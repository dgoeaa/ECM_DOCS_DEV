export const ACTIVITY_PARITY_CONFIG = {
  actions: Object.freeze([
    'activity-open-details',
    'activity-open-attachments',
    'activity-open-attachment-preview',
    'activity-download-attachment',
    'activity-assign',
    'activity-reassign',
    'activity-newassign',
    'activity-open-filters',
    'activity-reset-filters',
    'activity-archive',
    'activity-siwes',
    'activity-nysc',
    'activity-cancel-confirmation'
  ]),
  routes: Object.freeze({
    assign: '/assign',
    reassign: '/reassign',
    newassign: '/newassign'
  }),
  statusTabs: Object.freeze(['All', 'Treated', 'Not Treated']),
  responsiveBreakpoints: Object.freeze([320, 375, 430, 600, 768, 1024, 1280, 1440, 1920]),
  minInteractiveTargetPx: 44,
  toastAriaLive: 'polite'
};

export const DEFAULT_ACTIVITY_FILTERS = Object.freeze({
  statusTab: 'All',
  assignedTo: '',
  category: '',
  status: '',
  assignmentStatus: '',
  dateFrom: null,
  dateTo: null,
  search: ''
});
