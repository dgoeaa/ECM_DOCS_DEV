// Seed dataset for the local development backend.
//
// Field names here are the SharePoint-shaped ones core/domain.js reads (Title, RefIDD,
// AssignedToDSU, DSU_KEY …), not the normalised ones. That is deliberate: the dev server
// answers in the same shape the real flows do, so a module that works against this works
// against Power Automate without a second code path.
//
// Dates are day-offsets from start-up, materialised at install time, so a store created
// today never looks stale.

import fs from 'node:fs';
import vm from 'node:vm';

const DAY = 86_400_000;
const at = days => new Date(Date.now() - days * DAY).toISOString();

export const DEPARTMENTS = [
  { ID: 1, Title: 'Office of the Director-General', DSU_KEY: 'ODG', DSU_Email: 'odg@nitda.gov.ng', DSU_HeadEmail: 'dg@nitda.gov.ng', DSU_HeadTitle: 'Director-General' },
  { ID: 2, Title: 'Registry', DSU_KEY: 'REG', DSU_Email: 'registry@nitda.gov.ng', DSU_HeadEmail: 'head.registry@nitda.gov.ng', DSU_HeadTitle: 'Head, Registry' },
  { ID: 3, Title: 'Standards, Guidelines & Regulation', DSU_KEY: 'SGR', DSU_Email: 'sgr@nitda.gov.ng', DSU_HeadEmail: 'director.sgr@nitda.gov.ng', DSU_HeadTitle: 'Director, SGR' },
  { ID: 4, Title: 'Digital Economy & Compliance', DSU_KEY: 'DEC', DSU_Email: 'dec@nitda.gov.ng', DSU_HeadEmail: 'director.dec@nitda.gov.ng', DSU_HeadTitle: 'Director, DEC' },
  { ID: 5, Title: 'Corporate Planning & Partnerships', DSU_KEY: 'CPP', DSU_Email: 'cpp@nitda.gov.ng', DSU_HeadEmail: 'director.cpp@nitda.gov.ng', DSU_HeadTitle: 'Director, CPP' },
  { ID: 6, Title: 'Policy & Strategy', DSU_KEY: 'PST', DSU_Email: 'policy@nitda.gov.ng', DSU_HeadEmail: 'director.policy@nitda.gov.ng', DSU_HeadTitle: 'Director, Policy' },
  { ID: 7, Title: 'Digital Literacy & Capacity Development', DSU_KEY: 'DLC', DSU_Email: 'dlcd@nitda.gov.ng', DSU_HeadEmail: 'director.dlcd@nitda.gov.ng', DSU_HeadTitle: 'Director, DLCD' },
  { ID: 8, Title: 'Legal Services', DSU_KEY: 'LEG', DSU_Email: 'legal@nitda.gov.ng', DSU_HeadEmail: 'head.legal@nitda.gov.ng', DSU_HeadTitle: 'Head, Legal' },
];

