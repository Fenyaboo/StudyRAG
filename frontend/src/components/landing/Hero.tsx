import { ArrowRight, FileText, Quote } from "lucide-react";
import { Link } from "react-router-dom";

const stats = [
  { value: "< 5s", label: "Tìm đúng trang cần" },
  { value: "100%", label: "Câu trả lời có nguồn" },
  { value: "9 môn", label: "Bám chương trình 12" },
];

const subjects = ["Toán", "Ngữ văn", "Vật lý", "Hóa học", "Sinh học", "Tiếng Anh", "Lịch sử", "Địa lý", "GDKT & PL"];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-cream px-6 pb-16 pt-12 sm:pt-16">
      {/* Đường kẻ dọc mảnh tạo cảm giác lưới in ấn */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-carbon/[0.06] lg:block" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <p className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-carbon/55">
            <span className="relative grid h-2 w-2 place-items-center">
              <span className="absolute inset-0 rounded-full bg-accent-500" />
              <span className="absolute inset-0 animate-ping rounded-full bg-accent-500/60" />
            </span>
            Trợ lý ôn thi của riêng bạn
          </p>

          <h1 className="mt-6 font-display text-[clamp(2.5rem,6.2vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.035em] text-carbon">
            Ôn thi lớp 12
            <br />
            bằng{" "}
            <span className="relative whitespace-nowrap">
              <span className="relative z-10">tài liệu</span>
              <span aria-hidden className="absolute inset-x-[-2px] bottom-[0.12em] z-0 h-[0.34em] -rotate-[0.8deg] bg-accent-500/35" />
            </span>{" "}
            của chính mình
          </h1>

          <p className="mt-7 max-w-md text-[15px] leading-7 text-carbon/65">
            Tải đề thi và sách giáo khoa lên. StudyRAG đọc hiểu, tìm đúng đoạn cần và trả lời kèm trích dẫn trang — không đoán, không nói chung chung.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2.5 rounded-full bg-carbon px-6 py-3.5 text-sm font-semibold text-cream transition hover:shadow-hard-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              Bắt đầu miễn phí
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="border-b border-carbon/25 pb-0.5 text-sm font-medium text-carbon/75 transition hover:border-accent-500 hover:text-accent-600"
            >
              Xem cách hoạt động
            </a>
          </div>

          <dl className="mt-14 grid max-w-lg grid-cols-3 gap-px overflow-hidden border-y border-carbon/10">
            {stats.map(({ value, label }) => (
              <div key={label} className="py-5 pr-4">
                <dt className="font-display text-2xl font-bold tracking-tight text-carbon">{value}</dt>
                <dd className="mt-1 text-[11px] uppercase tracking-[0.12em] text-carbon/50">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Mock sản phẩm */}
        <div className="relative">
          <div aria-hidden className="absolute -right-3 -top-4 h-24 w-24 rounded-2xl border border-carbon/12 bg-sand" />
          <div className="relative rounded-[26px] border border-carbon/12 bg-white p-4 shadow-lift sm:p-5">
            <div className="flex items-center gap-2.5 border-b border-carbon/8 pb-3.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-carbon text-cream">
                <FileText className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-medium text-carbon/70">Vật lý 12 — Chuyên đề cơ năng.pdf</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Đã xử lý
              </span>
            </div>

            <div className="space-y-4 pt-5">
              <p className="ml-auto max-w-[16rem] rounded-2xl rounded-br-md bg-carbon px-4 py-3 text-[13px] leading-5 text-cream">
                Giải thích định luật bảo toàn cơ năng trong tài liệu của mình.
              </p>

              <div className="max-w-[21rem] rounded-2xl rounded-tl-md border border-carbon/10 bg-sand/50 px-4 py-3.5">
                <p className="text-[13px] leading-6 text-carbon/80">
                  Cơ năng của vật chỉ được bảo toàn khi vật chịu tác dụng của lực thế. Khi đó tổng động năng và thế năng không đổi…
                </p>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <span className="rounded-md bg-accent-100 px-2 py-1 text-[10px] font-semibold text-accent-600">[1] Vật lý 12 · tr. 42</span>
                  <span className="rounded-md bg-accent-100 px-2 py-1 text-[10px] font-semibold text-accent-600">[2] Chuyên đề · tr. 8</span>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-5 -left-2 hidden -rotate-[4deg] items-center gap-2 rounded-xl bg-accent-500 px-3.5 py-2.5 text-[11px] font-semibold text-white shadow-hard sm:inline-flex">
            <Quote className="h-3.5 w-3.5" />
            Mọi câu đều dẫn nguồn
          </div>
        </div>
      </div>

      {/* Dải chạy các môn học */}
      <div className="relative mx-auto mt-20 max-w-6xl overflow-hidden border-y border-carbon/10 py-4">
        <div className="flex w-max animate-marquee gap-10" aria-hidden>
          {[...subjects, ...subjects].map((subject, index) => (
            <span key={`${subject}-${index}`} className="flex items-center gap-10 whitespace-nowrap font-display text-sm font-semibold uppercase tracking-[0.18em] text-carbon/35">
              {subject}
              <span className="h-1 w-1 rounded-full bg-accent-500/60" />
            </span>
          ))}
        </div>
        <p className="sr-only">Hỗ trợ các môn: {subjects.join(", ")}.</p>
      </div>
    </section>
  );
}
