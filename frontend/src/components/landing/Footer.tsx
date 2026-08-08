import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-cream px-6 pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 border-t border-carbon/12 pt-8 text-xs text-carbon/55 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="inline-flex items-center gap-2 font-display text-sm font-bold tracking-tight text-carbon">
          <BookOpen className="h-4 w-4 text-accent-500" aria-hidden />
          StudyRAG
        </Link>
        <div className="flex flex-wrap items-center gap-5">
          <Link to="/auth" className="transition hover:text-accent-600">
            Bắt đầu
          </Link>
          <a href="#how-it-works" className="transition hover:text-accent-600">
            Cách hoạt động
          </a>
          <a href="mailto:hello@studyrag.bond" className="transition hover:text-accent-600">
            Liên hệ
          </a>
          <span className="text-carbon/40">© 2026 StudyRAG</span>
        </div>
      </div>
    </footer>
  );
}
