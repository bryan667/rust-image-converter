import type {
  CompressionPreset,
  Format,
  ImageItem,
} from './types/images.types';

const FORMAT_ALIASES: Record<string, Format> = {
  png: 'png',
  webp: 'webp',
  jpg: 'jpeg',
  jpeg: 'jpeg',
};

export const resolveKnownFormat = (
  value: string | undefined,
): Format | 'unknown' => {
  if (!value) return 'unknown';
  return FORMAT_ALIASES[value] ?? 'unknown';
};

export const formatFromFile = (file: File): Format | 'unknown' => {
  const mimeSubtype = file.type.toLowerCase().split('/')[1]?.split(';')[0];
  const fromMime = resolveKnownFormat(mimeSubtype);
  if (fromMime !== 'unknown') return fromMime;

  const extension = file.name.toLowerCase().split('.').pop();
  return resolveKnownFormat(extension);
};

export const replaceExtension = (name: string, target: Format) => {
  const base = name.replace(/\.[^/.]+$/, '');
  return `${base}.${target === 'jpeg' ? 'jpg' : target}`;
};

export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[index]}`;
};

export const readQueryFormat = (value: string | null): Format | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const map: Record<string, 'jpeg' | 'png' | 'webp'> = {
    jpg: 'jpeg',
    jpeg: 'jpeg',
    png: 'png',
    webp: 'webp',
  };
  return map[normalized] ?? null;
};

export const getImageDimensions = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  bitmap.close();
  return { width, height };
};

export const compressionOptions: Array<{
  preset: CompressionPreset;
  label: string;
  quality: number;
  lossless: boolean;
}> = [
  {
    preset: 'lossless',
    label: 'High quality (95%)',
    quality: 95,
    lossless: false,
  },
  {
    preset: 'sweet_spot',
    label: 'Sweet spot (70%)',
    quality: 70,
    lossless: false,
  },
  { preset: 'lossy', label: 'Lossy (45%)', quality: 45, lossless: false },
  {
    preset: 'ultra',
    label: 'Ultra (25%)',
    quality: 25,
    lossless: false,
  },
];

export const knownFormats: Array<{
  id: Format;
  label: string;
  mimeFormat: string;
}> = [
  { id: 'webp', label: 'WebP', mimeFormat: 'image/webp' },
  { id: 'png', label: 'PNG', mimeFormat: 'image/png' },
  { id: 'jpeg', label: 'JPEG', mimeFormat: 'image/jpeg' },
];
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const getItemSummary = (items: ImageItem[]) => {
  let output = 0;
  let queued = 0;
  let original = 0;
  let converted = 0;
  for (const item of items) {
    if (item.status === 'queued') queued += 1;
    if (item.status === 'done' && item.output) output += 1;
    original += item.file.size;
    if (item.output) converted += item.output.size;
  }
  const delta = Math.max(0, original - converted);
  const percent = delta > 0 ? Math.round((delta / original) * 100) : 0;

  return {
    output,
    queued,
    stats: {
      original,
      converted,
      delta,
      percent,
    },
  };
};
