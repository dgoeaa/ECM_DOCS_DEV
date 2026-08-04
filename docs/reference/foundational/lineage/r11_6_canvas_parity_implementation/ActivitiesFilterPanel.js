export function ActivitiesFilterPanel(filters, isOpen) {
  return {
    isOpen: Boolean(isOpen),
    filters: { ...filters }
  };
}
