import { ArrowRight, BookOpen, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { Features } from "../components/landing/Features";
import { Footer } from "../components/landing/Footer";
import { Hero } from "../components/landing/Hero";
import { HowItWorks } from "../components/landing/HowItWorks";
import { useAuth } from "../hooks/useAuth";

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="theme-light min-h-screen bg-cream text-carbon">
      <header className="sticky top-0 z-40 border-b border-carbon/8 bg-cream/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-carbon text-cream">
              <BookOpen className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="font-display text-[15px] font-extrabold tracking-tight">
              Study<span className="text-accent-500">RAG</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-xs font-medium text-carbon/60 sm:flex">
            <a href="#features" className="transition hover:text-carbon">
              Tính năng
            </a>
            <a href="#how-it-works" className="transition hover:text-carbon">
              Cách hoạt động
            </a>
          </nav>

          <Link
            to={user ? "/dashboard" : "/auth"}
            className="group inline-flex items-center gap-2 rounded-full border border-carbon/15 px-4 py-2 text-xs font-semibold text-carbon transition hover:border-carbon hover:bg-carbon hover:text-cream"
          >
            {user ? (
              <>
                Mở workspace
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5" aria-hidden />
                Đăng nhập
              </>
            )}
          </Link>
        </div>
      </header>

      <main>
        <Hero />
        <div id="features" className="scroll-mt-20">
          <Features />
        </div>
        <HowItWorks />

        <section className="bg-cream px-6 py-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] bg-carbon px-6 py-16 sm:px-14">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent-500/20 blur-2xl" />
            <div className="relative max-w-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-400">Miễn phí để thử</p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,4vw,3rem)] font-extrabold leading-[1.03] tracking-[-0.03em] text-cream">
                Sẵn sàng học chủ động hơn?
              </h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-cream/60">
                Bắt đầu với tài liệu bạn đang có và biến mỗi câu hỏi thành một bước tiến.
              </p>
              <Link
                to="/auth"
                className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-accent-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-accent-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
              >
                Tạo tài khoản miễn phí
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
