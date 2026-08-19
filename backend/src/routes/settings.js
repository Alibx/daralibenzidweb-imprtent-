import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/settings", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM settings LIMIT 1");
    res.json(rows[0] || {});
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const { hero_title, hero_subtitle, stat_years, stat_books, stat_readers, copyright } = req.body;

    const existing = await query("SELECT id FROM settings LIMIT 1");
    if (existing.length === 0) {
      await query(
        `INSERT INTO settings (hero_title, hero_subtitle, stat_years, stat_books, stat_readers, copyright)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          hero_title || "",
          hero_subtitle || "",
          stat_years || "",
          stat_books || "",
          stat_readers || "",
          copyright || "",
        ]
      );
    } else {
      await query(
        `UPDATE settings SET hero_title = ?, hero_subtitle = ?, stat_years = ?,
         stat_books = ?, stat_readers = ?, copyright = ? WHERE id = ?`,
        [
          hero_title || "",
          hero_subtitle || "",
          stat_years || "",
          stat_books || "",
          stat_readers || "",
          copyright || "",
          existing[0].id,
        ]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
