from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.agents.eligibility_engine import evaluate_op
from app.core.security import get_current_user
from app.database import get_db
from app.models.models import QuestionnaireSession, User
from app.seed.questionnaire import QUESTIONS, SUPPORTED_VOICE

router = APIRouter(prefix="/questionnaire", tags=["questionnaire"])


def _skip_met(rule: dict, answers: dict) -> bool:
    if "any" in rule:
        return any(_skip_met(r, answers) for r in rule["any"])
    field = rule["field"]
    value = answers.get(field)
    op = rule.get("op", "eq")
    expected = rule.get("value")
    matched, _ = evaluate_op(value, op, expected)
    return matched


def _next_index(session: QuestionnaireSession, from_idx: int | None = None) -> int | None:
    idx = from_idx if from_idx is not None else session.current_index
    while idx < len(QUESTIONS):
        q = QUESTIONS[idx]
        skip_rules = q.get("skip", [])
        if skip_rules and all(_skip_met(r, session.answers) for r in skip_rules):
            idx += 1
            continue
        return idx
    return None


def _index_of(key: str) -> int:
    for i, q in enumerate(QUESTIONS):
        if q["key"] == key:
            return i
    return len(QUESTIONS) - 1


def _question_out(q: dict, answers: dict, completed: bool) -> dict:
    return {
        "key": q["key"], "kind": q["kind"], "prompt": q["prompt"],
        "hint": q.get("hint", ""), "min": q.get("min"), "max": q.get("max"),
        "options": q.get("options", []),
        "value": answers.get(q["key"]),
    }


def _get_session(db: Session, user: User) -> QuestionnaireSession:
    s = db.query(QuestionnaireSession).filter_by(user_id=user.id).first()
    if s is None:
        s = QuestionnaireSession(user_id=user.id)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _save_progress(s: QuestionnaireSession) -> None:
    answered = len([k for k in s.answers if s.answers.get(k) not in (None, "", [], False)])
    total = len(QUESTIONS)
    s.progress = round(min(answered / max(total, 1) * 100, 100), 1)
    if answered >= total - 2:
        s.completed = True


@router.get("/start")
def start(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = _get_session(db, user)
    idx = _next_index(s)
    if idx is None:
        return {"session": {"progress": 100, "completed": True},
                "question": None, "completed": True}
    s.current_index = idx
    db.commit()
    return {
        "session": {"progress": s.progress, "completed": s.completed, "answers": s.answers},
        "question": _question_out(QUESTIONS[idx], s.answers, s.completed),
        "completed": False,
    }


@router.get("/state")
def state(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = _get_session(db, user)
    return {
        "progress": s.progress, "completed": s.completed,
        "answers": s.answers, "visited": s.visited,
        "total_questions": len(QUESTIONS),
        "languages": SUPPORTED_VOICE,
    }


@router.post("/answer")
def answer(payload: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    key = payload.get("key")
    value = payload.get("value")
    s = _get_session(db, user)
    if key is None:
        raise HTTPException(status_code=400, detail="Missing answer key")
    s.answers[key] = value
    if key not in s.visited:
        s.visited.append(key)
    _save_progress(s)
    s.current_index = _index_of(key) + 1
    db.commit()

    nxt = _next_index(s, s.current_index)
    if nxt is None:
        s.completed = True
        db.commit()
        return {"question": None, "progress": 100, "completed": True, "answers": s.answers}
    s.current_index = nxt
    db.commit()
    return {
        "question": _question_out(QUESTIONS[nxt], s.answers, False),
        "progress": s.progress,
        "completed": False,
        "answers": s.answers,
    }


@router.post("/resume")
def resume(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = _get_session(db, user)
    if s.completed:
        return {"progress": 100, "completed": True, "question": None, "answers": s.answers}
    nxt = _next_index(s)
    if nxt is not None:
        s.current_index = nxt
        db.commit()
    return {
        "progress": s.progress, "completed": False,
        "question": _question_out(QUESTIONS[nxt], s.answers, False) if nxt is not None else None,
        "answers": s.answers,
    }


@router.post("/reset")
def reset(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = _get_session(db, user)
    s.answers = {}
    s.visited = []
    s.current_index = 0
    s.progress = 0.0
    s.completed = False
    db.commit()
    return {"ok": True}
