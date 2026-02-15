import { useEffect, useMemo, useRef, useState } from 'react';
import pLimit from 'p-limit';
import './App.css';
import DropImagesSection from './components/DropImagesSection';
import ImageFormatControls from './components/ImageFormatControls';
import ProcessedItemsSection from './components/ProcessedItemsSection';
import {
  compressionOptions,
  MAX_FILE_SIZE_BYTES,
  mimeByFormat,
} from './helpers';
import type { ConversionSettings, ImageItem } from './types/images.types';
import WasmWorkerPool from './workers/WasmWorkerPool';
import {
  readQueryFormat,
  replaceExtension,
  formatBytes,
  formatFromFile,
  getImageDimensions,
} from './helpers';

const CONVERSION_CONCURRENCY = 4;

const App = () => {
  const workerPoolRef = useRef<WasmWorkerPool | null>(null);
  const [wasmState, setWasmState] = useState<{
    ready: boolean;
    error: string | null;
  }>({
    ready: false,
    error: null,
  });
  const [items, setItems] = useState<ImageItem[]>([]);
  const [conversionSettings, setConversionSettings] =
    useState<ConversionSettings>({
      targetFormat: 'webp',
      compressionPreset: 'sweet_spot',
      resizeEnabled: false,
      resizePercent: 100,
    });
  const [inputMessage, setInputMessage] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const to = readQueryFormat(search.get('to'));
    if (to) {
      setConversionSettings((prev) => ({
        ...prev,
        targetFormat: to,
      }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const workerPoolSize = Math.max(
      1,
      Math.min(CONVERSION_CONCURRENCY, navigator.hardwareConcurrency || 1),
    );
    const pool = new WasmWorkerPool(workerPoolSize);
    workerPoolRef.current = pool;

    const loadWorkers = async () => {
      try {
        await pool.init();
        if (!mounted) return;

        setWasmState({
          ready: true,
          error: null,
        });
      } catch (error: unknown) {
        if (!mounted) return;
        setWasmState({
          ready: false,
          error: String(error),
        });
      }
    };
    loadWorkers();

    return () => {
      mounted = false;
      pool.destroy();
      workerPoolRef.current = null;
    };
  }, []);

  const onFileSelect = (files: File[]) => {
    const accepted = files.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
    const rejected = files.filter((file) => file.size > MAX_FILE_SIZE_BYTES);

    if (rejected.length > 0) {
      const names = rejected
        .slice(0, 2)
        .map((file) => file.name)
        .join(', ');
      const suffix = rejected.length > 2 ? ', ...' : '';
      setInputMessage(
        `Skipped ${rejected.length} file(s) over ${formatBytes(MAX_FILE_SIZE_BYTES)}: ${names}${suffix}`,
      );
    } else {
      setInputMessage(null);
    }

    const nextItems: ImageItem[] = accepted.map((file) => {
      const sourceUrl = URL.createObjectURL(file);
      return {
        id: crypto.randomUUID(),
        file,
        sourceUrl,
        sourceFormat: formatFromFile(file),
        status: 'queued',
      };
    });

    if (!nextItems.length) return;
    setItems((prev) => [...prev, ...nextItems]);
  };

  const handleConvertAll = async () => {
    const workerPool = workerPoolRef.current;
    if (!wasmState.ready || !workerPool || isConverting) return;
    const queuedItems = items.filter((item) => item.status === 'queued');
    if (!queuedItems.length) return;

    setIsConverting(true);
    const selectedCompression =
      compressionOptions[conversionSettings.compressionPreset];
    const normalizedPercent = Math.min(
      100,
      Math.max(1, conversionSettings.resizePercent),
    );
    const processItem = async (item: ImageItem) => {
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: 'processing', error: undefined }
            : entry,
        ),
      );

      try {
        let targetWidth = 0;
        let targetHeight = 0;
        if (conversionSettings.resizeEnabled && normalizedPercent < 100) {
          const { width, height } = await getImageDimensions(item.file);
          const scale = normalizedPercent / 100;
          targetWidth = Math.max(1, Math.round(width * scale));
          targetHeight = Math.max(1, Math.round(height * scale));
        }

        const buffer = await item.file.arrayBuffer();
        const outputBytes = await workerPool.convert({
          input: buffer,
          targetFormat: conversionSettings.targetFormat,
          quality: selectedCompression.quality,
          maxWidth: targetWidth,
          maxHeight: targetHeight,
          lossless: selectedCompression.lossless,
        });
        const outputBuffer = outputBytes.slice().buffer;
        const outputBlob = new Blob([outputBuffer], {
          type: mimeByFormat[conversionSettings.targetFormat],
        });
        const outputUrl = URL.createObjectURL(outputBlob);
        const outputName = replaceExtension(
          item.file.name,
          conversionSettings.targetFormat,
        );

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
    };

    try {
      const limit = pLimit(CONVERSION_CONCURRENCY);
      await Promise.all(
        queuedItems.map((item) => limit(() => processItem(item))),
      );
    } finally {
      setIsConverting(false);
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
    const { default: JSZip } = await import('jszip');
    const doneItems = items.filter(
      (
        item,
      ): item is ImageItem & { output: NonNullable<ImageItem['output']> } =>
        item.status === 'done' && Boolean(item.output),
    );
    if (!doneItems.length) return;

    const zip = new JSZip();
    doneItems.forEach((item, index) => {
      zip.file(`${index}-${item.output.name}`, item.output.blob);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `converted-${Date.now()}.zip`);
  };

  const itemSummary = useMemo(() => {
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
    const delta = original - converted;
    const percent = original > 0 ? Math.round((delta / original) * 100) : 0;
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
  }, [items]);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <span className="eyebrow">Client-side Rust + WASM</span>
          <h1>Web Image Converter</h1>
          <p>Convert images entirely in your browser, client side only.</p>
        </div>
        <div className="status-card">
          <div
            className={`status-indicator ${wasmState.ready ? 'ready' : 'loading'}`}
          />
          <div>
            <strong>
              {wasmState.ready ? 'WASM ready' : 'Loading WASM...'}
            </strong>
            <span>
              {wasmState.error
                ? wasmState.error
                : 'All processing stays on your device.'}
            </span>
          </div>
        </div>
      </header>

      <ImageFormatControls
        conversionSettings={conversionSettings}
        setConversionSettings={setConversionSettings}
        compressionLabels={{
          lossless: compressionOptions.lossless.label,
          sweet_spot: compressionOptions.sweet_spot.label,
          lossy: compressionOptions.lossy.label,
        }}
      />

      <DropImagesSection
        inputMessage={inputMessage}
        maxFileSizeLabel={formatBytes(MAX_FILE_SIZE_BYTES)}
        onFileSelect={onFileSelect}
      />

      <section className="actions">
        <div className="stats">
          <div>
            <span>Original</span>
            <strong>{formatBytes(itemSummary.stats.original)}</strong>
          </div>
          <div>
            <span>Converted</span>
            <strong>{formatBytes(itemSummary.stats.converted)}</strong>
          </div>
          <div>
            <span>Saved</span>
            <strong>
              {itemSummary.stats.original
                ? `${formatBytes(itemSummary.stats.delta)} (${itemSummary.stats.percent}%)`
                : '-'}
            </strong>
          </div>
        </div>
        <div className="action-buttons">
          <button
            onClick={handleConvertAll}
            disabled={!itemSummary.queued || !wasmState.ready || isConverting}
          >
            {isConverting
              ? 'Converting...'
              : `Convert ${itemSummary.queued ? `(${itemSummary.queued})` : ''}`}
          </button>
          <button
            onClick={downloadAllZip}
            disabled={!itemSummary.output || !wasmState.ready || isConverting}
          >
            Download ZIP
          </button>
          <button
            onClick={handleClear}
            disabled={!items.length || isConverting}
          >
            Clear
          </button>
        </div>
      </section>

      <ProcessedItemsSection
        items={items}
        formatBytes={formatBytes}
        onDownload={downloadBlob}
        isConverting={isConverting}
      />
      {isConverting && (
        <div className="converting-overlay" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
        </div>
      )}
    </div>
  );
};

export default App;
