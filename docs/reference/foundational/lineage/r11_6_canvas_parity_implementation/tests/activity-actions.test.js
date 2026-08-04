import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityParityService } from '../ActivityParityService.js';
import { ActivitiesParityController } from '../ActivitiesParityController.js';

const selectedActivity = {
  ID: 77,
  Title: 'Parity Dossier',
  RefIDD: 'DGO-77',
  AttachmentLink: 'https://example.test/doc.pdf',
  Status: { Value: 'Not Treated' },
  AssignmentStatus: { Value: 'Pending' }
};

function makeService(patchId) {
  return new ActivityParityService({
    now: () => new Date('2026-07-26T00:00:00Z'),
    createQueueRecord: (payload) => ({ ...payload, ID: patchId }),
    updateActivity: (_activity, patchRecord) => ({
      Status: { Value: 'Treated' },
      AssignedTo: patchRecord.AssignedTo,
      Category: patchRecord.Category,
      AssignmentStatus: { Value: 'Assigned' }
    })
  });
}

test('Archive confirmation and execution with Reference_ID and DGO update', () => {
  const service = makeService(9001);
  const controller = new ActivitiesParityController({ service });
  controller.state.selectedActivity = selectedActivity;

  controller.handleAction('activity-archive', { triggerId: 'archive-btn' });
  assert.equal(controller.state.confirmation.role, undefined);
  assert.equal(controller.state.pendingAction, 'archive');

  const result = controller.handleAction('activity-archive', { confirm: true, triggerId: 'archive-btn' });
  assert.equal(result.Reference_ID, '20260727-77-UNC-9001');
  assert.equal(result.successMessage, 'Archiving Parity Dossier Successful');
  assert.equal(result.dgoUpdate.Status.Value, 'Treated');
  assert.equal(result.dgoUpdate.AssignmentStatus.Value, 'Assigned');
  assert.equal(controller.state.mode, 'gallery');
  assert.equal(controller.state.selectedActivity, null);
});

test('SIWES and NYSC execution behavior', () => {
  const siwes = makeService(500);
  const nysc = makeService(501);

  const c1 = new ActivitiesParityController({ service: siwes });
  c1.state.selectedActivity = selectedActivity;
  const r1 = c1.handleAction('activity-siwes', { confirm: true, triggerId: 'siwes-btn' });
  assert.equal(r1.Reference_ID, '20260727-77-INT-SIWES-500');
  assert.equal(r1.successMessage, 'SIWES Parity Dossier Successful');
  assert.equal(r1.dgoUpdate.Category, 'Internships (SIWES)');

  const c2 = new ActivitiesParityController({ service: nysc });
  c2.state.selectedActivity = selectedActivity;
  const r2 = c2.handleAction('activity-nysc', { confirm: true, triggerId: 'nysc-btn' });
  assert.equal(r2.Reference_ID, '20260727-77-INT-NYSC-501');
  assert.equal(r2.successMessage, 'Archiving Parity Dossier Successful');
  assert.equal(r2.dgoUpdate.Category, 'Internships (NYSC)');
});
