import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initialTheme } from './components/Header';
import './styles.css';
import './account.css';
import './editorial.css';
import './design.css';
document.documentElement.dataset.theme=initialTheme();
createRoot(document.getElementById('root')!).render(<App/>);
