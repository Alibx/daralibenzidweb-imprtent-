import { Router } from "express";
import { query } from "../db.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = Router();

// GET /settings - Publicly safe presentation settings only (Zero secrets leaked)
router.get("/settings", async (_req, res) => {
  try {
    const rows = await query(`
      SELECT 
        hero_title, hero_subtitle, stat_years, stat_books, stat_readers, copyright,
        announcement_text, announcement_active, announcement_link
      FROM settings LIMIT 1
    `);
    res.json(rows[0] || {});
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PUT /settings - Admin only update
router.put("/settings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      hero_title,
      hero_subtitle,
      stat_years,
      stat_books,
      stat_readers,
      copyright,
      announcement_text,
      announcement_active,
      announcement_link,
    } = req.body;

    const existing = await query("SELECT id FROM settings LIMIT 1");
    const activeFlag = typeof announcement_active !== "undefined" ? (announcement_active ? 1 : 0) : 1;

    if (existing.length === 0) {
      await query(
        `INSERT INTO settings (
          hero_title, hero_subtitle, stat_years, stat_books, stat_readers, copyright,
          announcement_text, announcement_active, announcement_link
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hero_title || "",
          hero_subtitle || "",
          stat_years || "",
          stat_books || "",
          stat_readers || "",
          copyright || "",
          announcement_text || "",
          activeFlag,
          announcement_link || "",
        ]
      );
    } else {
      await query(
        `UPDATE settings SET 
          hero_title = ?, hero_subtitle = ?, stat_years = ?,
          stat_books = ?, stat_readers = ?, copyright = ?,
          announcement_text = ?, announcement_active = ?, announcement_link = ?
         WHERE id = ?`,
        [
          hero_title || "",
          hero_subtitle || "",
          stat_years || "",
          stat_books || "",
          stat_readers || "",
          copyright || "",
          announcement_text || "",
          activeFlag,
          announcement_link || "",
          existing[0].id,
        ]
      );
    }

    res.json({ success: true, message: "تم حفظ الإعدادات بنجاح" });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
