import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container} role="alert">
          <h2 style={styles.heading}>Something went wrong</h2>
          <p style={styles.message}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.hash = '#/';
            }}
            style={styles.button}
          >
            Return to Projects
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: 32,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  heading: {
    fontSize: 24,
    fontWeight: 600,
    color: '#333',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    maxWidth: 480,
    textAlign: 'center',
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
