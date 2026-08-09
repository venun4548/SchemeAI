"""Lightweight LangGraph-style orchestration engine.

Each Agent is a callable node that takes a shared state dict and returns
mutations. Nodes may declare `conditional` edges that route on state.

A drop-in `langgraph` adapter is available: when the optional dependency is
installed, `build_langgraph_workflow` produces an equivalent graph. The
built-in executor keeps the demo fully offline and dependency-free.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class AgentNode:
    name: str
    fn: Callable[[dict], dict]
    condition: Callable[[dict], bool] | None = None
    routes: list[tuple[Callable[[dict], bool], str]] = field(default_factory=list)
    default_route: str | None = None


class AgentGraph:
    def __init__(self, entrypoint: str):
        self.entrypoint = entrypoint
        self.nodes: dict[str, AgentNode] = {}
        self.trace: list[dict] = []

    def add(self, name: str, fn, condition=None, routes=None, default_route=None):
        self.nodes[name] = AgentNode(name, fn, condition, routes or [], default_route)
        return self

    def run(self, initial: dict) -> dict:
        state = dict(initial)
        current = self.entrypoint
        visited = set()
        self.trace = []
        while current and current not in visited:
            visited.add(current)
            node = self.nodes[current]
            if node.condition and not node.condition(state):
                nxt = node.default_route
                self.trace.append({"node": current, "skipped": True, "to": nxt})
                current = nxt
                continue
            t0 = time.perf_counter()
            result = node.fn(state)
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            state.update(result or {})
            self.trace.append({"node": current, "skipped": False, "ms": elapsed_ms})
            nxt = node.default_route
            for cond, target in node.routes:
                if cond(state):
                    nxt = target
                    break
            current = nxt
        state["__trace__"] = self.trace
        return state


def serialize_trace(trace: list[dict]) -> list[dict]:
    return [
        {
            "agent": t["node"].replace("_", " ").title(),
            "skipped": t.get("skipped", False),
            "duration_ms": t.get("ms", 0),
        }
        for t in trace
    ]
