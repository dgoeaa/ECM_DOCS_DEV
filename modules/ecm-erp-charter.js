import { hydrateGovernance } from '../core/governed-actions.js';
import { head, badge, table, esc } from '../core/ui.js';

const CHARTER_TITLE = 'ERP–ECM Scope, Capability & Operating Boundary Charter';

const boundaryComparison = [
  {
    domain: 'System authority',
    erp: 'Structured operational and financial transactions.',
    ecm: 'Governed content, documents, records, evidence, and lifecycle control.'
  },
  {
    domain: 'Primary object',
    erp: 'Transaction records, postings, approvals, and ledger-impacting events.',
    ecm: 'Content assets, files, correspondence, versions, metadata, and records.'
  },
  {
    domain: 'Workflow focus',
    erp: 'Transaction completion and state change.',
    ecm: 'Content creation, review, approval, publication, retention, and disposition.'
  },
  {
    domain: 'Reporting focus',
    erp: 'Financial and operational performance.',
    ecm: 'Content lifecycle, search quality, workflow traceability, records compliance.'
  }
];

const ownershipRows = [
  ['Supplier / vendor', 'Master data', 'Documents, contracts, correspondence, due-diligence evidence', 'ERP ID referenced in ECM metadata'],
  ['Customer / client', 'Master/account data and transactions', 'Related documents, communications, supporting records', 'Shared account/party identifiers'],
  ['Purchase order', 'Create, validate, approve, track, close', 'Linked contract, quotes, specifications, approval evidence, attachments', 'PO number links ERP transaction to ECM file'],
  ['Invoice', 'Capture, validate, post, pay', 'Invoice image, correspondence, disputes, support/evidence package', 'Invoice ID + supplier ID as linkage metadata'],
  ['Payment', 'Calculate, authorize, execute, report', 'Supporting records retained as required', 'Payment reference links evidence'],
  ['Contract', 'Transaction references (parties, value, dates) as needed', 'Lifecycle, versioning, executed copy, amendments, retention', 'Contract identifier is shared across systems'],
  ['Policy / procedure', 'Reference applicable policy/version', 'Authoring, approval, publication, versions, distribution, retirement, retention', 'ERP stores policy reference only'],
  ['Project / activity documentation', 'Financial, budget, cost, resource data', 'Plans, reports, decisions, meeting records, deliverables, evidence', 'Project/activity ID links records'],
  ['Task and approval', 'Transaction tasks/approvals that change operational/financial state', 'Content/record tasks/approvals that change lifecycle or record status', 'Requests must specify transaction, content, or both'],
  ['Records retention / legal hold', 'Retain transaction data per finance/system requirements', 'Enterprise records controls and legal hold administration', 'Policy alignment subject to approved governance'],
  ['Reporting', 'Financial/operational reporting', 'Content lifecycle/search/workflow/records reporting', 'Cross-platform reports use linked references']
];

const glossary = [
  ['Business transaction', 'A structured action that changes operational or financial state.', 'ERP'],
  ['Content', 'Business information managed through lifecycle controls.', 'ECM'],
  ['Document', 'A content unit (draft or final) with context and metadata.', 'ECM'],
  ['Record', 'Content formally retained as evidence under approved policy.', 'ECM'],
  ['Attachment', 'Supporting file linked to a transaction or content item.', 'ECM (linked to ERP where relevant)'],
  ['System of record', 'Authoritative source that owns write-control for a field/object.', 'Context-specific'],
  ['System of reference', 'Consumer that displays/uses data without owning it.', 'Context-specific'],
  ['Master data', 'Canonical entities such as suppliers, customers, projects.', 'ERP'],
  ['Metadata', 'Descriptive fields used for findability, control, and integration.', 'ECM'],
  ['Workflow', 'Defined sequence of actions and state transitions.', 'ERP or ECM (must be qualified)'],
  ['Approval', 'Formal decision gate with accountable authority.', 'ERP, ECM, or both (must be qualified)'],
  ['Authoritative copy', 'The copy controlled by the owning platform for that object.', 'ERP or ECM by object type'],
  ['Linkage identifier', 'Shared key used to connect transaction context and content.', 'ERP-created, ECM-stored as metadata'],
  ['Retention', 'How long content/data must be preserved under approved policy.', 'ECM for records; ERP for transaction data'],
  ['Disposition', 'Controlled destruction/transfer at end of retention period.', 'ECM (subject to approvals)']
];

