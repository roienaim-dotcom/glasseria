# Glasseria Hebrew-Readable Logs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Glasseria admin logs understandable to a non-technical owner — plain-Hebrew error titles with collapsible technical detail — while removing duplicate visit/error logging and closing coverage gaps.

**Architecture:** Client (`logger.js`/`app.js`/`firebase-config.js`) captures rich raw fields (stack, Firestore `code`, navigation type, storage/persistence state). A new pure function `explainLog()` in `js/log-explain.js` translates a raw log into a Hebrew `{title, detail, severity}` at display time in the admin panel. Duplicate visits are collapsed via a `sessionStorage`-persisted session id + once-per-session visit log; duplicate Firestore errors via a per-load-phase flag.

**Tech Stack:** Vanilla JS (no build, no framework), Firebase 10.7.1 compat SDK, Firestore. Unit tests for the pure dictionary run under Node's built-in `assert`.

**Reference spec:** `docs/superpowers/specs/2026-06-23-glasseria-logs-hebrew-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `glasseria/js/log-explain.js` | **New.** Pure `explainLog(log)` + Hebrew dictionary. Browser global + Node module. |
| `glasseria/js/log-explain.test.js` | **New.** Node `assert` tests for `explainLog`. |
| `glasseria/js/logger.js` | Capture stack/code/navType/storage; sessionId persistence; once-per-session visit; image + network handlers; queue. |
| `glasseria/js/firebase-config.js` | Expose persistence result + log failure. |
| `glasseria/js/app.js` | Firestore `code` field + merged error log; storage-blocked warn; nav-timing in load timing. |
| `glasseria/admin/index.html` | Load `log-explain.js`; render Hebrew title + `<details>` technical accordion; show storage/persistence. |

> Note on TDD: only `log-explain.js` is pure and unit-testable (Task 1 = full red/green TDD). Tasks 2–5 touch browser/Firebase integration with no test harness in this project, so they are verified by **manual browser steps with explicit expected results** — the honest verification method here.

---

## Task 1: Hebrew explanation dictionary (`log-explain.js`)

**Files:**
- Create: `glasseria/js/log-explain.js`
- Test: `glasseria/js/log-explain.test.js`

- [ ] **Step 1: Write the failing test**

Create `glasseria/js/log-explain.test.js`:

```js
const assert = require('assert');
const { explainLog } = require('./log-explain.js');

let passed = 0, failed = 0;
function check(name, log, expectedTitle, expectedSeverity) {
    const r = explainLog(log);
    try {
        assert.strictEqual(r.title, expectedTitle, 'title');
        assert.strictEqual(r.severity, expectedSeverity, 'severity');
        passed++; console.log('  ✓ ' + name);
    } catch (e) {
        failed++; console.error('  ✗ ' + name + ' -> ' + JSON.stringify(r));
    }
}

