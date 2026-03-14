export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  console.error(`[${req.method} ${req.path}]`, status >= 500 ? err.stack : err.message);
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : (err.message || 'Internal server error'),
  });
}
