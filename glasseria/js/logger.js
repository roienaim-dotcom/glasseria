// ===== Glasseria Client Logger =====
// Saves error/warning logs + load timing to Firestore collection 'glasseria_logs'
// Lightweight, async, non-blocking - does NOT affect site performance

const GlasseriaLogger = (() => {
    const COLLECTION = 'glasseria_logs';
    const MAX_LOGS_PER_SESSION = 10; // Prevent spam
    let logCount = 0;
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
    const sessionStart = Date.now();

    // Persistent device ID - survives across sessions on same browser
    function _getOrCreateDeviceId() {
        const KEY = 'glasseria_did';
        try {
            let did = localStorage.getItem(KEY);
            if (!did) {
                did = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
                localStorage.setItem(KEY, did);
            }
            return did;
        } catch (e) {
            return 'did_unavailable'; // Private browsing / blocked
        }
    }
    const deviceId = _getOrCreateDeviceId();

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

    // Parse OS from user agent
    function _parseOS(ua) {
        if (/Windows NT 10/.test(ua)) return 'Windows 10+';
        if (/Windows NT 6\.3/.test(ua)) return 'Windows 8.1';
        if (/Windows NT 6\.2/.test(ua)) return 'Windows 8';
        if (/Windows NT 6\.1/.test(ua)) return 'Windows 7';
        if (/Windows/.test(ua)) return 'Windows';
        const androidMatch = ua.match(/Android ([\d.]+)/);
        if (androidMatch) return 'Android ' + androidMatch[1];
        const iosMatch = ua.match(/OS ([\d_]+) like Mac/);
        if (iosMatch) return 'iOS ' + iosMatch[1].replace(/_/g, '.');
        if (/Mac OS X/.test(ua)) {
            const macVer = ua.match(/Mac OS X ([\d_.]+)/);
            return macVer ? 'macOS ' + macVer[1].replace(/_/g, '.') : 'macOS';
        }
        if (/CrOS/.test(ua)) return 'ChromeOS';
        if (/Linux/.test(ua)) return 'Linux';
        return 'Unknown';
    }

    // Parse browser from user agent
    function _parseBrowser(ua) {
        let m;
        if ((m = ua.match(/SamsungBrowser\/([\d.]+)/))) return 'Samsung Browser ' + m[1];
        if ((m = ua.match(/OPR\/([\d.]+)/))) return 'Opera ' + m[1];
        if ((m = ua.match(/Edg\/([\d.]+)/))) return 'Edge ' + m[1];
        if ((m = ua.match(/UCBrowser\/([\d.]+)/))) return 'UC Browser ' + m[1];
        if ((m = ua.match(/Firefox\/([\d.]+)/))) return 'Firefox ' + m[1];
        // Check in-app browsers before Chrome/Safari
        if (/FBAN|FBAV/.test(ua)) return 'Facebook App';
        if (/Instagram/.test(ua)) return 'Instagram App';
        if (/Line\//i.test(ua)) return 'Line App';
        if (/Twitter/.test(ua)) return 'Twitter App';
        if ((m = ua.match(/CriOS\/([\d.]+)/))) return 'Chrome iOS ' + m[1];
        if ((m = ua.match(/Chrome\/([\d.]+)/))) return 'Chrome ' + m[1];
        if ((m = ua.match(/Version\/([\d.]+).*Safari/))) return 'Safari ' + m[1];
        if (/Safari/.test(ua)) return 'Safari';
        return 'Unknown';
    }

    // Parse device model (best-effort from UA)
    function _parseDeviceModel(ua) {
        // Android device model: between "; " and " Build/"
        const androidModel = ua.match(/;\s*([^;)]+)\s*Build\//);
        if (androidModel) return androidModel[1].trim();
        // iPad
        if (/iPad/.test(ua)) return 'iPad';
        // iPhone
        if (/iPhone/.test(ua)) return 'iPhone';
        return '';
    }

    // Detect in-app browser
    function _isInAppBrowser(ua) {
        if (/FBAN|FBAV/.test(ua)) return 'facebook';
        if (/Instagram/.test(ua)) return 'instagram';
        if (/Line\//i.test(ua)) return 'line';
        if (/Twitter/.test(ua)) return 'twitter';
        if (/\bwv\b/.test(ua)) return 'webview';
        return '';
    }

    const ua = navigator.userAgent || '';

    // Connection info (extended)
    function _getConnectionInfo() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (!conn) return { effectiveType: 'unknown' };
        return {
            effectiveType: conn.effectiveType || 'unknown',
            downlink: conn.downlink, // Mbps estimate
            rtt: conn.rtt, // Round-trip time ms
            saveData: conn.saveData || false // Data saver mode
        };
    }

    // Device info (collected once)
    const deviceInfo = {
        ua: ua.slice(0, 300),
        os: _parseOS(ua),
        browser: _parseBrowser(ua),
        deviceModel: _parseDeviceModel(ua),
        inApp: _isInAppBrowser(ua),
        platform: navigator.platform || '',
        screen: `${screen.width}x${screen.height}`,
        dpr: window.devicePixelRatio || 1,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        connection: _getConnectionInfo(),
        memory: navigator.deviceMemory || null, // GB RAM (Chrome only)
        cores: navigator.hardwareConcurrency || null,
        language: navigator.language || '',
        online: navigator.onLine,
        cookiesEnabled: navigator.cookieEnabled,
        touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0
    };

    function _getDeviceType() {
        const w = window.innerWidth;
        if (w < 768) return 'mobile';
        if (w < 1024) return 'tablet';
        return 'desktop';
    }

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
        // Fire-and-forget - don't await, don't block
        db.collection(COLLECTION).add(doc).catch(() => {
            // Silently fail - logging should never break the app
        });
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

    return {
        // Log an error
        error(source, message, extra = {}) {
            console.error(`[Logger] ${source}: ${message}`);
            _send({ level: 'error', source, message, ...extra });
        },

        // Log a warning
        warn(source, message, extra = {}) {
            console.warn(`[Logger] ${source}: ${message}`);
            _send({ level: 'warn', source, message, ...extra });
        },

        // Log general info (use sparingly)
        info(source, message, extra = {}) {
            _send({ level: 'info', source, message, ...extra });
        },

        // Log load timing - call when products finish loading
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

        // Log load failure
        logLoadFailure(method, errorMsg, retryCount) {
            _send({
                level: 'error',
                source: 'load',
                message: `Load failed: ${method} - ${errorMsg}`,
                method,
                retryCount
            });
        },

        // Capture unhandled errors globally
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

        // Get session start time (for calculating load duration)
        getSessionStart() {
            return sessionStart;
        }
    };
})();

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
