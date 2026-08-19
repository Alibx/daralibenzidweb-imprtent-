import mysql from "mysql2/promise";
import fs from "node:fs";

// Automatically load .env if running locally in Node 20+
if (typeof process.loadEnvFile === "function" && fs.existsSync(".env")) {
  try {
    process.loadEnvFile();
  } catch {}
}

// Resolve database configuration from environment variables
function getPoolConfig() {
  const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL;

  if (connectionUri) {
    return {
      uri: connectionUri,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
      dateStrings: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      connectTimeout: 30000,
    };
  }

  // Fallback to discrete environment variables
  return {
    host: process.env.MYSQL_HOST || process.env.DB_HOST || process.env.MYSQLHOST || "mysql.gb.stackcp.com",
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || process.env.MYSQLPORT || 45113),
    user: process.env.MYSQL_USER || process.env.DB_USER || process.env.MYSQLUSER || "daralibenzid-3737a16c",
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "assater123",
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || process.env.MYSQLDATABASE || "daralibenzid-3737a16c",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    dateStrings: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 30000,
  };
}

export const pool = mysql.createPool(getPoolConfig());

// Helper wrapper to execute queries cleanly
export async function query(sql, params = []) {
  const [results] = await pool.execute(sql, params);
  return results;
}

export default pool;
