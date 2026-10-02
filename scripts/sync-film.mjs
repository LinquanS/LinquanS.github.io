import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "images", "film");
const outputRoot = path.join(root, "public", "images", "film");
const dataFile = path.join(root, "src", "data", "film.json");
const acceptedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const previousPhotos = JSON.parse(await fs.readFile(dataFile, "utf8").catch(() => "[]"));
const previousBySource = new Map(previousPhotos.map((photo) => [photo._source?.toLowerCase(), photo]));

async function collect(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(fullPath));
    else if (entry.isFile() && acceptedExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

function slug(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function encodePath(value) {
  return value.split(path.sep).map(encodeURIComponent).join("/");
}

async function isMonochrome(file) {
  const { channels } = await sharp(file).stats();
  const rgb = channels.slice(0, 3);
  if (rgb.length < 3) return true;
  const meanSpread = Math.max(...rgb.map((channel) => channel.mean)) - Math.min(...rgb.map((channel) => channel.mean));
  const deviationSpread = Math.max(...rgb.map((channel) => channel.stdev)) - Math.min(...rgb.map((channel) => channel.stdev));
  return meanSpread <= 1 && deviationSpread <= 1;
}

const grouped = new Map();
for (const file of await collect(sourceRoot)) {
  const relative = path.relative(sourceRoot, file);
  const folderPath = path.dirname(relative);
  const roll = folderPath === "." ? "Unsorted" : folderPath.split(path.sep).join(" / ");
  const rollId = slug(roll);
  const previous = previousBySource.get(relative.split(path.sep).join("/").toLowerCase()) ?? {};
  const parsed = path.parse(file);
  const outputName = `${parsed.name}.jpg`;
  const outputFolder = path.join(outputRoot, folderPath);
  const webFile = path.join(outputFolder, "web", outputName);
  const thumbFile = path.join(outputFolder, "thumbs", outputName);
  const metadata = await sharp(file, { failOn: "none" }).metadata();
  const swapped = [5, 6, 7, 8].includes(metadata.orientation);
  const width = swapped ? metadata.height : metadata.width;
  const height = swapped ? metadata.width : metadata.height;
  const orientation = width === height ? "square" : width > height ? "landscape" : "portrait";
  const encodedFolder = encodePath(folderPath === "." ? "" : folderPath);
  const encodedName = encodeURIComponent(outputName);
  const assetBase = `/images/film/${encodedFolder ? `${encodedFolder}/` : ""}`;
  const sourceName = relative.split(path.sep).join("/");
  const photo = {
    image: `${assetBase}web/${encodedName}`,
    thumbnail: `${assetBase}thumbs/${encodedName}`,
    alt: previous.alt || `${roll} film photograph: ${parsed.name}`,
    title: previous.title ?? "",
    location: previous.location ?? "",
    date: previous.date ?? "",
    camera: previous.camera ?? "",
    lens: previous.lens ?? "",
    roll,
    rollId,
    orientation,
    monochrome: /b\s*&\s*w|black.?white|monochrome|lady\s*grey|lady\s*gray/i.test(sourceName),
    _source: sourceName,
  };
  if (!grouped.has(roll)) grouped.set(roll, []);
  grouped.get(roll).push({ file, webFile, thumbFile, name: path.basename(file), photo });
}

await fs.rm(outputRoot, { recursive: true, force: true });
const photos = [];
const batches = [];
for (const roll of [...grouped.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))) {
  const items = grouped.get(roll).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  for (const item of items) {
    photos.push(item.photo);
    batches.push(async () => {
      await fs.mkdir(path.dirname(item.webFile), { recursive: true });
      await fs.mkdir(path.dirname(item.thumbFile), { recursive: true });
      const image = sharp(item.file, { failOn: "none" }).rotate();
      await Promise.all([
        image.clone().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 86, mozjpeg: true, progressive: true }).toFile(item.webFile),
        image.clone().resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(item.thumbFile),
      ]);
      item.photo.monochrome ||= await isMonochrome(item.thumbFile);
    });
  }
}

for (let i = 0; i < batches.length; i += 3) {
  await Promise.all(batches.slice(i, i + 3).map((run) => run()));
  if ((i + 3) % 15 === 0 || i + 3 >= batches.length) {
    console.log(`Optimized ${Math.min(i + 3, batches.length)} / ${batches.length} film photos`);
  }
}

await fs.mkdir(path.dirname(dataFile), { recursive: true });
await fs.writeFile(dataFile, `${JSON.stringify(photos, null, 2)}\n`);
console.log(`Created ${photos.length} film photos in ${grouped.size} folders.`);
