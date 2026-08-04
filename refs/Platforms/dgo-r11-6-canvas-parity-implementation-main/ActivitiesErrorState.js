export function ActivitiesErrorState(error) {
  return { visible: true, message: error || 'Unable to load activities.' };
}
