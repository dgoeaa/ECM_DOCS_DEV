// Briefs, meetings and projects — the three capabilities ported from the ECM Activity Hub.
//
// WHY THESE THREE, AND WHY HERE
// docs/architecture/CONSOLIDATION_ANALYSIS.md compared the Activity Hub's 19 pages against
// this platform's 26 routes: 15 overlapped fully, one partially, and exactly three had no
// equivalent here at all. Decision D6(b) was to bring those three across and retire the
// shell. This is the domain half of that port.
//
// They live in one module because they are the same shape of thing — a register with a
// light lifecycle — and they share the identifier and transition helpers. Splitting them
// into three files would triplicate those for no gain.
//
// WHAT CHANGED IN THE PORT, DELIBERATELY
//
//   1. TRANSITIONS ARE GUARDED. The Activity Hub applied any decision to any record:
//      `decideBrief` rewrote status regardless of what the brief was in, so a rejected
//      brief could be re-decided and an unsubmitted one approved. Here a transition that
//      is not legal from the current state is refused.
//   2. THE SERVER'S ANSWER IS NOT ASSUMED. The Activity Hub mutated local state and then
//      reported success whether or not the call succeeded — `_local: !res.ok` recorded the
//      failure on the record but the toast still said "saved". Delivery is reported
//      separately here and the caller decides what to tell the user.
//   3. NO DEMO ROWS. Nothing seeds these. The Activity Hub never had demo data for any of
//      the three either, so there is no shipped sample to preserve.

const now = () => new Date().toISOString();

/** `PREFIX-<uuid>`, matching core/enterprise-domain.js `uid`. Not a registry reference — a
 *  brief is not correspondence and must not consume the correspondence sequence. */
const uid = prefix => `${prefix}-${crypto.randomUUID()}`;

const str = v => String(v ?? '').trim();

export class RegisterError extends Error {
  constructor(reason, detail = '') {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'RegisterError';
    this.reason = reason;
  }
}

/* ── briefs ────────────────────────────────────────────────────────────────────
   An executive briefing pack: drafted, submitted for decision, then approved or
   rejected. Draft → Submitted → Approved | Rejected, and nothing else. */

export const BriefStates = Object.freeze(['Draft', 'Submitted', 'Approved', 'Rejected']);

const BRIEF_TRANSITIONS = Object.freeze({
  Draft:     ['Submitted'],
  Submitted: ['Approved', 'Rejected'],
  Approved:  [],
  Rejected:  [],
});

export const Briefs = Object.freeze({
  create(form = {}, by = '') {
    const title = str(form.title);
    if (!title) throw new RegisterError('missing_title');
    return {
      id: uid('BRF'),
      title,
      theme: str(form.theme),
      summary: str(form.summary),
      background: str(form.background),
      options: str(form.options),
      risks: str(form.risks),
      recommendation: str(form.recommendation),
      status: 'Draft',
      raisedBy: str(by),
      createdAt: now(),
      updatedAt: now(),
    };
  },

  /** Legal next states from where the brief is now. */
  nextStates(brief) {
    return BRIEF_TRANSITIONS[brief?.status] || [];
  },

  /**
   * Apply a lifecycle transition. Throws rather than silently rewriting a record that is
   * not in a state the transition is legal from — the Activity Hub allowed exactly that.
   */
  transition(brief, to, { comments = '', by = '' } = {}) {
    if (!brief) throw new RegisterError('unknown_brief');
    if (!BriefStates.includes(to)) throw new RegisterError('unknown_state', to);
    if (!Briefs.nextStates(brief).includes(to)) {
      throw new RegisterError('illegal_transition', `${brief.status} → ${to}`);
    }
    const patch = { status: to, updatedAt: now() };
    if (to === 'Submitted') { patch.submittedAt = now(); patch.submittedBy = str(by); }
    else { patch.decidedAt = now(); patch.decidedBy = str(by); patch.decisionComments = str(comments); }
    return { ...brief, ...patch };
  },
});

/* ── meetings ──────────────────────────────────────────────────────────────────
   A meeting request, approved or declined, whose agreed actions become tasks.
   Requested → Approved | Declined; an approved meeting can then be Held. */

export const MeetingStates = Object.freeze(['Requested', 'Approved', 'Declined', 'Held']);

