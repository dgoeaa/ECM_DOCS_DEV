export const CorrespondenceEmailTemplateConfig = Object.freeze({
  schema: 'dgo-correspondence-email-templates/v1',
  brand: Object.freeze({
    agency: 'National Information Technology Development Agency',
    ministry: 'Federal Ministry of Communications, Innovation & Digital Economy',
    platform: 'DGO Digital Ops',
    deepGreen: '#05583B',
    smartGreen: '#17B255',
    ink: '#373435',
    line: '#DDE7E1',
    paper: '#F6F8F6'
  }),
  defaults: Object.freeze({
    fromName: 'Office of the Director-General / Registry',
    replyTo: 'dgsregistry@nitda.gov.ng',
    classification: 'Official',
    signatoryName: 'Registry, Office of the Director-General',
    signatoryTitle: 'For: Director-General/CEO'
  }),
  templates: Object.freeze([
    { id:'official-correspondence', label:'Official Correspondence', category:'Formal Response', tone:'formal', subject:'{{referenceId}} — {{subject}}', required:['recipientEmail','subject','referenceId','body'], sections:[
      {type:'opening', html:'Dear {{recipientName}},'},
      {type:'body', html:'Please find below the official correspondence of the Agency on the referenced matter.<br><br>{{body}}'},
      {type:'conditional', when:'hasActionRequired', html:'<b>Action required:</b> {{actionRequired}}'},
      {type:'conditional', when:'hasDueDate', html:'Kindly respond on or before <b>{{dueDate}}</b>.'},
      {type:'closing', html:'Please accept the assurances of our highest consideration.'}
    ]},
    { id:'request-for-information', label:'Request for Information / Documents', category:'Request', tone:'diplomatic', subject:'Request for Information — {{referenceId}}', required:['recipientEmail','referenceId','body'], sections:[
      {type:'opening', html:'Dear {{recipientName}},'},
      {type:'body', html:'The Agency is reviewing the referenced correspondence and requests the following information/documentation:<br><br>{{body}}'},
      {type:'conditional', when:'hasDueDate', html:'To enable timely processing, kindly provide the requested information by <b>{{dueDate}}</b>.'},
      {type:'closing', html:'Thank you for your cooperation.'}
    ]},
    { id:'document-transmittal', label:'Document Transmittal', category:'Transmittal', tone:'formal', subject:'Transmittal — {{referenceId}} — {{subject}}', required:['recipientEmail','referenceId'], sections:[
      {type:'opening', html:'Dear {{recipientName}},'},
      {type:'body', html:'Kindly receive the transmitted document(s) relating to the referenced matter.<br><br>{{body}}'},
      {type:'conditional', when:'hasAttachments', html:'<b>Attachment reference(s):</b> {{attachmentSummary}}'},
      {type:'closing', html:'Kindly acknowledge receipt where necessary.'}
    ]},
    { id:'meeting-invitation', label:'Meeting / Engagement Invitation', category:'Invitation', tone:'formal', subject:'Invitation — {{subject}} — {{referenceId}}', required:['recipientEmail','subject','body'], sections:[
      {type:'opening', html:'Dear {{recipientName}},'},
      {type:'body', html:'The Agency is pleased to invite you/your organization to the referenced engagement.<br><br>{{body}}'},
      {type:'conditional', when:'hasDueDate', html:'Kindly confirm availability on or before <b>{{dueDate}}</b>.'},
      {type:'closing', html:'We look forward to your participation.'}
    ]},
    { id:'circular-notice', label:'Circular / General Notice', category:'Notice', tone:'official', subject:'Circular / Notice — {{subject}}', required:['recipientEmail','subject','body'], sections:[
      {type:'opening', html:'Dear {{recipientName}},'},
      {type:'body', html:'Kindly note the following official notice from the Agency:<br><br>{{body}}'},
      {type:'closing', html:'Kindly be guided accordingly.'}
    ]},
    { id:'closure-response', label:'Closure / Final Response', category:'Closure', tone:'formal', subject:'Final Response — {{referenceId}}', required:['recipientEmail','referenceId','body'], sections:[
      {type:'opening', html:'Dear {{recipientName}},'},
      {type:'body', html:'The Agency hereby conveys its final response on the referenced matter as follows:<br><br>{{body}}'},
      {type:'closing', html:'This correspondence closes the matter from the Agency’s current action point unless otherwise communicated.'}
    ]}
  ])
});
export const CorrespondenceEmailTemplates = CorrespondenceEmailTemplateConfig.templates;
export function correspondenceEmailTemplate(id){ return CorrespondenceEmailTemplates.find(t=>t.id===id) || CorrespondenceEmailTemplates[0]; }
