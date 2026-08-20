import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// GET /delivery/rates - Get all delivery rates for the 58 Wilayas
router.get("/delivery/rates", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM delivery_rates ORDER BY wilaya_code ASC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching delivery rates:", error);
    res.status(500).json({ error: "Failed to fetch delivery rates" });
  }
});

// PUT /delivery/rates/:wilaya_code - Update specific wilaya rate (Admin)
router.put("/delivery/rates/:wilaya_code", async (req, res) => {
  try {
    const { home_price, desk_price, is_available } = req.body;

    await query(
      `UPDATE delivery_rates SET
        home_price = ?, desk_price = ?, is_available = ?
       WHERE wilaya_code = ?`,
      [
        Number(home_price) || 600.0,
        Number(desk_price) || 400.0,
        is_available !== undefined ? (is_available ? 1 : 0) : 1,
        req.params.wilaya_code,
      ]
    );

    const rows = await query("SELECT * FROM delivery_rates WHERE wilaya_code = ?", [req.params.wilaya_code]);
    if (!rows[0]) return res.status(404).json({ error: "Wilaya not found" });

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating delivery rate:", error);
    res.status(500).json({ error: "Failed to update delivery rate" });
  }
});

// POST /delivery/rates/bulk - Bulk update all wilayas (Admin)
router.post("/delivery/rates/bulk", async (req, res) => {
  try {
    const { home_price, desk_price } = req.body;
    if (home_price === undefined && desk_price === undefined) {
      return res.status(400).json({ error: "No prices provided" });
    }

    if (home_price !== undefined && desk_price !== undefined) {
      await query("UPDATE delivery_rates SET home_price = ?, desk_price = ?", [
        Number(home_price),
        Number(desk_price),
      ]);
    } else if (home_price !== undefined) {
      await query("UPDATE delivery_rates SET home_price = ?", [Number(home_price)]);
    } else if (desk_price !== undefined) {
      await query("UPDATE delivery_rates SET desk_price = ?", [Number(desk_price)]);
    }

    const rows = await query("SELECT * FROM delivery_rates ORDER BY wilaya_code ASC");
    res.json({ success: true, message: "تم تحديث أسعار التوصيل لجميع الولايات بنجاح", rates: rows });
  } catch (error) {
    console.error("Error bulk updating delivery rates:", error);
    res.status(500).json({ error: "Failed to bulk update delivery rates" });
  }
});

export default router;
