import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments, uploadDocument } from './services/api.js';
import './App.css';

function getInitialUserId() {
  try {
    return localStorage.getItem('dms-user-id') || 'demo-user';
  } catch {
    return 'demo-user';
  }
}

export default function App() {
  const [userId, setUserId] = useState(getInitialUserId);
  const [documentState, setDocumentState] = useState({ userId: '', documents: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [listError, setListError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const currentUserId = userId.trim();
  const documents = documentState.userId === currentUserId ? documentState.documents : [];

  useEffect(() => {
    try {
      localStorage.setItem('dms-user-id', userId);
    } catch {
    }
  }, [userId]);

  useEffect(() => {
    if (!currentUserId) {
      setDocumentState({ userId: '', documents: [] });
      setListError('Informe um identificador de usuário para consultar documentos.');
      setIsLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setListError('');

    listDocuments(currentUserId, { signal: controller.signal })
      .then((nextDocuments) => {
        setDocumentState({ userId: currentUserId, documents: nextDocuments });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setListError(error.message);
          setDocumentState({ userId: currentUserId, documents: [] });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [currentUserId, refreshVersion]);

  async function handleUpload(file) {
    setIsUploading(true);
    setFeedback(null);

    try {
      await uploadDocument(file, currentUserId);
      setFeedback({ type: 'success', message: 'Documento enviado.' });
      setRefreshVersion((version) => version + 1);
      return true;
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
      return false;
    } finally {
      setIsUploading(false);
    }
  }

  function handleDownloadError(error) {
    setFeedback({ type: 'error', message: error.message });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup" aria-label="Document Management System">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span className="brand-name">DMS<span>ARQUIVO LOCAL</span></span>
        </div>
        <label className="user-context" htmlFor="user-id">
          <span>USUÁRIO</span>
          <input
            id="user-id"
            type="text"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            maxLength={128}
            autoComplete="off"
            aria-label="Identificador do usuário"
          />
        </label>
      </header>

      <main className="page-content">
        <section className="page-heading" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">ESPAÇO DE TRABALHO <span> / </span> DOCUMENTOS</p>
            <h1 id="page-title">Seus documentos<span className="heading-period">.</span></h1>
          </div>
          <div className="document-total" aria-live="polite">
            <strong>{isLoading ? '—' : documents.length.toString().padStart(2, '0')}</strong>
            <span>ARQUIVOS</span>
          </div>
        </section>

        {feedback && (
          <p className={`feedback feedback-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </p>
        )}

        <div className="workspace-grid">
          <section className="upload-panel" aria-labelledby="upload-heading">
            <p className="section-index">01 <span>/</span> ENVIO</p>
            <h2 id="upload-heading">Adicionar documento</h2>
            <UploadComponent
              disabled={!currentUserId}
              isUploading={isUploading}
              onUpload={handleUpload}
            />
          </section>

          <section className="documents-panel" aria-labelledby="documents-heading">
            <div className="documents-heading">
              <div>
                <p className="section-index">02 <span>/</span> ARQUIVO</p>
                <h2 id="documents-heading">Documentos enviados</h2>
              </div>
              <button
                className="refresh-button"
                type="button"
                title="Atualizar lista"
                aria-label="Atualizar lista de documentos"
                disabled={!currentUserId || isLoading}
                onClick={() => setRefreshVersion((version) => version + 1)}
              >
                <span aria-hidden="true">↻</span>
              </button>
            </div>
            <DocumentList
              documents={documents}
              userId={currentUserId}
              isLoading={isLoading}
              error={listError}
              onDownloadError={handleDownloadError}
            />
          </section>
        </div>
      </main>
      <footer className="page-footer">
        <span>DMS <span className="footer-separator">/</span> DOCUMENT MANAGEMENT SYSTEM</span>
        <span>ARMAZENAMENTO NO DISPOSITIVO</span>
      </footer>
    </div>
  );
}
