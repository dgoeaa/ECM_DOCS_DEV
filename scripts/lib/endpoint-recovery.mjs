/**
 * Endpoint recovery from the repository's own reference corpus.
 *
 * The deployed Power Automate estate is documented verbatim under
 * `docs/reference/foundational/` by explicit decision (D5), signed trigger URLs included.
 * This module reads those URLs back out and resolves them onto the platform's endpoint
 * contract keys, so the delivered package is runnable against the flows that already exist
 * rather than requiring a fresh estate to be built before anything can be tested.
 *
 * ── WHY THIS FILE WAS REWRITTEN ────────────────────────────────────────────────────────
 *
 * The first cut inferred the mapping. It scanned one lineage artefact for `KEY: "https://…"`
 * pairs and trusted whatever it found, and it took a URL to be "whatever characters follow
 * `sig=` until something that is not base64url". Both are wrong, and both shipped:
 *
 *   1. A trigger signature is HMAC-SHA256 base64url — EXACTLY 43 characters, sometimes with
 *      one `=` of padding. The corpus contains URLs with prose glued straight onto the end
 *      (`…sig=XXXgetEmailsPOST`) and one artefact carrying a 40-character mangled copy.
 *      Greedy matching shipped those verbatim, so a package went out with a signature that
 *      could never authenticate. Extraction now takes exactly 43 characters and rebuilds the
 *      URL from its parts, so glued prose, entity residue and reordered query strings cannot
 *      survive into a package.
 *
 *   2. The lineage artefact is not authoritative. It is one build's snapshot, and where it
 *      disagrees with the operator's own labelled flow lists it is the one that is wrong —
 *      it named `REFERENCE_DATA` and `AI_DOC_ANALYSIS` against workflow ids that appear
 *      nowhere else in the corpus, and it is the source of the mangled signature above.
 *      The mapping is now an explicit table, and every entry cites the document that
 *      establishes it, so it can be checked by eye against the source.
 *
 * ── EVIDENCE ORDER ─────────────────────────────────────────────────────────────────────
 *
 * Where documents disagree about which flow a workflow id is, they are weighed in this
 * order, and the entry records which tier settled it:
 *
 *   1. A documented trigger schema or response body tied to the id. A flow whose schema is
 *      titled "Hybrid Assign Request (Single or Bulk)" is the assign flow whatever a prose
 *      label elsewhere calls it.
 *   2. The operator's own labelled URL lists — `Consolidated flow URLS.txt` and the numbered
 *      flow list in `Power Automate HTTP Flow URL's Request Schemas…txt`.
 *   3. A contract-key name sitting next to the URL in an application artefact.
 *   4. Corroboration: how many separate documents carry the same pairing.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────────────────
 *
 * These signatures are published — anyone who can read this repository holds them. They are
 * disclosed credentials, wired deliberately so the platform can be exercised live before a
 * production estate is minted, and every package stamps that fact.
 *
 * NO SIGNATURE IS HARDCODED HERE. The tables below map a contract key to a WORKFLOW ID — an
 * identifier, not a credential — and the URL carrying it is looked up from the corpus at
 * runtime. That keeps `scripts/` free of signatures, so the secret ratchet stays meaningful
 * and this file can be read without handling credentials.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS = 'docs/reference/';

/**
 * A manual-trigger URL, matched by its parts rather than swallowed whole.
 *
 * The signature is taken as exactly 43 base64url characters and nothing is asserted about
 * what follows, because in this corpus what follows is frequently prose. Optional trailing
 * `=` padding is matched so it is consumed rather than left dangling, and dropped: the
 * unpadded form is what every corroborated copy uses.
 */
const URL_RE = new RegExp(
  'https://([a-z0-9][a-z0-9.-]*\\.(?:powerplatform\\.com|logic\\.azure\\.com|azure-apihub\\.net)'
  + '(?::\\d{1,5})?)'
  + '/powerautomate/automations/direct/workflows/([a-f0-9]{32})'
  + '/triggers/([A-Za-z0-9_]+)/paths/invoke'
  + '\\?([A-Za-z0-9=%&._~-]*?)'
  + 'sig=([A-Za-z0-9_-]{43})=?',
  'gi'
);

const WORKFLOW_ID = /workflows\/([a-f0-9]{32})/;

/** How many characters a complete Power Automate trigger signature has. */
export const CANONICAL_SIGNATURE_LENGTH = 43;

/* ------------------------------------------------------------------ *
 * The flow catalogue
 *
 * Every workflow the corpus carries a complete trigger URL for, named from the documents
 * that name it. This is the artefact an operator reads during live testing to point any
 * contract key at any other flow, so it lists flows the platform does not currently call
 * as well as the ones it does.
 * ------------------------------------------------------------------ */

