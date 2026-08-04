## config/endpoints.config.js:55-72
```
55:   AI_DOC_ANALYSIS: {
56:     url: PATH('20e3b003a57f47febae8a24ad5b9acd4', 'TVPVBWHGec5Yt7oY_jtUyIIF4yQdkZgFrxy3oCNG0pk'),
57:     method: 'POST', headers: JSON_HEADERS, family: 'F5', envelope: 'v1', flowName: 'AI_Assisted_Event Related_Document_Analysis_Processing',
58:     sharesWorkflowWith: 'REFERENCE_DATA',
59:     defaults: { action: 'aiAnalyseEventDocs', operation: 'analyse', mode: 'batch', source: SOURCE }, expectedKeys: ['ok', 'data'], timeoutMs: 90000
60:   },
61:   OTP_GENERATE: {
62:     url: PATH('314aaf27593147089b38322e5ca25936', 'OWBIO1ooq0y8Zh9BTPp3sBOQoyVWs_a463FhFUT66fU'),
63:     method: 'POST', headers: JSON_HEADERS, family: 'F6', envelope: 'v1', flowName: 'OTP Generate',
64:     defaults: { action: 'otpGenerate', operation: 'generate', mode: 'single', source: SOURCE }, expectedKeys: ['ok', 'data']
65:   },
66:   OTP_VERIFY: {
67:     url: PATH('43879c5165de439680055ab4258b3f27', 'zO21cB8Gn-LDklvld-xWtGUuZDvCleHWR6j5N6s5Dyo'),
68:     method: 'POST', headers: JSON_HEADERS, family: 'F6', envelope: 'v1', flowName: 'OTP Verify',
69:     defaults: { action: 'otpVerify', operation: 'verify', mode: 'single', source: SOURCE }, expectedKeys: ['ok', 'data']
70:   },
71:   AI_CHAT: {
72:     url: PATH('a13c8b577bd44f8787c50d095ea3faf9', 'gtXPGBgn00fpw7ORkWQvzaNNQ8qwSHUahBodUv7AyX8'),
```

## config/endpoints.config.js:118-127
```
118:   method: ep.method || 'POST',
119:   mode: ep.defaults?.mode || '',
120:   operation: ep.defaults?.operation || '',
121:   action: ep.defaults?.action || '',
122:   readOnly: /read|get|fetch|lookups|analyse|respond/i.test(String(ep.defaults?.operation || ep.defaults?.action || '')) && !/create|update|dispatch|bulk|assign|verify|generate/i.test(String(ep.defaults?.action || '')),
123:   writeCapable: /create|update|dispatch|bulk|assign|acknowledge|verify|generate/i.test(String(ep.defaults?.action || ep.defaults?.operation || '')),
124:   otpRequired: key === 'BULK_ASSIGNMENT' || key === 'BULK_ASSIGNMENT_DIRECT',
125:   idempotencyRequired: /ASSIGNMENT|ACTIONS|TASK|OTP/i.test(key),
126:   expectedKeys: ep.expectedKeys || []
127: })])));
```

