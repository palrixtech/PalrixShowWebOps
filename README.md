# PalrixShowWebOps 📱✨

**Mobile-First Web & PWA Operations Manager for PalrixShow Product Showcase**

`PalrixShowWebOps` allows merchants and sellers to manage their product catalog, take and optimize photos directly from their smartphone camera, select color variants, and publish updates live to GitHub without requiring a computer.

---

## 🌟 Key Features

1. **Mobile-First Experience**: Designed specifically for smartphone screens (iOS / Android) with smooth touch navigation, bottom action sheets, and fast response times.
2. **Dedicated Seller Key / QR Pairing**: One-time pairing via Seller Passkey or QR Code scanner with secure browser-encrypted storage.
3. **Camera & Gallery Integration**:
   - Take photos directly with phone camera.
   - Client-side automatic resizing (max 1200px) and smart JPEG compression (~150KB per image).
   - Auto-naming convention: `{productId}_{colorName}_{index}.jpg`.
4. **Smart Product Management**:
   - Auto-incrementing Product IDs (`201`, `202`, `206`, etc.).
   - Auto-generated Product SKU / Code based on Category and ID.
   - Interactive Color Picker + RGB Euclidean distance auto-color detection (matching `PalrixShowOps` Desktop).
   - Size chips selector (S, M, L, XL, XXL, Free Size, custom sizes).
   - Badges & Promotion flags.
5. **Direct GitHub API Publishing**:
   - Commits changes atomically (all resized images + `products.csv`) using GitHub Git Data API.
   - No backend server required — can be hosted on GitHub Pages, Vercel, or Cloudflare Pages.
6. **Installable PWA**: Can be installed to the home screen as a standalone mobile app with offline preview support.

---

## 🚀 Deployment & Usage

Open `index.html` on any web server or host with GitHub Pages.
Pair with your Seller Key to manage your catalog on the go!
