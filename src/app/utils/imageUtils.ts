export interface ImageObjectLike {
  url?: string | null;
  alt?: string | null;
}

export type ImageSourceLike = string | ImageObjectLike | null | undefined;

import { API_URL } from '@/app/utils/api';

export function normalizeImageSource(image: ImageSourceLike): string {
  let urlStr = '';
  if (typeof image === 'string') {
    urlStr = image.trim();
  } else if (image && typeof image === 'object' && typeof image.url === 'string') {
    urlStr = image.url.trim();
  }

  if (!urlStr) return '';

  // Handle relative proxy paths like /api/s3/files/uploads%2F...
  if (urlStr.startsWith('/api/s3/files/')) {
    return `${API_URL}${urlStr}`;
  }

  // Handle any full URL that contains /api/s3/files/ (including localhost URLs)
  // Extract the key and rebuild with current API_URL
  if (urlStr.includes('/api/s3/files/')) {
    const key = urlStr.split('/api/s3/files/')[1];
    if (key) {
      return `${API_URL}/api/s3/files/${key}`;
    }
  }
  
  // Handle direct S3 URLs
  if (urlStr.includes('amazonaws.com')) {
    try {
      const urlObj = new URL(urlStr);
      const key = decodeURIComponent(urlObj.pathname.replace(/^\/+/, ''));
      return `${API_URL}/api/s3/files/${encodeURIComponent(key)}`;
    } catch {
      return urlStr;
    }
  }

  return urlStr;
}

export function getFirstValidImage(
  images: ImageSourceLike[] | null | undefined,
  fallback = '',
): string {
  if (!Array.isArray(images)) {
    return fallback;
  }

  for (const image of images) {
    const normalized = normalizeImageSource(image);
    if (normalized) {
      return normalized;
    }
  }

  return fallback;
}

export function normalizeProductImages(
  images: ImageSourceLike[] | null | undefined,
  fallbackAlt: string,
): Array<{ url: string; alt: string }> {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image) => {
      if (typeof image === 'string') {
        const normalized = normalizeImageSource(image);
        return normalized ? { url: normalized, alt: fallbackAlt } : null;
      }

      if (image && typeof image === 'object') {
        const normalized = normalizeImageSource(image);
        if (!normalized) {
          return null;
        }

        return {
          url: normalized,
          alt: image.alt?.trim() || fallbackAlt,
        };
      }

      return null;
    })
    .filter((image): image is { url: string; alt: string } => Boolean(image));
}
