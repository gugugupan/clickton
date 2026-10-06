// Runs minigame/game.js in a DOM-less worker with a fake `wx`, so adapter gaps surface without WeChat DevTools.
const BASE = "../../minigame/";
const NativeOffscreenCanvas = OffscreenCanvas;
const nativeFetch = fetch.bind(self);
const nativeCreateImageBitmap = createImageBitmap.bind(self);
const touch = { start: [], move: [], end: [], cancel: [] };
const store = new Map();
let screen = null;
let size = null;

const log = (level) => (...args) => postMessage({ type: "log", level, text: args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === "string" ? a : JSON.stringify(a))).join(" ") });
console.log = log("log");
console.warn = log("warn");
console.error = log("error");
self.addEventListener("error", (e) => console.error("uncaught", e.message, `${e.filename}:${e.lineno}`));
self.addEventListener("unhandledrejection", (e) => console.error("unhandled rejection", e.reason));

function stub() {
  const fn = () => proxy;
  const proxy = new Proxy(fn, {
    get: (_t, key) => (key === "then" ? undefined : key === Symbol.toPrimitive ? () => 0 : key === "currentTime" ? performance.now() / 1000 : key === "sampleRate" ? 44100 : proxy),
    set: () => true,
    apply: () => proxy,
  });
  return proxy;
}

function image() {
  const img = new NativeOffscreenCanvas(1, 1);
  let src = "";
  Object.defineProperty(img, "src", {
    get: () => src,
    set(value) {
      src = value;
      nativeFetch(BASE + value.replace(/^\.\//, ""))
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${r.status} ${value}`))))
        .then((b) => nativeCreateImageBitmap(b))
        .then((bmp) => {
          img.width = bmp.width;
          img.height = bmp.height;
          img.getContext("2d").drawImage(bmp, 0, 0);
          img.onload?.();
        })
        .catch((e) => img.onerror?.(e));
    },
  });
  return img;
}

self.wx = {
  getWindowInfo: () => ({ windowWidth: size.width, windowHeight: size.height, pixelRatio: size.dpr }),
  getDeviceInfo: () => ({ platform: "ios" }),
  createCanvas: () => {
    if (screen) {
      const c = screen;
      screen = null;
      return c;
    }
    return new NativeOffscreenCanvas(300, 150);
  },
  createImage: image,
  getFileSystemManager: () => ({
    readFile({ filePath, success, fail }) {
      nativeFetch(BASE + filePath)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${filePath}`))))
        .then((data) => success({ data }), (e) => fail({ errMsg: String(e) }));
    },
  }),
  loadSubpackage: ({ name, success }) => setTimeout(() => success({ name }), 5),
  onTouchStart: (fn) => touch.start.push(fn),
  onTouchMove: (fn) => touch.move.push(fn),
  onTouchEnd: (fn) => touch.end.push(fn),
  onTouchCancel: (fn) => touch.cancel.push(fn),
  onShow: () => {},
  onHide: () => {},
  getStorageSync: (k) => (store.has(k) ? store.get(k) : ""),
  setStorageSync: (k, v) => store.set(k, v),
  removeStorageSync: (k) => store.delete(k),
  createWebAudioContext: stub,
  getPerformance: () => performance,
};

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === "init") {
    screen = m.canvas;
    size = m.size;
    for (const key of ["self", "navigator", "location", "performance", "window", "document"]) {
      const value = key === "performance" ? performance : undefined;
      Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    }
    globalThis.GameGlobal = globalThis;
    importScripts(BASE + "game.js");
    return;
  }
  for (const fn of touch[m.type]) fn(m.event);
};
