import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Message } from "../../lib/api";
import { CitationCard } from "./CitationCard";

export function MessageBubble({ message, streaming = false }: { message: Message; streaming?: boolean }) { const user = message.role === "user"; return <div className={`flex ${user ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${user ? "rounded-tr-sm bg-carbon text-cream" : "rounded-tl-sm border border-carbon/10 bg-sand/50 text-carbon/80"}`}><div className="markdown">{user ? <p>{message.content}</p> : <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{message.content || (streaming ? " " : "")}</ReactMarkdown>}</div>{streaming && <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded bg-accent-500 align-middle" />}{!user && message.citations?.length > 0 && <div className="mt-3 border-t border-carbon/10 pt-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon/45">Nguồn tham khảo</p>{message.citations.map((citation) => <CitationCard key={citation.index} citation={citation} />)}</div>}</div></div>; }
