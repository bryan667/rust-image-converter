import { formatBytes } from '../helpers';

type ConversionStatsProps = {
  itemSummary: {
    output: number;
    queued: number;
    stats: {
      original: number;
      converted: number;
      delta: number;
      percent: number;
    };
  };
};

export function ConversionStats({ itemSummary }: ConversionStatsProps) {
  return (
    <div className="stats">
      <div>
        <span>Original</span>
        <strong>{formatBytes(itemSummary.stats?.original)}</strong>
      </div>
      <div>
        <span>Converted</span>
        <strong>{formatBytes(itemSummary.stats?.converted)}</strong>
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
  );
}
