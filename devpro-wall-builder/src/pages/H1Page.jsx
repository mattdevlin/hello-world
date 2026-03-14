import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProjects, getProjectH1, saveProjectH1 } from '../utils/storage.js';
import { getClimateZone } from '../utils/h1Constants.js';
import { checkH1Compliance } from '../utils/h1Calculator.js';
import H1Form from '../components/H1Form.jsx';
import H1Results from '../components/H1Results.jsx';

export default function H1Page() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [climateZone, setClimateZone] = useState(null);
  const [h1Input, setH1Input] = useState(null);
  const [results, setResults] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
    if (!p) {
      navigate('/', { replace: true });
      return;
    }
    setProject(p);
    setClimateZone(getClimateZone(p.territorialAuthority));

    const savedH1 = getProjectH1(projectId);
    if (savedH1) setH1Input(savedH1);
  }, [projectId, navigate]);

  const handleCalculate = (input) => {
    if (!climateZone) return;
    const result = checkH1Compliance({
      climateZone,
      grossWallArea: input.grossWallArea,
      constructions: input.constructions,
      heatedElements: input.heatedElements,
    });
    setResults(result);
  };

  const handleChange = (input) => {
    setH1Input(input);
    setSaved(false);
  };

  const handleSave = () => {
    if (h1Input) {
      saveProjectH1(projectId, h1Input);
      setSaved(true);
    }
  };

  if (!project) return null;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <nav style={styles.topBar} aria-label="Breadcrumb">
          <button onClick={() => navigate(`/project/${projectId}`)} style={styles.backBtn} aria-label={`Back to ${project.name}`}>
            &larr; {project.name}
          </button>
        </nav>

        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>H1/AS1 Compliance Check</h1>
            <p style={styles.subtitle}>
              {project.territorialAuthority || 'No location set'}
              {climateZone && <span style={styles.zoneBadge}>Zone {climateZone}</span>}
            </p>
          </div>
          <button style={styles.saveBtn} onClick={handleSave}>
            {saved ? 'Saved' : 'Save'}
          </button>
        </header>

        {!climateZone ? (
          <div style={styles.noZone}>
            <p style={styles.noZoneText}>Set the territorial authority on the project page first.</p>
            <button style={styles.noZoneBtn} onClick={() => navigate(`/project/${projectId}`)}>
              Go to project settings
            </button>
          </div>
        ) : (
          <main id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
            <H1Form
              projectId={projectId}
              climateZone={climateZone}
              initialData={h1Input}
              onChange={handleChange}
              onCalculate={handleCalculate}
            />
            <H1Results results={results} />
          </main>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f0f2f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '0 24px 48px',
  },
  topBar: {
    padding: '20px 0 0',
  },
  backBtn: {
    padding: '6px 12px',
    background: 'none',
    color: '#2C5F8A',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '12px 0 24px',
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a1a',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: '#636363',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  zoneBadge: {
    padding: '2px 10px',
    background: '#E8F5E9',
    color: '#2E7D32',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  saveBtn: {
    padding: '10px 24px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  noZone: {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#fff',
    borderRadius: 8,
    border: '1px dashed #ddd',
  },
  noZoneText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 500,
    margin: '0 0 12px',
  },
  noZoneBtn: {
    padding: '10px 20px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
};
