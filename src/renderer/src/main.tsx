import '@fontsource-variable/inter';
import '@fontsource-variable/sora';
import '~styles/theme.css';
import '~styles/global.css';
import '~styles/animations.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
