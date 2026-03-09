const PROJECTS_KEY = 'devpro-projects';
const LEGACY_KEY = 'devpro-saved-walls';

function projectWallsKey(projectId) {
  return `devpro-project-${projectId}`;
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
}

// ── Walls within a project ──

export function getProjectWalls(projectId) {
  return (readJson(projectWallsKey(projectId)) || []).sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
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
  syncWallCount(projectId);
}

// ── Archive (export/import as JSON zip) ──

export async function exportProject(projectId) {
  const JSZip = (await import('jszip')).default;
  const projects = getProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) throw new Error('Project not found');

  const walls = getProjectWalls(projectId);
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify({ ...project, exportedAt: Date.now() }, null, 2));
  zip.file('walls.json', JSON.stringify(walls, null, 2));

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

  // Assign fresh wall IDs too
  const walls = wallsData.map(w => ({
    ...w,
    id: crypto.randomUUID(),
  }));

  const projects = getProjects();
  projects.push(project);
  saveProjects(projects);
  localStorage.setItem(projectWallsKey(newId), JSON.stringify(walls));

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
