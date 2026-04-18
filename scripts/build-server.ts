import * as esbuild from 'esbuild';
import path from 'path';

async function build() {
  try {
    console.log('Building server...');
    await esbuild.build({
      entryPoints: ['server.ts'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: 'dist/server.js',
      format: 'esm',
      external: ['fsevents', 'vite'], // Vite is not needed in production
      banner: {
        js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    });
    console.log('Server built successfully!');
  } catch (err) {
    console.error('Server build failed:', err);
    process.exit(1);
  }
}

build();
