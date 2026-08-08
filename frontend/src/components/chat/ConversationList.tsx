import { Clock3, MessageCircle, Plus, Trash2 } from "lucide-react";
import type { Conversation } from "../../lib/api";
import { cn, formatDate } from "../../lib/utils";
import { Button } from "../ui/Button";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => Promise<void>;
};

export function ConversationList({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-600">Hội thoại</p>
        <Button variant="ghost" size="sm" onClick={onNew} aria-label="Hội thoại mới">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
            <MessageCircle className="mx-auto h-5 w-5 text-slate-700" />
            <p className="mt-2 text-xs text-slate-600">Chưa có hội thoại</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center gap-2 rounded-xl px-3 py-2.5 transition",
                activeId === conversation.id
                  ? "bg-primary-500/15 text-primary-200"
                  : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300",
              )}
            >
              <button onClick={() => onSelect(conversation.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-medium">{conversation.title}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-700">
                  <Clock3 className="h-3 w-3" />
                  {formatDate(conversation.last_message_at)}
                </p>
              </button>
              <button
                className="hidden shrink-0 text-slate-700 hover:text-rose-300 group-hover:block"
                onClick={() => void onDelete(conversation.id)}
                aria-label="Xóa hội thoại"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
