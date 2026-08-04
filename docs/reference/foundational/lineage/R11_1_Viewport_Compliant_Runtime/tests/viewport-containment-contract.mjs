import fs from 'node:fs';
const css=fs.readFileSync(new URL('../styles/app.css',import.meta.url),'utf8');
const shell=fs.readFileSync(new URL('../shared/shell.js',import.meta.url),'utf8');
for(const x of ['html,body{margin:0;width:100vw;height:100vh;overflow:hidden','grid-template-rows:minmax(0,1fr) var(--footer)','main{height:100%;min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden','table{width:100%;border-collapse:collapse','grid-template-columns:repeat(auto-fill,minmax(min(390px,100%),1fr))']) if(!css.includes(x)) throw new Error('Missing viewport CSS contract: '+x);
for(const x of ["navEl.addEventListener('pointerdown', collapse)","main.addEventListener('pointerdown', collapse)",'class="footer"','data-context']) if(!shell.includes(x)) throw new Error('Missing shell contract: '+x);
console.log('viewport containment contracts passed');
