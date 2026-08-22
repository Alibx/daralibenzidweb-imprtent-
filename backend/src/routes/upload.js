import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const router = Router();
const uploadsDir = path.resolve(process.cwd(), "public", "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Strict whitelist of allowed MIME types and their safe extensions
const ALLOWED_MIME_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

router.post("/upload", (req, res) => {
  try {
    const filePayload = req.body?.file || req.body?.image || req.body?.pdf || req.body?.data;

    if (filePayload && typeof filePayload === "string") {
      const matches = filePayload.match(/^data:([A-Za-z0-9-+.\/]+);base64,(.+)$/);

      if (matches && matches.length === 3) {
        const rawMime = matches[1].toLowerCase().split(";")[0].trim();
        const base64Data = matches[2];

        // Check against whitelist
        let ext = ALLOWED_MIME_MAP[rawMime];
        if (!ext) {
          return res.status(400).json({
            error: "نوع الملف غير مسموح به. الأنواع المسموحة فقط: الصور (JPG, PNG, WEBP) والمستندات (PDF, DOC, DOCX)."
          });
        }

        // Limit size (max 25MB decoded)
        const approxSizeInBytes = (base64Data.length * 3) / 4;
        if (approxSizeInBytes > 25 * 1024 * 1024) {
          return res.status(400).json({ error: "حجم الملف كبير جداً. الحد الأقصى المسموح به هو 25 ميجابايت." });
        }

        const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
        
        const host = req.get("host");
        const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
        const fileUrl = `${protocol}://${host}/uploads/${filename}`;

        return res.json({
          url: fileUrl,
          secure_url: fileUrl,
          image_url: fileUrl,
          pdf_url: fileUrl,
        });
      }

      // If already a valid URL
      if (filePayload.startsWith("http://") || filePayload.startsWith("https://") || filePayload.startsWith("/uploads/")) {
        return res.json({ url: filePayload, secure_url: filePayload });
      }

      return res.status(400).json({ error: "تنسيق الملف غير صالح" });
    }

    res.status(400).json({ error: "لم يتم إرسال أي ملف" });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "تعذّر رفع الملف على الخادم" });
  }
});

export default router;
