import { ArrowRight, Library, PauseCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";

/**
 * Nhánh hiển thị khi tính năng hỏi đáp AI đang tắt. Không render ô nhập câu hỏi, nút gửi
 * hay bộ chọn tài liệu, và không gọi API nào.
 */
export function ChatPlaceholder({ unknown = false }: { unknown?: boolean }) {
  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
        <PauseCircle className="h-6 w-6" />
      </div>
      <h1 className="mt-5 font-display text-xl font-extrabold tracking-[-0.03em] text-carbon">
        Tính năng hỏi đáp AI đang tạm ngưng
      </h1>
      <p className="mt-3 text-sm leading-6 text-carbon/60">
        Hệ thống đang được nâng cấp nên phần hỏi đáp AI chưa hoạt động. Tài liệu của bạn vẫn được lưu an toàn: hãy mở thư
        viện để tải lên, xem lại hoặc tải xuống PDF như bình thường.
      </p>
      {unknown && <p className="mt-3 text-xs font-medium text-carbon/50">Hiện chưa xác định được trạng thái tính năng.</p>}
      <Link
        to="/library"
        className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-carbon px-5 py-3 text-sm font-semibold text-cream transition hover:shadow-hard-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-500/30"
      >
        <Library className="h-4 w-4" />
        Mở thư viện tài liệu
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
