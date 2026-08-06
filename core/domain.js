import { normalizePriority } from '../config/priority.config.js';
const first = (...values) => values.find(v => v !== undefined && v !== null && v !== '');
const text = (...values) => String(first(...values) ?? '').trim();
const id = (...values) => text(...values) || crypto.randomUUID();
const emails = value => Array.isArray(value) ? value.map(x => text(x?.address,x?.emailAddress?.address,x)).filter(Boolean) : text(value).split(/[;,]+/).map(x=>x.trim()).filter(Boolean);
const iso = value => { const d=new Date(value); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const stripHtml = value => text(value).replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().slice(0,2000);
/* DGO_UserDirectory.AccessScope is a Note column, so it arrives as a JSON array, a
   comma-separated string, or already-parsed. Normalising here keeps the three shapes from
   reaching the scope comparison in core/directorate-scope.js as three different types. */
const scopeList = value => {
  if (Array.isArray(value)) return value.map(v => text(v)).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  if (raw.startsWith('[')) { try { return JSON.parse(raw).map(v => text(v)).filter(Boolean); } catch { /* fall through */ } }
  return raw.split(/[;,]+/).map(s => s.trim()).filter(Boolean);
};

export const status = a => text(a?.status,a?.Status?.Value,a?.Status) || 'Not Treated';
// Canonical status classifiers — the single source for "is this done / pending" and badge
// tone across modules (previously five divergent regex classifiers).
export const isComplete = v => /treated|completed|processed|acknowledged|closed|archived|dispatched|accepted|approved/i.test(String(v||''));
export const isPendingStatus = v => /pending|assigned|active|not started|in progress|awaiting|logged|received/i.test(String(v||''));
export const statusTone = v => { const x=String(v||''); if(/overdue|declined|reject|breach|blocked|escalat|failed|disabled/i.test(x)) return 'danger'; if(isComplete(x)) return 'ok'; return 'warn'; };
export const normalizeDocument = a => ({
  id:id(a.id,a.ID), sourceId:first(a.ID,a.id), entityType:'document',
  title:text(a.title,a.Title)||'Untitled', created:iso(first(a.created,a.Created))||new Date().toISOString(),
  description:stripHtml(first(a.description,a.Description)),
  status:status(a), assignmentStatus:text(a.assignmentStatus,a.AssignmentStatus?.Value,a.AssignmentStatus)||'Not Assigned',
  assignedTo:text(a.assignedTo,a.AssignedTo,a.Assigned), assigned:text(a.Assigned), category:text(a.category,a.Category),
  referenceId:text(a.referenceId,a.RefIDD,a.Reference_ID), routedTo:text(a.RoutedToDSU), cc:emails(a.CC_x0027_dTo),
  attachmentLink:text(a.AttachmentLink), attachments:text(a.AttachmentLink)?[{name:text(a.Title)||'Document',url:text(a.AttachmentLink)}]:[]
});
export const normalize = normalizeDocument;
export const normalizeTask = t => ({
  id:id(t.id,t.ID), sourceId:first(t.ID,t.id), entityType:'task', title:text(t.title,t.Title)||'Untitled task',
  description:stripHtml(first(t.description,t.Description)), created:iso(first(t.created,t.Created))||new Date().toISOString(),
  referenceId:text(t.referenceId,t.RefIDD,t.Reference_ID), assignedTo:text(t.assignedTo,t.AssignedTo,t.Assigned),
  assigned:text(t.Assigned), assignedToDsu:text(t.AssignedToDSU,t.DSULookUp), supportingDsu:text(t.CoAssigneeDSU),
  thirdAssignee:text(t._x0033_rdAssigned), routedTo:text(t.RoutedToDSU), classification:text(t.Classification),
  priority:normalizePriority(text(t.priority,t.Priority)), progress:text(t.Progress), status:text(t.status,t.Status,t.Progress)||'Pending',
  startDate:iso(first(t.StartDate,t.startDate)), due:iso(first(t.DueDate,t.due,t.dueDate)), ack:text(t.AcknowledgementDue,t.ack),
  author:text(t.AuthorTitle), editorEmail:text(t.EditorEmail)
});
export const normalizeComment = c => ({id:id(c.id,c.ID),sourceId:first(c.ID,c.id),entityType:'comment',referenceId:text(c.referenceId,c.RefIDD,c.Reference_ID,c.Title==='No Title'?'':c.Title),title:text(c.Title),body:stripHtml(first(c.body,c.Description)),author:text(c.author,c.AuthorTitle,c.EditorEmail)||'Unknown',editorEmail:text(c.EditorEmail),ts:iso(first(c.ts,c.Created))||new Date().toISOString()});
/**
 * A user row, from either shape it arrives in.
 *
 * Two sources feed this and they name the same things differently. Microsoft Graph sends
 * `displayName` / `mail` / `jobTitle` and carries NO role at all. DGO_UserDirectory sends
 * SharePoint internal names — `Role`, `Persona`, `Status`, `AccessScope` — and is the
 * authoritative identity register.
 *
 * Reading only the lower-case forms, as this did, is not a cosmetic gap. `Role` fell
 * through to the `'viewer'` default, so every officer in the directory arrived stripped of
 * their role; and `Status` fell through to `'active'`, so a DISABLED user arrived active
 * and config/rbac.config.js `canAccess()` — which admits anyone whose status is 'active' —
 * let them straight back in. Both defaults looked like sensible fallbacks and both failed
 * open.
 *
 * `persona` is now carried rather than re-derived. It is a stored column on the directory
 * row, and re-deriving it from the role would silently overwrite a deliberate assignment.
 */
export const normalizeUser = u => ({
  id: id(u.id, u.UserId, u.email, u.Email),
  entityType: 'user',
  fullName: text(u.fullName, u.FullName, u.name, u.displayName, u.Title) || 'Unnamed user',
  name: text(u.name, u.fullName, u.FullName, u.displayName),
  email: text(u.email, u.Email, u.mail, u.userPrincipalName).toLowerCase(),
  directorate: text(u.directorate, u.Directorate, u.department, u.Department),
  department: text(u.department, u.Department, u.directorate, u.Directorate),
  unit: text(u.unit, u.Unit),
  jobTitle: text(u.jobTitle, u.JobTitle),
  phone: text(u.phone, u.Phone),
  role: text(u.role, u.Role) || 'viewer',
  persona: text(u.persona, u.Persona),
  status: text(u.status, u.Status) || 'active',
  accessScope: scopeList(u.accessScope ?? u.AccessScope),
  pilotCohort: text(u.pilotCohort, u.PilotCohort),
  disabledReason: text(u.disabledReason, u.DisabledReason),
});
export const normalizeCategory = c => ({id:id(c.id,c.ID),entityType:'category',title:text(c.Title,c.Category,c.Subcategory),category:text(c.Category),subcategory:text(c.Subcategory),categoryCode:text(c['Category Code']),subcategoryCode:text(c['SubCategory Code']),dsuKey:text(c.DSU_KEY),primaryResponsible:text(c['Default Primary Responsible']),supportingDsu:text(c['Default Supporting Department/Unit']),inform:[c.INFORMDSU1,c.INFORMDSU2,c.INFORMDSU3].map(text).filter(Boolean),priority:text(c.Priority),timeline:text(c.Timeline)});
export const normalizeDepartment = d => ({id:id(d.id,d.ID),entityType:'department',title:text(d.Title),dsuKey:text(d.DSU_KEY),email:text(d.DSU_Email).toLowerCase(),headEmail:text(d.DSU_HeadEmail).toLowerCase(),headPersonalEmail:text(d.DSU_HeadPersonalEmail).toLowerCase(),headTitle:text(d.DSU_HeadTitle)});
export const normalizeEmail = e => ({id:id(e.id,e.internetMessageId),entityType:'email',subject:text(e.subject)||'(No subject)',fromAddress:text(e.fromAddress,e.from?.emailAddress?.address),fromName:text(e.fromName,e.from?.emailAddress?.name),receivedDateTime:iso(e.receivedDateTime),bodyPreview:text(e.bodyPreview),bodyContent:text(e.bodyContent,e.body?.content).slice(0,4000),bodyContentType:text(e.bodyContentType,e.body?.contentType),toRecipients:emails(e.toRecipients),ccRecipients:emails(e.ccRecipients),bccRecipients:emails(e.bccRecipients),hasAttachments:Boolean(e.hasAttachments),importance:text(e.importance)||'normal',conversationId:text(e.conversationId),internetMessageId:text(e.internetMessageId),webLink:text(e.webLink)});
export const makeRef = (value, code='UNC', sub='') => [new Date().toISOString().slice(0,10).replaceAll('-',''),value,code,sub].filter(Boolean).join('-');
