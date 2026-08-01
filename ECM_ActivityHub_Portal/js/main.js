import { startRouter } from "./core/router.js";
import { registerBindings } from "./events/bindings.js";
import { renderApp } from "./views/layout.js";
import { initBootstrap } from "./services/bootstrap.js";
import { listInbox } from "./services/inbox.js";
import { listInward, listOutward } from "./services/correspondence.js";
import { listApprovals } from "./services/approvals.js";
import { listTasks } from "./services/tasks.js";
import { listNotifications, listAudit, listDirectory } from "./services/ops.js";
import { listMeetings } from "./services/meetings.js";
import { listBriefs } from "./services/briefs.js";
import { listDecisions } from "./services/decisions.js";

registerBindings();
startRouter();

await initBootstrap();

// Prime key queues in parallel (best-effort; demo/bootstrap may already fill them)
Promise.allSettled([
  listInbox(),
  listInward(),
  listOutward(),
  listApprovals(),
  listTasks(),
  listMeetings(),
  listBriefs(),
  listDecisions(),
  listNotifications(),
  listAudit(),
  listDirectory()
]).finally(() => renderApp());
