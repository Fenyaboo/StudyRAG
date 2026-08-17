import re
import uuid
from typing import Any
from app.services.knowledge_graph.ontology import (
    EntityType,
    KnowledgeEdge,
    KnowledgeNode,
    KnowledgeSubgraph,
    RelationType,
)

# Regular expression patterns for extracting formulas, concepts, and relations
LATEX_INLINE_PATTERN = re.compile(r"\$(.+?)\$")
LATEX_BLOCK_PATTERN = re.compile(r"\$\$(.+?)\$\$", re.DOTALL)
FORMULA_DECLARATION_PATTERN = re.compile(
    r"(?:công thức|định luật|định lý|phương trình|formula|theorem|law|equation)\s*[:\-–]?\s*([^\n\.\;]+)",
    re.IGNORECASE,
)
CONCEPT_DEFINITION_PATTERN = re.compile(
    r"(?:khái niệm|định nghĩa|là gì|is defined as|refers to)\s*[:\-–]?\s*([^\n\.\;]+)",
    re.IGNORECASE,
)
HISTORICAL_DATE_PATTERN = re.compile(
    r"(?:ngày|năm|tháng|in year|on|dated)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}|\d{4})\b",
    re.IGNORECASE,
)


class MultiDisciplineExtractor:
    """Trích xuất thực thể, công thức và quan hệ tri thức từ tài liệu đa môn học."""

    def __init__(self) -> None:
        pass

    def extract_from_text(
        self,
        text: str,
        *,
        subject: str = "Chung",
        language: str = "vi",
        doc_id: str | None = None,
    ) -> KnowledgeSubgraph:
        nodes: list[KnowledgeNode] = []
        edges: list[KnowledgeEdge] = []
        node_lookup: dict[str, KnowledgeNode] = {}

        def add_node(name: str, entity_type: EntityType, formula: str | None = None, desc: str = "") -> KnowledgeNode:
            clean_name = name.strip()[:100]
            if not clean_name:
                clean_name = "Khái niệm"
            key = clean_name.lower()
            if key in node_lookup:
                existing = node_lookup[key]
                if formula and not existing.formula_latex:
                    existing.formula_latex = formula
                return existing

            node_id = str(uuid.uuid4())
            node = KnowledgeNode(
                id=node_id,
                name=clean_name,
                entity_type=entity_type,
                subject=subject,
                language="vi" if language.startswith("vi") else "en",
                description=desc[:300],
                formula_latex=formula,
                metadata={"doc_id": doc_id} if doc_id else {},
            )
            node_lookup[key] = node
            nodes.append(node)
            return node

        def add_edge(source: KnowledgeNode, target: KnowledgeNode, rel: RelationType) -> None:
            if source.id == target.id:
                return
            edge_id = str(uuid.uuid4())
            edge = KnowledgeEdge(
                id=edge_id,
                source_node_id=source.id,
                target_node_id=target.id,
                relation_type=rel,
                weight=1.0,
            )
            edges.append(edge)

        # 1. Trích xuất LaTeX formulas
        for block_formula in LATEX_BLOCK_PATTERN.findall(text):
            clean_formula = block_formula.strip()
            if clean_formula:
                f_node = add_node(
                    name=clean_formula[:40],
                    entity_type=EntityType.FORMULA,
                    formula=clean_formula,
                    desc="Công thức toán/lý/hóa trích xuất từ tài liệu",
                )

        for inline_formula in LATEX_INLINE_PATTERN.findall(text):
            clean_formula = inline_formula.strip()
            if len(clean_formula) > 3 and any(char in clean_formula for char in ("=", "+", "-", "\\", "^", "_")):
                f_node = add_node(
                    name=clean_formula[:40],
                    entity_type=EntityType.FORMULA,
                    formula=clean_formula,
                    desc="Công thức trích xuất",
                )

        # 2. Trích xuất định lý / định luật / phương trình
        for match in FORMULA_DECLARATION_PATTERN.finditer(text):
            phrase = match.group(1).strip()
            if 3 < len(phrase) < 80:
                t_node = add_node(
                    name=phrase,
                    entity_type=EntityType.THEOREM_LAW,
                    desc=f"Định lý / Quy tắc thuộc môn {subject}",
                )

        # 3. Trích xuất mốc thời gian / sự kiện lịch sử (nếu là môn Sử / Xã hội)
        if "sử" in subject.lower() or "history" in subject.lower():
            for match in HISTORICAL_DATE_PATTERN.finditer(text):
                date_str = match.group(1)
                e_node = add_node(
                    name=f"Sự kiện mốc {date_str}",
                    entity_type=EntityType.HISTORICAL_EVENT,
                    desc=f"Mốc lịch sử: {date_str}",
                )

        # 4. Tạo liên kết quan hệ (edges) giữa các node liên tiếp trong cùng đoạn
        if len(nodes) >= 2:
            for i in range(len(nodes) - 1):
                add_edge(nodes[i], nodes[i + 1], RelationType.RELATED_TO)

        return KnowledgeSubgraph(nodes=nodes, edges=edges)
