import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const appReleasePath = path.join(rootDir, "src", "config", "appRelease.ts");
const versionJsonPath = path.join(rootDir, "public", "version.json");
const packageJsonPath = path.join(rootDir, "package.json");

try {
  const content = fs.readFileSync(appReleasePath, "utf-8");
  const versionMatch = content.match(/version:\s*["']([^"']+)["']/);
  const versionLabelMatch = content.match(/versionLabel:\s*["']([^"']+)["']/);
  const releaseDateMatch = content.match(/releaseDate:\s*["']([^"']+)["']/);

  if (versionMatch && versionLabelMatch && releaseDateMatch) {
    const version = versionMatch[1];
    const versionLabel = versionLabelMatch[1];
    const releaseDate = releaseDateMatch[1];

    const versionData = {
      version,
      versionLabel,
      releaseDate,
      timestamp: Date.now(),
    };

    fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2) + "\n");
    console.log(`[sync-version] Synced public/version.json to ${versionLabel} (${releaseDate})`);

    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      if (pkg.version !== version) {
        pkg.version = version;
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
        console.log(`[sync-version] Synced package.json to ${version}`);
      }
    }
  } else {
    console.warn("[sync-version] Could not parse CURRENT_RELEASE from appRelease.ts");
  }
} catch (err) {
  console.error("[sync-version] Error syncing version:", err);
}
