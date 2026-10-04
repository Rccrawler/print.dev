/**
 * Módulo de Internacionalización (i18n) para print.dev
 * Soporta persistencia en localStorage, detección automática del navegador,
 * actualización de atributos HTML lang, placeholders, títulos y compatibilidad con SPA / navegación rápida.
 */

(function () {
  const SUPPORTED_LANGS = ["es", "en"];
  const DEFAULT_FALLBACK_LANG = "es";

  function getInitialLanguage() {
    const savedLang = localStorage.getItem("user_lang");
    if (savedLang && SUPPORTED_LANGS.includes(savedLang)) {
      return savedLang;
    }

    const browserLang = (navigator.language || navigator.userLanguage || "").toLowerCase();
    if (browserLang.startsWith("en")) {
      return "en";
    }

    return DEFAULT_FALLBACK_LANG;
  }

  let currentLang = getInitialLanguage();

  function t(key, lang = currentLang) {
    const dict = window.translations || (typeof translations !== "undefined" ? translations : null);
    if (!dict) return key;
    return dict[lang]?.[key] ?? dict[DEFAULT_FALLBACK_LANG]?.[key] ?? key;
  }

  function applyTranslations() {
    const dict = window.translations || (typeof translations !== "undefined" ? translations : null);
    if (!dict || !dict[currentLang]) return;

    const langData = dict[currentLang];

    // 1. Atributo lang en la etiqueta raíz <html> (SEO y accesibilidad)
    document.documentElement.lang = currentLang;

    // 2. Elementos con texto traducible (data-i18n)
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (langData[key] !== undefined) {
        el.textContent = langData[key];
      }
    });

    // 3. Inputs y textareas con placeholders traducibles (data-i18n-placeholder)
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (langData[key] !== undefined) {
        el.placeholder = langData[key];
      }
    });

    // 4. Elementos con atributo title traducible (data-i18n-title)
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (langData[key] !== undefined) {
        el.title = langData[key];
      }
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (langData[key] !== undefined) {
        el.setAttribute("aria-label", langData[key]);
      }
    });

    document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      const key = el.getAttribute("data-i18n-alt");
      if (langData[key] !== undefined) {
        el.setAttribute("alt", langData[key]);
      }
    });

    // 5. Traducir el título de la página (<title data-i18n="...">)
    const titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) {
      const key = titleEl.getAttribute("data-i18n");
      if (langData[key]) {
        document.title = langData[key];
      }
    }

    // 7. Actualizar la etiqueta del botón del dropdown de idioma (ES / EN)
    const langLabel = document.querySelector("#langBtn .mono");
    if (langLabel) {
      langLabel.textContent = currentLang.toUpperCase();
    }

    // 8. Actualizar estado activo en los botones de opciones del menú
    document.querySelectorAll(".lang-opt").forEach((btn) => {
      const isActive = btn.getAttribute("data-lang") === currentLang;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // 9. Quitar la clase anti-FOUC para revelar el contenido ya traducido
    document.documentElement.classList.remove("i18n-loading");
  }

  function setLanguage(lang) {
    if (!SUPPORTED_LANGS.includes(lang)) return;

    currentLang = lang;
    try {
      localStorage.setItem("user_lang", lang);
    } catch (e) {
      console.warn("No se pudo guardar la preferencia en localStorage:", e);
    }

    applyTranslations();

    // Notificar a otros scripts (ej. typewriter)
    document.dispatchEvent(new CustomEvent("languageChanged", {
      detail: { lang: currentLang }
    }));
  }

  function getLanguage() {
    return currentLang;
  }

  // Delegación de eventos para la selección de idioma en el dropdown
  // NOTA: el handler principal de activación está en index.js que llama a setLanguage().
  // Este listener actúa como fallback por si acaso.
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".lang-opt");
    if (!button) return;

    const targetLang = button.getAttribute("data-lang");
    if (targetLang && targetLang !== currentLang) {
      setLanguage(targetLang);
    }
  });

  // Inicialización al cargar el DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      applyTranslations();
      setupMainObserver();
    });
  } else {
    applyTranslations();
    setupMainObserver();
  }

  /**
   * MutationObserver sobre <main>: re-aplica traducciones automáticamente
   * cada vez que fast-navigation swapea el contenido, sin depender de llamadas externas.
   * Es la red de seguridad que garantiza que el idioma siempre se aplica tras la navegación SPA.
   */
  function setupMainObserver() {
    const mainEl = document.querySelector("main");
    if (!mainEl) return;

    let applying = false; // evita bucle infinito si applyTranslations() mutara el DOM
    const observer = new MutationObserver(() => {
      if (applying) return;
      applying = true;
      applyTranslations();
      applying = false;
    });

    // childList: true detecta cuando fast-navigation reemplaza los hijos de <main>
    observer.observe(mainEl, { childList: true });
  }

  window.i18n = {
    setLanguage,
    getLanguage,
    applyTranslations,
    t
  };
  window.setLanguage = setLanguage;
})();
