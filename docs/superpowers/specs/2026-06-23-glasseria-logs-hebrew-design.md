# מערכת לוגים מובנת בעברית + תיקון כפילויות — מסמך עיצוב

- **תאריך:** 2026-06-23
- **פרויקט:** Glasseria (קטלוג מוצרים, Firebase/Firestore, אתר סטטי ב-Netlify)
- **סטטוס:** מאושר לעיצוב, ממתין לתוכנית-מימוש

---

## 1. הבעיה

בעל האתר משתמש בלוגים שנשמרים ל-Firestore (`glasseria_logs`) ומוצגים בפאנל האדמין, כדי להבין למה גולשים נתקלים בבעיות. שתי תקלות:

1. **אין מספיק מידע כדי להחליט מה הייתה הבעיה.**
   - הלוגר לא לוכד `stack trace` כלל ([logger.js:197-211](../../../glasseria/js/logger.js)).
   - קוד שגיאת Firestore נדחס לתוך מחרוזת ההודעה במקום שדה נפרד ([app.js:1099](../../../glasseria/js/app.js)).
   - גם מידע שכן נלכד (filename/line/col, connectionType) **לא מוצג** בפאנל ([admin/index.html:4561-4576](../../../glasseria/admin/index.html)).
   - ההודעות באנגלית טכנית — בעל האתר אינו טכני.

2. **כניסות/שגיאות נרשמות "פעמיים".**
   - שגיאת רשת אחת מייצרת עד 3 לוגי `firestore error` (categories+subcategories+products), כי `handleError` מחובר ל-3 listeners נפרדים ([app.js:1113,1126,1137](../../../glasseria/js/app.js)).
   - "כניסה לאתר" נכתבת פעם אחת לכל טעינת עמוד, אבל `sessionId` נוצר מחדש בכל טעינה ולא נשמר — רענון/טעינה-מחדש (נפוץ ב-Safari מובייל) יוצר session חדש שנראה ככניסה כפולה.

## 2. מטרות / לא-מטרות

**מטרות:**
- כל בעיה שתופיע בפאנל תוצג עם **כותרת בעברית פשוטה** שגם לא-טכני מבין ממנה מה מקור הבעיה.
- לשמור את כל הפרטים הטכניים (stack, קוד, קובץ/שורה) ולהציגם ב**אקורדיון "פרטים טכניים" מוסתר** מתחת לכותרת.
- לצמצם כפילויות: רענון לא ייצור "כניסה" כפולה; תקלת רשת אחת תיתן לוג אחד מאוחד.
- לסגור חורי-כיסוי: כשל טעינת תמונות, כשל מטמון (persistence), חסימת שמירה מקומית.
- לאסוף עוד אותות-מכשיר שימושיים לאבחון (אחסון פנוי, זמני טעינה מפורטים, ניתוקי רשת, סוג-ניווט).

**לא-מטרות:**
- לא משנים את התנהגות האתר עצמו (טעינה/תצוגה/CTA).
- לא אוספים נתונים רגישים לפרטיות (GPS, סוללה, IP).
- לא בונים שרת/Backend.

## 3. ארכיטקטורה — תרגום בזמן תצוגה

הלקוח לוכד **נתונים גולמיים מובנים**; הפאנל מתרגם אותם לעברית **בזמן ההצגה** דרך מילון מרכזי.

**נימוק:** התרגום בזמן תצוגה עובד רטרואקטיבית גם על לוגים שכבר ב-Firestore, מרוכז במקום אחד, וקל להרחבה בלי לגעת בקוד האתר. הלקוח נשאר רזה ורושם רק שדות.

```
שגיאה → לכידה (logger.js/app.js) עם שדות גולמיים
      → נשמר ב-Firestore (glasseria_logs)
      → פאנל קורא (.get) → explainLog(log) → { title, detail }
      → כותרת עברית מוצגת + גלם באקורדיון
```

## 4. רכיבים

### A. לכידה עשירה — `js/logger.js`, `js/app.js`
שדות חדשים שיישמרו בכל לוג רלוונטי:
- `stack` — מ-`e.error?.stack` (window error) ו-`e.reason?.stack` (unhandledrejection).
- `code` — קוד שגיאת Firestore כשדה נפרד (`error.code`), בנוסף להודעה.
- `filename`, `line`, `col` — כבר נלכדים, נשמרים כמו שהם.
- `navigationType` — `performance.getEntriesByType('navigation')[0].type` (`navigate`/`reload`/`back_forward`).
- `bfcacheRestore` — בוליאני מאירוע `pageshow` (`event.persisted`).

