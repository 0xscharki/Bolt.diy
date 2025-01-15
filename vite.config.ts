import type { IncomingMessage, ServerResponse } from 'http';
import { execSync } from 'child_process';

import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';

// Get git hash with fallback
const getGitHash = (): string => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'no-git-info';
  }
};

interface Chrome129PluginType {
  name: string;
  configureServer: (server: ViteDevServer) => void;
}

function chrome129IssuePlugin(): Chrome129PluginType {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const userAgent = req.headers['user-agent'];
        const chromeVersionMatch = userAgent?.match(/Chrom(?:e|ium)\/([0-9]+)\./);

        if (chromeVersionMatch) {
          const version = parseInt(chromeVersionMatch[1], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1>' +
              '<p>Chrome 129 has an issue with JavaScript modules & Vite local development, see ' +
              '<a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">' +
              'for more information.</a></p>' +
              '<p><b>Note:</b> This only impacts <u>local development</u>. ' +
              '`pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>'
            );
            return;
          }
        }
        next();
      });
    },
  };
}

interface ConfigOptions {
  mode: string;
}

export default defineConfig((config: ConfigOptions) => ({
  define: {
    __COMMIT_HASH: JSON.stringify(getGitHash()),
    __APP_VERSION: JSON.stringify(process.env.npm_package_version),
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {},
    },
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    nodePolyfills({
      include: ['path', 'buffer'],
    }),
    config.mode !== 'test' && remixCloudflareDevProxy(),
    remixVitePlugin({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    UnoCSS(),
    tsconfigPaths(),
    chrome129IssuePlugin(),
    config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
  ].filter(Boolean),
  envPrefix: [
    'VITE_',
    'OPENAI_LIKE_API_BASE_URL',
    'OLLAMA_API_BASE_URL',
    'LMSTUDIO_API_BASE_URL',
    'TOGETHER_API_BASE_URL',
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
}));