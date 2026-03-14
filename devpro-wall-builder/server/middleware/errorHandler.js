export function errorHandler(err, req, res, next) {
  console.error(`[${req.method} ${req.path}]`, err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}
