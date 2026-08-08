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
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-carbon/45">Hội thoại</p>
        <Button variant="ghost" size="sm" onClick={onNew} aria-label="Hội thoại mới">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-carbon/15 p-4 text-center">
            <MessageCircle className="mx-auto h-5 w-5 text-carbon/30" />
            <p className="mt-2 text-xs text-carbon/50">Chưa có hội thoại</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center gap-2 rounded-xl px-3 py-2.5 transition",
                activeId === conversation.id
                  ? "bg-carbon text-cream"
                  : "text-carbon/60 hover:bg-sand hover:text-carbon",
              )}
            >
              <button onClick={() => onSelect(conversation.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-semibold">{conversation.title}</p>
                <p className={cn("mt-1 flex items-center gap-1 text-[10px]", activeId === conversation.id ? "text-cream/55" : "text-carbon/40")}>
                  <Clock3 className="h-3 w-3" />
                  {formatDate(conversation.last_message_at)}
                </p>
              </button>
              <button
                className={cn("hidden shrink-0 transition group-hover:block", activeId === conversation.id ? "text-cream/60 hover:text-white" : "text-carbon/35 hover:text-accent-600")}
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
