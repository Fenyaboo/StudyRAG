import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg" }) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", variant === "primary" && "bg-carbon text-cream hover:shadow-hard-accent", variant === "secondary" && "border border-carbon/15 bg-white text-carbon hover:border-carbon hover:bg-sand/60", variant === "ghost" && "text-carbon/55 hover:bg-sand hover:text-carbon", variant === "danger" && "border border-accent-500/25 bg-accent-100 text-accent-600 hover:bg-accent-500 hover:text-white", size === "sm" && "px-3 py-2 text-xs", size === "md" && "px-4 py-2.5 text-sm", size === "lg" && "px-5 py-3 text-base", className)} {...props} />;
}
