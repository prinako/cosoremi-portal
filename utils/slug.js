import slugify from 'slugify';

export default (value) =>
  slugify(value, { lower: true, strict: true, locale: 'pt' }).slice(0, 180);
