import { api } from './api-r.js';

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

function confirmDialog(msg, onConfirm) {
  const overlay   = document.getElementById('confirmOverlay');
  const msgEl     = document.getElementById('confirmMsg');
  const btnOk     = document.getElementById('confirmOk');
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

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function initAuth() {
  const loginPage  = document.getElementById('loginPage');
  const dashboard  = document.getElementById('dashboard');
  const loginForm  = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn  = document.getElementById('logoutBtn');

  function checkSession() {
    const ok = sessionStorage.getItem('dar_admin_session') === 'true';
    loginPage.style.display = ok ? 'none' : 'flex';
    dashboard.style.display = ok ? 'flex'  : 'none';
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const user = loginForm.querySelector('[name="username"]').value.trim();
    const pass = loginForm.querySelector('[name="password"]').value.trim();
    const btn  = loginForm.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const result = await api.post('/api/admin/login', { username: user, password: pass });
      if (result.success) {
        sessionStorage.setItem('dar_admin_session', 'true');
        loginError.classList.remove('show');
        checkSession();
        await renderAllSections();
      } else {
        loginError.textContent = result.message || 'اسم المستخدم أو كلمة المرور غير صحيحة';
        loginError.classList.add('show');
      }
    } catch {
      loginError.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
      loginError.classList.add('show');
    } finally {
      btn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('dar_admin_session');
    checkSession();
  });

  checkSession();
  if (sessionStorage.getItem('dar_admin_session') === 'true') renderAllSections();
}

// ─── SIDEBAR + NAVIGATION ─────────────────────────────────────────────────────
let currentSection = 'dashboard';

function initSidebar() {
  const hamburger = document.getElementById('adminHamburger');
  const sidebar   = document.getElementById('adminSidebar');
  const overlay   = document.getElementById('sidebarOverlay');

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
  currentSection = sec;
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`sec-${sec}`)?.classList.add('active');
  document.querySelector(`[data-section="${sec}"]`)?.classList.add('active');
  const titles = {
    dashboard:'لوحة الإحصاء', books:'إدارة الكتب', categories:'إدارة التصنيفات',
    about:'من نحن', messages:'الرسائل الواردة', testimonials:'الشهادات',
    contact:'معلومات التواصل', settings:'الإعدادات العامة'
  };
  document.getElementById('topbarTitle').textContent = titles[sec] || '';

  if (sec === 'dashboard')    await renderDashboard();
  if (sec === 'books')        await renderBooksSection();
  if (sec === 'categories')   await renderCategoriesSection();
  if (sec === 'about')        await renderAboutSection();
  if (sec === 'messages')     await renderMessagesSection();
  if (sec === 'testimonials') await renderTestimonialsSection();
  if (sec === 'contact')      await renderContactSection();
  if (sec === 'settings')     await renderSettingsSection();
}

async function renderAllSections() {
  await refreshCats();
  await updateUnreadBadge();
  await showSection('dashboard');
}

// ─── UNREAD BADGE ─────────────────────────────────────────────────────────────
async function updateUnreadBadge() {
  try {
    const msgs  = await api.get('/api/messages');
    const count = Array.isArray(msgs) ? msgs.filter(m => !m.is_read).length : 0;
    const badge = document.getElementById('msgBadge');
    if (badge) { badge.textContent = count || ''; badge.style.display = count ? 'inline' : 'none'; }
  } catch { /* silent */ }
}

