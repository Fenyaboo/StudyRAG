import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  FileText,
  Globe,
  Layers,
  Network,
  Play,
  RotateCw,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";

interface GraphTraceItem {
  node: string;
  label: string;
  status: "pending" | "running" | "completed";
  duration: number;
  output: string;
}

const SAMPLE_QUERIES = [
  {
    subject: "Toán học (Math)",
    lang: "vi",
    query: "Tính nguyên hàm của hàm số f(x) = x * e^x và giải thích từng bước",
    domain: "STEM",
    nodes: [
      { node: "RouterNode", label: "Phân loại ngôn ngữ & Môn học", status: "completed", duration: 18, output: "Language: vi | Subject: Toán (STEM) | Intent: Problem Solving" },
      { node: "RetrieveNode", label: "Truy xuất Hybrid Vector & Knowledge Graph", status: "completed", duration: 42, output: "Tìm thấy 3 chunks tài liệu + 2 node đồ thị liên quan: 'Công thức nguyên hàm từng phần', 'Định lý hàm số mũ'" },
      { node: "GradeDocumentsNode", label: "Đánh giá mức độ phù hợp tài liệu", status: "completed", duration: 25, output: "Relevance Score: 98% (Đạt tiêu chuẩn, không cần mở rộng query)" },
      { node: "UniversalSolverNode", label: "Định dạng cấu trúc giải chuyên sâu", status: "completed", duration: 30, output: "Áp dụng định dạng Toán học: bắt buộc chuẩn LaTeX $..$ và $$..$$, phân rã từng bước u, dv" },
      { node: "GenerateNode", label: "Sinh câu trả lời kèm trích dẫn nguồn", status: "completed", duration: 110, output: "Đáp án: $\\int x e^x dx = (x - 1)e^x + C$ [1]. Trích dẫn từ SGK Toán 12 Nâng cao, tr. 102." },
      { node: "HallucinationGraderNode", label: "Kiểm định trung thực (Grounding Check)", status: "completed", duration: 15, output: "Grounding Score: 100% (Hoàn toàn chính xác theo tài liệu)" },
    ],
  },
  {
    subject: "Vật lý (Physics)",
    lang: "en",
    query: "Explain photoelectric effect formula and calculate work function for metal",
    domain: "STEM",
    nodes: [
      { node: "RouterNode", label: "Language & Subject Classification", status: "completed", duration: 14, output: "Language: en | Subject: Physics (STEM) | Intent: Formula & Calculation" },
      { node: "RetrieveNode", label: "Hybrid Vector & KG Multi-Hop Traversal", status: "completed", duration: 38, output: "Found 4 chunks from Physics 12 textbook + KG Node: 'Einstein Photoelectric Equation' ($hf = A + W_{dmax}$)" },
      { node: "GradeDocumentsNode", label: "Context Relevance Grading", status: "completed", duration: 20, output: "Relevance Score: 96% -> Passes directly to Universal Solver" },
      { node: "UniversalSolverNode", label: "Physics Domain Formulation", status: "completed", duration: 28, output: "Strict SI Units formatting (Joules, eV, Hz), LaTeX equation rendering" },
      { node: "GenerateNode", label: "Grounded Generation with SSE Stream", status: "completed", duration: 95, output: "Formula: $hf = A + \\frac{1}{2}mv_{max}^2$ [1]. Step-by-step calculation formatted with citations." },
      { node: "HallucinationGraderNode", label: "Hallucination & Citation Verification", status: "completed", duration: 12, output: "Verification PASS: 100% matched to syllabus" },
    ],
  },
  {
    subject: "Hóa học (Chemistry)",
    lang: "vi",
    query: "Phương trình phản ứng thủy phân este no đơn chức mạch hở trong môi trường kiềm",
    domain: "STEM",
    nodes: [
      { node: "RouterNode", label: "Phân loại ngôn ngữ & Môn học", status: "completed", duration: 16, output: "Language: vi | Subject: Hóa học (STEM) | Intent: Reaction & Mechanism" },
      { node: "RetrieveNode", label: "Truy xuất Hybrid & Triplet Traversal", status: "completed", duration: 40, output: "3 chunks Este + Triplet: (Este) --[contains_reaction]--> (Phản ứng xà phòng hóa)" },
      { node: "GradeDocumentsNode", label: "Đánh giá chất lượng ngữ cảnh", status: "completed", duration: 22, output: "Relevance Score: 95%" },
      { node: "UniversalSolverNode", label: "Cấu trúc phản ứng Hóa học", status: "completed", duration: 24, output: "Cân bằng phương trình: $RCOOR' + NaOH \\xrightarrow{t^o} RCOONa + R'OH$" },
      { node: "GenerateNode", label: "Sinh lời giải chi tiết", status: "completed", duration: 88, output: "Phản ứng xà phòng hóa một chiều sinh muối natri và ancol [1]. Kèm ví dụ $CH_3COOC_2H_5$." },
      { node: "HallucinationGraderNode", label: "Kiểm tra độ trung thực", status: "completed", duration: 10, output: "Grounding Score: 100%" },
    ],
  },
  {
    subject: "Lịch sử (History)",
    lang: "vi",
    query: "Phân tích ý nghĩa lịch sử của chiến thắng Điện Biên Phủ năm 1954",
    domain: "Social Science",
    nodes: [
      { node: "RouterNode", label: "Phân loại ngôn ngữ & Môn học", status: "completed", duration: 15, output: "Language: vi | Subject: Lịch sử (Social Science) | Intent: Chronological & Analytical" },
      { node: "RetrieveNode", label: "Truy xuất Chunks & Mốc lịch sử", status: "completed", duration: 45, output: "4 chunks Lịch sử 12 + Node sự kiện: 'Mốc 07/05/1954 - Chiến dịch Điện Biên Phủ'" },
      { node: "GradeDocumentsNode", label: "Đánh giá tài liệu", status: "completed", duration: 20, output: "Relevance Score: 99%" },
      { node: "UniversalSolverNode", label: "Cấu trúc bài phân tích Sử học", status: "completed", duration: 32, output: "Bố cục 4 phần: Bối cảnh, Diễn biến, Kết quả, Ý nghĩa trong nước & quốc tế" },
      { node: "GenerateNode", label: "Sinh bài luận có luận điểm & dẫn chứng", status: "completed", duration: 130, output: "Chiến thắng 'lừng lẫy năm châu, chấn động địa cầu', buộc Pháp ký Hiệp định Giơ-ne-vơ [1] [2]." },
      { node: "HallucinationGraderNode", label: "Kiểm định sự kiện", status: "completed", duration: 14, output: "Grounded 100%" },
    ],
  },
];

