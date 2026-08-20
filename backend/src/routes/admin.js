import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "الرجاء إدخال اسم المستخدم وكلمة المرور" });
    }

    const rows = await query(
      "SELECT * FROM admins WHERE username = ? LIMIT 1",
      [username.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "اسم المستخدم غير صحيح" });
    }

    const admin = rows[0];
    if (admin.password_hash !== password) {
      return res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة" });
    }

    if (admin.is_active === 0) {
      return res.status(403).json({ success: false, message: "تم تعطيل هذا الحساب. يرجى التواصل مع المدير العام" });
    }

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name || (admin.role === 'admin' ? 'المدير' : 'موظف'),
        role: admin.role || 'admin'
      }
    });
  } catch (error) {
    console.error("Error in admin login:", error);
    res.status(500).json({ success: false, message: "حدث خطأ في الخادم" });
  }
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
router.put("/admin/change-password", async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const targetUsername = username || 'admin';

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "البيانات غير مكتملة" });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ success: false, message: "كلمة المرور يجب ألا تقل عن 4 أحرف" });
    }

    const rows = await query(
      "SELECT * FROM admins WHERE username = ? LIMIT 1",
      [targetUsername]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    if (rows[0].password_hash !== currentPassword) {
      return res.status(401).json({ success: false, message: "كلمة المرور الحالية غير صحيحة" });
    }

    await query(
      "UPDATE admins SET password_hash = ? WHERE id = ?",
      [newPassword, rows[0].id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error in change-password:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء تغيير كلمة المرور" });
  }
});

// ─── STAFF MANAGEMENT CRUD ────────────────────────────────────────────────────

// GET all staff members
router.get("/admin/staff", async (req, res) => {
  try {
    const staff = await query(
      "SELECT id, username, name, role, is_active, created_at FROM admins ORDER BY id ASC"
    );
    res.json(staff);
  } catch (error) {
    console.error("Error fetching staff list:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء جلب قائمة الموظفين" });
  }
});

// CREATE new staff member
router.post("/admin/staff", async (req, res) => {
  try {
    const { username, name, password, role } = req.body;

    if (!username || !password || !name) {
      return res.status(400).json({ success: false, message: "يرجى ملء جميع الحقول المطلوبة (اسم المستخدم، الاسم الكامل، وكلمة المرور)" });
    }

    if (password.length < 4) {
      return res.status(400).json({ success: false, message: "كلمة المرور يجب أن لا تقل عن 4 أحرف" });
    }

    const cleanUsername = username.trim().toLowerCase();
    const existing = await query("SELECT id FROM admins WHERE LOWER(username) = ?", [cleanUsername]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "اسم المستخدم هذا مسجّل مسبقاً، اختر اسماً آخر" });
    }

    const assignedRole = (role === 'admin') ? 'admin' : 'staff';

    const result = await query(
      "INSERT INTO admins (username, name, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)",
      [cleanUsername, name.trim(), password, assignedRole]
    );

    res.status(201).json({
      success: true,
      message: "تمت إضافة الموظف بنجاح",
      staff: {
        id: result.insertId,
        username: cleanUsername,
        name: name.trim(),
        role: assignedRole,
        is_active: 1
      }
    });
  } catch (error) {
    console.error("Error creating staff:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء إضافة الموظف" });
  }
});

// UPDATE staff member
router.put("/admin/staff/:id", async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const { name, role, password, is_active } = req.body;

    const rows = await query("SELECT * FROM admins WHERE id = ?", [staffId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "الموظف غير موجود" });
    }

    const target = rows[0];
    const newName = name ? name.trim() : target.name;
    const newRole = role ? (role === 'admin' ? 'admin' : 'staff') : target.role;
    const newActive = typeof is_active !== 'undefined' ? (is_active ? 1 : 0) : target.is_active;

    if (password && password.trim().length >= 4) {
      await query(
        "UPDATE admins SET name = ?, role = ?, password_hash = ?, is_active = ? WHERE id = ?",
        [newName, newRole, password.trim(), newActive, staffId]
      );
    } else {
      await query(
        "UPDATE admins SET name = ?, role = ?, is_active = ? WHERE id = ?",
        [newName, newRole, newActive, staffId]
      );
    }

    res.json({ success: true, message: "تم تحديث بيانات الموظف بنجاح" });
  } catch (error) {
    console.error("Error updating staff:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء تحديث بيانات الموظف" });
  }
});

// DELETE staff member
router.delete("/admin/staff/:id", async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    if (staffId === 1) {
      return res.status(400).json({ success: false, message: "لا يمكن حذف الحساب الرئيسي للمدير العام" });
    }

    await query("DELETE FROM admins WHERE id = ?", [staffId]);
    res.json({ success: true, message: "تم حذف الموظف بنجاح" });
  } catch (error) {
    console.error("Error deleting staff:", error);
    res.status(500).json({ success: false, message: "حدث خطأ أثناء حذف الموظف" });
  }
});

export default router;
