import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatFromFile,
  readQueryFormat,
  replaceExtension,
  resolveKnownFormat,
} from './helpers';

describe('helpers', () => {
  it('resolves known format aliases', () => {
    expect(resolveKnownFormat('jpg')).toBe('jpeg');
    expect(resolveKnownFormat('png')).toBe('png');
    expect(resolveKnownFormat('gif')).toBe('unknown');
    expect(resolveKnownFormat(undefined)).toBe('unknown');
  });

  it('detects file format from mime type first', () => {
    const file = new File(['x'], 'sample.unknown', { type: 'image/webp' });
    expect(formatFromFile(file)).toBe('webp');
  });

  it('falls back to extension when mime type is unavailable', () => {
    const file = new File(['x'], 'sample.jpeg', { type: '' });
    expect(formatFromFile(file)).toBe('jpeg');
  });

  it('replaces extension with normalized output extension', () => {
    expect(replaceExtension('photo.png', 'jpeg')).toBe('photo.jpg');
    expect(replaceExtension('photo', 'webp')).toBe('photo.webp');
  });

  it('formats byte values for display', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(10 * 1024)).toBe('10.0 KB');
  });

  it('reads target format from query string', () => {
    expect(readQueryFormat('jpg')).toBe('jpeg');
    expect(readQueryFormat('WEBP')).toBe('webp');
    expect(readQueryFormat('bmp')).toBeNull();
    expect(readQueryFormat(null)).toBeNull();
  });
});

