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

fs.mkdirSync(storageDirectory, { recursive: true, mode: 0o700 });

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
    const isUnexpectedField = error.code === 'LIMIT_FIELD_COUNT';
    let code = 'VALIDATION_ERROR';
    let message = 'Não foi possível processar o arquivo enviado.';

    if (isFileTooLarge) {
      code = 'FILE_TOO_LARGE';
      message = 'O arquivo excede o tamanho máximo permitido.';
    } else if (isUnexpectedFile) {
      message = 'Envie um único arquivo no campo "file".';
    } else if (isUnexpectedField) {
      message = 'Campos adicionais não são permitidos.';
    }

    res.status(isFileTooLarge ? 413 : 400).json({
      error: {
        code,
        message,
      },
    });
    return;
  }

  const isStorageError = typeof error.syscall === 'string';

  res.status(error.statusCode || 500).json({
    error: {
      code: error.statusCode ? error.code : isStorageError ? 'STORAGE_ERROR' : 'INTERNAL_ERROR',
      message: error.statusCode
        ? error.message
        : isStorageError
          ? 'Não foi possível acessar o armazenamento de documentos.'
          : 'Ocorreu um erro interno.',
    },
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DMS backend ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
