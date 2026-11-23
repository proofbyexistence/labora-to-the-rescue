/**
 * Client entry point mounting the LABORA React application and global styles.
 */
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
