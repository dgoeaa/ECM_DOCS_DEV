/* NITDA Intelligent Portal — correspondence taxonomy, status model and seed records.
   Loaded before core.js. All dates are stored as day-offsets and materialised
   at install time so a freshly deployed instance always looks current. */
window.PF = window.PF || {};

PF.ORG = {
  name: 'NITDA Intelligent Portal',
  agency: 'National Information Technology Development Agency',
  short: 'NITDA',
  tagline: 'Document submission, tracking and support',
  email: 'portal@nitda.gov.ng',
  phone: '+234 700 000 6483',
  address: 'No. 28 Port Harcourt Crescent, Off Gimbiya Street, Area 11, Garki, Abuja',
  hours: 'Monday – Friday, 08:00 – 17:00 WAT'
};

/* ---------------------------------------------------------------
   Backend.

   This replaced PF.ENDPOINTS, which held three SAS-signed Power Automate
   URLs. A signed URL is a bearer credential: possession alone authorises
   invoking the flow, and these were delivered to every browser that opened
   any page of this portal, cached by the service worker, and readable by
   anyone who could fetch a static asset.

   The portal now holds NO credential. It talks to the authenticating proxy,
   which is the only component that holds one (see proxy/README.md and
   docs/architecture/TARGET_ARCHITECTURE.md §3.1). That is what retires the
   problem class rather than rotating it: there is no signature left in any
   shipped asset to leak.

   Set at deploy time by copying config.example.js to config.local.js — which
   is git-ignored — or by injecting window.PF_CONFIG before this file loads.
   Empty means DEMO MODE: everything stays local and nothing is transmitted,
   which is the safe failure for a public channel.
   --------------------------------------------------------------- */
PF.CONFIG = Object.assign({ proxyBaseUrl: '' },
  (typeof window !== 'undefined' && window.PF_CONFIG) || {});

/* ---------------------------------------------------------------
   Status model — four visible stages, seven internal states.
   --------------------------------------------------------------- */
PF.STATUS = {
  received:          { label: 'Received',        pill: 'pending',  stage: 1, blurb: 'Logged in the registry and queued for validation.' },
  validation:        { label: 'Validation',      pill: 'routed',   stage: 2, blurb: 'Documents are being checked for completeness.' },
  review:            { label: 'Under review',    pill: 'routed',   stage: 3, blurb: 'With the assigned unit for technical assessment.' },
  'action-required': { label: 'Action required', pill: 'action',   stage: 3, blurb: 'We need something from you before we can continue.' },
  approved:          { label: 'Approved',        pill: 'success',  stage: 4, blurb: 'Decision issued. Outcome sent to your email address.' },
  declined:          { label: 'Declined',        pill: 'danger',   stage: 4, blurb: 'Not approved on this submission. Reasons are in the notes.' },
  withdrawn:         { label: 'Withdrawn',       pill: 'archived', stage: 4, blurb: 'Closed at the request of the submitter.' }
};
PF.STAGES = ['Received', 'Validated', 'Under review', 'Decision'];

/* ---------------------------------------------------------------
   Correspondence taxonomy.

   This replaced PF.SERVICES, which modelled the portal as a service desk:
   a submitter picked "IT Project Clearance", a 14-working-day decision SLA
   started, and an officer approved or declined it. That is not what this
   portal is. It is an external intake channel for documents and
   correspondence addressed to NITDA.

   Each entry is a PUBLIC-FACING type that maps onto the internal registry
   category the operations platform already uses, so a submitter never has to
   read an internal taxonomy but every submission lands on a known category.
   `category` is the mapping; confirm the exact strings against the registry
   reference data before go-live.
   --------------------------------------------------------------- */

/* Acknowledgement of receipt — NOT a decision deadline. The registry
   acknowledges within this window; the outcome follows its own workflow and
   is reported through tracking, not promised up front. */
PF.ACK_TARGET_DAYS = 3;

