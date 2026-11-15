import {useEffect,useRef} from 'react';
import {createBackground} from '../background.js';
import type {Page} from '../types';

export function Background({page}:{page:Page}) {
  const controller=useRef<ReturnType<typeof createBackground>|null>(null);
  useEffect(()=>{
    const canvas=document.createElement('canvas');canvas.id='ambient-canvas';canvas.className='ambient-canvas';canvas.setAttribute('aria-hidden','true');
    controller.current=createBackground(canvas);
    return()=>{controller.current?.destroy();controller.current=null;};
  },[]);
  useEffect(()=>{controller.current?.setScene(page);},[page]);
  return null;
}