const KNOWLEDGE_GRAPH_MOCK = {
  nodes: [
    { id: "1", label: "Tích phân (Integral)", type: "concept", subject: "Toán", math: "\\int f(x)dx" },
    { id: "2", label: "Đổi biến số", type: "method", subject: "Toán", math: "u = g(x)" },
    { id: "3", label: "Tích phân từng phần", type: "method", subject: "Toán", math: "\\int u dv = uv - \\int v du" },
    { id: "4", label: "Quang điện ngoài", type: "concept", subject: "Vật lý", math: "hf = A + W_d" },
    { id: "5", label: "Công thoát Electron", type: "parameter", subject: "Vật lý", math: "A = \\frac{hc}{\\lambda_0}" },
    { id: "6", label: "Giới hạn quang điện", type: "parameter", subject: "Vật lý", math: "\\lambda_0" },
    { id: "7", label: "Phản ứng xà phòng hóa", type: "reaction", subject: "Hóa học", math: "RCOOR' + NaOH \\to RCOONa + R'OH" },
    { id: "8", label: "Hiệp định Giơ-ne-vơ 1954", type: "event", subject: "Lịch sử", math: "1954-07-21" },
  ],
  edges: [
    { source: "1", target: "2", label: "phương pháp giải" },
    { source: "1", target: "3", label: "phương pháp giải" },
    { source: "4", target: "5", label: "phụ thuộc vào" },
    { source: "5", target: "6", label: "xác định" },
    { source: "7", target: "1", label: "tính toán hóa học" },
  ],
};

