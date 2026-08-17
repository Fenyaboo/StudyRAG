from dataclasses import dataclass, field
from typing import Any, Literal
from uuid import UUID

from app.services.knowledge_graph.ontology import KnowledgeSubgraph
from app.services.retriever import RetrievedChunk


@dataclass
class GraphState:
    """Trạng thái chia sẻ xuyên suốt các node trong Agentic RAG StateGraph."""

    query: str
    owner_id: UUID
    document_id: UUID | None = None

    # Language & Subject Routing
    language: Literal["vi", "en"] = "vi"
    subject: str = "Chung"
    domain_category: Literal["stem", "humanities", "languages", "social_science", "general"] = "general"
    intent: str = "general_qa"
    requires_retrieval: bool = True

    # Retrieval & Knowledge Graph Context
    rewritten_query: str = ""
    retrieved_chunks: list[RetrievedChunk] = field(default_factory=list)
    kg_subgraph: KnowledgeSubgraph = field(default_factory=lambda: KnowledgeSubgraph())
    grade_score: float = 1.0
    retry_count: int = 0
    max_retries: int = 2

    # Reasoning & Generation
    reasoning_plan: list[str] = field(default_factory=list)
    context_text: str = ""
    citations: list[dict[str, Any]] = field(default_factory=list)
    final_answer: str = ""
    is_grounded: bool = True
    grounding_score: float = 1.0

    # Node Execution History & Telemetry
    execution_trace: list[dict[str, Any]] = field(default_factory=list)

    def add_trace(self, node_name: str, status: str, detail: str = "", latency_ms: float = 0.0) -> None:
        self.execution_trace.append(
            {
                "node": node_name,
                "status": status,
                "detail": detail,
                "latency_ms": round(latency_ms, 2),
            }
        )
