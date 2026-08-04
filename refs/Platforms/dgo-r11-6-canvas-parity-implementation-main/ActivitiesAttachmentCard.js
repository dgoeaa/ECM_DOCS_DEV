export function ActivitiesAttachmentCard(attachment, selectedAttachmentId) {
  return {
    id: attachment?.ID,
    name: attachment?.Name,
    absoluteUri: attachment?.AbsoluteUri,
    selected: selectedAttachmentId === attachment?.ID
  };
}
