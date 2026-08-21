import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// GET /books/:id/reviews - Public approved reviews for a book
router.get("/books/:id/reviews", async (req, res) => {
  try {
    const bookId = Number(req.params.id);
    const reviews = await query(
      "SELECT id, reviewer_name, rating, comment, created_at FROM book_reviews WHERE book_id = ? AND is_approved = 1 ORDER BY id DESC",
      [bookId]
    );

    const [stats] = await query(
      "SELECT COUNT(*) as total_reviews, COALESCE(AVG(rating), 5.0) as avg_rating FROM book_reviews WHERE book_id = ? AND is_approved = 1",
      [bookId]
    );

    res.json({
      reviews,
      total_reviews: Number(stats?.total_reviews || 0),
      avg_rating: Number(Number(stats?.avg_rating || 5.0).toFixed(1))
    });
  } catch (error) {
    console.error("Error fetching book reviews:", error);
    res.status(500).json({ error: "Failed to fetch book reviews" });
  }
});

// POST /books/:id/reviews - Submit review (Public Reader Form)
router.post("/books/:id/reviews", async (req, res) => {
  try {
    const bookId = Number(req.params.id);
    const { reviewer_name, rating = 5, comment } = req.body;

    if (!reviewer_name || !reviewer_name.trim()) {
      return res.status(400).json({ error: "يرجى إدخال اسمك الكريم" });
    }

    const numRating = Math.max(1, Math.min(5, Number(rating) || 5));

    await query(
      `INSERT INTO book_reviews (book_id, reviewer_name, rating, comment, is_approved)
       VALUES (?, ?, ?, ?, 0)`,
      [bookId, reviewer_name.trim(), numRating, comment ? comment.trim() : ""]
    );

    res.status(201).json({
      success: true,
      message: "شكراً لك على تقييمك! ستتم مراجعة التقييم ونشره قريباً."
    });
  } catch (error) {
    console.error("Error submitting book review:", error);
    res.status(500).json({ error: "تعذّر إرسال التقييم" });
  }
});

// GET /admin/reviews - List all reviews with book details (Admin)
router.get("/admin/reviews", async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = `
      SELECT r.*, b.title as book_title, b.author as book_author, b.cover_url as book_cover
      FROM book_reviews r
      LEFT JOIN books b ON r.book_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (status === "pending") {
      sql += " AND r.is_approved = 0";
    } else if (status === "approved") {
      sql += " AND r.is_approved = 1";
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += " AND (r.reviewer_name LIKE ? OR r.comment LIKE ? OR b.title LIKE ?)";
      params.push(term, term, term);
    }

    sql += " ORDER BY r.id DESC";
    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching admin reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// PUT /admin/reviews/:id/approve - Approve or reject review (Admin)
router.put("/admin/reviews/:id/approve", async (req, res) => {
  try {
    const { is_approved } = req.body;
    const approvedVal = is_approved ? 1 : 0;

    await query("UPDATE book_reviews SET is_approved = ? WHERE id = ?", [
      approvedVal,
      req.params.id
    ]);

    res.json({
      success: true,
      message: approvedVal ? "تمت الموافقة على التقييم ونشره" : "تم إلغاء نشر التقييم"
    });
  } catch (error) {
    console.error("Error updating review approval:", error);
    res.status(500).json({ error: "Failed to update review" });
  }
});

// DELETE /admin/reviews/:id - Delete review (Admin)
router.delete("/admin/reviews/:id", async (req, res) => {
  try {
    await query("DELETE FROM book_reviews WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف التقييم بنجاح" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

export default router;
