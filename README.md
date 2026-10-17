# Linquan Sun Photography

A lightweight, static portfolio for Linquan Sun’s photographs.

> The site implementation was generated with OpenAI Codex using the GPT-6 model. The photographs are Linquan Sun’s work; they are not AI-generated.

## Architecture

```mermaid
flowchart LR
  A[Portfolio originals<br/>images/portfolio/] -->|photos:sync with Sharp| B[Optimized portfolio images]
  B --> C[Astro portfolio and photo manifest]
  J[Profile original<br/>images/profile/profile.JPG] -->|profile:sync with Sharp| K[Full-frame optimized profile image]
  K --> C
  C --> D[GitHub repository]
  D -->|push to main| E[GitHub Actions build]
  E --> F[GitHub Pages CDN]
  F --> G[github.io address or custom domain]
```

- **Astro** builds static HTML, CSS, and JavaScript. There is no application server or database to maintain.
- **GitHub** stores the site source, photo manifest, and optimized portfolio images. Camera originals stay in local source folders and are ignored by Git.
- **GitHub Actions and GitHub Pages** build and serve the site. A custom domain can point to Pages when ready.
- Each photo category has its own static slideshow page. If the collection approaches GitHub Pages’ published-site size limit, consider moving photo assets to object storage such as Cloudflare R2 while keeping the site and its manifest in Git.

## Photo workflow

1. Put digital photo originals into folders under `images/portfolio/`. Folder names become gallery categories; nested folders become nested category names. Empty folders are omitted. The `style` and `pswp` folders are excluded.
2. Run `pnpm photos:sync`. Sharp reads and rotates images according to their orientation, then creates display images up to 4800px and 1600px thumbnails under `public/images/gallery/`, without enlarging smaller originals. `src/data/photos.json` is regenerated, including a monochrome flag so the B&W preview control is hidden for already monochrome photographs.
3. Photos are grouped by folder and sorted by filename within each folder, independent of image orientation.
4. Keep the profile source at `images/profile/profile.JPG`. Run `pnpm profile:sync` to create a full-frame, optimized `public/images/profile.jpg` shown on the About page.
5. Review the site locally, then commit generated assets and manifests with any code changes.

The public photo copies have their EXIF data removed to avoid accidentally publishing private details such as GPS coordinates. Optional display metadata can be added to entries in `src/data/photos.json`: `title`, `location`, `date`, `camera`, `lens`, and `caption`.

The homepage links to a separate page for each photo category. Each category page is a slideshow: click the left or right side of the image, or focus it and use the arrow keys, to move between photographs. Captions and the reversible black-and-white preview stay beneath the image; the preview control is hidden for photos already detected as monochrome.

Keep camera originals backed up separately. Only curated, optimized images belong in this repository.

## Commands

The project uses Node.js 24 and pnpm 11.19.0. Run these from the repository root.

| Task | Command |
| --- | --- |
| Install dependencies | `pnpm install` |
| Start the local development site | `pnpm dev` |
| Regenerate the digital photo gallery after changing `images/portfolio/` | `pnpm photos:sync` |
| Regenerate the full-frame profile image after changing `images/profile/profile.JPG` | `pnpm profile:sync` |
| Build the production site | `pnpm build` |
| Preview the production build locally | `pnpm preview` |

After syncing new photos, refresh the local development site. Before deploying, run the relevant sync command(s), then `pnpm build`; commit the generated images and manifests along with the changes. GitHub Actions builds and deploys the committed site, so it does not need access to the ignored camera scans.

## Deployment

The GitHub Actions workflow builds and deploys commits pushed to `main`. In the repository’s **Settings → Pages**, select **GitHub Actions** as the deployment source.

## Custom domain

Configure the domain’s DNS for GitHub Pages, then add the domain under **Settings → Pages**. Add a `public/CNAME` file containing the domain name and update `site` in `astro.config.mjs` to the matching `https://` URL. The GitHub Pages documentation covers [custom-domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
