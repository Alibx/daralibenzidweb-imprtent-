import app from "./app.js";
import { pool } from "./db.js";

const port = Number(process.env.PORT) || 8080;

app.listen(port, async () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
  
  try {
    const [rows] = await pool.query("SELECT 1 AS health");
    if (rows && rows.length > 0) {
      console.log("✅ MySQL Database connected successfully.");
    }
  } catch (err) {
    console.warn("⚠️ Warning: Could not connect to MySQL database immediately:", err.message);
    console.warn("   Please check your DATABASE_URL or MySQL environment variables.");
  }
});