/** Shorthand for the documents cited below, so the evidence strings stay readable. */
const DOC = {
  spec: 'flows/details/HTTP_Endpoints_Power_Automate_Flows.txt',
  consolidated: 'flows/details/Consolidated flow URLS.txt',
  schemas: "flows/details/Power Automate HTTP Flow URL's Request Schemas and response body structures.txt",
  allFlows: 'flows/details/ALL_FLOWS_ENDPOINT-URL_GETDOCS_GETTASKS_GETEMAILS_GETREFERENCES-&-LOOKUPS.txt',
  controlDeck: 'flows/details/FlowDetails.txt',
  webPrimary: 'flows/details/WEB PRIMARY HTTP POWER AUTOMATE FLOWS STRUCTURE AND PARAMETERS.txt',
  submission: 'flows/DOCUMENT SUBMISSION PORTAL POWER AU.txt',
  sprint: 'lineage/r11_6_canvas_parity_implementation/Download Performance Hardening Sprint Report.json',
  regen: 'apps/REGEN_DGO_LIVE_V2_8_ENHANCED_FINAL.html',
  runRecords: 'flows/runs/ (Web - OTP Generate / Web - OTP Verify run records)',
};

/**
 * workflow id -> what the flow is.
 *
 * `named` is the operator's own words wherever they exist. `evidence` cites the documents,
 * most authoritative first. `tier` is the evidence order above — recorded because four of
 * these ids are labelled differently in different documents, and a reader deserves to know
 * which reading was taken and why rather than discovering it from behaviour.
 */
