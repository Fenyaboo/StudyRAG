import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", tone === "neutral" && "bg-white/[0.07] text-slate-300", tone === "success" && "bg-emerald-400/10 text-emerald-300", tone === "warning" && "bg-amber-400/10 text-amber-300", tone === "danger" && "bg-rose-400/10 text-rose-300", className)} {...props} />;
}
