const STORAGE_KEY = 'devpro-saved-walls';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(walls) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(walls));
}

export function saveWall(wallInput) {
  const walls = readAll();
  const existing = walls.findIndex(w => w.id === wallInput.id);
  const entry = {
    ...wallInput,
    id: wallInput.id || crypto.randomUUID(),
    updatedAt: Date.now(),
  };
  if (!entry.createdAt) entry.createdAt = Date.now();

  if (existing >= 0) {
    walls[existing] = entry;
  } else {
    walls.push(entry);
  }
  writeAll(walls);
  return entry;
}

export function loadWalls() {
  return readAll().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function deleteWall(id) {
  const walls = readAll().filter(w => w.id !== id);
  writeAll(walls);
}
