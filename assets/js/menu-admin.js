// ─────────────────────────────────────────────────────────────
// Menu Manager (simple CMS)
//
// Self-contained: renders into any container, injects its own
// styles so it works inside index.html (which loads no external
// CSS) and standalone. Exposes window.MenuAdmin.init(root).
// ─────────────────────────────────────────────────────────────

import {
    getMenu,
    getMenuConfig,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    saveMenuConfig,
    resolveImage,
    TAGS,
    TAG_LABELS
} from './menu-data.js';

let root = null;
let draft = [];          // working copy of menu items
let categories = [];     // working copy of categories
const removedIds = [];   // existing Firestore ids queued for deletion
let newSeq = 0;

// ─── Styles (injected once) ───

function injectStyles() {
    if (document.getElementById('ma-styles')) return;
    const style = document.createElement('style');
    style.id = 'ma-styles';
    style.textContent = `
    .ma-hint { color: var(--muted); font-size: 12px; margin-bottom: 12px; }
    .ma-group-title { font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
        color: var(--muted); margin: 16px 0 8px; display: flex; align-items: center; gap: 8px; }
    .ma-item { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px; padding: 12px; margin-bottom: 8px; }
    .ma-item-head { display: flex; gap: 10px; align-items: flex-start; }
    .ma-thumb { width: 54px; height: 54px; border-radius: 10px; overflow: hidden; flex: 0 0 54px;
        background: #0a0a12; border: 1px solid rgba(255,255,255,0.06); }
    .ma-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ma-grid { flex: 1; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 6px; }
    .ma-grid .ma-full { grid-column: 1 / -1; }
    .ma-field { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px; padding: 7px 10px; color: var(--text); font-size: 13px;
        font-family: inherit; width: 100%; }
    .ma-field:focus { outline: none; border-color: var(--accent); }
    .ma-field::placeholder { color: var(--muted); opacity: .5; }
    .ma-label { font-size: 9px; text-transform: uppercase; letter-spacing: .06em;
        color: var(--muted); margin-bottom: 3px; display: block; }
    .ma-toggles { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px;
        align-items: center; font-size: 12px; color: var(--muted); }
    .ma-toggles label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
    .ma-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
    .ma-chip { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em;
        padding: 4px 9px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.02); color: var(--muted); cursor: pointer;
        font-family: inherit; }
    .ma-chip[aria-pressed="true"] { color: var(--success); border-color: rgba(74,222,128,.35);
        background: rgba(74,222,128,.1); }
    .ma-del { background: none; border: none; color: #f87171; font-size: 17px; cursor: pointer;
        padding: 4px 8px; line-height: 1; flex: 0 0 auto; }
    .ma-del:hover { color: #fca5a5; }
    .ma-cat-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
    .ma-cat-row .ma-field { flex: 1; }
    .ma-cat-row .ma-field.ma-sm { flex: 0 0 60px; text-align: center; }
    .ma-cat-row .ma-field.ma-xs { flex: 0 0 52px; text-align: center; }
    .ma-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
    .ma-actions .primary-btn { flex: 1; min-width: 140px; }
    .ma-actions .secondary-btn { flex: 0 1 auto; }
    .ma-status { font-size: 13px; margin-top: 10px; display: none; }
    .ma-status.show { display: block; animation: fadeUp .3s ease; }
    .ma-status.ok { color: var(--success); }
    .ma-status.err { color: #f87171; }
    .ma-empty { color: var(--muted); font-size: 12px; padding: 10px; }
    @media (max-width: 640px) {
        .ma-grid { grid-template-columns: 1fr; }
    }
    `;
    document.head.appendChild(style);
}

// ─── Rendering ───

function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function categoryOptions(selected) {
    return categories.map((c) =>
        `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}</option>`
    ).join('');
}

function tagChips(selected) {
    return TAGS.map((t) =>
        `<button type="button" class="ma-chip" data-tag="${esc(t)}" aria-pressed="${selected.includes(t)}">${esc(TAG_LABELS[t] || t)}</button>`
    ).join('');
}

function itemRow(item, index) {
    const cat = categories.some((c) => c.id === item.category)
        ? item.category
        : (categories[0] && categories[0].id) || '';
    return `
    <div class="ma-item" data-index="${index}">
        <div class="ma-item-head">
            <div class="ma-thumb">
                <img src="${esc(resolveImage({ ...item, category: cat }))}" alt="">
            </div>
            <div class="ma-grid">
                <div class="ma-full">
                    <label class="ma-label">Name</label>
                    <input class="ma-field" data-field="name" value="${esc(item.name)}" placeholder="Item name">
                </div>
                <div>
                    <label class="ma-label">Price (₹)</label>
                    <input class="ma-field" data-field="price" type="number" min="0" step="1" value="${esc(item.price)}">
                </div>
                <div>
                    <label class="ma-label">Category</label>
                    <select class="ma-field" data-field="category">${categoryOptions(cat)}</select>
                </div>
                <div class="ma-full">
                    <label class="ma-label">Description</label>
                    <input class="ma-field" data-field="description" value="${esc(item.description || '')}" placeholder="Short description shown on the card">
                </div>
                <div class="ma-full">
                    <label class="ma-label">Image URL (blank = category image)</label>
                    <input class="ma-field" data-field="imageUrl" value="${esc(item.imageUrl || '')}" placeholder="https://… or assets/…">
                </div>
                <div>
                    <label class="ma-label">Sort order</label>
                    <input class="ma-field" data-field="sortOrder" type="number" step="1" value="${esc(item.sortOrder != null ? item.sortOrder : 0)}">
                </div>
                <div class="ma-toggles">
                    <label><input type="checkbox" data-field="available" ${item.available !== false ? 'checked' : ''}> Available</label>
                    <label><input type="checkbox" data-field="featured" ${item.featured ? 'checked' : ''}> Featured</label>
                </div>
            </div>
            <button class="ma-del" data-del="${index}" title="Delete item" aria-label="Delete ${esc(item.name)}">✕</button>
        </div>
        <div class="ma-tags">${tagChips(item.tags || [])}</div>
    </div>`;
}

