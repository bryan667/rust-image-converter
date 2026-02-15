import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ConversionSettings } from '../types/images.types';
import ImageFormatControls from './ImageFormatControls';

const baseSettings: ConversionSettings = {
  targetFormat: 'webp',
  compressionPreset: 'sweet_spot',
  resizeEnabled: false,
  resizePercent: 100,
};

const compressionLabels = {
  lossless: 'Lossless (95%)',
  sweet_spot: 'Sweet spot (70%)',
  lossy: 'Lossy (45%)',
} as const;

const renderControls = (setConversionSettings = vi.fn()) =>
  render(
    <ImageFormatControls
      conversionSettings={baseSettings}
      setConversionSettings={setConversionSettings}
      compressionLabels={compressionLabels}
    />,
  );

describe('ImageFormatControls', () => {
  it('updates target format using state updater function', () => {
    const setConversionSettings = vi.fn();
    renderControls(setConversionSettings);

    fireEvent.click(screen.getByRole('button', { name: 'PNG' }));
    expect(setConversionSettings).toHaveBeenCalledTimes(1);

    const updater = setConversionSettings.mock.calls[0][0] as (
      prev: ConversionSettings,
    ) => ConversionSettings;
    const next = updater(baseSettings);

    expect(next.targetFormat).toBe('png');
    expect(next.compressionPreset).toBe(baseSettings.compressionPreset);
  });

  it('toggles resize and updates percent', () => {
    const setConversionSettings = vi.fn();
    renderControls(setConversionSettings);

    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    fireEvent.change(screen.getByLabelText('Resize percentage'), {
      target: { value: '80' },
    });

    expect(setConversionSettings).toHaveBeenCalledTimes(2);

    const toggleUpdater = setConversionSettings.mock.calls[0][0] as (
      prev: ConversionSettings,
    ) => ConversionSettings;
    const resizedUpdater = setConversionSettings.mock.calls[1][0] as (
      prev: ConversionSettings,
    ) => ConversionSettings;

    expect(toggleUpdater(baseSettings).resizeEnabled).toBe(true);
    expect(resizedUpdater(baseSettings).resizePercent).toBe(80);
  });
});
