import fs from'node:fs';
const css=fs.readFileSync(new URL('../styles/app.css',import.meta.url),'utf8').replace(/\s+/g,'');
const required=[
  ['root chrome height','--ministry-height:22px;--top-height:56px;--chrome-height:calc(var(--ministry-height)+var(--top-height))'],
  ['app root locked','html,body,#app,dgo-shell{width:100%;height:100%;margin:0;overflow:hidden}'],
  ['shell locked','height:calc(100vh-var(--chrome-height));display:grid'],
  ['content footer grid','grid-template-rows:minmax(0,1fr)auto'],
  ['main scroll only','main{padding:14px16px;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden}'],
  ['workspace contained','width:100%;max-width:1760px;min-width:0;margin:0auto;overflow-x:hidden'],
  ['forms responsive','grid-template-columns:repeat(auto-fit,minmax(220px,1fr))'],
  ['records dense','grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr))'],
  ['tables contained','.tablewrap{width:100%;max-width:100%;min-width:0;overflow-x:auto}'],
  ['mobile chrome override','@media(max-width:768px){:root{--chrome-height:var(--top-height)}']
];
for(const [name,needle] of required)if(!css.includes(needle))throw Error('Viewport containment failed: '+name);
console.log('viewport containment passed');
