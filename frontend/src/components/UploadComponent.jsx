import { useState } from 'react';
import { formatFileSize } from './formatters.js';

export default function UploadComponent({ onUpload, isUploading, disabled }) {
  const [selectedFile, setSelectedFile] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedFile || disabled || isUploading) return;

    const uploaded = await onUpload(selectedFile);
    if (uploaded) setSelectedFile(null);
  }

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <label className={`file-picker${disabled ? ' file-picker-disabled' : ''}`} htmlFor="document-file">
        <span className="file-picker-mark" aria-hidden="true">+</span>
        <span>Selecionar arquivo</span>
        <input
          id="document-file"
          type="file"
          onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          disabled={disabled || isUploading}
        />
      </label>

      {selectedFile && (
        <div className="selected-file">
          <div className="selected-file-details">
            <strong title={selectedFile.name}>{selectedFile.name}</strong>
            <span>{formatFileSize(selectedFile.size)}</span>
          </div>
          <button
            className="clear-file-button"
            type="button"
            onClick={() => setSelectedFile(null)}
            disabled={isUploading}
          >
            Limpar
          </button>
        </div>
      )}

      <button
        className="primary-button"
        type="submit"
        disabled={!selectedFile || disabled || isUploading}
      >
        {isUploading ? 'Enviando...' : 'Enviar documento'}
      </button>
    </form>
  );
}