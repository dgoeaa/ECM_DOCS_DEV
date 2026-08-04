import { ACTIVITY_PARITY_CONFIG } from './config/activity-parity.config.js';
import { ActivityParityService } from './ActivityParityService.js';

const baseState = {
  mode: 'gallery',
  selectedActivity: null,
  selectedAttachment: null,
  selectedAction: '',
  pendingAction: '',
  busy: false,
  error: null,
  filters: null,
  showFilters: false,
  confirmation: null,
  toast: null,
  focus: {
    active: null,
    returnTo: null
  }
};

export class ActivitiesParityController {
  constructor({ service = new ActivityParityService(), router = { push: (route) => route } } = {}) {
    this.service = service;
    this.router = router;
    this.state = {
      ...baseState,
      filters: this.service.getDefaultFilters()
    };
  }

  resetPostActionState() {
    this.state = {
      ...this.state,
      mode: 'gallery',
      selectedActivity: null,
      selectedAttachment: null,
      selectedAction: '',
      pendingAction: '',
      busy: false,
      error: null,
      showFilters: false,
      confirmation: null,
      focus: {
        active: null,
        returnTo: this.state.focus.returnTo
      }
    };
  }

  openConfirmation(actionType, triggerId) {
    this.state.pendingAction = actionType;
    this.state.confirmation = { isOpen: true, actionLabel: actionType.toUpperCase(), triggerId };
    this.state.focus = { active: 'confirmation-primary-action', returnTo: triggerId ?? null };
  }

  closeConfirmation() {
    const returnTo = this.state.confirmation?.triggerId ?? this.state.focus.returnTo;
    this.state.confirmation = null;
    this.state.pendingAction = '';
    this.state.focus = { active: returnTo ?? null, returnTo: returnTo ?? null };
  }

  onEscape() {
    if (this.state.confirmation?.isOpen && !this.state.busy) {
      this.closeConfirmation();
    }
  }

  handleAction(action, payload = {}) {
    if (!ACTIVITY_PARITY_CONFIG.actions.includes(action)) {
      throw new Error(`Unregistered action: ${action}`);
    }

    switch (action) {
      case 'activity-open-details':
        this.state.selectedActivity = payload.activity;
        this.state.mode = 'details';
        return this.state;
      case 'activity-open-attachments':
        this.state.selectedActivity = payload.activity;
        this.state.mode = 'attachments';
        return this.state;
      case 'activity-open-attachment-preview':
        this.state.selectedAttachment = payload.attachment;
        this.state.mode = 'attachment-preview';
        return this.state;
      case 'activity-download-attachment':
        return payload.attachment?.AbsoluteUri ?? null;
      case 'activity-assign':
        return this.router.push(ACTIVITY_PARITY_CONFIG.routes.assign);
      case 'activity-reassign':
        return this.router.push(ACTIVITY_PARITY_CONFIG.routes.reassign);
      case 'activity-newassign':
        return this.router.push(ACTIVITY_PARITY_CONFIG.routes.newassign);
      case 'activity-open-filters':
        this.state.showFilters = true;
        return this.state;
      case 'activity-reset-filters':
        this.state.filters = this.service.getDefaultFilters();
        return this.state;
      case 'activity-cancel-confirmation':
        this.closeConfirmation();
        return this.state;
      case 'activity-archive':
      case 'activity-siwes':
      case 'activity-nysc': {
        const type = action.replace('activity-', '');
        if (!payload.confirm) {
          this.openConfirmation(type, payload.triggerId);
          return this.state;
        }

        this.state.busy = true;
        try {
          const result = this.service.executeLifecycleAction(type, this.state.selectedActivity);
          this.state.toast = { message: result.successMessage, ariaLive: 'polite' };
          this.resetPostActionState();
          this.state.focus = { active: payload.triggerId ?? null, returnTo: payload.triggerId ?? null };
          return result;
        } catch (error) {
          this.state.error = error.message;
          throw error;
        } finally {
          this.state.busy = false;
        }
      }
      default:
        return this.state;
    }
  }
}
