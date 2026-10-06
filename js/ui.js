/**
 * UI Utilities & Modals for PalrixShowWebOps
 */

import { BaseColors, getNearestColorName, hexToRgb } from './color-matcher.js';

export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-slate-900 text-white'
  };

  const icons = {
    success: 'bi-check-circle-fill',
    error: 'bi-exclamation-triangle-fill',
    warning: 'bi-exclamation-circle-fill',
    info: 'bi-info-circle-fill'
  };

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl transition-all duration-300 transform translate-y-4 opacity-0 text-sm font-medium ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <i class="bi ${icons[type] || icons.info} text-lg"></i>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function openColorPickerDialog(initialHex = '#1D2E47', onSelect = () => {}) {
  const modal = document.getElementById('colorPickerModal');
  if (!modal) return;

  const colorInput = document.getElementById('customColorInput');
  const colorHexText = document.getElementById('colorHexText');
  const colorNameText = document.getElementById('colorNameText');
  const colorPreviewBox = document.getElementById('colorPreviewBox');
  const paletteGrid = document.getElementById('presetPaletteGrid');
  const confirmBtn = document.getElementById('confirmColorBtn');
  const cancelBtn = document.getElementById('cancelColorBtn');

  let currentHex = initialHex.startsWith('#') ? initialHex : '#' + initialHex;

  function updateColorDisplay(hex) {
    currentHex = hex.toUpperCase();
    if (colorInput) colorInput.value = currentHex;
    if (colorHexText) colorHexText.textContent = currentHex;
    if (colorPreviewBox) colorPreviewBox.style.backgroundColor = currentHex;
    const name = getNearestColorName(currentHex);
    if (colorNameText) colorNameText.textContent = name;
  }

  // Populate presets
  if (paletteGrid) {
    paletteGrid.innerHTML = '';
    BaseColors.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-9 h-9 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center transition-transform active:scale-90';
      btn.style.backgroundColor = c.hex;
      btn.title = c.name;
      btn.onclick = () => updateColorDisplay(c.hex);
      paletteGrid.appendChild(btn);
    });
  }

  updateColorDisplay(currentHex);

  if (colorInput) {
    colorInput.oninput = (e) => updateColorDisplay(e.target.value);
  }

  modal.classList.remove('hidden');

  const cleanup = () => {
    modal.classList.add('hidden');
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  confirmBtn.onclick = () => {
    const finalName = getNearestColorName(currentHex);
    onSelect(currentHex, finalName);
    cleanup();
  };

  cancelBtn.onclick = cleanup;
}

export function showConfirmDialog({ title, message, confirmText = 'Confirm', confirmStyle = 'bg-blue-600', onConfirm }) {
  const modal = document.getElementById('confirmModal');
  if (!modal) return;

  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl = document.getElementById('confirmModalMsg');
  const confirmBtn = document.getElementById('confirmModalActionBtn');
  const cancelBtn = document.getElementById('confirmModalCancelBtn');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (confirmBtn) {
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `px-5 py-2.5 rounded-xl font-semibold text-white shadow-sm transition active:scale-95 text-sm ${confirmStyle}`;
  }

  modal.classList.remove('hidden');

  const cleanup = () => {
    modal.classList.add('hidden');
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  confirmBtn.onclick = () => {
    cleanup();
    if (onConfirm) onConfirm();
  };

  cancelBtn.onclick = cleanup;
}
