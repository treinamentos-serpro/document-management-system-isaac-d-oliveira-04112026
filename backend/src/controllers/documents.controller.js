const path = require('node:path');

function createDocumentsController({ documentsService }) {
  function requireUser(req, res, next) {
    const userId = req.get('X-User-Id')?.trim();

    if (!userId || userId.length > 128) {
      res.status(401).json({
        error: {
          code: 'USER_REQUIRED',
          message: 'Informe um identificador de usuário válido.',
        },
      });
      return;
    }

    req.userId = userId;
    next();
  }

  async function upload(req, res) {
    const document = await documentsService.upload(req.file, req.userId);
    res.status(201).json(document);
  }

  function list(req, res) {
    res.json(documentsService.list(req.userId));
  }

  async function download(req, res, next) {
    const result = await documentsService.getDownload(req.params.id, req.userId);
    const safeName = path.basename(result.document.originalName.replace(/\\/g, '/'))
      .replace(/[\r\n]/g, '') || 'document';

    res.setHeader('Content-Type', 'application/octet-stream');
    res.download(result.filePath, safeName, (error) => {
      if (error) {
        next(error);
      }
    });
  }

  return { requireUser, upload, list, download };
}

module.exports = createDocumentsController;