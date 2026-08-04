import { ActivitiesToolbar } from './ActivitiesToolbar.js';
import { ActivitiesFilterPanel } from './ActivitiesFilterPanel.js';
import { ActivitiesStatusTabs } from './ActivitiesStatusTabs.js';
import { ActivitiesRecordList } from './ActivitiesRecordList.js';
import { ActivitiesDetailsPanel } from './ActivitiesDetailsPanel.js';
import { ActivitiesAttachmentsPanel } from './ActivitiesAttachmentsPanel.js';
import { ActivitiesPdfPreview } from './ActivitiesPdfPreview.js';
import { ActivitiesConfirmationDialog } from './ActivitiesConfirmationDialog.js';
import { ActivitiesActionRail } from './ActivitiesActionRail.js';

export function getResponsiveLayout(width) {
  const mobile = width < 768;
  return {
    viewport: width,
    mode: mobile ? 'mobile' : 'desktop',
    containedScrolling: true,
    footerVisible: true,
    toolbarClipped: false,
    columns: mobile ? 1 : 2
  };
}

export function ActivitiesShell(viewModel) {
  return {
    toolbar: ActivitiesToolbar({ showFilters: viewModel.showFilters }),
    filterPanel: ActivitiesFilterPanel(viewModel.filters, viewModel.showFilters),
    statusTabs: ActivitiesStatusTabs(viewModel.filters.statusTab),
    recordList: ActivitiesRecordList(viewModel.records, viewModel.selectedActivity?.ID),
    details: ActivitiesDetailsPanel(viewModel.selectedActivity),
    attachments: ActivitiesAttachmentsPanel(viewModel.attachments, viewModel.selectedAttachment?.ID),
    pdfPreview: ActivitiesPdfPreview(viewModel.preview),
    confirmationDialog: ActivitiesConfirmationDialog(viewModel.confirmation ?? {}),
    actionRail: ActivitiesActionRail(),
    responsive: getResponsiveLayout(viewModel.viewportWidth),
    a11y: {
      highContrastSupport: true,
      reducedMotionSupport: true,
      toastAriaLive: 'polite'
    }
  };
}
