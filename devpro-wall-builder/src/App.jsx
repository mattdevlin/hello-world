import { useState, useEffect } from 'react';
import WallForm from './components/WallForm.jsx';
import WallDrawing from './components/WallDrawing.jsx';
import WallSummary from './components/WallSummary.jsx';
import PanelPlans from './components/PanelPlans.jsx';
import FramingElevation from './components/FramingElevation.jsx';
import EpsElevation from './components/EpsElevation.jsx';
import EpsCutPlans from './components/EpsCutPlans.jsx';
import Offcuts from './components/Offcuts.jsx';
import ProjectManager from './components/ProjectManager.jsx';
import { calculateWallLayout } from './utils/calculator.js';
import {
  getProjects, createProject, renameProject, deleteProject,
  getProjectWalls, saveWall, deleteWall, copyWallToProject,
  exportProject, importProject, migrateLegacyWalls,
} from './utils/storage.js';

function App() {
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeWalls, setActiveWalls] = useState([]);
  const [showProjects, setShowProjects] = useState(false);

  const [layout, setLayout] = useState(null);
  const [wallName, setWallName] = useState('');
  const [wallInput, setWallInput] = useState(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    // Migrate any legacy flat walls into a project
    const migrated = migrateLegacyWalls();
    if (migrated) {
      setActiveProjectId(migrated.id);
    }
    refreshProjects();
  }, []);

  // Load walls whenever the active project changes
  useEffect(() => {
    if (activeProjectId) {
      setActiveWalls(getProjectWalls(activeProjectId));
    } else {
      setActiveWalls([]);
    }
  }, [activeProjectId]);

  const refreshProjects = () => {
    const ps = getProjects();
    setProjects(ps);
    // If no active project, select the first one
    setActiveProjectId(prev => {
      if (prev && ps.find(p => p.id === prev)) return prev;
      return ps.length > 0 ? ps[0].id : null;
    });
  };

  const refreshWalls = () => {
    if (activeProjectId) {
      setActiveWalls(getProjectWalls(activeProjectId));
    }
    setProjects(getProjects());
  };

  const handleCalculate = (wall) => {
    const result = calculateWallLayout(wall);
    setLayout(result);
    setWallName(wall.name);
    setWallInput(wall);
  };

  const handleSave = () => {
    if (!wallInput || !activeProjectId) return;
    const saved = saveWall(activeProjectId, wallInput);
    setWallInput(saved);
    refreshWalls();
  };

  const handleNewWall = () => {
    setWallInput(null);
    setLayout(null);
    setWallName('');
    setLoadKey(k => k + 1);
  };

  const handleLoadWall = (wall) => {
    setWallInput(wall);
    setLoadKey(k => k + 1);
    const result = calculateWallLayout(wall);
    setLayout(result);
    setWallName(wall.name);
  };

  const handleCreateProject = (name) => {
    const p = createProject(name);
    setActiveProjectId(p.id);
    refreshProjects();
  };

  const handleSelectProject = (id) => {
    setActiveProjectId(id);
  };

  const handleRenameProject = (id, name) => {
    renameProject(id, name);
    refreshProjects();
  };

  const handleDeleteProject = (id) => {
    deleteProject(id);
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setActiveWalls([]);
    }
    refreshProjects();
  };

  const handleDeleteWall = (projectId, wallId) => {
    deleteWall(projectId, wallId);
    refreshWalls();
  };

  const handleCopyWall = (wall, targetProjectId) => {
    copyWallToProject(wall, targetProjectId);
    refreshProjects();
    // If the target is the active project, refresh its wall list too
    if (targetProjectId === activeProjectId) {
      setActiveWalls(getProjectWalls(activeProjectId));
    }
  };

  const handleExport = async (id) => {
    try {
      await exportProject(id);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleImport = async (file) => {
    try {
      const p = await importProject(file);
      setActiveProjectId(p.id);
      refreshProjects();
    } catch (err) {
      console.error('Import failed:', err);
    }
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>DEVPRO Wall Builder</h1>
            <p style={styles.subtitle}>
              {activeProject
                ? `Project: ${activeProject.name} — ${activeProject.wallCount} wall${activeProject.wallCount !== 1 ? 's' : ''}`
                : 'SIP panel layout tool'}
            </p>
          </div>
          <div style={styles.headerActions}>
            {activeProjectId && (
              <button onClick={handleNewWall} style={styles.newBtn}>
                + New Wall
              </button>
            )}
            {wallInput && activeProjectId && (
              <button onClick={handleSave} style={styles.saveBtn}>
                Save Wall
              </button>
            )}
            <button
              onClick={() => setShowProjects(!showProjects)}
              style={styles.loadBtn}
            >
              {showProjects ? 'Close' : 'Projects'}{' '}
              {projects.length > 0 && `(${projects.length})`}
            </button>
          </div>
        </div>
      </header>

      {showProjects && (
        <ProjectManager
          projects={projects}
          activeProjectId={activeProjectId}
          activeWalls={activeWalls}
          getWallsForProject={getProjectWalls}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
          onLoadWall={handleLoadWall}
          onDeleteWall={handleDeleteWall}
          onCopyWall={handleCopyWall}
          onExportProject={handleExport}
          onImportProject={handleImport}
        />
      )}

      <main style={styles.main}>
        {!activeProjectId && !showProjects && (
          <div style={styles.noProject}>
            <p>No project selected.</p>
            <button onClick={() => setShowProjects(true)} style={styles.openProjectsBtn}>
              Open Projects
            </button>
          </div>
        )}

        <WallForm
          key={loadKey}
          onCalculate={handleCalculate}
          onChange={setWallInput}
          initialWall={wallInput}
        />

        {layout && (
          <>
            <WallDrawing layout={layout} wallName={wallName} />
            <FramingElevation layout={layout} wallName={wallName} />
            <EpsElevation layout={layout} wallName={wallName} />
            <PanelPlans layout={layout} wallName={wallName} />
            <EpsCutPlans layout={layout} wallName={wallName} />
            <Offcuts layout={layout} wallName={wallName} />
            <WallSummary layout={layout} wallName={wallName} />
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    background: '#f0f2f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    background: '#2C5F8A',
    padding: '20px 32px',
    color: '#fff',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1280,
    margin: '0 auto',
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 14,
    opacity: 0.8,
  },
  headerActions: {
    display: 'flex',
    gap: 8,
  },
  newBtn: {
    padding: '8px 20px',
    background: '#e67e22',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  saveBtn: {
    padding: '8px 20px',
    background: '#27ae60',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  loadBtn: {
    padding: '8px 20px',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  noProject: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#888',
  },
  openProjectsBtn: {
    marginTop: 12,
    padding: '10px 24px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  main: {
    maxWidth: 1280,
    margin: '24px auto',
    padding: '0 24px',
  },
};

export default App;
