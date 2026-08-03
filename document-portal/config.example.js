/* Document portal — deployment configuration.
 *
 * Copy to config.local.js and set the proxy base URL. config.local.js is git-ignored:
 * nothing here is a credential, but the deployed host is environment-specific.
 *
 * The portal holds NO credential. It talks only to the authenticating proxy, which is the
 * one component that holds one. Leaving proxyBaseUrl empty puts the portal in DEMO MODE —
 * everything stays local and nothing is transmitted, which is the safe failure for a
 * public channel.
 */
window.PF_CONFIG = {
  // e.g. "https://dgo-proxy.nitda.gov.ng"
  proxyBaseUrl: ""
};
