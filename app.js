// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------

const STORAGE_KEY = 'discovery-poc-state-v1';

const defaultState = {
  onboardingComplete: false,
  preferences: { brands: [], styles: [], categories: [] },
  boards: [],        // { id, name, coverProductId, items: [productId] }
  savedProducts: {}, // { [productId]: { id, brand, name, price, image, ratio } }
};

let state = loadState();

let onboardingStep = 0;
let onboardingSelections = { brands: [], styles: [], categories: [] };

let activeCategory = 'all';
let feedPage      = 1;
let feedLoading   = false;
let feedHasMore   = true;
const productCache = new Map(); // id → product, survives chip/page changes

let activeSaveProductId = null;
let activeBoardDetailId = null;
let activeActionContext = null; // { boardId, productId }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  } catch (e) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------

let screenHistory = [];

function init() {
  bindGlobalEvents();

  if (state.onboardingComplete) {
    showScreen('feed');
    renderFeedChips();
    renderEditorialStrips();
    renderFeed(true);
    renderBoards();
  } else {
    renderOnboardingStep();
  }
}

function bindGlobalEvents() {
  document.getElementById('onboarding-continue').addEventListener('click', onOnboardingContinue);
  document.getElementById('onboarding-skip').addEventListener('click', onOnboardingSkip);

  document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.screen;
      screenHistory = [];
      showScreen(screen);
      if (screen === 'boards')  renderBoards();
      if (screen === 'profile') renderProfile();
      if (screen === 'search')  initSearch();
    });
  });

  document.getElementById('board-detail-back').addEventListener('click', navigateBack);

  // Save sheet
  document.getElementById('save-sheet-backdrop').addEventListener('click', closeSaveSheet);
  document.getElementById('new-board-input').addEventListener('input', onNewBoardInput);
  document.getElementById('new-board-create').addEventListener('click', onCreateBoardFromSheet);

  // Action sheet
  document.getElementById('action-sheet-backdrop').addEventListener('click', closeActionSheet);
  document.getElementById('action-set-cover').addEventListener('click', onSetCover);
  document.getElementById('action-remove').addEventListener('click', onRemoveFromBoard);

  // Search
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.addEventListener('input', onSearchInput);
  searchClear.addEventListener('click', () => { searchInput.value = ''; onSearchInput(); searchInput.focus(); });

  // Pull to refresh
  bindPullToRefresh();
}

// ---------------------------------------------------------------
// Screen routing
// ---------------------------------------------------------------

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  const bottomNav = document.getElementById('bottom-nav');
  const showsNav = ['feed', 'boards', 'search', 'profile'].includes(id);
  bottomNav.style.display = showsNav ? 'flex' : 'none';

  document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === id);
  });

  window.scrollTo(0, 0);
}

function navigateTo(screenId, renderFn) {
  const current = document.querySelector('.screen.active')?.id;
  if (current) screenHistory.push(current);
  showScreen(screenId);
  renderFn?.();
}

function navigateBack() {
  const prev = screenHistory.pop() || 'feed';
  showScreen(prev);
  if (prev === 'boards') renderBoards();
}

// ---------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------

function renderOnboardingStep() {
  const step = ONBOARDING_STEPS[onboardingStep];

  // Progress dots
  const progress = document.getElementById('onboarding-progress');
  progress.innerHTML = '';
  ONBOARDING_STEPS.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot' + (i <= onboardingStep ? ' active' : '');
    progress.appendChild(dot);
  });

  // Header
  const header = document.getElementById('onboarding-header');
  header.querySelector('h2').textContent = step.title;
  header.querySelector('p').textContent = step.subtitle;

  // Tiles
  const grid = document.getElementById('onboarding-tiles');
  grid.innerHTML = '';
  step.options.forEach(opt => {
    const tile = document.createElement('button');
    tile.className = 'tile';
    tile.dataset.id = opt.id;
    if (onboardingSelections[step.key].includes(opt.id)) {
      tile.classList.add('selected');
    }
    tile.innerHTML = `
      <img src="${opt.img}" alt="${opt.label}" />
      <div class="tile-check">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="tile-label">${opt.label}</div>
    `;
    tile.addEventListener('click', () => toggleOnboardingTile(step.key, opt.id, tile));
    grid.appendChild(tile);
  });

  // Footer
  const continueBtn = document.getElementById('onboarding-continue');
  const isLast = onboardingStep === ONBOARDING_STEPS.length - 1;
  continueBtn.textContent = isLast ? 'Start exploring' : 'Continue';
}

