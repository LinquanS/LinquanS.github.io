(() => {
  const photoGrids = [...document.querySelectorAll(".photo-grid")];
  const layoutMasonry = (grid) => {
    const styles = getComputedStyle(grid);
    const rowHeight = Number.parseFloat(styles.gridAutoRows);
    const rowGap = Number.parseFloat(styles.rowGap);
    const photoGap = Number.parseFloat(styles.getPropertyValue("--photo-gap"));
    if (!rowHeight || !Number.isFinite(rowGap) || !Number.isFinite(photoGap)) return;

    const cards = [...grid.querySelectorAll(".photo-card")];
    for (const card of cards) card.style.gridRowEnd = "auto";
    for (const card of cards) {
      const height = card.getBoundingClientRect().height;
      const rowSpan = Math.ceil((height + photoGap) / (rowHeight + rowGap));
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
  const stage = dialog.querySelector(".lightbox-stage");
  const title = dialog.querySelector(".lightbox-title");
  const details = dialog.querySelector(".lightbox-details");
  const monochrome = dialog.querySelector(".lightbox-bw");
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let pinch = null;
  let pan = null;
  let tapCandidate = null;
  let lastTap = null;
  const pointers = new Map();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function constrainOffsets() {
    const maxX = Math.max(0, (image.offsetWidth * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * scale - stage.clientHeight) / 2);
    offsetX = clamp(offsetX, -maxX, maxX);
    offsetY = clamp(offsetY, -maxY, maxY);
  }

  function renderZoom() {
    constrainOffsets();
    image.style.transform = scale === 1 ? "none" : `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
    image.classList.toggle("is-zoomed", scale > 1);
  }

  function zoomAt(nextScale, clientX, clientY) {
    const next = clamp(nextScale, 1, 5);
    if (next === 1) {
      scale = 1;
      offsetX = 0;
      offsetY = 0;
    } else {
      const rect = stage.getBoundingClientRect();
      const x = clientX - rect.left - rect.width / 2;
      const y = clientY - rect.top - rect.height / 2;
      offsetX = x - ((x - offsetX) / scale) * next;
      offsetY = y - ((y - offsetY) / scale) * next;
      scale = next;
    }
    renderZoom();
  }

  function resetZoom() {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    pinch = null;
    pan = null;
    tapCandidate = null;
    lastTap = null;
    image.style.transform = "none";
    image.classList.remove("is-zoomed", "is-dragging");
  }

  function updateStageOrientation(orientation) {
    const isPortrait = orientation === "portrait";
    dialog.dataset.orientation = isPortrait ? "portrait" : "landscape";
    stage.dataset.orientation = isPortrait ? "portrait" : "landscape";
    image.style.maxWidth = "100%";
    image.style.maxHeight = "100%";
    image.style.objectFit = "contain";

    const width = image.naturalWidth || 1;
    const height = image.naturalHeight || 1;
    const aspect = width / height;
    const availableWidth = stage.clientWidth || 1;
    const availableHeight = stage.clientHeight || 1;
    const maxWidthFromHeight = availableHeight * aspect;
    const maxHeightFromWidth = availableWidth / aspect;
    let renderWidth = availableWidth;
    let renderHeight = availableHeight;

    if (isPortrait) {
      renderHeight = Math.min(availableHeight, height / width * availableWidth);
      renderWidth = renderHeight * aspect;
    } else {
      renderWidth = Math.min(availableWidth, width / height * availableHeight);
      renderHeight = renderWidth / aspect;
    }

    if (renderWidth > Math.min(availableWidth, maxWidthFromHeight)) {
      renderWidth = Math.min(availableWidth, maxWidthFromHeight);
      renderHeight = renderWidth / aspect;
    }
    if (renderHeight > Math.min(availableHeight, maxHeightFromWidth)) {
      renderHeight = Math.min(availableHeight, maxHeightFromWidth);
      renderWidth = renderHeight * aspect;
    }

    image.style.width = `${renderWidth.toFixed(2)}px`;
    image.style.height = `${renderHeight.toFixed(2)}px`;
  }

  image.addEventListener("load", () => {
    const orientation = image.naturalHeight > image.naturalWidth ? "portrait" : "landscape";
    updateStageOrientation(orientation);
  });

  document.querySelectorAll(".photo-card").forEach((card) => {
    card.addEventListener("click", () => {
      resetZoom();
      image.src = card.dataset.full;
      image.alt = card.querySelector("img")?.alt ?? "Portfolio photograph";
      title.textContent = card.dataset.title || "";
      details.textContent = [card.dataset.location, card.dataset.date, card.dataset.camera, card.dataset.lens].filter(Boolean).join(" · ");
      updateStageOrientation(card.dataset.orientation === "portrait" ? "portrait" : "landscape");
      image.classList.remove("is-monochrome");
      monochrome.hidden = card.dataset.monochrome === "true";
      monochrome.setAttribute("aria-pressed", "false");
      dialog.showModal();
    });
  });

  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomAt(scale * Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY);
  }, { passive: false });
  stage.addEventListener("dblclick", (event) => {
    event.preventDefault();
    zoomAt(scale > 1 ? 1 : 2, event.clientX, event.clientY);
  });

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stage.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY, type: event.pointerType, startX: event.clientX, startY: event.clientY };
    pointers.set(event.pointerId, point);
    if (event.pointerType === "touch" && pointers.size === 1) {
      tapCandidate = { id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false };
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      a.startX = a.x;
      a.startY = a.y;
      b.startX = b.x;
      b.startY = b.y;
      pinch = { distance: distance(a, b), scale, offsetX, offsetY };
      pan = null;
      if (tapCandidate) tapCandidate.cancelled = true;
    } else if (pointers.size === 1 && scale > 1) {
      pan = { id: event.pointerId, x: event.clientX, y: event.clientY, offsetX, offsetY };
    }
  });

  stage.addEventListener("pointermove", (event) => {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    point.x = event.clientX;
    point.y = event.clientY;
    if (tapCandidate && tapCandidate.id === event.pointerId && Math.hypot(event.clientX - tapCandidate.x, event.clientY - tapCandidate.y) > 12) {
      tapCandidate.cancelled = true;
    }
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const rect = stage.getBoundingClientRect();
      const midX = (a.x + b.x) / 2 - rect.left - rect.width / 2;
      const midY = (a.y + b.y) / 2 - rect.top - rect.height / 2;
      const startMidX = (a.startX + b.startX) / 2 - rect.left - rect.width / 2;
      const startMidY = (a.startY + b.startY) / 2 - rect.top - rect.height / 2;
      const nextScale = clamp(pinch.scale * distance(a, b) / pinch.distance, 1, 5);
      offsetX = midX - ((startMidX - pinch.offsetX) / pinch.scale) * nextScale;
      offsetY = midY - ((startMidY - pinch.offsetY) / pinch.scale) * nextScale;
      scale = nextScale;
      renderZoom();
    } else if (pan?.id === event.pointerId) {
      offsetX = pan.offsetX + event.clientX - pan.x;
      offsetY = pan.offsetY + event.clientY - pan.y;
      image.classList.add("is-dragging");
      renderZoom();
    }
  });

  function endPointer(event, cancelled = false) {
    const point = pointers.get(event.pointerId);
    if (!point) return;
    pointers.delete(event.pointerId);
    if (point.type === "touch" && !cancelled && pointers.size === 0 && tapCandidate?.id === event.pointerId && !tapCandidate.cancelled) {
      const now = performance.now();
      if (lastTap && now - lastTap.time < 360 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 32) {
        zoomAt(scale > 1 ? 1 : 2, event.clientX, event.clientY);
        lastTap = null;
      } else {
        lastTap = { time: now, x: event.clientX, y: event.clientY };
      }
    }
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      pan = null;
      tapCandidate = null;
      image.classList.remove("is-dragging");
    } else if (pointers.size === 1 && scale > 1) {
      const [id, remaining] = [...pointers.entries()][0];
      pan = { id, x: remaining.x, y: remaining.y, offsetX, offsetY };
    }
  }
  stage.addEventListener("pointerup", (event) => endPointer(event));
  stage.addEventListener("pointercancel", (event) => endPointer(event, true));
  stage.addEventListener("keydown", (event) => {
    if (["+", "="].includes(event.key)) zoomAt(scale * 1.5, stage.getBoundingClientRect().left + stage.clientWidth / 2, stage.getBoundingClientRect().top + stage.clientHeight / 2);
    else if (["-", "_"].includes(event.key)) zoomAt(scale / 1.5, stage.getBoundingClientRect().left + stage.clientWidth / 2, stage.getBoundingClientRect().top + stage.clientHeight / 2);
    else if (event.key === "0") resetZoom();
    else return;
    event.preventDefault();
  });

  monochrome.addEventListener("click", () => {
    const isMonochrome = image.classList.toggle("is-monochrome");
    monochrome.setAttribute("aria-pressed", String(isMonochrome));
  });
  dialog.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { image.removeAttribute("src"); resetZoom(); image.classList.remove("is-monochrome"); monochrome.hidden = false; monochrome.setAttribute("aria-pressed", "false"); });
})();
