(() => {
  const main = document.querySelector("main");
  if (!main) {
    console.error("No se encontró el contenido principal para inicializar las galerías de descargas.");
    return;
  }

  const lightbox = document.createElement("dialog");
  lightbox.className = "gallery-lightbox";
  lightbox.setAttribute("aria-label", window.i18n ? window.i18n.t("gallery_lightbox_title") : "Image viewer");
  lightbox.innerHTML = `
    <div class="lightbox-layout">
      <div class="lightbox-stage">
        <button class="lightbox-close" type="button" data-lightbox-close aria-label="Cerrar imagen" data-i18n-aria-label="gallery_close">×</button>
        <div class="lightbox-zoom" role="group" aria-label="Controles de zoom" data-i18n-aria-label="gallery_zoom_controls">
          <button class="lightbox-zoom-button" type="button" data-lightbox-zoom-out aria-label="Alejar" data-i18n-aria-label="gallery_zoom_out">−</button>
          <button class="lightbox-zoom-level" type="button" data-lightbox-zoom-reset aria-label="Restablecer zoom" data-i18n-aria-label="gallery_zoom_reset" aria-live="polite">100%</button>
          <button class="lightbox-zoom-button" type="button" data-lightbox-zoom-in aria-label="Ampliar" data-i18n-aria-label="gallery_zoom_in">+</button>
        </div>
        <button class="lightbox-arrow lightbox-prev" type="button" data-lightbox-prev aria-label="Imagen anterior" data-i18n-aria-label="gallery_prev">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.5 4.5-5.5 5.5 5.5 5.5"/></svg>
        </button>
        <img class="lightbox-image" alt="">
        <button class="lightbox-arrow lightbox-next" type="button" data-lightbox-next aria-label="Imagen siguiente" data-i18n-aria-label="gallery_next">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7.5 4.5 5.5 5.5-5.5 5.5"/></svg>
        </button>
      </div>
      <div class="lightbox-caption">
        <span class="lightbox-description"></span>
        <span class="lightbox-count" aria-live="polite"></span>
      </div>
    </div>`;
  document.body.append(lightbox);

  const lightboxImage = lightbox.querySelector(".lightbox-image");
  const lightboxStage = lightbox.querySelector(".lightbox-stage");
  const lightboxDescription = lightbox.querySelector(".lightbox-description");
  const lightboxCount = lightbox.querySelector(".lightbox-count");
  let activeGallery = null;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;
  const activePointers = new Map();

  const renderZoom = () => {
    const bounds = lightboxStage.getBoundingClientRect();
    const maxPanX = Math.max(0, (lightboxImage.clientWidth * zoom - bounds.width) / 2);
    const maxPanY = Math.max(0, (lightboxImage.clientHeight * zoom - bounds.height) / 2);
    panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
    panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    lightboxImage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    lightboxStage.classList.toggle("is-zoomed", zoom > 1);
    lightbox.querySelector("[data-lightbox-zoom-reset]").textContent = `${Math.round(zoom * 100)}%`;
    lightbox.querySelector("[data-lightbox-zoom-out]").disabled = zoom <= 1;
    lightbox.querySelector("[data-lightbox-zoom-in]").disabled = zoom >= 4;
  };

  const setZoom = (nextZoom, anchorX, anchorY) => {
    const next = Math.max(1, Math.min(4, nextZoom));
    const stageBounds = lightboxStage.getBoundingClientRect();
    const focusX = (anchorX ?? stageBounds.left + stageBounds.width / 2) - stageBounds.left - stageBounds.width / 2;
    const focusY = (anchorY ?? stageBounds.top + stageBounds.height / 2) - stageBounds.top - stageBounds.height / 2;
    const zoomRatio = next / zoom;
    panX = focusX - (focusX - panX) * zoomRatio;
    panY = focusY - (focusY - panY) * zoomRatio;
    zoom = next;
    renderZoom();
  };

  const resetZoom = () => {
    zoom = 1;
    panX = 0;
    panY = 0;
    renderZoom();
  };

  const translateLightbox = () => {
    if (window.i18n) {
      lightbox.setAttribute("aria-label", window.i18n.t("gallery_lightbox_title"));
      lightbox.querySelectorAll("[data-i18n-aria-label]").forEach((control) => {
        control.setAttribute("aria-label", window.i18n.t(control.dataset.i18nAriaLabel));
      });
    }
  };

  const renderLightbox = () => {
    if (!activeGallery) return;

    const slides = Array.from(activeGallery.querySelectorAll(".gallery-slide"));
    const activeIndex = Number(activeGallery.dataset.activeIndex || 0);
    const activeSlide = slides[activeIndex];
    const sourceImage = activeSlide?.querySelector("img");
    if (!sourceImage) {
      console.error("No se pudo cargar la imagen seleccionada de la galería.", activeGallery);
      return;
    }

    lightboxImage.src = sourceImage.currentSrc || sourceImage.src;
    lightboxImage.alt = sourceImage.alt;
    lightboxDescription.textContent = activeSlide.querySelector("figcaption")?.textContent || sourceImage.alt;
    lightboxCount.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    resetZoom();

    const hasMultipleImages = slides.length > 1;
    lightbox.querySelector("[data-lightbox-prev]").hidden = !hasMultipleImages;
    lightbox.querySelector("[data-lightbox-next]").hidden = !hasMultipleImages;
  };

  const changeLightboxImage = (offset) => {
    if (!activeGallery) return;
    const activeIndex = Number(activeGallery.dataset.activeIndex || 0);
    activeGallery.querySelector(offset < 0 ? "[data-gallery-prev]" : "[data-gallery-next]")?.click();
    if (Number(activeGallery.dataset.activeIndex || 0) === activeIndex) return;
    renderLightbox();
  };

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target.closest("[data-lightbox-close]")) {
      lightbox.close();
      return;
    }
    if (event.target.closest("[data-lightbox-prev]")) changeLightboxImage(-1);
    if (event.target.closest("[data-lightbox-next]")) changeLightboxImage(1);
    if (event.target.closest("[data-lightbox-zoom-in]")) setZoom(zoom + 0.5);
    if (event.target.closest("[data-lightbox-zoom-out]")) setZoom(zoom - 0.5);
    if (event.target.closest("[data-lightbox-zoom-reset]")) resetZoom();
  });

  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      changeLightboxImage(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      changeLightboxImage(1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      lightbox.close();
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(zoom + 0.5);
    } else if (event.key === "-") {
      event.preventDefault();
      setZoom(zoom - 0.5);
    } else if (event.key === "0") {
      event.preventDefault();
      resetZoom();
    }
  });

  lightboxStage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    if (event.pointerType === "mouse" && zoom === 1) return;
    event.preventDefault();
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    lightboxStage.setPointerCapture(event.pointerId);

    if (activePointers.size === 2) {
      const [first, second] = Array.from(activePointers.values());
      pinchStartDistance = Math.hypot(first.x - second.x, first.y - second.y);
      pinchStartZoom = zoom;
    } else {
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragStartPanX = panX;
      dragStartPanY = panY;
    }
  });

  lightboxStage.addEventListener("pointermove", (event) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });

    if (activePointers.size >= 2) {
      const [first, second] = Array.from(activePointers.values());
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (pinchStartDistance > 0) {
        setZoom(pinchStartZoom * distance / pinchStartDistance, (first.x + second.x) / 2, (first.y + second.y) / 2);
      }
    } else if (zoom > 1) {
      const pointer = activePointers.get(event.pointerId);
      if (pointer.type === "touch" || event.buttons === 1) {
        panX = dragStartPanX + event.clientX - dragStartX;
        panY = dragStartPanY + event.clientY - dragStartY;
        renderZoom();
      }
    }
  });

  const releasePointer = (event) => {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchStartDistance = 0;
  };
  lightboxStage.addEventListener("pointerup", releasePointer);
  lightboxStage.addEventListener("pointercancel", releasePointer);
  lightboxStage.addEventListener("lostpointercapture", releasePointer);

  lightbox.addEventListener("cancel", (event) => {
    event.preventDefault();
    lightbox.close();
  });

  lightbox.addEventListener("close", () => {
    const galleryToRestoreFocus = activeGallery;
    activeGallery = null;
    window.setTimeout(() => {
      galleryToRestoreFocus
        ?.querySelector(".gallery-slide:not([hidden]) [data-gallery-open]")
        ?.focus({ preventScroll: true });
    }, 0);
  });

  document.addEventListener("languageChanged", translateLightbox);
  translateLightbox();

  const initializedGalleries = new WeakSet();

  const initializeGallery = (gallery) => {
    if (initializedGalleries.has(gallery)) return;
    initializedGalleries.add(gallery);

    const slides = Array.from(gallery.querySelectorAll(".gallery-slide"));
    const count = gallery.querySelector("[data-gallery-count]");
    const dots = gallery.querySelector("[data-gallery-dots]");
    const previousButton = gallery.querySelector("[data-gallery-prev]");
    const nextButton = gallery.querySelector("[data-gallery-next]");

    if (slides.length === 0 || !count) {
      console.error("La galería de descargas necesita diapositivas y un contador.", gallery);
      return;
    }

    if (slides.length > 1 && dots) {
      slides.forEach((_, index) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "gallery-dot";
        dot.dataset.galleryTo = String(index);
        dots.append(dot);
      });
    }

    if (slides.length > 1) {
      if (previousButton) previousButton.hidden = false;
      if (nextButton) nextButton.hidden = false;
      if (dots) dots.hidden = false;
    } else if (dots) {
      dots.hidden = true;
    }

    const render = (index) => {
      const activeIndex = (index + slides.length) % slides.length;
      gallery.dataset.activeIndex = String(activeIndex);

      slides.forEach((slide, slideIndex) => {
        slide.hidden = slideIndex !== activeIndex;
      });

      count.textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;

      if (dots) {
        const labelTemplate = window.i18n
          ? window.i18n.t("gallery_show_image")
          : "Show image {index}";

        dots.querySelectorAll(".gallery-dot").forEach((dot, dotIndex) => {
          dot.setAttribute("aria-current", dotIndex === activeIndex ? "true" : "false");
          dot.setAttribute("aria-label", labelTemplate.replace("{index}", String(dotIndex + 1)));
        });
      }

      if (activeGallery === gallery && lightbox.open) renderLightbox();
    };

    gallery.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const openButton = target.closest("[data-gallery-open]");
      if (openButton && gallery.contains(openButton)) {
        activeGallery = gallery;
        renderLightbox();
        lightbox.showModal();
        lightbox.querySelector("[data-lightbox-close]").focus();
        return;
      }

      const previous = target.closest("[data-gallery-prev]");
      if (previous && gallery.contains(previous)) {
        render(Number(gallery.dataset.activeIndex || 0) - 1);
        return;
      }

      const next = target.closest("[data-gallery-next]");
      if (next && gallery.contains(next)) {
        render(Number(gallery.dataset.activeIndex || 0) + 1);
        return;
      }

      const dot = target.closest("[data-gallery-to]");
      if (dot && gallery.contains(dot)) {
        const requestedIndex = Number(dot.dataset.galleryTo);
        if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < slides.length) {
          render(requestedIndex);
        }
      }
    });

    render(0);
  };

  const initializeGalleries = (root) => {
    if (root instanceof Element && root.matches("[data-gallery]")) {
      initializeGallery(root);
    }
    root.querySelectorAll("[data-gallery]").forEach(initializeGallery);
  };

  initializeGalleries(main);

  const observer = new MutationObserver(() => initializeGalleries(main));
  observer.observe(main, { childList: true, subtree: true });

  document.addEventListener("languageChanged", () => {
    main.querySelectorAll("[data-gallery]").forEach((gallery) => {
      const activeIndex = Number(gallery.dataset.activeIndex || 0);
      const dots = gallery.querySelector("[data-gallery-dots]");
      if (!dots || !window.i18n) return;

      const labelTemplate = window.i18n.t("gallery_show_image");
      dots.querySelectorAll(".gallery-dot").forEach((dot, dotIndex) => {
        dot.setAttribute("aria-label", labelTemplate.replace("{index}", String(dotIndex + 1)));
        dot.setAttribute("aria-current", dotIndex === activeIndex ? "true" : "false");
      });
    });
  });
})();