function toggleOnboardingTile(key, id, tileEl) {
  const list = onboardingSelections[key];
  const idx = list.indexOf(id);
  if (idx === -1) {
    list.push(id);
    tileEl.classList.add('selected');
  } else {
    list.splice(idx, 1);
    tileEl.classList.remove('selected');
  }
}

function onOnboardingContinue() {
  if (onboardingStep < ONBOARDING_STEPS.length - 1) {
    onboardingStep += 1;
    renderOnboardingStep();
  } else {
    completeOnboarding();
  }
}

function onOnboardingSkip() {
  completeOnboarding();
}

function completeOnboarding() {
  state.preferences = { ...onboardingSelections };
  state.onboardingComplete = true;
  saveState();
  showScreen('feed');
  renderFeedChips();
  renderFeed();
  renderBoards();
}

// ---------------------------------------------------------------
// Feed
// ---------------------------------------------------------------

function renderFeedChips() {
  const row = document.getElementById('feed-chips');
  row.innerHTML = '';
  const cats = [{ id: 'all', label: 'All' }, ...ONBOARDING_STEPS[2].options.map(o => ({ id: o.id, label: o.label }))];
  cats.forEach(({ id, label }) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (activeCategory === id ? ' active' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => {
      if (activeCategory === id || feedLoading) return;
      activeCategory = id;
      renderFeedChips();
      renderFeed(true);
    });
    row.appendChild(chip);
  });
}

async function renderFeed(reset = false) {
  if (feedLoading) return;
  const list = document.getElementById('feed-list');

  if (reset) {
    feedPage    = 1;
    feedHasMore = true;
    list.innerHTML = '';
    removeLoadMoreButton();
  }

  feedLoading = true;
  const skeletons = appendSkeletons(list, 6);

  try {
    const { products, hasMore } = await getProducts({ category: activeCategory, page: feedPage });
    products.forEach(p => productCache.set(p.id, p));
    skeletons.forEach(s => s.remove());
    products.forEach(p => list.appendChild(buildProductCard(p)));
    feedHasMore = hasMore;
    feedPage += 1;
  } catch (err) {
    skeletons.forEach(s => s.remove());
    console.error('Feed fetch failed', err);
  } finally {
    feedLoading = false;
  }

  if (feedHasMore) appendLoadMoreButton(list);
  else removeLoadMoreButton();
}

function buildProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.productId = product.id;
  const saved = isProductSaved(product.id);
  card.innerHTML = `
    <div class="media" style="aspect-ratio: 1 / ${product.ratio}">
      <img src="${product.image}" alt="${product.name}" loading="lazy" />
      <button class="save-btn ${saved ? 'saved' : ''}" aria-label="Save">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>
      </button>
    </div>
    <div class="product-info">
      <p class="product-brand">${product.brand}</p>
      <p class="product-name">${product.name}</p>
      <p class="product-price">$${parseFloat(product.price).toFixed(2)}</p>
    </div>
  `;
  card.querySelector('.save-btn').addEventListener('click', e => {
    e.stopPropagation();
    openSaveSheet(product.id);
  });
  card.addEventListener('click', () => openProductDetail(product.id));
  bindSwipeGesture(card, product);
  return card;
}

