const API_BASE = '/api/projects';

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPut(url, body) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// ── Projects ──

export async function getProjects() {
  return apiGet(API_BASE);
}

export async function createProject(name) {
  return apiPost(API_BASE, { name });
}

export async function renameProject(id, name) {
  return apiPut(`${API_BASE}/${id}`, { name });
}

export async function updateProjectDetails(id, fields) {
  return apiPut(`${API_BASE}/${id}`, fields);
}

export async function deleteProject(id) {
  return apiDelete(`${API_BASE}/${id}`);
}

// ── Walls within a project ──

export async function getProjectWalls(projectId) {
  return apiGet(`${API_BASE}/${projectId}/walls`);
}

export async function saveWall(projectId, wallInput) {
  const id = wallInput.id || crypto.randomUUID();
  const entry = { ...wallInput, id };
  return apiPut(`${API_BASE}/${projectId}/walls/${id}`, entry);
}

export async function deleteWall(projectId, wallId) {
  return apiDelete(`${API_BASE}/${projectId}/walls/${wallId}`);
}

export async function copyWallToProject(wall, targetProjectId) {
  return apiPost(`${API_BASE}/${targetProjectId}/walls/copy`, {
    wall,
    targetProjectId,
  });
}

// ── Floors within a project ──

export async function getProjectFloors(projectId) {
  return apiGet(`${API_BASE}/${projectId}/floors`);
}

export async function saveFloor(projectId, floorInput) {
  const id = floorInput.id || crypto.randomUUID();
  const entry = { ...floorInput, id };
  return apiPut(`${API_BASE}/${projectId}/floors/${id}`, entry);
}

export async function deleteFloor(projectId, floorId) {
  return apiDelete(`${API_BASE}/${projectId}/floors/${floorId}`);
}

// ── Roofs within a project ──

export async function getProjectRoofs(projectId) {
  return apiGet(`${API_BASE}/${projectId}/roofs`);
}

export async function saveRoof(projectId, roofInput) {
  const id = roofInput.id || crypto.randomUUID();
  const entry = { ...roofInput, id };
  return apiPut(`${API_BASE}/${projectId}/roofs/${id}`, entry);
}

export async function deleteRoof(projectId, roofId) {
  return apiDelete(`${API_BASE}/${projectId}/roofs/${roofId}`);
}

// ── Connections (wall snap layout) ──

export async function getProjectConnections(projectId) {
  return apiGet(`${API_BASE}/${projectId}/connections`);
}

export async function saveProjectConnections(projectId, connections) {
  return apiPut(`${API_BASE}/${projectId}/connections/_`, connections);
}

// ── Placements (which walls are placed in the 3D scene) ──

export async function getProjectPlacements(projectId) {
  return apiGet(`${API_BASE}/${projectId}/placements`);
}

export async function saveProjectPlacements(projectId, placedWallIds) {
  return apiPut(`${API_BASE}/${projectId}/placements/_`, placedWallIds);
}

// ── Wall Positions (manual positions for standalone walls in 3D) ──

export async function getProjectWallPositions(projectId) {
  return apiGet(`${API_BASE}/${projectId}/wall-positions`);
}

export async function saveProjectWallPositions(projectId, positions) {
  return apiPut(`${API_BASE}/${projectId}/wall-positions/_`, positions);
}

// ── H1 Compliance Data ──

export async function getProjectH1(projectId) {
  return apiGet(`${API_BASE}/${projectId}/h1`);
}

export async function saveProjectH1(projectId, h1Data) {
  return apiPut(`${API_BASE}/${projectId}/h1/_`, h1Data);
}

// ── Archive (export/import as JSON zip) ──

