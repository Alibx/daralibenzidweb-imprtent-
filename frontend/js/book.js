import { api } from './api-r.js';
import { ALGERIA_WILAYAS } from './algeria_cities.js';

// ─── STATE ────────────────────────────────────────────────────────────────────
let currentBook = null;
let orderQty = 1;
let cachedRates = [];
let appliedDiscount = 0;
let appliedCouponCode = '';
let cart = [];
try {
  cart = JSON.parse(localStorage.getItem('dar_cart') || '[]');
  if (!Array.isArray(cart)) cart = [];
} catch {
  cart = [];
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, type = 'success') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
}

function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const apiBase = window.__API_BASE__ || 'https://daralibenzidweb.onrender.com';
  return apiBase.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
}

// ─── CART DRAWER ──────────────────────────────────────────────────────────────
function saveCart() {
  localStorage.setItem('dar_cart', JSON.stringify(cart));
  updateCartBadges();
  renderCartDrawer();
}

function updateCartBadges() {
  const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const badge = document.getElementById('cartBadge');
  const drawerCount = document.getElementById('cartDrawerCountBadge');

  if (badge) {
    badge.textContent = count;
    badge.classList.remove('bump');
    void badge.offsetWidth;
    if (count > 0) badge.classList.add('bump');
  }
  if (drawerCount) drawerCount.textContent = `${count} كتب`;
}

window.removeFromCart = function(bookId) {
  cart = cart.filter(i => i.bookId !== bookId);
  saveCart();
};

window.changeCartQty = function(bookId, delta) {
  const item = cart.find(i => i.bookId === bookId);
  if (!item) return;
  item.quantity = (item.quantity || 1) + delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.bookId !== bookId);
  }
  saveCart();
};

