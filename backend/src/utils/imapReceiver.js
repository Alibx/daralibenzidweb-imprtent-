import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { query } from "../db.js";

// Ensure inbox_emails table and IMAP columns exist
export async function ensureInboxTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS \`inbox_emails\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`uid\` VARCHAR(150) UNIQUE,
        \`from_name\` VARCHAR(255) DEFAULT '',
        \`from_email\` VARCHAR(255) NOT NULL,
        \`to_email\` VARCHAR(255) DEFAULT '',
        \`subject\` VARCHAR(500) DEFAULT '(بدون موضوع)',
        \`body_text\` LONGTEXT,
        \`body_html\` LONGTEXT,
        \`date\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`is_read\` TINYINT(1) DEFAULT 0,
        \`is_starred\` TINYINT(1) DEFAULT 0,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure IMAP settings columns in settings table
    const imapCols = [
      "ALTER TABLE `settings` ADD COLUMN `imap_host` VARCHAR(255) DEFAULT 'imap.stackmail.com'",
      "ALTER TABLE `settings` ADD COLUMN `imap_port` INT DEFAULT 993",
      "ALTER TABLE `settings` ADD COLUMN `imap_user` VARCHAR(255) DEFAULT 'info@daralibenzid.dz'",
      "ALTER TABLE `settings` ADD COLUMN `imap_pass` VARCHAR(255) DEFAULT NULL"
    ];
    for (const sql of imapCols) {
      try {
        await query(sql);
      } catch {
        // silent ignore if duplicate
      }
    }
  } catch (err) {
    console.warn("ensureInboxTable error:", err.message);
  }
}

export async function getImapConfig() {
  await ensureInboxTable();
  try {
    const rows = await query("SELECT imap_host, imap_port, imap_user, imap_pass, smtp_user, smtp_pass FROM settings LIMIT 1");
    if (rows && rows[0]) {
      const r = rows[0];
      return {
        host: r.imap_host || process.env.IMAP_HOST || "imap.stackmail.com",
        port: Number(r.imap_port || process.env.IMAP_PORT || 993),
        user: r.imap_user || r.smtp_user || process.env.IMAP_USER || "info@daralibenzid.dz",
        pass: r.imap_pass || r.smtp_pass || process.env.IMAP_PASS || ""
      };
    }
  } catch (err) {
    console.warn("getImapConfig db error:", err.message);
  }
  return {
    host: process.env.IMAP_HOST || "imap.stackmail.com",
    port: Number(process.env.IMAP_PORT || 993),
    user: process.env.IMAP_USER || "info@daralibenzid.dz",
    pass: process.env.IMAP_PASS || ""
  };
}

export async function syncIncomingEmails(overrideConfig = null) {
  await ensureInboxTable();
  const config = overrideConfig || (await getImapConfig());

  if (!config.host || !config.user || !config.pass) {
    throw new Error("بيانات خادم البريد الوارد (IMAP) غير مكتملة. يرجى ضبط اسم المستخدم وكلمة المرور.");
  }

  const client = new ImapFlow({
    host: config.host.trim(),
    port: config.port || 993,
    secure: config.port === 993,
    auth: {
      user: config.user.trim(),
      pass: config.pass.trim()
    },
    logger: false,
    tls: {
      rejectUnauthorized: false
    }
  });

  let newCount = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch the latest 40 messages in INBOX
      const status = await client.status("INBOX", { messages: true });
      const totalMessages = status.messages || 0;

      if (totalMessages > 0) {
        const startSeq = Math.max(1, totalMessages - 35);
        const sequence = `${startSeq}:*`;

        for await (const message of client.fetch(sequence, { uid: true, source: true })) {
          const uidStr = `stackcp_${config.user}_${message.uid}`;

          // Check if already stored in DB
          const existing = await query("SELECT id FROM inbox_emails WHERE uid = ? LIMIT 1", [uidStr]);
          if (existing && existing.length > 0) {
            continue;
          }

          // Parse full email source
          const parsed = await simpleParser(message.source);

          const fromText = parsed.from?.text || parsed.from?.value?.[0]?.name || parsed.from?.value?.[0]?.address || "غير معروف";
          const fromAddress = parsed.from?.value?.[0]?.address || config.user;
          const toAddress = parsed.to?.text || config.user;
          const subject = parsed.subject || "(بدون موضوع)";
          const bodyText = parsed.text || "";
          const bodyHtml = parsed.html || parsed.textAsHtml || `<p>${bodyText}</p>`;
          const emailDate = parsed.date ? new Date(parsed.date) : new Date();

          await query(
            `INSERT INTO inbox_emails (uid, from_name, from_email, to_email, subject, body_text, body_html, date, is_read)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [uidStr, fromText, fromAddress, toAddress, subject, bodyText, bodyHtml, emailDate]
          );

          newCount++;
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error("IMAP Sync error:", err);
    throw new Error(err.message || "فشل الاتصال بخادم البريد الوارد IMAP");
  }

  return { success: true, newCount };
}