function appendSkeletons(list, count) {
  return Array.from({ length: count }, (_, i) => {
    const s = document.createElement('div');
    s.className = 'product-card skeleton-card';
    const ratio = [1.25, 0.8, 1.4, 1.1, 0.95, 1.3][i % 6];
    s.innerHTML = `
      <div class="skeleton-img" style="aspect-ratio: 1 / ${ratio}"></div>
      <div class="skeleton-body">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line xshort"></div>
      </div>
    `;
    list.appendChild(s);
    return s;
  });
}

function appendLoadMoreButton(list) {
  removeLoadMoreButton();
  const wrap = document.createElement('div');
  wrap.id = 'load-more-wrap';
  wrap.style.cssText = 'grid-column:1/-1;display:flex;justify-content:center;padding:8px 0 4px';
  list.insertAdjacentElement('afterend', wrap);
  const btn = document.createElement('button');
  btn.className = 'btn-outline';
  btn.style.cssText = 'max-width:200px;font-size:14px;padding:12px 24px';
  btn.textContent = 'Load more';
  btn.addEventListener('click', () => renderFeed(false));
  wrap.appendChild(btn);
}

function removeLoadMoreButton() {
  document.getElementById('load-more-wrap')?.remove();
}

function isProductSaved(productId) {
  return state.boards.some(b => b.items.includes(productId));
}

function lookupProduct(productId) {
  return productCache.get(productId)
    ?? state.savedProducts?.[productId]
    ?? PRODUCTS.find(p => p.id === productId)
    ?? null;
}

// ---------------------------------------------------------------
// Save bottom sheet
// ---------------------------------------------------------------

function openSaveSheet(productId) {
  activeSaveProductId = productId;
  document.getElementById('new-board-input').value = '';
  document.getElementById('new-board-create').disabled = true;
  renderSaveSheetOptions();
  document.getElementById('save-sheet-backdrop').classList.add('open');
  document.getElementById('save-sheet').classList.add('open');
}

function closeSaveSheet() {
  document.getElementById('save-sheet-backdrop').classList.remove('open');
  document.getElementById('save-sheet').classList.remove('open');
  activeSaveProductId = null;
}

function renderSaveSheetOptions() {
  const container = document.getElementById('board-options-list');
  container.innerHTML = '';

  if (state.boards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'meta';
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '14px';
    empty.style.padding = '8px 0';
    empty.textContent = 'No boards yet — create one above.';
    container.appendChild(empty);
    return;
  }

  state.boards.forEach(board => {
    const isChecked = board.items.includes(activeSaveProductId);
    const cover = getBoardCoverImage(board);
    const opt = document.createElement('button');
    opt.className = 'board-option' + (isChecked ? ' checked' : '');
    opt.innerHTML = `
      <div class="cover ${cover ? '' : 'empty'}">
        ${cover ? `<img src="${cover}" alt="" />` : emptyBoardIcon()}
      </div>
      <div class="info">
        <p class="name">${board.name}</p>
        <p class="count">${board.items.length} item${board.items.length === 1 ? '' : 's'}</p>
      </div>
      <div class="check">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `;
    opt.addEventListener('click', () => toggleSaveToBoard(board.id));
    container.appendChild(opt);
  });
}

function emptyBoardIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>`;
}

function toggleSaveToBoard(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  const productId = activeSaveProductId;
  const idx = board.items.indexOf(productId);

  if (idx === -1) {
    board.items.push(productId);
    if (!board.coverProductId) board.coverProductId = productId;
    const product = lookupProduct(productId);
    if (product) {
      if (!state.savedProducts) state.savedProducts = {};
      state.savedProducts[productId] = { id: product.id, brand: product.brand, name: product.name, price: product.price, image: product.image, ratio: product.ratio };
    }
    showToast(`Saved to ${board.name}`);
  } else {
    board.items.splice(idx, 1);
    if (board.coverProductId === productId) board.coverProductId = board.items[0] || null;
  }

  saveState();
  renderSaveSheetOptions();
  document.querySelectorAll('.product-card[data-product-id]').forEach(card => {
    card.querySelector('.save-btn')?.classList.toggle('saved', isProductSaved(card.dataset.productId));
  });
}

function onNewBoardInput(e) {
  document.getElementById('new-board-create').disabled = e.target.value.trim().length === 0;
}

function onCreateBoardFromSheet() {
  const input = document.getElementById('new-board-input');
  const name = input.value.trim();
  if (!name) return;

  const board = {
    id: 'b' + Date.now(),
    name,
    coverProductId: activeSaveProductId,
    items: [activeSaveProductId],
  };
  state.boards.unshift(board);
  const product = lookupProduct(activeSaveProductId);
  if (product) {
    if (!state.savedProducts) state.savedProducts = {};
    state.savedProducts[activeSaveProductId] = { id: product.id, brand: product.brand, name: product.name, price: product.price, image: product.image, ratio: product.ratio };
  }
  saveState();

  input.value = '';
  document.getElementById('new-board-create').disabled = true;
  renderSaveSheetOptions();
  renderFeed();
  showToast(`Saved to ${board.name}`);
}

// ---------------------------------------------------------------
// Boards home
// ---------------------------------------------------------------

function renderBoards() {
  const content = document.getElementById('boards-content');
  content.innerHTML = '';

  if (state.boards.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <svg class="icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
        <h3>No boards yet</h3>
        <p>Save products from your feed to start organizing them into boards.</p>
      </div>
    `;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'boards-grid';

  state.boards.forEach(board => {
    const cover = getBoardCoverImage(board);
    const card = document.createElement('button');
    card.className = 'board-card';
    card.innerHTML = `
      <div class="cover ${cover ? '' : 'empty'}">
        ${cover ? `<img src="${cover}" alt="" />` : emptyBoardIcon()}
      </div>
      <div class="board-info">
        <p class="board-name">${board.name}</p>
        <p class="board-count">${board.items.length} item${board.items.length === 1 ? '' : 's'}</p>
      </div>
    `;
    card.addEventListener('click', () => openBoardDetail(board.id));
    grid.appendChild(card);
  });

  content.appendChild(grid);
}

function getBoardCoverImage(board) {
  const coverId = board.coverProductId || board.items[0];
  if (!coverId) return null;
  return lookupProduct(coverId)?.image ?? null;
}

// ---------------------------------------------------------------
// Board detail
// ---------------------------------------------------------------

function openBoardDetail(boardId) {
  activeBoardDetailId = boardId;
  navigateTo('board-detail', renderBoardDetail);
}

