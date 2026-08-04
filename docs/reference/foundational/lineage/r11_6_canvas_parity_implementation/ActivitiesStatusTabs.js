import { ACTIVITY_PARITY_CONFIG } from './config/activity-parity.config.js';

export function ActivitiesStatusTabs(activeTab) {
  return ACTIVITY_PARITY_CONFIG.statusTabs.map((tab) => ({ label: tab, active: tab === activeTab }));
}
