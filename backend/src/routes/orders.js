import { Router } from "express";
import { query } from "../db.js";

const router = Router();

// GET /orders/stats - Summary metrics for admin dashboard
router.get("/orders/stats", async (_req, res) => {
  try {
    const [totalRow] = await query("SELECT COUNT(*) as total, COALESCE(SUM(total_price), 0) as total_revenue FROM orders");
    const [pendingRow] = await query("SELECT COUNT(*) as pending FROM orders WHERE status = 'pending'");
    const [confirmedRow] = await query("SELECT COUNT(*) as confirmed FROM orders WHERE status = 'confirmed'");
    const [shippedRow] = await query("SELECT COUNT(*) as shipped FROM orders WHERE status = 'shipped'");
    const [deliveredRow] = await query("SELECT COUNT(*) as delivered FROM orders WHERE status = 'delivered'");
    const [cancelledRow] = await query("SELECT COUNT(*) as cancelled FROM orders WHERE status = 'cancelled'");

    res.json({
      total: Number(totalRow.total || 0),
      revenue: Number(totalRow.total_revenue || 0),
      pending: Number(pendingRow.pending || 0),
      confirmed: Number(confirmedRow.confirmed || 0),
      shipped: Number(shippedRow.shipped || 0),
      delivered: Number(deliveredRow.delivered || 0),
      cancelled: Number(cancelledRow.cancelled || 0),
    });
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: "Failed to fetch order stats" });
  }
});

// GET /orders - List all orders with filters
router.get("/orders", async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = "SELECT * FROM orders WHERE 1=1";
    const params = [];

    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      sql += " AND (customer_name LIKE ? OR customer_phone LIKE ? OR wilaya_name LIKE ? OR book_title LIKE ?)";
      params.push(term, term, term, term);
    }

    sql += " ORDER BY id DESC";
    const rows = await query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /orders/:id - Get single order
router.get("/orders/:id", async (req, res) => {
  try {
    const rows = await query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Order not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// POST /orders - Create a new physical book order (Public Checkout)
router.post("/orders", async (req, res) => {
  try {
    const {
      book_id,
      customer_name,
      customer_phone,
      wilaya_code,
      wilaya_name,
      commune,
      address,
      delivery_type = "home",
      quantity = 1,
      coupon_code,
      payment_method = "cod",
      notes,
    } = req.body;

    if (!book_id || !customer_name || !customer_phone || !wilaya_code) {
      return res.status(400).json({
        error: "يرجى ملء جميع الحقول المطلوبة (الكتاب، الاسم، رقم الهاتف، والولاية)",
      });
    }

    // 1. Fetch book details
    const bookRows = await query("SELECT * FROM books WHERE id = ?", [Number(book_id)]);
    if (!bookRows[0]) {
      return res.status(404).json({ error: "الكتاب المطلوب غير موجود" });
    }
    const book = bookRows[0];
    const unitPrice = Number(book.discount_price || book.price || 1200.0);
    const qty = Math.max(1, Number(quantity) || 1);
    const subtotal = unitPrice * qty;

    // 2. Fetch delivery rate for the chosen wilaya
    let deliveryPrice = 600.0;
    let resolvedWilayaName = wilaya_name || `ولاية ${wilaya_code}`;

    const rateRows = await query("SELECT * FROM delivery_rates WHERE wilaya_code = ?", [Number(wilaya_code)]);
    if (rateRows[0]) {
      if (Number(rateRows[0].is_available) === 0) {
        return res.status(400).json({ error: "عذراً، التوصيل غير متاح حالياً للولاية المختارة" });
      }
      resolvedWilayaName = rateRows[0].wilaya_name;
      deliveryPrice = delivery_type === "desk"
        ? Number(rateRows[0].desk_price || 400.0)
        : Number(rateRows[0].home_price || 600.0);
    }

    // 3. Process coupon discount if provided
    let discountAmount = 0.0;
    let appliedCoupon = null;

    if (coupon_code && coupon_code.trim()) {
      const cRows = await query(
        "SELECT * FROM coupons WHERE BINARY code = ? AND is_active = 1",
        [coupon_code.trim()]
      );
      if (cRows[0]) {
        const coupon = cRows[0];
        const isNotExpired = !coupon.expires_at || new Date(coupon.expires_at) >= new Date();
        const hasUsesLeft = coupon.max_uses === null || coupon.used_count < coupon.max_uses;
        const meetsMinOrder = subtotal >= Number(coupon.min_order || 0);

        if (isNotExpired && hasUsesLeft && meetsMinOrder) {
          appliedCoupon = coupon.code;
          if (coupon.discount_type === "percent") {
            discountAmount = (subtotal * Number(coupon.discount_value)) / 100;
          } else {
            discountAmount = Math.min(subtotal, Number(coupon.discount_value));
          }
          // Increment coupon usage counter
          await query("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?", [coupon.id]);
        }
      }
    }

    const totalPrice = Math.max(0, subtotal + deliveryPrice - discountAmount);

    // 4. Insert order
    const result = await query(
      `INSERT INTO orders (
        book_id, book_title, customer_name, customer_phone,
        wilaya_code, wilaya_name, commune, address,
        delivery_type, quantity, book_price, delivery_price,
        discount_amount, coupon_code, total_price,
        payment_method, payment_status, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book.id,
        book.title,
        customer_name.trim(),
        customer_phone.trim(),
        Number(wilaya_code),
        resolvedWilayaName,
        (commune || "").trim(),
        (address || "").trim(),
        delivery_type === "desk" ? "desk" : "home",
        qty,
        unitPrice,
        deliveryPrice,
        discountAmount,
        appliedCoupon,
        totalPrice,
        payment_method || "cod",
        payment_method === "paypal" ? "paid" : "pending",
        notes ? notes.trim() : null,
        "pending",
      ]
    );

    const newOrder = await query("SELECT * FROM orders WHERE id = ?", [result.insertId]);
    res.status(201).json({
      success: true,
      message: "تم تسجيل طلبك بنجاح! سنتصل بك قريباً لتأكيد الطلب.",
      order: newOrder[0],
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "تعذّر تسجيل الطلب، يرجى المحاولة مرة أخرى." });
  }
});

// PATCH /orders/:id/status - Update order status (Admin)
router.patch("/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    await query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id]);
    const rows = await query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Order not found" });

    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// DELETE /orders/:id - Delete order (Admin)
router.delete("/orders/:id", async (req, res) => {
  try {
    await query("DELETE FROM orders WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "تم حذف الطلب بنجاح" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
