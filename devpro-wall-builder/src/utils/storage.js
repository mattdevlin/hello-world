const PROJECTS_KEY = 'devpro-projects';
const LEGACY_KEY = 'devpro-saved-walls';

function projectWallsKey(projectId) {
  return `devpro-project-${projectId}`;
}

function projectConnectionsKey(projectId) {
  return `devpro-project-${projectId}-connections`;
}

function projectPlacementsKey(projectId) {
  return `devpro-project-${projectId}-placements`;
}

function projectWallPositionsKey(projectId) {
  return `devpro-project-${projectId}-wallpositions`;
}

function projectFloorsKey(projectId) {
  return `devpro-project-${projectId}-floors`;
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Projects ──

export function getProjects() {
  return (readJson(PROJECTS_KEY) || []).sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
  );
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function createProject(name) {
  const projects = getProjects();
  const project = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    wallCount: 0,
  };
  projects.push(project);
  saveProjects(projects);
  localStorage.setItem(projectWallsKey(project.id), JSON.stringify([]));
  return project;
}

export function renameProject(id, name) {
  const projects = getProjects();
  const p = projects.find(p => p.id === id);
  if (p) {
    p.name = name;
    p.updatedAt = Date.now();
    saveProjects(projects);
  }
}

export function deleteProject(id) {
  const projects = getProjects().filter(p => p.id !== id);
  saveProjects(projects);
  localStorage.removeItem(projectWallsKey(id));
  localStorage.removeItem(projectFloorsKey(id));
}

// ── Walls within a project ──

