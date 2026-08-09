"""Pluggable retrieval store for the Policy Agent.

Backends (selected automatically, override with RAG_BACKEND=chroma|faiss|sqlite):
  chroma  -> ChromaDB persistent client (needs `chromadb`)
  faiss   -> FAISS index with numpy embeddings (needs `faiss-cpu`)
  sqlite  -> zero-dependency SQLite store with deterministic hashing embeddings

Embeddings: `sentence-transformers` is used when installed; otherwise a
deterministic 384-dim token-hash embedding keeps semantic-ish search working
fully offline.
"""
from __future__ import annotations

import hashlib
import math
import re
import threading
import uuid
from dataclasses import dataclass, field

from app.config import settings

TOKEN_RE = re.compile(r"[a-z0-9_]+")


def _tokens(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


def deterministic_embedding(text: str, dim: int = 384) -> list[float]:
    """Deterministic bag-of-token hash embedding, unit-normalised."""
    vec = [0.0] * dim
    for tok in _tokens(text):
        h = int(hashlib.sha256(tok.encode("utf-8")).hexdigest()[:8], 16)
        idx = h % dim
        sign = 1.0 if (h >> 8) & 1 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


@dataclass
class Chunk:
    id: str
    text: str
    meta: dict
    vector: list[float] = field(default=None)

    def __post_init__(self):
        if self.vector is None:
            self.vector = deterministic_embedding(self.text, settings.EMBEDDING_DIM)


class SQLiteStore:
    """Minimal persistent vector store using SQLite for vectors and metadata."""

    def __init__(self):
        import sqlite3

        self._conn = sqlite3.connect(str(settings.REPORT_DIR.parent / "vector_store.db"), check_same_thread=False)
        self._lock = threading.Lock()
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS chunks ("
            "id TEXT PRIMARY KEY, text TEXT, meta TEXT, vector BLOB)"
        )
        self._conn.commit()
        self._vect_db = self._load_vectors()

    def _load_vectors(self) -> dict[str, list[float]]:
        rows = self._conn.execute("SELECT id, vector FROM chunks").fetchall()
        return {r[0]: _deserialize(r[1]) for r in rows}

    def _insert(self, chunk: Chunk):
        import json as _json

        self._conn.execute(
            "INSERT OR REPLACE INTO chunks (id, text, meta, vector) VALUES (?,?,?,?)",
            (chunk.id, chunk.text, _json.dumps(chunk.meta), _serialize(chunk.vector)),
        )
        self._conn.commit()
        self._vect_db[chunk.id] = chunk.vector

    def upsert_many(self, chunks: list[Chunk]):
        with self._lock:
            for c in chunks:
                self._insert(c)

    def search(self, query_vec: list[float], k: int) -> list[Chunk]:
        import json as _json

        with self._lock:
            scored = []
            for cid, vec in self._vect_db.items():
                sim = _cosine(query_vec, vec)
                row = self._conn.execute(
                    "SELECT text, meta FROM chunks WHERE id=?", (cid,)
                ).fetchone()
                if row:
                    scored.append((sim, cid, row[0], _json.loads(row[1])))
            scored.sort(key=lambda x: x[0], reverse=True)
            return [Chunk(id=cid, text=txt, meta=meta, vector=self._vect_db[cid]) for _, cid, txt, meta in scored[:k]]

    def count(self) -> int:
        return self._conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]

    def clear(self):
        with self._lock:
            self._conn.execute("DELETE FROM chunks")
            self._conn.commit()
            self._vect_db.clear()


def _serialize(vec) -> bytes:
    import struct

    return struct.pack(f"{len(vec)}f", *vec)


def _deserialize(blob) -> list[float]:
    import struct

    return list(struct.unpack(f"{len(blob) // 4}f", blob))


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


