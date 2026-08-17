import { FileText, Quote, Search } from "lucide-react";

const features = [
  {
    index: "01",
    icon: FileText,
    title: "Tài liệu của bạn, không phải internet",
    description: "Kéo thả PDF đề thi, sách giáo khoa, vở ghi. Hệ thống tự đọc, tách trang và cắt đoạn theo ngữ nghĩa.",
  },
  {
    index: "02",
    icon: Search,
    title: "Tìm đúng đoạn, không lan man",
    description: "Truy xuất theo ngữ cảnh tiếng Việt, đưa ra đúng trang và đúng câu bạn cần trong vài giây.",
  },
  {
    index: "03",
    icon: Quote,
    title: "Trả lời kèm trích dẫn kiểm chứng được",
    description: "Mỗi câu trả lời đều ghi rõ file nào, trang nào — bạn tự mở lại để đối chiếu.",
  },
];

export function Features() {
  return (
    <section className="bg-cream px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 border-b border-carbon/12 pb-10 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-xl font-display text-[clamp(1.9rem,3.6vw,2.9rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-carbon">
            Ba việc Examoras làm tốt hơn một chatbot thường
          </h2>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-carbon/45 md:pb-2">Tập trung vào việc học</p>
        </div>

        <ul className="grid gap-px sm:grid-cols-3">
          {features.map(({ index, icon: Icon, title, description }) => (
            <li key={index} className="group relative border-b border-carbon/12 py-9 sm:border-b-0 sm:border-r sm:px-7 sm:py-10 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-carbon/12 bg-white text-carbon transition group-hover:-translate-y-1 group-hover:border-accent-500 group-hover:bg-accent-500 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display text-xs font-bold tracking-[0.2em] text-carbon/25">{index}</span>
              </div>
              <h3 className="mt-7 font-display text-lg font-bold leading-snug tracking-tight text-carbon">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-carbon/60">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
