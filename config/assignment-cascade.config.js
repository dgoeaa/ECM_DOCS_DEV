export const AssignmentCascadeConfig = Object.freeze({
  schema: 'dgo-assignment-cascade/v1',
  storageKey: 'DGO_R11_6_ASSIGNMENT_DRAFTS_V1',
  maxRecentDrafts: 50,
  defaultAckDays: 2,
  defaultDueDays: 5,
  dueByPriority: Object.freeze({ low: 10, normal: 5, high: 3, urgent: 1 }),
  categoryFieldAliases: Object.freeze({
    category: ['category','Category','Title','title','CATEGORY'],
    categoryCode: ['categoryCode','CategoryCode','Category Code','Code','CODE','CatCode'],
    subcategory: ['subcategory','Subcategory','SubCategory','Sub Category','SUBCATEGORY'],
    subcategoryCode: ['subcategoryCode','SubcategoryCode','SubCategoryCode','SubCategory Code','SubCode','SUBCODE'],
    dsuKey: ['dsuKey','DSU_KEY','DefaultPrimaryResponsible','Default Primary Responsible','primaryResponsible','ResponsibleDSU','DSU'],
    supportDsuKey: ['supportDsuKey','SupportDSU','SupportDsu','DefaultSupportResponsible','Default Supporting Department/Unit','SupportingDSU'],
    infoDsu: ['infoDsu','InformDSU','INFORMDSU1','INFORMDSU2','INFORMDSU3','InformDSU1','InformDSU2','InformDSU3'],
    assignedTo: ['assignedTo','AssignedTo','AssignedToEmail','DSU_HeadEmail','HeadEmail','DefaultAssignee','OwnerEmail'],
    supportingAssignee: ['supportingAssignee','SupportingAssignee','SupportAssignedTo','SupportAssignedToEmail','DefaultSupportAssignee'],
    copyTo: ['copyTo','CopyToList','CopyTo','CC','Cc','ccRecipients'],
    priority: ['priority','Priority','DefaultPriority'],
    ackDays: ['ackDays','AckDays','AcknowledgementDays','AckDueDays'],
    dueDays: ['dueDays','DueDays','TaskDueDays','SlaDays'],
    instruction: ['instruction','Instruction','DefaultInstruction','Comments','commentTemplate']
  }),
  fallbackMatrix: Object.freeze([
    { category:'Executive Correspondence', categoryCode:'EXC', subcategory:'DG Attention', subcategoryCode:'DG', dsuKey:'ODG', assignedTo:'dgs@nitda.gov.ng', supportDsuKey:'REG', priority:'urgent', ackDays:1, dueDays:2, instruction:'Review for DGCEO attention and provide immediate handling recommendation.' },
    { category:'Policy / Regulation', categoryCode:'POL', subcategory:'Review', subcategoryCode:'REV', dsuKey:'Policy', assignedTo:'policy@nitda.gov.ng', supportDsuKey:'Legal', priority:'high', ackDays:1, dueDays:3, instruction:'Review policy/regulatory implications and advise on required action.' },
    { category:'Operations', categoryCode:'OPS', subcategory:'Service Request', subcategoryCode:'SRV', dsuKey:'Operations', assignedTo:'operations@nitda.gov.ng', supportDsuKey:'Registry', priority:'normal', ackDays:2, dueDays:5, instruction:'Treat the operational request and update response tracking.' },
    { category:'Finance / Procurement', categoryCode:'FIN', subcategory:'Budget / Procurement', subcategoryCode:'BUD', dsuKey:'Finance', assignedTo:'finance@nitda.gov.ng', supportDsuKey:'Procurement', priority:'high', ackDays:1, dueDays:4, instruction:'Review financial/procurement requirements and advise Registry.' },
    { category:'ICT / Digital Services', categoryCode:'ICT', subcategory:'Technical Support', subcategoryCode:'TECH', dsuKey:'ICT', assignedTo:'ict@nitda.gov.ng', supportDsuKey:'Operations', priority:'normal', ackDays:1, dueDays:4, instruction:'Assess ICT requirements and provide implementation or support action.' },
    { category:'General Administration', categoryCode:'GEN', subcategory:'General', subcategoryCode:'GEN', dsuKey:'Registry', assignedTo:'registry@nitda.gov.ng', supportDsuKey:'Operations', priority:'normal', ackDays:2, dueDays:5, instruction:'Classify, minute and route for appropriate action.' }
  ]),
  validation: Object.freeze({ requireCategory:true, requireSubcategory:false, requireAssignedTo:true, requireDue:true, requireInstruction:true, enforceAckBeforeDue:true, enforceStartBeforeDue:true })
});