export const FLOW_CATALOGUE = Object.freeze({
  /* ---- Flows the specification document defines with a schema (tier 1) ---- */
  ff455c68e9ac493e858fb984bcfd01fb: {
    named: 'GET REFERENCES / LOOKUPS (users, categories, departments)', tier: 1,
    evidence: [`${DOC.spec} §1 and §6, both with schema and response`,
      `${DOC.consolidated} "references"`,
      `${DOC.allFlows} "Fetch_References_and_Lookups_Data"`],
  },
  '3931e2ff995242b6b2c920c8b2209797': {
    named: 'GET EMAILS', tier: 1,
    evidence: [`${DOC.spec} §2, schema and response`,
      `${DOC.consolidated} "get emails"`,
      `${DOC.schemas} FLOW_GET_EMAILS_URL`],
  },
  '7995c1eb50d94d5daa2780e71391d874': {
    named: 'BULK OPS GET DOCS', tier: 1,
    evidence: [`${DOC.spec} §3, schema and field mapping`],
  },
  '37642ba3597f4cf58288cc71b5e6b519': {
    named: 'GET TASKS', tier: 1,
    evidence: [`${DOC.spec} §4, schema and response`,
      `${DOC.allFlows} "fetch tasks"`, `${DOC.controlDeck} "Get Tasks"`],
  },
  '818ec4053f1e4f0b87845114241d8b74': {
    named: 'GET DOCS', tier: 1,
    evidence: [`${DOC.spec} §5, schema and response`,
      `${DOC.consolidated} "get docs"`, `${DOC.controlDeck} "Get Docs"`],
  },
  '85c556f10b8244ba9d839a2ebe240b91': {
    named: 'SUPPLEMENTARY / SUBSIDIARY ACTIONS (multi-route)', tier: 1,
    evidence: [`${DOC.spec} §7, normalised and extended schemas`,
      `${DOC.consolidated} "multiple actions"`, `${DOC.controlDeck} "Subsidiary Actions"`],
  },
  '7e71fffe770a45ccb93bf216bb53786e': {
    named: 'BULK ASSIGN (hybrid single or bulk)', tier: 1,
    evidence: [`${DOC.spec} §8, schema titled "Hybrid Assign Request (Single or Bulk)"`,
      `${DOC.allFlows} "bulk Assign direct"`],
    contested: `${DOC.schemas} lists it as "3. Flow: Email-to-Task AI summary" and `
      + `${DOC.controlDeck} as "Email to Task (Summary)". The schema wins: a flow whose `
      + 'trigger takes an assignment payload is the assign flow.',
  },
  f71397ff3ca145059dc8f78c04923e9f: {
    named: 'SINGLE ASSIGN / create task and update activity', tier: 1,
    evidence: [`${DOC.spec} §9`, `${DOC.consolidated} "create task and update activity"`,
      `${DOC.schemas} "6. FLow: Create task"`, `${DOC.controlDeck} "Create Task"`],
  },
  bc83d98acf474a088832d78f50085388: {
    named: 'DYNAMIC GLOBAL ENDPOINT INTERFACE', tier: 1,
    evidence: [`${DOC.spec} §10`, `${DOC.sprint} names it DYNAMIC_ACTIONS and EMAIL`,
      `${DOC.regen} names it DYNAMIC_GLOBAL`],
  },
  a942d230337c4ddfa9a386e92bbd048b: {
    named: 'CREATE TASK FOR EMAIL', tier: 1,
    evidence: [`${DOC.spec} §12`, `${DOC.regen} names it CREATE_TASK_FOR_EMAIL`,
      `${DOC.sprint} names it EMAIL_RELATED_TASK`],
    warning: `${DOC.sprint} carries a 40-character copy of this signature. It is mangled, `
      + 'not merely truncated — characters differ mid-string. The 43-character copy in '
      + `${DOC.spec} is the one two documents agree on.`,
  },
  a13c8b577bd44f8787c50d095ea3faf9: {
    named: 'AI chat', tier: 1,
    evidence: [`${DOC.webPrimary} response body is { "reply": @{outputs('Compose_AI_Response')} }`,
      `${DOC.sprint} names it AI_CHAT`],
  },
  '5b29edc84b5d4a8db3c885d8441aa977': {
    named: 'Events processing — AI over event documents', tier: 1,
    evidence: [`${DOC.controlDeck} "Events Processing", tags Events/AI, trigger { DocId, TaskId }, `
      + 'response { event_name, ai_summary, accept_url }'],
  },
  '3cea46a4f06748cb8a680ee1532d73cb': {
    named: 'Status update (single and bulk)', tier: 1,
    evidence: [`${DOC.schemas} "Status Update flow URL & schema (single & bulk)"`],
  },
  '314aaf27593147089b38322e5ca25936': {
    named: 'OTP generate / send', tier: 1,
    evidence: [`${DOC.runRecords} — the flow run record is titled "Web - OTP Generate"`,
      `${DOC.sprint} names it OTP_GENERATE`],
  },
  '43879c5165de439680055ab4258b3f27': {
    named: 'OTP verify', tier: 1,
    evidence: [`${DOC.runRecords} — the flow run record is titled "Web - OTP Verify"`,
      `${DOC.sprint} names it OTP_VERIFY`],
  },
  '1ff7714c11a74fa4a876f8f6a79b64d2': {
    named: 'DOCUMENT SUBMISSION PORTAL', tier: 1,
    evidence: [`${DOC.submission} — Endpoint_URL, with the full trigger and response contract`],
  },

  /* ---- Flows the operator's own lists name (tier 2) ---- */
  '31e02518075940d2bcfa9bdb0e9b0b8d': {
    named: 'get all data', tier: 2,
    evidence: [`${DOC.consolidated} "geta all data"`],
  },
  '1d56be97cd184fd9b2facede12b17c34': {
    named: 'all data and references', tier: 2,
    evidence: [`${DOC.consolidated} "all data and references"`],
  },
  '5729f50aa0fc4248be30ed4e9d7a7a4f': {
    named: 'get correspondence (flat response)', tier: 2,
    evidence: [`${DOC.consolidated} "get correspondence (flat response)"`,
      `${DOC.controlDeck} "Get Correspondence"`],
  },
  fe794e0139784ac694768e5a716e0be7: {
    named: 'AI over email and task context', tier: 2,
    evidence: [`${DOC.schemas} "5. Flow: AI chat over email + task context"`,
      `${DOC.sprint} names it AI_EMAIL_ANALYSIS`, `${DOC.controlDeck} "AI Assist Chat"`],
    contested: `${DOC.consolidated} labels it "email to task". All three readings are AI over `
      + 'an inbound email; the dedicated chat flow is a13c8b57, which has a response body '
      + 'proving it, so this one carries the analysis contract.',
  },
  '20e6340941ce4b1bbb87b43c9102a777': {
    named: 'Get email attachments', tier: 2,
    evidence: [`${DOC.schemas} "2. Flow: Get email attachments"`,
      `${DOC.controlDeck} "Get Attachments"`, `${DOC.sprint} names it FETCH_EMAIL_ATTACHMENTS`],
  },
  '2e37b6310842410eb15c4561f2b0c1eb': {
    named: 'Send email notification', tier: 2,
    evidence: [`${DOC.schemas} "4. Flow: Send email notification"`,
      `${DOC.controlDeck} "Send Notification"`],
  },
  '1154b50e1d17420dadb3b012e7e2a02c': {
    named: 'optimized bulk assign', tier: 2,
    evidence: [`${DOC.allFlows} "optimized bulk assign"`, `${DOC.sprint} names it BULK_ASSIGNMENT`,
      `${DOC.regen} names it BULK_OPS_ASSIGN`],
  },
  '6b3bad3005b44bf6bced0f8074d3f2ed': {
    named: 'Deployed Create task', tier: 2,
    evidence: [`${DOC.allFlows} "Deployed Create task"`, `${DOC.regen} names it SINGLE_ASSIGN`,
      `${DOC.sprint} names it SINGLE_ASSIGNMENT`],
    contested: 'A second create-task flow. The specification document names f71397ff as '
      + 'SINGLE ASSIGN and the operator\'s consolidated list agrees, so this is the '
      + 'alternate rather than the wired one.',
  },
  '607795813ee14d8abee6d1b4e8dd866b': {
    named: 'Get Users', tier: 2, evidence: [`${DOC.controlDeck} "Get Users" (HR)`],
  },
  '9df45c5086ea42f2ab2b6ee9afae3f29': {
    named: 'Get Categories', tier: 2, evidence: [`${DOC.controlDeck} "Get Categories" (Metadata)`],
  },
  '3c7094de10ce473e985e5cadcf66bc67': {
    named: 'Get Departments', tier: 2, evidence: [`${DOC.controlDeck} "Get Departments" (Metadata)`],
  },
  f480ade951a1437c91604bee33279b0e: {
    named: 'Get Letters', tier: 2, evidence: [`${DOC.controlDeck} "Get Letters" (Documents)`],
  },
  '4f733288d90e49a68d4d5715d9198d40': {
    named: 'DGO Attention Items', tier: 2, evidence: [`${DOC.controlDeck} "DGO Attention Items" (Executive)`],
  },
  '820c4a576cbb4a948d6a99dd85721e71': {
    named: 'Get Emails (Control Deck variant)', tier: 2,
    evidence: [`${DOC.controlDeck} "Get Emails" (Communication)`],
    contested: 'A second get-emails flow. Three documents name 3931e2ff for that function, '
      + 'so this is the alternate.',
  },

  /* ---- Flows only an application artefact names (tier 3) ---- */
  '4a250f97181b4a28abc1d0fb0f7d4c4d': {
    named: 'FETCH_ALL (lineage snapshot)', tier: 3, evidence: [`${DOC.sprint} names it FETCH_ALL`],
    contested: 'Appears in one document only, which is also the document carrying the '
      + 'mangled a942d230 signature. Recorded as an alternate for FETCH_ALL.',
  },
  d67f2acb3708449490eed561ee56efbe: {
    named: 'REFERENCE_DATA (lineage snapshot)', tier: 3,
    evidence: [`${DOC.sprint} names it REFERENCE_DATA`],
    contested: 'Appears in one document only. Twenty-two occurrences across three documents '
      + 'name ff455c68 for references and lookups, and that is what is wired.',
  },
  '20e3b003a57f47febae8a24ad5b9acd4': {
    named: 'AI_DOC_ANALYSIS (lineage snapshot)', tier: 3,
    evidence: [`${DOC.sprint} names it AI_DOC_ANALYSIS`,
      `${DOC.spec} flow list line 1 names this id LOOKUPS, while the LOOKUPS block itself `
      + 'carries the ff455c68 URL'],
    contested: 'Two documents disagree about what this id is and neither carries a schema '
      + 'for it. Recorded as an alternate; AI_DOC_ANALYSIS is wired to 5b29edc8, whose '
      + 'documented response is exactly { event_name, ai_summary, accept_url }.',
  },
  c43388639d14452faef4ca3042a95b23: {
    named: 'BULK_ASSIGN (REGEN build)', tier: 3, evidence: [`${DOC.regen} names it BULK_ASSIGN`],
  },
  '02a3a70f3dec4dcd9a85a244a60c65b9': {
    named: 'API_GET (ACK build)', tier: 3,
    evidence: ['apps/NITDA_DGO_HUB_ACK.html names it API_GET'],
  },
  '5de1fc934e2944bb9cf9d9a0f9bd38e3': {
    named: 'assign-item direct build endpoint', tier: 3,
    evidence: ['apps/DAA_DGO_HUB_ASSIGN_ITEM_DIRECT_Build_v2.0.html'],
  },
  '6d78b1940f4447b8b31b49657fe9c19c': {
    named: 'emails, compose-select response variant', tier: 3,
    evidence: [`${DOC.webPrimary} — response { "emails": @{outputs('Compose_JSON_Select_Output')} }`],
  },
  cae7796c721b47bc9aa95159eeb16081: {
    named: 'task-created responder', tier: 3,
    evidence: ['flows/details/Flows structures documentation.txt — response { "Status": "Task Created" }'],
    warning: 'Every copy of this URL has prose glued onto the signature. The 43-character '
      + 'prefix is consistent across both copies and is what is published here, but it has '
      + 'less corroboration than the rest of the catalogue.',
  },
  '7ee91bdefd3c449889d680c722a99d05': {
    named: 'send-email variant', tier: 3,
    evidence: ['flows/details/Flows structures documentation.txt'],
    warning: 'One occurrence, with prose glued onto the signature. Same caveat as cae7796c.',
  },
});