// ─── SECTION 1: DASHBOARD ─────────────────────────────────────────────────────
async function renderDashboard() {
  const safe = p => p.catch(() => []);
  const [books, msgs, tests] = await Promise.all([
    safe(api.get('/api/books')),
    safe(api.get('/api/messages')),
    safe(api.get('/api/testimonials')),
  ]);
  const unread = Array.isArray(msgs) ? msgs.filter(m => !m.is_read).length : 0;

  const el = id => document.getElementById(id);
  if (el('dashBooks'))  el('dashBooks').textContent  = Array.isArray(books) ? books.length : '—';
  if (el('dashCats'))   el('dashCats').textContent   = adminCats.length;
  if (el('dashUnread')) el('dashUnread').textContent = unread;
  if (el('dashTests'))  el('dashTests').textContent  = Array.isArray(tests) ? tests.length : '—';

  const tbody = document.getElementById('recentMsgsTbody');
  if (tbody && Array.isArray(msgs)) {
    const recent = [...msgs].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0)).slice(0,5);
    tbody.innerHTML = recent.length
      ? recent.map(m => `
        <tr>
          <td class="td-name">${escHtml(m.name)}</td>
          <td>${escHtml(m.subject)}</td>
          <td>${new Date(m.created_at||Date.now()).toLocaleDateString('ar-SA')}</td>
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
  const field = type === 'pdf' ? 'pdf' : 'image';
  const result = await api.upload('/api/upload', file, field);
  return result.url || result.secure_url || result.pdf_url || result.image_url || null;
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
        const cat   = getCat(b.category_id);
        const thumb = b.cover_url
          ? `<img src="${escHtml(b.cover_url)}" alt="غلاف" style="width:36px;height:48px;object-fit:cover;border-radius:4px;display:block">`
          : `<span class="color-swatch" style="background:${cat?.color||'#1B6CA8'}"></span>`;
        const pdfIcon = b.pdf_url ? `<span title="يوجد PDF" style="color:var(--gold);font-size:1rem">📄</span>` : '';
        return `
        <tr>
          <td>${thumb}</td>
          <td class="td-name">${escHtml(b.title)} ${pdfIcon}</td>
          <td>${escHtml(b.author)}</td>
          <td>${escHtml(cat?.name||'—')}</td>
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
      img.src = url; img.style.display = 'block';
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
    if (file.size > 5 * 1024 * 1024) { toast('حجم الصورة كبير جداً (حد أقصى 5MB)', 'error'); e.target.value = ''; return; }
    const uploadStatus = document.getElementById('coverUploadStatus');
    if (uploadStatus) uploadStatus.textContent = 'جارٍ الرفع...';
    try {
      const url = await uploadFileToServer(file, 'image');
      if (url) {
        document.getElementById('coverUrlInput').value = url;
        document.getElementById('coverUrlInput').dispatchEvent(new Event('input'));
        toast('تم رفع الصورة بنجاح');
      } else { throw new Error('no url'); }
    } catch {
      toast('تعذّر رفع الصورة — أدخل رابط الصورة يدوياً', 'error');
    } finally {
      if (uploadStatus) uploadStatus.textContent = 'PNG، JPG، WEBP (سيتم رفعها للخادم)';
      e.target.value = '';
    }
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
      if (statusEl) statusEl.innerHTML = `<span style="font-size:2rem">✅</span><span style="color:var(--gold)">رابط PDF مُدخَل</span><span class="file-hint">${escHtml(url.slice(0,60))}...</span>`;
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
      if (statusEl) statusEl.innerHTML = `<span style="font-size:2rem">📄</span><span>أو اضغط لرفع ملف PDF</span><span class="file-hint">PDF فقط (سيتم رفعه للخادم)</span>`;
      if (removeBtn) removeBtn.style.display = 'none';
    }
  });

  document.getElementById('pdfFileInput')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('حجم PDF كبير جداً (حد أقصى 20MB)', 'error'); e.target.value = ''; return; }
    const statusEl = document.getElementById('pdfStatusEl');
    if (statusEl) statusEl.innerHTML = `<span style="font-size:2rem">⏳</span><span>جارٍ رفع الملف...</span>`;
    try {
      const url = await uploadFileToServer(file, 'pdf');
      if (url) {
        document.getElementById('pdfUrlInput').value = url;
        document.getElementById('pdfUrlInput').dispatchEvent(new Event('input'));
        toast('تم رفع PDF بنجاح');
      } else { throw new Error('no url'); }
    } catch {
      toast('تعذّر رفع PDF — أدخل رابط الملف يدوياً', 'error');
      if (statusEl) statusEl.innerHTML = `<span style="font-size:2rem">📄</span><span>أو اضغط لرفع ملف PDF</span><span class="file-hint">PDF فقط (سيتم رفعه للخادم)</span>`;
    } finally {
      e.target.value = '';
    }
  });

  document.getElementById('removePdfBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('pdfUrlInput').value = '';
    document.getElementById('pdfUrlInput').dispatchEvent(new Event('input'));
    document.getElementById('pdfFileInput').value = '';
  });
}

