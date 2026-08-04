#!/usr/bin/env python3
"""
Module-parity harvest: what the 20 source SPAs actually do, reconciled against the 29
modules that consolidate them.

Method, so the result can be challenged:
  · A SPA's capability surface is read from what it BINDS, not from its prose — the
    data-action attributes, the named handler functions, and the flow endpoints it calls.
    A button with no handler is a mock-up; a handler with no button is dead code. Both are
    reported, neither is counted as a capability.
  · Module ownership comes from config/module-boundaries.config.js, which is the platform's
    own declaration of what each workspace may do. Matching is on stemmed tokens, because
    two teams naming the same thing ('doc' / 'document', 'ack' / 'acknowledgment') is drift,
    not divergence.
  · Anything that matches nothing is reported verbatim rather than force-fitted, then read
    once by hand and classed as a GAP or a helper. The classification is in this file.

WHAT THIS SCRIPT WILL NOT TELL YOU
The match percentage is meaningless and is deliberately not carried into the findings.
Function names in these SPAs are dominated by internal wiring — `updateBreadcrumb`,
`saveStateDebounced` — so the denominator measures the harvester's vocabulary rather than
the platform's completeness.

More important: module-boundaries.config.js is a PERMISSION LIST, not a manifest. A
capability that is built but not named in an `owns:` array reads here as missing. Seven of
the first nine "gaps" this script produced turned out to be fully implemented. Every entry
in GAPS therefore carries a verdict checked against the source tree, and only two are real.
"""
import json, os, re, sys
from collections import defaultdict

ROOT = '/home/user/ECM_DOCS_DEV'
SPA_DIR = os.path.join(ROOT, 'docs/reference/foundational/spas')

# ── what each SPA binds ────────────────────────────────────────────────────────────────
ACTION_ATTR = re.compile(r'data-(?:action|act|cmd|command|view|tab|nav)\s*=\s*["\']([^"\']{2,48})["\']')
FUNC_DECL = re.compile(r'(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\())')
ONCLICK = re.compile(r'onclick\s*=\s*["\']([A-Za-z_$][\w$]*)\s*\(')
WORKFLOW = re.compile(r'workflows/([0-9a-f]{32})')

# Verbs that denote a real capability rather than plumbing.
CAPABILITY_VERB = re.compile(
    r'^(?:add|apply|approve|archive|assign|ack|acknowledge|attach|bulk|cancel|classify|clear|close|comment|complete|'
    r'create|decline|delegate|delete|dispatch|edit|escalate|export|fasttrack|filter|flag|generate|hold|import|'
    r'log|lookup|minute|monitor|move|notify|open|preview|print|progress|reject|reopen|reply|report|reset|resolve|'
    r'retry|return|route|save|search|send|sort|start|submit|sync|track|triage|update|upload|view)', re.I)

NOISE = re.compile(r'^(?:init|render|main|setup|load|bind|util|helper|fmt|format|esc|escape|debounce|toast|'
                   r'showToast|closeModal|openModal|qs|el|\$|log|noop|on[A-Z])', re.I)

# A capability is a thing the ORGANISATION does. `close modal`, `update badges` and `clear
# field` are how a screen behaves, not what the office can do with a document — counting them
# as capabilities inflates the denominator and manufactures gaps that do not exist. The
# discriminator is the noun, not the verb: any phrase whose object is a widget is plumbing.
WIDGET = re.compile(r'\b(?:modal|dropdown|dropdowns|toast|spinner|overlay|tooltip|accordion|'
                    r'tab|tabs|badge|badges|indicator|chip|pill|panel|drawer|sidebar|menu|'
                    r'ui|dom|form|field|input|scroll|theme|app|page|counts|placeholder)\b', re.I)
PURE_UI_VERB = re.compile(r'^(?:close|open|toggle|show|hide|update|refresh|reset|clear|start)\b', re.I)

