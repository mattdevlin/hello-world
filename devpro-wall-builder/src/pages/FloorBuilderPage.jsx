import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FloorForm from '../components/FloorForm.jsx';
import FloorPlanView from '../components/FloorPlanView.jsx';
import FloorFramingPlan from '../components/FloorFramingPlan.jsx';
import FloorEpsPlan from '../components/FloorEpsPlan.jsx';
import FloorPanelPlans from '../components/FloorPanelPlans.jsx';
import FloorEpsCutPlans from '../components/FloorEpsCutPlans.jsx';
import FloorOffcuts from '../components/FloorOffcuts.jsx';
import FloorSummary from '../components/FloorSummary.jsx';
import CollapsibleSection from '../components/CollapsibleSection.jsx';
import { calculateFloorLayout } from '../utils/floorCalculator.js';
import { getProjects, getProjectFloors, saveFloor } from '../utils/storage.js';

export default function FloorBuilderPage() {
  const { projectId, floorId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [layout, setLayout] = useState(null);
  const [floorName, setFloorName] = useState('');
  const [floorInput, setFloorInput] = useState(null);
  const [loadKey, setLoadKey] = useState(0);
  const [generateKey, setGenerateKey] = useState(0);
  const [calcError, setCalcError] = useState(null);

  useEffect(() => {
    const p = getProjects().find(p => p.id === projectId);
    if (!p) { navigate('/', { replace: true }); return; }
    setProject(p);

    if (floorId && floorId !== 'new') {
      const floors = getProjectFloors(projectId);
      const floor = floors.find(f => f.id === floorId);
      if (floor) {
        setFloorInput(floor);
        setLoadKey(k => k + 1);
        const result = calculateFloorLayout(floor);
        if (!result.error) setLayout(result);
        setFloorName(floor.name);
      }
    } else {
      setFloorInput(null);
      setLayout(null);
      setFloorName('');
      setLoadKey(k => k + 1);
    }
  }, [projectId, floorId, navigate]);

  const handleCalculate = (floor) => {
    const result = calculateFloorLayout(floor);
    if (result.error) {
      setCalcError(result.error);
      return;
    }
    setCalcError(null);
    setLayout(result);
    setFloorName(floor.name);
    setFloorInput(floor);
    setGenerateKey(k => k + 1);
  };

  const handleSave = () => {
    if (!floorInput || !projectId) return;
    const saved = saveFloor(projectId, floorInput);
    setFloorInput(saved);
    if (!floorId || floorId === 'new') {
      navigate(`/project/${projectId}/floor/${saved.id}`, { replace: true });
    }
  };

  if (!project) return null;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <button onClick={() => navigate(`/project/${projectId}`)} style={styles.backBtn}>
              &larr; {project.name}
            </button>
            {floorName && <span style={styles.floorLabel}>{floorName}</span>}
          </div>
          <div style={styles.headerActions}>
            <button
              onClick={() => navigate(`/project/${projectId}/floor/new`)}
              style={styles.newBtn}
            >
              + New Floor
            </button>
            {floorInput && (
              <button onClick={handleSave} style={styles.saveBtn}>
                Save Floor
              </button>
            )}
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <FloorForm
          key={loadKey}
          onCalculate={handleCalculate}
          onChange={setFloorInput}
          initialFloor={floorInput}
        />

        {calcError && (
          <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginTop: 16, color: '#991b1b', fontSize: 14 }}>
            {calcError}
          </div>
        )}

        {layout && (
          <>
            <CollapsibleSection sectionKey="floorPlan" title="Floor Plan View" forceOpen={generateKey}>
              <FloorPlanView layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorFraming" title="Framing Plan" forceOpen={generateKey}>
              <FloorFramingPlan layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorEps" title="EPS Plan" defaultCollapsed forceOpen={generateKey}>
              <FloorEpsPlan layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorPanelPlans" title="Panel Cut Plans" defaultCollapsed>
              <FloorPanelPlans layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorEpsCutPlans" title="EPS Cut Plans" defaultCollapsed>
              <FloorEpsCutPlans layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorOffcuts" title="Offcuts" defaultCollapsed>
              <FloorOffcuts layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
            <CollapsibleSection sectionKey="floorSummary" title="Floor Summary">
              <FloorSummary layout={layout} floorName={floorName} projectName={project.name} />
            </CollapsibleSection>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    background: '#5D4037',
    padding: '12px 32px',
    color: '#fff',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 1280,
    margin: '0 auto',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  floorLabel: {
    fontSize: 16,
    fontWeight: 600,
    opacity: 0.9,
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
  main: {
    maxWidth: 1280,
    margin: '24px auto',
    padding: '0 24px',
  },
};