function renderCartDrawer() {
  const body = document.getElementById('cartDrawerBody');
  const subtotalEl = document.getElementById('cartSubtotalVal');
  const checkoutBtn = document.getElementById('btnCartCheckout');
  if (!body) return;

  if (!cart.length) {
    body.innerHTML = `
      <div class="cart-empty-state">
        <div class="cart-empty-icon">🛒</div>
        <h3>سلة المشتريات فارغة</h3>
        <p style="margin-top:0.4rem;font-size:0.88rem">أضف الكتب التي تود اقتناءها إلى السلة!</p>
      </div>`;
    if (subtotalEl) subtotalEl.textContent = '0 دج';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (checkoutBtn) checkoutBtn.disabled = false;

  let subtotal = 0;
  body.innerHTML = cart.map(item => {
    const itemTotal = item.price * (item.quantity || 1);
    subtotal += itemTotal;
    const coverPath = resolveMediaUrl(item.coverUrl);

    return `
      <div class="cart-item-card">
        <div class="cart-item-thumb">
          ${coverPath ? `<img src="${escHtml(coverPath)}" alt="${escHtml(item.title)}">` : '<div style="background:#1B6CA8;width:100%;height:100%;display:flex;align-items:center;justify-content:center">📖</div>'}
        </div>
        <div class="cart-item-info">
          <div class="cart-item-title" title="${escHtml(item.title)}">${escHtml(item.title)}</div>
          <div class="cart-item-price">${item.price} دج <small style="color:var(--text-muted)">(${itemTotal} دج)</small></div>
          <div class="cart-item-stepper">
            <button type="button" class="cart-step-btn" onclick="changeCartQty(${item.bookId}, -1)">-</button>
            <span class="cart-step-qty">${item.quantity || 1}</span>
            <button type="button" class="cart-step-btn" onclick="changeCartQty(${item.bookId}, 1)">+</button>
          </div>
        </div>
        <button type="button" class="cart-item-del-btn" onclick="removeFromCart(${item.bookId})" title="حذف من السلة">🗑️</button>
      </div>
    `;
  }).join('');

  if (subtotalEl) subtotalEl.textContent = `${subtotal} دج`;
}

function openCartDrawer() {
  renderCartDrawer();
  document.getElementById('cartDrawer')?.classList.add('open');
  document.getElementById('cartDrawerOverlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  document.getElementById('cartDrawer')?.classList.remove('open');
  document.getElementById('cartDrawerOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}

function initCart() {
  updateCartBadges();
  document.getElementById('navCartBtn')?.addEventListener('click', openCartDrawer);
  document.getElementById('cartDrawerClose')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartDrawerOverlay')?.addEventListener('click', closeCartDrawer);
  document.getElementById('btnCartCheckout')?.addEventListener('click', () => {
    window.location.href = './index.html';
  });
}

// ─── LOAD BOOK & POPULATE ─────────────────────────────────────────────────────
async function loadBookData() {
  const params = new URLSearchParams(window.location.search);
  let bookId = Number(params.get('id'));

  let books = [];
  try {
    books = await api.get('/api/books');
  } catch {
    books = [];
  }

  if (!Array.isArray(books) || !books.length) {
    document.getElementById('bookPageTitle').textContent = 'لا توجد كتب متاحة حالياً';
    return;
  }

  currentBook = bookId ? books.find(b => b.id === bookId) : books[0];
  if (!currentBook) currentBook = books[0];

  document.title = `${currentBook.title} — دار علي بن زيد للنشر`;

  // Populate Showcase
  const coverPath = resolveMediaUrl(currentBook.cover_url);
  const coverEl = document.getElementById('bookCoverLarge');
  if (coverEl) {
    coverEl.innerHTML = coverPath
      ? `<img src="${escHtml(coverPath)}" alt="${escHtml(currentBook.title)}" onerror="this.parentElement.innerHTML='<span style=\\'font-size:4rem;opacity:.5\\'>📖</span>'">`
      : `<span style="font-size:4rem;opacity:.5">📖</span>`;
  }

  document.getElementById('bookPageTitle').textContent = currentBook.title;
  document.getElementById('bookPageAuthor').textContent = `✍️ تأليف: ${currentBook.author}`;

  let cats = [];
  try { cats = await api.get('/api/categories'); } catch { cats = []; }
  const cat = Array.isArray(cats) ? cats.find(c => String(c.id) === String(currentBook.category_id)) : null;
  const catBadge = document.getElementById('bookCategoryBadge');
  if (catBadge) {
    catBadge.textContent = cat ? (cat.name || cat.name_ar || 'إصدارات الدار') : 'إصدارات الدار';
    if (cat?.color) catBadge.style.borderColor = cat.color;
  }

  // Pricing
  const price = Number(currentBook.price) || 1200;
  const discountPrice = currentBook.discount_price ? Number(currentBook.discount_price) : null;
  const hasDiscount = discountPrice && discountPrice < price;

  const currEl = document.getElementById('bookPriceCurr');
  const oldEl = document.getElementById('bookPriceOld');
  const discEl = document.getElementById('bookPriceDiscount');

  if (currEl) currEl.textContent = `${hasDiscount ? discountPrice : price} دج`;
  if (oldEl) {
    oldEl.textContent = `${price} دج`;
    oldEl.style.display = hasDiscount ? 'inline' : 'none';
  }
  if (discEl) {
    discEl.textContent = `خصم ${price - discountPrice} دج`;
    discEl.style.display = hasDiscount ? 'inline' : 'none';
  }

  // Meta Pills
  const pillsEl = document.getElementById('bookMetaPills');
  if (pillsEl) {
    pillsEl.innerHTML = `
      ${currentBook.year ? `<span class="book-meta-pill">📅 سنة النشر: ${currentBook.year}</span>` : ''}
      ${currentBook.pages ? `<span class="book-meta-pill">📄 عدد الصفحات: ${currentBook.pages} صفحة</span>` : ''}
      <span class="book-meta-pill">📦 متوفر وجاهز للشحن الفوري</span>
      <span class="book-meta-pill">🇩🇿 الدفع عند الاستلام</span>
    `;
  }

  // Description
  const descEl = document.getElementById('bookPageDesc');
  if (descEl) {
    descEl.textContent = currentBook.description || 'إصدار مميز من منشورات دار علي بن زيد للطباعة والنشر. طبعة أصلية منقحة ومطبوعة بأعلى معايير الجودة الورقية والطباعية.';
  }

  // PDF Box
  if (currentBook.pdf_url) {
    const pdfBox = document.getElementById('pdfPurchaseBox');
    const pdfVal = document.getElementById('pdfPriceVal');
    if (pdfBox) pdfBox.style.display = 'flex';
    if (pdfVal) pdfVal.textContent = (currentBook.pdf_price || 5.0).toFixed(2);
  }

  // WhatsApp Order Link
  const waBtn = document.getElementById('btnOrderWaDirect');
  if (waBtn) {
    const phone = '213770921426';
    const text = encodeURIComponent(`مرحباً دار علي بن زيد، أود طلب كتاب (${currentBook.title}) للمؤلف (${currentBook.author}):`);
    waBtn.href = `https://wa.me/${phone}?text=${text}`;
  }

  // Reviews
  loadBookReviews(currentBook.id);
  updateOrderCalc();
}

// ─── REVIEWS ──────────────────────────────────────────────────────────────────
async function loadBookReviews(bookId) {
  const listEl = document.getElementById('bookReviewsList');
  const avgNum = document.getElementById('ratingAvgNum');
  const avgStars = document.getElementById('ratingAvgStars');
  const countText = document.getElementById('ratingCountText');
  if (!listEl) return;

  try {
    const data = await api.get(`/api/books/${bookId}/reviews`);
    const reviews = data.reviews || [];
    const avg = Number(data.avg_rating || 5.0).toFixed(1);
    const total = data.total_reviews || 0;

    if (avgNum) avgNum.textContent = avg;
    if (avgStars) avgStars.textContent = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
    if (countText) countText.textContent = `(${total} مراجعات)`;

    if (!reviews.length) {
      listEl.innerHTML = `<div class="empty-reviews">لا توجد مراجعات بعد. كن أول من يكتب مراجعة لهذا الكتاب!</div>`;
      return;
    }

    listEl.innerHTML = reviews.map(r => {
      const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
      const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('ar-DZ') : '';
      return `
        <div class="review-item" style="background:rgba(255,255,255,0.03);padding:0.9rem 1rem;border-radius:8px;margin-bottom:0.75rem;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem">
            <span style="font-weight:bold;color:var(--text-light)">👤 ${escHtml(r.reviewer_name)}</span>
            <div>
              <span style="color:#f1c40f;letter-spacing:1px">${stars}</span>
              <small style="color:var(--text-muted);margin-right:0.4rem">${dateStr}</small>
            </div>
          </div>
          <p style="margin:0;color:var(--text-muted);font-size:0.9rem;line-height:1.5">${escHtml(r.comment || '')}</p>
        </div>
      `;
    }).join('');
  } catch {
    listEl.innerHTML = `<div class="empty-reviews">كن أول من يكتب مراجعة لهذا الكتاب!</div>`;
  }
}

function initReviews() {
  const starBtns = document.querySelectorAll('#starIcons .star-btn');
  const ratingIn = document.getElementById('reviewRatingInput');

  starBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.val);
      if (ratingIn) ratingIn.value = val;
      starBtns.forEach(b => {
        b.classList.toggle('active', Number(b.dataset.val) <= val);
      });
    });
  });

  document.getElementById('addReviewForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentBook) return;

    const name = document.getElementById('reviewNameInput')?.value.trim();
    const comment = document.getElementById('reviewCommentInput')?.value.trim();
    const rating = Number(ratingIn?.value || 5);

    if (!name) { toast('يرجى كتابة اسمك الكريم', 'error'); return; }

    const btn = document.getElementById('btnSubmitReview');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الإرسال...'; }

    try {
      await api.post(`/api/books/${currentBook.id}/reviews`, { reviewer_name: name, rating, comment });
      toast('شكراً لتقييمك! ستتم مراجعة التقييم واعتماده قريباً ✨');
      document.getElementById('addReviewForm').reset();
      if (ratingIn) ratingIn.value = 5;
      starBtns.forEach(b => b.classList.add('active'));
    } catch (err) {
      toast('تعذّر إرسال التقييم: ' + (err.message || ''), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'إرسال التقييم ✨'; }
    }
  });
}