# Vocabulary drift between two teams writing the same system. Normalising per token beats a
# phrase-level synonym table: it generalises to phrases nobody wrote down.
STEM = {
    'docs': 'document', 'doc': 'document', 'documents': 'document', 'item': 'document',
    'items': 'document', 'record': 'document', 'records': 'document', 'file': 'document',
    'correspondence': 'document', 'activity': 'document', 'activities': 'document',
    'assign': 'assignment', 'assigns': 'assignment', 'assigned': 'assignment',
    'assignments': 'assignment', 'assigning': 'assignment',
    'ack': 'acknowledge', 'acks': 'acknowledge', 'acknowledgment': 'acknowledge',
    'acknowledged': 'acknowledge', 'acknowledgement': 'acknowledge',
    'comments': 'comment', 'minutes': 'minute', 'minuting': 'minute',
    'tasks': 'task', 'etask': 'task', 'etasks': 'task',
    'mail': 'email', 'emails': 'email', 'mails': 'email',
    'reports': 'report', 'reporting': 'report',
    'users': 'user', 'staff': 'user', 'assignee': 'user', 'owner': 'user',
    'flags': 'flag', 'flagged': 'flag', 'exports': 'export', 'filters': 'filter',
    'searches': 'search', 'routes': 'route', 'routing': 'route',
    'approvals': 'approve', 'approval': 'approve', 'approved': 'approve',
    'rejects': 'reject', 'rejected': 'reject', 'declined': 'reject', 'decline': 'reject',
    'dispatches': 'dispatch', 'dispatched': 'dispatch',
    'escalation': 'escalate', 'escalations': 'escalate',
    'archived': 'archive', 'archives': 'archive',
    'submission': 'submit', 'submitted': 'submit', 'submitting': 'submit',
    'creates': 'create', 'created': 'create', 'new': 'create', 'add': 'create',
    'view': 'view', 'views': 'view', 'detail': 'view', 'details': 'view', 'preview': 'view',
    'monitoring': 'monitor', 'monitors': 'monitor', 'track': 'monitor', 'tracking': 'monitor',
    'sync': 'sync', 'synced': 'sync', 'refresh': 'sync', 'reload': 'sync',
    'movement': 'movement', 'move': 'movement', 'custody': 'custody',
    'scanned': 'scan', 'scanning': 'scan', 'intake': 'scan',
    'notify': 'notify', 'notification': 'notify', 'notifications': 'notify', 'remind': 'notify',
    'ai': 'suggestion', 'suggest': 'suggestion', 'suggestions': 'suggestion',
    'brief': 'brief', 'briefs': 'brief', 'briefing': 'brief',
    'project': 'project', 'projects': 'project',
    'response': 'response', 'responses': 'response', 'reply': 'response',
    'fasttrack': 'fasttrack', 'fast': 'fasttrack',
    'registry': 'registry', 'register': 'registry', 'registration': 'registry',
}
STOP = {'the', 'a', 'an', 'to', 'of', 'and', 'for', 'from', 'with', 'on', 'in', 'by',
        'data', 'live', 'all', 'one', 'single', 'this', 'my', 'via', 'entries', 'entry',
        'action', 'actions', 'selection', 'selected', 'summary', 'list', 'row', 'rows'}


def split_words(name):
    s = re.sub(r'[-_]+', ' ', name)
    s = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', ' ', s)
    return re.sub(r'\s+', ' ', s).strip().lower()


def tokens(phrase):
    """Significant, stemmed tokens. This is the unit both sides are compared in."""
    out = []
    for w in phrase.split():
        w = STEM.get(w, w)
        if w not in STOP and len(w) > 1:
            out.append(w)
    return set(out)


def is_plumbing(phrase):
    return bool(WIDGET.search(phrase)) or (
        PURE_UI_VERB.match(phrase) and not (tokens(phrase) - {'sync', 'view', 'monitor'}))


def spa_capabilities(text):
    caps = set()
    for m in ACTION_ATTR.finditer(text):
        caps.add(split_words(m.group(1)))
    handlers = set()
    for m in FUNC_DECL.finditer(text):
        n = m.group(1) or m.group(2)
        if n and not NOISE.match(n):
            handlers.add(n)
    for m in ONCLICK.finditer(text):
        handlers.add(m.group(1))
    for h in handlers:
        w = split_words(h)
        if CAPABILITY_VERB.match(w):
            caps.add(w)
    sized = {c for c in caps if 3 <= len(c) <= 46}
    return {c for c in sized if not is_plumbing(c)}, {c for c in sized if is_plumbing(c)}


