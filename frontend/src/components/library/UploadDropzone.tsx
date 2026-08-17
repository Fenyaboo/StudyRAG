import { FileUp, Loader2, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import type { DocumentType, Subject } from "../../lib/api";
import { Button } from "../ui/Button";

export function UploadDropzone({ onUpload }: { onUpload: (file: File, subject: Subject, docType: DocumentType) => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState<Subject>("Chung");
  const [docType, setDocType] = useState<DocumentType>("exam");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const choose = (next: File | undefined) => { if (!next) return; setError(null); if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) { setError("Vui lòng chọn file PDF."); return; } if (next.size > 50 * 1024 * 1024) { setError("File tối đa 50 MB."); return; } setFile(next); };
  const submit = async () => { if (!file) return; setBusy(true); setError(null); try { await onUpload(file, subject, docType); setFile(null); } catch (err) { setError(err instanceof Error ? err.message : "Upload thất bại"); } finally { setBusy(false); } };
  return (
    <div className="rounded-2xl border border-carbon/10 bg-white p-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border border-dashed p-7 text-center transition ${
          dragging ? "border-accent-500 bg-accent-100/60" : "border-carbon/15 hover:border-accent-500/50 hover:bg-sand/40"
        }`}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
        {file ? (
          <>
            <FileUp className="mx-auto h-8 w-8 text-accent-500" />
            <p className="mt-3 truncate text-sm font-semibold text-carbon">{file.name}</p>
            <p className="mt-1 text-xs text-carbon/50">Click để chọn file khác</p>
          </>
        ) : (
          <>
            <UploadCloud className="mx-auto h-8 w-8 text-carbon/35" />
            <p className="mt-3 text-sm font-semibold text-carbon">Kéo thả PDF tài liệu vào đây</p>
            <p className="mt-1 text-xs text-carbon/50">hoặc click để chọn · tối đa 50 MB</p>
          </>
        )}
      </div>

      {file && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon/50">
            Môn học
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-2 w-full rounded-xl border border-carbon/12 bg-sand/45 px-3 py-2.5 text-sm text-carbon outline-none transition focus:border-accent-500"
            >
              <option value="Chung">Chung (General)</option>
              <option value="Toán">Toán học (Mathematics)</option>
              <option value="Ngữ văn">Ngữ văn (Literature)</option>
              <option value="Tiếng Anh">Tiếng Anh (English)</option>
              <option value="Vật lý">Vật lý (Physics)</option>
              <option value="Hóa học">Hóa học (Chemistry)</option>
              <option value="Sinh học">Sinh học (Biology)</option>
              <option value="Lịch sử">Lịch sử (History)</option>
              <option value="Địa lý">Địa lý (Geography)</option>
              <option value="Tin học">Tin học (Computer Science)</option>
              <option value="GDKT & PL">GDKT & PL (Civics & Law)</option>
              <option value="Công nghệ">Công nghệ (Technology)</option>
            </select>
          </label>

          <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-carbon/50">
            Loại tài liệu
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              className="mt-2 w-full rounded-xl border border-carbon/12 bg-sand/45 px-3 py-2.5 text-sm text-carbon outline-none transition focus:border-accent-500"
            >
              <option value="exam">Đề thi / Bài tập</option>
              <option value="textbook">Sách giáo khoa / Giáo trình</option>
            </select>
          </label>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-medium text-accent-600">{error}</p>}

      {file && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFile(null)} disabled={busy}>
            <X className="h-4 w-4" />
            Bỏ chọn
          </Button>
          <Button size="sm" onClick={() => void submit()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Bắt đầu xử lý
          </Button>
        </div>
      )}
    </div>
  );
}
