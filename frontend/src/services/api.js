const API_PREFIX = '/api';

async function request(path, userId, options = {}) {
  const headers = new Headers(options.headers);
  if (userId) headers.set('X-User-Id', userId);

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new Error(payload?.error?.message || 'Não foi possível concluir a solicitação.');
  }

  return response;
}

export async function listDocuments(userId, { signal } = {}) {
  const response = await request('/documents', userId, { signal });
  return response.json();
}

export async function uploadDocument(file, userId) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', userId, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export async function downloadDocument(documentMetadata, userId) {
  const response = await request(
    `/documents/${encodeURIComponent(documentMetadata.id)}/download`,
    userId,
  );
  const fileBlob = await response.blob();
  const objectUrl = URL.createObjectURL(fileBlob);
  const downloadLink = document.createElement('a');
  const fileName = String(documentMetadata.originalName || 'document').split(/[\\/]/).pop();

  downloadLink.href = objectUrl;
  downloadLink.download = fileName || 'document';
  downloadLink.hidden = true;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}