import { defineConfig,loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({mode})=>{const env=loadEnv(mode,process.cwd(),"");return {base:"/",plugins:[react()],server:{port:5174,proxy:{"/api/iro":{target:env.VITE_API_TARGET||"http://localhost:4000",changeOrigin:true}}},build:{outDir:"dist"}}});
