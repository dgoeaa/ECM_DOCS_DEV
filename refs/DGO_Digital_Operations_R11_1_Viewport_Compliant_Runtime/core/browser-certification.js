import { BrowserCertification } from '../config/browser-certification.config.js';
import { Router } from './router.js';
export function certify(){ const result={at:new Date().toISOString(),routes:Router.known(),...BrowserCertification,passed:Router.known().length>=22}; localStorage.setItem('dgo.r11.viewport.certification',JSON.stringify(result)); return result; }
