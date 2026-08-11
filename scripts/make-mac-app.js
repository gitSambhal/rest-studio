import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sevenZipBin from '7zip-bin';

/**
 * Creates native macOS .app bundles and .zip archives for Neutralino build targets.
 * Ensures proper CFBundleExecutable naming ("RestStudio"), PkgInfo header, executable permissions,
 * and ZIP archives to preserve Mac permissions during web downloads.
 */

const distRestStudioDir = path.resolve('dist/reststudio');
const searchDirs = [
  distRestStudioDir,
  path.resolve('bin'),
];

const targets = [
  { appName: 'RestStudio-Mac-ARM64.app', zipName: 'RestStudio-Mac-ARM64.zip', binary: 'reststudio-mac_arm64' },
  { appName: 'RestStudio-Mac-x64.app', zipName: 'RestStudio-Mac-x64.zip', binary: 'reststudio-mac_x64' },
  { appName: 'RestStudio-Mac-Universal.app', zipName: 'RestStudio-Mac-Universal.zip', binary: 'reststudio-mac_universal' },
];

let totalCreated = 0;

searchDirs.forEach((searchDir) => {
  if (!fs.existsSync(searchDir)) return;

  targets.forEach(({ appName, zipName, binary }) => {
    const binaryPath = path.join(searchDir, binary);
    if (!fs.existsSync(binaryPath)) return;

    const appDir = path.join(distRestStudioDir, appName);
    const contentsDir = path.join(appDir, 'Contents');
    const macOSDir = path.join(contentsDir, 'MacOS');
    const resourcesDir = path.join(contentsDir, 'Resources');

    // Remove stale bundle if exists
    fs.rmSync(appDir, { recursive: true, force: true });

    fs.mkdirSync(macOSDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });

    // 1. Copy executable binary to Contents/MacOS/RestStudio
    const mainExePath = path.join(macOSDir, 'RestStudio');
    fs.copyFileSync(binaryPath, mainExePath);

    // 2. Copy icon
    if (fs.existsSync('public/icon.png')) {
      fs.copyFileSync('public/icon.png', path.join(resourcesDir, 'icon.png'));
    }

    // 3. Create PkgInfo
    fs.writeFileSync(path.join(contentsDir, 'PkgInfo'), 'APPL????');

    // 4. Create Info.plist with clean CFBundleExecutable matching "RestStudio"
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>RestStudio</string>
    <key>CFBundleIconFile</key>
    <string>icon.png</string>
    <key>CFBundleIdentifier</key>
    <string>top.suhail.rest-studio</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>RestStudio</string>
    <key>CFBundleDisplayName</key>
    <string>RestStudio</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>Copyright © 2026 RestStudio</string>
</dict>
</plist>`;

    fs.writeFileSync(path.join(contentsDir, 'Info.plist'), plistContent);

    // 5. Grant execute permissions and clear gatekeeper quarantine flag
    try {
      fs.chmodSync(mainExePath, '755');
      execSync(`chmod +x "${mainExePath}" 2>/dev/null || true`);
      execSync(`xattr -cr "${appDir}" 2>/dev/null || true`);
    } catch (_) {}

    console.log(`[Mac App Bundler] Created native macOS App bundle: ${appDir}`);

    // 6. Create macOS ZIP archive package for easy distribution
    const p7z = sevenZipBin.path7za;
    if (fs.existsSync(p7z)) {
      try {
        try { fs.chmodSync(p7z, '755'); } catch (_) {}
        const zipPath = path.join(distRestStudioDir, zipName);
        fs.rmSync(zipPath, { force: true });
        execSync(`"${p7z}" a -tzip "${zipName}" "${appName}"`, { cwd: distRestStudioDir, stdio: 'pipe' });
        console.log(`[Mac App Bundler] Created macOS ZIP package: ${zipPath}`);
      } catch (err) {
        console.warn(`[Mac App Bundler] Could not zip ${appName}:`, err.message);
      }
    }

    totalCreated++;
  });
});

// Clean up loose raw Mac binaries in dist/reststudio to prevent duplicate files
if (fs.existsSync(distRestStudioDir)) {
  ['reststudio-mac_arm64', 'reststudio-mac_x64', 'reststudio-mac_universal'].forEach((rawBinary) => {
    const rawPath = path.join(distRestStudioDir, rawBinary);
    if (fs.existsSync(rawPath)) {
      fs.unlinkSync(rawPath);
      console.log(`[Mac App Bundler] Removed raw duplicate binary: ${rawBinary}`);
    }
  });
}

if (totalCreated === 0) {
  console.log('[Mac App Bundler] No macOS binaries found to bundle into .app packages.');
}
