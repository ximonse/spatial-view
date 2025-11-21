// Helpers for normalizing and safely reading card image data
// Ensures rendering layers can consistently handle both string URLs and
// object-based image payloads containing base64 data and metadata.

/**
 * Normalize image payload to a predictable structure.
 *
 * @param {string|object|null|undefined} image
 * @returns {{src: string, width: number|null, height: number|null, quality: any}|null}
 */
export function normalizeCardImage(image) {
  if (!image) return null;

  // Strings are treated as already-final URLs/Base64 strings
  if (typeof image === 'string') {
    return { src: image, width: null, height: null, quality: null };
  }

  if (typeof image === 'object') {
    const base64 = typeof image.base64 === 'string' ? image.base64 : null;
    const url = typeof image.url === 'string' ? image.url : null;
    const src = base64 || url;

    if (!src) {
      console.warn('normalizeCardImage: missing base64/url on image object', image);
      return null;
    }

    return {
      src,
      width: Number.isFinite(image.width) ? image.width : null,
      height: Number.isFinite(image.height) ? image.height : null,
      quality: image.quality ?? null
    };
  }

  console.warn('normalizeCardImage: unsupported image format', image);
  return null;
}

/**
 * Convenience accessor that only returns the normalized src string.
 *
 * @param {string|object|null|undefined} image
 * @returns {string|null}
 */
export function getCardImageSrc(image) {
  const normalized = normalizeCardImage(image);
  return normalized?.src ?? null;
}
