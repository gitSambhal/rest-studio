import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';
import { initDesktopClipboardHandlers } from './utils/desktopClipboard.ts';

// Initialize Neutralino Native Desktop SDK if running inside Neutralino container
if (typeof window !== 'undefined' && (window as any).Neutralino) {
  try {
    const NL = (window as any).Neutralino;
    NL.init();
    console.log('[RestStudio Neutralino] Neutralino Native OS SDK initialized');

    // Configure native main menu bar on macOS/Windows/Linux for native Edit shortcuts
    if (NL.window?.setMainMenu) {
      NL.window
        .setMainMenu({
          menu: [
            {
              id: 'edit',
              text: 'Edit',
              items: [
                { id: 'undo', text: 'Undo', shortcut: 'CmdOrCtrl+Z' },
                { id: 'redo', text: 'Redo', shortcut: 'CmdOrCtrl+Shift+Z' },
                { id: 'cut', text: 'Cut', shortcut: 'CmdOrCtrl+X' },
                { id: 'copy', text: 'Copy', shortcut: 'CmdOrCtrl+C' },
                { id: 'paste', text: 'Paste', shortcut: 'CmdOrCtrl+V' },
                { id: 'selectAll', text: 'Select All', shortcut: 'CmdOrCtrl+A' },
              ],
            },
          ],
        })
        .catch((err: any) => console.warn('[RestStudio Neutralino] Menu registration note:', err));
    }
  } catch (err) {
    console.warn('[RestStudio Neutralino] Initialization warning:', err);
  }
}

// Initialize desktop clipboard, copy/paste and text selection handlers
initDesktopClipboardHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


