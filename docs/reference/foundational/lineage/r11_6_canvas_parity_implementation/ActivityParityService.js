import { DEFAULT_ACTIVITY_FILTERS } from './config/activity-parity.config.js';

const norm = (value) => String(value ?? '').trim().toLowerCase();
const startsWithCI = (value, search) => norm(value).startsWith(norm(search));
const addOneDay = (date) => {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
};
const fmtYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}${m}${d}`;
};

const actionMeta = {
  archive: { category: 'Archived', suffix: 'UNC', messagePrefix: 'Archiving' },
  siwes: { category: 'Internships (SIWES)', suffix: 'INT-SIWES', messagePrefix: 'SIWES' },
  nysc: { category: 'Internships (NYSC)', suffix: 'INT-NYSC', messagePrefix: 'Archiving' }
};

export class ActivityParityService {
  constructor({ now = () => new Date(), createQueueRecord, updateActivity } = {}) {
    this.now = now;
    this.createQueueRecord = createQueueRecord ?? ((payload) => ({ ...payload, ID: 1001 }));
    this.updateActivity =
      updateActivity ??
      ((activity, patchRecord) => ({
        ...activity,
        Status: { Value: 'Treated' },
        AssignedTo: patchRecord.AssignedTo,
        Category: patchRecord.Category,
        AssignmentStatus: { Value: 'Assigned' }
      }));
  }

  getDefaultFilters() {
    return { ...DEFAULT_ACTIVITY_FILTERS };
  }

  getActivityStatus(activity) {
    return activity?.Status?.Value ?? activity?.Status ?? '';
  }

  getAssignmentStatus(activity) {
    return activity?.AssignmentStatus?.Value ?? activity?.AssignmentStatus ?? '';
  }

  toComparableDate(dateLike) {
    return dateLike ? new Date(dateLike) : null;
  }

  filterActivities(activities = [], filters = DEFAULT_ACTIVITY_FILTERS) {
    const merged = { ...DEFAULT_ACTIVITY_FILTERS, ...filters };
    return activities
      .filter((activity) => {
        const status = this.getActivityStatus(activity);
        const assignedTo = activity?.AssignedTo ?? '';
        const category = activity?.Category ?? '';
        const assignmentStatus = this.getAssignmentStatus(activity);
        const created = this.toComparableDate(activity?.Created);

        if (merged.statusTab === 'Treated' && norm(status) !== 'treated') return false;
        if (merged.statusTab === 'Not Treated' && norm(status) === 'treated') return false;
        if (merged.assignedTo && norm(assignedTo) !== norm(merged.assignedTo)) return false;
        if (merged.category && norm(category) !== norm(merged.category)) return false;
        if (merged.status && norm(status) !== norm(merged.status)) return false;
        if (merged.assignmentStatus && norm(assignmentStatus) !== norm(merged.assignmentStatus)) return false;

        const dateFrom = this.toComparableDate(merged.dateFrom);
        const dateTo = this.toComparableDate(merged.dateTo);
        if (dateFrom && (!created || created < dateFrom)) return false;
        if (dateTo && (!created || created > dateTo)) return false;

        if (merged.search && !startsWithCI(activity?.Title ?? '', merged.search)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.Created) - new Date(a.Created));
  }

  getAttachments(selectedActivity) {
    return Array.isArray(selectedActivity?.Attachments) ? selectedActivity.Attachments : [];
  }

  getAttachmentPreviewModel(attachment) {
    const name = attachment?.Name ?? '';
    const uri = attachment?.AbsoluteUri ?? '';
    const isPdf = /\.pdf$/i.test(name) || /pdf/i.test(attachment?.ContentType ?? '');
    return {
      isPdf,
      uri,
      name,
      fallbackMessage: isPdf ? '' : 'Preview not available for this file type.'
    };
  }

  buildQueuePayload(actionType, selectedActivity) {
    const meta = actionMeta[actionType];
    if (!meta) throw new Error(`Unsupported action type: ${actionType}`);
    const today = this.now();

    return {
      Title: selectedActivity.Title,
      'Activity Tracking ID': selectedActivity.RefIDD,
      StartDate: today,
      AttachmentLink: selectedActivity.AttachmentLink,
      AssignedBy: 'DGS OFFICE',
      RefIDD: String(selectedActivity.ID),
      AssignedTo: 'dgs@NITDA.gov.ng',
      RefIDDN: selectedActivity.ID,
      Status: { Value: 'Completed' },
      Priority: { Value: 'low' },
      'Acknowledgement Due Date': today,
      DueDate: today,
      NVERSE: 'DGOFASTTRACK',
      Category: meta.category
    };
  }

  buildReferenceId(actionType, selectedActivity, patchRecordId) {
    const meta = actionMeta[actionType];
    const datePart = fmtYYYYMMDD(addOneDay(this.now()));
    return `${datePart}-${selectedActivity.ID}-${meta.suffix}-${patchRecordId}`;
  }

  getActionSuccessMessage(actionType, title) {
    const meta = actionMeta[actionType];
    return `${meta.messagePrefix} ${title} Successful`;
  }

  executeLifecycleAction(actionType, selectedActivity) {
    const queuePayload = this.buildQueuePayload(actionType, selectedActivity);
    const varPatchRecord = this.createQueueRecord(queuePayload);
    const Reference_ID = this.buildReferenceId(actionType, selectedActivity, varPatchRecord.ID);
    const queueRecord = { ...varPatchRecord, Reference_ID };
    const dgoUpdate = this.updateActivity(selectedActivity, queueRecord);
    return {
      queueRecord,
      dgoUpdate,
      successMessage: this.getActionSuccessMessage(actionType, queueRecord.Title),
      Reference_ID
    };
  }
}
