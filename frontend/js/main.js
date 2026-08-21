import { api } from './api-r.js';
import { ALGERIA_WILAYAS } from './algeria_cities.js';

// ─── STATE ────────────────────────────────────────────────────────────────────
let allBooks      = [];
let allCategories = [];
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

// ─── SHOPPING CART STATE & DRAWER ─────────────────────────────────────────────
function saveCart() {
  localStorage.setItem('dar_cart', JSON.stringify(cart));
  updateCartBadges();
  renderCartDrawer();
}

function updateCartBadges() {
  const count = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const badge = document.getElementById('cartBadge');
  const mobileBadge = document.getElementById('mobileCartBadge');
  const drawerCount = document.getElementById('cartDrawerCountBadge');

  if (badge) {
    badge.textContent = count;
    badge.classList.remove('bump');
    void badge.offsetWidth; // trigger reflow
    if (count > 0) badge.classList.add('bump');
  }
  if (mobileBadge) mobileBadge.textContent = count;
  if (drawerCount) drawerCount.textContent = `${count} كتب`;
}

window.addToCart = function(bookId, qty = 1) {
  const book = allBooks.find(b => b.id === bookId);
  if (!book) return;

  const price = Number(book.discount_price || book.price || 1200);
  const existing = cart.find(i => i.bookId === bookId);

  if (existing) {
    existing.quantity = (existing.quantity || 1) + qty;
  } else {
    cart.push({
      bookId: book.id,
      title: book.title,
      author: book.author,
      price: price,
      coverUrl: book.cover_url,
      quantity: qty
    });
  }

  saveCart();
  toast(`🛒 تمت إضافة (${book.title}) إلى السلة بنجاح`);
};

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
        <p style="margin-top:0.4rem;font-size:0.88rem">تصفح إصداراتنا وأضف الكتب التي تود اقتناءها إلى السلة!</p>
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
  document.getElementById('mobileCartBtn')?.addEventListener('click', () => {
    document.getElementById('mobileDrawer')?.classList.remove('open');
    document.getElementById('overlayBg')?.classList.remove('show');
    openCartDrawer();
  });
  document.getElementById('cartDrawerClose')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartDrawerOverlay')?.addEventListener('click', closeCartDrawer);
  document.getElementById('btnCartContinue')?.addEventListener('click', closeCartDrawer);

  document.getElementById('btnCartCheckout')?.addEventListener('click', () => {
    if (!cart.length) {
      toast('السلة فارغة، يرجى إضافة كتب أولاً', 'error');
      return;
    }
    closeCartDrawer();
    openOrderModal(null); // Open checkout in multi-item cart mode
  });
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const drawer    = document.getElementById('mobileDrawer');
  const overlayBg = document.getElementById('overlayBg');
  const drawerClose = document.getElementById('drawerClose');

  window.addEventListener('scroll', () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 50);
  });

  const openDrawer  = () => { drawer.classList.add('open'); overlayBg.classList.add('show'); document.body.style.overflow = 'hidden'; };
  const closeDrawer = () => { drawer.classList.remove('open'); overlayBg.classList.remove('show'); document.body.style.overflow = ''; };

  hamburger?.addEventListener('click', openDrawer);
  drawerClose?.addEventListener('click', closeDrawer);
  overlayBg?.addEventListener('click', closeDrawer);
  drawer?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));

  const sections = document.querySelectorAll('section[id]');
  const links    = document.querySelectorAll('.navbar-links a, .mobile-links a');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) current = s.id; });
    links.forEach(a => { a.classList.toggle('active', a.getAttribute('href') === `#${current}`); });
  });
}

// ─── HERO & STATS ─────────────────────────────────────────────────────────────
function renderHero(s = {}) {
  const h1  = document.getElementById('heroTitle');
  const sub = document.getElementById('heroSubtitle');
  if (h1)  h1.innerHTML   = s.hero_title    || 'نشر المعرفة... إرث يدوم';
  if (sub) sub.textContent = s.hero_subtitle || 'دار علي بن زيد للطباعة والنشر';
}

function renderStats(s = {}) {
  [['statYears', s.stat_years || '20'], ['statBooks', s.stat_books || '150'], ['statReaders', s.stat_readers || '5000']]
    .forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.dataset.target = parseInt(val) || 0;
    });
}