PF.CORRESPONDENCE_TYPES = [
  { key: 'letter', label: 'Official letter', category: 'General Correspondence',
    blurb: 'A formal letter addressed to the Director-General or to a directorate.',
    needs: ['The signed letter, as a PDF or scan'] },
  { key: 'application', label: 'Application or formal request', category: 'Application',
    blurb: 'A request for clearance, accreditation, licensing, labelling or approval.',
    needs: ['Covering letter stating what is requested', 'Supporting documents named in the letter'] },
  { key: 'proposal', label: 'Proposal or expression of interest', category: 'Proposal',
    blurb: 'An unsolicited proposal, partnership concept or expression of interest.',
    needs: ['Concept note or proposal', 'Organisation profile'] },
  { key: 'report', label: 'Report or periodic return', category: 'Report',
    blurb: 'A report or return required under an existing engagement or obligation.',
    needs: ['The report document', 'Reference of the engagement it relates to'] },
  { key: 'compliance', label: 'Regulatory or compliance filing', category: 'Compliance Filing',
    blurb: 'A filing made under a regulation, standard or statutory instrument.',
    needs: ['The filing itself', 'Evidence of any fee paid'] },
  { key: 'policy', label: 'Policy or strategy document', category: 'Policy Submission',
    blurb: 'A draft policy, standard, strategy or regulatory instrument submitted for review.',
    needs: ['The document', 'Any consultation or endorsement evidence'] },
  { key: 'invitation', label: 'Invitation or event notice', category: 'Invitation',
    blurb: 'An invitation to an event, or a request for representation or an observer.',
    needs: ['Invitation letter', 'Programme or agenda, if available'] },
  { key: 'other', label: 'Other correspondence', category: 'General Correspondence',
    blurb: 'Anything that does not fit the types above. The registry will classify it.',
    needs: ['Whatever document you are submitting'] }
];

PF.ORG_TYPES = ['Ministry, Department or Agency', 'State Government', 'Private company', 'Non-governmental organisation', 'Academic institution', 'Individual / Sole proprietor', 'International organisation'];
PF.STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT — Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];

/* Names used only to make the shipped demonstration records read plausibly. Nothing in the
   portal assigns work — the registry does that on receipt, and a submission dispatched to
   the proxy carries no officer at all. */
PF.OFFICERS = ['A. Bello', 'C. Okonkwo', 'F. Danjuma', 'H. Yusuf', 'M. Adeyemi', 'T. Eze'];

/* PF.STAFF is deleted, not moved.
   It held three username/password pairs — admin/password, reviewer/reviewer,
   compliance/compliance — in a JavaScript file served to the public internet by an
   unauthenticated static site, and admin.js compared the typed password against them in
   the browser. That is not a weak authentication control; it is the absence of one, and
   the fix is not a stronger password.

   The operations console it gated is retired with it. An external submission channel has
   no business carrying staff triage: the internal platform already implements registry,
   correspondence, dispatch and approvals, and enforces identity server-side.
   See TARGET_ARCHITECTURE.md §3.4 and docs/forensic/dd2e909/findings.json F-029. */

PF.CHANNELS = [
  { icon: 'mail', label: 'Helpdesk email', value: 'portal@nitda.gov.ng', href: 'mailto:portal@nitda.gov.ng', note: 'Quote your tracking ID in the subject line. Replies within one working day.' },
  { icon: 'chat', label: 'Registry telephone', value: '+234 700 000 6483', href: 'tel:+2347000006483', note: 'Monday to Friday, 08:00 – 17:00 WAT, excluding public holidays.' },
  { icon: 'building', label: 'Walk-in registry', value: 'No. 28 Port Harcourt Crescent, Garki, Abuja', href: '', note: 'Ground-floor registry desk. Bring a printed copy of your receipt.' },
  { icon: 'shield', label: 'Data protection officer', value: 'dpo@nitda.gov.ng', href: 'mailto:dpo@nitda.gov.ng', note: 'For access, correction or erasure requests under the NDPA.' }
];

