import { useEffect, useState } from "react";
import { api, type ReadyStatus } from "../lib/api";

// Promise ở module scope: ChatPage, Sidebar và DashboardPage cùng dùng một lần gọi, nên
// mỗi lần tải ứng dụng chỉ có tối đa 1 request tới readiness endpoint.
let pending: Promise<ReadyStatus> | null = null;

function readOnce(): Promise<ReadyStatus> {
  if (pending === null) pending = api.getReadiness();
  return pending;
}

export interface AiFeaturesState {
  /** null = chưa xác định được trạng thái cờ. */
  aiEnabled: boolean | null;
  /** true khi không đọc được cờ (lỗi mạng, response lỗi, quá thời gian, dữ liệu sai kiểu). */
  unknown: boolean;
}

export function useAiFeatures(): AiFeaturesState {
  const [state, setState] = useState<AiFeaturesState>({ aiEnabled: null, unknown: false });

  useEffect(() => {
    let active = true;
    void readOnce()
      .then((data) => {
        if (!active) return;
        const raw: unknown = (data as { ai_enabled?: unknown } | null)?.ai_enabled;
        // Fail-safe: giá trị không phải boolean cũng coi như tắt.
        if (typeof raw === "boolean") setState({ aiEnabled: raw, unknown: false });
        else setState({ aiEnabled: false, unknown: true });
      })
      .catch(() => {
        pending = null; // cho phép thử lại ở lần mount sau
        if (!active) return;
        setState({ aiEnabled: false, unknown: true });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
