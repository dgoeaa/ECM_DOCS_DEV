import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityParityService } from '../ActivityParityService.js';
import { ActivitiesParityController } from '../ActivitiesParityController.js';
import { ActivitiesAttachmentsPanel } from '../ActivitiesAttachmentsPanel.js';
import { ActivitiesPdfPreview } from '../ActivitiesPdfPreview.js';

const service = new ActivityParityService();

const activityWithAttachments = {
  Attachments: [
    { ID: 1, Name: 'letter.pdf', AbsoluteUri: 'https://example.test/letter.pdf', ContentType: 'application/pdf' },
    { ID: 2, Name: 'image.png', AbsoluteUri: 'https://example.test/image.png', ContentType: 'image/png' }
  ]
};

test('No attachments state', () => {
  const panel = ActivitiesAttachmentsPanel([], null);
  assert.equal(panel.empty, true);
  assert.equal(panel.message, 'No Attachments');
});

test('View attachment, download attachment, and PDF preview', () => {
  const attachments = service.getAttachments(activityWithAttachments);
  const controller = new ActivitiesParityController({ service });

  controller.handleAction('activity-open-attachment-preview', { attachment: attachments[0] });
  assert.equal(controller.state.mode, 'attachment-preview');

  const url = controller.handleAction('activity-download-attachment', { attachment: attachments[0] });
  assert.equal(url, 'https://example.test/letter.pdf');

  const pdfPreview = ActivitiesPdfPreview(service.getAttachmentPreviewModel(attachments[0]));
  assert.equal(pdfPreview.kind, 'pdf');

  const fallbackPreview = ActivitiesPdfPreview(service.getAttachmentPreviewModel(attachments[1]));
  assert.equal(fallbackPreview.kind, 'fallback');
});
