export function ActivitiesDetailsPanel(activity) {
  return {
    visible: Boolean(activity),
    title: activity?.Title ?? '',
    created: activity?.Created ?? null,
    status: activity?.Status?.Value ?? activity?.Status ?? '',
    assignedTo: activity?.AssignedTo ?? ''
  };
}
