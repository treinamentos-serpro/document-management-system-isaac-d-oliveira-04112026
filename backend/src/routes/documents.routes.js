const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const multer = require('multer');
const express = require('express');
const createDocumentsController = require('../controllers/documents.controller');

async function restrictUploadedFilePermissions(req, res, next) {
  if (!req.file) return next();

  try {
    await fs.chmod(req.file.path, 0o600);
    next();
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    next(error);
  }
}

function createDocumentsRouter({ documentsService, storageDirectory, maxFileSizeBytes }) {
  const router = express.Router();
  const controller = createDocumentsController({ documentsService });
  const upload = multer({
    storage: multer.diskStorage({
      destination: storageDirectory,
      filename: (req, file, callback) => callback(null, randomUUID()),
    }),
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
      fields: 0,
    },
  });

  router.post(
    '/upload',
    controller.requireUser,
    upload.single('file'),
    restrictUploadedFilePermissions,
    controller.upload,
  );
  router.get('/documents', controller.requireUser, controller.list);
  router.get('/documents/:id/download', controller.requireUser, controller.download);

  return router;
}

module.exports = createDocumentsRouter;