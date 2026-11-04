const fs = require('node:fs/promises');
const path = require('node:path');

function createDocumentsRepository({ storageDirectory }) {
  const documents = new Map();
  const resolvedStorageDirectory = path.resolve(storageDirectory);

  function resolveStoredFilePath(storageName) {
    const isUuid = typeof storageName === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storageName);
    if (!isUuid) return null;

    const filePath = path.resolve(resolvedStorageDirectory, storageName);
    const relativePath = path.relative(resolvedStorageDirectory, filePath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return null;
    }

    return filePath;
  }

  function add(document) {
    if (documents.has(document.id)) {
      throw new Error('Identificador de documento duplicado.');
    }

    documents.set(document.id, { ...document });
  }

  function listByOwner(owner) {
    return Array.from(documents.values())
      .filter((document) => document.owner === owner)
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
      .map((document) => ({ ...document }));
  }

  async function findAvailableByIdAndOwner(id, owner) {
    const document = documents.get(id);

    if (!document || document.owner !== owner) {
      return null;
    }

    const filePath = resolveStoredFilePath(document.storageName);
    if (!filePath) return null;

    try {
      const fileStats = await fs.stat(filePath);
      if (!fileStats.isFile()) {
        return null;
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    return { document: { ...document }, filePath };
  }

  async function removeStoredFile(storageName) {
    if (!storageName) return;
    const filePath = resolveStoredFilePath(storageName);
    if (!filePath) return;

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return { add, listByOwner, findAvailableByIdAndOwner, removeStoredFile };
}

module.exports = createDocumentsRepository;