export const CATEGORIES = [
  { ID: 1, Title: 'General Correspondence', Category: 'General Correspondence', Subcategory: 'Official Letter', 'Category Code': 'GC', 'SubCategory Code': 'OL', DSU_KEY: 'REG', 'Default Primary Responsible': 'Registry', 'Default Supporting Department/Unit': 'Office of the Director-General', INFORMDSU1: 'Office of the Director-General', Priority: 'Medium', Timeline: '5' },
  { ID: 2, Title: 'Application', Category: 'Application', Subcategory: 'Clearance', 'Category Code': 'AP', 'SubCategory Code': 'CL', DSU_KEY: 'SGR', 'Default Primary Responsible': 'Standards, Guidelines & Regulation', 'Default Supporting Department/Unit': 'Legal Services', INFORMDSU1: 'Registry', Priority: 'High', Timeline: '14' },
  { ID: 3, Title: 'Application', Category: 'Application', Subcategory: 'Accreditation', 'Category Code': 'AP', 'SubCategory Code': 'AC', DSU_KEY: 'SGR', 'Default Primary Responsible': 'Standards, Guidelines & Regulation', 'Default Supporting Department/Unit': 'Digital Literacy & Capacity Development', Priority: 'Medium', Timeline: '21' },
  { ID: 4, Title: 'Proposal', Category: 'Proposal', Subcategory: 'Expression of Interest', 'Category Code': 'PR', 'SubCategory Code': 'EOI', DSU_KEY: 'CPP', 'Default Primary Responsible': 'Corporate Planning & Partnerships', 'Default Supporting Department/Unit': 'Policy & Strategy', Priority: 'Medium', Timeline: '21' },
  { ID: 5, Title: 'Report', Category: 'Report', Subcategory: 'Periodic Return', 'Category Code': 'RP', 'SubCategory Code': 'PRN', DSU_KEY: 'CPP', 'Default Primary Responsible': 'Corporate Planning & Partnerships', 'Default Supporting Department/Unit': 'Registry', Priority: 'Low', Timeline: '10' },
  { ID: 6, Title: 'Compliance Filing', Category: 'Compliance Filing', Subcategory: 'Data Protection Audit', 'Category Code': 'CF', 'SubCategory Code': 'DPA', DSU_KEY: 'DEC', 'Default Primary Responsible': 'Digital Economy & Compliance', 'Default Supporting Department/Unit': 'Legal Services', INFORMDSU1: 'Registry', Priority: 'High', Timeline: '14' },
  { ID: 7, Title: 'Policy Submission', Category: 'Policy Submission', Subcategory: 'Draft Instrument', 'Category Code': 'PS', 'SubCategory Code': 'DI', DSU_KEY: 'PST', 'Default Primary Responsible': 'Policy & Strategy', 'Default Supporting Department/Unit': 'Legal Services', Priority: 'High', Timeline: '30' },
  { ID: 8, Title: 'Event Invitation', Category: 'Event Invitation', Subcategory: 'Representation Request', 'Category Code': 'EI', 'SubCategory Code': 'RR', DSU_KEY: 'ODG', 'Default Primary Responsible': 'Office of the Director-General', 'Default Supporting Department/Unit': 'Corporate Planning & Partnerships', Priority: 'Medium', Timeline: '3' },
];

export const USERS = [
  { id: 'u-registry', Title: 'Registry Desk', email: 'dgsregistry@nitda.gov.ng', Department: 'Registry', JobTitle: 'Registry Officer', role: 'systemAdmin', status: 'active' },
  { id: 'u-abello', Title: 'A. Bello', email: 'a.bello@nitda.gov.ng', Department: 'Standards, Guidelines & Regulation', JobTitle: 'Principal Officer', role: 'operator', status: 'active' },
  { id: 'u-cokonkwo', Title: 'C. Okonkwo', email: 'c.okonkwo@nitda.gov.ng', Department: 'Digital Economy & Compliance', JobTitle: 'Compliance Officer', role: 'operator', status: 'active' },
  { id: 'u-fdanjuma', Title: 'F. Danjuma', email: 'f.danjuma@nitda.gov.ng', Department: 'Policy & Strategy', JobTitle: 'Policy Analyst', role: 'operator', status: 'active' },
  { id: 'u-hyusuf', Title: 'H. Yusuf', email: 'h.yusuf@nitda.gov.ng', Department: 'Corporate Planning & Partnerships', JobTitle: 'Partnerships Officer', role: 'operator', status: 'active' },
  { id: 'u-madeyemi', Title: 'M. Adeyemi', email: 'm.adeyemi@nitda.gov.ng', Department: 'Standards, Guidelines & Regulation', JobTitle: 'Senior Technical Officer', role: 'operator', status: 'active' },
  { id: 'u-teze', Title: 'T. Eze', email: 't.eze@nitda.gov.ng', Department: 'Digital Literacy & Capacity Development', JobTitle: 'Programme Officer', role: 'operator', status: 'active' },
  { id: 'u-director', Title: 'Director, SGR', email: 'director.sgr@nitda.gov.ng', Department: 'Standards, Guidelines & Regulation', JobTitle: 'Director', role: 'director', status: 'active' },
  { id: 'u-dg', Title: 'Director-General', email: 'dg@nitda.gov.ng', Department: 'Office of the Director-General', JobTitle: 'Director-General', role: 'executive', status: 'active' },
  { id: 'u-audit', Title: 'Internal Audit', email: 'audit@nitda.gov.ng', Department: 'Office of the Director-General', JobTitle: 'Auditor', role: 'viewer', status: 'active' },
];

