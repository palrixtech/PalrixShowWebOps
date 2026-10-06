/**
 * PalrixShowWebOps — Main App Controller
 */

import { isAuthenticated, getAuthConfig, setAuthConfig, clearAuthConfig, parsePairingKey, generatePairingKey } from './auth.js';
import { catalogStore } from './store.js';
import { processAndCompressImage, generateImageFilename } from './image-processor.js';
import { showToast, openColorPickerDialog, showConfirmDialog } from './ui.js';
import { getNearestColorName } from './color-matcher.js';

class App {
  constructor() {
    this.currentView = 'view-dashboard';
    this.editingProduct = null;
    this.editingVariants = []; // { colorName, colorCode, imagePath, previewUrl, isNew, base64 }
    this.activeCategoryFilter = 'ALL';
    this.searchQuery = '';
    this.html5QrCode = null;
  }

  init() {
    this.setupEventListeners();
    this.setupStoreSubscription();
    this.checkAuthAndStart();
  }

  checkAuthAndStart() {
    if (!isAuthenticated()) {
      this.switchView('view-login');
    } else {
      this.switchView('view-dashboard');
      this.loadCatalogData();
    }
  }

  setupStoreSubscription() {
    catalogStore.subscribe(() => {
      this.renderDashboard();
      this.renderProductsList();
      this.updateDirtyIndicator();
    });
  }

  switchView(viewId) {
    document.querySelectorAll('.app-view').forEach(el => {
      el.classList.add('hidden');
    });

    const target = document.getElementById(viewId);
    if (target) {
      target.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update bottom navigation bar active state
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const match = btn.dataset.view === viewId;
      btn.classList.toggle('text-blue-600', match);
      btn.classList.toggle('text-slate-400', !match);
    });

    this.currentView = viewId;

