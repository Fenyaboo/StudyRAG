import { BookOpen, LayoutDashboard, Library, MessageCircle, Settings, Sparkles, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/utils";

const links = [
  { to: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/library", label: "Thư viện", icon: Library },
  { to: "/chat", label: "Hỏi đáp AI", icon: MessageCircle },
  { to: "/settings", label: "Cài đặt", icon: Settings },
];

type Props = { open?: boolean; onClose?: () => void };

export function Sidebar({ open = false, onClose }: Props) {
  return (
    <aside className={cn("fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-carbon/10 bg-white px-4 py-5 md:flex", open ? "flex" : "hidden")}>
      <div className="flex items-center gap-3 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-carbon text-cream"><BookOpen className="h-4.5 w-4.5" /></div>
        <div><p className="font-display text-[15px] font-extrabold tracking-tight text-carbon">Study<span className="text-accent-500">RAG</span></p><p className="text-[10px] uppercase tracking-[0.18em] text-carbon/40">Learn with context</p></div>
        <button onClick={onClose} className="ml-auto text-carbon/45 transition hover:text-carbon md:hidden" aria-label="Đóng menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="mt-10 space-y-1">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition", isActive ? "bg-carbon text-cream" : "text-carbon/60 hover:bg-sand hover:text-carbon")}><Icon className="h-[18px] w-[18px]" />{label}</NavLink>)}</nav>
      <div className="mt-auto rounded-2xl border border-carbon/10 bg-sand/60 p-4"><Sparkles className="h-5 w-5 text-accent-500" /><p className="mt-3 font-display text-sm font-bold text-carbon">Học sâu hơn</p><p className="mt-1 text-xs leading-5 text-carbon/55">Tải tài liệu cá nhân để AI trả lời đúng ngữ cảnh.</p></div>
    </aside>
  );
}
