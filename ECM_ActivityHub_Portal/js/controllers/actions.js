import { Store, setDeepValue, setBusy, openModal, closeModal } from "../core/store.js";
import { renderApp } from "../views/layout.js";
import { navigate } from "../core/router.js";
import { toast } from "../utils/toast.js";

import { initBootstrap } from "../services/bootstrap.js";
import { listInbox, triageInbox, promoteToTask } from "../services/inbox.js";
import { listInward, listOutward, registerInward, createOutward, deleteCorrespondence } from "../services/correspondence.js";
import { listMinutes, createMinute, routeMinute, closeMinute } from "../services/minutes.js";
import { listApprovals, decideApproval } from "../services/approvals.js";
import { listBriefs, createBrief, submitBrief, decideBrief } from "../services/briefs.js";
import { listDecisions, recordDecision } from "../services/decisions.js";
import { listMeetings, requestMeeting, approveMeeting, minutesToTasks } from "../services/meetings.js";
import { listTasks, createTask, completeTask, deleteTask } from "../services/tasks.js";
import { listProjects, updateProject } from "../services/projects.js";
import { getKpiSnapshot } from "../services/kpi.js";
import { listNotifications, ackNotification, listAudit, listDirectory, generateReport, getSlaMetrics } from "../services/ops.js";
import { aiChat } from "../services/ai.js";

import { modalInward, modalOutward, modalMinute, modalApprovalDecision, modalBrief, modalDecision, modalMeeting, modalTask } from "../views/components/modals.js";

function inputValue(el) { return (el && "value" in el) ? el.value : ""; }

