// Glasseria log explainer — translates a raw log entry to plain Hebrew.
// Pure function. Browser: window.explainLog. Node: module.exports (for tests).
// Returns { title, detail, action, severity, fixable }.
//   action  = concrete Hebrew "what to do" (empty string when nothing to do)
//   fixable = 'owner' | 'developer' | 'visitor' | 'none'  (who can act)
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

    // "What to do" per Firestore error code
    var FIRESTORE_ACTIONS = {
        'permission-denied': 'בדקו את חוקי האבטחה ב-Firebase Console (Firestore → Rules), או פנו למפתח.',
        'unavailable': 'בדרך כלל חולף מעצמו. אם חוזר הרבה — בדקו את סטטוס השירות של Firebase.',
        'deadline-exceeded': 'לרוב חיבור איטי אצל הלקוח. אם חוזר אצל מבקרים רבים — ייתכן עומס בשרת.',
        'failed-precondition': 'ייתכן שחסר אינדקס ב-Firestore או שיש בעיית הרשאות — פנו למפתח.',
        'unauthenticated': 'רעננו את הדף. אם חוזר — פנו למפתח.',
        'resource-exhausted': 'נגמרה המכסה של Firebase — שדרגו תוכנית או המתינו לאיפוס היומי (חצות שעון האוקיינוס השקט).'
    };

    function make(title, detail, action, severity, fixable) {
        return {
            title: title,
            detail: detail || '',
            action: action || '',
            severity: severity,
            fixable: fixable || 'none'
        };
    }

    function explainLog(log) {
        log = log || {};
        var level = log.level || '';
        var source = log.source || '';
        var code = log.code || '';
        var method = log.method || '';
        var message = log.message || '';

        if (level === 'timing') {
            // Cache-only load means the server was unreachable — this is NOT a clean success
            if (method === 'get-cache' || method === 'onSnapshot-cache') {
                return make('האתר הוצג מגרסה שמורה — לא היה חיבור לשרת', message,
                    'האתר עבד אבל הציג מידע שמור (ייתכן לא מעודכן). בדקו שיש חיבור ל-Firebase ושחוקי הקריאה תקינים.',
                    'warn', 'owner');
            }
            // Loaded, but with zero products
            if (log.productCount === 0) {
                return make('האתר נטען אבל בלי מוצרים', message,
                    'בדקו שיש מוצרים בקטלוג ושחוקי הקריאה של glasseria_products מאפשרים קריאה ציבורית.',
                    'error', 'owner');
            }
            // Loaded but very slowly
            if (typeof log.durationMs === 'number' && log.durationMs > 8000) {
                return make('האתר נטען — אבל לאט (' + Math.round(log.durationMs / 1000) + ' שניות)', message,
                    'אם זה חוזר אצל מבקרים רבים — שקלו לשפר את מהירות הטעינה. בודדים = חיבור איטי אצל הלקוח.',
                    'warn', 'developer');
            }
            return make('האתר נטען בהצלחה', message, '', 'ok', 'none');
        }

        if (source === 'session') {
            if (/מטמון/.test(message)) return make('חזרה לעמוד (מהמטמון של הדפדפן)', message, '', 'ok', 'none');
            return make('כניסה לאתר', message, '', 'ok', 'none');
        }

        if (source === 'network') {
            if (level === 'warn') return make('החיבור לאינטרנט נותק תוך כדי הגלישה', message,
                'תקלת רשת אצל המבקר — אין צורך בפעולה מצידכם.', 'warn', 'visitor');
            return make('החיבור לאינטרנט חזר', message, '', 'ok', 'none');
        }

        if (source === 'firestore') {
            if (code && FIRESTORE_CODES[code]) {
                return make(FIRESTORE_CODES[code], message, FIRESTORE_ACTIONS[code] || '', 'error',
                    (code === 'permission-denied' || code === 'resource-exhausted') ? 'owner' : 'developer');
            }
            return make('תקלה בהתחברות למסד הנתונים', message,
                'בדקו את החיבור ל-Firebase. אם חוזר — פנו למפתח עם הפרטים הטכניים.', 'error', 'developer');
        }

        if (source === 'load') {
            // Apply the Firestore code map here too, so a permission error during the
            // get() fallback isn't mislabeled as a generic "network problem"
            if (code && FIRESTORE_CODES[code]) {
                return make(FIRESTORE_CODES[code], message, FIRESTORE_ACTIONS[code] || '', 'error',
                    (code === 'permission-denied' || code === 'resource-exhausted') ? 'owner' : 'developer');
            }
            if (level === 'warn') return make('הטעינה לקחה יותר מדי זמן — המערכת ניסתה דרך חלופית', message,
                'אם זה חוזר אצל מבקרים רבים — ייתכן בעיה בשרת/בחיבור. בודדים = חיבור איטי אצל הלקוח.', 'warn', 'visitor');
            if (method === 'timeout') return make('החיבור לאינטרנט איטי או לא יציב — המוצרים לא נטענו אחרי כמה ניסיונות', message,
                'אם זה חוזר אצל מבקרים רבים — בדקו את השרת/החוקים. בודדים = חיבור איטי אצל הלקוח.', 'error', 'visitor');
            if (method === 'get-cache') return make('אין נתונים שמורים במכשיר ואין חיבור לאינטרנט', message,
                'תקלת רשת אצל המבקר בביקור ראשון. אם חוזר אצל רבים — בדקו את החיבור ל-Firebase.', 'error', 'visitor');
            return make('המוצרים לא נטענו מהשרת — בעיית רשת או שרת', message,
                'אם זה חוזר אצל מבקרים רבים — בדקו את החיבור ל-Firebase ואת חוקי הקריאה.', 'error', 'developer');
        }

        if (source === 'image') {
            // Include the product identity when the log carries it, so the owner knows exactly
            // which product image to replace
            var who = log.productName ? ('תמונת המוצר "' + log.productName + '"' + (log.sku ? ' (מק"ט ' + log.sku + ')' : '')) : 'תמונת מוצר';
            return make(who + ' לא נטענה — קישור שבור או בעיית רשת', message,
                'פתחו את המוצר בפאנל הניהול והעלו תמונה מחדש. אם זה קורה להרבה תמונות — ייתכן בעיה כללית בתמונות.',
                'warn', 'owner');
        }

        if (source === 'persistence') {
            if (code === 'failed-precondition') return make('המטמון לא הופעל — האתר פתוח בכמה טאבים', message,
                'תקין — לא דורש טיפול.', 'warn', 'none');
            return make('הדפדפן אינו תומך בשמירת מטמון (גלישה פרטית?)', message,
                'תקין — לא דורש טיפול.', 'warn', 'none');
        }

        if (source === 'storage') return make('שמירת המועדפים נחסמה בדפדפן (דפדפן בתוך אפליקציה?)', message,
            'לרוב זה דפדפן בתוך פייסבוק/אינסטגרם שחוסם אחסון — אין צורך בפעולה.', 'warn', 'none');

        if (source === 'global') return make('תקלה טכנית בקוד האתר', message,
            'צלמו מסך של הפרטים הטכניים (הודעה + קובץ + שורה) ושלחו למפתח.', 'error', 'developer');

        if (source === 'promise') return make('תקלה טכנית באתר — פעולה ברקע נכשלה', message,
            'צלמו מסך של הפרטים הטכניים ושלחו למפתח.', 'error', 'developer');

        if (level === 'info') return make(message || 'מידע', message, '', 'ok', 'none');

        return make('תקלה לא צפויה באתר', message,
            'צלמו מסך של הפרטים הטכניים ושלחו למפתח.', 'error', 'developer');
    }

    root.explainLog = explainLog;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { explainLog: explainLog, FIRESTORE_CODES: FIRESTORE_CODES };
    }
})(typeof window !== 'undefined' ? window : this);
