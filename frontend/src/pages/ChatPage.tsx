import { useEffect, useState } from "react";
import { ConversationList } from "../components/chat/ConversationList";
import { ChatPanel } from "../components/chat/ChatPanel";
import { Loading } from "../components/ui/Loading";
import { useConversations } from "../hooks/useConversations";
import { useDocuments } from "../hooks/useDocuments";

export function ChatPage() { const { conversations, loading: conversationsLoading, refresh, messages, remove } = useConversations(); const { documents } = useDocuments(); const [activeId, setActiveId] = useState<string | null>(null); const [activeMessages, setActiveMessages] = useState<import("../lib/api").Message[]>([]); const [loadingMessages, setLoadingMessages] = useState(false);
  useEffect(() => { if (!activeId && conversations[0]) setActiveId(conversations[0].id); }, [activeId, conversations]);
  useEffect(() => { if (!activeId) { setActiveMessages([]); return; } setLoadingMessages(true); void messages(activeId).then(setActiveMessages).finally(() => setLoadingMessages(false)); }, [activeId, messages]);
  const select = (id: string) => setActiveId(id); const newChat = () => { setActiveId(null); setActiveMessages([]); }; const onCreated = (id: string) => { setActiveId(id); void refresh(); };
  return <div className="grid gap-4 lg:grid-cols-[230px_1fr]"><aside className="hidden min-h-[calc(100vh-9rem)] rounded-2xl border border-carbon/10 bg-white p-3 lg:block"><ConversationList conversations={conversations} activeId={activeId} onSelect={select} onNew={newChat} onDelete={async (id) => { await remove(id); if (activeId === id) newChat(); }} /></aside><div>{conversationsLoading || loadingMessages ? <Loading label="Đang mở hội thoại…" /> : <ChatPanel conversationId={activeId} initialMessages={activeMessages} documents={documents} onConversationCreated={onCreated} />}</div></div>; }
