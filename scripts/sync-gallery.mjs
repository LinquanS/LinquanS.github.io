import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourceRoot = path.join(root, "images", "portfolio");
const galleryRoot = path.join(root, "public", "images", "gallery");
const dataFile = path.join(root, "src", "data", "photos.json");
const acceptedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const excludedFolders = new Set(["pswp", "style"]);
const oldPhotos = JSON.parse(await fs.readFile(dataFile, "utf8").catch(() => "[]"));
const previousMetadataByName = new Map(oldPhotos.map((photo) => [
  path.basename(decodeURIComponent(photo.image ?? "")).toLowerCase(), photo,
]));
const previousMetadataBySource = new Map(oldPhotos.filter((photo) => photo._source).map((photo) => [
  photo._source.replaceAll("\\", "/").toLowerCase(), photo,
]));

async function collect(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const images = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludedFolders.has(entry.name.toLowerCase())) images.push(...await collect(fullPath));
    } else if (entry.isFile() && acceptedExtensions.has(path.extname(entry.name).toLowerCase())) {
      images.push(fullPath);
    }
  }
  return images;
}

function slug(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function urlPath(value) {
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

const imageFiles = await collect(sourceRoot);
const grouped = new Map();
for (const file of imageFiles) {
  const relative = path.relative(sourceRoot, file);
  const folder = path.dirname(relative);
  const categoryParts = folder === "." ? ["Unsorted"] : folder.split(path.sep);
  const category = categoryParts.join(" / ");
  const categoryId = slug(categoryParts.join("-"));
  const categorySlug = slug(categoryParts.join("/"));
  const metadata = await sharp(file).metadata();
  const swapped = [5, 6, 7, 8].includes(metadata.orientation);
  const width = swapped ? metadata.height : metadata.width;
  const height = swapped ? metadata.width : metadata.height;
  const orientation = width === height ? "square" : width > height ? "landscape" : "portrait";
  const outputName = `${path.parse(file).name}.jpg`;
  const folderPath = path.join(categorySlug, path.parse(outputName).name);
  const webFile = path.join(galleryRoot, categorySlug, "web", outputName);
  const thumbFile = path.join(galleryRoot, categorySlug, "thumbs", outputName);
  const sourceKey = relative.split(path.sep).join("/").toLowerCase();
  const original = previousMetadataBySource.get(sourceKey) ?? previousMetadataByName.get(path.basename(file).toLowerCase()) ?? {};
  const fallbackAlt = `${category} photograph: ${path.parse(file).name}`;
  const alt = original.alt && !/^Photograph \d+$/i.test(original.alt) ? original.alt : fallbackAlt;
  const encodedFolder = urlPath(path.join("/images/gallery", categorySlug));
  const encodedName = encodeURIComponent(outputName);
  const photo = {
    image: `${encodedFolder}/web/${encodedName}`,
    thumbnail: `${encodedFolder}/thumbs/${encodedName}`,
    alt,
    title: original.title ?? "",
    location: original.location ?? "",
    date: original.date ?? "",
    camera: original.camera ?? "",
    lens: original.lens ?? "",
    category,
    categoryId,
    orientation,
    monochrome: /b\s*&\s*w|black.?white|monochrome/i.test(relative),
    _source: relative.split(path.sep).join("/"),
  };
  if (!grouped.has(category)) grouped.set(category, []);
  grouped.get(category).push({ file, webFile, thumbFile, photo, orientation, name: path.basename(file) });
}

await fs.rm(galleryRoot, { recursive: true, force: true });
const photos = [];
const batches = [];
for (const category of [...grouped.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }))) {
  const items = grouped.get(category).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
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
  if ((i + 3) % 30 === 0 || i + 3 >= batches.length) {
    console.log(`Optimized ${Math.min(i + 3, batches.length)} / ${batches.length} photos`);
  }
}

await fs.writeFile(dataFile, `${JSON.stringify(photos, null, 2)}\n`);
console.log(`Created ${photos.length} photos in ${grouped.size} non-empty folders.`);

