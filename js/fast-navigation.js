document.addEventListener('DOMContentLoaded', () => {

  // Función mejorada para marcar la pestaña activa
  function updateActiveNavLink() {
    const currentPath = window.location.pathname;

    document.querySelectorAll('.nav-link').forEach(link => {
      const linkPath = new URL(link.href).pathname;

      // Compara rutas considerando también la raíz '/' como '/index.html'
      const isHomeMatch = (currentPath === '/' || currentPath.endsWith('/index.html')) && 
                          (linkPath === '/' || linkPath.endsWith('/index.html'));

      if (isHomeMatch || (currentPath === linkPath && currentPath !== '/')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Activar la pestaña al cargar la página por primera vez
  updateActiveNavLink();

  // Interceptar los clics en los enlaces
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('a');
    
    // Verificar si es un enlace interno válido
    if (!link || link.origin !== location.origin || link.hasAttribute('data-native')) return;

    e.preventDefault();
    const url = link.href;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Respuesta de red no OK');
      
      const htmlText = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // 1. Reemplazar el contenedor principal y el título de la página
      const newMain = doc.querySelector('main');
      if (newMain) {
        document.querySelector('main').innerHTML = newMain.innerHTML;
      }
      document.title = doc.title;

      // 2. Actualizar la barra de direcciones sin recargar
      history.pushState({}, '', url);

      // 3. Refrescar las clases del header
      updateActiveNavLink();

      // 4. Hacer scroll arriba al cambiar de página
      window.scrollTo(0, 0);

    } catch (error) {
      console.warn('Error en la carga asíncrona, navegando tradicionalmente:', error);
      window.location.href = url;
    }
  });

  // Permitir uso de los botones Atrás / Adelante del navegador
  window.addEventListener('popstate', async () => {
    try {
      const response = await fetch(location.href);
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      document.querySelector('main').innerHTML = doc.querySelector('main').innerHTML;
      document.title = doc.title;
      updateActiveNavLink();
    } catch (e) {
      window.location.reload();
    }
  });
});