import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityParityService } from '../ActivityParityService.js';
import { ActivitiesParityController } from '../ActivitiesParityController.js';

const activities = [
  { ID: 1, Title: 'Alpha Brief', Created: '2026-07-20T12:00:00Z', Status: { Value: 'Not Treated' }, AssignmentStatus: { Value: 'Pending' }, AssignedTo: 'ops@nitda.gov.ng', Category: 'General', RefIDD: 'REF-1', AttachmentLink: 'x' },
  { ID: 2, Title: 'Bravo Memo', Created: '2026-07-22T12:00:00Z', Status: { Value: 'Treated' }, AssignmentStatus: { Value: 'Assigned' }, AssignedTo: 'dgs@NITDA.gov.ng', Category: 'Archived', RefIDD: 'REF-2', AttachmentLink: 'y' },
  { ID: 3, Title: 'Alpine Note', Created: '2026-07-21T12:00:00Z', Status: { Value: 'Not Treated' }, AssignmentStatus: { Value: 'Open' }, AssignedTo: 'hr@nitda.gov.ng', Category: 'Internships (SIWES)', RefIDD: 'REF-3', AttachmentLink: 'z' }
];

test('Gallery initial mode and created descending sort', () => {
  const service = new ActivityParityService();
  const controller = new ActivitiesParityController({ service });
  assert.equal(controller.state.mode, 'gallery');

  const sorted = service.filterActivities(activities, service.getDefaultFilters());
  assert.deepEqual(sorted.map((a) => a.ID), [2, 3, 1]);
});

test('Open details and open attachments transitions', () => {
  const controller = new ActivitiesParityController();
  controller.handleAction('activity-open-details', { activity: activities[0] });
  assert.equal(controller.state.mode, 'details');
  controller.handleAction('activity-open-attachments', { activity: activities[0] });
  assert.equal(controller.state.mode, 'attachments');
});

test('Assign/ReAssign/NewAssign routing', () => {
  const routes = [];
  const controller = new ActivitiesParityController({ router: { push: (route) => routes.push(route) } });
  controller.handleAction('activity-assign');
  controller.handleAction('activity-reassign');
  controller.handleAction('activity-newassign');
  assert.deepEqual(routes, ['/assign', '/reassign', '/newassign']);
});
