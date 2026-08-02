import { Store } from "../core/store.js";
import { renderNotFound, renderDenied } from "./pages/notfound.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderInbox } from "./pages/inbox.js";
import { renderInward } from "./pages/inward.js";
import { renderOutward } from "./pages/outward.js";
import { renderMinutes } from "./pages/minutes.js";
import { renderApprovals } from "./pages/approvals.js";
import { renderBriefs } from "./pages/briefs.js";
import { renderDecisions } from "./pages/decisions.js";
import { renderMeetings } from "./pages/meetings.js";
import { renderTasks } from "./pages/tasks.js";
import { renderProjects } from "./pages/projects.js";
import { renderKpi } from "./pages/kpi.js";
import { renderReports } from "./pages/reports.js";
import { renderNotifications } from "./pages/notifications.js";
import { renderAudit } from "./pages/audit.js";
import { renderDirectory } from "./pages/directory.js";
import { renderAdmin } from "./pages/admin.js";
import { renderAi } from "./pages/ai.js";

export function renderRoute() {
  const r = Store.ui.route;
  switch (r) {
    case "/dashboard": return renderDashboard();
    case "/inbox": return renderInbox();
    case "/correspondence/inward": return renderInward();
    case "/correspondence/outward": return renderOutward();
    case "/minutes": return renderMinutes();
    case "/approvals": return renderApprovals();
    case "/briefs": return renderBriefs();
    case "/decisions": return renderDecisions();
    case "/meetings": return renderMeetings();
    case "/tasks": return renderTasks();
    case "/projects": return renderProjects();
    case "/kpi": return renderKpi();
    case "/reports": return renderReports();
    case "/notifications": return renderNotifications();
    case "/audit": return renderAudit();
    case "/directory": return renderDirectory();
    case "/admin": return renderAdmin();
    case "/ai": return renderAi();
    case "/denied": return renderDenied();
    default: return renderNotFound();
  }
}
