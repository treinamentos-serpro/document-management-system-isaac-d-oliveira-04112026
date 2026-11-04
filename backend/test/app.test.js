const { after, test } = require('node:test');
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
  if (!server.listening) {
    await new Promise((resolve) => server.once('listening', resolve));
  }
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

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
