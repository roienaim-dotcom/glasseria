// ===== Glasseria Client Logger =====
// Saves error/warning logs + load timing to Firestore collection 'glasseria_logs'
// Lightweight, async, non-blocking - does NOT affect site performance

const GlasseriaLogger = (() => {
    const COLLECTION = 'glasseria_logs';
    const MAX_LOGS_PER_SESSION = 10; // Prevent spam
    let logCount = 0;
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

    // Send log to Firestore (fire-and-forget, never blocks UI)
    function _send(entry) {
        if (logCount >= MAX_LOGS_PER_SESSION) return;
        if (typeof db === 'undefined') return; // Firestore not loaded yet
        logCount++;

        const doc = {
            ...entry,
            sessionId,
            deviceId,
            device: deviceInfo,
            deviceType: _getDeviceType(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            clientTime: new Date().toISOString(),
            url: window.location.href
        };

        // Fire-and-forget - don't await, don't block
        db.collection(COLLECTION).add(doc).catch(() => {
            // Silently fail - logging should never break the app
        });
    }

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
                timeSincePageLoad: Date.now() - sessionStart
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
            window.addEventListener('error', (e) => {
                this.error('global', e.message || 'Unknown error', {
                    filename: e.filename,
                    line: e.lineno,
                    col: e.colno
                });
            });

            window.addEventListener('unhandledrejection', (e) => {
                const reason = e.reason;
                const msg = reason?.message || reason?.toString?.() || 'Unhandled promise rejection';
                this.error('promise', msg);
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

// Log every visit (session start)
GlasseriaLogger.info('session', 'כניסה לאתר', {
    referrer: document.referrer || 'direct'
});