function animateCounters() {
  document.querySelectorAll('.stat-number[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    const step   = target / (1800 / 16);
    let current  = 0;
    const timer  = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      el.querySelector('.num').textContent = Math.floor(current).toLocaleString('ar-SA');
    }, 16);
  });
}

// ─── PUBLICATIONS ─────────────────────────────────────────────────────────────
let activeCategory = 'all';

function getCatById(id) {
  return allCategories.find(c => String(c.id) === String(id));
}

function getCatName(book) {
  const id = book.category_id ?? book.categoryId;
  const cat = getCatById(id);
  return cat ? (cat.name || cat.name_ar || '—') : '—';
}

function getCatColor(book) {
  const id = book.category_id ?? book.categoryId;
  const cat = getCatById(id);
  return cat?.color || '#1B6CA8';
}

function renderFilterTabs(cats) {
  const container = document.getElementById('filterTabs');
  if (!container) return;
  container.innerHTML = `<button class="filter-tab active" data-cat="all">الكل</button>`;
  cats.forEach(c => {
    container.innerHTML += `<button class="filter-tab" data-cat="${c.id}">${escHtml(c.name || c.name_ar || '')}</button>`;
  });
  container.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      container.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterBooks();
    });
  });
}

function filterBooks() {
  const filtered = activeCategory === 'all'
    ? allBooks
    : allBooks.filter(b => String(b.category_id ?? b.categoryId) === String(activeCategory));
  renderBooks(filtered);
}

function renderBooks(books) {
  const grid = document.getElementById('booksGrid');
  if (!grid) return;

  const visible = books.filter(b => !b.status || b.status === 'published');
  if (!visible.length) {
    grid.innerHTML = `<div class="books-empty"><div style="font-size:3rem;opacity:.3">📚</div><p>لا توجد كتب في هذا التصنيف</p></div>`;
    return;
  }
  grid.innerHTML = visible.map(book => {
    const color     = getCatColor(book);
    const catName   = getCatName(book);
    const coverPath = resolveMediaUrl(book.cover_url);
    const coverHtml = coverPath
      ? `<img src="${escHtml(coverPath)}" alt="${escHtml(book.title)}" class="book-cover-img" onerror="this.parentElement.classList.remove('has-image'); this.style.display='none';">`
      : `<span class="book-cover-icon">📖</span><div class="book-cover-lines"></div>`;
    const pdfBadge = book.pdf_url ? `<span class="pdf-badge">📄 PDF</span>` : '';

    const price = Number(book.price) || 1200;
    const discountPrice = book.discount_price ? Number(book.discount_price) : null;
    const hasDiscount = discountPrice && discountPrice < price;

    const priceHtml = hasDiscount
      ? `<div class="book-price-tag">
          <span class="price-current">${discountPrice} دج</span>
          <span class="price-old">${price} دج</span>
          <span class="price-discount-pill">خصم</span>
        </div>`
      : `<div class="book-price-tag"><span class="price-current">${price} دج</span></div>`;

    return `
    <article class="book-card fade-in" style="cursor:pointer" onclick="window.location.href='./book.html?id=${book.id}'">
      <div class="book-cover ${coverPath ? 'has-image' : ''}" style="${coverPath ? '' : `background:linear-gradient(135deg,${color}dd 0%,${color}88 50%,${color}44 100%)`}">
        ${coverHtml}${pdfBadge}
      </div>
      <div class="book-info">
        <span class="book-category-badge">${catName}</span>
        <h3 class="book-title">${escHtml(book.title)}</h3>
        <p class="book-author">✍️ ${escHtml(book.author)}</p>
        ${book.year ? `<p class="book-year">📅 ${book.year}</p>` : ''}
        ${priceHtml}
        <div class="book-footer" style="margin-top:0.8rem">
          <a href="./book.html?id=${book.id}" class="btn-order-now" style="width:100%;display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.75rem 1rem;text-decoration:none">
            <span>📖 تفاصيل الكتاب والطلب الفوري</span>
          </a>
        </div>
      </div>
    </article>`;
  }).join('');
}

