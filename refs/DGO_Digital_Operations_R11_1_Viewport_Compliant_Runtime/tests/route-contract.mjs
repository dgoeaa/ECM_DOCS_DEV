import fs from 'node:fs';
const ids=["home", "activities", "correspondence", "response-tracking", "orchestrator", "single-assignment", "bulk-assignment", "fasttrack", "approvals", "acknowledgment", "dispatch", "registry", "comments", "reports", "statistics", "executive", "assistant", "lookup", "operator-hud", "settings", "diagnostics", "user-admin"];
for(const id of ids) if(!fs.existsSync(new URL(`../modules/${id}.js`,import.meta.url))) throw new Error(`Missing route module ${id}`);
console.log(`route contract passed: ${ids.length}`);
