// Deployment-specific Power Automate HTTP endpoint URLs are configured in Settings.
// No flow signatures, bearer tokens, credentials or production URLs are embedded in this runtime package.
export const EndpointContracts = Object.freeze({
  FETCH_ACTIVITIES: { method:'POST', action:'LIST-ACTIVITIES', readOnly:true },
  SINGLE_ASSIGNMENT: { method:'POST', action:'singleassignment', write:true },
  BULK_ASSIGNMENT: { method:'POST', action:'bulkassignment', write:true },
  DYNAMIC_ACTIONS: { method:'POST', action:'dynamicGlobalAction', write:true },
  EMAIL: { method:'POST', action:'dispatchEmail', write:true }
});
export const EndpointKeys = Object.keys(EndpointContracts);