function renderBoardDetail() {
  const board = state.boards.find(b => b.id === activeBoardDetailId);
  if (!board) return;

  document.getElementById('board-detail-name').textContent = board.name;

  const products = board.items.map(id => lookupProduct(id)).filter(Boolean);
  const total = products.reduce((sum, p) => sum + p.price, 0);
  const itemLabel = `${products.length} item${products.length === 1 ? '' : 's'}`;
  document.getElementById('board-detail-meta').textContent =
    products.length ? `${itemLabel} · $${total.toLocaleString()} total` : itemLabel;

  const grid = document.getElementById('board-detail-grid');
  grid.innerHTML = '';

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg class="icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>
        <h3>Nothing saved here yet</h3>
        <p>Save items from your feed and choose this board.</p>
      </div>
    `;
    return;
  }

  products.forEach(product => {
    const card = document.createElement('article');
    card.className = 'board-item-card';
    card.innerHTML = `
      <div class="media">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
      </div>
      <button class="item-menu-btn" aria-label="Options">
        <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
      <div class="product-info">
        <p class="product-brand">${product.brand}</p>
        <p class="product-name">${product.name}</p>
        <p class="product-price">$${product.price}</p>
      </div>
    `;
    card.querySelector('.item-menu-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openActionSheet(board.id, product.id);
    });
    grid.appendChild(card);
  });
}

// ---------------------------------------------------------------
// Item action sheet (board detail)
// ---------------------------------------------------------------

function openActionSheet(boardId, productId) {
  activeActionContext = { boardId, productId };
  document.getElementById('action-sheet-backdrop').classList.add('open');
  document.getElementById('action-sheet').classList.add('open');
}

function closeActionSheet() {
  document.getElementById('action-sheet-backdrop').classList.remove('open');
  document.getElementById('action-sheet').classList.remove('open');
  activeActionContext = null;
}

function onSetCover() {
  if (!activeActionContext) return;
  const board = state.boards.find(b => b.id === activeActionContext.boardId);
  board.coverProductId = activeActionContext.productId;
  saveState();
  closeActionSheet();
  renderBoardDetail();
  showToast('Cover updated');
}

function onRemoveFromBoard() {
  if (!activeActionContext) return;
  const { boardId, productId } = activeActionContext;
  const board = state.boards.find(b => b.id === boardId);
  board.items = board.items.filter(id => id !== productId);
  if (board.coverProductId === productId) {
    board.coverProductId = board.items[0] || null;
  }
  saveState();
  closeActionSheet();
  renderBoardDetail();
  renderFeed();
  showToast('Removed from board');
}

// ---------------------------------------------------------------
// Toast
// ---------------------------------------------------------------

let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ---------------------------------------------------------------
// Profile
// ---------------------------------------------------------------

function renderProfile() {
  const totalSaved = [...new Set(state.boards.flatMap(b => b.items))].length;
  const prefs = state.preferences;

  const labelFor = (stepKey, id) => {
    const step = ONBOARDING_STEPS.find(s => s.key === stepKey);
    const opt = step?.options.find(o => o.id === id);
    return opt ? opt.label : id;
  };

  const chipGroup = (stepKey, ids) => {
    if (!ids || ids.length === 0) return `<p class="pref-empty">None selected</p>`;
    return `<div class="pref-chips">${ids.map(id => `<span class="pref-chip">${labelFor(stepKey, id)}</span>`).join('')}</div>`;
  };

  const hasPrefs = (prefs.brands?.length || prefs.styles?.length || prefs.categories?.length);

  document.getElementById('profile-content').innerHTML = `
    <div class="profile-body">

      <div class="profile-stats">
        <div class="stat-card">
          <p class="stat-value">${state.boards.length}</p>
          <p class="stat-label">Boards</p>
        </div>
        <div class="stat-card">
          <p class="stat-value">${totalSaved}</p>
          <p class="stat-label">Saved items</p>
        </div>
      </div>

      <div class="profile-section">
        <p class="profile-section-title">Your Taste</p>
        ${hasPrefs ? `
          <div class="pref-group">
            <p class="pref-group-label">Brands</p>
            ${chipGroup('brands', prefs.brands)}
          </div>
          <div class="pref-group">
            <p class="pref-group-label">Styles</p>
            ${chipGroup('styles', prefs.styles)}
          </div>
          <div class="pref-group">
            <p class="pref-group-label">Categories</p>
            ${chipGroup('categories', prefs.categories)}
          </div>
        ` : `<p class="pref-empty">You skipped onboarding — no taste profile yet.</p>`}
      </div>

      <div class="profile-divider"></div>

      <div style="display:flex;flex-direction:column;gap:10px;">
        <button class="btn-outline" id="profile-redo-onboarding">Edit preferences</button>
        <button class="btn-destructive" id="profile-clear-data">Clear all data</button>
      </div>

    </div>
  `;

  document.getElementById('profile-redo-onboarding').addEventListener('click', () => {
    state.onboardingComplete = false;
    saveState();
    onboardingStep = 0;
    onboardingSelections = { brands: [], styles: [], categories: [] };
    showScreen('onboarding');
    renderOnboardingStep();
  });

  document.getElementById('profile-clear-data').addEventListener('click', () => {
    if (!confirm('Clear all boards and saved items?')) return;
    state.boards = [];
    state.preferences = { brands: [], styles: [], categories: [] };
    state.onboardingComplete = false;
    saveState();
    onboardingStep = 0;
    onboardingSelections = { brands: [], styles: [], categories: [] };
    showScreen('onboarding');
    renderOnboardingStep();
  });
}

// ---------------------------------------------------------------
// Product detail
// ---------------------------------------------------------------

const PLACEHOLDER_DESC = 'A considered piece designed to wear and wear. Crafted with attention to material and fit — built to earn a place in your rotation, not just your cart.';

function openProductDetail(productId) {
  const product = lookupProduct(productId);
  if (!product) return;
  navigateTo('product-detail', () => renderProductDetail(product));
}

function renderProductDetail(product) {
  const saved = isProductSaved(product.id);
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-hero">
      <img src="${product.image}" alt="${product.name}" />
      <button class="detail-back-btn" id="detail-back">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button class="detail-save-btn ${saved ? 'saved' : ''}" id="detail-save-hero">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>
      </button>
    </div>
    <div class="detail-body">
      <p class="detail-brand">${product.brand}</p>
      <h1 class="detail-name">${product.name}</h1>
      <p class="detail-price">$${parseFloat(product.price).toFixed(2)}</p>
      <p class="detail-desc">${product.description || PLACEHOLDER_DESC}</p>
      <div class="detail-tags">
        ${(product.styles || []).map(s => `<span class="detail-tag">${s}</span>`).join('')}
        ${product.category ? `<span class="detail-tag">${product.category}</span>` : ''}
      </div>
    </div>
    <div class="detail-actions">
      <button class="btn-shop" id="detail-shop">Shop now</button>
      <button class="btn-save-detail ${saved ? 'saved' : ''}" id="detail-save-btn">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>
      </button>
    </div>
  `;

  document.getElementById('detail-back').addEventListener('click', navigateBack);
  document.getElementById('detail-shop').addEventListener('click', () => {
    if (product.url && product.url !== '#') window.open(product.url, '_blank', 'noopener');
    else showToast('No retailer link yet');
  });
  const openSave = () => openSaveSheet(product.id);
  document.getElementById('detail-save-btn').addEventListener('click', openSave);
  document.getElementById('detail-save-hero').addEventListener('click', openSave);
}

