-- Migration 003: Mở rộng subject cho mọi môn học và thêm bảng Knowledge Graph
-- Examoras V2

-- 1. Nới lỏng CHECK constraint trên bảng documents để hỗ trợ tất cả các môn học
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_subject_check;

-- 2. Bảng lưu trữ Knowledge Graph Nodes
CREATE TABLE IF NOT EXISTS public.knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- 'concept', 'formula', 'theorem_law', 'historical_event', 'literary_work', 'grammar_rule', 'problem_type', 'topic', 'subject'
    subject TEXT NOT NULL DEFAULT 'Chung',
    language TEXT NOT NULL DEFAULT 'vi',
    description TEXT,
    formula_latex TEXT,
    aliases TEXT[] DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes cho knowledge_nodes
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_owner ON public.knowledge_nodes(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_doc ON public.knowledge_nodes(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_name ON public.knowledge_nodes(owner_id, name);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_subject ON public.knowledge_nodes(owner_id, subject);

-- 3. Bảng lưu trữ Knowledge Graph Edges (Quan hệ Triplets: Source -> Relation -> Target)
CREATE TABLE IF NOT EXISTS public.knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL, -- 'belongs_to', 'prerequisite_of', 'applies_to', 'contains_formula', 'caused_by', 'defined_as', 'related_to'
    weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes cho knowledge_edges
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_owner ON public.knowledge_edges(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_source ON public.knowledge_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_target ON public.knowledge_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_relation ON public.knowledge_edges(relation_type);

-- 4. Bật Row Level Security (RLS)
ALTER TABLE public.knowledge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own knowledge nodes"
    ON public.knowledge_nodes
    FOR ALL
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can manage their own knowledge edges"
    ON public.knowledge_edges
    FOR ALL
    USING (auth.uid() = owner_id);