// ─── BOOK DETAILS & ORDER PAGE REDIRECT ──────────────────────────────────────
window.openBookModal = function(bookId) {
  window.location.href = `./book.html?id=${bookId}`;
};

// ─── ORDER CHECKOUT MODAL LOGIC (Cart Checkout) ───────────────────────────────
let cachedDeliveryRates = [];
let activeOrderBook = null;
let isCartCheckoutMode = false;
let orderQty = 1;
let appliedDiscount = 0;
let appliedCouponCode = '';

async function loadDeliveryRates(forceRefresh = false) {
  if (!forceRefresh && cachedDeliveryRates.length) return cachedDeliveryRates;
  try {
    cachedDeliveryRates = await api.get('/api/delivery/rates');
  } catch {
    cachedDeliveryRates = [];
  }
  return cachedDeliveryRates;
}

window.openOrderModal = async function(bookId = null) {
  const summaryContainer = document.getElementById('orderBookSummaryContainer');
  appliedDiscount = 0;
  appliedCouponCode = '';

  if (bookId) {
    // Single Book Checkout Mode
    isCartCheckoutMode = false;
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    activeOrderBook = book;
    orderQty = 1;

    document.getElementById('orderModalBadge').textContent = '🛍️ طلب شراء كتاب';
    document.getElementById('orderBookId').value = book.id;

    const price = Number(book.discount_price || book.price || 1200);
    const coverPath = resolveMediaUrl(book.cover_url);

    summaryContainer.innerHTML = `
      <div class="order-book-thumb">
        ${coverPath ? `<img src="${escHtml(coverPath)}" alt="${escHtml(book.title)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">` : '<div style="background:#1B6CA8;width:100%;height:100%;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.8rem">📖</div>'}
      </div>
      <div class="order-book-details">
        <h3 class="order-book-name">${escHtml(book.title)}</h3>
        <p class="order-book-author">✍️ ${escHtml(book.author)}</p>
        <div class="order-book-price">${price} دج / للنسخة</div>
        <div class="order-qty-stepper">
          <span class="qty-label">الكمية:</span>
          <button type="button" class="btn-qty" id="btnQtyMinus">-</button>
          <input type="number" id="orderQtyInput" value="1" min="1" max="20" readonly />
          <button type="button" class="btn-qty" id="btnQtyPlus">+</button>
        </div>
      </div>
    `;

    document.getElementById('btnQtyMinus')?.addEventListener('click', () => {
      if (orderQty > 1) { orderQty--; document.getElementById('orderQtyInput').value = orderQty; updateOrderCalculation(); }
    });
    document.getElementById('btnQtyPlus')?.addEventListener('click', () => {
      if (orderQty < 20) { orderQty++; document.getElementById('orderQtyInput').value = orderQty; updateOrderCalculation(); }
    });
  } else {
    // Multi-Item Cart Checkout Mode
    isCartCheckoutMode = true;
    activeOrderBook = null;

    document.getElementById('orderModalBadge').textContent = `🛒 إتمام طلب السلة (${cart.length} كتب)`;
    document.getElementById('orderBookId').value = '';

    const itemsPreview = cart.map(i => `
      <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:0.4rem 0.6rem;border-radius:5px;font-size:0.85rem">
        <span style="font-weight:bold;color:var(--text-light)">${escHtml(i.title)} <small style="color:var(--gold)">(×${i.quantity || 1})</small></span>
        <span style="color:var(--gold)">${i.price * (i.quantity || 1)} دج</span>
      </div>
    `).join('');

    summaryContainer.innerHTML = `
      <div style="width:100%;display:flex;flex-direction:column;gap:0.4rem">
        <div style="font-weight:700;color:var(--gold);margin-bottom:0.2rem">📚 محتويات سلة مشترياتك:</div>
        ${itemsPreview}
      </div>
    `;
  }

  // Load Wilayas (Filtered by is_available = 1)
  const rates = await loadDeliveryRates(true);
  const availableRates = rates.filter(w => Number(w.is_available) === 1);
  const wilayaSelect = document.getElementById('orderWilayaSelect');
  if (wilayaSelect) {
    if (availableRates.length === 0) {
      wilayaSelect.innerHTML = `<option value="">-- عذراً، التوصيل غير متاح حالياً --</option>`;
    } else {
      wilayaSelect.innerHTML = `<option value="">-- اختر ولايتك (${availableRates.length} ولاية متاحة) --</option>` +
        availableRates.map(w => `<option value="${w.wilaya_code}" data-home="${w.home_price}" data-desk="${w.desk_price}">${w.wilaya_code}. ${escHtml(w.wilaya_name)}</option>`).join('');
    }
  }

  // Reset commune select
  const communeSelect = document.getElementById('orderCommuneSelect');
  if (communeSelect) communeSelect.innerHTML = `<option value="">-- اختر الولاية أولاً --</option>`;
  const customCommune = document.getElementById('orderCommuneCustom');
  if (customCommune) { customCommune.value = ''; customCommune.style.display = 'none'; }

  // Reset coupon state
  document.getElementById('orderCouponInput').value = '';
  document.getElementById('couponStatusMsg').innerHTML = '';
  document.getElementById('calcDiscountRow').style.display = 'none';

  updateOrderCalculation();

  document.getElementById('orderModal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

function onWilayaChanged() {
  const wilayaSelect = document.getElementById('orderWilayaSelect');
  const communeSelect = document.getElementById('orderCommuneSelect');
  const customInput = document.getElementById('orderCommuneCustom');
  const wilayaCode = Number(wilayaSelect?.value);

  if (customInput) { customInput.value = ''; customInput.style.display = 'none'; }

  if (!wilayaCode || !communeSelect) {
    if (communeSelect) communeSelect.innerHTML = `<option value="">-- اختر الولاية أولاً --</option>`;
    updateOrderCalculation();
    return;
  }

  const wilayaData = ALGERIA_WILAYAS.find(w => w.code === wilayaCode);
  const communes = wilayaData ? wilayaData.communes : [];

  communeSelect.innerHTML = `<option value="">-- اختر البلدية (${communes.length} بلدية) --</option>` +
    communes.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('') +
    `<option value="__CUSTOM__">✍️ بلدية أخرى (كتابة يدوية)</option>`;

  updateOrderCalculation();
}

function updateOrderCalculation() {
  let subtotal = 0;
  if (isCartCheckoutMode) {
    subtotal = cart.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0);
  } else if (activeOrderBook) {
    const unitPrice = Number(activeOrderBook.discount_price || activeOrderBook.price || 1200);
    subtotal = unitPrice * orderQty;
  }

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

  const bookPriceLabel = document.getElementById('calcBookPriceLabel');
  if (bookPriceLabel) {
    bookPriceLabel.textContent = isCartCheckoutMode ? `سعر الكتب (${cart.length} كتب):` : `سعر الكتاب (×${orderQty}):`;
  }

  document.getElementById('calcBookPrice').textContent = `${subtotal} دج`;
  document.getElementById('calcDeliveryPrice').textContent = shippingFee > 0 ? `${shippingFee} دج` : 'اختر الولاية لحساب التوصيل';
  document.getElementById('calcTotal').textContent = `${total} دج`;

  if (appliedDiscount > 0) {
    document.getElementById('calcDiscountRow').style.display = 'flex';
    document.getElementById('calcDiscount').textContent = `-${appliedDiscount} دج`;
  } else {
    document.getElementById('calcDiscountRow').style.display = 'none';
  }
}

// ─── PAYPAL DIGITAL PDF MODAL ─────────────────────────────────────────────────
window.openPaypalModal = function(bookId) {
  const book = allBooks.find(b => b.id === bookId);
  if (!book) return;

  const price = book.pdf_price ? Number(book.pdf_price) : 5.0;
  document.getElementById('paypalBookTitle').textContent = book.title;
  document.getElementById('paypalPriceVal').textContent = `$${price.toFixed(2)}`;

  const directLink = document.getElementById('paypalDirectLink');
  if (directLink) {
    directLink.href = `https://www.paypal.com/paypalme/daralibenzid/${price}`;
  }

  document.getElementById('paypalModal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

function initModalsAndOrder() {
  // Book Details Modal
  const bookOverlay = document.getElementById('bookModal');
  const bookClose   = document.getElementById('modalClose');
  const closeBook   = () => { bookOverlay?.classList.remove('open'); document.body.style.overflow = ''; };
  bookClose?.addEventListener('click', closeBook);
  bookOverlay?.addEventListener('click', e => { if (e.target === bookOverlay) closeBook(); });

  // Order Modal
  const orderOverlay = document.getElementById('orderModal');
  const orderClose   = document.getElementById('orderModalClose');
  const closeOrder   = () => { orderOverlay?.classList.remove('open'); document.body.style.overflow = ''; };
  orderClose?.addEventListener('click', closeOrder);
  orderOverlay?.addEventListener('click', e => { if (e.target === orderOverlay) closeOrder(); });

  // Paypal Modal
  const paypalOverlay = document.getElementById('paypalModal');
  const paypalClose   = document.getElementById('paypalModalClose');
  const closePaypal   = () => { paypalOverlay?.classList.remove('open'); document.body.style.overflow = ''; };
  paypalClose?.addEventListener('click', closePaypal);
  paypalOverlay?.addEventListener('click', e => { if (e.target === paypalOverlay) closePaypal(); });

  // Order Success Modal
  const successOverlay = document.getElementById('orderSuccessModal');
  const successClose   = document.getElementById('btnOrderSuccessClose');
  const closeSuccess   = () => { successOverlay?.classList.remove('open'); document.body.style.overflow = ''; };
  successClose?.addEventListener('click', closeSuccess);
  successOverlay?.addEventListener('click', e => { if (e.target === successOverlay) closeSuccess(); });

  // Manuscript Success Modal
  const manuSuccessOverlay = document.getElementById('manuscriptSuccessModal');
  const manuSuccessClose   = document.getElementById('btnManuSuccessClose');
  const closeManuSuccess   = () => { manuSuccessOverlay?.classList.remove('open'); document.body.style.overflow = ''; };
  manuSuccessClose?.addEventListener('click', closeManuSuccess);
  manuSuccessOverlay?.addEventListener('click', e => { if (e.target === manuSuccessOverlay) closeManuSuccess(); });

  // Wilaya and Delivery Type change listeners
  document.getElementById('orderWilayaSelect')?.addEventListener('change', onWilayaChanged);

  // Commune change listener
  document.getElementById('orderCommuneSelect')?.addEventListener('change', e => {
    const customInput = document.getElementById('orderCommuneCustom');
    if (e.target.value === '__CUSTOM__') {
      if (customInput) { customInput.style.display = 'block'; customInput.focus(); }
    } else {
      if (customInput) customInput.style.display = 'none';
    }
  });

  document.querySelectorAll('input[name="orderDeliveryType"]').forEach(r => {
    r.addEventListener('change', () => {
      document.querySelectorAll('.delivery-opt').forEach(opt => opt.classList.remove('active'));
      r.closest('.delivery-opt')?.classList.add('active');
      updateOrderCalculation();
    });
  });

  // Apply Coupon Button
  document.getElementById('btnApplyCoupon')?.addEventListener('click', async () => {
    const code = document.getElementById('orderCouponInput')?.value.trim();
    const statusMsg = document.getElementById('couponStatusMsg');
    if (!code) {
      if (statusMsg) statusMsg.innerHTML = `<span style="color:var(--danger)">يرجى كتابة كود الخصم أولاً</span>`;
      return;
    }
    let subtotal = 0;
    if (isCartCheckoutMode) {
      subtotal = cart.reduce((sum, i) => sum + (i.price * (i.quantity || 1)), 0);
    } else {
      const unitPrice = Number(activeOrderBook?.discount_price || activeOrderBook?.price || 1200);
      subtotal = unitPrice * orderQty;
    }

    if (statusMsg) statusMsg.innerHTML = `<span>جارٍ التحقق من الكود...</span>`;
    try {
      const res = await api.post('/api/coupons/validate', { code, subtotal });
      if (res.valid) {
        appliedDiscount = Number(res.discount_amount);
        appliedCouponCode = res.code;
        if (statusMsg) statusMsg.innerHTML = `<span style="color:var(--success)">✅ ${res.message}</span>`;
        updateOrderCalculation();
      } else {
        appliedDiscount = 0;
        appliedCouponCode = '';
        if (statusMsg) statusMsg.innerHTML = `<span style="color:var(--danger)">❌ ${res.message || 'الكوبون غير صالح'}</span>`;
        updateOrderCalculation();
      }
    } catch (err) {
      appliedDiscount = 0;
      appliedCouponCode = '';
      if (statusMsg) statusMsg.innerHTML = `<span style="color:var(--danger)">❌ ${err.message || 'كود الخصم غير صحيح'}</span>`;
      updateOrderCalculation();
    }
  });

  // Order Form Submit
  document.getElementById('orderForm')?.addEventListener('submit', async e => {
    e.preventDefault();
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
      toast('يرجى ملء جميع الحقول المطلوبة (الاسم، الهاتف، الولاية، البلدية، والعنوان)', 'error');
      return;
    }

    const submitBtn = document.getElementById('btnSubmitOrder');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جارٍ تسجيل طلبك...'; }

    try {
      const payload = {
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

      if (isCartCheckoutMode) {
        payload.items = cart.map(i => ({
          book_id: i.bookId,
          title: i.title,
          price: i.price,
          quantity: i.quantity || 1,
          cover_url: i.coverUrl
        }));
      } else {
        payload.book_id = activeOrderBook.id;
        payload.quantity = orderQty;
      }

      const result = await api.post('/api/orders', payload);
      closeOrder();

      if (isCartCheckoutMode) {
        cart = [];
        saveCart();
      }

      // Populate & open success modal
      document.getElementById('successOrderId').textContent = `#${result.order?.id || 'OK'}`;
      document.getElementById('successBookTitle').textContent = result.order?.book_title || (isCartCheckoutMode ? 'مجموعة كتب' : activeOrderBook.title);
      document.getElementById('successWilaya').textContent = result.order?.wilaya_name || `ولاية ${wilaya}`;
      document.getElementById('successTotal').textContent = `${result.order?.total_price || 0} دج`;

      document.getElementById('orderSuccessModal').classList.add('open');
      document.body.style.overflow = 'hidden';
    } catch (err) {
      toast('تعذّر إرسال الطلب: ' + (err.message || 'يرجى المحاولة مرة أخرى'), 'error');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🛍️ تأكيد الطلب والدفع عند الاستلام'; }
    }
  });
}

// ─── MANUSCRIPT SUBMISSION (انشر كتابك معنا) ──────────────────────────────────
let selectedManuscriptFile = null;

function initManuscriptSection() {
  const wilayaSelect = document.getElementById('manuWilaya');
  if (wilayaSelect) {
    wilayaSelect.innerHTML = `<option value="">-- اختر ولايتك --</option>` +
      ALGERIA_WILAYAS.map(w => `<option value="${w.code}. ${escHtml(w.name)}">${w.code}. ${escHtml(w.name)}</option>`).join('');
  }

  const fileInput = document.getElementById('manuFileInput');
  const fileNameDisplay = document.getElementById('manuFileName');

  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 35 * 1024 * 1024) {
        toast('حجم الملف كبير جداً (الحد الأقصى 35 ميغابايت)', 'error');
        fileInput.value = '';
        return;
      }
      selectedManuscriptFile = file;
      if (fileNameDisplay) fileNameDisplay.innerHTML = `<strong style="color:var(--gold)">📄 تم اختيار: ${escHtml(file.name)} (${(file.size / 1024 / 1024).toFixed(2)} MB)</strong>`;
    }
  });

  document.getElementById('manuscriptForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const authorName  = document.getElementById('manuAuthorName')?.value.trim();
    const authorPhone = document.getElementById('manuAuthorPhone')?.value.trim();
    const authorEmail = document.getElementById('manuAuthorEmail')?.value.trim();
    const wilaya      = document.getElementById('manuWilaya')?.value;
    const bookTitle   = document.getElementById('manuBookTitle')?.value.trim();
    const category    = document.getElementById('manuCategory')?.value;
    const summary     = document.getElementById('manuSummary')?.value.trim();

    if (!authorName || !authorPhone || !bookTitle) {
      toast('يرجى ملء الحقول الإلزامية: اسم المؤلف، رقم الهاتف، وعنوان الكتاب', 'error');
      return;
    }

    if (!selectedManuscriptFile) {
      toast('يرجى إرفاق ملف المخطوطة أو الفهرس', 'error');
      return;
    }

    const btn = document.getElementById('btnSubmitManuscript');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ رفع المخطوطة وإرسال الطلب...'; }

    try {
      // 1. Convert file to Base64 and upload
      const reader = new FileReader();
      reader.readAsDataURL(selectedManuscriptFile);
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
      });

      let fileUrl = '';
      try {
        const uploadRes = await api.post('/api/upload', { file: reader.result });
        fileUrl = uploadRes.url || uploadRes.pdf_url || '';
      } catch {
        fileUrl = '';
      }

      // 2. Submit manuscript
      await api.post('/api/manuscripts', {
        author_name: authorName,
        author_phone: authorPhone,
        author_email: authorEmail || null,
        wilaya: wilaya || null,
        book_title: bookTitle,
        category: category || null,
        summary: summary || null,
        file_url: fileUrl
      });

      document.getElementById('manuscriptForm').reset();
      selectedManuscriptFile = null;
      if (fileNameDisplay) fileNameDisplay.textContent = 'اضغط هنا لاختيار ملف المخطوطة من جهازك';

      document.getElementById('manuscriptSuccessModal')?.classList.add('open');
      document.body.style.overflow = 'hidden';
    } catch (err) {
      toast('تعذّر إرسال طلب النشر: ' + (err.message || ''), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📤 إرسال طلب النشر للمراجعة'; }
    }
  });
}

