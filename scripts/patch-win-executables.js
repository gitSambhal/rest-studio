import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sevenZipBin from '7zip-bin';

/**
 * Patches Windows executable PE Subsystem to GUI mode (Subsystem 2)
 */
function fixPeSubsystem(filePath) {
  if (!fs.existsSync(filePath)) return;

  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 0x200) return;

    if (buf.readUInt16LE(0) !== 0x5a4d) return;

    const peOffset = buf.readUInt32LE(0x3c);
    if (buf.length < peOffset + 0x60) return;

    if (buf.readUInt32BE(peOffset) !== 0x50450000) return;

    const subsystemOffset = peOffset + 0x5c;
    const currentSubsystem = buf.readUInt16LE(subsystemOffset);

    if (currentSubsystem !== 2) {
      console.log(`[Win Patch] Changing ${path.basename(filePath)} PE Subsystem to 2 (GUI Mode)...`);
      buf.writeUInt16LE(2, subsystemOffset);
      fs.writeFileSync(filePath, buf);
    }
  } catch (err) {
    console.warn(`[Win Patch] Failed to patch PE header for ${filePath}:`, err.message);
  }
}

/**
 * Packages Windows executable + resources.neu into a true single-file SFX executable (.exe).
 * When launched on Windows, it extracts resources into %TEMP% and runs the GUI binary seamlessly.
 */
function buildWindowsSingleFileExe(distDir) {
  const sfxStub = path.resolve('scripts/sfx-stubs/7zsd_All_x64.sfx');
  const p7z = sevenZipBin.path7za;
  
  if (!fs.existsSync(sfxStub) || !fs.existsSync(p7z)) {
    console.warn('[Win SFX] 7z SFX stub or 7za tool missing, skipping SFX packaging.');
    return;
  }

  const winExe = path.join(distDir, 'reststudio-win_x64.exe');
  const resNeu = path.join(distDir, 'resources.neu');

  if (!fs.existsSync(winExe) || !fs.existsSync(resNeu)) {
    console.warn('[Win SFX] Windows binary or resources.neu missing, skipping SFX build.');
    return;
  }

  // Ensure 7za is executable
  try { fs.chmodSync(p7z, '755'); } catch (_) {}

  // 1. Prepare temp directory
  const tmpDir = path.join(distDir, 'tmp_win_sfx');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  fs.copyFileSync(winExe, path.join(tmpDir, 'reststudio-win_x64.exe'));
  fs.copyFileSync(resNeu, path.join(tmpDir, 'resources.neu'));
  if (fs.existsSync('public/icon.png')) {
    fs.copyFileSync('public/icon.png', path.join(tmpDir, 'icon.png'));
  }

  // Ensure PE subsystem 2 (GUI mode)
  fixPeSubsystem(path.join(tmpDir, 'reststudio-win_x64.exe'));

  // 2. Compress into app.7z archive
  const archivePath = path.join(distDir, 'app.7z');
  fs.rmSync(archivePath, { force: true });

  try {
    execSync(`"${p7z}" a -t7z -m0=lzma2 -mx=9 "${archivePath}" "${tmpDir}/*"`, { stdio: 'pipe' });

    // 3. Create SFX config.txt
    const configContent = `;!@Install@!UTF-8!
Title="RestStudio"
RunProgram="reststudio-win_x64.exe"
GUIMode="2"
;!@InstallEnd@!
`;
    const configPath = path.join(distDir, 'sfx_config.txt');
    fs.writeFileSync(configPath, configContent, 'utf8');

    // 4. Concatenate stub + config + 7z archive into single RestStudio-Windows-x64.exe
    const stubBuf = fs.readFileSync(sfxStub);
    const cfgBuf = fs.readFileSync(configPath);
    const arcBuf = fs.readFileSync(archivePath);

    const finalWinExeBuf = Buffer.concat([stubBuf, cfgBuf, arcBuf]);
    const finalWinExePath = path.join(distDir, 'RestStudio-Windows-x64.exe');
    
    fs.writeFileSync(finalWinExePath, finalWinExeBuf);
    console.log(`[Win SFX] Created single standalone Windows executable (${(finalWinExeBuf.length / (1024 * 1024)).toFixed(2)} MB): ${finalWinExePath}`);

    // Cleanup temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(archivePath, { force: true });
    fs.rmSync(configPath, { force: true });
  } catch (err) {
    console.warn('[Win SFX] Error building SFX package:', err.message);
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
  // 1. Build Windows Single-File Executable
  buildWindowsSingleFileExe(distDir);

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
