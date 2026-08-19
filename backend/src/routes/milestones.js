import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/milestones", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM milestones ORDER BY year ASC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching milestones:", error);
    res.status(500).json({ error: "Failed to fetch milestones" });
  }
});

router.post("/milestones", async (req, res) => {
  try {
    const { year, title, description } = req.body;
    const result = await query(
      "INSERT INTO milestones (year, title, description) VALUES (?, ?, ?)",
      [year ? Number(year) : null, title || "", description || ""]
    );

    const rows = await query("SELECT * FROM milestones WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating milestone:", error);
    res.status(500).json({ error: "Failed to create milestone" });
  }
});

router.put("/milestones/:id", async (req, res) => {
  try {
    const { year, title, description } = req.body;
    await query(
      "UPDATE milestones SET year = ?, title = ?, description = ? WHERE id = ?",
      [year ? Number(year) : null, title || "", description || "", req.params.id]
    );

    const rows = await query("SELECT * FROM milestones WHERE id = ?", [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ error: "Milestone not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating milestone:", error);
    res.status(500).json({ error: "Failed to update milestone" });
  }
});

router.delete("/milestones/:id", async (req, res) => {
  try {
    await query("DELETE FROM milestones WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting milestone:", error);
    res.status(500).json({ error: "Failed to delete milestone" });
  }
});

export default router;
