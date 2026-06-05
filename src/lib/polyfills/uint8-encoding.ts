/**
 * Polyfill des méthodes d'encodage Uint8Array (proposition TC39 :
 * toHex/fromHex/toBase64/fromBase64/setFromHex/setFromBase64).
 *
 * pdf.js v6 les utilise. Elles n'arrivent que dans Chrome ~140 / Node 22+, or
 * les apps de BUREAU tournent sur Electron 33 = Chromium 130 + Node 20 → erreur
 * « a.toHex is not a function » au rendu PDF (écran de signature). Sur le web /
 * navigateur récent, les méthodes natives existent → ce polyfill est un NO-OP.
 *
 * Import à effet de bord (`import "@/lib/polyfills/uint8-encoding"`).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
(function installUint8Encoding() {
  const g: any = typeof globalThis !== "undefined" ? globalThis : (undefined as any);
  if (!g || !g.Uint8Array) return;
  const Ctor: any = g.Uint8Array;
  const Proto: any = Ctor.prototype;
  const HEX = "0123456789abcdef";

  function toHex(this: Uint8Array): string {
    let s = "";
    for (let i = 0; i < this.length; i++) {
      const b = this[i];
      s += HEX[(b >> 4) & 15] + HEX[b & 15];
    }
    return s;
  }
  function fromHex(input: string): Uint8Array {
    const clean = String(input).replace(/[^0-9a-fA-F]/g, "");
    const n = clean.length >> 1;
    const out = new Ctor(n);
    for (let i = 0; i < n; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }
  function toBase64(this: Uint8Array, opts?: { alphabet?: string }): string {
    let bin = "";
    for (let i = 0; i < this.length; i++) bin += String.fromCharCode(this[i]);
    let b64 =
      typeof (g as any).btoa === "function"
        ? (g as any).btoa(bin)
        : (g as any).Buffer.from(this).toString("base64");
    if (opts && opts.alphabet === "base64url") b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return b64;
  }
  function fromBase64(input: string, opts?: { alphabet?: string }): Uint8Array {
    let s = String(input);
    if (opts && opts.alphabet === "base64url") s = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin =
      typeof (g as any).atob === "function"
        ? (g as any).atob(s)
        : (g as any).Buffer.from(s, "base64").toString("binary");
    const out = new Ctor(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function setFromHex(this: Uint8Array, input: string) {
    const b = fromHex(input);
    const n = Math.min(b.length, this.length);
    this.set(b.subarray(0, n));
    return { read: n * 2, written: n };
  }
  function setFromBase64(this: Uint8Array, input: string, opts?: { alphabet?: string }) {
    const b = fromBase64(input, opts);
    const n = Math.min(b.length, this.length);
    this.set(b.subarray(0, n));
    return { read: String(input).length, written: n };
  }

  function def(target: any, name: string, value: any) {
    if (typeof target[name] !== "function") {
      try {
        Object.defineProperty(target, name, { value, configurable: true, writable: true });
      } catch {
        /* ignore */
      }
    }
  }
  def(Proto, "toHex", toHex);
  def(Proto, "toBase64", toBase64);
  def(Proto, "setFromHex", setFromHex);
  def(Proto, "setFromBase64", setFromBase64);
  def(Ctor, "fromHex", fromHex);
  def(Ctor, "fromBase64", fromBase64);
})();

export {};