    if (viewId === 'view-settings') {
      this.renderSettings();
    }
  }

  async loadCatalogData() {
    try {
      await catalogStore.loadCatalog();
      showToast('Catalog synchronized from live repository', 'success');
    } catch (e) {
      showToast(e.message || 'Failed to load catalog', 'error');
    }
  }

  updateDirtyIndicator() {
    const dirtyBadges = document.querySelectorAll('.dirty-badge');
    dirtyBadges.forEach(b => {
      b.classList.toggle('hidden', !catalogStore.isDirty);
    });

    const publishBtn = document.getElementById('globalPublishBtn');
    if (publishBtn) {
      publishBtn.disabled = !catalogStore.isDirty;
      publishBtn.classList.toggle('opacity-50', !catalogStore.isDirty);
      publishBtn.classList.toggle('cursor-not-allowed', !catalogStore.isDirty);
    }
  }

  renderDashboard() {
    const totalCountEl = document.getElementById('statTotalProducts');
    const categoriesCountEl = document.getElementById('statTotalCategories');
    const dirtyCountEl = document.getElementById('statPendingChanges');
    const sellerNameEl = document.getElementById('sellerDisplayName');

    const auth = getAuthConfig();
    if (sellerNameEl) sellerNameEl.textContent = auth ? auth.sellerId : 'Palrix Fashion';

    if (totalCountEl) totalCountEl.textContent = catalogStore.sellerProducts.length;
    if (categoriesCountEl) categoriesCountEl.textContent = catalogStore.categories.length;
    if (dirtyCountEl) {
      dirtyCountEl.textContent = catalogStore.isDirty ? 'Changes Pending' : 'In Sync';
      dirtyCountEl.className = catalogStore.isDirty ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold';
    }
  }

  renderProductsList() {
    const container = document.getElementById('productsListContainer');
    const categoryBar = document.getElementById('categoryChipsBar');
    if (!container) return;

    // Render Category Filter Chips
    if (categoryBar) {
      categoryBar.innerHTML = `
        <button class="cat-chip px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${this.activeCategoryFilter === 'ALL' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}" data-category="ALL">All</button>
      `;

      catalogStore.categories.forEach(cat => {
        const btn = document.createElement('button');
        const isActive = this.activeCategoryFilter === cat;
        btn.className = `cat-chip px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'}`;
        btn.textContent = cat;
        btn.dataset.category = cat;
        btn.onclick = () => {
          this.activeCategoryFilter = cat;
          this.renderProductsList();
        };
        categoryBar.appendChild(btn);
      });

      categoryBar.querySelector('[data-category="ALL"]').onclick = () => {
        this.activeCategoryFilter = 'ALL';
        this.renderProductsList();
      };
    }

    // Filter Products
    let filtered = catalogStore.sellerProducts;

    if (this.activeCategoryFilter !== 'ALL') {
      filtered = filtered.filter(p => p.categoryName === this.activeCategoryFilter);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.id && String(p.id).toLowerCase().includes(q)) ||
        (p.productCode && p.productCode.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center text-slate-400">
          <i class="bi bi-box-seam text-4xl block mb-2 opacity-50"></i>
          <p class="text-sm font-medium">No products found</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    filtered.forEach(p => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center gap-3.5 transition active:scale-[0.99]';

      // First image thumbnail
      let thumbUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="%23e2e8f0"><rect width="60" height="60"/></svg>';
      if (p.variants && p.variants.length > 0 && p.variants[0].imagePath) {
        const rawPath = p.variants[0].imagePath;
        thumbUrl = rawPath.startsWith('http') || rawPath.startsWith('data:')
          ? rawPath
          : `https://raw.githubusercontent.com/${getAuthConfig()?.repo || 'palrixtech/PalrixShow'}/${getAuthConfig()?.branch || 'main'}/${rawPath}`;
      }

      // Badges
      let badgeHtml = '';
      if (p.badge) {
        badgeHtml = `<span class="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">${p.badge}</span>`;
      } else if (p.isNewArrival) {
        badgeHtml = `<span class="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">New</span>`;
      }

      card.innerHTML = `
        <img src="${thumbUrl}" alt="${p.name}" class="w-16 h-16 rounded-xl object-cover bg-slate-50 border border-slate-100 flex-shrink-0" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' fill=\'%23cbd5e1\'><rect width=\'60\' height=\'60\'/></svg>'">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-[11px] font-bold text-slate-400">#${p.id}</span>
            <span class="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">${p.productCode || 'NO-SKU'}</span>
            ${badgeHtml}
          </div>
          <h3 class="font-bold text-slate-900 text-sm truncate">${p.name}</h3>
          <div class="flex items-baseline gap-2 mt-1">
            <span class="text-sm font-black text-slate-900">₹${p.price}</span>
            ${p.originalPrice && p.originalPrice > p.price ? `<span class="text-xs text-slate-400 line-through">₹${p.originalPrice}</span>` : ''}
            <span class="text-[11px] text-slate-500 ml-auto">${p.variants?.length || 0} pics</span>
          </div>
        </div>
        <button class="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 active:scale-90" title="Edit Product">
          <i class="bi bi-chevron-right text-sm"></i>
        </button>
      `;

      card.onclick = () => this.openEditProduct(p);
      container.appendChild(card);
    });
  }

  openAddProduct() {
    const newId = catalogStore.generateNextProductId();
    const defaultProduct = {
      id: newId,
      productCode: `PRD-${newId}`,
      name: '',
      categoryName: catalogStore.categories[0] || 'T-Shirts',
      description: '',
      price: 0,
      originalPrice: null,
      baseLikes: 50,
      baseShares: 10,
      isNewArrival: true,
      isLimitedStock: false,
      isMostSold: false,
      isMostLiked: false,
      badge: '',
      badgeClass: '',
      sizes: ['S', 'M', 'L', 'XL'],
      variants: []
    };

    this.openEditProduct(defaultProduct, true);
  }

  openEditProduct(product, isNew = false) {
    this.editingProduct = JSON.parse(JSON.stringify(product));
    this.isEditingNew = isNew;

    // Setup Local Variants list
    const auth = getAuthConfig();
    const repo = auth?.repo || 'palrixtech/PalrixShow';
    const branch = auth?.branch || 'main';

    this.editingVariants = (this.editingProduct.variants || []).map(v => {
      const rawPath = v.imagePath;
      const previewUrl = rawPath.startsWith('http') || rawPath.startsWith('data:')
        ? rawPath
        : `https://raw.githubusercontent.com/${repo}/${branch}/${rawPath}`;
      return {
        ...v,
        previewUrl: previewUrl,
        isNew: false
      };
    });

    this.populateEditForm();
    this.switchView('view-edit-product');
  }

  populateEditForm() {
    const p = this.editingProduct;
    if (!p) return;

    document.getElementById('editProductId').value = p.id;
    document.getElementById('editProductCode').value = p.productCode;
    document.getElementById('editProductName').value = p.name;
    document.getElementById('editProductCategory').value = p.categoryName;
    document.getElementById('editProductPrice').value = p.price || '';
    document.getElementById('editProductOriginalPrice').value = p.originalPrice || '';
    document.getElementById('editProductDesc').value = p.description || '';
    document.getElementById('editProductBadge').value = p.badge || '';

    // Flags
    document.getElementById('editFlagNewArrival').checked = !!p.isNewArrival;
    document.getElementById('editFlagLimitedStock').checked = !!p.isLimitedStock;
    document.getElementById('editFlagMostSold').checked = !!p.isMostSold;
    document.getElementById('editFlagMostLiked').checked = !!p.isMostLiked;

    // Render Sizes Chips
    this.renderSizesSelector();

    // Render Variant Images
    this.renderEditVariants();
  }

  renderSizesSelector() {
    const container = document.getElementById('sizesChipsContainer');
    if (!container) return;

    const standardSizes = ['S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
    const currentSizes = new Set(this.editingProduct.sizes || []);

    // Combine standard with any existing custom sizes
    const allSizes = Array.from(new Set([...standardSizes, ...currentSizes]));

    container.innerHTML = '';
    allSizes.forEach(size => {
      const isSelected = currentSizes.has(size);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${isSelected ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;
      btn.textContent = size;
      btn.onclick = () => {
        if (currentSizes.has(size)) {
          currentSizes.delete(size);
        } else {
          currentSizes.add(size);
        }
        this.editingProduct.sizes = Array.from(currentSizes);
        this.renderSizesSelector();
      };
      container.appendChild(btn);
    });
  }

  renderEditVariants() {
    const container = document.getElementById('editVariantsList');
    if (!container) return;

    if (this.editingVariants.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          <i class="bi bi-camera text-3xl block mb-1 opacity-50"></i>
          <p class="text-xs font-semibold">No photos added yet</p>
          <span class="text-[10px] text-slate-400">Take a photo or upload from gallery</span>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    this.editingVariants.forEach((v, idx) => {
      const row = document.createElement('div');
      row.className = 'bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm';

      row.innerHTML = `
        <img src="${v.previewUrl}" class="w-14 h-14 rounded-xl object-cover bg-white border border-slate-200 flex-shrink-0">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-4 h-4 rounded-full border border-slate-300 shadow-sm flex-shrink-0" style="background-color: ${v.colorCode || '#FFFFFF'};"></span>
            <span class="text-xs font-bold text-slate-800 truncate">${v.colorName || 'Default'}</span>
            <span class="text-[10px] text-slate-400 font-mono">${v.colorCode || '#FFF'}</span>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="btn-pick-color px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-50 active:scale-95 flex items-center gap-1 shadow-sm">
              <i class="bi bi-palette text-[10px]"></i> Pick Color
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <button type="button" class="btn-del-variant w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100 active:scale-90" title="Delete Image">
            <i class="bi bi-trash text-xs"></i>
          </button>
        </div>
      `;

      row.querySelector('.btn-pick-color').onclick = () => {
        openColorPickerDialog(v.colorCode || '#1D2E47', (hex, name) => {
          v.colorCode = hex;
          v.colorName = name;
          this.renderEditVariants();
        });
      };

      row.querySelector('.btn-del-variant').onclick = () => {
        this.editingVariants.splice(idx, 1);
        this.renderEditVariants();
      };

      container.appendChild(row);
    });
  }

  async handleAddPhotos(files) {
    if (!files || files.length === 0) return;

    showToast('Optimizing & resizing images...', 'info');

    const productId = document.getElementById('editProductId').value || this.editingProduct.id;
    const defaultColorName = 'Default';
    const defaultColorCode = '#FFFFFF';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const processed = await processAndCompressImage(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.82
        });

        const newIndex = this.editingVariants.length + 1;
        const filename = generateImageFilename(productId, defaultColorName, newIndex);
        const imageRelativePath = `images/products/${productId}/${filename}`;

        this.editingVariants.push({
          colorName: defaultColorName,
          colorCode: defaultColorCode,
          imagePath: imageRelativePath,
          previewUrl: processed.dataUrl,
          base64: processed.base64,
          isNew: true
        });
      } catch (err) {
        console.error('Failed to process photo', err);
        showToast(`Failed to process photo ${i + 1}`, 'error');
      }
    }

    this.renderEditVariants();
    showToast(`${files.length} photo(s) added & compressed!`, 'success');
  }

  applyColorToAllVariants() {
    if (this.editingVariants.length === 0) return;
    const first = this.editingVariants[0];
    const colorName = first.colorName;
    const colorCode = first.colorCode;

    this.editingVariants.forEach(v => {
      v.colorName = colorName;
      v.colorCode = colorCode;
    });

    this.renderEditVariants();
    showToast(`Applied ${colorName} to all photos`, 'success');
  }

  saveCurrentProductForm() {
    const id = document.getElementById('editProductId').value.trim();
    const name = document.getElementById('editProductName').value.trim();
    const categoryName = document.getElementById('editProductCategory').value.trim();
    const price = parseFloat(document.getElementById('editProductPrice').value) || 0;
    const origPriceVal = document.getElementById('editProductOriginalPrice').value.trim();
    const originalPrice = origPriceVal ? parseFloat(origPriceVal) : null;
    const desc = document.getElementById('editProductDesc').value.trim();
    const badge = document.getElementById('editProductBadge').value.trim();

    if (!name) {
      showToast('Product Name is required', 'warning');
      return;
    }

    let code = document.getElementById('editProductCode').value.trim();
    if (!code) {
      code = catalogStore.generateProductCode(id, categoryName);
    }

    // Standardize variant paths with current color names
    const newImagesMap = new Map();
    const finalizedVariants = this.editingVariants.map((v, idx) => {
      const filename = generateImageFilename(id, v.colorName, idx + 1);
      const cleanPath = `images/products/${id}/${filename}`;

      if (v.isNew && v.base64) {
        newImagesMap.set(cleanPath, v.base64);
      }

      return {
        colorName: v.colorName,
        colorCode: v.colorCode,
        imagePath: cleanPath
      };
    });

    const productData = {
      ...this.editingProduct,
      id: id,
      productCode: code,
      name: name,
      categoryName: categoryName,
      price: price,
      originalPrice: originalPrice,
      description: desc,
      badge: badge,
      isNewArrival: document.getElementById('editFlagNewArrival').checked,
      isLimitedStock: document.getElementById('editFlagLimitedStock').checked,
      isMostSold: document.getElementById('editFlagMostSold').checked,
      isMostLiked: document.getElementById('editFlagMostLiked').checked,
      variants: finalizedVariants
    };

    catalogStore.saveProduct(productData, newImagesMap);
    showToast(`Product #${id} saved locally!`, 'success');
    this.switchView('view-products');
  }

  async publishLiveWorkflow() {
    if (!catalogStore.isDirty) {
      showToast('No pending changes to publish.', 'info');
      return;
    }

    const modal = document.getElementById('publishProgressModal');
    const msgEl = document.getElementById('publishProgressMsg');
    const barEl = document.getElementById('publishProgressBar');

    showConfirmDialog({
      title: 'Publish Changes LIVE',
      message: 'This will commit all added/modified products and compressed photos directly to your live GitHub repository.',
      confirmText: 'Publish LIVE 🚀',
      confirmStyle: 'bg-emerald-600',
      onConfirm: async () => {
        try {
          if (modal) modal.classList.remove('hidden');

          const res = await catalogStore.publishToGitHub(
            `Update catalog from PalrixShowWebOps - ${new Date().toISOString().split('T')[0]}`,
            (p) => {
              if (msgEl) msgEl.textContent = p.message;
              if (barEl) barEl.style.width = `${(p.step / p.total) * 100}%`;
            }
          );

          if (modal) modal.classList.add('hidden');
          showToast('Published LIVE successfully to website!', 'success', 4000);
        } catch (e) {
          if (modal) modal.classList.add('hidden');
          showToast(`Publish failed: ${e.message}`, 'error', 5000);
        }
      }
    });
  }

  renderSettings() {
    const auth = getAuthConfig();
    if (!auth) return;

    const keyDisplay = document.getElementById('settingsKeyDisplay');
    const repoDisplay = document.getElementById('settingsRepoDisplay');
    const sellerDisplay = document.getElementById('settingsSellerDisplay');
    const qrContainer = document.getElementById('pairingQrContainer');

    if (keyDisplay) keyDisplay.value = generatePairingKey(auth);
    if (repoDisplay) repoDisplay.textContent = auth.repo;
    if (sellerDisplay) sellerDisplay.textContent = auth.sellerId;

    // Generate QR Code for sharing
    if (qrContainer && window.QRCode) {
      qrContainer.innerHTML = '';
      const pairingKey = generatePairingKey(auth);
      new QRCode(qrContainer, {
        text: pairingKey,
        width: 180,
        height: 180,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  setupEventListeners() {
    // Navigation items
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.onclick = () => {
        const view = btn.dataset.view;
        if (view) this.switchView(view);
      };
    });

    // Top action triggers
    document.querySelectorAll('[data-action="add-product"]').forEach(b => {
      b.onclick = () => this.openAddProduct();
    });

    const globalPublishBtn = document.getElementById('globalPublishBtn');
    if (globalPublishBtn) globalPublishBtn.onclick = () => this.publishLiveWorkflow();

    const refreshCatalogBtn = document.getElementById('refreshCatalogBtn');
    if (refreshCatalogBtn) refreshCatalogBtn.onclick = () => this.loadCatalogData();

    // Search bar
    const searchInput = document.getElementById('productsSearchInput');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.renderProductsList();
      };
    }

    // Edit Product form buttons
    const cancelEditBtn = document.getElementById('cancelEditProductBtn');
    if (cancelEditBtn) cancelEditBtn.onclick = () => this.switchView('view-products');

    const saveEditBtn = document.getElementById('saveProductBtn');
    if (saveEditBtn) saveEditBtn.onclick = () => this.saveCurrentProductForm();

    const deleteProductBtn = document.getElementById('deleteProductBtn');
    if (deleteProductBtn) {
      deleteProductBtn.onclick = () => {
        showConfirmDialog({
          title: 'Delete Product',
          message: `Are you sure you want to delete Product #${this.editingProduct.id}?`,
          confirmText: 'Delete',
          confirmStyle: 'bg-rose-600',
          onConfirm: () => {
            catalogStore.deleteProduct(this.editingProduct.id);
            showToast(`Product #${this.editingProduct.id} deleted.`, 'info');
            this.switchView('view-products');
          }
        });
      };
    }

    const duplicateProductBtn = document.getElementById('duplicateProductBtn');
    if (duplicateProductBtn) {
      duplicateProductBtn.onclick = () => {
        const dup = catalogStore.duplicateProduct(this.editingProduct.id);
        if (dup) {
          showToast(`Duplicated as Product #${dup.id}`, 'success');
          this.openEditProduct(dup);
        }
      };
    }

    const applyColorAllBtn = document.getElementById('applyColorAllBtn');
    if (applyColorAllBtn) applyColorAllBtn.onclick = () => this.applyColorToAllVariants();

    // Photo pickers
    const cameraInput = document.getElementById('cameraFileInput');
    if (cameraInput) {
      cameraInput.onchange = (e) => this.handleAddPhotos(e.target.files);
    }

    const galleryInput = document.getElementById('galleryFileInput');
    if (galleryInput) {
      galleryInput.onchange = (e) => this.handleAddPhotos(e.target.files);
    }

    // Add Custom Size
    const addCustomSizeBtn = document.getElementById('addCustomSizeBtn');
    const customSizeInput = document.getElementById('customSizeInput');
    if (addCustomSizeBtn && customSizeInput) {
      addCustomSizeBtn.onclick = () => {
        const val = customSizeInput.value.trim();
        if (val) {
          if (!this.editingProduct.sizes) this.editingProduct.sizes = [];
          if (!this.editingProduct.sizes.includes(val)) {
            this.editingProduct.sizes.push(val);
          }
          customSizeInput.value = '';
          this.renderSizesSelector();
        }
      };
    }

    // Login screen handlers
    const loginKeyInput = document.getElementById('loginKeyInput');
    const submitKeyBtn = document.getElementById('submitKeyBtn');
    if (submitKeyBtn && loginKeyInput) {
      submitKeyBtn.onclick = () => {
        const key = loginKeyInput.value.trim();
        const parsed = parsePairingKey(key);
        if (!parsed) {
          showToast('Invalid Seller Key format. Please check and try again.', 'error');
          return;
        }

        setAuthConfig(parsed);
        showToast('Paired successfully!', 'success');
        this.switchView('view-dashboard');
        this.loadCatalogData();
      };
    }

    // Logout handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        showConfirmDialog({
          title: 'Disconnect Seller Key',
          message: 'Are you sure you want to disconnect this device? You will need your pairing key to log back in.',
          confirmText: 'Disconnect',
          confirmStyle: 'bg-rose-600',
          onConfirm: () => {
            clearAuthConfig();
            this.switchView('view-login');
            showToast('Disconnected successfully', 'info');
          }
        });
      };
    }
  }
}

// Instantiate and launch
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.PalrixApp = app;
  app.init();
});
