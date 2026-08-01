import { BrowserCertification } from './browser-certification.config.js';

export const AppConfig = Object.freeze({
  id: 'dgo-r11-3-bespoke-runtime',
  version: '11.6.0-enterprise-domains',
  storageKey: 'dgo.r11.viewport.runtime.state',
  stateSchemaVersion: 4,
  defaultRoute: 'home',
  maxBulkAssign: 50,
  apiTimeoutMs: 45000,
  themes: ['light','dark','hc'],
  densities: ['comfortable','compact'],
  // Single source of truth: the certified matrix lives with the browser-certification
  // contract that the validation harness and Diagnostics both iterate.
  certifiedViewports: BrowserCertification.viewports
});
