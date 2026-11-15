import {useEffect,useRef,useState} from 'react';
import {BACKGROUND_KEY,createBackground} from '../background.js';
import type {Page} from '../types';

export function Background({page}:{page:Page}) {
  const controller=useRef<ReturnType<typeof createBackground>|null>(null);
  const [paused,setPaused]=useState(()=>{try{return localStorage.getItem(BACKGROUND_KEY)==='1';}catch{return false;}});
  useEffect(()=>{
    const canvas=document.createElement('canvas');canvas.id='ambient-canvas';canvas.className='ambient-canvas';canvas.setAttribute('aria-hidden','true');
    controller.current=createBackground(canvas);
    return()=>{controller.current?.destroy();controller.current=null;};
  },[]);
  useEffect(()=>{controller.current?.setScene(page);},[page]);
  return <button type="button" className="background-toggle" aria-pressed={paused} onClick={()=>{controller.current?.pause(!paused);setPaused(!paused);}}>
    <svg viewBox="0 0 20 20" aria-hidden="true">{paused?<path d="m7 4 8 6-8 6Z"/>:<path d="M6 4v12M14 4v12"/>}</svg>
    {paused?'Resume background':'Pause background'}
  </button>;
}