## core/entry-logic.js:50-170
```
50:   // ==========================================
51:   initGateway() {
52:     const phase1 = document.getElementById('phase-1');
53:     const phase2 = document.getElementById('phase-2');
54:     const emailInput = document.getElementById('email-input');
55:     const reqBtn = document.getElementById('btn-request-otp');
56:     const verifyBtn = document.getElementById('btn-verify-otp');
57:     const otpInputs = document.querySelectorAll('.entry-otp-input');
58:     const displayEmail = document.getElementById('display-email');
59:     
60:     if (!phase1 || !phase2) return;
61: 
62:     let userEmail = "";
63: 
64:     // STEP 1: REQUEST OTP
65:     reqBtn.addEventListener('click', async () => {
66:       const email = emailInput.value.trim();
67:       const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
68: 
69:       if (!emailRegex.test(email)) {
70:         emailInput.parentElement.classList.add('is-error');
71:         setTimeout(() => emailInput.parentElement.classList.remove('is-error'), 400);
72:         return;
73:       }
74: 
75:       reqBtn.classList.add('is-loading');
76:       
77:       const res = await API.callAPI('OTP_GENERATE', {
78:         action: 'generate',
79:         identifier: email,
80:         purpose: 'LOGIN'
81:       });
82: 
83:       reqBtn.classList.remove('is-loading');
84: 
85:       if (res.ok) {
86:         userEmail = email;
87:         displayEmail.textContent = userEmail;
88:         phase1.classList.remove('is-active');
89:         phase2.classList.add('is-active');
90:         otpInputs[0].focus();
91:       } else {
92:         emailInput.parentElement.classList.add('is-error');
93:         console.error("OTP Generation Failed:", res.errors);
94:       }
95:     });
96: 
97:     // OTP Input Matrix Logic
98:     otpInputs.forEach((input, index) => {
99:       input.addEventListener('input', (e) => {
100:         e.target.value = e.target.value.replace(/[^0-9]/g, '');
101:         if (e.target.value && index < otpInputs.length - 1) otpInputs[index + 1].focus();
102:       });
103: 
104:       input.addEventListener('keydown', (e) => {
105:         if (e.key === 'Backspace' && !e.target.value && index > 0) {
106:           otpInputs[index - 1].focus();
107:           otpInputs[index - 1].value = ''; 
108:         }
109:         if (e.key === 'Enter') verifyBtn.click();
110:       });
111: 
112:       input.addEventListener('paste', (e) => {
113:         e.preventDefault();
114:         const pasteData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
115:         pasteData.split('').forEach((char, i) => {
116:           if (otpInputs[index + i]) {
117:             otpInputs[index + i].value = char;
118:             otpInputs[index + i].focus();
119:           }
120:         });
121:       });
122:     });
123: 
124:     // STEP 2: VERIFY OTP
125:     verifyBtn.addEventListener('click', async () => {
126:       const code = Array.from(otpInputs).map(i => i.value).join('');
127:       const otpGroup = document.querySelector('.entry-otp-group');
128: 
129:       if (code.length < 6) {
130:         otpGroup.classList.add('is-error');
131:         setTimeout(() => otpGroup.classList.remove('is-error'), 400);
132:         return;
133:       }
134: 
135:       verifyBtn.classList.add('is-loading');
136: 
137:       const res = await API.callAPI('OTP_VERIFY', {
138:         action: 'verify',
139:         identifier: userEmail,
140:         otp_code: code
141:       });
142: 
143:       if (res.ok && res.data && res.data.valid !== false) {
144:         Persona.setSession(res.data.token || 'dgo-secure-token', {
145:           email: userEmail,
146:           fullName: res.data.fullName || 'Operator',
147:           dsuKey: res.data.dsuKey || 'DEFAULT'
148:         });
149: 
150:         verifyBtn.classList.remove('is-loading');
151:         const btnText = document.createElement('span');
152:         btnText.className = 'btn-text';
153:         btnText.textContent = 'Verified ✓';
154:         verifyBtn.replaceChildren(btnText);
155:         verifyBtn.style.background = 'var(--entry-glow-accent)';
156:         
157:         setTimeout(() => {
158:           document.getElementById('shutter').classList.add('shutter-active');
159:           setTimeout(() => window.location.href = 'index.html', 600);
160:         }, 500);
161: 
162:       } else {
163:         verifyBtn.classList.remove('is-loading');
164:         otpGroup.classList.add('is-error');
165:         otpInputs.forEach(i => i.value = '');
166:         otpInputs[0].focus();
167:         setTimeout(() => otpGroup.classList.remove('is-error'), 400);
168:       }
169:     });
170:   }
```

## login.html:25-50
```
25:         <h1 class="entry-title">Operator Access</h1>
26:         <p class="entry-subtitle">Enter your NITDA credentials to continue.</p>
27:         <label class="entry-field">
28:           <span class="entry-label">Official Email</span>
29:           <input type="email" id="email-input" class="entry-input" placeholder="operator@nitda.gov.ng" autocomplete="email" required>
30:         </label>
31:         <button type="button" id="btn-request-otp" class="entry-btn">
32:           <span class="btn-text">Continue</span>
33:         </button>
34:       </div>
35: 
36:       <div id="phase-2" class="form-phase">
37:         <h1 class="entry-title">Verification</h1>
38:         <p class="entry-subtitle">Enter the 6-digit access code sent to <strong id="display-email" style="color:#fff;"></strong></p>
39:         <div class="entry-otp-group">
40:           <input type="text" class="entry-otp-input" maxlength="1" inputmode="numeric" autocomplete="one-time-code" aria-label="Digit 1">
41:           <input type="text" class="entry-otp-input" maxlength="1" inputmode="numeric" aria-label="Digit 2">
42:           <input type="text" class="entry-otp-input" maxlength="1" inputmode="numeric" aria-label="Digit 3">
43:           <input type="text" class="entry-otp-input" maxlength="1" inputmode="numeric" aria-label="Digit 4">
44:           <input type="text" class="entry-otp-input" maxlength="1" inputmode="numeric" aria-label="Digit 5">
45:           <input type="text" class="entry-otp-input" maxlength="1" inputmode="numeric" aria-label="Digit 6">
46:         </div>
47:         <button type="button" id="btn-verify-otp" class="entry-btn">
48:           <span class="btn-text">Authenticate</span>
49:         </button>
50:         <div style="text-align: center; margin-top: 16px;">
```