check('session visit', { level: 'info', source: 'session', message: 'כניסה לאתר' }, 'כניסה לאתר', 'ok');
check('bfcache restore', { level: 'info', source: 'session', message: 'חזרה לעמוד מהמטמן' }, 'חזרה לעמוד (מהמטמן של הדפדפן)', 'ok');
check('timing ok', { level: 'timing', source: 'load', message: 'Loaded 50' }, 'האתר נטען בהצלחה', 'ok');
check('network offline', { level: 'warn', source: 'network', message: 'x' }, 'החיבור לאינטרנט נותק תוך כדי הגלישה', 'warn');
check('network online', { level: 'info', source: 'network', message: 'x' }, 'החיבור לאינטרנט חזר', 'ok');
check('fs permission-denied', { level: 'error', source: 'firestore', code: 'permission-denied' }, 'אין הרשאת גישה לנתונים — כנראה בעיה בהגדרות האבטחה של מסד הנתונים', 'error');
check('fs unavailable', { level: 'error', source: 'firestore', code: 'unavailable' }, 'השרת של גוגל לא היה זמין לרגע — תקלת רשת זמנית', 'error');
check('fs unknown', { level: 'error', source: 'firestore', code: 'weird' }, 'תקלה בהתחברות למסד הנתונים', 'error');
check('load timeout', { level: 'error', source: 'load', method: 'timeout' }, 'החיבור לאינטרנט איטי או לא יציב — המוצרים לא נטענו אחרי כמה ניסיונות', 'error');
check('load get-cache', { level: 'error', source: 'load', method: 'get-cache', message: 'Empty cache' }, 'אין נתונים שמורים במכשיר ואין חיבור לאינטרנט', 'error');
check('load get-server', { level: 'error', source: 'load', method: 'get-server' }, 'המוצרים לא נטענו מהשרת — בעיית רשת או שרת', 'error');
check('load warn', { level: 'warn', source: 'load', message: 'Timeout' }, 'הטעינה לקחה יותר מדי זמן — המערכת ניסתה דרך חלופית', 'warn');
check('image fail', { level: 'warn', source: 'image', message: 'a.jpg' }, 'תמונת מוצר לא נטענה — קישור שבור או בעיית רשת', 'warn');
check('persist multitab', { level: 'warn', source: 'persistence', code: 'failed-precondition' }, 'המטמן לא הופעל — האתר פתוח בכמה טאבים', 'warn');
check('persist unimpl', { level: 'warn', source: 'persistence', code: 'unimplemented' }, 'הדפדפן אינו תומך בשמירת מטמן (גלישה פרטית?)', 'warn');
check('storage blocked', { level: 'warn', source: 'storage' }, 'שמירת המועדפים נחסמה בדפדפן (דפדפן בתוך אפליקציה?)', 'warn');
check('global', { level: 'error', source: 'global', message: 'x is not defined' }, 'תקלה טכנית בקוד האתר', 'error');
check('promise', { level: 'error', source: 'promise' }, 'תקלה טכנית באתר — פעולה ברקע נכשלה', 'error');
check('fallback', { level: 'error', source: 'mystery' }, 'תקלה לא צפויה באתר', 'error');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "glasseria" && node js/log-explain.test.js`
Expected: FAIL — `Cannot find module './log-explain.js'`.

- [ ] **Step 3: Write the minimal implementation**

Create `glasseria/js/log-explain.js`:

```js
// Glasseria log explainer — translates a raw log entry to plain Hebrew.
// Pure function. Browser: window.explainLog. Node: module.exports (for tests).
(function (root) {
    'use strict';

    var FIRESTORE_CODES = {
        'permission-denied': 'אין הרשאת גישה לנתונים — כנראה בעיה בהגדרות האבטחה של מסד הנתונים',
        'unavailable': 'השרת של גוגל לא היה זמין לרגע — תקלת רשת זמנית',
        'deadline-exceeded': 'השרת לא הגיב בזמן — חיבור איטי',
        'failed-precondition': 'בעיה בהגדרות מסד הנתונים (חסר אינדקס או הרשאות)',
        'unauthenticated': 'נדרשת התחברות מחדש למסד הנתונים',
        'resource-exhausted': 'חריגה ממכסת השימוש של מסד הנתונים'
    };

    function explainLog(log) {
        log = log || {};
        var level = log.level || '';
        var source = log.source || '';
        var code = log.code || '';
        var method = log.method || '';
        var message = log.message || '';

        if (level === 'timing') return { title: 'האתר נטען בהצלחה', detail: message, severity: 'ok' };

        if (source === 'session') {
            if (/מטמן/.test(message)) return { title: 'חזרה לעמוד (מהמטמן של הדפדפן)', detail: message, severity: 'ok' };
            return { title: 'כניסה לאתר', detail: message, severity: 'ok' };
        }

        if (source === 'network') {
            if (level === 'warn') return { title: 'החיבור לאינטרנט נותק תוך כדי הגלישה', detail: message, severity: 'warn' };
            return { title: 'החיבור לאינטרנט חזר', detail: message, severity: 'ok' };
        }

        if (source === 'firestore') {
            if (code && FIRESTORE_CODES[code]) return { title: FIRESTORE_CODES[code], detail: message, severity: 'error' };
            return { title: 'תקלה בהתחברות למסד הנתונים', detail: message, severity: 'error' };
        }

        if (source === 'load') {
            if (level === 'warn') return { title: 'הטעינה לקחה יותר מדי זמן — המערכת ניסתה דרך חלופית', detail: message, severity: 'warn' };
            if (method === 'timeout') return { title: 'החיבור לאינטרנט איטי או לא יציב — המוצרים לא נטענו אחרי כמה ניסיונות', detail: message, severity: 'error' };
            if (method === 'get-cache') return { title: 'אין נתונים שמורים במכשיר ואין חיבור לאינטרנט', detail: message, severity: 'error' };
            return { title: 'המוצרים לא נטענו מהשרת — בעיית רשת או שרת', detail: message, severity: 'error' };
        }

        if (source === 'image') return { title: 'תמונת מוצר לא נטענה — קישור שבור או בעיית רשת', detail: message, severity: 'warn' };

        if (source === 'persistence') {
            if (code === 'failed-precondition') return { title: 'המטמן לא הופעל — האתר פתוח בכמה טאבים', detail: message, severity: 'warn' };
            return { title: 'הדפדפן אינו תומך בשמירת מטמן (גלישה פרטית?)', detail: message, severity: 'warn' };
        }

        if (source === 'storage') return { title: 'שמירת המועדפים נחסמה בדפדפן (דפדפן בתוך אפליקציה?)', detail: message, severity: 'warn' };

        if (source === 'global') return { title: 'תקלה טכנית בקוד האתר', detail: message, severity: 'error' };

        if (source === 'promise') return { title: 'תקלה טכנית באתר — פעולה ברקע נכשלה', detail: message, severity: 'error' };

        if (level === 'info') return { title: message || 'מידע', detail: message, severity: 'ok' };

        return { title: 'תקלה לא צפויה באתר', detail: message, severity: 'error' };
    }

    root.explainLog = explainLog;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { explainLog: explainLog, FIRESTORE_CODES: FIRESTORE_CODES };
    }
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "glasseria" && node js/log-explain.test.js`
Expected: PASS — `19 passed, 0 failed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
cd "glasseria"
git add js/log-explain.js js/log-explain.test.js
git commit -m "feat(logs): add Hebrew explainLog dictionary with Node tests"
```

---

## Task 2: Enrich client capture & de-duplicate visits (`logger.js`)

**Files:**
- Modify: `glasseria/js/logger.js`

- [ ] **Step 1: Persist sessionId in sessionStorage**

In `glasseria/js/logger.js`, replace line 9:

```js
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
```

with:

```js
    function _getOrCreateSessionId() {
        const KEY = 'glasseria_sid';
        const fresh = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        try {
            let sid = sessionStorage.getItem(KEY);
            if (!sid) { sid = fresh(); sessionStorage.setItem(KEY, sid); }
            return sid;
        } catch (e) { return fresh(); }
    }
    const sessionId = _getOrCreateSessionId();
```

- [ ] **Step 2: Add navigation-type, nav-timing, and storage helpers**

In `glasseria/js/logger.js`, immediately after the `const deviceId = _getOrCreateDeviceId();` line (currently line 26), add:

```js
    // Navigation type: navigate | reload | back_forward
    function _getNavigationType() {
        try {
            const nav = performance.getEntriesByType('navigation')[0];
            return nav ? nav.type : 'unknown';
        } catch (e) { return 'unknown'; }
    }

    // Detailed navigation timing (best-effort)
    function _getNavTiming() {
        try {
            const nav = performance.getEntriesByType('navigation')[0];
            if (!nav) return {};
            return {
                ttfbMs: Math.round(nav.responseStart),
                domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
                loadEventMs: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : null
            };
        } catch (e) { return {}; }
    }

    // Storage usage/quota (async, non-blocking; read at send time)
    let _storageInfo = null;
    (function _captureStorage() {
        try {
            if (navigator.storage && navigator.storage.estimate) {
                navigator.storage.estimate().then(function (est) {
                    _storageInfo = {
                        usageMB: est.usage ? Math.round(est.usage / 1048576) : null,
                        quotaMB: est.quota ? Math.round(est.quota / 1048576) : null
                    };
                }).catch(function () {});
            }
        } catch (e) {}
    })();
```

- [ ] **Step 3: Refactor `_send` into queue + writer with new fields**

In `glasseria/js/logger.js`, replace the entire `_send` function (currently lines 131-152) with:

```js
    // Build the document and write it (fire-and-forget)
    function _writeDoc(entry) {
        const doc = {
            ...entry,
            sessionId,
            deviceId,
            device: Object.assign({}, deviceInfo, {
                storage: _storageInfo,
                persistence: (typeof window !== 'undefined' && window._glasseriaPersistence) || null
            }),
            deviceType: _getDeviceType(),
            navigationType: _getNavigationType(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            clientTime: new Date().toISOString(),
            url: window.location.href
        };
        db.collection(COLLECTION).add(doc).catch(() => {});
    }

    // Queue logs created before Firestore is available; flush when it is.
    let _queue = [];
    function _flushQueue() {
        if (typeof db === 'undefined' || !db || !_queue.length) return;
        const q = _queue; _queue = [];
        q.forEach(_writeDoc);
    }

    // Send log to Firestore (fire-and-forget, never blocks UI)
    function _send(entry) {
        if (logCount >= MAX_LOGS_PER_SESSION) return;
        logCount++;
        if (typeof db === 'undefined' || !db) {
            if (_queue.length < MAX_LOGS_PER_SESSION) _queue.push(entry);
            return;
        }
        _flushQueue();
        _writeDoc(entry);
    }
    // Belt-and-suspenders flush in case Firestore SDK came up after first logs
    setTimeout(_flushQueue, 3000);
```

- [ ] **Step 4: Capture stack + handle image errors in global handlers**

In `glasseria/js/logger.js`, replace the `setupGlobalErrorHandlers()` method body (currently the `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)` blocks, lines 197-211) with:

```js
        setupGlobalErrorHandlers() {
            // Capture phase = true so resource (img/script) load failures are caught too
            window.addEventListener('error', (e) => {
                const target = e.target;
                if (target && target !== window && target.tagName) {
                    if (target.tagName.toLowerCase() === 'img') {
                        const src = target.src || target.currentSrc || 'unknown';
                        this.warn('image', 'תמונה לא נטענה: ' + src, { src });
                    }
                    return; // other resource errors ignored for now
                }
                this.error('global', e.message || 'Unknown error', {
                    filename: e.filename,
                    line: e.lineno,
                    col: e.colno,
                    stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 1000) : ''
                });
            }, true);

            window.addEventListener('unhandledrejection', (e) => {
                const reason = e.reason;
                const msg = (reason && reason.message) || (reason && reason.toString && reason.toString()) || 'Unhandled promise rejection';
                this.error('promise', msg, {
                    stack: reason && reason.stack ? String(reason.stack).slice(0, 1000) : ''
                });
            });
        },
