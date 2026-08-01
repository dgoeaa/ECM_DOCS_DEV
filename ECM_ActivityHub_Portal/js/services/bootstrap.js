import { CONFIG } from "../core/config.js";
import { Store, setBusy } from "../core/store.js";
import { toast } from "../utils/toast.js";
import { callApi } from "../api/client.js";
import { demoBootstrap } from "../data/demo.js";

export async function initBootstrap() {
  setBusy(true, "Syncing Executive Hub…");
  try {
    const res = await callApi(CONFIG.ACTIONS.GET_BOOTSTRAP, {});
    if (res.ok) {
      // Expected backend response shape:
      // { ref:{departments,people}, entities:{inbox,inward,outward,minutes,approvals,briefs,decisions,meetings,tasks,projects,kpi,notifications,audit,sla,directory} }
      const data = res.data?.data ?? res.data;
      if (data?.ref) Store.ref = { ...Store.ref, ...data.ref };
      if (data?.entities) Store.entities = { ...Store.entities, ...data.entities };
      toast("success", "System synced.");
      return;
    }
    if (CONFIG.DEMO_FALLBACK) {
      const demo = demoBootstrap();
      Store.ref = { ...Store.ref, ...demo.ref };
      Store.entities = { ...Store.entities, ...demo.entities };
      toast("info", "Running in demo mode (API not configured / unavailable).");
      return;
    }
    toast("error", `Bootstrap failed: ${res.error || "Unknown error"}`);
  } finally {
    setBusy(false);
  }
}
