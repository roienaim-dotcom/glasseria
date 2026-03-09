// ===== Glasseria Client Logger =====
// Saves error/warning logs + load timing to Firestore collection 'glasseria_logs'
// Lightweight, async, non-blocking - does NOT affect site performance

const GlasseriaLogger = (() => {
    const COLLECTION = 'glasseria_logs';
    const MAX_LOGS_PER_SESSION = 10; // Prevent spam
    let logCount = 0;
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const sessionStart = Date.now();

    // Device info (collected once)
    const deviceInfo = {
        ua: navigator.userAgent.slice(0, 200),
        platform: navigator.platform || '',
        screen: `${screen.width}x${screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        connection: navigator.connection ? navigator.connection.effectiveType : 'unknown',
        language: navigator.language || '',
        online: navigator.onLine
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
