import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './reference.css';
import './app.css';
import './premium.css';

class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Setline could not render', error, info.componentStack); }
  render() {
    return this.state.failed ? (
      <main className="app-recovery" role="alert">
        <img src="/favicon.svg" alt="" width="48" height="48" />
        <h1>Setline couldn't open</h1>
        <p>Your saved data has not been removed. Reload the app to try again.</p>
        <button className="btn" onClick={() => window.location.reload()}>Reload Setline</button>
      </main>
    ) : this.props.children;
  }
}

const root = document.getElementById('setline-root');
if (!root) throw new Error('Missing Setline app root.');
createRoot(root).render(<AppBoundary><App /></AppBoundary>);
