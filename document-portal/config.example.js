/* NITDA Intelligent Portal — runtime configuration template.
   ==========================================================

   Copy this file to  document-portal/config.local.js  and fill it in. That file is
   git-ignored, exactly like config/config.local.js for the root platform.

   WHY THIS FILE EXISTS
   --------------------
   A SAS-signed Power Automate URL is a bearer credential: possession alone authorises
   invocation of the flow. Three such URLs were previously hardcoded in js/data.js and
   therefore served, in plaintext, to every anonymous visitor of the portal. They have
   been removed from the tree. THE SIGNATURES THAT WERE COMMITTED REMAIN VALID UNTIL
   THEY ARE ROTATED IN POWER AUTOMATE — deleting a file revokes nothing, and they are
   still readable in Git history and in ECM_DOCS_DEV.zip.

   With no config.local.js present the portal runs fully: everything is recorded in
   localStorage and PF.flow() reports `not-configured` instead of posting. That is the
   safe default for a public deployment that has no rotated credentials yet.

   HOW IT LOADS
   ------------
   Each page loads  <script src="config.local.js" onerror="void 0"></script>  before
   js/data.js. The onerror handler is intentional: the file is optional.
*/
window.PF_CONFIG = {
  /* Power Automate HTTP trigger endpoints. Leave a value empty ('') to disable that
     integration — the portal degrades to local-only recording for that flow. */
  endpoints: {
    submission: '',
    tracking: '',
    support: ''
  },

  /* Operations console access.
     ------------------------------------------------------------------
     The console gate is a CLIENT-SIDE control. It cannot be an authentication
     boundary: every record it displays lives in the visitor's own localStorage, and
     any visitor can write the session key directly from the developer console. It is
     therefore treated as a role selector, not as a security control, and the UI says
     so.

     Publishing usernames AND passwords in js/data.js — which is what this portal did —
     was strictly worse than having no gate, because it implied a protection that did
     not exist. No credential is shipped in the tree any more.

     Set `consoleAccounts` here to restrict which roles a deployment offers. Set
     `requireCredentials: true` together with `consoleAccounts[].pass` only if you
     understand that those values are readable by anyone who opens config.local.js
     over HTTP — i.e. only for a closed demonstration on a private host. Real staff
     authentication belongs behind the authenticating proxy (see proxy/ and
     AUTHENTICATION_CONTRACT.md), not here. */
  console: {
    requireCredentials: false,
    accounts: null   /* null => use the built-in demonstration roles in js/data.js */
  }
};
