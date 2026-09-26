import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDirectory = path.join(
  import.meta.dirname,
  '..',
  'public',
  'vendor',
  'editorjs'
);
const assets = [
  ['@editorjs/editorjs', 'dist/editorjs.mjs', 'editorjs.mjs'],
  ['@editorjs/header', 'dist/header.mjs', 'header.mjs'],
  ['@editorjs/list', 'dist/editorjs-list.mjs', 'list.mjs'],
  ['@editorjs/quote', 'dist/quote.mjs', 'quote.mjs'],
  ['@editorjs/delimiter', 'dist/delimiter.mjs', 'delimiter.mjs'],
];

await fs.mkdir(outputDirectory, { recursive: true });
const manifest = {};
for (const [packageName, relativeSource, filename] of assets) {
  const packageDirectory = path.dirname(
    path.dirname(fileURLToPath(import.meta.resolve(packageName)))
  );
  const packageJson = JSON.parse(
    await fs.readFile(path.join(packageDirectory, 'package.json'), 'utf8')
  );
  const content = await fs.readFile(
    path.join(packageDirectory, relativeSource)
  );
  await fs.writeFile(path.join(outputDirectory, filename), content);
  manifest[filename] = {
    package: packageName,
    version: packageJson.version,
    license: packageJson.license,
    sha256: crypto.createHash('sha256').update(content).digest('hex'),
  };
}
await fs.writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`
);