/* ------------------------------------------------------------------ *
 * Contract key -> flow
 * ------------------------------------------------------------------ */

/**
 * Every contract key on both surfaces, mapped to the flow that serves it.
 *
 * `why` cites the evidence. `alternates` names other workflow ids in the catalogue that
 * could plausibly serve the key, so the provisioning record can offer them for a live-test
 * swap rather than making the operator re-derive them from the corpus.
 */
const KEY_MAP = {
  runtime: {
    FETCH_ALL: {
      workflowId: '31e02518075940d2bcfa9bdb0e9b0b8d',
      why: 'The register bootstrap. The operator\'s consolidated list names this flow '
        + '"get all data", which is what the fetchAll action asks for.',
      alternates: ['1d56be97cd184fd9b2facede12b17c34', '4a250f97181b4a28abc1d0fb0f7d4c4d'],
      caveat: 'Two other flows could serve this key — "all data and references", which '
        + 'merges what REFERENCE_DATA fetches separately, and the lineage snapshot\'s '
        + 'FETCH_ALL. Both are in FLOW_CATALOGUE with complete URLs; swapping is one line '
        + 'in a values file.',
    },
    DYNAMIC_ACTIONS: {
      workflowId: 'bc83d98acf474a088832d78f50085388',
      why: 'The DYNAMIC GLOBAL ENDPOINT INTERFACE flow, named by the specification document '
        + 'and by two application builds. Every governed write routes here.',
    },
    EMAIL: {
      workflowId: 'bc83d98acf474a088832d78f50085388',
      why: 'The same flow: dispatchEmail is a route on the dynamic global interface, which '
        + 'is why EMAIL declares DYNAMIC_GLOBAL_ACTIONS as its sourceKey.',
    },
    SINGLE_ASSIGNMENT: {
      workflowId: 'f71397ff3ca145059dc8f78c04923e9f',
      why: 'Named SINGLE ASSIGN by the specification document, "create task and update '
        + 'activity" by the consolidated list, and "Create task" by the numbered flow list. '
        + 'Three of the operator\'s own documents agree.',
      alternates: ['6b3bad3005b44bf6bced0f8074d3f2ed'],
      caveat: 'A second create-task flow exists (6b3bad30, "Deployed Create task"). An '
        + 'earlier build wired that one on the strength of a single lineage artefact; it is '
        + 'now the recorded alternate.',
    },
    BULK_ASSIGNMENT: {
      workflowId: '1154b50e1d17420dadb3b012e7e2a02c',
      why: 'Named "optimized bulk assign" by the flow URL list and BULK_ASSIGNMENT by the '
        + 'lineage snapshot.',
    },
    BULK_ASSIGNMENT_DIRECT: {
      workflowId: '7e71fffe770a45ccb93bf216bb53786e',
      why: 'Named "bulk Assign direct" by the flow URL list, and the specification document '
        + 'carries its trigger schema, titled "Hybrid Assign Request (Single or Bulk)".',
    },
    FETCH_ACTIVITIES: {
      workflowId: '85c556f10b8244ba9d839a2ebe240b91',
      why: 'The subsidiary-actions flow. LIST-ACTIVITIES is one of its declared routes, '
        + 'which is why this key declares SUBSIDIARY_ACTIONS as its sourceKey.',
    },
    SUBSIDIARY_ACTIONS: {
      workflowId: '85c556f10b8244ba9d839a2ebe240b91',
      why: 'The flow itself, with eighteen routes on one URL — specification document §7.',
    },
    REFERENCE_DATA: {
      workflowId: 'ff455c68e9ac493e858fb984bcfd01fb',
      why: 'The specification document defines this id twice, as LOOKUPS and as GET '
        + 'REFERENCES, both with schema and response; the consolidated list calls it '
        + '"references"; the flow URL list calls it Fetch_References_and_Lookups_Data. '
        + 'Twenty-two occurrences across three documents.',
      alternates: ['d67f2acb3708449490eed561ee56efbe'],
      caveat: 'An earlier build wired d67f2acb here, on one line in one lineage artefact '
        + 'and no corroboration anywhere. That was wrong and is now the alternate.',
    },
    GET_DOCS: {
      workflowId: '818ec4053f1e4f0b87845114241d8b74',
      why: 'Named GET DOCS by the specification document with schema and response, and '
        + '"get docs" by the consolidated list.',
      alternates: ['7995c1eb50d94d5daa2780e71391d874'],
      caveat: 'BULK OPS GET DOCS (7995c1eb) is the bulk variant of the same read and is '
        + 'catalogued with a complete URL.',
    },
    FETCH_EMAIL_ATTACHMENTS: {
      workflowId: '20e6340941ce4b1bbb87b43c9102a777',
      why: 'Named "Get email attachments" in the operator\'s numbered flow list and '
        + '"Get Attachments" in the control-deck export.',
      warning: 'The lineage snapshot carries this signature with a trailing "=" of base64 '
        + 'padding. The unpadded 43-character form is what is provisioned.',
    },
    EMAIL_RELATED_TASK: {
      workflowId: 'a942d230337c4ddfa9a386e92bbd048b',
      why: 'Named CREATE TASK FOR EMAIL by the specification document and by the REGEN build.',
      warning: 'An earlier build took this signature from the lineage snapshot, which '
        + 'carries a mangled 40-character copy. The URL provisioned now is the '
        + '43-character one the specification document and the REGEN build both carry.',
    },
    AI_EMAIL_ANALYSIS: {
      workflowId: 'fe794e0139784ac694768e5a716e0be7',
      why: 'The AI-over-inbound-email flow: the numbered flow list, the control-deck export '
        + 'and the lineage snapshot all place AI analysis of an email here.',
      caveat: 'The consolidated list labels it "email to task". If a live probe answers '
        + 'with a task rather than an analysis, swap it for the dedicated chat flow '
        + '(a13c8b57) or CREATE TASK FOR EMAIL (a942d230) and re-run.',
    },
    AI_DOC_ANALYSIS: {
      workflowId: '5b29edc84b5d4a8db3c885d8441aa977',
      why: 'The events-processing flow. Its documented trigger is { DocId, TaskId } and its '
        + 'documented response is { event_name, ai_summary, accept_url }, which is exactly '
        + 'what the aiAnalyseEventDocs action asks for and reads back.',
      alternates: ['20e3b003a57f47febae8a24ad5b9acd4'],
      caveat: 'An earlier build wired 20e3b003, named AI_DOC_ANALYSIS by the lineage '
        + 'snapshot and LOOKUPS by the specification document\'s own index. Neither '
        + 'document carries a schema for it, so it is the alternate.',
    },
    AI_CHAT: {
      workflowId: 'a13c8b577bd44f8787c50d095ea3faf9',
      why: 'Its documented response body is { "reply": @{outputs(\'Compose_AI_Response\')} } '
        + 'and the lineage snapshot names it AI_CHAT.',
    },
    OTP_GENERATE: {
      workflowId: '314aaf27593147089b38322e5ca25936',
      why: 'The OTP issue flow. Its own run records are titled "Web - OTP Generate".',
    },
    OTP_VERIFY: {
      workflowId: '43879c5165de439680055ab4258b3f27',
      why: 'The redemption half of the pair. Its run records are titled "Web - OTP Verify".',
    },
  },

  portal: {
    SUBMISSION: {
      workflowId: '1ff7714c11a74fa4a876f8f6a79b64d2',
      why: 'The document submission portal flow, documented in full in '
        + 'docs/reference/foundational/flows/DOCUMENT SUBMISSION PORTAL POWER AU.txt.',
      caveat:
        'CONTRACT MISMATCH. This flow takes the file inline as FileContentBase64 and '
        + 'answers { trackingId, referenceId, … }. The portal today declares attachments '
        + 'and expects { referenceId, uploads: [ticket, …] }, then PUTs raw bytes to '
        + 'UPLOAD. Wired so the difference is provable rather than assumed — '
        + '`npm run verify:endpoints` reports exactly which fields are missing.',
    },
    VERIFY: {
      workflowId: '314aaf27593147089b38322e5ca25936',
      why: 'The OTP generate flow. The portal\'s VERIFY contract — take an email, mail a '
        + 'one-time code, rate-limit per address — is what this flow already does.',
    },
    VERIFY_CONFIRM: {
      workflowId: '43879c5165de439680055ab4258b3f27',
      why: 'The OTP verify flow, the redemption half of the pair above.',
    },
    STATUS: {
      workflowId: '85c556f10b8244ba9d839a2ebe240b91',
      why: 'The subsidiary-actions flow. TRACK is one of its declared routes, and that is '
        + 'the read-back the portal\'s STATUS contract describes.',
      caveat: 'Routed, not dedicated: this reaches the TRACK route of a shared flow. '
        + 'Whether that route is implemented is a live question — verify before relying on it.',
    },
    SUPPORT: {
      workflowId: '85c556f10b8244ba9d839a2ebe240b91',
      why: 'The same shared flow. CREATESUPPORTREQUEST is declared among its routes and is '
        + 'the operation config/support-routing.config.js already names.',
      caveat: 'Routed, not dedicated — same caveat as STATUS.',
    },
  },
};

