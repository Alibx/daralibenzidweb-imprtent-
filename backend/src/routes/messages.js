import { Router } from "express";
import { query } from "../db.js";

const router = Router();

router.get("/messages", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM messages ORDER BY id DESC");
    const formatted = rows.map((m) => ({
      ...m,
      is_read: Boolean(m.is_read),
    }));
    res.json(formatted);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/messages", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ error: "name and message are required" });
    }

    const result = await query(
      `INSERT INTO messages (name, email, subject, message, is_read, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [name, email || "", subject || "", message]
    );

    const rows = await query("SELECT * FROM messages WHERE id = ?", [result.insertId]);
    const created = rows[0] ? { ...rows[0], is_read: Boolean(rows[0].is_read) } : null;
    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Failed to create message" });
  }
});

router.patch("/messages/:id", async (req, res) => {
  try {
    const { read, is_read } = req.body;
    const rawValue = read ?? is_read ?? false;
    const isReadInt = rawValue ? 1 : 0;

    await query("UPDATE messages SET is_read = ? WHERE id = ?", [
      isReadInt,
      req.params.id,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating message status:", error);
    res.status(500).json({ error: "Failed to update message" });
  }
});

router.delete("/messages/:id", async (req, res) => {
  try {
    await query("DELETE FROM messages WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// BULK DELETE MESSAGES
router.post("/messages/bulk-delete", async (req, res) => {
  try {
    const { ids, all } = req.body || {};
    if (all) {
      await query("DELETE FROM messages");
      return res.json({ success: true, message: "تم حذف جميع الرسائل بنجاح" });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد الرسائل المراد حذفها" });
    }
    const placeholders = ids.map(() => "?").join(",");
    await query(`DELETE FROM messages WHERE id IN (${placeholders})`, ids);
    res.json({ success: true, message: `تم حذف ${ids.length} رسالة بنجاح` });
  } catch (err) {
    res.status(500).json({ error: "Failed to bulk delete messages: " + err.message });
  }
});

// BULK MARK READ/UNREAD MESSAGES
router.post("/messages/bulk-read", async (req, res) => {
  try {
    const { ids, is_read, all } = req.body || {};
    const val = is_read ? 1 : 0;
    if (all) {
      await query("UPDATE messages SET is_read = ?", [val]);
      return res.json({ success: true, message: "تم تحديث حالة جميع الرسائل" });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد الرسائل المراد تعديلها" });
    }
    const placeholders = ids.map(() => "?").join(",");
    await query(`UPDATE messages SET is_read = ? WHERE id IN (${placeholders})`, [val, ...ids]);
    res.json({ success: true, message: `تم تحديث حالة ${ids.length} رسالة` });
  } catch (err) {
    res.status(500).json({ error: "Failed to bulk update read status: " + err.message });
  }
});

export default router;
