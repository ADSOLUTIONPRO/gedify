// Worker pdf.js « enveloppé » : charge d'ABORD le polyfill Uint8Array
// (toHex/toBase64/fromBase64…) puis le vrai worker pdf.js. Les modules ES sont
// évalués dans l'ordre des imports → le polyfill est en place avant pdf.js.
// Sert à l'écran de signature sous Electron (Chromium 130) qui n'a pas ces
// méthodes natives. Sur navigateur récent, le polyfill est un no-op.
import "./uint8-polyfill.mjs";
import "./pdf.worker.min.mjs";
