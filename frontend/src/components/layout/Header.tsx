import { Menu, UserCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const titles: Record<string, string> = { "/dashboard": "Tổng quan", "/library": "Thư viện tài liệu", "/chat": "Hỏi đáp AI", "/settings": "Cài đặt" };

export function Header({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const { user } = useAuth();
  return <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.07] bg-ink/80 px-4 backdrop-blur-xl sm:px-6"><div className="flex items-center gap-3"><button onClick={onMenu} aria-label="Mở menu" className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.05] md:hidden"><Menu className="h-5 w-5" /></button><div><p className="text-sm font-medium text-white">{titles[location.pathname] || "StudyRAG"}</p><p className="hidden text-xs text-slate-600 sm:block">Không gian học tập cá nhân của bạn</p></div></div><div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"><UserCircle className="h-5 w-5 text-primary-300" /><span className="max-w-[160px] truncate text-xs text-slate-400">{user?.email || "Học sinh"}</span></div></header>;
}
