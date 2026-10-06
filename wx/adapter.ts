/* eslint-disable @typescript-eslint/no-explicit-any */
declare const wx: any;
declare const GameGlobal: any;

type Listener = (event: any) => void;

function eventTarget<T extends object>(target: T, self: object = target): T & EventTargetLike {
  const listeners = new Map<string, Set<Listener>>();
  return Object.assign(target, {
    addEventListener(type: string, fn: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event: any) {
      for (const fn of [...(listeners.get(event.type) ?? [])]) fn.call(self, event);
      return true;
    },
  });
}

interface EventTargetLike {
  addEventListener(type: string, fn: Listener, options?: unknown): void;
  removeEventListener(type: string, fn: Listener, options?: unknown): void;
  dispatchEvent(event: any): boolean;
}

const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
const deviceInfo = wx.getDeviceInfo ? wx.getDeviceInfo() : info;
const width: number = info.windowWidth;
const height: number = info.windowHeight;
const ios = String(deviceInfo.platform ?? "").toLowerCase() === "ios";

const g = GameGlobal;
const doc: any = eventTarget({
  hidden: false,
  visibilityState: "visible",
  readyState: "complete",
  body: { appendChild() {}, removeChild() {}, style: {} },
  documentElement: { style: {} },
  createElement: (tag: string) => createElement(tag),
  createElementNS: (_ns: string, tag: string) => createElement(tag),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
});

function asElement<T extends object>(el: T, w: number, h: number): any {
  const e: any = eventTarget(el);
  e.style = e.style ?? {};
  e.clientWidth = w;
  e.clientHeight = h;
  e.ownerDocument = doc;
  e.getRootNode = () => doc;
  e.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: e.clientWidth, height: e.clientHeight, right: e.clientWidth, bottom: e.clientHeight });
  e.setPointerCapture = () => {};
  e.releasePointerCapture = () => {};
  e.focus = () => {};
  return e;
}

export const screenCanvas = asElement(wx.createCanvas(), width, height);

function createElement(tag: string): any {
  if (tag === "canvas") return asElement(wx.createCanvas(), 300, 150);
  if (tag === "img") {
    const img: any = wx.createImage();
    const ev = eventTarget({} as object, img) as EventTargetLike;
    img.addEventListener = (type: string, fn: Listener) => {
      ev.addEventListener(type, fn);
      if (type === "load") img.onload = () => ev.dispatchEvent({ type: "load", target: img });
      if (type === "error") img.onerror = (e: unknown) => ev.dispatchEvent({ type: "error", target: img, error: e });
    };
    img.removeEventListener = (type: string, fn: Listener) => ev.removeEventListener(type, fn);
    return img;
  }
  return asElement({}, 0, 0);
}

function localPath(url: string): string {
  return url.replace(/^\.\//, "").replace(/^\//, "");
}

class Headers {
  private readonly map = new Map<string, string>();
  constructor(init?: Record<string, string>) {
    for (const [k, v] of Object.entries(init ?? {})) this.map.set(k.toLowerCase(), v);
  }
  get(key: string) {
    return this.map.get(key.toLowerCase()) ?? null;
  }
  set(key: string, value: string) {
    this.map.set(key.toLowerCase(), value);
  }
}

class Request {
  constructor(readonly url: string, readonly init: Record<string, unknown> = {}) {}
}

function utf8(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    let cp = b;
    if (b >= 0xf0) cp = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else if (b >= 0xe0) cp = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else if (b >= 0xc0) cp = ((b & 31) << 6) | (bytes[i++] & 63);
    out += String.fromCodePoint(cp);
  }
  return out;
}

class TextDecoder {
  decode(input?: ArrayBuffer | ArrayBufferView): string {
    if (!input) return "";
    if (input instanceof ArrayBuffer) return utf8(input);
    return utf8(input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer);
  }
}

const fs = wx.getFileSystemManager();

