import { Menu, UserCircle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const titles: Record<string, string> = { "/dashboard": "Tổng quan", "/library": "Thư viện tài liệu", "/chat": "Hỏi đáp AI", "/settings": "Cài đặt" };

export function Header({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const { user } = useAuth();
  return <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-carbon/10 bg-cream/85 px-4 backdrop-blur sm:px-6"><div className="flex items-center gap-3"><button onClick={onMenu} aria-label="Mở menu" className="rounded-lg p-2 text-carbon/55 transition hover:bg-sand hover:text-carbon md:hidden"><Menu className="h-5 w-5" /></button><div><p className="font-display text-sm font-bold tracking-tight text-carbon">{titles[location.pathname] || "StudyRAG"}</p><p className="hidden text-xs text-carbon/50 sm:block">Không gian học tập cá nhân của bạn</p></div></div><div className="flex items-center gap-2 rounded-full border border-carbon/12 bg-white px-3 py-1.5"><UserCircle className="h-5 w-5 text-accent-500" /><span className="max-w-[160px] truncate text-xs font-medium text-carbon/65">{user?.email || "Học sinh"}</span></div></header>;
}
