import { ActivitiesAttachmentCard } from './ActivitiesAttachmentCard.js';

export function ActivitiesAttachmentsPanel(attachments, selectedAttachmentId) {
  if (!attachments.length) {
    return { empty: true, message: 'No Attachments' };
  }
  return {
    empty: false,
    items: attachments.map((attachment) => ActivitiesAttachmentCard(attachment, selectedAttachmentId))
  };
}
