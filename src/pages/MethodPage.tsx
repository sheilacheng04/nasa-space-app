import { useEffect } from 'react';
import { renderMethod } from '../method.js';
import type { Bootstrap } from '../types';
export function MethodPage({active, data}: {active: boolean; data: Bootstrap}) {
  useEffect(() => { renderMethod(data.sites, data.sources, data.enso, data.news); }, [data]);
  return <section id="page-method" className="page" hidden={!active}><div className="wrap page-intro"><p className="eyebrow">Our data & method</p><h1>About this project</h1><p className="dek">Sources, processing, uncertainty and the questions still open.</p></div><div className="wrap" id="method-content"/></section>;
}
