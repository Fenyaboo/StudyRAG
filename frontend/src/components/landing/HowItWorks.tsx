import { MessageCircle, Sparkles, Upload } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Tải tài liệu lên",
    description: "Đề thi, sách giáo khoa, vở ghi dạng PDF. Mỗi file được tách trang và đánh chỉ mục riêng cho bạn.",
  },
  {
    number: "02",
    icon: MessageCircle,
    title: "Hỏi bằng tiếng Việt",
    description: "Đặt câu hỏi tự nhiên như đang nhắn cho gia sư. Không cần từ khoá, không cần cú pháp đặc biệt.",
  },
  {
    number: "03",
    icon: Sparkles,
    title: "Nhận đáp án có nguồn",
    description: "Câu trả lời gọn, kèm số trang để bạn mở lại đúng chỗ và tự kiểm chứng trước khi học thuộc.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-carbon/10 bg-sand px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-600">Ba bước để bắt đầu</p>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,3.6vw,2.9rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-carbon">
            Từ tài liệu đến câu trả lời
          </h2>
        </div>

        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map(({ number, icon: Icon, title, description }) => (
            <li key={number} className="relative border-t-2 border-carbon pt-6">
              <span className="font-display text-[3.25rem] font-extrabold leading-none tracking-[-0.05em] text-carbon/12">{number}</span>
              <span className="absolute right-0 top-6 grid h-10 w-10 place-items-center rounded-xl border border-carbon/12 bg-cream text-accent-600">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
              <h3 className="mt-3 font-display text-lg font-bold tracking-tight text-carbon">{title}</h3>
              <p className="mt-2.5 max-w-xs text-sm leading-6 text-carbon/60">{description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