// ─── ABOUT ────────────────────────────────────────────────────────────────────
function renderAbout(about = {}, milestones = []) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
  set('aboutMain',    about.main     || about.main_text || '');
  set('aboutMission', about.mission  || '');
  set('aboutVision',  about.vision   || '');

  const track = document.getElementById('timelineTrack');
  if (!track) return;
  if (!milestones.length) { track.innerHTML = ''; return; }
  track.innerHTML = milestones.map(m => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-year">${escHtml(String(m.year || ''))}</div>
        <div class="timeline-item-title">${escHtml(m.title || '')}</div>
        <div class="timeline-item-desc">${escHtml(m.description || '')}</div>
      </div>
    </div>`).join('');
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
function renderTestimonials(list = []) {
  const grid = document.getElementById('testimonialsGrid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⭐</div><p>لا توجد شهادات حتى الآن</p></div>`;
    return;
  }
  grid.innerHTML = list.map(t => {
    const stars   = '★'.repeat(t.rating || 5) + '☆'.repeat(5 - (t.rating || 5));
    const initial = (t.name || '؟')[0];
    return `
    <div class="testimonial-card fade-in">
      <div class="testimonial-quote">❝</div>
      <p class="testimonial-text">${escHtml(t.quote)}</p>
      <div class="testimonial-author">
        <div class="author-avatar">${initial}</div>
        <div>
          <div class="author-name">${escHtml(t.name)}</div>
          <div class="author-role">${escHtml(t.role || '')}</div>
          <div class="stars">${stars}</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── CONTACT ──────────────────────────────────────────────────────────────────
function renderContact(info = {}) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  set('contactAddress', info.address);
  set('contactPhone',   info.phone);
  set('contactEmail',   info.email);
  set('contactHours',   info.hours);
  const phone2El = document.getElementById('contactPhone2');
  const phone2Item = document.getElementById('contactPhone2Item');
  if (phone2El && info.phone2) {
    phone2El.textContent = info.phone2;
    if (phone2Item) phone2Item.style.display = '';
  }

  const fbBtn = document.getElementById('socialFb');
  const igBtn = document.getElementById('socialIg');
  const waBtn = document.getElementById('socialWa');
  const floatingWa = document.getElementById('whatsappWidget');

  const waNum = String(info.whatsapp || info.phone || '213770921426').replace(/\D/g,'');
  if (fbBtn && info.facebook)  { fbBtn.href = info.facebook; fbBtn.style.display = 'flex'; }
  if (igBtn && info.instagram) { igBtn.href = info.instagram; igBtn.style.display = 'flex'; }
  if (waBtn && info.whatsapp)  { waBtn.href = `https://wa.me/${waNum}`; waBtn.style.display = 'flex'; }
  if (floatingWa) {
    floatingWa.href = `https://wa.me/${waNum}?text=${encodeURIComponent('مرحباً دار علي بن زيد، أود الاستفسار بخصوص...')}`;
  }
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fields = ['name','email','subject','message'].map(n => form.querySelector(`[name="${n}"]`));
    let valid = true;
    fields.forEach(el => { el.classList.remove('error'); if (!el.value.trim()) { el.classList.add('error'); valid = false; } });
    if (!valid) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled    = true;
    btn.textContent = 'جارٍ الإرسال...';

    try {
      await api.post('/api/messages', {
        name:    fields[0].value.trim(),
        email:   fields[1].value.trim(),
        subject: fields[2].value.trim(),
        message: fields[3].value.trim(),
      });
      form.reset();
      toast('تم إرسال رسالتك بنجاح! سنتواصل معك قريباً 🎉');
    } catch (err) {
      console.error(err);
      toast('تعذّر الإرسال، يرجى المحاولة لاحقاً', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = 'إرسال الرسالة ✉️';
    }
  });
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function renderFooter(s = {}) {
  const el = document.getElementById('footerCopyright');
  if (el) el.textContent = s.copyright || `© ${new Date().getFullYear()} دار علي بن زيد للطباعة والنشر`;
}

// ─── SCROLL ANIMATIONS ────────────────────────────────────────────────────────
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        if (entry.target.id === 'statsBar') animateCounters();
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.section-animate').forEach(el => observer.observe(el));
}

