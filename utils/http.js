exports.asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
exports.httpError = (status, message) =>
  Object.assign(new Error(message), { status });