/* Registry correspondence. `RefIDD` is the reference the whole platform keys on. */
export const ACTIVITIES = [
  { ID: 101, Title: 'Clearance for national health records platform', RefIDD: 'NITDA/REG/2026/0101', Category: 'Application', Status: 'Treated', AssignmentStatus: 'Assigned', AssignedTo: 'm.adeyemi@nitda.gov.ng', RoutedToDSU: 'Standards, Guidelines & Regulation', Created: at(21), Description: 'Request from the Federal Ministry of Health for clearance of the national health records platform. Architecture documentation and approved budget line attached.', AttachmentLink: 'https://example.invalid/dev/NHR-Platform-Proposal.pdf' },
  { ID: 102, Title: 'Annual data protection audit filing 2025', RefIDD: 'NITDA/REG/2026/0102', Category: 'Compliance Filing', Status: 'Pending', AssignmentStatus: 'Assigned', AssignedTo: 'c.okonkwo@nitda.gov.ng', RoutedToDSU: 'Digital Economy & Compliance', Created: at(9), Description: 'Sterling Data Systems Ltd annual audit filing. Sub-processor register and hosting-location evidence outstanding.', AttachmentLink: 'https://example.invalid/dev/DPCO-Audit-Report-2025.pdf' },
  { ID: 103, Title: 'Kaduna State digital economy strategy 2026-2030', RefIDD: 'NITDA/REG/2026/0103', Category: 'Policy Submission', Status: 'In Progress', AssignmentStatus: 'Assigned', AssignedTo: 'f.danjuma@nitda.gov.ng', RoutedToDSU: 'Policy & Strategy', Created: at(5), Description: 'Draft state strategy submitted for alignment review against the National Digital Economy Policy.', AttachmentLink: 'https://example.invalid/dev/KDSG-Digital-Strategy.pdf' },
  { ID: 104, Title: 'Accreditation of IT training programme', RefIDD: 'NITDA/REG/2026/0104', Category: 'Application', Status: 'In Progress', AssignmentStatus: 'Assigned', AssignedTo: 'a.bello@nitda.gov.ng', RoutedToDSU: 'Standards, Guidelines & Regulation', Created: at(12), Description: 'Cedarwood Institute of Technology seeks accreditation of its IT training programme. Facility capacity review scheduled.' },
  { ID: 105, Title: 'Startup Act labelling verification', RefIDD: 'NITDA/REG/2026/0105', Category: 'Application', Status: 'Treated', AssignmentStatus: 'Assigned', AssignedTo: 't.eze@nitda.gov.ng', RoutedToDSU: 'Digital Literacy & Capacity Development', Created: at(16), Description: 'Paylink Africa labelling verification under the Startup Act. Label reference SUA/LB/2025/1187 issued.' },
  { ID: 106, Title: 'Unsolicited proposal - rural connectivity pilot', RefIDD: 'NITDA/REG/2026/0106', Category: 'Proposal', Status: 'Declined', AssignmentStatus: 'Assigned', AssignedTo: 'h.yusuf@nitda.gov.ng', RoutedToDSU: 'Corporate Planning & Partnerships', Created: at(27), Description: 'Novatek Consulting rural connectivity concept. Scope overlaps an existing National Broadband Plan intervention.' },
  { ID: 107, Title: 'Q3 infrastructure utilisation report', RefIDD: 'NITDA/REG/2026/0107', Category: 'Report', Status: 'Not Treated', AssignmentStatus: 'Not Assigned', AssignedTo: '', RoutedToDSU: 'Corporate Planning & Partnerships', Created: at(2), Description: 'Galaxy Backbone Ltd quarterly utilisation return. Awaiting registry validation.' },
  { ID: 108, Title: 'Draft state cloud adoption policy', RefIDD: 'NITDA/REG/2026/0108', Category: 'Policy Submission', Status: 'In Progress', AssignmentStatus: 'Assigned', AssignedTo: 'f.danjuma@nitda.gov.ng', RoutedToDSU: 'Policy & Strategy', Created: at(8), Description: 'Ogun State Ministry of Science & Technology draft cloud adoption policy, version 3.' },
  { ID: 109, Title: 'Clearance for tax administration upgrade', RefIDD: 'NITDA/REG/2026/0109', Category: 'Application', Status: 'Pending', AssignmentStatus: 'Assigned', AssignedTo: 'm.adeyemi@nitda.gov.ng', RoutedToDSU: 'Standards, Guidelines & Regulation', Created: at(14), Description: 'Federal Inland Revenue Service tax administration upgrade. Signed technical specification and budget line reference requested.' },
  { ID: 110, Title: 'Request for digital literacy partnership briefing', RefIDD: 'NITDA/REG/2026/0110', Category: 'General Correspondence', Status: 'Treated', AssignmentStatus: 'Assigned', AssignedTo: 't.eze@nitda.gov.ng', RoutedToDSU: 'Corporate Planning & Partnerships', Created: at(6), Description: 'Bright Minds Foundation request for a partnership briefing. Briefing scheduled and confirmed.' },
  { ID: 111, Title: 'Data protection audit filing 2025 - Meridian HMO', RefIDD: 'NITDA/REG/2026/0111', Category: 'Compliance Filing', Status: 'Not Treated', AssignmentStatus: 'Not Assigned', AssignedTo: '', RoutedToDSU: 'Digital Economy & Compliance', Created: at(1), Description: 'Meridian Health HMO audit summary received. Not yet validated.' },
  { ID: 112, Title: 'Invitation - West Africa digital governance forum', RefIDD: 'NITDA/REG/2026/0112', Category: 'Event Invitation', Status: 'Pending', AssignmentStatus: 'Assigned', AssignedTo: 'dg@nitda.gov.ng', RoutedToDSU: 'Office of the Director-General', Created: at(3), Description: 'Invitation to the Director-General to open the West Africa digital governance forum. Representation decision required.' },
  { ID: 113, Title: 'EdTech strategy alignment review', RefIDD: 'NITDA/REG/2026/0113', Category: 'Policy Submission', Status: 'Treated', AssignmentStatus: 'Assigned', AssignedTo: 'f.danjuma@nitda.gov.ng', RoutedToDSU: 'Policy & Strategy', Created: at(41), Description: 'Federal Ministry of Education EdTech strategy. Alignment confirmed and communicated.' },
  { ID: 114, Title: 'Expression of interest - data centre colocation', RefIDD: 'NITDA/REG/2026/0114', Category: 'Proposal', Status: 'In Progress', AssignmentStatus: 'Assigned', AssignedTo: 'h.yusuf@nitda.gov.ng', RoutedToDSU: 'Corporate Planning & Partnerships', Created: at(4), Description: 'Zenith Cloud Nigeria expression of interest for data centre colocation. Under commercial and technical review.' },
  { ID: 115, Title: 'Digital skills programme completion report', RefIDD: 'NITDA/REG/2026/0115', Category: 'Report', Status: 'Treated', AssignmentStatus: 'Assigned', AssignedTo: 't.eze@nitda.gov.ng', RoutedToDSU: 'Digital Literacy & Capacity Development', Created: at(11), Description: 'Nasarawa State ICT Bureau programme completion report. Outcomes verified and filed.' },
  { ID: 116, Title: 'Request for research data-sharing guidance', RefIDD: 'NITDA/REG/2026/0116', Category: 'General Correspondence', Status: 'Not Treated', AssignmentStatus: 'Not Assigned', AssignedTo: '', RoutedToDSU: 'Registry', Created: at(0), Description: 'University of Ibadan enquiry on research data-sharing guidance under the NDPA.' },
];

