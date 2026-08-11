import { ChatPlaceholder } from "../components/chat/ChatPlaceholder";
import { ChatWorkspace } from "../components/chat/ChatWorkspace";
import { Loading } from "../components/ui/Loading";
import { useAiFeatures } from "../hooks/useAiFeatures";

// Switch ở biên component: nhánh tắt không mount ChatWorkspace nên useConversations() và
// useDocuments() (có setInterval 10 giây) không chạy, giữ đúng 0 request ở chế độ tắt.
export function ChatPage() {
  const { aiEnabled, unknown } = useAiFeatures();
  if (aiEnabled === null) return <Loading label="Đang kiểm tra trạng thái tính năng…" />;
  if (!aiEnabled) return <ChatPlaceholder unknown={unknown} />;
  return <ChatWorkspace />;
}