PF.SUPPORT_TOPICS = [
  { key: 'submission', label: 'Problem with a submission' },
  { key: 'tracking', label: 'Tracking ID not found' },
  { key: 'upload', label: 'File upload or format issue' },
  { key: 'status', label: 'Question about a decision' },
  { key: 'account', label: 'Access or account issue' },
  { key: 'other', label: 'Something else' }
];

PF.FAQ = [
  { q: 'How long does a submission take?', a: 'The registry acknowledges receipt within ' + PF.ACK_TARGET_DAYS + ' working days, and the acknowledgement carries your tracking ID. How long the substantive response takes depends on what was submitted and which directorate handles it — the portal does not promise a decision date it cannot keep. Every change is reported on your tracking timeline.' },
  { q: 'I have lost my tracking ID. What can I do?', a: 'Tracking IDs are emailed to the address used at submission and are also listed under “Recent activity on this device” on the tracking page. If neither is available, raise a support request with your name, organisation and the approximate submission date and the registry will locate the record.' },
  { q: 'Which file formats are accepted?', a: 'PDF, DOC, DOCX, XLS, XLSX, PNG and JPG. Individual files may not exceed 10 MB and a single submission may carry up to five attachments. Scanned documents should be legible at 200 dpi or better.' },
  { q: 'My request says “Action required”. What happens next?', a: 'A reviewing officer has asked for extra information. The note on your tracking timeline explains what is needed. Reply to the notification email with the requested document, quoting your tracking ID. Nothing further happens on the file until you respond.' },
  { q: 'Is my data protected?', a: 'Submissions are processed under the Nigeria Data Protection Act. Files are transmitted over TLS, retained only for as long as the regulatory purpose requires, and access is limited to the assigned unit and the registry.' },
  { q: 'Can somebody else submit on my behalf?', a: 'Yes. Provide the organisation details of the entity the submission is for and use an official email address that is monitored — all correspondence, including the decision, goes to that address.' },
  { q: 'Are there fees, and can I pay in the portal?', a: 'Where a prescribed fee applies it is paid into the agency’s designated revenue account through the Treasury Single Account. The portal does not take card payments; upload the evidence of payment as one of your attachments and the registry reconciles it during validation.' },
  { q: 'Can a request be expedited?', a: 'Mark the submission as expedited on the document step and state the reason. The registry validates the justification, and expedited correspondence is triaged ahead of the standard queue. It changes the order things are picked up in, not the acknowledgement target.' },
  { q: 'How do I correct something after submitting?', a: 'Open the request on the tracking page and add a note; it lands on the reviewing officer’s timeline immediately. If the document itself was wrong, withdraw the request and submit the corrected version so the registry keeps one clean record per decision.' }
];

/* Support cases installed on first run so the helpdesk queue in the
   operations console is populated on a fresh deployment. */
PF.SUPPORT_SEEDS = [
  { ref: 'NITDA-S-4KQ7BM', topic: 'tracking', days: 2, name: 'Amaka Smith', email: 'a.smith@sterlingdata.ng', requestId: 'NITDA-F6G7H8I9J', status: 'in-progress',
    message: 'I received the request for additional documentation but the tracking page does not show the sub-processor register I emailed on Monday. Please confirm it was received.',
    replies: [{ d: 1, by: 'Helpdesk', text: 'Located the email; it has been attached to the record and the reviewing officer notified. The clock on your target remains paused until the review resumes.' }] },
  { ref: 'NITDA-S-9XR2TD', topic: 'upload', days: 6, name: 'Peter Onoja', email: 'p.onoja@skylarkict.ng', requestId: '', status: 'resolved',
    message: 'The accreditation form is a 14 MB scan and the portal will not accept it. What is the best way to send it?',
    replies: [{ d: 5, by: 'Helpdesk', text: 'Re-scan at 200 dpi in black and white, which brings a 14-page form under 10 MB, or split it into two attachments. Both are accepted.' }] }
];

