import { useState } from 'react';
import WallForm from './components/WallForm.jsx';
import WallDrawing from './components/WallDrawing.jsx';
import WallSummary from './components/WallSummary.jsx';
import PanelPlans from './components/PanelPlans.jsx';
import { calculateWallLayout } from './utils/calculator.js';

function App() {
  const [layout, setLayout] = useState(null);
  const [wallName, setWallName] = useState('');

  const handleCalculate = (wall) => {
    const result = calculateWallLayout(wall);
    setLayout(result);
    setWallName(wall.name);
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>DEVPRO Wall Builder</h1>
        <p style={styles.subtitle}>
          Single wall manufacturing drawing generator — SIP panel layout tool
        </p>
      </header>

      <main style={styles.main}>
        <WallForm onCalculate={handleCalculate} />

        {layout && (
          <>
            <WallDrawing layout={layout} wallName={wallName} />
            <PanelPlans layout={layout} />
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
  main: {
    maxWidth: 1280,
    margin: '24px auto',
    padding: '0 24px',
  },
};

export default App;
