import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initialTheme } from './components/Header';
import './styles.css';
import './account.css';
import './editorial.css';
import './design.css';
document.documentElement.dataset.theme=initialTheme();
createRoot(document.getElementById('root')!).render(<App/>);
const launchPrelude=document.getElementById('launch-prelude');
if(launchPrelude){
  const dismiss=()=>launchPrelude.classList.add('is-leaving');
  window.setTimeout(dismiss,window.matchMedia('(prefers-reduced-motion: reduce)').matches?350:1150);
  window.setTimeout(()=>launchPrelude.remove(),1700);
}