// ─── ORDER FORM & CALCULATION ─────────────────────────────────────────────────
async function loadDeliveryRates() {
  try {
    cachedRates = await api.get('/api/delivery/rates');
  } catch {
    cachedRates = [];
  }
  const available = cachedRates.filter(w => Number(w.is_available) === 1);
  const select = document.getElementById('orderWilayaSelect');
  if (select) {
    if (!available.length) {
      select.innerHTML = `<option value="">-- عذراً، التوصيل غير متاح حالياً --</option>`;
    } else {
      select.innerHTML = `<option value="">-- اختر ولايتك (${available.length} ولاية متاحة) --</option>` +
        available.map(w => `<option value="${w.wilaya_code}" data-home="${w.home_price}" data-desk="${w.desk_price}">${w.wilaya_code}. ${escHtml(w.wilaya_name)}</option>`).join('');
    }
  }
}

function onWilayaChanged() {
  const wilayaSelect = document.getElementById('orderWilayaSelect');
  const communeSelect = document.getElementById('orderCommuneSelect');
  const customInput = document.getElementById('orderCommuneCustom');
  const wilayaCode = Number(wilayaSelect?.value);

  if (customInput) { customInput.value = ''; customInput.style.display = 'none'; }

  if (!wilayaCode || !communeSelect) {
    if (communeSelect) communeSelect.innerHTML = `<option value="">-- اختر الولاية أولاً --</option>`;
    updateOrderCalc();
    return;
  }

  const wilayaData = ALGERIA_WILAYAS.find(w => w.code === wilayaCode);
  const communes = wilayaData ? wilayaData.communes : [];

  communeSelect.innerHTML = `<option value="">-- اختر البلدية (${communes.length} بلدية) --</option>` +
    communes.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('') +
    `<option value="__CUSTOM__">✍️ بلدية أخرى (كتابة يدوية)</option>`;

  updateOrderCalc();
}

