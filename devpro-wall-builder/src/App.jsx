import { useState, useEffect } from 'react';
import WallForm from './components/WallForm.jsx';
import WallDrawing from './components/WallDrawing.jsx';
import WallSummary from './components/WallSummary.jsx';
import PanelPlans from './components/PanelPlans.jsx';
import FramingElevation from './components/FramingElevation.jsx';
import EpsElevation from './components/EpsElevation.jsx';
import EpsCutPlans from './components/EpsCutPlans.jsx';
import Offcuts from './components/Offcuts.jsx';
import { calculateWallLayout } from './utils/calculator.js';
import { saveWall, loadWalls, deleteWall } from './utils/storage.js';

function App() {
  const [layout, setLayout] = useState(null);
  const [wallName, setWallName] = useState('');
  const [wallInput, setWallInput] = useState(null);
  const [savedWalls, setSavedWalls] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    setSavedWalls(loadWalls());
  }, []);

  const handleCalculate = (wall) => {
    const result = calculateWallLayout(wall);
    setLayout(result);
    setWallName(wall.name);
    setWallInput(wall);
  };

  const handleSave = () => {
    if (!wallInput) return;
    const saved = saveWall(wallInput);
    setWallInput(saved);
    setSavedWalls(loadWalls());
  };

  const handleLoad = (wall) => {
    setWallInput(wall);
    setLoadKey(k => k + 1);
    const result = calculateWallLayout(wall);
    setLayout(result);
    setWallName(wall.name);
    setShowSaved(false);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    deleteWall(id);
    setSavedWalls(loadWalls());
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>DEVPRO Wall Builder</h1>
            <p style={styles.subtitle}>
              Single wall manufacturing drawing generator — SIP panel layout tool
            </p>
          </div>
          <div style={styles.headerActions}>
            {wallInput && (
              <button onClick={handleSave} style={styles.saveBtn}>
                Save Wall
              </button>
            )}
            <button
              onClick={() => setShowSaved(!showSaved)}
              style={styles.loadBtn}
            >
              {showSaved ? 'Close' : 'Saved Walls'}{' '}
              {savedWalls.length > 0 && `(${savedWalls.length})`}
            </button>
          </div>
        </div>
      </header>

      {showSaved && (
        <div style={styles.savedPanel} data-no-print>
          <h3 style={styles.savedTitle}>Saved Walls</h3>
          {savedWalls.length === 0 ? (
            <p style={styles.emptyText}>No saved walls yet.</p>
          ) : (
            <div style={styles.savedList}>
              {savedWalls.map(w => (
                <div
                  key={w.id}
                  style={styles.savedItem}
                  onClick={() => handleLoad(w)}
                >
                  <div>
                    <strong>{w.name}</strong>
                    <span style={styles.savedMeta}>
                      {' '}{w.length_mm}mm × {w.height_mm}mm
                      {w.openings?.length > 0 && ` · ${w.openings.length} opening${w.openings.length > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div style={styles.savedRight}>
                    <span style={styles.savedDate}>
                      {new Date(w.updatedAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => handleDelete(w.id, e)}
                      style={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <main style={styles.main}>
        <WallForm
          key={loadKey}
          onCalculate={handleCalculate}
          initialWall={wallInput}
        />

        {layout && (
          <>
            <div data-no-print>
              <WallDrawing layout={layout} wallName={wallName} />
              <FramingElevation layout={layout} wallName={wallName} />
              <EpsElevation layout={layout} wallName={wallName} />
            </div>
            <PanelPlans layout={layout} wallName={wallName} />
            <div data-no-print>
              <EpsCutPlans layout={layout} />
              <Offcuts layout={layout} />
              <WallSummary layout={layout} wallName={wallName} />
            </div>
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
  savedPanel: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '16px 24px',
    background: '#fff',
    borderBottom: '1px solid #ddd',
  },
  savedTitle: {
    margin: '0 0 12px 0',
    fontSize: 16,
    color: '#333',
  },
  savedList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  savedItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    background: '#f9f9f9',
    border: '1px solid #e0e0e0',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
  },
  savedMeta: {
    color: '#888',
    fontSize: 12,
    marginLeft: 8,
  },
  savedRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  savedDate: {
    color: '#999',
    fontSize: 12,
  },
  deleteBtn: {
    padding: '4px 10px',
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 11,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    fontSize: 14,
  },
  main: {
    maxWidth: 1280,
    margin: '24px auto',
    padding: '0 24px',
  },
};

export default App;
