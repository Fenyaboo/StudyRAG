import { FileText } from "lucide-react";
import type { Citation } from "../../lib/api";

export function CitationCard({ citation }: { citation: Citation }) { return <div className="mt-2 rounded-lg border border-primary-300/10 bg-primary-400/[0.06] p-2.5"><div className="flex items-center gap-2 text-[11px] font-medium text-primary-200"><span className="grid h-5 w-5 place-items-center rounded bg-primary-400/15">{citation.index}</span><FileText className="h-3.5 w-3.5" /><span className="truncate">{citation.document_name}</span>{citation.page && <span className="ml-auto shrink-0 text-primary-300/70">tr. {citation.page}</span>}</div><p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-slate-500">{citation.text}</p></div>; }
