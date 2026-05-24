(function () {
  var base = window.CRUSTY_EXT_BASE || ".";
  var runtimeId = window.CRUSTY_RUNTIME_ID || "crusty-runtime";
  var verbose = !!window.CRUSTY_COMPAT_VERBOSE;

  var memoryStore = { local: {}, sync: {} };

  function log() {
    if (!verbose) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift("[CrustyCompat]");
    console.log.apply(console, args);
  }

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function readStore(area) {
    var key = "crusty_storage_" + area;
    try {
      var raw = localStorage.getItem(key);
      var parsed = safeParse(raw);
      if (parsed) return parsed;
    } catch (err) {
      log("storage read failed", err);
    }
    return memoryStore[area] || {};
  }

  function writeStore(area, data) {
    var key = "crusty_storage_" + area;
    memoryStore[area] = data;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (err) {
      log("storage write failed", err);
    }
  }

  function normalizeUrl(path) {
    if (!path) return base;
    if (/^(https?:|file:|data:|blob:)/.test(path)) return path;
    var trimmed = path.charAt(0) === "/" ? path.slice(1) : path;
    return base.replace(/\/$/, "") + "/" + trimmed;
  }

  function rewriteChromeExtensionUrl(url) {
    if (!url || typeof url !== "string") return url;
    var prefix = "chrome-extension://" + runtimeId + "/";
    if (url.indexOf(prefix) === 0) {
      return normalizeUrl(url.slice(prefix.length));
    }
    return url;
  }

  function pickKeys(data, keys) {
    var result = {};
    if (keys == null) return Object.assign({}, data);
    if (Array.isArray(keys)) {
      keys.forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = data[key];
        }
      });
      return result;
    }
    if (typeof keys === "string") {
      result[keys] = data[keys];
      return result;
    }
    if (typeof keys === "object") {
      Object.keys(keys).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          result[key] = data[key];
        } else {
          result[key] = keys[key];
        }
      });
      return result;
    }
    return result;
  }

  function storageGet(area, keys, callback) {
    var data = readStore(area);
    var result = pickKeys(data, keys);
    if (typeof callback === "function") {
      callback(result);
      return;
    }
    return Promise.resolve(result);
  }

  function storageSet(area, items, callback) {
    var data = readStore(area);
    var next = Object.assign({}, data, items || {});
    writeStore(area, next);
    if (typeof callback === "function") {
      callback();
      return;
    }
    return Promise.resolve();
  }

  function rewriteAttr(el, attr) {
    var value = el.getAttribute(attr);
    var next = rewriteChromeExtensionUrl(value);
    if (next && next !== value) {
      el.setAttribute(attr, next);
    }
  }

  function scanAndRewrite(root) {
    if (!root.querySelectorAll) return;
    var nodes = root.querySelectorAll("[src],[href]");
    nodes.forEach(function (el) {
      if (el.hasAttribute("src")) rewriteAttr(el, "src");
      if (el.hasAttribute("href")) rewriteAttr(el, "href");
    });
  }

  function observeChromeExtensionUrls() {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === "attributes") {
          rewriteAttr(mutation.target, mutation.attributeName);
          return;
        }
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) {
            scanAndRewrite(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href"]
    });

    scanAndRewrite(document);
  }

  function ensureCrypto() {
    if (!window.crypto) window.crypto = {};
    if (!crypto.randomUUID) {
      crypto.randomUUID = function () {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          var v = c === "x" ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    }
  }

  function boot() {
    ensureCrypto();

    window.chrome = window.chrome || {};
    chrome.runtime = chrome.runtime || {};
    chrome.runtime.id = chrome.runtime.id || runtimeId;
    chrome.runtime.getURL = chrome.runtime.getURL || normalizeUrl;
    chrome.runtime.sendMessage = chrome.runtime.sendMessage || function (message, callback) {
      log("runtime.sendMessage", message);
      if (typeof callback === "function") callback();
      window.dispatchEvent(new CustomEvent("crusty:message", { detail: message }));
    };

    chrome.extension = chrome.extension || {};
    chrome.extension.getURL = chrome.extension.getURL || normalizeUrl;

    chrome.storage = chrome.storage || {};
    chrome.storage.local = chrome.storage.local || {};
    chrome.storage.sync = chrome.storage.sync || {};
    chrome.storage.local.get = storageGet.bind(null, "local");
    chrome.storage.local.set = storageSet.bind(null, "local");
    chrome.storage.sync.get = storageGet.bind(null, "sync");
    chrome.storage.sync.set = storageSet.bind(null, "sync");

    observeChromeExtensionUrls();
    log("compat ready", { base: base, runtimeId: runtimeId });
  }

  boot();

  window.CrustyCompat = {
    base: base,
    runtimeId: runtimeId,
    normalizeUrl: normalizeUrl,
    rewriteChromeExtensionUrl: rewriteChromeExtensionUrl
  };
})();
