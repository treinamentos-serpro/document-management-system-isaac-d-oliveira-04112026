const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const storageDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
const originalStorageDirectory = process.env.STORAGE_DIR;
const originalMaxFileSize = process.env.MAX_FILE_SIZE_BYTES;
process.env.STORAGE_DIR = storageDirectory;
process.env.MAX_FILE_SIZE_BYTES = '8';

const app = require('../src/app');
const server = app.listen(0);
let baseUrl;

before(async () => {
  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await fsp.rm(storageDirectory, { recursive: true, force: true });

  if (originalStorageDirectory === undefined) {
    delete process.env.STORAGE_DIR;
  } else {
    process.env.STORAGE_DIR = originalStorageDirectory;
  }

  if (originalMaxFileSize === undefined) {
    delete process.env.MAX_FILE_SIZE_BYTES;
  } else {
    process.env.MAX_FILE_SIZE_BYTES = originalMaxFileSize;
  }
});

test('os endpoints de documentos validam upload e isolam os documentos por usuário', async () => {
  const missingUserResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(missingUserResponse.status, 401);
  assert.equal((await missingUserResponse.json()).error.code, 'USER_REQUIRED');

  const emptyForm = new FormData();
  const missingFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: emptyForm,
  });
  assert.equal(missingFileResponse.status, 400);

  const emptyFileForm = new FormData();
  emptyFileForm.append('file', new Blob([]), 'empty.txt');
  const emptyFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: emptyFileForm,
  });
  assert.equal(emptyFileResponse.status, 400);

  const extraFieldForm = new FormData();
  extraFieldForm.append('file', new Blob(['content']), 'extra.txt');
  extraFieldForm.append('metadata', 'unexpected');
  const extraFieldResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: extraFieldForm,
  });
  assert.equal(extraFieldResponse.status, 400);

  const uploadForm = new FormData();
  uploadForm.append('file', new Blob(['content']), '../../sample.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: uploadForm,
  });
  assert.equal(uploadResponse.status, 201, await uploadResponse.clone().text());
  const uploadedDocument = await uploadResponse.json();
  assert.equal(uploadedDocument.originalName, 'sample.txt');
  assert.equal(uploadedDocument.size, 7);
  assert.equal(uploadedDocument.owner, 'alice');
  assert.ok(uploadedDocument.id);
  assert.ok(uploadedDocument.uploadedAt);
  assert.equal(Object.hasOwn(uploadedDocument, 'storageName'), false);

  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'alice' },
  });
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [uploadedDocument]);

  const otherUserListResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'bob' },
  });
  assert.deepEqual(await otherUserListResponse.json(), []);

  const forbiddenDownloadResponse = await fetch(
    `${baseUrl}/documents/${uploadedDocument.id}/download`,
    { headers: { 'X-User-Id': 'bob' } },
  );
  assert.equal(forbiddenDownloadResponse.status, 404);

  const downloadResponse = await fetch(
    `${baseUrl}/documents/${uploadedDocument.id}/download`,
    { headers: { 'X-User-Id': 'alice' } },
  );
  assert.equal(downloadResponse.status, 200);
  assert.equal(downloadResponse.headers.get('content-type'), 'application/octet-stream');
  assert.equal(await downloadResponse.text(), 'content');
  assert.match(downloadResponse.headers.get('content-disposition'), /sample\.txt/);

  const oversizedForm = new FormData();
  oversizedForm.append('file', new Blob(['123456789']), 'large.txt');
  const oversizedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'alice' },
    body: oversizedForm,
  });
  assert.equal(oversizedResponse.status, 413);
  assert.equal((await oversizedResponse.json()).error.code, 'FILE_TOO_LARGE');

  const storedFiles = await fsp.readdir(storageDirectory);
  assert.equal(storedFiles.length, 1);
  const storedFileStats = await fsp.stat(path.join(storageDirectory, storedFiles[0]));
  assert.equal(storedFileStats.mode & 0o777, 0o600);
});

test('upload e download exigem a identificação do usuário', async () => {
  const storedFilesBefore = await fsp.readdir(storageDirectory);
  const uploadForm = new FormData();
  uploadForm.append('file', new Blob(['content']), 'unauthorized.txt');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: uploadForm,
  });
  assert.equal(uploadResponse.status, 401);
  assert.equal((await uploadResponse.json()).error.code, 'USER_REQUIRED');

  const downloadResponse = await fetch(`${baseUrl}/documents/unknown/download`);
  assert.equal(downloadResponse.status, 401);
  assert.equal((await downloadResponse.json()).error.code, 'USER_REQUIRED');
  assert.deepEqual(await fsp.readdir(storageDirectory), storedFilesBefore);
});

test('upload rejeita campo incorreto e múltiplos arquivos sem persistir documentos', async (context) => {
  for (const fields of [['attachment'], ['file', 'file']]) {
    await context.test(fields.join(', '), async () => {
      const storedFilesBefore = await fsp.readdir(storageDirectory);
      const uploadForm = new FormData();
      for (const field of fields) {
        uploadForm.append(field, new Blob(['content']), 'sample.txt');
      }

      const response = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: { 'X-User-Id': 'invalid-upload-user' },
        body: uploadForm,
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error.code, 'VALIDATION_ERROR');
      assert.deepEqual(await fsp.readdir(storageDirectory), storedFilesBefore);

      const listResponse = await fetch(`${baseUrl}/documents`, {
        headers: { 'X-User-Id': 'invalid-upload-user' },
      });
      assert.equal(listResponse.status, 200);
      assert.deepEqual(await listResponse.json(), []);
    });
  }
});

test('listagem retorna uma lista vazia para usuário sem documentos', async () => {
  const response = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'new-user' },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});

test('download de documento inexistente retorna erro 404', async () => {
  const response = await fetch(`${baseUrl}/documents/unknown/download`, {
    headers: { 'X-User-Id': 'alice' },
  });

  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('upload binário permite listar e baixar os bytes originais', async () => {
  const content = Buffer.from([0, 1, 127, 128, 253, 254, 255]);
  const uploadForm = new FormData();
  uploadForm.append('file', new Blob([content]), 'binary.bin');

  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'binary-user' },
    body: uploadForm,
  });
  assert.equal(uploadResponse.status, 201);
  const document = await uploadResponse.json();
  assert.equal(document.originalName, 'binary.bin');
  assert.equal(document.size, content.length);
  assert.equal(document.owner, 'binary-user');

  const listResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'binary-user' },
  });
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), [document]);

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'binary-user' },
  });
  assert.equal(downloadResponse.status, 200);
  assert.equal(downloadResponse.headers.get('content-type'), 'application/octet-stream');
  assert.match(downloadResponse.headers.get('content-disposition'), /binary\.bin/);
  assert.deepEqual(Buffer.from(await downloadResponse.arrayBuffer()), content);
});
