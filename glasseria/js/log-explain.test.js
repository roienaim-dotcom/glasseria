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
check('bfcache restore', { level: 'info', source: 'session', message: 'חזרה לעמוד מהמטמון' }, 'חזרה לעמוד (מהמטמון של הדפדפן)', 'ok');
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
check('persist multitab', { level: 'warn', source: 'persistence', code: 'failed-precondition' }, 'המטמון לא הופעל — האתר פתוח בכמה טאבים', 'warn');
check('persist unimpl', { level: 'warn', source: 'persistence', code: 'unimplemented' }, 'הדפדפן אינו תומך בשמירת מטמון (גלישה פרטית?)', 'warn');
check('storage blocked', { level: 'warn', source: 'storage' }, 'שמירת המועדפים נחסמה בדפדפן (דפדפן בתוך אפליקציה?)', 'warn');
check('global', { level: 'error', source: 'global', message: 'x is not defined' }, 'תקלה טכנית בקוד האתר', 'error');
check('promise', { level: 'error', source: 'promise' }, 'תקלה טכנית באתר — פעולה ברקע נכשלה', 'error');
check('fallback', { level: 'error', source: 'mystery' }, 'תקלה לא צפויה באתר', 'error');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