/* ---------------------------------------------------------------
   Seed records — installed once per browser, then live in the store.
   --------------------------------------------------------------- */
PF.SEEDS = [
  { id: 'NITDA-A1B2C3D4E', type: 'application', status: 'approved', priority: 'standard', days: 21, org: 'Federal Ministry of Health', orgType: 'Ministry, Department or Agency', state: 'FCT — Abuja', name: 'Joseph Danladi', email: 'j.danladi@health.gov.ng',
    title: 'Clearance for national health records platform', officer: 'M. Adeyemi',
    files: [{ name: 'NHR-Platform-Proposal.pdf', size: 2411520 }, { name: 'Approved-Budget-Line.pdf', size: 318000 }],
    events: [ { d: 21, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 20, s: 'validation', a: 'Documents validated by the registry.' }, { d: 17, s: 'review', a: 'Assigned to Standards, Guidelines & Regulation.' }, { d: 8, s: 'review', a: 'Compliance audit completed successfully.', n: 'Architecture meets the NGN Cloud First policy.' }, { d: 3, s: 'approved', a: 'Clearance certificate issued and sent to the requester.', n: 'Certificate reference ITC/2025/0418.' } ] },
  { id: 'NITDA-F6G7H8I9J', type: 'compliance', status: 'action-required', priority: 'standard', days: 9, org: 'Sterling Data Systems Ltd', orgType: 'Private company', state: 'Lagos', name: 'Amaka Smith', email: 'a.smith@sterlingdata.ng',
    title: 'Annual data protection audit filing 2025', officer: 'C. Okonkwo',
    files: [{ name: 'DPCO-Audit-Report-2025.pdf', size: 5240000 }],
    events: [ { d: 9, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 8, s: 'validation', a: 'Documents validated by the registry.' }, { d: 5, s: 'review', a: 'Initial assessment by Digital Economy & Compliance.' }, { d: 2, s: 'action-required', a: 'Additional documentation requested.', n: 'Please provide evidence of the data-hosting location and the sub-processor register.' } ] },
  { id: 'NITDA-K0L1M2N3O', type: 'policy', status: 'review', priority: 'expedited', days: 5, org: 'Kaduna State Government', orgType: 'State Government', state: 'Kaduna', name: 'Bilkisu Mark', email: 'b.mark@kdsg.gov.ng',
    title: 'Kaduna State digital economy strategy 2026–2030', officer: 'F. Danjuma',
    files: [{ name: 'KDSG-Digital-Strategy.pdf', size: 8120000 }, { name: 'Implementation-Roadmap.xlsx', size: 442000 }],
    events: [ { d: 5, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 4, s: 'validation', a: 'Documents validated by the registry.' }, { d: 2, s: 'review', a: 'Technical compatibility assessment initiated.' } ] },
  { id: 'NITDA-P4Q5R6S7T', type: 'application', status: 'review', priority: 'standard', days: 12, org: 'Cedarwood Institute of Technology', orgType: 'Academic institution', state: 'Enugu', name: 'Ngozi Obi', email: 'registrar@cedarwood.edu.ng', title: 'Accreditation of IT training programme', officer: 'A. Bello',
    files: [{ name: 'Accreditation-Application.pdf', size: 1240000 }],
    events: [ { d: 12, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 11, s: 'validation', a: 'Documents validated by the registry.' }, { d: 6, s: 'review', a: 'Facility capacity review scheduled.' } ] },
  { id: 'NITDA-U8V9W0X1Y', type: 'application', status: 'approved', priority: 'expedited', days: 16, org: 'Paylink Africa', orgType: 'Private company', state: 'Lagos', name: 'Tunde Bakare', email: 'tunde@paylink.africa', title: 'Startup Act labelling verification', officer: 'T. Eze',
    files: [{ name: 'CAC-Certificate.pdf', size: 640000 }, { name: 'Product-Overview.pdf', size: 1810000 }],
    events: [ { d: 16, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 15, s: 'validation', a: 'Documents validated by the registry.' }, { d: 12, s: 'review', a: 'Eligibility assessed against the Startup Act.' }, { d: 4, s: 'approved', a: 'Startup label confirmed.', n: 'Label reference SUA/LB/2025/1187.' } ] },
  { id: 'NITDA-Z2A3B4C5D', type: 'proposal', status: 'declined', priority: 'standard', days: 27, org: 'Novatek Consulting', orgType: 'Private company', state: 'Rivers', name: 'Ibim Wokoma', email: 'i.wokoma@novatek.ng', title: 'Unsolicited proposal — rural connectivity pilot', officer: 'H. Yusuf',
    files: [{ name: 'Rural-Connectivity-Concept.pdf', size: 2960000 }],
    events: [ { d: 27, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 26, s: 'validation', a: 'Documents validated by the registry.' }, { d: 20, s: 'review', a: 'Reviewed by Corporate Planning & Partnerships.' }, { d: 11, s: 'declined', a: 'Proposal not accepted.', n: 'Scope overlaps an existing intervention under the National Broadband Plan. Resubmission is welcome in the next cycle.' } ] },
  { id: 'NITDA-E6F7G8H9I', type: 'report', status: 'validation', priority: 'standard', days: 2, org: 'Galaxy Backbone Ltd', orgType: 'Ministry, Department or Agency', state: 'FCT — Abuja', name: 'Sadiq Aliyu', email: 's.aliyu@galaxybackbone.com.ng', title: 'Q3 infrastructure utilisation report', officer: 'A. Bello',
    files: [{ name: 'Q3-Utilisation-Report.pdf', size: 1120000 }],
    events: [ { d: 2, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 1, s: 'validation', a: 'Registry check in progress.' } ] },
  { id: 'NITDA-J0K1L2M3N', type: 'policy', status: 'review', priority: 'standard', days: 8, org: 'Ogun State Ministry of Science & Technology', orgType: 'State Government', state: 'Ogun', name: 'Folasade Adeniyi', email: 'f.adeniyi@ogunstate.gov.ng', title: 'Draft state cloud adoption policy', officer: 'F. Danjuma',
    files: [{ name: 'Draft-Cloud-Policy-v3.docx', size: 384000 }],
    events: [ { d: 8, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 7, s: 'validation', a: 'Documents validated by the registry.' }, { d: 5, s: 'review', a: 'Under review by Policy & Strategy.' } ] },
  { id: 'NITDA-O4P5Q6R7S', type: 'application', status: 'action-required', priority: 'standard', days: 14, org: 'Federal Inland Revenue Service', orgType: 'Ministry, Department or Agency', state: 'FCT — Abuja', name: 'Emeka Nwosu', email: 'e.nwosu@firs.gov.ng', title: 'Clearance for tax administration upgrade', officer: 'M. Adeyemi',
    files: [{ name: 'TAS-Upgrade-BOQ.xlsx', size: 214000 }],
    events: [ { d: 14, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 13, s: 'validation', a: 'Documents validated by the registry.' }, { d: 9, s: 'review', a: 'Technical specification under assessment.' }, { d: 4, s: 'action-required', a: 'Clarification requested.', n: 'Provide the signed technical specification and the approved budget line reference.' } ] },
  { id: 'NITDA-T8U9V0W1X', type: 'letter', status: 'approved', priority: 'standard', days: 6, org: 'Bright Minds Foundation', orgType: 'Non-governmental organisation', state: 'Kano', name: 'Halima Sani', email: 'h.sani@brightminds.org', title: 'Request for digital literacy partnership briefing', officer: 'T. Eze',
    files: [{ name: 'Partnership-Request.pdf', size: 168000 }],
    events: [ { d: 6, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 5, s: 'validation', a: 'Documents validated by the registry.' }, { d: 3, s: 'review', a: 'Routed to Corporate Planning & Partnerships.' }, { d: 1, s: 'approved', a: 'Briefing scheduled and confirmation sent.' } ] },
  { id: 'NITDA-Y2Z3A4B5C', type: 'compliance', status: 'received', priority: 'standard', days: 1, org: 'Meridian Health HMO', orgType: 'Private company', state: 'Oyo', name: 'Kunle Ojo', email: 'compliance@meridianhmo.ng', title: 'Data protection audit filing 2025', officer: 'C. Okonkwo',
    files: [{ name: 'Audit-Summary.pdf', size: 903000 }],
    events: [ { d: 1, s: 'received', a: 'Submission received and tracking ID issued.' } ] },
  { id: 'NITDA-D6E7F8G9H', type: 'application', status: 'withdrawn', priority: 'standard', days: 34, org: 'Skylark ICT Services', orgType: 'Private company', state: 'Delta', name: 'Peter Onoja', email: 'p.onoja@skylarkict.ng', title: 'Consultant accreditation application', officer: 'A. Bello',
    files: [{ name: 'Consultant-Application.pdf', size: 512000 }],
    events: [ { d: 34, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 33, s: 'validation', a: 'Documents validated by the registry.' }, { d: 26, s: 'withdrawn', a: 'Withdrawn at the request of the applicant.' } ] },
  { id: 'NITDA-I0J1K2L3M', type: 'policy', status: 'approved', priority: 'standard', days: 41, org: 'Federal Ministry of Education', orgType: 'Ministry, Department or Agency', state: 'FCT — Abuja', name: 'Grace Umeh', email: 'g.umeh@education.gov.ng', title: 'EdTech strategy alignment review', officer: 'F. Danjuma',
    files: [{ name: 'EdTech-Strategy.pdf', size: 4300000 }],
    events: [ { d: 41, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 40, s: 'validation', a: 'Documents validated by the registry.' }, { d: 34, s: 'review', a: 'Alignment review with the National Digital Economy Policy.' }, { d: 24, s: 'approved', a: 'Alignment confirmed and communicated.' } ] },
  { id: 'NITDA-N4O5P6Q7R', type: 'proposal', status: 'review', priority: 'standard', days: 4, org: 'Zenith Cloud Nigeria', orgType: 'Private company', state: 'Lagos', name: 'Chidi Anyanwu', email: 'c.anyanwu@zenithcloud.ng', title: 'Expression of interest — data centre colocation', officer: 'H. Yusuf',
    files: [{ name: 'EOI-Colocation.pdf', size: 730000 }, { name: 'Company-Profile.pdf', size: 1600000 }],
    events: [ { d: 4, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 3, s: 'validation', a: 'Documents validated by the registry.' }, { d: 1, s: 'review', a: 'Under commercial and technical review.' } ] },
  { id: 'NITDA-S8T9U0V1W', type: 'report', status: 'approved', priority: 'expedited', days: 11, org: 'Nasarawa State ICT Bureau', orgType: 'State Government', state: 'Nasarawa', name: 'Yakubu Musa', email: 'y.musa@nasarawaict.gov.ng', title: 'Digital skills programme completion report', officer: 'T. Eze',
    files: [{ name: 'Programme-Report.docx', size: 296000 }],
    events: [ { d: 11, s: 'received', a: 'Submission received and tracking ID issued.' }, { d: 10, s: 'validation', a: 'Documents validated by the registry.' }, { d: 8, s: 'review', a: 'Outcomes verified against the programme plan.' }, { d: 5, s: 'approved', a: 'Report accepted and filed.' } ] },
  { id: 'NITDA-X2Y3Z4A5B', type: 'letter', status: 'received', priority: 'standard', days: 0, org: 'University of Ibadan', orgType: 'Academic institution', state: 'Oyo', name: 'Adaobi Eze', email: 'a.eze@ui.edu.ng', title: 'Request for research data-sharing guidance', officer: 'A. Bello',
    files: [{ name: 'Research-Data-Enquiry.pdf', size: 121000 }],
    events: [ { d: 0, s: 'received', a: 'Submission received and tracking ID issued.' } ] }
];
