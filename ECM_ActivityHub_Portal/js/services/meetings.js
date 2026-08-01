import { CONFIG } from "../core/config.js";
import { Store } from "../core/store.js";
import { callApi } from "../api/client.js";
import { toast } from "../utils/toast.js";
import { uid } from "../utils/fn.js";

export async function listMeetings() {
  const res = await callApi(CONFIG.ACTIONS.MEETING_LIST, {});
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    Store.entities.meetings = data?.items ?? data ?? [];
  }
  return Store.entities.meetings;
}

export async function requestMeeting(form) {
  const payload = { ...form, status: "Requested" };
  const res = await callApi(CONFIG.ACTIONS.MEETING_REQUEST, payload);
  if (res.ok) {
    const data = res.data?.data ?? res.data;
    const item = data?.item ?? payload;
    if (!item.id) item.id = uid("MTG");
    Store.entities.meetings.unshift(item);
    toast("success", "Meeting request logged.");
    return true;
  }
  Store.entities.meetings.unshift({ ...payload, id: uid("MTG"), _local: true });
  toast("info", "Saved locally (demo/offline).");
  return false;
}

export async function approveMeeting(meetingId, decision, comments) {
  const res = await callApi(CONFIG.ACTIONS.MEETING_APPROVE, { meetingId, decision, comments });
  Store.entities.meetings = Store.entities.meetings.map(m => m.id === meetingId ? { ...m, status: decision === "Approve" ? "Approved" : "Declined", decisionAt: new Date().toISOString(), comments, _local: !res.ok } : m);
  toast(res.ok ? "success" : "info", res.ok ? "Meeting decision saved." : "Saved locally (demo/offline).");
  return res.ok;
}

export async function minutesToTasks(meetingId) {
  const res = await callApi(CONFIG.ACTIONS.MEETING_MINUTE_TO_TASKS, { meetingId });
  toast(res.ok ? "success" : "info", res.ok ? "Actions converted to tasks (per backend)." : "No backend conversion; create tasks manually (demo/offline).");
  return res.ok;
}