## shared/components/pf-otp-modal.js:1-220
```
1: /** OBSIDIAN v4.0 — <pf-otp-modal> · stateless PA-handshake OTP gate (register B-1 / D-7). */
2: import { PfBaseElement } from './_base.js';
3: import { BaseService } from '../../core/base-service.js';
4: 
5: const requestOtp = BaseService.endpoint('OTP_GENERATE', { expectedKeys: ['ok'] });
6: const verifyOtp  = BaseService.endpoint('OTP_VERIFY', { expectedKeys: ['ok'] });
7: 
8: const DEFAULT_ATTEMPTS = 5;
9: 
10: class PfOtpModal extends PfBaseElement {
11:   static require(opts = {}) {
12:     return new Promise((resolve) => {
13:       const el = document.createElement('pf-otp-modal');
14:       el._opts = opts || {};
15:       el._resolve = resolve;
16:       document.body.appendChild(el);
17:     });
18:   }
19: 
20:   onConnect() {
21:     this._settled = false;
22:     this._sent = false;
23:     this._otpId = null;
24:     this._expiresAt = 0;
25:     this._attemptsLeft = Number(this._opts.maxAttempts) || DEFAULT_ATTEMPTS;
26:     this._countdownTimer = null;
27:     this._release = null;
28: 
29:     const reason = this._opts.reason || this.t('otp.defaultReason');
30:     this.render(`<style>
31:       :host{ position:fixed; inset:0; z-index:var(--z-modal, 1000); display:grid; place-items:center;
32:         background:color-mix(in srgb, var(--color-text) 45%, transparent); }
33:       .card{ width:min(28rem,92vw); background:var(--color-surface-raised); border:1px solid var(--color-border);
34:         border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); padding:var(--space-6); display:grid; gap:var(--space-4); }
35:       h2{ font:var(--font-display); font-size:var(--size-h3); margin:0; color:var(--color-text); }
36:       p{ margin:0; color:var(--color-text-muted); font-size:var(--size-body-sm); }
37:       input{ font:inherit; font-size:var(--size-h3); letter-spacing:.4em; text-align:center; padding:var(--space-3);
38:         border:1px solid var(--color-border-strong); border-radius:var(--radius-md);
39:         background:var(--color-surface); color:var(--color-text); }
40:       input:disabled{ opacity:.5; }
41:       .row{ display:flex; gap:var(--space-3); justify-content:flex-end; align-items:center; }
42:       .row .spacer{ margin-right:auto; }
43:       button{ padding:var(--space-2) var(--space-4); border-radius:var(--radius-md); font-weight:var(--fw-semibold); font-size:var(--size-body-sm); }
44:       button:disabled{ opacity:.5; cursor:not-allowed; }
45:       .primary{ background:var(--color-brand-primary); color:var(--color-text-inverse); }
46:       .ghost{ background:transparent; color:var(--color-text-muted); border:1px solid var(--color-border); }
47:       .link{ background:none; color:var(--color-brand-primary); padding:var(--space-1) var(--space-2); }
48:       .meta{ font-size:var(--size-caption); color:var(--color-text-muted); min-height:1.2em; }
49:       .err{ font-size:var(--size-caption); color:var(--color-danger); min-height:1.2em; }
50:     </style>
51:     <div class="card" role="dialog" aria-modal="true" aria-label="${this.t('otp.title')}">
52:       <h2>${this.t('otp.title')}</h2>
53:       <p>${reason}</p>
54:       <p id="dest" class="meta" role="status" aria-live="polite"></p>
55:       <input id="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8"
56:              placeholder="••••••" aria-label="${this.t('otp.codeLabel')}" disabled>
57:       <p id="countdown" class="meta" role="status" aria-live="polite"></p>
58:       <div id="msg" class="err" role="alert" aria-live="assertive"></div>
59:       <div class="row">
60:         <button class="link spacer" id="resend" hidden>${this.t('otp.resend')}</button>
61:         <button class="ghost" id="cancel">${this.t('common.actions.cancel')}</button>
62:         <button class="primary" id="verify" disabled>${this.t('otp.verify')}</button>
63:       </div>
64:     </div>`);
65: 
66:     this.on(this.$('#cancel'), 'click', () => this._finish({ ok: false, kind: 'CANCELLED' }));
67:     this.on(this.$('#verify'), 'click', () => this._verify());
68:     this.on(this.$('#resend'), 'click', () => this._request());
69:     this.on(this.$('#code'), 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this._verify(); } });
70:     this.on(this, 'keydown', (e) => { if (e.key === 'Escape') this._finish({ ok: false, kind: 'CANCELLED' }); });
71: 
72:     this._request();
73:   }
74: 
75:   onDisconnect() { 
76:     this._stopCountdown(); 
77:     this._release?.();
78:   }
79: 
80:   _identifier() {
81:     return this._opts.identifier || this._opts.userEmail || this._personaEmail();
82:   }
83: 
84:   _parseData(res) {
85:     let d = res && res.data;
86:     if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { d = {}; } }
87:     if (!d || typeof d !== 'object') d = {};
88:     return d;
89:   }
90: 
91:   async _request() {
92:     this._stopCountdown();
93:     this._sent = false;
94:     const msg = this.$('#msg'); msg.textContent = '';
95:     this.$('#resend').hidden = true;
96:     this.$('#dest').textContent = this.t('otp.sendingCode');
97:     this.$('#code').disabled = true; this.$('#verify').disabled = true;
98: 
99:     const identifier = this._identifier();
100:     const res = await requestOtp({
101:       action: 'generate',
102:       identifier,
103:       userEmail: identifier,
104:       purpose: this._opts.purpose || 'VERIFICATION',
105:       channel: 'email',
106:       context: this._opts.context || {}
107:     });
108: 
109:     if (!res.ok) {
110:       this.$('#dest').textContent = '';
111:       msg.textContent = this._detail(res) || this.t('otp.genFailed');
112:       this.$('#resend').hidden = false;
113:       return;
114:     }
115:     const d = this._parseData(res);
116:     if (d.valid === false) {
117:       this.$('#dest').textContent = '';
118:       msg.textContent = d.message || this.t('otp.genFailed');
119:       this.$('#resend').hidden = false;
120:       return;
121:     }
122:     this._sent = true;
123:     this._otpId = d.otpId || d.id || null;
124:     this._attemptsLeft = Number(this._opts.maxAttempts) || DEFAULT_ATTEMPTS;
125:     const ttl = Number(d.ttlSeconds) || 0;
126:     this._expiresAt = d.expiresAt ? Date.parse(d.expiresAt) : (ttl ? Date.now() + ttl * 1000 : 0);
127:     this.$('#dest').textContent = this.t('otp.sent', { to: d.sentTo || identifier || 'email', ttl: ttl || 0 });
128:     const input = this.$('#code');
129:     input.disabled = false; input.value = ''; input.maxLength = Number(d.codeLength) || 8;
130:     this.$('#verify').disabled = false;
131:     
132:     this._release = globalThis.Platform?.A11y?.trapFocus?.(this.$('.card'));
133:     globalThis.Platform?.A11y?.focusFirst?.(this.$('.card'));
134:     input.focus();
135:     this._startCountdown();
136:   }
137: 
138:   async _verify() {
139:     const input = this.$('#code');
140:     const code = (input.value || '').trim();
141:     const msg = this.$('#msg'); msg.textContent = '';
142:     if (!this._sent) { msg.textContent = this.t('otp.expired'); this.$('#resend').hidden = false; return; }
143:     if (!code) { msg.textContent = this.t('otp.needCode'); return; }
144:     if (this._expiresAt && Date.now() > this._expiresAt) { this._onExpired(); return; }
145: 
146:     this.$('#verify').disabled = true;
147:     this.$('#countdown').textContent = this.t('otp.verifying');
148:     const identifier = this._identifier();
149:     const res = await verifyOtp({ action: 'verify', identifier, otp_code: code, userEmail: identifier });
150:     this.$('#verify').disabled = false;
151: 
152:     const d = this._parseData(res);
153:     if (res.ok && d.valid !== false) {
154:       this._finish({ ok: true, identifier, code, verificationToken: d.verificationToken || d.token || null });
155:       return;
156:     }
157: 
158:     const kind = res.errorKind || '';
159:     if (kind === 'OTP_EXPIRED') { this._onExpired(); return; }
160: 
161:     const serverLeft = Number.isFinite(d.remainingAttempts) ? Number(d.remainingAttempts) : null;
162:     this._attemptsLeft = serverLeft != null ? serverLeft : (this._attemptsLeft - 1);
163:     if (this._attemptsLeft <= 0) { this._rollback(); return; }
164:     msg.textContent = (d.message || this.t('otp.invalid')) + ' ' + this.t('otp.attemptsLeft', { n: this._attemptsLeft });
165:     input.focus(); input.select();
166:   }
167: 
168:   _onExpired() {
169:     this._stopCountdown();
170:     this._sent = false;
171:     this._otpId = null;
172:     this.$('#code').disabled = true; this.$('#verify').disabled = true;
173:     this.$('#countdown').textContent = '';
174:     this.$('#msg').textContent = this.t('otp.expired');
175:     this.$('#resend').hidden = false;
176:   }
177: 
178:   _rollback() {
179:     const Bus = globalThis.Platform && globalThis.Platform.Bus;
180:     const payload = { reason: 'otp-attempts-exhausted', purpose: this._opts.purpose || null,
181:       context: this._opts.context || {}, ts: new Date().toISOString() };
182:     if (Bus) { Bus.emit('assignment:failed', payload); Bus.emit('audit:assignment-failed', payload); }
183:     this.$('#msg').textContent = this.t('otp.rollback');
184:     this._finish({ ok: false, kind: 'ASSIGNMENT_FAILED' });
185:   }
186: 
187:   _startCountdown() {
188:     if (!this._expiresAt) { this.$('#countdown').textContent = ''; return; }
189:     const tick = () => {
190:       const s = Math.max(0, Math.round((this._expiresAt - Date.now()) / 1000));
191:       this.$('#countdown').textContent = this.t('otp.expiresIn', { s });
192:       if (s <= 0) this._onExpired();
193:     };
194:     tick();
195:     this._countdownTimer = setInterval(tick, 1000);
196:   }
197:   _stopCountdown() { if (this._countdownTimer) { clearInterval(this._countdownTimer); this._countdownTimer = null; } }
198: 
199:   _personaEmail() {
200:     const P = globalThis.Platform && globalThis.Platform.Persona;
201:     return (P && P.email && P.email()) || null;
202:   }
203:   _detail(res) {
204:     return (res && Array.isArray(res.errors) && res.errors[0] && res.errors[0].message) || '';
205:   }
206: 
207:   _finish(result) {
208:     if (this._settled) return;
209:     this._settled = true;
210:     this._stopCountdown();
211:     this._release?.();
212:     const resolve = this._resolve; this._resolve = null;
213:     this.remove();
214:     if (resolve) resolve(result);
215:   }
216: }
217: customElements.define('pf-otp-modal', PfOtpModal);
218: export { PfOtpModal };
219: export default PfOtpModal;
```

