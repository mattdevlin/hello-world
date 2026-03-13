import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <h1 style={styles.code}>404</h1>
      <p style={styles.message}>Page not found</p>
      <button onClick={() => navigate('/')} style={styles.button}>
        Go to Projects
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  code: {
    fontSize: 64,
    fontWeight: 700,
    color: '#ccc',
    margin: 0,
  },
  message: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  button: {
    padding: '10px 24px',
    background: '#2C5F8A',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
};
