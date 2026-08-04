import { AppConfig } from '../config/app.config.js';
const initial = { profile:{name:'Registry',email:'dgsregistry@nitda.gov.ng',persona:'admin'}, settings:{theme:'government',density:'comfortable',maxBulkAssign:AppConfig.maxBulkAssign,endpoints:{}}, activities:[], tracking:[], comments:[], audit:[], pending:[], selectedId:null };
let state;
try { state = { ...initial, ...JSON.parse(localStorage.getItem(AppConfig.storageKey) || '{}') }; } catch { state = structuredClone(initial); }
const listeners = new Set();
export const State = { get:()=>state, patch(p){ state={...state,...p}; localStorage.setItem(AppConfig.storageKey, JSON.stringify(state)); listeners.forEach(f=>f(state)); return state; }, on(f){ listeners.add(f); return ()=>listeners.delete(f); }, reset(){ state=structuredClone(initial); this.patch({}); } };