## modules/bulk-assignment/index.js:400-505
```
400:     if (!control) return null;
401:     control.setAttribute('aria-invalid', 'true');
402:     control.classList.add('pf-input--error');
403:     const err = document.getElementById(`${id}-error`);
404:     if (err) { err.textContent = message; err.hidden = false; }
405:     return control;
406:   }
407: 
408:   _selectionError(message) {
409:     const count = document.getElementById('bulk-selected-count');
410:     if (count) { count.setAttribute('aria-invalid', 'true'); count.classList.add('pf-input--error'); count.textContent = message; }
411:     return count;
412:   }
413: 
414:   async _requireBulkOtp(mode, count) {
415:     const P = globalThis.Platform;
416:     const OtpModal = globalThis.customElements?.get?.('pf-otp-modal');
417:     if (!OtpModal || typeof OtpModal.require !== 'function') {
418:       P?.UI?.toast?.({ message: this.t('otp.required'), variant: 'danger' });
419:       return false;
420:     }
421:     const userEmail = (P?.Persona?.email && P.Persona.email()) || `${(P?.Persona?.current && P.Persona.current()) || 'web-ops'}@nitda.gov.ng`;
422:     const result = await OtpModal.require({
423:       purpose: 'BULK_ASSIGNMENT',
424:       userEmail,
425:       identifier: userEmail,
426:       reason: this.t('bulk.otpReason'),
427:       context: { module: this.id, mode, selectedCount: count }
428:     });
429:     if (!result || !result.ok) {
430:       P?.UI?.toast?.({ messageKey: 'otp.failed', variant: 'danger' });
431:       return false;
432:     }
433:     this._lastOtp = { verifiedAt: new Date().toISOString(), mode, selectedCount: count, identifier: result.identifier || userEmail, token: result.verificationToken || null };
434:     return true;
435:   }
436: 
437:   async _submit(mode) {
438:     if (this._busy) return;
439:     const P = globalThis.Platform;
440:     const d = this._draft;
441: 
442:     this._clearValidation();
443: 
444:     // SPA validation order: category → assignee present → email format → items selected.
445:     let firstInvalid = null;
446:     if (!d.category) firstInvalid = this._fieldError('bulk-category', 'Select a category.');
447:     else if (!d.assignee) firstInvalid = this._fieldError('bulk-assignee', 'Enter an assignee email.');
448:     else if (!EMAIL_RE.test(d.assignee)) firstInvalid = this._fieldError('bulk-assignee', 'Enter a valid assignee email address.');
449:     else if (!this._selected.size) firstInvalid = this._selectionError('Select at least one item before submitting.');
450: 
451:     if (firstInvalid) {
452:       P.UI.toast({ message: 'Fix the highlighted field before submitting.', variant: 'danger' });
453:       if (typeof firstInvalid.focus === 'function') firstInvalid.focus();
454:       return;
455:     }
456: 
457:     const n = this._selected.size;
458:     const ok = await P.UI.confirm({
459:       titleKey: 'module.bulk-assignment.title',
460:       summaryKey: 'bulk.confirmSummary',
461:       danger: true,
462:       confirmKey: 'module.bulk-assignment.submit',
463:       details: [
464:         { label: 'Items', value: `${n} item${n !== 1 ? 's' : ''}` },
465:         { label: 'Category', value: d.category + (d.subCategory ? ' / ' + d.subCategory : '') },
466:         { label: 'Assigned To', value: d.assignee },
467:         { label: 'Co-Assignee', value: d.coAssignee || '—' },
468:         { label: 'CC', value: (d.copyTo || []).length ? d.copyTo.join('; ') : '—' },
469:         { label: 'Priority', value: d.priority },
470:         { label: 'Mode', value: mode === 'optimized' ? '⚡ Optimized' : '📤 Direct' },
471:         { label: this.t('confirm.endpoint'), value: mode === 'optimized' ? 'BULK_ASSIGNMENT' : 'BULK_ASSIGNMENT_DIRECT' },
472:         { label: this.t('confirm.impact'), value: this.t('confirm.impactWrite') }
473:       ]
474:     });
475:     if (!ok) return;
476: 
477:     const otpOk = await this._requireBulkOtp(mode, n);
478:     if (!otpOk) return;
479: 
480:     await this._execute(mode);
481:   }
482: 
483:   /** SPA executeBulkAssign — builds the byte-for-byte SPA payload and posts to E06/E07. */
484:   async _execute(mode) {
485:     if (this._busy) return;
486:     this._busy = true; this._renderStepper();
487:     const P = globalThis.Platform;
488:     const d = this._draft;
489: 
490:     const assignment = buildBulkAssignmentPayload({
491:       draft: d,
492:       selectedRefs: [...this._selected],
493:       entities: P.Entities,
494:       lookups: Lookups,
495:       platform: P,
496:       nav: globalThis.navigator || {}
497:     });
498:     const { payload, selectedItems, total, taskRecords } = assignment;
499:     if (this._lastOtp) payload.otp = { ...this._lastOtp };
500: 
501:     const res = await this.call(() => submitBulkAssignment(mode, payload));
502:     if (!res.ok) { this._busy = false; this._renderStepper(); return; } // error toast already raised by this.call
503: 
504:     const data = res.data || {};
505:     const failed = Array.isArray(data.failed) ? data.failed.length
```

