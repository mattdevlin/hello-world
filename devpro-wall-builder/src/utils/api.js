const API_BASE = '/api';

async function request(method, path, body) {
  const options = {
    method,
    headers: {},
  };

  if (body != null) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json();

  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};
