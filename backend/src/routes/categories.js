import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/categories", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM categories ORDER BY id ASC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const result = await query(
      "INSERT INTO categories (name, color) VALUES (?, ?)",
      [name, color || "#1B6CA8"]
    );

    const rows = await query("SELECT * FROM categories WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const { name, color } = req.body;
    await query(
      "UPDATE categories SET name = ?, color = ? WHERE id = ?",
      [name, color, req.params.id]
    );

    const rows = await query("SELECT * FROM categories WHERE id = ?", [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    await query("DELETE FROM categories WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