function updateOrderCalc() {
  if (!currentBook) return;

  const unitPrice = Number(currentBook.discount_price || currentBook.price || 1200);
  const subtotal = unitPrice * orderQty;

  const wilayaSelect = document.getElementById('orderWilayaSelect');
  const selectedOpt = wilayaSelect?.options[wilayaSelect.selectedIndex];

  const homePrice = selectedOpt ? Number(selectedOpt.dataset.home || 600) : 600;
  const deskPrice = selectedOpt ? Number(selectedOpt.dataset.desk || 400) : 400;

  const homePriceEl = document.getElementById('homeDeliveryPrice');
  const deskPriceEl = document.getElementById('deskDeliveryPrice');
  if (homePriceEl) homePriceEl.textContent = `${homePrice} دج`;
  if (deskPriceEl) deskPriceEl.textContent = `${deskPrice} دج`;

  const deliveryType = document.querySelector('input[name="orderDeliveryType"]:checked')?.value || 'home';
  const shippingFee = wilayaSelect?.value ? (deliveryType === 'desk' ? deskPrice : homePrice) : 0;

  const total = Math.max(0, subtotal + shippingFee - appliedDiscount);

  document.getElementById('calcBookPriceLabel').textContent = `سعر الكتاب (×${orderQty}):`;
  document.getElementById('calcBookPrice').textContent = `${subtotal} دج`;
  document.getElementById('calcDeliveryPrice').textContent = shippingFee > 0 ? `${shippingFee} دج` : 'اختر الولاية';
  document.getElementById('calcTotal').textContent = `${total} دج`;

  const discRow = document.getElementById('calcDiscountRow');
  if (discRow) {
    if (appliedDiscount > 0) {
      discRow.style.display = 'flex';
      document.getElementById('calcDiscount').textContent = `-${appliedDiscount} دج`;
    } else {
      discRow.style.display = 'none';
    }
  }
}

