import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import JSZip from 'jszip';
import './App.css';
import init, { convert_image_with_options } from '../wasm/pkg/image_wasm';

type Format = 'webp' | 'png' | 'jpeg';

type ConvertStatus = 'queued' | 'processing' | 'done' | 'error' | 'skipped';

type ImageItem = {
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

const DEFAULT_QUALITY = 78;
const LOSSLESS_QUALITY = 100;

const formatLabels: Record<Format, string> = {
  webp: 'WebP',
  png: 'PNG',
  jpeg: 'JPEG',
};

const mimeByFormat: Record<Format, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

const knownFormats: Format[] = ['webp', 'png', 'jpeg'];

const formatFromFile = (file: File): Format | 'unknown' => {
  const type = file.type.toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg';
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.webp')) return 'webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpeg';
  return 'unknown';
};

const replaceExtension = (name: string, target: Format) => {
  const base = name.replace(/\.[^/.]+$/, '');
  return `${base}.${target === 'jpeg' ? 'jpg' : target}`;
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[index]}`;
};

const readQueryFormat = (value: string | null): Format | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'jpg' || normalized === 'jpeg') return 'jpeg';
  if (normalized === 'png') return 'png';
  if (normalized === 'webp') return 'webp';
  return null;
};

const App = () => {
  const [wasmReady, setWasmReady] = useState(false);
  const [wasmError, setWasmError] = useState<string | null>(null);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<Format>('webp');
  const [sourceFilter, setSourceFilter] = useState<Format | 'any'>('any');
  const [lossy, setLossy] = useState(true);
  const [resizeToMax, setResizeToMax] = useState(false);
  const [maxWidth, setMaxWidth] = useState(1600);
  const [maxHeight, setMaxHeight] = useState(1600);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const from = readQueryFormat(search.get('from'));
    const to = readQueryFormat(search.get('to'));
    if (from) setSourceFilter(from);
    if (to) setTargetFormat(to);
  }, []);

  useEffect(() => {
    let mounted = true;
    init()
      .then(() => {
        if (mounted) setWasmReady(true);
      })
      .catch((error: unknown) => {
        if (mounted) setWasmError(String(error));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const outputCount = useMemo(
    () => items.filter((item) => item.status === 'done' && item.output).length,
    [items],
  );

  const handleFiles = (fileList: FileList | File[]) => {
    const nextItems: ImageItem[] = Array.from(fileList).map((file) => {
      const sourceUrl = URL.createObjectURL(file);
      return {
        id: crypto.randomUUID(),
        file,
        sourceUrl,
        sourceFormat: formatFromFile(file),
        status: 'queued',
      };
    });
    setItems((prev) => [...prev, ...nextItems]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files?.length) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const handleConvertAll = async () => {
    if (!wasmReady) return;
    const quality = lossy ? DEFAULT_QUALITY : LOSSLESS_QUALITY;

    for (const item of items) {
      if (item.status === 'done' || item.status === 'processing') continue;
      if (sourceFilter !== 'any' && item.sourceFormat !== sourceFilter) {
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: 'skipped',
                  error: 'Skipped (format mismatch).',
                }
              : entry,
          ),
        );
        continue;
      }
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: 'processing', error: undefined }
            : entry,
        ),
      );

      try {
        const buffer = await item.file.arrayBuffer();
        const output = convert_image_with_options(
          new Uint8Array(buffer),
          targetFormat,
          quality,
          resizeToMax ? maxWidth : 0,
          resizeToMax ? maxHeight : 0,
          !lossy,
        );

        const outputBytes = new Uint8Array(output.byteLength);
        outputBytes.set(output);
        const outputBlob = new Blob([outputBytes], {
          type: mimeByFormat[targetFormat],
        });
        const outputUrl = URL.createObjectURL(outputBlob);
        const outputName = replaceExtension(item.file.name, targetFormat);

        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: 'done',
                  output: {
                    blob: outputBlob,
                    url: outputUrl,
                    size: outputBlob.size,
                    name: outputName,
                  },
                }
              : entry,
          ),
        );
      } catch (error) {
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: 'error',
                  error: `Conversion failed: ${String(error)}`,
                }
              : entry,
          ),
        );
      }
    }
  };

  const handleClear = () => {
    items.forEach((item) => {
      URL.revokeObjectURL(item.sourceUrl);
      if (item.output?.url) URL.revokeObjectURL(item.output.url);
    });
    setItems([]);
  };

  const downloadBlob = (blob: Blob, name: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };

  const downloadAllZip = async () => {
    if (!outputCount) return;
    const zip = new JSZip();
    items.forEach((item) => {
      if (item.output) {
        zip.file(item.output.name, item.output.blob);
      }
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `converted-${Date.now()}.zip`);
  };

  const stats = useMemo(() => {
    let original = 0;
    let converted = 0;
    items.forEach((item) => {
      original += item.file.size;
      if (item.output) converted += item.output.size;
    });
    const delta = original - converted;
    const percent = original > 0 ? Math.round((delta / original) * 100) : 0;
    return { original, converted, delta, percent };
  }, [items]);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <span className="eyebrow">Client-side Rust + WASM</span>
          <h1>Web Image Converter</h1>
          <p>Convert PNG, JPEG, and WebP entirely in your browser.</p>
        </div>
        <div className="status-card">
          <div
            className={`status-indicator ${wasmReady ? 'ready' : 'loading'}`}
          />
          <div>
            <strong>{wasmReady ? 'WASM ready' : 'Loading WASM...'}</strong>
            <span>
              {wasmError ? wasmError : 'All processing stays on your device.'}
            </span>
          </div>
        </div>
      </header>

      <section className="controls">
        <div className="control-block">
          <label>Source format</label>
          <div className="pill-group">
            <button
              className={sourceFilter === 'any' ? 'active' : ''}
              onClick={() => setSourceFilter('any')}
            >
              Any
            </button>
            {knownFormats.map((format) => (
              <button
                key={format}
                className={sourceFilter === format ? 'active' : ''}
                onClick={() => setSourceFilter(format)}
              >
                {formatLabels[format]}
              </button>
            ))}
          </div>
        </div>

        <div className="control-block">
          <label>Target format</label>
          <div className="pill-group">
            {knownFormats.map((format) => (
              <button
                key={format}
                className={targetFormat === format ? 'active' : ''}
                onClick={() => setTargetFormat(format)}
              >
                {formatLabels[format]}
              </button>
            ))}
          </div>
        </div>

        <div className="control-block">
          <label>Compression</label>
          <div className="toggle-row">
            <button
              className={lossy ? 'active' : ''}
              onClick={() => setLossy(true)}
            >
              Lossy (smaller)
            </button>
            <button
              className={!lossy ? 'active' : ''}
              onClick={() => setLossy(false)}
            >
              Lossless*
            </button>
          </div>
          <small>
            *JPEG uses quality 100 as a near-lossless fallback. WebP is encoded
            lossless here.
          </small>
        </div>

        <div className="control-block">
          <label>Resize (optional)</label>
          <div className="resize-row">
            <button
              className={resizeToMax ? 'active' : ''}
              onClick={() => setResizeToMax(!resizeToMax)}
            >
              {resizeToMax ? 'On' : 'Off'}
            </button>
            <input
              type="number"
              min={64}
              max={6000}
              value={maxWidth}
              onChange={(event) => setMaxWidth(Number(event.target.value))}
              disabled={!resizeToMax}
              aria-label="Max width"
            />
            <span>x</span>
            <input
              type="number"
              min={64}
              max={6000}
              value={maxHeight}
              onChange={(event) => setMaxHeight(Number(event.target.value))}
              disabled={!resizeToMax}
              aria-label="Max height"
            />
          </div>
        </div>
      </section>

      <section className="drop-zone">
        <div
          className={`drop-surface ${isDragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div>
            <strong>Drop images here</strong>
            <p>
              or select files from your computer. Supported: JPG, PNG, WebP.
            </p>
          </div>
          <label className="file-button">
            Select files
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                if (event.target.files) handleFiles(event.target.files);
              }}
            />
          </label>
        </div>
      </section>

      <section className="actions">
        <div className="stats">
          <div>
            <span>Original</span>
            <strong>{formatBytes(stats.original)}</strong>
          </div>
          <div>
            <span>Converted</span>
            <strong>{formatBytes(stats.converted)}</strong>
          </div>
          <div>
            <span>Saved</span>
            <strong>
              {stats.original
                ? `${formatBytes(stats.delta)} (${stats.percent}%)`
                : '—'}
            </strong>
          </div>
        </div>
        <div className="action-buttons">
          <button
            onClick={handleConvertAll}
            disabled={!items.length || !wasmReady}
          >
            Convert {items.length ? `(${items.length})` : ''}
          </button>
          <button onClick={downloadAllZip} disabled={!outputCount}>
            Download ZIP
          </button>
          <button onClick={handleClear} disabled={!items.length}>
            Clear
          </button>
        </div>
      </section>

      <section className="grid">
        {items.map((item) => (
          <article key={item.id} className={`card ${item.status}`}>
            <div className="thumbs">
              <img src={item.sourceUrl} alt={item.file.name} />
              {item.output?.url ? (
                <img
                  src={item.output.url}
                  alt={`${item.file.name} converted`}
                />
              ) : null}
            </div>
            <div className="card-body">
              <div className="card-title">
                <strong>{item.file.name}</strong>
                <span className="badge">{item.sourceFormat}</span>
              </div>
              <div className="meta">
                <span>{formatBytes(item.file.size)} original</span>
                {item.output ? (
                  <span>{formatBytes(item.output.size)} converted</span>
                ) : null}
              </div>
              <div className="status-row">
                <span className={`status ${item.status}`}>{item.status}</span>
                {item.error ? (
                  <span className="error">{item.error}</span>
                ) : null}
              </div>
              <div className="card-actions">
                <button
                  disabled={!item.output}
                  onClick={() =>
                    item.output &&
                    downloadBlob(item.output.blob, item.output.name)
                  }
                >
                  Download
                </button>
              </div>
            </div>
          </article>
        ))}
        {!items.length ? (
          <div className="empty">
            <h3>Nothing here yet</h3>
            <p>
              Add images to start converting. Everything stays in your browser.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default App;
