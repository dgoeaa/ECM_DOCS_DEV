import test from 'node:test';
import assert from 'node:assert/strict';
import { getResponsiveLayout, ActivitiesShell } from '../ActivitiesShell.js';

const viewports = [320, 375, 430, 600, 768, 1024, 1280, 1440, 1920];

test('Viewport checks, no toolbar clipping, footer visible, contained scrolling', () => {
  for (const width of viewports) {
    const layout = getResponsiveLayout(width);
    assert.equal(layout.viewport, width);
    assert.equal(layout.toolbarClipped, false);
    assert.equal(layout.footerVisible, true);
    assert.equal(layout.containedScrolling, true);
  }
});

test('Shell carries high contrast and reduced motion support', () => {
  const shell = ActivitiesShell({
    showFilters: false,
    filters: { statusTab: 'All' },
    records: [],
    selectedActivity: null,
    attachments: [],
    selectedAttachment: null,
    preview: null,
    confirmation: { isOpen: false },
    viewportWidth: 1024
  });

  assert.equal(shell.a11y.highContrastSupport, true);
  assert.equal(shell.a11y.reducedMotionSupport, true);
});
