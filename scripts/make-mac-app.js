import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const binDir = path.resolve('bin');

if (!fs.existsSync(binDir)) {
  console.log('[Mac App Bundler] bin directory does not exist, skipping.');
  process.exit(0);
}

const targets = [
  { name: 'RestStudio-ARM64.app', binary: 'reststudio-mac_arm64' },
  { name: 'RestStudio-x64.app', binary: 'reststudio-mac_x64' },
  { name: 'RestStudio-Universal.app', binary: 'reststudio-mac_universal' },
];

let created = 0;

targets.forEach(({ name, binary }) => {
  const binaryPath = path.join(binDir, binary);
  if (!fs.existsSync(binaryPath)) return;

  const appDir = path.join(binDir, name);
  const contentsDir = path.join(appDir, 'Contents');
  const macOSDir = path.join(contentsDir, 'MacOS');
  const resourcesDir = path.join(contentsDir, 'Resources');

  fs.mkdirSync(macOSDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });

  // Copy target binary and resources.neu into Contents/MacOS
  fs.copyFileSync(binaryPath, path.join(macOSDir, binary));
  const resNeu = path.join(binDir, 'resources.neu');
  if (fs.existsSync(resNeu)) {
    fs.copyFileSync(resNeu, path.join(macOSDir, 'resources.neu'));
  }

  // Copy icon
  if (fs.existsSync('public/icon.png')) {
    fs.copyFileSync('public/icon.png', path.join(resourcesDir, 'icon.png'));
  }

  // Write Info.plist
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

  // Set executable bit and clear quarantine attribute so double clicking works instantly
  try {
    execSync(`chmod +x "${path.join(macOSDir, binary)}"`);
    execSync(`xattr -cr "${appDir}" 2>/dev/null || true`);
  } catch (_) {}

  console.log(`[Mac App Bundler] Created native macOS App bundle: bin/${name}`);
  created++;
});

if (created === 0) {
  console.log('[Mac App Bundler] No macOS binaries found in bin/ to bundle.');
}
