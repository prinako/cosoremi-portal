const slugify = require('slugify');
module.exports = (value) =>
  slugify(value, { lower: true, strict: true, locale: 'pt' }).slice(0, 180);