function render() {
    const groups = categories.map((cat) => {
        const rows = draft.map((item, index) => ({ item, index }))
            .filter(({ item }) => item.category === cat.id);
        if (!rows.length) return '';
        return `
        <div class="ma-group-title">${esc(cat.icon || '')} ${esc(cat.name)} <span>· ${rows.length}</span></div>
        ${rows.map(({ item, index }) => itemRow(item, index)).join('')}`;
    }).join('');

    // Items whose category no longer exists / is unset
    const orphanRows = draft.map((item, index) => ({ item, index }))
        .filter(({ item }) => !categories.some((c) => c.id === item.category));
    const orphanBlock = orphanRows.length
        ? `<div class="ma-group-title">⚠️ Uncategorised <span>· ${orphanRows.length}</span></div>
           ${orphanRows.map(({ item, index }) => itemRow(item, index)).join('')}`
        : '';

    root.innerHTML = `
        <p class="ma-hint">Add, edit, reorder or remove items. Changes are saved to the cloud when you press Save.</p>
        ${draft.length ? (groups + orphanBlock) : '<div class="ma-empty">No items yet. Use “+ Add Item”.</div>'}

        <div class="ma-group-title">🗂️ Categories</div>
        <div id="maCategories">
            ${categories.map((c, i) => `
                <div class="ma-cat-row" data-ci="${i}">
                    <input class="ma-field ma-xs" data-cfield="icon" value="${esc(c.icon || '')}" placeholder="🏷️" aria-label="Icon">
                    <input class="ma-field" data-cfield="name" value="${esc(c.name)}" placeholder="Category name" aria-label="Name">
                    <input class="ma-field ma-sm" data-cfield="sortOrder" type="number" value="${esc(c.sortOrder != null ? c.sortOrder : 0)}" aria-label="Order">
                    <button class="ma-del" data-cdel="${i}" title="Delete category" aria-label="Delete category">✕</button>
                </div>`).join('')}
        </div>
        <button type="button" class="secondary-btn" id="maAddCategory" style="margin-top:4px;">+ Add Category</button>

        <div class="ma-actions">
            <button class="primary-btn" id="maSave"><span>💾</span> Save Changes</button>
            <button class="secondary-btn" id="maAddItem"><span>＋</span> Add Item</button>
            <button class="secondary-btn" id="maReload"><span>↻</span> Reload</button>
        </div>
        <div class="ma-status" id="maStatus"></div>`;

    wire();
}

// ─── DOM ↔ draft sync ───

function syncFromDom() {
    root.querySelectorAll('.ma-item').forEach((row) => {
        const item = draft[Number(row.dataset.index)];
        if (!item) return;
        row.querySelectorAll('[data-field]').forEach((el) => {
            const field = el.dataset.field;
            if (el.type === 'checkbox') item[field] = el.checked;
            else if (field === 'price' || field === 'sortOrder') item[field] = Number(el.value) || 0;
            else item[field] = el.value;
        });
    });
    root.querySelectorAll('.ma-cat-row').forEach((row) => {
        const cat = categories[Number(row.dataset.ci)];
        if (!cat) return;
        row.querySelectorAll('[data-cfield]').forEach((el) => {
            const field = el.dataset.cfield;
            cat[field] = field === 'sortOrder' ? (Number(el.value) || 0) : el.value;
        });
    });
}

// ─── Events ───

