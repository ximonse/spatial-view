/**
 * Image processing utilities
 */

import imageCompression from 'browser-image-compression';

/**
 * Quality presets
 * Optimized for A7 cards (74x105mm) with handwritten notes
 */
const QUALITY_PRESETS = {
  low: {
    maxWidthOrHeight: 600,
    quality: 0.75,
    fileType: 'image/jpeg',
    useWebWorker: true
  },
  normal: {
    maxWidthOrHeight: 900,
    quality: 0.85,
    fileType: 'image/jpeg',
    useWebWorker: true
  },
  high: {
    maxWidthOrHeight: 1200,
    quality: 0.92,
    fileType: 'image/jpeg',
    useWebWorker: true
  }
};

/**
 * Compress image with quality preset
 */
export async function compressImage(file, quality = 'normal') {
  try {
    const options = QUALITY_PRESETS[quality] || QUALITY_PRESETS.normal;
    const compressed = await imageCompression(file, options);

    console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB → ${(compressed.size / 1024).toFixed(1)}KB (${quality})`);

    return compressed;
  } catch (error) {
    console.error('Image compression failed:', error);
    return file; // Return original on error
  }
}

/**
 * Convert File/Blob to base64 for storage
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert base64 to Blob
 */
export function base64ToBlob(base64) {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Extract EXIF metadata from image
 * Note: browser-image-compression preserves EXIF data
 */
export async function extractExifData(file) {
  // For now, just extract basic file metadata
  // Full EXIF extraction would require exif-js library
  const dimensions = await getImageDimensions(file);

  return {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    lastModified: file.lastModified,
    width: dimensions.width,
    height: dimensions.height,
    // Future: camera model, GPS, date taken, etc.
  };
}

/**
 * Process uploaded image
 * Returns processed image data ready for storage
 */
export async function processImage(file, quality = 'normal') {
  try {
    // If quality is 'original', skip compression
    const compressed = quality === 'original' ? file : await compressImage(file, quality);

    // Extract metadata
    const metadata = await extractExifData(file);

    // Convert to base64 for IndexedDB storage
    const base64 = await fileToBase64(compressed);

    return {
      base64,
      metadata: {
        ...metadata,
        quality,
        originalSize: file.size,
        compressedSize: compressed.size,
        compressionRatio: (compressed.size / file.size).toFixed(2)
      }
    };
  } catch (error) {
    console.error('Image processing failed:', error);
    throw error;
  }
}
