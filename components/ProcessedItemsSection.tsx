import type { ImageItem } from '../src/types';

type ProcessedItemsSectionProps = {
  items: ImageItem[];
  formatBytes: (bytes: number) => string;
  onDownload: (blob: Blob, name: string) => void;
  isConverting: boolean;
};

export default function ProcessedItemsSection({
  items,
  formatBytes,
  onDownload,
  isConverting,
}: ProcessedItemsSectionProps) {
  const getOutputFormat = (name: string) => {
    const extension = name.split('.').pop()?.toLowerCase();
    if (!extension) return null;
    const map: Record<string, 'jpeg' | 'png' | 'webp'> = {
      jpg: 'jpeg',
      jpeg: 'jpeg',
      png: 'png',
      webp: 'webp',
    };
    return map[extension] ?? null;
  };

  return (
    <section className="grid">
      {items.map((item) => {
        const itemOutputFormat = getOutputFormat(item.output?.name ?? '');
        return (
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
                <div className="badge-group">
                  <span className="badge">{item.sourceFormat}</span>
                  {itemOutputFormat && (
                    <span className="badge output">{itemOutputFormat}</span>
                  )}
                </div>
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
                  disabled={!item.output || isConverting}
                  onClick={() =>
                    item.output &&
                    onDownload(item.output.blob, item.output.name)
                  }
                >
                  Download
                </button>
              </div>
            </div>
          </article>
        );
      })}
      {!items.length ? (
        <div className="empty">
          <h3>Nothing here yet</h3>
          <p>
            Add images to start converting. Everything stays in your browser.
          </p>
        </div>
      ) : null}
    </section>
  );
}