```

- [ ] **Step 5: Add nav-timing to load timing log**

In `glasseria/js/logger.js`, in the `logLoadTime` method (currently lines 173-183), add `..._getNavTiming()` as the last property of the `_send({...})` object:

```js
        logLoadTime(method, productCount, durationMs) {
            _send({
                level: 'timing',
                source: 'load',
                message: `Loaded ${productCount} products via ${method}`,
                method,
                productCount,
                durationMs,
                timeSincePageLoad: Date.now() - sessionStart,
                ..._getNavTiming()
            });
        },
```

- [ ] **Step 6: Visit-once, bfcache, and network listeners at module end**

In `glasseria/js/logger.js`, replace the final block (currently lines 220-227, from `// Auto-setup global error handlers` to the end) with:

```js
// Auto-setup global error handlers
GlasseriaLogger.setupGlobalErrorHandlers();

// Log every visit ONCE per browser-tab session (reloads reuse the same session, no duplicate)
(function logVisitOnce() {
    const KEY = 'glasseria_visit_logged';
    try {
        if (sessionStorage.getItem(KEY)) return;
        sessionStorage.setItem(KEY, '1');
    } catch (e) { /* storage blocked: fall through and log anyway */ }
    GlasseriaLogger.info('session', 'כניסה לאתר', {
        referrer: document.referrer || 'direct'
    });
})();

// Back/forward bfcache restore: scripts don't re-run, so note the revisit explicitly
window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
        GlasseriaLogger.info('session', 'חזרה לעמוד מהמטמן');
    }
});

// Connectivity changes during the session
window.addEventListener('offline', () => GlasseriaLogger.warn('network', 'החיבור לאינטרנט נותק'));
window.addEventListener('online', () => GlasseriaLogger.info('network', 'החיבור לאינטרנט חזר'));
```