/* Tasks raised against the correspondence above. */
export const TRACKING = [
  { ID: 201, Title: 'Assess platform architecture against Cloud First policy', RefIDD: 'NITDA/REG/2026/0101', AssignedTo: 'm.adeyemi@nitda.gov.ng', AssignedToDSU: 'Standards, Guidelines & Regulation', CoAssigneeDSU: 'Legal Services', Priority: 'High', Status: 'Completed', Progress: 'Completed', Created: at(20), StartDate: at(20), DueDate: at(-1), Classification: 'Technical review', Description: 'Confirm the proposed architecture meets the NGN Cloud First policy before clearance is issued.', AcknowledgementDue: at(19) },
  { ID: 202, Title: 'Request sub-processor register and hosting evidence', RefIDD: 'NITDA/REG/2026/0102', AssignedTo: 'c.okonkwo@nitda.gov.ng', AssignedToDSU: 'Digital Economy & Compliance', Priority: 'High', Status: 'In Progress', Progress: 'In Progress', Created: at(5), StartDate: at(5), DueDate: at(-4), Classification: 'Compliance', Description: 'Write to Sterling Data Systems for the sub-processor register and evidence of data-hosting location.' },
  { ID: 203, Title: 'Alignment review against National Digital Economy Policy', RefIDD: 'NITDA/REG/2026/0103', AssignedTo: 'f.danjuma@nitda.gov.ng', AssignedToDSU: 'Policy & Strategy', CoAssigneeDSU: 'Legal Services', Priority: 'High', Status: 'In Progress', Progress: 'In Progress', Created: at(4), StartDate: at(4), DueDate: at(-10), Classification: 'Policy review', Description: 'Assess the Kaduna State strategy for alignment and report exceptions.' },
  { ID: 204, Title: 'Schedule facility capacity review', RefIDD: 'NITDA/REG/2026/0104', AssignedTo: 'a.bello@nitda.gov.ng', AssignedToDSU: 'Standards, Guidelines & Regulation', Priority: 'Medium', Status: 'Assigned', Progress: 'Not Started', Created: at(6), StartDate: at(6), DueDate: at(-8), Classification: 'Accreditation', Description: 'Arrange and conduct the on-site facility capacity review at Cedarwood Institute.' },
  { ID: 205, Title: 'Verify Startup Act eligibility', RefIDD: 'NITDA/REG/2026/0105', AssignedTo: 't.eze@nitda.gov.ng', AssignedToDSU: 'Digital Literacy & Capacity Development', Priority: 'Medium', Status: 'Completed', Progress: 'Completed', Created: at(12), StartDate: at(12), DueDate: at(4), Classification: 'Verification', Description: 'Assess eligibility against the Startup Act and issue the label reference.' },
  { ID: 206, Title: 'Commercial and technical review of colocation EOI', RefIDD: 'NITDA/REG/2026/0114', AssignedTo: 'h.yusuf@nitda.gov.ng', AssignedToDSU: 'Corporate Planning & Partnerships', CoAssigneeDSU: 'Policy & Strategy', Priority: 'Medium', Status: 'Assigned', Progress: 'Not Started', Created: at(1), StartDate: at(1), DueDate: at(-13), Classification: 'Partnership', Description: 'Assess the Zenith Cloud colocation proposal on commercial and technical grounds.' },
  { ID: 207, Title: 'Validate Q3 utilisation return', RefIDD: 'NITDA/REG/2026/0107', AssignedTo: '', AssignedToDSU: 'Corporate Planning & Partnerships', Priority: 'Low', Status: 'Pending', Progress: 'Not Started', Created: at(2), StartDate: at(2), DueDate: at(-8), Classification: 'Registry validation', Description: 'Check the Galaxy Backbone return for completeness before routing.' },
  { ID: 208, Title: 'Prepare representation recommendation for the DG', RefIDD: 'NITDA/REG/2026/0112', AssignedTo: 'h.yusuf@nitda.gov.ng', AssignedToDSU: 'Corporate Planning & Partnerships', Priority: 'High', Status: 'Assigned', Progress: 'Not Started', Created: at(3), StartDate: at(3), DueDate: at(-2), Classification: 'Briefing', Description: 'Recommend whether the Director-General attends or nominates a representative.' },
  { ID: 209, Title: 'Draft clarification letter to FIRS', RefIDD: 'NITDA/REG/2026/0109', AssignedTo: 'm.adeyemi@nitda.gov.ng', AssignedToDSU: 'Standards, Guidelines & Regulation', Priority: 'High', Status: 'In Progress', Progress: 'In Progress', Created: at(4), StartDate: at(4), DueDate: at(-3), Classification: 'Correspondence', Description: 'Request the signed technical specification and the approved budget line reference.' },
  { ID: 210, Title: 'File EdTech alignment outcome', RefIDD: 'NITDA/REG/2026/0113', AssignedTo: 'f.danjuma@nitda.gov.ng', AssignedToDSU: 'Policy & Strategy', Priority: 'Low', Status: 'Completed', Progress: 'Completed', Created: at(30), StartDate: at(30), DueDate: at(22), Classification: 'Records', Description: 'Record the alignment outcome and close the file.' },
  { ID: 211, Title: 'Classify research data-sharing enquiry', RefIDD: 'NITDA/REG/2026/0116', AssignedTo: '', AssignedToDSU: 'Registry', Priority: 'Medium', Status: 'Pending', Progress: 'Not Started', Created: at(0), StartDate: at(0), DueDate: at(-5), Classification: 'Registry validation', Description: 'Assign the University of Ibadan enquiry to the responsible unit.' },
  { ID: 212, Title: 'Validate Meridian HMO audit summary', RefIDD: 'NITDA/REG/2026/0111', AssignedTo: '', AssignedToDSU: 'Digital Economy & Compliance', Priority: 'Medium', Status: 'Pending', Progress: 'Not Started', Created: at(1), StartDate: at(1), DueDate: at(-6), Classification: 'Compliance', Description: 'Check the filing for completeness against the DPA reporting template.' },
];

