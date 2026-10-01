// js/theme.js

// 1. Sincroniza la posición del checkbox con el tema actual
function updateThemeUI(theme) {
  const themeToggleBtn = document.getElementById("theme-toggle");
  if (!themeToggleBtn) return;

  const checkbox = themeToggleBtn.querySelector("input[type='checkbox']");
  if (checkbox) {
    checkbox.checked = (theme === "dark");
  }
}

// 2. Alterna entre temas y guarda en localStorage
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  document.documentElement.setAttribute("data-theme", newTheme);
  updateThemeUI(newTheme);
  try {
    localStorage.setItem("user_theme", newTheme);
  } catch {}
}

// 3. Inyecta la estructura CORRECTA del switch si la página no la trae en su HTML
function ensureThemeButtonExists() {
  let themeToggleBtn = document.getElementById("theme-toggle");

  if (!themeToggleBtn) {
    themeToggleBtn = document.querySelector(".header-controls .switch");
    if (themeToggleBtn) {
      themeToggleBtn.id = "theme-toggle";
      return themeToggleBtn;
    }

    const langSelect = document.getElementById("langSelect");
    const headerControls = document.querySelector(".header-controls");

    if (headerControls) {
      themeToggleBtn = document.createElement("label");
      themeToggleBtn.id = "theme-toggle";
      themeToggleBtn.className = "switch";
      themeToggleBtn.title = "Cambiar tema";
      themeToggleBtn.innerHTML = `
            <input type="checkbox" aria-label="Cambiar tema">
            <span class="slider">
                <span class="circle">
                    <span class="shine shine-1"></span>
                    <span class="shine shine-2"></span>
                    <span class="shine shine-3"></span>
                    <span class="shine shine-4"></span>
                    <span class="shine shine-5"></span>
                    <span class="shine shine-6"></span>
                    <span class="shine shine-7"></span>
                    <span class="shine shine-8"></span>
                    <span class="moon"></span>
                </span>
            </span>
      `;

      if (langSelect) {
        headerControls.insertBefore(themeToggleBtn, langSelect.nextSibling);
      } else {
        headerControls.appendChild(themeToggleBtn);
      }
    }
  }
  return themeToggleBtn;
}

// 4. Inicialización global expuesta
window.initTheme = function() {
  ensureThemeButtonExists();
  const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
  updateThemeUI(currentTheme);
};

// 5. Delegación de eventos adaptada (escucha el evento 'change' del checkbox)
document.addEventListener("change", (e) => {
  if (e.target.matches("#theme-toggle input[type='checkbox']")) {
    toggleTheme();
  }
});

// Inicializar en la primera carga
document.addEventListener("DOMContentLoaded", () => {
  window.initTheme();
});