// Module loader for Minerado legacy app
// Provides dependency resolution and namespace exports
window.Mineradio = window.Mineradio || {};

const MODULE_REGISTRY = {};
const MODULE_LOADED = {};
const MODULE_QUEUE = [];

export function define(name, deps, factory) {
  MODULE_REGISTRY[name] = { deps, factory };
  if (MODULE_LOADED[name]) return;
  // Check if all deps already loaded
  const allLoaded = deps.every(d => MODULE_LOADED[d]);
  if (allLoaded) {
    loadModule(name);
  } else {
    MODULE_QUEUE.push(name);
  }
}

function loadModule(name) {
  const mod = MODULE_REGISTRY[name];
  if (!mod || MODULE_LOADED[name]) return;
  const deps = mod.deps.map(d => MODULE_LOADED[d] || {});
  const exports = {};
  mod.factory(window, exports, ...deps);
  MODULE_LOADED[name] = exports;
  // Check queue
  for (let i = MODULE_QUEUE.length - 1; i >= 0; i--) {
    const qName = MODULE_QUEUE[i];
    const qMod = MODULE_REGISTRY[qName];
    if (qMod && qMod.deps.every(d => MODULE_LOADED[d])) {
      MODULE_QUEUE.splice(i, 1);
      loadModule(qName);
    }
  }
}

export function init() {
  // Load all ready modules
  Object.keys(MODULE_REGISTRY).forEach(name => {
    if (!MODULE_LOADED[name]) loadModule(name);
  });
}

export function get(name) {
  return MODULE_LOADED[name] || null;
}
