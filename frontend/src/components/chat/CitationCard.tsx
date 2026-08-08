import { FileText } from "lucide-react";
import type { Citation } from "../../lib/api";

export function CitationCard({ citation }: { citation: Citation }) { return <div className="mt-2 rounded-lg border border-carbon/10 bg-sand/50 p-2.5"><div className="flex items-center gap-2 text-[11px] font-semibold text-carbon/75"><span className="grid h-5 w-5 place-items-center rounded bg-accent-100 text-accent-600">{citation.index}</span><FileText className="h-3.5 w-3.5 text-accent-500" /><span className="truncate">{citation.document_name}</span>{citation.page && <span className="ml-auto shrink-0 text-accent-600">tr. {citation.page}</span>}</div><p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-carbon/55">{citation.text}</p></div>; }
