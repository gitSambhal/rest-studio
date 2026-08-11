import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Creates native macOS .app bundles for Neutralino build targets.
 * Packaging inside a .app bundle prevents macOS from opening Terminal.app when the user double-clicks the application.
 */

// Look for binaries in dist/reststudio first, then bin/
const searchDirs = [
  path.resolve('dist/reststudio'),
  path.resolve('bin'),
];

const targets = [
  { appName: 'RestStudio-Mac-ARM64.app', binary: 'reststudio-mac_arm64' },
  { appName: 'RestStudio-Mac-x64.app', binary: 'reststudio-mac_x64' },
  { appName: 'RestStudio-Mac-Universal.app', binary: 'reststudio-mac_universal' },
];

let totalCreated = 0;

searchDirs.forEach((searchDir) => {
  if (!fs.existsSync(searchDir)) return;

  const resNeuPath = path.join(searchDir, 'resources.neu');

  targets.forEach(({ appName, binary }) => {
    const binaryPath = path.join(searchDir, binary);
    if (!fs.existsSync(binaryPath)) return;

    const appDir = path.join(searchDir, appName);
    const contentsDir = path.join(appDir, 'Contents');
    const macOSDir = path.join(contentsDir, 'MacOS');
    const resourcesDir = path.join(contentsDir, 'Resources');

    fs.mkdirSync(macOSDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });

    // 1. Copy executable binary to Contents/MacOS
    fs.copyFileSync(binaryPath, path.join(macOSDir, binary));

    // 2. Copy resources.neu into Contents/MacOS and Contents/Resources next to binary
    const activeResNeu = fs.existsSync(resNeuPath) ? resNeuPath : path.resolve('dist/reststudio/resources.neu');
    if (fs.existsSync(activeResNeu)) {
      fs.copyFileSync(activeResNeu, path.join(macOSDir, 'resources.neu'));
      fs.copyFileSync(activeResNeu, path.join(resourcesDir, 'resources.neu'));
    }

    // 3. Copy icon
    if (fs.existsSync('public/icon.png')) {
      fs.copyFileSync('public/icon.png', path.join(resourcesDir, 'icon.png'));
    }

    // 4. Create Info.plist (Native GUI app declaration)
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${binary}</string>
    <key>CFBundleIdentifier</key>
    <string>top.suhail.rest-studio</string>
    <key>CFBundleName</key>
    <string>RestStudio</string>
    <key>CFBundleDisplayName</key>
    <string>RestStudio</string>
    <key>CFBundleIconFile</key>
    <string>icon.png</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>`;

    fs.writeFileSync(path.join(contentsDir, 'Info.plist'), plistContent);

    // 5. Grant execute permissions and clear gatekeeper quarantine flag
    try {
      execSync(`chmod +x "${path.join(macOSDir, binary)}"`);
      execSync(`xattr -cr "${appDir}" 2>/dev/null || true`);
    } catch (_) {}

    console.log(`[Mac App Bundler] Created native macOS App bundle: ${appDir}`);
    totalCreated++;
  });
});

if (totalCreated === 0) {
  console.log('[Mac App Bundler] No macOS binaries found to bundle into .app packages.');
}
