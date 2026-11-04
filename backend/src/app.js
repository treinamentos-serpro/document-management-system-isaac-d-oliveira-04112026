const fs = require('node:fs');
const express = require('express');
const path = require('node:path');
const createDocumentsRepository = require('./repositories/documents.repository');
const createDocumentsRouter = require('./routes/documents.routes');
const createDocumentsService = require('./services/documents.service');

const app = express();
const PORT = process.env.PORT || 3000;
const storageDirectory = path.resolve(
  process.env.STORAGE_DIR || path.join(__dirname, '../storage'),
);
const configuredMaxFileSize = Number(process.env.MAX_FILE_SIZE_BYTES || 10485760);

if (!Number.isSafeInteger(configuredMaxFileSize) || configuredMaxFileSize < 1) {
  throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
}

fs.mkdirSync(storageDirectory, { recursive: true });

const documentsRepository = createDocumentsRepository({ storageDirectory });
const documentsService = createDocumentsService({ documentsRepository });

app.use(express.json());
app.use(createDocumentsRouter({
  documentsService,
  storageDirectory,
  maxFileSizeBytes: configuredMaxFileSize,
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error.name === 'MulterError') {
    const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE';
    const isUnexpectedFile = error.code === 'LIMIT_UNEXPECTED_FILE';

    res.status(isFileTooLarge ? 413 : 400).json({
      error: {
        code: isFileTooLarge ? 'FILE_TOO_LARGE' : 'VALIDATION_ERROR',
        message: isFileTooLarge
          ? 'O arquivo excede o tamanho máximo permitido.'
          : isUnexpectedFile
            ? 'Envie um único arquivo no campo "file".'
            : 'Não foi possível processar o arquivo enviado.',
      },
    });
    return;
  }

  res.status(error.statusCode || 500).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.statusCode ? error.message : 'Ocorreu um erro interno.',
    },
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
