# Examoras (examoras.site) — Architecture & Code Graph Documentation

Hệ thống trợ lý học tập và ôn thi AI toàn cầu đa môn học và đa ngôn ngữ (**Examoras** — domain: `examoras.site`, API: `api.examoras.site`).

---

## 1. Overall System Architecture Graph

```mermaid
graph TB
    subgraph ClientLayer["🖥️ Frontend Client — examoras.site (Vercel)"]
        Landing["Landing Page<br/>(examoras.site)"]
        DemoHub["Live Demo Hub<br/>(/demo)"]
        AuthView["Auth Portal<br/>(/auth)"]
        DashboardView["Workspace Dashboard<br/>(/dashboard)"]
        LibraryView["Document Library<br/>(/library)"]
        ChatView["Agentic Graph Chat<br/>(/chat)"]
    end

    subgraph EdgeProxy["☁️ Reverse Proxy & Security Layer"]
        Nginx["Nginx Reverse Proxy<br/>api.examoras.site (SSL/TLS)"]
        RateLimit["In-Memory Token Bucket<br/>Rate Limiter"]
    end

    subgraph BackendAPI["🚀 FastAPI Backend Server — api.examoras.site (AWS VPS)"]
        AppRouter["API Router /api/v1"]
        AuthDep["JWT & RLS Verification"]
        
        subgraph Services["Core Application Services"]
            DocService["PDF Parser & Adaptive Chunker"]
            HybridRetriever["Hybrid Retriever<br/>(Dense Bi-Encoder + TSVector BM25)"]
            KGService["Knowledge Graph Store<br/>& Triplet Traversal"]
            AgenticEngine["Examoras Agentic StateGraph Engine"]
            StorageService["Tencent Cloud COS Storage"]
        end
    end

    subgraph ExternalCloud["🔌 Cloud Infrastructure & Services"]
        SupabaseAuth["Supabase Auth<br/>(OAuth / JWT / JWKS)"]
        SupabaseDB[("Supabase PostgreSQL<br/>(pgvector + tsvector + KG Tables)")]
        TencentCOS[("Tencent Cloud COS<br/>(Cloud Object Storage - S3 API)")]
        DifyLLM["Dify Pro / LLM Engine<br/>(Streaming SSE)"]
    end

    Landing --> AuthView
    DemoHub --> Landing
    AuthView --> DashboardView
    DashboardView --> LibraryView
    DashboardView --> ChatView
    
    ClientLayer -->|"HTTPS / WSS"| Nginx
    Nginx --> RateLimit
    RateLimit --> AppRouter
    AppRouter --> AuthDep
    AuthDep -.->|"Verify JWT"| SupabaseAuth
    
    LibraryView -->|"Upload PDF"| DocService
    DocService --> StorageService
    StorageService -->|"Presigned S3 API"| TencentCOS
    DocService -->|"Vector Embeddings"| SupabaseDB
    DocService -->|"Extract Triplets"| KGService
    KGService -->|"Store Graph Nodes/Edges"| SupabaseDB

    ChatView -->|"SSE Streaming"| AgenticEngine
    AgenticEngine --> HybridRetriever
    AgenticEngine --> KGService
    HybridRetriever <-->|"Cosine Similarity"| SupabaseDB
    AgenticEngine -->|"Stream Generation"| DifyLLM
```

---

## 2. Universal Document Ingestion & Knowledge Graph Extraction Pipeline

```mermaid
flowchart TD
    A([User Uploads PDF]) --> B{Validate File}
    B -->|Size > 50MB or Not PDF| ERR1[Raise 413 / 415 Error]
    B -->|Valid PDF| C[Upload to Tencent Cloud COS]
    C --> D[PyMuPDF Text & Page Extraction]
    
    D --> E{Text Layer Present?}
    E -->|No Text Found| F[Set status: ocr_required]
    E -->|Has Text Layer| G{AI_FEATURES_ENABLED?}
    
    G -->|false| H[Set status: stored<br/>PDF preserved on COS]
    G -->|true| I[Adaptive Sliding Window Chunker<br/>500 tokens / 100 overlap]
    
    I --> J[Generate Bi-Encoder Vectors<br/>768-dim Embeddings]
    I --> K[MultiDisciplineExtractor<br/>Formulas, Theorems, Events, Rules]
    
    J --> L[Store Chunks into<br/>public.document_chunks (pgvector)]
    K --> M[Store Nodes & Edges into<br/>public.knowledge_nodes / edges]
    
    L & M --> N[Set status: ready<br/>Index complete]
    N --> O([Document Available for RAG])
```

