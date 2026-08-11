import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sevenZipBin from '7zip-bin';

/**
 * Packages Windows executable + resources.neu into:
 * 1. RestStudio-Windows-x64.exe (Standalone single executable with appended resources.neu)
 * 2. RestStudio-Windows-x64.zip (Portable zip package containing RestStudio.exe + resources.neu)
 */
function buildWindowsExecutables(distDir) {
  const winExePath = path.join(distDir, 'reststudio-win_x64.exe');
  const resNeuPath = path.join(distDir, 'resources.neu');

  if (!fs.existsSync(winExePath) || !fs.existsSync(resNeuPath)) {
    console.warn('[Win Build] Windows binary or resources.neu missing, skipping Windows packaging.');
    return;
  }

  try {
    const winExeBuf = fs.readFileSync(winExePath);
    const resNeuBuf = fs.readFileSync(resNeuPath);

    // 1. Create Standalone Single Executable by concatenating untouched PE binary + resources.neu
    const standaloneWinExeBuf = Buffer.concat([winExeBuf, resNeuBuf]);
    const finalWinExePath = path.join(distDir, 'RestStudio-Windows-x64.exe');
    fs.writeFileSync(finalWinExePath, standaloneWinExeBuf);
    console.log(`[Win Build] Created single standalone Windows executable (${(standaloneWinExeBuf.length / (1024 * 1024)).toFixed(2)} MB): ${finalWinExePath}`);

    // 2. Create Portable ZIP package
    const p7z = sevenZipBin.path7za;
    if (fs.existsSync(p7z)) {
      try { fs.chmodSync(p7z, '755'); } catch (_) {}
      
      const tmpDir = path.join(distDir, 'tmp_win_zip');
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(tmpDir, { recursive: true });

      fs.copyFileSync(winExePath, path.join(tmpDir, 'RestStudio.exe'));
      fs.copyFileSync(resNeuPath, path.join(tmpDir, 'resources.neu'));

      const zipPath = path.join(distDir, 'RestStudio-Windows-x64.zip');
      fs.rmSync(zipPath, { force: true });

      execSync(`"${p7z}" a -tzip "${zipPath}" "${tmpDir}/*"`, { stdio: 'pipe' });
      console.log(`[Win Build] Created portable Windows ZIP package: ${zipPath}`);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[Win Build] Error creating Windows packages:', err.message);
  }
}

/**
 * Packages Linux executables + resources.neu into self-extracting single-file binaries.
 */
function buildLinuxSingleFileBinaries(distDir) {
  const resNeu = path.join(distDir, 'resources.neu');
  if (!fs.existsSync(resNeu)) return;

  const linuxTargets = [
    { binary: 'reststudio-linux_x64', output: 'RestStudio-Linux-x64' },
    { binary: 'reststudio-linux_arm64', output: 'RestStudio-Linux-ARM64' },
    { binary: 'reststudio-linux_armhf', output: 'RestStudio-Linux-ARMhf' },
  ];

  linuxTargets.forEach(({ binary, output }) => {
    const binPath = path.join(distDir, binary);
    if (!fs.existsSync(binPath)) return;

    const tmpDir = path.join(distDir, `tmp_${binary}`);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    fs.copyFileSync(binPath, path.join(tmpDir, binary));
    fs.copyFileSync(resNeu, path.join(tmpDir, 'resources.neu'));

    const tarPath = path.join(distDir, `${binary}.tar.gz`);
    fs.rmSync(tarPath, { force: true });

    try {
      execSync(`tar -czf "${tarPath}" -C "${tmpDir}" .`, { stdio: 'pipe' });

      const header = `#!/bin/sh
TMP_DIR=$(mktemp -d /tmp/reststudio_XXXXXX)
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM
ARCHIVE_LINE=$(grep -a -n "^__ARCHIVE_FOLLOWS__$" "$0" | cut -d: -f1)
tail -n +$((ARCHIVE_LINE + 1)) "$0" | tar -xz -C "$TMP_DIR"
cd "$TMP_DIR"
chmod +x ./${binary}
./${binary} "$@"
exit $?
__ARCHIVE_FOLLOWS__
`;

      const headerBuf = Buffer.from(header, 'utf8');
      const tarBuf = fs.readFileSync(tarPath);
      const finalBinBuf = Buffer.concat([headerBuf, tarBuf]);

      const outputPath = path.join(distDir, output);
      fs.writeFileSync(outputPath, finalBinBuf);
      fs.chmodSync(outputPath, '755');

      console.log(`[Linux SFX] Created single standalone Linux binary (${(finalBinBuf.length / (1024 * 1024)).toFixed(2)} MB): ${outputPath}`);

      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(tarPath, { force: true });
    } catch (err) {
      console.warn(`[Linux SFX] Failed to bundle ${binary}:`, err.message);
    }
  });
}

// MAIN EXECUTION
const distDir = path.resolve('dist/reststudio');

if (fs.existsSync(distDir)) {
  // 1. Build Windows Executables
  buildWindowsExecutables(distDir);

  // 2. Build Linux Single-File Binaries
  buildLinuxSingleFileBinaries(distDir);

  // 3. Clean up loose / raw / duplicate files in dist/reststudio
  const filesToDelete = [
    'resources.neu',
    'reststudio-win_x64.exe',
    'reststudio-win_x86.exe',
    'reststudio-win_arm64.exe',
    'reststudio-linux_x64',
    'reststudio-linux_arm64',
    'reststudio-linux_armhf',
    'RestStudio.exe',
  ];

  filesToDelete.forEach((file) => {
    const filePath = path.join(distDir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Clean] Removed loose file: ${file}`);
    }
  });

  const redundantDir = path.join(distDir, 'RestStudio-Windows-x64');
  if (fs.existsSync(redundantDir)) {
    fs.rmSync(redundantDir, { recursive: true, force: true });
    console.log(`[Clean] Removed redundant directory: RestStudio-Windows-x64`);
  }
}
