# print-portfolio

## Añadir imágenes a las descargas

Las tarjetas de `descargas.html` usan galerías sencillas que admiten capturas, imágenes y GIF animados. Al pulsar una captura se abre el visor ampliado; se puede cambiar de imagen con los controles o con las flechas del teclado y cerrar con Escape:

1. Guarda el archivo en `img/downloads/`.
2. Dentro de la galería del proyecto, añade un `<figure class="gallery-slide" hidden>` con un botón `.gallery-open` que contenga el `<img>`, y un `<figcaption>`. En la primera diapositiva, omite `hidden`.
3. Para traducir el texto, añade claves `data-i18n` para el pie y `data-i18n-alt` para el texto alternativo en `js/locales.js`.

`js/downloads.js` crea los controles y puntos de navegación automáticamente cuando una galería contiene más de una diapositiva. Para un GIF, usa `.gif` en el `src` de la imagen.