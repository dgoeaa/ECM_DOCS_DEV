import { ACTIVITY_PARITY_CONFIG } from './config/activity-parity.config.js';

export function ActivitiesConfirmationDialog({ isOpen, actionLabel, busy, triggerId }) {
  if (!isOpen) {
    return null;
  }

  return {
    role: 'dialog',
    ariaModal: 'true',
    ariaLabel: `${actionLabel} confirmation`,
    isOpen: true,
    busy: Boolean(busy),
    focusTarget: isOpen ? 'confirmation-primary-action' : null,
    focusReturnTarget: triggerId ?? null,
    keyboard: {
      escapeCloses: true,
      keyboardReachable: true
    },
    interactiveTargetMinPx: ACTIVITY_PARITY_CONFIG.minInteractiveTargetPx,
    highContrastSupport: true,
    reducedMotionSupport: true
  };
}
