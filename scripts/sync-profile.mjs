import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.join(process.cwd(), "images", "profile", "profile.JPG");
const output = path.join(process.cwd(), "public", "images", "profile.jpg");

await fs.mkdir(path.dirname(output), { recursive: true });
await sharp(source, { failOn: "none" })
  .rotate()
  .resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true })
  .jpeg({ quality: 88, mozjpeg: true, progressive: true })
  .toFile(output);

console.log(`Created full-frame profile image at ${path.relative(process.cwd(), output)}.`);
