import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const field = "w-full rounded-xl border border-carbon/12 bg-sand/45 px-3.5 py-3 text-sm text-carbon outline-none transition placeholder:text-carbon/35 focus:border-accent-500 focus:bg-white focus:ring-4 focus:ring-accent-500/12";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "resize-none", className)} {...props} />;
}
