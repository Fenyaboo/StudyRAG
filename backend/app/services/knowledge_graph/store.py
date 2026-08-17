import asyncio
from typing import Any
from uuid import UUID
import asyncpg

from app.services.knowledge_graph.extractor import MultiDisciplineExtractor
from app.services.knowledge_graph.ontology import (
    KnowledgeEdge,
    KnowledgeNode,
    KnowledgeSubgraph,
    RelationType,
)


class KnowledgeGraphStore:
    """Quản lý lưu trữ và truy vấn đồ thị tri thức (In-Memory + Postgres)."""

    def __init__(self, pool: asyncpg.Pool | None = None) -> None:
        self.pool = pool
        self.extractor = MultiDisciplineExtractor()
        # In-memory graph cache: node_id -> KnowledgeNode
        self._nodes: dict[str, KnowledgeNode] = {}
        # In-memory edges: list of KnowledgeEdge
        self._edges: list[KnowledgeEdge] = []
        # Adjacency map: node_id -> set of neighbor node_ids
        self._adj: dict[str, set[str]] = {}

    def add_subgraph(self, subgraph: KnowledgeSubgraph) -> None:
        """Nạp subgraph vào in-memory graph index."""
        for node in subgraph.nodes:
            self._nodes[node.id] = node
            if node.id not in self._adj:
                self._adj[node.id] = set()

        for edge in subgraph.edges:
            self._edges.append(edge)
            self._adj.setdefault(edge.source_node_id, set()).add(edge.target_node_id)
            self._adj.setdefault(edge.target_node_id, set()).add(edge.source_node_id)

    def search_nodes(self, query: str, *, subject: str | None = None, limit: int = 5) -> list[KnowledgeNode]:
        """Tìm các node có tên hoặc mô tả khớp với query."""
        terms = [t.lower() for t in query.split() if len(t) > 2]
        if not terms:
            return list(self._nodes.values())[:limit]

        matched: list[tuple[int, KnowledgeNode]] = []
        for node in self._nodes.values():
            if subject and subject != "Chung" and node.subject != "Chung" and node.subject.lower() != subject.lower():
                continue
            name_lower = node.name.lower()
            desc_lower = node.description.lower()
            score = sum(2 for term in terms if term in name_lower) + sum(1 for term in terms if term in desc_lower)
            if score > 0:
                matched.append((score, node))

        matched.sort(key=lambda x: x[0], reverse=True)
        return [node for _, node in matched[:limit]]

    def get_k_hop_subgraph(self, start_node_ids: list[str], k: int = 2) -> KnowledgeSubgraph:
        """Thực hiện k-hop traversal trên đồ thị tri thức bắt đầu từ start_node_ids."""
        visited: set[str] = set()
        queue: list[tuple[str, int]] = [(nid, 0) for nid in start_node_ids if nid in self._nodes]

        while queue:
            curr_id, depth = queue.pop(0)
            if curr_id in visited or depth > k:
                continue
            visited.add(curr_id)

            if depth < k:
                for neighbor in self._adj.get(curr_id, set()):
                    if neighbor not in visited:
                        queue.append((neighbor, depth + 1))

        nodes = [self._nodes[nid] for nid in visited if nid in self._nodes]
        edges = [
            e for e in self._edges if e.source_node_id in visited and e.target_node_id in visited
        ]
        return KnowledgeSubgraph(nodes=nodes, edges=edges)

    def format_graph_context_for_prompt(self, subgraph: KnowledgeSubgraph) -> str:
        """Định dạng subgraph thành ngữ cảnh có cấu trúc để đưa vào prompt LLM."""
        if not subgraph.nodes:
            return ""

        lines: list[str] = ["### TRI THỨC ĐỒ THỊ LIÊN QUAN (KNOWLEDGE GRAPH):"]
        for node in subgraph.nodes:
            item = f"- [{node.entity_type.value.upper()}] **{node.name}** ({node.subject})"
            if node.formula_latex:
                item += f": ${node.formula_latex}$"
            if node.description:
                item += f" — {node.description}"
            lines.append(item)

        if subgraph.edges:
            lines.append("\n**Quan hệ liên kết:**")
            for edge in subgraph.edges[:8]:
                src = self._nodes.get(edge.source_node_id)
                dst = self._nodes.get(edge.target_node_id)
                if src and dst:
                    lines.append(f"- ({src.name}) --[{edge.relation_type.value}]--> ({dst.name})")

        return "\n".join(lines)

    async def ingest_document_chunks(
        self,
        owner_id: UUID,
        document_id: UUID,
        chunks: list[dict[str, Any]],
        *,
        subject: str = "Chung",
        language: str = "vi",
    ) -> KnowledgeSubgraph:
        """Trích xuất và lập chỉ mục đồ thị cho các chunk tài liệu."""
        all_nodes: list[KnowledgeNode] = []
        all_edges: list[KnowledgeEdge] = []

        for chunk in chunks:
            content = str(chunk.get("content", ""))
            subgraph = self.extractor.extract_from_text(
                content,
                subject=subject,
                language=language,
                doc_id=str(document_id),
            )
            self.add_subgraph(subgraph)
            all_nodes.extend(subgraph.nodes)
            all_edges.extend(subgraph.edges)

        # Lưu vào PostgreSQL nếu database pool có sẵn
        if self.pool:
            try:
                async with self.pool.acquire() as conn:
                    # Ghi nodes
                    for node in all_nodes:
                        await conn.execute(
                            """
                            INSERT INTO public.knowledge_nodes (id, owner_id, document_id, name, entity_type, subject, language, description, formula_latex, metadata)
                            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
                            ON CONFLICT (id) DO NOTHING
                            """,
                            node.id,
                            owner_id,
                            document_id,
                            node.name,
                            node.entity_type.value,
                            node.subject,
                            node.language,
                            node.description,
                            node.formula_latex,
                            node.metadata,
                        )
            except Exception:
                # Không để lỗi persistence làm hỏng in-memory ingest
                pass

        return KnowledgeSubgraph(nodes=all_nodes, edges=all_edges)
