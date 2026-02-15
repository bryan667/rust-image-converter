import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

type DropImagesSectionProps = {
  inputMessage: string | null;
  maxFileSizeLabel: string;
  onFileSelect: (files: File[]) => void;
};

export default function DropImagesSection({
  inputMessage,
  maxFileSizeLabel,
  onFileSelect,
}: DropImagesSectionProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length) onFileSelect(acceptedFiles);
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'image/png': [],
      'image/jpeg': [],
      'image/webp': [],
    },
  });

  return (
    <section className="drop-zone">
      <div
        {...getRootProps({
          className: `drop-surface ${isDragActive ? 'dragging' : ''}`,
        })}
      >
        <input {...getInputProps()} />
        <div>
          <strong>Drop images here</strong>
          <p>
            or select files from your computer. Supported: JPG, PNG, WebP. Max
            file size: {maxFileSizeLabel} each.
          </p>
          {inputMessage && <p className="input-message">{inputMessage}</p>}
        </div>
        <label className="file-button">Select files</label>
      </div>
    </section>
  );
}
