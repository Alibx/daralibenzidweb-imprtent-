import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "الرجاء إدخال اسم المستخدم وكلمة المرور" });
    }

    const rows = await query(
      "SELECT * FROM admins WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "اسم المستخدم غير صحيح" });
    }

    const admin = rows[0];
    if (admin.password_hash !== password) {
      return res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة" });
    }

    res.json({ success: true, admin: { id: admin.id, username: admin.username } });
  } catch (error) {
    console.error("Error in admin login:", error);
    res.status(500).json({ success: false, message: "حدث خطأ في الخادم" });
  }
});

router.put("/admin/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "البيانات غير مكتملة" });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: "كلمة المرور يجب ألا تقل عن 4 أحرف" });
    }

    const rows = await query(
      "SELECT * FROM admins WHERE username = 'admin' LIMIT 1"
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "المسؤول غير موجود" });
    }

    if (rows[0].password_hash !== currentPassword) {
      return res.status(401).json({ success: false, message: "كلمة المرور الحالية غير صحيحة" });
    }

    await query(
      "UPDATE admins SET password_hash = ? WHERE username = 'admin'",
      [newPassword]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error in change-password:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء تغيير كلمة المرور" });
  }
});

export default router;
