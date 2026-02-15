export type Format = 'webp' | 'png' | 'jpeg';
export type CompressionPreset = 'lossless' | 'sweet_spot' | 'lossy';
export type ConvertStatus = 'queued' | 'processing' | 'done' | 'error' | 'skipped';
export type ConversionSettings = {
  targetFormat: Format;
  compressionPreset: CompressionPreset;
  resizeEnabled: boolean;
  resizePercent: number;
};

export type ImageItem = {
  id: string;
  file: File;
  sourceFormat: Format | 'unknown';
  sourceUrl: string;
  status: ConvertStatus;
  error?: string;
  output?: {
    blob: Blob;
    url: string;
    size: number;
    name: string;
  };
};

export const compressionOptions: Record<
  CompressionPreset,
  { label: string; quality: number; lossless: boolean }
> = {
  lossless: { label: 'Lossless (95%)', quality: 95, lossless: true },
  sweet_spot: { label: 'Sweet spot (70%)', quality: 70, lossless: false },
  lossy: { label: 'Lossy (45%)', quality: 45, lossless: false },
};

export const formatLabels: Record<Format, string> = {
  webp: 'WebP',
  png: 'PNG',
  jpeg: 'JPEG',
};

export const mimeByFormat: Record<Format, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

export const knownFormats: Format[] = ['webp', 'png', 'jpeg'];
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
