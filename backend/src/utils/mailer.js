import nodemailer from "nodemailer";
import { query } from "../db.js";

// Ensure settings table has SMTP columns
export async function ensureSmtpColumns() {
  try {
    const columns = [
      "ALTER TABLE `settings` ADD COLUMN `smtp_host` VARCHAR(255) DEFAULT NULL",
      "ALTER TABLE `settings` ADD COLUMN `smtp_port` INT DEFAULT 465",
      "ALTER TABLE `settings` ADD COLUMN `smtp_user` VARCHAR(255) DEFAULT NULL",
      "ALTER TABLE `settings` ADD COLUMN `smtp_pass` VARCHAR(255) DEFAULT NULL",
      "ALTER TABLE `settings` ADD COLUMN `smtp_from_name` VARCHAR(255) DEFAULT 'دار علي بن زيد للطباعة والنشر'",
      "ALTER TABLE `settings` ADD COLUMN `smtp_from_email` VARCHAR(255) DEFAULT NULL"
    ];
    for (const sql of columns) {
      try {
        await query(sql);
      } catch (err) {
        // Ignore column already exists errors (ER_DUP_FIELDNAME)
        if (err.code !== "ER_DUP_FIELDNAME") {
          // silent ignore
        }
      }
    }
  } catch (err) {
    console.warn("ensureSmtpColumns error:", err.message);
  }
}

export async function getSmtpConfig() {
  try {
    await ensureSmtpColumns();
    const rows = await query("SELECT * FROM settings LIMIT 1");
    if (rows && rows[0]) {
      return {
        smtp_host: rows[0].smtp_host || process.env.SMTP_HOST || "",
        smtp_port: Number(rows[0].smtp_port || process.env.SMTP_PORT) || 465,
        smtp_user: rows[0].smtp_user || process.env.SMTP_USER || "",
        smtp_pass: rows[0].smtp_pass || process.env.SMTP_PASS || "",
        smtp_from_name: rows[0].smtp_from_name || process.env.SMTP_FROM_NAME || "دار علي بن زيد للطباعة والنشر",
        smtp_from_email: rows[0].smtp_from_email || process.env.SMTP_FROM_EMAIL || rows[0].smtp_user || "",
      };
    }
  } catch (err) {
    console.warn("getSmtpConfig db error:", err.message);
  }
  return {
    smtp_host: process.env.SMTP_HOST || "",
    smtp_port: Number(process.env.SMTP_PORT) || 465,
    smtp_user: process.env.SMTP_USER || "",
    smtp_pass: process.env.SMTP_PASS || "",
    smtp_from_name: process.env.SMTP_FROM_NAME || "دار علي بن زيد للطباعة والنشر",
    smtp_from_email: process.env.SMTP_FROM_EMAIL || "",
  };
}

export function createTransporter(config) {
  const host = (config.smtp_host || process.env.SMTP_HOST || '').trim();
  const port = Number(config.smtp_port || process.env.SMTP_PORT || 465);
  const user = (config.smtp_user || process.env.SMTP_USER || '').trim();
  const pass = (config.smtp_pass || process.env.SMTP_PASS || '').trim();

  if (!host || !user || !pass) {
    throw new Error("بيانات خادم البريد (SMTP) غير مكتملة. يرجى كتابة خادم البريد، الإيميل، وكلمة المرور.");
  }

  const isSecure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: { user, pass },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false
    }
  });
}

export function buildDarEmailHtml({ recipientName, subject, messageBody, referenceTitle, referenceType }) {
  // Format message lines
  const formattedBody = String(messageBody || "")
    .split("\n")
    .map(line => `<p style="margin:0 0 12px 0;line-height:1.8;color:#2c3e50;font-size:15px">${line || "&nbsp;"}</p>`)
    .join("");

  const refBadge = referenceTitle ? `
    <div style="background:#f8f9fa;border-right:4px solid #C9A84C;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-size:14px;color:#555">
      <strong>مرجع الموضوع:</strong> ${referenceTitle}
      ${referenceType ? `<span style="display:inline-block;background:#e2e8f0;padding:2px 8px;border-radius:12px;font-size:12px;margin-right:8px">${referenceType}</span>` : ""}
    </div>
  ` : "";

  return `
  <!DOCTYPE html>
  <html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8">
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;text-align:right">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f4f6f9;padding:30px 10px">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.08);border:1px solid #e1e8ed">
            
            <!-- HEADER -->
            <tr>
              <td style="background:linear-gradient(135deg, #0D1B2A 0%, #1B263B 100%);padding:30px 25px;text-align:center">
                <div style="color:#C9A84C;font-size:24px;font-weight:bold;margin-bottom:4px;letter-spacing:1px">دار علي بن زيد</div>
                <div style="color:#e0e1dd;font-size:13px;letter-spacing:2px">للطباعة والنشر والتوزيع — بسكرة، الجزائر</div>
              </td>
            </tr>

            <!-- BODY CONTENT -->
            <tr>
              <td style="padding:35px 30px">
                <div style="font-size:17px;font-weight:bold;color:#0D1B2A;margin-bottom:18px">
                  ${recipientName ? `الأستاذ(ة) الفاضل(ة): <span style="color:#C9A84C">${recipientName}</span>` : "تحية طيبة وبعد،"}
                </div>

                ${refBadge}

                <div style="border-top:1px solid #edf2f7;padding-top:18px;margin-bottom:25px">
                  ${formattedBody}
                </div>

                <div style="margin-top:30px;padding-top:20px;border-top:1px solid #edf2f7;font-size:14px;color:#718096">
                  مع خالص التحيات والتقدير،<br>
                  <strong style="color:#0D1B2A;font-size:15px">إدارة دار علي بن زيد للطباعة والنشر</strong>
                </div>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="background-color:#0D1B2A;padding:20px 25px;text-align:center;color:#a0aec0;font-size:12px;line-height:1.6">
                <div>دار علي بن زيد للطباعة والنشر — بسكرة، الجزائر 🇩🇿</div>
                <div style="margin-top:4px">
                  📧 <a href="mailto:contact@daralibenzid.com" style="color:#C9A84C;text-decoration:none">contact@daralibenzid.com</a> | 
                  📞 <span style="color:#e2e8f0">+213 770 92 14 26</span>
                </div>
                <div style="margin-top:8px;color:#718096;font-size:11px">تم إرسال هذا البريد تلقائياً من منصة دار علي بن زيد الرسمية.</div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}
