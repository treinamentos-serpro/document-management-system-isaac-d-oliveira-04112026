const { randomUUID } = require('node:crypto');

function createDocumentsService({ documentsRepository }) {
  async function upload(file, owner) {
    if (!file) {
      throw createError(400, 'VALIDATION_ERROR', 'Envie um arquivo no campo "file".');
    }

    if (file.size === 0) {
      await documentsRepository.removeStoredFile(file.filename);
      throw createError(400, 'VALIDATION_ERROR', 'Arquivos vazios não são permitidos.');
    }

    const document = {
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner,
      storageName: file.filename,
    };

    try {
      documentsRepository.add(document);
    } catch (error) {
      await documentsRepository.removeStoredFile(file.filename);
      throw error;
    }

    return toPublicDocument(document);
  }

  function list(owner) {
    return documentsRepository.listByOwner(owner).map(toPublicDocument);
  }

  async function getDownload(id, owner) {
    const result = await documentsRepository.findAvailableByIdAndOwner(id, owner);

    if (!result) {
      throw createError(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }

    return result;
  }

  return { upload, list, getDownload };
}

function toPublicDocument(document) {
  const { storageName, ...publicDocument } = document;
  return publicDocument;
}

function createError(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

module.exports = createDocumentsService;