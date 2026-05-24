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
    