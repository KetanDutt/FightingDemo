/**
 * Headless browser environment for the smoke test.
 *
 * There is no real browser in CI, so this boots the game inside jsdom with a
 * canvas implementation provided by `@napi-rs/canvas`, and serves the
 * `public/` folder from disk for image / JSON requests. Phaser itself never
 * knows the difference.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, '..', '..');
const publicRoot = path.join(projectRoot, 'public');

/**
 * Creates the DOM globals Phaser expects.
 * @returns {Promise<{dom: JSDOM, cleanup: () => void, errors: string[]}>}
 */
export async function createHeadlessEnvironment() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="game"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });

  const { window } = dom;
  const errors = [];

  // --- canvas -------------------------------------------------------------
  /** Lazily creates (and resizes) the @napi-rs/canvas backing a jsdom canvas. */
  const ensureNapiCanvas = (element) => {
    const width = Math.max(1, element.width || 300);
    const height = Math.max(1, element.height || 150);
    if (!element.__napiCanvas) {
      element.__napiCanvas = createCanvas(width, height);
      const napiContext = element.__napiCanvas.getContext('2d');
      const originalDrawImage = napiContext.drawImage.bind(napiContext);
      // Unwrap synthetic <img> / <canvas> elements before drawing.
      napiContext.drawImage = (source, ...rest) => originalDrawImage(unwrapSource(source), ...rest);
    } else if (element.__napiCanvas.width !== width || element.__napiCanvas.height !== height) {
      element.__napiCanvas.width = width;
      element.__napiCanvas.height = height;
    }
    return element.__napiCanvas;
  };

  const unwrapSource = (source) => {
    if (source && source.__napiImage) return source.__napiImage;
    if (source && source.__napiCanvas) return source.__napiCanvas;
    if (source && typeof source.getContext === 'function') return ensureNapiCanvas(source);
    return source;
  };

  window.HTMLCanvasElement.prototype.getContext = function getContext(type) {
    if (type !== '2d') return null;
    return ensureNapiCanvas(this).getContext('2d');
  };

  window.HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
    return 'data:image/png;base64,';
  };

  // Phaser gates renderers on these feature detections, and jsdom has no
  // canvas implementation of its own — we provide the @napi-rs/canvas ones.
  window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
  window.ImageData = function ImageData() {};
  window.OffscreenCanvas = undefined;
  window.WebGLRenderingContext = undefined;

  // --- blobs (Phaser loads images as blobs and turns them into object URLs) ---
  const blobRegistry = new Map();
  let blobCounter = 0;
  window.URL.createObjectURL = (blob) => {
    const url = `blob:http://localhost/${(blobCounter += 1)}`;
    blobRegistry.set(url, blob);
    return url;
  };
  window.URL.revokeObjectURL = (url) => blobRegistry.delete(url);

  // --- images -------------------------------------------------------------
  class HeadlessImage {
    constructor() {
      this.width = 1;
      this.height = 1;
      this.complete = false;
      this.__napiImage = null;
      this.onload = null;
      this.onerror = null;
      this._src = '';
    }

    get src() {
      return this._src;
    }

    set src(value) {
      this._src = value;
      Promise.resolve(resolveImageSource(value, blobRegistry))
        .then(loadImage)
        .then((image) => {
          this.__napiImage = image;
          this.width = image.width;
          this.height = image.height;
          this.complete = true;
          this.naturalWidth = image.width;
          this.naturalHeight = image.height;
          window.setTimeout(() => this.onload?.({ target: this }), 0);
        })
        .catch((error) => {
          this.complete = true;
          errors.push(`image failed: ${value} (${error.message})`);
          window.setTimeout(() => this.onerror?.(error), 0);
        });
    }

    addEventListener(type, handler) {
      if (type === 'load') this.onload = handler;
      if (type === 'error') this.onerror = handler;
    }

    removeEventListener() {}
  }
  window.Image = HeadlessImage;

  // --- xhr (json / text atlas files) --------------------------------------
  class HeadlessXHR {
    constructor() {
      this.readyState = 0;
      this.status = 0;
      this.responseText = '';
      this.response = null;
      this.responseType = '';
      this.timeout = 0;
      this.onload = null;
      this.onerror = null;
      this.onreadystatechange = null;
      this.onprogress = null;
      this.ontimeout = null;
      this._headers = {};
    }

    open(method, url) {
      this._method = method;
      this._url = url;
    }

    setRequestHeader(key, value) {
      this._headers[key] = value;
    }

    addEventListener(type, handler) {
      this[`on${type}`] = handler;
    }

    removeEventListener() {}

    send() {
      const file = resolvePublicPath(this._url);
      window.setTimeout(() => {
        try {
          if (this.responseType === 'blob') {
            const buffer = fs.readFileSync(file);
            this.response = new window.Blob([buffer], { type: 'image/png' });
            this.responseText = '';
          } else {
            this.responseText = fs.readFileSync(file, 'utf8');
            this.response = this.responseText;
          }
          this.status = 200;
          this.readyState = 4;
          this.onreadystatechange?.();
          this.onload?.({ target: this });
        } catch (error) {
          this.status = 404;
          this.readyState = 4;
          errors.push(`xhr failed: ${this._url} (${error.message})`);
          this.onerror?.(error);
        }
      }, 0);
    }
  }
  window.XMLHttpRequest = HeadlessXHR;

  // --- misc shims ---------------------------------------------------------
  if (!window.performance) window.performance = { now: () => Date.now() };
  window.focus = () => {};
  window.AudioContext = undefined; // force the audio manager into "unavailable"
  window.webkitAudioContext = undefined;
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
  window.HTMLMediaElement.prototype.pause = () => {};

  // --- globals ------------------------------------------------------------
  const original = {};
  const globals = [
    'window',
    'document',
    'navigator',
    'location',
    'Image',
    'XMLHttpRequest',
    'HTMLCanvasElement',
    'HTMLImageElement',
    'HTMLVideoElement',
    'HTMLDivElement',
    'Element',
    'Event',
    'CustomEvent',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    // Note: `performance` is deliberately NOT overridden — jsdom's
    // implementation delegates to the global one and would recurse forever.
    'localStorage',
    'sessionStorage',
    'URL',
    'Blob',
    'FileReader',
    'getComputedStyle',
    'DOMParser',
    'MutationObserver',
    // Extras Phaser's scale / input managers expect
    'screen',
    'devicePixelRatio',
    'matchMedia',
    'ResizeObserver',
    'Node',
    'HTMLElement',
    'HTMLDocument',
    'DocumentFragment',
    'TouchEvent',
    'PointerEvent',
    'KeyboardEvent',
    'MouseEvent',
    'WheelEvent',
    'FocusEvent',
    'UIEvent',
    'Screen',
    'MediaQueryList',
  ];
  globals.forEach((key) => {
    original[key] = globalThis[key];
    const value = key === 'window' ? window : window[key];
    if (value !== undefined) {
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
  });

  globalThis.self = window;

  const cleanup = () => {
    globals.forEach((key) => {
      if (original[key] === undefined) delete globalThis[key];
      else
        Object.defineProperty(globalThis, key, {
          value: original[key],
          configurable: true,
          writable: true,
        });
    });
    delete globalThis.self;
    window.close();
  };

  return { dom, window, cleanup, errors };
}

async function resolveImageSource(url, blobRegistry) {
  if (String(url).startsWith('data:')) {
    return Buffer.from(String(url).split(',')[1] ?? '', 'base64');
  }
  if (String(url).startsWith('blob:')) {
    const blob = blobRegistry.get(url);
    if (!blob) throw new Error(`unknown blob url ${url}`);
    return Buffer.from(await blob.arrayBuffer());
  }
  return resolvePublicPath(url);
}

function resolvePublicPath(url) {
  const clean = String(url)
    .split('?')[0]
    .replace(/^\.?\//, '');
  return path.join(publicRoot, clean);
}

/** Small promise helper used by the tests. */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits until `predicate()` is truthy or the timeout elapses. */
export async function waitFor(
  predicate,
  { timeout = 15000, interval = 60, label = 'condition' } = {},
) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return true;
    await wait(interval);
  }
  throw new Error(`Timed out waiting for ${label} after ${timeout}ms`);
}

export { pathToFileURL };
