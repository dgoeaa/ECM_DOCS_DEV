// DGO R11.6 — endpoint configuration.
//
// ⚠️  SECURITY NOTICE: The SAS-signed Power Automate URLs that were previously
// hardcoded here have been removed because they constitute credentials.  They
// remain in Git history and MUST be rotated / regenerated in Power Automate.
//
// To supply real endpoint URLs:
//   1. Copy  config/config.example.js  →  config/config.local.js
//   2. Fill in the rotated URLs in config/config.local.js
//   3. Add  <script src="config/config.local.js"></script>  to index.html
//      (or load it however you prefer — it just needs to set window.DGO_CONFIG
//       before the ES-module graph is evaluated)
//   4. config/config.local.js is git-ignored; never commit the real URLs.
//
// At runtime this module reads from window.DGO_CONFIG.endpoints first.
// If that is absent, all URLs are empty strings and API calls will
// fail gracefully (the platform degrades to offline/demo mode).
//
// DIRECT OPERATION
// Every URL below is invoked directly by the browser. There is no proxy, broker or
// other intermediary in the request path, and none is required to run or deploy the
// platform. The flow behind each URL is therefore the only place authentication,
// authorisation and validation can be enforced — it must enforce them itself.

const _cfg = (typeof window !== 'undefined' && window.DGO_CONFIG?.endpoints) || {};

/** Resolve a key: prefer runtime config, fall back to '' */
const _url = (key) => _cfg[key] || '';

