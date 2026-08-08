import { ArrowLeft, BookOpen, Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

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

  const title = mode === "login" ? "Chào mừng trở lại" : mode === "signup" ? "Tạo workspace học tập" : "Đặt lại mật khẩu";
  return <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-10"><div className="w-full max-w-md"><Link to="/" className="mb-10 flex items-center justify-center gap-2 text-sm text-slate-500 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Về trang chủ</Link><div className="mb-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary-500 shadow-glow"><BookOpen className="h-6 w-6 text-white" /></div><h1 className="mt-5 text-2xl font-semibold text-white">{title}</h1><p className="mt-2 text-sm text-slate-500">{mode === "reset" ? "Nhập email để nhận liên kết khôi phục." : "Học tập có ngữ cảnh, tiến bộ có định hướng."}</p></div><div className="rounded-2xl border border-white/[0.08] bg-panel/80 p-6 shadow-2xl shadow-black/20"><form onSubmit={submit} className="space-y-4"><label className="block text-xs font-medium text-slate-400">Email<Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="ban@email.com" required className="mt-2" /></label>{mode !== "reset" && <label className="block text-xs font-medium text-slate-400">Mật khẩu<div className="relative mt-2"><Input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="Tối thiểu 8 ký tự" minLength={8} required className="pr-10" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>}{mode === "login" && <button type="button" onClick={() => setMode("reset")} className="text-xs text-primary-300 hover:text-primary-200">Quên mật khẩu?</button>}{error && <p className="rounded-xl bg-rose-400/10 px-3 py-2.5 text-xs text-rose-300">{error}</p>}{message && <p className="rounded-xl bg-emerald-400/10 px-3 py-2.5 text-xs leading-5 text-emerald-300">{message}</p>}<Button type="submit" disabled={busy} className="w-full">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "login" ? "Đăng nhập" : mode === "signup" ? "Đăng ký miễn phí" : "Gửi liên kết khôi phục"}</Button></form>{mode !== "reset" && <><div className="my-5 flex items-center gap-3 text-[11px] text-slate-700"><div className="h-px flex-1 bg-white/[0.07]" />hoặc<div className="h-px flex-1 bg-white/[0.07]" /></div><Button variant="secondary" type="button" onClick={() => void signInWithGoogle()} className="w-full"><span className="font-semibold">G</span>Tiếp tục với Google</Button></>}{mode === "reset" ? <button onClick={() => { setMode("login"); setError(null); setMessage(null); }} className="mt-5 flex w-full justify-center text-xs text-slate-500 hover:text-slate-300">Quay lại đăng nhập</button> : <p className="mt-5 text-center text-xs text-slate-600">{mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}<button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary-300 hover:text-primary-200">{mode === "login" ? "Đăng ký ngay" : "Đăng nhập"}</button></p>}</div><p className="mt-5 text-center text-[11px] leading-5 text-slate-700"><Mail className="mr-1 inline h-3 w-3" />Tài khoản của bạn được bảo vệ bởi Supabase Auth</p></div></div>;
}
