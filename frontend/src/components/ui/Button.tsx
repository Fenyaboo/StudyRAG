import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" }) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50", variant === "primary" && "bg-primary-500 text-white shadow-glow hover:bg-primary-400", variant === "secondary" && "border border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]", variant === "ghost" && "text-slate-400 hover:bg-white/[0.06] hover:text-white", variant === "danger" && "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20", size === "sm" && "px-3 py-2 text-xs", size === "md" && "px-4 py-2.5 text-sm", size === "lg" && "px-5 py-3 text-base", className)} {...props} />;
}
