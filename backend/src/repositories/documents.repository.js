const fs = require('node:fs/promises');
const path = require('node:path');

function createDocumentsRepository({ storageDirectory }) {
  const documents = new Map();

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

    const filePath = path.join(storageDirectory, document.storageName);

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

    try {
      await fs.unlink(path.join(storageDirectory, storageName));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return { add, listByOwner, findAvailableByIdAndOwner, removeStoredFile };
}

module.exports = createDocumentsRepository;