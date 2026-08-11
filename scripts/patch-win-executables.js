import fs from 'fs';
import path from 'path';

/**
 * Ensures Windows executable binaries operate in pure GUI mode (Subsystem 2) 
 * so no console/terminal command prompt window opens when launching the app.
 */
function fixPeSubsystem(filePath) {
  if (!fs.existsSync(filePath)) return;

  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 0x200) return;

    // Check MZ signature
    if (buf.readUInt16LE(0) !== 0x5a4d) return;

    // Read PE Header offset
    const peOffset = buf.readUInt32LE(0x3c);
    if (buf.length < peOffset + 0x60) return;

    // Check PE signature ('PE\0\0')
    if (buf.readUInt32BE(peOffset) !== 0x50450000) return;

    const subsystemOffset = peOffset + 0x5c;
    const currentSubsystem = buf.readUInt16LE(subsystemOffset);

    // Subsystem 2 = IMAGE_SUBSYSTEM_WINDOWS_GUI (No terminal window)
    // Subsystem 3 = IMAGE_SUBSYSTEM_WINDOWS_CUI (Opens cmd.exe terminal)
    if (currentSubsystem !== 2) {
      console.log(`[Win Patch] Changing ${path.basename(filePath)} PE Subsystem from ${currentSubsystem} to 2 (GUI Mode)...`);
      buf.writeUInt16LE(2, subsystemOffset);
      fs.writeFileSync(filePath, buf);
      console.log(`[Win Patch] Successfully patched ${path.basename(filePath)} to GUI mode!`);
    } else {
      console.log(`[Win Patch] Verified ${path.basename(filePath)} is already in GUI mode (Subsystem 2). No terminal will open!`);
    }
  } catch (err) {
    console.warn(`[Win Patch] Warning: Failed to inspect/patch PE header for ${filePath}:`, err.message);
  }
}

// Target paths to patch
const targetFiles = [
  path.resolve('dist/reststudio/reststudio-win_x64.exe'),
  path.resolve('dist/reststudio/reststudio-win_x86.exe'),
  path.resolve('dist/reststudio/reststudio-win_arm64.exe'),
  path.resolve('bin/reststudio-win_x64.exe'),
  path.resolve('bin/neutralino-win_x64.exe'),
];

targetFiles.forEach((file) => fixPeSubsystem(file));

// Also package a clean, self-contained Windows folder in dist/reststudio/RestStudio-Windows-x64/
const distRestStudioDir = path.resolve('dist/reststudio');
const winExe = path.join(distRestStudioDir, 'reststudio-win_x64.exe');
const resNeu = path.join(distRestStudioDir, 'resources.neu');

if (fs.existsSync(winExe)) {
  const winBundleDir = path.join(distRestStudioDir, 'RestStudio-Windows-x64');
  fs.mkdirSync(winBundleDir, { recursive: true });

  fs.copyFileSync(winExe, path.join(winBundleDir, 'reststudio-win_x64.exe'));
  
  if (fs.existsSync(resNeu)) {
    fs.copyFileSync(resNeu, path.join(winBundleDir, 'resources.neu'));
  }

  if (fs.existsSync('public/icon.png')) {
    fs.copyFileSync('public/icon.png', path.join(winBundleDir, 'icon.png'));
  }

  console.log(`[Win Patch] Created self-contained Windows release package: ${winBundleDir}`);
}
