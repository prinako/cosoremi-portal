exports.health = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await req.app.locals.db.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
};
