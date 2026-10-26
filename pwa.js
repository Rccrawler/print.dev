// Inyección dinámica del Manifiesto (Método Tutorial InfinityFree)
const baseUrl = window.location.origin;
const pathArray = window.location.pathname.split('/');
pathArray.pop(); // Quitar index.php de la ruta
const basePath = pathArray.join('/');

const manifestData = {
    "name": "print.dev | Herramientas online para desarrolladores",
    "short_name": "print.dev",
    "description": "Herramientas online gratis para programadores: formateador JSON, Base64, intérprete de Java, intérprete de Phyton.",
    "start_url": baseUrl + basePath + "/index.html",
    "scope": baseUrl + basePath + "/",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#dfaf49",
    "orientation": "any",
    "icons": [
        {
            "src": baseUrl + basePath + "/img/favicon.svg",
            "sizes": "512x512",
            "type": "image/svg+xml",
            "purpose": "any maskable"
        }
    ]
};

const stringManifest = JSON.stringify(manifestData);
const blob = new Blob([stringManifest], { type: 'application/json' });
const manifestURL = URL.createObjectURL(blob);

const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = manifestURL;
document.head.appendChild(manifestLink);

if ("serviceWorker" in navigator) {
    console.log("Navegador admite Service worker.");
    if (navigator.serviceWorker.controller) {
        console.log("El service worker ya existe, no se necesita registralo de nuevo");
    } else {
        // Registra el service worker y lo deja ejecutandose en segundo plano (otro hilo)
        console.log("Registrar Service worker.");
        navigator.serviceWorker.register("pwa_sw.js", {
            scope: "./"
        }).then(function (reg) {
            console.log("Service worker ha sido registrado para: " + reg.scope);
        }).catch(function (err) {
            // registration failed :(
            console.log('NO se ha podido registrar el ServiceWorker: ', err);
        });
    }
}