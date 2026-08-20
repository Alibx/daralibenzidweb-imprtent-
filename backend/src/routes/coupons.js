import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// POST /coupons/validate - Validate coupon for checkout
router.post("/coupons/validate", async (req, res) => {
  try {
    const { code, subtotal = 0 } = req.body;
    if (!code || !code.trim()) {
      return res.status(400).json({ valid: false, message: "يرجى إدخال كود الخصم" });
    }

    const cleanCode = code.trim().toUpperCase();
    const rows = await query(
      "SELECT * FROM coupons WHERE UPPER(code) = ? AND is_active = 1",
      [cleanCode]
    );

    if (!rows[0]) {
      return res.status(404).json({ valid: false, message: "كود الخصم غير صحيح أو غير مفعل" });
    }

    const coupon = rows[0];
    const now = new Date();

    // Check expiration
    if (coupon.expires_at && new Date(coupon.expires_at) < now) {
      return res.status(400).json({ valid: false, message: "كود الخصم هذا منتهي الصلاحية" });
    }

    // Check usage limits
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ valid: false, message: "تم استنفاد الحد الأقصى لاستخدام هذا الكوبون" });
    }

    // Check minimum order
    const totalOrder = Number(subtotal) || 0;
    if (coupon.min_order && totalOrder < Number(coupon.min_order)) {
      return res.status(400).json({
        valid: false,
        message: `الحد الأدنى للطلب لتفعيل هذا الكوبون هو ${coupon.min_order} دج`,
      });
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === "percent") {
      discountAmount = (totalOrder * Number(coupon.discount_value)) / 100;
    } else {
      discountAmount = Math.min(totalOrder, Number(coupon.discount_value));
    }

    res.json({
      valid: true,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      discount_amount: Math.round(discountAmount * 100) / 100,
      message: `تم تطبيق خصم بقيمة ${discountAmount} دج بنجاح!`,
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({ valid: false, message: "حدث خطأ أثناء التحقق من الكود" });
  }
});

// GET /coupons - List all coupons (Admin)
router.get("/coupons", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM coupons ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

// POST /coupons - Create a new coupon (Admin)
router.post("/coupons", async (req, res) => {
  try {
    const {
      code,
      discount_type = "percent",
      discount_value,
      min_order = 0,
      max_uses,
      expires_at,
      is_active = 1,
    } = req.body;

    if (!code || !discount_value) {
      return res.status(400).json({ error: "الكود وقيمة الخصم مطلوبان" });
    }

    const cleanCode = code.trim().toUpperCase();
    const result = await query(
      `INSERT INTO coupons (
        code, discount_type, discount_value, min_order, max_uses, expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanCode,
        discount_type,
        Number(discount_value),
        Number(min_order) || 0,
        max_uses ? Number(max_uses) : null,
        expires_at || null,
        is_active ? 1 : 0,
      ]
    );

    const rows = await query("SELECT * FROM coupons WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "كود الخصم هذا موجود مسبقاً" });
    }
    console.error("Error creating coupon:", error);
    res.status(500).json({ error: "Failed to create coupon" });
  }
});

// PUT /coupons/:id - Update coupon (Admin)
router.put("/coupons/:id", async (req, res) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      min_order,
      max_uses,
      expires_at,
      is_active,
    } = req.body;

    await query(
      `UPDATE coupons SET
        code = ?, discount_type = ?, discount_value = ?,
        min_order = ?, max_uses = ?, expires_at = ?, is_active = ?
       WHERE id = ?`,
      [
        code.trim().toUpperCase(),
        discount_type,
        Number(discount_value),
        Number(min_order) || 0,
        max_uses ? Number(max_uses) : null,
        expires_at || null,
        is_active ? 1 : 0,
        req.params.id,
      ]
    );

    const rows = await query("SELECT * FROM coupons WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Coupon not found" });

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ error: "Failed to update coupon" });
  }
});

// DELETE /coupons/:id - Delete coupon (Admin)
router.delete("/coupons/:id", async (req, res) => {
  try {
    await query("DELETE FROM coupons WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف الكوبون بنجاح" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ error: "Failed to delete coupon" });
  }
});

export default router;
