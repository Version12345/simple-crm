import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        // react-kanban-kit is hoisted to root node_modules, which also pulls in
        // its own React 18 copy. dedupe forces Vite to use a single React instance
        // (the client's React 19 in code/client/node_modules).
        dedupe: ["react", "react-dom"],
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                changeOrigin: true,
                rewrite: path => path.replace(/^\/api/, ""),
            },
        },
    },
});