window.editBook = function(id) {
  const book = adminBooks.find(b => b.id === id);
  if (book) openBookDrawer(book);
};

window.deleteBook = function(id) {
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

  const drawer  = document.getElementById('bookDrawer');
  const overlay = document.getElementById('bookDrawerOverlay');
  document.getElementById('bookDrawerTitle').textContent = book ? 'تعديل الكتاب' : 'إضافة كتاب جديد';

  const catSel = document.getElementById('bookCategory');
  catSel.innerHTML = adminCats.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  const f = document.getElementById('bookForm');
  f.querySelector('[name="title"]').value       = book?.title       || '';
  f.querySelector('[name="author"]').value      = book?.author      || '';
  f.querySelector('[name="year"]').value        = book?.year        || '';
  f.querySelector('[name="pages"]').value       = book?.pages       || '';
  f.querySelector('[name="description"]').value = book?.description || '';
  f.querySelector('[name="color"]').value       = book?.color       || '#1B6CA8';
  catSel.value = book?.category_id || (adminCats[0]?.id || '');
  f.querySelector('[name="status"]').checked = (book?.status !== 'draft');

  const coverUrl = book?.cover_url || '';
  const coverInput = document.getElementById('coverUrlInput');
  if (coverInput) { coverInput.value = coverUrl; coverInput.dispatchEvent(new Event('input')); }

  const pdfUrl = book?.pdf_url || '';
  const pdfInput = document.getElementById('pdfUrlInput');
  if (pdfInput) { pdfInput.value = pdfUrl; pdfInput.dispatchEvent(new Event('input')); }

  document.getElementById('coverFileInput').value = '';
  document.getElementById('pdfFileInput').value   = '';

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
  const f      = e.target;
  const title  = f.querySelector('[name="title"]').value.trim();
  const author = f.querySelector('[name="author"]').value.trim();
  if (!title || !author) { toast('يرجى ملء الحقول المطلوبة (العنوان والمؤلف)', 'error'); return; }

  const cover_url = (document.getElementById('coverUrlInput')?.value || '').trim();
  const pdf_url   = (document.getElementById('pdfUrlInput')?.value   || '').trim();

  const data = {
    title,
    author,
    category_id: parseInt(document.getElementById('bookCategory')?.value) || null,
    year:        parseInt(f.querySelector('[name="year"]').value)   || null,
    pages:       parseInt(f.querySelector('[name="pages"]').value)  || null,
    description: f.querySelector('[name="description"]').value.trim(),
    color:       f.querySelector('[name="color"]').value,
    status:      f.querySelector('[name="status"]').checked ? 'published' : 'draft',
    cover_url:   cover_url || null,
    pdf_url:     pdf_url   || null,
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

  list.innerHTML = adminCats.length
    ? adminCats.map(c => {
        const count = adminBooks.filter(b => String(b.category_id) === String(c.id)).length;
        return `
        <div class="category-item">
          <span class="cat-color-dot" style="background:${c.color}"></span>
          <span class="cat-name">${escHtml(c.name)}</span>
          <span class="cat-count">(${count} كتاب)</span>
          <div class="action-btns">
            <button class="btn-edit" onclick="editCat(${c.id})">✏️</button>
            <button class="btn-del"  onclick="deleteCat(${c.id}, ${count})">🗑️</button>
          </div>
        </div>`;
      }).join('')
    : `<div class="empty-state"><div class="empty-icon">🏷️</div><p>لا توجد تصنيفات</p></div>`;
}

function initCategoriesSection() {
  document.getElementById('addCatBtn')?.addEventListener('click', () => {
    const form = document.getElementById('inlineCatForm');
    showCatForm = !showCatForm;
    form.style.display = showCatForm ? 'block' : 'none';
    if (showCatForm) {
      document.getElementById('catFormName').value  = '';
      document.getElementById('catFormColor').value = '#1B6CA8';
      document.getElementById('catFormId').value    = '';
    }
  });

  document.getElementById('catFormSave')?.addEventListener('click', async () => {
    const name   = document.getElementById('catFormName').value.trim();
    const color  = document.getElementById('catFormColor').value;
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

window.editCat = function(id) {
  const cat = adminCats.find(c => c.id === id);
  if (!cat) return;
  document.getElementById('catFormName').value  = cat.name;
  document.getElementById('catFormColor').value = cat.color;
  document.getElementById('catFormId').value    = cat.id;
  document.getElementById('inlineCatForm').style.display = 'block';
  showCatForm = true;
};

window.deleteCat = function(id, bookCount) {
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
    if (s('aMain'))    s('aMain').value    = about.main_text || about.main || '';
    if (s('aMission')) s('aMission').value = about.mission   || '';
    if (s('aVision'))  s('aVision').value  = about.vision    || '';
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
      <input type="number" placeholder="السنة"   value="${escHtml(String(m.year||''))}"        data-idx="${i}" data-field="year">
      <input type="text"   placeholder="العنوان" value="${escHtml(m.title||'')}"       data-idx="${i}" data-field="title">
      <input type="text"   placeholder="الوصف"   value="${escHtml(m.description||'')}" data-idx="${i}" data-field="description">
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
      mission:   document.getElementById('aMission')?.value.trim(),
      vision:    document.getElementById('aVision')?.value.trim(),
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

window.deleteMilestone = function(idx) {
  const mils = collectMilestones();
  mils.splice(idx, 1);
  renderMilestonesList(mils);
};

// ─── SECTION 5: MESSAGES ──────────────────────────────────────────────────────
let msgFilter = 'all';
let adminMsgs = [];

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

  const filtered =
    msgFilter === 'unread' ? adminMsgs.filter(m => !m.is_read) :
    msgFilter === 'read'   ? adminMsgs.filter(m =>  m.is_read) :
                             adminMsgs;

  const sorted = [...filtered].sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));

  tbody.innerHTML = sorted.length
    ? sorted.map(m => {
        const isRead = m.is_read;
        const dateStr = new Date(m.created_at||Date.now()).toLocaleDateString('ar-SA');
        return `
      <tr class="message-row${isRead ? '' : ' unread'}" data-msg-id="${m.id}">
        <td class="td-name">${escHtml(m.name)}</td>
        <td>${escHtml(m.email)}</td>
        <td>${escHtml(m.subject)}</td>
        <td>${dateStr}</td>
        <td>${isRead ? '<span class="status-badge status-published">مقروء</span>' : '<span class="unread-badge">جديد</span>'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-view" onclick="toggleMsgDetail(${m.id})">عرض</button>
            <button class="btn-del"  onclick="deleteMsg(${m.id})">🗑️</button>
          </div>
        </td>
      </tr>
      <tr class="detail-row" id="detail-${m.id}">
        <td colspan="6">
          <div class="message-detail" id="msg-detail-${m.id}">
            <div class="message-text-box">${escHtml(m.message)}</div>
            <div class="msg-actions">
              ${isRead
                ? `<button class="btn-mark-unread" onclick="markMsg(${m.id}, false)">تحديد كغير مقروء</button>`
                : `<button class="btn-mark-read"   onclick="markMsg(${m.id}, true)">تحديد كمقروء</button>`}
              <button class="btn-del" onclick="deleteMsg(${m.id})">🗑️ حذف</button>
            </div>
          </div>
        </td>
      </tr>`;
      }).join('')
    : `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📬</div><p>لا توجد رسائل</p></div></td></tr>`;

  updateUnreadBadge();
}

function initMessagesSection() {
  document.querySelectorAll('.msg-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.msg-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderMessagesSection(btn.dataset.filter);
    });
  });
}

