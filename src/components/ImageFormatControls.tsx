import {
  formatLabels,
  knownFormats,
  type CompressionPreset,
  type ConversionSettings,
} from '../types';
import type { Dispatch, SetStateAction } from 'react';

type ImageFormatControlsProps = {
  conversionSettings: ConversionSettings;
  setConversionSettings: Dispatch<SetStateAction<ConversionSettings>>;
  compressionLabels: Record<CompressionPreset, string>;
};

export default function ImageFormatControls({
  conversionSettings,
  setConversionSettings,
  compressionLabels,
}: ImageFormatControlsProps) {
  const updateSetting = <K extends keyof ConversionSettings>(
    key: K,
    value: ConversionSettings[K],
  ) => {
    setConversionSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

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
              className={
                conversionSettings.targetFormat === format ? 'active' : ''
              }
              onClick={() => updateSetting('targetFormat', format)}
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
            className={
              conversionSettings.compressionPreset === 'lossless'
                ? 'active'
                : ''
            }
            onClick={() => updateSetting('compressionPreset', 'lossless')}
          >
            {compressionLabels.lossless}
          </button>
          <button
            className={
              conversionSettings.compressionPreset === 'sweet_spot'
                ? 'active'
                : ''
            }
            onClick={() => updateSetting('compressionPreset', 'sweet_spot')}
          >
            {compressionLabels.sweet_spot}
          </button>
          <button
            className={
              conversionSettings.compressionPreset === 'lossy' ? 'active' : ''
            }
            onClick={() => updateSetting('compressionPreset', 'lossy')}
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
            className={conversionSettings.resizeEnabled ? 'active' : ''}
            onClick={() =>
              updateSetting('resizeEnabled', !conversionSettings.resizeEnabled)
            }
          >
            {conversionSettings.resizeEnabled ? 'On' : 'Off'}
          </button>
          <input
            type="number"
            min={1}
            max={100}
            value={conversionSettings.resizePercent}
            onChange={(event) =>
              updateSetting('resizePercent', Number(event.target.value))
            }
            disabled={!conversionSettings.resizeEnabled}
            aria-label="Resize percentage"
          />
          <span>%</span>
        </div>
        <small>Maintains original aspect ratio automatically.</small>
      </div>
    </section>
  );
}
