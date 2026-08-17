import asyncio
from collections.abc import AsyncIterator
from typing import Any
from app.services.dify import DifyClient
from app.services.graph.nodes import (
    GenerateNode,
    GradeDocumentsNode,
    HallucinationGraderNode,
    QueryRewriteNode,
    RetrieveNode,
    RouterNode,
    UniversalSolverNode,
)
from app.services.graph.state import GraphState
from app.services.knowledge_graph.store import KnowledgeGraphStore
from app.services.retriever import HybridRetriever


class ExamorasAgentGraph:
    """Agentic RAG StateGraph Engine cho Examoras."""

    def __init__(
        self,
        retriever: HybridRetriever | None = None,
        kg_store: KnowledgeGraphStore | None = None,
        dify_client: DifyClient | None = None,
    ) -> None:
        self.retriever = retriever
        self.kg_store = kg_store
        self.dify_client = dify_client

        # Khởi tạo các node
        self.router_node = RouterNode()
        self.retrieve_node = RetrieveNode(retriever, kg_store)
        self.grade_node = GradeDocumentsNode()
        self.rewrite_node = QueryRewriteNode()
        self.solver_node = UniversalSolverNode(kg_store)
        self.generate_node = GenerateNode(dify_client)
        self.hallucination_node = HallucinationGraderNode()

    async def run(self, state: GraphState) -> GraphState:
        """Thực thi toàn bộ luồng StateGraph và trả về trạng thái kết thúc."""
        # 1. Router Node
        state = await self.router_node(state)

        # 2. Retrieval Loop với Grading & Query Rewriting
        while True:
            state = await self.retrieve_node(state)
            state = await self.grade_node(state)

            if state.grade_score < 0.65 and state.retry_count < state.max_retries:
                state = await self.rewrite_node(state)
            else:
                break

        # 3. Solver Node
        state = await self.solver_node(state)

        # 4. Generate Node
        state = await self.generate_node(state)

        # 5. Hallucination Grader Node
        state = await self.hallucination_node(state)

        return state

    async def stream(self, state: GraphState) -> AsyncIterator[dict[str, Any]]:
        """Thực thi StateGraph và stream từng sự kiện qua SSE."""
        # 1. Router
        yield {"event": "node_start", "node": "RouterNode"}
        state = await self.router_node(state)
        yield {
            "event": "node_complete",
            "node": "RouterNode",
            "data": {
                "language": state.language,
                "subject": state.subject,
                "domain": state.domain_category,
                "intent": state.intent,
            },
        }

        # 2. Retrieval Loop
        while True:
            yield {"event": "node_start", "node": "RetrieveNode"}
            state = await self.retrieve_node(state)
            yield {
                "event": "node_complete",
                "node": "RetrieveNode",
                "data": {
                    "chunks_count": len(state.retrieved_chunks),
                    "kg_nodes_count": len(state.kg_subgraph.nodes),
                },
            }

            yield {"event": "node_start", "node": "GradeDocumentsNode"}
            state = await self.grade_node(state)
            yield {
                "event": "node_complete",
                "node": "GradeDocumentsNode",
                "data": {"grade_score": state.grade_score},
            }

            if state.grade_score < 0.65 and state.retry_count < state.max_retries:
                yield {"event": "node_start", "node": "QueryRewriteNode"}
                state = await self.rewrite_node(state)
                yield {
                    "event": "node_complete",
                    "node": "QueryRewriteNode",
                    "data": {"retry_count": state.retry_count, "rewritten_query": state.rewritten_query},
                }
            else:
                break

        # 3. Universal Solver
        yield {"event": "node_start", "node": "UniversalSolverNode"}
        state = await self.solver_node(state)
        yield {
            "event": "node_complete",
            "node": "UniversalSolverNode",
            "data": {"citations": state.citations},
        }

        # 4. Generate Node with streaming tokens
        yield {"event": "node_start", "node": "GenerateNode"}
        if self.dify_client and self.dify_client.configured:
            answer_parts: list[str] = []
            try:
                async for event in self.dify_client.stream_chat(
                    query=state.query,
                    context=state.context_text,
                    user_id=str(state.owner_id),
                ):
                    if event.answer:
                        answer_parts.append(event.answer)
                        yield {"event": "token", "delta": event.answer}
                state.final_answer = "".join(answer_parts)
            except Exception as exc:
                err_msg = f"Lỗi sinh câu trả lời: {exc}"
                state.final_answer = err_msg
                yield {"event": "token", "delta": err_msg}
        else:
            state = await self.generate_node(state)
            yield {"event": "token", "delta": state.final_answer}

        yield {"event": "node_complete", "node": "GenerateNode"}

        # 5. Hallucination Grader
        yield {"event": "node_start", "node": "HallucinationGraderNode"}
        state = await self.hallucination_node(state)
        yield {
            "event": "node_complete",
            "node": "HallucinationGraderNode",
            "data": {"is_grounded": state.is_grounded, "grounding_score": state.grounding_score},
        }

        # Final Event
        yield {
            "event": "done",
            "data": {
                "final_answer": state.final_answer,
                "citations": state.citations,
                "trace": state.execution_trace,
                "is_grounded": state.is_grounded,
            },
        }
