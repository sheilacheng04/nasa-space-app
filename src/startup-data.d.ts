import type {Bootstrap} from './types';
export type DatasetKey=keyof Required<Bootstrap>;
export const datasetKeys:DatasetKey[];
export function datasetStatus(key:DatasetKey,value:unknown):'empty'|'ready';