const MEETING_TRANSITIONS = Object.freeze({
  Requested: ['Approved', 'Declined'],
  Approved:  ['Held'],
  Declined:  [],
  Held:      [],
});

export const Meetings = Object.freeze({
  create(form = {}, by = '') {
    const title = str(form.title);
    if (!title) throw new RegisterError('missing_title');
    const date = str(form.date);
    if (!date) throw new RegisterError('missing_date');
    return {
      id: uid('MTG'),
      title,
      requestor: str(form.requestor) || str(by),
      date,
      time: str(form.time),
      location: str(form.location) || 'Virtual',
      agenda: str(form.agenda),
      attendees: str(form.attendees),
      notes: str(form.notes),
      status: 'Requested',
      createdAt: now(),
      updatedAt: now(),
    };
  },

  nextStates(meeting) {
    return MEETING_TRANSITIONS[meeting?.status] || [];
  },

  transition(meeting, to, { comments = '', by = '' } = {}) {
    if (!meeting) throw new RegisterError('unknown_meeting');
    if (!MeetingStates.includes(to)) throw new RegisterError('unknown_state', to);
    if (!Meetings.nextStates(meeting).includes(to)) {
      throw new RegisterError('illegal_transition', `${meeting.status} → ${to}`);
    }
    const patch = { status: to, updatedAt: now() };
    if (to === 'Held') patch.heldAt = now();
    else { patch.decidedAt = now(); patch.decidedBy = str(by); patch.decisionComments = str(comments); }
    return { ...meeting, ...patch };
  },

  /**
   * Agreed actions → task records, one per non-empty line of `actions`.
   *
   * The Activity Hub asked its backend to do this and, when there was no backend, told the
   * user to "create tasks manually" — the conversion existed only as a remote call. Doing
   * it here means the capability works whether or not a backend answers, which is the whole
   * reason the capability is interesting.
   *
   * Shape matches the root's `operations` collection so converted actions are ordinary
   * tasks, not a parallel kind of work.
   */
  actionsToTasks(meeting, actions, { by = '', dueDate = '' } = {}) {
    if (!meeting) throw new RegisterError('unknown_meeting');
    const lines = String(actions || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) throw new RegisterError('no_actions');
    return lines.map(line => ({
      id: uid('TSK'),
      referenceId: meeting.id,
      title: line,
      description: `Agreed at: ${meeting.title}`,
      status: 'Not Started',
      priority: 'normal',
      assignedTo: '',
      createdBy: str(by),
      dueDate: str(dueDate),
      source: 'meeting',
      createdAt: now(),
      updatedAt: now(),
    }));
  },
});

/* ── projects ──────────────────────────────────────────────────────────────────
   A register of projects with an owner, a status and a KPI note. The lightest of the
   three — a list with an update, not a workflow. */

export const ProjectStates = Object.freeze(['Planned', 'Active', 'On Hold', 'Completed', 'Cancelled']);

export const Projects = Object.freeze({
  create(form = {}, by = '') {
    const name = str(form.name);
    if (!name) throw new RegisterError('missing_name');
    const status = str(form.status) || 'Planned';
    if (!ProjectStates.includes(status)) throw new RegisterError('unknown_state', status);
    return {
      id: uid('PRJ'),
      name,
      owner: str(form.owner) || str(by),
      status,
      kpi: str(form.kpi),
      createdAt: now(),
      updatedAt: now(),
    };
  },

  /**
   * Patch a project by allow-list.
   *
   * The Activity Hub spread an arbitrary `patch` object onto the record, so a caller could
   * add or overwrite any field including `id`. Only these four are updatable.
   */
  update(project, patch = {}) {
    if (!project) throw new RegisterError('unknown_project');
    const next = { ...project, updatedAt: now() };
    if (patch.name !== undefined) {
      const name = str(patch.name);
      if (!name) throw new RegisterError('missing_name');
      next.name = name;
    }
    if (patch.owner !== undefined) next.owner = str(patch.owner);
    if (patch.kpi !== undefined) next.kpi = str(patch.kpi);
    if (patch.status !== undefined) {
      const status = str(patch.status);
      if (!ProjectStates.includes(status)) throw new RegisterError('unknown_state', status);
      next.status = status;
    }
    return next;
  },
});
