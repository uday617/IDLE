import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceShell } from './WorkspaceShell.js';
import './styles.css';
import './final-ui.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceShell />
  </StrictMode>,
);
