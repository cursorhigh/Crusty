(function () {
  var base = window.CRUSTY_EXT_BASE || ".";
  var scripts = window.CRUSTY_SCRIPTS || ["content_script.js", "spot.js"];
  var state = { started: false, loaded: [] };

  function buildUrl(path) {
    if (/^(https?:|file:|data:|blob:)/.test(path)) return path;
    var trimmed = path.charAt(0) === "/" ? path.slice(1) : path;
    return base.replace(/\/$/, "") + "/" + trimmed;
  }

  function loadScript(path) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = buildUrl(path);
      script.async = false;
      script.onload = function () { resolve(path); };
      script.onerror = function () { reject(new Error("Failed to load " + path)); };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  function start() {
    if (state.started) return Promise.resolve(state.loaded.slice());
    state.started = true;

    return scripts.reduce(function (chain, path) {
      return chain.then(function () {
        return loadScript(path).then(function () {
          state.loaded.push(path);
        });
      });
    }, Promise.resolve()).then(function () {
      console.log("[CrustyLoader] loaded", state.loaded);
      return state.loaded.slice();
    });
  }

  window.CrustyLoader = {
    start: start,
    state: state,
    scripts: scripts,
    base: base
  };

  if (window.CRUSTY_AUTO_START !== false) {
    start();
  }
})();
