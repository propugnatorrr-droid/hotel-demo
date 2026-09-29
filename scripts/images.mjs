import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const NAMES = [
  'hero', 'cove', 'night', 'exterior-day', 'reception', 'owner', 'guest-phone', 'pool-bar',
  'restaurant', 'breakfast', 'room-seaview', 'suite-bath', 'spa', 'beach-club', 'housekeeping', 'back-office',
  'login', 'heritage-gjirokaster', 'city-tirana', 'mountain-theth', 'team', 'detail-welcome',
];
const RAW = 'scripts/raw-images';
const outDir = (i) => (i < 16 ? 'public/images/marketing' : 'public/images/platform');

await mkdir(RAW, { recursive: true });

if (existsSync('scripts/image-urls.txt')) {
  const urls = (await readFile('scripts/image-urls.txt', 'utf8')).split('\n').map((s) => s.trim()).filter(Boolean);
  for (const [i, url] of urls.entries()) {
    if (!NAMES[i]) break;
    const res = await fetch(url);
    if (!res.ok) { console.error(`✗ ${NAMES[i]}: HTTP ${res.status} (download it manually into ${RAW})`); continue; }
    await writeFile(path.join(RAW, `${NAMES[i]}.src`), Buffer.from(await res.arrayBuffer()));
    console.log('↓', NAMES[i]);
  }
}

const files = await readdir(RAW);
for (const [i, name] of NAMES.entries()) {
  const src = files.find((f) => path.parse(f).name.toLowerCase() === name);
  if (!src) { console.warn('… missing', name); continue; }
  const dir = outDir(i);
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, `${name}.jpg`);
  await sharp(path.join(RAW, src)).rotate()
    .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true, progressive: true })
    .toFile(out);
  console.log('✓', out);
}
