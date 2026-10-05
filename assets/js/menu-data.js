// ─────────────────────────────────────────────────────────────
// Menu data layer (repository)
//
// Owns all Firestore access for the digital menu. The UI never
// touches Firebase directly, so the backend can be swapped later
// by editing only this file.
// ─────────────────────────────────────────────────────────────

// Firebase is loaded lazily (dynamic import) rather than at module top-level.
// If the Firebase CDN is blocked or offline, the static import would reject and
// take the WHOLE module graph down with it — leaving a blank page. Loading it
// inside the read functions means a failure is caught and we show DEFAULT_MENU.
let _fs = null;
async function firestore() {
    if (!_fs) {
        const [init, fs] = await Promise.all([
            import('./firebase-init.js'),
            import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
        ]);
        _fs = {
            db: init.getDb(),
            collection: fs.collection,
            doc: fs.doc,
            getDoc: fs.getDoc,
            getDocs: fs.getDocs,
            addDoc: fs.addDoc,
            updateDoc: fs.updateDoc,
            deleteDoc: fs.deleteDoc,
            setDoc: fs.setDoc
        };
    }
    return _fs;
}

const MENU_COLLECTION = 'menu_items';
const CONFIG_DOC = ['menu_configs', 'main'];

// Fixed dietary vocabulary — keeps filters reliable (free-text tags
// would fragment into "Veg", "veg", "vegetarian", ...).
export const TAGS = [
    'veg',
    'vegan',
    'jain',
    'contains-dairy',
    'contains-nuts',
    'gluten-free',
    'spicy',
    'caffeine',
    'non-veg',
    'alcohol'
];

export const TAG_LABELS = {
    'veg': 'Veg',
    'vegan': 'Vegan',
    'jain': 'Jain',
    'contains-dairy': 'Contains dairy',
    'contains-nuts': 'Contains nuts',
    'gluten-free': 'Gluten-free',
    'spicy': 'Spicy',
    'caffeine': 'Caffeine',
    'non-veg': 'Non-veg',
    'alcohol': 'Alcohol'
};

export const DEFAULT_CATEGORIES = [
    { id: 'fries', name: 'Fries', icon: '🍟', sortOrder: 1 },
    { id: 'maggi', name: 'Maggi', icon: '🍜', sortOrder: 2 },
    { id: 'shakes', name: 'Shakes', icon: '🥤', sortOrder: 3 },
    { id: 'drinks', name: 'Coffee & Drinks', icon: '☕', sortOrder: 4 },
    { id: 'snacks', name: 'Snacks & Extras', icon: '🍫', sortOrder: 5 }
];

// The live 14-item menu. Rendered when Firestore is empty or unreachable.
export const DEFAULT_MENU = [
    // Fries
    { id: 'salted-fries', name: 'Salted Fries', description: 'Classic crispy fries with a light salt seasoning.', price: 100, category: 'fries', imageUrl: 'assets/images/menu/salted-fries.jpg', tags: ['veg'], sortOrder: 10, available: true, featured: false },
    { id: 'peri-peri-fries', name: 'Peri Peri Fries', description: 'Crispy fries tossed in a punchy peri peri spice mix.', price: 120, category: 'fries', imageUrl: 'assets/images/menu/peri-peri-fries.jpg', tags: ['veg', 'spicy'], sortOrder: 20, available: true, featured: false },
    { id: 'peri-peri-cheese-fries', name: 'Peri Peri Cheese Fries', description: 'Loaded fries with melted cheese and peri peri heat.', price: 130, category: 'fries', imageUrl: 'assets/images/menu/peri-peri-cheese-fries.jpg', tags: ['veg', 'spicy', 'contains-dairy'], sortOrder: 30, available: true, featured: true },
    // Maggi
    { id: 'plain-maggi', name: 'Plain Maggi', description: 'The comforting classic, simply cooked and served hot.', price: 60, category: 'maggi', imageUrl: 'assets/images/menu/plain-maggi.jpg', tags: ['veg'], sortOrder: 10, available: true, featured: false },
    { id: 'veg-masala-maggi', name: 'Veg Masala Maggi', description: 'Masala noodles with fresh garden vegetables.', price: 100, category: 'maggi', imageUrl: 'assets/images/menu/veg-masala-maggi.jpg', tags: ['veg'], sortOrder: 20, available: true, featured: false },
    { id: 'peri-masala-cheese-maggi', name: 'Peri Masala Cheese Maggi', description: 'Spicy peri masala noodles finished with molten cheese.', price: 130, category: 'maggi', imageUrl: 'assets/images/menu/peri-masala-cheese-maggi.jpg', tags: ['veg', 'spicy', 'contains-dairy'], sortOrder: 30, available: true, featured: false },
    // Shakes
    { id: 'oreo-thick-shake', name: 'Oreo Thick Shake', description: 'Thick blended shake loaded with crushed Oreo cookies.', price: 100, category: 'shakes', imageUrl: 'assets/images/menu/oreo-thick-shake.jpg', tags: ['veg', 'contains-dairy'], sortOrder: 10, available: true, featured: false },
    { id: 'kitkat-shake', name: 'Kitkat Shake', description: 'Creamy chocolate shake with crunchy KitKat pieces.', price: 120, category: 'shakes', imageUrl: 'assets/images/menu/kitkat-shake.jpg', tags: ['veg', 'contains-dairy'], sortOrder: 20, available: true, featured: false },
    { id: 'biscoff-thick-shake', name: 'Biscoff Thick Shake', description: 'Caramelised Biscoff blended into a rich thick shake.', price: 130, category: 'shakes', imageUrl: 'assets/images/menu/biscoff-thick-shake.jpg', tags: ['veg', 'contains-dairy'], sortOrder: 30, available: true, featured: true },
    // Coffee & Drinks
    { id: 'hot-coffee', name: 'Hot Coffee', description: 'Freshly brewed hot coffee, served strong and warm.', price: 60, category: 'drinks', imageUrl: 'assets/images/menu/hot-coffee.jpg', tags: ['veg', 'contains-dairy', 'caffeine'], sortOrder: 10, available: true, featured: false },
    { id: 'cold-coffee', name: 'Cold Coffee', description: 'Chilled iced brew with cream — the house favourite.', price: 100, category: 'drinks', imageUrl: 'assets/images/menu/cold-coffee.jpg', tags: ['veg', 'contains-dairy', 'caffeine'], sortOrder: 20, available: true, featured: true },
    { id: 'water', name: 'Water', description: 'Chilled packaged drinking water.', price: 10, category: 'drinks', imageUrl: 'assets/images/menu/water.jpg', tags: ['vegan'], sortOrder: 30, available: true, featured: false },
    { id: 'diet-coke', name: 'Diet Coke', description: 'Sugar-free cola, served ice cold.', price: 60, category: 'drinks', imageUrl: 'assets/images/menu/diet-coke.jpg', tags: ['vegan', 'caffeine'], sortOrder: 40, available: true, featured: false },
    // Snacks & Extras
    { id: 'cyob-chips-bag', name: 'CYOB Chips Bag', description: 'Build your own bag of chips and pick your flavours.', price: 80, category: 'snacks', imageUrl: 'assets/images/menu/cyob-chips-bag.jpg', tags: ['veg'], sortOrder: 10, available: true, featured: false }
];

