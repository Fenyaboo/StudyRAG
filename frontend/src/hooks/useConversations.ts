import { useCallback, useEffect, useState } from "react";
import { api, type Conversation, type Message } from "../lib/api";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api.listConversations();
      setConversations(result.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const messages = useCallback(async (id: string): Promise<Message[]> => (await api.listMessages(id)).items, []);
  const remove = useCallback(async (id: string) => {
    await api.deleteConversation(id);
    await refresh();
  }, [refresh]);

  return { conversations, loading, refresh, messages, remove };
}
