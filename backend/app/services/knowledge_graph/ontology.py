from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


class EntityType(str, Enum):
    CONCEPT = "concept"
    FORMULA = "formula"
    THEOREM_LAW = "theorem_law"
    HISTORICAL_EVENT = "historical_event"
    LITERARY_WORK = "literary_work"
    GRAMMAR_RULE = "grammar_rule"
    PROBLEM_TYPE = "problem_type"
    TOPIC = "topic"
    SUBJECT = "subject"


class RelationType(str, Enum):
    BELONGS_TO = "belongs_to"
    PREREQUISITE_OF = "prerequisite_of"
    APPLIES_TO = "applies_to"
    CONTAINS_FORMULA = "contains_formula"
    CAUSED_BY = "caused_by"
    DEFINED_AS = "defined_as"
    RELATED_TO = "related_to"


class KnowledgeNode(BaseModel):
    id: str
    name: str
    entity_type: EntityType
    subject: str = "Chung"
    language: Literal["vi", "en"] = "vi"
    description: str = ""
    formula_latex: str | None = None
    aliases: list[str] = Field(default_factory=list)
    metadata: dict[str, object] = Field(default_factory=dict)


class KnowledgeEdge(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    relation_type: RelationType
    weight: float = 1.0
    metadata: dict[str, object] = Field(default_factory=dict)


class KnowledgeSubgraph(BaseModel):
    nodes: list[KnowledgeNode] = Field(default_factory=list)
    edges: list[KnowledgeEdge] = Field(default_factory=list)
