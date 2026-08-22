import { api } from './api-r.js';
import { ALGERIA_WILAYAS } from './algeria_cities.js';

// ─── UTILS ────────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function confirmDialog(msg, onConfirm) {
  const overlay = document.getElementById('confirmOverlay');
  const msgEl = document.getElementById('confirmMsg');
  const btnOk = document.getElementById('confirmOk');
  const btnCancel = document.getElementById('confirmCancel');
  msgEl.textContent = msg;
  overlay.classList.add('open');
  const close = () => overlay.classList.remove('open');
  const handler = () => { close(); btnOk.removeEventListener('click', handler); onConfirm(); };
  btnOk.addEventListener('click', handler);
  btnCancel.onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
}

// ─── CATEGORIES CACHE ─────────────────────────────────────────────────────────
let adminCats = [];

async function refreshCats() {
  try {
    const data = await api.get('/api/categories');
    adminCats = Array.isArray(data) ? data : [];
  } catch {
    adminCats = [];
  }
}

// ─── AUTH & RBAC (ROLE-BASED ACCESS CONTROL) ──────────────────────────────────
let currentUser = null;

function getCurrentUser() {
  if (!currentUser) {
    try {
      currentUser = JSON.parse(sessionStorage.getItem('dar_admin_user') || 'null');
    } catch {
      currentUser = null;
    }
  }
  return currentUser || { role: 'admin', name: 'المدير العام', username: 'admin' };
}

function applyRolePermissions() {
  const user = getCurrentUser();
  const isStaff = user.role === 'staff';

  // Topbar user indicator
  const topbarUser = document.getElementById('topbarUser');
  if (topbarUser) {
    topbarUser.innerHTML = isStaff
      ? `💼 <span style="color:var(--gold);font-weight:bold">${escHtml(user.name || user.username)}</span> (موظف مبيعات)`
      : `👑 <span style="color:var(--gold);font-weight:bold">${escHtml(user.name || user.username)}</span> (المدير العام)`;
  }

  // Filter sidebar links based on role
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const access = link.dataset.roleAccess || 'admin';
    if (isStaff && access !== 'all') {
      link.style.display = 'none';
    } else {
      link.style.display = 'flex';
    }
  });
}

function initAuth() {
  const loginPage = document.getElementById('loginPage');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  function checkSession() {
    const ok = sessionStorage.getItem('dar_admin_session') === 'true' && !!sessionStorage.getItem('dar_admin_token');
    loginPage.style.display = ok ? 'none' : 'flex';
    dashboard.style.display = ok ? 'flex' : 'none';
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const user = loginForm.querySelector('[name="username"]').value.trim();
    const pass = loginForm.querySelector('[name="password"]').value.trim();
    const btn = loginForm.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const result = await api.post('/api/admin/login', { username: user, password: pass });
      if (result.success && result.token) {
        currentUser = result.admin;
        sessionStorage.setItem('dar_admin_session', 'true');
        sessionStorage.setItem('dar_admin_token', result.token);
        sessionStorage.setItem('dar_admin_user', JSON.stringify(result.admin));
        loginError.classList.remove('show');
        checkSession();
        await renderAllSections();
      } else {
        loginError.textContent = result.message || 'اسم المستخدم أو كلمة المرور غير صحيحة';
        loginError.classList.add('show');
      }
    } catch (err) {
      loginError.textContent = err.message || 'اسم المستخدم أو كلمة المرور غير صحيحة';
      loginError.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    sessionStorage.removeItem('dar_admin_session');
    sessionStorage.removeItem('dar_admin_token');
    sessionStorage.removeItem('dar_admin_user');
    checkSession();
  });

  checkSession();
  if (sessionStorage.getItem('dar_admin_session') === 'true' && sessionStorage.getItem('dar_admin_token')) {
    renderAllSections();
  }
}

// ─── SIDEBAR + NAVIGATION ─────────────────────────────────────────────────────
let currentSection = 'dashboard';

function initSidebar() {
  const hamburger = document.getElementById('adminHamburger');
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('show');
    document.body.style.overflow = sidebar.classList.contains('mobile-open') ? 'hidden' : '';
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  });

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      const sec = link.dataset.section;
      if (!sec) return;
      showSection(sec);
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    });
  });
}

async function showSection(sec) {
  const user = getCurrentUser();
  const isStaff = user.role === 'staff';

  // If staff user tries to navigate to restricted sections, force redirect to orders
  const staffAllowed = ['orders', 'manuscripts', 'coupons', 'delivery'];
  if (isStaff && !staffAllowed.includes(sec)) {
    sec = 'orders';
  }

  currentSection = sec;
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`sec-${sec}`)?.classList.add('active');
  document.querySelector(`[data-section="${sec}"]`)?.classList.add('active');
  const titles = {
    dashboard: 'لوحة الإحصاء',
    orders: 'إدارة الطلبات الواردة',
    manuscripts: 'طلبات النشر والمخطوطات',
    inbox: 'بريد الدار الرسمي — صندوق الرسائل الواردة',
    books: 'إدارة الكتب',
    categories: 'إدارة التصنيفات',
    reviews: 'تقييمات ومراجعات الكتب',
    coupons: 'إدارة أكواد الخصم',
    delivery: 'أسعار التوصيل (58 ولاية)',
    staff: 'إدارة الموظفين والصلاحيات',
    about: 'من نحن',
    messages: 'الرسائل الواردة',
    testimonials: 'الشهادات',
    contact: 'معلومات التواصل',
    settings: 'الإعدادات العامة'
  };
  document.getElementById('topbarTitle').textContent = titles[sec] || '';

  if (sec === 'dashboard') await renderDashboard();
  if (sec === 'orders') await renderOrdersSection();
  if (sec === 'manuscripts') await renderManuscriptsSection();
  if (sec === 'inbox') await renderInboxSection();
  if (sec === 'books') await renderBooksSection();
  if (sec === 'categories') await renderCategoriesSection();
  if (sec === 'reviews') await renderReviewsSection();
  if (sec === 'coupons') await renderCouponsSection();
  if (sec === 'delivery') await renderDeliverySection();
  if (sec === 'staff') await renderStaffSection();
  if (sec === 'about') await renderAboutSection();
  if (sec === 'messages') await renderMessagesSection();
  if (sec === 'testimonials') await renderTestimonialsSection();
  if (sec === 'contact') await renderContactSection();
  if (sec === 'settings') await renderSettingsSection();
}

async function renderAllSections() {
  applyRolePermissions();
  await refreshCats();
  await updateUnreadBadge();
  const user = getCurrentUser();
  const initialSec = user.role === 'staff' ? 'orders' : 'dashboard';
  await showSection(initialSec);
}

// ─── UNREAD BADGES ────────────────────────────────────────────────────────────
async function updateUnreadBadge() {
  try {
    const msgs = await api.get('/api/messages');
    const count = Array.isArray(msgs) ? msgs.filter(m => !m.is_read).length : 0;
    const badge = document.getElementById('msgBadge');
    if (badge) { badge.textContent = count || ''; badge.style.display = count ? 'inline' : 'none'; }

    const orderStats = await api.get('/api/orders/stats');
    const orderBadge = document.getElementById('orderBadge');
    if (orderBadge && orderStats) {
      const pending = orderStats.pending || 0;
      orderBadge.textContent = pending || '';
      orderBadge.style.display = pending ? 'inline' : 'none';
    }

    const manuStats = await api.get('/api/manuscripts/stats');
    const manuBadge = document.getElementById('manuscriptBadge');
    if (manuBadge && manuStats) {
      const pending = manuStats.pending || 0;
      manuBadge.textContent = pending || '';
      manuBadge.style.display = pending ? 'inline' : 'none';
    }

    const inboxStats = await api.get('/api/inbox/stats').catch(() => null);
    const inboxBadge = document.getElementById('inboxBadge');
    if (inboxBadge && inboxStats) {
      const unread = inboxStats.unread || 0;
      inboxBadge.textContent = unread || '';
      inboxBadge.style.display = unread ? 'inline' : 'none';
    }

    const revRows = await api.get('/api/admin/reviews?status=pending');
    const revBadge = document.getElementById('reviewsBadge');
    if (revBadge && Array.isArray(revRows)) {
      const count = revRows.length;
      revBadge.textContent = count || '';
      revBadge.style.display = count ? 'inline' : 'none';
    }
  } catch { /* silent */ }
}

