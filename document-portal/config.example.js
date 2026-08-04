/* Document portal — deployment configuration.
 *
 * Copy to config.local.js and fill in the flow endpoint URLs. config.local.js is
 * git-ignored so no URL is ever committed.
 *
 * The portal calls each Power Automate flow DIRECTLY. There is no proxy, worker or
 * broker to deploy, run or keep alive between this static site and the flows.
 *
 * ⚠  A signed Power Automate URL is a bearer credential, and this is a PUBLIC site:
 * every URL below is delivered to every visitor's browser and can be read by anyone
 * who fetches this file. Configure ONLY endpoints whose flows are built to be invoked
 * by an anonymous stranger — each one must validate its own input, rate-limit its own
 * callers, return only what the caller is entitled to see, and be rotated on a
 * schedule. Never point one of these at a flow that does something the public may not
 * do. The request/response contract each flow must satisfy is in README.md.
 *
 * Leave an endpoint out and the feature it serves reports itself unconfigured. Leave
 * SUBMISSION out and the whole portal stays in DEMO MODE — everything stays local and
 * nothing is transmitted, which is the safe failure for a public channel.
 */
window.PF_CONFIG = {
  endpoints: {
    // Register a submission and receive a reference plus one upload ticket per attachment.
    SUBMISSION:     "",
    // Redeem one ticket with the raw bytes of one attachment (PUT).
    UPLOAD:         "",
    // Raise a helpdesk case. Returns a CASE- reference; never enters the registry.
    SUPPORT:        "",
    // Mail a one-time code to a submitter's address.
    VERIFY:         "",
    // Exchange that code for the single-use proof SUBMISSION accepts.
    VERIFY_CONFIRM: "",
    // Read a submission's status back, for a reference + email pair the caller supplies.
    STATUS:         ""
  }
};
