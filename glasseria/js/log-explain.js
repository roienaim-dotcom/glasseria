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
            if (/מטמון/.test(message)) return { title: 'חזרה לעמוד (מהמטמון של הדפדפן)', detail: message, severity: 'ok' };
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
            if (code === 'failed-precondition') return { title: 'המטמון לא הופעל — האתר פתוח בכמה טאבים', detail: message, severity: 'warn' };
            return { title: 'הדפדפן אינו תומך בשמירת מטמון (גלישה פרטית?)', detail: message, severity: 'warn' };
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
