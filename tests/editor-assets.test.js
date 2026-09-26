import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.join(import.meta.dirname, '..');
const vendor = path.join(root, 'public', 'vendor', 'editorjs');

test('self-hosted editor assets match the pinned dependency manifest', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8')
  );
  const expected = {
    'editorjs.mjs': ['@editorjs/editorjs', '2.31.7', 'Apache-2.0'],
    'header.mjs': ['@editorjs/header', '2.8.9', 'MIT'],
    'list.mjs': ['@editorjs/list', '2.0.9', 'MIT'],
    'quote.mjs': ['@editorjs/quote', '2.7.6', 'MIT'],
    'delimiter.mjs': ['@editorjs/delimiter', '1.4.2', 'MIT'],
  };
  assert.deepEqual(Object.keys(manifest).sort(), Object.keys(expected).sort());
  for (const [filename, [packageName, version, license]] of Object.entries(
    expected
  )) {
    const content = fs.readFileSync(path.join(vendor, filename));
    assert.deepEqual(
      [
        manifest[filename].package,
        manifest[filename].version,
        manifest[filename].license,
      ],
      [packageName, version, license]
    );
    assert.equal(
      manifest[filename].sha256,
      crypto.createHash('sha256').update(content).digest('hex')
    );
  }
});

test('admin editor loads only local approved tools', () => {
  const source = fs.readFileSync(
    path.join(root, 'public', 'js', 'admin-rich-content.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /https?:\/\//);
  for (const asset of Object.keys(
    JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8'))
  ))
    assert.match(source, new RegExp(`/vendor/editorjs/${asset}`));
  assert.doesNotMatch(source, /raw|embed|image\.mjs/i);
  assert.match(source, /tool\.data\?\.style !== 'checklist'/);
  assert.match(source, /await editor\.isReady;[\s\S]+restoreCreateElement\(\)/);
});
