import type { ImageItem } from '../src/imageConverterTypes';

type ProcessedItemsSectionProps = {
  items: ImageItem[];
  formatBytes: (bytes: number) => string;
  onDownload: (blob: Blob, name: string) => void;
};

export default function ProcessedItemsSection({
  items,
  formatBytes,
  onDownload,
}: ProcessedItemsSectionProps) {
  return (
    <section className="grid">
      {items.map((item) => (
        <article key={item.id} className={`card ${item.status}`}>
          <div className="thumbs">
            <img src={item.sourceUrl} alt={item.file.name} />
            {item.output?.url ? (
              <img src={item.output.url} alt={`${item.file.name} converted`} />
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
              {item.error ? <span className="error">{item.error}</span> : null}
            </div>
            <div className="card-actions">
              <button
                disabled={!item.output}
                onClick={() =>
                  item.output && onDownload(item.output.blob, item.output.name)
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
          <p>Add images to start converting. Everything stays in your browser.</p>
        </div>
      ) : null}
    </section>
  );
}