window.toggleMsgDetail = function(id) {
  const detail = document.getElementById(`msg-detail-${id}`);
  if (!detail) return;
  const isOpen = detail.classList.contains('open');
  document.querySelectorAll('.message-detail.open').forEach(d => d.classList.remove('open'));
  if (!isOpen) {
    detail.classList.add('open');
    const msgObj = adminMsgs.find(m => m.id === id);
    if (msgObj && !msgObj.is_read) {
      msgObj.is_read = true;
      api.patch(`/api/messages/${id}`, { is_read: true }).catch(() => {});
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

window.markMsg = async function(id, read) {
  try {
    await api.patch(`/api/messages/${id}`, { is_read: read });
  } catch { /* silent */ }
  await renderMessagesSection();
};

window.deleteMsg = function(id) {
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

window.editTest = function(id) {
  const t = adminTests.find(t => t.id === id);
  if (t) openTestDrawer(t);
};

window.deleteTest = function(id) {
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
  f.querySelector('[name="name"]').value  = t?.name  || '';
  f.querySelector('[name="role"]').value  = t?.role  || '';
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
  const f     = e.target;
  const name  = f.querySelector('[name="name"]').value.trim();
  const quote = f.querySelector('[name="quote"]').value.trim();
  if (!name || !quote) { toast('يرجى ملء الحقول المطلوبة', 'error'); return; }
  const ratingEl = f.querySelector('[name="rating"]:checked');
  const data = {
    name,
    role:   f.querySelector('[name="role"]').value.trim(),
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
    ['address','phone','phone2','email','hours','facebook','instagram','whatsapp'].forEach(k => {
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
    ['address','phone','phone2','email','hours','facebook','instagram','whatsapp'].forEach(k => {
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
    ['hero_title','hero_subtitle','stat_years','stat_books','stat_readers','copyright'].forEach(k => {
      const el = document.querySelector(`#sec-settings [name="${k}"]`);
      if (el) el.value = s[k] || '';
    });
  } catch { /* silently skip — form stays blank */ }
}

function initSettingsSection() {
  document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
    const data = {};
    ['hero_title','hero_subtitle','stat_years','stat_books','stat_readers','copyright'].forEach(k => {
      const el = document.querySelector(`#sec-settings [name="${k}"]`);
      if (el) data[k] = el.value.trim();
    });
    const btn = document.getElementById('saveSettingsBtn');
    btn.disabled = true;
    try {
      await api.put('/api/settings', data);
      toast('تم حفظ الإعدادات العامة بنجاح');
    } catch {
      toast('تعذّر حفظ الإعدادات', 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('changePassBtn')?.addEventListener('click', async () => {
    const current  = document.getElementById('passCurrent')?.value || '';
    const newPass  = document.getElementById('passNew')?.value     || '';
    const confirm2 = document.getElementById('passConfirm')?.value || '';
    if (!current || !newPass || !confirm2) { toast('يرجى ملء جميع حقول كلمة المرور', 'error'); return; }
    if (newPass !== confirm2)              { toast('كلمتا المرور الجديدتان غير متطابقتين', 'error'); return; }
    if (newPass.length < 4)               { toast('كلمة المرور يجب أن تكون 4 أحرف على الأقل', 'error'); return; }

    const btn = document.getElementById('changePassBtn');
    btn.disabled = true;
    try {
      await api.put('/api/admin/change-password', { currentPassword: current, newPassword: newPass });
      ['passCurrent','passNew','passConfirm'].forEach(id => {
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

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initSidebar();
  initBooksSection();
  initCategoriesSection();
  initAboutSection();
  initMessagesSection();
  initTestimonialsSection();
  initContactSection();
  initSettingsSection();
});
