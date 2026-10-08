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

const settingsUploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
    fields: 30,
    fieldSize: 300000,
    parts: 35,
  },
});
image.settings = settingsUploader.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'socialImage', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
]);

export default image;
