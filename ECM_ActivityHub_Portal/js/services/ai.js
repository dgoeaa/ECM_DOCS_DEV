import { CONFIG } from "../core/config.js";
import { callApi } from "../api/client.js";

export async function aiChat(messages) {
  const res = await callApi(CONFIG.ACTIONS.AI_CHAT, { messages });
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    return data?.reply ?? data?.message ?? "OK";
  }
  return null;
}
