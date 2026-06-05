// Polyfill Uint8Array toHex/fromHex/toBase64/fromBase64/setFromHex/setFromBase64
// (proposition TC39) pour le WORKER pdf.js. Nécessaire sous Electron 33
// (Chromium 130) où ces méthodes n'existent pas → « a.toHex is not a function ».
// No-op sur navigateur récent (Chrome 140+).
(function () {
  const g = self;
  if (!g || !g.Uint8Array) return;
  const Ctor = g.Uint8Array;
  const Proto = Ctor.prototype;
  const HEX = "0123456789abcdef";
  function toHex() {
    let s = "";
    for (let i = 0; i < this.length; i++) { const b = this[i]; s += HEX[(b >> 4) & 15] + HEX[b & 15]; }
    return s;
  }
  function fromHex(input) {
    const clean = String(input).replace(/[^0-9a-fA-F]/g, "");
    const n = clean.length >> 1; const out = new Ctor(n);
    for (let i = 0; i < n; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }
  function toBase64(opts) {
    let bin = "";
    for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]);
    let b64 = g.btoa(bin);
    if (opts && opts.alphabet === "base64url") b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return b64;
  }
  function fromBase64(input, opts) {
    let s = String(input);
    if (opts && opts.alphabet === "base64url") s = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = g.atob(s); const out = new Ctor(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function setFromHex(input) {
    const b = fromHex(input); const n = Math.min(b.length, this.length);
    this.set(b.subarray(0, n)); return { read: n * 2, written: n };
  }
  function setFromBase64(input, opts) {
    const b = fromBase64(input, opts); const n = Math.min(b.length, this.length);
    this.set(b.subarray(0, n)); return { read: String(input).length, written: n };
  }
  function def(target, name, value) {
    if (typeof target[name] !== "function") {
      try { Object.defineProperty(target, name, { value, configurable: true, writable: true }); } catch (e) { /* ignore */ }
    }
  }
  def(Proto, "toHex", toHex);
  def(Proto, "toBase64", toBase64);
  def(Proto, "setFromHex", setFromHex);
  def(Proto, "setFromBase64", setFromBase64);
  def(Ctor, "fromHex", fromHex);
  def(Ctor, "fromBase64", fromBase64);
})();
