/**
 * GitHub Git Data API Service for PalrixShowWebOps
 * Handles atomic commits for CSV catalog and product image assets.
 */

import { getAuthConfig } from './auth.js';
import { parseCSV, groupRowsIntoProducts, serializeProductsToCSV } from './csv-parser.js';

class GitHubService {
  constructor() {
    this.apiBase = 'https://api.github.com';
  }

  getHeaders() {
    const config = getAuthConfig();
    if (!config || !config.token) {
      throw new Error('Not authenticated. Please pair your Seller Key in Settings.');
    }
    return {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  getRepoInfo() {
    const config = getAuthConfig();
    if (!config || !config.repo) {
      throw new Error('Repository target is not configured.');
    }
    const parts = config.repo.split('/');
    if (parts.length !== 2) {
      throw new Error(`Invalid repository format: ${config.repo}. Expected "owner/repo".`);
    }
    return {
      owner: parts[0],
      repo: parts[1],
      branch: config.branch || 'main',
      sellerId: config.sellerId || 'palrix-fashion'
    };
  }

  async testConnection() {
    const { owner, repo } = this.getRepoInfo();
    const url = `${this.apiBase}/repos/${owner}/${repo}`;
    const response = await fetch(url, { headers: this.getHeaders() });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Invalid or expired Seller Key / Token.');
      if (response.status === 404) throw new Error(`Repository "${owner}/${repo}" not found or token lacks access.`);
      throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return {
      fullName: data.full_name,
      private: data.private,
      defaultBranch: data.default_branch,
      pushedAt: data.pushed_at
    };
  }

  async fetchCatalog() {
    const { owner, repo, branch, sellerId } = this.getRepoInfo();
    const ts = Date.now();
    const url = `${this.apiBase}/repos/${owner}/${repo}/contents/data/products.csv?ref=${branch}&t=${ts}`;
    
    const response = await fetch(url, { headers: this.getHeaders() });
    if (!response.ok) {
      throw new Error(`Failed to fetch products.csv (HTTP ${response.status})`);
    }

    const data = await response.json();
    // GitHub contents API returns base64
    let csvText = '';
    if (data.content && data.encoding === 'base64') {
      csvText = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
    } else {
      throw new Error('Unsupported content encoding for products.csv');
    }

    const rows = parseCSV(csvText);
    const allProducts = groupRowsIntoProducts(rows);
    return {
      allProducts,
      rawCsv: csvText,
      sellerProducts: allProducts.filter(p => !sellerId || p.sellerId === sellerId),
      sha: data.sha
    };
  }

  async createBlob(base64Content, encoding = 'base64') {
    const { owner, repo } = this.getRepoInfo();
    const url = `${this.apiBase}/repos/${owner}/${repo}/git/blobs`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        content: base64Content,
        encoding: encoding
      })
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(`Failed to create Git blob: ${errJson.message || response.statusText}`);
    }

    const data = await response.json();
    return data.sha;
  }

  /**
   * Publishes products and new images atomically via Git Data API.
   * @param {Array} updatedProducts - List of Product models
   * @param {Map<string, string>} newImagesMap - Relative path -> Base64 string
   * @param {string} commitMessage - Commit message
   * @param {Function} onProgress - Callback for UI progress updates
   */
  async publishCatalogChanges(updatedProducts, newImagesMap, commitMessage, onProgress = () => {}) {
    const { owner, repo, branch } = this.getRepoInfo();
    const headers = this.getHeaders();

    onProgress({ step: 1, total: 5, message: 'Getting latest repository state...' });

    // 1. Get HEAD commit SHA
    const refUrl = `${this.apiBase}/repos/${owner}/${repo}/git/refs/heads/${branch}`;
    const refRes = await fetch(refUrl, { headers });
    if (!refRes.ok) {
      throw new Error(`Failed to get branch "${branch}" reference.`);
    }
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Get latest commit to find base tree SHA
    const commitUrl = `${this.apiBase}/repos/${owner}/${repo}/git/commits/${latestCommitSha}`;
    const commitRes = await fetch(commitUrl, { headers });
    if (!commitRes.ok) {
      throw new Error('Failed to get parent commit details.');
    }
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    const treeItems = [];

    // 3. Upload new image blobs
    const imageEntries = Array.from(newImagesMap.entries());
    const totalImages = imageEntries.length;
    
    for (let i = 0; i < totalImages; i++) {
      const [imgPath, b64Data] = imageEntries[i];
      onProgress({
        step: 2,
        total: 5,
        message: `Uploading image ${i + 1}/${totalImages}: ${imgPath.split('/').pop()}...`
      });

      const blobSha = await this.createBlob(b64Data, 'base64');
      treeItems.push({
        path: imgPath,
        mode: '100644',
        type: 'blob',
        sha: blobSha
      });
    }

    // 4. Create CSV blob
    onProgress({ step: 3, total: 5, message: 'Encoding updated catalog CSV...' });
    const csvContent = serializeProductsToCSV(updatedProducts);
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));
    const csvBlobSha = await this.createBlob(csvBase64, 'base64');

    treeItems.push({
      path: 'data/products.csv',
      mode: '100644',
      type: 'blob',
      sha: csvBlobSha
    });

    // 5. Create new Tree
    onProgress({ step: 4, total: 5, message: 'Creating Git tree...' });
    const treeUrl = `${this.apiBase}/repos/${owner}/${repo}/git/trees`;
    const treeRes = await fetch(treeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });

    if (!treeRes.ok) {
      const err = await treeRes.json().catch(() => ({}));
      throw new Error(`Failed to create Git tree: ${err.message || treeRes.statusText}`);
    }
    const treeData = await treeRes.json();
    const newTreeSha = treeData.sha;

    // 6. Create Commit
    onProgress({ step: 5, total: 5, message: 'Finalizing live commit...' });
    const msg = commitMessage || `Update catalog from PalrixShowWebOps - ${new Date().toISOString().split('T')[0]}`;
    const createCommitUrl = `${this.apiBase}/repos/${owner}/${repo}/git/commits`;
    const newCommitRes = await fetch(createCommitUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: msg,
        tree: newTreeSha,
        parents: [latestCommitSha]
      })
    });

    if (!newCommitRes.ok) {
      const err = await newCommitRes.json().catch(() => ({}));
      throw new Error(`Failed to create commit: ${err.message || newCommitRes.statusText}`);
    }
    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;

    // 7. Update Ref to new Commit
    const updateRefRes = await fetch(refUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitSha,
        force: false
      })
    });

    if (!updateRefRes.ok) {
      const err = await updateRefRes.json().catch(() => ({}));
      throw new Error(`Failed to update branch head: ${err.message || updateRefRes.statusText}`);
    }

    return {
      success: true,
      commitSha: newCommitSha,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommitSha}`
    };
  }
}

export const gitHubService = new GitHubService();
