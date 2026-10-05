// ─────────────────────────────────────────────────────────────
// Public digital menu page
// State → applyFilters() (pure) → render(). No framework.
// ─────────────────────────────────────────────────────────────

import {
    getMenu,
    getMenuConfig,
    resolveImage,
    placeholderImage,
    TAG_LABELS
} from './menu-data.js';

const FAV_KEY = 'gp_menu_favorites';

const state = {
    items: [],
    categories: [],
    currency: '₹',
    query: '',
    category: 'all',
    tags: new Set(),
    favoritesOnly: false,
    favorites: new Set(readFavorites())
};

// ─── Small utilities ───

function readFavorites() {
    try {
        const raw = JSON.parse(localStorage.getItem(FAV_KEY));
        return Array.isArray(raw) ? raw : [];
    } catch (e) {
        return [];
    }
}

function persistFavorites() {
    try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...state.favorites]));
    } catch (e) { /* storage unavailable — favorites stay session-only */ }
}

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatPrice(price) {
    return `${state.currency}${Number(price) || 0}`;
}

function categoryOf(id) {
    return state.categories.find((c) => c.id === id) || null;
}

function categoryName(id) {
    const c = categoryOf(id);
    return c ? c.name : id;
}

function tagLabel(tag) {
    return TAG_LABELS[tag] || tag;
}

// ─── Pure filtering (items + state → items) ───