## shared/domain/validators.js:1-25
```
1: /** Central domain validators for assignment, acknowledgement, endpoint, and governance-sensitive payloads. */
2: const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
3: const PRIORITY_RE = /^P[1-4]\s*\(/i;
4: 
5: function err(field, key, message) { return { field, key, message }; }
6: export function isEmail(value) { return EMAIL_RE.test(String(value || '').trim()); }
7: export function normalizeValidationErrors(errors = []) { return errors.filter(Boolean); }
8: 
9: export function validateAssignmentDraft(draft = {}, { mode = 'single', selectedCount = 0, requireOtp = false, otpVerified = false } = {}) {
10:   const d = draft || {};
11:   const errors = [];
12:   if (mode === 'single' && !String(d.ref || '').trim()) errors.push(err('ref', 'module.single-item-ops.needRef', 'Reference is required.'));
13:   if (!String(d.category || '').trim()) errors.push(err('category', 'field.required', 'Category is required.'));
14:   const assignee = mode === 'bulk' ? d.assignee : d.assignedTo;
15:   if (!String(assignee || '').trim()) errors.push(err('assignee', 'module.single-item-ops.needAssignee', 'Assignee is required.'));
16:   if (assignee && !isEmail(assignee)) errors.push(err('assignee', 'validation.email', 'Assignee must be a valid email address.'));
17:   if (mode === 'bulk' && selectedCount < 1) errors.push(err('selection', 'validation.required', 'At least one selected item is required.'));
18:   if (d.priority && !PRIORITY_RE.test(String(d.priority))) errors.push(err('priority', 'validation.priority', 'Priority must use a supported P1-P4 token.'));
19:   if (requireOtp && !otpVerified) errors.push(err('otp', 'otp.required', 'OTP verification is required.'));
20:   return Object.freeze({ ok: errors.length === 0, errors: normalizeValidationErrors(errors) });
21: }
22: 
23: export function validateEndpointContract(contract = {}) {
24:   const errors = [];
25:   if (!contract.key) errors.push(err('key', 'validation.required', 'Endpoint key is required.'));
```

