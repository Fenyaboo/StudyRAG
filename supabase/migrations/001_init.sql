-- StudyRAG V2 initial schema
-- Run this migration in Supabase SQL Editor or with Supabase CLI.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- PostgreSQL marks unaccent(text) as STABLE. Wrapping the dictionary overload
-- as IMMUTABLE lets it be used in the stored full-text search column.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
    SELECT extensions.unaccent('extensions.unaccent'::regdictionary, input)
$$;

CREATE TABLE IF NOT EXISTS public.documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_key     TEXT NOT NULL,
    title           TEXT NOT NULL,
    filename        TEXT NOT NULL,
    file_hash       TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    subject         TEXT NOT NULL DEFAULT 'Chung'
                    CHECK (subject IN ('Toán', 'Lý', 'Hóa', 'Chung')),
    doc_type        TEXT NOT NULL DEFAULT 'exam'
                    CHECK (doc_type IN ('exam', 'textbook')),
    status          TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'ready', 'failed', 'ocr_required')),
    page_count      INT NOT NULL DEFAULT 0 CHECK (page_count >= 0),
    chunk_count     INT NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_owner_file UNIQUE (owner_id, file_hash)
);

CREATE INDEX IF NOT EXISTS idx_docs_owner ON public.documents(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_status ON public.documents(owner_id, status);

CREATE TABLE IF NOT EXISTS public.document_chunks (
    id          TEXT PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    embedding   extensions.vector(768),
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_tsv TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple'::regconfig, public.immutable_unaccent(content))
    ) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON public.document_chunks USING gin(content_tsv);
CREATE INDEX IF NOT EXISTS idx_chunks_vec ON public.document_chunks
    USING hnsw (embedding extensions.vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE TABLE IF NOT EXISTS public.conversations (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title                TEXT NOT NULL DEFAULT 'Hội thoại mới',
    dify_conversation_id TEXT,
    document_id          UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_owner ON public.conversations(owner_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    citations       JSONB NOT NULL DEFAULT '[]'::jsonb,
    latency_ms      INT,
    dify_message_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_msg_conv ON public.messages(conversation_id, created_at);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_docs_touch ON public.documents;
CREATE TRIGGER trg_docs_touch BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_conv_touch ON public.conversations;
CREATE TRIGGER trg_conv_touch BEFORE UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owner_documents ON public.documents;
CREATE POLICY owner_documents ON public.documents
    FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_chunks ON public.document_chunks;
CREATE POLICY owner_chunks ON public.document_chunks
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.documents d
        WHERE d.id = document_chunks.document_id
          AND d.owner_id = auth.uid()
    ));

DROP POLICY IF EXISTS owner_conversations ON public.conversations;
CREATE POLICY owner_conversations ON public.conversations
    FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS owner_messages ON public.messages;
CREATE POLICY owner_messages ON public.messages
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = messages.conversation_id
          AND c.owner_id = auth.uid()
    ));
