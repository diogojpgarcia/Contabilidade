import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { tab, onRetry } = this.props;
      const isTabBoundary = !!tab;
      return (
        <div style={{
          padding: '2rem', textAlign: 'center',
          ...(isTabBoundary ? { paddingTop: '4rem' } : {}),
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
          <h3 style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
            {tab ? `Erro em "${tab}"` : 'Algo correu mal'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'Erro inesperado'}
          </p>
          {isTabBoundary && (
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); onRetry?.(); }}
              style={{
                marginRight: '0.75rem', padding: '0.5rem 1.25rem',
                background: 'var(--accent)', color: '#fff',
                border: 'none', borderRadius: '8px', cursor: 'pointer',
              }}
            >
              Tentar de novo
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.25rem',
              background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
            }}
          >
            Recarregar app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
