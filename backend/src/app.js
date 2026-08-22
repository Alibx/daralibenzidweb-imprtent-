import express from "express";
import cors from "cors";
import path from "node:path";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";

const app = express();

// Security: Helmet headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Performance: Gzip / Deflate Compression
app.use(compression());

// Security: Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 350, // limit each IP to 350 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تم تجاوز الحد المسموح به من الطلبات مؤقتاً، يرجى المحاولة بعد قليل." }
});
app.use("/api", globalLimiter);

// Specific Auth Brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 login attempts per 15 min
  message: { error: "تم حظر محاولات الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار 15 دقيقة." }
});
app.use("/api/admin/login", authLimiter);

// CORS Whitelist Protection
const ALLOWED_ORIGINS = [
  "https://daralibenzid.dz",
  "https://www.daralibenzid.dz",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:8080",
  "http://localhost:5500"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed) || allowed === origin)) {
      return callback(null, true);
    }
    if (/^https?:\/\/([a-zA-Z0-9-]+\.)?daralibenzid\.dz$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS policy: Not allowed by origin"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static uploaded files if any
const publicDir = path.resolve(process.cwd(), "public");
app.use(express.static(publicDir, {
  maxAge: "1d",
  etag: true
}));

// API Routes
app.use("/api", router);

// Root route
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "دار علي بن زيد API Server",
    database: "MySQL",
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

export default app;