## core/error-router.js:1-55
```
1: /** OBSIDIAN v4.0 — error-router.js · the canonical kind → UI behaviour map (register A-10 / S1).
2:  *  Consumes the machine-readable `result.errorKind` attached by core/api.js and routes each failure
3:  *  to its locked behaviour: re-auth prompts, OTP-modal mount requests, and danger/warning toasts with
4:  *  the correct aria-live urgency. UI.toastError delegates here at runtime (no static import cycle:
5:  *  this module imports UI, ui.js only reaches ErrorRouter via globalThis.Platform). */
6: import { Bus } from './bus.js';
7: import { UI } from './ui.js';
8: 
9: function t(key, vars) { return globalThis.Platform?.I18n?.t ? globalThis.Platform.I18n.t(key, vars) : key; }
10: 
11: /** The 13-row taxonomy. variant drives toast colour + aria-live (danger ⇒ assertive in pf-toast).
12:  *  behaviour fires a canonical side-effect event; suppress hides the toast (handled elsewhere). */
13: const TAXONOMY = {
14:   OK:                   { variant: 'success', i18nKey: null,                     behaviour: null,    retryable: false, suppress: true },
15:   AUTH_FAILED:          { variant: 'danger',  i18nKey: 'error.auth.failed',      behaviour: 'auth',  retryable: false },
16:   OTP_REQUIRED:         { variant: 'info',    i18nKey: 'otp.required',           behaviour: 'otp',   retryable: false },
17:   OTP_INVALID:          { variant: 'danger',  i18nKey: 'otp.invalid',            behaviour: null,    retryable: true },
18:   OTP_EXPIRED:          { variant: 'warning', i18nKey: 'otp.expired',            behaviour: null,    retryable: true },
19:   DIRECTORATE_MISMATCH: { variant: 'warning', i18nKey: 'error.directorate.mismatch', behaviour: null, retryable: false },
20:   RATE_LIMITED:         { variant: 'warning', i18nKey: 'error.rateLimited',      behaviour: 'rate',  retryable: true },
21:   VALIDATION_FAILED:    { variant: 'warning', i18nKey: 'error.validation',       behaviour: null,    retryable: true },
22:   NOT_AUTHORIZED:       { variant: 'danger',  i18nKey: 'error.notAuthorized',    behaviour: 'denied', retryable: false },
23:   DISPATCH_FAILED:      { variant: 'danger',  i18nKey: 'dispatch.failed',        behaviour: null,    retryable: true },
24:   CONFLICT_IDEMPOTENT:  { variant: 'info',    i18nKey: 'info.alreadyApplied',    behaviour: null,    retryable: false },
25:   UPSTREAM_TIMEOUT:     { variant: 'warning', i18nKey: 'error.timeout',          behaviour: null,    retryable: true },
26:   INTERNAL_ERROR:       { variant: 'danger',  i18nKey: 'error.internal',         behaviour: null,    retryable: false }
27: };
28: 
29: function entryFor(kind) { return TAXONOMY[kind] || TAXONOMY.INTERNAL_ERROR; }
30: 
31: export const ErrorRouter = {
32:   TAXONOMY,
33:   /** Look up the taxonomy entry for a normalized API result (or a raw kind string).
34:    *  Unknown kinds normalize to INTERNAL_ERROR so callers never branch on an unmapped label. */
35:   classify(resultOrKind) {
36:     const raw = typeof resultOrKind === 'string' ? resultOrKind : (resultOrKind && resultOrKind.errorKind);
37:     const kind = (raw && TAXONOMY[raw]) ? raw : 'INTERNAL_ERROR';
38:     return { kind, ...entryFor(kind) };
39:   },
40: 
41:   /** Route a failed API result to its canonical UI behaviour. Returns the toast id (or null). */
42:   handle(result) {
43:     if (!result || result.ok) return null;
44:     const kind = result.errorKind || 'INTERNAL_ERROR';
45:     const e = entryFor(kind);
46: 
47:     // Canonical side-effects (the UI shell / flows subscribe to these).
48:     if (e.behaviour === 'auth')   Bus.emit('auth:required', { result, ts: new Date().toISOString() });
49:     if (e.behaviour === 'otp')    Bus.emit('otp:required', { result, ts: new Date().toISOString() });
50:     if (e.behaviour === 'rate')   Bus.emit('rate:limited', { retryAfter: result.retryAfter || null });
51:     if (e.behaviour === 'denied') Bus.emit('audit:unauthorized-access-attempt', {
52:       persona: (globalThis.Platform?.Persona?.current && globalThis.Platform.Persona.current()) || null,
53:       action: (result.errors && result.errors[0] && result.errors[0].code) || 'api', ts: new Date().toISOString() });
54: 
55:     if (e.suppress || !e.i18nKey) return null;
```

