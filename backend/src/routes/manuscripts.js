import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// GET /manuscripts - List all submitted manuscripts (Admin)
router.get("/manuscripts", async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = "SELECT * FROM manuscripts WHERE 1=1";
    const params = [];

    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += " AND (author_name LIKE ? OR author_phone LIKE ? OR book_title LIKE ? OR wilaya LIKE ?)";
      params.push(term, term, term, term);
    }

    sql += " ORDER BY id DESC";
    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching manuscripts:", error);
    res.status(500).json({ error: "Failed to fetch manuscripts" });
  }
});

// GET /manuscripts/stats - Summary counts
router.get("/manuscripts/stats", async (_req, res) => {
  try {
    const [totalRow] = await query("SELECT COUNT(*) as total FROM manuscripts");
    const [pendingRow] = await query("SELECT COUNT(*) as pending FROM manuscripts WHERE status = 'pending'");
    const [reviewRow] = await query("SELECT COUNT(*) as under_review FROM manuscripts WHERE status = 'under_review'");
    const [acceptedRow] = await query("SELECT COUNT(*) as accepted FROM manuscripts WHERE status = 'accepted'");
    const [rejectedRow] = await query("SELECT COUNT(*) as rejected FROM manuscripts WHERE status = 'rejected'");

    res.json({
      total: Number(totalRow.total || 0),
      pending: Number(pendingRow.pending || 0),
      under_review: Number(reviewRow.under_review || 0),
      accepted: Number(acceptedRow.accepted || 0),
      rejected: Number(rejectedRow.rejected || 0)
    });
  } catch (error) {
    console.error("Error fetching manuscript stats:", error);
    res.status(500).json({ error: "Failed to fetch manuscript stats" });
  }
});

// POST /manuscripts - Submit manuscript (Public Author Form)
router.post("/manuscripts", async (req, res) => {
  try {
    const {
      author_name,
      author_phone,
      author_email,
      wilaya,
      book_title,
      category,
      pages_count,
      summary,
      file_url
    } = req.body;

    if (!author_name || !author_phone || !book_title) {
      return res.status(400).json({
        error: "يرجى ملء الحقول الإلزامية: اسم المؤلف، رقم الهاتف، وعنوان الكتاب"
      });
    }

    const result = await query(
      `INSERT INTO manuscripts 
       (author_name, author_phone, author_email, wilaya, book_title, category, pages_count, summary, file_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        author_name.trim(),
        author_phone.trim(),
        author_email ? author_email.trim() : null,
        wilaya || null,
        book_title.trim(),
        category || null,
        pages_count ? Number(pages_count) : null,
        summary ? summary.trim() : null,
        file_url || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "تم استلام طلب نشر مخطوطتك بنجاح! سيتواصل معك فريق التحرير قريباً.",
      manuscript_id: result.insertId
    });
  } catch (error) {
    console.error("Error submitting manuscript:", error);
    res.status(500).json({ error: "تعذّر إرسال طلب النشر. يرجى المحاولة لاحقاً." });
  }
});

// PUT /manuscripts/:id/status - Update manuscript status & admin notes (Admin)
router.put("/manuscripts/:id/status", async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    const allowed = ["pending", "under_review", "accepted", "rejected"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: "حالة المخطوطة غير صالحة" });
    }

    const fields = [];
    const params = [];

    if (status) {
      fields.push("status = ?");
      params.push(status);
    }
    if (typeof admin_notes !== "undefined") {
      fields.push("admin_notes = ?");
      params.push(admin_notes);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "لا توجد بيانات للتعديل" });
    }

    params.push(req.params.id);
    await query(`UPDATE manuscripts SET ${fields.join(", ")} WHERE id = ?`, params);

    const rows = await query("SELECT * FROM manuscripts WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "المخطوطة غير موجودة" });

    res.json({ success: true, message: "تم تحديث حالة المخطوطة بنجاح", manuscript: rows[0] });
  } catch (error) {
    console.error("Error updating manuscript status:", error);
    res.status(500).json({ error: "تعذّر تحديث حالة المخطوطة" });
  }
});

// DELETE /manuscripts/:id - Delete manuscript (Admin)
router.delete("/manuscripts/:id", async (req, res) => {
  try {
    const result = await query("DELETE FROM manuscripts WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "المخطوطة غير موجودة" });
    }
    res.json({ success: true, message: "تم حذف المخطوطة بنجاح" });
  } catch (error) {
    console.error("Error deleting manuscript:", error);
    res.status(500).json({ error: "تعذّر حذف المخطوطة" });
  }
});

export default router;