// ─── SECTION 1: DASHBOARD ─────────────────────────────────────────────────────
async function renderDashboard() {
  const safe = p => p.catch(() => []);
  const [books, msgs, tests, orderStats, allOrders] = await Promise.all([
    safe(api.get('/api/books')),
    safe(api.get('/api/messages')),
    safe(api.get('/api/testimonials')),
    safe(api.get('/api/orders/stats')),
    safe(api.get('/api/orders')),
  ]);
  const unread = Array.isArray(msgs) ? msgs.filter(m => !m.is_read).length : 0;

  const el = id => document.getElementById(id);
  if (el('dashBooks')) el('dashBooks').textContent = Array.isArray(books) ? books.length : '—';
  if (el('dashCats')) el('dashCats').textContent = adminCats.length;
  if (el('dashUnread')) el('dashUnread').textContent = unread;
  if (el('dashTests')) el('dashTests').textContent = Array.isArray(tests) ? tests.length : '—';

  const stats = orderStats && typeof orderStats === 'object' ? orderStats : { total: 0, revenue: 0, pending: 0 };
  if (el('dashOrders')) el('dashOrders').textContent = stats.total || 0;
  if (el('dashRevenue')) el('dashRevenue').textContent = `${stats.revenue || 0} دج`;

  const orderBadge = document.getElementById('orderBadge');
  if (orderBadge) {
    orderBadge.textContent = stats.pending || '';
    orderBadge.style.display = stats.pending ? 'inline' : 'none';
  }

  // Render recent orders
  const ordersTbody = document.getElementById('recentOrdersTbody');
  if (ordersTbody && Array.isArray(allOrders)) {
    const recentOrders = allOrders.slice(0, 5);
    ordersTbody.innerHTML = recentOrders.length
      ? recentOrders.map(o => `
        <tr>
          <td><strong style="color:var(--gold)">#${o.id}</strong></td>
          <td class="td-name">${escHtml(o.customer_name)}<br><small style="color:var(--text-muted)">${escHtml(o.customer_phone)}</small></td>
          <td>${escHtml(o.book_title)} (×${o.quantity})</td>
          <td>${escHtml(o.wilaya_name)}</td>
          <td><strong style="color:var(--gold)">${o.total_price} دج</strong></td>
          <td><span class="status-badge status-${o.status}">${getStatusLabel(o.status)}</span></td>
          <td>
            <button class="btn-edit" onclick="openInvoice(${o.id})">📄 تفاصيل</button>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1.5rem">لا توجد طلبات واردة حتى الآن</td></tr>`;
  }

  const tbody = document.getElementById('recentMsgsTbody');
  if (tbody && Array.isArray(msgs)) {
    const recent = [...msgs].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);
    tbody.innerHTML = recent.length
      ? recent.map(m => `
        <tr>
          <td class="td-name">${escHtml(m.name)}</td>
          <td>${escHtml(m.subject)}</td>
          <td>${new Date(m.created_at || Date.now()).toLocaleDateString('ar-SA')}</td>
          <td>${m.is_read ? '<span class="status-badge status-published">مقروء</span>' : '<span class="unread-badge">جديد</span>'}</td>
        </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">لا توجد رسائل</td></tr>`;
  }
}

// ─── SECTION 2: BOOKS ─────────────────────────────────────────────────────────
let bookSearch = '';
let bookEditId = null;
let adminBooks = [];

async function uploadFileToServer(file, type = 'image') {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        const result = await api.post('/api/upload', {
          file: base64Data,
          type: type,
          name: file.name,
        });
        resolve(result.url || result.secure_url || result.image_url || result.pdf_url || base64Data);
      } catch (err) {
        // Graceful fallback to DataURL so user never gets blocked
        resolve(reader.result);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const apiBase = window.__API_BASE__ || 'https://daralibenzidweb.onrender.com';
  return apiBase.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
}

async function renderBooksSection() {
  const tbody = document.getElementById('booksTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">جارٍ التحميل...</td></tr>`;
  try {
    adminBooks = await api.get('/api/books');
  } catch {
    adminBooks = [];
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⚠️</div><p>تعذّر تحميل الكتب</p></div></td></tr>`;
    return;
  }
  const getCat = id => adminCats.find(c => String(c.id) === String(id));

  const filtered = adminBooks.filter(b =>
    !bookSearch || b.title?.includes(bookSearch) || b.author?.includes(bookSearch)
  );

  tbody.innerHTML = filtered.length
    ? filtered.map(b => {
      const cat = getCat(b.category_id);
      const coverPath = resolveMediaUrl(b.cover_url);
      const thumb = coverPath
        ? `<img src="${escHtml(coverPath)}" alt="غلاف" style="width:36px;height:48px;object-fit:cover;border-radius:4px;display:block">`
        : `<span class="color-swatch" style="background:${cat?.color || '#1B6CA8'}"></span>`;
      const pdfIcon = b.pdf_url ? `<span title="يوجد PDF" style="color:var(--gold);font-size:1rem">📄</span>` : '';
      return `
        <tr>
          <td>${thumb}</td>
          <td class="td-name">${escHtml(b.title)} ${pdfIcon}</td>
          <td>${escHtml(b.author)}</td>
          <td>${escHtml(cat?.name || '—')}</td>
          <td>${b.year || '—'}</td>
          <td><span class="status-badge ${b.status === 'draft' ? 'status-draft' : 'status-published'}">${b.status === 'draft' ? 'مسودة' : 'منشور'}</span></td>
          <td>
            <div class="action-btns">
              <button class="btn-edit" onclick="editBook(${b.id})">✏️ تعديل</button>
              <button class="btn-del"  onclick="deleteBook(${b.id})">🗑️ حذف</button>
            </div>
          </td>
        </tr>`;
    }).join('')
    : `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📚</div><p>لا توجد كتب</p></div></td></tr>`;
}

function initBooksSection() {
  document.getElementById('bookSearch')?.addEventListener('input', e => {
    bookSearch = e.target.value.trim();
    renderBooksSection();
  });
  document.getElementById('addBookBtn')?.addEventListener('click', () => openBookDrawer(null));
  document.getElementById('bookDrawerClose')?.addEventListener('click', closeBookDrawer);
  document.getElementById('bookDrawerCancel')?.addEventListener('click', closeBookDrawer);
  document.getElementById('bookDrawerOverlay')?.addEventListener('click', closeBookDrawer);
  document.getElementById('bookForm')?.addEventListener('submit', saveBook);

  document.getElementById('coverUrlInput')?.addEventListener('input', e => {
    const url = e.target.value.trim();
    const img = document.getElementById('coverPreviewImg');
    const placeholder = document.getElementById('coverPlaceholder');
    const removeBtn = document.getElementById('removeCoverBtn');
    if (url) {
      const coverPath = resolveMediaUrl(url);
      img.src = coverPath; img.style.display = 'block';
      if (placeholder) placeholder.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
      img.src = ''; img.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
      if (removeBtn) removeBtn.style.display = 'none';
    }
  });

  document.getElementById('coverFileInput')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast('حجم الصورة كبير جداً (حد أقصى 10MB)', 'error'); e.target.value = ''; return; }
    const uploadStatus = document.getElementById('coverUploadStatus');
    if (uploadStatus) uploadStatus.textContent = 'جارٍ معالجة الصورة...';
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      const coverInput = document.getElementById('coverUrlInput');
      if (coverInput) {
        coverInput.value = base64Data;
        coverInput.dispatchEvent(new Event('input'));
      }
      try {
        const url = await uploadFileToServer(file, 'image');
        if (url && url !== base64Data && coverInput) {
          coverInput.value = url;
          coverInput.dispatchEvent(new Event('input'));
        }
        toast('تم تحديد الصورة بنجاح');
      } catch {
        toast('تم تجهيز الصورة بنجاح');
      } finally {
        if (uploadStatus) uploadStatus.textContent = 'PNG، JPG، WEBP';
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('removeCoverBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('coverUrlInput').value = '';
    const img = document.getElementById('coverPreviewImg');
    img.src = ''; img.style.display = 'none';
    const placeholder = document.getElementById('coverPlaceholder');
    if (placeholder) placeholder.style.display = 'flex';
    document.getElementById('removeCoverBtn').style.display = 'none';
    document.getElementById('coverFileInput').value = '';
  });

  document.getElementById('pdfUrlInput')?.addEventListener('input', e => {
    const url = e.target.value.trim();
    const statusEl = document.getElementById('pdfStatusEl');
    const removeBtn = document.getElementById('removePdfBtn');
    if (url) {
      if (statusEl) statusEl.innerHTML = `<span style="font-size:2rem">✅</span><span style="color:var(--gold)">تم تحديد ملف PDF</span><span class="file-hint">${escHtml(url.slice(0,60))}...</span>`;
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
      if (statusEl) statusEl.innerHTML = `<span style="font-size:2rem">📄</span><span>أو اضغط لرفع ملف PDF</span><span class="file-hint">PDF فقط</span>`;
      if (removeBtn) removeBtn.style.display = 'none';
    }
  });

  document.getElementById('pdfFileInput')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { toast('حجم PDF كبير جداً (حد أقصى 25MB)', 'error'); e.target.value = ''; return; }
    const statusEl = document.getElementById('pdfStatusEl');
    if (statusEl) statusEl.innerHTML = `<span style="font-size:2rem">⏳</span><span>جارٍ معالجة ملف PDF...</span>`;
    
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result;
      const pdfInput = document.getElementById('pdfUrlInput');
      if (pdfInput) {
        pdfInput.value = base64Data;
        pdfInput.dispatchEvent(new Event('input'));
      }
      try {
        const url = await uploadFileToServer(file, 'pdf');
        if (url && url !== base64Data && pdfInput) {
          pdfInput.value = url;
          pdfInput.dispatchEvent(new Event('input'));
        }
        toast('تم تحديد ملف PDF بنجاح');
      } catch {
        toast('تم تجهيز ملف PDF بنجاح');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('removePdfBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('pdfUrlInput').value = '';
    document.getElementById('pdfUrlInput').dispatchEvent(new Event('input'));
    document.getElementById('pdfFileInput').value = '';
  });
}

window.editBook = function (id) {
  const book = adminBooks.find(b => b.id === id);
  if (book) openBookDrawer(book);
};

window.deleteBook = function (id) {
  confirmDialog('هل أنت متأكد من حذف هذا الكتاب؟ لا يمكن التراجع.', async () => {
    try {
      await api.del(`/api/books/${id}`);
      toast('تم حذف الكتاب بنجاح');
      await renderBooksSection();
      await renderDashboard();
    } catch {
      toast('تعذّر حذف الكتاب', 'error');
    }
  });
};

function openBookDrawer(book) {
  bookEditId = book ? book.id : null;

  const drawer = document.getElementById('bookDrawer');
  const overlay = document.getElementById('bookDrawerOverlay');
  document.getElementById('bookDrawerTitle').textContent = book ? 'تعديل الكتاب' : 'إضافة كتاب جديد';

  const catSel = document.getElementById('bookCategory');
  catSel.innerHTML = adminCats.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  const f = document.getElementById('bookForm');
  f.querySelector('[name="title"]').value = book?.title || '';
  f.querySelector('[name="author"]').value = book?.author || '';
  f.querySelector('[name="year"]').value = book?.year || '';
  f.querySelector('[name="pages"]').value = book?.pages || '';
  f.querySelector('[name="price"]').value = book?.price !== undefined && book?.price !== null ? book.price : '1200';
  f.querySelector('[name="discount_price"]').value = book?.discount_price || '';
  f.querySelector('[name="pdf_price"]').value = book?.pdf_price !== undefined && book?.pdf_price !== null ? book.pdf_price : '5.00';
  f.querySelector('[name="description"]').value = book?.description || '';
  f.querySelector('[name="color"]').value = book?.color || '#1B6CA8';
  catSel.value = book?.category_id || (adminCats[0]?.id || '');
  f.querySelector('[name="status"]').checked = (book?.status !== 'draft');

  const coverUrl = book?.cover_url || '';
  const coverInput = document.getElementById('coverUrlInput');
  if (coverInput) { coverInput.value = coverUrl; coverInput.dispatchEvent(new Event('input')); }

  const pdfUrl = book?.pdf_url || '';
  const pdfInput = document.getElementById('pdfUrlInput');
  if (pdfInput) { pdfInput.value = pdfUrl; pdfInput.dispatchEvent(new Event('input')); }

  document.getElementById('coverFileInput').value = '';
  document.getElementById('pdfFileInput').value = '';

  drawer.classList.add('open');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBookDrawer() {
  document.getElementById('bookDrawer').classList.remove('open');
  document.getElementById('bookDrawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function saveBook(e) {
  e.preventDefault();
  const f = e.target;
  const title = f.querySelector('[name="title"]').value.trim();
  const author = f.querySelector('[name="author"]').value.trim();
  if (!title || !author) { toast('يرجى ملء الحقول المطلوبة (العنوان والمؤلف)', 'error'); return; }

  const cover_url = (document.getElementById('coverUrlInput')?.value || '').trim();
  const pdf_url = (document.getElementById('pdfUrlInput')?.value || '').trim();

  const data = {
    title,
    author,
    category_id: parseInt(document.getElementById('bookCategory')?.value) || null,
    year: parseInt(f.querySelector('[name="year"]').value) || null,
    pages: parseInt(f.querySelector('[name="pages"]').value) || null,
    price: parseFloat(f.querySelector('[name="price"]').value) || 1200,
    discount_price: parseFloat(f.querySelector('[name="discount_price"]').value) || null,
    pdf_price: parseFloat(f.querySelector('[name="pdf_price"]').value) || 5.0,
    description: f.querySelector('[name="description"]').value.trim(),
    color: f.querySelector('[name="color"]').value,
    status: f.querySelector('[name="status"]').checked ? 'published' : 'draft',
    cover_url: cover_url || null,
    pdf_url: pdf_url || null,
  };

  const saveBtn = document.querySelector('#bookDrawer .btn-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'جارٍ الحفظ...'; }

  try {
    if (bookEditId) {
      await api.put(`/api/books/${bookEditId}`, data);
    } else {
      await api.post('/api/books', data);
    }
    closeBookDrawer();
    toast(bookEditId ? 'تم تحديث الكتاب بنجاح' : 'تمت إضافة الكتاب بنجاح');
    await renderBooksSection();
    await renderDashboard();
  } catch (err) {
    toast('تعذّر حفظ الكتاب: ' + (err.message || 'خطأ غير معروف'), 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'حفظ الكتاب'; }
  }
}

// ─── SECTION 3: CATEGORIES ────────────────────────────────────────────────────
let showCatForm = false;

async function renderCategoriesSection() {
  await refreshCats();
  const list = document.getElementById('catList');
  if (!list) return;

  if (!Array.isArray(adminBooks) || !adminBooks.length) {
    try {
      const data = await api.get('/api/books');
      adminBooks = Array.isArray(data) ? data : [];
    } catch {
      adminBooks = [];
    }
  }

  list.innerHTML = adminCats.length
    ? adminCats.map(c => {
      const count = Array.isArray(adminBooks) ? adminBooks.filter(b => String(b.category_id) === String(c.id)).length : 0;
      return `
        <div class="category-item">
          <span class="cat-color-dot" style="background:${c.color || '#C9A84C'}"></span>
          <span class="cat-name">${escHtml(c.name)}</span>
          <span class="cat-count">(${count} كتاب)</span>
          <div class="action-btns">
            <button class="btn-edit" onclick="editCat(${c.id})">✏️</button>
            <button class="btn-del"  onclick="deleteCat(${c.id}, ${count})">🗑️</button>
          </div>
        </div>`;
    }).join('')
    : `<div class="empty-state"><div class="empty-icon">🏷️</div><p>لا توجد تصنيفات حالياً. اضغط على "+ إضافة تصنيف" للبدء</p></div>`;
}

function initCategoriesSection() {
  document.getElementById('addCatBtn')?.addEventListener('click', () => {
    const form = document.getElementById('inlineCatForm');
    showCatForm = !showCatForm;
    form.style.display = showCatForm ? 'block' : 'none';
    if (showCatForm) {
      document.getElementById('catFormName').value = '';
      document.getElementById('catFormColor').value = '#1B6CA8';
      document.getElementById('catFormId').value = '';
    }
  });

  document.getElementById('catFormSave')?.addEventListener('click', async () => {
    const name = document.getElementById('catFormName').value.trim();
    const color = document.getElementById('catFormColor').value;
    const editId = document.getElementById('catFormId').value;
    if (!name) { toast('يرجى إدخال اسم التصنيف', 'error'); return; }

    const saveBtn = document.getElementById('catFormSave');
    saveBtn.disabled = true;
    try {
      if (editId) {
        await api.put(`/api/categories/${editId}`, { name, color });
        toast('تم تحديث التصنيف');
      } else {
        await api.post('/api/categories', { name, color });
        toast('تمت إضافة التصنيف');
      }
      document.getElementById('inlineCatForm').style.display = 'none';
      showCatForm = false;
      await renderCategoriesSection();
    } catch {
      toast('تعذّر حفظ التصنيف', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.getElementById('catFormCancel')?.addEventListener('click', () => {
    document.getElementById('inlineCatForm').style.display = 'none';
    showCatForm = false;
  });
}

window.editCat = function (id) {
  const cat = adminCats.find(c => c.id === id);
  if (!cat) return;
  document.getElementById('catFormName').value = cat.name;
  document.getElementById('catFormColor').value = cat.color;
  document.getElementById('catFormId').value = cat.id;
  document.getElementById('inlineCatForm').style.display = 'block';
  showCatForm = true;
};

window.deleteCat = function (id, bookCount) {
  const msg = bookCount > 0
    ? `هذا التصنيف يحتوي على ${bookCount} كتاب. هل تريد المتابعة؟`
    : 'هل أنت متأكد من حذف هذا التصنيف؟';
  confirmDialog(msg, async () => {
    try {
      await api.del(`/api/categories/${id}`);
      toast('تم حذف التصنيف');
      await renderCategoriesSection();
    } catch {
      toast('تعذّر حذف التصنيف', 'error');
    }
  });
};

// ─── SECTION 4: ABOUT ─────────────────────────────────────────────────────────
let localMilestones = [];

async function renderAboutSection() {
  const s = id => document.getElementById(id);
  try {
    const [about, mils] = await Promise.all([
      api.get('/api/about'),
      api.get('/api/milestones').catch(() => []),
    ]);
    if (s('aMain')) s('aMain').value = about.main_text || about.main || '';
    if (s('aMission')) s('aMission').value = about.mission || '';
    if (s('aVision')) s('aVision').value = about.vision || '';
    localMilestones = Array.isArray(mils) ? mils : [];
    renderMilestonesList(localMilestones);
  } catch {
    toast('تعذّر تحميل بيانات "من نحن"', 'error');
  }
}

function renderMilestonesList(mils) {
  const container = document.getElementById('milestonesList');
  if (!container) return;
  container.innerHTML = mils.map((m, i) => `
    <div class="milestone-row">
      <input type="number" placeholder="السنة"   value="${escHtml(String(m.year || ''))}"        data-idx="${i}" data-field="year">
      <input type="text"   placeholder="العنوان" value="${escHtml(m.title || '')}"       data-idx="${i}" data-field="title">
      <input type="text"   placeholder="الوصف"   value="${escHtml(m.description || '')}" data-idx="${i}" data-field="description">
      <button class="btn-del-sm" onclick="deleteMilestone(${i})">🗑️</button>
    </div>`).join('');
}

function collectMilestones() {
  return Array.from(document.querySelectorAll('.milestone-row')).map(row => {
    const inp = row.querySelectorAll('input');
    return { year: inp[0].value, title: inp[1].value, description: inp[2].value };
  });
}

function initAboutSection() {
  document.getElementById('saveAboutBtn')?.addEventListener('click', async () => {
    const mils = collectMilestones();
    const body = {
      main_text: document.getElementById('aMain')?.value.trim(),
      mission: document.getElementById('aMission')?.value.trim(),
      vision: document.getElementById('aVision')?.value.trim(),
    };
    const saveBtn = document.getElementById('saveAboutBtn');
    saveBtn.disabled = true;
    try {
      await api.put('/api/about', body);
      // Save milestones: sync deletions/additions by rebuilding via API
      const existingMils = await api.get('/api/milestones').catch(() => []);
      for (const m of existingMils) {
        await api.del(`/api/milestones/${m.id}`).catch(() => null);
      }
      for (const m of mils) {
        if (m.year || m.title) {
          await api.post('/api/milestones', m).catch(() => null);
        }
      }
      toast('تم حفظ بيانات "من نحن" بنجاح');
    } catch {
      toast('تعذّر الحفظ', 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.getElementById('addMilestoneBtn')?.addEventListener('click', () => {
    const mils = collectMilestones();
    mils.push({ year: new Date().getFullYear().toString(), title: '', description: '' });
    renderMilestonesList(mils);
  });
}

window.deleteMilestone = function (idx) {
  const mils = collectMilestones();
  mils.splice(idx, 1);
  renderMilestonesList(mils);
};

// ─── SECTION 5: MESSAGES ──────────────────────────────────────────────────────
let msgFilter = 'all';
let msgSearchQuery = '';
let adminMsgs = [];
let selectedMsgIds = new Set();

function updateMsgBulkBar() {
  const bar = document.getElementById('msgBulkBar');
  const countEl = document.getElementById('msgSelectedCount');
  const selectAll = document.getElementById('msgSelectAll');
  if (!bar || !countEl) return;

  const count = selectedMsgIds.size;
  countEl.textContent = count;
  bar.style.display = count > 0 ? 'flex' : 'none';

  if (selectAll) {
    const visibleCheckboxes = document.querySelectorAll('.msg-row-cb');
    if (visibleCheckboxes.length > 0) {
      selectAll.checked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    } else {
      selectAll.checked = false;
    }
  }
}

async function renderMessagesSection(filter) {
  if (filter !== undefined) msgFilter = filter;
  const tbody = document.getElementById('msgsTbody');
  if (!tbody) return;

  try {
    adminMsgs = await api.get('/api/messages');
    if (!Array.isArray(adminMsgs)) adminMsgs = [];
  } catch {
    adminMsgs = [];
  }

  const filtered = adminMsgs.filter(m => {
    let matchStatus = true;
    if (msgFilter === 'unread') matchStatus = !m.is_read;
    if (msgFilter === 'read') matchStatus = !!m.is_read;

    const q = (msgSearchQuery || '').toLowerCase().trim();
    const matchSearch = !q ||
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.subject && m.subject.toLowerCase().includes(q)) ||
      (m.message && m.message.toLowerCase().includes(q));

    return matchStatus && matchSearch;
  });

  const sorted = [...filtered].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  tbody.innerHTML = sorted.length
    ? sorted.map(m => {
      const isRead = m.is_read;
      const isChecked = selectedMsgIds.has(m.id);
      const dateStr = new Date(m.created_at || Date.now()).toLocaleDateString('ar-DZ');
      return `
      <tr class="message-row${isRead ? '' : ' unread'}" data-msg-id="${m.id}" style="${isChecked ? 'background:rgba(201,168,76,0.08)' : ''}">
        <td style="text-align:center">
          <input type="checkbox" class="msg-row-cb" data-id="${m.id}" ${isChecked ? 'checked' : ''} onchange="toggleMsgSelection(${m.id}, this.checked)" />
        </td>
        <td class="td-name"><strong>${escHtml(m.name)}</strong></td>
        <td style="font-size:0.85rem;color:var(--text-muted)">${escHtml(m.email)}</td>
        <td><strong style="color:var(--text-light)">${escHtml(m.subject || 'بدون عنوان')}</strong></td>
        <td style="font-size:0.85rem;color:var(--text-muted)">${dateStr}</td>
        <td>${isRead ? '<span class="status-badge status-published">مقروء ✓</span>' : '<span class="status-badge" style="background:#e67e22;color:#fff">جديد 📩</span>'}</td>
        <td>
          <div class="action-btns" style="display:flex;gap:0.35rem">
            <button class="btn-view" onclick="toggleMsgDetail(${m.id})">عرض</button>
            <button class="btn-edit" style="background:#27ae60;border-color:#27ae60;color:#fff;font-size:0.75rem;padding:0.25rem 0.6rem" onclick="openEmailForMessage(${m.id})" title="إرسال رد رسمي عبر الإيميل">✉️ رد</button>
            <button class="btn-del"  onclick="deleteMsg(${m.id})">🗑️</button>
          </div>
        </td>
      </tr>
      <tr class="detail-row" id="detail-${m.id}">
        <td colspan="7">
          <div class="message-detail" id="msg-detail-${m.id}">
            <div class="message-text-box">${escHtml(m.message)}</div>
            <div class="msg-actions" style="display:flex;gap:0.5rem;flex-wrap:wrap">
              <button class="btn-save" style="background:#27ae60;border-color:#27ae60" onclick="openEmailForMessage(${m.id})">✉️ رد عبر الإيميل الرسمي للدار</button>
              ${isRead
          ? `<button class="btn-mark-unread" onclick="markMsg(${m.id}, false)">تحديد كغير مقروء</button>`
          : `<button class="btn-mark-read"   onclick="markMsg(${m.id}, true)">تحديد كمقروء</button>`}
              <button class="btn-del" onclick="deleteMsg(${m.id})">🗑️ حذف</button>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📬</div><p>لا توجد رسائل واردة مطابقة</p></div></td></tr>`;

  updateMsgBulkBar();
  updateUnreadBadge();
}

window.toggleMsgSelection = function(id, checked) {
  if (checked) {
    selectedMsgIds.add(id);
  } else {
    selectedMsgIds.delete(id);
  }
  updateMsgBulkBar();
};

function initMessagesSection() {
  document.querySelectorAll('.msg-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.msg-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMsgIds.clear();
      renderMessagesSection(btn.dataset.filter);
    });
  });

  document.getElementById('msgSearchInput')?.addEventListener('input', e => {
    msgSearchQuery = e.target.value;
    renderMessagesSection();
  });

  document.getElementById('msgSelectAll')?.addEventListener('change', e => {
    const checked = e.target.checked;
    document.querySelectorAll('.msg-row-cb').forEach(cb => {
      cb.checked = checked;
      const id = Number(cb.dataset.id);
      if (id) {
        if (checked) selectedMsgIds.add(id);
        else selectedMsgIds.delete(id);
      }
    });
    updateMsgBulkBar();
  });

  // Bulk Mark Read
  document.getElementById('btnMsgBulkMarkRead')?.addEventListener('click', async () => {
    if (!selectedMsgIds.size) return;
    try {
      await api.post('/api/messages/bulk-read', { ids: Array.from(selectedMsgIds), is_read: 1 });
      toast(`تم تحديد ${selectedMsgIds.size} رسالة كمقروءة`);
      selectedMsgIds.clear();
      await renderMessagesSection();
    } catch {
      toast('تعذّر تحديث الرسائل', 'error');
    }
  });

  // Bulk Mark Unread
  document.getElementById('btnMsgBulkMarkUnread')?.addEventListener('click', async () => {
    if (!selectedMsgIds.size) return;
    try {
      await api.post('/api/messages/bulk-read', { ids: Array.from(selectedMsgIds), is_read: 0 });
      toast(`تم تحديد ${selectedMsgIds.size} رسالة كغير مقروءة`);
      selectedMsgIds.clear();
      await renderMessagesSection();
    } catch {
      toast('تعذّر تحديث الرسائل', 'error');
    }
  });

  // Bulk Delete Selected
  document.getElementById('btnMsgBulkDelete')?.addEventListener('click', () => {
    if (!selectedMsgIds.size) return;
    confirmDialog(`هل أنت متأكد من حذف ${selectedMsgIds.size} رسالة محددة نهائياً؟`, async () => {
      try {
        await api.post('/api/messages/bulk-delete', { ids: Array.from(selectedMsgIds) });
        toast('تم حذف الرسائل المحددة بنجاح');
        selectedMsgIds.clear();
        await renderMessagesSection();
      } catch {
        toast('تعذّر حذف الرسائل', 'error');
      }
    });
  });

  // Delete All Messages
  document.getElementById('btnMsgDeleteAll')?.addEventListener('click', () => {
    confirmDialog('⚠️ تحذير: هل أنت متأكد تماماً من حذف جميع الرسائل الواردة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.', async () => {
      try {
        await api.post('/api/messages/bulk-delete', { all: true });
        toast('تم حذف جميع الرسائل بنجاح');
        selectedMsgIds.clear();
        await renderMessagesSection();
      } catch {
        toast('تعذّر حذف الرسائل', 'error');
      }
    });
  });
}

window.toggleMsgDetail = function (id) {
  const detail = document.getElementById(`msg-detail-${id}`);
  if (!detail) return;
  const isOpen = detail.classList.contains('open');
  document.querySelectorAll('.message-detail.open').forEach(d => d.classList.remove('open'));
  if (!isOpen) {
    detail.classList.add('open');
    const msgObj = adminMsgs.find(m => m.id === id);
    if (msgObj && !msgObj.is_read) {
      msgObj.is_read = true;
      api.patch(`/api/messages/${id}`, { is_read: true }).catch(() => { });
      const row = document.querySelector(`tr.message-row[data-msg-id="${id}"]`);
      if (row) {
        row.classList.remove('unread');
        const badge = row.querySelector('.unread-badge');
        if (badge) badge.outerHTML = '<span class="status-badge status-published">مقروء</span>';
        const markBtn = detail.querySelector('.btn-mark-read');
        if (markBtn) {
          markBtn.className = 'btn-mark-unread';
          markBtn.textContent = 'تحديد كغير مقروء';
          markBtn.onclick = () => markMsg(id, false);
        }
      }
      const msgBadge = document.getElementById('msgBadge');
      if (msgBadge) {
        const unread = adminMsgs.filter(m => !m.is_read).length;
        msgBadge.textContent = unread || '';
        msgBadge.style.display = unread ? 'inline' : 'none';
      }
    }
  }
};

window.markMsg = async function (id, read) {
  try {
    await api.patch(`/api/messages/${id}`, { is_read: read });
  } catch { /* silent */ }
  await renderMessagesSection();
};

window.deleteMsg = function (id) {
  confirmDialog('هل تريد حذف هذه الرسالة؟', async () => {
    try {
      await api.del(`/api/messages/${id}`);
      toast('تم حذف الرسالة');
    } catch {
      toast('تعذّر حذف الرسالة', 'error');
    }
    await renderMessagesSection();
  });
};

// ─── SECTION 6: TESTIMONIALS ──────────────────────────────────────────────────
let testEditId = null;
let adminTests = [];

async function renderTestimonialsSection() {
  const grid = document.getElementById('testimonialsAdminGrid');
  if (!grid) return;
  grid.innerHTML = `<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:2rem">جارٍ التحميل...</div>`;
  try {
    adminTests = await api.get('/api/testimonials');
    if (!Array.isArray(adminTests)) adminTests = [];
  } catch {
    adminTests = [];
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⚠️</div><p>تعذّر تحميل الشهادات</p></div>`;
    return;
  }
  grid.innerHTML = adminTests.length
    ? adminTests.map(t => {
      const stars = '★'.repeat(t.rating || 5) + '☆'.repeat(5 - (t.rating || 5));
      return `
        <div class="testimonial-admin-card">
          <div class="card-actions">
            <button class="btn-edit" onclick="editTest(${t.id})">✏️</button>
            <button class="btn-del"  onclick="deleteTest(${t.id})">🗑️</button>
          </div>
          <div class="tac-stars">${stars}</div>
          <div class="tac-name">${escHtml(t.name)}</div>
          <div class="tac-role">${escHtml(t.role || '')}</div>
          <p class="tac-text">${escHtml(t.quote)}</p>
        </div>`;
    }).join('')
    : `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⭐</div><p>لا توجد شهادات</p></div>`;
}

function initTestimonialsSection() {
  document.getElementById('addTestBtn')?.addEventListener('click', () => openTestDrawer(null));
  document.getElementById('testDrawerClose')?.addEventListener('click', closeTestDrawer);
  document.getElementById('testDrawerCancel')?.addEventListener('click', closeTestDrawer);
  document.getElementById('testDrawerOverlay')?.addEventListener('click', closeTestDrawer);
  document.getElementById('testForm')?.addEventListener('submit', saveTest);
}

window.editTest = function (id) {
  const t = adminTests.find(t => t.id === id);
  if (t) openTestDrawer(t);
};

window.deleteTest = function (id) {
  confirmDialog('هل تريد حذف هذه الشهادة؟', async () => {
    try {
      await api.del(`/api/testimonials/${id}`);
      toast('تم حذف الشهادة');
      await renderTestimonialsSection();
      await renderDashboard();
    } catch {
      toast('تعذّر حذف الشهادة', 'error');
    }
  });
};

function openTestDrawer(t) {
  testEditId = t?.id || null;
  document.getElementById('testDrawerTitle').textContent = t ? 'تعديل الشهادة' : 'إضافة شهادة';
  const f = document.getElementById('testForm');
  f.querySelector('[name="name"]').value = t?.name || '';
  f.querySelector('[name="role"]').value = t?.role || '';
  f.querySelector('[name="quote"]').value = t?.quote || '';
  const rating = t?.rating || 5;
  const radio = f.querySelector(`[name="rating"][value="${rating}"]`);
  if (radio) radio.checked = true;
  document.getElementById('testDrawer').classList.add('open');
  document.getElementById('testDrawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTestDrawer() {
  document.getElementById('testDrawer').classList.remove('open');
  document.getElementById('testDrawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function saveTest(e) {
  e.preventDefault();
  const f = e.target;
  const name = f.querySelector('[name="name"]').value.trim();
  const quote = f.querySelector('[name="quote"]').value.trim();
  if (!name || !quote) { toast('يرجى ملء الحقول المطلوبة', 'error'); return; }
  const ratingEl = f.querySelector('[name="rating"]:checked');
  const data = {
    name,
    role: f.querySelector('[name="role"]').value.trim(),
    quote,
    rating: ratingEl ? parseInt(ratingEl.value) : 5,
  };
  try {
    if (testEditId) {
      await api.put(`/api/testimonials/${testEditId}`, data);
    } else {
      await api.post('/api/testimonials', data);
    }
    closeTestDrawer();
    toast(testEditId ? 'تم تحديث الشهادة' : 'تمت إضافة الشهادة');
    await renderTestimonialsSection();
    await renderDashboard();
  } catch {
    toast('تعذّر حفظ الشهادة', 'error');
  }
}

// ─── SECTION 7: CONTACT ───────────────────────────────────────────────────────
async function renderContactSection() {
  try {
    const info = await api.get('/api/contact');
    ['address', 'phone', 'phone2', 'email', 'hours', 'facebook', 'instagram', 'whatsapp'].forEach(k => {
      const el = document.querySelector(`#sec-contact [name="${k}"]`);
      if (el) el.value = info[k] || '';
    });
  } catch {
    toast('تعذّر تحميل معلومات التواصل', 'error');
  }
}

function initContactSection() {
  document.getElementById('saveContactBtn')?.addEventListener('click', async () => {
    const data = {};
    ['address', 'phone', 'phone2', 'email', 'hours', 'facebook', 'instagram', 'whatsapp'].forEach(k => {
      const el = document.querySelector(`#sec-contact [name="${k}"]`);
      if (el) data[k] = el.value.trim();
    });
    const btn = document.getElementById('saveContactBtn');
    btn.disabled = true;
    try {
      await api.put('/api/contact', data);
      toast('تم حفظ معلومات التواصل بنجاح');
    } catch {
      toast('تعذّر الحفظ', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── SECTION 8: SETTINGS ──────────────────────────────────────────────────────
async function renderSettingsSection() {
  try {
    const s = await api.get('/api/settings');
    ['hero_title', 'hero_subtitle', 'stat_years', 'stat_books', 'stat_readers', 'copyright', 'announcement_text', 'announcement_link'].forEach(k => {
      const el = document.querySelector(`#sec-settings [name="${k}"]`);
      if (el) el.value = s[k] || '';
    });
    const activeEl = document.querySelector('#sec-settings [name="announcement_active"]');
    if (activeEl) {
      activeEl.checked = s.announcement_active !== 0 && s.announcement_active !== '0';
    }
  } catch { /* silently skip */ }

  // Load SMTP Settings
  try {
    const smtp = await api.get('/api/email/settings');
    if (smtp) {
      if (document.getElementById('smtpHostInput')) document.getElementById('smtpHostInput').value = smtp.smtp_host || '';
      if (document.getElementById('smtpPortInput')) document.getElementById('smtpPortInput').value = smtp.smtp_port || '465';
      if (document.getElementById('smtpUserInput')) document.getElementById('smtpUserInput').value = smtp.smtp_user || '';
      if (document.getElementById('smtpFromNameInput')) document.getElementById('smtpFromNameInput').value = smtp.smtp_from_name || 'دار علي بن زيد للطباعة والنشر';
      if (document.getElementById('smtpFromEmailInput')) document.getElementById('smtpFromEmailInput').value = smtp.smtp_from_email || smtp.smtp_user || '';
      if (smtp.smtp_pass_set) {
        document.getElementById('smtpPassInput').placeholder = '•••••••• (كلمة المرور محفوظة مسبقاً)';
      }
    }
  } catch { /* silent */ }

  // Load IMAP Settings
  try {
    const imap = await api.get('/api/inbox/settings/config');
    if (imap) {
      if (document.getElementById('imapHostInput')) document.getElementById('imapHostInput').value = imap.imap_host || 'imap.stackmail.com';
      if (document.getElementById('imapPortInput')) document.getElementById('imapPortInput').value = imap.imap_port || '993';
      if (document.getElementById('imapUserInput')) document.getElementById('imapUserInput').value = imap.imap_user || 'info@daralibenzid.dz';
      if (imap.imap_pass_set && document.getElementById('imapPassInput')) {
        document.getElementById('imapPassInput').placeholder = '•••••••• (كلمة المرور محفوظة مسبقاً)';
      }
    }
  } catch { /* silent */ }
}

function initSettingsSection() {
  document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
    const data = {};
    ['hero_title', 'hero_subtitle', 'stat_years', 'stat_books', 'stat_readers', 'copyright', 'announcement_text', 'announcement_link'].forEach(k => {
      const el = document.querySelector(`#sec-settings [name="${k}"]`);
      if (el) data[k] = el.value.trim();
    });
    const activeEl = document.querySelector('#sec-settings [name="announcement_active"]');
    if (activeEl) {
      data.announcement_active = activeEl.checked ? 1 : 0;
    }

    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;
    try {
      await api.put('/api/settings', data);
      toast('تم حفظ الإعدادات العامة وشريط الإعلانات بنجاح');
    } catch {
      toast('تعذّر حفظ الإعدادات', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Save SMTP Settings
  document.getElementById('smtpSettingsForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const host = document.getElementById('smtpHostInput')?.value.trim();
    const port = Number(document.getElementById('smtpPortInput')?.value || 465);
    const user = document.getElementById('smtpUserInput')?.value.trim();
    const pass = document.getElementById('smtpPassInput')?.value.trim();
    const fromName = document.getElementById('smtpFromNameInput')?.value.trim();
    const fromEmail = document.getElementById('smtpFromEmailInput')?.value.trim();

    if (!host || !user) {
      toast('يرجى كتابة خادم البريد (Host) والبريد الإلكتروني للدار', 'error');
      return;
    }

    const btn = document.getElementById('btnSaveSmtp');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الحفظ...'; }

    try {
      const payload = {
        smtp_host: host,
        smtp_port: port,
        smtp_user: user,
        smtp_from_name: fromName || 'دار علي بن زيد للطباعة والنشر',
        smtp_from_email: fromEmail || user
      };
      if (pass) payload.smtp_pass = pass;

      await api.put('/api/email/settings', payload);
      toast('✅ تم حفظ إعدادات البريد الرسمي للدار بنجاح');
    } catch (err) {
      toast('تعذّر حفظ إعدادات البريد: ' + (err.message || ''), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ إعدادات البريد'; }
    }
  });

  // Test SMTP Settings
  document.getElementById('btnTestSmtp')?.addEventListener('click', async () => {
    const host = document.getElementById('smtpHostInput')?.value.trim();
    const port = Number(document.getElementById('smtpPortInput')?.value || 465);
    const user = document.getElementById('smtpUserInput')?.value.trim();
    const pass = document.getElementById('smtpPassInput')?.value.trim();
    const fromName = document.getElementById('smtpFromNameInput')?.value.trim();
    const fromEmail = document.getElementById('smtpFromEmailInput')?.value.trim();

    if (!host || !user) {
      toast('يرجى كتابة خادم البريد (Host) والبريد الإلكتروني للدار أولاً', 'error');
      return;
    }

    const testBtn = document.getElementById('btnTestSmtp');
    if (testBtn) { testBtn.disabled = true; testBtn.textContent = '⏳ جارٍ الفحص...'; }

    const feedback = document.getElementById('smtpStatusFeedback');
    if (feedback) feedback.innerHTML = '<span style="color:var(--gold)">⏳ جارٍ الاتصال بخادم البريد وإرسال بريد الاختبار...</span>';

    try {
      const res = await api.post('/api/email/test', {
        smtp_host: host,
        smtp_port: port,
        smtp_user: user,
        smtp_pass: pass,
        smtp_from_name: fromName,
        smtp_from_email: fromEmail,
        test_recipient: user
      });
      toast('🎉 ' + res.message);
      if (feedback) feedback.innerHTML = `<span style="color:var(--success)">✅ ${res.message}</span>`;
    } catch (err) {
      toast('فشل الاختبار: ' + (err.message || ''), 'error');
      if (feedback) feedback.innerHTML = `<span style="color:var(--danger)">❌ ${err.message || 'فشل الاتصال بخادم البريد (تأكد من المنفذ وكلمة المرور)'}</span>`;
    } finally {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🧪 فحص وإرسال بريد اختباري'; }
    }
  });

  // Save IMAP Settings
  document.getElementById('imapSettingsForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const host = document.getElementById('imapHostInput')?.value.trim();
    const port = Number(document.getElementById('imapPortInput')?.value || 993);
    const user = document.getElementById('imapUserInput')?.value.trim();
    const pass = document.getElementById('imapPassInput')?.value.trim();

    if (!host || !user) {
      toast('يرجى كتابة خادم البريد الوارد (IMAP Host) واسم المستخدم', 'error');
      return;
    }

    const btn = document.getElementById('btnSaveImap');
    if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الحفظ...'; }

    try {
      const payload = { imap_host: host, imap_port: port, imap_user: user };
      if (pass) payload.imap_pass = pass;

      await api.put('/api/inbox/settings/config', payload);
      toast('✅ تم حفظ إعدادات البريد الوارد (IMAP) بنجاح');
    } catch (err) {
      toast('تعذّر حفظ إعدادات IMAP: ' + (err.message || ''), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 حفظ إعدادات البريد الوارد (IMAP)'; }
    }
  });

  // Test / Trigger IMAP Sync from Settings
  document.getElementById('btnTestImap')?.addEventListener('click', async () => {
    const feedback = document.getElementById('imapStatusFeedback');
    const testBtn = document.getElementById('btnTestImap');
    if (testBtn) { testBtn.disabled = true; testBtn.textContent = '⏳ جارٍ الاتصال وجلب الرسائل...'; }
    if (feedback) feedback.innerHTML = '<span style="color:var(--gold)">⏳ جارٍ الاتصال بخادم IMAP وجلب الرسائل الواردة...</span>';

    try {
      const host = document.getElementById('imapHostInput')?.value.trim();
      const port = Number(document.getElementById('imapPortInput')?.value || 993);
      const user = document.getElementById('imapUserInput')?.value.trim();
      const pass = document.getElementById('imapPassInput')?.value.trim();

      const config = { host, port, user };
      if (pass) config.pass = pass;

      const res = await api.post('/api/inbox/sync', { config });
      toast('🎉 ' + res.message);
      if (feedback) feedback.innerHTML = `<span style="color:var(--success)">✅ ${res.message}</span>`;
      await updateUnreadBadge();
    } catch (err) {
      toast('تعذّر جلب الرسائل: ' + (err.message || ''), 'error');
      if (feedback) feedback.innerHTML = `<span style="color:var(--danger)">❌ ${err.message || 'فشل الاتصال بخادم IMAP'}</span>`;
    } finally {
      if (testBtn) { testBtn.disabled = false; testBtn.textContent = '🔄 جلب وتحديث الرسائل الآن'; }
    }
  });

  document.getElementById('changePassBtn')?.addEventListener('click', async () => {
    const current = document.getElementById('passCurrent')?.value || '';
    const newPass = document.getElementById('passNew')?.value || '';
    const confirm2 = document.getElementById('passConfirm')?.value || '';
    if (!current || !newPass || !confirm2) { toast('يرجى ملء جميع حقول كلمة المرور', 'error'); return; }
    if (newPass !== confirm2) { toast('كلمتا المرور الجديدتان غير متطابقتين', 'error'); return; }
    if (newPass.length < 4) { toast('كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'error'); return; }

    const btn = document.getElementById('changePassBtn');
    btn.disabled = true;
    try {
      await api.put('/api/admin/change-password', { currentPassword: current, newPassword: newPass });
      ['passCurrent', 'passNew', 'passConfirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      toast('تم تغيير كلمة المرور بنجاح — يرجى إعادة تسجيل الدخول');
      setTimeout(() => {
        sessionStorage.removeItem('dar_admin_session');
        location.reload();
      }, 1500);
    } catch (err) {
      toast(err.message?.includes('401') ? 'كلمة المرور الحالية غير صحيحة' : 'تعذّر تغيير كلمة المرور', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// ─── HELPER: STATUS LABEL ─────────────────────────────────────────────────────
function getStatusLabel(status) {
  const map = {
    pending: 'قيد الانتظار ⏳',
    confirmed: 'مؤكد ✅',
    shipped: 'تم الشحن 🚚',
    delivered: 'تم التوصيل 📦',
    cancelled: 'ملغي ❌',
  };
  return map[status] || status;
}

// ─── SECTION: ORDERS ──────────────────────────────────────────────────────────
let adminOrders = [];
let orderFilterStatus = 'all';
let orderSearchQuery = '';

async function renderOrdersSection() {
  try {
    const data = await api.get('/api/orders');
    adminOrders = Array.isArray(data) ? data : [];
  } catch {
    adminOrders = [];
  }

  const tbody = document.getElementById('ordersTbody');
  if (!tbody) return;

  const filtered = adminOrders.filter(o => {
    const matchStatus = (orderFilterStatus === 'all') || (o.status === orderFilterStatus);
    const q = orderSearchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.customer_phone && o.customer_phone.includes(q)) ||
      (o.wilaya_name && o.wilaya_name.toLowerCase().includes(q)) ||
      (o.book_title && o.book_title.toLowerCase().includes(q)) ||
      String(o.id).includes(q);
    return matchStatus && matchSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:2.5rem">لا توجد طلبات مطابقة</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const cleanPhone = (o.customer_phone || '').replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '213' + cleanPhone.slice(1) : (cleanPhone.startsWith('213') ? cleanPhone : '213' + cleanPhone);

    let booksDisplay = `<div style="font-weight:600">${escHtml(o.book_title)}</div><div style="font-size:0.82rem;color:var(--text-muted)">الكمية: <strong>${o.quantity}</strong> × ${o.unit_price || o.book_price || ''} دج</div>`;

    if (o.items) {
      try {
        const parsed = JSON.parse(o.items);
        if (Array.isArray(parsed) && parsed.length > 0) {
          booksDisplay = parsed.map(it => `
            <div style="font-size:0.85rem;margin-bottom:0.2rem">
              📚 <strong>${escHtml(it.title || it.book_title)}</strong> <span style="color:var(--gold)">(×${it.quantity || 1})</span>
            </div>
          `).join('');
        }
      } catch { /* use default */ }
    }

    return `
    <tr class="order-row" data-id="${o.id}">
      <td><strong style="color:var(--gold);font-size:1.05rem">#${o.id}</strong></td>
      <td style="font-size:0.85rem">${dateStr}</td>
      <td>
        <div style="font-weight:bold;color:var(--text-light)">${escHtml(o.customer_name)}</div>
        <div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.25rem">
          <a href="tel:${escHtml(o.customer_phone)}" style="color:var(--gold);font-size:0.85rem;text-decoration:none" title="اتصال هاتفي">📞 ${escHtml(o.customer_phone)}</a>
          <a href="https://wa.me/${waPhone}" target="_blank" rel="noopener" style="background:#25D366;color:#fff;border-radius:4px;padding:2px 6px;font-size:0.75rem;text-decoration:none" title="مراسلة واتساب">واتساب</a>
        </div>
      </td>
      <td>${booksDisplay}</td>
      <td>
        <div><strong>${escHtml(o.wilaya_name)}</strong> (${escHtml(o.commune || '—')})</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(o.address || '')} [${o.delivery_type === 'desk' ? '🏢 استلام من المكتب' : '🏠 توصيل للمنزل'}]</div>
      </td>
      <td>
        <div style="font-weight:bold;color:var(--gold);font-size:1.1rem">${o.total_price} دج</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">توصيل: ${o.shipping_fee || o.delivery_price || 0} دج</div>
      </td>
      <td>${o.coupon_code ? `<span class="coupon-tag" style="background:rgba(201,168,76,0.15);color:var(--gold);padding:2px 6px;border-radius:4px;font-weight:bold">${escHtml(o.coupon_code)} (-${o.discount_amount}دج)</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>
        <select class="status-select status-${o.status}" onchange="updateOrderStatus(${o.id}, this.value)" style="padding:0.4rem 0.6rem;border-radius:6px;border:1px solid var(--border);background:var(--navy-dark);color:#fff;font-size:0.85rem;cursor:pointer">
          <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>⏳ قيد الانتظار</option>
          <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>✅ مؤكد</option>
          <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>🚚 تم الشحن</option>
          <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>📦 تم التوصيل</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>❌ ملغي</option>
        </select>
      </td>
      <td>
        <div class="action-btns" style="display:flex;gap:0.4rem">
          <button class="btn-edit" onclick="openInvoice(${o.id})" title="طباعة الفاتورة والوصل">📄 وصل</button>
          <button class="btn-del" onclick="deleteOrder(${o.id})" title="حذف الطلب">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

window.updateOrderStatus = async function(id, newStatus) {
  try {
    await api.patch(`/api/orders/${id}/status`, { status: newStatus });
    toast(`تم تحديث حالة الطلب #${id} إلى: ${getStatusLabel(newStatus)}`);
    await updateUnreadBadge();
    await renderDashboard();
  } catch (err) {
    toast('تعذّر تحديث حالة الطلب: ' + (err.message || ''), 'error');
    await renderOrdersSection();
  }
};

window.deleteOrder = function(id) {
  confirmDialog('هل أنت متأكد من حذف هذا الطلب نهائياً؟', async () => {
    try {
      await api.del(`/api/orders/${id}`);
      toast('تم حذف الطلب بنجاح');
      await renderOrdersSection();
      await updateUnreadBadge();
      await renderDashboard();
    } catch {
      toast('تعذّر حذف الطلب', 'error');
    }
  });
};

window.openInvoice = function(orderId) {
  const o = adminOrders.find(x => x.id === orderId);
  if (!o) return;

  document.getElementById('invOrderId').textContent = `#${o.id}`;
  document.getElementById('invDate').textContent = o.created_at ? new Date(o.created_at).toLocaleDateString('ar-DZ') : '—';
  document.getElementById('invPayment').textContent = o.payment_method === 'cod' ? 'الدفع عند الاستلام (COD)' : 'دفع إلكتروني';
  document.getElementById('invCustomerName').textContent = o.customer_name;
  document.getElementById('invPhone').textContent = o.customer_phone;
  document.getElementById('invWilaya').textContent = `${o.wilaya_name} (${o.commune || ''})`;
  document.getElementById('invAddress').textContent = `${o.address || ''} [${o.delivery_type === 'desk' ? 'استلام من المكتب' : 'توصيل للمنزل'}]`;

  document.getElementById('invBookTitle').textContent = o.book_title;
  document.getElementById('invQty').textContent = o.quantity;
  document.getElementById('invUnitPrice').textContent = `${o.unit_price || o.book_price || 0} دج`;
  document.getElementById('invSubtotal').textContent = `${o.subtotal || o.book_price || 0} دج`;
  document.getElementById('invDelivery').textContent = `${o.shipping_fee || o.delivery_price || 0} دج`;

  const discRow = document.getElementById('invDiscountRow');
  if (o.discount_amount > 0) {
    discRow.style.display = 'table-row';
    document.getElementById('invDiscount').textContent = `-${o.discount_amount} دج (${o.coupon_code || ''})`;
  } else {
    discRow.style.display = 'none';
  }

  document.getElementById('invTotal').textContent = `${o.total_price} دج`;

  const modal = document.getElementById('invoiceModal');
  if (modal) modal.style.display = 'flex';
};

function exportOrdersToExcel() {
  const ordersToExport = adminOrders.filter(o => {
    const matchStatus = (orderFilterStatus === 'all') || (o.status === orderFilterStatus);
    const q = (orderSearchQuery || '').toLowerCase().trim();
    const matchSearch = !q ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.customer_phone && o.customer_phone.includes(q)) ||
      (o.wilaya_name && o.wilaya_name.toLowerCase().includes(q)) ||
      (o.book_title && o.book_title.toLowerCase().includes(q)) ||
      String(o.id).includes(q);
    return matchStatus && matchSearch;
  });

  if (!ordersToExport.length) {
    toast('لا توجد طلبات لتصديرها حالياً', 'error');
    return;
  }

  const statusMap = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    shipped: 'تم الشحن',
    delivered: 'تم التوصيل',
    cancelled: 'ملغي'
  };

  const deliveryMap = {
    home: 'توصيل للمنزل',
    desk: 'استلام من المكتب'
  };

  let csvContent = '\uFEFF'; // UTF-8 BOM for Microsoft Excel Arabic compatibility
  csvContent += 'رقم الطلب,تاريخ الطلب,اسم المشتري,رقم الهاتف,الولاية,البلدية,العنوان التفصيلي,نوع التوصيل,الكتاب / تفاصيل الطلب,الكمية,سعر الوحدة (دج),تكلفة التوصيل (دج),قيمة الخصم (دج),كود الخصم,المجموع الإجمالي (دج),حالة الطلب,ملاحظات\n';

  ordersToExport.forEach(o => {
    const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString('ar-DZ') : '';
    const customer = `"${(o.customer_name || '').replace(/"/g, '""')}"`;
    const phone = `"${(o.customer_phone || '').replace(/"/g, '""')}"`;
    const wilaya = `"${(o.wilaya_name || '').replace(/"/g, '""')}"`;
    const commune = `"${(o.commune || '').replace(/"/g, '""')}"`;
    const address = `"${(o.address || '').replace(/"/g, '""')}"`;
    const delivery = `"${deliveryMap[o.delivery_type] || o.delivery_type || ''}"`;

    let booksDesc = o.book_title || '';
    if (o.items) {
      try {
        const parsed = JSON.parse(o.items);
        if (Array.isArray(parsed) && parsed.length > 0) {
          booksDesc = parsed.map(i => `${i.title || i.book_title} (×${i.quantity || 1})`).join(' + ');
        }
      } catch { /* ignore */ }
    }
    const booksCol = `"${booksDesc.replace(/"/g, '""')}"`;
    const qty = o.quantity || 1;
    const unitPrice = Number(o.unit_price || o.book_price || 0);
    const deliveryPrice = Number(o.delivery_price || 0);
    const discount = Number(o.discount_amount || 0);
    const coupon = o.coupon_code ? `"${o.coupon_code}"` : '""';
    const total = Number(o.total_price || 0);
    const st = `"${statusMap[o.status] || o.status || ''}"`;
    const notes = o.notes ? `"${(o.notes || '').replace(/"/g, '""')}"` : '""';

    csvContent += `${o.id},${dateStr},${customer},${phone},${wilaya},${commune},${address},${delivery},${booksCol},${qty},${unitPrice},${deliveryPrice},${discount},${coupon},${total},${st},${notes}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `طلبات_دار_علي_بن_زيد_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast(`📊 تم تصدير ${ordersToExport.length} طلب إلى ملف Excel بنجاح ✅`);
}

function initOrdersSection() {
  document.querySelectorAll('#sec-orders .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sec-orders .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      orderFilterStatus = btn.dataset.orderStatus || 'all';
      renderOrdersSection();
    });
  });

  document.getElementById('orderSearch')?.addEventListener('input', e => {
    orderSearchQuery = e.target.value;
    renderOrdersSection();
  });

  document.getElementById('btnExportOrdersExcel')?.addEventListener('click', () => {
    exportOrdersToExcel();
  });

  const invClose = document.getElementById('invoiceModalClose');
  const invCloseBtn = document.getElementById('btnInvoiceClose');
  const invOverlay = document.getElementById('invoiceModal');
  const closeInv = () => { if (invOverlay) invOverlay.style.display = 'none'; };
  invClose?.addEventListener('click', closeInv);
  invCloseBtn?.addEventListener('click', closeInv);
}

// ─── SECTION: COUPONS ─────────────────────────────────────────────────────────
let adminCoupons = [];
let couponEditId = null;

async function renderCouponsSection() {
  try {
    const data = await api.get('/api/coupons');
    adminCoupons = Array.isArray(data) ? data : [];
  } catch {
    adminCoupons = [];
  }

  const tbody = document.getElementById('couponsTbody');
  if (!tbody) return;

  if (!adminCoupons.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2.5rem">لا توجد أكواد خصم حالياً. انقر على "+ إضافة كود خصم جديد"</td></tr>`;
    return;
  }

  tbody.innerHTML = adminCoupons.map(c => `
    <tr>
      <td><strong style="color:var(--gold);letter-spacing:1px;font-size:1.05rem">${escHtml(c.code)}</strong></td>
      <td>${c.discount_type === 'percent' ? 'نسبة مئوية (%)' : 'مبلغ ثابت (دج)'}</td>
      <td><strong style="color:var(--success)">${c.discount_value}${c.discount_type === 'percent' ? '%' : ' دج'}</strong></td>
      <td>${c.min_order > 0 ? `${c.min_order} دج` : '<span style="color:var(--text-muted)">بدون حد</span>'}</td>
      <td><strong>${c.used_count || 0}</strong> / ${c.max_uses !== null ? c.max_uses : '∞'}</td>
      <td>${c.expires_at ? new Date(c.expires_at).toLocaleDateString('ar-DZ') : '<span style="color:var(--text-muted)">دائم</span>'}</td>
      <td>
        <span class="status-badge ${c.is_active ? 'status-published' : 'status-draft'}">
          ${c.is_active ? 'مفعّل' : 'معطّل'}
        </span>
      </td>
      <td>
        <div class="action-btns" style="display:flex;gap:0.4rem">
          <button class="btn-edit" onclick="openCouponDrawerById(${c.id})">✏️</button>
          <button class="btn-del" onclick="deleteCoupon(${c.id})">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

window.openCouponDrawerById = function(id) {
  const c = adminCoupons.find(x => x.id === id);
  if (c) openCouponDrawer(c);
};

function openCouponDrawer(coupon = null) {
  couponEditId = coupon ? coupon.id : null;
  document.getElementById('couponDrawerTitle').textContent = coupon ? 'تعديل كود الخصم' : 'إضافة كود خصم جديد';

  document.getElementById('couponCodeInput').value = coupon ? coupon.code : '';
  document.getElementById('couponTypeInput').value = coupon ? coupon.discount_type : 'percent';
  document.getElementById('couponValueInput').value = coupon ? coupon.discount_value : '';
  document.getElementById('couponMinOrderInput').value = coupon && coupon.min_order ? coupon.min_order : '';
  document.getElementById('couponMaxUsesInput').value = coupon && coupon.max_uses !== null ? coupon.max_uses : '';
  document.getElementById('couponExpiresInput').value = coupon && coupon.expires_at ? coupon.expires_at.split('T')[0] : '';
  document.getElementById('couponActiveInput').checked = coupon ? Boolean(coupon.is_active) : true;

  document.getElementById('couponDrawer').classList.add('open');
  document.getElementById('couponDrawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCouponDrawer() {
  document.getElementById('couponDrawer').classList.remove('open');
  document.getElementById('couponDrawerOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

window.deleteCoupon = function(id) {
  confirmDialog('هل أنت متأكد من حذف هذا الكوبون؟', async () => {
    try {
      await api.del(`/api/coupons/${id}`);
      toast('تم حذف الكود بنجاح');
      await renderCouponsSection();
    } catch {
      toast('تعذّر حذف الكود', 'error');
    }
  });
};

function initCouponsSection() {
  document.getElementById('addCouponBtn')?.addEventListener('click', () => openCouponDrawer(null));
  document.getElementById('couponDrawerClose')?.addEventListener('click', closeCouponDrawer);
  document.getElementById('couponDrawerCancel')?.addEventListener('click', closeCouponDrawer);
  document.getElementById('couponDrawerOverlay')?.addEventListener('click', closeCouponDrawer);

  document.getElementById('btnSaveCoupon')?.addEventListener('click', async e => {
    e.preventDefault();
    const code = document.getElementById('couponCodeInput').value.trim().toUpperCase();
    const discount_type = document.getElementById('couponTypeInput').value;
    const discount_value = document.getElementById('couponValueInput').value;
    const min_order = document.getElementById('couponMinOrderInput').value;
    const max_uses = document.getElementById('couponMaxUsesInput').value;
    const expires_at = document.getElementById('couponExpiresInput').value;
    const is_active = document.getElementById('couponActiveInput').checked;

    if (!code || !discount_value) {
      toast('يرجى ملء الكود وقيمة الخصم', 'error');
      return;
    }

    const payload = {
      code,
      discount_type,
      discount_value: Number(discount_value),
      min_order: min_order ? Number(min_order) : 0,
      max_uses: max_uses ? Number(max_uses) : null,
      expires_at: expires_at || null,
      is_active: is_active ? 1 : 0
    };

    const btn = document.getElementById('btnSaveCoupon');
    btn.disabled = true;
    btn.textContent = 'جارٍ الحفظ...';

    try {
      if (couponEditId) {
        await api.put(`/api/coupons/${couponEditId}`, payload);
        toast('تم تحديث كود الخصم بنجاح');
      } else {
        await api.post('/api/coupons', payload);
        toast('تمت إضافة كود الخصم بنجاح');
      }
      closeCouponDrawer();
      await renderCouponsSection();
    } catch (err) {
      toast('تعذّر حفظ الكوبون: ' + (err.message || ''), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'حفظ الكوبون';
    }
  });
}

// ─── SECTION: DELIVERY RATES (58 WILAYAS) ─────────────────────────────────────
let adminDeliveryRates = [];
let deliverySearchQuery = '';

async function renderDeliverySection() {
  try {
    const data = await api.get('/api/delivery/rates');
    adminDeliveryRates = Array.isArray(data) ? data : [];
  } catch {
    adminDeliveryRates = [];
  }

  const tbody = document.getElementById('deliveryRatesTbody');
  if (!tbody) return;

  const filtered = adminDeliveryRates.filter(w => {
    const q = deliverySearchQuery.toLowerCase().trim();
    if (!q) return true;
    return String(w.wilaya_code).includes(q) ||
           (w.wilaya_name && w.wilaya_name.toLowerCase().includes(q));
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2.5rem">لا توجد ولاية مطابقة لبحثك</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(w => {
    const wilayaMeta = ALGERIA_WILAYAS.find(x => x.code === w.wilaya_code);
    const communeCount = wilayaMeta ? wilayaMeta.communes.length : 0;
    const communesPreview = wilayaMeta ? wilayaMeta.communes.slice(0, 4).join('، ') + '...' : '';

    return `
    <tr id="wilaya-row-${w.wilaya_code}">
      <td><strong style="color:var(--gold);font-size:1.05rem">${w.wilaya_code}</strong></td>
      <td>
        <div style="font-weight:bold;color:var(--text-light);font-size:0.95rem">${escHtml(w.wilaya_name)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)" title="${wilayaMeta ? wilayaMeta.communes.join('، ') : ''}">
          📍 ${communeCount} بلدية (${escHtml(communesPreview)})
        </div>
      </td>
      <td>
        <input type="number" id="homePrice_${w.wilaya_code}" value="${w.home_price}" class="form-input" style="width:110px;padding:0.4rem 0.6rem" step="10" />
      </td>
      <td>
        <input type="number" id="deskPrice_${w.wilaya_code}" value="${w.desk_price}" class="form-input" style="width:110px;padding:0.4rem 0.6rem" step="10" />
      </td>
      <td>
        <label class="toggle-switch" title="تفعيل أو إيقاف التوصيل لهذه الولاية">
          <input type="checkbox" id="avail_${w.wilaya_code}" ${Number(w.is_available) === 1 ? 'checked' : ''} onchange="saveWilayaRate(${w.wilaya_code})" />
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button class="btn-save" onclick="saveWilayaRate(${w.wilaya_code})" style="padding:0.4rem 0.9rem;font-size:0.85rem">💾 حفظ</button>
      </td>
    </tr>`;
  }).join('');
}

window.saveWilayaRate = async function(wilayaCode) {
  const homePrice = document.getElementById(`homePrice_${wilayaCode}`)?.value;
  const deskPrice = document.getElementById(`deskPrice_${wilayaCode}`)?.value;
  const isAvailable = document.getElementById(`avail_${wilayaCode}`)?.checked;

  try {
    await api.put(`/api/delivery/rates/${wilayaCode}`, {
      home_price: Number(homePrice),
      desk_price: Number(deskPrice),
      is_available: isAvailable ? 1 : 0
    });
    if (isAvailable) {
      toast(`✅ تم تفعيل التوصيل لولاية (${wilayaCode}) وستظهر للزبائن`);
    } else {
      toast(`⛔ تم إيقاف التوصيل لولاية (${wilayaCode}) وتم إخفاؤها من الموقع`);
    }
  } catch (err) {
    toast('تعذّر تحديث السعر والحالة: ' + (err.message || ''), 'error');
  }
};

function initDeliverySection() {
  document.getElementById('deliverySearch')?.addEventListener('input', e => {
    deliverySearchQuery = e.target.value;
    renderDeliverySection();
  });

  document.getElementById('btnBulkDeliveryUpdate')?.addEventListener('click', async () => {
    const home = document.getElementById('bulkHomePrice')?.value;
    const desk = document.getElementById('bulkDeskPrice')?.value;

    if (!home && !desk) {
      toast('يرجى إدخال سعر التوصيل للمنزل أو للمكتب', 'error');
      return;
    }

    const payload = {};
    if (home) payload.home_price = Number(home);
    if (desk) payload.desk_price = Number(desk);

    const btn = document.getElementById('btnBulkDeliveryUpdate');
    btn.disabled = true;
    btn.textContent = 'جارٍ التطبيق...';

    try {
      await api.post('/api/delivery/rates/bulk', payload);
      toast('تم تطبيق الأسعار الجديدة على جميع الـ 58 ولاية بنجاح! 🚀');
      await renderDeliverySection();
    } catch (err) {
      toast('تعذّر التحديث الشامل: ' + (err.message || ''), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'تطبيق على 58 ولاية 🚀';
    }
  });
}

// ─── SECTION: STAFF MANAGEMENT ────────────────────────────────────────────────
let adminStaffList = [];
let staffSearchQuery = '';

async function renderStaffSection() {
  try {
    const data = await api.get('/api/admin/staff');
    adminStaffList = Array.isArray(data) ? data : [];
  } catch {
    adminStaffList = [];
  }

  const tbody = document.getElementById('staffTbody');
  if (!tbody) return;

  const filtered = adminStaffList.filter(s => {
    const q = staffSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (s.name && s.name.toLowerCase().includes(q)) ||
           (s.username && s.username.toLowerCase().includes(q)) ||
           (s.role && s.role.toLowerCase().includes(q));
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2.5rem">لا يوجد موظفون مطابقون لبحثك</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const isAdmin = s.role === 'admin';
    const roleBadge = isAdmin
      ? `<span style="background:rgba(201,168,76,0.18);color:var(--gold);border:1px solid var(--gold);padding:0.25rem 0.65rem;border-radius:6px;font-size:0.82rem;font-weight:700;display:inline-flex;align-items:center;gap:0.3rem">👑 مدير عام (صلاحية كاملة)</span>`
      : `<span style="background:rgba(52,152,219,0.18);color:#3498db;border:1px solid #3498db;padding:0.25rem 0.65rem;border-radius:6px;font-size:0.82rem;font-weight:700;display:inline-flex;align-items:center;gap:0.3rem">💼 موظف مبيعات وتوصيل</span>`;

    const statusBadge = s.is_active
      ? `<span style="color:#2ecc71;font-weight:700;font-size:0.88rem;display:inline-flex;align-items:center;gap:0.3rem">● نشط ومفعل</span>`
      : `<span style="color:#e74c3c;font-weight:700;font-size:0.88rem;display:inline-flex;align-items:center;gap:0.3rem">● معطل ⛔</span>`;

    const createdDate = s.created_at ? new Date(s.created_at).toLocaleDateString('ar-DZ') : '—';
    const canDelete = s.id !== 1;

    return `
    <tr id="staff-row-${s.id}">
      <td><strong style="color:var(--gold)">#${s.id}</strong></td>
      <td>
        <div style="display:flex;align-items:center;gap:0.6rem">
          <div style="width:34px;height:34px;border-radius:50%;background:rgba(201,168,76,0.2);color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.9rem">
            ${isAdmin ? '👑' : '👤'}
          </div>
          <div>
            <div style="font-weight:700;color:var(--text-light);font-size:0.95rem">${escHtml(s.name || s.username)}</div>
            ${s.id === 1 ? '<small style="color:var(--gold);font-size:0.75rem">الحساب الرئيسي</small>' : ''}
          </div>
        </div>
      </td>
      <td><code style="background:rgba(255,255,255,0.06);padding:0.2rem 0.5rem;border-radius:4px;color:var(--text-light)">${escHtml(s.username)}</code></td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td style="color:var(--text-muted);font-size:0.85rem">${createdDate}</td>
      <td>
        <div class="action-btns" style="display:flex;gap:0.4rem">
          <button class="btn-edit" onclick="editStaff(${s.id})" title="تعديل بيانات الموظف والصلاحية">✏️</button>
          ${canDelete ? `<button class="btn-del" onclick="deleteStaff(${s.id}, '${escHtml(s.name || s.username)}')" title="حذف الموظف">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openStaffDrawer(staff = null) {
  const drawer = document.getElementById('staffDrawer');
  const overlay = document.getElementById('staffDrawerOverlay');
  const title = document.getElementById('staffDrawerTitle');
  const editId = document.getElementById('staffEditId');
  const nameIn = document.getElementById('staffNameInput');
  const userIn = document.getElementById('staffUsernameInput');
  const roleIn = document.getElementById('staffRoleInput');
  const passIn = document.getElementById('staffPasswordInput');
  const passLbl = document.getElementById('staffPasswordLabel');
  const passHint = document.getElementById('staffPasswordHint');
  const activeIn = document.getElementById('staffActiveInput');

  if (staff) {
    title.textContent = `تعديل بيانات الموظف: ${staff.name || staff.username}`;
    editId.value = staff.id;
    nameIn.value = staff.name || '';
    userIn.value = staff.username || '';
    userIn.disabled = staff.id === 1; // Cannot change main admin username
    roleIn.value = staff.role || 'staff';
    roleIn.disabled = staff.id === 1; // Cannot demote main admin
    passIn.value = '';
    passLbl.innerHTML = `كلمة المرور الجديدة <span style="font-weight:normal;color:var(--text-muted);font-size:0.8rem">(اختياري)</span>`;
    passHint.style.display = 'block';
    activeIn.checked = staff.is_active !== 0;
  } else {
    title.textContent = 'إضافة موظف جديد';
    editId.value = '';
    nameIn.value = '';
    userIn.value = '';
    userIn.disabled = false;
    roleIn.value = 'staff';
    roleIn.disabled = false;
    passIn.value = '';
    passLbl.innerHTML = `كلمة المرور <span class="req" style="color:var(--danger)">*</span>`;
    passHint.style.display = 'none';
    activeIn.checked = true;
  }

  drawer?.classList.add('open');
  overlay?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeStaffDrawer() {
  document.getElementById('staffDrawer')?.classList.remove('open');
  document.getElementById('staffDrawerOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}

window.editStaff = function(id) {
  const staff = adminStaffList.find(s => s.id === id);
  if (staff) openStaffDrawer(staff);
};

window.deleteStaff = function(id, name) {
  confirmDialog(`هل أنت متأكد من رغبتك في حذف الموظف (${name}) نهائياً؟`, async () => {
    try {
      await api.del(`/api/admin/staff/${id}`);
      toast('تم حذف الموظف بنجاح');
      await renderStaffSection();
    } catch (err) {
      toast('تعذّر حذف الموظف: ' + (err.message || ''), 'error');
    }
  });
};

function initStaffSection() {
  document.getElementById('addStaffBtn')?.addEventListener('click', () => openStaffDrawer(null));
  document.getElementById('staffDrawerClose')?.addEventListener('click', closeStaffDrawer);
  document.getElementById('staffDrawerOverlay')?.addEventListener('click', closeStaffDrawer);
  document.getElementById('staffDrawerCancel')?.addEventListener('click', closeStaffDrawer);

  document.getElementById('staffSearch')?.addEventListener('input', e => {
    staffSearchQuery = e.target.value;
    renderStaffSection();
  });

  document.getElementById('btnSaveStaff')?.addEventListener('click', async () => {
    const editId = document.getElementById('staffEditId')?.value;
    const name = document.getElementById('staffNameInput')?.value.trim();
    const username = document.getElementById('staffUsernameInput')?.value.trim();
    const role = document.getElementById('staffRoleInput')?.value;
    const password = document.getElementById('staffPasswordInput')?.value.trim();
    const is_active = document.getElementById('staffActiveInput')?.checked ? 1 : 0;

    if (!name) { toast('يرجى كتابة الاسم الكامل للموظف', 'error'); return; }
    if (!username) { toast('يرجى كتابة اسم المستخدم', 'error'); return; }
    if (!editId && (!password || password.length < 4)) {
      toast('يرجى كتابة كلمة مرور للموظف (4 أحرف فأكثر)', 'error');
      return;
    }
    if (editId && password && password.length < 4) {
      toast('كلمة المرور يجب أن لا تقل عن 4 أحرف', 'error');
      return;
    }

    const payload = { name, username, role, is_active };
    if (password) payload.password = password;

    const btn = document.getElementById('btnSaveStaff');
    btn.disabled = true;
    btn.textContent = 'جارٍ الحفظ...';

    try {
      if (editId) {
        await api.put(`/api/admin/staff/${editId}`, payload);
        toast('تم تحديث بيانات الموظف بنجاح');
      } else {
        await api.post('/api/admin/staff', payload);
        toast('تمت إضافة الموظف الجديد بنجاح');
      }
      closeStaffDrawer();
      await renderStaffSection();
    } catch (err) {
      toast('تعذّر حفظ الموظف: ' + (err.message || ''), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'حفظ الموظف';
    }
  });
}

// ─── SECTION: MANUSCRIPTS (طلبات النشر والمخطوطات) ───────────────────────────
let adminManuscripts = [];
let manuFilterStatus = 'all';
let manuSearchQuery = '';

async function renderManuscriptsSection() {
  const tbody = document.getElementById('manuscriptsTbody');
  if (!tbody) return;

  try {
    const stats = await api.get('/api/manuscripts/stats');
    if (stats) {
      const el = id => document.getElementById(id);
      if (el('dashManuTotal')) el('dashManuTotal').textContent = stats.total || 0;
      if (el('dashManuPending')) el('dashManuPending').textContent = stats.pending || 0;
      if (el('dashManuReview')) el('dashManuReview').textContent = stats.under_review || 0;
      if (el('dashManuAccepted')) el('dashManuAccepted').textContent = stats.accepted || 0;
    }
  } catch { /* silent */ }

  try {
    const data = await api.get('/api/manuscripts');
    adminManuscripts = Array.isArray(data) ? data : [];
  } catch {
    adminManuscripts = [];
  }

  const filtered = adminManuscripts.filter(m => {
    const matchStatus = (manuFilterStatus === 'all') || (m.status === manuFilterStatus);
    const q = manuSearchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      (m.author_name && m.author_name.toLowerCase().includes(q)) ||
      (m.author_phone && m.author_phone.includes(q)) ||
      (m.book_title && m.book_title.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q)) ||
      String(m.id).includes(q);
    return matchStatus && matchSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2.5rem">لا توجد طلبات نشر مطابقة</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const dateStr = m.created_at ? new Date(m.created_at).toLocaleDateString('ar-DZ') : '—';
    const cleanPhone = (m.author_phone || '').replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.startsWith('0') ? '213' + cleanPhone.slice(1) : (cleanPhone.startsWith('213') ? cleanPhone : '213' + cleanPhone);

    const statusBadgeMap = {
      pending: '<span class="status-badge" style="background:#e67e22;color:#fff">⏳ جديد (قيد المعاينة)</span>',
      under_review: '<span class="status-badge" style="background:#3498db;color:#fff">🔍 قيد التحكيم</span>',
      accepted: '<span class="status-badge" style="background:#2ecc71;color:#fff">✅ مقبول للنشر</span>',
      rejected: '<span class="status-badge" style="background:#e74c3c;color:#fff">❌ غير مناسب</span>'
    };

    const fileBtn = m.file_url
      ? `<a href="${resolveMediaUrl(m.file_url)}" target="_blank" rel="noopener" class="btn-save" style="font-size:0.75rem;padding:0.25rem 0.5rem;background:#1B6CA8;text-decoration:none;display:inline-flex;align-items:center;gap:0.2rem">📥 تحميل الملف</a>`
      : '<span style="color:var(--text-muted);font-size:0.75rem">لا يوجد ملف</span>';

    return `
    <tr>
      <td><strong style="color:var(--gold)">#${m.id}</strong></td>
      <td style="font-size:0.85rem">${dateStr}</td>
      <td>
        <div style="font-weight:bold;color:var(--text-light)">${escHtml(m.author_name)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(m.wilaya || '—')}</div>
        <div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.25rem;flex-wrap:wrap">
          <a href="tel:${escHtml(m.author_phone)}" style="color:var(--gold);font-size:0.82rem;text-decoration:none">📞 ${escHtml(m.author_phone)}</a>
          <a href="https://wa.me/${waPhone}?text=${encodeURIComponent(`مرحباً أستاذ ${m.author_name}، بخصوص طلب نشر مخطوطتك (${m.book_title}) لدى دار علي بن زيد للنشر:`)}" target="_blank" rel="noopener" style="background:#25D366;color:#fff;border-radius:4px;padding:2px 6px;font-size:0.75rem;text-decoration:none">واتساب</a>
          <button class="btn-edit" style="background:#27ae60;border-color:#27ae60;color:#fff;font-size:0.72rem;padding:2px 6px" onclick="openEmailForManuscript(${m.id})" title="إرسال بريد رسمي للمؤلف">✉️ بريد</button>
        </div>
      </td>
      <td>
        <div style="font-weight:bold;color:var(--gold)">${escHtml(m.book_title)}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">مجال: ${escHtml(m.category || 'عام')}</div>
      </td>
      <td>
        <div style="font-size:0.82rem;max-width:240px;line-height:1.4;margin-bottom:0.4rem;color:var(--text-light)">${escHtml(m.summary || 'بدون ملخص')}</div>
        ${fileBtn}
      </td>
      <td>${statusBadgeMap[m.status] || m.status}</td>
      <td>
        <div class="action-btns" style="display:flex;gap:0.4rem">
          <button class="btn-edit" onclick="openManuscriptDrawer(${m.id})" title="مراجعة المخطوطة وتحديث الحالة">✏️ مراجعة</button>
          <button class="btn-del" onclick="deleteManuscript(${m.id})" title="حذف الطلب">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

window.openManuscriptDrawer = function(id) {
  const m = adminManuscripts.find(x => x.id === id);
  if (!m) return;

  document.getElementById('manuEditId').value = m.id;
  document.getElementById('manuStatusSelect').value = m.status || 'pending';
  document.getElementById('manuAdminNotes').value = m.admin_notes || '';

  const prev = document.getElementById('manuDetailsPreview');
  if (prev) {
    prev.innerHTML = `
      <div style="margin-bottom:0.4rem"><strong style="color:var(--gold)">عنوان العمل:</strong> ${escHtml(m.book_title)}</div>
      <div style="margin-bottom:0.4rem"><strong>المؤلف:</strong> ${escHtml(m.author_name)} (${escHtml(m.author_phone)}) ${m.author_email ? `| 📧 ${escHtml(m.author_email)}` : ''}</div>
      <div style="margin-bottom:0.4rem"><strong>التصنيف:</strong> ${escHtml(m.category || 'عام')} | <strong>الولاية:</strong> ${escHtml(m.wilaya || '—')}</div>
      ${m.summary ? `<div style="margin-top:0.4rem;color:var(--text-muted);font-size:0.85rem"><strong>الملخص:</strong> ${escHtml(m.summary)}</div>` : ''}
      <div style="margin-top:0.8rem;padding-top:0.6rem;border-top:1px dashed rgba(255,255,255,0.1)">
        <button type="button" class="btn-save" style="background:#27ae60;border-color:#27ae60;font-size:0.85rem;padding:0.45rem 1rem;display:inline-flex;align-items:center;gap:0.4rem" onclick="openEmailForManuscript(${m.id})">✉️ مراسلة المؤلف عبر البريد الرسمي للدار</button>
      </div>
    `;
  }

  document.getElementById('manuDrawer').classList.add('open');
  document.getElementById('manuDrawerOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
};

function closeManuscriptDrawer() {
  document.getElementById('manuDrawer')?.classList.remove('open');
  document.getElementById('manuDrawerOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

window.deleteManuscript = function(id) {
  confirmDialog('هل أنت متأكد من حذف طلب النشر هذا نهائياً؟', async () => {
    try {
      await api.del(`/api/manuscripts/${id}`);
      toast('تم حذف طلب النشر بنجاح');
      await renderManuscriptsSection();
      await updateUnreadBadge();
    } catch {
      toast('تعذّر حذف طلب النشر', 'error');
    }
  });
};

function initManuscriptsSection() {
  document.querySelectorAll('#sec-manuscripts .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sec-manuscripts .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      manuFilterStatus = btn.dataset.manuStatus || 'all';
      renderManuscriptsSection();
    });
  });

  document.getElementById('manuSearch')?.addEventListener('input', e => {
    manuSearchQuery = e.target.value;
    renderManuscriptsSection();
  });

  document.getElementById('manuDrawerClose')?.addEventListener('click', closeManuscriptDrawer);
  document.getElementById('manuDrawerCancel')?.addEventListener('click', closeManuscriptDrawer);
  document.getElementById('manuDrawerOverlay')?.addEventListener('click', closeManuscriptDrawer);

  document.getElementById('btnSaveManuStatus')?.addEventListener('click', async () => {
    const id = document.getElementById('manuEditId')?.value;
    const status = document.getElementById('manuStatusSelect')?.value;
    const admin_notes = document.getElementById('manuAdminNotes')?.value.trim();

    if (!id) return;
    const btn = document.getElementById('btnSaveManuStatus');
    btn.disabled = true;
    btn.textContent = 'جارٍ الحفظ...';

    try {
      await api.put(`/api/manuscripts/${id}/status`, { status, admin_notes });
      toast('تم تحديث حالة المخطوطة والملاحظات بنجاح ✅');
      closeManuscriptDrawer();
      await renderManuscriptsSection();
      await updateUnreadBadge();
    } catch (err) {
      toast('تعذّر حفظ التحديث: ' + (err.message || ''), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 حفظ التحديث';
    }
  });
}

// ─── SECTION: INBOX (بريد الدار الوارد) ───────────────────────────────────────
let adminInboxEmails = [];
let inboxFilterStatus = 'all';
let inboxSearchQuery = '';
let selectedInboxIds = new Set();

function updateInboxBulkBar() {
  const bar = document.getElementById('inboxBulkBar');
  const countEl = document.getElementById('inboxSelectedCount');
  const selectAll = document.getElementById('inboxSelectAll');
  if (!bar || !countEl) return;

  const count = selectedInboxIds.size;
  countEl.textContent = count;
  bar.style.display = count > 0 ? 'flex' : 'none';

  if (selectAll) {
    const visibleCheckboxes = document.querySelectorAll('.inbox-row-cb');
    if (visibleCheckboxes.length > 0) {
      selectAll.checked = Array.from(visibleCheckboxes).every(cb => cb.checked);
    } else {
      selectAll.checked = false;
    }
  }
}

async function renderInboxSection() {
  const tbody = document.getElementById('inboxTbody');
  if (!tbody) return;

  try {
    const params = new URLSearchParams();
    if (inboxFilterStatus && inboxFilterStatus !== 'all') params.set('filter', inboxFilterStatus);
    if (inboxSearchQuery) params.set('search', inboxSearchQuery);

    const [emails, stats] = await Promise.all([
      api.get(`/api/inbox?${params.toString()}`).catch(() => []),
      api.get('/api/inbox/stats').catch(() => null)
    ]);

    adminInboxEmails = Array.isArray(emails) ? emails : [];

    // Update stats cards
    if (stats) {
      const elTot = document.getElementById('dashInboxTotal');
      const elUnr = document.getElementById('dashInboxUnread');
      const elSta = document.getElementById('dashInboxStarred');
      if (elTot) elTot.textContent = stats.total || 0;
      if (elUnr) elUnr.textContent = stats.unread || 0;
      if (elSta) elSta.textContent = stats.starred || 0;
    }
  } catch {
    adminInboxEmails = [];
  }

  await updateUnreadBadge();

  if (!adminInboxEmails.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:3rem">
      <div style="font-size:2rem;margin-bottom:0.5rem">📭</div>
      <div>لا توجد رسائل واردة مطابقة</div>
      <div style="font-size:0.8rem;margin-top:0.4rem;color:var(--text-muted)">اضغط على زر "جلب وتحديث الرسائل" لفحص البريد من الخادم</div>
    </td></tr>`;
    updateInboxBulkBar();
    return;
  }

  tbody.innerHTML = adminInboxEmails.map(em => {
    const isUnread = (em.is_read === 0 || em.is_read === false);
    const isStarred = (em.is_starred === 1 || em.is_starred === true);
    const isChecked = selectedInboxIds.has(em.id);
    const dateStr = em.date ? new Date(em.date).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const initial = (em.from_name || em.from_email || 'U').charAt(0).toUpperCase();
    const snippet = (em.body_text || '').replace(/\s+/g, ' ').slice(0, 75);

    return `
    <tr class="inbox-row ${isUnread ? 'unread-row' : ''}" style="${isChecked ? 'background:rgba(201,168,76,0.08);' : (isUnread ? 'background:rgba(52,152,219,0.06);font-weight:600' : '')}">
      <td style="text-align:center">
        <input type="checkbox" class="inbox-row-cb" data-id="${em.id}" ${isChecked ? 'checked' : ''} onchange="toggleInboxSelection(${em.id}, this.checked)" />
      </td>
      <td style="text-align:center">
        <button onclick="toggleInboxStar(${em.id}, ${isStarred ? 1 : 0})" style="background:none;border:none;cursor:pointer;font-size:1.2rem;color:${isStarred ? '#f1c40f' : 'rgba(255,255,255,0.2)'}" title="${isStarred ? 'إزالة النجمة' : 'تمييز بنجمة'}">
          ${isStarred ? '★' : '☆'}
        </button>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:0.6rem">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--gold);color:var(--navy);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.88rem;flex-shrink:0">
            ${initial}
          </div>
          <div>
            <div style="color:var(--text-light);font-size:0.92rem">${escHtml(em.from_name || em.from_email)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);direction:ltr;text-align:right">&lt;${escHtml(em.from_email)}&gt;</div>
          </div>
        </div>
      </td>
      <td style="cursor:pointer" onclick="openInboxReader(${em.id})">
        <div style="color:${isUnread ? 'var(--gold)' : 'var(--text-light)'};font-size:0.92rem;margin-bottom:0.2rem">
          ${isUnread ? '📩 ' : ''}${escHtml(em.subject || '(بدون موضوع)')}
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${escHtml(snippet || '—')}
        </div>
      </td>
      <td style="font-size:0.82rem;color:var(--text-muted);white-space:nowrap">${dateStr}</td>
      <td>
        <span class="status-badge" style="background:${isUnread ? '#3498db' : 'rgba(255,255,255,0.08)'};color:${isUnread ? '#fff' : 'var(--text-muted)'}">
          ${isUnread ? 'غير مقروء 📩' : 'مقروء ✓'}
        </span>
      </td>
      <td>
        <div class="action-btns" style="display:flex;gap:0.35rem">
          <button class="btn-edit" onclick="openInboxReader(${em.id})" title="قراءة الرسالة">👁️ قراءة</button>
          <button class="btn-save" style="background:#27ae60;border-color:#27ae60;padding:0.3rem 0.6rem;font-size:0.8rem" onclick="openEmailForInboxReply(${em.id})" title="رد فوري">↩️ رد</button>
          <button class="btn-del" onclick="deleteInboxEmail(${em.id})" title="حذف الرسالة">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  updateInboxBulkBar();
}

window.toggleInboxSelection = function(id, checked) {
  if (checked) {
    selectedInboxIds.add(id);
  } else {
    selectedInboxIds.delete(id);
  }
  updateInboxBulkBar();
};

window.openInboxReader = async function(id) {
  try {
    const em = await api.get(`/api/inbox/${id}`);
    if (!em) return;

    document.getElementById('inboxActiveEmailId').value = em.id;
    document.getElementById('inboxDrawerSubject').textContent = em.subject || 'قراءة الرسالة';
    document.getElementById('inboxDetailSubject').textContent = em.subject || '(بدون موضوع)';
    document.getElementById('inboxDetailFromName').textContent = em.from_name || em.from_email;
    document.getElementById('inboxDetailFromEmail').textContent = em.from_email;
    document.getElementById('inboxDetailToEmail').textContent = em.to_email || 'info@daralibenzid.dz';
    document.getElementById('inboxDetailDate').textContent = em.date ? new Date(em.date).toLocaleString('ar-DZ') : '';

    const bodyEl = document.getElementById('inboxDetailBody');
    if (bodyEl) {
      if (em.body_html && em.body_html.trim().length > 0) {
        bodyEl.innerHTML = em.body_html;
      } else {
        bodyEl.innerHTML = `<pre style="font-family:inherit;white-space:pre-wrap;margin:0">${escHtml(em.body_text || '')}</pre>`;
      }
    }

    const isRead = (em.is_read === 1 || em.is_read === true);
    const toggleBtn = document.getElementById('btnInboxToggleRead');
    if (toggleBtn) toggleBtn.textContent = isRead ? '✉️ تحديد كغير مقروء' : '✓ تحديد كمقروء';

    document.getElementById('inboxDrawer').classList.add('open');
    document.getElementById('inboxDrawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';

    renderInboxSection();
  } catch (err) {
    toast('تعذّر فتح تفاصيل الرسالة: ' + (err.message || ''), 'error');
  }
};

window.openEmailForInboxReply = function(id) {
  const em = adminInboxEmails.find(x => x.id === id);
  if (!em) return;
  const replySubject = em.subject?.startsWith('Re:') || em.subject?.startsWith('رد:') ? em.subject : `Re: ${em.subject || ''}`;
  window.openEmailComposer({
    recipientName: em.from_name || '',
    recipientEmail: em.from_email || '',
    subject: replySubject,
    referenceType: 'inbox',
    referenceId: em.id,
    referenceTitle: em.subject || '',
    defaultTemplate: 'msg_ack'
  });
};

window.toggleInboxStar = async function(id, currentStar) {
  try {
    const newVal = currentStar ? 0 : 1;
    await api.patch(`/api/inbox/${id}/star`, { is_starred: newVal });
    await renderInboxSection();
  } catch {
    toast('تعذّر تحديث تمييز الرسالة', 'error');
  }
};

window.toggleInboxRead = async function(id, currentRead) {
  try {
    const newVal = currentRead ? 0 : 1;
    await api.patch(`/api/inbox/${id}/read`, { is_read: newVal });
    await renderInboxSection();
    await updateUnreadBadge();
  } catch {
    toast('تعذّر تحديث حالة القراءة', 'error');
  }
};

window.deleteInboxEmail = function(id) {
  confirmDialog('هل أنت متأكد من حذف هذه الرسالة نهائياً؟', async () => {
    try {
      await api.del(`/api/inbox/${id}`);
      toast('تم حذف الرسالة بنجاح');
      closeInboxDrawer();
      selectedInboxIds.delete(id);
      await renderInboxSection();
      await updateUnreadBadge();
    } catch {
      toast('تعذّر حذف الرسالة', 'error');
    }
  });
};

function closeInboxDrawer() {
  document.getElementById('inboxDrawer')?.classList.remove('open');
  document.getElementById('inboxDrawerOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

async function syncInboxEmails() {
  const btn = document.getElementById('btnSyncInbox');
  const icon = document.getElementById('syncInboxIcon');
  const text = document.getElementById('syncInboxText');

  if (btn) btn.disabled = true;
  if (icon) icon.textContent = '⏳';
  if (text) text.textContent = 'جارٍ جلب الرسائل...';

  try {
    const res = await api.post('/api/inbox/sync');
    toast(`🎉 ${res.message}`);
    await renderInboxSection();
    await updateUnreadBadge();
  } catch (err) {
    toast('تعذّر جلب الرسائل: ' + (err.message || 'تأكد من ضبط إعدادات IMAP في قسم الإعدادات'), 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (icon) icon.textContent = '🔄';
    if (text) text.textContent = 'جلب وتحديث الرسائل';
  }
}

function initInboxSection() {
  document.querySelectorAll('#sec-inbox .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sec-inbox .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      inboxFilterStatus = btn.dataset.inboxFilter || 'all';
      selectedInboxIds.clear();
      renderInboxSection();
    });
  });

  document.getElementById('inboxSearchInput')?.addEventListener('input', e => {
    inboxSearchQuery = e.target.value;
    renderInboxSection();
  });

  document.getElementById('inboxSelectAll')?.addEventListener('change', e => {
    const checked = e.target.checked;
    document.querySelectorAll('.inbox-row-cb').forEach(cb => {
      cb.checked = checked;
      const id = Number(cb.dataset.id);
      if (id) {
        if (checked) selectedInboxIds.add(id);
        else selectedInboxIds.delete(id);
      }
    });
    updateInboxBulkBar();
  });

  // Bulk Mark Read
  document.getElementById('btnInboxBulkMarkRead')?.addEventListener('click', async () => {
    if (!selectedInboxIds.size) return;
    try {
      await api.post('/api/inbox/bulk-read', { ids: Array.from(selectedInboxIds), is_read: 1 });
      toast(`تم تحديد ${selectedInboxIds.size} رسالة كمقروءة`);
      selectedInboxIds.clear();
      await renderInboxSection();
    } catch {
      toast('تعذّر تحديث الرسائل', 'error');
    }
  });

  // Bulk Mark Unread
  document.getElementById('btnInboxBulkMarkUnread')?.addEventListener('click', async () => {
    if (!selectedInboxIds.size) return;
    try {
      await api.post('/api/inbox/bulk-read', { ids: Array.from(selectedInboxIds), is_read: 0 });
      toast(`تم تحديد ${selectedInboxIds.size} رسالة كغير مقروءة`);
      selectedInboxIds.clear();
      await renderInboxSection();
    } catch {
      toast('تعذّر تحديث الرسائل', 'error');
    }
  });

  // Bulk Delete Selected
  document.getElementById('btnInboxBulkDelete')?.addEventListener('click', () => {
    if (!selectedInboxIds.size) return;
    confirmDialog(`هل أنت متأكد من حذف ${selectedInboxIds.size} رسالة محددة نهائياً؟`, async () => {
      try {
        await api.post('/api/inbox/bulk-delete', { ids: Array.from(selectedInboxIds) });
        toast('تم حذف الرسائل المحددة بنجاح');
        selectedInboxIds.clear();
        await renderInboxSection();
      } catch {
        toast('تعذّر حذف الرسائل', 'error');
      }
    });
  });

  // Delete All Emails
  document.getElementById('btnInboxDeleteAll')?.addEventListener('click', () => {
    confirmDialog('⚠️ تحذير: هل أنت متأكد تماماً من حذف جميع الرسائل الواردة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.', async () => {
      try {
        await api.post('/api/inbox/bulk-delete', { all: true });
        toast('تم حذف جميع الرسائل بنجاح');
        selectedInboxIds.clear();
        await renderInboxSection();
      } catch {
        toast('تعذّر حذف الرسائل', 'error');
      }
    });
  });

  document.getElementById('btnSyncInbox')?.addEventListener('click', syncInboxEmails);

  document.getElementById('inboxDrawerClose')?.addEventListener('click', closeInboxDrawer);
  document.getElementById('inboxDrawerOverlay')?.addEventListener('click', closeInboxDrawer);

  document.getElementById('btnInboxReply')?.addEventListener('click', () => {
    const id = Number(document.getElementById('inboxActiveEmailId')?.value);
    if (id) {
      closeInboxDrawer();
      openEmailForInboxReply(id);
    }
  });

  document.getElementById('btnInboxToggleRead')?.addEventListener('click', async () => {
    const id = Number(document.getElementById('inboxActiveEmailId')?.value);
    if (id) {
      await toggleInboxRead(id, 1);
      closeInboxDrawer();
    }
  });

  document.getElementById('btnInboxDelete')?.addEventListener('click', () => {
    const id = Number(document.getElementById('inboxActiveEmailId')?.value);
    if (id) deleteInboxEmail(id);
  });
}

// ─── SECTION: REVIEWS (تقييمات ومراجعات الكتب) ──────────────────────────────
let adminReviews = [];
let reviewFilterStatus = 'all';
let reviewSearchQuery = '';

async function renderReviewsSection() {
  const tbody = document.getElementById('reviewsTbody');
  if (!tbody) return;

  try {
    const data = await api.get('/api/admin/reviews');
    adminReviews = Array.isArray(data) ? data : [];
  } catch {
    adminReviews = [];
  }

  const filtered = adminReviews.filter(r => {
    let matchStatus = true;
    if (reviewFilterStatus === 'pending') matchStatus = (r.is_approved === 0 || r.is_approved === false);
    if (reviewFilterStatus === 'approved') matchStatus = (r.is_approved === 1 || r.is_approved === true);

    const q = reviewSearchQuery.toLowerCase().trim();
    const matchSearch = !q ||
      (r.reviewer_name && r.reviewer_name.toLowerCase().includes(q)) ||
      (r.book_title && r.book_title.toLowerCase().includes(q)) ||
      (r.comment && r.comment.toLowerCase().includes(q));

    return matchStatus && matchSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2.5rem">لا توجد مراجعات مطابقة</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('ar-DZ') : '—';
    const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
    const isApproved = (r.is_approved === 1 || r.is_approved === true);

    return `
    <tr>
      <td><strong style="color:var(--gold)">#${r.id}</strong></td>
      <td style="font-size:0.85rem">${dateStr}</td>
      <td><strong style="color:var(--text-light)">${escHtml(r.book_title || 'كتاب')}</strong></td>
      <td><strong>${escHtml(r.reviewer_name)}</strong></td>
      <td><span style="color:#f1c40f;font-size:1.1rem;letter-spacing:2px">${stars}</span> (${r.rating}/5)</td>
      <td><div style="max-width:280px;font-size:0.88rem;line-height:1.4;color:var(--text-light)">${escHtml(r.comment || '—')}</div></td>
      <td>
        <span class="status-badge ${isApproved ? 'status-published' : 'status-draft'}">
          ${isApproved ? 'منشور بالموقع ✅' : 'بانتظار الموافقة ⏳'}
        </span>
      </td>
      <td>
        <div class="action-btns" style="display:flex;gap:0.4rem">
          <button class="btn-save" onclick="toggleReviewApproval(${r.id}, ${isApproved ? 0 : 1})" style="padding:0.35rem 0.7rem;font-size:0.8rem;background:${isApproved ? '#e67e22' : '#27ae60'};border-color:${isApproved ? '#e67e22' : '#27ae60'}">
            ${isApproved ? 'إلغاء النشر 🚫' : 'موافقة ونشر ✅'}
          </button>
          <button class="btn-del" onclick="deleteReview(${r.id})" title="حذف المراجعة">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

window.toggleReviewApproval = async function(id, newStatus) {
  try {
    await api.put(`/api/admin/reviews/${id}/approve`, { is_approved: newStatus });
    toast(newStatus ? 'تمت الموافقة ونشر المراجعة على الكتاب بنجاح ✅' : 'تم إلغاء نشر المراجعة');
    await renderReviewsSection();
    await updateUnreadBadge();
  } catch (err) {
    toast('تعذّر تعديل حالة المراجعة: ' + (err.message || ''), 'error');
  }
};

window.deleteReview = function(id) {
  confirmDialog('هل أنت متأكد من حذف هذه المراجعة نهائياً؟', async () => {
    try {
      await api.del(`/api/admin/reviews/${id}`);
      toast('تم حذف المراجعة بنجاح');
      await renderReviewsSection();
      await updateUnreadBadge();
    } catch {
      toast('تعذّر حذف المراجعة', 'error');
    }
  });
};

function initReviewsSection() {
  document.querySelectorAll('#sec-reviews .filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sec-reviews .filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      reviewFilterStatus = btn.dataset.reviewStatus || 'all';
      renderReviewsSection();
    });
  });

  document.getElementById('reviewsSearch')?.addEventListener('input', e => {
    reviewSearchQuery = e.target.value;
    renderReviewsSection();
  });
}

// ─── AUDIO CHIME & LIVE POLLING ENGINE ───────────────────────────────────────
let soundEnabled = localStorage.getItem('dar_admin_sound') !== '0';
let lastKnownPendingOrders = -1;

function initSoundToggle() {
  const btn = document.getElementById('btnSoundToggle');
  const icon = document.getElementById('soundIcon');
  const text = document.getElementById('soundText');

  function updateSoundBtn() {
    if (icon) icon.textContent = soundEnabled ? '🔔' : '🔕';
    if (text) text.textContent = soundEnabled ? 'صوت التنبيه: مفعّل' : 'صوت التنبيه: مكتوم';
    if (btn) {
      btn.style.color = soundEnabled ? 'var(--gold)' : 'var(--text-muted)';
      btn.style.borderColor = soundEnabled ? 'var(--gold)' : 'var(--border)';
    }
  }
  updateSoundBtn();

  btn?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('dar_admin_sound', soundEnabled ? '1' : '0');
    updateSoundBtn();
    if (soundEnabled) {
      playNewOrderChime();
      toast('تم تفعيل صوت التنبيه للطلبات الجديدة 🔔');
    } else {
      toast('تم كتم صوت التنبيه 🔕');
    }
  });
}

function playNewOrderChime() {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };

    // Golden two-tone notification chime (F5 -> A5)
    playTone(698.46, 0, 0.25);
    playTone(880.00, 0.15, 0.45);
  } catch { /* AudioContext blocked or unsupported */ }
}

function startLivePolling() {
  setInterval(async () => {
    if (sessionStorage.getItem('dar_admin_session') !== 'true') return;
    try {
      const stats = await api.get('/api/orders/stats');
      const pending = Number(stats?.pending || 0);

      if (lastKnownPendingOrders !== -1 && pending > lastKnownPendingOrders) {
        playNewOrderChime();
        toast(`🔔 وصل طلب كتاب جديد! (${pending} بانتظار التأكيد)`);
        if (currentSection === 'orders') renderOrdersSection();
        if (currentSection === 'dashboard') renderDashboard();
      }
      lastKnownPendingOrders = pending;
      updateUnreadBadge();
    } catch { /* silent */ }
  }, 20000); // Check every 20 seconds
}

// ─── EMAIL COMPOSER CONTROLLER & TEMPLATES ─────────────────────────────────────
const EMAIL_TEMPLATES = {
  msg_ack: {
    subject: (name, ref) => `رد بخصوص: ${ref || 'استفساركم'} — دار علي بن زيد للطباعة والنشر`,
    body: (name, ref) => `السلام عليكم ورحمة الله وبركاته،\nالأستاذ(ة) الفاضل(ة) ${name || ''}،\n\nنشكركم على تواصلكم مع دار علي بن زيد للطباعة والنشر.\n\nنود إفادتكم بأننا تلقينا رسالتكم الكريمة بخصوص (${ref || 'استفساركم'}) باهتمام، ويسرنا الرد كالتالي:\n\n[اكتب نص الرد والتوضيح هنا...]\n\nنسعد دوماً بخدمتكم ويسرنا تواصلكم الدائم معنا.`
  },
  manu_review: {
    subject: (name, ref) => `إشعار استلام مخطوطتكم (${ref || 'طلب النشر'}) وقيد القراءة والتحكيم — دار علي بن زيد`,
    body: (name, ref) => `السلام عليكم ورحمة الله وبركاته،\nالأستاذ(ة) الفاضل(ة) ${name || ''}،\n\nنود إعلامكم بأننا استلمنا طلب نشر مخطوطتكم الكريمة المعنونة بـ (${ref || 'المخطوطة'}) باهتمام بالغ.\n\nتم إحالة الملف إلى اللجنة العلمية ولجنة القراءة والتحكيم بالدار لفحصه ودراسة إمكانية إدراجه ضمن خطة النشر والطباعة للموسم القادم.\n\nسنوافيكم بالتقرير والرد النهائي في أقرب الآجال فور استكمال تقرير القراءة.\n\nشاكرين لكم ثقتكم واختياركم لدار علي بن زيد للنشر والتوزيع.`
  },
  manu_accept: {
    subject: (name, ref) => `تهانينا! الموافقة المبدئية على نشر مخطوطتكم (${ref || 'المخطوطة'}) — دار علي بن زيد`,
    body: (name, ref) => `السلام عليكم ورحمة الله وبركاته،\nالأستاذ(ة) الفاضل(ة) ${name || ''}،\n\nيسر إدارة دار علي بن زيد للطباعة والنشر إبلاغكم بصدور الموافقة المبدئية على نشر وطباعة مخطوطتكم القيمة المعنونة بـ (${ref || 'المخطوطة'})، وذلك بعد التقييم الإيجابي من قبل لجنة القراءة والتحكيم وإشادتها بالقيمة المعرفية للعمل.\n\nيرجى تزويدنا بالنسخة الكاملة بصيغة Word لمباشرة إجراءات التدقيق اللغوي، التنسيق والإخراج الفني، وتصميم الغلاف.\n\nيسعدنا جداً التعاون معكم لتقديم هذا الإصدار المتميز للقراء.`
  },
  manu_contract: {
    subject: (name, ref) => `دعوة لتوقيع عقد النشر والتوزيع لمخطوطة (${ref || 'المخطوطة'}) — دار علي بن زيد`,
    body: (name, ref) => `السلام عليكم ورحمة الله وبركاته،\nالأستاذ(ة) الفاضل(ة) ${name || ''}،\n\nتتويجاً للاتفاق والتنسيق بخصوص نشر عملكم الكريم (${ref || 'المخطوطة'})، يسرنا دعوتكم لجلسة عمل وتوقيع عقد النشر والتوزيع وضبط الخطة الزمنية للمراحل الفنية والتسويقية.\n\nيرجى التواصل معنا لتحديد الموعد والمكان الأنسب لكم، أو إتمام التوقيع الإلكتروني إن كنتم خارج الولاية.\n\nأهلاً ومرحباً بكم في أسرة مؤلفي دار علي بن زيد.`
  },
  manu_revisions: {
    subject: (name, ref) => `ملاحظات وتعديلات مقترحة على مخطوطة (${ref || 'المخطوطة'}) — دار علي بن زيد`,
    body: (name, ref) => `السلام عليكم ورحمة الله وبركاته،\nالأستاذ(ة) الفاضل(ة) ${name || ''}،\n\nبعد دراسة مخطوطتكم الكريمة (${ref || 'المخطوطة'}) من طرف لجنة القراءة، نود إحاطتكم ببعض الملاحظات والتعديلات المقترحة لتطوير العمل وتجهيزه بأفضل صورة للنشر:\n\n[اكتب الملاحظات والتعديلات المطلوبة هنا...]\n\nيرجى إرسال النسخة بعد التعديل لمواصلة إجراءات النشر.`
  },
  manu_reject: {
    subject: (name, ref) => `بخصوص طلب نشر مخطوطة (${ref || 'المخطوطة'}) — دار علي بن زيد للطباعة والنشر`,
    body: (name, ref) => `السلام عليكم ورحمة الله وبركاته،\nالأستاذ(ة) الفاضل(ة) ${name || ''}،\n\nنشكركم جزيل الشكر على ثقتكم الغالية واختياركم لدار علي بن زيد لعرض مخطوطتكم الكريمة (${ref || 'المخطوطة'}).\n\nنأسف لإبلاغكم بأنه يتعذر علينا إدراج هذا العمل ضمن خطة النشر للموسم الحالي نظراً لاكتمال الحصة المقررة لهذا المجال.\n\nنتمنى لكم دوام التوفيق والنجاح في مسيرتكم العلمية والإبداعية، ويسرنا الاطلاع على أعمالكم القادمة مستقبلاً.`
  }
};

window.openEmailForManuscript = function(id) {
  const m = adminManuscripts.find(x => x.id === id);
  if (!m) return;
  window.openEmailComposer({
    recipientName: m.author_name || '',
    recipientEmail: m.author_email || '',
    subject: `بخصوص طلب نشر مخطوطتكم (${m.book_title || 'المخطوطة'}) — دار علي بن زيد`,
    referenceType: 'manuscript',
    referenceId: m.id,
    referenceTitle: m.book_title || '',
    defaultTemplate: 'manu_review'
  });
};

window.openEmailForMessage = function(id) {
  const msg = adminMessages.find(x => x.id === id);
  if (!msg) return;
  window.openEmailComposer({
    recipientName: msg.name || '',
    recipientEmail: msg.email || '',
    subject: `رد بخصوص: ${msg.subject || 'استفساركم'} — دار علي بن زيد`,
    referenceType: 'message',
    referenceId: msg.id,
    referenceTitle: msg.subject || '',
    defaultTemplate: 'msg_ack'
  });
};

window.openEmailComposer = function({
  recipientName = '',
  recipientEmail = '',
  subject = '',
  referenceType = '',
  referenceId = '',
  referenceTitle = '',
  defaultTemplate = ''
}) {
  const modal = document.getElementById('emailComposeModal');
  if (!modal) return;

  if (document.getElementById('emailRecipientName')) document.getElementById('emailRecipientName').value = recipientName;
  if (document.getElementById('emailRecipientAddress')) document.getElementById('emailRecipientAddress').value = recipientEmail;
  if (document.getElementById('emailRefType')) document.getElementById('emailRefType').value = referenceType;
  if (document.getElementById('emailRefId')) document.getElementById('emailRefId').value = referenceId;

  const refBox = document.getElementById('emailReferenceBox');
  const refTxt = document.getElementById('emailReferenceText');
  if (referenceTitle) {
    if (refTxt) refTxt.textContent = referenceTitle;
    if (refBox) refBox.style.display = 'block';
  } else {
    if (refBox) refBox.style.display = 'none';
  }

  const tplSelect = document.getElementById('emailTemplateSelect');
  if (tplSelect) {
    tplSelect.value = defaultTemplate || '';
    if (defaultTemplate && EMAIL_TEMPLATES[defaultTemplate]) {
      const t = EMAIL_TEMPLATES[defaultTemplate];
      if (document.getElementById('emailSubjectInput')) document.getElementById('emailSubjectInput').value = t.subject(recipientName, referenceTitle);
      if (document.getElementById('emailBodyInput')) document.getElementById('emailBodyInput').value = t.body(recipientName, referenceTitle);
    } else {
      if (document.getElementById('emailSubjectInput')) document.getElementById('emailSubjectInput').value = subject;
      if (document.getElementById('emailBodyInput')) document.getElementById('emailBodyInput').value = '';
    }
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
};

function initEmailComposer() {
  const modal = document.getElementById('emailComposeModal');
  const closeModal = () => {
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  document.getElementById('emailModalClose')?.addEventListener('click', closeModal);
  document.getElementById('btnEmailCancel')?.addEventListener('click', closeModal);

  // Template select change
  document.getElementById('emailTemplateSelect')?.addEventListener('change', e => {
    const key = e.target.value;
    if (!key || !EMAIL_TEMPLATES[key]) return;
    const name = document.getElementById('emailRecipientName')?.value.trim();
    const ref = document.getElementById('emailReferenceText')?.textContent || '';
    const t = EMAIL_TEMPLATES[key];
    document.getElementById('emailSubjectInput').value = t.subject(name, ref);
    document.getElementById('emailBodyInput').value = t.body(name, ref);
  });

  // Form submit
  document.getElementById('emailComposeForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const to = document.getElementById('emailRecipientAddress')?.value.trim();
    const to_name = document.getElementById('emailRecipientName')?.value.trim();
    const subject = document.getElementById('emailSubjectInput')?.value.trim();
    const message = document.getElementById('emailBodyInput')?.value.trim();
    const reference_type = document.getElementById('emailRefType')?.value;
    const reference_id = document.getElementById('emailRefId')?.value;
    const reference_title = document.getElementById('emailReferenceText')?.textContent;

    if (!to || !subject || !message) {
      toast('يرجى كتابة البريد المستلم، عنوان الرسالة، ونص الرسالة', 'error');
      return;
    }

    const btn = document.getElementById('btnSendEmailSubmit');
    btn.disabled = true;
    btn.textContent = 'جارٍ إرسال البريد... ✉️';

    try {
      const res = await api.post('/api/email/send', {
        to,
        to_name,
        subject,
        message,
        reference_type,
        reference_id,
        reference_title
      });
      toast(`🎉 ${res.message}`);
      closeModal();
      if (reference_type === 'manuscript') renderManuscriptsSection();
      if (reference_type === 'message') renderMessagesSection();
      if (reference_type === 'inbox') renderInboxSection();
    } catch (err) {
      toast('تعذّر إرسال البريد: ' + (err.message || 'تأكد من ضبط إعدادات SMTP'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 إرسال البريد الإلكتروني الآن';
    }
  });
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initSidebar();
  initSoundToggle();
  startLivePolling();
  initOrdersSection();
  initManuscriptsSection();
  initInboxSection();
  initBooksSection();
  initCategoriesSection();
  initReviewsSection();
  initCouponsSection();
  initDeliverySection();
  initStaffSection();
  initAboutSection();
  initMessagesSection();
  initTestimonialsSection();
  initContactSection();
  initSettingsSection();
  initEmailComposer();
});


