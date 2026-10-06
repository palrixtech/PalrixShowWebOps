/**
 * State Management Store for PalrixShowWebOps
 */

import { gitHubService } from './github-service.js';
import { getAuthConfig } from './auth.js';

class CatalogStore {
  constructor() {
    this.allProducts = [];
    this.sellerProducts = [];
    this.categories = [];
    this.pendingNewImages = new Map(); // path -> base64
    this.isDirty = false;
    this.isLoading = false;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  async loadCatalog() {
    this.isLoading = true;
    this.notify();

    try {
      const res = await gitHubService.fetchCatalog();
      this.allProducts = res.allProducts;
      this.sellerProducts = res.sellerProducts;
      this.updateCategories();
      this.isDirty = false;
      this.pendingNewImages.clear();
      this.isLoading = false;
      this.notify();
      return true;
    } catch (e) {
      this.isLoading = false;
      this.notify();
      throw e;
    }
  }

  updateCategories() {
    const catSet = new Set();
    this.allProducts.forEach(p => {
      if (p.categoryName && p.categoryName.trim()) {
        catSet.add(p.categoryName.trim());
      }
    });
    this.categories = Array.from(catSet).sort();
  }

  generateNextProductId() {
    let maxId = 0;
    this.allProducts.forEach(p => {
      const num = parseInt(p.id, 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    });
    if (maxId === 0) return '201';
    return String(maxId + 1);
  }

  generateProductCode(id, categoryName) {
    const cleanId = String(id || '').trim();
    if (!categoryName || !categoryName.trim()) {
      return `PRD-${cleanId}`;
    }
    const prefix = categoryName
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 4);
    return `${prefix || 'PRD'}-${cleanId}`;
  }

  saveProduct(productData, newImagesMap = new Map()) {
    const auth = getAuthConfig();
    const sellerId = auth ? auth.sellerId : 'palrix-fashion';

    const index = this.allProducts.findIndex(p => p.id === productData.id);
    const updatedProd = {
      ...productData,
      sellerId: productData.sellerId || sellerId
    };

    if (index >= 0) {
      this.allProducts[index] = updatedProd;
    } else {
      this.allProducts.push(updatedProd);
    }

    // Register new image blobs in pending map
    if (newImagesMap && newImagesMap.size > 0) {
      for (const [path, b64] of newImagesMap.entries()) {
        this.pendingNewImages.set(path, b64);
      }
    }

    this.sellerProducts = this.allProducts.filter(p => !sellerId || p.sellerId === sellerId);
    this.updateCategories();
    this.isDirty = true;
    this.notify();
  }

  deleteProduct(productId) {
    const auth = getAuthConfig();
    const sellerId = auth ? auth.sellerId : 'palrix-fashion';

    this.allProducts = this.allProducts.filter(p => p.id !== productId);
    this.sellerProducts = this.allProducts.filter(p => !sellerId || p.sellerId === sellerId);
    this.updateCategories();
    this.isDirty = true;
    this.notify();
  }

  duplicateProduct(productId) {
    const orig = this.allProducts.find(p => p.id === productId);
    if (!orig) return null;

    const newId = this.generateNextProductId();
    const newCode = this.generateProductCode(newId, orig.categoryName);

    const dup = {
      ...JSON.parse(JSON.stringify(orig)),
      id: newId,
      productCode: newCode,
      name: `${orig.name} (Copy)`
    };

    this.saveProduct(dup);
    return dup;
  }

  async publishToGitHub(commitMessage, onProgress) {
    const res = await gitHubService.publishCatalogChanges(
      this.allProducts,
      this.pendingNewImages,
      commitMessage,
      onProgress
    );

    this.isDirty = false;
    this.pendingNewImages.clear();
    this.notify();
    return res;
  }
}

export const catalogStore = new CatalogStore();