---

## 3. Agentic RAG StateGraph Execution Flow (7 Nodes)

```mermaid
stateDiagram-v2
    [*] --> RouterNode: User Query Received

    state RouterNode {
        direction LR
        DetectLang: Detect Language (VI/EN)
        ClassifySubj: Classify Subject (Toán/Lý/Hóa/Văn/Sử/Anh...)
        ClassifyIntent: Classify Intent (Problem Solving/Formula/Essay)
        DetectLang --> ClassifySubj --> ClassifyIntent
    }

    RouterNode --> RetrieveNode

    state RetrieveNode {
        direction LR
        HybridSearch: Dense Vector + BM25 tsvector
        KGTraversal: k-Hop Graph Traversal
        HybridSearch --> KGTraversal
    }

    RetrieveNode --> GradeDocumentsNode

    state GradeDocumentsNode {
        EvalScore: Compute Relevance Score
    }

    GradeDocumentsNode --> QueryRewriteNode: Score < 65% AND Retries < Max
    QueryRewriteNode --> RetrieveNode: Expanded Terminology Query

    GradeDocumentsNode --> UniversalSolverNode: Score >= 65% OR Max Retries Exceeded

    state UniversalSolverNode {
        direction TB
        STEM: LaTeX Formulas ($..$, $$..$$) & Unit Checks
        Humanities: Argument Structuring & Chronology
        Languages: Grammar & Sentence Syntax
    }

    UniversalSolverNode --> GenerateNode: Assemble Context & Domain Prompt

    state GenerateNode {
        StreamDify: Stream Response Tokens via SSE
        AppendCitations: Ground [1], [2] Document References
    }

    GenerateNode --> HallucinationGraderNode

    state HallucinationGraderNode {
        VerifyCitations: Check Claims Grounded in Chunks
        GradeFidelity: 100% Fidelity Score
    }

    HallucinationGraderNode --> [*]: Stream Completed (event: done)
```

---

## 4. Multi-Discipline Knowledge Graph Ontology & ERD

```mermaid
erDiagram
    KNOWLEDGE_NODES {
        uuid id PK
        uuid owner_id FK
        uuid document_id FK
        text name
        text entity_type "concept | formula | theorem_law | historical_event | literary_work | grammar_rule"
        text subject "Toán | Vật lý | Hóa học | Sinh học | Ngữ văn | Lịch sử | Tiếng Anh..."
        text language "vi | en"
        text description
        text formula_latex
        jsonb metadata
        timestamp created_at
    }

    KNOWLEDGE_EDGES {
        uuid id PK
        uuid owner_id FK
        uuid document_id FK
        uuid source_node_id FK
        uuid target_node_id FK
        text relation_type "belongs_to | prerequisite_of | applies_to | contains_formula | caused_by | defined_as | related_to"
        float weight
        jsonb metadata
        timestamp created_at
    }

    DOCUMENTS {
        uuid id PK
        uuid owner_id FK
        text title
        text filename
        text storage_key
        text subject
        text doc_type
        text status
        int page_count
        int chunk_count
    }

    DOCUMENT_CHUNKS {
        uuid id PK
        uuid document_id FK
        text content
        vector embedding "768-dim"
        tsvector content_tsv
        jsonb metadata
    }

    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : contains
    DOCUMENTS ||--o{ KNOWLEDGE_NODES : extracts
    DOCUMENTS ||--o{ KNOWLEDGE_EDGES : extracts
    KNOWLEDGE_NODES ||--o{ KNOWLEDGE_EDGES : "source / target"
```

---

## 5. Backend Dependency & Module Call Graph