- [ ] **Step 7: Verify in browser**

Run a local server: `cd "glasseria" && python3 -m http.server 8000`. Open `http://localhost:8000/`.
- Open DevTools console: no errors thrown by logger.js.
- Application → Session Storage: keys `glasseria_sid` and `glasseria_visit_logged` exist.
- Reload the page. Confirm `glasseria_sid` value is **unchanged** (same session) — this is the de-dup proof.
Expected: page loads normally, both keys present, sid stable across reload.

- [ ] **Step 8: Commit**

```bash
cd "glasseria"
git add js/logger.js
git commit -m "feat(logs): capture stack/nav/storage, dedupe visits, log image+network failures"
```

---

## Task 3: Expose persistence result (`firebase-config.js`)

**Files:**
- Modify: `glasseria/js/firebase-config.js`

- [ ] **Step 1: Record persistence outcome and log failures**

In `glasseria/js/firebase-config.js`, replace the `db.enablePersistence(...)` block (currently lines 30-39) with:

```js
db.enablePersistence({ synchronizeTabs: true })
    .then(() => { window._glasseriaPersistence = 'ok'; })
    .catch((err) => {
        window._glasseriaPersistence = err.code || 'error';
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence: multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence: not supported by browser');
        } else {
            console.warn('Firestore persistence error:', err.code, err.message);
        }
        // Surface to the admin log (logger.js has loaded by the time this async catch runs)
        if (typeof GlasseriaLogger !== 'undefined') {
            GlasseriaLogger.warn('persistence', 'Persistence failed: ' + (err.code || err.message || 'unknown'), { code: err.code || '' });
        }
    });
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:8000/`. In DevTools console run: `window._glasseriaPersistence`.
Expected: `"ok"` on a normal single-tab load. Open the same URL in a second tab and reload the first → first tab logs `failed-precondition` (multi-tab) and console shows the multi-tab warning.

