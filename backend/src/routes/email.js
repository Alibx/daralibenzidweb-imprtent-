import { Router } from "express";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  getSmtpConfig,
  createTransporter,
  sendMailUnified,
  buildDarEmailHtml,
  ensureSmtpColumns
} from "../utils/mailer.js";

const router = Router();

// Protect all email endpoints with Admin JWT
router.use(authenticateToken);

// GET current SMTP settings (for Admin Panel settings)
router.get("/email/settings", async (_req, res) => {
  try {
    const config = await getSmtpConfig();
    // Mask password
    res.json({
      smtp_host: config.smtp_host || "",
      smtp_port: config.smtp_port || 465,
      smtp_user: config.smtp_user || "",
      smtp_pass_set: !!config.smtp_pass,
      smtp_from_name: config.smtp_from_name || "دار علي بن زيد للطباعة والنشر",
      smtp_from_email: config.smtp_from_email || config.smtp_user || "",
    });
  } catch (err) {
    console.error("Error fetching SMTP settings:", err);
    res.status(500).json({ error: "Failed to fetch SMTP settings" });
  }
});

// UPDATE SMTP settings
router.put("/email/settings", async (req, res) => {
  try {
    await ensureSmtpColumns();
    const {
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      smtp_from_name,
      smtp_from_email
    } = req.body || {};

    const existing = await query("SELECT id, smtp_pass FROM settings LIMIT 1");
    const portNum = Number(smtp_port) || 465;
    const finalPass = (smtp_pass && smtp_pass.trim().length > 0)
      ? smtp_pass.trim()
      : (existing[0]?.smtp_pass || "");

    if (existing.length === 0) {
      await query(
        `INSERT INTO settings (smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name, smtp_from_email)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [smtp_host || "", portNum, smtp_user || "", finalPass, smtp_from_name || "دار علي بن زيد للطباعة والنشر", smtp_from_email || smtp_user || ""]
      );
    } else {
      await query(
        `UPDATE settings SET 
           smtp_host = ?,
           smtp_port = ?,
           smtp_user = ?,
           smtp_pass = ?,
           smtp_from_name = ?,
           smtp_from_email = ?
         WHERE id = ?`,
        [smtp_host || "", portNum, smtp_user || "", finalPass, smtp_from_name || "دار علي بن زيد للطباعة والنشر", smtp_from_email || smtp_user || "", existing[0].id]
      );
    }

    res.json({ success: true, message: "تم حفظ إعدادات البريد بنجاح" });
  } catch (err) {
    console.error("Error updating SMTP settings:", err);
    res.status(500).json({ error: "Failed to update SMTP settings: " + err.message });
  }
});

// TEST SMTP Connection & Send test email
router.post("/email/test", async (req, res) => {
  try {
    const { test_recipient, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name, smtp_from_email } = req.body || {};

    const config = (smtp_host && smtp_user)
      ? {
          smtp_host,
          smtp_port: Number(smtp_port) || 465,
          smtp_user,
          smtp_pass,
          smtp_from_name: smtp_from_name || "دار علي بن زيد للطباعة والنشر",
          smtp_from_email: smtp_from_email || smtp_user,
        }
      : await getSmtpConfig();

    const recipient = test_recipient || config.smtp_user;
    if (!recipient) {
      return res.status(400).json({ error: "يرجى تحديد عنوان بريد لاستقبال رسالة الاختبار" });
    }

    const html = buildDarEmailHtml({
      recipientName: "المدير العام / مسؤول النظام",
      subject: "🧪 رسالة اختبار خادم البريد (SMTP) — دار علي بن زيد",
      messageBody: "تهانينا! تم اختبار وتوصيل خادم البريد الإلكتروني (SMTP) لدار علي بن زيد للطباعة والنشر بنجاح.\n\nيمكنك الآن إرسال الرسائل والرد على طلبات النشر واستفسارات القراء مباشرة من لوحة التحكم بكل سهولة.",
      referenceTitle: "فحص الإعدادات والربط الفني",
      referenceType: "رسالة فحص"
    });

    await sendMailUnified(config, {
      to: recipient,
      subject: "🧪 رسالة اختبار خادم البريد — دار علي بن زيد",
      html,
      text: "تهانينا! تم ربط خادم البريد الإلكتروني بنجاح."
    });

    res.json({ success: true, message: `تم إرسال بريد الاختبار بنجاح إلى: ${recipient}` });
  } catch (err) {
    console.error("SMTP Test failed:", err);
    res.status(400).json({ error: "فشل إرسال بريد الاختبار: " + (err.message || "تأكد من صحة بيانات الخادم وكلمة المرور") });
  }
});

// SEND DIRECT REPLY / EMAIL FROM ADMIN
router.post("/email/send", async (req, res) => {
  try {
    const {
      to,
      to_name,
      subject,
      message,
      reference_title,
      reference_type, // 'manuscript' | 'message' | 'custom'
      reference_id
    } = req.body || {};

    if (!to || !subject || !message) {
      return res.status(400).json({ error: "البريد المستلم، عنوان الرسالة، ونص الرسالة مطلوبين." });
    }

    const config = await getSmtpConfig();
    const html = buildDarEmailHtml({
      recipientName: to_name || "",
      subject,
      messageBody: message,
      referenceTitle: reference_title || "",
      referenceType: reference_type === "manuscript" ? "طلب نشر مخطوطة" : (reference_type === "message" ? "رسالة تواصل واردة" : "")
    });

    await sendMailUnified(config, {
      to,
      subject,
      html,
      text: message
    });

    // If reference is a manuscript, we can optionally append a note to admin_notes
    if (reference_type === "manuscript" && reference_id) {
      try {
        const rows = await query("SELECT admin_notes FROM manuscripts WHERE id = ?", [reference_id]);
        if (rows && rows[0]) {
          const timestamp = new Date().toLocaleDateString("ar-DZ") + " " + new Date().toLocaleTimeString("ar-DZ");
          const noteAppend = `\n[تم إرسال بريد في ${timestamp}]: ${subject}`;
          const updatedNotes = (rows[0].admin_notes || "") + noteAppend;
          await query("UPDATE manuscripts SET admin_notes = ? WHERE id = ?", [updatedNotes, reference_id]);
        }
      } catch (noteErr) {
        console.warn("Could not append email note to manuscript:", noteErr);
      }
    }

    res.json({ success: true, message: `تم إرسال البريد الإلكتروني بنجاح إلى ${to}` });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: "تعذّر إرسال البريد: " + (err.message || "تحقق من إعدادات SMTP في لوحة التحكم") });
  }
});

export default router;