הרחבת `deviceInfo` (נלכד פעם אחת):
- `storage` — `{ usageMB, quotaMB }` מ-`navigator.storage.estimate()` (אסינכרוני; נלכד ב-best-effort, לא חוסם).
- `persistence` — `'ok'` / `'failed-precondition'` / `'unimplemented'` / `'error'` — תוצאת `enablePersistence` שמועברת מ-firebase-config.

זמני-טעינה מפורטים (אופציונלי, מאושר) — נוסף ללוג ה-timing:
- `ttfbMs`, `dnsMs`, `domContentLoadedMs`, `loadEventMs` מ-navigation timing.

### B. מילון הסברים — קובץ חדש `js/log-explain.js`
פונקציה טהורה אחת:
```js
function explainLog(log) → { title: string, detail: string, severity: 'ok'|'warn'|'error' }
```
- ללא תלות ב-DOM → ניתנת לבדיקה ב-Node.
- נטענת כ-global בדפדפן (`window.explainLog`) וגם כ-`module.exports` ל-Node (`typeof module !== 'undefined'`).
- נכללת ב-admin/index.html לפני סקריפט התצוגה.

לוגיקת התרגום (לפי סדר עדיפות):
1. לפי `level`: `timing` → "טעינה תקינה"; `info`/`session` → "כניסה לאתר".
2. לפי `source` + `code`/`method` (טבלה בסעיף 5).
3. ברירת מחדל: "תקלה לא צפויה באתר" + ההודעה המקורית ב-detail.

### C. תצוגה — `admin/index.html`
ב-`renderSessions` כל `log-entry` יציג:
- **כותרת**: `explainLog(log).title` בעברית, עם צבע לפי severity.
- **אקורדיון "▸ פרטים טכניים"** (מוסתר כברירת מחדל) המכיל: ההודעה המקורית, `code`, `stack`, `filename:line:col`, `method`, `connectionType`, `navigationType`.
- שורת המכשיר/חיבור הקיימת תורחב להציג גם `storage` ו-`persistence`.

### D. תיקוני כפילות — `js/logger.js`, `js/app.js`
- **שמירת `sessionId`** ב-`sessionStorage` (מפתח `glasseria_sid`). אם קיים — שימוש חוזר; אחרת יצירה ושמירה. כך רענון באותו טאב לא יוצר session/כניסה חדשה. נפילה חיננית אם sessionStorage חסום (חזרה להתנהגות הנוכחית: id חדש בזיכרון).
- **מיזוג שגיאות Firestore**: `handleError` ירשום שגיאה אחת מאוחדת לכל "פרק" טעינה, לא אחת לכל collection. **מנגנון נבחר:** דגל ברמת ה-load-phase (`firestoreErrorLogged`) שמתאפס ב-`loadAllData`. השגיאה הראשונה נרשמת עם שם ה-collection הראשון שנכשל; שגיאות נוספות באותו פרק רק מעדכנות מונה (`affectedCollections`) שנשמר בלוג, בלי לוג נוסף. דטרמיניסטי וללא debounce תלוי-זמן.

### E. סגירת חורי-כיסוי — `js/app.js`, `js/firebase-config.js`, `js/logger.js`
- **כשל טעינת תמונות** (`source: 'image'`): מאזין גלובלי ל-`error` ב-capture שמזהה `e.target` שהוא `<img>` שנכשל, ורושם את ה-`src` שנכשל (עם הגבלת ספאם — כבר יש `MAX_LOGS_PER_SESSION=10`).
- **תוצאת persistence** (`source: 'persistence'`): firebase-config מעביר את תוצאת ה-catch ללוגר → נשמר ב-deviceInfo וגם כלוג אם נכשל.
- **חסימת שמירה מקומית** (`source: 'storage'`): כש-`safeSetStorage`/`safeGetStorage` נכשלים — רישום warn חד-פעמי.
- **ניתוקי רשת** (אופציונלי, מאושר): מאזינים ל-`online`/`offline` ב-window → לוג info קצר על שינוי מצב.

### F. מגבלה ידועה + מיטיגציה — "המוות השקט"
אם ה-SDK של Firebase נחסם לגמרי (CDN חסום) — `db` לא קיים והלוגר לא יכול לכתוב כלום, אפילו לא "כניסה". פתרון מלא דורש ערוץ-שידור חלופי (שרת), שלא קיים באתר סטטי.
- **מיטיגציה קלה (בהיקף):** תור-לוגים בזיכרון. לוגים שנוצרו לפני ש-`db` זמין נכנסים לתור ומתרוקנים כש-`db` עולה (מטפל ב-race של סדר טעינה). חסימת-CDN מלאה תיוותר כמגבלה מתועדת.

