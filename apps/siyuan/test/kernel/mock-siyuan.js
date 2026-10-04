// Minimal stand-in for SiYuan's `globalThis.siyuan` kernel API (see
// siyuan/kernel/plugin/*.go), enough to drive kernel.js under goja-runner.
var __mock = { storage: new Map(), rpc: new Map(), broadcasts: [], logs: [] };

(function () {
  function log(level) {
    return async function () {
      __mock.logs.push([level].concat(Array.prototype.slice.call(arguments)));
    };
  }
  function children(dir) {
    var prefix = dir.replace(/\/$/, "") + "/";
    var names = new Map();
    __mock.storage.forEach(function (_, key) {
      if (key.indexOf(prefix) !== 0) return;
      var rest = key.slice(prefix.length);
      var slash = rest.indexOf("/");
      names.set(slash < 0 ? rest : rest.slice(0, slash), slash >= 0);
    });
    return names;
  }

  globalThis.siyuan = {
    plugin: {
      name: "still",
      version: "0.1.0",
      displayName: "Still",
      platform: "darwin",
      i18n: {},
      lifecycle: { onload: null, onrunning: null, onunload: null },
    },
    logger: { trace: log("trace"), debug: log("debug"), info: log("info"), warn: log("warn"), error: log("error") },
    event: { handler: null, emit: async function () {} },
    storage: {
      get: async function (path) {
        if (!__mock.storage.has(path)) throw new Error("file does not exist: " + path);
        var text = __mock.storage.get(path);
        return { text: async () => text, json: async () => JSON.parse(text) };
      },
      put: async function (path, content) {
        if (typeof content !== "string") throw new TypeError("storage.put content must be a string");
        __mock.storage.set(path, content);
      },
      remove: async function (path) {
        __mock.storage.delete(path);
      },
      list: async function (dir) {
        var names = children(dir);
        if (names.size === 0) throw new Error("directory does not exist: " + dir);
        var out = [];
        names.forEach(function (isDir, name) {
          out.push({ name: name, isDir: isDir, isSymlink: false, updated: 0 });
        });
        return out;
      },
      watcher: { add: async function () {}, remove: async function () {} },
    },
    rpc: {
      bind: async function (name, handler) {
        __mock.rpc.set(name, handler);
      },
      unbind: async function (name) {
        __mock.rpc.delete(name);
      },
      broadcast: async function (method, params) {
        __mock.broadcasts.push({ method: method, params: params });
      },
    },
    client: {
      fetch: async function (path) {
        if (path === "/api/system/getConf") {
          var body = { code: 0, msg: "", data: { conf: { system: { id: "8d2f-ABC_123-device-xyz" } } } };
          return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
        }
        throw new Error("unexpected fetch: " + path);
      },
    },
  };
})();
