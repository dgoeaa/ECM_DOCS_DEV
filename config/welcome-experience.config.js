export const WelcomeExperienceConfig = Object.freeze({
  schema: 'dgo-welcome-experience/v1',
  enabled: true,
  storageKey: 'DGO_R11_6_WELCOME_SEEN',
  skipQueryParams: Object.freeze(['skipWelcome','embed']),
  forceQueryParams: Object.freeze(['showWelcome','welcome']),
  version: 'welcome-experience/attached-state',
  // Branding block consumed by the welcome/login/OTP experience.
  branding: Object.freeze({
    agency: 'National Information Technology Development Agency',
    ministry: 'Federal Ministry of Communications, Innovation & Digital Economy',
    subtitle: 'Digital Operations',
    tagline: 'One governed lifecycle for every correspondence, assignment and dispatch.'
  }),
  // Login/OTP defaults.
  defaults: Object.freeze({
    channel: 'email',
    identifier: '',
    userName: 'Registry',
    userRole: 'Administrator'
  }),
  resendSeconds: 30,
  invalidDemoOtp: '000000',
  bootMs: 1450,
  bootDurationMs: 1450,
  reducedMotionBootMs: 240,
  tipsIntervalMs: 2600,
  // Boot animation steps (bootSteps is read by the welcome experience; `steps` kept for compatibility).
  bootSteps: Object.freeze([
    'Establishing governed browser session',
    'Loading endpoint contracts and local state',
    'Preparing registry, assignment and tracking workspaces',
    'Checking offline queue, cache and diagnostics surface',
    'Opening Command Center'
  ]),
  steps: Object.freeze([
    'Establishing governed browser session',
    'Loading endpoint contracts and local state',
    'Preparing registry, assignment and tracking workspaces',
    'Checking offline queue, cache and diagnostics surface',
    'Opening Command Center'
  ]),
  tips: Object.freeze([
    'Use Ctrl K to search references, tasks, people and workspaces.',
    'Four ingestion sources resolve into one governed lifecycle.',
    'Assignment Desk owns single assignment, bulk assignment and email-to-task handoff.',
    'Tracking shows SLA pressure, ageing, response evidence and exports.',
    'Settings can replay this welcome experience at any time.'
  ]),
  spotlight: Object.freeze([
    { title: 'Command Center First', body: 'Start from the operational landing surface and move into the correct governed workspace.' },
    { title: 'Four Sources Unified', body: 'Physical scans, customer-service emails, public portal matters and DGCEO outgoing correspondence share one lifecycle.' },
    { title: 'Governed By Design', body: 'Mutating actions use ownership, preview, confirmation, audit and endpoint contracts.' },
    { title: 'Built On The Platform Shell', body: 'This welcome layer runs on the same shell, router, state, RBAC and module boundaries as the rest of the platform.' }
  ])
});
