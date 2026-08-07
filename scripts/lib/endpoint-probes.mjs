/**
 * The probe table — one definition, two callers.
 *
 * Each probe is the smallest request that exercises a flow's routing without asking it to
 * do anything it would not do in normal use. `expect` lists the top-level response keys the
 * reference corpus documents for that flow; where the corpus documents none, it is left out
 * and the caller reports what came back rather than judging it.
 *
 * WHY IT IS ITS OWN MODULE. Two things now probe these endpoints — `scripts/verify-endpoints.mjs`
 * from a terminal, and the `ENDPOINT-CHECK.html` page each delivered package carries, which
 * runs in the browser on the operator's own machine. Those are the same question asked from
 * two places, and the second is the one that matters: the browser is where the real request
 * path is, and it is the only place that can answer "do these flows work from where I am?"
 * Two copies of a probe table is two chances for the terminal and the browser to disagree
 * about what was tested, which would make the disagreement itself the finding.
 *
 * `__probe` and the `__DGO_PROBE__` markers travel on every request so anything a probe
 * creates can be found and deleted afterwards.
 */

/**
 * @param {object} opts
 * @param {string} opts.probeEmail  the address probes identify themselves with
 * @param {string} opts.runId       a per-run marker, written into anything a write probe creates
 */
export function probeTables({ probeEmail, runId }) {
  const PROBE_EMAIL = probeEmail;
  const RUN_ID = runId;

  const RUNTIME_PROBES = {
    FETCH_ALL: { body: { action: 'fetchAll', userEmail: PROBE_EMAIL }, expect: ['tasks', 'docs', 'emails'] },
    GET_DOCS: { body: { action: 'getDocs', userEmail: PROBE_EMAIL }, expect: ['docs'] },
    REFERENCE_DATA: { body: { action: 'lookups', userEmail: PROBE_EMAIL }, expect: ['users', 'categories', 'departments'] },
    FETCH_ACTIVITIES: { body: { action: 'LIST-ACTIVITIES', userEmail: PROBE_EMAIL } },
    FETCH_EMAIL_ATTACHMENTS: { body: { action: 'fetchEmailAttachments', userEmail: PROBE_EMAIL } },

    SUBSIDIARY_ACTIONS: { body: { action: 'GET_BOOTSTRAP', name: 'GET_BOOTSTRAP', userEmail: PROBE_EMAIL } },
    DYNAMIC_ACTIONS: { body: { action: 'dynamicGlobalAction', operation: 'noop', userEmail: PROBE_EMAIL } },
    SINGLE_ASSIGNMENT: { body: { action: 'singleassignment', operation: 'create', userEmail: PROBE_EMAIL } },
    BULK_ASSIGNMENT: { body: { action: 'bulkassignment', operation: 'create', userEmail: PROBE_EMAIL } },
    BULK_ASSIGNMENT_DIRECT: { body: { action: 'bulkassignment', operation: 'create', userEmail: PROBE_EMAIL } },
    EMAIL: { body: { action: 'dispatchEmail', userEmail: PROBE_EMAIL } },
    EMAIL_RELATED_TASK: { body: { action: 'emailtotaskassignment', userEmail: PROBE_EMAIL } },
    AI_EMAIL_ANALYSIS: { body: { action: 'aiAnalyseEmail', userEmail: PROBE_EMAIL } },
    AI_DOC_ANALYSIS: { body: { action: 'aiAnalyseEventDocs', userEmail: PROBE_EMAIL } },
    AI_CHAT: { body: { action: 'aiChat', userEmail: PROBE_EMAIL, message: '__DGO_PROBE__' }, expect: ['reply'] },
    OTP_GENERATE: { body: { action: 'otpGenerate', userEmail: PROBE_EMAIL } },
    OTP_VERIFY: { body: { action: 'otpVerify', userEmail: PROBE_EMAIL, code: '000000' } },

    /* Two contracts, one URL. DISPATCH_OUTBOUND and ARCHIVE_REFERENCE both post to the
       DYNAMIC_ACTIONS trigger and are distinguished only by `action`, so provisioning that
       one URL commissions three obligations rather than one. Until these were added, the
       verifier exercised the first and reported the surface green — a flow whose switch had
       no `dispatchOutbound` case would have been discovered by the first officer who tried
       to dispatch a decision, in production. `via` names the key whose URL to use. */
    DISPATCH_OUTBOUND: {
      via: 'DYNAMIC_ACTIONS',
      body: { action: 'dispatchOutbound', ref: '__DGO_PROBE__', channel: 'email', recipients: [PROBE_EMAIL], userEmail: PROBE_EMAIL },
    },
    ARCHIVE_REFERENCE: {
      via: 'DYNAMIC_ACTIONS',
      body: { action: 'archiveReference', ref: '__DGO_PROBE__', userEmail: PROBE_EMAIL },
    },

    /* Not a JSON contract: core/scan-intake-service.js PUTs the raw bytes of a scanned
       document with the filename, size and digest in headers, because base64-in-JSON is what
       produced the 4 MB ceiling this replaced. Probing it with a POSTed envelope would prove
       nothing about the path the platform actually uses. */
    SCAN_INTAKE: { transport: 'bytes', filename: '__DGO_PROBE__.txt' },
  };

  const PORTAL_PROBES = {
    STATUS: {
      write: false,
      body: { action: 'TRACK', name: 'TRACK', referenceId: '__DGO_PROBE__', email: PROBE_EMAIL },
      expect: ['record'],
      /* The register must not confirm that a reference exists, so an unknown pair and a wrong
         address answer identically. __DGO_PROBE__ is by construction unknown: 404 is the
         correct answer and the evidence the uniform denial is implemented. */
      expectStatus: [404],
      expectStatusWhy: 'the uniform denial — the flow refuses to say whether the reference exists',
    },
    SUBMISSION: {
      write: true,
      body: {
        action: 'CREATE', UserId: RUN_ID, SubmitterName: '__DGO_PROBE__', EmailAddress: PROBE_EMAIL,
        CompanyName: '__DGO_PROBE__', DocumentType: 'General Correspondence',
        subject: '__DGO_PROBE__', category: 'General Correspondence', description: RUN_ID,
      },
      expect: ['referenceId', 'uploads'],
    },
    SUPPORT: {
      write: true,
      body: { action: 'CREATESUPPORTREQUEST', name: 'CREATESUPPORTREQUEST', email: PROBE_EMAIL, subject: '__DGO_PROBE__', message: RUN_ID },
      expect: ['caseRef'],
    },
    VERIFY: { write: true, body: { action: 'otpGenerate', email: PROBE_EMAIL }, expect: ['sent'] },
    VERIFY_CONFIRM: { write: true, body: { action: 'otpVerify', email: PROBE_EMAIL, code: '000000' }, expect: ['verification'] },

    /* The ticket-redeeming attachment PUT. It is half of the portal's minimal-pilot set and
       was the one member of that set the verifier could not exercise, so "both pilot
       endpoints are wired" and "both pilot endpoints answer" were different claims and only
       the first was ever checked. A deposit without a ticket should be REFUSED — that
       refusal is the evidence that the flow validates its own callers, which on a public
       channel is the whole control. */
    UPLOAD: {
      write: true, transport: 'bytes', filename: '__DGO_PROBE__.txt',
      /* Deposited with no ticket. A refusal is the pass: a flow that accepts bytes without a
         redeemable ticket is one anyone can write into. */
      expectStatus: [401, 403],
      expectStatusWhy: 'refused a deposit carrying no upload ticket — the ticket check is live',
    },
  };
  return { RUNTIME_PROBES, PORTAL_PROBES };
}