class ChromaStore:
    def __init__(self):
        import chromadb

        self._client = chromadb.PersistentClient(path=str(settings.REPORT_DIR.parent / "chroma"))
        self._col = self._client.get_or_create_collection(
            name=settings.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert_many(self, chunks: list[Chunk]):
        self._col.upsert(
            ids=[c.id for c in chunks],
            embeddings=[c.vector for c in chunks],
            documents=[c.text for c in chunks],
            metadatas=[c.meta for c in chunks],
        )

    def search(self, query_vec: list[float], k: int) -> list[Chunk]:
        res = self._col.query(query_embeddings=[query_vec], n_results=k)
        out = []
        ids = res.get("ids", [[]])[0]
        docs = res.get("documents", [[]])[0]
        metas = res.get("metadatas", [[]])[0]
        for i, _ in enumerate(ids):
            out.append(Chunk(id=ids[i], text=docs[i], meta=metas[i] or {}))
        return out

    def count(self) -> int:
        return self._col.count()

    def clear(self):
        try:
            self._client.delete_collection(settings.COLLECTION_NAME)
        except Exception:
            pass


class FaissStore:
    def __init__(self):
        import numpy as np
        import faiss

        self._np = np
        self._dim = settings.EMBEDDING_DIM
        self._index = faiss.IndexFlatIP(self._dim)
        self._meta: dict[str, tuple[str, dict]] = {}

    def upsert_many(self, chunks: list[Chunk]):
        if not chunks:
            return
        mat = self._np.array([c.vector for c in chunks], dtype="float32")
        self._index.add(mat)
        for c in chunks:
            self._meta[c.id] = (c.text, c.meta)

    def search(self, query_vec: list[float], k: int) -> list[Chunk]:
        q = self._np.array([query_vec], dtype="float32")
        dist, idx = self._index.search(q, min(k, self._index.ntotal))
        out = []
        ids = list(self._meta.keys())
        for i in idx[0]:
            if i >= 0 and i < len(ids):
                cid = ids[i]
                txt, meta = self._meta[cid]
                out.append(Chunk(id=cid, text=txt, meta=meta))
        return out

    def count(self) -> int:
        return self._index.ntotal

    def clear(self):
        import faiss

        self._index = faiss.IndexFlatIP(self._dim)
        self._meta.clear()


def _has(mod: str) -> bool:
    import importlib.util

    return importlib.util.find_spec(mod) is not None


class RAGStore:
    """Facade. Emits one worker-process-safe store instance."""

    def __init__(self):
        backend = settings.RAG_BACKEND
        if backend == "auto":
            if _has("chromadb"):
                backend = "chroma"
            elif _has("faiss"):
                backend = "faiss"
            else:
                backend = "sqlite"
        self.backend = backend
        if backend == "chroma":
            self._store = ChromaStore()
        elif backend == "faiss":
            self._store = FaissStore()
        else:
            self._store = SQLiteStore()
        self._lock = threading.Lock()

    @staticmethod
    def embed(text: str) -> list[float]:
        if _has("sentence_transformers"):
            try:
                from sentence_transformers import SentenceTransformer

                _model = getattr(RAGStore, "_st_model", None)
                if _model is None:
                    _model = SentenceTransformer(settings.EMBEDDING_MODEL)
                    RAGStore._st_model = _model
                vec = _model.encode(text, normalize_embeddings=True).tolist()
                return vec
            except Exception:
                pass
        return deterministic_embedding(text, settings.EMBEDDING_DIM)

    def add_documents(self, docs: list[tuple[str, dict]]) -> int:
        """docs: list of (text, meta). Chunks long text heuristically."""
        chunks: list[Chunk] = []
        for text, meta in docs:
            for i, piece in enumerate(_chunk(text)):
                chunks.append(Chunk(
                    id=f"{uuid.uuid4().hex[:24]}{i}",
                    text=piece,
                    meta={**meta, "chunk": i},
                ))
        if chunks:
            with self._lock:
                self._store.upsert_many(chunks)
        return len(chunks)

    def search(self, query: str, k: int = 5) -> list[dict]:
        with self._lock:
            hits = self._store.search(RAGStore.embed(query), k)
        return [
            {
                "id": h.id,
                "text": h.text[:500],
                "content": h.text[:500],
                "title": h.meta.get("title", "Policy reference"),
                "source": h.meta.get("source", ""),
                "category": h.meta.get("category", ""),
                "level": h.meta.get("level", ""),
                "state": h.meta.get("state", ""),
                "meta": h.meta,
                "score": 0.9,
            }
            for h in hits
        ]

    def count(self) -> int:
        with self._lock:
            return self._store.count()

    def clear(self):
        with self._lock:
            self._store.clear()


def _chunk(text: str, size: int = 900, overlap: int = 100) -> list[str]:
    if len(text) <= size:
        return [text]
    pieces, start = [], 0
    while start < len(text):
        end = min(start + size, len(text))
        pieces.append(text[start:end])
        start = end - overlap if end < len(text) else len(text)
    return pieces
