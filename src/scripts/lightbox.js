(() => {
  const photoGrids = [...document.querySelectorAll(".photo-grid")];
  const layoutMasonry = (grid) => {
    const styles = getComputedStyle(grid);
    const rowHeight = Number.parseFloat(styles.gridAutoRows);
    const rowGap = Number.parseFloat(styles.rowGap);
    if (!rowHeight || !Number.isFinite(rowGap)) return;

    const cards = [...grid.querySelectorAll(".photo-card")];
    for (const card of cards) card.style.gridRowEnd = "auto";
    for (const card of cards) {
      const height = card.getBoundingClientRect().height;
      const rowSpan = Math.ceil((height + rowGap) / (rowHeight + rowGap));
      card.style.gridRowEnd = `span ${rowSpan}`;
    }
  };
  let layoutFrame = 0;
  const scheduleMasonry = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => photoGrids.forEach(layoutMasonry));
  };
  for (const grid of photoGrids) {
    grid.querySelectorAll("img").forEach((photo) => photo.addEventListener("load", scheduleMasonry, { once: true }));
  }
  window.addEventListener("resize", scheduleMasonry);
  document.fonts?.ready.then(scheduleMasonry);
  scheduleMasonry();

  const dialog = document.querySelector(".lightbox");
  if (!(dialog instanceof HTMLDialogElement)) return;
  const image = dialog.querySelector(".lightbox-image");
  const title = dialog.querySelector(".lightbox-title");
  const details = dialog.querySelector(".lightbox-details");
  const zoom = dialog.querySelector(".lightbox-zoom");
  const monochrome = dialog.querySelector(".lightbox-bw");
  document.querySelectorAll(".photo-card").forEach((card) => {
    card.addEventListener("click", () => {
      image.src = card.dataset.full;
      image.alt = card.querySelector("img")?.alt ?? "Portfolio photograph";
      title.textContent = card.dataset.title || "";
      details.textContent = [card.dataset.location, card.dataset.date, card.dataset.camera, card.dataset.lens].filter(Boolean).join(" · ");
      image.classList.remove("is-zoomed");
      zoom.textContent = "Zoom";
      image.classList.remove("is-monochrome");
      monochrome.hidden = card.dataset.monochrome === "true";
      monochrome.setAttribute("aria-pressed", "false");
      monochrome.textContent = "B&W preview";
      dialog.showModal();
    });
  });
  zoom.addEventListener("click", () => {
    const isZoomed = image.classList.toggle("is-zoomed");
    zoom.textContent = isZoomed ? "Fit to screen" : "Zoom";
  });
  monochrome.addEventListener("click", () => {
    const isMonochrome = image.classList.toggle("is-monochrome");
    monochrome.setAttribute("aria-pressed", String(isMonochrome));
    monochrome.textContent = isMonochrome ? "Colour preview" : "B&W preview";
  });
  dialog.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { image.removeAttribute("src"); image.classList.remove("is-zoomed", "is-monochrome"); monochrome.hidden = false; monochrome.setAttribute("aria-pressed", "false"); monochrome.textContent = "B&W preview"; });
})();