- [ ] **Step 3: Commit**

```bash
cd "glasseria"
git add js/firebase-config.js
git commit -m "feat(logs): record Firestore persistence result and log failures"
```

---

## Task 4: Merge Firestore errors, add code field, storage warn (`app.js`)

**Files:**
- Modify: `glasseria/js/app.js`

- [ ] **Step 1: Reset the per-load error flag**

In `glasseria/js/app.js`, in `loadAllData()`, immediately after the line `window._glasseriaLoadStart = Date.now();` (live baseline line 824), add:

```js
    window._firestoreErrorLogged = false; // reset per load-phase: only one merged firestore error per load
```

- [ ] **Step 2: Merge Firestore onSnapshot errors into one log**

In `glasseria/js/app.js`, replace the `handleError` definition (live baseline lines 871-884) with:

```js
    const handleError = (source) => (error) => {
        if (listenersCancelled) return; // Ignore errors from cancelled listeners
        console.error(`Error loading ${source}:`, error);
        // One merged log per load-phase instead of one per collection
        if (!window._firestoreErrorLogged) {
            window._firestoreErrorLogged = true;
            GlasseriaLogger.error('firestore', `onSnapshot error (${source}): ${error.message || error.code || error}`, {
                code: error.code || '',
                firstCollection: source
            });
        }
        // Don't immediately give up - try fallback
        if (!productsLoaded && source === 'products') {
            console.log(`onSnapshot error for ${source}, trying get() fallback...`);
            if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
            loadDataWithGet();
        } else if (!productsLoaded) {
            console.warn(`onSnapshot error for ${source}, will retry via get if products also fail`);
        }
    };
```

- [ ] **Step 3: Add code field to listener-setup failure**

In `glasseria/js/app.js`, replace line 941 (`Listener setup failed`):

```js
        GlasseriaLogger.error('firestore', `Listener setup failed: ${error.message || error}`);
```

with:

```js
        GlasseriaLogger.error('firestore', `Listener setup failed: ${error.message || error}`, { code: error.code || '' });
```

- [ ] **Step 4: Log storage-blocked once in safe helpers**

In `glasseria/js/app.js`, replace the safe-storage helpers (currently lines 4-10) with:

