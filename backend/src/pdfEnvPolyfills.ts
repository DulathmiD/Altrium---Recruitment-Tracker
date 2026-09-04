// pdf-parse (via pdfjs-dist's legacy Node build) unconditionally calls
// `new DOMMatrix()` at module-import time as part of an attempted canvas
// polyfill. It tries to load the optional native binding `@napi-rs/canvas`
// first; when that binding isn't available for the current platform/Node
// version (observed on Windows + Node 24 -- the prebuilt binary doesn't load
// there), the fallback path never defines these globals, and the app crashes
// on startup with "ReferenceError: DOMMatrix is not defined" -- before a
// single request is ever handled.
//
// We only ever call getText() for CV parsing, never any canvas-based
// rendering (getImage()/getScreenshot()), so these globals never need real
// behavior -- they just need to exist so the module finishes evaluating.
// This must run before anything that imports "pdf-parse" (directly or
// transitively), which is why it's the very first import in server.ts.
if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error -- intentionally minimal stand-in, not a real DOMMatrix
  globalThis.DOMMatrix = class DOMMatrix {};
}
if (typeof globalThis.ImageData === "undefined") {
  // @ts-expect-error -- intentionally minimal stand-in, not a real ImageData
  globalThis.ImageData = class ImageData {};
}
if (typeof globalThis.Path2D === "undefined") {
  // @ts-expect-error -- intentionally minimal stand-in, not a real Path2D
  globalThis.Path2D = class Path2D {};
}
