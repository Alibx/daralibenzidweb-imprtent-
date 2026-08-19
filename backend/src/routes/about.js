import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/about", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM about LIMIT 1");
    res.json(rows[0] || {});
  } catch (error) {
    console.error("Error fetching about:", error);
    res.status(500).json({ error: "Failed to fetch about data" });
  }
});

router.put("/about", async (req, res) => {
  try {
    const { main_text, main, mission, vision } = req.body;
    const mainValue = main_text ?? main ?? "";

    const existing = await query("SELECT id FROM about LIMIT 1");
    if (existing.length === 0) {
      await query(
        "INSERT INTO about (id, main_text, mission, vision) VALUES (1, ?, ?, ?)",
        [mainValue, mission || "", vision || ""]
      );
    } else {
      await query(
        "UPDATE about SET main_text = ?, mission = ?, vision = ? WHERE id = ?",
        [mainValue, mission || "", vision || "", existing[0].id]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating about:", error);
    res.status(500).json({ error: "Failed to update about data" });
  }
});

export default router;
