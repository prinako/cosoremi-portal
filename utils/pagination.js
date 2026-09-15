module.exports = (value, size = 12) => {
  const page = Math.min(10000, Math.max(1, Number.parseInt(value, 10) || 1));
  return { page, take: size, skip: (page - 1) * size };
};
