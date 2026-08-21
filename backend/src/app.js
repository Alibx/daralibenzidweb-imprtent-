import express from "express";
import cors from "cors";
import path from "node:path";
import router from "./routes/index.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static uploaded files if any
const publicDir = path.resolve(process.cwd(), "public");
app.use(express.static(publicDir));

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
