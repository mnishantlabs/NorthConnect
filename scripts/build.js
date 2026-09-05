const esbuild = require('esbuild');
const vite = require('vite');
const path = require('path');

async function build() {
  console.log('Building renderer (React)...');
  await vite.build({
    configFile: path.resolve(__dirname, '../vite.config.ts'),
  });

  const externals = [
    'electron',
    'music-metadata',
    'electron-store',
    'electron-updater',
    'ffmpeg-static',
    'opusscript',
    'ws',
    'tweetnacl',
    '@discordjs/voice',
    'prism-media',
    'libsodium-wrappers',
    '@snazzah/davey',
    '@stablelib/xchacha20poly1305',
  ];

  console.log('Building main process (Electron)...');
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../src/main/main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node16',
    external: externals,
    outfile: path.resolve(__dirname, '../dist/main/main.js'),
    minify: true,
  });

  // Copy ffmpeg.exe and opusscript wasm assets to dist/main
  try {
    const fs = require('fs');
    const destDir = path.resolve(__dirname, '../dist/main');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const srcFfmpeg = path.resolve(__dirname, '../node_modules/ffmpeg-static/ffmpeg.exe');
    const destFfmpeg = path.join(destDir, 'ffmpeg.exe');
    if (fs.existsSync(srcFfmpeg)) {
      fs.copyFileSync(srcFfmpeg, destFfmpeg);
      console.log('Copied ffmpeg.exe to dist/main/ffmpeg.exe');
    }

    const opusBuild = path.resolve(__dirname, '../node_modules/opusscript/build');
    if (fs.existsSync(opusBuild)) {
      const files = fs.readdirSync(opusBuild);
      for (const f of files) {
        fs.copyFileSync(path.join(opusBuild, f), path.join(destDir, f));
      }
      const destBuildDir = path.join(destDir, 'build');
      if (!fs.existsSync(destBuildDir)) fs.mkdirSync(destBuildDir, { recursive: true });
      for (const f of files) {
        fs.copyFileSync(path.join(opusBuild, f), path.join(destBuildDir, f));
      }
      console.log('Copied opusscript wasm assets to dist/main');
    }
  } catch (e) {
    console.warn('Could not copy binary assets:', e);
  }

  console.log('Building preload process (Electron)...');
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../src/main/preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node16',
    external: externals,
    outfile: path.resolve(__dirname, '../dist/main/preload.js'),
    minify: true,
  });

  console.log('Build completed successfully!');
}

build().catch((err) => {
  console.error('Build failed with error:', err);
  process.exit(1);
});
