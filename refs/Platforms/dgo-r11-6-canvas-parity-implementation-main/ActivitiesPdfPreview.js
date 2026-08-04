export function ActivitiesPdfPreview(previewModel) {
  if (!previewModel) {
    return { visible: false, kind: 'none' };
  }
  if (previewModel.isPdf) {
    return { visible: true, kind: 'pdf', src: previewModel.uri, title: previewModel.name };
  }
  return { visible: true, kind: 'fallback', message: previewModel.fallbackMessage };
}
