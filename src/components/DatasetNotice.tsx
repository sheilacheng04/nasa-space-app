import type {DatasetState} from '../useStartupData';
export function DatasetNotice({label,state,retry}:{label:string;state:DatasetState;retry:()=>void}){
 if(state.status==='ready')return null;
 return <div className="source-line dataset-notice" data-dataset-status={state.status} role="status">
  <p>{state.status==='loading'?'Loading '+label+'...':state.status==='empty'?'No saved '+label+' records are available.':label+' could not be loaded. '+state.error}</p>
  {state.status!=='loading'&&<button onClick={retry}>Retry {label}</button>}
 </div>;
}
