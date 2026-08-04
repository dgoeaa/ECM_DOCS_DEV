/**
 * DGO R11.6 Root Runtime — runtime configuration example.
 *
 * HOW TO USE
 * ----------
 * 1. Copy this file to  config/config.local.js
 * 2. Replace the placeholder URLs with your freshly-rotated Power Automate
 *    HTTP-trigger URLs (regenerate the SAS signatures in Power Automate first).
 * 3. config/config.local.js is git-ignored — never commit real URLs.
 * 4. index.html already loads  config/config.local.js  via:
 *      <script src="config/config.local.js" onerror="void 0"></script>
 *    This script tag appears before the ES-module graph, so DGO_CONFIG is
 *    available when config/endpoints.config.js evaluates.
 *
 * ⚠️  SECURITY NOTICE
 * Any Power Automate SAS URL is effectively a credential.  The URLs that were
 * previously hardcoded in config/endpoints.config.js have been removed from
 * that file, but they remain in Git history and MUST be rotated / regenerated
 * in Power Automate before any continued use.
 *
 * ⚠️  DIRECT OPERATION
 * The browser invokes these URLs directly — there is no proxy, broker or other
 * intermediary to deploy or run.  Whatever is served this file can read the URLs
 * in it, so each flow must authenticate and authorise its own callers, validate
 * its own input, and return only what that caller is entitled to see.
 */

window.DGO_CONFIG = {
  /**
   * Power Automate HTTP-trigger endpoint URLs.
   * Each key matches a name in config/endpoints.config.js EndpointUrls.
   * Omit a key to leave that endpoint unconfigured (calls will fail gracefully).
   */
  endpoints: {
    FETCH_ACTIVITIES:        "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    FETCH_ALL:               "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    REFERENCE_DATA:          "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    GET_DOCS:                "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    FETCH_EMAIL_ATTACHMENTS: "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    SINGLE_ASSIGNMENT:       "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    BULK_ASSIGNMENT:         "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    BULK_ASSIGNMENT_DIRECT:  "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    DYNAMIC_ACTIONS:         "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    EMAIL:                   "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    EMAIL_RELATED_TASK:      "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    AI_EMAIL_ANALYSIS:       "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    AI_DOC_ANALYSIS:         "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    AI_CHAT:                 "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    OTP_GENERATE:            "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    OTP_VERIFY:              "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
    SUBSIDIARY_ACTIONS:      "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",

    /**
     * Registry scan deposit. Receives a PUT of the raw document bytes with
     * X-DGO-Filename, X-DGO-Size and X-DGO-Sha256 headers, and answers with
     * { referenceId, attachmentLink, stored, depositedBy, sha256, bytes }.
     * Omit it and Registry Scan Intake says it is unconfigured instead of
     * recording a document that was never filed.
     */
    SCAN_INTAKE:             "https://YOUR_ENV.api.powerplatform.com/powerautomate/.../invoke?sig=ROTATE_ME",
  },
};
