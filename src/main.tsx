import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  window.sessionStorage.removeItem('turquation_boot_retry');
} catch {
  // Ignore private mode restrictions
}

createRoot(document.getElementById('root')!).render(<App />);
