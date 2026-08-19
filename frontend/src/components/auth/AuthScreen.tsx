import { ArrowLeft, ArrowRight, BookOpen, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export function AuthScreen() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try {
      if (mode === "reset") { const result = await resetPassword(email); if (result.error) throw result.error; setMessage("Kiểm tra email để đặt lại mật khẩu nhé."); return; }
      if (mode === "login") { const result = await signIn(email, password); if (result.error) throw result.error; navigate("/dashboard"); }
      else { const result = await signUp(email, password); if (result.error) throw result.error; setMessage(result.needsConfirmation ? "Đăng ký thành công. Hãy xác nhận email trước khi đăng nhập." : "Tài khoản đã sẵn sàng."); if (!result.needsConfirmation) navigate("/dashboard"); }
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể thực hiện lúc này"); } finally { setBusy(false); }
  };

  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  const clearFeedback = () => { setError(null); setMessage(null); };
  const switchMode = (nextMode: "login" | "signup") => { setMode(nextMode); clearFeedback(); };

  const inputClass = "w-full rounded-xl border border-carbon/12 bg-sand/45 px-10 py-3.5 text-sm text-carbon outline-none transition placeholder:text-carbon/35 focus:border-accent-500 focus:bg-white focus:ring-4 focus:ring-accent-500/12";
  const labelClass = "block text-[11px] font-bold uppercase tracking-[0.16em] text-carbon/50";

  const renderPane = (variant: "login" | "signup") => {
    const active = variant === "signup" ? isSignup : !isSignup;
    const resetView = variant === "login" && isReset;
    const heading = variant === "signup" ? "Tạo tài khoản" : resetView ? "Đặt lại mật khẩu" : "Chào mừng trở lại";
    const description = variant === "signup"
      ? "Đăng ký để mở workspace học tập của riêng bạn."
      : resetView
        ? "Nhập email để nhận liên kết khôi phục tài khoản."
        : "Đăng nhập để tiếp tục hành trình học tập của bạn.";

    return (
      <div className={`auth-pane auth-pane-${variant} px-7 py-12 sm:px-12 sm:py-14 lg:px-14`} aria-hidden={!active}>
        <fieldset disabled={!active} className="contents">
          <Link to="/" tabIndex={active ? 0 : -1} className="inline-flex w-fit items-center gap-2.5 font-display text-[15px] font-extrabold tracking-tight text-carbon">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-carbon text-cream shadow-sm"><BookOpen className="h-4 w-4 text-accent-400" /></span>
            Exam<span className="text-accent-500">oras</span>
          </Link>

          <div className="my-auto w-full max-w-sm pt-10">
            <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-carbon/55">
              <span className="h-2 w-2 rounded-full bg-accent-500" />
              {variant === "signup" ? "Bắt đầu miễn phí" : "Workspace đang chờ bạn"}
            </p>
            <h1 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.5rem)] font-extrabold leading-[1.05] tracking-[-0.035em] text-carbon">{heading}</h1>
            <p className="mt-3 text-sm leading-6 text-carbon/60">{description}</p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className={labelClass}>
                Địa chỉ email
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon/35" />
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" required className={inputClass} />
                </div>
              </label>

              {!resetView && <label className={labelClass}>
                Mật khẩu
                <div className="relative mt-2">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon/35" />
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} placeholder="Tối thiểu 8 ký tự" minLength={8} required className={`${inputClass} pr-11`} />
                  <button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-carbon/40 transition hover:text-carbon">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>}

              {variant === "login" && !resetView && <div className="flex items-center justify-between gap-3 text-xs">
                <label className="flex items-center gap-2 text-carbon/60"><input type="checkbox" className="h-3.5 w-3.5 rounded border-carbon/25 accent-accent-500" /> Ghi nhớ mình</label>
                <button type="button" onClick={() => { setMode("reset"); clearFeedback(); }} className="font-semibold text-accent-600 transition hover:text-carbon">Quên mật khẩu?</button>
              </div>}

              {error && <p className="rounded-xl border border-accent-500/25 bg-accent-100/70 px-3.5 py-3 text-xs leading-5 text-accent-600">{error}</p>}
              {message && <p className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-3.5 py-3 text-xs leading-5 text-emerald-700">{message}</p>}

              <button type="submit" className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-carbon px-5 py-3.5 text-sm font-semibold text-cream transition hover:shadow-hard-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-60">
                {busy && active && <Loader2 className="h-4 w-4 animate-spin" />}
                {variant === "signup" ? "Đăng ký miễn phí" : resetView ? "Gửi liên kết khôi phục" : "Đăng nhập"}
                {!(busy && active) && !resetView && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
              </button>
            </form>

            {!resetView && <>
              <div className="my-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-carbon/40"><span className="h-px flex-1 bg-carbon/12" />hoặc<span className="h-px flex-1 bg-carbon/12" /></div>
              <button type="button" onClick={() => void signInWithGoogle()} className="flex w-full items-center justify-center gap-3 rounded-full border border-carbon/15 bg-white px-5 py-3 text-sm font-semibold text-carbon transition hover:border-carbon hover:bg-sand/60"><span className="grid h-5 w-5 place-items-center rounded-full border border-carbon/15 text-[11px] font-bold">G</span>Tiếp tục với Google</button>
              <p className="mt-6 text-center text-xs text-carbon/55 lg:hidden">{variant === "signup" ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}<button type="button" onClick={() => switchMode(variant === "signup" ? "login" : "signup")} className="font-bold text-accent-600 hover:text-carbon">{variant === "signup" ? "Đăng nhập" : "Tạo tài khoản"}</button></p>
            </>}
            {resetView && <button type="button" onClick={() => switchMode("login")} className="mt-6 flex w-full justify-center text-xs font-semibold text-carbon/55 transition hover:text-carbon">Quay lại đăng nhập</button>}
          </div>

          <p className="mt-10 flex items-center gap-2 text-[11px] text-carbon/45"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Dữ liệu của bạn luôn được bảo mật.</p>
        </fieldset>
      </div>
    );
  };

  return (
    <main className="theme-light relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 py-8 font-sans sm:px-6 lg:py-12">
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-sand blur-3xl" />

      <Link to="/" className="absolute left-5 top-5 z-40 inline-flex items-center gap-2 text-xs font-semibold text-carbon/55 transition hover:text-carbon sm:left-8 sm:top-7">
        <ArrowLeft className="h-4 w-4" /> Về trang chủ
      </Link>

      <section data-mode={mode} className="auth-shell w-full max-w-[1000px] rounded-[28px] bg-white shadow-lift ring-1 ring-carbon/10">
        {renderPane("login")}
        {renderPane("signup")}

        <div className="auth-overlay-wrap">
          <div className="auth-overlay bg-sand text-carbon">
            <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent-500/10 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-cream/70 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-carbon/[0.06]" />

            <div className="auth-overlay-panel auth-overlay-left px-10" aria-hidden={!isSignup}>
              <div className="mb-8 grid h-24 w-24 place-items-center rounded-[26px] border border-carbon/12 bg-cream">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-500 text-white shadow-hard"><Sparkles className="h-6 w-6" /></div>
              </div>
              <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-carbon/55"><span className="h-2 w-2 rounded-full bg-accent-500" />Rất vui gặp lại</p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-carbon">
                <span className="relative whitespace-nowrap"><span className="relative z-10">Chào mừng</span><span aria-hidden className="absolute inset-x-[-2px] bottom-[0.12em] z-0 h-[0.34em] -rotate-[0.8deg] bg-accent-500/35" /></span> trở lại
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-6 text-carbon/60">Đăng nhập để tiếp tục workspace và những cuộc trò chuyện đang học dở của bạn.</p>
              <button type="button" disabled={!isSignup} onClick={() => switchMode("login")} className="group mt-8 inline-flex items-center gap-2 rounded-full bg-carbon px-6 py-3 text-xs font-semibold text-cream transition hover:shadow-hard-accent">Đăng nhập<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></button>
            </div>

            <div className="auth-overlay-panel auth-overlay-right px-10" aria-hidden={isSignup}>
              <div className="mb-8 grid h-24 w-24 place-items-center rounded-[26px] border border-carbon/12 bg-cream">
                <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-carbon text-cream"><Check className="h-6 w-6" /><span className="absolute -right-3 -top-3 grid h-7 w-7 place-items-center rounded-full bg-accent-500 text-[11px] font-bold text-white">+</span></div>
              </div>
              <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-carbon/55"><span className="h-2 w-2 rounded-full bg-accent-500" />Học cùng tài liệu của bạn</p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-carbon">
                Chưa có <span className="relative whitespace-nowrap"><span className="relative z-10">tài khoản?</span><span aria-hidden className="absolute inset-x-[-2px] bottom-[0.12em] z-0 h-[0.34em] -rotate-[0.8deg] bg-accent-500/35" /></span>
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-6 text-carbon/60">Tạo workspace riêng, tải tài liệu lên và bắt đầu học thông minh hơn mỗi ngày.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="rounded-md bg-accent-100 px-2 py-1 text-[10px] font-semibold text-accent-600">[1] Vật lý 12 · tr. 42</span>
                <span className="rounded-md bg-accent-100 px-2 py-1 text-[10px] font-semibold text-accent-600">[2] Chuyên đề · tr. 8</span>
              </div>
              <button type="button" disabled={isSignup} onClick={() => switchMode("signup")} className="group mt-7 inline-flex items-center gap-2 rounded-full bg-carbon px-6 py-3 text-xs font-semibold text-cream transition hover:shadow-hard-accent">Tạo tài khoản<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
