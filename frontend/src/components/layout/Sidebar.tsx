import { BookOpen, LayoutDashboard, Library, MessageCircle, Settings, Sparkles, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAiFeatures } from "../../hooks/useAiFeatures";
import { cn } from "../../lib/utils";

// Mục /chat được tách khỏi mảng links vì nó có nhánh render riêng khi tính năng AI tắt.
const linksBeforeChat = [
  { to: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/library", label: "Thư viện", icon: Library },
];

const chatLink = { to: "/chat", label: "Hỏi đáp AI", icon: MessageCircle };

const linksAfterChat = [
  { to: "/settings", label: "Cài đặt", icon: Settings },
];

const itemBase = "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition";
const itemIdle = "text-carbon/60 hover:bg-sand hover:text-carbon";

type Props = { open?: boolean; onClose?: () => void };

export function Sidebar({ open = false, onClose }: Props) {
  const { aiEnabled } = useAiFeatures();
  const chatDisabled = aiEnabled === false;
  const ChatIcon = chatLink.icon;
  return (
    <aside className={cn("fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-carbon/10 bg-white px-4 py-5 md:flex", open ? "flex" : "hidden")}>
      <div className="flex items-center gap-3 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-carbon text-cream"><BookOpen className="h-4.5 w-4.5" /></div>
        <div><p className="font-display text-[15px] font-extrabold tracking-tight text-carbon">Study<span className="text-accent-500">RAG</span></p><p className="text-[10px] uppercase tracking-[0.18em] text-carbon/40">Learn with context</p></div>
        <button onClick={onClose} className="ml-auto text-carbon/45 transition hover:text-carbon md:hidden" aria-label="Đóng menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="mt-10 space-y-1">
        {linksBeforeChat.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => cn(itemBase, isActive ? "bg-carbon text-cream" : itemIdle)}><Icon className="h-[18px] w-[18px]" />{label}</NavLink>)}
        {chatDisabled
          ? <button type="button" aria-disabled="true" onClick={() => {}} className={cn(itemBase, "w-full cursor-not-allowed text-left text-carbon/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/25")}><ChatIcon className="h-[18px] w-[18px]" /><span className="flex-1">{chatLink.label}</span><span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-semibold text-carbon/50">Tạm ngưng</span></button>
          : <NavLink to={chatLink.to} onClick={onClose} className={({ isActive }) => cn(itemBase, isActive ? "bg-carbon text-cream" : itemIdle)}><ChatIcon className="h-[18px] w-[18px]" />{chatLink.label}</NavLink>}
        {linksAfterChat.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => cn(itemBase, isActive ? "bg-carbon text-cream" : itemIdle)}><Icon className="h-[18px] w-[18px]" />{label}</NavLink>)}
      </nav>
      <div className="mt-auto rounded-2xl border border-carbon/10 bg-sand/60 p-4"><Sparkles className="h-5 w-5 text-accent-500" /><p className="mt-3 font-display text-sm font-bold text-carbon">Học sâu hơn</p><p className="mt-1 text-xs leading-5 text-carbon/55">Tải tài liệu cá nhân để AI trả lời đúng ngữ cảnh.</p></div>
    </aside>
  );
}
