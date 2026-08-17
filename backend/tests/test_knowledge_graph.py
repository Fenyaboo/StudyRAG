import pytest
from uuid import uuid4
from app.services.knowledge_graph.extractor import MultiDisciplineExtractor
from app.services.knowledge_graph.ontology import EntityType, RelationType
from app.services.knowledge_graph.store import KnowledgeGraphStore


def test_extractor_extracts_formulas_and_theorems():
    extractor = MultiDisciplineExtractor()
    text = (
        "Định lý Pytago: Trong tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.\n"
        "Công thức: $$a^2 + b^2 = c^2$$\n"
        "Đối với dao động điều hòa: chu kỳ con lắc lò xo là $T = 2\\pi \\sqrt{\\frac{m}{k}}$."
    )

    subgraph = extractor.extract_from_text(text, subject="Toán")
    assert len(subgraph.nodes) >= 2

    formula_nodes = [n for n in subgraph.nodes if n.entity_type == EntityType.FORMULA]
    assert len(formula_nodes) >= 1
    assert any("a^2 + b^2 = c^2" in (n.formula_latex or "") for n in formula_nodes)


def test_knowledge_graph_store_traversal_and_prompt_formatting():
    store = KnowledgeGraphStore()
    extractor = MultiDisciplineExtractor()

    text1 = "Công thức tích phân từng phần: $$\\int u dv = uv - \\int v du$$"
    text2 = "Phương pháp tích phân từng phần áp dụng cho hàm số $P(x) \\cdot e^x$"

    sub1 = extractor.extract_from_text(text1, subject="Toán")
    sub2 = extractor.extract_from_text(text2, subject="Toán")

    store.add_subgraph(sub1)
    store.add_subgraph(sub2)

    # Search nodes
    matched = store.search_nodes("tích phân", subject="Toán")
    assert len(matched) >= 1

    # k-hop subgraph
    k_sub = store.get_k_hop_subgraph([matched[0].id], k=2)
    assert len(k_sub.nodes) >= 1

    # Format context
    ctx = store.format_graph_context_for_prompt(k_sub)
    assert "TRI THỨC ĐỒ THỊ LIÊN QUAN" in ctx