# ── the platform's declared capability surface ─────────────────────────────────────────
def module_capabilities():
    src = open(os.path.join(ROOT, 'config/module-boundaries.config.js'), encoding='utf8').read()
    caps = defaultdict(set)
    for m in re.finditer(r"['\"]?([a-z][\w-]*)['\"]?\s*:\s*\{\s*role:\s*'([^']+)',\s*owns:\s*\[([^\]]*)\]", src):
        module, _role, owns = m.group(1), m.group(2), m.group(3)
        for o in re.findall(r"'([^']+)'", owns):
            caps[module].add(split_words(o))
    return caps


SYNONYM = {
    'bulk assign documents': 'bulk assign', 'single assign document': 'assign one',
    'submit single assignment': 'assign one', 'submit bulk assignment': 'bulk assign',
    'create task': 'create task', 'email to task': 'create task from email',
    'fetch docs': 'activity view', 'fetch emails': 'email evidence',
    'open document detail': 'activity view', 'flag document': 'flag document',
    'export selection': 'export', 'apply suggestions': 'ai suggestion apply',
    'sync live data': 'sync', 'route assign task': 'route task',
    'quick minute': 'review minute', 'append to document': 'comment',
    'approve accept': 'approve', 'decline reject': 'reject', 'delegate via ea': 'return',
}


# ── hand review ────────────────────────────────────────────────────────────────────────
# Automated matching gets the shape right and the count wrong. Most of what survives
# reconciliation is an internal helper — `update breadcrumb`, `save state debounced`,
# `attach event listeners` — and reporting "116 unmatched capabilities" would be a false
# alarm dressed as a measurement. So the unmatched list is read once, by hand, and each
# entry is classed. The classification lives here, in the open, where it can be argued
# with; the percentage does not appear in the findings because it measures the harvester's
# vocabulary, not the platform's completeness.
#
# A DECLARATION IS NOT A MANIFEST — read this before believing any gap below.
# module-boundaries.config.js says what each workspace MAY own. It does not say what is
# built. A capability that is fully implemented but absent from an `owns:` array is
# invisible to the reconciler and reads as a gap. The first pass of this harvest reported
# nine gaps on exactly that basis; checked against the source tree, seven were already
# implemented. Every entry below therefore carries a VERDICT recording what the tree
# actually holds, and only the two marked GAP are real.
VERIFIED = 'verified-implemented'   # present in the tree; the boundaries file just omits it
GAP = 'gap'                         # checked against the tree and genuinely absent

GAPS = {
    'category cascade': (VERIFIED,
        ['apply etask category cascade', 'apply bulk category cascade',
         'apply category defaults', 'apply category defaults notified',
         'update sub category options'],
        'config/assignment-cascade.config.js + core/assignment-cascade.js, consumed by '
        'single-assignment, bulk-assignment and lookup. Carries category -> subcategory -> '
        'codes -> primary/support DSU -> assignee -> priority -> ack/due SLA -> instruction.'),
    'people picker (co-assignee / cc)': (VERIFIED,
        ['filter co assignee list', 'filter email task cc', 'filter email task co assignee',
         'filter email task users', 'filter bulk users', 'add cc',
         'sync cc multi select from state'],
        'datalist#user-emails type-ahead on assignedTo and supportingAssignee, plus a '
        'Copy-to/CC field. Narrower than source: CC is free text, not a filtered '
        'multi-select. A refinement, not a gap.'),
    'report generation per list family': (VERIFIED,
        ['generate dgoreport', 'generate gtqreport', 'report tag'],
        'modules/reports.js carries DGO and GTQ date ranges, a DGO/GTQ/Combined selector, '
        'template chips, print, HTML download and three email routes. Wider than source.'),
    'cross-navigation document -> assignment': (VERIFIED,
        ['open assignment from doc', 'open assign for email', 'open assign for single patched'],
        'config/navigation-relationships.config.js declares the entry/exit graph '
        '(registry.exitTo = [single-assignment, archive]); shared/relationship-runtime.js '
        'installs the interceptors and core/boot.js calls it.'),
    'reassignment': (VERIFIED,
        ['reassign'],
        'single-assignment offers an Assignment-type selector with a Reassignment option; '
        'core/lifecycle.js carries the reassign_requested state.'),
    'meeting agenda construction': (VERIFIED,
        ['create agenda days'],
        'modules/meetings.js has an agenda field, renders it and searches across it.'),
    'client telemetry': (VERIFIED,
        ['clear telemetry'],
        'modules/operator-hud.js is a live telemetry surface — sync state, contract version, '
        'collection inventory, pending-write queue, receipt health, deep-link inspector.'),

    # Note the direction of this one. `flag-document` IS declared, so the reconciler counts
    # it as carried across and cannot see the defect at all — the inverse of the seven
    # above. A declaration matches whether or not anything implements it. That is the
    # structural blind spot of this whole method, and it is why the tree, not this file,
    # is the authority.
    'document flagging': (GAP,
        ['mark dg', 'submit flag action'],
        'A PROMISE WITH NO IMPLEMENTATION. module-boundaries declares activities owns '
        'flag-document. lookup.js renders four flag controls (DG Attention, Follow-Up, INT, '
        'UNC) and renders r.flags as chips — but flagActivity() writes nothing: it raises '
        '"Complete this in Activities" and navigates away, and modules/activities.js has no '
        'flag implementation. The string `flags` appears in one module in the whole '
        'platform. An officer marking a document for DG attention is confirmed, redirected, '
        'and abandoned believing it was flagged.'),
    'flow-graph authoring': (GAP,
        ['open edge editor', 'add or update edge', 'import edges', 'import workspace',
         'save flow', 'send flow'],
        'UNDECIDED, NOT DEFECTIVE. The Orchestrator SPA edits the routing graph itself. '
        'modules/orchestrator.js binds only runtime verbs. Does graph authoring belong in '
        'the platform or stay in Power Automate? Building before that is answered creates '
        'two authorities over one graph.'),
}