export const COMMENTS = [
  { ID: 301, RefIDD: 'NITDA/REG/2026/0101', Title: 'NITDA/REG/2026/0101', Description: 'Architecture meets the NGN Cloud First policy. Recommending clearance.', AuthorTitle: 'M. Adeyemi', EditorEmail: 'm.adeyemi@nitda.gov.ng', Created: at(8) },
  { ID: 302, RefIDD: 'NITDA/REG/2026/0102', Title: 'NITDA/REG/2026/0102', Description: 'Sub-processor register still outstanding. Chased by email on the 2nd.', AuthorTitle: 'C. Okonkwo', EditorEmail: 'c.okonkwo@nitda.gov.ng', Created: at(2) },
  { ID: 303, RefIDD: 'NITDA/REG/2026/0103', Title: 'NITDA/REG/2026/0103', Description: 'Section 4 conflicts with the federal data residency guideline. Raising with Legal.', AuthorTitle: 'F. Danjuma', EditorEmail: 'f.danjuma@nitda.gov.ng', Created: at(2) },
  { ID: 304, RefIDD: 'NITDA/REG/2026/0106', Title: 'NITDA/REG/2026/0106', Description: 'Declined. Overlaps the National Broadband Plan intervention in Rivers State.', AuthorTitle: 'H. Yusuf', EditorEmail: 'h.yusuf@nitda.gov.ng', Created: at(11) },
  { ID: 305, RefIDD: 'NITDA/REG/2026/0109', Title: 'NITDA/REG/2026/0109', Description: 'FIRS confirmed the budget line exists; awaiting the signed specification.', AuthorTitle: 'M. Adeyemi', EditorEmail: 'm.adeyemi@nitda.gov.ng', Created: at(1) },
  { ID: 306, RefIDD: 'NITDA/REG/2026/0114', Title: 'NITDA/REG/2026/0114', Description: 'Requested the tier certification for the Lagos facility before review continues.', AuthorTitle: 'H. Yusuf', EditorEmail: 'h.yusuf@nitda.gov.ng', Created: at(0) },
];

