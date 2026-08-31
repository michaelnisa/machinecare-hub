import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const sentryEnabled = mode === "production" && !!process.env.SENTRY_AUTH_TOKEN;
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    build: {
      // Only emit source maps when they'll actually be uploaded to Sentry and
      // then deleted below — otherwise they'd sit in dist/ and ship to every
      // visitor's browser, leaking source structure for no benefit.
      sourcemap: sentryEnabled,
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("jspdf")) {
                return "vendor-jspdf";
              }
              if (id.includes("html2canvas") || id.includes("canvg")) {
                return "vendor-html2canvas";
              }
              if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) {
                return "vendor-charts";
              }
              if (id.includes("@radix-ui") || id.includes("lucide-react")) {
                return "vendor-ui";
              }
              if (id.includes("@supabase") || id.includes("@tanstack")) {
                return "vendor-data";
              }
            }
          },
        },
      },
    },
    plugins: [
      react(),
      // Only active when SENTRY_AUTH_TOKEN is set (e.g. in CI/prod builds) —
      // uploads source maps so Sentry shows real stack traces, then deletes
      // the local .map files so they aren't served publicly. No-ops locally.
      sentryEnabled &&
        sentryVitePlugin({
          authToken: process.env.SENTRY_AUTH_TOKEN,
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          sourcemaps: { filesToDeleteAfterUpload: ["dist/**/*.map"] },
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
