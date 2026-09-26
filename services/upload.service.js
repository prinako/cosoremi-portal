import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { httpError } from '../utils/http.js';

const root = path.join(import.meta.dirname, '..', 'public', 'uploads');
const allowedFolders = new Set(['blog', 'gallery', 'pages', 'branding']);

function uploadStorageError(error) {
  if (error?.code === 'EACCES' || error?.code === 'EROFS')
    return httpError(
      503,
      'O armazenamento de imagens não está gravável. Verifique as permissões do volume de uploads.'
    );
  return error;
}

export const save = async (file, folder) => {
  if (!file) return null;
  if (!allowedFolders.has(folder))
    throw httpError(422, 'Destino de upload inválido.');

  const extensions = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  };

  if (
    !extensions[file.mimetype]?.includes(
      path.extname(file.originalname).toLowerCase()
    )
  )
    throw httpError(422, 'Envie uma imagem JPG, PNG ou WebP.');

  let buffer;
  try {
    const source = sharp(file.buffer, {
      limitInputPixels: 25000000,
      animated: false,
    });
    const metadata = await source.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format))
      throw new Error('Invalid format');

    const maxSize = folder === 'branding' ? 1200 : 2000;
    buffer = await source
      .rotate()
      .resize({
        width: maxSize,
        height: maxSize,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw httpError(422, 'A imagem está inválida ou excede 25 megapixels.');
  }

  const filename = `${randomUUID()}.webp`;
  try {
    await fs.mkdir(path.join(root, folder), { recursive: true });
    await fs.writeFile(path.join(root, folder, filename), buffer, {
      flag: 'wx',
    });
  } catch (error) {
    throw uploadStorageError(error);
  }
  return `/uploads/${folder}/${filename}`;
};

export const remove = async (image) => {
  if (
    !/^\/uploads\/(blog|gallery|pages|branding)\/[a-f\d-]+\.webp$/.test(
      image || ''
    )
  )
    return;

  await fs
    .unlink(path.join(root, image.slice('/uploads/'.length)))
    .catch((err) => {
      if (err.code !== 'ENOENT')
        console.error(
          JSON.stringify({ event: 'upload_cleanup_failed', code: err.code })
        );
    });
};