function applyFilters() {
    const q = state.query.trim().toLowerCase();
    return state.items.filter((item) => {
        if (state.category !== 'all' && item.category !== state.category) return false;
        if (state.favoritesOnly && !state.favorites.has(item.id)) return false;
        for (const tag of state.tags) {
            if (!Array.isArray(item.tags) || !item.tags.includes(tag)) return false;
        }
        if (q) {
            // Search name, description and tags — not the category name, so that
            // searching "coffee" doesn't also pull in every item that merely
            // sits in the "Coffee & Drinks" category.
            const haystack = `${item.name || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });
}

// ─── Rendering ───

function renderTabs() {
    const el = document.getElementById('menuTabs');
    const total = state.items.length;
    const tabs = [{ id: 'all', name: 'All', icon: '🍽️', count: total }]
        .concat(state.categories.map((c) => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            count: state.items.filter((i) => i.category === c.id).length
        })));

    el.innerHTML = tabs.map((t) => `
        <button class="menu-tab" role="tab" data-cat="${escapeHtml(t.id)}"
                aria-selected="${state.category === t.id}">
            <span aria-hidden="true">${escapeHtml(t.icon || '')}</span>${escapeHtml(t.name)}
        </button>
    `).join('');
}

function renderChips() {
    const el = document.getElementById('menuChips');
    // Only offer tags that actually exist in the data.
    const present = new Set();
    state.items.forEach((i) => (i.tags || []).forEach((t) => present.add(t)));
    const available = [...present].sort();

    el.innerHTML = `<span class="chips-label">Diet</span>` + available.map((tag) => `
        <button class="chip" data-tag="${escapeHtml(tag)}"
                aria-pressed="${state.tags.has(tag)}">${escapeHtml(tagLabel(tag))}</button>
    `).join('');
}

function tagPills(tags) {
    return (tags || []).map((t) =>
        `<span class="tag-pill ${escapeHtml(t)}">${escapeHtml(tagLabel(t))}</span>`
    ).join('');
}

// Card = image + name + price. Nothing else, so nothing is duplicated.
function cardHtml(item) {
    const saved = state.favorites.has(item.id);
    const soldOut = item.available === false;
    return `
    <article class="menu-card ${soldOut ? 'soldout' : ''}" data-id="${escapeHtml(item.id)}">
        <div class="menu-card__media">
            <button class="menu-card__fav ${saved ? 'active' : ''}" data-fav="${escapeHtml(item.id)}"
                    aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save'} ${escapeHtml(item.name)}">${saved ? '♥' : '♡'}</button>
            ${soldOut ? '<span class="menu-card__badge">Sold out</span>' : ''}
            <img src="${escapeHtml(resolveImage(item))}" alt="${escapeHtml(item.name)}"
                 loading="lazy" decoding="async" width="400" height="400"
                 data-fallback="${escapeHtml(placeholderImage())}"
                 onerror="this.onerror=null;this.src=this.dataset.fallback;">
        </div>
        <h3 class="menu-card__title">
            <button class="menu-card__open" data-open="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>
        </h3>
        ${item.description ? `<p class="menu-card__desc">${escapeHtml(item.description)}</p>` : ''}
        <span class="menu-card__price">${escapeHtml(formatPrice(item.price))}</span>
    </article>`;
}

function renderSections(visible) {
    const root = document.getElementById('menuSections');

    if (!visible.length) {
        root.innerHTML = `
            <div class="menu-empty">
                <span class="emoji" aria-hidden="true">🔍</span>
                <strong>No dishes match</strong>
                <p>Try a different search or clear your filters.</p>
                <button class="secondary-btn" id="menuResetFilters" style="margin-top:14px;">Clear filters</button>
            </div>`;
        const reset = document.getElementById('menuResetFilters');
        if (reset) reset.addEventListener('click', resetFilters);
        return;
    }        const cats = state.category === 'all'
        ? state.categories
        : state.categories.filter((c) => c.id === state.category);

    root.innerHTML = cats.map((cat) => {
        const items = visible.filter((i) => i.category === cat.id);
        if (!items.length) return '';
        return `
        <section class="menu-section" id="cat-${escapeHtml(cat.id)}" aria-labelledby="cat-${escapeHtml(cat.id)}-h">
            <div class="menu-section-head">
                <h2 id="cat-${escapeHtml(cat.id)}-h">${escapeHtml(cat.name)}</h2>
                <span class="sec-count">${items.length} item${items.length > 1 ? 's' : ''}</span>
            </div>
            <div class="menu-grid">${items.map(cardHtml).join('')}</div>
        </section>`;
    }).join('');
}

function render() {
    const visible = applyFilters();
    renderTabs();
    renderChips();
    renderSections(visible);

    const countEl = document.getElementById('menuResultCount');
    if (countEl) {
        countEl.textContent = visible.length === state.items.length
            ? `${state.items.length} items`
            : `${visible.length} of ${state.items.length} items`;
    }
}

function renderSkeletons() {
    const root = document.getElementById('menuSections');
    root.innerHTML = `<div class="menu-skeleton">${Array.from({ length: 6 }).map(() => `
        <div class="sk-card"><div class="sk-media"></div><div class="sk-line"></div><div class="sk-line short"></div></div>
    `).join('')}</div>`;
}

// ─── Item detail modal ───

function openItem(id) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    const saved = state.favorites.has(item.id);
    const soldOut = item.available === false;

    const overlay = document.getElementById('itemModal');
    document.getElementById('itemModalBody').innerHTML = `
        <button class="modal-close" id="itemModalClose" aria-label="Close">✕</button>
        <div class="item-detail">
            <div class="item-detail__media">
                <img src="${escapeHtml(resolveImage(item))}" alt="${escapeHtml(item.name)}"
                     data-fallback="${escapeHtml(placeholderImage())}"
                     onerror="this.onerror=null;this.src=this.dataset.fallback;">
            </div>
            <div class="item-detail__cat">${escapeHtml(categoryName(item.category))}</div>
            <h3 class="item-detail__title">${escapeHtml(item.name)}</h3>
            <p class="item-detail__desc">${escapeHtml(item.description || 'No description yet.')}</p>
            <div class="item-detail__tags">
                ${tagPills(item.tags) || '<span class="tag-pill">No dietary info</span>'}
            </div>
            <div class="item-detail__foot">
                <span class="item-detail__price">${escapeHtml(formatPrice(item.price))}</span>
                <div style="display:flex;gap:10px;align-items:center;">
                    <span class="item-detail__avail ${soldOut ? 'out' : ''}">${soldOut ? 'Sold out' : 'Available'}</span>
                    <button class="fav-btn ${saved ? 'active' : ''}" id="itemModalFav" data-fav="${escapeHtml(item.id)}">
                        ${saved ? '♥ Saved' : '♡ Save'}
                    </button>
                </div>
            </div>
        </div>`;

    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';

    const close = () => closeItem();
    document.getElementById('itemModalClose').addEventListener('click', close);
    history.replaceState(null, '', `#item-${item.id}`);
    lastFocused = document.activeElement;
    overlay.querySelector('#itemModalClose').focus();
}

function closeItem() {
    const overlay = document.getElementById('itemModal');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
    history.replaceState(null, '', window.location.pathname + window.location.search);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
}

let lastFocused = null;

// ─── Favorites toggle ───

function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    persistFavorites();
    render();
    // Keep the open modal in sync.
    const overlay = document.getElementById('itemModal');
    if (overlay.classList.contains('show')) {
        const favBtn = document.getElementById('itemModalFav');
        if (favBtn) {
            const saved = state.favorites.has(id);
            favBtn.classList.toggle('active', saved);
            favBtn.textContent = saved ? '♥ Saved' : '♡ Save';
        }
    }
}

function resetFilters() {
    state.query = '';
    state.category = 'all';
    state.tags.clear();
    state.favoritesOnly = false;
    const input = document.getElementById('menuSearchInput');
    if (input) input.value = '';
    const clear = document.getElementById('menuSearchClear');
    if (clear) clear.classList.remove('show');
    const saved = document.getElementById('menuSavedToggle');
    if (saved) saved.setAttribute('aria-pressed', 'false');
    render();
}

// ─── Event wiring (delegated) ───

function wireEvents() {
    // Search (debounced)
    const input = document.getElementById('menuSearchInput');
    const clearBtn = document.getElementById('menuSearchClear');
    let timer = null;
    input.addEventListener('input', () => {
        clearBtn.classList.toggle('show', input.value.length > 0);
        clearTimeout(timer);
        timer = setTimeout(() => {
            state.query = input.value;
            render();
        }, 150);
    });
    clearBtn.addEventListener('click', () => {
        input.value = '';
        state.query = '';
        clearBtn.classList.remove('show');
        render();
    });

    // Saved-only toggle
    const savedToggle = document.getElementById('menuSavedToggle');
    savedToggle.addEventListener('click', () => {
        state.favoritesOnly = !state.favoritesOnly;
        savedToggle.setAttribute('aria-pressed', String(state.favoritesOnly));
        render();
    });

    // Category tabs
    document.getElementById('menuTabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.menu-tab');
        if (!tab) return;
        state.category = tab.dataset.cat;
        render();
        const head = document.querySelector('.menu-hero');
        if (head && head.getBoundingClientRect().top < 0) {
            document.getElementById('menuTabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // Diet chips
    document.getElementById('menuChips').addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const tag = chip.dataset.tag;
        if (state.tags.has(tag)) state.tags.delete(tag);
        else state.tags.add(tag);
        render();
    });

    // Card interactions (delegated across featured rail + sections)
    document.getElementById('menuMain').addEventListener('click', (e) => {
        const fav = e.target.closest('[data-fav]');
        if (fav) {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(fav.dataset.fav);
            return;
        }
        const open = e.target.closest('[data-open]');
        if (open) {
            openItem(open.dataset.open);
            return;
        }
        const card = e.target.closest('.menu-card');
        if (card) openItem(card.dataset.id);
    });

    // Modal: click backdrop, Esc
    const overlay = document.getElementById('itemModal');
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeItem();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('show')) closeItem();
    });
}

// ─── Particle background (kept subtle, disabled for reduced motion) ───

function initParticles() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h;
    const particles = [];

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const count = Math.min(70, Math.floor((w * h) / 14000));
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 1.2 + Math.random() * 2.4,
            dx: (Math.random() - 0.5) * 0.28,
            dy: (Math.random() - 0.5) * 0.28,
            o: 0.12 + Math.random() * 0.3,
            hue: 260 + Math.random() * 40
        });
    }

    let running = true;
    document.addEventListener('visibilitychange', () => { running = !document.hidden; });
    function draw() {
        if (running) {
            ctx.clearRect(0, 0, w, h);
            for (const p of particles) {
                p.x += p.dx; p.y += p.dy;
                if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.o})`;
                ctx.fill();
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
}

// ─── Boot ───

async function init() {
    initParticles();
    renderSkeletons();
    wireEvents();

    const [config, items] = await Promise.all([getMenuConfig(), getMenu()]);
    state.categories = config.categories;
    state.currency = config.currency || '₹';
    state.items = items;

    render();

    // Deep link: menu.html#item-<id>
    const match = /^#item-(.+)$/.exec(window.location.hash);
    if (match) openItem(decodeURIComponent(match[1]));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
