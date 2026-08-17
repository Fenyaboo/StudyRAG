import { Bot, Cpu, FileQuestion, Loader2, Send, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { Conversation, Document, Message } from "../../lib/api";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { MessageBubble } from "./MessageBubble";

function temporaryMessage(role: Message["role"], content: string, conversationId: string): Message {
  return {
    id: `temp-${Date.now()}`,
    conversation_id: conversationId,
    role,
    content,
    citations: [],
    latency_ms: null,
    created_at: new Date().toISOString(),
  };
}

export function ChatPanel({
  conversationId,
  initialMessages,
  documents,
  onConversationCreated,
}: {
  conversationId: string | null;
  initialMessages: Message[];
  documents: Document[];
  onConversationCreated: (conversation: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [query, setQuery] = useState("");
  const [documentId, setDocumentId] = useState<string>("");
  const [useGraphMode, setUseGraphMode] = useState<boolean>(true);
  const [activeGraphNode, setActiveGraphNode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMessages(initialMessages), [initialMessages, conversationId]);
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = query.trim();
    if (!text || busy) return;
    setQuery("");
    setBusy(true);
    setError(null);
    setActiveGraphNode(null);

    const localConversation = conversationId || "pending";
    const userMessage = temporaryMessage("user", text, localConversation);
    const streamMessage = temporaryMessage("assistant", "", localConversation);
    setMessages((current) => [...current, userMessage, streamMessage]);
    const streamId = streamMessage.id;

    const streamFn = useGraphMode ? api.streamGraphChat : api.streamChat;

    try {
      await streamFn(
        { query: text, document_id: documentId || null, conversation_id: conversationId },
        {
          onToken: (content) =>
            setMessages((current) =>
              current.map((item) =>
                item.id === streamId ? { ...item, content: item.content + content } : item
              )
            ),
          onNodeUpdate: (nodeData) => {
            if (nodeData.node) setActiveGraphNode(nodeData.node);
          },
          onDone: (done) => {
            setActiveGraphNode(null);
            onConversationCreated(done.conversation_id);
            setMessages((current) =>
              current.map((item) =>
                item.id === streamId
                  ? {
                      ...item,
                      id: done.message_id,
                      conversation_id: done.conversation_id,
                      content: done.answer,
                      citations: done.citations,
                      latency_ms: done.latency_ms,
                    }
                  : item
              )
            );
          },
          onError: (message) => setError(message),
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi câu hỏi");
      setMessages((current) => current.filter((item) => item.id !== streamId));
    } finally {
      setBusy(false);
      setActiveGraphNode(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col rounded-2xl border border-carbon/10 bg-white shadow-sm">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-carbon/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-carbon text-cream shadow-sm">
            <Bot className="h-4 w-4 text-accent-400" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-carbon">Examoras AI</p>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Sẵn sàng hỗ trợ mọi môn học
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Agentic Graph mode toggle pill */}
          <button
            type="button"
            onClick={() => setUseGraphMode(!useGraphMode)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
              useGraphMode
                ? "border-accent-500/40 bg-accent-100/50 text-accent-600"
                : "border-carbon/10 bg-sand/30 text-carbon/60 hover:text-carbon"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Agentic Graph:</span>
            <span>{useGraphMode ? "ON" : "OFF"}</span>
          </button>

          {/* Document selector */}
          <select
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="max-w-[170px] rounded-lg border border-carbon/12 bg-sand/45 px-2.5 py-1.5 text-xs font-medium text-carbon/70 outline-none transition focus:border-accent-500 sm:max-w-[220px]"
          >
            <option value="">Tất cả tài liệu</option>
            {documents
              .filter((doc) => doc.status === "ready")
              .map((doc) => (
                <option value={doc.id} key={doc.id}>
                  [{doc.subject}] {doc.title}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Live Graph Node execution indicator banner */}
      {activeGraphNode && (
        <div className="flex items-center gap-2 border-b border-accent-500/20 bg-accent-100/40 px-4 py-2 text-xs font-bold text-accent-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-600" />
          <span>Đang thực thi StateGraph Node:</span>
          <span className="rounded bg-accent-500 px-1.5 py-0.5 text-[11px] font-extrabold text-white">
            {activeGraphNode}
          </span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 && (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-100 text-accent-600 shadow-sm">
              <FileQuestion className="h-7 w-7" />
            </div>
            <h2 className="mt-5 font-display text-lg font-bold tracking-tight text-carbon">
              Bạn muốn tìm hiểu điều gì?
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-carbon/55">
              Hỏi về công thức, bài tập, tác phẩm, sự kiện hay bất kỳ câu hỏi nào trong tài liệu. Examoras luôn kèm công thức LaTeX và nguồn trích dẫn.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {[
                "Giải thích công thức quan trọng",
                "Tóm tắt kiến thức trọng tâm",
                "Tạo câu hỏi ôn tập theo chuyên đề",
                "Hướng dẫn giải bài tập từng bước",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  className="rounded-full border border-carbon/12 bg-sand/20 px-3.5 py-2 text-xs font-medium text-carbon/75 transition hover:border-accent-500 hover:bg-white hover:text-accent-600"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            streaming={busy && message.role === "assistant" && message.id.startsWith("temp-")}
          />
        ))}

        {error && (
          <p className="rounded-xl border border-accent-500/25 bg-accent-100/70 px-3 py-2 text-xs text-accent-600">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input query form */}
      <form onSubmit={submit} className="border-t border-carbon/10 p-3 sm:p-4">
        <div className="flex items-end gap-2 rounded-xl border border-carbon/12 bg-sand/40 p-2 transition focus-within:border-accent-500 focus-within:bg-white">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={1}
            placeholder="Đặt câu hỏi về tài liệu (Toán, Lý, Hóa, Văn, Sử, Địa, Tiếng Anh...)..."
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-carbon outline-none placeholder:text-carbon/35"
          />
          <Button type="submit" size="sm" disabled={busy || !query.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-2 px-1 text-[10px] text-carbon/40">Enter để gửi · Shift + Enter để xuống dòng</p>
      </form>
    </div>
  );
}
