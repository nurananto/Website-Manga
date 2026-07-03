// Recovery shim for a previously deployed stale entry bundle.
// Some browsers can keep an old index.html that still points here after deploy.
(function () {
  var now = Date.now();
  var reload = function () {
    var next = new URL(window.location.href);
    next.searchParams.set('r', String(Date.now()));
    window.location.replace(next.toString());
  };
  try {
    var key = 'mf-stale-entry-reload-at';
    var last = Number(sessionStorage.getItem(key) || '0');
    if (now - last < 10000) return;
    sessionStorage.setItem(key, String(now));
  } catch (e) {}
  var jobs = [];
  try {
    if ('caches' in window) {
      jobs.push(caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (key) { return caches.delete(key); }));
      }));
    }
  } catch (e) {}
  try {
    if ('serviceWorker' in navigator) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (reg) { return reg.unregister(); }));
      }));
    }
  } catch (e) {}
  Promise.all(jobs).then(reload).catch(reload);
})();

export {};
