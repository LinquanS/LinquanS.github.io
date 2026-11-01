(() => {
  for (const carousel of document.querySelectorAll("[data-carousel]")) {
    const photos = JSON.parse(carousel.dataset.photos);
    const image = carousel.querySelector(".carousel-image");
    const stage = carousel.querySelector(".carousel-stage");
    const title = carousel.querySelector(".carousel-title");
    const details = carousel.querySelector(".carousel-details");
    const description = carousel.querySelector(".carousel-description");
    const monochrome = carousel.querySelector(".carousel-bw");
    const count = carousel.querySelector(".carousel-count");
    let currentIndex = 0;
    let requestedPhoto = null;

    function preloadAdjacentPhotos() {
      for (const offset of [-1, 1]) {
        const photo = photos[(currentIndex + offset + photos.length) % photos.length];
        const preload = new Image();
        preload.decoding = "async";
        preload.src = photo.thumbnail || photo.image;
      }
    }

    function sizeStageToImage() {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const mobile = window.innerWidth <= 600;
      const maxHeight = Math.min(window.innerHeight * (mobile ? 0.74 : 0.82), mobile ? 720 : 900);
      const imageHeightAtFullWidth = stage.clientWidth * image.naturalHeight / image.naturalWidth;
      stage.style.height = `${Math.min(maxHeight, Math.max(180, imageHeightAtFullWidth))}px`;
    }

    function applyPhotoFilter() {
      if (!requestedPhoto || !image.complete || !image.naturalWidth || image.currentSrc !== requestedPhoto.src) return;
      image.classList.toggle("is-monochrome", requestedPhoto.monochrome);
      monochrome.disabled = false;
    }

    function showPhoto(index) {
      currentIndex = (index + photos.length) % photos.length;
      const photo = photos[currentIndex];
      const imageSrc = photo.thumbnail || photo.image;
      requestedPhoto = { src: new URL(imageSrc, document.baseURI).href, monochrome: photo.monochrome };
      image.src = imageSrc;
      image.alt = photo.alt;
      monochrome.disabled = true;
      title.textContent = photo.title || "";
      details.textContent = [photo.location, photo.date, photo.camera, photo.lens].filter(Boolean).join(" · ");
      description.textContent = photo.caption || "";
      monochrome.hidden = photo.monochrome;
      monochrome.setAttribute("aria-pressed", "false");
      count.textContent = `${String(currentIndex + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
      applyPhotoFilter();
      preloadAdjacentPhotos();
    }

    image.addEventListener("load", () => {
      sizeStageToImage();
      applyPhotoFilter();
    });
    image.addEventListener("error", () => {
      if (requestedPhoto && image.currentSrc === requestedPhoto.src) monochrome.disabled = false;
    });
    window.addEventListener("resize", sizeStageToImage);
    let swipeStart = null;
    let suppressClickUntil = 0;

    stage.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
      stage.setPointerCapture?.(event.pointerId);
    });

    stage.addEventListener("pointerup", (event) => {
      if (!swipeStart || swipeStart.id !== event.pointerId) return;
      const deltaX = event.clientX - swipeStart.x;
      const deltaY = event.clientY - swipeStart.y;
      swipeStart = null;

      if (Math.abs(deltaX) >= 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
        suppressClickUntil = Date.now() + 500;
        showPhoto(deltaX < 0 ? currentIndex + 1 : currentIndex - 1);
      }
    });

    stage.addEventListener("pointercancel", () => {
      swipeStart = null;
    });

    stage.addEventListener("click", (event) => {
      if (Date.now() < suppressClickUntil) return;
      const bounds = stage.getBoundingClientRect();
      showPhoto(event.clientX < bounds.left + bounds.width / 2 ? currentIndex - 1 : currentIndex + 1);
    });
    monochrome.addEventListener("click", () => {
      const isMonochrome = image.classList.toggle("is-monochrome");
      monochrome.setAttribute("aria-pressed", String(isMonochrome));
    });
    stage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPhoto(currentIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showPhoto(currentIndex + 1);
      }
    });

    showPhoto(0);
    sizeStageToImage();
  }
})();