## 5. מילון התרחישים (B)

| source | code / method | severity | כותרת בעברית |
|--------|---------------|----------|--------------|
| session | — | ok | כניסה לאתר |
| load | timing | ok | האתר נטען בהצלחה |
| load | warn timeout | warn | הטעינה לקחה יותר מדי זמן — המערכת ניסתה דרך חלופית |
| load | timeout "All retries exhausted" | error | החיבור לאינטרנט איטי או לא יציב — המוצרים לא נטענו אחרי כמה ניסיונות |
| load | get-server | error | המוצרים לא נטענו מהשרת — בעיית רשת או שרת |
| load | get-cache "Empty cache" | error | אין נתונים שמורים במכשיר ואין חיבור לאינטרנט |
| firestore | permission-denied | error | אין הרשאת גישה לנתונים — כנראה בעיה בהגדרות האבטחה של מסד הנתונים |
| firestore | unavailable | error | השרת של גוגל לא היה זמין לרגע — תקלת רשת זמנית |
| firestore | deadline-exceeded | error | השרת לא הגיב בזמן — חיבור איטי |
| firestore | failed-precondition | error | בעיה בהגדרות מסד הנתונים (חסר אינדקס/הרשאות) |
| firestore | unauthenticated | error | נדרשת התחברות מחדש למסד הנתונים |
| firestore | resource-exhausted | error | חריגה ממכסת השימוש של מסד הנתונים |
| firestore | (אחר/Listener setup) | error | תקלה בהתחברות למסד הנתונים |
| image | — | warn | תמונת מוצר לא נטענה — קישור שבור או בעיית רשת |
| persistence | failed-precondition | warn | המטמון לא הופעל — האתר פתוח בכמה טאבים |
| persistence | unimplemented | warn | הדפדפן אינו תומך בשמירת מטמון (גלישה פרטית?) |
| storage | — | warn | שמירת המועדפים נחסמה בדפדפן (דפדפן בתוך אפליקציה?) |
| global | — | error | תקלה טכנית בקוד האתר *(הקובץ והשורה בפרטים הטכניים)* |
| promise | — | error | תקלה טכנית באתר — פעולה ברקע נכשלה |
| (לא מוכר) | — | error | תקלה לא צפויה באתר *(ההודעה המקורית בפרטים הטכניים)* |

## 6. בדיקות

- **יחידה (TDD):** `js/log-explain.test.js` רץ ב-Node. כותבים קודם בדיקה עם אובייקטי-לוג לדוגמה לכל שורה בטבלת סעיף 5 → פלט עברי צפוי. רואים אותה נכשלת → מממשים את `explainLog`.
- **ידני בדפדפן:** טעינת `admin/index.html`, פתיחת לשונית לוגים, ולידציה ש: הכותרות בעברית, האקורדיון נפתח/נסגר, שדות storage/persistence מופיעים. סימולציה של שגיאה (חסימת רשת ב-DevTools) ובדיקה שנרשם לוג אחד מאוחד.
- **כפילות:** רענון של index.html ובדיקה ש-`sessionId` נשמר (אותו ערך ב-sessionStorage) → אין "כניסה" שנייה.

## 7. סיכום שינויים לפי קובץ

| קובץ | שינוי |
|------|-------|
| `js/logger.js` | stack/code/navigationType/bfcache; deviceInfo.storage+persistence; sessionId מ-sessionStorage; image+storage handlers; queue ל-race |
| `js/firebase-config.js` | העברת תוצאת persistence ללוגר |
| `js/app.js` | code נפרד לשגיאות Firestore; מיזוג handleError; אירועי online/offline; timing מפורט |
| `js/log-explain.js` | **חדש** — `explainLog()` + מילון עברית (browser global + Node module) |
| `js/log-explain.test.js` | **חדש** — בדיקות Node ל-explainLog |
| `admin/index.html` | include ל-log-explain.js; renderSessions עם כותרת עברית + אקורדיון טכני; הצגת storage/persistence |
| `index.html` | ללא שינוי — `log-explain.js` נטען רק בפאנל האדמין, לא באתר הציבורי |

## 8. היקף מאושר

ליבה: A, B, C, D, E, F. אופציונלי (מאושר ונכלל): זמני-טעינה מפורטים, ניתוקי-רשת תוך-כדי, סוג-ניווט.