// ─── LOADING OVERLAY ──────────────────────────────────────────────────────────
function showLoading(show) {
  let overlay = document.getElementById('pageLoadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pageLoadingOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(13,27,42,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
    overlay.innerHTML = '<div style="color:#C9A84C;font-family:Cairo,sans-serif;font-size:1.1rem;display:flex;flex-direction:column;align-items:center;gap:1rem"><div style="width:40px;height:40px;border:3px solid rgba(201,168,76,.3);border-top-color:#C9A84C;border-radius:50%;animation:spin 0.8s linear infinite"></div><span>جارٍ تحميل البيانات...</span></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = show ? 'flex' : 'none';
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try { initNavbar(); } catch (e) { console.error('initNavbar error', e); }
  try { initCart(); } catch (e) { console.error('initCart error', e); }
  try { initModalsAndOrder(); } catch (e) { console.error('initModalsAndOrder error', e); }
  try { initManuscriptSection(); } catch (e) { console.error('initManuscriptSection error', e); }
  try { initContactForm(); } catch (e) { console.error('initContactForm error', e); }
  try { initScrollAnimations(); } catch (e) { console.error('initScrollAnimations error', e); }

  showLoading(true);

  const safe = p => p.catch(() => null);

  try {
    const [books, cats, about, milestones, testimonials, contact, settings] = await Promise.all([
      safe(api.get('/api/books')),
      safe(api.get('/api/categories')),
      safe(api.get('/api/about')),
      safe(api.get('/api/milestones')),
      safe(api.get('/api/testimonials')),
      safe(api.get('/api/contact')),
      safe(api.get('/api/settings')),
    ]);

    allBooks      = Array.isArray(books)        ? books        : [];
    allCategories = Array.isArray(cats)         ? cats         : [];
    const aboutData    = about    && typeof about    === 'object' ? about    : {};
    const mils         = Array.isArray(milestones)   ? milestones   : [];
    const tests        = Array.isArray(testimonials) ? testimonials : [];
    const contactData  = contact  && typeof contact  === 'object' ? contact  : {};
    const settingsData = settings && typeof settings === 'object' ? settings : {};

    renderHero(settingsData);
    renderStats(settingsData);
    renderFilterTabs(allCategories);
    renderBooks(allBooks);
    renderAbout(aboutData, mils);
    renderTestimonials(tests);
    renderContact(contactData);
    renderFooter(settingsData);
  } catch (err) {
    console.error('Data load error:', err);
  } finally {
    showLoading(false);
  }
});