// ---------------------------------------------------------------
// Editorial strips
// ---------------------------------------------------------------

const STRIPS = [
  { title: 'Trending Now',  filter: p => p.price > 80 },
  { title: 'Under $60',     filter: p => p.price < 60 },
  { title: 'Minimal Picks', filter: p => p.styles?.includes('minimalist') },
  { title: 'New Arrivals',  filter: (_, i) => i % 3 === 0 },
];

function renderEditorialStrips() {
  const container = document.getElementById('editorial-strips');
  container.innerHTML = '';

  STRIPS.forEach(strip => {
    const products = PRODUCTS.filter(strip.filter).slice(0, 8);
    if (!products.length) return;

    const section = document.createElement('div');
    section.className = 'editorial-section';
    section.innerHTML = `
      <div class="editorial-header">
        <h2 class="editorial-title">${strip.title}</h2>
        <button class="editorial-see-all">See all</button>
      </div>
      <div class="editorial-scroll">
        ${products.map(p => `
          <div class="strip-card" data-id="${p.id}">
            <div class="media">
              <img src="${p.image}" alt="${p.name}" loading="lazy" />
            </div>
            <div class="info">
              <p class="brand">${p.brand}</p>
              <p class="name">${p.name}</p>
              <p class="price">$${p.price}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    section.querySelectorAll('.strip-card').forEach(card => {
      card.addEventListener('click', () => openProductDetail(card.dataset.id));
    });

    container.appendChild(section);
  });
}

// ---------------------------------------------------------------
// Search
// ---------------------------------------------------------------

let searchTimer = null;

function initSearch() {
  const input = document.getElementById('search-input');
  input.value = '';
  document.getElementById('search-clear').classList.remove('visible');
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-empty').style.display = 'block';
  document.getElementById('search-results').innerHTML = '';
  setTimeout(() => input.focus(), 120);
}

