import fs from'node:fs';
for(const f of ['index.html','core/boot.js','shared/shell.js','styles/app.css'])if(!fs.existsSync(new URL('../'+f,import.meta.url)))throw Error('Missing '+f);
const css=fs.readFileSync(new URL('../styles/app.css',import.meta.url),'utf8');
for(const x of [
  'html,body,#app,dgo-shell',
  'overflow:hidden',
  'grid-template-rows:minmax(0,1fr) auto',
  'overflow-y:auto',
  'repeat(auto-fit,minmax(220px,1fr))',
  'repeat(auto-fill,minmax(min(100%,380px),1fr))',
  '.tablewrap',
  '--chrome-height'
])if(!css.includes(x))throw Error('Missing viewport containment contract: '+x);
console.log('static validation passed');
