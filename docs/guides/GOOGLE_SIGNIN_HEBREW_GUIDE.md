# 🔐 מדריך הגדרת Google Sign-In לאפליקציה

## 🚀 **איך להוסיף Google Sign-In לאפליקציה שלך**

המדריך הזה יסביר לך איך להגדיר Google Sign-In בדיוק כמו בתמונה ששלחת!

---

## **📋 שלב 1: קבלת Web Client ID מ-Firebase Console**

### **1.1 היכנס ל-Firebase Console**
- לך ל-[Firebase Console](https://console.firebase.google.com/)
- בחר את הפרויקט שלך: **social-vault**

### **1.2 הגדרת Web App**
1. **לחץ על Settings** (⚙️) → **Project Settings**
2. **לך לטאב "General"**
3. **גלול למטה לסעיף "Your apps"**
4. **אם אין לך Web app, לחץ על "Add app"** → **Web app (</>)**
5. **תן שם לאפליקציה**: `SocialVault Web`
6. **לחץ "Register app"**

### **1.3 קבלת Web Client ID**
1. **לאחר יצירת ה-Web app, תמצא את ה-Web Client ID**
2. **זה נראה כך**: `929613087809-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
3. **העתק את המספר הזה**

---

## **📋 שלב 2: הפעלת Google Authentication**

### **2.1 הפעלת Google Sign-In**
1. **לך ל-Authentication** → **Sign-in method**
2. **לחץ על Google** → **Enable**
3. **הכנס Project support email** (האימייל שלך)
4. **לחץ "Save"**

---

## **📋 שלב 3: עדכון הקוד**

### **3.1 החלפת Web Client ID**
בקובץ `screens/Welcome.js`, החלף את השורה הזו:

```javascript
const clientId = '929613087809-YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
```

במספר האמיתי שלך:

```javascript
const clientId = '929613087809-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com';
```

### **3.2 דוגמה:**
אם ה-Web Client ID שלך הוא: `929613087809-abc123def456.apps.googleusercontent.com`

אז הקוד יהיה:
```javascript
const clientId = '929613087809-abc123def456.apps.googleusercontent.com';
```

---

## **📋 שלב 4: בדיקה**

### **4.1 הפעלת האפליקציה**
1. **הפעל את האפליקציה**: `npm start`
2. **לך למסך Welcome**
3. **לחץ על "Continue With Google"**

### **4.2 מה אמור לקרות:**
1. **הדפדפן יפתח** עם Google Sign-In
2. **תראה חלון בחירת חשבון** בדיוק כמו בתמונה
3. **תוכל לבחור חשבון Google** ולהתחבר

---

## **🎯 מה הקוד עושה:**

### **הפרמטר החשוב:**
```javascript
prompt=select_account
```
**זה גורם להצגת חלון בחירת החשבון בדיוק כמו בתמונה!**

### **התהליך המלא:**
1. **לחיצה על הכפתור** → פתיחת דפדפן
2. **Google OAuth** → בחירת חשבון
3. **אישור הרשאות** → חזרה לאפליקציה
4. **יצירת משתמש** → שמירה ב-Firebase

---

## **🔒 אבטחה:**

- ✅ **OAuth 2.0** - תקן אבטחה עולמי
- ✅ **Google מטפל באבטחה** - אין סיסמאות באפליקציה
- ✅ **טוקנים מוצפנים** - Firebase מטפל בהצפנה
- ✅ **אימות אימייל** - Google מאמת אימיילים

---

## **🆘 פתרון בעיות:**

### **שגיאה 404:**
- וודא שה-Web Client ID נכון
- בדוק שה-Google Authentication מופעל

### **הדפדפן לא נפתח:**
- וודא שיש דפדפן מותקן בטלפון
- בדוק הרשאות לאפליקציה

### **לא רואה חלון בחירת חשבון:**
- וודא שהוספת `prompt=select_account`
- בדוק שה-Web Client ID תקין

---

## **🎉 סיכום:**

לאחר שתעשה את כל השלבים:
1. **תקבל Web Client ID** מ-Firebase Console
2. **תחליף את הקוד** ב-Welcome.js
3. **תפעיל Google Authentication** ב-Firebase
4. **תראה חלון בחירת חשבון** בדיוק כמו בתמונה!

**האפליקציה שלך תהיה מוכנה עם Google Sign-In! 🚀**
