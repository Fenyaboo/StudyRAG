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
    <aside className={cn("fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-white/[0.07] bg-[#0b0f1e] px-4 py-5 md:flex", open ? "flex" : "hidden")}>
      <div className="flex items-center gap-3 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-500 shadow-glow"><BookOpen className="h-5 w-5 text-white" /></div>
        <div><p className="font-semibold tracking-tight text-white">Study<span className="text-primary-400">RAG</span></p><p className="text-[10px] uppercase tracking-[0.18em] text-slate-600">Learn with context</p></div>
        <button onClick={onClose} className="ml-auto text-slate-500 md:hidden" aria-label="Đóng menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="mt-10 space-y-1">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition", isActive ? "bg-primary-500/15 text-primary-300" : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200")}><Icon className="h-[18px] w-[18px]" />{label}</NavLink>)}</nav>
      <div className="mt-auto rounded-2xl border border-primary-400/10 bg-primary-500/[0.07] p-4"><Sparkles className="h-5 w-5 text-primary-300" /><p className="mt-3 text-sm font-medium text-slate-200">Học sâu hơn</p><p className="mt-1 text-xs leading-5 text-slate-500">Tải tài liệu cá nhân để AI trả lời đúng ngữ cảnh.</p></div>
    </aside>
  );
}
