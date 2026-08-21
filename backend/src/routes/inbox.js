import { Router } from "express";
import { query } from "../db.js";
import {
  ensureInboxTable,
  getImapConfig,
  syncIncomingEmails
} from "../utils/imapReceiver.js";

const router = Router();

// GET Inbox Emails list
router.get("/inbox", async (req, res) => {
  try {
    await ensureInboxTable();
    const { filter, search } = req.query;

    let sql = "SELECT id, uid, from_name, from_email, to_email, subject, body_text, date, is_read, is_starred, created_at FROM inbox_emails WHERE 1=1";
    const params = [];

    if (filter === "unread") {
      sql += " AND is_read = 0";
    } else if (filter === "starred") {
      sql += " AND is_starred = 1";
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      sql += " AND (from_name LIKE ? OR from_email LIKE ? OR subject LIKE ? OR body_text LIKE ?)";
      params.push(q, q, q, q);
    }

    sql += " ORDER BY date DESC, id DESC LIMIT 100";

    const rows = await query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error("Error fetching inbox:", err);
    res.status(500).json({ error: "Failed to fetch inbox emails: " + err.message });
  }
});

// GET Inbox Stats (unread count, total)
router.get("/inbox/stats", async (_req, res) => {
  try {
    await ensureInboxTable();
    const rows = await query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
        SUM(CASE WHEN is_starred = 1 THEN 1 ELSE 0 END) AS starred
      FROM inbox_emails
    `);
    res.json({
      total: Number(rows[0]?.total || 0),
      unread: Number(rows[0]?.unread || 0),
      starred: Number(rows[0]?.starred || 0)
    });
  } catch (err) {
    console.error("Error fetching inbox stats:", err);
    res.status(500).json({ error: "Failed to fetch inbox stats" });
  }
});

// TRIGGER IMAP SYNC
router.post("/inbox/sync", async (req, res) => {
  try {
    const result = await syncIncomingEmails(req.body?.config || null);
    res.json({
      success: true,
      message: result.newCount > 0 ? `تم جلب ${result.newCount} رسالة واردة جديدة بنجاح 🎉` : "صندوق الوارد محدث، لا توجد رسائل جديدة."
    });
  } catch (err) {
    console.error("Inbox Sync Error:", err);
    res.status(400).json({ error: err.message || "تعذّر جلب الرسائل من خادم IMAP" });
  }
});

// GET Single Email by ID
router.get("/inbox/:id", async (req, res) => {
  try {
    await ensureInboxTable();
    const rows = await query("SELECT * FROM inbox_emails WHERE id = ? LIMIT 1", [req.params.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "الرسالة غير موجودة" });
    }

    // Auto mark as read
    await query("UPDATE inbox_emails SET is_read = 1 WHERE id = ?", [req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching email:", err);
    res.status(500).json({ error: "Failed to fetch email details" });
  }
});

// Toggle Read / Unread
router.patch("/inbox/:id/read", async (req, res) => {
  try {
    const { is_read } = req.body || {};
    const val = typeof is_read !== "undefined" ? (is_read ? 1 : 0) : 1;
    await query("UPDATE inbox_emails SET is_read = ? WHERE id = ?", [val, req.params.id]);
    res.json({ success: true, is_read: val });
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

// Toggle Starred
router.patch("/inbox/:id/star", async (req, res) => {
  try {
    const { is_starred } = req.body || {};
    const val = typeof is_starred !== "undefined" ? (is_starred ? 1 : 0) : 1;
    await query("UPDATE inbox_emails SET is_starred = ? WHERE id = ?", [val, req.params.id]);
    res.json({ success: true, is_starred: val });
  } catch (err) {
    res.status(500).json({ error: "Failed to update star" });
  }
});

// Delete Email
router.delete("/inbox/:id", async (req, res) => {
  try {
    await query("DELETE FROM inbox_emails WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف الرسالة" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete email" });
  }
});

// BULK DELETE INBOX EMAILS
router.post("/inbox/bulk-delete", async (req, res) => {
  try {
    const { ids, all } = req.body || {};
    if (all) {
      await query("DELETE FROM inbox_emails");
      return res.json({ success: true, message: "تم حذف جميع الرسائل الواردة بنجاح" });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد الرسائل المراد حذفها" });
    }
    const placeholders = ids.map(() => "?").join(",");
    await query(`DELETE FROM inbox_emails WHERE id IN (${placeholders})`, ids);
    res.json({ success: true, message: `تم حذف ${ids.length} رسالة بنجاح` });
  } catch (err) {
    res.status(500).json({ error: "Failed to bulk delete emails: " + err.message });
  }
});

// BULK MARK READ/UNREAD INBOX EMAILS
router.post("/inbox/bulk-read", async (req, res) => {
  try {
    const { ids, is_read, all } = req.body || {};
    const val = is_read ? 1 : 0;
    if (all) {
      await query("UPDATE inbox_emails SET is_read = ?", [val]);
      return res.json({ success: true, message: "تم تحديث حالة جميع الرسائل" });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "يرجى تحديد الرسائل المراد تعديلها" });
    }
    const placeholders = ids.map(() => "?").join(",");
    await query(`UPDATE inbox_emails SET is_read = ? WHERE id IN (${placeholders})`, [val, ...ids]);
    res.json({ success: true, message: `تم تحديث حالة ${ids.length} رسالة` });
  } catch (err) {
    res.status(500).json({ error: "Failed to bulk update read status: " + err.message });
  }
});

// GET IMAP Settings
router.get("/inbox/settings/config", async (_req, res) => {
  try {
    const config = await getImapConfig();
    res.json({
      imap_host: config.host,
      imap_port: config.port,
      imap_user: config.user,
      imap_pass_set: !!config.pass
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch IMAP config" });
  }
});

// UPDATE IMAP Settings
router.put("/inbox/settings/config", async (req, res) => {
  try {
    await ensureInboxTable();
    const { imap_host, imap_port, imap_user, imap_pass } = req.body || {};

    const existing = await query("SELECT id, imap_pass FROM settings LIMIT 1");
    const portNum = Number(imap_port) || 993;
    const finalPass = (imap_pass && imap_pass.trim().length > 0)
      ? imap_pass.trim()
      : (existing[0]?.imap_pass || "");

    if (existing.length === 0) {
      await query(
        `INSERT INTO settings (imap_host, imap_port, imap_user, imap_pass)
         VALUES (?, ?, ?, ?)`,
        [imap_host || "imap.stackmail.com", portNum, imap_user || "info@daralibenzid.dz", finalPass]
      );
    } else {
      await query(
        `UPDATE settings SET 
           imap_host = ?,
           imap_port = ?,
           imap_user = ?,
           imap_pass = ?
         WHERE id = ?`,
        [imap_host || "imap.stackmail.com", portNum, imap_user || "info@daralibenzid.dz", finalPass, existing[0].id]
      );
    }

    res.json({ success: true, message: "تم حفظ إعدادات البريد الوارد (IMAP) بنجاح" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update IMAP settings: " + err.message });
  }
});

export default router;