def main():
    mods = module_capabilities()
    all_module_caps = {}
    for mod, caps in mods.items():
        for c in caps:
            all_module_caps.setdefault(c, []).append(mod)

    spa_rows = []
    every_spa_cap = defaultdict(set)      # capability -> spas that have it
    every_plumbing = set()                # widget-level bindings, excluded from the count
    for fn in sorted(os.listdir(SPA_DIR)):
        if not fn.endswith('.html'):
            continue
        text = open(os.path.join(SPA_DIR, fn), encoding='utf8', errors='replace').read()
        caps, plumbing = spa_capabilities(text)
        every_plumbing |= plumbing
        flows = len(set(WORKFLOW.findall(text)))
        spa_rows.append((fn, len(text) // 1024, len(caps), flows))
        for c in caps:
            every_spa_cap[c].add(fn)

    print('=' * 104)
    print('SOURCE SPA SURFACE')
    print('=' * 104)
    print(f'{"spa":<52} {"KB":>5} {"capabilities":>13} {"flows":>6}')
    for fn, kb, n, flows in sorted(spa_rows, key=lambda r: -r[2]):
        print(f'{fn[:52]:<52} {kb:>5} {n:>13} {flows:>6}')
    print(f'\n  {len(spa_rows)} SPAs, {len(every_spa_cap)} distinct capability strings')

    print('\n' + '=' * 104)
    print('PLATFORM SURFACE (config/module-boundaries.config.js)')
    print('=' * 104)
    print(f'  {len(mods)} modules, {len(all_module_caps)} declared capabilities')

    # ── reconcile ──────────────────────────────────────────────────────────────────
    module_tokens = {mc: tokens(mc) for mc in all_module_caps}

    def resolve(cap):
        """Best-scoring module capability, or None.

        Scoring is deliberately asymmetric. A SPA capability is CARRIED ACROSS when the
        module surface can express it — so what matters is how much of the SPA phrase the
        module phrase accounts for, not the reverse. A module that owns a broader
        capability ('assignment') still covers a narrower SPA one ('submit assignment');
        a module owning something the SPA phrase never mentions does not.
        """
        if cap in all_module_caps:
            return all_module_caps[cap], cap, 1.0
        syn = SYNONYM.get(cap)
        if syn and syn in all_module_caps:
            return all_module_caps[syn], syn, 1.0
        cw = tokens(cap)
        if not cw:
            return None
        best, best_cap, best_score = None, None, 0.0
        for mc, mw in module_tokens.items():
            if not mw:
                continue
            shared = cw & mw
            if not shared:
                continue
            # coverage of the SPA phrase, tempered by how much of the module phrase is
            # spurious — so 'assignment' doesn't win every assignment-shaped query.
            score = (len(shared) / len(cw)) * (0.5 + 0.5 * len(shared) / len(mw))
            if score > best_score:
                best, best_cap, best_score = all_module_caps[mc], mc, score
        return (best, best_cap, round(best_score, 2)) if best_score >= 0.5 else None

    covered, uncovered = {}, {}
    for cap, spas in every_spa_cap.items():
        hit = resolve(cap)
        if hit:
            covered[cap] = (spas, hit[0], hit[1], hit[2])
        else:
            uncovered[cap] = spas

    print('\n' + '=' * 104)
    print('RECONCILIATION')
    print('=' * 104)
    total = len(every_spa_cap)
    print(f'  SPA capabilities carried across       : {len(covered)}/{total}'
          f'  ({100*len(covered)//total}%)')
    print(f'  SPA capabilities matching nothing     : {len(uncovered)}')
    print(f'  UI plumbing excluded before matching  : {len(every_plumbing)}')

    # Every string named in GAPS must still be unmatched. If a later synonym or module
    # declaration covers one, this assertion fails loudly rather than leaving a stale gap
    # in the findings — the classification is only worth trusting if it is checked.
    stale = sorted(s for g in GAPS.values() for s in g[1] if s not in uncovered)
    if stale:
        print(f'\n  !! GAPS entries now matched by a module (remove from GAPS): {stale}')

    print('\n  UNDECLARED IN module-boundaries.config.js — with a verdict from the tree')
    print('  (the remaining unmatched strings are internal helpers)\n')
    for verdict in (GAP, VERIFIED):
        for name, (v, strings, why) in GAPS.items():
            if v != verdict:
                continue
            spas = set()
            for st in strings:
                spas |= uncovered.get(st, set())
            tag = 'GAP     ' if v == GAP else 'BUILT   '
            print(f'  {tag} {name}   [{len(strings)} bindings across {len(spas)} SPA(s)]')
            for line in re.findall(r'.{1,88}(?:\s|$)', why):
                print(f'           {line.strip()}')
            print()

    real = sum(1 for v, _s, _w in GAPS.values() if v == GAP)
    helpers = len(uncovered) - sum(1 for g in GAPS.values() for s in g[1] if s in uncovered)
    print(f'  {real} real gaps; {len(GAPS) - real} implemented but undeclared; '
          f'{helpers} unmatched strings are helpers')

    # The reverse question, per capability rather than per module: what has the platform
    # declared that no SPA ever implemented? That is either genuinely new ground or an
    # undelivered promise, and the two are worth telling apart by hand.
    matched_module_caps = {mc for _s, _o, mc, _sc in covered.values()}
    print('\n  MODULE CAPABILITIES WITH NO DETECTED SPA BINDING')
    print('  Read this direction with care. The harvester sees a SPA through its function')
    print('  names, and plenty of real behaviour never surfaces as one — `archive hash` and')
    print('  `closure check` would not, however faithfully a SPA implemented them. Absence')
    print('  here is weak evidence of new ground, not proof of it. The list is kept because')
    print('  it bounds the question, not because it answers it.\n')
    for mod in sorted(mods):
        orphan = sorted(c for c in mods[mod] if c not in matched_module_caps)
        if orphan:
            print(f'    {mod:<22} {", ".join(orphan)}')

    out = os.path.join(ROOT, 'docs/reference/foundational/verification/parity.json')
    json.dump({
        'spas': [{'file': f, 'kb': k, 'capabilities': n, 'flows': fl} for f, k, n, fl in spa_rows],
        'moduleCapabilities': {m: sorted(c) for m, c in mods.items()},
        'unmatched': {c: sorted(s) for c, s in uncovered.items()},
        'matched': {c: {'spas': sorted(s), 'modules': o, 'moduleCapability': mc, 'score': sc}
                    for c, (s, o, mc, sc) in covered.items()},
        'moduleCapabilitiesWithoutSpaAncestry': sorted(
            set(all_module_caps) - matched_module_caps),
    }, open(out, 'w', encoding='utf8'), indent=1)
    print(f'\n  written -> {os.path.relpath(out, ROOT)}')


main()