```js
// Safe localStorage/sessionStorage helpers (some in-app browsers block storage)
let _storageBlockedWarned = false;
function _warnStorageBlocked(e) {
    if (_storageBlockedWarned) return;
    _storageBlockedWarned = true;
    if (typeof GlasseriaLogger !== 'undefined') {
        GlasseriaLogger.warn('storage', 'שמירה מקומית נחסמה: ' + (e && e.message ? e.message : e));
    }
}
function safeSetStorage(key, value, session = false) {
    try { (session ? sessionStorage : localStorage).setItem(key, value); } catch(e) { _warnStorageBlocked(e); }
}
function safeGetStorage(key, session = false) {
    try { return (session ? sessionStorage : localStorage).getItem(key); } catch(e) { return null; }
}
```

- [ ] **Step 5: Verify in browser (simulate a Firestore error)**

Reload `http://localhost:8000/`. In DevTools, open Network → set "Offline", then in console run `loadAllData()`.
Expected: console shows the timeout/fallback path; **only one** `firestore`-source error is produced for the load phase (not three). Re-enable network to restore.

- [ ] **Step 6: Commit**

```bash
cd "glasseria"
git add js/app.js
git commit -m "feat(logs): merge Firestore errors, add error code field, log blocked storage"
```

---

## Task 5: Render Hebrew titles + technical accordion (`admin/index.html`)

**Files:**
- Modify: `glasseria/admin/index.html`

- [ ] **Step 1: Load the explainer in the admin panel**

In `glasseria/admin/index.html`, after line 2183 (`firebase-auth-compat.js`) and before the inline `<script>` at line 2185, add:

```html
    <script src="../js/log-explain.js"></script>
```

- [ ] **Step 2: Add accordion CSS**

In `glasseria/admin/index.html`, inside the `/* ===== Logs Viewer ===== */` style block, after the `.log-entry .log-header { ... }` rule (around line 1567), add:

```css
        .log-tech { margin-top: 6px; }
        .log-tech summary { cursor: pointer; color: var(--secondary); font-size: 12px; user-select: none; }
        .log-tech summary:hover { color: var(--primary); }
        .log-tech pre {
            white-space: pre-wrap; word-break: break-word;
            background: #f8f9fa; border: 1px solid #eee; border-radius: 6px;
            padding: 8px; margin-top: 6px; font-size: 11px;
            direction: ltr; text-align: left; max-height: 240px; overflow: auto;
        }
```

- [ ] **Step 3: Render Hebrew title + technical accordion**

In `glasseria/admin/index.html`, replace the inner `entries` map (currently lines 4561-4576) with:

```js
                const entries = session.logs.map(log => {
                    const logTime = log.timestamp ? log.timestamp.toDate().toLocaleTimeString('he-IL') : '';
                    const exp = (typeof explainLog === 'function')
                        ? explainLog(log)
                        : { title: log.message || '', detail: log.message || '', severity: log.level };
                    const sevColor = exp.severity === 'error' ? 'var(--danger)'
                        : (exp.severity === 'warn' ? 'var(--warning)' : '#1565c0');

                    let details = '';
                    if (log.durationMs) details += `<span>⏱ ${(log.durationMs / 1000).toFixed(1)}s</span>`;
                    if (log.productCount) details += `<span>📦 ${log.productCount} מוצרים</span>`;
                    if (log.retryCount) details += `<span>🔄 ${log.retryCount} ניסיונות</span>`;
                    if (log.referrer && log.referrer !== 'direct') details += `<span>🔗 ${_escHtml(log.referrer)}</span>`;

                    const tech = [];
                    if (log.message) tech.push('הודעה: ' + _escHtml(log.message));
                    if (log.code) tech.push('קוד: ' + _escHtml(log.code));
                    if (log.method) tech.push('שיטה: ' + _escHtml(log.method));
                    if (log.filename) tech.push('קובץ: ' + _escHtml(log.filename) + (log.line ? ':' + log.line + (log.col ? ':' + log.col : '') : ''));
                    if (log.navigationType) tech.push('ניווט: ' + _escHtml(log.navigationType));
                    if (log.stack) tech.push('Stack:\n' + _escHtml(log.stack));
                    const techBlock = tech.length
                        ? `<details class="log-tech"><summary>פרטים טכניים</summary><pre>${tech.join('\n')}</pre></details>`
                        : '';

                    return `<div class="log-entry">
                        <div class="log-header"><span class="log-badge ${log.level}">${log.level}</span><span class="log-time">${logTime}</span></div>
                        <div class="log-message" style="font-weight:600;color:${sevColor}">${_escHtml(exp.title)}</div>
                        ${details ? `<div class="log-details">${details}</div>` : ''}
                        ${techBlock}
                    </div>`;
                }).join('');
```

