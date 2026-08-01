import { uid, isoDate } from "../utils/fn.js";

export function demoBootstrap() {
  const today = isoDate(new Date());
  const inbox = [
    { id: uid("INB"), type: "Inward", refNo: "NITDA/DG/INW/2025/0012", title: "Invitation: National DPI Summit", summary: "Request for DG/CEO keynote and participation.", status: "Open", priority: "High", classification: "Internal", receivedDate: today, owner: "Registry", route: [] },
    { id: uid("INB"), type: "Approval", refNo: "NITDA/DG/APR/2025/0041", title: "Approval: Vendor onboarding for SOC tools", summary: "Approval required for onboarding and procurement steps.", status: "Pending", priority: "Urgent", classification: "Confidential", receivedDate: today, owner: "Procurement", route: [] },
    { id: uid("INB"), type: "Brief", refNo: "NITDA/DG/BRF/2025/0007", title: "Policy Brief: National AI Governance Framework", summary: "Options and recommendation for ministerial submission.", status: "Open", priority: "High", classification: "Internal", receivedDate: today, owner: "Policy", route: [] }
  ];

  const approvals = [
    { id: uid("APR"), title: "Vendor onboarding for SOC tools", amount: "₦—", status: "Pending", requester: "Procurement", createdAt: today, classification: "Confidential" }
  ];

  const inward = [
    { id: uid("INW"), refNo: "NITDA/DG/INW/2025/0012", sender: "DPI Secretariat", subject: "Invitation: National DPI Summit", classification: "Internal", priority: "High", receivedDate: today, status: "Open" }
  ];

  const outward = [
    { id: uid("OUT"), refNo: "NITDA/DG/OUT/2025/0005", recipient: "DPI Secretariat", subject: "Re: Invitation — DG/CEO Participation", classification: "Internal", priority: "Normal", status: "Draft", createdAt: today }
  ];

  const tasks = [
    { id: uid("TSK"), title: "Prepare DG/CEO brief pack for DPI Summit", owner: "Chief of Staff", dueDate: today, status: "Open", priority: "High", relatedId: inward[0].id }
  ];

  const decisions = [
    { id: uid("DEC"), title: "Proceed with AI Governance submission", text: "Approve the recommended option and submit to Minister.", relatedId: "NITDA/DG/BRF/2025/0007", owner: "Policy", dueDate: today, createdAt: today }
  ];

  const meetings = [
    { id: uid("MTG"), title: "Executive Briefing — AI Governance", date: today, time: "10:00", location: "Virtual", status: "Requested", agenda: "Review brief pack and finalize recommendation.", requestor: "Policy" }
  ];

  const projects = [
    { id: uid("PRJ"), name: "National Digital Public Infrastructure", status: "On Track", owner: "DPI Unit", kpi: "Milestones", updatedAt: today }
  ];

  const kpi = { snapshot: [
    { name: "Inward SLA Compliance", value: "92%" },
    { name: "Overdue Tasks", value: "3" },
    { name: "Pending Approvals", value: "1" }
  ], updatedAt: new Date().toISOString() };

  const notifications = [
    { id: uid("NTF"), title: "Overdue task escalated", message: "Task 'Prepare DG/CEO brief pack' due today.", ts: new Date().toISOString(), acknowledged: false }
  ];

  const audit = [
    { id: uid("AUD"), actor: "Registry", action: "REGISTER_INWARD", target: "NITDA/DG/INW/2025/0012", ts: new Date().toISOString() }
  ];

  const directory = [
    { id: uid("PPL"), name: "Chief of Staff", email: "cos@nitda.gov.ng", department: "DG Office" },
    { id: uid("PPL"), name: "Principal Secretary", email: "ps@nitda.gov.ng", department: "DG Office" },
    { id: uid("PPL"), name: "Procurement Lead", email: "proc@nitda.gov.ng", department: "Procurement" },
    { id: uid("PPL"), name: "Policy Lead", email: "policy@nitda.gov.ng", department: "Policy" }
  ];

  return {
    ref: { departments: ["DG Office","Procurement","Policy","Registry","Legal","Finance"], people: directory },
    entities: { inbox, approvals, inward, outward, minutes: [], briefs: [], decisions, meetings, tasks, projects, kpi, notifications, audit, sla: { metrics: [], updatedAt: null }, directory }
  };
}
