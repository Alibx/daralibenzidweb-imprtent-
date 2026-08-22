import { Router } from "express";
import { query } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// GET /orders/stats - Summary metrics for admin dashboard
router.get("/orders/stats", authenticateToken, async (_req, res) => {
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

// GET /orders/export - Export orders to Excel/CSV with UTF-8 BOM (Admin)
router.get("/orders/export", authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = "SELECT * FROM orders WHERE 1=1";
    const params = [];

    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY id DESC";

    const rows = await query(sql, params);

    const statusMap = {
      pending: "قيد الانتظار",
      confirmed: "مؤكد",
      shipped: "تم الشحن",
      delivered: "تم التوصيل",
      cancelled: "ملغي"
    };

    const deliveryMap = {
      home: "توصيل للمنزل",
      desk: "استلام من المكتب"
    };

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel Arabic compatibility
    csvContent += "رقم الطلب,تاريخ الطلب,اسم العميل,رقم الهاتف,الولاية,البلدية,العنوان التفصيلي,نوع التوصيل,تفاصيل الكتب,سعر الكتب (دج),تكلفة التوصيل (دج),قيمة الخصم (دج),كود الخصم,المجموع الإجمالي (دج),حالة الطلب,ملاحظات\n";

    rows.forEach(o => {
      const dateStr = o.created_at ? new Date(o.created_at).toISOString().split("T")[0] : "";
      const customer = `"${(o.customer_name || "").replace(/"/g, '""')}"`;
      const phone = `"${(o.customer_phone || "").replace(/"/g, '""')}"`;
      const wilaya = `"${(o.wilaya_name || "").replace(/"/g, '""')}"`;
      const commune = `"${(o.commune || "").replace(/"/g, '""')}"`;
      const address = `"${(o.address || "").replace(/"/g, '""')}"`;
      const delivery = `"${deliveryMap[o.delivery_type] || o.delivery_type}"`;
      
      let booksDesc = o.book_title || "";
      if (o.items) {
        try {
          const parsed = JSON.parse(o.items);
          if (Array.isArray(parsed) && parsed.length > 0) {
            booksDesc = parsed.map(i => `${i.title || i.book_title} (×${i.quantity || 1})`).join(" + ");
          }
        } catch { /* use default */ }
      }
      const booksCol = `"${booksDesc.replace(/"/g, '""')}"`;

      const bookPrice = Number(o.book_price || 0);
      const deliveryPrice = Number(o.delivery_price || 0);
      const discount = Number(o.discount_amount || 0);
      const coupon = o.coupon_code ? `"${o.coupon_code}"` : '""';
      const total = Number(o.total_price || 0);
      const st = `"${statusMap[o.status] || o.status}"`;
      const notes = o.notes ? `"${o.notes.replace(/"/g, '""')}"` : '""';

      csvContent += `${o.id},${dateStr},${customer},${phone},${wilaya},${commune},${address},${delivery},${booksCol},${bookPrice},${deliveryPrice},${discount},${coupon},${total},${st},${notes}\n`;
    });

    const filename = `orders_daralibenzid_${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting orders:", error);
    res.status(500).json({ error: "Failed to export orders" });
  }
});

// GET /orders - List all orders with filters
router.get("/orders", authenticateToken, async (req, res) => {
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
router.get("/orders/:id", authenticateToken, async (req, res) => {
  try {
    const rows = await query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Order not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// POST /orders - Create a new physical book order (Single book or Multi-item Cart)
router.post("/orders", async (req, res) => {
  try {
    const {
      book_id,
      items, // Array for cart orders: [{book_id, title, quantity, price}]
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

    if (!customer_name || !customer_phone || !wilaya_code) {
      return res.status(400).json({
        error: "يرجى ملء جميع الحقول المطلوبة (الاسم، رقم الهاتف، والولاية)",
      });
    }

    // 1. Calculate books subtotal & resolved items
    let mainBookId = 0;
    let mainBookTitle = "";
    let subtotal = 0;
    let totalQty = 0;
    let itemsJson = null;

    if (Array.isArray(items) && items.length > 0) {
      // Multi-item cart
      itemsJson = JSON.stringify(items);
      mainBookId = Number(items[0].book_id || items[0].id || 0);
      if (items.length === 1) {
        mainBookTitle = items[0].title || items[0].book_title || "كتاب";
      } else {
        mainBookTitle = `${items[0].title || items[0].book_title} + ${items.length - 1} كتب أخرى`;
      }

      items.forEach(it => {
        const itemPrice = Number(it.price || it.discount_price || 1200);
        const itemQty = Math.max(1, Number(it.quantity || 1));
        subtotal += itemPrice * itemQty;
        totalQty += itemQty;
      });
    } else if (book_id) {
      // Single book direct order
      mainBookId = Number(book_id);
      const bookRows = await query("SELECT * FROM books WHERE id = ?", [mainBookId]);
      if (!bookRows[0]) {
        return res.status(404).json({ error: "الكتاب المطلوب غير موجود" });
      }
      const book = bookRows[0];
      mainBookTitle = book.title;
      const unitPrice = Number(book.discount_price || book.price || 1200.0);
      totalQty = Math.max(1, Number(quantity) || 1);
      subtotal = unitPrice * totalQty;
      itemsJson = JSON.stringify([{
        book_id: book.id,
        title: book.title,
        price: unitPrice,
        quantity: totalQty,
        cover_url: book.cover_url
      }]);
    } else {
      return res.status(400).json({ error: "لم يتم تحديد أي كتاب للطلب" });
    }

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
        delivery_type, quantity, items, book_price, delivery_price,
        discount_amount, coupon_code, total_price,
        payment_method, payment_status, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mainBookId,
        mainBookTitle,
        customer_name.trim(),
        customer_phone.trim(),
        Number(wilaya_code),
        resolvedWilayaName,
        (commune || "").trim(),
        (address || "").trim(),
        delivery_type === "desk" ? "desk" : "home",
        totalQty,
        itemsJson,
        subtotal,
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

    const [createdOrder] = await query("SELECT * FROM orders WHERE id = ?", [result.insertId]);

    res.status(201).json({
      success: true,
      message: "تم تسجيل طلبك بنجاح! سنتصل بك هاتفياً لتأكيد الإرسال.",
      order: createdOrder,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "تعذّر تسجيل الطلب، يرجى المحاولة مرة أخرى." });
  }
});

// PUT /orders/:id/status - Update order status (Admin)
router.put("/orders/:id/status", authenticateToken, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const allowed = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: "حالة الطلب غير صالحة" });
    }

    const fields = [];
    const params = [];

    if (status) {
      fields.push("status = ?");
      params.push(status);
    }
    if (notes !== undefined) {
      fields.push("notes = ?");
      params.push(notes);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "لا توجد حقول للتعديل" });
    }

    params.push(req.params.id);
    await query(`UPDATE orders SET ${fields.join(", ")} WHERE id = ?`, params);

    const [updated] = await query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
    if (!updated) return res.status(404).json({ error: "Order not found" });

    res.json({ success: true, message: "تم تحديث حالة الطلب بنجاح", order: updated });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// DELETE /orders/:id - Delete order (Admin)
router.delete("/orders/:id", authenticateToken, async (req, res) => {
  try {
    const result = await query("DELETE FROM orders WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ success: true, message: "تم حذف الطلب بنجاح" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
