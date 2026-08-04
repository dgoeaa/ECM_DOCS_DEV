import fs from 'node:fs';
const required=['index.html','core/boot.js','core/router.js','shared/shell.js','modules/activities.js','modules/single-assignment.js','modules/bulk-assignment.js','modules/settings.js','modules/diagnostics.js','styles/app.css'];
for(const f of required) if(!fs.existsSync(new URL('../'+f,import.meta.url))) throw new Error('Missing '+f);
console.log('static validation passed');
