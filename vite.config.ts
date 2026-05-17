import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import cesium from 'vite-plugin-cesium'

const config = defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), viteReact(), cesium()],
})

export default config
