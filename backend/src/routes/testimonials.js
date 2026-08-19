import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/testimonials", async (_req, res) => {
  try {
    const rows = await query(
      "SELECT id, name, role, COALESCE(quote, content) AS quote, rating FROM testimonials ORDER BY id DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching testimonials:", error);
    res.status(500).json({ error: "Failed to fetch testimonials" });
  }
});

router.post("/testimonials", async (req, res) => {
  try {
    const { name, role, quote, content, rating } = req.body;
    const finalQuote = quote || content || "";
    if (!name || !finalQuote) {
      return res.status(400).json({ error: "name and quote are required" });
    }

    const result = await query(
      "INSERT INTO testimonials (name, role, quote, content, rating) VALUES (?, ?, ?, ?, ?)",
      [name, role || "", finalQuote, finalQuote, rating ? Number(rating) : 5]
    );

    const rows = await query(
      "SELECT id, name, role, COALESCE(quote, content) AS quote, rating FROM testimonials WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating testimonial:", error);
    res.status(500).json({ error: "Failed to create testimonial" });
  }
});

router.put("/testimonials/:id", async (req, res) => {
  try {
    const { name, role, quote, content, rating } = req.body;
    const finalQuote = quote || content || "";

    await query(
      "UPDATE testimonials SET name = ?, role = ?, quote = ?, content = ?, rating = ? WHERE id = ?",
      [name, role || "", finalQuote, finalQuote, rating ? Number(rating) : 5, req.params.id]
    );

    const rows = await query(
      "SELECT id, name, role, COALESCE(quote, content) AS quote, rating FROM testimonials WHERE id = ?",
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: "Testimonial not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({ error: "Failed to update testimonial" });
  }
});

router.delete("/testimonials/:id", async (req, res) => {
  try {
    await query("DELETE FROM testimonials WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({ error: "Failed to delete testimonial" });
  }
});

export default router;