- [ ] **Step 4: Show storage + persistence in the device info block**

In `glasseria/admin/index.html`, in `renderSessions`, inside the `log-device-info` block (currently lines 4593-4597), add these two lines right after the `dev.memory` line:

```js
                            ${dev.storage ? `<div class="device-detail">🗄 אחסון: ${dev.storage.usageMB != null ? dev.storage.usageMB : '?'}MB / ${dev.storage.quotaMB != null ? dev.storage.quotaMB : '?'}MB</div>` : ''}
                            ${dev.persistence ? `<div class="device-detail">📦 מטמן: ${dev.persistence === 'ok' ? 'פעיל' : 'לא פעיל (' + _escHtml(dev.persistence) + ')'}</div>` : ''}
```

Note: the condition `${deviceDetail || connDetail ? ...}` currently gates the whole block. Change that opening condition (line 4593) to also show when storage/persistence exist:

```js
                        ${deviceDetail || connDetail || dev.storage || dev.persistence ? `<div class="log-device-info">
```

- [ ] **Step 5: Verify in browser**

Open `http://localhost:8000/admin/` and log in. Go to the Logs tab.
Expected:
- Each entry shows a **bold Hebrew title** colored by severity (red/orange/blue).
- A `▸ פרטים טכניים` toggle appears on entries that have technical data; clicking expands an LTR `<pre>` with message/code/file/stack.
- The device line shows `🗄 אחסון: …MB / …MB` and `📦 מטמון: פעיל`.
- The session that was reloaded in Task 2 appears **once**, not twice.

- [ ] **Step 6: Commit**

```bash
cd "glasseria"
git add admin/index.html
git commit -m "feat(logs): show plain-Hebrew titles, technical accordion, storage/persistence in admin"
```

---

## Task 6: Post-edit review

- [ ] **Step 1: Run the project's post-edit review protocol**

Per the user's MANDATORY post-edit review protocol, dispatch the parallel review agents over the changed files (`js/log-explain.js`, `js/logger.js`, `js/firebase-config.js`, `js/app.js`, `admin/index.html`) checking: correctness, no regressions to the load flow, Hebrew/RTL correctness, XSS-safety of rendered fields (all log fields pass through `_escHtml`), and that no site behavior changed.

- [ ] **Step 2: Re-run unit tests**

Run: `cd "glasseria" && node js/log-explain.test.js`
Expected: `19 passed, 0 failed`.

- [ ] **Step 3: Address any findings, then report completion to the user.**

---

## Self-Review

**Spec coverage:**
- Component A (rich capture: stack/code/navType/storage/persistence) → Tasks 2, 3, 4. ✓
- Component B (explainLog dictionary, Node-testable) → Task 1. ✓
- Component C (admin Hebrew title + accordion) → Task 5. ✓
- Component D (sessionId persistence + merged Firestore errors) → Task 2 Step 1/6, Task 4 Step 1/2. ✓
- Component E (image failures, persistence log, storage-blocked, network events) → Task 2 Step 4/6, Task 3, Task 4 Step 4. ✓
- Component F (silent-death queue) → Task 2 Step 3. ✓
- Optional (nav timing, online/offline, navigationType) → Task 2 Step 2/5/6. ✓
- Dictionary table (spec §5) → Task 1 test cases cover every row. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code. ✓

**Type/name consistency:** `window._glasseriaPersistence` set in Task 3, read in Task 2 Step 3. `window._firestoreErrorLogged` reset in Task 4 Step 1, used in Step 2. `_storageInfo`/`_getNavTiming`/`_getNavigationType` defined in Task 2 Step 2, used in Step 3/5. `explainLog` returns `{title, detail, severity}` in Task 1, consumed in Task 5 Step 3. `source` values (`session`/`network`/`firestore`/`load`/`image`/`persistence`/`storage`/`global`/`promise`) match between producers (Tasks 2-4) and the dictionary (Task 1). ✓
