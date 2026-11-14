export function createJSONCache(): <T>(key:string,fetcher:()=>Promise<T>,reload?:boolean)=>Promise<T>;
