import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityParityService } from '../ActivityParityService.js';

const service = new ActivityParityService();
const activities = [
  { ID: 1, Title: 'Alpha Brief', Created: '2026-07-20T12:00:00Z', Status: { Value: 'Not Treated' }, AssignmentStatus: { Value: 'Pending' }, AssignedTo: 'ops@nitda.gov.ng', Category: 'General' },
  { ID: 2, Title: 'Bravo Memo', Created: '2026-07-22T12:00:00Z', Status: { Value: 'Treated' }, AssignmentStatus: { Value: 'Assigned' }, AssignedTo: 'dgs@NITDA.gov.ng', Category: 'Archived' },
  { ID: 3, Title: 'Alpine Note', Created: '2026-07-21T12:00:00Z', Status: { Value: 'Not Treated' }, AssignmentStatus: { Value: 'Open' }, AssignedTo: 'hr@nitda.gov.ng', Category: 'Internships (SIWES)' }
];

test('All/Treated/Not Treated filters', () => {
  assert.equal(service.filterActivities(activities, { statusTab: 'All' }).length, 3);
  assert.deepEqual(service.filterActivities(activities, { statusTab: 'Treated' }).map((x) => x.ID), [2]);
  assert.deepEqual(service.filterActivities(activities, { statusTab: 'Not Treated' }).map((x) => x.ID), [3, 1]);
});

test('AssignedTo, Category, Status, AssignmentStatus filters', () => {
  assert.deepEqual(service.filterActivities(activities, { assignedTo: 'dgs@NITDA.gov.ng' }).map((x) => x.ID), [2]);
  assert.deepEqual(service.filterActivities(activities, { category: 'Internships (SIWES)' }).map((x) => x.ID), [3]);
  assert.deepEqual(service.filterActivities(activities, { status: 'Treated' }).map((x) => x.ID), [2]);
  assert.deepEqual(service.filterActivities(activities, { assignmentStatus: 'Pending' }).map((x) => x.ID), [1]);
});

test('DateFrom/DateTo and starts-with search', () => {
  assert.deepEqual(service.filterActivities(activities, { dateFrom: '2026-07-21T00:00:00Z' }).map((x) => x.ID), [2, 3]);
  assert.deepEqual(service.filterActivities(activities, { dateTo: '2026-07-21T12:00:00Z' }).map((x) => x.ID), [3, 1]);
  assert.deepEqual(service.filterActivities(activities, { search: 'al' }).map((x) => x.ID), [3, 1]);
  assert.deepEqual(service.filterActivities(activities, { search: 'ph' }).map((x) => x.ID), []);
});

test('Reset filters returns default set', () => {
  assert.deepEqual(service.getDefaultFilters(), {
    statusTab: 'All',
    assignedTo: '',
    category: '',
    status: '',
    assignmentStatus: '',
    dateFrom: null,
    dateTo: null,
    search: ''
  });
});
