import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dar-ali-benzid-secure-super-jwt-key-2026";

/**
 * Generate a signed JWT token for an authenticated user
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Middleware: Verify JWT Bearer token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({
      error: "يرجى تسجيل الدخول للوصول إلى هذه البيانات (Unauthorized)",
      code: "AUTH_REQUIRED"
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: "انتهت صلاحية الجلسة أو أن الرمز غير صالح (Forbidden)",
        code: "INVALID_TOKEN"
      });
    }
    req.user = user;
    next();
  });
}

/**
 * Middleware: Require admin role (e.g. for staff management or server settings)
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      error: "هذا الإجراء متاح للمدير العام فقط (Admin Role Required)",
      code: "ADMIN_REQUIRED"
    });
  }
  next();
}