function onSearchInput() {
  const input = document.getElementById('search-input');
  const q = input.value.trim();
  document.getElementById('search-clear').classList.toggle('visible', q.length > 0);
  clearTimeout(searchTimer);
  if (!q) {
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('search-empty').style.display = 'block';
    return;
  }
  searchTimer = setTimeout(() => runSearch(q), 280);
}

async function runSearch(q) {
  const resultsEl = document.getElementById('search-results');
  const emptyEl   = document.getElementById('search-empty');
  emptyEl.style.display = 'none';
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '';
  appendSkeletons(resultsEl, 6);

  try {
    const { products } = await getProducts({ query: q, perPage: 24 });
    products.forEach(p => productCache.set(p.id, p));
    resultsEl.innerHTML = '';
    if (!products.length) {
      resultsEl.style.display = 'none';
      emptyEl.style.display = 'block';
      emptyEl.querySelector('p').textContent = `No results for "${q}"`;
      return;
    }
    products.forEach(p => resultsEl.appendChild(buildProductCard(p)));
  } catch (e) {
    resultsEl.innerHTML = '<p style="padding:20px;color:var(--text-muted)">Something went wrong. Try again.</p>';
  }
}

// ---------------------------------------------------------------
// Pull to refresh
// ---------------------------------------------------------------

function bindPullToRefresh() {
  const feedScreen = document.getElementById('feed');
  let startY = 0, pulling = false;
  const indicator = document.getElementById('pull-indicator');

  feedScreen.addEventListener('touchstart', e => {
    if (window.scrollY === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  feedScreen.addEventListener('touchmove', e => {
    if (!pulling) return;
    const delta = e.touches[0].clientY - startY;
    if (delta > 10) indicator.classList.add('visible');
  }, { passive: true });

  feedScreen.addEventListener('touchend', () => {
    if (!pulling) return;
    pulling = false;
    if (indicator.classList.contains('visible')) {
      renderFeed(true);
      setTimeout(() => indicator.classList.remove('visible'), 600);
    }
  });
}

// ---------------------------------------------------------------
// Swipe to save
// ---------------------------------------------------------------

function bindSwipeGesture(card, product) {
  let startX = 0, currentX = 0, active = false;
  const THRESHOLD = 72;

  const saveOverlay     = document.createElement('div');
  saveOverlay.className = 'swipe-overlay save-hint';
  saveOverlay.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`;

  const dismissOverlay     = document.createElement('div');
  dismissOverlay.className = 'swipe-overlay dismiss-hint';
  dismissOverlay.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  card.style.position = 'relative';
  card.appendChild(saveOverlay);
  card.appendChild(dismissOverlay);

  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    currentX = 0;
    active = true;
    card.classList.add('swiping');
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    if (!active) return;
    currentX = e.touches[0].clientX - startX;
    const capped = Math.max(-THRESHOLD * 1.2, Math.min(THRESHOLD * 1.2, currentX));
    card.style.transform = `translateX(${capped}px) rotate(${capped * 0.02}deg)`;
    const progress = Math.min(1, Math.abs(currentX) / THRESHOLD);
    if (currentX > 0) {
      saveOverlay.style.opacity = progress;
      dismissOverlay.style.opacity = 0;
    } else {
      dismissOverlay.style.opacity = progress;
      saveOverlay.style.opacity = 0;
    }
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    card.classList.remove('swiping');
    saveOverlay.style.opacity = 0;
    dismissOverlay.style.opacity = 0;

    if (currentX >= THRESHOLD) {
      card.style.transform = '';
      openSaveSheet(product.id);
    } else if (currentX <= -THRESHOLD) {
      card.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      card.style.transform = 'translateX(-120%) rotate(-8deg)';
      card.style.opacity = '0';
      setTimeout(() => { card.style.display = 'none'; }, 260);
    } else {
      card.style.transform = '';
    }
  });
}

// ---------------------------------------------------------------

init();
