import { defineConfig } from 'vite';
export default defineConfig({server:{proxy:{'/api':'http://127.0.0.1:8790','/games':'http://127.0.0.1:8790'}},build:{chunkSizeWarningLimit:2200}});
