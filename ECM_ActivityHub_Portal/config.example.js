/**
 * ECM Activity Hub Portal — runtime configuration example.
 *
 * HOW TO USE
 * ----------
 * 1. Copy this file to  ECM_ActivityHub_Portal/htdocs/config.local.js
 * 2. Replace the placeholder URL with your API gateway / Power Automate endpoint.
 * 3. config.local.js is git-ignored — never commit real credentials.
 * 4. index.html already loads  ./config.local.js  via:
 *      <script src="./config.local.js" onerror="void 0"></script>
 *
 * ⚠️  NOTE on powerAutomateClient.js
 * powerAutomateClient.js contains NO hardcoded secrets — it is a generic fetch
 * wrapper.  All URL configuration flows through this file and js/core/config.js.
 * If DGO_CONFIG.API_URL is set here it takes precedence over the compiled default
 * in js/core/config.js.
 */

window.DGO_CONFIG = {
  /**
   * Primary backend URL.  Can be a Power Automate HTTP trigger (with a freshly
   * regenerated SAS signature), a Cloudflare Worker proxy, an Azure API Management
   * gateway, or any other endpoint that speaks the DGO envelope protocol.
   */
  API_URL: "https://YOUR_API_GATEWAY_OR_FLOW_URL_HERE",
};