/** Fallback image path for a category (bundled, always available). */
export function categoryImage(categoryId) {
    return `assets/images/menu/${categoryId}.svg`;
}

export function placeholderImage() {
    return 'assets/images/menu/placeholder.svg';
}

/** Resolves an item's image with the layered fallback chain. */
export function resolveImage(item) {
    if (item && item.imageUrl) return item.imageUrl;
    if (item && item.category) return categoryImage(item.category);
    return placeholderImage();
}

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Sorts items within their category by sortOrder, then name. */
export function sortItems(items) {
    return items.slice().sort((a, b) => {
        const sa = Number(a.sortOrder) || 0;
        const sb = Number(b.sortOrder) || 0;
        if (sa !== sb) return sa - sb;
        return String(a.name).localeCompare(String(b.name));
    });
}

// ─── Reads ───

export async function getMenuConfig() {
    try {
        const { db, doc, getDoc } = await firestore();
        const snap = await getDoc(doc(db, ...CONFIG_DOC));
        if (snap.exists() && Array.isArray(snap.data().categories) && snap.data().categories.length) {
            const data = snap.data();
            return {
                currency: data.currency || '₹',
                categories: data.categories.slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
            };
        }
        return { currency: '₹', categories: clone(DEFAULT_CATEGORIES) };
    } catch (e) {
        console.warn('[menu] config read failed, using defaults:', e && e.message);
        return { currency: '₹', categories: clone(DEFAULT_CATEGORIES) };
    }
}

export async function getMenu() {
    try {
        const { db, collection, getDocs } = await firestore();
        const snap = await getDocs(collection(db, MENU_COLLECTION));
        if (snap.empty) return sortItems(clone(DEFAULT_MENU));
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return sortItems(items);
    } catch (e) {
        console.warn('[menu] menu read failed, using default menu:', e && e.message);
        return sortItems(clone(DEFAULT_MENU));
    }
}

// ─── Writes (admin only — requires Firestore rules that allow admin writes) ───

export async function createMenuItem(data) {
    const { db, collection, addDoc } = await firestore();
    const ref = await addDoc(collection(db, MENU_COLLECTION), normalizeItem(data));
    return ref.id;
}

export async function updateMenuItem(id, patch) {
    const { db, doc, updateDoc } = await firestore();
    await updateDoc(doc(db, MENU_COLLECTION, id), normalizeItem(patch, true));
}

export async function deleteMenuItem(id) {
    const { db, doc, deleteDoc } = await firestore();
    await deleteDoc(doc(db, MENU_COLLECTION, id));
}

export async function saveMenuConfig(config) {
    const { db, doc, setDoc } = await firestore();
    await setDoc(doc(db, ...CONFIG_DOC), {
        currency: config.currency || '₹',
        categories: config.categories || [],
        updatedAt: new Date().toISOString()
    });
}

/** Coerces a free-form object into the canonical menu item shape. */
export function normalizeItem(data, partial = false) {
    const out = {};
    const has = (k) => Object.prototype.hasOwnProperty.call(data, k);

    if (has('name')) out.name = String(data.name || '').trim();
    if (has('description')) out.description = String(data.description || '').trim();
    if (has('price')) out.price = Math.max(0, Math.round(Number(data.price) || 0));
    if (has('category')) out.category = String(data.category || '').trim();
    if (has('imageUrl')) out.imageUrl = String(data.imageUrl || '').trim();
    if (has('tags')) out.tags = Array.isArray(data.tags) ? data.tags.filter((t) => TAGS.includes(t)) : [];
    if (has('sortOrder')) out.sortOrder = Number(data.sortOrder) || 0;
    if (has('available')) out.available = data.available !== false;
    if (has('featured')) out.featured = data.featured === true;

    const now = new Date().toISOString();
    if (!partial) out.createdAt = now;
    out.updatedAt = now;
    return out;
}
