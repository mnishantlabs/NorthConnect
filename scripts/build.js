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

  // Copy ffmpeg.exe, yt-dlp.exe, and opusscript wasm assets to dist/main and bin
  try {
    const fs = require('fs');
    const destDir = path.resolve(__dirname, '../dist/main');
    const binDir = path.resolve(__dirname, '../bin');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

    // Copy ffmpeg.exe
    const srcFfmpeg = path.resolve(__dirname, '../node_modules/ffmpeg-static/ffmpeg.exe');
    const destFfmpeg = path.join(destDir, 'ffmpeg.exe');
    const binFfmpeg = path.join(binDir, 'ffmpeg.exe');
    if (fs.existsSync(srcFfmpeg)) {
      fs.copyFileSync(srcFfmpeg, destFfmpeg);
      fs.copyFileSync(srcFfmpeg, binFfmpeg);
      console.log('Copied ffmpeg.exe to dist/main/ffmpeg.exe and bin/ffmpeg.exe');
    }

    // Copy yt-dlp.exe
    const srcYtDlp = path.join(binDir, 'yt-dlp.exe');
    const destYtDlp = path.join(destDir, 'yt-dlp.exe');
    if (fs.existsSync(srcYtDlp)) {
      fs.copyFileSync(srcYtDlp, destYtDlp);
      console.log('Copied yt-dlp.exe to dist/main/yt-dlp.exe');
    }

    // Copy opusscript assets
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
