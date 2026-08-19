# دار علي بن زيد — API Server (MySQL)

خادم الواجهة الخلفية (Backend API) لموقع دار علي بن زيد للطباعة والنشر، متوافق مع قواعد بيانات **MySQL** أو **MariaDB**.

---

## 🛠️ متطلبات التشغيل

- **Node.js** (الإصدار 20 فما فوق)
- قاعدة بيانات **MySQL** (أو MariaDB)

---

## ⚙️ التثبيت والتشغيل المحلي

### 1. تثبيت الحزم:
```bash
npm install
```

### 2. إعداد قاعدة البيانات:
قم باستيراد ملف `database.sql` إلى قاعدة بيانات MySQL لديك:
- **باستخدام سطر الأوامر:**
  ```bash
  mysql -u root -p daralibenzid < database.sql
  ```
- **أو عبر phpMyAdmin / MySQL Workbench / DBeaver:**
  أنشئ قاعدة بيانات باسم `daralibenzid`، ثم اختر **Import (استيراد)** واختر ملف `database.sql`.

### 3. ضبط متغيرات البيئة:
أنشئ ملف `.env` (أو استخدم المتغيرات مباشرة):
```env
PORT=8080
DATABASE_URL=mysql://root:password@localhost:3306/daralibenzid
```

### 4. تشغيل السيرفر:
```bash
npm start
```
أو للتطوير مع إعادة التشغيل التلقائي:
```bash
npm run dev
```

---

## 🚀 النشر على السحاب (Railway / Render / VPS)

### 1. أنشئ خدمة MySQL:
- على **Railway**: اضغط **Add Service → Database → MySQL**.
- ستحصل تلقائياً على متغير `DATABASE_URL` (أو `MYSQL_URL` و `MYSQLHOST` وما إلى ذلك).

### 2. استيراد قاعدة البيانات:
- انسخ بيانات الاتصال بقاعدة MySQL من Railway، واستورد ملف `database.sql`.

### 3. نشر الـ API Server:
- اربط مجلد الـ backend بالمشروع على Railway.
- سيتم تشغيل Dockerfile أو `npm start` تلقائياً.

### 4. ربط الواجهة الأمامية (Frontend):
في ملفات الواجهة (`index.html` و `admin.html` و `js/api-r.js`)، قم بتعيين رابط الـ API المنشور:
```html
<script>window.__API_BASE__ = "https://your-api-domain.com";</script>
```

---

## 🔐 بيانات الدخول للوحة التحكم الافتراضية
- **اسم المستخدم:** `admin`
- **كلمة المرور:** `assater123`
