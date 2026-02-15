import type { CompressionPreset, Format } from '../src/types';

type ImageFormatControlsProps = {
  targetFormat: Format;
  compressionPreset: CompressionPreset;
  resizeEnabled: boolean;
  resizePercent: number;
  knownFormats: Format[];
  formatLabels: Record<Format, string>;
  compressionLabels: Record<CompressionPreset, string>;
  onTargetFormatChange: (value: Format) => void;
  onCompressionPresetChange: (value: CompressionPreset) => void;
  onResizeEnabledChange: (value: boolean) => void;
  onResizePercentChange: (value: number) => void;
};

export default function ImageFormatControls({
  targetFormat,
  compressionPreset,
  resizeEnabled,
  resizePercent,
  knownFormats,
  formatLabels,
  compressionLabels,
  onTargetFormatChange,
  onCompressionPresetChange,
  onResizeEnabledChange,
  onResizePercentChange,
}: ImageFormatControlsProps) {
  return (
    <section className="controls">
      <div className="control-block">
        <label>Source format</label>
        <div className="pill-group">
          <button className="active">Any</button>
        </div>
        <small>Supported formats are WebP, PNG, JPG.</small>
      </div>

      <div className="control-block">
        <label>Target format</label>
        <div className="pill-group">
          {knownFormats.map((format) => (
            <button
              key={format}
              className={targetFormat === format ? 'active' : ''}
              onClick={() => onTargetFormatChange(format)}
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
            className={compressionPreset === 'lossless' ? 'active' : ''}
            onClick={() => onCompressionPresetChange('lossless')}
          >
            {compressionLabels.lossless}
          </button>
          <button
            className={compressionPreset === 'sweet_spot' ? 'active' : ''}
            onClick={() => onCompressionPresetChange('sweet_spot')}
          >
            {compressionLabels.sweet_spot}
          </button>
          <button
            className={compressionPreset === 'lossy' ? 'active' : ''}
            onClick={() => onCompressionPresetChange('lossy')}
          >
            {compressionLabels.lossy}
          </button>
        </div>
        <small>
          PNG output is always lossless. JPEG and WebP use quality presets.
        </small>
      </div>

      <div className="control-block">
        <label>Resize (optional, %)</label>
        <div className="resize-row">
          <button
            className={resizeEnabled ? 'active' : ''}
            onClick={() => onResizeEnabledChange(!resizeEnabled)}
          >
            {resizeEnabled ? 'On' : 'Off'}
          </button>
          <input
            type="number"
            min={1}
            max={100}
            value={resizePercent}
            onChange={(event) =>
              onResizePercentChange(Number(event.target.value))
            }
            disabled={!resizeEnabled}
            aria-label="Resize percentage"
          />
          <span>%</span>
        </div>
        <small>Maintains original aspect ratio automatically.</small>
      </div>
    </section>
  );
}
