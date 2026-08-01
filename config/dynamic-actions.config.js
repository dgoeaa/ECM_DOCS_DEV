// Contract registry for endpoint-less actions routed through DYNAMIC_ACTIONS.
// Ported from the R11.5 platform's dynamic-actions.config.js (operation/mode/required/optional/confirm).
import { ActivityParityConfig } from './activity-parity.config.js';

// Canvas Activities parity lifecycle operations. These declare the *operation discriminators*
// the client sends on the already registered DYNAMIC_ACTIONS contract — no new endpoint and no
// URL change. Production execution requires the DYNAMIC_ACTIONS backend flow to recognise each
// discriminator below; when it does not, the write fails explicitly (never simulated locally).
const ACTIVITY_LIFECYCLE_LABELS = Object.freeze({ archive: 'Archiving', siwes: 'SIWES routing', nysc: 'NYSC routing' });
const ACTIVITY_LIFECYCLE_STEPS = Object.freeze([
  Object.freeze({
    step: 'create-queue-record', mode: 'single', required: ['operation', 'ref', 'activityId', 'queueRecord'],
    confirm: true, successMessage: 'FastTrack queue record created',
    notes: 'Step 1 of the Canvas write sequence: Patch() a DGOFASTTRACK queue record and return its generated record ID. Operator confirmation gates the whole sequence before this step runs.'
  }),
  Object.freeze({
    step: 'set-reference-id', mode: 'single', required: ['operation', 'ref', 'activityId', 'queueRecordId', 'Reference_ID'],
    confirm: false, successMessage: 'Reference_ID persisted on the queue record',
    notes: 'Step 2 of the Canvas write sequence: persist the minted Reference_ID onto the queue record. Continuation of the confirmed sequence — never invoked standalone.'
  }),
  Object.freeze({
    step: 'update-activity', mode: 'single', required: ['operation', 'ref', 'activityId', 'patch'],
    confirm: false, successMessage: 'Activity updated to Treated / Assigned',
    notes: 'Step 3 of the Canvas write sequence: patch the source activity to Treated / Assigned with the queue AssignedTo and Category. Continuation of the confirmed sequence — never invoked standalone.'
  })
]);

export const ActivityLifecycleActions = Object.freeze(Object.keys(ActivityParityConfig.lifecycle).map(type => `activity-${type}`));
export const activityLifecycleOperations = action => ACTIVITY_LIFECYCLE_STEPS.map(s => `${action}:${s.step}`);
export const ActivityLifecycleOperations = Object.freeze(ActivityLifecycleActions.flatMap(activityLifecycleOperations));

const activityLifecycleContracts = Object.fromEntries(ActivityLifecycleActions.flatMap(action => {
  const type = action.replace('activity-', '');
  const label = ACTIVITY_LIFECYCLE_LABELS[type] || type;
  const sequence = Object.freeze({
    operation: action, mode: 'sequence', required: ['operation', 'ref', 'activityId'], confirm: true,
    successMessage: `${label} <activity title> Successful`,
    steps: Object.freeze(activityLifecycleOperations(action)),
    notes: 'Canvas Activities parity lifecycle routing (not archive execution). Executed as three ordered governed writes through WriteManager.backend() on the registered DYNAMIC_ACTIONS contract; a step the backend does not recognise must fail explicitly.'
  });
  return [[action, sequence], ...ACTIVITY_LIFECYCLE_STEPS.map(s => [`${action}:${s.step}`, Object.freeze({
    operation: `${action}:${s.step}`, mode: s.mode, required: s.required, confirm: s.confirm,
    successMessage: s.successMessage, sequence: action, notes: s.notes
  })])];
}));

export const DynamicActions = Object.freeze({
  transition:         { operation:'transition', mode:'single', required:['ref','status'], confirm:false, successMessage:'Status updated' },
  addComment:         { operation:'create', mode:'single', required:['referenceId','body'], confirm:false, successMessage:'Comment added' },
  acknowledge:        { operation:'acknowledge', mode:'single', required:['ref'], confirm:true, successMessage:'Acknowledged' },
  route:              { operation:'route', mode:'single', required:['ref'], confirm:true, successMessage:'Routed' },
  dispatchEmail:      { operation:'send', mode:'single', required:['email'], confirm:true, successMessage:'Email sent' },
  prepareMeetingPack: { operation:'generate', mode:'batch', required:['refs'], confirm:true, successMessage:'Pack generated' },
  issueTripClearance: { operation:'issue', mode:'single', required:['ref','traveller','destination'], confirm:true, successMessage:'Clearance issued' },
  setReminder:        { operation:'create', mode:'single', required:['dueAt'], confirm:true, successMessage:'Reminder set' },
  dispatch:           { operation:'dispatch', mode:'single', required:['ref','recipientAddress'], confirm:true, successMessage:'Dispatched' },
  ...activityLifecycleContracts
});
export const dynamicActionContract = (action) => DynamicActions[action] || null;
