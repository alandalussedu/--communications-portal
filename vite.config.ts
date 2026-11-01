import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" : الموقع يعمل من أي مسار (GitHub Pages يخدمه تحت /اسم-المستودع/)
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "dist" },
});
