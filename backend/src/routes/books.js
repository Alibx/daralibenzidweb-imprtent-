import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/books", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM books ORDER BY id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

router.get("/books/:id", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM books WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Book not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching book:", error);
    res.status(500).json({ error: "Failed to fetch book" });
  }
});

router.post("/books", async (req, res) => {
  try {
    const {
      title,
      author,
      description,
      cover_url,
      pdf_url,
      year,
      pages,
      price,
      discount_price,
      pdf_price,
      color,
      status,
      category_id,
    } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: "title and author are required" });
    }

    const result = await query(
      `INSERT INTO books (
        title, author, description, cover_url, pdf_url,
        year, pages, price, discount_price, pdf_price,
        color, status, category_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        author,
        description || "",
        cover_url || null,
        pdf_url || null,
        year ? Number(year) : null,
        pages ? Number(pages) : null,
        price !== undefined && price !== null ? Number(price) : 1200.0,
        discount_price !== undefined && discount_price !== null && discount_price !== "" ? Number(discount_price) : null,
        pdf_price !== undefined && pdf_price !== null && pdf_price !== "" ? Number(pdf_price) : 5.0,
        color || null,
        status || "published",
        category_id ? Number(category_id) : null,
      ]
    );

    const rows = await query("SELECT * FROM books WHERE id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(500).json({ error: "Failed to create book" });
  }
});

router.put("/books/:id", async (req, res) => {
  try {
    const {
      title,
      author,
      description,
      cover_url,
      pdf_url,
      year,
      pages,
      price,
      discount_price,
      pdf_price,
      color,
      status,
      category_id,
    } = req.body;

    await query(
      `UPDATE books SET
        title = ?, author = ?, description = ?, cover_url = ?, pdf_url = ?,
        year = ?, pages = ?, price = ?, discount_price = ?, pdf_price = ?,
        color = ?, status = ?, category_id = ?
       WHERE id = ?`,
      [
        title,
        author,
        description || "",
        cover_url || null,
        pdf_url || null,
        year ? Number(year) : null,
        pages ? Number(pages) : null,
        price !== undefined && price !== null ? Number(price) : 1200.0,
        discount_price !== undefined && discount_price !== null && discount_price !== "" ? Number(discount_price) : null,
        pdf_price !== undefined && pdf_price !== null && pdf_price !== "" ? Number(pdf_price) : 5.0,
        color || null,
        status || "published",
        category_id ? Number(category_id) : null,
        req.params.id,
      ]
    );

    const rows = await query("SELECT * FROM books WHERE id = ?", [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ error: "Book not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).json({ error: "Failed to update book" });
  }
});

router.delete("/books/:id", async (req, res) => {
  try {
    await query("DELETE FROM books WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).json({ error: "Failed to delete book" });
  }
});

export default router;
