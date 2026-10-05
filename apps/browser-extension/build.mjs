import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, 'dist');
const files = [
  'manifest.json',
  'background.js',
  'shared.js',
  'popup.html',
  'popup.css',
  'popup.js',
  'options.html',
  'options.css',
  'options.js'
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(dist, file));
}
await cp(resolve(root, 'icons'), resolve(dist, 'icons'), { recursive: true });

const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'));

if (manifest.manifest_version !== 3 || !manifest.background?.service_worker) {
  throw new Error('Invalid Manifest V3 build output');
}
if (!manifest.action?.default_popup) {
  throw new Error('Browser Companion build must provide a toolbar popup');
}
if (manifest.content_scripts || manifest.host_permissions?.includes('<all_urls>')) {
  throw new Error('Browser Companion must not inject into every page by default');
}
if (!manifest.optional_host_permissions?.length) {
  throw new Error('Browser Companion must request API host permission explicitly');
}

await writeFile(
  resolve(dist, 'BUILD_INFO.json'),
  JSON.stringify({
    name: manifest.name,
    version: manifest.version,
    permissions: manifest.permissions,
    optionalHostPermissions: manifest.optional_host_permissions,
    files: [...files, 'icons/'],
    builtAt: new Date().toISOString()
  }, null, 2) + '\n'
);

console.log(`Built ${manifest.name} v${manifest.version} -> ${dist}`);
