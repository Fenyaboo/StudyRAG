import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Lock, LogOut, Mail, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

export function SettingsPage() {
  const { user, signOut, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const changePassword = async (event: FormEvent) => {
    event.preventDefault(); setFeedback(null);
    if (password.length < 8) { setFeedback({ type: "error", message: "Mật khẩu mới cần ít nhất 8 ký tự." }); return; }
    if (password !== confirmation) { setFeedback({ type: "error", message: "Mật khẩu xác nhận chưa khớp." }); return; }
    setBusy(true); const result = await updatePassword(password); setBusy(false);
    setFeedback(result.error ? { type: "error", message: result.error.message } : { type: "success", message: "Đã cập nhật mật khẩu." });
    if (!result.error) { setPassword(""); setConfirmation(""); }
  };
  return <div className="mx-auto max-w-3xl space-y-6"><div><p className="text-sm text-slate-500">Workspace</p><h1 className="mt-1 text-2xl font-semibold text-white">Cài đặt</h1></div><Card className="divide-y divide-white/[0.07]"><div className="flex items-center gap-4 p-6"><div className="grid h-12 w-12 place-items-center rounded-full bg-primary-500/15 text-primary-300"><User className="h-5 w-5" /></div><div><p className="font-medium text-white">Tài khoản của bạn</p><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Mail className="h-3.5 w-3.5" />{user?.email || "—"}</p></div></div><div className="p-6"><div className="flex items-start gap-4"><Lock className="mt-0.5 h-5 w-5 text-primary-300" /><div><p className="font-medium text-slate-200">Đổi mật khẩu</p><p className="mt-1 text-sm leading-6 text-slate-500">Dùng mật khẩu mới dài ít nhất 8 ký tự.</p></div></div><form onSubmit={changePassword} className="mt-5 grid gap-3 sm:grid-cols-2"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu mới" minLength={8} required /><Input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder="Xác nhận mật khẩu" minLength={8} required /><div className="sm:col-span-2">{feedback && <p className={`mb-3 flex items-center gap-1.5 text-xs ${feedback.type === "success" ? "text-emerald-300" : "text-rose-300"}`}>{feedback.type === "success" && <CheckCircle2 className="h-3.5 w-3.5" />}{feedback.message}</p>}<Button type="submit" size="sm" disabled={busy}>{busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Cập nhật mật khẩu</Button></div></form></div><div className="flex items-start gap-4 p-6"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" /><div><p className="font-medium text-slate-200">Dữ liệu riêng tư</p><p className="mt-1 text-sm leading-6 text-slate-500">Tài liệu và hội thoại chỉ được truy cập bởi tài khoản của bạn. StudyRAG dùng owner-scoped queries và RLS làm lớp bảo vệ bổ sung.</p></div></div><div className="flex items-center justify-between gap-4 p-6"><div><p className="font-medium text-slate-200">Đăng xuất</p><p className="mt-1 text-sm text-slate-600">Kết thúc phiên trên thiết bị này.</p></div><Button variant="danger" onClick={() => void signOut()}><LogOut className="h-4 w-4" />Đăng xuất</Button></div></Card></div>;
}
