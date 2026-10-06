/**
 * Image Processor for PalrixShowWebOps
 * Handles client-side resizing, compression, Base64 conversion, and naming.
 */

export function sanitizeFilenamePart(part) {
  if (!part) return '';
  return String(part)
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

export function generateImageFilename(productId, colorName, index, ext = 'jpg') {
  const cleanId = sanitizeFilenamePart(productId) || 'PRD';
  const cleanColor = sanitizeFilenamePart(colorName) || 'Default';
  return `${cleanId}_${cleanColor}_${index}.${ext}`;
}

/**
 * Resizes and compresses an image file in the browser.
 * @param {File|Blob} file 
 * @param {Object} options { maxWidth: 1200, maxHeight: 1200, quality: 0.82 }
 * @returns {Promise<{ blob: Blob, dataUrl: string, base64: string, sizeBytes: number }>}
 */
export async function processAndCompressImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to parse image data'));
      img.onload = () => {
        let { width, height } = img;

        // Calculate scaled dimensions maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to dataUrl (JPEG)
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];

        canvas.toBlob((blob) => {
          if (!blob) {
            return reject(new Error('Canvas toBlob conversion failed'));
          }
          resolve({
            blob,
            dataUrl,
            base64,
            width,
            height,
            sizeBytes: blob.size
          });
        }, 'image/jpeg', quality);
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}
