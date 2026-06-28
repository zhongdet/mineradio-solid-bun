// ============================================================
// Mineradio Legacy Modules — Entry Point
// ============================================================
// This file replaces the monolithic app.js with modular code.
// Each module exports to window.Mineradio and sets up global
// functions for backward compatibility with onclick handlers.

(function(){
  const R = window.Mineradio = window.Mineradio || {};
  R.modules = {};
  R.ready = false;
  const readyCallbacks = [];

  R.onReady = function(fn) {
    if (R.ready) fn();
    else readyCallbacks.push(fn);
  };

  R._markReady = function() {
    R.ready = true;
    readyCallbacks.forEach(fn => fn());
    readyCallbacks.length = 0;
  };

  // ---- Module registration ----
  R.define = function(name, deps, initFn) {
    R.modules[name] = { deps, initFn, loaded: false, exports: {} };
  };

  R._loadModule = function(name) {
    const mod = R.modules[name];
    if (!mod || mod.loaded) return;
    // Check deps
    for (const dep of mod.deps) {
      if (!R.modules[dep] || !R.modules[dep].loaded) return; // dep not ready
    }
    mod.initFn(window, mod.exports);
    mod.loaded = true;
  };

  R._initAll = function() {
    // Topological sort by dependency
    let loaded = true;
    while (loaded) {
      loaded = false;
      for (const name of Object.keys(R.modules)) {
        const mod = R.modules[name];
        if (mod.loaded) continue;
        const depsReady = mod.deps.every(d => {
          const depMod = R.modules[d];
          return depMod && depMod.loaded;
        });
        if (depsReady) {
          mod.initFn(window, mod.exports);
          mod.loaded = true;
          loaded = true;
        }
      }
    }
    R._markReady();
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(R._initAll, 0);
  } else {
    document.addEventListener('DOMContentLoaded', R._initAll);
  }
})();