export const APPROVALS = [
  { id: 'AP-001', referenceId: 'NITDA/REG/2026/0101', title: 'Issue clearance certificate ITC/2026/0418', requestedBy: 'm.adeyemi@nitda.gov.ng', approver: 'director.sgr@nitda.gov.ng', status: 'Approved', stage: 'Director', decidedAt: at(3), createdAt: at(6), notes: 'Cleared subject to annual re-attestation.' },
  { id: 'AP-002', referenceId: 'NITDA/REG/2026/0103', title: 'Endorse Kaduna State strategy alignment finding', requestedBy: 'f.danjuma@nitda.gov.ng', approver: 'dg@nitda.gov.ng', status: 'Pending', stage: 'Director-General', decidedAt: '', createdAt: at(2), notes: '' },
  { id: 'AP-003', referenceId: 'NITDA/REG/2026/0105', title: 'Confirm Startup Act label SUA/LB/2026/1187', requestedBy: 't.eze@nitda.gov.ng', approver: 'director.sgr@nitda.gov.ng', status: 'Approved', stage: 'Director', decidedAt: at(4), createdAt: at(7), notes: '' },
  { id: 'AP-004', referenceId: 'NITDA/REG/2026/0112', title: 'Approve representation at the governance forum', requestedBy: 'h.yusuf@nitda.gov.ng', approver: 'dg@nitda.gov.ng', status: 'Pending', stage: 'Director-General', decidedAt: '', createdAt: at(1), notes: '' },
  { id: 'AP-005', referenceId: 'NITDA/REG/2026/0106', title: 'Sign decline letter to Novatek Consulting', requestedBy: 'h.yusuf@nitda.gov.ng', approver: 'director.cpp@nitda.gov.ng', status: 'Rejected', stage: 'Director', decidedAt: at(10), createdAt: at(13), notes: 'Reword paragraph 3 to invite resubmission in the next cycle.' },
];

