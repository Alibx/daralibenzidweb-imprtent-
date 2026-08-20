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
    const filePayload = req.body?.file || req.body?.image || req.body?.pdf || req.body?.data;

    if (filePayload && typeof filePayload === "string") {
      const matches = filePayload.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);

      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        let ext = mimeType.split("/")[1] || "bin";
        if (ext.includes(";")) ext = ext.split(";")[0];
        if (ext === "jpeg") ext = "jpg";

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

      // If already a valid URL or string
      return res.json({ url: filePayload, secure_url: filePayload });
    }

    res.status(400).json({ error: "No file data provided" });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

export default router;