export async function dispatchAction(action, el) {
  // Sidebar
  if (action === "sidebar.toggle") { Store.ui.sidebarOpen = !Store.ui.sidebarOpen; return renderApp(); }
  if (action === "sidebar.close") { Store.ui.sidebarOpen = false; return renderApp(); }

  // Navigation
  if (action === "nav") {
    const r = el.dataset.route || "/dashboard";
    Store.ui.sidebarOpen = false;
    navigate(r);
    return;
  }

  // Role switch (lightweight demo)
  if (action === "role.switch") {
    const current = Store.auth.user.role;
    Store.auth.user.role = current === "DGCEO" ? "COS" : "DGCEO";
    Store.auth.user.name = Store.auth.user.role === "DGCEO" ? "DG/CEO" : "Chief of Staff";
    toast("info", `Role switched to ${Store.auth.user.role}`);
    return renderApp();
  }

  // Filters (inbox q via direct input)
  if (action === "filter.inbox.q") {
    Store.ui.filters.inbox.q = inputValue(el);
    return renderApp();
  }

  // Global refresh
  if (action === "refresh.all") {
    await initBootstrap();
    return renderApp();
  }

  // Inbox actions
  if (action === "inbox.refresh") { await listInbox(); return renderApp(); }
  if (action === "inbox.route") {
    const id = el.dataset.id;
    openModal(modalMinute(id)); // route via minute sheet
    return renderApp();
  }
  if (action === "inbox.task") {
    const id = el.dataset.id;
    const item = Store.entities.inbox.find(x => x.id === id);
    if (item) promoteToTask(item);
    return renderApp();
  }
  if (action === "inbox.close") {
    const id = el.dataset.id;
    await triageInbox(id, { status: "Closed" });
    return renderApp();
  }

  // Modals open
  if (action === "modal.inward.open") { openModal(modalInward()); return renderApp(); }
  if (action === "modal.outward.open") { openModal(modalOutward()); return renderApp(); }
  if (action === "modal.minute.open") { openModal(modalMinute("")); return renderApp(); }
  if (action === "modal.brief.open") { openModal(modalBrief()); return renderApp(); }
  if (action === "modal.decision.open") { openModal(modalDecision()); return renderApp(); }
  if (action === "modal.meeting.open") { openModal(modalMeeting()); return renderApp(); }
  if (action === "modal.task.open") { openModal(modalTask()); return renderApp(); }
  if (action === "modal.close") { closeModal(); return renderApp(); }

  // Correspondence
  if (action === "corr.inward.refresh") { await listInward(); return renderApp(); }
  if (action === "corr.outward.refresh") { await listOutward(); return renderApp(); }
  if (action === "corr.inward.save") {
    setBusy(true, "Registering inward…"); renderApp();
    try { await registerInward(Store.ui.forms.inward); } finally { setBusy(false); closeModal(); }
    return renderApp();
  }
  if (action === "corr.outward.save") {
    setBusy(true, "Saving outward draft…"); renderApp();
    try { await createOutward(Store.ui.forms.outward); } finally { setBusy(false); closeModal(); }
    return renderApp();
  }
  if (action === "corr.inward.delete") { await deleteCorrespondence("inward", el.dataset.id); return renderApp(); }
  if (action === "corr.outward.delete") { await deleteCorrespondence("outward", el.dataset.id); return renderApp(); }

  // Minutes
  if (action === "minute.refresh") { await listMinutes(); return renderApp(); }
  if (action === "minute.save") {
    setBusy(true, "Saving minute…"); renderApp();
    try { await createMinute(Store.ui.forms.minute); } finally { setBusy(false); closeModal(); }
    return renderApp();
  }
  if (action === "minute.route") {
    const id = el.dataset.id;
    const routeTo = Store.ui.forms.minute.routeTo || "—";
    const comments = Store.ui.forms.minute.comments || "";
    await routeMinute(id, routeTo, comments);
    return renderApp();
  }
  if (action === "minute.close") { await closeMinute(el.dataset.id); return renderApp(); }

  // Approvals
  if (action === "approvals.refresh") { await listApprovals(); return renderApp(); }
  if (action === "approval.decide.open") {
    openModal(modalApprovalDecision(el.dataset.id));
    return renderApp();
  }
  if (action === "approval.decide.save") {
    setBusy(true, "Recording decision…"); renderApp();
    try {
      const f = Store.ui.forms.approvalDecision;
      await decideApproval(f.approvalId, f.decision, f.comments);
    } finally {
      setBusy(false); closeModal();
    }
    return renderApp();
  }

  // Briefs
  if (action === "briefs.refresh") { await listBriefs(); return renderApp(); }
  if (action === "brief.save") {
    setBusy(true, "Saving brief…"); renderApp();
    try { await createBrief(Store.ui.forms.brief); } finally { setBusy(false); closeModal(); }
    return renderApp();
  }
  if (action === "brief.submit") { await submitBrief(el.dataset.id); return renderApp(); }
  if (action === "brief.decide.open") {
    // reuse approval decision modal fields
    Store.ui.forms.approvalDecision = { approvalId: el.dataset.id, decision: "Approve", comments: "" };
    openModal(modalApprovalDecision(el.dataset.id));
    // override save handler by setting a flag
    Store.ui._briefDecision = true;
    return renderApp();
  }
  if (action === "approval.decide.save" && Store.ui._briefDecision) {
    // not reached because earlier return; kept for safety
  }

  // Decisions
  if (action === "decisions.refresh") { await listDecisions(); return renderApp(); }
  if (action === "decision.save") {
    setBusy(true, "Recording decision…"); renderApp();
    try { await recordDecision(Store.ui.forms.decision); } finally { setBusy(false); closeModal(); }
    return renderApp();
  }

  // Meetings
  if (action === "meetings.refresh") { await listMeetings(); return renderApp(); }
  if (action === "meeting.save") {
    setBusy(true, "Saving meeting request…"); renderApp();
    try { await requestMeeting(Store.ui.forms.meeting); } finally { setBusy(false); closeModal(); }
    return renderApp();
  }
  if (action === "meeting.decide") {
    const id = el.dataset.id;
    const decision = el.dataset.decision;
    await approveMeeting(id, decision, "");
    return renderApp();
  }
  if (action === "meeting.tasks") { await minutesToTasks(el.dataset.id); return renderApp(); }

  // Tasks
  if (action === "tasks.refresh") { await listTasks(); return renderApp(); }
  if (action === "task.save") {
    setBusy(true, "Saving task…"); renderApp();
    try { await createTask(Store.ui.forms.task); } finally { setBusy(false); closeModal(); }
    return renderApp();
  }
  if (action === "task.complete") { await completeTask(el.dataset.id); return renderApp(); }
  if (action === "task.delete") { await deleteTask(el.dataset.id); return renderApp(); }

  // Projects
  if (action === "projects.refresh") { await listProjects(); return renderApp(); }
  if (action === "project.status") {
    await updateProject(el.dataset.id, { status: el.dataset.status });
    return renderApp();
  }

  // KPI
  if (action === "kpi.refresh") { await getKpiSnapshot(); return renderApp(); }

  // Notifications
  if (action === "notif.refresh") { await listNotifications(); return renderApp(); }
  if (action === "notif.ack") { await ackNotification(el.dataset.id); return renderApp(); }

  // Audit
  if (action === "audit.refresh") { await listAudit({}); return renderApp(); }

  // Directory
  if (action === "directory.refresh") { await listDirectory(); return renderApp(); }

  // Reports
  if (action === "report.generate") {
    const t = el.dataset.type || "DG_WEEKLY_PACK";
    setBusy(true, "Generating report…"); renderApp();
    try {
      const res = await generateReport(t);
      if (res.ok) toast("success", "Report generated (check backend response for URL).");
      else toast("info", "Report request sent (demo/offline).");
    } finally {
      setBusy(false);
    }
    return renderApp();
  }

  // AI
  if (action === "ai.send") {
    const draft = Store.ui.aiDraft || "";
    if (!draft.trim()) return;
    Store.ui.aiHistory = Store.ui.aiHistory || [{ role: "system", content: "You are the DG/CEO Executive Assistant. Provide concise, policy-compliant support." }];
    Store.ui.aiHistory.push({ role: "user", content: draft });
    Store.ui.aiDraft = "";
    renderApp();
    setBusy(true, "AI is thinking…"); renderApp();
    try {
      const reply = await aiChat(Store.ui.aiHistory);
      Store.ui.aiHistory.push({ role: "assistant", content: reply || "AI unavailable (check API_URL and backend)." });
    } finally {
      setBusy(false);
    }
    return renderApp();
  }
  if (action === "ai.clear") {
    Store.ui.aiHistory = [{ role: "system", content: "You are the DG/CEO Executive Assistant. Provide concise, policy-compliant support." }];
    Store.ui.aiDraft = "";
    return renderApp();
  }

  // Admin small test toast
  if (action === "admin.demoToast") {
    toast("info", "Admin test notification.");
    return renderApp();
  }
}
