import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/contact", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM contact LIMIT 1");
    res.json(rows[0] || {});
  } catch (error) {
    console.error("Error fetching contact info:", error);
    res.status(500).json({ error: "Failed to fetch contact information" });
  }
});

router.put("/contact", async (req, res) => {
  try {
    const { address, phone, phone2, email, hours, facebook, instagram, whatsapp } = req.body;

    const existing = await query("SELECT id FROM contact LIMIT 1");
    if (existing.length === 0) {
      await query(
        `INSERT INTO contact (address, phone, phone2, email, hours, facebook, instagram, whatsapp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          address || "",
          phone || "",
          phone2 || null,
          email || "",
          hours || "",
          facebook || "",
          instagram || "",
          whatsapp || "",
        ]
      );
    } else {
      await query(
        `UPDATE contact SET address = ?, phone = ?, phone2 = ?, email = ?, hours = ?,
         facebook = ?, instagram = ?, whatsapp = ? WHERE id = ?`,
        [
          address || "",
          phone || "",
          phone2 || null,
          email || "",
          hours || "",
          facebook || "",
          instagram || "",
          whatsapp || "",
          existing[0].id,
        ]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating contact info:", error);
    res.status(500).json({ error: "Failed to update contact information" });
  }
});

export default router;