export async function exportProject(projectId) {
  const JSZip = (await import('jszip')).default;
  const [projects, walls, connections, floors, roofs, h1Data] = await Promise.all([
    getProjects(),
    getProjectWalls(projectId),
    getProjectConnections(projectId),
    getProjectFloors(projectId),
    getProjectRoofs(projectId),
    getProjectH1(projectId),
  ]);
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error('Project not found');

  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({ ...project, exportedAt: Date.now() }, null, 2));
  zip.file('walls.json', JSON.stringify(walls, null, 2));
  zip.file('connections.json', JSON.stringify(connections, null, 2));
  zip.file('floors.json', JSON.stringify(floors, null, 2));
  zip.file('roofs.json', JSON.stringify(roofs, null, 2));
  if (h1Data) {
    zip.file('h1.json', JSON.stringify(h1Data, null, 2));
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.devpro`;
  a.click();
  URL.revokeObjectURL(url);
}

function isPositiveNumber(v) {
  return typeof v === 'number' && isFinite(v) && v > 0;
}

function validateWallData(wall) {
  if (!wall || typeof wall !== 'object') return false;
  if (!isPositiveNumber(wall.length_mm)) return false;
  if (!isPositiveNumber(wall.height_mm)) return false;
  if (wall.openings != null && !Array.isArray(wall.openings)) return false;
  return true;
}

function validateConnectionData(conn) {
  if (!conn || typeof conn !== 'object') return false;
  if (typeof conn.wallId !== 'string' || typeof conn.attachedWallId !== 'string') return false;
  if (!['left', 'right'].includes(conn.anchorEnd)) return false;
  if (!['left', 'right'].includes(conn.attachedEnd)) return false;
  if (![0, 90, 180, 270].includes(conn.angleDeg)) return false;
  return true;
}

export async function importProject(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const projectJson = await zip.file('project.json')?.async('string');
  const wallsJson = await zip.file('walls.json')?.async('string');
  if (!projectJson || !wallsJson) throw new Error('Invalid .devpro file');

  const projectData = JSON.parse(projectJson);
  const wallsData = JSON.parse(wallsJson);

  if (!projectData || typeof projectData.name !== 'string') {
    throw new Error('Invalid .devpro file: missing project name');
  }
  if (!Array.isArray(wallsData)) {
    throw new Error('Invalid .devpro file: walls data must be an array');
  }

  const validWalls = wallsData.filter(w => validateWallData(w));
  if (validWalls.length === 0 && wallsData.length > 0) {
    throw new Error('Invalid .devpro file: no valid wall entries found');
  }

  // Create as a new project with a fresh ID
  const newId = crypto.randomUUID();
  const project = await apiPost(API_BASE, {
    id: newId,
    name: projectData.name + ' (imported)',
    address: projectData.address || '',
    territorialAuthority: projectData.territorialAuthority || '',
  });

  // Remap wall IDs
  const wallIdMap = new Map();
  const walls = validWalls.map(w => {
    const newWallId = crypto.randomUUID();
    wallIdMap.set(w.id, newWallId);
    return { ...w, id: newWallId };
  });

  // Import connections
  const connectionsJson = await zip.file('connections.json')?.async('string');
  const connectionsData = connectionsJson ? JSON.parse(connectionsJson) : [];
  const validConnections = Array.isArray(connectionsData)
    ? connectionsData.filter(c => validateConnectionData(c))
    : [];
  const connections = validConnections.map(c => ({
    ...c,
    id: crypto.randomUUID(),
    wallId: wallIdMap.get(c.wallId) || c.wallId,
    attachedWallId: wallIdMap.get(c.attachedWallId) || c.attachedWallId,
  }));

  // Import floors
  const floorsJson = await zip.file('floors.json')?.async('string');
  const floorsData = floorsJson ? JSON.parse(floorsJson) : [];
  const floors = floorsData.map(f => ({ ...f, id: crypto.randomUUID() }));

  // Import roofs
  const roofsJson = await zip.file('roofs.json')?.async('string');
  const roofsData = roofsJson ? JSON.parse(roofsJson) : [];
  const roofs = roofsData.map(r => ({ ...r, id: crypto.randomUUID() }));

  // Save all entities
  const savePromises = [];
  for (const w of walls) {
    savePromises.push(apiPut(`${API_BASE}/${newId}/walls/${w.id}`, w));
  }
  for (const f of floors) {
    savePromises.push(apiPut(`${API_BASE}/${newId}/floors/${f.id}`, f));
  }
  for (const r of roofs) {
    savePromises.push(apiPut(`${API_BASE}/${newId}/roofs/${r.id}`, r));
  }
  if (connections.length > 0) {
    savePromises.push(apiPut(`${API_BASE}/${newId}/connections/_`, connections));
  }
  await Promise.all(savePromises);

  // Import H1 data
  const h1Json = await zip.file('h1.json')?.async('string');
  if (h1Json) {
    await apiPut(`${API_BASE}/${newId}/h1/_`, JSON.parse(h1Json));
  }

  return project;
}

// ── Migration: localStorage → SQLite ──

export async function migrateLocalStorageToSqlite() {
  // Already migrated?
  if (localStorage.getItem('devpro-migrated-to-sqlite')) return false;

  const projectsRaw = localStorage.getItem('devpro-projects');
  if (!projectsRaw) return false;

  let projects;
  try {
    projects = JSON.parse(projectsRaw);
  } catch {
    return false;
  }
  if (!Array.isArray(projects) || projects.length === 0) return false;

  // Collect all data
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('devpro-') && key !== 'devpro-migrated-to-sqlite') {
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        // skip unparseable
      }
    }
  }

  // Send to migration endpoint
  await apiPost(`${API_BASE}/migrate`, { projects, data });

  // Mark as migrated
  localStorage.setItem('devpro-migrated-to-sqlite', 'true');

  // Clean up old keys
  const keysToRemove = Object.keys(data);
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  return true;
}

// ── Legacy migration (flat walls → project) — now a no-op ──
export function migrateLegacyWalls() {
  // Legacy migration is handled by migrateLocalStorageToSqlite
  return null;
}
