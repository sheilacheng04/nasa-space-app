import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
const deployment=JSON.parse(readFileSync(new URL('./vercel.json',import.meta.url),'utf8'));
const headers=Object.fromEntries(deployment.headers[0].headers.map(h=>[h.key,h.value]));
export default defineConfig({base:'./',build:{target:'es2022',chunkSizeWarningLimit:2000},server:{port:5173},preview:{headers}});
