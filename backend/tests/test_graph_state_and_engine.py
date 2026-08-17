import pytest
from uuid import uuid4
from app.services.graph.state import GraphState
from app.services.graph.nodes import (
    RouterNode,
    RetrieveNode,
    GradeDocumentsNode,
    QueryRewriteNode,
    UniversalSolverNode,
    GenerateNode,
    HallucinationGraderNode,
)
from app.services.graph.engine import ExamorasAgentGraph
from app.services.knowledge_graph.store import KnowledgeGraphStore
from app.services.retriever import RetrievedChunk


@pytest.mark.asyncio
async def test_router_node_classification():
    router = RouterNode()

    # Math test (VI)
    state_math = GraphState(query="Tính nguyên hàm của hàm số x * e^x", owner_id=uuid4())
    res_math = await router(state_math)
    assert res_math.language == "vi"
    assert res_math.subject in ("Toán", "Mathematics")
    assert res_math.domain_category == "stem"
    assert res_math.intent == "problem_solving"

    # Physics test (EN)
    state_phys = GraphState(query="Explain photoelectric effect formula and work function", owner_id=uuid4())
    res_phys = await router(state_phys)
    assert res_phys.language == "en"
    assert res_phys.subject in ("Vật lý", "Physics")
    assert res_phys.domain_category == "stem"
    assert res_phys.intent == "formula"

    # History test (VI)
    state_hist = GraphState(query="Ý nghĩa lịch sử của chiến dịch Điện Biên Phủ", owner_id=uuid4())
    res_hist = await router(state_hist)
    assert res_hist.language == "vi"
    assert res_hist.subject in ("Lịch sử", "History")
    assert res_hist.domain_category == "social_science"


@pytest.mark.asyncio
async def test_query_rewrite_and_loop_control():
    grader = GradeDocumentsNode()
    rewriter = QueryRewriteNode()

    state = GraphState(query="con lắc đơn", owner_id=uuid4(), subject="Vật lý")
    state.retrieved_chunks = []  # No chunks -> low score

    state = await grader(state)
    assert state.grade_score < 0.65

    state = await rewriter(state)
    assert state.retry_count == 1
    assert "định luật công thức" in state.rewritten_query


@pytest.mark.asyncio
async def test_agentic_graph_full_execution():
    kg_store = KnowledgeGraphStore()
    engine = ExamorasAgentGraph(retriever=None, kg_store=kg_store, dify_client=None)

    initial_state = GraphState(
        query="Tính tích phân của hàm số f(x) = 2x",
        owner_id=uuid4(),
    )

    # Mocking retrieved chunk
    initial_state.retrieved_chunks = [
        RetrievedChunk(
            id="c1",
            document_id=uuid4(),
            content="Công thức nguyên hàm cơ bản: \\int 2x dx = x^2 + C",
            metadata={"page": 12},
            document_name="SGK Toán 12.pdf",
            title="SGK Toán 12",
            score=0.95,
        )
    ]

    final_state = await engine.run(initial_state)

    assert final_state.subject in ("Toán", "Mathematics")
    assert len(final_state.citations) == 1
    assert final_state.citations[0]["page"] == 12
    assert final_state.is_grounded is True
    assert len(final_state.execution_trace) >= 5
