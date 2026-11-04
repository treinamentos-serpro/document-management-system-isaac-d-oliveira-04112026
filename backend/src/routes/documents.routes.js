const { randomUUID } = require('node:crypto');
const multer = require('multer');
const express = require('express');
const createDocumentsController = require('../controllers/documents.controller');

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
    },
  });

  router.post('/upload', controller.requireUser, upload.single('file'), controller.upload);
  router.get('/documents', controller.requireUser, controller.list);
  router.get('/documents/:id/download', controller.requireUser, controller.download);

  return router;
}

module.exports = createDocumentsRouter;