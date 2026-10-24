import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ErrorBoundary - ${this.props.name || 'Component'}] Caught error:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div 
          className="error-boundary-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            margin: '16px',
            background: 'var(--bg-card, #1e1e2e)',
            border: '1px solid var(--border-color, #313244)',
            borderRadius: '8px',
            color: 'var(--text-primary, #cdd6f4)',
            textAlign: 'center',
            minHeight: this.props.minHeight || '160px'
          }}
        >
          <AlertTriangle size={32} color="#f38ba8" style={{ marginBottom: '12px' }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>
            {this.props.title || `${this.props.name || 'Component'} Render Error`}
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-secondary, #a6adc8)', maxWidth: '420px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. You can safely try reloading this component.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: 'var(--accent-primary, #89b4fa)',
              color: '#11111b',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            <span>Reload {this.props.name || 'View'}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
