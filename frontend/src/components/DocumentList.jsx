import DownloadButton from './DownloadButton.jsx';
import { formatFileSize } from './formatters.js';

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function DocumentList({
  documents,
  userId,
  isLoading,
  error,
  onDownloadError,
}) {
  if (isLoading) {
    return <p className="list-state" role="status">Carregando documentos...</p>;
  }

  if (error) {
    return <p className="list-state list-state-error" role="alert">{error}</p>;
  }

  if (documents.length === 0) {
    return <p className="list-state">Nenhum documento encontrado.</p>;
  }

  return (
    <div className="document-list" role="list" aria-label="Documentos enviados">
      {documents.map((document) => (
        <article className="document-row" role="listitem" key={document.id}>
          <div className="document-name-group">
            <span className="document-type" aria-hidden="true">DOC</span>
            <div className="document-name-details">
              <strong title={document.originalName}>{document.originalName}</strong>
              <span>{formatDate(document.uploadedAt)}</span>
            </div>
          </div>
          <span className="document-size">{formatFileSize(document.size)}</span>
          <DownloadButton
            document={document}
            userId={userId}
            onError={onDownloadError}
          />
        </article>
      ))}
    </div>
  );
}