```mermaid
graph LR
    subgraph API_Routers["API Router Layer (backend/app/api/v1/)"]
        R_System["system.py"]
        R_Docs["documents.py"]
        R_Conv["conversations.py"]
        R_Chat["chat.py"]
        R_Graph["graph.py"]
    end

    subgraph Dependencies["Dependency Injection (backend/app/api/deps.py)"]
        D_Auth["CurrentUser (JWT)"]
        D_Pool["PoolDep (asyncpg)"]
        D_AIGate["require_ai_features"]
    end

    subgraph Services["Services Layer (backend/app/services/)"]
        S_Graph["graph/engine.py<br/>(ExamorasAgentGraph)"]
        S_Nodes["graph/nodes.py<br/>(7 Nodes)"]
        S_KG["knowledge_graph/store.py<br/>(KnowledgeGraphStore)"]
        S_Extractor["knowledge_graph/extractor.py"]
        S_Retriever["retriever.py<br/>(HybridRetriever)"]
        S_Embedding["embedding.py<br/>(Bi-Encoder)"]
        S_Chunker["chunker.py<br/>(SmartChunker)"]
        S_Storage["storage.py<br/>(Tencent COS)"]
        S_Dify["dify.py<br/>(DifyClient)"]
    end

    subgraph Repositories["Database Repositories (backend/app/db/repositories/)"]
        Repo_Doc["DocumentRepository"]
        Repo_Chunk["ChunkRepository"]
        Repo_Conv["ConversationRepository"]
    end

    R_Docs --> D_Auth & D_Pool & S_Storage & Repo_Doc & Repo_Chunk & S_Chunker & S_Embedding & S_KG
    R_Chat --> D_Auth & D_Pool & D_AIGate & Repo_Conv & S_Retriever & S_Dify
    R_Graph --> D_Auth & D_Pool & D_AIGate & Repo_Conv & S_Graph
    S_Graph --> S_Nodes
    S_Nodes --> S_Retriever & S_KG & S_Dify
    S_KG --> S_Extractor
    S_Retriever --> Repo_Chunk & S_Embedding
```

---

## 6. Frontend Component & State Flow Graph

```mermaid
graph TB
    subgraph Router["React Router (frontend/src/App.tsx)"]
        Route_Landing["/ (LandingPage)"]
        Route_Demo["/demo (DemoPage)"]
        Route_Auth["/auth (AuthPage)"]
        Route_Dash["/dashboard (DashboardPage)"]
        Route_Lib["/library (LibraryPage)"]
        Route_Chat["/chat (ChatPage)"]
        Route_Settings["/settings (SettingsPage)"]
    end

    subgraph Hooks["State & Query Hooks (frontend/src/hooks/)"]
        H_Auth["useAuth (Supabase Session)"]
        H_Docs["useDocuments (Documents & Stats)"]
        H_Ai["useAiFeatures (Readiness Check)"]
        H_Conv["useConversations (Chat History)"]
    end

    subgraph Components["UI Components (frontend/src/components/)"]
        C_ChatPanel["ChatPanel<br/>(Agentic Graph Toggle + SSE Streaming)"]
        C_Bubble["MessageBubble<br/>(KaTeX + Markdown + Citations)"]
        C_Dropzone["UploadDropzone<br/>(Universal Subjects Selector)"]
        C_DocList["DocumentList<br/>(Status Badges & PDF Viewer)"]
    end

    Route_Landing --> Route_Demo & Route_Auth
    Route_Auth --> H_Auth
    Route_Dash --> H_Docs & H_Ai
    Route_Lib --> H_Docs --> C_Dropzone & C_DocList
    Route_Chat --> H_Conv --> C_ChatPanel --> C_Bubble
```

---

## 7. Storage Infrastructure (Tencent Cloud COS + AWS S3 API)

```mermaid
flowchart LR
    Client[Browser / User] -->|1. Request Upload| API[FastAPI StorageService]
    API -->|2. Stream Upload via S3 API| TencentCOS[(Tencent Cloud COS Bucket)]
    Client -->|3. Request PDF URL| API
    API -->|4. Generate Presigned URL| TencentCOS
    API -->|5. Return Presigned URL (15 mins)| Client
    Client -->|6. Direct Authenticated Stream| TencentCOS
```