export function DemoPage() {
  const [activeTab, setActiveTab] = useState<"runner" | "knowledge" | "ingest">("runner");
  const [selectedSample, setSelectedSample] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(6);
  const [filterSubject, setFilterSubject] = useState<string>("All");

  const sample = SAMPLE_QUERIES[selectedSample];

  const handleRunDemo = () => {
    setIsRunning(true);
    setCurrentStep(0);
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setCurrentStep(step);
      if (step >= 6) {
        clearInterval(interval);
        setIsRunning(false);
      }
    }, 450);
  };

  const filteredNodes = filterSubject === "All"
    ? KNOWLEDGE_GRAPH_MOCK.nodes
    : KNOWLEDGE_GRAPH_MOCK.nodes.filter((n) => n.subject.toLowerCase() === filterSubject.toLowerCase());

  return (
    <div className="theme-light min-h-screen bg-cream text-carbon">
      {/* Top Banner */}
      <header className="border-b border-carbon/10 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-carbon text-cream shadow-sm">
                <Sparkles className="h-4.5 w-4.5 text-accent-400" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight text-carbon">
                Exam<span className="text-accent-500">oras</span>
              </span>
            </Link>
            <span className="rounded-full bg-accent-100 px-3 py-1 text-[11px] font-bold text-accent-600">
              AGENTIC GRAPH VISUALIZER
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/chat"
              className="inline-flex items-center gap-2 rounded-full bg-carbon px-5 py-2 text-xs font-bold text-cream shadow-md transition hover:bg-carbon/90"
            >
              <Bot className="h-3.5 w-3.5" />
              Mở Chat Workspace
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <div className="border-b border-carbon/10 bg-sand/30">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-6 py-3">
          <button
            onClick={() => setActiveTab("runner")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "runner"
                ? "bg-carbon text-cream shadow-sm"
                : "bg-white text-carbon/60 hover:bg-sand hover:text-carbon"
            }`}
          >
            <BrainCircuit className="h-4 w-4" />
            Agentic StateGraph (Live Runner)
          </button>
          <button
            onClick={() => setActiveTab("knowledge")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "knowledge"
                ? "bg-carbon text-cream shadow-sm"
                : "bg-white text-carbon/60 hover:bg-sand hover:text-carbon"
            }`}
          >
            <Network className="h-4 w-4" />
            Knowledge Graph Explorer
          </button>
          <button
            onClick={() => setActiveTab("ingest")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              activeTab === "ingest"
                ? "bg-carbon text-cream shadow-sm"
                : "bg-white text-carbon/60 hover:bg-sand hover:text-carbon"
            }`}
          >
            <Layers className="h-4 w-4" />
            Document Ingest & Chunker
          </button>
        </div>
      </div>

      {/* Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* TAB 1: STATEGRAPH RUNNER */}
        {activeTab === "runner" && (
          <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
            {/* Sidebar query picker */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-carbon/10 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-carbon/45">
                  Chọn câu hỏi mẫu (Đa môn & Đa ngôn ngữ)
                </p>
                <div className="mt-3 space-y-2">
                  {SAMPLE_QUERIES.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedSample(idx);
                        setCurrentStep(6);
                      }}
                      className={`w-full rounded-xl border p-3.5 text-left transition ${
                        selectedSample === idx
                          ? "border-accent-500 bg-accent-100/40 text-carbon shadow-sm"
                          : "border-carbon/10 bg-sand/20 text-carbon/70 hover:bg-sand/60"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-accent-600">{q.subject}</span>
                        <span className="rounded bg-carbon/10 px-1.5 py-0.5 text-[10px] uppercase text-carbon/70">
                          {q.lang}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs font-medium text-carbon/80">{q.query}</p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleRunDemo}
                  disabled={isRunning}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 py-3 text-xs font-bold text-white shadow-md transition hover:bg-accent-600 disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      Đang thực thi StateGraph...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-white" />
                      Chạy StateGraph Tác Nhân
                    </>
                  )}
                </button>
              </div>

              {/* Status Box */}
              <div className="rounded-2xl border border-carbon/10 bg-sand/60 p-4">
                <p className="text-xs font-bold text-carbon">Trạng thái DAG Workflow:</p>
                <p className="mt-1 text-xs text-carbon/60">
                  {isRunning
                    ? `Đang chạy node ${currentStep + 1}/6...`
                    : "Đã hoàn thành toàn bộ 6 node. Đáp án đã được kiểm định 100% grounded."}
                </p>
              </div>
            </div>

            {/* Main StateGraph DAG Visualizer */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-carbon/10 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-carbon/8 pb-4">
                  <div>
                    <h2 className="font-display text-base font-bold text-carbon">
                      Luồng thực thi StateGraph thời gian thực
                    </h2>
                    <p className="text-xs text-carbon/50">
                      Mô phỏng 6 node tác nhân tự định tuyến, chấm điểm và tự chữa lành (self-correction).
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    SSE Streaming Active
                  </span>
                </div>

                {/* Nodes Stack */}
                <div className="mt-6 space-y-3">
                  {sample.nodes.map((node, index) => {
                    const isPassed = index <= currentStep;
                    const isCurrent = index === currentStep && isRunning;
                    return (
                      <div
                        key={index}
                        className={`rounded-xl border p-4 transition-all ${
                          isCurrent
                            ? "border-accent-500 bg-accent-100/50 shadow-md ring-2 ring-accent-500/20"
                            : isPassed
                            ? "border-carbon/10 bg-sand/30"
                            : "border-carbon/5 bg-sand/10 opacity-40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold ${
                                isPassed
                                  ? "bg-accent-500 text-white"
                                  : "bg-carbon/10 text-carbon/40"
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div>
                              <p className="text-xs font-extrabold text-carbon">
                                {node.node} — <span className="font-medium text-carbon/70">{node.label}</span>
                              </p>
                            </div>
                          </div>
                          {isPassed && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {node.duration}ms
                            </span>
                          )}
                        </div>

                        {isPassed && (
                          <div className="mt-3 rounded-lg border border-carbon/8 bg-white p-3 font-mono text-xs text-carbon/85">
                            {node.output}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KNOWLEDGE GRAPH EXPLORER */}
        {activeTab === "knowledge" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-carbon/10 bg-white p-5 shadow-sm">
              <div>
                <h2 className="font-display text-base font-bold text-carbon">
                  Đồ thị tri thức đa môn học (Multi-Discipline Knowledge Graph)
                </h2>
                <p className="text-xs text-carbon/50">
                  Trực quan hóa các Node khái niệm, công thức LaTeX và Edges quan hệ liên môn.
                </p>
              </div>

              {/* Filter by subject */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-carbon/60">Môn học:</span>
                {["All", "Toán", "Vật lý", "Hóa học", "Lịch sử"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterSubject(s)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      filterSubject === s
                        ? "bg-carbon text-cream"
                        : "border border-carbon/10 bg-sand/30 text-carbon/70 hover:bg-sand"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Graph Visual Canvas Simulation */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredNodes.map((node) => (
                <div
                  key={node.id}
                  className="rounded-2xl border border-carbon/10 bg-white p-5 shadow-sm transition hover:border-accent-500/50 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-accent-100 px-2 py-0.5 text-[10px] font-bold uppercase text-accent-600">
                      {node.type}
                    </span>
                    <span className="text-xs font-semibold text-carbon/50">{node.subject}</span>
                  </div>
                  <h3 className="mt-3 font-display text-sm font-bold text-carbon">{node.label}</h3>
                  <div className="mt-3 rounded-lg border border-carbon/8 bg-sand/40 p-3 font-mono text-xs font-semibold text-accent-700">
                    ${node.math}$
                  </div>
                  <p className="mt-3 text-[11px] text-carbon/50">
                    ID: node_{node.id} · k-hop connected
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DOCUMENT INGEST & CHUNKER */}
        {activeTab === "ingest" && (
          <div className="rounded-2xl border border-carbon/10 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-bold text-carbon">
              Quy trình bóc tách PDF & Cắt đoạn thông minh (Chunker Pipeline)
            </h2>
            <p className="mt-1 text-xs text-carbon/50">
              Chuyển đổi tài liệu PDF gốc thành vector 768 chiều và trích xuất thực thể vào đồ thị tri thức.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-carbon/10 bg-sand/30 p-4">
                <FileText className="h-6 w-6 text-accent-500" />
                <h3 className="mt-3 font-display text-sm font-bold text-carbon">1. PyMuPDF Layer Parsing</h3>
                <p className="mt-1 text-xs text-carbon/60">
                  Trích xuất nguyên vẹn chữ, công thức, bảng biểu và số trang.
                </p>
              </div>

              <div className="rounded-xl border border-carbon/10 bg-sand/30 p-4">
                <Layers className="h-6 w-6 text-accent-500" />
                <h3 className="mt-3 font-display text-sm font-bold text-carbon">2. Sliding Window Chunker</h3>
                <p className="mt-1 text-xs text-carbon/60">
                  Cắt đoạn 500 token kèm 100 token overlap để không đứt mạch ý nghĩa.
                </p>
              </div>

              <div className="rounded-xl border border-carbon/10 bg-sand/30 p-4">
                <Zap className="h-6 w-6 text-accent-500" />
                <h3 className="mt-3 font-display text-sm font-bold text-carbon">3. Bi-Encoder & KG Embed</h3>
                <p className="mt-1 text-xs text-carbon/60">
                  Lưu vector vào `pgvector` và đẩy triplets vào `knowledge_nodes`.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
