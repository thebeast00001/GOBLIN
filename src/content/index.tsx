import { createRoot } from 'react-dom/client';
import tailwindCss from '../index.css?inline';
import { Sidebar } from './Sidebar';

console.log('GOBLIN Content script running on YouTube');

function init() {
  const rootElement = document.createElement('div');
  rootElement.id = 'goblin-extension-root';
  
  // Create a Shadow DOM to encapsulate our styles and prevent YouTube from breaking them
  const shadowRoot = rootElement.attachShadow({ mode: 'open' });
  
  // Inject Tailwind CSS into the Shadow DOM
  const style = document.createElement('style');
  style.textContent = tailwindCss;
  shadowRoot.appendChild(style);

  // Create a container inside the Shadow DOM for React
  const reactContainer = document.createElement('div');
  shadowRoot.appendChild(reactContainer);

  document.body.appendChild(rootElement);

  const root = createRoot(reactContainer);
  root.render(<Sidebar />);
}

// Ensure the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