export function getProjectWalls(projectId) {
  return (readJson(projectWallsKey(projectId)) || []).sort(
    (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
  );
}

function syncWallCount(projectId) {
  const walls = getProjectWalls(projectId);
  const projects = getProjects();
  const p = projects.find(p => p.id === projectId);
  if (p) {
    p.wallCount = walls.length;
    p.updatedAt = Date.now();
    saveProjects(projects);
  }
}

export function saveWall(projectId, wallInput) {
  const walls = getProjectWalls(projectId);
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
  localStorage.setItem(projectWallsKey(projectId), JSON.stringify(walls));
  syncWallCount(projectId);
  return entry;
}

export function deleteWall(projectId, wallId) {
  const walls = getProjectWalls(projectId).filter(w => w.id !== wallId);
  localStorage.setItem(projectWallsKey(projectId), JSON.stringify(walls));
  // Remove any connections referencing the deleted wall
  const connections = getProjectConnections(projectId)
    .filter(c => c.wallId !== wallId && c.attachedWallId !== wallId);
  saveProjectConnections(projectId, connections);
  // Remove from placements
  const placements = getProjectPlacements(projectId).filter(id => id !== wallId);
  saveProjectPlacements(projectId, placements);
  // Remove stored position
  const positions = getProjectWallPositions(projectId);
  delete positions[wallId];
  saveProjectWallPositions(projectId, positions);
  syncWallCount(projectId);
}

export function copyWallToProject(wall, targetProjectId) {
  const copy = {
    ...wall,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const walls = getProjectWalls(targetProjectId);
  walls.push(copy);
  localStorage.setItem(projectWallsKey(targetProjectId), JSON.stringify(walls));
  syncWallCount(targetProjectId);
  return copy;
}

// ── Floors within a project ──

export function getProjectFloors(projectId) {
  return (readJson(projectFloorsKey(projectId)) || []).sort(
    (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' })
  );
}

function syncFloorCount(projectId) {
  const floors = getProjectFloors(projectId);
  const projects = getProjects();
  const p = projects.find(p => p.id === projectId);
  if (p) {
    p.floorCount = floors.length;
    p.updatedAt = Date.now();
    saveProjects(projects);
  }
}

export function saveFloor(projectId, floorInput) {
  const floors = getProjectFloors(projectId);
  const existing = floors.findIndex(f => f.id === floorInput.id);
  const entry = {
    ...floorInput,
    id: floorInput.id || crypto.randomUUID(),
    updatedAt: Date.now(),
  };
  if (!entry.createdAt) entry.createdAt = Date.now();

  if (existing >= 0) {
    floors[existing] = entry;
  } else {
    floors.push(entry);
  }
  localStorage.setItem(projectFloorsKey(projectId), JSON.stringify(floors));
  syncFloorCount(projectId);
  return entry;
}

export function deleteFloor(projectId, floorId) {
  const floors = getProjectFloors(projectId).filter(f => f.id !== floorId);
  localStorage.setItem(projectFloorsKey(projectId), JSON.stringify(floors));
  syncFloorCount(projectId);
}

// ── Connections (wall snap layout) ──

export function getProjectConnections(projectId) {
  return readJson(projectConnectionsKey(projectId)) || [];
}

export function saveProjectConnections(projectId, connections) {
  localStorage.setItem(projectConnectionsKey(projectId), JSON.stringify(connections));
}

// ── Placements (which walls are placed in the 3D scene) ──

export function getProjectPlacements(projectId) {
  return readJson(projectPlacementsKey(projectId)) || [];
}

export function saveProjectPlacements(projectId, placedWallIds) {
  localStorage.setItem(projectPlacementsKey(projectId), JSON.stringify(placedWallIds));
}

// ── Wall Positions (manual positions for standalone walls in 3D) ──

export function getProjectWallPositions(projectId) {
  return readJson(projectWallPositionsKey(projectId)) || {};
}

export function saveProjectWallPositions(projectId, positions) {
  localStorage.setItem(projectWallPositionsKey(projectId), JSON.stringify(positions));
}

// ── Archive (export/import as JSON zip) ──

export async function exportProject(projectId) {
  const JSZip = (await import('jszip')).default;
  const projects = getProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error('Project not found');

  const walls = getProjectWalls(projectId);
  const connections = getProjectConnections(projectId);
  const floors = getProjectFloors(projectId);
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({ ...project, exportedAt: Date.now() }, null, 2));
  zip.file('walls.json', JSON.stringify(walls, null, 2));
  zip.file('connections.json', JSON.stringify(connections, null, 2));
  zip.file('floors.json', JSON.stringify(floors, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.devpro`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importProject(file) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const projectJson = await zip.file('project.json')?.async('string');
  const wallsJson = await zip.file('walls.json')?.async('string');
  if (!projectJson || !wallsJson) throw new Error('Invalid .devpro file');

  const projectData = JSON.parse(projectJson);
  const wallsData = JSON.parse(wallsJson);

  // Create as a new project with a fresh ID to avoid collisions
  const newId = crypto.randomUUID();
  const project = {
    id: newId,
    name: projectData.name + ' (imported)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    wallCount: wallsData.length,
  };

  // Import connections if present (backward compatible with older exports)
  const connectionsJson = await zip.file('connections.json')?.async('string');
  const connectionsData = connectionsJson ? JSON.parse(connectionsJson) : [];

  // Import floors if present (backward compatible with older exports)
  const floorsJson = await zip.file('floors.json')?.async('string');
  const floorsData = floorsJson ? JSON.parse(floorsJson) : [];

  // Remap wall IDs in connections
  const wallIdMap = new Map();
  const walls = wallsData.map(w => {
    const newWallId = crypto.randomUUID();
    wallIdMap.set(w.id, newWallId);
    return { ...w, id: newWallId };
  });
  const connections = connectionsData.map(c => ({
    ...c,
    id: crypto.randomUUID(),
    wallId: wallIdMap.get(c.wallId) || c.wallId,
    attachedWallId: wallIdMap.get(c.attachedWallId) || c.attachedWallId,
  }));

  // Remap floor IDs
  const floors = floorsData.map(f => ({
    ...f,
    id: crypto.randomUUID(),
  }));

  project.floorCount = floors.length;

  const projects = getProjects();
  projects.push(project);
  saveProjects(projects);
  localStorage.setItem(projectWallsKey(newId), JSON.stringify(walls));
  if (floors.length > 0) {
    localStorage.setItem(projectFloorsKey(newId), JSON.stringify(floors));
  }
  if (connections.length > 0) {
    saveProjectConnections(newId, connections);
  }

  return project;
}

// ── Migration: move legacy flat walls into a default project ──

export function migrateLegacyWalls() {
  const legacy = readJson(LEGACY_KEY);
  if (!legacy || legacy.length === 0) return null;

  const project = createProject('Imported Walls');
  localStorage.setItem(projectWallsKey(project.id), JSON.stringify(legacy));
  project.wallCount = legacy.length;

  const projects = getProjects();
  const p = projects.find(p => p.id === project.id);
  if (p) p.wallCount = legacy.length;
  saveProjects(projects);

  localStorage.removeItem(LEGACY_KEY);
  return project;
}
