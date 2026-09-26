export default (value, size = 12) => {
  const parsed =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : 1;
  const page = Math.min(10000, Math.max(1, parsed));
  return { page, take: size, skip: (page - 1) * size };
};