export const EMAILS = [
  { id: 'EM-001', internetMessageId: 'EM-001', subject: 'Sub-processor register - Sterling Data Systems', fromAddress: 'a.smith@sterlingdata.ng', fromName: 'Amaka Smith', receivedDateTime: at(1), bodyPreview: 'Please find attached the sub-processor register requested on the 2nd.', bodyContent: 'Please find attached the sub-processor register requested on the 2nd, together with the hosting-location attestation from our infrastructure provider.', bodyContentType: 'text', toRecipients: ['c.okonkwo@nitda.gov.ng'], ccRecipients: ['dgsregistry@nitda.gov.ng'], hasAttachments: true, importance: 'high', conversationId: 'CV-102' },
  { id: 'EM-002', internetMessageId: 'EM-002', subject: 'Re: Clearance for tax administration upgrade', fromAddress: 'e.nwosu@firs.gov.ng', fromName: 'Emeka Nwosu', receivedDateTime: at(2), bodyPreview: 'The approved budget line is FIRS/CAP/2026/114.', bodyContent: 'The approved budget line is FIRS/CAP/2026/114. The signed technical specification is with our Director of ICT and will follow this week.', bodyContentType: 'text', toRecipients: ['m.adeyemi@nitda.gov.ng'], hasAttachments: false, importance: 'normal', conversationId: 'CV-109' },
  { id: 'EM-003', internetMessageId: 'EM-003', subject: 'Invitation - West Africa digital governance forum', fromAddress: 'secretariat@wadgf.org', fromName: 'WADGF Secretariat', receivedDateTime: at(3), bodyPreview: 'We would be honoured to have the Director-General open the forum.', bodyContent: 'We would be honoured to have the Director-General open the forum on the 18th. A draft programme is attached for consideration.', bodyContentType: 'text', toRecipients: ['dg@nitda.gov.ng'], ccRecipients: ['odg@nitda.gov.ng'], hasAttachments: true, importance: 'normal', conversationId: 'CV-112' },
  { id: 'EM-004', internetMessageId: 'EM-004', subject: 'Tier certification - Lagos facility', fromAddress: 'c.anyanwu@zenithcloud.ng', fromName: 'Chidi Anyanwu', receivedDateTime: at(0), bodyPreview: 'Attaching the Uptime Institute certificate for the Lagos site.', bodyContent: 'Attaching the Uptime Institute certificate for the Lagos site as requested during the technical review.', bodyContentType: 'text', toRecipients: ['h.yusuf@nitda.gov.ng'], hasAttachments: true, importance: 'normal', conversationId: 'CV-114' },
  { id: 'EM-005', internetMessageId: 'EM-005', subject: 'Research data-sharing guidance', fromAddress: 'a.eze@ui.edu.ng', fromName: 'Adaobi Eze', receivedDateTime: at(0), bodyPreview: 'Seeking guidance on sharing anonymised research datasets under the NDPA.', bodyContent: 'Seeking guidance on sharing anonymised research datasets with partner institutions under the NDPA, particularly on the lawful basis to record.', bodyContentType: 'text', toRecipients: ['dgsregistry@nitda.gov.ng'], hasAttachments: false, importance: 'normal', conversationId: 'CV-116' },
];