function initOrderForm() {
  // Stepper
  document.getElementById('btnQtyMinus')?.addEventListener('click', () => {
    if (orderQty > 1) {
      orderQty--;
      document.getElementById('orderQtyInput').value = orderQty;
      updateOrderCalc();
    }
  });
  document.getElementById('btnQtyPlus')?.addEventListener('click', () => {
    if (orderQty < 20) {
      orderQty++;
      document.getElementById('orderQtyInput').value = orderQty;
      updateOrderCalc();
    }
  });

  // Wilaya & Commune
  document.getElementById('orderWilayaSelect')?.addEventListener('change', onWilayaChanged);
  document.getElementById('orderCommuneSelect')?.addEventListener('change', e => {
    const customInput = document.getElementById('orderCommuneCustom');
    if (e.target.value === '__CUSTOM__') {
      if (customInput) { customInput.style.display = 'block'; customInput.focus(); }
    } else {
      if (customInput) customInput.style.display = 'none';
    }
  });

  // Delivery radio toggle
  document.querySelectorAll('input[name="orderDeliveryType"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('.del-opt-card').forEach(c => c.classList.remove('active'));
      r.closest('.del-opt-card')?.classList.add('active');
      updateOrderCalc();
    });
  });

  // Apply Coupon
  document.getElementById('btnApplyCoupon')?.addEventListener('click', async () => {
    const code = document.getElementById('orderCouponInput')?.value.trim();
    const msgEl = document.getElementById('couponStatusMsg');
    if (!code) {
      if (msgEl) msgEl.innerHTML = `<span style="color:var(--danger)">يرجى كتابة رمز الكوبون</span>`;
      return;
    }
    const unitPrice = Number(currentBook?.discount_price || currentBook?.price || 1200);
    const subtotal = unitPrice * orderQty;

    if (msgEl) msgEl.innerHTML = `<span>جارٍ التحقق...</span>`;
    try {
      const res = await api.post('/api/coupons/validate', { code, subtotal });
      if (res.valid) {
        appliedDiscount = Number(res.discount_amount);
        appliedCouponCode = res.code;
        if (msgEl) msgEl.innerHTML = `<span style="color:var(--success)">✅ ${res.message}</span>`;
        updateOrderCalc();
      } else {
        appliedDiscount = 0;
        appliedCouponCode = '';
        if (msgEl) msgEl.innerHTML = `<span style="color:var(--danger)">❌ ${res.message || 'الكوبون غير صالح'}</span>`;
        updateOrderCalc();
      }
    } catch (err) {
      appliedDiscount = 0;
      appliedCouponCode = '';
      if (msgEl) msgEl.innerHTML = `<span style="color:var(--danger)">❌ ${err.message || 'كود الخصم غير صحيح'}</span>`;
      updateOrderCalc();
    }
  });

  // Add to cart secondary button
  document.getElementById('btnAddToCart')?.addEventListener('click', () => {
    if (!currentBook) return;
    const price = Number(currentBook.discount_price || currentBook.price || 1200);
    const existing = cart.find(i => i.bookId === currentBook.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + orderQty;
    } else {
      cart.push({
        bookId: currentBook.id,
        title: currentBook.title,
        author: currentBook.author,
        price,
        coverUrl: currentBook.cover_url,
        quantity: orderQty
      });
    }
    saveCart();
    toast(`🛒 تمت إضافة (${currentBook.title} ×${orderQty}) إلى سلة المشتريات`);
  });

  // Order Form Submit
  document.getElementById('bookOrderForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentBook) return;

    const name    = document.getElementById('orderCustomerName')?.value.trim();
    const phone   = document.getElementById('orderCustomerPhone')?.value.trim();
    const wilaya  = document.getElementById('orderWilayaSelect')?.value;
    const communeSelectVal = document.getElementById('orderCommuneSelect')?.value;
    const communeCustomVal = document.getElementById('orderCommuneCustom')?.value.trim();
    const commune = (communeSelectVal === '__CUSTOM__' ? communeCustomVal : communeSelectVal) || '';
    const address = document.getElementById('orderAddress')?.value.trim();
    const notes   = document.getElementById('orderNotes')?.value.trim();
    const deliveryType = document.querySelector('input[name="orderDeliveryType"]:checked')?.value || 'home';

    if (!name || !phone || !wilaya || !commune || !address) {
      toast('يرجى ملء كافة الحقول الإلزامية: الاسم، الهاتف، الولاية، البلدية، والعنوان', 'error');
      return;
    }

    const btn = document.getElementById('btnSubmitOrder');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ تسجيل طلبك...'; }

    try {
      const payload = {
        book_id: currentBook.id,
        quantity: orderQty,
        customer_name: name,
        customer_phone: phone,
        wilaya_code: Number(wilaya),
        commune,
        address,
        notes: notes || null,
        delivery_type: deliveryType,
        coupon_code: appliedCouponCode || null,
        payment_method: 'cod'
      };

      const res = await api.post('/api/orders', payload);

      document.getElementById('successOrderId').textContent = `#${res.order?.id || 'OK'}`;
      document.getElementById('successBookTitle').textContent = `${currentBook.title} (×${orderQty})`;
      document.getElementById('successWilaya').textContent = res.order?.wilaya_name || `ولاية ${wilaya}`;
      document.getElementById('successTotal').textContent = `${res.order?.total_price || 0} دج`;

      document.getElementById('orderSuccessModal')?.classList.add('open');
      document.body.style.overflow = 'hidden';
    } catch (err) {
      toast('تعذّر إرسال الطلب: ' + (err.message || 'يرجى المحاولة مرة أخرى'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🛍️ اضغط هنا لتأكيد طلبك (الدفع عند الاستلام)'; }
    }
  });

  // Success modal close
  document.getElementById('btnOrderSuccessClose')?.addEventListener('click', () => {
    document.getElementById('orderSuccessModal')?.classList.remove('open');
    document.body.style.overflow = '';
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initCart();
  initReviews();
  initOrderForm();
  await loadDeliveryRates();
  await loadBookData();
});
