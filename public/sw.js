// Service worker do app da Cliva.
// De propósito NÃO guarda páginas nem respostas de API: o painel tem dados de
// pacientes e de saúde, que não podem ficar no aparelho. Só a tela "sem
// conexão" e o ícone ficam em cache. Trocar a versão ao alterar estes arquivos.
const CACHE = "cliva-shell-v1";
const SHELL = ["/offline.html", "/pwa/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  // Página: sempre da rede; sem internet, mostra o aviso.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  // Ícone da tela de aviso. O resto segue direto para a rede.
  if (new URL(request.url).pathname === "/pwa/icon-192.png") {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
  }
});
