import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {startupFile,errorMessage} from './api/client';
import {datasetKeys,datasetStatus} from './startup-data.js';
import type {DatasetKey} from './startup-data.js';
import type {Bootstrap} from './types';
export interface DatasetState {status:'loading'|'ready'|'empty'|'error';error?:string}
type States={[K in DatasetKey]:DatasetState&{data?:Required<Bootstrap>[K]}};
export function useStartupData(){
 const [states,setStates]=useState<States>(()=>Object.fromEntries(datasetKeys.map(key=>[key,{status:'loading'}])) as States);
 const live=useRef(false),versions=useRef<Partial<Record<DatasetKey,number>>>({});
 const load=useCallback(async(key:DatasetKey,reload=false)=>{
  const version=(versions.current[key]||0)+1;versions.current[key]=version;
  setStates(old=>({...old,[key]:{status:'loading'}}));
  try{
   const value=await startupFile(key,reload),status=datasetStatus(key,value);
   if(live.current&&versions.current[key]===version)setStates(old=>({...old,[key]:{status,data:value}}));
  }catch(error){if(live.current&&versions.current[key]===version)setStates(old=>({...old,[key]:{status:'error',error:errorMessage(error)}}));}
 },[]);
 useEffect(()=>{live.current=true;for(const key of datasetKeys)void load(key);return()=>{live.current=false;};},[load]);
 const data=useMemo<Bootstrap|null>(()=>states.sites.data?.length?{
  sites:states.sites.data,enso:states.enso.data,news:states.news.data,evidence:states.evidence.data,sources:states.sources.data,
 }:null,[states]);
 return {data,states,retry:(key:DatasetKey)=>void load(key,true)};
}