const pilotScoring = [
  'Business value',
  'Pain and volume',
  'Risk exposure',
  'Process clarity',
  'Sponsor readiness',
  'Integration complexity',
  'Data quality and migration effort',
  'Delivery window fit',
  'Reusability across units'
];

const successMeasures = [
  ['Findability', 'Time to find the authoritative document'],
  ['Metadata quality', 'Metadata completeness for governed content'],
  ['Duplication control', 'Reduction in duplicate/conflicting versions'],
  ['Workflow speed', 'Approval turnaround time'],
  ['Evidence coverage', 'Percentage of tasks/activities with required evidence'],
  ['Access governance', 'Access exception resolution time'],
  ['Retention quality', 'Valid retention categorization rate'],
  ['Adoption', 'Active usage of governed workspaces'],
  ['User experience', 'Stakeholder satisfaction with search and workflows']
];

export async function mount(el) {
  hydrateGovernance();
  render(el);
}

function render(el) {
  el.innerHTML = `<div class="workspace">
    ${head(CHARTER_TITLE, 'Authoritative scope and governance boundary for ERP and ECM.')}
    <section class="panel">
      <div class="eyebrow panel-eyebrow">Executive decision</div>
      <h2>${esc(CHARTER_TITLE)}</h2>
      <p><b>ERP is the authoritative system for structured operational and financial transactions. ECM is the authoritative system for governed content, documents, records, evidence, and content-centric work.</b></p>
      <p>ERP and ECM are complementary and must integrate through controlled identifiers and references, not duplicate one another.</p>
      <div class="chips" aria-label="Operating stance"><span class="chip">${badge('Complementary')}</span><span class="chip">${badge('Integrated')}</span><span class="chip">${badge('No Duplication', 'warning')}</span></div>
      <p class="meta">All legal, privacy, security, and records controls in this charter are subject to the organization’s approved policies and stakeholder review.</p>
    </section>

    <section class="split" aria-label="Purpose and scope">
      <section class="panel">
        <h2>Purpose and objectives</h2>
        <ul class="journey-list">
          <li>Improve findability and authoritative sources of truth.</li>
          <li>Connect content to activities, decisions, tasks, projects, and transactions.</li>
          <li>Strengthen governance, security, retention, auditability, and compliance.</li>
          <li>Reduce duplicate content, manual routing, unclear ownership, and user friction.</li>
          <li>Enable incremental, measurable delivery through high-value pilots.</li>
        </ul>
      </section>
      <section class="panel">
        <h2>Scope: initial ECM program</h2>
        <h3>In scope</h3>
        <ul class="journey-list">
          <li>Business documents and attachments created during operational work.</li>
          <li>Activity, task, project, and approval documentation.</li>
          <li>Versioning, approval states, metadata, content types, search, role-based access.</li>
          <li>Retention classification and audit requirements.</li>
          <li>Integration between content and task/activity processes.</li>
          <li>One to two high-value business pilots.</li>
        </ul>
        <h3>Out of scope initially</h3>
        <ul class="journey-list">
          <li>Enterprise-wide historic-content migration.</li>
          <li>Redesign of every departmental workflow.</li>
          <li>Replacing all collaboration/CRM/ERP/case-management platforms.</li>
          <li>AI classification before metadata governance is reliable.</li>
          <li>Broad records disposition without approved legal/privacy/security/records review.</li>
          <li>Folder standardization as a substitute for a sound content model.</li>
        </ul>
      </section>
    </section>

    <section class="panel">
      <h2>Definitive ERP vs ECM capability boundary</h2>
      ${table(
        [
          { key: 'domain', label: 'Capability domain' },
          { key: 'erp', label: 'ERP owns' },
          { key: 'ecm', label: 'ECM owns' }
        ],
        boundaryComparison
      )}
      <h3>Detailed ownership matrix</h3>
      ${table(
        [
          { key: 'object', label: 'Business object' },
          { key: 'erp', label: 'ERP ownership' },
          { key: 'ecm', label: 'ECM ownership' },
          { key: 'integration', label: 'Integration rule' }
        ],
        ownershipRows.map(([object, erp, ecm, integration]) => ({ object, erp, ecm, integration }))
      )}
    </section>

    <section class="split">
      <section class="panel">
        <h2>Task, activity, and approval definitions</h2>
        <ul class="journey-list">
          <li><b>ERP task:</b> transactional action that changes operational/financial state.</li>
          <li><b>ECM task:</b> action that changes content lifecycle, status, or record state.</li>
          <li><b>Activity:</b> broader business work that may involve both platforms.</li>
          <li><b>Approval:</b> always qualify as transaction approval, content approval, or both.</li>
        </ul>
        <p><b>Procurement example:</b> ERP owns the purchase order transaction; ECM owns the procurement file and evidence package linked by PO identifier.</p>
      </section>
      <section class="panel">
        <h2>Controlled shared terminology</h2>
        ${table(
          [
            { key: 'term', label: 'Term' },
            { key: 'definition', label: 'Definition' },
            { key: 'owner', label: 'Owning system context' }
          ],
          glossary.map(([term, definition, owner]) => ({ term, definition, owner }))
        )}
        <p class="meta"><b>Requirements and API contracts must not use generic terms like task, workflow, approval, document, or record without the business meaning and owning system.</b></p>
      </section>
    </section>

    <section class="panel">
      <h2>Integration and data-ownership rules</h2>
      <ol class="journey-list">
        <li>ERP creates the transaction/master-data identifier (PO, invoice, vendor, project, contract/case ID as applicable).</li>
        <li>ECM stores and governs associated content, including the linkage identifier as metadata.</li>
        <li>ERP surfaces ECM content by secure link/reference/preview; ECM remains content-lifecycle authority.</li>
        <li>ECM may show selected ERP context read-only by reference; it must not become another ledger.</li>
        <li>Prefer events and references over uncontrolled replication.</li>
        <li>Each field has one write-authoritative source; other systems consume/index/display by controlled sync rules.</li>
      </ol>
      <h3>Procurement and invoice example sequence</h3>
      <ul class="timeline">
        <li><div class="when">Step 1</div><b>ERP creates PO and supplier transaction context.</b><p>PO identifier becomes the integration key.</p></li>
        <li><div class="when">Step 2</div><b>ECM captures contract, quote, and approval evidence.</b><p>ECM stores PO identifier as mandatory metadata.</p></li>
        <li><div class="when">Step 3</div><b>ERP receives and validates invoice.</b><p>ERP stores invoice transaction state and payment readiness.</p></li>
        <li><div class="when">Step 4</div><b>ECM stores invoice image, disputes, and correspondence.</b><p>All supporting evidence remains lifecycle-controlled in ECM.</p></li>
        <li><div class="when">Step 5</div><b>ERP executes payment and reporting.</b><p>ECM retains the auditable evidence package by policy.</p></li>
      </ul>
    </section>

    <section class="split">
      <section class="panel">
        <h2>Non-duplication guardrails: ECM must not replicate</h2>
        <ul class="journey-list">
          <li>Ledger entries, payment execution, tax/accounting calculations.</li>
          <li>Procurement transaction processing and inventory operations.</li>
          <li>Master-data maintenance and financial-close controls.</li>
          <li>Binding financial approvals owned by ERP.</li>
        </ul>
      </section>
      <section class="panel">
        <h2>Non-duplication guardrails: ERP must not replicate</h2>
        <ul class="journey-list">
          <li>Full document version history and controlled authoring/publishing.</li>
          <li>Taxonomy/content metadata and legal hold/records schedules.</li>
          <li>Enterprise content search and document collaboration spaces.</li>
          <li>Long-term evidence packages, policy/procedure control, content disposition.</li>
        </ul>
      </section>
    </section>

    <section class="panel">
      <h2>Governance and operating model</h2>
      <p><b>Establish an ERP–ECM Architecture Working Group.</b></p>
      <p>Representation: ERP and ECM product owners, enterprise architecture, security, information/data governance, records/legal, integration architecture, business process owners, development, QA.</p>
      <h3>Responsibilities</h3>
      <ul class="journey-list">
        <li>Maintain the ownership matrix and shared glossary.</li>
        <li>Approve cross-platform changes and prevent duplicate functionality.</li>
        <li>Set integration patterns and authoritative identifiers.</li>
        <li>Resolve conflicts and assess privacy/security/retention/audit impacts.</li>
        <li>Prioritize the joint roadmap and pilot expansion.</li>
      </ul>
    </section>

    <section class="panel">
      <h2>Initial implementation plan and 90-day sequencing</h2>
      <ul class="timeline">
        <li><div class="when">Days 1–30</div><b>Discovery and decision rights</b><p>Map stakeholders, inventory high-value content flows, assess current state and evidence-backed pain points.</p></li>
        <li><div class="when">Days 31–60</div><b>Target operating model</b><p>Define content types, minimum metadata, lifecycle/access/retention principles, and pilot scoring.</p></li>
        <li><div class="when">Days 61–90</div><b>Pilot delivery</b><p>Configure 1–2 pilots, establish repository/workflow/integration links, migrate active high-value content, train users, measure and refine.</p></li>
      </ul>
      <h3>Pilot scoring factors</h3>
      <div class="chips" aria-label="Pilot scoring factors">${pilotScoring.map(item => `<span class="chip">${esc(item)}</span>`).join('')}</div>
    </section>

    <section class="split">
      <section class="panel">
        <h2>Measures and immediate artifacts</h2>
        ${table(
          [
            { key: 'outcome', label: 'Success outcome' },
            { key: 'measure', label: 'Measure' }
          ],
          successMeasures.map(([outcome, measure]) => ({ outcome, measure }))
        )}
        <h3>Immediate artifacts</h3>
        <ol class="journey-list">
          <li>Scope and Capability Boundary Charter</li>
          <li>Business Object Ownership Matrix</li>
          <li>Shared Terminology Glossary</li>
          <li>Integration Context Diagram</li>
          <li>Cross-Platform Requirements Template</li>
        </ol>
      </section>
      <section class="panel">
        <h2>Decision checklist for feature requests</h2>
        <ul class="journey-list">
          <li>What is the primary object (transaction or content/record)?</li>
          <li>Does it change operational/financial state?</li>
          <li>Does it require content lifecycle control?</li>
          <li>Which platform owns the authoritative audit trail?</li>
          <li>Does the other platform need linkage or status visibility?</li>
          <li>Does an existing capability already satisfy this need?</li>
          <li>What is the duplication risk?</li>
          <li>What is the most natural user context for completion?</li>
        </ul>
      </section>
    </section>

    <section class="panel">
      <h2>Concluding operating rule</h2>
      <p><b>If the primary value is executing, calculating, accounting for, or reporting a structured transaction, it belongs in ERP. If the primary value is managing a document, evidence package, knowledge asset, or record through its lifecycle, it belongs in ECM.</b></p>
    </section>
  </div>`;
}
