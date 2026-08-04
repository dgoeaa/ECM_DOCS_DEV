import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivitiesConfirmationDialog } from '../ActivitiesConfirmationDialog.js';
import { ActivitiesParityController } from '../ActivitiesParityController.js';

test('Dialog semantics and focus entry', () => {
  const dialog = ActivitiesConfirmationDialog({ isOpen: true, actionLabel: 'Archive', triggerId: 'archive-btn' });
  assert.equal(dialog.role, 'dialog');
  assert.equal(dialog.ariaModal, 'true');
  assert.equal(dialog.focusTarget, 'confirmation-primary-action');
  assert.equal(dialog.keyboard.escapeCloses, true);
  assert.equal(dialog.interactiveTargetMinPx >= 44, true);
});

test('Closed dialog is not rendered', () => {
  const dialog = ActivitiesConfirmationDialog({ isOpen: false, actionLabel: 'Archive', triggerId: 'archive-btn' });
  assert.equal(dialog, null);
});

test('Dialog focus return and Escape close', () => {
  const controller = new ActivitiesParityController();
  controller.state.selectedActivity = { ID: 10, Title: 'Sample', RefIDD: 'R10', AttachmentLink: '' };

  controller.handleAction('activity-archive', { triggerId: 'archive-btn' });
  assert.equal(controller.state.focus.active, 'confirmation-primary-action');

  controller.onEscape();
  assert.equal(controller.state.confirmation, null);
  assert.equal(controller.state.focus.active, 'archive-btn');
});
