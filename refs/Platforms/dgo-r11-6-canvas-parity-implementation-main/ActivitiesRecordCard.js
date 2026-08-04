export function ActivitiesRecordCard(activity, selectedId) {
  return {
    id: activity.ID,
    title: activity.Title,
    created: activity.Created,
    selected: activity.ID === selectedId
  };
}
