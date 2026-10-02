import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.join(process.cwd(), "images", "profile", "profile.JPG");
const output = path.join(process.cwd(), "public", "images", "profile.jpg");

await fs.mkdir(path.dirname(output), { recursive: true });
await sharp(source, { failOn: "none" })
  .rotate()
  .resize(900, 900, { fit: "cover", position: sharp.strategy.attention })
  .jpeg({ quality: 88, mozjpeg: true, progressive: true })
  .toFile(output);

console.log(`Created square profile image at ${path.relative(process.cwd(), output)}.`);
