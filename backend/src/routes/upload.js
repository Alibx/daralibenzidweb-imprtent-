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

router.post("/upload", (req, res) => {
  try {
    // If request contains json/base64 payload
    if (req.body && (req.body.file || req.body.image || req.body.pdf || req.body.data)) {
      const dataUri = req.body.file || req.body.image || req.body.pdf || req.body.data;
      const matches = dataUri.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const ext = mimeType.split("/")[1] || "bin";
        const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
        const filePath = path.join(uploadsDir, filename);

        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
        const fileUrl = `/uploads/${filename}`;
        return res.json({ url: fileUrl, secure_url: fileUrl, image_url: fileUrl, pdf_url: fileUrl });
      }

      return res.json({ url: dataUri, secure_url: dataUri });
    }

    // Default response if no file data parsed
    res.status(400).json({ error: "No file data provided" });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

export default router;
