/**
 * Color Matcher & Palette Utility for PalrixShowWebOps
 * Provides RGB Euclidean Distance calculation matching PalrixShowOps Desktop.
 */

export const BaseColors = [
  { name: 'Black', r: 0, g: 0, b: 0, hex: '#000000' },
  { name: 'White', r: 255, g: 255, b: 255, hex: '#FFFFFF' },
  { name: 'Grey', r: 128, g: 128, b: 128, hex: '#808080' },
  { name: 'Red', r: 255, g: 0, b: 0, hex: '#FF0000' },
  { name: 'Green', r: 0, g: 128, b: 0, hex: '#008000' },
  { name: 'Blue', r: 0, g: 0, b: 255, hex: '#0000FF' },
  { name: 'Yellow', r: 255, g: 255, b: 0, hex: '#FFFF00' },
  { name: 'Orange', r: 255, g: 165, b: 0, hex: '#FFA500' },
  { name: 'Purple', r: 128, g: 0, b: 128, hex: '#800080' },
  { name: 'Pink', r: 255, g: 192, b: 203, hex: '#FFC0CB' },
  { name: 'Brown', r: 165, g: 42, b: 42, hex: '#A52A2A' },
  { name: 'Navy', r: 0, g: 0, b: 128, hex: '#000080' },
  { name: 'Teal', r: 0, g: 128, b: 128, hex: '#008080' },
  { name: 'Maroon', r: 128, g: 0, b: 0, hex: '#800000' },
  { name: 'Cyan', r: 0, g: 255, b: 255, hex: '#00FFFF' },
  { name: 'Magenta', r: 255, g: 0, b: 255, hex: '#FF00FF' },
  { name: 'Beige', r: 245, g: 245, b: 220, hex: '#F5F5DC' },
  { name: 'Gold', r: 255, g: 215, b: 0, hex: '#FFD700' },
  { name: 'Silver', r: 192, g: 192, b: 192, hex: '#C0C0C0' },
  { name: 'Khaki', r: 240, g: 230, b: 140, hex: '#F0E68C' },
  { name: 'Olive', r: 128, g: 128, b: 0, hex: '#808000' }
];

export function hexToRgb(hex) {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num) || cleaned.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

export function getNearestColorName(hexOrRgb) {
  let r, g, b;
  if (typeof hexOrRgb === 'string') {
    const rgb = hexToRgb(hexOrRgb);
    r = rgb.r;
    g = rgb.g;
    b = rgb.b;
  } else {
    r = hexOrRgb.r;
    g = hexOrRgb.g;
    b = hexOrRgb.b;
  }

  let bestName = 'Custom';
  let minDistance = Infinity;

  for (const base of BaseColors) {
    const dist = Math.pow(r - base.r, 2) +
                 Math.pow(g - base.g, 2) +
                 Math.pow(b - base.b, 2);
    if (dist < minDistance) {
      minDistance = dist;
      bestName = base.name;
    }
  }

  return bestName;
}
