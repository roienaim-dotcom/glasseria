# Glasseria - אתר קטלוג עם Firebase

## 🌟 תכונות חדשות

- ✅ **קטגוריות דינמיות** - צור קטגוריות ותת-קטגוריות עם תמונות
- ✅ **פאנל ניהול מלא** - הוספה, עריכה ומחיקה
- ✅ **העלאת תמונות** - ישירות מהדפדפן ל-Firebase Storage
- ✅ **מודל מוצר** - תצוגה מפורטת עם מידות וצבעים
- ✅ **מועדפים + WhatsApp** - שליחת רשימה ישירה ללקוח
- ✅ **עיצוב רספונסיבי** - מושלם למובייל ולדסקטופ

## 📁 מבנה הקבצים

```
glasseria/
├── index.html              # דף הבית
├── css/
│   └── style.css           # עיצוב האתר
├── js/
│   ├── firebase-config.js  # הגדרות Firebase
│   └── app.js              # פונקציונליות
├── images/
│   ├── logo.png            # לוגו
│   └── placeholder.svg     # תמונת ברירת מחדל
├── admin/
│   └── index.html          # ממשק ניהול מלא
├── netlify.toml            # הגדרות Netlify
└── README.md               # קובץ זה
```

## 🚀 התקנה והעלאה

### שלב 1: העלאה ל-Netlify

1. היכנס ל-[netlify.com](https://netlify.com)
2. לחץ "Add new site" → "Deploy manually"
3. גרור את תיקיית `glasseria` לאזור ההעלאה
4. קבל כתובת לאתר

### שלב 2: הגדרת Firebase (כבר מוגדר!)

הפרויקט מחובר ל-Firebase שלך (`izhar-d3157`).

**⚠️ חשוב - עדכן את חוקי האבטחה:**

#### Firestore Rules:
1. היכנס ל-[Firebase Console](https://console.firebase.google.com)
2. בחר פרויקט `izhar`
3. Firestore Database → Rules
4. הדבק:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // קטגוריות
    match /glasseria_categories/{document=**} {
      allow read: if true;
      allow write: if true;
    }
    // תת-קטגוריות
    match /glasseria_subcategories/{document=**} {
      allow read: if true;
      allow write: if true;
    }
    // מוצרים
    match /glasseria_products/{document=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

#### Storage Rules:
1. Storage → Rules
2. הדבק:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /glasseria/{allPaths=**} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

## 🔧 שימוש

### פאנל ניהול
- **כתובת:** `yoursite.netlify.app/admin/`
- **סיסמה:** `glasseria2024`

### הוספת קטגוריה
1. לשונית "קטגוריות"
2. מלא שם + העלה תמונה
3. לחץ "הוסף קטגוריה"

### הוספת תת-קטגוריה
1. לשונית "תת-קטגוריות"
2. בחר קטגוריה ראשית
3. מלא שם + העלה תמונה
4. לחץ "הוסף תת-קטגוריה"

### הוספת מוצר
1. לשונית "מוצרים"
2. בחר קטגוריה (ואופציונלי תת-קטגוריה)
3. מלא פרטים: שם, מק"ט, מחיר, תיאור
4. הוסף מידות וצבעים (מופרד בפסיקים)
5. העלה תמונה
6. לחץ "הוסף מוצר"

## ⚙️ הגדרות

### שינוי סיסמת אדמין
בקובץ `admin/index.html`, שורה ~20:
```javascript
const ADMIN_PASSWORD = 'glasseria2024';
```

### שינוי מספר WhatsApp
בקובץ `js/app.js`, שורה ~4:
```javascript
const WHATSAPP_NUMBER = '972524048371';
```

## 📱 תצוגת האתר

### דף הבית
- כותרת עליונה עם לוגו וניווט
- רשת קטגוריות עם תמונות
- רשימת מוצרים

### תת-קטגוריות
- נפתח בלחיצה על קטגוריה
- כפתור "כל המוצרים" + תת-קטגוריות עם תמונות

### מוצר
- לחיצה על מוצר פותחת מודל מפורט
- תמונה גדולה, תיאור, מידות, צבעים
- כפתור הוספה/הסרה ממועדפים

### מועדפים
- כפתור שחור קבוע בפינה
- פאנל צד עם רשימת המוצרים
- שליחה ישירה ל-WhatsApp

## 🔒 אבטחה

- סיסמה לפאנל ניהול
- Firebase Rules מוגדרים
- Headers אבטחה ב-Netlify

## 📞 תמיכה

לשאלות ותמיכה: רועי - WEBFLOW STUDIO