function fetchLocal(input: string | Request): Promise<any> {
  const url = typeof input === "string" ? input : input.url;
  return new Promise((resolve, reject) => {
    fs.readFile({
      filePath: localPath(url),
      success: ({ data }: { data: ArrayBuffer }) =>
        resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          url,
          headers: new Headers(),
          arrayBuffer: () => Promise.resolve(data),
          text: () => Promise.resolve(utf8(data)),
          json: () => Promise.resolve(JSON.parse(utf8(data))),
        }),
      fail: (err: unknown) => reject(new Error(`readFile ${url}: ${JSON.stringify(err)}`)),
    });
  });
}

const storage = {
  getItem: (key: string) => {
    const v = wx.getStorageSync(key);
    return v === "" ? null : String(v);
  },
  setItem: (key: string, value: string) => wx.setStorageSync(key, String(value)),
  removeItem: (key: string) => wx.removeStorageSync(key),
};

const win = eventTarget(g);
Object.assign(win, {
  window: g,
  self: g,
  document: doc,
  innerWidth: width,
  innerHeight: height,
  devicePixelRatio: info.pixelRatio,
  navigator: { userAgent: ios ? "iPhone wechatgame" : "Android wechatgame", language: "zh-CN", languages: ["zh-CN"], maxTouchPoints: 5, platform: deviceInfo.platform },
  location: { href: "", search: "", hash: "", pathname: "/", origin: "", reload() {} },
  history: { replaceState() {}, pushState() {} },
  localStorage: storage,
  Headers,
  Request,
  TextDecoder,
  fetch: fetchLocal,
  matchMedia: (q: string) => ({ matches: q.includes("coarse"), addEventListener() {}, removeEventListener() {} }),
  AudioContext: function AudioContext() {
    return wx.createWebAudioContext();
  },
  HTMLCanvasElement: function HTMLCanvasElement() {},
  HTMLImageElement: function HTMLImageElement() {},
  HTMLVideoElement: function HTMLVideoElement() {},
  ImageBitmap: function ImageBitmap() {},
  VideoFrame: function VideoFrame() {},
  OffscreenCanvas: function OffscreenCanvas() {},
});
g.createImageBitmap = undefined;
if (typeof g.performance === "undefined") g.performance = wx.getPerformance ? wx.getPerformance() : { now: () => Date.now() };
if (typeof g.AbortController === "undefined") {
  g.AbortSignal = class AbortSignal {
    aborted = false;
    addEventListener() {}
    removeEventListener() {}
  };
  g.AbortController = class AbortController {
    signal = new g.AbortSignal();
    abort() {
      this.signal.aborted = true;
    }
  };
}

function pointer(type: string, touch: any, source: any): any {
  return {
    type,
    pointerId: touch.identifier,
    pointerType: "touch",
    isPrimary: true,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: touch.clientX,
    clientY: touch.clientY,
    pageX: touch.pageX ?? touch.clientX,
    pageY: touch.pageY ?? touch.clientY,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: screenCanvas,
    timeStamp: source.timeStamp,
    preventDefault() {},
    stopPropagation() {},
  };
}

wx.onTouchStart((e: any) => {
  for (const t of e.changedTouches) {
    const ev = pointer("pointerdown", t, e);
    screenCanvas.dispatchEvent(ev);
    win.dispatchEvent(ev);
  }
});
wx.onTouchMove((e: any) => {
  for (const t of e.changedTouches) doc.dispatchEvent(pointer("pointermove", t, e));
});
const end = (type: string) => (e: any) => {
  for (const t of e.changedTouches) {
    doc.dispatchEvent(pointer(type, t, e));
    screenCanvas.dispatchEvent(pointer(type, t, e));
  }
};
wx.onTouchEnd(end("pointerup"));
wx.onTouchCancel(end("pointercancel"));

wx.onHide(() => {
  doc.hidden = true;
  doc.visibilityState = "hidden";
  doc.dispatchEvent({ type: "visibilitychange" });
});
wx.onShow(() => {
  doc.hidden = false;
  doc.visibilityState = "visible";
  doc.dispatchEvent({ type: "visibilitychange" });
});
