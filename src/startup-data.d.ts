export type DatasetKey='sites'|'enso'|'evidence'|'news'|'sources';
export const datasetKeys:DatasetKey[];
export function datasetStatus(key:DatasetKey,value:unknown):'empty'|'ready';