/**
 * The document portal's demonstration records, as intake submissions.
 *
 * Read out of the portal's own `js/data.js` rather than transcribed, because two hand-kept
 * copies of the same sixteen records drift and the drift is invisible until the tracking
 * page denies a reference it displays on its own home screen.
 *
 * Why they need to be here at all: the portal installs these into localStorage, but once a
 * backend is configured the tracking page asks the REGISTRY, and it treats a 404 as
 * authoritative — deliberately, so device data is never dressed up as a registry answer.
 * A registry that has never heard of them therefore makes every shipped demonstration
 * record untrackable. Seeding them is what makes the two agree.
 */
function portalSeedSubmissions() {
  let PF;
  try {
    const src = fs.readFileSync(new URL('../../document-portal/js/data.js', import.meta.url), 'utf8');
    const ctx = vm.createContext({});
    ctx.window = ctx;
    vm.runInContext(src, ctx);
    PF = ctx.PF;
    if (!Array.isArray(PF?.SEEDS)) return [];
  } catch {
    // The portal is optional; a registry without its demo records still works.
    return [];
  }

  const categoryOf = Object.fromEntries((PF.CORRESPONDENCE_TYPES || []).map(t => [t.key, t.category]));

  const list = PF.SEEDS.map(s => {
    const receivedAt = at(s.days);
    const events = (s.events || []).map(e => ({
      at: at(e.d),
      status: e.s,
      note: e.a || '',
      // The portal's own timeline is what a submitter is shown, so it is public. `n` is the
      // internal note; it stays out, matching the contract's rule that anything unmarked is
      // withheld.
      public: true,
    }));
    return {
      referenceId: s.id,
      status: s.status,
      receivedAt,
      updatedAt: events.length ? events[events.length - 1].at : receivedAt,
      timeline: events,
      record: {
        title: s.title,
        name: s.name,
        email: String(s.email || '').toLowerCase(),
        organisation: s.org || '',
        orgType: s.orgType || '',
        state: s.state || '',
        phone: '',
        description: '',
        category: categoryOf[s.type] || 'General Correspondence',
        type: s.type,
        priority: s.priority === 'expedited' ? 'expedited' : 'standard',
        files: (s.files || []).map(f => ({ name: f.name, size: f.size || 0, sha256: '' })),
        channel: 'Document Portal',
        correspondenceType: 'Inbound',
      },
    };
  });

  /* Back into this realm.
   *
   * `PF.SEEDS` is an Array built inside the vm context, so everything derived from it —
   * including the result of `.map()` — carries that context's Array.prototype. Such a value
   * behaves normally until something compares prototypes, at which point an empty array
   * fails a deepStrictEqual against an empty array and the reason is invisible at the call
   * site. The round-trip is what makes these ordinary objects again. */
  return JSON.parse(JSON.stringify(list));
}

/** The dataset a fresh store starts from. */
export function freshStore() {
  return {
    createdAt: new Date().toISOString(),
    activities: structuredClone(ACTIVITIES),
    tracking: structuredClone(TRACKING),
    comments: structuredClone(COMMENTS),
    users: structuredClone(USERS),
    categories: structuredClone(CATEGORIES),
    departments: structuredClone(DEPARTMENTS),
    emails: structuredClone(EMAILS),
    approvals: structuredClone(APPROVALS),
    /* Written by the portal's anonymous intake and read back by /intake/status. Starts
       holding the portal's own demonstration records so they are trackable from a fresh
       install — see portalSeedSubmissions() for why that is not optional. */
    submissions: portalSeedSubmissions(),
    supportCases: [],
    /* Bytes accepted by /intake/upload and /documents/scan, kept as metadata only. */
    attachments: [],
    /* Anything the app dispatches: emails, governed actions, OTP challenges. */
    outbox: [],
    auditLog: [],
    /* Registry sequence for minted references. Starts above the seeded block. */
    nextReference: 117,
  };
}
