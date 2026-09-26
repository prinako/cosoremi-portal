import multer from 'multer';

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 30,
    fieldSize: 300000,
    parts: 32,
  },
});

const image = uploader.single('image');
image.logo = uploader.single('logo');

export default image;