function wire() {
    // Tag toggles
    root.querySelectorAll('.ma-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
            const row = chip.closest('.ma-item');
            const item = draft[Number(row.dataset.index)];
            if (!item) return;
            item.tags = item.tags || [];
            const tag = chip.dataset.tag;
            if (item.tags.includes(tag)) item.tags = item.tags.filter((t) => t !== tag);
            else item.tags.push(tag);
            const on = item.tags.includes(tag);
            chip.setAttribute('aria-pressed', String(on));
        });
    });

    // Keep the thumbnail in sync when the category changes
    root.querySelectorAll('select[data-field="category"]').forEach((sel) => {
        sel.addEventListener('change', () => {
            const row = sel.closest('.ma-item');
            const img = row.querySelector('.ma-thumb img');
            const urlInput = row.querySelector('[data-field="imageUrl"]');
            const custom = urlInput && urlInput.value.trim();
            if (img) {
                img.src = custom || `assets/images/menu/${sel.value}.svg`;
                img.onerror = () => { img.onerror = null; img.src = 'assets/images/menu/placeholder.svg'; };
            }
        });
    });

    // Delete item
    root.querySelectorAll('[data-del]').forEach((btn) => {
        btn.addEventListener('click', () => {
            syncFromDom();
            const index = Number(btn.dataset.del);
            const item = draft[index];
            if (!item) return;
            if (!confirm(`Delete “${item.name || 'this item'}”?`)) return;
            if (!item._new && item.id) removedIds.push(item.id);
            draft.splice(index, 1);
            render();
        });
    });

    // Delete category
    root.querySelectorAll('[data-cdel]').forEach((btn) => {
        btn.addEventListener('click', () => {
            syncFromDom();
            const i = Number(btn.dataset.cdel);
            const cat = categories[i];
            if (!cat) return;
            if (draft.some((it) => it.category === cat.id)) {
                alert('Move or delete the items in this category first.');
                return;
            }
            if (!confirm(`Delete category “${cat.name}”?`)) return;
            categories.splice(i, 1);
            render();
        });
    });

    // Add category
    const addCat = document.getElementById('maAddCategory');
    if (addCat) addCat.addEventListener('click', () => {
        syncFromDom();
        const id = `cat-${Date.now().toString(36)}`;
        categories.push({ id, name: 'New Category', icon: '🏷️', sortOrder: categories.length + 1 });
        render();
    });

    // Add item
    const addItem = document.getElementById('maAddItem');
    if (addItem) addItem.addEventListener('click', () => {
        syncFromDom();
        const firstCat = (categories[0] && categories[0].id) || '';
        const maxOrder = draft
            .filter((i) => i.category === firstCat)
            .reduce((m, i) => Math.max(m, Number(i.sortOrder) || 0), 0);
        draft.push({
            _new: true,
            id: `new-${++newSeq}`,
            name: '',
            description: '',
            price: 0,
            category: firstCat,
            imageUrl: '',
            tags: [],
            sortOrder: maxOrder + 10,
            available: true,
            featured: false
        });
        render();
    });

    // Reload
    const reload = document.getElementById('maReload');
    if (reload) reload.addEventListener('click', () => {
        if (confirm('Discard unsaved changes and reload from the cloud?')) load();
    });

    // Save
    const save = document.getElementById('maSave');
    if (save) save.addEventListener('click', saveAll);
}

// ─── Status ───

function setStatus(message, ok) {
    const el = document.getElementById('maStatus');
    if (!el) return;
    el.textContent = message;
    el.className = `ma-status show ${ok ? 'ok' : 'err'}`;
    if (ok) setTimeout(() => el.classList.remove('show'), 3500);
}

// ─── Load / save ───

async function load() {
    root.innerHTML = '<div class="ma-empty">Loading menu…</div>';
    const [config, items] = await Promise.all([getMenuConfig(), getMenu()]);
    categories = config.categories.map((c) => ({ ...c }));
    draft = items.map((i) => ({ ...i }));
    removedIds.length = 0;
    render();
}

function validate() {
    for (const item of draft) {
        if (!item.name || !item.name.trim()) return `Every item needs a name.`;
        if (!(Number(item.price) >= 0)) return `“${item.name}” has an invalid price.`;
        if (item.category && !categories.some((c) => c.id === item.category)) {
            return `“${item.name}” is in a category that no longer exists.`;
        }
    }
    return null;
}

async function saveAll() {
    syncFromDom();
    const error = validate();
    if (error) { setStatus(`✗ ${error}`, false); return; }

    const btn = document.getElementById('maSave');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;"></span> Saving…';
    try {
        // Deletions first
        for (const id of removedIds) await deleteMenuItem(id);

        // Upserts
        for (const item of draft) {
            const payload = {
                name: (item.name || '').trim(),
                description: (item.description || '').trim(),
                price: Number(item.price) || 0,
                category: item.category || '',
                imageUrl: (item.imageUrl || '').trim(),
                tags: item.tags || [],
                sortOrder: Number(item.sortOrder) || 0,
                available: item.available !== false,
                featured: item.featured === true
            };
            if (item._new || String(item.id).startsWith('new-')) await createMenuItem(payload);
            else await updateMenuItem(item.id, payload);
        }

        // Categories
        await saveMenuConfig({
            currency: '₹',
            categories: categories.map((c, i) => ({
                id: c.id,
                name: (c.name || '').trim() || c.id,
                icon: (c.icon || '').trim() || '🏷️',
                sortOrder: Number(c.sortOrder) || i + 1
            }))
        });

        await load();
        setStatus('✓ Menu saved successfully!', true);
    } catch (e) {
        setStatus(`✗ Save failed: ${e && e.message ? e.message : e}`, false);
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

// ─── Public API ───

export async function init(target) {
    root = target;
    if (!root) return;
    injectStyles();
    await load();
}

window.MenuAdmin = { init };
