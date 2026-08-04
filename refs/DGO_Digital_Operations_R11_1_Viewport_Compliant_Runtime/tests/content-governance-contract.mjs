import fs from 'node:fs';
const noKpi=['correspondence','response-tracking','orchestrator','approvals','acknowledgment','dispatch','registry','comments','reports','assistant','lookup','user-admin'];
for(const id of noKpi){const s=fs.readFileSync(new URL(`../modules/${id}.js`,import.meta.url),'utf8');if(s.includes('kpis('))throw new Error('Unexpected KPI in '+id)}
const generic=fs.readFileSync(new URL('../shared/generic-module.js',import.meta.url),'utf8');if(generic.includes('<h2>${title}</h2>'))throw new Error('Duplicate module title remains');
console.log('content governance contracts passed');