## core/base-service.js:1-70
```
1: // FILE: core/base-service.js
2: /**
3:  * OBSIDIAN v4.0 — BaseService (/core/base-service.js)
4:  * Common service plumbing so no service hand-rolls fetch, pagination, sort, or cache.
5:  *
6:  *   export const fetchAll = BaseService.endpoint('FETCH_ALL', { cache: 30000, expectedKeys: ['ok','data'] });
7:  *   const res = await fetchAll({ ...payload }, { page, pageSize, sortBy, sortDir });
8:  *
9:  * The factory returns the FULL normalized result from API.callAPI (callers keep errors[] warnings);
10:  * res.data is the contract payload. Client-side sort/paginate apply only when res.data is an array.
11:  *
12:  * Idempotency: for writes a key is prepared here (deterministic, bucketed) and passed BOTH via
13:  * payload.idempotencyKey and opts.idempotencyKey. The caller's payload object is never mutated.
14:  * bucketMs may be overridden per-endpoint (factory opts) or per-call (query) for OTP-gated bulk flows.
15:  */
16: 
17: import { API } from './api.js';
18: import { Endpoints } from '../config/endpoints.config.js';
19: import { Idempotency } from './idempotency.js';
20: 
21: function log(level, msg, ctx) {
22:   const L = globalThis.Platform && Platform.Log;
23:   if (L && typeof L[level] === 'function') L[level](msg, ctx);
24: }
25: 
26: function cacheKey(endpointKey, payload, query) {
27:   return endpointKey + '::' + JSON.stringify(payload || {}) + '::' + JSON.stringify(query || {});
28: }
29: 
30: function validateShape(endpointKey, result, expectedKeys) {
31:   if (!result.ok || !result.body || !Array.isArray(expectedKeys)) return;
32:   const missing = expectedKeys.filter((k) => !(k in result.body));
33:   if (missing.length) log('error', 'service.shape-mismatch', { endpointKey, missing, correlationId: result.correlationId });
34: }
35: 
36: function applySort(rows, sortBy, sortDir) {
37:   if (!sortBy || !Array.isArray(rows)) return rows;
38:   const dir = sortDir === 'desc' ? -1 : 1;
39:   return [...rows].sort((a, b) => {
40:     const av = a == null ? '' : a[sortBy]; const bv = b == null ? '' : b[sortBy];
41:     if (av === bv) return 0;
42:     return (av > bv ? 1 : -1) * dir;
43:   });
44: }
45: 
46: function applyPage(rows, page, pageSize) {
47:   if (!pageSize || !Array.isArray(rows)) return rows;
48:   const p = Math.max(1, page || 1);
49:   return rows.slice((p - 1) * pageSize, (p - 1) * pageSize + pageSize);
50: }
51: 
52: export const BaseService = {
53:   /**
54:    * Build a callable bound to one endpoint key.
55:    * opts: { cache?:ms, expectedKeys?:string[], silent?:bool, bucketMs?:number|false }
56:    * Returned fn(payload?, query?): query may carry { page, pageSize, sortBy, sortDir, force, bucketMs, idempotencyKey }.
57:    */
58:   endpoint(endpointKey, opts = {}) {
59:     if (!Endpoints[endpointKey]) {
60:       log('error', 'service.unknown-endpoint', { endpointKey });
61:     }
62:     const expectedKeys = opts.expectedKeys || (Endpoints[endpointKey] && Endpoints[endpointKey].expectedKeys);
63:     const ttl = opts.cache || 0;
64:     const store = new Map(); // key -> { at, result }
65: 
66:     const fn = async (payload = {}, query = {}) => {
67:       const key = cacheKey(endpointKey, payload, query);
68:       if (ttl && !query.force) {
69:         const hit = store.get(key);
70:         if (hit && Date.now() - hit.at < ttl) return hit.result;
```

## config/i18n/en.json:775-795
```
775:     "confirmSummary": "This creates a tracked task for the selected document and notifies the assignee.",
776:     "success": "Assignment created."
777:   },
778:   "otp": {
779:     "title": "Security verification",
780:     "defaultReason": "Confirm your identity to proceed.",
781:     "codeLabel": "One-time code",
782:     "verify": "Verify",
783:     "sent": "Code sent to {to} · expires in {ttl}s",
784:     "genFailed": "Could not send a code. Try again.",
785:     "needCode": "Enter the code.",
786:     "invalid": "Invalid or expired code.",
787:     "required": "A one-time code is required to continue.",
788:     "expired": "The code expired. Request a new one.",
789:     "resend": "Resend code",
790:     "verifying": "Verifying…",
791:     "expiresIn": "Expires in {s}s",
792:     "attemptsLeft": "{n} attempt(s) left.",
793:     "failed": "Verification failed. The assignment was rolled back.",
794:     "sendingCode": "Sending a code…",
795:     "rollback": "Too many incorrect attempts — assignment cancelled."
```