export const EndpointUrls = Object.freeze({
  FETCH_ACTIVITIES:       _url('FETCH_ACTIVITIES'),
  FETCH_ALL:              _url('FETCH_ALL'),
  REFERENCE_DATA:         _url('REFERENCE_DATA'),
  GET_DOCS:               _url('GET_DOCS'),
  FETCH_EMAIL_ATTACHMENTS:_url('FETCH_EMAIL_ATTACHMENTS'),
  SINGLE_ASSIGNMENT:      _url('SINGLE_ASSIGNMENT'),
  BULK_ASSIGNMENT:        _url('BULK_ASSIGNMENT'),
  BULK_ASSIGNMENT_DIRECT: _url('BULK_ASSIGNMENT_DIRECT'),
  DYNAMIC_ACTIONS:        _url('DYNAMIC_ACTIONS'),
  EMAIL:                  _url('EMAIL'),
  EMAIL_RELATED_TASK:     _url('EMAIL_RELATED_TASK'),
  AI_EMAIL_ANALYSIS:      _url('AI_EMAIL_ANALYSIS'),
  AI_DOC_ANALYSIS:        _url('AI_DOC_ANALYSIS'),
  AI_CHAT:                _url('AI_CHAT'),
  OTP_GENERATE:           _url('OTP_GENERATE'),
  OTP_VERIFY:             _url('OTP_VERIFY'),
  SUBSIDIARY_ACTIONS:     _url('SUBSIDIARY_ACTIONS'),

  /**
   * Registry scan deposit. Not a JSON contract like the keys above: core/scan-intake-service.js
   * PUTs the raw bytes of a scanned document to this URL with the filename, size and SHA-256
   * in headers, because base64-in-JSON is what produced the 4 MB ceiling this replaced.
   * It is therefore resolved through the endpoint registry but carries no EndpointContracts
   * entry — DataClient.request() cannot and must not be used for it.
   * Leave it unset and Registry Scan Intake reports itself unconfigured rather than
   * pretending a deposit succeeded.
   */
  SCAN_INTAKE:            _url('SCAN_INTAKE'),
});
export const DefaultEndpointSettings = Object.freeze({ ...EndpointUrls });
export const EndpointContracts = Object.freeze({
  FETCH_ACTIVITIES: Object.freeze({ method:'POST', action:"LIST-ACTIVITIES", readOnly:true, timeoutMs:90000, sourceKey:"SUBSIDIARY_ACTIONS", url:EndpointUrls.FETCH_ACTIVITIES }),
  FETCH_ALL: Object.freeze({ method:'POST', action:"fetchAll", readOnly:true, timeoutMs:90000, sourceKey:"FETCH_ALL", url:EndpointUrls.FETCH_ALL }),
  REFERENCE_DATA: Object.freeze({ method:'POST', action:"lookups", readOnly:true, sourceKey:"REFERENCE_DATA", url:EndpointUrls.REFERENCE_DATA }),
  GET_DOCS: Object.freeze({ method:'POST', action:"getDocs", readOnly:true, sourceKey:"GET_DOCS", url:EndpointUrls.GET_DOCS }),
  FETCH_EMAIL_ATTACHMENTS: Object.freeze({ method:'POST', action:"fetchEmailAttachments", readOnly:true, sourceKey:"FETCH_EMAIL_ATTACHMENTS", url:EndpointUrls.FETCH_EMAIL_ATTACHMENTS }),
  SINGLE_ASSIGNMENT: Object.freeze({ method:'POST', action:"singleassignment", write:true, sourceKey:"SINGLE_ASSIGNMENT", url:EndpointUrls.SINGLE_ASSIGNMENT }),
  BULK_ASSIGNMENT: Object.freeze({ method:'POST', action:"bulkassignment", write:true, timeoutMs:90000, sourceKey:"BULK_ASSIGNMENT", url:EndpointUrls.BULK_ASSIGNMENT }),
  BULK_ASSIGNMENT_DIRECT: Object.freeze({ method:'POST', action:"bulkassignment", write:true, timeoutMs:90000, sourceKey:"BULK_ASSIGNMENT_DIRECT", url:EndpointUrls.BULK_ASSIGNMENT_DIRECT }),
  DYNAMIC_ACTIONS: Object.freeze({ method:'POST', action:"dynamicGlobalAction", write:true, sourceKey:"DYNAMIC_GLOBAL_ACTIONS", url:EndpointUrls.DYNAMIC_ACTIONS }),
  EMAIL: Object.freeze({ method:'POST', action:"dispatchEmail", write:true, sourceKey:"DYNAMIC_GLOBAL_ACTIONS", url:EndpointUrls.EMAIL }),
  // Governed dispatch + archive contracts route through the existing DYNAMIC_ACTIONS flow (no URL rotation).
  DISPATCH_OUTBOUND: Object.freeze({ method:'POST', action:"dispatchOutbound", write:true, sourceKey:"DYNAMIC_GLOBAL_ACTIONS", url:EndpointUrls.DYNAMIC_ACTIONS }),
  ARCHIVE_REFERENCE: Object.freeze({ method:'POST', action:"archiveReference", write:true, sourceKey:"DYNAMIC_GLOBAL_ACTIONS", url:EndpointUrls.DYNAMIC_ACTIONS }),
  EMAIL_RELATED_TASK: Object.freeze({ method:'POST', action:"emailtotaskassignment", write:true, sourceKey:"EMAIL_RELATED_TASK", url:EndpointUrls.EMAIL_RELATED_TASK }),
  AI_EMAIL_ANALYSIS: Object.freeze({ method:'POST', action:"aiAnalyseEmail", write:true, timeoutMs:90000, sourceKey:"AI_EMAIL_ANALYSIS", url:EndpointUrls.AI_EMAIL_ANALYSIS }),
  AI_DOC_ANALYSIS: Object.freeze({ method:'POST', action:"aiAnalyseEventDocs", write:true, timeoutMs:90000, sourceKey:"AI_DOC_ANALYSIS", url:EndpointUrls.AI_DOC_ANALYSIS }),
  AI_CHAT: Object.freeze({ method:'POST', action:"aiChat", write:true, timeoutMs:90000, sourceKey:"AI_CHAT", url:EndpointUrls.AI_CHAT }),
  OTP_GENERATE: Object.freeze({ method:'POST', action:"otpGenerate", write:true, sourceKey:"OTP_GENERATE", url:EndpointUrls.OTP_GENERATE }),
  OTP_VERIFY: Object.freeze({ method:'POST', action:"otpVerify", write:true, sourceKey:"OTP_VERIFY", url:EndpointUrls.OTP_VERIFY }),
  SUBSIDIARY_ACTIONS: Object.freeze({ method:'POST', action:"INIT", write:true, timeoutMs:90000, routeKeys:["INIT", "REFRESH_EMAILS", "LOAD_EMAIL_DETAILS", "AI_ANALYSE_EMAIL", "CREATE_TASK", "UPDATE_TASK", "LOAD_EVENT_INFO", "AI_CHAT", "TRACK", "ACKNOWLEDGE", "GET_ALL", "GET_BOOTSTRAP", "LISTDOCS", "GETDOC", "BULKASSIGN", "CREATESUPPORTREQUEST", "GETREFERENCES", "LIST-ACTIVITIES"], sourceKey:"SUBSIDIARY_ACTIONS", url:EndpointUrls.SUBSIDIARY_ACTIONS }),
});
export const EndpointKeys = Object.freeze(Object.keys(EndpointContracts));
export const ConfiguredEndpointKeys = Object.freeze(Object.keys(EndpointUrls));
export const endpointUrl = key => EndpointUrls[key] || ''; 
export const endpointContract = key => EndpointContracts[key] || null;
