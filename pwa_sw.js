/* CREAR UNA CACHE DE FUENTES Y FICHEROS */
const NOMBRE_CACHE = "cache_principal_v5";
var urls = ['img/favicon.svg',
	'offline.html'];

self.addEventListener("install", function (event) {  //evento que ejecuta al instalar
	event.waitUntil(  //espera a que se haya registrado el service worker, para cargar la cache
		caches.open(NOMBRE_CACHE).then(function (cache) {
			//console.log("Cache abierta");
			//return cache.add(elementoOffline); //solo una
			return cache.addAll(urls); //un array
		})
	);
});

//Intercepta las peticiones y si estan en la cache, devuelve las de la cache.
self.addEventListener("fetch", function (evento) {
	console.log('evento');
	console.log(evento);
	evento.respondWith(
		caches.match(evento.request).then(function (response) {
			if (response) {
				//console.log("Cargando desde la cache ");
				//console.log(response);
				return response;
			}
			return fetch(evento.request);
		}).catch(function (err) {
			if (evento.request.mode == "navigate") {
				return caches.match("./offline.html")
			}
		})
	);
});