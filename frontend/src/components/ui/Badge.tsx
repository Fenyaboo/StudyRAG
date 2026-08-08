import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Badge({ className, tone = "neutral", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", tone === "neutral" && "bg-sand text-carbon/70", tone === "success" && "bg-emerald-100 text-emerald-700", tone === "warning" && "bg-amber-100 text-amber-700", tone === "danger" && "bg-accent-100 text-accent-600", className)} {...props} />;
}
