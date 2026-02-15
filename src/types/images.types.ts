export type Format = 'webp' | 'png' | 'jpeg';
export type CompressionPreset = 'lossless' | 'sweet_spot' | 'lossy';
export type ConvertStatus =
  | 'queued'
  | 'processing'
  | 'done'
  | 'error'
  | 'skipped';
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
