import { api } from './api-r.js';

// ─── STATE ────────────────────────────────────────────────────────────────────
let allBooks      = [];
let allCategories = [];

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

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const drawer    = document.getElementById('mobileDrawer');
  const overlayBg = document.getElementById('overlayBg');
  const drawerClose = document.getElementById('drawerClose');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
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

// ─── HERO ─────────────────────────────────────────────────────────────────────
function renderHero(s = {}) {
  const h1  = document.getElementById('heroTitle');
  const sub = document.getElementById('heroSubtitle');
  if (h1)  h1.innerHTML   = s.hero_title    || 'نشر المعرفة... إرث يدوم';
  if (sub) sub.textContent = s.hero_subtitle || 'دار علي بن زيد للطباعة والنشر';
}

// ─── STATS ────────────────────────────────────────────────────────────────────
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
    const color    = getCatColor(book);
    const catName  = getCatName(book);
    const coverHtml = book.cover_url
      ? `<img src="${escHtml(book.cover_url)}" alt="${escHtml(book.title)}" class="book-cover-img">`
      : `<span class="book-cover-icon">📖</span><div class="book-cover-lines"></div>`;
    const pdfBadge = book.pdf_url ? `<span class="pdf-badge">📄 PDF</span>` : '';
    return `
    <article class="book-card fade-in">
      <div class="book-cover ${book.cover_url ? 'has-image' : ''}" style="${book.cover_url ? '' : `background:linear-gradient(135deg,${color}dd 0%,${color}88 50%,${color}44 100%)`}">
        ${coverHtml}${pdfBadge}
      </div>
      <div class="book-info">
        <span class="book-category-badge">${catName}</span>
        <h3 class="book-title">${escHtml(book.title)}</h3>
        <p class="book-author">✍️ ${escHtml(book.author)}</p>
        ${book.year ? `<p class="book-year">📅 ${book.year}</p>` : ''}
        <div class="book-footer">
          <button class="btn-detail" onclick="openBookModal(${book.id})">عرض التفاصيل</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

// ─── BOOK MODAL ───────────────────────────────────────────────────────────────
window.openBookModal = function(bookId) {
  const book = allBooks.find(b => b.id === bookId);
  if (!book) return;

  const color   = getCatColor(book);
  const catName = getCatName(book);

  const coverEl = document.getElementById('modalCover');
  if (book.cover_url) {
    coverEl.style.background = 'none';
    coverEl.innerHTML = `<img src="${escHtml(book.cover_url)}" alt="${escHtml(book.title)}" style="width:100%;height:100%;object-fit:cover;display:block">`;
  } else {
    coverEl.style.background = `linear-gradient(135deg,${color}cc,${color}55)`;
    coverEl.innerHTML = `<span style="font-size:4rem;opacity:.7">📖</span>`;
  }

  document.getElementById('modalTitle').textContent = book.title;
  document.getElementById('modalMeta').innerHTML = `
    <span>✍️ ${escHtml(book.author)}</span>
    <span>🏷️ ${catName}</span>
    ${book.year  ? `<span>📅 ${book.year}</span>`           : ''}
    ${book.pages ? `<span>📄 ${book.pages} صفحة</span>`    : ''}
  `;
  document.getElementById('modalDesc').textContent = book.description || 'لا يوجد وصف متاح.';

  const existing = document.getElementById('modalPdfBtn');
  if (existing) existing.remove();
  if (book.pdf_url) {
    const btn = document.createElement('a');
    btn.id        = 'modalPdfBtn';
    btn.href      = book.pdf_url;
    btn.target    = '_blank';
    btn.rel       = 'noopener noreferrer';
    btn.className = 'btn-pdf-download';
    btn.innerHTML = `<i class="fa-solid fa-file-pdf"></i> تحميل PDF`;
    btn.addEventListener('click', e => e.stopPropagation());
    document.getElementById('modalDesc').after(btn);
  }

  document.getElementById('bookModal').classList.add('open');
  document.body.style.overflow = 'hidden';
};

function initModal() {
  const overlay  = document.getElementById('bookModal');
  const closeBtn = document.getElementById('modalClose');
  const close    = () => { overlay.classList.remove('open'); document.body.style.overflow = ''; };
  closeBtn?.addEventListener('click', close);
  overlay?.addEventListener('click', e => { if (e.target === overlay) close(); });
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
  if (fbBtn && info.facebook)  { fbBtn.href = info.facebook; fbBtn.style.display = 'flex'; }
  if (igBtn && info.instagram) { igBtn.href = info.instagram; igBtn.style.display = 'flex'; }
  if (waBtn && info.whatsapp)  { waBtn.href = `https://wa.me/${String(info.whatsapp).replace(/\D/g,'')}`; waBtn.style.display = 'flex'; }
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
  initNavbar();
  initModal();
  initContactForm();
  initScrollAnimations();

  showLoading(true);

  const safe = p => p.catch(() => null);

  const [books, cats, about, milestones, testimonials, contact, settings] = await Promise.all([
    safe(api.get('/api/books')),
    safe(api.get('/api/categories')),
    safe(api.get('/api/about')),
    safe(api.get('/api/milestones')),
    safe(api.get('/api/testimonials')),
    safe(api.get('/api/contact')),
    safe(api.get('/api/settings')),
  ]);

  showLoading(false);

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
});