/** Keys with no flow anywhere in the corpus, recorded so the absence is stated. */
export const UNAVAILABLE = {
  runtime: {
    SCAN_INTAKE:
      'No flow in the corpus accepts a raw-bytes PUT with X-DGO-Filename / X-DGO-Size / '
      + 'X-DGO-Sha256. Registry Scan Intake reports itself unconfigured, which is correct — '
      + 'it must not appear to file a document it never filed. Wiring it to a JSON flow '
      + 'would make it fail at an officer\'s desk instead of at the point of configuration.',
  },
  portal: {
    UPLOAD:
      'No ticket-redeeming upload flow exists. The legacy submission flow takes bytes '
      + 'inline as base64 instead, which is the 4 MB ceiling the ticket design replaced.',
  },
};

/* ------------------------------------------------------------------ *
 * Scanning the corpus
 * ------------------------------------------------------------------ */

function trackedCorpusFiles() {
  return execFileSync('git', ['ls-files', '-z', CORPUS], {
    cwd: ROOT, maxBuffer: 64 * 1024 * 1024,
  })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

/**
 * Read one corpus file as text, flattening the escaping the exports carry.
 *
 * These are documentation artefacts, not clean data: JSON files whose payloads are
 * themselves JSON-encoded strings, HTML with entity-encoded ampersands, plain text pasted
 * from half a dozen tools.
 *
 * Unescaping is done in a single pass. Chained `.replace()` calls would re-scan their own
 * output, so `&amp;` would decode to `&` in two steps rather than the `&amp;` it
 * denotes — and a URL carrying a literal `&amp;` in a parameter would lose it. One pass,
 * each match substituted once, keeps the mapping honest.
 */
const UNESCAPE = {
  '\\"': '"',
  '\\/': '/',
  '\\u0026': '&',
  '&amp;': '&',
  '\\n': '\n',
  '\\r': '\r',
};
const UNESCAPE_RE = /\\"|\\\/|\\u0026|&amp;|\\n|\\r/g;

function readNormalised(rel) {
  const abs = path.join(ROOT, rel);
  let text;
  try {
    if (fs.statSync(abs).size > 64 * 1024 * 1024) return '';
    text = fs.readFileSync(abs, 'latin1');
  } catch {
    return '';
  }
  return text.replace(UNESCAPE_RE, (m) => UNESCAPE[m]);
}

/**
 * Rebuild a trigger URL from its parts.
 *
 * Reconstruction rather than pass-through is the point. The corpus carries these URLs with
 * prose glued on, entity residue in the query string, and parameters in whatever order the
 * tool that exported them chose. Rebuilding from four extracted values means none of that
 * can reach a package: what is written is a URL this module composed, not a substring it
 * happened to find.
 */
function composeUrl({ host, workflowId, trigger, query, signature }) {
  const params = new Map();
  for (const pair of String(query || '').split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const name = eq === -1 ? pair : pair.slice(0, eq);
    if (!name || name === 'sig') continue;
    params.set(name, eq === -1 ? '' : pair.slice(eq + 1));
  }
  if (!params.has('api-version')) params.set('api-version', '1');
  if (!params.has('sp')) params.set('sp', `%2Ftriggers%2F${trigger}%2Frun`);
  if (!params.has('sv')) params.set('sv', '1.0');

  /* Ordered, so the same flow composes to the same string wherever it was found — the
     package build id is a digest of these URLs, and an id that changed with the scan order
     of the corpus would answer "is this the deployment I verified?" with noise. */
  const ORDER = ['api-version', 'sp', 'sv'];
  const names = [...ORDER.filter(n => params.has(n)),
    ...[...params.keys()].filter(n => !ORDER.includes(n)).sort()];
  const qs = names.map(n => `${n}=${params.get(n)}`).join('&');

  return `https://${host}/powerautomate/automations/direct/workflows/${workflowId}`
    + `/triggers/${trigger}/paths/invoke?${qs}&sig=${signature}`;
}

/**
 * Index every complete trigger URL in the corpus by workflow id.
 *
 * A flow's trigger may have been regenerated more than once, and the corpus also carries
 * corrupted copies, so one id can carry several distinct signatures. Corroboration is the
 * tie-break: the signature documented in the most separate files is the one the estate
 * settled on. Alternates are returned rather than discarded, because picking wrong is only
 * recoverable if you can see what else there was.
 */
export function indexCorpus() {
  const byWorkflow = new Map();
  for (const rel of trackedCorpusFiles()) {
    const text = readNormalised(rel);
    if (!text) continue;
    for (const m of text.matchAll(URL_RE)) {
      const [, host, workflowId, trigger, query, signature] = m;
      const url = composeUrl({ host, workflowId, trigger, query, signature });
      if (!byWorkflow.has(workflowId)) byWorkflow.set(workflowId, new Map());
      const bySig = byWorkflow.get(workflowId);
      if (!bySig.has(url)) bySig.set(url, { url, count: 0, sources: new Set() });
      const rec = bySig.get(url);
      rec.count++;
      rec.sources.add(rel);
    }
  }
  const out = new Map();
  for (const [id, bySig] of byWorkflow) {
    const ranked = [...bySig.values()].sort(
      (a, b) => b.sources.size - a.sources.size || b.count - a.count || (a.url < b.url ? -1 : 1)
    );
    out.set(id, ranked.map(r => ({ ...r, sources: [...r.sources] })));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

/**
 * Resolve every endpoint the corpus can supply.
 *
 * Returns `{ runtime, portal, unavailable, catalogue, index }` where each surface maps a
 * contract key to `{ url, workflowId, via, why, caveat, alternates }`. `via` records how
 * the mapping was established, so the wiring can be audited without re-deriving it.
 */
export function recoverEndpoints({ runtimeKeys, portalKeys }) {
  const index = indexCorpus();

  const resolve = (keys, surface) => {
    const found = {};
    const missing = [];
    for (const key of keys) {
      const spec = KEY_MAP[surface]?.[key];
      const candidates = spec && index.get(spec.workflowId);
      if (!spec || !candidates?.length) {
        missing.push(key);
        continue;
      }
      const entry = FLOW_CATALOGUE[spec.workflowId] || {};
      found[key] = {
        url: candidates[0].url,
        workflowId: spec.workflowId,
        flow: entry.named || null,
        via: `catalogue (evidence tier ${entry.tier ?? '?'})`,
        why: spec.why,
        caveat: spec.caveat,
        warning: spec.warning || entry.warning,
        contested: entry.contested,
        evidence: entry.evidence || [],
        sources: candidates[0].sources,
        /* Other signatures on the SAME flow, then whole other flows that could serve the
           key. Both are things an operator may need to reach for mid-test. */
        alternates: [
          ...candidates.slice(1).map(c => c.url),
          ...(spec.alternates || []).flatMap(id => (index.get(id) || []).slice(0, 1).map(c => c.url)),
        ],
      };
    }
    return { found, missing };
  };

  const runtime = resolve(runtimeKeys, 'runtime');
  const portal = resolve(portalKeys, 'portal');

  return { runtime, portal, unavailable: UNAVAILABLE, catalogue: flowCatalogue({ runtime, portal, index }), index };
}

/**
 * Every flow the corpus supplies a usable URL for, whether or not a contract key calls it.
 *
 * This is the answer to "which flows are available and which is each one wired to?" — a
 * question that had no artefact before, so a flow the platform has no key for was
 * indistinguishable from a flow that had been overlooked. It ships inside both packages, so
 * live testing can repoint any key at any flow without going back to the corpus.
 */
export function flowCatalogue({ runtime, portal, index } = {}) {
  const idx = index || indexCorpus();
  const wiredBy = new Map();
  for (const [surface, res] of [['runtime', runtime], ['portal', portal]]) {
    for (const [key, v] of Object.entries(res?.found || {})) {
      if (!wiredBy.has(v.workflowId)) wiredBy.set(v.workflowId, []);
      wiredBy.get(v.workflowId).push(`${surface}.${key}`);
    }
  }
  return [...idx.entries()]
    .map(([workflowId, candidates]) => {
      const entry = FLOW_CATALOGUE[workflowId] || {};
      return {
        workflowId,
        flow: entry.named || '(not named in any reference document)',
        evidenceTier: entry.tier ?? null,
        evidence: entry.evidence || [],
        contested: entry.contested,
        warning: entry.warning,
        wiredTo: wiredBy.get(workflowId) || [],
        url: candidates[0].url,
        alternateUrls: candidates.slice(1).map(c => c.url),
        documentedIn: candidates[0].sources,
      };
    })
    .sort((a, b) => (b.wiredTo.length - a.wiredTo.length)
      || ((a.evidenceTier ?? 9) - (b.evidenceTier ?? 9))
      || (a.flow < b.flow ? -1 : 1));
}

/** Signatures recovered here are published; the gate needs to recognise them. */
export function recoveredSignatures() {
  const sigs = new Set();
  for (const candidates of indexCorpus().values()) {
    for (const c of candidates) {
      const m = /sig=([A-Za-z0-9_-]+)/.exec(c.url);
      if (m) sigs.add(m[1]);
    }
  }
  return sigs;
}
