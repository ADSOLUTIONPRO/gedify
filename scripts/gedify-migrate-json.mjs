import { createRequire as __gedifyCreateRequire } from 'module'; const require = __gedifyCreateRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/pg-types/node_modules/postgres-array/index.js
var require_postgres_array = __commonJS({
  "node_modules/pg-types/node_modules/postgres-array/index.js"(exports) {
    "use strict";
    exports.parse = function(source, transform) {
      return new ArrayParser(source, transform).parse();
    };
    var ArrayParser = class _ArrayParser {
      constructor(source, transform) {
        this.source = source;
        this.transform = transform || identity;
        this.position = 0;
        this.entries = [];
        this.recorded = [];
        this.dimension = 0;
      }
      isEof() {
        return this.position >= this.source.length;
      }
      nextCharacter() {
        var character = this.source[this.position++];
        if (character === "\\") {
          return {
            value: this.source[this.position++],
            escaped: true
          };
        }
        return {
          value: character,
          escaped: false
        };
      }
      record(character) {
        this.recorded.push(character);
      }
      newEntry(includeEmpty) {
        var entry;
        if (this.recorded.length > 0 || includeEmpty) {
          entry = this.recorded.join("");
          if (entry === "NULL" && !includeEmpty) {
            entry = null;
          }
          if (entry !== null) entry = this.transform(entry);
          this.entries.push(entry);
          this.recorded = [];
        }
      }
      consumeDimensions() {
        if (this.source[0] === "[") {
          while (!this.isEof()) {
            var char = this.nextCharacter();
            if (char.value === "=") break;
          }
        }
      }
      parse(nested) {
        var character, parser, quote;
        this.consumeDimensions();
        while (!this.isEof()) {
          character = this.nextCharacter();
          if (character.value === "{" && !quote) {
            this.dimension++;
            if (this.dimension > 1) {
              parser = new _ArrayParser(this.source.substr(this.position - 1), this.transform);
              this.entries.push(parser.parse(true));
              this.position += parser.position - 2;
            }
          } else if (character.value === "}" && !quote) {
            this.dimension--;
            if (!this.dimension) {
              this.newEntry();
              if (nested) return this.entries;
            }
          } else if (character.value === '"' && !character.escaped) {
            if (quote) this.newEntry(true);
            quote = !quote;
          } else if (character.value === "," && !quote) {
            this.newEntry();
          } else {
            this.record(character.value);
          }
        }
        if (this.dimension !== 0) {
          throw new Error("array dimension not balanced");
        }
        return this.entries;
      }
    };
    function identity(value) {
      return value;
    }
  }
});

// node_modules/pg-types/lib/arrayParser.js
var require_arrayParser = __commonJS({
  "node_modules/pg-types/lib/arrayParser.js"(exports, module) {
    var array = require_postgres_array();
    module.exports = {
      create: function(source, transform) {
        return {
          parse: function() {
            return array.parse(source, transform);
          }
        };
      }
    };
  }
});

// node_modules/postgres-date/index.js
var require_postgres_date = __commonJS({
  "node_modules/postgres-date/index.js"(exports, module) {
    "use strict";
    var DATE_TIME = /(\d{1,})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,})?.*?( BC)?$/;
    var DATE = /^(\d{1,})-(\d{2})-(\d{2})( BC)?$/;
    var TIME_ZONE = /([Z+-])(\d{2})?:?(\d{2})?:?(\d{2})?/;
    var INFINITY = /^-?infinity$/;
    module.exports = function parseDate(isoDate) {
      if (INFINITY.test(isoDate)) {
        return Number(isoDate.replace("i", "I"));
      }
      var matches = DATE_TIME.exec(isoDate);
      if (!matches) {
        return getDate(isoDate) || null;
      }
      var isBC = !!matches[8];
      var year = parseInt(matches[1], 10);
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var hour = parseInt(matches[4], 10);
      var minute = parseInt(matches[5], 10);
      var second = parseInt(matches[6], 10);
      var ms = matches[7];
      ms = ms ? 1e3 * parseFloat(ms) : 0;
      var date;
      var offset = timeZoneOffset(isoDate);
      if (offset != null) {
        date = new Date(Date.UTC(year, month, day, hour, minute, second, ms));
        if (is0To99(year)) {
          date.setUTCFullYear(year);
        }
        if (offset !== 0) {
          date.setTime(date.getTime() - offset);
        }
      } else {
        date = new Date(year, month, day, hour, minute, second, ms);
        if (is0To99(year)) {
          date.setFullYear(year);
        }
      }
      return date;
    };
    function getDate(isoDate) {
      var matches = DATE.exec(isoDate);
      if (!matches) {
        return;
      }
      var year = parseInt(matches[1], 10);
      var isBC = !!matches[4];
      if (isBC) {
        year = bcYearToNegativeYear(year);
      }
      var month = parseInt(matches[2], 10) - 1;
      var day = matches[3];
      var date = new Date(year, month, day);
      if (is0To99(year)) {
        date.setFullYear(year);
      }
      return date;
    }
    function timeZoneOffset(isoDate) {
      if (isoDate.endsWith("+00")) {
        return 0;
      }
      var zone = TIME_ZONE.exec(isoDate.split(" ")[1]);
      if (!zone) return;
      var type = zone[1];
      if (type === "Z") {
        return 0;
      }
      var sign = type === "-" ? -1 : 1;
      var offset = parseInt(zone[2], 10) * 3600 + parseInt(zone[3] || 0, 10) * 60 + parseInt(zone[4] || 0, 10);
      return offset * sign * 1e3;
    }
    function bcYearToNegativeYear(year) {
      return -(year - 1);
    }
    function is0To99(num2) {
      return num2 >= 0 && num2 < 100;
    }
  }
});

// node_modules/xtend/mutable.js
var require_mutable = __commonJS({
  "node_modules/xtend/mutable.js"(exports, module) {
    module.exports = extend;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    function extend(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        for (var key in source) {
          if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
          }
        }
      }
      return target;
    }
  }
});

// node_modules/postgres-interval/index.js
var require_postgres_interval = __commonJS({
  "node_modules/postgres-interval/index.js"(exports, module) {
    "use strict";
    var extend = require_mutable();
    module.exports = PostgresInterval;
    function PostgresInterval(raw2) {
      if (!(this instanceof PostgresInterval)) {
        return new PostgresInterval(raw2);
      }
      extend(this, parse(raw2));
    }
    var properties = ["seconds", "minutes", "hours", "days", "months", "years"];
    PostgresInterval.prototype.toPostgres = function() {
      var filtered = properties.filter(this.hasOwnProperty, this);
      if (this.milliseconds && filtered.indexOf("seconds") < 0) {
        filtered.push("seconds");
      }
      if (filtered.length === 0) return "0";
      return filtered.map(function(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/\.?0+$/, "");
        }
        return value + " " + property;
      }, this).join(" ");
    };
    var propertiesISOEquivalent = {
      years: "Y",
      months: "M",
      days: "D",
      hours: "H",
      minutes: "M",
      seconds: "S"
    };
    var dateProperties = ["years", "months", "days"];
    var timeProperties = ["hours", "minutes", "seconds"];
    PostgresInterval.prototype.toISOString = PostgresInterval.prototype.toISO = function() {
      var datePart = dateProperties.map(buildProperty, this).join("");
      var timePart = timeProperties.map(buildProperty, this).join("");
      return "P" + datePart + "T" + timePart;
      function buildProperty(property) {
        var value = this[property] || 0;
        if (property === "seconds" && this.milliseconds) {
          value = (value + this.milliseconds / 1e3).toFixed(6).replace(/0+$/, "");
        }
        return value + propertiesISOEquivalent[property];
      }
    };
    var NUMBER = "([+-]?\\d+)";
    var YEAR = NUMBER + "\\s+years?";
    var MONTH = NUMBER + "\\s+mons?";
    var DAY = NUMBER + "\\s+days?";
    var TIME = "([+-])?([\\d]*):(\\d\\d):(\\d\\d)\\.?(\\d{1,6})?";
    var INTERVAL = new RegExp([YEAR, MONTH, DAY, TIME].map(function(regexString) {
      return "(" + regexString + ")?";
    }).join("\\s*"));
    var positions = {
      years: 2,
      months: 4,
      days: 6,
      hours: 9,
      minutes: 10,
      seconds: 11,
      milliseconds: 12
    };
    var negatives = ["hours", "minutes", "seconds", "milliseconds"];
    function parseMilliseconds(fraction) {
      var microseconds = fraction + "000000".slice(fraction.length);
      return parseInt(microseconds, 10) / 1e3;
    }
    function parse(interval) {
      if (!interval) return {};
      var matches = INTERVAL.exec(interval);
      var isNegative = matches[8] === "-";
      return Object.keys(positions).reduce(function(parsed, property) {
        var position = positions[property];
        var value = matches[position];
        if (!value) return parsed;
        value = property === "milliseconds" ? parseMilliseconds(value) : parseInt(value, 10);
        if (!value) return parsed;
        if (isNegative && ~negatives.indexOf(property)) {
          value *= -1;
        }
        parsed[property] = value;
        return parsed;
      }, {});
    }
  }
});

// node_modules/postgres-bytea/index.js
var require_postgres_bytea = __commonJS({
  "node_modules/postgres-bytea/index.js"(exports, module) {
    "use strict";
    var bufferFrom = Buffer.from || Buffer;
    module.exports = function parseBytea(input) {
      if (/^\\x/.test(input)) {
        return bufferFrom(input.substr(2), "hex");
      }
      var output = "";
      var i = 0;
      while (i < input.length) {
        if (input[i] !== "\\") {
          output += input[i];
          ++i;
        } else {
          if (/[0-7]{3}/.test(input.substr(i + 1, 3))) {
            output += String.fromCharCode(parseInt(input.substr(i + 1, 3), 8));
            i += 4;
          } else {
            var backslashes = 1;
            while (i + backslashes < input.length && input[i + backslashes] === "\\") {
              backslashes++;
            }
            for (var k = 0; k < Math.floor(backslashes / 2); ++k) {
              output += "\\";
            }
            i += Math.floor(backslashes / 2) * 2;
          }
        }
      }
      return bufferFrom(output, "binary");
    };
  }
});

// node_modules/pg-types/lib/textParsers.js
var require_textParsers = __commonJS({
  "node_modules/pg-types/lib/textParsers.js"(exports, module) {
    var array = require_postgres_array();
    var arrayParser = require_arrayParser();
    var parseDate = require_postgres_date();
    var parseInterval = require_postgres_interval();
    var parseByteA = require_postgres_bytea();
    function allowNull(fn) {
      return function nullAllowed(value) {
        if (value === null) return value;
        return fn(value);
      };
    }
    function parseBool(value) {
      if (value === null) return value;
      return value === "TRUE" || value === "t" || value === "true" || value === "y" || value === "yes" || value === "on" || value === "1";
    }
    function parseBoolArray(value) {
      if (!value) return null;
      return array.parse(value, parseBool);
    }
    function parseBaseTenInt(string) {
      return parseInt(string, 10);
    }
    function parseIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(parseBaseTenInt));
    }
    function parseBigIntegerArray(value) {
      if (!value) return null;
      return array.parse(value, allowNull(function(entry) {
        return parseBigInteger(entry).trim();
      }));
    }
    var parsePointArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parsePoint(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseFloatArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseFloat(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseStringArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value);
      return p.parse();
    };
    var parseDateArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseDate(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseIntervalArray = function(value) {
      if (!value) {
        return null;
      }
      var p = arrayParser.create(value, function(entry) {
        if (entry !== null) {
          entry = parseInterval(entry);
        }
        return entry;
      });
      return p.parse();
    };
    var parseByteAArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(parseByteA));
    };
    var parseInteger = function(value) {
      return parseInt(value, 10);
    };
    var parseBigInteger = function(value) {
      var valStr = String(value);
      if (/^\d+$/.test(valStr)) {
        return valStr;
      }
      return value;
    };
    var parseJsonArray = function(value) {
      if (!value) {
        return null;
      }
      return array.parse(value, allowNull(JSON.parse));
    };
    var parsePoint = function(value) {
      if (value[0] !== "(") {
        return null;
      }
      value = value.substring(1, value.length - 1).split(",");
      return {
        x: parseFloat(value[0]),
        y: parseFloat(value[1])
      };
    };
    var parseCircle = function(value) {
      if (value[0] !== "<" && value[1] !== "(") {
        return null;
      }
      var point = "(";
      var radius = "";
      var pointParsed = false;
      for (var i = 2; i < value.length - 1; i++) {
        if (!pointParsed) {
          point += value[i];
        }
        if (value[i] === ")") {
          pointParsed = true;
          continue;
        } else if (!pointParsed) {
          continue;
        }
        if (value[i] === ",") {
          continue;
        }
        radius += value[i];
      }
      var result = parsePoint(point);
      result.radius = parseFloat(radius);
      return result;
    };
    var init2 = function(register) {
      register(20, parseBigInteger);
      register(21, parseInteger);
      register(23, parseInteger);
      register(26, parseInteger);
      register(700, parseFloat);
      register(701, parseFloat);
      register(16, parseBool);
      register(1082, parseDate);
      register(1114, parseDate);
      register(1184, parseDate);
      register(600, parsePoint);
      register(651, parseStringArray);
      register(718, parseCircle);
      register(1e3, parseBoolArray);
      register(1001, parseByteAArray);
      register(1005, parseIntegerArray);
      register(1007, parseIntegerArray);
      register(1028, parseIntegerArray);
      register(1016, parseBigIntegerArray);
      register(1017, parsePointArray);
      register(1021, parseFloatArray);
      register(1022, parseFloatArray);
      register(1231, parseFloatArray);
      register(1014, parseStringArray);
      register(1015, parseStringArray);
      register(1008, parseStringArray);
      register(1009, parseStringArray);
      register(1040, parseStringArray);
      register(1041, parseStringArray);
      register(1115, parseDateArray);
      register(1182, parseDateArray);
      register(1185, parseDateArray);
      register(1186, parseInterval);
      register(1187, parseIntervalArray);
      register(17, parseByteA);
      register(114, JSON.parse.bind(JSON));
      register(3802, JSON.parse.bind(JSON));
      register(199, parseJsonArray);
      register(3807, parseJsonArray);
      register(3907, parseStringArray);
      register(2951, parseStringArray);
      register(791, parseStringArray);
      register(1183, parseStringArray);
      register(1270, parseStringArray);
    };
    module.exports = {
      init: init2
    };
  }
});

// node_modules/pg-int8/index.js
var require_pg_int8 = __commonJS({
  "node_modules/pg-int8/index.js"(exports, module) {
    "use strict";
    var BASE = 1e6;
    function readInt8(buffer) {
      var high = buffer.readInt32BE(0);
      var low = buffer.readUInt32BE(4);
      var sign = "";
      if (high < 0) {
        high = ~high + (low === 0);
        low = ~low + 1 >>> 0;
        sign = "-";
      }
      var result = "";
      var carry;
      var t;
      var digits;
      var pad;
      var l;
      var i;
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        high = high / BASE >>> 0;
        t = 4294967296 * carry + low;
        low = t / BASE >>> 0;
        digits = "" + (t - BASE * low);
        if (low === 0 && high === 0) {
          return sign + digits + result;
        }
        pad = "";
        l = 6 - digits.length;
        for (i = 0; i < l; i++) {
          pad += "0";
        }
        result = pad + digits + result;
      }
      {
        carry = high % BASE;
        t = 4294967296 * carry + low;
        digits = "" + t % BASE;
        return sign + digits + result;
      }
    }
    module.exports = readInt8;
  }
});

// node_modules/pg-types/lib/binaryParsers.js
var require_binaryParsers = __commonJS({
  "node_modules/pg-types/lib/binaryParsers.js"(exports, module) {
    var parseInt64 = require_pg_int8();
    var parseBits = function(data, bits, offset, invert, callback) {
      offset = offset || 0;
      invert = invert || false;
      callback = callback || function(lastValue, newValue, bits2) {
        return lastValue * Math.pow(2, bits2) + newValue;
      };
      var offsetBytes = offset >> 3;
      var inv = function(value) {
        if (invert) {
          return ~value & 255;
        }
        return value;
      };
      var mask = 255;
      var firstBits = 8 - offset % 8;
      if (bits < firstBits) {
        mask = 255 << 8 - bits & 255;
        firstBits = bits;
      }
      if (offset) {
        mask = mask >> offset % 8;
      }
      var result = 0;
      if (offset % 8 + bits >= 8) {
        result = callback(0, inv(data[offsetBytes]) & mask, firstBits);
      }
      var bytes = bits + offset >> 3;
      for (var i = offsetBytes + 1; i < bytes; i++) {
        result = callback(result, inv(data[i]), 8);
      }
      var lastBits = (bits + offset) % 8;
      if (lastBits > 0) {
        result = callback(result, inv(data[bytes]) >> 8 - lastBits, lastBits);
      }
      return result;
    };
    var parseFloatFromBits = function(data, precisionBits, exponentBits) {
      var bias = Math.pow(2, exponentBits - 1) - 1;
      var sign = parseBits(data, 1);
      var exponent = parseBits(data, exponentBits, 1);
      if (exponent === 0) {
        return 0;
      }
      var precisionBitsCounter = 1;
      var parsePrecisionBits = function(lastValue, newValue, bits) {
        if (lastValue === 0) {
          lastValue = 1;
        }
        for (var i = 1; i <= bits; i++) {
          precisionBitsCounter /= 2;
          if ((newValue & 1 << bits - i) > 0) {
            lastValue += precisionBitsCounter;
          }
        }
        return lastValue;
      };
      var mantissa = parseBits(data, precisionBits, exponentBits + 1, false, parsePrecisionBits);
      if (exponent == Math.pow(2, exponentBits + 1) - 1) {
        if (mantissa === 0) {
          return sign === 0 ? Infinity : -Infinity;
        }
        return NaN;
      }
      return (sign === 0 ? 1 : -1) * Math.pow(2, exponent - bias) * mantissa;
    };
    var parseInt16 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 15, 1, true) + 1);
      }
      return parseBits(value, 15, 1);
    };
    var parseInt32 = function(value) {
      if (parseBits(value, 1) == 1) {
        return -1 * (parseBits(value, 31, 1, true) + 1);
      }
      return parseBits(value, 31, 1);
    };
    var parseFloat32 = function(value) {
      return parseFloatFromBits(value, 23, 8);
    };
    var parseFloat64 = function(value) {
      return parseFloatFromBits(value, 52, 11);
    };
    var parseNumeric = function(value) {
      var sign = parseBits(value, 16, 32);
      if (sign == 49152) {
        return NaN;
      }
      var weight = Math.pow(1e4, parseBits(value, 16, 16));
      var result = 0;
      var digits = [];
      var ndigits = parseBits(value, 16);
      for (var i = 0; i < ndigits; i++) {
        result += parseBits(value, 16, 64 + 16 * i) * weight;
        weight /= 1e4;
      }
      var scale = Math.pow(10, parseBits(value, 16, 48));
      return (sign === 0 ? 1 : -1) * Math.round(result * scale) / scale;
    };
    var parseDate = function(isUTC, value) {
      var sign = parseBits(value, 1);
      var rawValue = parseBits(value, 63, 1);
      var result = new Date((sign === 0 ? 1 : -1) * rawValue / 1e3 + 9466848e5);
      if (!isUTC) {
        result.setTime(result.getTime() + result.getTimezoneOffset() * 6e4);
      }
      result.usec = rawValue % 1e3;
      result.getMicroSeconds = function() {
        return this.usec;
      };
      result.setMicroSeconds = function(value2) {
        this.usec = value2;
      };
      result.getUTCMicroSeconds = function() {
        return this.usec;
      };
      return result;
    };
    var parseArray2 = function(value) {
      var dim2 = parseBits(value, 32);
      var flags = parseBits(value, 32, 32);
      var elementType = parseBits(value, 32, 64);
      var offset = 96;
      var dims = [];
      for (var i = 0; i < dim2; i++) {
        dims[i] = parseBits(value, 32, offset);
        offset += 32;
        offset += 32;
      }
      var parseElement = function(elementType2) {
        var length = parseBits(value, 32, offset);
        offset += 32;
        if (length == 4294967295) {
          return null;
        }
        var result;
        if (elementType2 == 23 || elementType2 == 20) {
          result = parseBits(value, length * 8, offset);
          offset += length * 8;
          return result;
        } else if (elementType2 == 25) {
          result = value.toString(this.encoding, offset >> 3, (offset += length << 3) >> 3);
          return result;
        } else {
          console.log("ERROR: ElementType not implemented: " + elementType2);
        }
      };
      var parse = function(dimension, elementType2) {
        var array = [];
        var i2;
        if (dimension.length > 1) {
          var count = dimension.shift();
          for (i2 = 0; i2 < count; i2++) {
            array[i2] = parse(dimension, elementType2);
          }
          dimension.unshift(count);
        } else {
          for (i2 = 0; i2 < dimension[0]; i2++) {
            array[i2] = parseElement(elementType2);
          }
        }
        return array;
      };
      return parse(dims, elementType);
    };
    var parseText = function(value) {
      return value.toString("utf8");
    };
    var parseBool = function(value) {
      if (value === null) return null;
      return parseBits(value, 8) > 0;
    };
    var init2 = function(register) {
      register(20, parseInt64);
      register(21, parseInt16);
      register(23, parseInt32);
      register(26, parseInt32);
      register(1700, parseNumeric);
      register(700, parseFloat32);
      register(701, parseFloat64);
      register(16, parseBool);
      register(1114, parseDate.bind(null, false));
      register(1184, parseDate.bind(null, true));
      register(1e3, parseArray2);
      register(1007, parseArray2);
      register(1016, parseArray2);
      register(1008, parseArray2);
      register(1009, parseArray2);
      register(25, parseText);
    };
    module.exports = {
      init: init2
    };
  }
});

// node_modules/pg-types/lib/builtins.js
var require_builtins = __commonJS({
  "node_modules/pg-types/lib/builtins.js"(exports, module) {
    module.exports = {
      BOOL: 16,
      BYTEA: 17,
      CHAR: 18,
      INT8: 20,
      INT2: 21,
      INT4: 23,
      REGPROC: 24,
      TEXT: 25,
      OID: 26,
      TID: 27,
      XID: 28,
      CID: 29,
      JSON: 114,
      XML: 142,
      PG_NODE_TREE: 194,
      SMGR: 210,
      PATH: 602,
      POLYGON: 604,
      CIDR: 650,
      FLOAT4: 700,
      FLOAT8: 701,
      ABSTIME: 702,
      RELTIME: 703,
      TINTERVAL: 704,
      CIRCLE: 718,
      MACADDR8: 774,
      MONEY: 790,
      MACADDR: 829,
      INET: 869,
      ACLITEM: 1033,
      BPCHAR: 1042,
      VARCHAR: 1043,
      DATE: 1082,
      TIME: 1083,
      TIMESTAMP: 1114,
      TIMESTAMPTZ: 1184,
      INTERVAL: 1186,
      TIMETZ: 1266,
      BIT: 1560,
      VARBIT: 1562,
      NUMERIC: 1700,
      REFCURSOR: 1790,
      REGPROCEDURE: 2202,
      REGOPER: 2203,
      REGOPERATOR: 2204,
      REGCLASS: 2205,
      REGTYPE: 2206,
      UUID: 2950,
      TXID_SNAPSHOT: 2970,
      PG_LSN: 3220,
      PG_NDISTINCT: 3361,
      PG_DEPENDENCIES: 3402,
      TSVECTOR: 3614,
      TSQUERY: 3615,
      GTSVECTOR: 3642,
      REGCONFIG: 3734,
      REGDICTIONARY: 3769,
      JSONB: 3802,
      REGNAMESPACE: 4089,
      REGROLE: 4096
    };
  }
});

// node_modules/pg-types/index.js
var require_pg_types = __commonJS({
  "node_modules/pg-types/index.js"(exports) {
    var textParsers = require_textParsers();
    var binaryParsers = require_binaryParsers();
    var arrayParser = require_arrayParser();
    var builtinTypes = require_builtins();
    exports.getTypeParser = getTypeParser2;
    exports.setTypeParser = setTypeParser;
    exports.arrayParser = arrayParser;
    exports.builtins = builtinTypes;
    var typeParsers = {
      text: {},
      binary: {}
    };
    function noParse(val) {
      return String(val);
    }
    function getTypeParser2(oid, format) {
      format = format || "text";
      if (!typeParsers[format]) {
        return noParse;
      }
      return typeParsers[format][oid] || noParse;
    }
    function setTypeParser(oid, format, parseFn) {
      if (typeof format == "function") {
        parseFn = format;
        format = "text";
      }
      typeParsers[format][oid] = parseFn;
    }
    textParsers.init(function(oid, converter) {
      typeParsers.text[oid] = converter;
    });
    binaryParsers.init(function(oid, converter) {
      typeParsers.binary[oid] = converter;
    });
  }
});

// node_modules/pg/lib/defaults.js
var require_defaults = __commonJS({
  "node_modules/pg/lib/defaults.js"(exports, module) {
    "use strict";
    var user;
    try {
      user = process.platform === "win32" ? process.env.USERNAME : process.env.USER;
    } catch {
    }
    module.exports = {
      // database host. defaults to localhost
      host: "localhost",
      // database user's name
      user,
      // name of database to connect
      database: void 0,
      // database user's password
      password: null,
      // a Postgres connection string to be used instead of setting individual connection items
      // NOTE:  Setting this value will cause it to override any other value (such as database or user) defined
      // in the defaults object.
      connectionString: void 0,
      // database port
      port: 5432,
      // number of rows to return at a time from a prepared statement's
      // portal. 0 will return all rows at once
      rows: 0,
      // binary result mode
      binary: false,
      // Connection pool options - see https://github.com/brianc/node-pg-pool
      // number of connections to use in connection pool
      // 0 will disable connection pooling
      max: 10,
      // max milliseconds a client can go unused before it is removed
      // from the pool and destroyed
      idleTimeoutMillis: 3e4,
      client_encoding: "",
      ssl: false,
      application_name: void 0,
      fallback_application_name: void 0,
      options: void 0,
      parseInputDatesAsUTC: false,
      // max milliseconds any query using this connection will execute for before timing out in error.
      // false=unlimited
      statement_timeout: false,
      // Abort any statement that waits longer than the specified duration in milliseconds while attempting to acquire a lock.
      // false=unlimited
      lock_timeout: false,
      // Terminate any session with an open transaction that has been idle for longer than the specified duration in milliseconds
      // false=unlimited
      idle_in_transaction_session_timeout: false,
      // max milliseconds to wait for query to complete (client side)
      query_timeout: false,
      connect_timeout: 0,
      keepalives: 1,
      keepalives_idle: 0
    };
    var pgTypes = require_pg_types();
    var parseBigInteger = pgTypes.getTypeParser(20, "text");
    var parseBigIntegerArray = pgTypes.getTypeParser(1016, "text");
    module.exports.__defineSetter__("parseInt8", function(val) {
      pgTypes.setTypeParser(20, "text", val ? pgTypes.getTypeParser(23, "text") : parseBigInteger);
      pgTypes.setTypeParser(1016, "text", val ? pgTypes.getTypeParser(1007, "text") : parseBigIntegerArray);
    });
  }
});

// node_modules/pg/lib/utils.js
var require_utils = __commonJS({
  "node_modules/pg/lib/utils.js"(exports, module) {
    "use strict";
    var defaults2 = require_defaults();
    var { isDate } = __require("util/types");
    function escapeElement(elementRepresentation) {
      const escaped = elementRepresentation.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return '"' + escaped + '"';
    }
    function arrayString(val) {
      let result = "{";
      for (let i = 0; i < val.length; i++) {
        if (i > 0) {
          result += ",";
        }
        let item = val[i];
        if (item == null) {
          result += "NULL";
        } else if (Array.isArray(item)) {
          result += arrayString(item);
        } else if (ArrayBuffer.isView(item)) {
          if (!(item instanceof Buffer)) {
            item = Buffer.from(item.buffer, item.byteOffset, item.byteLength);
          }
          result += "\\\\x" + item.toString("hex");
        } else {
          result += escapeElement(prepareValue(item));
        }
      }
      result += "}";
      return result;
    }
    var prepareValue = function(val, seen) {
      if (val == null) {
        return null;
      }
      if (typeof val === "object") {
        if (val instanceof Buffer) {
          return val;
        }
        if (ArrayBuffer.isView(val)) {
          return Buffer.from(val.buffer, val.byteOffset, val.byteLength);
        }
        if (isDate(val)) {
          if (defaults2.parseInputDatesAsUTC) {
            return dateToStringUTC(val);
          } else {
            return dateToString(val);
          }
        }
        if (Array.isArray(val)) {
          return arrayString(val);
        }
        return prepareObject(val, seen);
      }
      return val.toString();
    };
    function prepareObject(val, seen) {
      if (val && typeof val.toPostgres === "function") {
        seen = seen || [];
        if (seen.indexOf(val) !== -1) {
          throw new Error('circular reference detected while preparing "' + val + '" for query');
        }
        seen.push(val);
        return prepareValue(val.toPostgres(prepareValue), seen);
      }
      return JSON.stringify(val);
    }
    function dateToString(date) {
      let offset = -date.getTimezoneOffset();
      let year = date.getFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") + "T" + String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0") + ":" + String(date.getSeconds()).padStart(2, "0") + "." + String(date.getMilliseconds()).padStart(3, "0");
      if (offset < 0) {
        ret += "-";
        offset *= -1;
      } else {
        ret += "+";
      }
      ret += String(Math.floor(offset / 60)).padStart(2, "0") + ":" + String(offset % 60).padStart(2, "0");
      if (isBCYear) ret += " BC";
      return ret;
    }
    function dateToStringUTC(date) {
      let year = date.getUTCFullYear();
      const isBCYear = year < 1;
      if (isBCYear) year = Math.abs(year) + 1;
      let ret = String(year).padStart(4, "0") + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0") + "T" + String(date.getUTCHours()).padStart(2, "0") + ":" + String(date.getUTCMinutes()).padStart(2, "0") + ":" + String(date.getUTCSeconds()).padStart(2, "0") + "." + String(date.getUTCMilliseconds()).padStart(3, "0");
      ret += "+00:00";
      if (isBCYear) ret += " BC";
      return ret;
    }
    function normalizeQueryConfig(config2, values, callback) {
      config2 = typeof config2 === "string" ? { text: config2 } : config2;
      if (values) {
        if (typeof values === "function") {
          config2.callback = values;
        } else {
          config2.values = values;
        }
      }
      if (callback) {
        config2.callback = callback;
      }
      return config2;
    }
    var escapeIdentifier2 = function(str2) {
      return '"' + str2.replace(/"/g, '""') + '"';
    };
    var escapeLiteral2 = function(str2) {
      let hasBackslash = false;
      let escaped = "'";
      if (str2 == null) {
        return "''";
      }
      if (typeof str2 !== "string") {
        return "''";
      }
      for (let i = 0; i < str2.length; i++) {
        const c = str2[i];
        if (c === "'") {
          escaped += c + c;
        } else if (c === "\\") {
          escaped += c + c;
          hasBackslash = true;
        } else {
          escaped += c;
        }
      }
      escaped += "'";
      if (hasBackslash === true) {
        escaped = " E" + escaped;
      }
      return escaped;
    };
    module.exports = {
      prepareValue: function prepareValueWrapper(value) {
        return prepareValue(value);
      },
      normalizeQueryConfig,
      escapeIdentifier: escapeIdentifier2,
      escapeLiteral: escapeLiteral2
    };
  }
});

// node_modules/pg/lib/crypto/utils.js
var require_utils2 = __commonJS({
  "node_modules/pg/lib/crypto/utils.js"(exports, module) {
    var nodeCrypto = __require("crypto");
    module.exports = {
      postgresMd5PasswordHash,
      randomBytes,
      deriveKey,
      sha256,
      hashByName,
      hmacSha256,
      md5
    };
    var webCrypto = nodeCrypto.webcrypto || globalThis.crypto;
    var subtleCrypto = webCrypto.subtle;
    var textEncoder = new TextEncoder();
    function randomBytes(length) {
      return webCrypto.getRandomValues(Buffer.alloc(length));
    }
    async function md5(string) {
      try {
        return nodeCrypto.createHash("md5").update(string, "utf-8").digest("hex");
      } catch (e) {
        const data = typeof string === "string" ? textEncoder.encode(string) : string;
        const hash = await subtleCrypto.digest("MD5", data);
        return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    }
    async function postgresMd5PasswordHash(user, password, salt) {
      const inner = await md5(password + user);
      const outer = await md5(Buffer.concat([Buffer.from(inner), salt]));
      return "md5" + outer;
    }
    async function sha256(text) {
      return await subtleCrypto.digest("SHA-256", text);
    }
    async function hashByName(hashName, text) {
      return await subtleCrypto.digest(hashName, text);
    }
    async function hmacSha256(keyBuffer, msg) {
      const key = await subtleCrypto.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      return await subtleCrypto.sign("HMAC", key, textEncoder.encode(msg));
    }
    async function deriveKey(password, salt, iterations) {
      const key = await subtleCrypto.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const params = { name: "PBKDF2", hash: "SHA-256", salt, iterations };
      return await subtleCrypto.deriveBits(params, key, 32 * 8, ["deriveBits"]);
    }
  }
});

// node_modules/pg/lib/crypto/cert-signatures.js
var require_cert_signatures = __commonJS({
  "node_modules/pg/lib/crypto/cert-signatures.js"(exports, module) {
    function x509Error(msg, cert) {
      return new Error("SASL channel binding: " + msg + " when parsing public certificate " + cert.toString("base64"));
    }
    function readASN1Length(data, index) {
      let length = data[index++];
      if (length < 128) return { length, index };
      const lengthBytes = length & 127;
      if (lengthBytes > 4) throw x509Error("bad length", data);
      length = 0;
      for (let i = 0; i < lengthBytes; i++) {
        length = length << 8 | data[index++];
      }
      return { length, index };
    }
    function readASN1OID(data, index) {
      if (data[index++] !== 6) throw x509Error("non-OID data", data);
      const { length: OIDLength, index: indexAfterOIDLength } = readASN1Length(data, index);
      index = indexAfterOIDLength;
      const lastIndex = index + OIDLength;
      const byte1 = data[index++];
      let oid = (byte1 / 40 >> 0) + "." + byte1 % 40;
      while (index < lastIndex) {
        let value = 0;
        while (index < lastIndex) {
          const nextByte = data[index++];
          value = value << 7 | nextByte & 127;
          if (nextByte < 128) break;
        }
        oid += "." + value;
      }
      return { oid, index };
    }
    function expectASN1Seq(data, index) {
      if (data[index++] !== 48) throw x509Error("non-sequence data", data);
      return readASN1Length(data, index);
    }
    function signatureAlgorithmHashFromCertificate(data, index) {
      if (index === void 0) index = 0;
      index = expectASN1Seq(data, index).index;
      const { length: certInfoLength, index: indexAfterCertInfoLength } = expectASN1Seq(data, index);
      index = indexAfterCertInfoLength + certInfoLength;
      index = expectASN1Seq(data, index).index;
      const { oid, index: indexAfterOID } = readASN1OID(data, index);
      switch (oid) {
        // RSA
        case "1.2.840.113549.1.1.4":
          return "MD5";
        case "1.2.840.113549.1.1.5":
          return "SHA-1";
        case "1.2.840.113549.1.1.11":
          return "SHA-256";
        case "1.2.840.113549.1.1.12":
          return "SHA-384";
        case "1.2.840.113549.1.1.13":
          return "SHA-512";
        case "1.2.840.113549.1.1.14":
          return "SHA-224";
        case "1.2.840.113549.1.1.15":
          return "SHA512-224";
        case "1.2.840.113549.1.1.16":
          return "SHA512-256";
        // ECDSA
        case "1.2.840.10045.4.1":
          return "SHA-1";
        case "1.2.840.10045.4.3.1":
          return "SHA-224";
        case "1.2.840.10045.4.3.2":
          return "SHA-256";
        case "1.2.840.10045.4.3.3":
          return "SHA-384";
        case "1.2.840.10045.4.3.4":
          return "SHA-512";
        // RSASSA-PSS: hash is indicated separately
        case "1.2.840.113549.1.1.10": {
          index = indexAfterOID;
          index = expectASN1Seq(data, index).index;
          if (data[index++] !== 160) throw x509Error("non-tag data", data);
          index = readASN1Length(data, index).index;
          index = expectASN1Seq(data, index).index;
          const { oid: hashOID } = readASN1OID(data, index);
          switch (hashOID) {
            // standalone hash OIDs
            case "1.2.840.113549.2.5":
              return "MD5";
            case "1.3.14.3.2.26":
              return "SHA-1";
            case "2.16.840.1.101.3.4.2.1":
              return "SHA-256";
            case "2.16.840.1.101.3.4.2.2":
              return "SHA-384";
            case "2.16.840.1.101.3.4.2.3":
              return "SHA-512";
          }
          throw x509Error("unknown hash OID " + hashOID, data);
        }
        // Ed25519 -- see https: return//github.com/openssl/openssl/issues/15477
        case "1.3.101.110":
        case "1.3.101.112":
          return "SHA-512";
        // Ed448 -- still not in pg 17.2 (if supported, digest would be SHAKE256 x 64 bytes)
        case "1.3.101.111":
        case "1.3.101.113":
          throw x509Error("Ed448 certificate channel binding is not currently supported by Postgres");
      }
      throw x509Error("unknown OID " + oid, data);
    }
    module.exports = { signatureAlgorithmHashFromCertificate };
  }
});

// node_modules/pg/lib/crypto/sasl.js
var require_sasl = __commonJS({
  "node_modules/pg/lib/crypto/sasl.js"(exports, module) {
    "use strict";
    var crypto = require_utils2();
    var { signatureAlgorithmHashFromCertificate } = require_cert_signatures();
    function saslprep(password) {
      const nonAsciiSpace = /[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g;
      const mappedToNothing = /[\u00AD\u034F\u1806\u180B\u180C\u180D\u200C\u200D\u2060\uFE00-\uFE0F\uFEFF]/g;
      return password.replace(nonAsciiSpace, " ").replace(mappedToNothing, "").normalize("NFKC");
    }
    var DEFAULT_MAX_SCRAM_ITERATIONS = 1e5;
    function startSession(mechanisms, stream, scramMaxIterations = DEFAULT_MAX_SCRAM_ITERATIONS) {
      const candidates = ["SCRAM-SHA-256"];
      if (stream) candidates.unshift("SCRAM-SHA-256-PLUS");
      const mechanism = candidates.find((candidate) => mechanisms.includes(candidate));
      if (!mechanism) {
        throw new Error("SASL: Only mechanism(s) " + candidates.join(" and ") + " are supported");
      }
      if (mechanism === "SCRAM-SHA-256-PLUS" && typeof stream.getPeerCertificate !== "function") {
        throw new Error("SASL: Mechanism SCRAM-SHA-256-PLUS requires a certificate");
      }
      const clientNonce = crypto.randomBytes(18).toString("base64");
      const gs2Header = mechanism === "SCRAM-SHA-256-PLUS" ? "p=tls-server-end-point" : stream ? "y" : "n";
      return {
        mechanism,
        clientNonce,
        response: gs2Header + ",,n=*,r=" + clientNonce,
        message: "SASLInitialResponse",
        scramMaxIterations
      };
    }
    async function continueSession(session, password, serverData, stream) {
      if (session.message !== "SASLInitialResponse") {
        throw new Error("SASL: Last message was not SASLInitialResponse");
      }
      if (typeof password !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string");
      }
      if (password === "") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a non-empty string");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: serverData must be a string");
      }
      const sv = parseServerFirstMessage(serverData);
      if (!sv.nonce.startsWith(session.clientNonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce does not start with client nonce");
      } else if (sv.nonce.length === session.clientNonce.length) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: server nonce is too short");
      }
      const scramMaxIterations = typeof session.scramMaxIterations === "number" ? session.scramMaxIterations : DEFAULT_MAX_SCRAM_ITERATIONS;
      if (scramMaxIterations !== 0 && sv.iteration > scramMaxIterations) {
        throw new Error(
          "SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration count " + sv.iteration + " exceeds scramMaxIterations of " + scramMaxIterations
        );
      }
      const clientFirstMessageBare = "n=*,r=" + session.clientNonce;
      const serverFirstMessage = "r=" + sv.nonce + ",s=" + sv.salt + ",i=" + sv.iteration;
      let channelBinding = stream ? "eSws" : "biws";
      if (session.mechanism === "SCRAM-SHA-256-PLUS") {
        const peerCert = stream.getPeerCertificate().raw;
        let hashName = signatureAlgorithmHashFromCertificate(peerCert);
        if (hashName === "MD5" || hashName === "SHA-1") hashName = "SHA-256";
        const certHash = await crypto.hashByName(hashName, peerCert);
        const bindingData = Buffer.concat([Buffer.from("p=tls-server-end-point,,"), Buffer.from(certHash)]);
        channelBinding = bindingData.toString("base64");
      }
      const clientFinalMessageWithoutProof = "c=" + channelBinding + ",r=" + sv.nonce;
      const authMessage = clientFirstMessageBare + "," + serverFirstMessage + "," + clientFinalMessageWithoutProof;
      const saltBytes = Buffer.from(sv.salt, "base64");
      const saltedPassword = await crypto.deriveKey(saslprep(password), saltBytes, sv.iteration);
      const clientKey = await crypto.hmacSha256(saltedPassword, "Client Key");
      const storedKey = await crypto.sha256(clientKey);
      const clientSignature = await crypto.hmacSha256(storedKey, authMessage);
      const clientProof = xorBuffers(Buffer.from(clientKey), Buffer.from(clientSignature)).toString("base64");
      const serverKey = await crypto.hmacSha256(saltedPassword, "Server Key");
      const serverSignatureBytes = await crypto.hmacSha256(serverKey, authMessage);
      session.message = "SASLResponse";
      session.serverSignature = Buffer.from(serverSignatureBytes).toString("base64");
      session.response = clientFinalMessageWithoutProof + ",p=" + clientProof;
    }
    function finalizeSession(session, serverData) {
      if (session.message !== "SASLResponse") {
        throw new Error("SASL: Last message was not SASLResponse");
      }
      if (typeof serverData !== "string") {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: serverData must be a string");
      }
      const { serverSignature } = parseServerFinalMessage(serverData);
      if (serverSignature !== session.serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match");
      }
    }
    function isPrintableChars(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: text must be a string");
      }
      return text.split("").map((_, i) => text.charCodeAt(i)).every((c) => c >= 33 && c <= 43 || c >= 45 && c <= 126);
    }
    function isBase64(text) {
      return /^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(text);
    }
    function parseAttributePairs(text) {
      if (typeof text !== "string") {
        throw new TypeError("SASL: attribute pairs text must be a string");
      }
      return new Map(
        text.split(",").map((attrValue) => {
          if (!/^.=/.test(attrValue)) {
            throw new Error("SASL: Invalid attribute pair entry");
          }
          const name2 = attrValue[0];
          const value = attrValue.substring(2);
          return [name2, value];
        })
      );
    }
    function parseServerFirstMessage(data) {
      const attrPairs = parseAttributePairs(data);
      const nonce = attrPairs.get("r");
      if (!nonce) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce missing");
      } else if (!isPrintableChars(nonce)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: nonce must only contain printable characters");
      }
      const salt = attrPairs.get("s");
      if (!salt) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt missing");
      } else if (!isBase64(salt)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: salt must be base64");
      }
      const iterationText = attrPairs.get("i");
      if (!iterationText) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: iteration missing");
      } else if (!/^[1-9][0-9]*$/.test(iterationText)) {
        throw new Error("SASL: SCRAM-SERVER-FIRST-MESSAGE: invalid iteration count");
      }
      const iteration = parseInt(iterationText, 10);
      return {
        nonce,
        salt,
        iteration
      };
    }
    function parseServerFinalMessage(serverData) {
      const attrPairs = parseAttributePairs(serverData);
      const error = attrPairs.get("e");
      const serverSignature = attrPairs.get("v");
      if (error) {
        throw new Error(`SASL: SCRAM-SERVER-FINAL-MESSAGE: server returned error: "${error}"`);
      }
      if (!serverSignature) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature is missing");
      } else if (!isBase64(serverSignature)) {
        throw new Error("SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature must be base64");
      }
      return {
        serverSignature
      };
    }
    function xorBuffers(a, b) {
      if (!Buffer.isBuffer(a)) {
        throw new TypeError("first argument must be a Buffer");
      }
      if (!Buffer.isBuffer(b)) {
        throw new TypeError("second argument must be a Buffer");
      }
      if (a.length !== b.length) {
        throw new Error("Buffer lengths must match");
      }
      if (a.length === 0) {
        throw new Error("Buffers cannot be empty");
      }
      return Buffer.from(a.map((_, i) => a[i] ^ b[i]));
    }
    module.exports = {
      startSession,
      continueSession,
      finalizeSession,
      DEFAULT_MAX_SCRAM_ITERATIONS
    };
  }
});

// node_modules/pg/lib/type-overrides.js
var require_type_overrides = __commonJS({
  "node_modules/pg/lib/type-overrides.js"(exports, module) {
    "use strict";
    var types3 = require_pg_types();
    function TypeOverrides2(userTypes) {
      this._types = userTypes || types3;
      this.text = {};
      this.binary = {};
    }
    TypeOverrides2.prototype.getOverrides = function(format) {
      switch (format) {
        case "text":
          return this.text;
        case "binary":
          return this.binary;
        default:
          return {};
      }
    };
    TypeOverrides2.prototype.setTypeParser = function(oid, format, parseFn) {
      if (typeof format === "function") {
        parseFn = format;
        format = "text";
      }
      this.getOverrides(format)[oid] = parseFn;
    };
    TypeOverrides2.prototype.getTypeParser = function(oid, format) {
      format = format || "text";
      return this.getOverrides(format)[oid] || this._types.getTypeParser(oid, format);
    };
    module.exports = TypeOverrides2;
  }
});

// node_modules/pg-connection-string/index.js
var require_pg_connection_string = __commonJS({
  "node_modules/pg-connection-string/index.js"(exports, module) {
    "use strict";
    function parse(str2, options = {}) {
      if (str2.charAt(0) === "/") {
        const config3 = str2.split(" ");
        return { host: config3[0], database: config3[1] };
      }
      const config2 = /* @__PURE__ */ Object.create(null);
      let result;
      let dummyHost = false;
      if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(str2)) {
        str2 = encodeURI(str2).replace(/%25(\d\d)/g, "%$1");
      }
      try {
        try {
          result = new URL(str2, "postgres://base");
        } catch (e) {
          result = new URL(str2.replace("@/", "@___DUMMY___/"), "postgres://base");
          dummyHost = true;
        }
      } catch (err) {
        err.input && (err.input = "*****REDACTED*****");
        throw err;
      }
      for (const entry of result.searchParams.entries()) {
        config2[entry[0]] = entry[1];
      }
      config2.user = config2.user || decodeURIComponent(result.username);
      config2.password = config2.password || decodeURIComponent(result.password);
      if (result.protocol == "socket:") {
        config2.host = decodeURI(result.pathname);
        config2.database = result.searchParams.get("db");
        config2.client_encoding = result.searchParams.get("encoding");
        return config2;
      }
      const hostname = dummyHost ? "" : result.hostname;
      if (!config2.host) {
        config2.host = decodeURIComponent(hostname);
      } else if (hostname && /^%2f/i.test(hostname)) {
        result.pathname = hostname + result.pathname;
      }
      if (!config2.port) {
        config2.port = result.port;
      }
      const pathname = result.pathname.slice(1) || null;
      config2.database = pathname ? decodeURI(pathname) : null;
      if (config2.ssl === "true" || config2.ssl === "1") {
        config2.ssl = true;
      }
      if (config2.ssl === "0") {
        config2.ssl = false;
      }
      if (config2.sslcert || config2.sslkey || config2.sslrootcert || config2.sslmode) {
        config2.ssl = {};
      }
      const fs = config2.sslcert || config2.sslkey || config2.sslrootcert ? __require("fs") : null;
      if (config2.sslcert) {
        config2.ssl.cert = fs.readFileSync(config2.sslcert).toString();
      }
      if (config2.sslkey) {
        config2.ssl.key = fs.readFileSync(config2.sslkey).toString();
      }
      if (config2.sslrootcert) {
        config2.ssl.ca = fs.readFileSync(config2.sslrootcert).toString();
      }
      if (options.useLibpqCompat && config2.uselibpqcompat) {
        throw new Error("Both useLibpqCompat and uselibpqcompat are set. Please use only one of them.");
      }
      if (config2.uselibpqcompat === "true" || options.useLibpqCompat) {
        switch (config2.sslmode) {
          case "disable": {
            config2.ssl = false;
            break;
          }
          case "prefer": {
            config2.ssl.rejectUnauthorized = false;
            break;
          }
          case "require": {
            if (config2.sslrootcert) {
              config2.ssl.checkServerIdentity = function() {
              };
            } else {
              config2.ssl.rejectUnauthorized = false;
            }
            break;
          }
          case "verify-ca": {
            if (!config2.ssl.ca) {
              throw new Error(
                "SECURITY WARNING: Using sslmode=verify-ca requires specifying a CA with sslrootcert. If a public CA is used, verify-ca allows connections to a server that somebody else may have registered with the CA, making you vulnerable to Man-in-the-Middle attacks. Either specify a custom CA certificate with sslrootcert parameter or use sslmode=verify-full for proper security."
              );
            }
            config2.ssl.checkServerIdentity = function() {
            };
            break;
          }
          case "verify-full": {
            break;
          }
        }
      } else {
        switch (config2.sslmode) {
          case "disable": {
            config2.ssl = false;
            break;
          }
          case "prefer":
          case "require":
          case "verify-ca":
          case "verify-full": {
            if (config2.sslmode !== "verify-full") {
              deprecatedSslModeWarning(config2.sslmode);
            }
            break;
          }
          case "no-verify": {
            config2.ssl.rejectUnauthorized = false;
            break;
          }
        }
      }
      return config2;
    }
    function toConnectionOptions(sslConfig) {
      const connectionOptions = Object.entries(sslConfig).reduce((c, [key, value]) => {
        if (value !== void 0 && value !== null) {
          c[key] = value;
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return connectionOptions;
    }
    function toClientConfig(config2) {
      const poolConfig = Object.entries(config2).reduce((c, [key, value]) => {
        if (key === "ssl") {
          const sslConfig = value;
          if (typeof sslConfig === "boolean") {
            c[key] = sslConfig;
          }
          if (typeof sslConfig === "object") {
            c[key] = toConnectionOptions(sslConfig);
          }
        } else if (value !== void 0 && value !== null) {
          if (key === "port") {
            if (value !== "") {
              const v = parseInt(value, 10);
              if (isNaN(v)) {
                throw new Error(`Invalid ${key}: ${value}`);
              }
              c[key] = v;
            }
          } else {
            c[key] = value;
          }
        }
        return c;
      }, /* @__PURE__ */ Object.create(null));
      return poolConfig;
    }
    function parseIntoClientConfig(str2) {
      return toClientConfig(parse(str2));
    }
    function deprecatedSslModeWarning(sslmode) {
      if (!deprecatedSslModeWarning.warned && typeof process !== "undefined" && process.emitWarning) {
        deprecatedSslModeWarning.warned = true;
        process.emitWarning(`SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
In the next major version (pg-connection-string v3.0.0 and pg v9.0.0), these modes will adopt standard libpq semantics, which have weaker security guarantees.

To prepare for this change:
- If you want the current behavior, explicitly use 'sslmode=verify-full'
- If you want libpq compatibility now, use 'uselibpqcompat=true&sslmode=${sslmode}'

See https://www.postgresql.org/docs/current/libpq-ssl.html for libpq SSL mode definitions.`);
      }
    }
    module.exports = parse;
    parse.parse = parse;
    parse.toClientConfig = toClientConfig;
    parse.parseIntoClientConfig = parseIntoClientConfig;
  }
});

// node_modules/pg/lib/connection-parameters.js
var require_connection_parameters = __commonJS({
  "node_modules/pg/lib/connection-parameters.js"(exports, module) {
    "use strict";
    var dns = __require("dns");
    var defaults2 = require_defaults();
    var parse = require_pg_connection_string().parse;
    var val = function(key, config2, envVar) {
      if (config2[key]) {
        return config2[key];
      }
      if (envVar === void 0) {
        envVar = process.env["PG" + key.toUpperCase()];
      } else if (envVar === false) {
      } else {
        envVar = process.env[envVar];
      }
      return envVar || defaults2[key];
    };
    var readSSLConfigFromEnvironment = function() {
      switch (process.env.PGSSLMODE) {
        case "disable":
          return false;
        case "prefer":
        case "require":
        case "verify-ca":
        case "verify-full":
          return true;
        case "no-verify":
          return { rejectUnauthorized: false };
      }
      return defaults2.ssl;
    };
    var quoteParamValue = function(value) {
      return "'" + ("" + value).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
    };
    var add = function(params, config2, paramName) {
      const value = config2[paramName];
      if (value !== void 0 && value !== null) {
        params.push(paramName + "=" + quoteParamValue(value));
      }
    };
    var ConnectionParameters = class {
      constructor(config2) {
        config2 = typeof config2 === "string" ? parse(config2) : config2 || {};
        if (config2.connectionString) {
          config2 = Object.assign({}, config2, parse(config2.connectionString));
        }
        this.user = val("user", config2);
        this.database = val("database", config2);
        if (this.database === void 0) {
          this.database = this.user;
        }
        this.port = parseInt(val("port", config2), 10);
        this.host = val("host", config2);
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: val("password", config2)
        });
        this.binary = val("binary", config2);
        this.options = val("options", config2);
        this.ssl = typeof config2.ssl === "undefined" ? readSSLConfigFromEnvironment() : config2.ssl;
        if (typeof this.ssl === "string") {
          if (this.ssl === "true") {
            this.ssl = true;
          }
        }
        if (this.ssl === "no-verify") {
          this.ssl = { rejectUnauthorized: false };
        }
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this.client_encoding = val("client_encoding", config2);
        this.replication = val("replication", config2);
        this.isDomainSocket = !(this.host || "").indexOf("/");
        this.application_name = val("application_name", config2, "PGAPPNAME");
        this.fallback_application_name = val("fallback_application_name", config2, false);
        this.statement_timeout = val("statement_timeout", config2, false);
        this.lock_timeout = val("lock_timeout", config2, false);
        this.idle_in_transaction_session_timeout = val("idle_in_transaction_session_timeout", config2, false);
        this.query_timeout = val("query_timeout", config2, false);
        if (config2.connectionTimeoutMillis === void 0) {
          this.connect_timeout = process.env.PGCONNECT_TIMEOUT || 0;
        } else {
          this.connect_timeout = Math.floor(config2.connectionTimeoutMillis / 1e3);
        }
        if (config2.keepAlive === false) {
          this.keepalives = 0;
        } else if (config2.keepAlive === true) {
          this.keepalives = 1;
        }
        if (typeof config2.keepAliveInitialDelayMillis === "number") {
          this.keepalives_idle = Math.floor(config2.keepAliveInitialDelayMillis / 1e3);
        }
      }
      getLibpqConnectionString(cb) {
        const params = [];
        add(params, this, "user");
        add(params, this, "password");
        add(params, this, "port");
        add(params, this, "application_name");
        add(params, this, "fallback_application_name");
        add(params, this, "connect_timeout");
        add(params, this, "options");
        const ssl = typeof this.ssl === "object" ? this.ssl : this.ssl ? { sslmode: this.ssl } : {};
        add(params, ssl, "sslmode");
        add(params, ssl, "sslca");
        add(params, ssl, "sslkey");
        add(params, ssl, "sslcert");
        add(params, ssl, "sslrootcert");
        if (this.database) {
          params.push("dbname=" + quoteParamValue(this.database));
        }
        if (this.replication) {
          params.push("replication=" + quoteParamValue(this.replication));
        }
        if (this.host) {
          params.push("host=" + quoteParamValue(this.host));
        }
        if (this.isDomainSocket) {
          return cb(null, params.join(" "));
        }
        if (this.client_encoding) {
          params.push("client_encoding=" + quoteParamValue(this.client_encoding));
        }
        dns.lookup(this.host, function(err, address) {
          if (err) return cb(err, null);
          params.push("hostaddr=" + quoteParamValue(address));
          return cb(null, params.join(" "));
        });
      }
    };
    module.exports = ConnectionParameters;
  }
});

// node_modules/pg/lib/result.js
var require_result = __commonJS({
  "node_modules/pg/lib/result.js"(exports, module) {
    "use strict";
    var types3 = require_pg_types();
    var matchRegexp = /^([A-Za-z]+)(?: (\d+))?(?: (\d+))?/;
    var Result2 = class {
      constructor(rowMode, types4) {
        this.command = null;
        this.rowCount = null;
        this.oid = null;
        this.rows = [];
        this.fields = [];
        this._parsers = void 0;
        this._types = types4;
        this.RowCtor = null;
        this.rowAsArray = rowMode === "array";
        if (this.rowAsArray) {
          this.parseRow = this._parseRowAsArray;
        }
        this._prebuiltEmptyResultObject = null;
      }
      // adds a command complete message
      addCommandComplete(msg) {
        let match;
        if (msg.text) {
          match = matchRegexp.exec(msg.text);
        } else {
          match = matchRegexp.exec(msg.command);
        }
        if (match) {
          this.command = match[1];
          if (match[3]) {
            this.oid = parseInt(match[2], 10);
            this.rowCount = parseInt(match[3], 10);
          } else if (match[2]) {
            this.rowCount = parseInt(match[2], 10);
          }
        }
      }
      _parseRowAsArray(rowData) {
        const row = new Array(rowData.length);
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          if (rawValue !== null) {
            row[i] = this._parsers[i](rawValue);
          } else {
            row[i] = null;
          }
        }
        return row;
      }
      parseRow(rowData) {
        const row = { ...this._prebuiltEmptyResultObject };
        for (let i = 0, len = rowData.length; i < len; i++) {
          const rawValue = rowData[i];
          const field = this.fields[i].name;
          if (rawValue !== null) {
            const v = this.fields[i].format === "binary" ? Buffer.from(rawValue) : rawValue;
            row[field] = this._parsers[i](v);
          } else {
            row[field] = null;
          }
        }
        return row;
      }
      addRow(row) {
        this.rows.push(row);
      }
      addFields(fieldDescriptions) {
        this.fields = fieldDescriptions;
        if (this.fields.length) {
          this._parsers = new Array(fieldDescriptions.length);
        }
        const row = /* @__PURE__ */ Object.create(null);
        for (let i = 0; i < fieldDescriptions.length; i++) {
          const desc = fieldDescriptions[i];
          row[desc.name] = null;
          if (this._types) {
            this._parsers[i] = this._types.getTypeParser(desc.dataTypeID, desc.format || "text");
          } else {
            this._parsers[i] = types3.getTypeParser(desc.dataTypeID, desc.format || "text");
          }
        }
        this._prebuiltEmptyResultObject = { ...row };
      }
    };
    module.exports = Result2;
  }
});

// node_modules/pg/lib/query.js
var require_query = __commonJS({
  "node_modules/pg/lib/query.js"(exports, module) {
    "use strict";
    var { EventEmitter } = __require("events");
    var Result2 = require_result();
    var utils = require_utils();
    var Query2 = class extends EventEmitter {
      constructor(config2, values, callback) {
        super();
        config2 = utils.normalizeQueryConfig(config2, values, callback);
        this.text = config2.text;
        this.values = config2.values;
        this.rows = config2.rows;
        this.types = config2.types;
        this.name = config2.name;
        this.queryMode = config2.queryMode;
        this.binary = config2.binary;
        this.portal = config2.portal || "";
        this.callback = config2.callback;
        this._rowMode = config2.rowMode;
        if (process.domain && config2.callback) {
          this.callback = process.domain.bind(config2.callback);
        }
        this._result = new Result2(this._rowMode, this.types);
        this._results = this._result;
        this._canceledDueToError = false;
      }
      requiresPreparation() {
        if (this.queryMode === "extended") {
          return true;
        }
        if (this.name) {
          return true;
        }
        if (this.rows) {
          return true;
        }
        if (!this.text) {
          return false;
        }
        if (!this.values) {
          return false;
        }
        return this.values.length > 0;
      }
      _checkForMultirow() {
        if (this._result.command) {
          if (!Array.isArray(this._results)) {
            this._results = [this._result];
          }
          this._result = new Result2(this._rowMode, this._result._types);
          this._results.push(this._result);
        }
      }
      // associates row metadata from the supplied
      // message with this query object
      // metadata used when parsing row results
      handleRowDescription(msg) {
        this._checkForMultirow();
        this._result.addFields(msg.fields);
        this._accumulateRows = this.callback || !this.listeners("row").length;
      }
      handleDataRow(msg) {
        let row;
        if (this._canceledDueToError) {
          return;
        }
        try {
          row = this._result.parseRow(msg.fields);
        } catch (err) {
          this._canceledDueToError = err;
          return;
        }
        this.emit("row", row, this._result);
        if (this._accumulateRows) {
          this._result.addRow(row);
        }
      }
      handleCommandComplete(msg, connection) {
        this._checkForMultirow();
        this._result.addCommandComplete(msg);
        if (this.rows) {
          connection.sync();
        }
      }
      // if a named prepared statement is created with empty query text
      // the backend will send an emptyQuery message but *not* a command complete message
      // since we pipeline sync immediately after execute we don't need to do anything here
      // unless we have rows specified, in which case we did not pipeline the initial sync call
      handleEmptyQuery(connection) {
        if (this.rows) {
          connection.sync();
        }
      }
      handleError(err, connection) {
        if (this._canceledDueToError) {
          err = this._canceledDueToError;
          this._canceledDueToError = false;
        }
        if (this.callback) {
          return this.callback(err);
        }
        this.emit("error", err);
      }
      handleReadyForQuery(con) {
        if (this._canceledDueToError) {
          return this.handleError(this._canceledDueToError, con);
        }
        if (this.callback) {
          try {
            this.callback(null, this._results);
          } catch (err) {
            process.nextTick(() => {
              throw err;
            });
          }
        }
        this.emit("end", this._results);
      }
      submit(connection) {
        if (typeof this.text !== "string" && typeof this.name !== "string") {
          return new Error("A query must have either text or a name. Supplying neither is unsupported.");
        }
        const previous = connection.parsedStatements[this.name];
        if (this.text && previous && this.text !== previous) {
          return new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
        }
        if (this.values && !Array.isArray(this.values)) {
          return new Error("Query values must be an array");
        }
        if (this.requiresPreparation()) {
          connection.stream.cork && connection.stream.cork();
          try {
            this.prepare(connection);
          } finally {
            connection.stream.uncork && connection.stream.uncork();
          }
        } else {
          connection.query(this.text);
        }
        return null;
      }
      hasBeenParsed(connection) {
        return this.name && connection.parsedStatements[this.name];
      }
      handlePortalSuspended(connection) {
        this._getRows(connection, this.rows);
      }
      _getRows(connection, rows) {
        connection.execute({
          portal: this.portal,
          rows
        });
        if (!rows) {
          connection.sync();
        } else {
          connection.flush();
        }
      }
      // http://developer.postgresql.org/pgdocs/postgres/protocol-flow.html#PROTOCOL-FLOW-EXT-QUERY
      prepare(connection) {
        if (!this.hasBeenParsed(connection)) {
          connection.parse({
            text: this.text,
            name: this.name,
            types: this.types
          });
        }
        try {
          connection.bind({
            portal: this.portal,
            statement: this.name,
            values: this.values,
            binary: this.binary,
            valueMapper: utils.prepareValue
          });
        } catch (err) {
          this.handleError(err, connection);
          return;
        }
        connection.describe({
          type: "P",
          name: this.portal || ""
        });
        this._getRows(connection, this.rows);
      }
      handleCopyInResponse(connection) {
        connection.sendCopyFail("No source stream defined");
      }
      handleCopyData(msg, connection) {
      }
    };
    module.exports = Query2;
  }
});

// node_modules/pg-protocol/dist/messages.js
var require_messages = __commonJS({
  "node_modules/pg-protocol/dist/messages.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.NoticeMessage = exports.DataRowMessage = exports.CommandCompleteMessage = exports.ReadyForQueryMessage = exports.NotificationResponseMessage = exports.BackendKeyDataMessage = exports.AuthenticationMD5Password = exports.ParameterStatusMessage = exports.ParameterDescriptionMessage = exports.RowDescriptionMessage = exports.Field = exports.CopyResponse = exports.CopyDataMessage = exports.DatabaseError = exports.copyDone = exports.emptyQuery = exports.replicationStart = exports.portalSuspended = exports.noData = exports.closeComplete = exports.bindComplete = exports.parseComplete = void 0;
    exports.parseComplete = {
      name: "parseComplete",
      length: 5
    };
    exports.bindComplete = {
      name: "bindComplete",
      length: 5
    };
    exports.closeComplete = {
      name: "closeComplete",
      length: 5
    };
    exports.noData = {
      name: "noData",
      length: 5
    };
    exports.portalSuspended = {
      name: "portalSuspended",
      length: 5
    };
    exports.replicationStart = {
      name: "replicationStart",
      length: 4
    };
    exports.emptyQuery = {
      name: "emptyQuery",
      length: 4
    };
    exports.copyDone = {
      name: "copyDone",
      length: 4
    };
    var DatabaseError2 = class extends Error {
      constructor(message, length, name2) {
        super(message);
        this.length = length;
        this.name = name2;
      }
    };
    exports.DatabaseError = DatabaseError2;
    var CopyDataMessage = class {
      constructor(length, chunk) {
        this.length = length;
        this.chunk = chunk;
        this.name = "copyData";
      }
    };
    exports.CopyDataMessage = CopyDataMessage;
    var CopyResponse = class {
      constructor(length, name2, binary, columnCount) {
        this.length = length;
        this.name = name2;
        this.binary = binary;
        this.columnTypes = new Array(columnCount);
      }
    };
    exports.CopyResponse = CopyResponse;
    var Field = class {
      constructor(name2, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, format) {
        this.name = name2;
        this.tableID = tableID;
        this.columnID = columnID;
        this.dataTypeID = dataTypeID;
        this.dataTypeSize = dataTypeSize;
        this.dataTypeModifier = dataTypeModifier;
        this.format = format;
      }
    };
    exports.Field = Field;
    var RowDescriptionMessage = class {
      constructor(length, fieldCount) {
        this.length = length;
        this.fieldCount = fieldCount;
        this.name = "rowDescription";
        this.fields = new Array(this.fieldCount);
      }
    };
    exports.RowDescriptionMessage = RowDescriptionMessage;
    var ParameterDescriptionMessage = class {
      constructor(length, parameterCount) {
        this.length = length;
        this.parameterCount = parameterCount;
        this.name = "parameterDescription";
        this.dataTypeIDs = new Array(this.parameterCount);
      }
    };
    exports.ParameterDescriptionMessage = ParameterDescriptionMessage;
    var ParameterStatusMessage = class {
      constructor(length, parameterName, parameterValue) {
        this.length = length;
        this.parameterName = parameterName;
        this.parameterValue = parameterValue;
        this.name = "parameterStatus";
      }
    };
    exports.ParameterStatusMessage = ParameterStatusMessage;
    var AuthenticationMD5Password = class {
      constructor(length, salt) {
        this.length = length;
        this.salt = salt;
        this.name = "authenticationMD5Password";
      }
    };
    exports.AuthenticationMD5Password = AuthenticationMD5Password;
    var BackendKeyDataMessage = class {
      constructor(length, processID, secretKey) {
        this.length = length;
        this.processID = processID;
        this.secretKey = secretKey;
        this.name = "backendKeyData";
      }
    };
    exports.BackendKeyDataMessage = BackendKeyDataMessage;
    var NotificationResponseMessage = class {
      constructor(length, processId, channel, payload) {
        this.length = length;
        this.processId = processId;
        this.channel = channel;
        this.payload = payload;
        this.name = "notification";
      }
    };
    exports.NotificationResponseMessage = NotificationResponseMessage;
    var ReadyForQueryMessage = class {
      constructor(length, status) {
        this.length = length;
        this.status = status;
        this.name = "readyForQuery";
      }
    };
    exports.ReadyForQueryMessage = ReadyForQueryMessage;
    var CommandCompleteMessage = class {
      constructor(length, text) {
        this.length = length;
        this.text = text;
        this.name = "commandComplete";
      }
    };
    exports.CommandCompleteMessage = CommandCompleteMessage;
    var DataRowMessage = class {
      constructor(length, fields) {
        this.length = length;
        this.fields = fields;
        this.name = "dataRow";
        this.fieldCount = fields.length;
      }
    };
    exports.DataRowMessage = DataRowMessage;
    var NoticeMessage = class {
      constructor(length, message) {
        this.length = length;
        this.message = message;
        this.name = "notice";
      }
    };
    exports.NoticeMessage = NoticeMessage;
  }
});

// node_modules/pg-protocol/dist/buffer-writer.js
var require_buffer_writer = __commonJS({
  "node_modules/pg-protocol/dist/buffer-writer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Writer = void 0;
    var Writer = class {
      constructor(size = 256) {
        this.size = size;
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(size);
      }
      ensure(size) {
        const remaining = this.buffer.length - this.offset;
        if (remaining < size) {
          const oldBuffer = this.buffer;
          const newSize = oldBuffer.length + (oldBuffer.length >> 1) + size;
          this.buffer = Buffer.allocUnsafe(newSize);
          oldBuffer.copy(this.buffer);
        }
      }
      addInt32(num2) {
        this.ensure(4);
        this.buffer[this.offset++] = num2 >>> 24 & 255;
        this.buffer[this.offset++] = num2 >>> 16 & 255;
        this.buffer[this.offset++] = num2 >>> 8 & 255;
        this.buffer[this.offset++] = num2 >>> 0 & 255;
        return this;
      }
      addInt16(num2) {
        this.ensure(2);
        this.buffer[this.offset++] = num2 >>> 8 & 255;
        this.buffer[this.offset++] = num2 >>> 0 & 255;
        return this;
      }
      addCString(string) {
        if (!string) {
          this.ensure(1);
        } else {
          const len = Buffer.byteLength(string);
          this.ensure(len + 1);
          this.buffer.write(string, this.offset, "utf-8");
          this.offset += len;
        }
        this.buffer[this.offset++] = 0;
        return this;
      }
      addString(string = "") {
        const len = Buffer.byteLength(string);
        this.ensure(len);
        this.buffer.write(string, this.offset);
        this.offset += len;
        return this;
      }
      add(otherBuffer) {
        this.ensure(otherBuffer.length);
        otherBuffer.copy(this.buffer, this.offset);
        this.offset += otherBuffer.length;
        return this;
      }
      join(code) {
        if (code) {
          this.buffer[this.headerPosition] = code;
          const length = this.offset - (this.headerPosition + 1);
          this.buffer.writeInt32BE(length, this.headerPosition + 1);
        }
        return this.buffer.slice(code ? 0 : 5, this.offset);
      }
      flush(code) {
        const result = this.join(code);
        this.offset = 5;
        this.headerPosition = 0;
        this.buffer = Buffer.allocUnsafe(this.size);
        return result;
      }
    };
    exports.Writer = Writer;
  }
});

// node_modules/pg-protocol/dist/serializer.js
var require_serializer = __commonJS({
  "node_modules/pg-protocol/dist/serializer.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serialize = void 0;
    var buffer_writer_1 = require_buffer_writer();
    var writer = new buffer_writer_1.Writer();
    var startup = (opts) => {
      writer.addInt16(3).addInt16(0);
      for (const key of Object.keys(opts)) {
        writer.addCString(key).addCString(opts[key]);
      }
      writer.addCString("client_encoding").addCString("UTF8");
      const bodyBuffer = writer.addCString("").flush();
      const length = bodyBuffer.length + 4;
      return new buffer_writer_1.Writer().addInt32(length).add(bodyBuffer).flush();
    };
    var requestSsl = () => {
      const response = Buffer.allocUnsafe(8);
      response.writeInt32BE(8, 0);
      response.writeInt32BE(80877103, 4);
      return response;
    };
    var password = (password2) => {
      return writer.addCString(password2).flush(
        112
        /* code.startup */
      );
    };
    var sendSASLInitialResponseMessage = function(mechanism, initialResponse) {
      writer.addCString(mechanism).addInt32(Buffer.byteLength(initialResponse)).addString(initialResponse);
      return writer.flush(
        112
        /* code.startup */
      );
    };
    var sendSCRAMClientFinalMessage = function(additionalData) {
      return writer.addString(additionalData).flush(
        112
        /* code.startup */
      );
    };
    var query = (text) => {
      return writer.addCString(text).flush(
        81
        /* code.query */
      );
    };
    var emptyArray = [];
    var parse = (query2) => {
      const name2 = query2.name || "";
      if (name2.length > 63) {
        console.error("Warning! Postgres only supports 63 characters for query names.");
        console.error("You supplied %s (%s)", name2, name2.length);
        console.error("This can cause conflicts and silent errors executing queries");
      }
      const types3 = query2.types || emptyArray;
      const len = types3.length;
      const buffer = writer.addCString(name2).addCString(query2.text).addInt16(len);
      for (let i = 0; i < len; i++) {
        buffer.addInt32(types3[i]);
      }
      return writer.flush(
        80
        /* code.parse */
      );
    };
    var paramWriter = new buffer_writer_1.Writer();
    var writeValues = function(values, valueMapper) {
      for (let i = 0; i < values.length; i++) {
        const mappedVal = valueMapper ? valueMapper(values[i], i) : values[i];
        if (mappedVal == null) {
          writer.addInt16(
            0
            /* ParamType.STRING */
          );
          paramWriter.addInt32(-1);
        } else if (mappedVal instanceof Buffer) {
          writer.addInt16(
            1
            /* ParamType.BINARY */
          );
          paramWriter.addInt32(mappedVal.length);
          paramWriter.add(mappedVal);
        } else {
          writer.addInt16(
            0
            /* ParamType.STRING */
          );
          paramWriter.addInt32(Buffer.byteLength(mappedVal));
          paramWriter.addString(mappedVal);
        }
      }
    };
    var bind = (config2 = {}) => {
      const portal = config2.portal || "";
      const statement = config2.statement || "";
      const binary = config2.binary || false;
      const values = config2.values || emptyArray;
      const len = values.length;
      writer.addCString(portal).addCString(statement);
      writer.addInt16(len);
      writeValues(values, config2.valueMapper);
      writer.addInt16(len);
      writer.add(paramWriter.flush());
      writer.addInt16(1);
      writer.addInt16(
        binary ? 1 : 0
        /* ParamType.STRING */
      );
      return writer.flush(
        66
        /* code.bind */
      );
    };
    var emptyExecute = Buffer.from([69, 0, 0, 0, 9, 0, 0, 0, 0, 0]);
    var execute = (config2) => {
      if (!config2 || !config2.portal && !config2.rows) {
        return emptyExecute;
      }
      const portal = config2.portal || "";
      const rows = config2.rows || 0;
      const portalLength = Buffer.byteLength(portal);
      const len = 4 + portalLength + 1 + 4;
      const buff = Buffer.allocUnsafe(1 + len);
      buff[0] = 69;
      buff.writeInt32BE(len, 1);
      buff.write(portal, 5, "utf-8");
      buff[portalLength + 5] = 0;
      buff.writeUInt32BE(rows, buff.length - 4);
      return buff;
    };
    var cancel = (processID, secretKey) => {
      const buffer = Buffer.allocUnsafe(16);
      buffer.writeInt32BE(16, 0);
      buffer.writeInt16BE(1234, 4);
      buffer.writeInt16BE(5678, 6);
      buffer.writeInt32BE(processID, 8);
      buffer.writeInt32BE(secretKey, 12);
      return buffer;
    };
    var cstringMessage = (code, string) => {
      const stringLen = Buffer.byteLength(string);
      const len = 4 + stringLen + 1;
      const buffer = Buffer.allocUnsafe(1 + len);
      buffer[0] = code;
      buffer.writeInt32BE(len, 1);
      buffer.write(string, 5, "utf-8");
      buffer[len] = 0;
      return buffer;
    };
    var emptyDescribePortal = writer.addCString("P").flush(
      68
      /* code.describe */
    );
    var emptyDescribeStatement = writer.addCString("S").flush(
      68
      /* code.describe */
    );
    var describe = (msg) => {
      return msg.name ? cstringMessage(68, `${msg.type}${msg.name || ""}`) : msg.type === "P" ? emptyDescribePortal : emptyDescribeStatement;
    };
    var close = (msg) => {
      const text = `${msg.type}${msg.name || ""}`;
      return cstringMessage(67, text);
    };
    var copyData = (chunk) => {
      return writer.add(chunk).flush(
        100
        /* code.copyFromChunk */
      );
    };
    var copyFail = (message) => {
      return cstringMessage(102, message);
    };
    var codeOnlyBuffer = (code) => Buffer.from([code, 0, 0, 0, 4]);
    var flushBuffer = codeOnlyBuffer(
      72
      /* code.flush */
    );
    var syncBuffer = codeOnlyBuffer(
      83
      /* code.sync */
    );
    var endBuffer = codeOnlyBuffer(
      88
      /* code.end */
    );
    var copyDoneBuffer = codeOnlyBuffer(
      99
      /* code.copyDone */
    );
    var serialize = {
      startup,
      password,
      requestSsl,
      sendSASLInitialResponseMessage,
      sendSCRAMClientFinalMessage,
      query,
      parse,
      bind,
      execute,
      describe,
      close,
      flush: () => flushBuffer,
      sync: () => syncBuffer,
      end: () => endBuffer,
      copyData,
      copyDone: () => copyDoneBuffer,
      copyFail,
      cancel
    };
    exports.serialize = serialize;
  }
});

// node_modules/pg-protocol/dist/buffer-reader.js
var require_buffer_reader = __commonJS({
  "node_modules/pg-protocol/dist/buffer-reader.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BufferReader = void 0;
    var BufferReader = class {
      constructor(offset = 0) {
        this.offset = offset;
        this.buffer = Buffer.allocUnsafe(0);
        this.encoding = "utf-8";
      }
      setBuffer(offset, buffer) {
        this.offset = offset;
        this.buffer = buffer;
      }
      int16() {
        const result = this.buffer.readInt16BE(this.offset);
        this.offset += 2;
        return result;
      }
      byte() {
        const result = this.buffer[this.offset];
        this.offset++;
        return result;
      }
      int32() {
        const result = this.buffer.readInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      uint32() {
        const result = this.buffer.readUInt32BE(this.offset);
        this.offset += 4;
        return result;
      }
      string(length) {
        const result = this.buffer.toString(this.encoding, this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
      cstring() {
        const start = this.offset;
        let end = start;
        while (this.buffer[end++] !== 0) {
        }
        this.offset = end;
        return this.buffer.toString(this.encoding, start, end - 1);
      }
      bytes(length) {
        const result = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return result;
      }
    };
    exports.BufferReader = BufferReader;
  }
});

// node_modules/pg-protocol/dist/parser.js
var require_parser = __commonJS({
  "node_modules/pg-protocol/dist/parser.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Parser = void 0;
    var messages_1 = require_messages();
    var buffer_reader_1 = require_buffer_reader();
    var CODE_LENGTH = 1;
    var LEN_LENGTH = 4;
    var HEADER_LENGTH = CODE_LENGTH + LEN_LENGTH;
    var LATEINIT_LENGTH = -1;
    var emptyBuffer = Buffer.allocUnsafe(0);
    var Parser = class {
      constructor(opts) {
        this.buffer = emptyBuffer;
        this.bufferLength = 0;
        this.bufferOffset = 0;
        this.reader = new buffer_reader_1.BufferReader();
        if ((opts === null || opts === void 0 ? void 0 : opts.mode) === "binary") {
          throw new Error("Binary mode not supported yet");
        }
        this.mode = (opts === null || opts === void 0 ? void 0 : opts.mode) || "text";
      }
      parse(buffer, callback) {
        this.mergeBuffer(buffer);
        const bufferFullLength = this.bufferOffset + this.bufferLength;
        let offset = this.bufferOffset;
        while (offset + HEADER_LENGTH <= bufferFullLength) {
          const code = this.buffer[offset];
          const length = this.buffer.readUInt32BE(offset + CODE_LENGTH);
          const fullMessageLength = CODE_LENGTH + length;
          if (fullMessageLength + offset <= bufferFullLength) {
            const message = this.handlePacket(offset + HEADER_LENGTH, code, length, this.buffer);
            callback(message);
            offset += fullMessageLength;
          } else {
            break;
          }
        }
        if (offset === bufferFullLength) {
          this.buffer = emptyBuffer;
          this.bufferLength = 0;
          this.bufferOffset = 0;
        } else {
          this.bufferLength = bufferFullLength - offset;
          this.bufferOffset = offset;
        }
      }
      mergeBuffer(buffer) {
        if (this.bufferLength > 0) {
          const newLength = this.bufferLength + buffer.byteLength;
          const newFullLength = newLength + this.bufferOffset;
          if (newFullLength > this.buffer.byteLength) {
            let newBuffer;
            if (newLength <= this.buffer.byteLength && this.bufferOffset >= this.bufferLength) {
              newBuffer = this.buffer;
            } else {
              let newBufferLength = this.buffer.byteLength * 2;
              while (newLength >= newBufferLength) {
                newBufferLength *= 2;
              }
              newBuffer = Buffer.allocUnsafe(newBufferLength);
            }
            this.buffer.copy(newBuffer, 0, this.bufferOffset, this.bufferOffset + this.bufferLength);
            this.buffer = newBuffer;
            this.bufferOffset = 0;
          }
          buffer.copy(this.buffer, this.bufferOffset + this.bufferLength);
          this.bufferLength = newLength;
        } else {
          this.buffer = buffer;
          this.bufferOffset = 0;
          this.bufferLength = buffer.byteLength;
        }
      }
      handlePacket(offset, code, length, bytes) {
        const { reader } = this;
        reader.setBuffer(offset, bytes);
        let message;
        switch (code) {
          case 50:
            message = messages_1.bindComplete;
            break;
          case 49:
            message = messages_1.parseComplete;
            break;
          case 51:
            message = messages_1.closeComplete;
            break;
          case 110:
            message = messages_1.noData;
            break;
          case 115:
            message = messages_1.portalSuspended;
            break;
          case 99:
            message = messages_1.copyDone;
            break;
          case 87:
            message = messages_1.replicationStart;
            break;
          case 73:
            message = messages_1.emptyQuery;
            break;
          case 68:
            message = parseDataRowMessage(reader);
            break;
          case 67:
            message = parseCommandCompleteMessage(reader);
            break;
          case 90:
            message = parseReadyForQueryMessage(reader);
            break;
          case 65:
            message = parseNotificationMessage(reader);
            break;
          case 82:
            message = parseAuthenticationResponse(reader, length);
            break;
          case 83:
            message = parseParameterStatusMessage(reader);
            break;
          case 75:
            message = parseBackendKeyData(reader);
            break;
          case 69:
            message = parseErrorMessage(reader, "error");
            break;
          case 78:
            message = parseErrorMessage(reader, "notice");
            break;
          case 84:
            message = parseRowDescriptionMessage(reader);
            break;
          case 116:
            message = parseParameterDescriptionMessage(reader);
            break;
          case 71:
            message = parseCopyInMessage(reader);
            break;
          case 72:
            message = parseCopyOutMessage(reader);
            break;
          case 100:
            message = parseCopyData(reader, length);
            break;
          default:
            return new messages_1.DatabaseError("received invalid response: " + code.toString(16), length, "error");
        }
        reader.setBuffer(0, emptyBuffer);
        message.length = length;
        return message;
      }
    };
    exports.Parser = Parser;
    var parseReadyForQueryMessage = (reader) => {
      const status = reader.string(1);
      return new messages_1.ReadyForQueryMessage(LATEINIT_LENGTH, status);
    };
    var parseCommandCompleteMessage = (reader) => {
      const text = reader.cstring();
      return new messages_1.CommandCompleteMessage(LATEINIT_LENGTH, text);
    };
    var parseCopyData = (reader, length) => {
      const chunk = reader.bytes(length - 4);
      return new messages_1.CopyDataMessage(LATEINIT_LENGTH, chunk);
    };
    var parseCopyInMessage = (reader) => parseCopyMessage(reader, "copyInResponse");
    var parseCopyOutMessage = (reader) => parseCopyMessage(reader, "copyOutResponse");
    var parseCopyMessage = (reader, messageName) => {
      const isBinary = reader.byte() !== 0;
      const columnCount = reader.int16();
      const message = new messages_1.CopyResponse(LATEINIT_LENGTH, messageName, isBinary, columnCount);
      for (let i = 0; i < columnCount; i++) {
        message.columnTypes[i] = reader.int16();
      }
      return message;
    };
    var parseNotificationMessage = (reader) => {
      const processId = reader.int32();
      const channel = reader.cstring();
      const payload = reader.cstring();
      return new messages_1.NotificationResponseMessage(LATEINIT_LENGTH, processId, channel, payload);
    };
    var parseRowDescriptionMessage = (reader) => {
      const fieldCount = reader.int16();
      const message = new messages_1.RowDescriptionMessage(LATEINIT_LENGTH, fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        message.fields[i] = parseField(reader);
      }
      return message;
    };
    var parseField = (reader) => {
      const name2 = reader.cstring();
      const tableID = reader.uint32();
      const columnID = reader.int16();
      const dataTypeID = reader.uint32();
      const dataTypeSize = reader.int16();
      const dataTypeModifier = reader.int32();
      const mode = reader.int16() === 0 ? "text" : "binary";
      return new messages_1.Field(name2, tableID, columnID, dataTypeID, dataTypeSize, dataTypeModifier, mode);
    };
    var parseParameterDescriptionMessage = (reader) => {
      const parameterCount = reader.int16();
      const message = new messages_1.ParameterDescriptionMessage(LATEINIT_LENGTH, parameterCount);
      for (let i = 0; i < parameterCount; i++) {
        message.dataTypeIDs[i] = reader.int32();
      }
      return message;
    };
    var parseDataRowMessage = (reader) => {
      const fieldCount = reader.int16();
      const fields = new Array(fieldCount);
      for (let i = 0; i < fieldCount; i++) {
        const len = reader.int32();
        fields[i] = len === -1 ? null : reader.string(len);
      }
      return new messages_1.DataRowMessage(LATEINIT_LENGTH, fields);
    };
    var parseParameterStatusMessage = (reader) => {
      const name2 = reader.cstring();
      const value = reader.cstring();
      return new messages_1.ParameterStatusMessage(LATEINIT_LENGTH, name2, value);
    };
    var parseBackendKeyData = (reader) => {
      const processID = reader.int32();
      const secretKey = reader.int32();
      return new messages_1.BackendKeyDataMessage(LATEINIT_LENGTH, processID, secretKey);
    };
    var parseAuthenticationResponse = (reader, length) => {
      const code = reader.int32();
      const message = {
        name: "authenticationOk",
        length
      };
      switch (code) {
        case 0:
          break;
        case 3:
          if (message.length === 8) {
            message.name = "authenticationCleartextPassword";
          }
          break;
        case 5:
          if (message.length === 12) {
            message.name = "authenticationMD5Password";
            const salt = reader.bytes(4);
            return new messages_1.AuthenticationMD5Password(LATEINIT_LENGTH, salt);
          }
          break;
        case 10:
          {
            message.name = "authenticationSASL";
            message.mechanisms = [];
            let mechanism;
            do {
              mechanism = reader.cstring();
              if (mechanism) {
                message.mechanisms.push(mechanism);
              }
            } while (mechanism);
          }
          break;
        case 11:
          message.name = "authenticationSASLContinue";
          message.data = reader.string(length - 8);
          break;
        case 12:
          message.name = "authenticationSASLFinal";
          message.data = reader.string(length - 8);
          break;
        default:
          throw new Error("Unknown authenticationOk message type " + code);
      }
      return message;
    };
    var parseErrorMessage = (reader, name2) => {
      const fields = {};
      let fieldType = reader.string(1);
      while (fieldType !== "\0") {
        fields[fieldType] = reader.cstring();
        fieldType = reader.string(1);
      }
      const messageValue = fields.M;
      const message = name2 === "notice" ? new messages_1.NoticeMessage(LATEINIT_LENGTH, messageValue) : new messages_1.DatabaseError(messageValue, LATEINIT_LENGTH, name2);
      message.severity = fields.S;
      message.code = fields.C;
      message.detail = fields.D;
      message.hint = fields.H;
      message.position = fields.P;
      message.internalPosition = fields.p;
      message.internalQuery = fields.q;
      message.where = fields.W;
      message.schema = fields.s;
      message.table = fields.t;
      message.column = fields.c;
      message.dataType = fields.d;
      message.constraint = fields.n;
      message.file = fields.F;
      message.line = fields.L;
      message.routine = fields.R;
      return message;
    };
  }
});

// node_modules/pg-protocol/dist/index.js
var require_dist = __commonJS({
  "node_modules/pg-protocol/dist/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DatabaseError = exports.serialize = exports.parse = void 0;
    var messages_1 = require_messages();
    Object.defineProperty(exports, "DatabaseError", { enumerable: true, get: function() {
      return messages_1.DatabaseError;
    } });
    var serializer_1 = require_serializer();
    Object.defineProperty(exports, "serialize", { enumerable: true, get: function() {
      return serializer_1.serialize;
    } });
    var parser_1 = require_parser();
    function parse(stream, callback) {
      const parser = new parser_1.Parser();
      stream.on("data", (buffer) => parser.parse(buffer, callback));
      return new Promise((resolve) => stream.on("end", () => resolve()));
    }
    exports.parse = parse;
  }
});

// node_modules/pg-cloudflare/dist/empty.js
var require_empty = __commonJS({
  "node_modules/pg-cloudflare/dist/empty.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = {};
  }
});

// node_modules/pg/lib/stream.js
var require_stream = __commonJS({
  "node_modules/pg/lib/stream.js"(exports, module) {
    var { getStream, getSecureStream } = getStreamFuncs();
    module.exports = {
      /**
       * Get a socket stream compatible with the current runtime environment.
       * @returns {Duplex}
       */
      getStream,
      /**
       * Get a TLS secured socket, compatible with the current environment,
       * using the socket and other settings given in `options`.
       * @returns {Duplex}
       */
      getSecureStream
    };
    function getNodejsStreamFuncs() {
      function getStream2(ssl) {
        const net = __require("net");
        return new net.Socket();
      }
      function getSecureStream2(options) {
        const tls = __require("tls");
        return tls.connect(options);
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function getCloudflareStreamFuncs() {
      function getStream2(ssl) {
        const { CloudflareSocket } = require_empty();
        return new CloudflareSocket(ssl);
      }
      function getSecureStream2(options) {
        options.socket.startTls(options);
        return options.socket;
      }
      return {
        getStream: getStream2,
        getSecureStream: getSecureStream2
      };
    }
    function isCloudflareRuntime() {
      if (typeof navigator === "object" && navigator !== null && typeof navigator.userAgent === "string") {
        return navigator.userAgent === "Cloudflare-Workers";
      }
      if (typeof Response === "function") {
        const resp = new Response(null, { cf: { thing: true } });
        if (typeof resp.cf === "object" && resp.cf !== null && resp.cf.thing) {
          return true;
        }
      }
      return false;
    }
    function getStreamFuncs() {
      if (isCloudflareRuntime()) {
        return getCloudflareStreamFuncs();
      }
      return getNodejsStreamFuncs();
    }
  }
});

// node_modules/pg/lib/connection.js
var require_connection = __commonJS({
  "node_modules/pg/lib/connection.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events").EventEmitter;
    var { parse, serialize } = require_dist();
    var { getStream, getSecureStream } = require_stream();
    var flushBuffer = serialize.flush();
    var syncBuffer = serialize.sync();
    var endBuffer = serialize.end();
    var Connection2 = class extends EventEmitter {
      constructor(config2) {
        super();
        config2 = config2 || {};
        this.stream = config2.stream || getStream(config2.ssl);
        if (typeof this.stream === "function") {
          this.stream = this.stream(config2);
        }
        this._keepAlive = config2.keepAlive;
        this._keepAliveInitialDelayMillis = config2.keepAliveInitialDelayMillis;
        this.parsedStatements = {};
        this.ssl = config2.ssl || false;
        this._ending = false;
        this._emitMessage = false;
        const self = this;
        this.on("newListener", function(eventName) {
          if (eventName === "message") {
            self._emitMessage = true;
          }
        });
      }
      connect(port, host) {
        const self = this;
        this._connecting = true;
        this.stream.setNoDelay(true);
        this.stream.connect(port, host);
        this.stream.once("connect", function() {
          if (self._keepAlive) {
            self.stream.setKeepAlive(true, self._keepAliveInitialDelayMillis);
          }
          self.emit("connect");
        });
        const reportStreamError = function(error) {
          if (self._ending && (error.code === "ECONNRESET" || error.code === "EPIPE")) {
            return;
          }
          self.emit("error", error);
        };
        this.stream.on("error", reportStreamError);
        this.stream.on("close", function() {
          self.emit("end");
        });
        if (!this.ssl) {
          return this.attachListeners(this.stream);
        }
        this.stream.once("data", function(buffer) {
          const responseCode = buffer.toString("utf8");
          switch (responseCode) {
            case "S":
              break;
            case "N":
              self.stream.end();
              return self.emit("error", new Error("The server does not support SSL connections"));
            default:
              self.stream.end();
              return self.emit("error", new Error("There was an error establishing an SSL connection"));
          }
          const options = {
            socket: self.stream
          };
          if (self.ssl !== true) {
            Object.assign(options, self.ssl);
            if ("key" in self.ssl) {
              options.key = self.ssl.key;
            }
          }
          const net = __require("net");
          if (net.isIP && net.isIP(host) === 0) {
            options.servername = host;
          }
          try {
            self.stream = getSecureStream(options);
          } catch (err) {
            return self.emit("error", err);
          }
          self.attachListeners(self.stream);
          self.stream.on("error", reportStreamError);
          self.emit("sslconnect");
        });
      }
      attachListeners(stream) {
        parse(stream, (msg) => {
          const eventName = msg.name === "error" ? "errorMessage" : msg.name;
          if (this._emitMessage) {
            this.emit("message", msg);
          }
          this.emit(eventName, msg);
        });
      }
      requestSsl() {
        this.stream.write(serialize.requestSsl());
      }
      startup(config2) {
        this.stream.write(serialize.startup(config2));
      }
      cancel(processID, secretKey) {
        this._send(serialize.cancel(processID, secretKey));
      }
      password(password) {
        this._send(serialize.password(password));
      }
      sendSASLInitialResponseMessage(mechanism, initialResponse) {
        this._send(serialize.sendSASLInitialResponseMessage(mechanism, initialResponse));
      }
      sendSCRAMClientFinalMessage(additionalData) {
        this._send(serialize.sendSCRAMClientFinalMessage(additionalData));
      }
      _send(buffer) {
        if (!this.stream.writable) {
          return false;
        }
        return this.stream.write(buffer);
      }
      query(text) {
        this._send(serialize.query(text));
      }
      // send parse message
      parse(query) {
        this._send(serialize.parse(query));
      }
      // send bind message
      bind(config2) {
        this._send(serialize.bind(config2));
      }
      // send execute message
      execute(config2) {
        this._send(serialize.execute(config2));
      }
      flush() {
        if (this.stream.writable) {
          this.stream.write(flushBuffer);
        }
      }
      sync() {
        this._ending = true;
        this._send(syncBuffer);
      }
      ref() {
        this.stream.ref();
      }
      unref() {
        this.stream.unref();
      }
      end() {
        this._ending = true;
        if (!this._connecting || !this.stream.writable) {
          this.stream.end();
          return;
        }
        return this.stream.write(endBuffer, () => {
          this.stream.end();
        });
      }
      close(msg) {
        this._send(serialize.close(msg));
      }
      describe(msg) {
        this._send(serialize.describe(msg));
      }
      sendCopyFromChunk(chunk) {
        this._send(serialize.copyData(chunk));
      }
      endCopyFrom() {
        this._send(serialize.copyDone());
      }
      sendCopyFail(msg) {
        this._send(serialize.copyFail(msg));
      }
    };
    module.exports = Connection2;
  }
});

// node_modules/split2/index.js
var require_split2 = __commonJS({
  "node_modules/split2/index.js"(exports, module) {
    "use strict";
    var { Transform } = __require("stream");
    var { StringDecoder } = __require("string_decoder");
    var kLast = /* @__PURE__ */ Symbol("last");
    var kDecoder = /* @__PURE__ */ Symbol("decoder");
    function transform(chunk, enc, cb) {
      let list;
      if (this.overflow) {
        const buf = this[kDecoder].write(chunk);
        list = buf.split(this.matcher);
        if (list.length === 1) return cb();
        list.shift();
        this.overflow = false;
      } else {
        this[kLast] += this[kDecoder].write(chunk);
        list = this[kLast].split(this.matcher);
      }
      this[kLast] = list.pop();
      for (let i = 0; i < list.length; i++) {
        try {
          push(this, this.mapper(list[i]));
        } catch (error) {
          return cb(error);
        }
      }
      this.overflow = this[kLast].length > this.maxLength;
      if (this.overflow && !this.skipOverflow) {
        cb(new Error("maximum buffer reached"));
        return;
      }
      cb();
    }
    function flush(cb) {
      this[kLast] += this[kDecoder].end();
      if (this[kLast]) {
        try {
          push(this, this.mapper(this[kLast]));
        } catch (error) {
          return cb(error);
        }
      }
      cb();
    }
    function push(self, val) {
      if (val !== void 0) {
        self.push(val);
      }
    }
    function noop(incoming) {
      return incoming;
    }
    function split(matcher, mapper, options) {
      matcher = matcher || /\r?\n/;
      mapper = mapper || noop;
      options = options || {};
      switch (arguments.length) {
        case 1:
          if (typeof matcher === "function") {
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof matcher === "object" && !(matcher instanceof RegExp) && !matcher[Symbol.split]) {
            options = matcher;
            matcher = /\r?\n/;
          }
          break;
        case 2:
          if (typeof matcher === "function") {
            options = mapper;
            mapper = matcher;
            matcher = /\r?\n/;
          } else if (typeof mapper === "object") {
            options = mapper;
            mapper = noop;
          }
      }
      options = Object.assign({}, options);
      options.autoDestroy = true;
      options.transform = transform;
      options.flush = flush;
      options.readableObjectMode = true;
      const stream = new Transform(options);
      stream[kLast] = "";
      stream[kDecoder] = new StringDecoder("utf8");
      stream.matcher = matcher;
      stream.mapper = mapper;
      stream.maxLength = options.maxLength;
      stream.skipOverflow = options.skipOverflow || false;
      stream.overflow = false;
      stream._destroy = function(err, cb) {
        this._writableState.errorEmitted = false;
        cb(err);
      };
      return stream;
    }
    module.exports = split;
  }
});

// node_modules/pgpass/lib/helper.js
var require_helper = __commonJS({
  "node_modules/pgpass/lib/helper.js"(exports, module) {
    "use strict";
    var path5 = __require("path");
    var Stream = __require("stream").Stream;
    var split = require_split2();
    var util = __require("util");
    var defaultPort = 5432;
    var isWin = process.platform === "win32";
    var warnStream = process.stderr;
    var S_IRWXG = 56;
    var S_IRWXO = 7;
    var S_IFMT = 61440;
    var S_IFREG = 32768;
    function isRegFile(mode) {
      return (mode & S_IFMT) == S_IFREG;
    }
    var fieldNames = ["host", "port", "database", "user", "password"];
    var nrOfFields = fieldNames.length;
    var passKey = fieldNames[nrOfFields - 1];
    function warn() {
      var isWritable = warnStream instanceof Stream && true === warnStream.writable;
      if (isWritable) {
        var args = Array.prototype.slice.call(arguments).concat("\n");
        warnStream.write(util.format.apply(util, args));
      }
    }
    Object.defineProperty(module.exports, "isWin", {
      get: function() {
        return isWin;
      },
      set: function(val) {
        isWin = val;
      }
    });
    module.exports.warnTo = function(stream) {
      var old = warnStream;
      warnStream = stream;
      return old;
    };
    module.exports.getFileName = function(rawEnv) {
      var env = rawEnv || process.env;
      var file = env.PGPASSFILE || (isWin ? path5.join(env.APPDATA || "./", "postgresql", "pgpass.conf") : path5.join(env.HOME || "./", ".pgpass"));
      return file;
    };
    module.exports.usePgPass = function(stats, fname) {
      if (Object.prototype.hasOwnProperty.call(process.env, "PGPASSWORD")) {
        return false;
      }
      if (isWin) {
        return true;
      }
      fname = fname || "<unkn>";
      if (!isRegFile(stats.mode)) {
        warn('WARNING: password file "%s" is not a plain file', fname);
        return false;
      }
      if (stats.mode & (S_IRWXG | S_IRWXO)) {
        warn('WARNING: password file "%s" has group or world access; permissions should be u=rw (0600) or less', fname);
        return false;
      }
      return true;
    };
    var matcher = module.exports.match = function(connInfo, entry) {
      return fieldNames.slice(0, -1).reduce(function(prev, field, idx) {
        if (idx == 1) {
          if (Number(connInfo[field] || defaultPort) === Number(entry[field])) {
            return prev && true;
          }
        }
        return prev && (entry[field] === "*" || entry[field] === connInfo[field]);
      }, true);
    };
    module.exports.getPassword = function(connInfo, stream, cb) {
      var pass;
      var lineStream = stream.pipe(split());
      function onLine(line) {
        var entry = parseLine(line);
        if (entry && isValidEntry(entry) && matcher(connInfo, entry)) {
          pass = entry[passKey];
          lineStream.end();
        }
      }
      var onEnd = function() {
        stream.destroy();
        cb(pass);
      };
      var onErr = function(err) {
        stream.destroy();
        warn("WARNING: error on reading file: %s", err);
        cb(void 0);
      };
      stream.on("error", onErr);
      lineStream.on("data", onLine).on("end", onEnd).on("error", onErr);
    };
    var parseLine = module.exports.parseLine = function(line) {
      if (line.length < 11 || line.match(/^\s+#/)) {
        return null;
      }
      var curChar = "";
      var prevChar = "";
      var fieldIdx = 0;
      var startIdx = 0;
      var endIdx = 0;
      var obj2 = {};
      var isLastField = false;
      var addToObj = function(idx, i0, i1) {
        var field = line.substring(i0, i1);
        if (!Object.hasOwnProperty.call(process.env, "PGPASS_NO_DEESCAPE")) {
          field = field.replace(/\\([:\\])/g, "$1");
        }
        obj2[fieldNames[idx]] = field;
      };
      for (var i = 0; i < line.length - 1; i += 1) {
        curChar = line.charAt(i + 1);
        prevChar = line.charAt(i);
        isLastField = fieldIdx == nrOfFields - 1;
        if (isLastField) {
          addToObj(fieldIdx, startIdx);
          break;
        }
        if (i >= 0 && curChar == ":" && prevChar !== "\\") {
          addToObj(fieldIdx, startIdx, i + 1);
          startIdx = i + 2;
          fieldIdx += 1;
        }
      }
      obj2 = Object.keys(obj2).length === nrOfFields ? obj2 : null;
      return obj2;
    };
    var isValidEntry = module.exports.isValidEntry = function(entry) {
      var rules = {
        // host
        0: function(x) {
          return x.length > 0;
        },
        // port
        1: function(x) {
          if (x === "*") {
            return true;
          }
          x = Number(x);
          return isFinite(x) && x > 0 && x < 9007199254740992 && Math.floor(x) === x;
        },
        // database
        2: function(x) {
          return x.length > 0;
        },
        // username
        3: function(x) {
          return x.length > 0;
        },
        // password
        4: function(x) {
          return x.length > 0;
        }
      };
      for (var idx = 0; idx < fieldNames.length; idx += 1) {
        var rule = rules[idx];
        var value = entry[fieldNames[idx]] || "";
        var res = rule(value);
        if (!res) {
          return false;
        }
      }
      return true;
    };
  }
});

// node_modules/pgpass/lib/index.js
var require_lib = __commonJS({
  "node_modules/pgpass/lib/index.js"(exports, module) {
    "use strict";
    var path5 = __require("path");
    var fs = __require("fs");
    var helper = require_helper();
    module.exports = function(connInfo, cb) {
      var file = helper.getFileName();
      fs.stat(file, function(err, stat) {
        if (err || !helper.usePgPass(stat, file)) {
          return cb(void 0);
        }
        var st = fs.createReadStream(file);
        helper.getPassword(connInfo, st, cb);
      });
    };
    module.exports.warnTo = helper.warnTo;
  }
});

// node_modules/pg/lib/client.js
var require_client = __commonJS({
  "node_modules/pg/lib/client.js"(exports, module) {
    var EventEmitter = __require("events").EventEmitter;
    var utils = require_utils();
    var nodeUtils = __require("util");
    var sasl = require_sasl();
    var TypeOverrides2 = require_type_overrides();
    var ConnectionParameters = require_connection_parameters();
    var Query2 = require_query();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var crypto = require_utils2();
    var activeQueryDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.activeQuery is deprecated and will be removed in pg@9.0"
    );
    var queryQueueDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Client.queryQueue is deprecated and will be removed in pg@9.0."
    );
    var pgPassDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "pgpass support is deprecated and will be removed in pg@9.0. You can provide an async function as the password property to the Client/Pool constructor that returns a password instead. Within this function you can call the pgpass module in your own code."
    );
    var byoPromiseDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Passing a custom Promise implementation to the Client/Pool constructor is deprecated and will be removed in pg@9.0."
    );
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    function coerceNumberOrDefault(value, defaultValue) {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : defaultValue;
      }
      if (typeof value === "string" && value.trim() !== "") {
        const n = Number(value);
        return Number.isFinite(n) ? n : defaultValue;
      }
      return defaultValue;
    }
    var Client2 = class extends EventEmitter {
      constructor(config2) {
        super();
        this.connectionParameters = new ConnectionParameters(config2);
        this.user = this.connectionParameters.user;
        this.database = this.connectionParameters.database;
        this.port = this.connectionParameters.port;
        this.host = this.connectionParameters.host;
        Object.defineProperty(this, "password", {
          configurable: true,
          enumerable: false,
          writable: true,
          value: this.connectionParameters.password
        });
        this.replication = this.connectionParameters.replication;
        const c = config2 || {};
        if (c.Promise) {
          byoPromiseDeprecationNotice();
        }
        this._Promise = c.Promise || global.Promise;
        this._types = new TypeOverrides2(c.types);
        this._ending = false;
        this._ended = false;
        this._connecting = false;
        this._connected = false;
        this._connectionError = false;
        this._queryable = true;
        this._activeQuery = null;
        this._txStatus = null;
        this.enableChannelBinding = Boolean(c.enableChannelBinding);
        this.scramMaxIterations = coerceNumberOrDefault(c.scramMaxIterations, sasl.DEFAULT_MAX_SCRAM_ITERATIONS);
        this.connection = c.connection || new Connection2({
          stream: c.stream,
          ssl: this.connectionParameters.ssl,
          keepAlive: c.keepAlive || false,
          keepAliveInitialDelayMillis: c.keepAliveInitialDelayMillis || 0,
          encoding: this.connectionParameters.client_encoding || "utf8"
        });
        this._queryQueue = [];
        this.binary = c.binary || defaults2.binary;
        this.processID = null;
        this.secretKey = null;
        this.ssl = this.connectionParameters.ssl || false;
        if (this.ssl && this.ssl.key) {
          Object.defineProperty(this.ssl, "key", {
            enumerable: false
          });
        }
        this._connectionTimeoutMillis = c.connectionTimeoutMillis || 0;
      }
      get activeQuery() {
        activeQueryDeprecationNotice();
        return this._activeQuery;
      }
      set activeQuery(val) {
        activeQueryDeprecationNotice();
        this._activeQuery = val;
      }
      _getActiveQuery() {
        return this._activeQuery;
      }
      _errorAllQueries(err) {
        const enqueueError = (query) => {
          process.nextTick(() => {
            query.handleError(err, this.connection);
          });
        };
        const activeQuery = this._getActiveQuery();
        if (activeQuery) {
          enqueueError(activeQuery);
          this._activeQuery = null;
        }
        this._queryQueue.forEach(enqueueError);
        this._queryQueue.length = 0;
      }
      _connect(callback) {
        const self = this;
        const con = this.connection;
        this._connectionCallback = callback;
        if (this._connecting || this._connected) {
          const err = new Error("Client has already been connected. You cannot reuse a client.");
          process.nextTick(() => {
            callback(err);
          });
          return;
        }
        this._connecting = true;
        if (this._connectionTimeoutMillis > 0) {
          this.connectionTimeoutHandle = setTimeout(() => {
            con._ending = true;
            con.stream.destroy(new Error("timeout expired"));
          }, this._connectionTimeoutMillis);
          if (this.connectionTimeoutHandle.unref) {
            this.connectionTimeoutHandle.unref();
          }
        }
        if (this.host && this.host.indexOf("/") === 0) {
          con.connect(this.host + "/.s.PGSQL." + this.port);
        } else {
          con.connect(this.port, this.host);
        }
        con.on("connect", function() {
          if (self.ssl) {
            con.requestSsl();
          } else {
            con.startup(self.getStartupConf());
          }
        });
        con.on("sslconnect", function() {
          con.startup(self.getStartupConf());
        });
        this._attachListeners(con);
        con.once("end", () => {
          const error = this._ending ? new Error("Connection terminated") : new Error("Connection terminated unexpectedly");
          clearTimeout(this.connectionTimeoutHandle);
          this._errorAllQueries(error);
          this._ended = true;
          if (!this._ending) {
            if (this._connecting && !this._connectionError) {
              if (this._connectionCallback) {
                this._connectionCallback(error);
              } else {
                this._handleErrorEvent(error);
              }
            } else if (!this._connectionError) {
              this._handleErrorEvent(error);
            }
          }
          process.nextTick(() => {
            this.emit("end");
          });
        });
      }
      connect(callback) {
        if (callback) {
          this._connect(callback);
          return;
        }
        return new this._Promise((resolve, reject) => {
          this._connect((error) => {
            if (error) {
              reject(error);
            } else {
              resolve(this);
            }
          });
        });
      }
      _attachListeners(con) {
        con.on("authenticationCleartextPassword", this._handleAuthCleartextPassword.bind(this));
        con.on("authenticationMD5Password", this._handleAuthMD5Password.bind(this));
        con.on("authenticationSASL", this._handleAuthSASL.bind(this));
        con.on("authenticationSASLContinue", this._handleAuthSASLContinue.bind(this));
        con.on("authenticationSASLFinal", this._handleAuthSASLFinal.bind(this));
        con.on("backendKeyData", this._handleBackendKeyData.bind(this));
        con.on("error", this._handleErrorEvent.bind(this));
        con.on("errorMessage", this._handleErrorMessage.bind(this));
        con.on("readyForQuery", this._handleReadyForQuery.bind(this));
        con.on("notice", this._handleNotice.bind(this));
        con.on("rowDescription", this._handleRowDescription.bind(this));
        con.on("dataRow", this._handleDataRow.bind(this));
        con.on("portalSuspended", this._handlePortalSuspended.bind(this));
        con.on("emptyQuery", this._handleEmptyQuery.bind(this));
        con.on("commandComplete", this._handleCommandComplete.bind(this));
        con.on("parseComplete", this._handleParseComplete.bind(this));
        con.on("copyInResponse", this._handleCopyInResponse.bind(this));
        con.on("copyData", this._handleCopyData.bind(this));
        con.on("notification", this._handleNotification.bind(this));
      }
      _getPassword(cb) {
        const con = this.connection;
        if (typeof this.password === "function") {
          this._Promise.resolve().then(() => this.password(this.connectionParameters)).then((pass) => {
            if (pass !== void 0) {
              if (typeof pass !== "string") {
                con.emit("error", new TypeError("Password must be a string"));
                return;
              }
              this.connectionParameters.password = this.password = pass;
            } else {
              this.connectionParameters.password = this.password = null;
            }
            cb();
          }).catch((err) => {
            con.emit("error", err);
          });
        } else if (this.password !== null) {
          cb();
        } else {
          try {
            const pgPass = require_lib();
            pgPass(this.connectionParameters, (pass) => {
              if (void 0 !== pass) {
                pgPassDeprecationNotice();
                this.connectionParameters.password = this.password = pass;
              }
              cb();
            });
          } catch (e) {
            this.emit("error", e);
          }
        }
      }
      _handleAuthCleartextPassword(msg) {
        this._getPassword(() => {
          this.connection.password(this.password);
        });
      }
      _handleAuthMD5Password(msg) {
        this._getPassword(async () => {
          try {
            const hashedPassword = await crypto.postgresMd5PasswordHash(this.user, this.password, msg.salt);
            this.connection.password(hashedPassword);
          } catch (e) {
            this.emit("error", e);
          }
        });
      }
      _handleAuthSASL(msg) {
        this._getPassword(() => {
          try {
            this.saslSession = sasl.startSession(
              msg.mechanisms,
              this.enableChannelBinding && this.connection.stream,
              this.scramMaxIterations
            );
            this.connection.sendSASLInitialResponseMessage(this.saslSession.mechanism, this.saslSession.response);
          } catch (err) {
            this.connection.emit("error", err);
          }
        });
      }
      async _handleAuthSASLContinue(msg) {
        try {
          await sasl.continueSession(
            this.saslSession,
            this.password,
            msg.data,
            this.enableChannelBinding && this.connection.stream
          );
          this.connection.sendSCRAMClientFinalMessage(this.saslSession.response);
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleAuthSASLFinal(msg) {
        try {
          sasl.finalizeSession(this.saslSession, msg.data);
          this.saslSession = null;
        } catch (err) {
          this.connection.emit("error", err);
        }
      }
      _handleBackendKeyData(msg) {
        this.processID = msg.processID;
        this.secretKey = msg.secretKey;
      }
      _handleReadyForQuery(msg) {
        if (this._connecting) {
          this._connecting = false;
          this._connected = true;
          clearTimeout(this.connectionTimeoutHandle);
          if (this._connectionCallback) {
            this._connectionCallback(null, this);
            this._connectionCallback = null;
          }
          this.emit("connect");
        }
        const activeQuery = this._getActiveQuery();
        this._activeQuery = null;
        this._txStatus = msg?.status ?? null;
        this.readyForQuery = true;
        if (activeQuery) {
          activeQuery.handleReadyForQuery(this.connection);
        }
        this._pulseQueryQueue();
      }
      // if we receive an error event or error message
      // during the connection process we handle it here
      _handleErrorWhileConnecting(err) {
        if (this._connectionError) {
          return;
        }
        this._connectionError = true;
        clearTimeout(this.connectionTimeoutHandle);
        if (this._connectionCallback) {
          return this._connectionCallback(err);
        }
        this.emit("error", err);
      }
      // if we're connected and we receive an error event from the connection
      // this means the socket is dead - do a hard abort of all queries and emit
      // the socket error on the client as well
      _handleErrorEvent(err) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(err);
        }
        this._queryable = false;
        this._errorAllQueries(err);
        this.emit("error", err);
      }
      // handle error messages from the postgres backend
      _handleErrorMessage(msg) {
        if (this._connecting) {
          return this._handleErrorWhileConnecting(msg);
        }
        const activeQuery = this._getActiveQuery();
        if (!activeQuery) {
          this._handleErrorEvent(msg);
          return;
        }
        this._activeQuery = null;
        activeQuery.handleError(msg, this.connection);
      }
      _handleRowDescription(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected rowDescription message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleRowDescription(msg);
      }
      _handleDataRow(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected dataRow message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleDataRow(msg);
      }
      _handlePortalSuspended(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected portalSuspended message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handlePortalSuspended(this.connection);
      }
      _handleEmptyQuery(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected emptyQuery message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleEmptyQuery(this.connection);
      }
      _handleCommandComplete(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected commandComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCommandComplete(msg, this.connection);
      }
      _handleParseComplete() {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected parseComplete message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        if (activeQuery.name) {
          this.connection.parsedStatements[activeQuery.name] = activeQuery.text;
        }
      }
      _handleCopyInResponse(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyInResponse message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyInResponse(this.connection);
      }
      _handleCopyData(msg) {
        const activeQuery = this._getActiveQuery();
        if (activeQuery == null) {
          const error = new Error("Received unexpected copyData message from backend.");
          this._handleErrorEvent(error);
          return;
        }
        activeQuery.handleCopyData(msg, this.connection);
      }
      _handleNotification(msg) {
        this.emit("notification", msg);
      }
      _handleNotice(msg) {
        this.emit("notice", msg);
      }
      getStartupConf() {
        const params = this.connectionParameters;
        const data = {
          user: params.user,
          database: params.database
        };
        const appName = params.application_name || params.fallback_application_name;
        if (appName) {
          data.application_name = appName;
        }
        if (params.replication) {
          data.replication = "" + params.replication;
        }
        if (params.statement_timeout) {
          data.statement_timeout = String(parseInt(params.statement_timeout, 10));
        }
        if (params.lock_timeout) {
          data.lock_timeout = String(parseInt(params.lock_timeout, 10));
        }
        if (params.idle_in_transaction_session_timeout) {
          data.idle_in_transaction_session_timeout = String(parseInt(params.idle_in_transaction_session_timeout, 10));
        }
        if (params.options) {
          data.options = params.options;
        }
        return data;
      }
      cancel(client2, query) {
        if (client2.activeQuery === query) {
          const con = this.connection;
          if (this.host && this.host.indexOf("/") === 0) {
            con.connect(this.host + "/.s.PGSQL." + this.port);
          } else {
            con.connect(this.port, this.host);
          }
          con.on("connect", function() {
            con.cancel(client2.processID, client2.secretKey);
          });
        } else if (client2._queryQueue.indexOf(query) !== -1) {
          client2._queryQueue.splice(client2._queryQueue.indexOf(query), 1);
        }
      }
      setTypeParser(oid, format, parseFn) {
        return this._types.setTypeParser(oid, format, parseFn);
      }
      getTypeParser(oid, format) {
        return this._types.getTypeParser(oid, format);
      }
      // escapeIdentifier and escapeLiteral moved to utility functions & exported
      // on PG
      // re-exported here for backwards compatibility
      escapeIdentifier(str2) {
        return utils.escapeIdentifier(str2);
      }
      escapeLiteral(str2) {
        return utils.escapeLiteral(str2);
      }
      _pulseQueryQueue() {
        if (this.readyForQuery === true) {
          this._activeQuery = this._queryQueue.shift();
          const activeQuery = this._getActiveQuery();
          if (activeQuery) {
            this.readyForQuery = false;
            this.hasExecuted = true;
            const queryError = activeQuery.submit(this.connection);
            if (queryError) {
              process.nextTick(() => {
                activeQuery.handleError(queryError, this.connection);
                this.readyForQuery = true;
                this._pulseQueryQueue();
              });
            }
          } else if (this.hasExecuted) {
            this._activeQuery = null;
            this.emit("drain");
          }
        }
      }
      query(config2, values, callback) {
        let query;
        let result;
        if (config2 == null) {
          throw new TypeError("Client was passed a null or undefined query");
        }
        if (typeof config2.submit === "function") {
          result = query = config2;
          if (!query.callback) {
            if (typeof values === "function") {
              query.callback = values;
            } else if (callback) {
              query.callback = callback;
            }
          }
        } else {
          query = new Query2(config2, values, callback);
          if (!query.callback) {
            result = new this._Promise((resolve, reject) => {
              query.callback = (err, res) => err ? reject(err) : resolve(res);
            }).catch((err) => {
              Error.captureStackTrace(err);
              throw err;
            });
          } else if (typeof query.callback !== "function") {
            throw new TypeError("callback is not a function");
          }
        }
        const readTimeout = config2.query_timeout || this.connectionParameters.query_timeout;
        if (readTimeout) {
          const queryCallback = query.callback || (() => {
          });
          const readTimeoutTimer = setTimeout(() => {
            const error = new Error("Query read timeout");
            process.nextTick(() => {
              query.handleError(error, this.connection);
            });
            queryCallback(error);
            query.callback = () => {
            };
            const index = this._queryQueue.indexOf(query);
            if (index > -1) {
              this._queryQueue.splice(index, 1);
            }
            this._pulseQueryQueue();
          }, readTimeout);
          query.callback = (err, res) => {
            clearTimeout(readTimeoutTimer);
            queryCallback(err, res);
          };
        }
        if (this.binary && !query.binary) {
          query.binary = true;
        }
        if (query._result && !query._result._types) {
          query._result._types = this._types;
        }
        if (!this._queryable) {
          process.nextTick(() => {
            query.handleError(new Error("Client has encountered a connection error and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._ending) {
          process.nextTick(() => {
            query.handleError(new Error("Client was closed and is not queryable"), this.connection);
          });
          return result;
        }
        if (this._queryQueue.length > 0) {
          queryQueueLengthDeprecationNotice();
        }
        this._queryQueue.push(query);
        this._pulseQueryQueue();
        return result;
      }
      ref() {
        this.connection.ref();
      }
      unref() {
        this.connection.unref();
      }
      getTransactionStatus() {
        return this._txStatus;
      }
      end(cb) {
        this._ending = true;
        if (!this.connection._connecting || this._ended) {
          if (cb) {
            cb();
            return;
          } else {
            return this._Promise.resolve();
          }
        }
        if (this._getActiveQuery() || !this._queryable) {
          this.connection.stream.destroy();
        } else {
          this.connection.end();
        }
        if (cb) {
          this.connection.once("end", cb);
        } else {
          return new this._Promise((resolve) => {
            this.connection.once("end", resolve);
          });
        }
      }
      get queryQueue() {
        queryQueueDeprecationNotice();
        return this._queryQueue;
      }
    };
    Client2.Query = Query2;
    module.exports = Client2;
  }
});

// node_modules/pg-pool/index.js
var require_pg_pool = __commonJS({
  "node_modules/pg-pool/index.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events").EventEmitter;
    var NOOP = function() {
    };
    var removeWhere = (list, predicate) => {
      const i = list.findIndex(predicate);
      return i === -1 ? void 0 : list.splice(i, 1)[0];
    };
    var IdleItem = class {
      constructor(client2, idleListener, timeoutId) {
        this.client = client2;
        this.idleListener = idleListener;
        this.timeoutId = timeoutId;
      }
    };
    var PendingItem = class {
      constructor(callback) {
        this.callback = callback;
      }
    };
    function throwOnDoubleRelease() {
      throw new Error("Release called on client which has already been released to the pool.");
    }
    function promisify(Promise2, callback) {
      if (callback) {
        return { callback, result: void 0 };
      }
      let rej;
      let res;
      const cb = function(err, client2) {
        err ? rej(err) : res(client2);
      };
      const result = new Promise2(function(resolve, reject) {
        res = resolve;
        rej = reject;
      }).catch((err) => {
        Error.captureStackTrace(err);
        throw err;
      });
      return { callback: cb, result };
    }
    function makeIdleListener(pool, client2) {
      return function idleListener(err) {
        err.client = client2;
        client2.removeListener("error", idleListener);
        client2.on("error", () => {
          pool.log("additional client error after disconnection due to error", err);
        });
        pool._remove(client2);
        pool.emit("error", err, client2);
      };
    }
    var Pool2 = class extends EventEmitter {
      constructor(options, Client2) {
        super();
        this.options = Object.assign({}, options);
        if (options != null && "password" in options) {
          Object.defineProperty(this.options, "password", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: options.password
          });
        }
        if (options != null && options.ssl && options.ssl.key) {
          Object.defineProperty(this.options.ssl, "key", {
            enumerable: false
          });
        }
        this.options.max = this.options.max || this.options.poolSize || 10;
        this.options.min = this.options.min || 0;
        this.options.maxUses = this.options.maxUses || Infinity;
        this.options.allowExitOnIdle = this.options.allowExitOnIdle || false;
        this.options.maxLifetimeSeconds = this.options.maxLifetimeSeconds || 0;
        this.log = this.options.log || function() {
        };
        this.Client = this.options.Client || Client2 || require_lib2().Client;
        this.Promise = this.options.Promise || global.Promise;
        if (typeof this.options.idleTimeoutMillis === "undefined") {
          this.options.idleTimeoutMillis = 1e4;
        }
        this._clients = [];
        this._idle = [];
        this._expired = /* @__PURE__ */ new WeakSet();
        this._pendingQueue = [];
        this._endCallback = void 0;
        this.ending = false;
        this.ended = false;
      }
      _promiseTry(f) {
        const Promise2 = this.Promise;
        if (typeof Promise2.try === "function") {
          return Promise2.try(f);
        }
        return new Promise2((resolve) => resolve(f()));
      }
      _isFull() {
        return this._clients.length >= this.options.max;
      }
      _isAboveMin() {
        return this._clients.length > this.options.min;
      }
      _pulseQueue() {
        this.log("pulse queue");
        if (this.ended) {
          this.log("pulse queue ended");
          return;
        }
        if (this.ending) {
          this.log("pulse queue on ending");
          if (this._idle.length) {
            this._idle.slice().map((item) => {
              this._remove(item.client);
            });
          }
          if (!this._clients.length) {
            this.ended = true;
            this._endCallback();
          }
          return;
        }
        if (!this._pendingQueue.length) {
          this.log("no queued requests");
          return;
        }
        if (!this._idle.length && this._isFull()) {
          return;
        }
        const pendingItem = this._pendingQueue.shift();
        if (this._idle.length) {
          const idleItem = this._idle.pop();
          clearTimeout(idleItem.timeoutId);
          const client2 = idleItem.client;
          client2.ref && client2.ref();
          const idleListener = idleItem.idleListener;
          return this._acquireClient(client2, pendingItem, idleListener, false);
        }
        if (!this._isFull()) {
          return this.newClient(pendingItem);
        }
        throw new Error("unexpected condition");
      }
      _remove(client2, callback) {
        const removed = removeWhere(this._idle, (item) => item.client === client2);
        if (removed !== void 0) {
          clearTimeout(removed.timeoutId);
        }
        this._clients = this._clients.filter((c) => c !== client2);
        const context = this;
        client2.end(() => {
          context.emit("remove", client2);
          if (typeof callback === "function") {
            callback();
          }
        });
      }
      connect(cb) {
        if (this.ending) {
          const err = new Error("Cannot use a pool after calling end on the pool");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        const response = promisify(this.Promise, cb);
        const result = response.result;
        if (this._isFull() || this._idle.length) {
          if (this._idle.length) {
            process.nextTick(() => this._pulseQueue());
          }
          if (!this.options.connectionTimeoutMillis) {
            this._pendingQueue.push(new PendingItem(response.callback));
            return result;
          }
          const queueCallback = (err, res, done) => {
            clearTimeout(tid);
            response.callback(err, res, done);
          };
          const pendingItem = new PendingItem(queueCallback);
          const tid = setTimeout(() => {
            removeWhere(this._pendingQueue, (i) => i.callback === queueCallback);
            pendingItem.timedOut = true;
            response.callback(new Error("timeout exceeded when trying to connect"));
          }, this.options.connectionTimeoutMillis);
          if (tid.unref) {
            tid.unref();
          }
          this._pendingQueue.push(pendingItem);
          return result;
        }
        this.newClient(new PendingItem(response.callback));
        return result;
      }
      newClient(pendingItem) {
        const client2 = new this.Client(this.options);
        this._clients.push(client2);
        const idleListener = makeIdleListener(this, client2);
        this.log("checking client timeout");
        let tid;
        let timeoutHit = false;
        if (this.options.connectionTimeoutMillis) {
          tid = setTimeout(() => {
            if (client2.connection) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client2.connection.stream.destroy();
            } else if (!client2.isConnected()) {
              this.log("ending client due to timeout");
              timeoutHit = true;
              client2.end();
            }
          }, this.options.connectionTimeoutMillis);
        }
        this.log("connecting new client");
        client2.connect((err) => {
          if (tid) {
            clearTimeout(tid);
          }
          client2.on("error", idleListener);
          if (err) {
            this.log("client failed to connect", err);
            this._clients = this._clients.filter((c) => c !== client2);
            if (timeoutHit) {
              err = new Error("Connection terminated due to connection timeout", { cause: err });
            }
            this._pulseQueue();
            if (!pendingItem.timedOut) {
              pendingItem.callback(err, void 0, NOOP);
            }
          } else {
            this.log("new client connected");
            if (this.options.onConnect) {
              this._promiseTry(() => this.options.onConnect(client2)).then(
                () => {
                  this._afterConnect(client2, pendingItem, idleListener);
                },
                (hookErr) => {
                  this._clients = this._clients.filter((c) => c !== client2);
                  client2.end(() => {
                    this._pulseQueue();
                    if (!pendingItem.timedOut) {
                      pendingItem.callback(hookErr, void 0, NOOP);
                    }
                  });
                }
              );
              return;
            }
            return this._afterConnect(client2, pendingItem, idleListener);
          }
        });
      }
      _afterConnect(client2, pendingItem, idleListener) {
        if (this.options.maxLifetimeSeconds !== 0) {
          const maxLifetimeTimeout = setTimeout(() => {
            this.log("ending client due to expired lifetime");
            this._expired.add(client2);
            const idleIndex = this._idle.findIndex((idleItem) => idleItem.client === client2);
            if (idleIndex !== -1) {
              this._acquireClient(
                client2,
                new PendingItem((err, client3, clientRelease) => clientRelease()),
                idleListener,
                false
              );
            }
          }, this.options.maxLifetimeSeconds * 1e3);
          maxLifetimeTimeout.unref();
          client2.once("end", () => clearTimeout(maxLifetimeTimeout));
        }
        return this._acquireClient(client2, pendingItem, idleListener, true);
      }
      // acquire a client for a pending work item
      _acquireClient(client2, pendingItem, idleListener, isNew) {
        if (isNew) {
          this.emit("connect", client2);
        }
        this.emit("acquire", client2);
        client2.release = this._releaseOnce(client2, idleListener);
        client2.removeListener("error", idleListener);
        if (!pendingItem.timedOut) {
          if (isNew && this.options.verify) {
            this.options.verify(client2, (err) => {
              if (err) {
                client2.release(err);
                return pendingItem.callback(err, void 0, NOOP);
              }
              pendingItem.callback(void 0, client2, client2.release);
            });
          } else {
            pendingItem.callback(void 0, client2, client2.release);
          }
        } else {
          if (isNew && this.options.verify) {
            this.options.verify(client2, client2.release);
          } else {
            client2.release();
          }
        }
      }
      // returns a function that wraps _release and throws if called more than once
      _releaseOnce(client2, idleListener) {
        let released = false;
        return (err) => {
          if (released) {
            throwOnDoubleRelease();
          }
          released = true;
          this._release(client2, idleListener, err);
        };
      }
      // release a client back to the poll, include an error
      // to remove it from the pool
      _release(client2, idleListener, err) {
        client2.on("error", idleListener);
        client2._poolUseCount = (client2._poolUseCount || 0) + 1;
        this.emit("release", err, client2);
        if (err || this.ending || !client2._queryable || client2._ending || client2._poolUseCount >= this.options.maxUses) {
          if (client2._poolUseCount >= this.options.maxUses) {
            this.log("remove expended client");
          }
          return this._remove(client2, this._pulseQueue.bind(this));
        }
        const isExpired = this._expired.has(client2);
        if (isExpired) {
          this.log("remove expired client");
          this._expired.delete(client2);
          return this._remove(client2, this._pulseQueue.bind(this));
        }
        let tid;
        if (this.options.idleTimeoutMillis && this._isAboveMin()) {
          tid = setTimeout(() => {
            if (this._isAboveMin()) {
              this.log("remove idle client");
              this._remove(client2, this._pulseQueue.bind(this));
            }
          }, this.options.idleTimeoutMillis);
          if (this.options.allowExitOnIdle) {
            tid.unref();
          }
        }
        if (this.options.allowExitOnIdle) {
          client2.unref();
        }
        this._idle.push(new IdleItem(client2, idleListener, tid));
        this._pulseQueue();
      }
      query(text, values, cb) {
        if (typeof text === "function") {
          const response2 = promisify(this.Promise, text);
          setImmediate(function() {
            return response2.callback(new Error("Passing a function as the first parameter to pool.query is not supported"));
          });
          return response2.result;
        }
        if (typeof values === "function") {
          cb = values;
          values = void 0;
        }
        const response = promisify(this.Promise, cb);
        cb = response.callback;
        this.connect((err, client2) => {
          if (err) {
            return cb(err);
          }
          let clientReleased = false;
          const onError = (err2) => {
            if (clientReleased) {
              return;
            }
            clientReleased = true;
            client2.release(err2);
            cb(err2);
          };
          client2.once("error", onError);
          this.log("dispatching query");
          try {
            client2.query(text, values, (err2, res) => {
              this.log("query dispatched");
              client2.removeListener("error", onError);
              if (clientReleased) {
                return;
              }
              clientReleased = true;
              client2.release(err2);
              if (err2) {
                return cb(err2);
              }
              return cb(void 0, res);
            });
          } catch (err2) {
            client2.release(err2);
            return cb(err2);
          }
        });
        return response.result;
      }
      end(cb) {
        this.log("ending");
        if (this.ending) {
          const err = new Error("Called end on pool more than once");
          return cb ? cb(err) : this.Promise.reject(err);
        }
        this.ending = true;
        const promised = promisify(this.Promise, cb);
        this._endCallback = promised.callback;
        this._pulseQueue();
        return promised.result;
      }
      get waitingCount() {
        return this._pendingQueue.length;
      }
      get idleCount() {
        return this._idle.length;
      }
      get expiredCount() {
        return this._clients.reduce((acc, client2) => acc + (this._expired.has(client2) ? 1 : 0), 0);
      }
      get totalCount() {
        return this._clients.length;
      }
    };
    module.exports = Pool2;
  }
});

// node_modules/pg/lib/native/query.js
var require_query2 = __commonJS({
  "node_modules/pg/lib/native/query.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events").EventEmitter;
    var util = __require("util");
    var utils = require_utils();
    var NativeQuery = module.exports = function(config2, values, callback) {
      EventEmitter.call(this);
      config2 = utils.normalizeQueryConfig(config2, values, callback);
      this.text = config2.text;
      this.values = config2.values;
      this.name = config2.name;
      this.queryMode = config2.queryMode;
      this.callback = config2.callback;
      this.state = "new";
      this._arrayMode = config2.rowMode === "array";
      this._emitRowEvents = false;
      this.on(
        "newListener",
        function(event) {
          if (event === "row") this._emitRowEvents = true;
        }.bind(this)
      );
    };
    util.inherits(NativeQuery, EventEmitter);
    var errorFieldMap = {
      sqlState: "code",
      statementPosition: "position",
      messagePrimary: "message",
      context: "where",
      schemaName: "schema",
      tableName: "table",
      columnName: "column",
      dataTypeName: "dataType",
      constraintName: "constraint",
      sourceFile: "file",
      sourceLine: "line",
      sourceFunction: "routine"
    };
    NativeQuery.prototype.handleError = function(err) {
      const fields = this.native.pq.resultErrorFields();
      if (fields) {
        for (const key in fields) {
          const normalizedFieldName = errorFieldMap[key] || key;
          err[normalizedFieldName] = fields[key];
        }
      }
      if (this.callback) {
        this.callback(err);
      } else {
        this.emit("error", err);
      }
      this.state = "error";
    };
    NativeQuery.prototype.then = function(onSuccess, onFailure) {
      return this._getPromise().then(onSuccess, onFailure);
    };
    NativeQuery.prototype.catch = function(callback) {
      return this._getPromise().catch(callback);
    };
    NativeQuery.prototype._getPromise = function() {
      if (this._promise) return this._promise;
      this._promise = new Promise(
        function(resolve, reject) {
          this._once("end", resolve);
          this._once("error", reject);
        }.bind(this)
      );
      return this._promise;
    };
    NativeQuery.prototype.submit = function(client2) {
      this.state = "running";
      const self = this;
      this.native = client2.native;
      client2.native.arrayMode = this._arrayMode;
      let after = function(err, rows, results) {
        client2.native.arrayMode = false;
        setImmediate(function() {
          self.emit("_done");
        });
        if (err) {
          return self.handleError(err);
        }
        if (self._emitRowEvents) {
          if (results.length > 1) {
            rows.forEach((rowOfRows, i) => {
              rowOfRows.forEach((row) => {
                self.emit("row", row, results[i]);
              });
            });
          } else {
            rows.forEach(function(row) {
              self.emit("row", row, results);
            });
          }
        }
        self.state = "end";
        self.emit("end", results);
        if (self.callback) {
          self.callback(null, results);
        }
      };
      if (process.domain) {
        after = process.domain.bind(after);
      }
      if (this.name) {
        if (this.name.length > 63) {
          console.error("Warning! Postgres only supports 63 characters for query names.");
          console.error("You supplied %s (%s)", this.name, this.name.length);
          console.error("This can cause conflicts and silent errors executing queries");
        }
        const values = (this.values || []).map(utils.prepareValue);
        if (client2.namedQueries[this.name]) {
          if (this.text && client2.namedQueries[this.name] !== this.text) {
            const err = new Error(`Prepared statements must be unique - '${this.name}' was used for a different statement`);
            return after(err);
          }
          return client2.native.execute(this.name, values, after);
        }
        return client2.native.prepare(this.name, this.text, values.length, function(err) {
          if (err) return after(err);
          client2.namedQueries[self.name] = self.text;
          return self.native.execute(self.name, values, after);
        });
      } else if (this.values) {
        if (!Array.isArray(this.values)) {
          const err = new Error("Query values must be an array");
          return after(err);
        }
        const vals = this.values.map(utils.prepareValue);
        client2.native.query(this.text, vals, after);
      } else if (this.queryMode === "extended") {
        client2.native.query(this.text, [], after);
      } else {
        client2.native.query(this.text, after);
      }
    };
  }
});

// node_modules/pg/lib/native/client.js
var require_client2 = __commonJS({
  "node_modules/pg/lib/native/client.js"(exports, module) {
    var nodeUtils = __require("util");
    var Native;
    try {
      Native = __require("pg-native");
    } catch (e) {
      throw e;
    }
    var TypeOverrides2 = require_type_overrides();
    var EventEmitter = __require("events").EventEmitter;
    var util = __require("util");
    var ConnectionParameters = require_connection_parameters();
    var NativeQuery = require_query2();
    var queryQueueLengthDeprecationNotice = nodeUtils.deprecate(
      () => {
      },
      "Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead."
    );
    var Client2 = module.exports = function(config2) {
      EventEmitter.call(this);
      config2 = config2 || {};
      this._Promise = config2.Promise || global.Promise;
      this._types = new TypeOverrides2(config2.types);
      this.native = new Native({
        types: this._types
      });
      this._queryQueue = [];
      this._ending = false;
      this._connecting = false;
      this._connected = false;
      this._queryable = true;
      const cp = this.connectionParameters = new ConnectionParameters(config2);
      if (config2.nativeConnectionString) cp.nativeConnectionString = config2.nativeConnectionString;
      this.user = cp.user;
      Object.defineProperty(this, "password", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: cp.password
      });
      this.database = cp.database;
      this.host = cp.host;
      this.port = cp.port;
      this.namedQueries = {};
    };
    Client2.Query = NativeQuery;
    util.inherits(Client2, EventEmitter);
    Client2.prototype._errorAllQueries = function(err) {
      const enqueueError = (query) => {
        process.nextTick(() => {
          query.native = this.native;
          query.handleError(err);
        });
      };
      if (this._hasActiveQuery()) {
        enqueueError(this._activeQuery);
        this._activeQuery = null;
      }
      this._queryQueue.forEach(enqueueError);
      this._queryQueue.length = 0;
    };
    Client2.prototype._connect = function(cb) {
      const self = this;
      if (this._connecting) {
        process.nextTick(() => cb(new Error("Client has already been connected. You cannot reuse a client.")));
        return;
      }
      this._connecting = true;
      this.connectionParameters.getLibpqConnectionString(function(err, conString) {
        if (self.connectionParameters.nativeConnectionString) conString = self.connectionParameters.nativeConnectionString;
        if (err) return cb(err);
        self.native.connect(conString, function(err2) {
          if (err2) {
            self.native.end();
            return cb(err2);
          }
          self._connected = true;
          self.native.on("error", function(err3) {
            self._queryable = false;
            self._errorAllQueries(err3);
            self.emit("error", err3);
          });
          self.native.on("notification", function(msg) {
            self.emit("notification", {
              channel: msg.relname,
              payload: msg.extra
            });
          });
          self.emit("connect");
          self._pulseQueryQueue(true);
          cb(null, this);
        });
      });
    };
    Client2.prototype.connect = function(callback) {
      if (callback) {
        this._connect(callback);
        return;
      }
      return new this._Promise((resolve, reject) => {
        this._connect((error) => {
          if (error) {
            reject(error);
          } else {
            resolve(this);
          }
        });
      });
    };
    Client2.prototype.query = function(config2, values, callback) {
      let query;
      let result;
      let readTimeout;
      let readTimeoutTimer;
      let queryCallback;
      if (config2 === null || config2 === void 0) {
        throw new TypeError("Client was passed a null or undefined query");
      } else if (typeof config2.submit === "function") {
        readTimeout = config2.query_timeout || this.connectionParameters.query_timeout;
        result = query = config2;
        if (typeof values === "function") {
          config2.callback = values;
        }
      } else {
        readTimeout = config2.query_timeout || this.connectionParameters.query_timeout;
        query = new NativeQuery(config2, values, callback);
        if (!query.callback) {
          let resolveOut, rejectOut;
          result = new this._Promise((resolve, reject) => {
            resolveOut = resolve;
            rejectOut = reject;
          }).catch((err) => {
            Error.captureStackTrace(err);
            throw err;
          });
          query.callback = (err, res) => err ? rejectOut(err) : resolveOut(res);
        }
      }
      if (readTimeout) {
        queryCallback = query.callback || (() => {
        });
        readTimeoutTimer = setTimeout(() => {
          const error = new Error("Query read timeout");
          process.nextTick(() => {
            query.handleError(error, this.connection);
          });
          queryCallback(error);
          query.callback = () => {
          };
          const index = this._queryQueue.indexOf(query);
          if (index > -1) {
            this._queryQueue.splice(index, 1);
          }
          this._pulseQueryQueue();
        }, readTimeout);
        query.callback = (err, res) => {
          clearTimeout(readTimeoutTimer);
          queryCallback(err, res);
        };
      }
      if (!this._queryable) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client has encountered a connection error and is not queryable"));
        });
        return result;
      }
      if (this._ending) {
        query.native = this.native;
        process.nextTick(() => {
          query.handleError(new Error("Client was closed and is not queryable"));
        });
        return result;
      }
      if (this._queryQueue.length > 0) {
        queryQueueLengthDeprecationNotice();
      }
      this._queryQueue.push(query);
      this._pulseQueryQueue();
      return result;
    };
    Client2.prototype.end = function(cb) {
      const self = this;
      this._ending = true;
      if (this._connecting && !this._connected) {
        this.once("connect", () => {
          this.end(() => {
          });
        });
      }
      let result;
      if (!cb) {
        result = new this._Promise(function(resolve, reject) {
          cb = (err) => err ? reject(err) : resolve();
        });
      }
      this.native.end(function() {
        self._connected = false;
        self._errorAllQueries(new Error("Connection terminated"));
        process.nextTick(() => {
          self.emit("end");
          if (cb) cb();
        });
      });
      return result;
    };
    Client2.prototype._hasActiveQuery = function() {
      return this._activeQuery && this._activeQuery.state !== "error" && this._activeQuery.state !== "end";
    };
    Client2.prototype._pulseQueryQueue = function(initialConnection) {
      if (!this._connected) {
        return;
      }
      if (this._hasActiveQuery()) {
        return;
      }
      const query = this._queryQueue.shift();
      if (!query) {
        if (!initialConnection) {
          this.emit("drain");
        }
        return;
      }
      this._activeQuery = query;
      query.submit(this);
      const self = this;
      query.once("_done", function() {
        self._pulseQueryQueue();
      });
    };
    Client2.prototype.cancel = function(query) {
      if (this._activeQuery === query) {
        this.native.cancel(function() {
        });
      } else if (this._queryQueue.indexOf(query) !== -1) {
        this._queryQueue.splice(this._queryQueue.indexOf(query), 1);
      }
    };
    Client2.prototype.ref = function() {
    };
    Client2.prototype.unref = function() {
    };
    Client2.prototype.setTypeParser = function(oid, format, parseFn) {
      return this._types.setTypeParser(oid, format, parseFn);
    };
    Client2.prototype.getTypeParser = function(oid, format) {
      return this._types.getTypeParser(oid, format);
    };
    Client2.prototype.isConnected = function() {
      return this._connected;
    };
    Client2.prototype.getTransactionStatus = function() {
      return this.native.getTransactionStatus();
    };
  }
});

// node_modules/pg/lib/native/index.js
var require_native = __commonJS({
  "node_modules/pg/lib/native/index.js"(exports, module) {
    "use strict";
    module.exports = require_client2();
  }
});

// node_modules/pg/lib/index.js
var require_lib2 = __commonJS({
  "node_modules/pg/lib/index.js"(exports, module) {
    "use strict";
    var Client2 = require_client();
    var defaults2 = require_defaults();
    var Connection2 = require_connection();
    var Result2 = require_result();
    var utils = require_utils();
    var Pool2 = require_pg_pool();
    var TypeOverrides2 = require_type_overrides();
    var { DatabaseError: DatabaseError2 } = require_dist();
    var { escapeIdentifier: escapeIdentifier2, escapeLiteral: escapeLiteral2 } = require_utils();
    var poolFactory = (Client3) => {
      return class BoundPool extends Pool2 {
        constructor(options) {
          super(options, Client3);
        }
      };
    };
    var PG = function(clientConstructor2) {
      this.defaults = defaults2;
      this.Client = clientConstructor2;
      this.Query = this.Client.Query;
      this.Pool = poolFactory(this.Client);
      this._pools = [];
      this.Connection = Connection2;
      this.types = require_pg_types();
      this.DatabaseError = DatabaseError2;
      this.TypeOverrides = TypeOverrides2;
      this.escapeIdentifier = escapeIdentifier2;
      this.escapeLiteral = escapeLiteral2;
      this.Result = Result2;
      this.utils = utils;
    };
    var clientConstructor = Client2;
    var forceNative = false;
    try {
      forceNative = !!process.env.NODE_PG_FORCE_NATIVE;
    } catch {
    }
    if (forceNative) {
      clientConstructor = require_native();
    }
    module.exports = new PG(clientConstructor);
    Object.defineProperty(module.exports, "native", {
      configurable: true,
      enumerable: false,
      get() {
        let native = null;
        try {
          native = new PG(require_native());
        } catch (err) {
          if (err.code !== "MODULE_NOT_FOUND") {
            throw err;
          }
        }
        Object.defineProperty(module.exports, "native", {
          value: native
        });
        return native;
      }
    });
  }
});

// node_modules/postgres-array/index.js
var require_postgres_array2 = __commonJS({
  "node_modules/postgres-array/index.js"(exports) {
    "use strict";
    var BACKSLASH = "\\";
    var DQUOT = '"';
    var LBRACE = "{";
    var RBRACE = "}";
    var LBRACKET = "[";
    var EQUALS = "=";
    var COMMA = ",";
    var NULL_STRING = "NULL";
    function makeParseArrayWithTransform(transform) {
      const haveTransform = transform != null;
      return function parseArray3(str2) {
        const rbraceIndex = str2.length - 1;
        if (rbraceIndex === 1) {
          return [];
        }
        if (str2[rbraceIndex] !== RBRACE) {
          throw new Error("Invalid array text - must end with }");
        }
        let position = 0;
        if (str2[position] === LBRACKET) {
          position = str2.indexOf(EQUALS) + 1;
        }
        if (str2[position++] !== LBRACE) {
          throw new Error("Invalid array text - must start with {");
        }
        const output = [];
        let current = output;
        const stack = [];
        let currentStringStart = position;
        let currentString = "";
        let expectValue = true;
        for (; position < rbraceIndex; ++position) {
          let char = str2[position];
          if (char === DQUOT) {
            currentStringStart = ++position;
            let dquot = str2.indexOf(DQUOT, currentStringStart);
            let backSlash = str2.indexOf(BACKSLASH, currentStringStart);
            while (backSlash !== -1 && backSlash < dquot) {
              position = backSlash;
              const part2 = str2.slice(currentStringStart, position);
              currentString += part2;
              currentStringStart = ++position;
              if (dquot === position++) {
                dquot = str2.indexOf(DQUOT, position);
              }
              backSlash = str2.indexOf(BACKSLASH, position);
            }
            position = dquot;
            const part = str2.slice(currentStringStart, position);
            currentString += part;
            current.push(haveTransform ? transform(currentString) : currentString);
            currentString = "";
            expectValue = false;
          } else if (char === LBRACE) {
            const newArray = [];
            current.push(newArray);
            stack.push(current);
            current = newArray;
            currentStringStart = position + 1;
            expectValue = true;
          } else if (char === COMMA) {
            expectValue = true;
          } else if (char === RBRACE) {
            expectValue = false;
            const arr = stack.pop();
            if (arr === void 0) {
              throw new Error("Invalid array text - too many '}'");
            }
            current = arr;
          } else if (expectValue) {
            currentStringStart = position;
            while ((char = str2[position]) !== COMMA && char !== RBRACE && position < rbraceIndex) {
              ++position;
            }
            const part = str2.slice(currentStringStart, position--);
            current.push(
              part === NULL_STRING ? null : haveTransform ? transform(part) : part
            );
            expectValue = false;
          } else {
            throw new Error("Was expecting delimeter");
          }
        }
        return output;
      };
    }
    var parseArray2 = makeParseArrayWithTransform();
    exports.parse = (source, transform) => transform != null ? makeParseArrayWithTransform(transform)(source) : parseArray2(source);
  }
});

// scripts/migrate-json.ts
import { mkdirSync as mkdirSync2, writeFileSync } from "node:fs";
import path4 from "node:path";

// src/generated/prisma/client.ts
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// src/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.8.0",
  "engineVersion": "3c6e192761c0362d496ed980de936e2f3cebcd3a",
  "activeProvider": "postgresql",
  "inlineSchema": '// Sch\xE9ma PostgreSQL de Gedify (int\xE9gration progressive, sans casser le JSON).\n// Chaque table a des colonnes \xAB requ\xEAtables \xBB + une colonne `raw Json` qui\n// conserve l\'objet JSON d\'origine INT\xC9GRAL \u2192 migration sans perte de donn\xE9es.\n// Prisma 7 : client TypeScript + driver adapter (pg), pas de moteur natif runtime.\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../src/generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\n/**\n * \u2500\u2500 Documents & taxonomies \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Document {\n  id               Int       @id\n  title            String?\n  content          String?   @db.Text\n  created          DateTime?\n  createdDate      String?   @map("created_date")\n  added            DateTime?\n  modified         DateTime?\n  correspondentId  Int?      @map("correspondent_id")\n  documentTypeId   Int?      @map("document_type_id")\n  storagePath      String?   @map("storage_path")\n  mimeType         String?   @map("mime_type")\n  checksum         String?\n  storedFilename   String?   @map("stored_filename")\n  originalFileName String?   @map("original_file_name")\n  pageCount        Int?      @map("page_count")\n  deleted          Boolean   @default(false)\n  deletedAt        DateTime? @map("deleted_at")\n  raw              Json?\n  createdAt        DateTime  @default(now()) @map("created_at")\n  updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@index([correspondentId])\n  @@index([documentTypeId])\n  @@index([deleted])\n  @@index([checksum])\n  @@map("documents")\n}\n\nmodel DocumentFile {\n  id         String  @id\n  documentId Int     @map("document_id")\n  kind       String  @default("original") // original | thumbnail\n  filename   String?\n  mimeType   String? @map("mime_type")\n  sizeBytes  Int?    @map("size_bytes")\n  raw        Json?\n\n  @@index([documentId])\n  @@map("document_files")\n}\n\nmodel DocumentVersion {\n  id         String   @id\n  documentId Int      @map("document_id")\n  label      String?\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@index([documentId])\n  @@map("document_versions")\n}\n\nmodel DocumentOcr {\n  documentId Int     @id @map("document_id")\n  content    String? @db.Text\n  raw        Json?\n\n  @@map("document_ocr")\n}\n\nmodel DocumentAiAnalysis {\n  id         String    @id\n  documentId Int       @map("document_id")\n  summary    String?   @db.Text\n  confidence String?\n  source     String?\n  analyzedAt DateTime? @map("analyzed_at")\n  raw        Json?\n  createdAt  DateTime  @default(now()) @map("created_at")\n\n  @@index([documentId])\n  @@map("document_ai_analyses")\n}\n\nmodel DocumentAiSuggestion {\n  id             String   @id\n  documentId     Int?     @map("document_id")\n  analysisId     String?  @map("analysis_id")\n  suggestionType String?  @map("suggestion_type")\n  fieldName      String?  @map("field_name")\n  suggestedValue String?  @map("suggested_value") @db.Text\n  confidence     String?\n  source         String?\n  applied        Boolean  @default(false)\n  rawPayload     Json?    @map("raw_payload")\n  createdAt      DateTime @default(now()) @map("created_at")\n  updatedAt      DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@index([documentId])\n  @@index([analysisId])\n  @@map("document_ai_suggestions")\n}\n\nmodel Tag {\n  id        Int     @id\n  name      String?\n  slug      String?\n  color     String?\n  textColor String? @map("text_color")\n  raw       Json?\n\n  @@map("tags")\n}\n\nmodel DocumentTag {\n  documentId Int @map("document_id")\n  tagId      Int @map("tag_id")\n\n  @@id([documentId, tagId])\n  @@index([tagId])\n  @@map("document_tags")\n}\n\nmodel DocumentType {\n  id   Int     @id\n  name String?\n  slug String?\n  raw  Json?\n\n  @@map("document_types")\n}\n\nmodel Correspondent {\n  id   Int     @id\n  name String?\n  slug String?\n  raw  Json?\n\n  @@map("correspondents")\n}\n\nmodel DocumentCorrespondent {\n  documentId      Int     @map("document_id")\n  correspondentId Int     @map("correspondent_id")\n  role            String? // primary | secondary\n\n  @@id([documentId, correspondentId])\n  @@index([correspondentId])\n  @@map("document_correspondents")\n}\n\n/**\n * \u2500\u2500 Dossiers / projets \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Folder {\n  id        String   @id\n  parentId  String?  @map("parent_id")\n  name      String?\n  slug      String?\n  color     String?\n  category  String?\n  status    String?\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@index([parentId])\n  @@map("folders")\n}\n\nmodel FolderDocument {\n  folderId   String @map("folder_id")\n  documentId Int    @map("document_id")\n\n  @@id([folderId, documentId])\n  @@index([documentId])\n  @@map("folder_documents")\n}\n\n/**\n * \u2500\u2500 Finances \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel BudgetEntry {\n  id               String   @id\n  kind             String?\n  direction        String?\n  label            String?\n  amount           Float?\n  amountPaid       Float?   @map("amount_paid")\n  dueDate          String?  @map("due_date")\n  status           String?\n  categoryId       String?  @map("category_id")\n  categoryName     String?  @map("category_name")\n  sourceDocumentId Int?     @map("source_document_id")\n  raw              Json?\n  createdAt        DateTime @default(now()) @map("created_at")\n  updatedAt        DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@index([status])\n  @@index([direction])\n  @@index([sourceDocumentId])\n  @@map("budget_entries")\n}\n\nmodel BudgetPayment {\n  id            String  @id\n  budgetEntryId String  @map("budget_entry_id")\n  amount        Float?\n  date          String?\n  account       String?\n  raw           Json?\n\n  @@index([budgetEntryId])\n  @@map("budget_payments")\n}\n\n/**\n * \u2500\u2500 Mails \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Mail {\n  id             String    @id\n  accountId      String?   @map("account_id")\n  messageId      String?   @map("message_id")\n  threadId       String?   @map("thread_id")\n  fromAddr       String?   @map("from_addr")\n  toAddr         String?   @map("to_addr")\n  subject        String?\n  date           DateTime?\n  snippet        String?   @db.Text\n  body           String?   @db.Text\n  hasAttachments Boolean   @default(false) @map("has_attachments")\n  raw            Json?\n\n  @@index([accountId])\n  @@index([threadId])\n  @@map("mails")\n}\n\nmodel MailAttachment {\n  id       String  @id\n  mailId   String? @map("mail_id")\n  threadId String? @map("thread_id")\n  filename String?\n  mimeType String? @map("mime_type")\n  raw      Json?\n\n  @@index([mailId])\n  @@map("mail_attachments")\n}\n\nmodel MailDocumentLink {\n  id         String   @id\n  accountId  String?  @map("account_id")\n  mailId     String?  @map("mail_id")\n  threadId   String?  @map("thread_id")\n  documentId Int?     @map("document_id")\n  filename   String?\n  status     String?\n  kind       String? // attachment | ged-link\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@index([threadId])\n  @@index([documentId])\n  @@map("mail_document_links")\n}\n\n/**\n * \u2500\u2500 Rappels / t\xE2ches \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Reminder {\n  id              String    @id\n  title           String?\n  remindAt        DateTime? @map("remind_at")\n  status          String?\n  documentId      Int?      @map("document_id")\n  financialItemId String?   @map("financial_item_id")\n  raw             Json?\n  createdAt       DateTime  @default(now()) @map("created_at")\n\n  @@index([status])\n  @@index([documentId])\n  @@map("reminders")\n}\n\nmodel Task {\n  id        String   @id\n  title     String?\n  status    String?\n  priority  String?\n  dueDate   String?  @map("due_date")\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n\n  @@index([status])\n  @@map("tasks")\n}\n\n/**\n * \u2500\u2500 Divers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Signature {\n  id         String   @id\n  scope      String? // document | email | writer\n  documentId Int?     @map("document_id")\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@index([documentId])\n  @@map("signatures")\n}\n\nmodel LearnedTemplate {\n  id        String   @id\n  label     String?\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n\n  @@map("learned_templates")\n}\n\nmodel AssistantActionLog {\n  id         String   @id @default(cuid())\n  type       String?\n  message    String?  @db.Text\n  documentId Int?     @map("document_id")\n  user       String?\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@map("assistant_action_logs")\n}\n\nmodel ActivityLog {\n  id         String   @id\n  level      String?\n  source     String?\n  message    String?  @db.Text\n  documentId Int?     @map("document_id")\n  projectId  String?  @map("project_id")\n  user       String?\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@index([documentId])\n  @@map("activity_logs")\n}\n\nmodel User {\n  id           Int       @id\n  username     String    @unique\n  email        String?   @unique\n  passwordHash String?   @map("password_hash")\n  isSuperuser  Boolean   @default(false) @map("is_superuser")\n  isActive     Boolean   @default(true) @map("is_active")\n  metadata     Json?\n  createdAt    DateTime  @default(now()) @map("created_at")\n  updatedAt    DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt    DateTime? @map("deleted_at")\n\n  @@map("users")\n}\n\nmodel Counter {\n  name      String   @id\n  value     Int      @default(0)\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("counters")\n}\n\nmodel DocumentTitleOverride {\n  documentId Int      @id @map("document_id")\n  title      String?\n  source     String?\n  metadata   Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("document_title_overrides")\n}\n\nmodel EmailContact {\n  id          String    @id\n  name        String?\n  email       String?\n  displayName String?   @map("display_name")\n  source      String?\n  lastSeenAt  DateTime? @map("last_seen_at")\n  metadata    Json?\n  createdAt   DateTime  @default(now()) @map("created_at")\n  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt   DateTime? @map("deleted_at")\n\n  @@index([email])\n  @@map("email_contacts")\n}\n\nmodel MailAccount {\n  id          String    @id\n  provider    String?\n  email       String?\n  displayName String?   @map("display_name")\n  status      String?\n  scopes      Json?\n  metadata    Json?\n  createdAt   DateTime  @default(now()) @map("created_at")\n  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt   DateTime? @map("deleted_at")\n\n  @@map("mail_accounts")\n}\n\nmodel MailOauthToken {\n  id                    String    @id\n  accountId             String?   @map("account_id")\n  provider              String?\n  email                 String?\n  accessTokenEncrypted  String?   @map("access_token_encrypted") @db.Text\n  refreshTokenEncrypted String?   @map("refresh_token_encrypted") @db.Text\n  expiryDate            DateTime? @map("expiry_date")\n  scope                 String?   @db.Text\n  tokenType             String?   @map("token_type")\n  metadata              Json?\n  createdAt             DateTime  @default(now()) @map("created_at")\n  updatedAt             DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt             DateTime? @map("deleted_at")\n\n  @@index([accountId])\n  @@map("mail_oauth_tokens")\n}\n\nmodel SavedSignature {\n  id        String    @id\n  label     String?\n  type      String?\n  imagePath String?   @map("image_path")\n  imageData String?   @map("image_data") @db.Text\n  width     Int?\n  height    Int?\n  metadata  Json?\n  createdAt DateTime  @default(now()) @map("created_at")\n  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt DateTime? @map("deleted_at")\n\n  @@map("saved_signatures")\n}\n\nmodel HiddenSender {\n  id        String    @id\n  email     String?\n  domain    String?\n  reason    String?\n  metadata  Json?\n  createdAt DateTime  @default(now()) @map("created_at")\n  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt DateTime? @map("deleted_at")\n\n  @@index([email])\n  @@map("hidden_senders")\n}\n\nmodel CustomField {\n  id        Int       @id\n  name      String?\n  label     String?\n  type      String?\n  options   Json?\n  required  Boolean   @default(false)\n  metadata  Json?\n  createdAt DateTime  @default(now()) @map("created_at")\n  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt DateTime? @map("deleted_at")\n\n  @@map("custom_fields")\n}\n\nmodel Setting {\n  key   String @id\n  value Json\n\n  @@map("settings")\n}\n\n/**\n * \u2500\u2500 Multi-tenant (FONDATION \u2014 Phase 1) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n * Tables additives, INACTIVES tant que MULTI_TENANT n\'est pas activ\xE9 (env).\n * Aucun impact sur main / Synology / local : non utilis\xE9es en mode mono-tenant.\n * On NE branche PAS encore `tenant_id` sur les tables m\xE9tier (\xE9tape ult\xE9rieure).\n */\n\nmodel Tenant {\n  id        String   @id // slug = id (ex. "azserver-staging")\n  name      String?\n  slug      String   @unique\n  plan      String? // internal | free | pro | enterprise\n  status    String? // active | suspended | archived\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("tenants")\n}\n\nmodel Membership {\n  id        String   @id // `${tenantId}:${userId}`\n  userId    Int      @map("user_id")\n  tenantId  String   @map("tenant_id")\n  role      String // owner | admin | member | viewer\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@unique([tenantId, userId])\n  @@index([userId])\n  @@index([tenantId])\n  @@map("memberships")\n}\n\nmodel TenantSettings {\n  id                 String   @id // = tenantId (une ligne par tenant)\n  tenantId           String   @unique @map("tenant_id")\n  maxUsers           Int?     @map("max_users")\n  maxDocuments       Int?     @map("max_documents")\n  maxStorageMb       Int?     @map("max_storage_mb")\n  aiEnabled          Boolean  @default(true) @map("ai_enabled")\n  ocrEnabled         Boolean  @default(true) @map("ocr_enabled")\n  emailImportEnabled Boolean  @default(true) @map("email_import_enabled")\n  onlyofficeEnabled  Boolean  @default(true) @map("onlyoffice_enabled")\n  raw                Json?\n  createdAt          DateTime @default(now()) @map("created_at")\n  updatedAt          DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("tenant_settings")\n}\n',
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config.runtimeDataModel = JSON.parse('{"models":{"Document":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"title","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"created","kind":"scalar","type":"DateTime"},{"name":"createdDate","kind":"scalar","type":"String","dbName":"created_date"},{"name":"added","kind":"scalar","type":"DateTime"},{"name":"modified","kind":"scalar","type":"DateTime"},{"name":"correspondentId","kind":"scalar","type":"Int","dbName":"correspondent_id"},{"name":"documentTypeId","kind":"scalar","type":"Int","dbName":"document_type_id"},{"name":"storagePath","kind":"scalar","type":"String","dbName":"storage_path"},{"name":"mimeType","kind":"scalar","type":"String","dbName":"mime_type"},{"name":"checksum","kind":"scalar","type":"String"},{"name":"storedFilename","kind":"scalar","type":"String","dbName":"stored_filename"},{"name":"originalFileName","kind":"scalar","type":"String","dbName":"original_file_name"},{"name":"pageCount","kind":"scalar","type":"Int","dbName":"page_count"},{"name":"deleted","kind":"scalar","type":"Boolean"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"documents"},"DocumentFile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"kind","kind":"scalar","type":"String"},{"name":"filename","kind":"scalar","type":"String"},{"name":"mimeType","kind":"scalar","type":"String","dbName":"mime_type"},{"name":"sizeBytes","kind":"scalar","type":"Int","dbName":"size_bytes"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"document_files"},"DocumentVersion":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"label","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"document_versions"},"DocumentOcr":{"fields":[{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"content","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"document_ocr"},"DocumentAiAnalysis":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"summary","kind":"scalar","type":"String"},{"name":"confidence","kind":"scalar","type":"String"},{"name":"source","kind":"scalar","type":"String"},{"name":"analyzedAt","kind":"scalar","type":"DateTime","dbName":"analyzed_at"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"document_ai_analyses"},"DocumentAiSuggestion":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"analysisId","kind":"scalar","type":"String","dbName":"analysis_id"},{"name":"suggestionType","kind":"scalar","type":"String","dbName":"suggestion_type"},{"name":"fieldName","kind":"scalar","type":"String","dbName":"field_name"},{"name":"suggestedValue","kind":"scalar","type":"String","dbName":"suggested_value"},{"name":"confidence","kind":"scalar","type":"String"},{"name":"source","kind":"scalar","type":"String"},{"name":"applied","kind":"scalar","type":"Boolean"},{"name":"rawPayload","kind":"scalar","type":"Json","dbName":"raw_payload"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"document_ai_suggestions"},"Tag":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"color","kind":"scalar","type":"String"},{"name":"textColor","kind":"scalar","type":"String","dbName":"text_color"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"tags"},"DocumentTag":{"fields":[{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"tagId","kind":"scalar","type":"Int","dbName":"tag_id"}],"dbName":"document_tags"},"DocumentType":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"document_types"},"Correspondent":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"correspondents"},"DocumentCorrespondent":{"fields":[{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"correspondentId","kind":"scalar","type":"Int","dbName":"correspondent_id"},{"name":"role","kind":"scalar","type":"String"}],"dbName":"document_correspondents"},"Folder":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"parentId","kind":"scalar","type":"String","dbName":"parent_id"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"color","kind":"scalar","type":"String"},{"name":"category","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"folders"},"FolderDocument":{"fields":[{"name":"folderId","kind":"scalar","type":"String","dbName":"folder_id"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"}],"dbName":"folder_documents"},"BudgetEntry":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"kind","kind":"scalar","type":"String"},{"name":"direction","kind":"scalar","type":"String"},{"name":"label","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Float"},{"name":"amountPaid","kind":"scalar","type":"Float","dbName":"amount_paid"},{"name":"dueDate","kind":"scalar","type":"String","dbName":"due_date"},{"name":"status","kind":"scalar","type":"String"},{"name":"categoryId","kind":"scalar","type":"String","dbName":"category_id"},{"name":"categoryName","kind":"scalar","type":"String","dbName":"category_name"},{"name":"sourceDocumentId","kind":"scalar","type":"Int","dbName":"source_document_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"budget_entries"},"BudgetPayment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"budgetEntryId","kind":"scalar","type":"String","dbName":"budget_entry_id"},{"name":"amount","kind":"scalar","type":"Float"},{"name":"date","kind":"scalar","type":"String"},{"name":"account","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"budget_payments"},"Mail":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String","dbName":"account_id"},{"name":"messageId","kind":"scalar","type":"String","dbName":"message_id"},{"name":"threadId","kind":"scalar","type":"String","dbName":"thread_id"},{"name":"fromAddr","kind":"scalar","type":"String","dbName":"from_addr"},{"name":"toAddr","kind":"scalar","type":"String","dbName":"to_addr"},{"name":"subject","kind":"scalar","type":"String"},{"name":"date","kind":"scalar","type":"DateTime"},{"name":"snippet","kind":"scalar","type":"String"},{"name":"body","kind":"scalar","type":"String"},{"name":"hasAttachments","kind":"scalar","type":"Boolean","dbName":"has_attachments"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"mails"},"MailAttachment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"mailId","kind":"scalar","type":"String","dbName":"mail_id"},{"name":"threadId","kind":"scalar","type":"String","dbName":"thread_id"},{"name":"filename","kind":"scalar","type":"String"},{"name":"mimeType","kind":"scalar","type":"String","dbName":"mime_type"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"mail_attachments"},"MailDocumentLink":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String","dbName":"account_id"},{"name":"mailId","kind":"scalar","type":"String","dbName":"mail_id"},{"name":"threadId","kind":"scalar","type":"String","dbName":"thread_id"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"filename","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"kind","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"mail_document_links"},"Reminder":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"remindAt","kind":"scalar","type":"DateTime","dbName":"remind_at"},{"name":"status","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"financialItemId","kind":"scalar","type":"String","dbName":"financial_item_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"reminders"},"Task":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"priority","kind":"scalar","type":"String"},{"name":"dueDate","kind":"scalar","type":"String","dbName":"due_date"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"tasks"},"Signature":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"scope","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"signatures"},"LearnedTemplate":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"label","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"learned_templates"},"AssistantActionLog":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"user","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"assistant_action_logs"},"ActivityLog":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"level","kind":"scalar","type":"String"},{"name":"source","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"projectId","kind":"scalar","type":"String","dbName":"project_id"},{"name":"user","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"activity_logs"},"User":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"username","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"passwordHash","kind":"scalar","type":"String","dbName":"password_hash"},{"name":"isSuperuser","kind":"scalar","type":"Boolean","dbName":"is_superuser"},{"name":"isActive","kind":"scalar","type":"Boolean","dbName":"is_active"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"users"},"Counter":{"fields":[{"name":"name","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"counters"},"DocumentTitleOverride":{"fields":[{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"title","kind":"scalar","type":"String"},{"name":"source","kind":"scalar","type":"String"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"document_title_overrides"},"EmailContact":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"displayName","kind":"scalar","type":"String","dbName":"display_name"},{"name":"source","kind":"scalar","type":"String"},{"name":"lastSeenAt","kind":"scalar","type":"DateTime","dbName":"last_seen_at"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"email_contacts"},"MailAccount":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"provider","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"displayName","kind":"scalar","type":"String","dbName":"display_name"},{"name":"status","kind":"scalar","type":"String"},{"name":"scopes","kind":"scalar","type":"Json"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"mail_accounts"},"MailOauthToken":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String","dbName":"account_id"},{"name":"provider","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"accessTokenEncrypted","kind":"scalar","type":"String","dbName":"access_token_encrypted"},{"name":"refreshTokenEncrypted","kind":"scalar","type":"String","dbName":"refresh_token_encrypted"},{"name":"expiryDate","kind":"scalar","type":"DateTime","dbName":"expiry_date"},{"name":"scope","kind":"scalar","type":"String"},{"name":"tokenType","kind":"scalar","type":"String","dbName":"token_type"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"mail_oauth_tokens"},"SavedSignature":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"label","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"imagePath","kind":"scalar","type":"String","dbName":"image_path"},{"name":"imageData","kind":"scalar","type":"String","dbName":"image_data"},{"name":"width","kind":"scalar","type":"Int"},{"name":"height","kind":"scalar","type":"Int"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"saved_signatures"},"HiddenSender":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"domain","kind":"scalar","type":"String"},{"name":"reason","kind":"scalar","type":"String"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"hidden_senders"},"CustomField":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"name","kind":"scalar","type":"String"},{"name":"label","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"options","kind":"scalar","type":"Json"},{"name":"required","kind":"scalar","type":"Boolean"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"custom_fields"},"Setting":{"fields":[{"name":"key","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"Json"}],"dbName":"settings"},"Tenant":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"plan","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"tenants"},"Membership":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"Int","dbName":"user_id"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"role","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"memberships"},"TenantSettings":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"maxUsers","kind":"scalar","type":"Int","dbName":"max_users"},{"name":"maxDocuments","kind":"scalar","type":"Int","dbName":"max_documents"},{"name":"maxStorageMb","kind":"scalar","type":"Int","dbName":"max_storage_mb"},{"name":"aiEnabled","kind":"scalar","type":"Boolean","dbName":"ai_enabled"},{"name":"ocrEnabled","kind":"scalar","type":"Boolean","dbName":"ocr_enabled"},{"name":"emailImportEnabled","kind":"scalar","type":"Boolean","dbName":"email_import_enabled"},{"name":"onlyofficeEnabled","kind":"scalar","type":"Boolean","dbName":"onlyoffice_enabled"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"tenant_settings"}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","Document.findUnique","Document.findUniqueOrThrow","orderBy","cursor","Document.findFirst","Document.findFirstOrThrow","Document.findMany","data","Document.createOne","Document.createMany","Document.createManyAndReturn","Document.updateOne","Document.updateMany","Document.updateManyAndReturn","create","update","Document.upsertOne","Document.deleteOne","Document.deleteMany","having","_count","_avg","_sum","_min","_max","Document.groupBy","Document.aggregate","DocumentFile.findUnique","DocumentFile.findUniqueOrThrow","DocumentFile.findFirst","DocumentFile.findFirstOrThrow","DocumentFile.findMany","DocumentFile.createOne","DocumentFile.createMany","DocumentFile.createManyAndReturn","DocumentFile.updateOne","DocumentFile.updateMany","DocumentFile.updateManyAndReturn","DocumentFile.upsertOne","DocumentFile.deleteOne","DocumentFile.deleteMany","DocumentFile.groupBy","DocumentFile.aggregate","DocumentVersion.findUnique","DocumentVersion.findUniqueOrThrow","DocumentVersion.findFirst","DocumentVersion.findFirstOrThrow","DocumentVersion.findMany","DocumentVersion.createOne","DocumentVersion.createMany","DocumentVersion.createManyAndReturn","DocumentVersion.updateOne","DocumentVersion.updateMany","DocumentVersion.updateManyAndReturn","DocumentVersion.upsertOne","DocumentVersion.deleteOne","DocumentVersion.deleteMany","DocumentVersion.groupBy","DocumentVersion.aggregate","DocumentOcr.findUnique","DocumentOcr.findUniqueOrThrow","DocumentOcr.findFirst","DocumentOcr.findFirstOrThrow","DocumentOcr.findMany","DocumentOcr.createOne","DocumentOcr.createMany","DocumentOcr.createManyAndReturn","DocumentOcr.updateOne","DocumentOcr.updateMany","DocumentOcr.updateManyAndReturn","DocumentOcr.upsertOne","DocumentOcr.deleteOne","DocumentOcr.deleteMany","DocumentOcr.groupBy","DocumentOcr.aggregate","DocumentAiAnalysis.findUnique","DocumentAiAnalysis.findUniqueOrThrow","DocumentAiAnalysis.findFirst","DocumentAiAnalysis.findFirstOrThrow","DocumentAiAnalysis.findMany","DocumentAiAnalysis.createOne","DocumentAiAnalysis.createMany","DocumentAiAnalysis.createManyAndReturn","DocumentAiAnalysis.updateOne","DocumentAiAnalysis.updateMany","DocumentAiAnalysis.updateManyAndReturn","DocumentAiAnalysis.upsertOne","DocumentAiAnalysis.deleteOne","DocumentAiAnalysis.deleteMany","DocumentAiAnalysis.groupBy","DocumentAiAnalysis.aggregate","DocumentAiSuggestion.findUnique","DocumentAiSuggestion.findUniqueOrThrow","DocumentAiSuggestion.findFirst","DocumentAiSuggestion.findFirstOrThrow","DocumentAiSuggestion.findMany","DocumentAiSuggestion.createOne","DocumentAiSuggestion.createMany","DocumentAiSuggestion.createManyAndReturn","DocumentAiSuggestion.updateOne","DocumentAiSuggestion.updateMany","DocumentAiSuggestion.updateManyAndReturn","DocumentAiSuggestion.upsertOne","DocumentAiSuggestion.deleteOne","DocumentAiSuggestion.deleteMany","DocumentAiSuggestion.groupBy","DocumentAiSuggestion.aggregate","Tag.findUnique","Tag.findUniqueOrThrow","Tag.findFirst","Tag.findFirstOrThrow","Tag.findMany","Tag.createOne","Tag.createMany","Tag.createManyAndReturn","Tag.updateOne","Tag.updateMany","Tag.updateManyAndReturn","Tag.upsertOne","Tag.deleteOne","Tag.deleteMany","Tag.groupBy","Tag.aggregate","DocumentTag.findUnique","DocumentTag.findUniqueOrThrow","DocumentTag.findFirst","DocumentTag.findFirstOrThrow","DocumentTag.findMany","DocumentTag.createOne","DocumentTag.createMany","DocumentTag.createManyAndReturn","DocumentTag.updateOne","DocumentTag.updateMany","DocumentTag.updateManyAndReturn","DocumentTag.upsertOne","DocumentTag.deleteOne","DocumentTag.deleteMany","DocumentTag.groupBy","DocumentTag.aggregate","DocumentType.findUnique","DocumentType.findUniqueOrThrow","DocumentType.findFirst","DocumentType.findFirstOrThrow","DocumentType.findMany","DocumentType.createOne","DocumentType.createMany","DocumentType.createManyAndReturn","DocumentType.updateOne","DocumentType.updateMany","DocumentType.updateManyAndReturn","DocumentType.upsertOne","DocumentType.deleteOne","DocumentType.deleteMany","DocumentType.groupBy","DocumentType.aggregate","Correspondent.findUnique","Correspondent.findUniqueOrThrow","Correspondent.findFirst","Correspondent.findFirstOrThrow","Correspondent.findMany","Correspondent.createOne","Correspondent.createMany","Correspondent.createManyAndReturn","Correspondent.updateOne","Correspondent.updateMany","Correspondent.updateManyAndReturn","Correspondent.upsertOne","Correspondent.deleteOne","Correspondent.deleteMany","Correspondent.groupBy","Correspondent.aggregate","DocumentCorrespondent.findUnique","DocumentCorrespondent.findUniqueOrThrow","DocumentCorrespondent.findFirst","DocumentCorrespondent.findFirstOrThrow","DocumentCorrespondent.findMany","DocumentCorrespondent.createOne","DocumentCorrespondent.createMany","DocumentCorrespondent.createManyAndReturn","DocumentCorrespondent.updateOne","DocumentCorrespondent.updateMany","DocumentCorrespondent.updateManyAndReturn","DocumentCorrespondent.upsertOne","DocumentCorrespondent.deleteOne","DocumentCorrespondent.deleteMany","DocumentCorrespondent.groupBy","DocumentCorrespondent.aggregate","Folder.findUnique","Folder.findUniqueOrThrow","Folder.findFirst","Folder.findFirstOrThrow","Folder.findMany","Folder.createOne","Folder.createMany","Folder.createManyAndReturn","Folder.updateOne","Folder.updateMany","Folder.updateManyAndReturn","Folder.upsertOne","Folder.deleteOne","Folder.deleteMany","Folder.groupBy","Folder.aggregate","FolderDocument.findUnique","FolderDocument.findUniqueOrThrow","FolderDocument.findFirst","FolderDocument.findFirstOrThrow","FolderDocument.findMany","FolderDocument.createOne","FolderDocument.createMany","FolderDocument.createManyAndReturn","FolderDocument.updateOne","FolderDocument.updateMany","FolderDocument.updateManyAndReturn","FolderDocument.upsertOne","FolderDocument.deleteOne","FolderDocument.deleteMany","FolderDocument.groupBy","FolderDocument.aggregate","BudgetEntry.findUnique","BudgetEntry.findUniqueOrThrow","BudgetEntry.findFirst","BudgetEntry.findFirstOrThrow","BudgetEntry.findMany","BudgetEntry.createOne","BudgetEntry.createMany","BudgetEntry.createManyAndReturn","BudgetEntry.updateOne","BudgetEntry.updateMany","BudgetEntry.updateManyAndReturn","BudgetEntry.upsertOne","BudgetEntry.deleteOne","BudgetEntry.deleteMany","BudgetEntry.groupBy","BudgetEntry.aggregate","BudgetPayment.findUnique","BudgetPayment.findUniqueOrThrow","BudgetPayment.findFirst","BudgetPayment.findFirstOrThrow","BudgetPayment.findMany","BudgetPayment.createOne","BudgetPayment.createMany","BudgetPayment.createManyAndReturn","BudgetPayment.updateOne","BudgetPayment.updateMany","BudgetPayment.updateManyAndReturn","BudgetPayment.upsertOne","BudgetPayment.deleteOne","BudgetPayment.deleteMany","BudgetPayment.groupBy","BudgetPayment.aggregate","Mail.findUnique","Mail.findUniqueOrThrow","Mail.findFirst","Mail.findFirstOrThrow","Mail.findMany","Mail.createOne","Mail.createMany","Mail.createManyAndReturn","Mail.updateOne","Mail.updateMany","Mail.updateManyAndReturn","Mail.upsertOne","Mail.deleteOne","Mail.deleteMany","Mail.groupBy","Mail.aggregate","MailAttachment.findUnique","MailAttachment.findUniqueOrThrow","MailAttachment.findFirst","MailAttachment.findFirstOrThrow","MailAttachment.findMany","MailAttachment.createOne","MailAttachment.createMany","MailAttachment.createManyAndReturn","MailAttachment.updateOne","MailAttachment.updateMany","MailAttachment.updateManyAndReturn","MailAttachment.upsertOne","MailAttachment.deleteOne","MailAttachment.deleteMany","MailAttachment.groupBy","MailAttachment.aggregate","MailDocumentLink.findUnique","MailDocumentLink.findUniqueOrThrow","MailDocumentLink.findFirst","MailDocumentLink.findFirstOrThrow","MailDocumentLink.findMany","MailDocumentLink.createOne","MailDocumentLink.createMany","MailDocumentLink.createManyAndReturn","MailDocumentLink.updateOne","MailDocumentLink.updateMany","MailDocumentLink.updateManyAndReturn","MailDocumentLink.upsertOne","MailDocumentLink.deleteOne","MailDocumentLink.deleteMany","MailDocumentLink.groupBy","MailDocumentLink.aggregate","Reminder.findUnique","Reminder.findUniqueOrThrow","Reminder.findFirst","Reminder.findFirstOrThrow","Reminder.findMany","Reminder.createOne","Reminder.createMany","Reminder.createManyAndReturn","Reminder.updateOne","Reminder.updateMany","Reminder.updateManyAndReturn","Reminder.upsertOne","Reminder.deleteOne","Reminder.deleteMany","Reminder.groupBy","Reminder.aggregate","Task.findUnique","Task.findUniqueOrThrow","Task.findFirst","Task.findFirstOrThrow","Task.findMany","Task.createOne","Task.createMany","Task.createManyAndReturn","Task.updateOne","Task.updateMany","Task.updateManyAndReturn","Task.upsertOne","Task.deleteOne","Task.deleteMany","Task.groupBy","Task.aggregate","Signature.findUnique","Signature.findUniqueOrThrow","Signature.findFirst","Signature.findFirstOrThrow","Signature.findMany","Signature.createOne","Signature.createMany","Signature.createManyAndReturn","Signature.updateOne","Signature.updateMany","Signature.updateManyAndReturn","Signature.upsertOne","Signature.deleteOne","Signature.deleteMany","Signature.groupBy","Signature.aggregate","LearnedTemplate.findUnique","LearnedTemplate.findUniqueOrThrow","LearnedTemplate.findFirst","LearnedTemplate.findFirstOrThrow","LearnedTemplate.findMany","LearnedTemplate.createOne","LearnedTemplate.createMany","LearnedTemplate.createManyAndReturn","LearnedTemplate.updateOne","LearnedTemplate.updateMany","LearnedTemplate.updateManyAndReturn","LearnedTemplate.upsertOne","LearnedTemplate.deleteOne","LearnedTemplate.deleteMany","LearnedTemplate.groupBy","LearnedTemplate.aggregate","AssistantActionLog.findUnique","AssistantActionLog.findUniqueOrThrow","AssistantActionLog.findFirst","AssistantActionLog.findFirstOrThrow","AssistantActionLog.findMany","AssistantActionLog.createOne","AssistantActionLog.createMany","AssistantActionLog.createManyAndReturn","AssistantActionLog.updateOne","AssistantActionLog.updateMany","AssistantActionLog.updateManyAndReturn","AssistantActionLog.upsertOne","AssistantActionLog.deleteOne","AssistantActionLog.deleteMany","AssistantActionLog.groupBy","AssistantActionLog.aggregate","ActivityLog.findUnique","ActivityLog.findUniqueOrThrow","ActivityLog.findFirst","ActivityLog.findFirstOrThrow","ActivityLog.findMany","ActivityLog.createOne","ActivityLog.createMany","ActivityLog.createManyAndReturn","ActivityLog.updateOne","ActivityLog.updateMany","ActivityLog.updateManyAndReturn","ActivityLog.upsertOne","ActivityLog.deleteOne","ActivityLog.deleteMany","ActivityLog.groupBy","ActivityLog.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","Counter.findUnique","Counter.findUniqueOrThrow","Counter.findFirst","Counter.findFirstOrThrow","Counter.findMany","Counter.createOne","Counter.createMany","Counter.createManyAndReturn","Counter.updateOne","Counter.updateMany","Counter.updateManyAndReturn","Counter.upsertOne","Counter.deleteOne","Counter.deleteMany","Counter.groupBy","Counter.aggregate","DocumentTitleOverride.findUnique","DocumentTitleOverride.findUniqueOrThrow","DocumentTitleOverride.findFirst","DocumentTitleOverride.findFirstOrThrow","DocumentTitleOverride.findMany","DocumentTitleOverride.createOne","DocumentTitleOverride.createMany","DocumentTitleOverride.createManyAndReturn","DocumentTitleOverride.updateOne","DocumentTitleOverride.updateMany","DocumentTitleOverride.updateManyAndReturn","DocumentTitleOverride.upsertOne","DocumentTitleOverride.deleteOne","DocumentTitleOverride.deleteMany","DocumentTitleOverride.groupBy","DocumentTitleOverride.aggregate","EmailContact.findUnique","EmailContact.findUniqueOrThrow","EmailContact.findFirst","EmailContact.findFirstOrThrow","EmailContact.findMany","EmailContact.createOne","EmailContact.createMany","EmailContact.createManyAndReturn","EmailContact.updateOne","EmailContact.updateMany","EmailContact.updateManyAndReturn","EmailContact.upsertOne","EmailContact.deleteOne","EmailContact.deleteMany","EmailContact.groupBy","EmailContact.aggregate","MailAccount.findUnique","MailAccount.findUniqueOrThrow","MailAccount.findFirst","MailAccount.findFirstOrThrow","MailAccount.findMany","MailAccount.createOne","MailAccount.createMany","MailAccount.createManyAndReturn","MailAccount.updateOne","MailAccount.updateMany","MailAccount.updateManyAndReturn","MailAccount.upsertOne","MailAccount.deleteOne","MailAccount.deleteMany","MailAccount.groupBy","MailAccount.aggregate","MailOauthToken.findUnique","MailOauthToken.findUniqueOrThrow","MailOauthToken.findFirst","MailOauthToken.findFirstOrThrow","MailOauthToken.findMany","MailOauthToken.createOne","MailOauthToken.createMany","MailOauthToken.createManyAndReturn","MailOauthToken.updateOne","MailOauthToken.updateMany","MailOauthToken.updateManyAndReturn","MailOauthToken.upsertOne","MailOauthToken.deleteOne","MailOauthToken.deleteMany","MailOauthToken.groupBy","MailOauthToken.aggregate","SavedSignature.findUnique","SavedSignature.findUniqueOrThrow","SavedSignature.findFirst","SavedSignature.findFirstOrThrow","SavedSignature.findMany","SavedSignature.createOne","SavedSignature.createMany","SavedSignature.createManyAndReturn","SavedSignature.updateOne","SavedSignature.updateMany","SavedSignature.updateManyAndReturn","SavedSignature.upsertOne","SavedSignature.deleteOne","SavedSignature.deleteMany","SavedSignature.groupBy","SavedSignature.aggregate","HiddenSender.findUnique","HiddenSender.findUniqueOrThrow","HiddenSender.findFirst","HiddenSender.findFirstOrThrow","HiddenSender.findMany","HiddenSender.createOne","HiddenSender.createMany","HiddenSender.createManyAndReturn","HiddenSender.updateOne","HiddenSender.updateMany","HiddenSender.updateManyAndReturn","HiddenSender.upsertOne","HiddenSender.deleteOne","HiddenSender.deleteMany","HiddenSender.groupBy","HiddenSender.aggregate","CustomField.findUnique","CustomField.findUniqueOrThrow","CustomField.findFirst","CustomField.findFirstOrThrow","CustomField.findMany","CustomField.createOne","CustomField.createMany","CustomField.createManyAndReturn","CustomField.updateOne","CustomField.updateMany","CustomField.updateManyAndReturn","CustomField.upsertOne","CustomField.deleteOne","CustomField.deleteMany","CustomField.groupBy","CustomField.aggregate","Setting.findUnique","Setting.findUniqueOrThrow","Setting.findFirst","Setting.findFirstOrThrow","Setting.findMany","Setting.createOne","Setting.createMany","Setting.createManyAndReturn","Setting.updateOne","Setting.updateMany","Setting.updateManyAndReturn","Setting.upsertOne","Setting.deleteOne","Setting.deleteMany","Setting.groupBy","Setting.aggregate","Tenant.findUnique","Tenant.findUniqueOrThrow","Tenant.findFirst","Tenant.findFirstOrThrow","Tenant.findMany","Tenant.createOne","Tenant.createMany","Tenant.createManyAndReturn","Tenant.updateOne","Tenant.updateMany","Tenant.updateManyAndReturn","Tenant.upsertOne","Tenant.deleteOne","Tenant.deleteMany","Tenant.groupBy","Tenant.aggregate","Membership.findUnique","Membership.findUniqueOrThrow","Membership.findFirst","Membership.findFirstOrThrow","Membership.findMany","Membership.createOne","Membership.createMany","Membership.createManyAndReturn","Membership.updateOne","Membership.updateMany","Membership.updateManyAndReturn","Membership.upsertOne","Membership.deleteOne","Membership.deleteMany","Membership.groupBy","Membership.aggregate","TenantSettings.findUnique","TenantSettings.findUniqueOrThrow","TenantSettings.findFirst","TenantSettings.findFirstOrThrow","TenantSettings.findMany","TenantSettings.createOne","TenantSettings.createMany","TenantSettings.createManyAndReturn","TenantSettings.updateOne","TenantSettings.updateMany","TenantSettings.updateManyAndReturn","TenantSettings.upsertOne","TenantSettings.deleteOne","TenantSettings.deleteMany","TenantSettings.groupBy","TenantSettings.aggregate","AND","OR","NOT","id","tenantId","maxUsers","maxDocuments","maxStorageMb","aiEnabled","ocrEnabled","emailImportEnabled","onlyofficeEnabled","raw","createdAt","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","contains","startsWith","endsWith","userId","role","tenantId_userId","name","slug","plan","status","key","value","label","type","options","required","metadata","deletedAt","email","domain","reason","imagePath","imageData","width","height","accountId","provider","accessTokenEncrypted","refreshTokenEncrypted","expiryDate","scope","tokenType","displayName","scopes","source","lastSeenAt","documentId","title","username","passwordHash","isSuperuser","isActive","level","message","projectId","user","priority","dueDate","remindAt","financialItemId","mailId","threadId","filename","kind","mimeType","messageId","fromAddr","toAddr","subject","date","snippet","body","hasAttachments","budgetEntryId","amount","account","direction","amountPaid","categoryId","categoryName","sourceDocumentId","folderId","folderId_documentId","parentId","color","category","correspondentId","documentId_correspondentId","tagId","documentId_tagId","textColor","analysisId","suggestionType","fieldName","suggestedValue","confidence","applied","rawPayload","summary","analyzedAt","content","sizeBytes","created","createdDate","added","modified","documentTypeId","storagePath","checksum","storedFilename","originalFileName","pageCount","deleted","set","increment","decrement","multiply","divide"]'),
  graph: "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_cBAAAiAgAMN0EAACBAQAQ3gQAAIgIADDfBAEAsAcAIekEQAC0BwAh6gRAALQHACGbBQEAwQcAIZ0FAgCxBwAhygUBAMEHACHLBQEAwQcAIcwFAQDBBwAhzQUBAMEHACHOBQEAwQcAIc8FIACyBwAh0AUAALMHACAImwUAAJMIACCdBQAAkwgAIMoFAACTCAAgywUAAJMIACDMBQAAkwgAIM0FAACTCAAgzgUAAJMIACDQBQAAkwgAIAMAAACBAQAgAwAAggEAMAQAAH4AIAMAAACBAQAgAwAAggEAMAQAAH4AIAMAAACBAQAgAwAAggEAMAQAAH4AIAzfBAEAAAAB6QRAAAAAAeoEQAAAAAGbBQEAAAABnQUCAAAAAcoFAQAAAAHLBQEAAAABzAUBAAAAAc0FAQAAAAHOBQEAAAABzwUgAAAAAdAFgAAAAAEBCAAAhgEAIAzfBAEAAAAB6QRAAAAAAeoEQAAAAAGbBQEAAAABnQUCAAAAAcoFAQAAAAHLBQEAAAABzAUBAAAAAc0FAQAAAAHOBQEAAAABzwUgAAAAAdAFgAAAAAEBCAAAiAEAMAEIAACIAQAwDN8EAQCZCAAh6QRAAJwIACHqBEAAnAgAIZsFAQCmCAAhnQUCAJoIACHKBQEApggAIcsFAQCmCAAhzAUBAKYIACHNBQEApggAIc4FAQCmCAAhzwUgAJsIACHQBYAAAAABAgAAAH4AIAgAAIsBACAM3wQBAJkIACHpBEAAnAgAIeoEQACcCAAhmwUBAKYIACGdBQIAmggAIcoFAQCmCAAhywUBAKYIACHMBQEApggAIc0FAQCmCAAhzgUBAKYIACHPBSAAmwgAIdAFgAAAAAECAAAAgQEAIAgAAI0BACACAAAAgQEAIAgAAI0BACADAAAAfgAgDwAAhgEAIBAAAIsBACABAAAAfgAgAQAAAIEBACANFQAAoQkAIBYAAKIJACAXAAClCQAgGAAApAkAIBkAAKMJACCbBQAAkwgAIJ0FAACTCAAgygUAAJMIACDLBQAAkwgAIMwFAACTCAAgzQUAAJMIACDOBQAAkwgAINAFAACTCAAgD9wEAACHCAAw3QQAAJQBABDeBAAAhwgAMN8EAQCfBwAh6QRAAKMHACHqBEAAowcAIZsFAQC9BwAhnQUCAKAHACHKBQEAvQcAIcsFAQC9BwAhzAUBAL0HACHNBQEAvQcAIc4FAQC9BwAhzwUgAKEHACHQBQAAogcAIAMAAACBAQAgAwAAkwEAMBQAAJQBACADAAAAgQEAIAMAAIIBADAEAAB-ACAJ3AQAAIYIADDdBAAAmgEAEN4EAACGCAAw3wQCAAAAAegEAACzBwAg_wQBAMEHACGABQEAwQcAIcMFAQDBBwAhyQUBAMEHACEBAAAAlwEAIAEAAACXAQAgCdwEAACGCAAw3QQAAJoBABDeBAAAhggAMN8EAgC6BwAh6AQAALMHACD_BAEAwQcAIYAFAQDBBwAhwwUBAMEHACHJBQEAwQcAIQXoBAAAkwgAIP8EAACTCAAggAUAAJMIACDDBQAAkwgAIMkFAACTCAAgAwAAAJoBACADAACbAQAwBAAAlwEAIAMAAACaAQAgAwAAmwEAMAQAAJcBACADAAAAmgEAIAMAAJsBADAEAACXAQAgBt8EAgAAAAHoBIAAAAAB_wQBAAAAAYAFAQAAAAHDBQEAAAAByQUBAAAAAQEIAACfAQAgBt8EAgAAAAHoBIAAAAAB_wQBAAAAAYAFAQAAAAHDBQEAAAAByQUBAAAAAQEIAAChAQAwAQgAAKEBADAG3wQCAKIIACHoBIAAAAAB_wQBAKYIACGABQEApggAIcMFAQCmCAAhyQUBAKYIACECAAAAlwEAIAgAAKQBACAG3wQCAKIIACHoBIAAAAAB_wQBAKYIACGABQEApggAIcMFAQCmCAAhyQUBAKYIACECAAAAmgEAIAgAAKYBACACAAAAmgEAIAgAAKYBACADAAAAlwEAIA8AAJ8BACAQAACkAQAgAQAAAJcBACABAAAAmgEAIAoVAACcCQAgFgAAnQkAIBcAAKAJACAYAACfCQAgGQAAngkAIOgEAACTCAAg_wQAAJMIACCABQAAkwgAIMMFAACTCAAgyQUAAJMIACAJ3AQAAIUIADDdBAAArQEAEN4EAACFCAAw3wQCALYHACHoBAAAogcAIP8EAQC9BwAhgAUBAL0HACHDBQEAvQcAIckFAQC9BwAhAwAAAJoBACADAACsAQAwFAAArQEAIAMAAACaAQAgAwAAmwEAMAQAAJcBACAG3AQAAIMIADDdBAAAswEAEN4EAACDCAAwnQUCALoHACHHBQIAugcAIcgFAACECAAgAQAAALABACABAAAAsAEAIAXcBAAAgwgAMN0EAACzAQAQ3gQAAIMIADCdBQIAugcAIccFAgC6BwAhAAMAAACzAQAgAwAAtAEAMAQAALABACADAAAAswEAIAMAALQBADAEAACwAQAgAwAAALMBACADAAC0AQAwBAAAsAEAIAKdBQIAAAABxwUCAAAAAQEIAAC4AQAgAp0FAgAAAAHHBQIAAAABAQgAALoBADABCAAAugEAMAKdBQIAoggAIccFAgCiCAAhAgAAALABACAIAAC9AQAgAp0FAgCiCAAhxwUCAKIIACECAAAAswEAIAgAAL8BACACAAAAswEAIAgAAL8BACADAAAAsAEAIA8AALgBACAQAAC9AQAgAQAAALABACABAAAAswEAIAUVAACXCQAgFgAAmAkAIBcAAJsJACAYAACaCQAgGQAAmQkAIAXcBAAAgggAMN0EAADGAQAQ3gQAAIIIADCdBQIAtgcAIccFAgC2BwAhAwAAALMBACADAADFAQAwFAAAxgEAIAMAAACzAQAgAwAAtAEAMAQAALABACAH3AQAAIEIADDdBAAAzAEAEN4EAACBCAAw3wQCAAAAAegEAACzBwAg_wQBAMEHACGABQEAwQcAIQEAAADJAQAgAQAAAMkBACAH3AQAAIEIADDdBAAAzAEAEN4EAACBCAAw3wQCALoHACHoBAAAswcAIP8EAQDBBwAhgAUBAMEHACED6AQAAJMIACD_BAAAkwgAIIAFAACTCAAgAwAAAMwBACADAADNAQAwBAAAyQEAIAMAAADMAQAgAwAAzQEAMAQAAMkBACADAAAAzAEAIAMAAM0BADAEAADJAQAgBN8EAgAAAAHoBIAAAAAB_wQBAAAAAYAFAQAAAAEBCAAA0QEAIATfBAIAAAAB6ASAAAAAAf8EAQAAAAGABQEAAAABAQgAANMBADABCAAA0wEAMATfBAIAoggAIegEgAAAAAH_BAEApggAIYAFAQCmCAAhAgAAAMkBACAIAADWAQAgBN8EAgCiCAAh6ASAAAAAAf8EAQCmCAAhgAUBAKYIACECAAAAzAEAIAgAANgBACACAAAAzAEAIAgAANgBACADAAAAyQEAIA8AANEBACAQAADWAQAgAQAAAMkBACABAAAAzAEAIAgVAACSCQAgFgAAkwkAIBcAAJYJACAYAACVCQAgGQAAlAkAIOgEAACTCAAg_wQAAJMIACCABQAAkwgAIAfcBAAAgAgAMN0EAADfAQAQ3gQAAIAIADDfBAIAtgcAIegEAACiBwAg_wQBAL0HACGABQEAvQcAIQMAAADMAQAgAwAA3gEAMBQAAN8BACADAAAAzAEAIAMAAM0BADAEAADJAQAgB9wEAAD_BwAw3QQAAOUBABDeBAAA_wcAMN8EAgAAAAHoBAAAswcAIP8EAQDBBwAhgAUBAMEHACEBAAAA4gEAIAEAAADiAQAgB9wEAAD_BwAw3QQAAOUBABDeBAAA_wcAMN8EAgC6BwAh6AQAALMHACD_BAEAwQcAIYAFAQDBBwAhA-gEAACTCAAg_wQAAJMIACCABQAAkwgAIAMAAADlAQAgAwAA5gEAMAQAAOIBACADAAAA5QEAIAMAAOYBADAEAADiAQAgAwAAAOUBACADAADmAQAwBAAA4gEAIATfBAIAAAAB6ASAAAAAAf8EAQAAAAGABQEAAAABAQgAAOoBACAE3wQCAAAAAegEgAAAAAH_BAEAAAABgAUBAAAAAQEIAADsAQAwAQgAAOwBADAE3wQCAKIIACHoBIAAAAAB_wQBAKYIACGABQEApggAIQIAAADiAQAgCAAA7wEAIATfBAIAoggAIegEgAAAAAH_BAEApggAIYAFAQCmCAAhAgAAAOUBACAIAADxAQAgAgAAAOUBACAIAADxAQAgAwAAAOIBACAPAADqAQAgEAAA7wEAIAEAAADiAQAgAQAAAOUBACAIFQAAjQkAIBYAAI4JACAXAACRCQAgGAAAkAkAIBkAAI8JACDoBAAAkwgAIP8EAACTCAAggAUAAJMIACAH3AQAAP4HADDdBAAA-AEAEN4EAAD-BwAw3wQCALYHACHoBAAAogcAIP8EAQC9BwAhgAUBAL0HACEDAAAA5QEAIAMAAPcBADAUAAD4AQAgAwAAAOUBACADAADmAQAwBAAA4gEAIAfcBAAA_AcAMN0EAAD-AQAQ3gQAAPwHADD9BAEAwQcAIZ0FAgC6BwAhxQUCALoHACHGBQAA_QcAIAEAAAD7AQAgAQAAAPsBACAG3AQAAPwHADDdBAAA_gEAEN4EAAD8BwAw_QQBAMEHACGdBQIAugcAIcUFAgC6BwAhAf0EAACTCAAgAwAAAP4BACADAAD_AQAwBAAA-wEAIAMAAAD-AQAgAwAA_wEAMAQAAPsBACADAAAA_gEAIAMAAP8BADAEAAD7AQAgA_0EAQAAAAGdBQIAAAABxQUCAAAAAQEIAACDAgAgA_0EAQAAAAGdBQIAAAABxQUCAAAAAQEIAACFAgAwAQgAAIUCADAD_QQBAKYIACGdBQIAoggAIcUFAgCiCAAhAgAAAPsBACAIAACIAgAgA_0EAQCmCAAhnQUCAKIIACHFBQIAoggAIQIAAAD-AQAgCAAAigIAIAIAAAD-AQAgCAAAigIAIAMAAAD7AQAgDwAAgwIAIBAAAIgCACABAAAA-wEAIAEAAAD-AQAgBhUAAIgJACAWAACJCQAgFwAAjAkAIBgAAIsJACAZAACKCQAg_QQAAJMIACAG3AQAAPsHADDdBAAAkQIAEN4EAAD7BwAw_QQBAL0HACGdBQIAtgcAIcUFAgC2BwAhAwAAAP4BACADAACQAgAwFAAAkQIAIAMAAAD-AQAgAwAA_wEAMAQAAPsBACAN3AQAAPoHADDdBAAAlwIAEN4EAAD6BwAw3wQBAAAAAegEAACzBwAg6QRAALQHACHqBEAAtAcAIf8EAQDBBwAhgAUBAMEHACGCBQEAwQcAIcIFAQDBBwAhwwUBAMEHACHEBQEAwQcAIQEAAACUAgAgAQAAAJQCACAN3AQAAPoHADDdBAAAlwIAEN4EAAD6BwAw3wQBALAHACHoBAAAswcAIOkEQAC0BwAh6gRAALQHACH_BAEAwQcAIYAFAQDBBwAhggUBAMEHACHCBQEAwQcAIcMFAQDBBwAhxAUBAMEHACEH6AQAAJMIACD_BAAAkwgAIIAFAACTCAAgggUAAJMIACDCBQAAkwgAIMMFAACTCAAgxAUAAJMIACADAAAAlwIAIAMAAJgCADAEAACUAgAgAwAAAJcCACADAACYAgAwBAAAlAIAIAMAAACXAgAgAwAAmAIAMAQAAJQCACAK3wQBAAAAAegEgAAAAAHpBEAAAAAB6gRAAAAAAf8EAQAAAAGABQEAAAABggUBAAAAAcIFAQAAAAHDBQEAAAABxAUBAAAAAQEIAACcAgAgCt8EAQAAAAHoBIAAAAAB6QRAAAAAAeoEQAAAAAH_BAEAAAABgAUBAAAAAYIFAQAAAAHCBQEAAAABwwUBAAAAAcQFAQAAAAEBCAAAngIAMAEIAACeAgAwCt8EAQCZCAAh6ASAAAAAAekEQACcCAAh6gRAAJwIACH_BAEApggAIYAFAQCmCAAhggUBAKYIACHCBQEApggAIcMFAQCmCAAhxAUBAKYIACECAAAAlAIAIAgAAKECACAK3wQBAJkIACHoBIAAAAAB6QRAAJwIACHqBEAAnAgAIf8EAQCmCAAhgAUBAKYIACGCBQEApggAIcIFAQCmCAAhwwUBAKYIACHEBQEApggAIQIAAACXAgAgCAAAowIAIAIAAACXAgAgCAAAowIAIAMAAACUAgAgDwAAnAIAIBAAAKECACABAAAAlAIAIAEAAACXAgAgChUAAIUJACAYAACHCQAgGQAAhgkAIOgEAACTCAAg_wQAAJMIACCABQAAkwgAIIIFAACTCAAgwgUAAJMIACDDBQAAkwgAIMQFAACTCAAgDdwEAAD5BwAw3QQAAKoCABDeBAAA-QcAMN8EAQCfBwAh6AQAAKIHACDpBEAAowcAIeoEQACjBwAh_wQBAL0HACGABQEAvQcAIYIFAQC9BwAhwgUBAL0HACHDBQEAvQcAIcQFAQC9BwAhAwAAAJcCACADAACpAgAwFAAAqgIAIAMAAACXAgAgAwAAmAIAMAQAAJQCACAG3AQAAPcHADDdBAAAsAIAEN4EAAD3BwAwnQUCALoHACHABQEAsAcAIcEFAAD4BwAgAQAAAK0CACABAAAArQIAIAXcBAAA9wcAMN0EAACwAgAQ3gQAAPcHADCdBQIAugcAIcAFAQCwBwAhAAMAAACwAgAgAwAAsQIAMAQAAK0CACADAAAAsAIAIAMAALECADAEAACtAgAgAwAAALACACADAACxAgAwBAAArQIAIAKdBQIAAAABwAUBAAAAAQEIAAC1AgAgAp0FAgAAAAHABQEAAAABAQgAALcCADABCAAAtwIAMAKdBQIAoggAIcAFAQCZCAAhAgAAAK0CACAIAAC6AgAgAp0FAgCiCAAhwAUBAJkIACECAAAAsAIAIAgAALwCACACAAAAsAIAIAgAALwCACADAAAArQIAIA8AALUCACAQAAC6AgAgAQAAAK0CACABAAAAsAIAIAUVAACACQAgFgAAgQkAIBcAAIQJACAYAACDCQAgGQAAggkAIAXcBAAA9gcAMN0EAADDAgAQ3gQAAPYHADCdBQIAtgcAIcAFAQCfBwAhAwAAALACACADAADCAgAwFAAAwwIAIAMAAACwAgAgAwAAsQIAMAQAAK0CACAR3AQAAPUHADDdBAAAyQIAEN4EAAD1BwAw3wQBAAAAAegEAACzBwAg6QRAALQHACHqBEAAtAcAIYIFAQDBBwAhhQUBAMEHACGoBQEAwQcAIa4FAQDBBwAhuQUIAPMHACG7BQEAwQcAIbwFCADzBwAhvQUBAMEHACG-BQEAwQcAIb8FAgCxBwAhAQAAAMYCACABAAAAxgIAIBHcBAAA9QcAMN0EAADJAgAQ3gQAAPUHADDfBAEAsAcAIegEAACzBwAg6QRAALQHACHqBEAAtAcAIYIFAQDBBwAhhQUBAMEHACGoBQEAwQcAIa4FAQDBBwAhuQUIAPMHACG7BQEAwQcAIbwFCADzBwAhvQUBAMEHACG-BQEAwQcAIb8FAgCxBwAhC-gEAACTCAAgggUAAJMIACCFBQAAkwgAIKgFAACTCAAgrgUAAJMIACC5BQAAkwgAILsFAACTCAAgvAUAAJMIACC9BQAAkwgAIL4FAACTCAAgvwUAAJMIACADAAAAyQIAIAMAAMoCADAEAADGAgAgAwAAAMkCACADAADKAgAwBAAAxgIAIAMAAADJAgAgAwAAygIAMAQAAMYCACAO3wQBAAAAAegEgAAAAAHpBEAAAAAB6gRAAAAAAYIFAQAAAAGFBQEAAAABqAUBAAAAAa4FAQAAAAG5BQgAAAABuwUBAAAAAbwFCAAAAAG9BQEAAAABvgUBAAAAAb8FAgAAAAEBCAAAzgIAIA7fBAEAAAAB6ASAAAAAAekEQAAAAAHqBEAAAAABggUBAAAAAYUFAQAAAAGoBQEAAAABrgUBAAAAAbkFCAAAAAG7BQEAAAABvAUIAAAAAb0FAQAAAAG-BQEAAAABvwUCAAAAAQEIAADQAgAwAQgAANACADAO3wQBAJkIACHoBIAAAAAB6QRAAJwIACHqBEAAnAgAIYIFAQCmCAAhhQUBAKYIACGoBQEApggAIa4FAQCmCAAhuQUIAPoIACG7BQEApggAIbwFCAD6CAAhvQUBAKYIACG-BQEApggAIb8FAgCaCAAhAgAAAMYCACAIAADTAgAgDt8EAQCZCAAh6ASAAAAAAekEQACcCAAh6gRAAJwIACGCBQEApggAIYUFAQCmCAAhqAUBAKYIACGuBQEApggAIbkFCAD6CAAhuwUBAKYIACG8BQgA-ggAIb0FAQCmCAAhvgUBAKYIACG_BQIAmggAIQIAAADJAgAgCAAA1QIAIAIAAADJAgAgCAAA1QIAIAMAAADGAgAgDwAAzgIAIBAAANMCACABAAAAxgIAIAEAAADJAgAgEBUAAPsIACAWAAD8CAAgFwAA_wgAIBgAAP4IACAZAAD9CAAg6AQAAJMIACCCBQAAkwgAIIUFAACTCAAgqAUAAJMIACCuBQAAkwgAILkFAACTCAAguwUAAJMIACC8BQAAkwgAIL0FAACTCAAgvgUAAJMIACC_BQAAkwgAIBHcBAAA9AcAMN0EAADcAgAQ3gQAAPQHADDfBAEAnwcAIegEAACiBwAg6QRAAKMHACHqBEAAowcAIYIFAQC9BwAhhQUBAL0HACGoBQEAvQcAIa4FAQC9BwAhuQUIAPAHACG7BQEAvQcAIbwFCADwBwAhvQUBAL0HACG-BQEAvQcAIb8FAgCgBwAhAwAAAMkCACADAADbAgAwFAAA3AIAIAMAAADJAgAgAwAAygIAMAQAAMYCACAJ3AQAAPIHADDdBAAA4gIAEN4EAADyBwAw3wQBAAAAAegEAACzBwAgtAUBAMEHACG4BQEAsAcAIbkFCADzBwAhugUBAMEHACEBAAAA3wIAIAEAAADfAgAgCdwEAADyBwAw3QQAAOICABDeBAAA8gcAMN8EAQCwBwAh6AQAALMHACC0BQEAwQcAIbgFAQCwBwAhuQUIAPMHACG6BQEAwQcAIQToBAAAkwgAILQFAACTCAAguQUAAJMIACC6BQAAkwgAIAMAAADiAgAgAwAA4wIAMAQAAN8CACADAAAA4gIAIAMAAOMCADAEAADfAgAgAwAAAOICACADAADjAgAwBAAA3wIAIAbfBAEAAAAB6ASAAAAAAbQFAQAAAAG4BQEAAAABuQUIAAAAAboFAQAAAAEBCAAA5wIAIAbfBAEAAAAB6ASAAAAAAbQFAQAAAAG4BQEAAAABuQUIAAAAAboFAQAAAAEBCAAA6QIAMAEIAADpAgAwBt8EAQCZCAAh6ASAAAAAAbQFAQCmCAAhuAUBAJkIACG5BQgA-ggAIboFAQCmCAAhAgAAAN8CACAIAADsAgAgBt8EAQCZCAAh6ASAAAAAAbQFAQCmCAAhuAUBAJkIACG5BQgA-ggAIboFAQCmCAAhAgAAAOICACAIAADuAgAgAgAAAOICACAIAADuAgAgAwAAAN8CACAPAADnAgAgEAAA7AIAIAEAAADfAgAgAQAAAOICACAJFQAA9QgAIBYAAPYIACAXAAD5CAAgGAAA-AgAIBkAAPcIACDoBAAAkwgAILQFAACTCAAguQUAAJMIACC6BQAAkwgAIAncBAAA7wcAMN0EAAD1AgAQ3gQAAO8HADDfBAEAnwcAIegEAACiBwAgtAUBAL0HACG4BQEAnwcAIbkFCADwBwAhugUBAL0HACEDAAAA4gIAIAMAAPQCADAUAAD1AgAgAwAAAOICACADAADjAgAwBAAA3wIAIA_cBAAA7gcAMN0EAAD7AgAQ3gQAAO4HADDfBAEAAAAB6AQAALMHACCSBQEAwQcAIawFAQDBBwAhsAUBAMEHACGxBQEAwQcAIbIFAQDBBwAhswUBAMEHACG0BUAAzAcAIbUFAQDBBwAhtgUBAMEHACG3BSAAsgcAIQEAAAD4AgAgAQAAAPgCACAP3AQAAO4HADDdBAAA-wIAEN4EAADuBwAw3wQBALAHACHoBAAAswcAIJIFAQDBBwAhrAUBAMEHACGwBQEAwQcAIbEFAQDBBwAhsgUBAMEHACGzBQEAwQcAIbQFQADMBwAhtQUBAMEHACG2BQEAwQcAIbcFIACyBwAhCugEAACTCAAgkgUAAJMIACCsBQAAkwgAILAFAACTCAAgsQUAAJMIACCyBQAAkwgAILMFAACTCAAgtAUAAJMIACC1BQAAkwgAILYFAACTCAAgAwAAAPsCACADAAD8AgAwBAAA-AIAIAMAAAD7AgAgAwAA_AIAMAQAAPgCACADAAAA-wIAIAMAAPwCADAEAAD4AgAgDN8EAQAAAAHoBIAAAAABkgUBAAAAAawFAQAAAAGwBQEAAAABsQUBAAAAAbIFAQAAAAGzBQEAAAABtAVAAAAAAbUFAQAAAAG2BQEAAAABtwUgAAAAAQEIAACAAwAgDN8EAQAAAAHoBIAAAAABkgUBAAAAAawFAQAAAAGwBQEAAAABsQUBAAAAAbIFAQAAAAGzBQEAAAABtAVAAAAAAbUFAQAAAAG2BQEAAAABtwUgAAAAAQEIAACCAwAwAQgAAIIDADAM3wQBAJkIACHoBIAAAAABkgUBAKYIACGsBQEApggAIbAFAQCmCAAhsQUBAKYIACGyBQEApggAIbMFAQCmCAAhtAVAAK8IACG1BQEApggAIbYFAQCmCAAhtwUgAJsIACECAAAA-AIAIAgAAIUDACAM3wQBAJkIACHoBIAAAAABkgUBAKYIACGsBQEApggAIbAFAQCmCAAhsQUBAKYIACGyBQEApggAIbMFAQCmCAAhtAVAAK8IACG1BQEApggAIbYFAQCmCAAhtwUgAJsIACECAAAA-wIAIAgAAIcDACACAAAA-wIAIAgAAIcDACADAAAA-AIAIA8AAIADACAQAACFAwAgAQAAAPgCACABAAAA-wIAIA0VAADyCAAgGAAA9AgAIBkAAPMIACDoBAAAkwgAIJIFAACTCAAgrAUAAJMIACCwBQAAkwgAILEFAACTCAAgsgUAAJMIACCzBQAAkwgAILQFAACTCAAgtQUAAJMIACC2BQAAkwgAIA_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_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-QMAMAQAAPUDACADAAAA-AMAIAMAAPkDADAEAAD1AwAgBd8EAQAAAAHoBIAAAAAB6QRAAAAAAZcFAQAAAAGdBQIAAAABAQgAAP0DACAF3wQBAAAAAegEgAAAAAHpBEAAAAABlwUBAAAAAZ0FAgAAAAEBCAAA_wMAMAEIAAD_AwAwBd8EAQCZCAAh6ASAAAAAAekEQACcCAAhlwUBAKYIACGdBQIAmggAIQIAAAD1AwAgCAAAggQAIAXfBAEAmQgAIegEgAAAAAHpBEAAnAgAIZcFAQCmCAAhnQUCAJoIACECAAAA-AMAIAgAAIQEACACAAAA-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_wQBAAAAAYQFAgAAAAEBCAAA-gQAIATpBEAAAAAB6gRAAAAAAf8EAQAAAAGEBQIAAAABAQgAAPwEADABCAAA_AQAMATpBEAAnAgAIeoEQACcCAAh_wQBAJkIACGEBQIAoggAIQIAAADyBAAgCAAA_wQAIATpBEAAnAgAIeoEQACcCAAh_wQBAJkIACGEBQIAoggAIQIAAAD1BAAgCAAAgQUAIAIAAAD1BAAgCAAAgQUAIAMAAADyBAAgDwAA-gQAIBAAAP8EACABAAAA8gQAIAEAAAD1BAAgBRUAAMYIACAWAADHCAAgFwAAyggAIBgAAMkIACAZAADICAAgB9wEAADZBwAw3QQAAIgFABDeBAAA2QcAMOkEQACjBwAh6gRAAKMHACH_BAEAnwcAIYQFAgC2BwAhAwAAAPUEACADAACHBQAwFAAAiAUAIAMAAAD1BAAgAwAA9gQAMAQAAPIEACAJ3AQAANgHADDdBAAAjgUAEN4EAADYBwAw6QRAALQHACHqBEAAtAcAIYkFAACzBwAgmwUBAMEHACGdBQIAAAABngUBAMEHACEBAAAAiwUAIAEAAACLBQAgCdwEAADYBwAw3QQAAI4FABDeBAAA2AcAMOkEQAC0BwAh6gRAALQHACGJBQAAswcAIJsFAQDBBwAhnQUCALoHACGeBQEAwQcAIQOJBQAAkwgAIJsFAACTCAAgngUAAJMIACADAAAAjgUAIAMAAI8FADAEAACLBQAgAwAAAI4FACADAACPBQAwBAAAiwUAIAMAAACOBQAgAwAAjwUAMAQAAIsFACAG6QRAAAAAAeoEQAAAAAGJBYAAAAABmwUBAAAAAZ0FAgAAAAGeBQEAAAABAQgAAJMFACAG6QRAAAAAAeoEQAAAAAGJBYAAAAABmwUBAAAAAZ0FAgAAAAGeBQEAAAABAQgAAJUFADABCAAAlQUAMAbpBEAAnAgAIeoEQACcCAAhiQWAAAAAAZsFAQCmCAAhnQUCAKIIACGeBQEApggAIQIAAACLBQAgCAAAmAUAIAbpBEAAnAgAIeoEQACcCAAhiQWAAAAAAZsFAQCmCAAhnQUCAKIIACGeBQEApggAIQIAAACOBQAgCAAAmgUAIAIAAACOBQAgCAAAmgUAIAMAAACLBQAgDwAAkwUAIBAAAJgFACABAAAAiwUAIAEAAACOBQAgCBUAAMEIACAWAADCCAAgFwAAxQgAIBgAAMQIACAZAADDCAAgiQUAAJMIACCbBQAAkwgAIJ4FAACTCAAgCdwEAADXBwAw3QQAAKEFABDeBAAA1wcAMOkEQACjBwAh6gRAAKMHACGJBQAAogcAIJsFAQC9BwAhnQUCALYHACGeBQEAvQcAIQMAAACOBQAgAwAAoAUAMBQAAKEFACADAAAAjgUAIAMAAI8FADAEAACLBQAgDdwEAADWBwAw3QQAAKcFABDeBAAA1gcAMN8EAQAAAAHpBEAAtAcAIeoEQAC0BwAh_wQBAMEHACGJBQAAswcAIIoFQADMBwAhiwUBAMEHACGZBQEAwQcAIZsFAQDBBwAhnAVAAMwHACEBAAAApAUAIAEAAACkBQAgDdwEAADWBwAw3QQAAKcFABDeBAAA1gcAMN8EAQCwBwAh6QRAALQHACHqBEAAtAcAIf8EAQDBBwAhiQUAALMHACCKBUAAzAcAIYsFAQDBBwAhmQUBAMEHACGbBQEAwQcAIZwFQADMBwAhB_8EAACTCAAgiQUAAJMIACCKBQAAkwgAIIsFAACTCAAgmQUAAJMIACCbBQAAkwgAIJwFAACTCAAgAwAAAKcFACADAACoBQAwBAAApAUAIAMAAACnBQAgAwAAqAUAMAQAAKQFACADAAAApwUAIAMAAKgFADAEAACkBQAgCt8EAQAAAAHpBEAAAAAB6gRAAAAAAf8EAQAAAAGJBYAAAAABigVAAAAAAYsFAQAAAAGZBQEAAAABmwUBAAAAAZwFQAAAAAEBCAAArAUAIArfBAEAAAAB6QRAAAAAAeoEQAAAAAH_BAEAAAABiQWAAAAAAYoFQAAAAAGLBQEAAAABmQUBAAAAAZsFAQAAAAGcBUAAAAABAQgAAK4FADABCAAArgUAMArfBAEAmQgAIekEQACcCAAh6gRAAJwIACH_BAEApggAIYkFgAAAAAGKBUAArwgAIYsFAQCmCAAhmQUBAKYIACGbBQEApggAIZwFQACvCAAhAgAAAKQFACAIAACxBQAgCt8EAQCZCAAh6QRAAJwIACHqBEAAnAgAIf8EAQCmCAAhiQWAAAAAAYoFQACvCAAhiwUBAKYIACGZBQEApggAIZsFAQCmCAAhnAVAAK8IACECAAAApwUAIAgAALMFACACAAAApwUAIAgAALMFACADAAAApAUAIA8AAKwFACAQAACxBQAgAQAAAKQFACABAAAApwUAIAoVAAC-CAAgGAAAwAgAIBkAAL8IACD_BAAAkwgAIIkFAACTCAAgigUAAJMIACCLBQAAkwgAIJkFAACTCAAgmwUAAJMIACCcBQAAkwgAIA3cBAAA1QcAMN0EAAC6BQAQ3gQAANUHADDfBAEAnwcAIekEQACjBwAh6gRAAKMHACH_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-BQAgAgAAAPIFACAIAAD-BQAgAwAAAO8FACAPAAD3BQAgEAAA_AUAIAEAAADvBQAgAQAAAPIFACANFQAAswgAIBYAALQIACAXAAC3CAAgGAAAtggAIBkAALUIACCFBQAAkwgAIIYFAACTCAAgiQUAAJMIACCKBQAAkwgAII4FAACTCAAgjwUAAJMIACCQBQAAkwgAIJEFAACTCAAgDtwEAADPBwAw3QQAAIUGABDeBAAAzwcAMN8EAQCfBwAh6QRAAKMHACHqBEAAowcAIYUFAQC9BwAhhgUBAL0HACGJBQAAogcAIIoFQADIBwAhjgUBAL0HACGPBQEAvQcAIZAFAgCgBwAhkQUCAKAHACEDAAAA8gUAIAMAAIQGADAUAACFBgAgAwAAAPIFACADAADzBQAwBAAA7wUAIAvcBAAAzgcAMN0EAACLBgAQ3gQAAM4HADDfBAEAAAAB6QRAALQHACHqBEAAtAcAIYkFAACzBwAgigVAAMwHACGLBQEAwQcAIYwFAQDBBwAhjQUBAMEHACEBAAAAiAYAIAEAAACIBgAgC9wEAADOBwAw3QQAAIsGABDeBAAAzgcAMN8EAQCwBwAh6QRAALQHACHqBEAAtAcAIYkFAACzBwAgigVAAMwHACGLBQEAwQcAIYwFAQDBBwAhjQUBAMEHACEFiQUAAJMIACCKBQAAkwgAIIsFAACTCAAgjAUAAJMIACCNBQAAkwgAIAMAAACLBgAgAwAAjAYAMAQAAIgGACADAAAAiwYAIAMAAIwGADAEAACIBgAgAwAAAIsGACADAACMBgAwBAAAiAYAIAjfBAEAAAAB6QRAAAAAAeoEQAAAAAGJBYAAAAABigVAAAAAAYsFAQAAAAGMBQEAAAABjQUBAAAAAQEIAACQBgAgCN8EAQAAAAHpBEAAAAAB6gRAAAAAAYkFgAAAAAGKBUAAAAABiwUBAAAAAYwFAQAAAAGNBQEAAAABAQgAAJIGADABCAAAkgYAMAjfBAEAmQgAIekEQACcCAAh6gRAAJwIACGJBYAAAAABigVAAK8IACGLBQEApggAIYwFAQCmCAAhjQUBAKYIACECAAAAiAYAIAgAAJUGACAI3wQBAJkIACHpBEAAnAgAIeoEQACcCAAhiQWAAAAAAYoFQACvCAAhiwUBAKYIACGMBQEApggAIY0FAQCmCAAhAgAAAIsGACAIAACXBgAgAgAAAIsGACAIAACXBgAgAwAAAIgGACAPAACQBgAgEAAAlQYAIAEAAACIBgAgAQAAAIsGACAIFQAAsAgAIBgAALIIACAZAACxCAAgiQUAAJMIACCKBQAAkwgAIIsFAACTCAAgjAUAAJMIACCNBQAAkwgAIAvcBAAAzQcAMN0EAACeBgAQ3gQAAM0HADDfBAEAnwcAIekEQACjBwAh6gRAAKMHACGJBQAAogcAIIoFQADIBwAhiwUBAL0HACGMBQEAvQcAIY0FAQC9BwAhAwAAAIsGACADAACdBgAwFAAAngYAIAMAAACLBgAgAwAAjAYAMAQAAIgGACAN3AQAAMsHADDdBAAApAYAEN4EAADLBwAw3wQCAAAAAekEQAC0BwAh6gRAALQHACH_BAEAwQcAIYUFAQDBBwAhhgUBAMEHACGHBQAAswcAIIgFIACyBwAhiQUAALMHACCKBUAAzAcAIQEAAAChBgAgAQAAAKEGACAN3AQAAMsHADDdBAAApAYAEN4EAADLBwAw3wQCALoHACHpBEAAtAcAIeoEQAC0BwAh_wQBAMEHACGFBQEAwQcAIYYFAQDBBwAhhwUAALMHACCIBSAAsgcAIYkFAACzBwAgigVAAMwHACEG_wQAAJMIACCFBQAAkwgAIIYFAACTCAAghwUAAJMIACCJBQAAkwgAIIoFAACTCAAgAwAAAKQGACADAAClBgAwBAAAoQYAIAMAAACkBgAgAwAApQYAMAQAAKEGACADAAAApAYAIAMAAKUGADAEAAChBgAgCt8EAgAAAAHpBEAAAAAB6gRAAAAAAf8EAQAAAAGFBQEAAAABhgUBAAAAAYcFgAAAAAGIBSAAAAABiQWAAAAAAYoFQAAAAAEBCAAAqQYAIArfBAIAAAAB6QRAAAAAAeoEQAAAAAH_BAEAAAABhQUBAAAAAYYFAQAAAAGHBYAAAAABiAUgAAAAAYkFgAAAAAGKBUAAAAABAQgAAKsGADABCAAAqwYAMArfBAIAoggAIekEQACcCAAh6gRAAJwIACH_BAEApggAIYUFAQCmCAAhhgUBAKYIACGHBYAAAAABiAUgAJsIACGJBYAAAAABigVAAK8IACECAAAAoQYAIAgAAK4GACAK3wQCAKIIACHpBEAAnAgAIeoEQACcCAAh_wQBAKYIACGFBQEApggAIYYFAQCmCAAhhwWAAAAAAYgFIACbCAAhiQWAAAAAAYoFQACvCAAhAgAAAKQGACAIAACwBgAgAgAAAKQGACAIAACwBgAgAwAAAKEGACAPAACpBgAgEAAArgYAIAEAAAChBgAgAQAAAKQGACALFQAAqggAIBYAAKsIACAXAACuCAAgGAAArQgAIBkAAKwIACD_BAAAkwgAIIUFAACTCAAghgUAAJMIACCHBQAAkwgAIIkFAACTCAAgigUAAJMIACAN3AQAAMcHADDdBAAAtwYAEN4EAADHBwAw3wQCALYHACHpBEAAowcAIeoEQACjBwAh_wQBAL0HACGFBQEAvQcAIYYFAQC9BwAhhwUAAKIHACCIBSAAoQcAIYkFAACiBwAgigVAAMgHACEDAAAApAYAIAMAALYGADAUAAC3BgAgAwAAAKQGACADAAClBgAwBAAAoQYAIAXcBAAAxQcAMN0EAAC9BgAQ3gQAAMUHADCDBQEAAAABhAUAAMYHACABAAAAugYAIAEAAAC6BgAgBdwEAADFBwAw3QQAAL0GABDeBAAAxQcAMIMFAQCwBwAhhAUAAMYHACAAAwAAAL0GACADAAC-BgAwBAAAugYAIAMAAAC9BgAgAwAAvgYAMAQAALoGACADAAAAvQYAIAMAAL4GADAEAAC6BgAgAoMFAQAAAAGEBYAAAAABAQgAAMIGACACgwUBAAAAAYQFgAAAAAEBCAAAxAYAMAEIAADEBgAwAoMFAQCZCAAhhAWAAAAAAQIAAAC6BgAgCAAAxwYAIAKDBQEAmQgAIYQFgAAAAAECAAAAvQYAIAgAAMkGACACAAAAvQYAIAgAAMkGACADAAAAugYAIA8AAMIGACAQAADHBgAgAQAAALoGACABAAAAvQYAIAMVAACnCAAgGAAAqQgAIBkAAKgIACAF3AQAAMIHADDdBAAA0AYAEN4EAADCBwAwgwUBAJ8HACGEBQAAwwcAIAMAAAC9BgAgAwAAzwYAMBQAANAGACADAAAAvQYAIAMAAL4GADAEAAC6BgAgC9wEAADABwAw3QQAANYGABDeBAAAwAcAMN8EAQAAAAHoBAAAswcAIOkEQAC0BwAh6gRAALQHACH_BAEAwQcAIYAFAQAAAAGBBQEAwQcAIYIFAQDBBwAhAQAAANMGACABAAAA0wYAIAvcBAAAwAcAMN0EAADWBgAQ3gQAAMAHADDfBAEAsAcAIegEAACzBwAg6QRAALQHACHqBEAAtAcAIf8EAQDBBwAhgAUBALAHACGBBQEAwQcAIYIFAQDBBwAhBOgEAACTCAAg_wQAAJMIACCBBQAAkwgAIIIFAACTCAAgAwAAANYGACADAADXBgAwBAAA0wYAIAMAAADWBgAgAwAA1wYAMAQAANMGACADAAAA1gYAIAMAANcGADAEAADTBgAgCN8EAQAAAAHoBIAAAAAB6QRAAAAAAeoEQAAAAAH_BAEAAAABgAUBAAAAAYEFAQAAAAGCBQEAAAABAQgAANsGACAI3wQBAAAAAegEgAAAAAHpBEAAAAAB6gRAAAAAAf8EAQAAAAGABQEAAAABgQUBAAAAAYIFAQAAAAEBCAAA3QYAMAEIAADdBgAwCN8EAQCZCAAh6ASAAAAAAekEQACcCAAh6gRAAJwIACH_BAEApggAIYAFAQCZCAAhgQUBAKYIACGCBQEApggAIQIAAADTBgAgCAAA4AYAIAjfBAEAmQgAIegEgAAAAAHpBEAAnAgAIeoEQACcCAAh_wQBAKYIACGABQEAmQgAIYEFAQCmCAAhggUBAKYIACECAAAA1gYAIAgAAOIGACACAAAA1gYAIAgAAOIGACADAAAA0wYAIA8AANsGACAQAADgBgAgAQAAANMGACABAAAA1gYAIAcVAACjCAAgGAAApQgAIBkAAKQIACDoBAAAkwgAIP8EAACTCAAggQUAAJMIACCCBQAAkwgAIAvcBAAAvAcAMN0EAADpBgAQ3gQAALwHADDfBAEAnwcAIegEAACiBwAg6QRAAKMHACHqBEAAowcAIf8EAQC9BwAhgAUBAJ8HACGBBQEAvQcAIYIFAQC9BwAhAwAAANYGACADAADoBgAwFAAA6QYAIAMAAADWBgAgAwAA1wYAMAQAANMGACAL3AQAALkHADDdBAAA7wYAEN4EAAC5BwAw3wQBAAAAAeAEAQCwBwAh6AQAALMHACDpBEAAtAcAIeoEQAC0BwAh_AQCALoHACH9BAEAsAcAIf4EAAC7BwAgAQAAAOwGACABAAAA7AYAIArcBAAAuQcAMN0EAADvBgAQ3gQAALkHADDfBAEAsAcAIeAEAQCwBwAh6AQAALMHACDpBEAAtAcAIeoEQAC0BwAh_AQCALoHACH9BAEAsAcAIQHoBAAAkwgAIAMAAADvBgAgAwAA8AYAMAQAAOwGACADAAAA7wYAIAMAAPAGADAEAADsBgAgAwAAAO8GACADAADwBgAwBAAA7AYAIAffBAEAAAAB4AQBAAAAAegEgAAAAAHpBEAAAAAB6gRAAAAAAfwEAgAAAAH9BAEAAAABAQgAAPQGACAH3wQBAAAAAeAEAQAAAAHoBIAAAAAB6QRAAAAAAeoEQAAAAAH8BAIAAAAB_QQBAAAAAQEIAAD2BgAwAQgAAPYGADAH3wQBAJkIACHgBAEAmQgAIegEgAAAAAHpBEAAnAgAIeoEQACcCAAh_AQCAKIIACH9BAEAmQgAIQIAAADsBgAgCAAA-QYAIAffBAEAmQgAIeAEAQCZCAAh6ASAAAAAAekEQACcCAAh6gRAAJwIACH8BAIAoggAIf0EAQCZCAAhAgAAAO8GACAIAAD7BgAgAgAAAO8GACAIAAD7BgAgAwAAAOwGACAPAAD0BgAgEAAA-QYAIAEAAADsBgAgAQAAAO8GACAGFQAAnQgAIBYAAJ4IACAXAAChCAAgGAAAoAgAIBkAAJ8IACDoBAAAkwgAIArcBAAAtQcAMN0EAACCBwAQ3gQAALUHADDfBAEAnwcAIeAEAQCfBwAh6AQAAKIHACDpBEAAowcAIeoEQACjBwAh_AQCALYHACH9BAEAnwcAIQMAAADvBgAgAwAAgQcAMBQAAIIHACADAAAA7wYAIAMAAPAGADAEAADsBgAgD9wEAACvBwAw3QQAAIgHABDeBAAArwcAMN8EAQAAAAHgBAEAAAAB4QQCALEHACHiBAIAsQcAIeMEAgCxBwAh5AQgALIHACHlBCAAsgcAIeYEIACyBwAh5wQgALIHACHoBAAAswcAIOkEQAC0BwAh6gRAALQHACEBAAAAhQcAIAEAAACFBwAgD9wEAACvBwAw3QQAAIgHABDeBAAArwcAMN8EAQCwBwAh4AQBALAHACHhBAIAsQcAIeIEAgCxBwAh4wQCALEHACHkBCAAsgcAIeUEIACyBwAh5gQgALIHACHnBCAAsgcAIegEAACzBwAg6QRAALQHACHqBEAAtAcAIQThBAAAkwgAIOIEAACTCAAg4wQAAJMIACDoBAAAkwgAIAMAAACIBwAgAwAAiQcAMAQAAIUHACADAAAAiAcAIAMAAIkHADAEAACFBwAgAwAAAIgHACADAACJBwAwBAAAhQcAIAzfBAEAAAAB4AQBAAAAAeEEAgAAAAHiBAIAAAAB4wQCAAAAAeQEIAAAAAHlBCAAAAAB5gQgAAAAAecEIAAAAAHoBIAAAAAB6QRAAAAAAeoEQAAAAAEBCAAAjQcAIAzfBAEAAAAB4AQBAAAAAeEEAgAAAAHiBAIAAAAB4wQCAAAAAeQEIAAAAAHlBCAAAAAB5gQgAAAAAecEIAAAAAHoBIAAAAAB6QRAAAAAAeoEQAAAAAEBCAAAjwcAMAEIAACPBwAwDN8EAQCZCAAh4AQBAJkIACHhBAIAmggAIeIEAgCaCAAh4wQCAJoIACHkBCAAmwgAIeUEIACbCAAh5gQgAJsIACHnBCAAmwgAIegEgAAAAAHpBEAAnAgAIeoEQACcCAAhAgAAAIUHACAIAACSBwAgDN8EAQCZCAAh4AQBAJkIACHhBAIAmggAIeIEAgCaCAAh4wQCAJoIACHkBCAAmwgAIeUEIACbCAAh5gQgAJsIACHnBCAAmwgAIegEgAAAAAHpBEAAnAgAIeoEQACcCAAhAgAAAIgHACAIAACUBwAgAgAAAIgHACAIAACUBwAgAwAAAIUHACAPAACNBwAgEAAAkgcAIAEAAACFBwAgAQAAAIgHACAJFQAAlAgAIBYAAJUIACAXAACYCAAgGAAAlwgAIBkAAJYIACDhBAAAkwgAIOIEAACTCAAg4wQAAJMIACDoBAAAkwgAIA_cBAAAngcAMN0EAACbBwAQ3gQAAJ4HADDfBAEAnwcAIeAEAQCfBwAh4QQCAKAHACHiBAIAoAcAIeMEAgCgBwAh5AQgAKEHACHlBCAAoQcAIeYEIAChBwAh5wQgAKEHACHoBAAAogcAIOkEQACjBwAh6gRAAKMHACEDAAAAiAcAIAMAAJoHADAUAACbBwAgAwAAAIgHACADAACJBwAwBAAAhQcAIA_cBAAAngcAMN0EAACbBwAQ3gQAAJ4HADDfBAEAnwcAIeAEAQCfBwAh4QQCAKAHACHiBAIAoAcAIeMEAgCgBwAh5AQgAKEHACHlBCAAoQcAIeYEIAChBwAh5wQgAKEHACHoBAAAogcAIOkEQACjBwAh6gRAAKMHACEOFQAApQcAIBgAAK4HACAZAACuBwAg6wQBAAAAAewEAQAAAATtBAEAAAAE7gQBAAAAAe8EAQAAAAHwBAEAAAAB8QQBAAAAAfIEAQCtBwAh-QQBAAAAAfoEAQAAAAH7BAEAAAABDRUAAKcHACAWAACsBwAgFwAApwcAIBgAAKcHACAZAACnBwAg6wQCAAAAAewEAgAAAAXtBAIAAAAF7gQCAAAAAe8EAgAAAAHwBAIAAAAB8QQCAAAAAfIEAgCrBwAhBRUAAKUHACAYAACqBwAgGQAAqgcAIOsEIAAAAAHyBCAAqQcAIQ8VAACnBwAgGAAAqAcAIBkAAKgHACDrBIAAAAAB7gSAAAAAAe8EgAAAAAHwBIAAAAAB8QSAAAAAAfIEgAAAAAHzBAEAAAAB9AQBAAAAAfUEAQAAAAH2BIAAAAAB9wSAAAAAAfgEgAAAAAELFQAApQcAIBgAAKYHACAZAACmBwAg6wRAAAAAAewEQAAAAATtBEAAAAAE7gRAAAAAAe8EQAAAAAHwBEAAAAAB8QRAAAAAAfIEQACkBwAhCxUAAKUHACAYAACmBwAgGQAApgcAIOsEQAAAAAHsBEAAAAAE7QRAAAAABO4EQAAAAAHvBEAAAAAB8ARAAAAAAfEEQAAAAAHyBEAApAcAIQjrBAIAAAAB7AQCAAAABO0EAgAAAATuBAIAAAAB7wQCAAAAAfAEAgAAAAHxBAIAAAAB8gQCAKUHACEI6wRAAAAAAewEQAAAAATtBEAAAAAE7gRAAAAAAe8EQAAAAAHwBEAAAAAB8QRAAAAAAfIEQACmBwAhCOsEAgAAAAHsBAIAAAAF7QQCAAAABe4EAgAAAAHvBAIAAAAB8AQCAAAAAfEEAgAAAAHyBAIApwcAIQzrBIAAAAAB7gSAAAAAAe8EgAAAAAHwBIAAAAAB8QSAAAAAAfIEgAAAAAHzBAEAAAAB9AQBAAAAAfUEAQAAAAH2BIAAAAAB9wSAAAAAAfgEgAAAAAEFFQAApQcAIBgAAKoHACAZAACqBwAg6wQgAAAAAfIEIACpBwAhAusEIAAAAAHyBCAAqgcAIQ0VAACnBwAgFgAArAcAIBcAAKcHACAYAACnBwAgGQAApwcAIOsEAgAAAAHsBAIAAAAF7QQCAAAABe4EAgAAAAHvBAIAAAAB8AQCAAAAAfEEAgAAAAHyBAIAqwcAIQjrBAgAAAAB7AQIAAAABe0ECAAAAAXuBAgAAAAB7wQIAAAAAfAECAAAAAHxBAgAAAAB8gQIAKwHACEOFQAApQcAIBgAAK4HACAZAACuBwAg6wQBAAAAAewEAQAAAATtBAEAAAAE7gQBAAAAAe8EAQAAAAHwBAEAAAAB8QQBAAAAAfIEAQCtBwAh-QQBAAAAAfoEAQAAAAH7BAEAAAABC-sEAQAAAAHsBAEAAAAE7QQBAAAABO4EAQAAAAHvBAEAAAAB8AQBAAAAAfEEAQAAAAHyBAEArgcAIfkEAQAAAAH6BAEAAAAB-wQBAAAAAQ_cBAAArwcAMN0EAACIBwAQ3gQAAK8HADDfBAEAsAcAIeAEAQCwBwAh4QQCALEHACHiBAIAsQcAIeMEAgCxBwAh5AQgALIHACHlBCAAsgcAIeYEIACyBwAh5wQgALIHACHoBAAAswcAIOkEQAC0BwAh6gRAALQHACEL6wQBAAAAAewEAQAAAATtBAEAAAAE7gQBAAAAAe8EAQAAAAHwBAEAAAAB8QQBAAAAAfIEAQCuBwAh-QQBAAAAAfoEAQAAAAH7BAEAAAABCOsEAgAAAAHsBAIAAAAF7QQCAAAABe4EAgAAAAHvBAIAAAAB8AQCAAAAAfEEAgAAAAHyBAIApwcAIQLrBCAAAAAB8gQgAKoHACEM6wSAAAAAAe4EgAAAAAHvBIAAAAAB8ASAAAAAAfEEgAAAAAHyBIAAAAAB8wQBAAAAAfQEAQAAAAH1BAEAAAAB9gSAAAAAAfcEgAAAAAH4BIAAAAABCOsEQAAAAAHsBEAAAAAE7QRAAAAABO4EQAAAAAHvBEAAAAAB8ARAAAAAAfEEQAAAAAHyBEAApgcAIQrcBAAAtQcAMN0EAACCBwAQ3gQAALUHADDfBAEAnwcAIeAEAQCfBwAh6AQAAKIHACDpBEAAowcAIeoEQACjBwAh_AQCALYHACH9BAEAnwcAIQ0VAAClBwAgFgAAuAcAIBcAAKUHACAYAAClBwAgGQAApQcAIOsEAgAAAAHsBAIAAAAE7QQCAAAABO4EAgAAAAHvBAIAAAAB8AQCAAAAAfEEAgAAAAHyBAIAtwcAIQ0VAAClBwAgFgAAuAcAIBcAAKUHACAYAAClBwAgGQAApQcAIOsEAgAAAAHsBAIAAAAE7QQCAAAABO4EAgAAAAHvBAIAAAAB8AQCAAAAAfEEAgAAAAHyBAIAtwcAIQjrBAgAAAAB7AQIAAAABO0ECAAAAATuBAgAAAAB7wQIAAAAAfAECAAAAAHxBAgAAAAB8gQIALgHACEK3AQAALkHADDdBAAA7wYAEN4EAAC5BwAw3wQBALAHACHgBAEAsAcAIegEAACzBwAg6QRAALQHACHqBEAAtAcAIfwEAgC6BwAh_QQBALAHACEI6wQCAAAAAewEAgAAAATtBAIAAAAE7gQCAAAAAe8EAgAAAAHwBAIAAAAB8QQCAAAAAfIEAgClBwAhAuAEAQAAAAH8BAIAAAABC9wEAAC8BwAw3QQAAOkGABDeBAAAvAcAMN8EAQCfBwAh6AQAAKIHACDpBEAAowcAIeoEQACjBwAh_wQBAL0HACGABQEAnwcAIYEFAQC9BwAhggUBAL0HACEOFQAApwcAIBgAAL8HACAZAAC_BwAg6wQBAAAAAewEAQAAAAXtBAEAAAAF7gQBAAAAAe8EAQAAAAHwBAEAAAAB8QQBAAAAAfIEAQC-BwAh-QQBAAAAAfoEAQAAAAH7BAEAAAABDhUAAKcHACAYAAC_BwAgGQAAvwcAIOsEAQAAAAHsBAEAAAAF7QQBAAAABe4EAQAAAAHvBAEAAAAB8AQBAAAAAfEEAQAAAAHyBAEAvgcAIfkEAQAAAAH6BAEAAAAB-wQBAAAAAQvrBAEAAAAB7AQBAAAABe0EAQAAAAXuBAEAAAAB7wQBAAAAAfAEAQAAAAHxBAEAAAAB8gQBAL8HACH5BAEAAAAB-gQBAAAAAfsEAQAAAAEL3AQAAMAHADDdBAAA1gYAEN4EAADABwAw3wQBALAHACHoBAAAswcAIOkEQAC0BwAh6gRAALQHACH_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_wQBAL0HACGABQEAvQcAIYIFAQC9BwAhwgUBAL0HACHDBQEAvQcAIcQFAQC9BwAhDdwEAAD6BwAw3QQAAJcCABDeBAAA-gcAMN8EAQCwBwAh6AQAALMHACDpBEAAtAcAIeoEQAC0BwAh_wQBAMEHACGABQEAwQcAIYIFAQDBBwAhwgUBAMEHACHDBQEAwQcAIcQFAQDBBwAhBtwEAAD7BwAw3QQAAJECABDeBAAA-wcAMP0EAQC9BwAhnQUCALYHACHFBQIAtgcAIQbcBAAA_AcAMN0EAAD-AQAQ3gQAAPwHADD9BAEAwQcAIZ0FAgC6BwAhxQUCALoHACECnQUCAAAAAcUFAgAAAAEH3AQAAP4HADDdBAAA-AEAEN4EAAD-BwAw3wQCALYHACHoBAAAogcAIP8EAQC9BwAhgAUBAL0HACEH3AQAAP8HADDdBAAA5QEAEN4EAAD_BwAw3wQCALoHACHoBAAAswcAIP8EAQDBBwAhgAUBAMEHACEH3AQAAIAIADDdBAAA3wEAEN4EAACACAAw3wQCALYHACHoBAAAogcAIP8EAQC9BwAhgAUBAL0HACEH3AQAAIEIADDdBAAAzAEAEN4EAACBCAAw3wQCALoHACHoBAAAswcAIP8EAQDBBwAhgAUBAMEHACEF3AQAAIIIADDdBAAAxgEAEN4EAACCCAAwnQUCALYHACHHBQIAtgcAIQXcBAAAgwgAMN0EAACzAQAQ3gQAAIMIADCdBQIAugcAIccFAgC6BwAhAp0FAgAAAAHHBQIAAAABCdwEAACFCAAw3QQAAK0BABDeBAAAhQgAMN8EAgC2BwAh6AQAAKIHACD_BAEAvQcAIYAFAQC9BwAhwwUBAL0HACHJBQEAvQcAIQncBAAAhggAMN0EAACaAQAQ3gQAAIYIADDfBAIAugcAIegEAACzBwAg_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-GAB_GQCAAQAAAAUVAIYBFgCHARcAiAEYAIkBGQCKAQAAAAAABRUAhgEWAIcBFwCIARgAiQEZAIoBAAAABRUAkAEWAJEBFwCSARgAkwEZAJQBAAAAAAAFFQCQARYAkQEXAJIBGACTARkAlAEAAAADFQCaARgAmwEZAJwBAAAAAxUAmgEYAJsBGQCcAQAAAAMVAKIBGACjARkApAEAAAADFQCiARgAowEZAKQBAAAABRUAqgEWAKsBFwCsARgArQEZAK4BAAAAAAAFFQCqARYAqwEXAKwBGACtARkArgEAAAAFFQC0ARYAtQEXALYBGAC3ARkAuAEAAAAAAAUVALQBFgC1ARcAtgEYALcBGQC4AQAAAAMVAL4BGAC_ARkAwAEAAAADFQC-ARgAvwEZAMABAAAABRUAxgEWAMcBFwDIARgAyQEZAMoBAAAAAAAFFQDGARYAxwEXAMgBGADJARkAygEAAAADFQDQARgA0QEZANIBAAAAAxUA0AEYANEBGQDSAQAAAAUVANgBFgDZARcA2gEYANsBGQDcAQAAAAAABRUA2AEWANkBFwDaARgA2wEZANwBAAAABRUA4gEWAOMBFwDkARgA5QEZAOYBAAAAAAAFFQDiARYA4wEXAOQBGADlARkA5gEAAAAFFQDsARYA7QEXAO4BGADvARkA8AEAAAAAAAUVAOwBFgDtARcA7gEYAO8BGQDwAQAAAAUVAPYBFgD3ARcA-AEYAPkBGQD6AQAAAAAABRUA9gEWAPcBFwD4ARgA-QEZAPoBAAAABRUAgAIWAIECFwCCAhgAgwIZAIQCAAAAAAAFFQCAAhYAgQIXAIICGACDAhkAhAIAAAADFQCKAhgAiwIZAIwCAAAAAxUAigIYAIsCGQCMAgAAAAMVAJICGACTAhkAlAIAAAADFQCSAhgAkwIZAJQCAAAAAxUAmgIYAJsCGQCcAgAAAAMVAJoCGACbAhkAnAIAAAAFFQCiAhYAowIXAKQCGAClAhkApgIAAAAAAAUVAKICFgCjAhcApAIYAKUCGQCmAgAAAAMVAKwCGACtAhkArgIAAAADFQCsAhgArQIZAK4CAAAABRUAtAIWALUCFwC2AhgAtwIZALgCAAAAAAAFFQC0AhYAtQIXALYCGAC3AhkAuAIAAAADFQC-AhgAvwIZAMACAAAAAxUAvgIYAL8CGQDAAgAAAAMVAMYCGADHAhkAyAIAAAADFQDGAhgAxwIZAMgCAAAABRUAzgIWAM8CFwDQAhgA0QIZANICAAAAAAAFFQDOAhYAzwIXANACGADRAhkA0gIAAAAFFQDYAhYA2QIXANoCGADbAhkA3AIAAAAAAAUVANgCFgDZAhcA2gIYANsCGQDcAgECAQIDAQUGAQYHAQcIAQkKAQoMAgsNAwwPAQ0RAg4SBBETARIUARMVAhoYBRsZCxwbDB0cDB4fDB8gDCAhDCEjDCIlAiMmDSQoDCUqAiYrDicsDCgtDCkuAioxDysyFSw0Fi01Fi44Fi85FjA6FjE8FjI-AjM_FzRBFjVDAjZEGDdFFjhGFjlHAjpKGTtLHzxNID1OID5RID9SIEBTIEFVIEJXAkNYIURaIEVcAkZdIkdeIEhfIElgAkpjI0tkKUxmKk1nKk5qKk9rKlBsKlFuKlJwAlNxK1RzKlV1AlZ2LFd3Klh4Kll5Alp8LVt9M1x_NF2AATRegwE0X4QBNGCFATRhhwE0YokBAmOKATVkjAE0ZY4BAmaPATZnkAE0aJEBNGmSAQJqlQE3a5YBPWyYAT5tmQE-bpwBPm-dAT5wngE-caABPnKiAQJzowE_dKUBPnWnAQJ2qAFAd6kBPniqAT55qwECeq4BQXuvAUd8sQFIfbIBSH61AUh_tgFIgAG3AUiBAbkBSIIBuwECgwG8AUmEAb4BSIUBwAEChgHBAUqHAcIBSIgBwwFIiQHEAQKKAccBS4sByAFRjAHKAVKNAcsBUo4BzgFSjwHPAVKQAdABUpEB0gFSkgHUAQKTAdUBU5QB1wFSlQHZAQKWAdoBVJcB2wFSmAHcAVKZAd0BApoB4AFVmwHhAVucAeMBXJ0B5AFcngHnAVyfAegBXKAB6QFcoQHrAVyiAe0BAqMB7gFdpAHwAVylAfIBAqYB8wFepwH0AVyoAfUBXKkB9gECqgH5AV-rAfoBZawB_AFmrQH9AWauAYACZq8BgQJmsAGCAmaxAYQCZrIBhgICswGHAme0AYkCZrUBiwICtgGMAmi3AY0CZrgBjgJmuQGPAgK6AZICabsBkwJvvAGVAnC9AZYCcL4BmQJwvwGaAnDAAZsCcMEBnQJwwgGfAgLDAaACccQBogJwxQGkAgLGAaUCcscBpgJwyAGnAnDJAagCAsoBqwJzywGsAnfMAa4CeM0BrwJ4zgGyAnjPAbMCeNABtAJ40QG2AnjSAbgCAtMBuQJ51AG7AnjVAb0CAtYBvgJ61wG_AnjYAcACeNkBwQIC2gHEAnvbAcUCgQHcAccCggHdAcgCggHeAcsCggHfAcwCggHgAc0CggHhAc8CggHiAdECAuMB0gKDAeQB1AKCAeUB1gIC5gHXAoQB5wHYAoIB6AHZAoIB6QHaAgLqAd0ChQHrAd4CiwHsAeACjAHtAeECjAHuAeQCjAHvAeUCjAHwAeYCjAHxAegCjAHyAeoCAvMB6wKNAfQB7QKMAfUB7wIC9gHwAo4B9wHxAowB-AHyAowB-QHzAgL6AfYCjwH7AfcClQH8AfkClgH9AfoClgH-Af0ClgH_Af4ClgGAAv8ClgGBAoEDlgGCAoMDAoMChAOXAYQChgOWAYUCiAMChgKJA5gBhwKKA5YBiAKLA5YBiQKMAwKKAo8DmQGLApADnQGMApIDngGNApMDngGOApYDngGPApcDngGQApgDngGRApoDngGSApwDApMCnQOfAZQCnwOeAZUCoQMClgKiA6ABlwKjA54BmAKkA54BmQKlAwKaAqgDoQGbAqkDpQGcAqsDpgGdAqwDpgGeAq8DpgGfArADpgGgArEDpgGhArMDpgGiArUDAqMCtgOnAaQCuAOmAaUCugMCpgK7A6gBpwK8A6YBqAK9A6YBqQK-AwKqAsEDqQGrAsIDrwGsAsQDsAGtAsUDsAGuAsgDsAGvAskDsAGwAsoDsAGxAswDsAGyAs4DArMCzwOxAbQC0QOwAbUC0wMCtgLUA7IBtwLVA7ABuALWA7ABuQLXAwK6AtoDswG7AtsDuQG8At0DugG9At4DugG-AuEDugG_AuIDugHAAuMDugHBAuUDugHCAucDAsMC6AO7AcQC6gO6AcUC7AMCxgLtA7wBxwLuA7oByALvA7oByQLwAwLKAvMDvQHLAvQDwQHMAvYDwgHNAvcDwgHOAvoDwgHPAvsDwgHQAvwDwgHRAv4DwgHSAoAEAtMCgQTDAdQCgwTCAdUChQQC1gKGBMQB1wKHBMIB2AKIBMIB2QKJBALaAowExQHbAo0EywHcAo8EzAHdApAEzAHeApMEzAHfApQEzAHgApUEzAHhApcEzAHiApkEAuMCmgTNAeQCnATMAeUCngQC5gKfBM4B5wKgBMwB6AKhBMwB6QKiBALqAqUEzwHrAqYE0wHsAqgE1AHtAqkE1AHuAqwE1AHvAq0E1AHwAq4E1AHxArAE1AHyArIEAvMCswTVAfQCtQTUAfUCtwQC9gK4BNYB9wK5BNQB-AK6BNQB-QK7BAL6Ar4E1wH7Ar8E3QH8AsEE3gH9AsIE3gH-AsUE3gH_AsYE3gGAA8cE3gGBA8kE3gGCA8sEAoMDzATfAYQDzgTeAYUD0AQChgPRBOABhwPSBN4BiAPTBN4BiQPUBAKKA9cE4QGLA9gE5wGMA9oE6AGNA9sE6AGOA94E6AGPA98E6AGQA-AE6AGRA-IE6AGSA-QEApMD5QTpAZQD5wToAZUD6QQClgPqBOoBlwPrBOgBmAPsBOgBmQPtBAKaA_AE6wGbA_EE8QGcA_ME8gGdA_QE8gGeA_cE8gGfA_gE8gGgA_kE8gGhA_sE8gGiA_0EAqMD_gTzAaQDgAXyAaUDggUCpgODBfQBpwOEBfIBqAOFBfIBqQOGBQKqA4kF9QGrA4oF-wGsA4wF_AGtA40F_AGuA5AF_AGvA5EF_AGwA5IF_AGxA5QF_AGyA5YFArMDlwX9AbQDmQX8AbUDmwUCtgOcBf4BtwOdBfwBuAOeBfwBuQOfBQK6A6IF_wG7A6MFhQK8A6UFhgK9A6YFhgK-A6kFhgK_A6oFhgLAA6sFhgLBA60FhgLCA68FAsMDsAWHAsQDsgWGAsUDtAUCxgO1BYgCxwO2BYYCyAO3BYYCyQO4BQLKA7sFiQLLA7wFjQLMA74FjgLNA78FjgLOA8IFjgLPA8MFjgLQA8QFjgLRA8YFjgLSA8gFAtMDyQWPAtQDywWOAtUDzQUC1gPOBZAC1wPPBY4C2APQBY4C2QPRBQLaA9QFkQLbA9UFlQLcA9cFlgLdA9gFlgLeA9sFlgLfA9wFlgLgA90FlgLhA98FlgLiA-EFAuMD4gWXAuQD5AWWAuUD5gUC5gPnBZgC5wPoBZYC6APpBZYC6QPqBQLqA-0FmQLrA-4FnQLsA_AFngLtA_EFngLuA_QFngLvA_UFngLwA_YFngLxA_gFngLyA_oFAvMD-wWfAvQD_QWeAvUD_wUC9gOABqAC9wOBBp4C-AOCBp4C-QODBgL6A4YGoQL7A4cGpwL8A4kGqAL9A4oGqAL-A40GqAL_A44GqAKABI8GqAKBBJEGqAKCBJMGAoMElAapAoQElgaoAoUEmAYChgSZBqoChwSaBqgCiASbBqgCiQScBgKKBJ8GqwKLBKAGrwKMBKIGsAKNBKMGsAKOBKYGsAKPBKcGsAKQBKgGsAKRBKoGsAKSBKwGApMErQaxApQErwawApUEsQYClgSyBrIClwSzBrACmAS0BrACmQS1BgKaBLgGswKbBLkGuQKcBLsGugKdBLwGugKeBL8GugKfBMAGugKgBMEGugKhBMMGugKiBMUGAqMExga7AqQEyAa6AqUEygYCpgTLBrwCpwTMBroCqATNBroCqQTOBgKqBNEGvQKrBNIGwQKsBNQGwgKtBNUGwgKuBNgGwgKvBNkGwgKwBNoGwgKxBNwGwgKyBN4GArME3wbDArQE4QbCArUE4wYCtgTkBsQCtwTlBsICuATmBsICuQTnBgK6BOoGxQK7BOsGyQK8BO0GygK9BO4GygK-BPEGygK_BPIGygLABPMGygLBBPUGygLCBPcGAsME-AbLAsQE-gbKAsUE_AYCxgT9BswCxwT-BsoCyAT_BsoCyQSABwLKBIMHzQLLBIQH0wLMBIYH1ALNBIcH1ALOBIoH1ALPBIsH1ALQBIwH1ALRBI4H1ALSBJAHAtMEkQfVAtQEkwfUAtUElQcC1gSWB9YC1wSXB9QC2ASYB9QC2QSZBwLaBJwH1wLbBJ0H3QI"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer: Buffer2 } = await import("node:buffer");
  const wasmArray = Buffer2.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config);
}

// src/generated/prisma/internal/prismaNamespace.ts
import * as runtime2 from "@prisma/client/runtime/client";
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var defineExtension = runtime2.Extensions.defineExtension;

// src/generated/prisma/client.ts
globalThis["__dirname"] = path.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass();

// node_modules/@prisma/debug/dist/index.mjs
var __defProp2 = Object.defineProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp2(target, name2, { get: all[name2], enumerable: true });
};
var colors_exports = {};
__export(colors_exports, {
  $: () => $,
  bgBlack: () => bgBlack,
  bgBlue: () => bgBlue,
  bgCyan: () => bgCyan,
  bgGreen: () => bgGreen,
  bgMagenta: () => bgMagenta,
  bgRed: () => bgRed,
  bgWhite: () => bgWhite,
  bgYellow: () => bgYellow,
  black: () => black,
  blue: () => blue,
  bold: () => bold,
  cyan: () => cyan,
  dim: () => dim,
  gray: () => gray,
  green: () => green,
  grey: () => grey,
  hidden: () => hidden,
  inverse: () => inverse,
  italic: () => italic,
  magenta: () => magenta,
  red: () => red,
  reset: () => reset,
  strikethrough: () => strikethrough,
  underline: () => underline,
  white: () => white,
  yellow: () => yellow
});
var FORCE_COLOR;
var NODE_DISABLE_COLORS;
var NO_COLOR;
var TERM;
var isTTY = true;
if (typeof process !== "undefined") {
  ({ FORCE_COLOR, NODE_DISABLE_COLORS, NO_COLOR, TERM } = process.env || {});
  isTTY = process.stdout && process.stdout.isTTY;
}
var $ = {
  enabled: !NODE_DISABLE_COLORS && NO_COLOR == null && TERM !== "dumb" && (FORCE_COLOR != null && FORCE_COLOR !== "0" || isTTY)
};
function init(x, y) {
  let rgx = new RegExp(`\\x1b\\[${y}m`, "g");
  let open = `\x1B[${x}m`, close = `\x1B[${y}m`;
  return function(txt) {
    if (!$.enabled || txt == null) return txt;
    return open + (!!~("" + txt).indexOf(close) ? txt.replace(rgx, close + open) : txt) + close;
  };
}
var reset = init(0, 0);
var bold = init(1, 22);
var dim = init(2, 22);
var italic = init(3, 23);
var underline = init(4, 24);
var inverse = init(7, 27);
var hidden = init(8, 28);
var strikethrough = init(9, 29);
var black = init(30, 39);
var red = init(31, 39);
var green = init(32, 39);
var yellow = init(33, 39);
var blue = init(34, 39);
var magenta = init(35, 39);
var cyan = init(36, 39);
var white = init(37, 39);
var gray = init(90, 39);
var grey = init(90, 39);
var bgBlack = init(40, 49);
var bgRed = init(41, 49);
var bgGreen = init(42, 49);
var bgYellow = init(43, 49);
var bgBlue = init(44, 49);
var bgMagenta = init(45, 49);
var bgCyan = init(46, 49);
var bgWhite = init(47, 49);
var MAX_ARGS_HISTORY = 100;
var COLORS = ["green", "yellow", "blue", "magenta", "cyan", "red"];
var argsHistory = [];
var lastTimestamp = Date.now();
var lastColor = 0;
var processEnv = typeof process !== "undefined" ? process.env : {};
globalThis.DEBUG ??= processEnv.DEBUG ?? "";
globalThis.DEBUG_COLORS ??= processEnv.DEBUG_COLORS ? processEnv.DEBUG_COLORS === "true" : true;
var topProps = {
  enable(namespace) {
    if (typeof namespace === "string") {
      globalThis.DEBUG = namespace;
    }
  },
  disable() {
    const prev = globalThis.DEBUG;
    globalThis.DEBUG = "";
    return prev;
  },
  // this is the core logic to check if logging should happen or not
  enabled(namespace) {
    const listenedNamespaces = globalThis.DEBUG.split(",").map((s) => {
      return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    });
    const isListened = listenedNamespaces.some((listenedNamespace) => {
      if (listenedNamespace === "" || listenedNamespace[0] === "-") return false;
      return namespace.match(RegExp(listenedNamespace.split("*").join(".*") + "$"));
    });
    const isExcluded = listenedNamespaces.some((listenedNamespace) => {
      if (listenedNamespace === "" || listenedNamespace[0] !== "-") return false;
      return namespace.match(RegExp(listenedNamespace.slice(1).split("*").join(".*") + "$"));
    });
    return isListened && !isExcluded;
  },
  log: (...args) => {
    const [namespace, format, ...rest] = args;
    const logWithFormatting = console.warn ?? console.log;
    logWithFormatting(`${namespace} ${format}`, ...rest);
  },
  formatters: {}
  // not implemented
};
function debugCreate(namespace) {
  const instanceProps = {
    color: COLORS[lastColor++ % COLORS.length],
    enabled: topProps.enabled(namespace),
    namespace,
    log: topProps.log,
    extend: () => {
    }
    // not implemented
  };
  const debugCall = (...args) => {
    const { enabled, namespace: namespace2, color, log } = instanceProps;
    if (args.length !== 0) {
      argsHistory.push([namespace2, ...args]);
    }
    if (argsHistory.length > MAX_ARGS_HISTORY) {
      argsHistory.shift();
    }
    if (topProps.enabled(namespace2) || enabled) {
      const stringArgs = args.map((arg) => {
        if (typeof arg === "string") {
          return arg;
        }
        return safeStringify(arg);
      });
      const ms = `+${Date.now() - lastTimestamp}ms`;
      lastTimestamp = Date.now();
      if (globalThis.DEBUG_COLORS) {
        log(colors_exports[color](bold(namespace2)), ...stringArgs, colors_exports[color](ms));
      } else {
        log(namespace2, ...stringArgs, ms);
      }
    }
  };
  return new Proxy(debugCall, {
    get: (_, prop) => instanceProps[prop],
    set: (_, prop, value) => instanceProps[prop] = value
  });
}
var Debug = new Proxy(debugCreate, {
  get: (_, prop) => topProps[prop],
  set: (_, prop, value) => topProps[prop] = value
});
function safeStringify(value, indent = 2) {
  const cache = /* @__PURE__ */ new Set();
  return JSON.stringify(
    value,
    (key, value2) => {
      if (typeof value2 === "object" && value2 !== null) {
        if (cache.has(value2)) {
          return `[Circular *]`;
        }
        cache.add(value2);
      } else if (typeof value2 === "bigint") {
        return value2.toString();
      }
      return value2;
    },
    indent
  );
}

// node_modules/@prisma/driver-adapter-utils/dist/index.mjs
var DriverAdapterError = class extends Error {
  name = "DriverAdapterError";
  cause;
  constructor(payload) {
    super(typeof payload["message"] === "string" ? payload["message"] : payload.kind);
    this.cause = payload;
  }
};
var debug = Debug("driver-adapter-utils");
var ColumnTypeEnum = {
  // Scalars
  Int32: 0,
  Int64: 1,
  Float: 2,
  Double: 3,
  Numeric: 4,
  Boolean: 5,
  Character: 6,
  Text: 7,
  Date: 8,
  Time: 9,
  DateTime: 10,
  Json: 11,
  Enum: 12,
  Bytes: 13,
  Set: 14,
  Uuid: 15,
  // Arrays
  Int32Array: 64,
  Int64Array: 65,
  FloatArray: 66,
  DoubleArray: 67,
  NumericArray: 68,
  BooleanArray: 69,
  CharacterArray: 70,
  TextArray: 71,
  DateArray: 72,
  TimeArray: 73,
  DateTimeArray: 74,
  JsonArray: 75,
  EnumArray: 76,
  BytesArray: 77,
  UuidArray: 78,
  // Custom
  UnknownNumber: 128
};
var mockAdapterErrors = {
  queryRaw: new Error("Not implemented: queryRaw"),
  executeRaw: new Error("Not implemented: executeRaw"),
  startTransaction: new Error("Not implemented: startTransaction"),
  executeScript: new Error("Not implemented: executeScript"),
  dispose: new Error("Not implemented: dispose")
};

// node_modules/pg/esm/index.mjs
var import_lib = __toESM(require_lib2(), 1);
var Client = import_lib.default.Client;
var Pool = import_lib.default.Pool;
var Connection = import_lib.default.Connection;
var types = import_lib.default.types;
var Query = import_lib.default.Query;
var DatabaseError = import_lib.default.DatabaseError;
var escapeIdentifier = import_lib.default.escapeIdentifier;
var escapeLiteral = import_lib.default.escapeLiteral;
var Result = import_lib.default.Result;
var TypeOverrides = import_lib.default.TypeOverrides;
var defaults = import_lib.default.defaults;
var esm_default = import_lib.default;

// node_modules/@prisma/adapter-pg/dist/index.mjs
var import_postgres_array = __toESM(require_postgres_array2(), 1);
var name = "@prisma/adapter-pg";
var FIRST_NORMAL_OBJECT_ID = 16384;
var { types: types2 } = esm_default;
var { builtins: ScalarColumnType, getTypeParser } = types2;
var AdditionalScalarColumnType = {
  NAME: 19
};
var ArrayColumnType = {
  BIT_ARRAY: 1561,
  BOOL_ARRAY: 1e3,
  BYTEA_ARRAY: 1001,
  BPCHAR_ARRAY: 1014,
  CHAR_ARRAY: 1002,
  CIDR_ARRAY: 651,
  DATE_ARRAY: 1182,
  FLOAT4_ARRAY: 1021,
  FLOAT8_ARRAY: 1022,
  INET_ARRAY: 1041,
  INT2_ARRAY: 1005,
  INT4_ARRAY: 1007,
  INT8_ARRAY: 1016,
  JSONB_ARRAY: 3807,
  JSON_ARRAY: 199,
  MONEY_ARRAY: 791,
  NUMERIC_ARRAY: 1231,
  OID_ARRAY: 1028,
  TEXT_ARRAY: 1009,
  TIMESTAMP_ARRAY: 1115,
  TIMESTAMPTZ_ARRAY: 1185,
  TIME_ARRAY: 1183,
  UUID_ARRAY: 2951,
  VARBIT_ARRAY: 1563,
  VARCHAR_ARRAY: 1015,
  XML_ARRAY: 143
};
var UnsupportedNativeDataType = class _UnsupportedNativeDataType extends Error {
  // map of type codes to type names
  static typeNames = {
    16: "bool",
    17: "bytea",
    18: "char",
    19: "name",
    20: "int8",
    21: "int2",
    22: "int2vector",
    23: "int4",
    24: "regproc",
    25: "text",
    26: "oid",
    27: "tid",
    28: "xid",
    29: "cid",
    30: "oidvector",
    32: "pg_ddl_command",
    71: "pg_type",
    75: "pg_attribute",
    81: "pg_proc",
    83: "pg_class",
    114: "json",
    142: "xml",
    194: "pg_node_tree",
    269: "table_am_handler",
    325: "index_am_handler",
    600: "point",
    601: "lseg",
    602: "path",
    603: "box",
    604: "polygon",
    628: "line",
    650: "cidr",
    700: "float4",
    701: "float8",
    705: "unknown",
    718: "circle",
    774: "macaddr8",
    790: "money",
    829: "macaddr",
    869: "inet",
    1033: "aclitem",
    1042: "bpchar",
    1043: "varchar",
    1082: "date",
    1083: "time",
    1114: "timestamp",
    1184: "timestamptz",
    1186: "interval",
    1266: "timetz",
    1560: "bit",
    1562: "varbit",
    1700: "numeric",
    1790: "refcursor",
    2202: "regprocedure",
    2203: "regoper",
    2204: "regoperator",
    2205: "regclass",
    2206: "regtype",
    2249: "record",
    2275: "cstring",
    2276: "any",
    2277: "anyarray",
    2278: "void",
    2279: "trigger",
    2280: "language_handler",
    2281: "internal",
    2283: "anyelement",
    2287: "_record",
    2776: "anynonarray",
    2950: "uuid",
    2970: "txid_snapshot",
    3115: "fdw_handler",
    3220: "pg_lsn",
    3310: "tsm_handler",
    3361: "pg_ndistinct",
    3402: "pg_dependencies",
    3500: "anyenum",
    3614: "tsvector",
    3615: "tsquery",
    3642: "gtsvector",
    3734: "regconfig",
    3769: "regdictionary",
    3802: "jsonb",
    3831: "anyrange",
    3838: "event_trigger",
    3904: "int4range",
    3906: "numrange",
    3908: "tsrange",
    3910: "tstzrange",
    3912: "daterange",
    3926: "int8range",
    4072: "jsonpath",
    4089: "regnamespace",
    4096: "regrole",
    4191: "regcollation",
    4451: "int4multirange",
    4532: "nummultirange",
    4533: "tsmultirange",
    4534: "tstzmultirange",
    4535: "datemultirange",
    4536: "int8multirange",
    4537: "anymultirange",
    4538: "anycompatiblemultirange",
    4600: "pg_brin_bloom_summary",
    4601: "pg_brin_minmax_multi_summary",
    5017: "pg_mcv_list",
    5038: "pg_snapshot",
    5069: "xid8",
    5077: "anycompatible",
    5078: "anycompatiblearray",
    5079: "anycompatiblenonarray",
    5080: "anycompatiblerange"
  };
  type;
  constructor(code) {
    super();
    this.type = _UnsupportedNativeDataType.typeNames[code] || "Unknown";
    this.message = `Unsupported column type ${this.type}`;
  }
};
function fieldToColumnType(fieldTypeId) {
  switch (fieldTypeId) {
    case ScalarColumnType.INT2:
    case ScalarColumnType.INT4:
      return ColumnTypeEnum.Int32;
    case ScalarColumnType.INT8:
      return ColumnTypeEnum.Int64;
    case ScalarColumnType.FLOAT4:
      return ColumnTypeEnum.Float;
    case ScalarColumnType.FLOAT8:
      return ColumnTypeEnum.Double;
    case ScalarColumnType.BOOL:
      return ColumnTypeEnum.Boolean;
    case ScalarColumnType.DATE:
      return ColumnTypeEnum.Date;
    case ScalarColumnType.TIME:
    case ScalarColumnType.TIMETZ:
      return ColumnTypeEnum.Time;
    case ScalarColumnType.TIMESTAMP:
    case ScalarColumnType.TIMESTAMPTZ:
      return ColumnTypeEnum.DateTime;
    case ScalarColumnType.NUMERIC:
    case ScalarColumnType.MONEY:
      return ColumnTypeEnum.Numeric;
    case ScalarColumnType.JSON:
    case ScalarColumnType.JSONB:
      return ColumnTypeEnum.Json;
    case ScalarColumnType.UUID:
      return ColumnTypeEnum.Uuid;
    case ScalarColumnType.OID:
      return ColumnTypeEnum.Int64;
    case ScalarColumnType.BPCHAR:
    case ScalarColumnType.TEXT:
    case ScalarColumnType.VARCHAR:
    case ScalarColumnType.BIT:
    case ScalarColumnType.VARBIT:
    case ScalarColumnType.INET:
    case ScalarColumnType.CIDR:
    case ScalarColumnType.XML:
    case AdditionalScalarColumnType.NAME:
      return ColumnTypeEnum.Text;
    case ScalarColumnType.BYTEA:
      return ColumnTypeEnum.Bytes;
    case ArrayColumnType.INT2_ARRAY:
    case ArrayColumnType.INT4_ARRAY:
      return ColumnTypeEnum.Int32Array;
    case ArrayColumnType.FLOAT4_ARRAY:
      return ColumnTypeEnum.FloatArray;
    case ArrayColumnType.FLOAT8_ARRAY:
      return ColumnTypeEnum.DoubleArray;
    case ArrayColumnType.NUMERIC_ARRAY:
    case ArrayColumnType.MONEY_ARRAY:
      return ColumnTypeEnum.NumericArray;
    case ArrayColumnType.BOOL_ARRAY:
      return ColumnTypeEnum.BooleanArray;
    case ArrayColumnType.CHAR_ARRAY:
      return ColumnTypeEnum.CharacterArray;
    case ArrayColumnType.BPCHAR_ARRAY:
    case ArrayColumnType.TEXT_ARRAY:
    case ArrayColumnType.VARCHAR_ARRAY:
    case ArrayColumnType.VARBIT_ARRAY:
    case ArrayColumnType.BIT_ARRAY:
    case ArrayColumnType.INET_ARRAY:
    case ArrayColumnType.CIDR_ARRAY:
    case ArrayColumnType.XML_ARRAY:
      return ColumnTypeEnum.TextArray;
    case ArrayColumnType.DATE_ARRAY:
      return ColumnTypeEnum.DateArray;
    case ArrayColumnType.TIME_ARRAY:
      return ColumnTypeEnum.TimeArray;
    case ArrayColumnType.TIMESTAMP_ARRAY:
      return ColumnTypeEnum.DateTimeArray;
    case ArrayColumnType.TIMESTAMPTZ_ARRAY:
      return ColumnTypeEnum.DateTimeArray;
    case ArrayColumnType.JSON_ARRAY:
    case ArrayColumnType.JSONB_ARRAY:
      return ColumnTypeEnum.JsonArray;
    case ArrayColumnType.BYTEA_ARRAY:
      return ColumnTypeEnum.BytesArray;
    case ArrayColumnType.UUID_ARRAY:
      return ColumnTypeEnum.UuidArray;
    case ArrayColumnType.INT8_ARRAY:
    case ArrayColumnType.OID_ARRAY:
      return ColumnTypeEnum.Int64Array;
    default:
      if (fieldTypeId >= FIRST_NORMAL_OBJECT_ID) {
        return ColumnTypeEnum.Text;
      }
      throw new UnsupportedNativeDataType(fieldTypeId);
  }
}
function normalize_array(element_normalizer) {
  return (str2) => (0, import_postgres_array.parse)(str2, element_normalizer);
}
function normalize_numeric(numeric) {
  return numeric;
}
function normalize_date(date) {
  return date;
}
function normalize_timestamp(time) {
  return `${time.replace(" ", "T")}+00:00`;
}
function normalize_timestamptz(time) {
  return time.replace(" ", "T").replace(/[+-]\d{2}(:\d{2})?$/, "+00:00");
}
function normalize_time(time) {
  return time;
}
function normalize_timez(time) {
  return time.replace(/[+-]\d{2}(:\d{2})?$/, "");
}
function normalize_money(money) {
  return money.slice(1);
}
function normalize_xml(xml) {
  return xml;
}
function toJson(json) {
  return json;
}
var parsePgBytes = getTypeParser(ScalarColumnType.BYTEA);
var normalizeByteaArray = getTypeParser(ArrayColumnType.BYTEA_ARRAY);
function convertBytes(serializedBytes) {
  return parsePgBytes(serializedBytes);
}
function normalizeBit(bit) {
  return bit;
}
var customParsers = {
  [ScalarColumnType.NUMERIC]: normalize_numeric,
  [ArrayColumnType.NUMERIC_ARRAY]: normalize_array(normalize_numeric),
  [ScalarColumnType.TIME]: normalize_time,
  [ArrayColumnType.TIME_ARRAY]: normalize_array(normalize_time),
  [ScalarColumnType.TIMETZ]: normalize_timez,
  [ScalarColumnType.DATE]: normalize_date,
  [ArrayColumnType.DATE_ARRAY]: normalize_array(normalize_date),
  [ScalarColumnType.TIMESTAMP]: normalize_timestamp,
  [ArrayColumnType.TIMESTAMP_ARRAY]: normalize_array(normalize_timestamp),
  [ScalarColumnType.TIMESTAMPTZ]: normalize_timestamptz,
  [ArrayColumnType.TIMESTAMPTZ_ARRAY]: normalize_array(normalize_timestamptz),
  [ScalarColumnType.MONEY]: normalize_money,
  [ArrayColumnType.MONEY_ARRAY]: normalize_array(normalize_money),
  [ScalarColumnType.JSON]: toJson,
  [ArrayColumnType.JSON_ARRAY]: normalize_array(toJson),
  [ScalarColumnType.JSONB]: toJson,
  [ArrayColumnType.JSONB_ARRAY]: normalize_array(toJson),
  [ScalarColumnType.BYTEA]: convertBytes,
  [ArrayColumnType.BYTEA_ARRAY]: normalizeByteaArray,
  [ArrayColumnType.BIT_ARRAY]: normalize_array(normalizeBit),
  [ArrayColumnType.VARBIT_ARRAY]: normalize_array(normalizeBit),
  [ArrayColumnType.XML_ARRAY]: normalize_array(normalize_xml)
};
function mapArg(arg, argType) {
  if (arg === null) {
    return null;
  }
  if (Array.isArray(arg) && argType.arity === "list") {
    return arg.map((value) => mapArg(value, argType));
  }
  if (typeof arg === "string" && argType.scalarType === "datetime") {
    arg = new Date(arg);
  }
  if (arg instanceof Date) {
    switch (argType.dbType) {
      case "TIME":
      case "TIMETZ":
        return formatTime(arg);
      case "DATE":
        return formatDate(arg);
      default:
        return formatDateTime(arg);
    }
  }
  if (typeof arg === "string" && argType.scalarType === "bytes") {
    return Buffer.from(arg, "base64");
  }
  if (ArrayBuffer.isView(arg)) {
    return new Uint8Array(arg.buffer, arg.byteOffset, arg.byteLength);
  }
  return arg;
}
function formatDateTime(date) {
  const pad = (n, z = 2) => String(n).padStart(z, "0");
  const ms = date.getUTCMilliseconds();
  return pad(date.getUTCFullYear(), 4) + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate()) + " " + pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes()) + ":" + pad(date.getUTCSeconds()) + (ms ? "." + String(ms).padStart(3, "0") : "");
}
function formatDate(date) {
  const pad = (n, z = 2) => String(n).padStart(z, "0");
  return pad(date.getUTCFullYear(), 4) + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate());
}
function formatTime(date) {
  const pad = (n, z = 2) => String(n).padStart(z, "0");
  const ms = date.getUTCMilliseconds();
  return pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes()) + ":" + pad(date.getUTCSeconds()) + (ms ? "." + String(ms).padStart(3, "0") : "");
}
var TLS_ERRORS = /* @__PURE__ */ new Set([
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_CRL",
  "UNABLE_TO_DECRYPT_CERT_SIGNATURE",
  "UNABLE_TO_DECRYPT_CRL_SIGNATURE",
  "UNABLE_TO_DECODE_ISSUER_PUBLIC_KEY",
  "CERT_SIGNATURE_FAILURE",
  "CRL_SIGNATURE_FAILURE",
  "CERT_NOT_YET_VALID",
  "CERT_HAS_EXPIRED",
  "CRL_NOT_YET_VALID",
  "CRL_HAS_EXPIRED",
  "ERROR_IN_CERT_NOT_BEFORE_FIELD",
  "ERROR_IN_CERT_NOT_AFTER_FIELD",
  "ERROR_IN_CRL_LAST_UPDATE_FIELD",
  "ERROR_IN_CRL_NEXT_UPDATE_FIELD",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_CHAIN_TOO_LONG",
  "CERT_REVOKED",
  "INVALID_CA",
  "INVALID_PURPOSE",
  "CERT_UNTRUSTED",
  "CERT_REJECTED",
  "HOSTNAME_MISMATCH",
  "ERR_TLS_CERT_ALTNAME_FORMAT",
  "ERR_TLS_CERT_ALTNAME_INVALID"
]);
var SOCKET_ERRORS = /* @__PURE__ */ new Set(["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT"]);
function convertDriverError(error) {
  if (isSocketError(error)) {
    return mapSocketError(error);
  }
  if (isTlsError(error)) {
    return {
      kind: "TlsConnectionError",
      reason: error.message
    };
  }
  if (isDriverError(error)) {
    return {
      originalCode: error.code,
      originalMessage: error.message,
      ...mapDriverError(error)
    };
  }
  throw error;
}
function mapDriverError(error) {
  switch (error.code) {
    case "22001":
      return {
        kind: "LengthMismatch",
        column: error.column
      };
    case "22003":
      return {
        kind: "ValueOutOfRange",
        cause: error.message
      };
    case "22P02":
      return {
        kind: "InvalidInputValue",
        message: error.message
      };
    case "23505": {
      const fields = error.detail?.match(/Key \(([^)]+)\)/)?.at(1)?.split(", ");
      return {
        kind: "UniqueConstraintViolation",
        constraint: fields !== void 0 ? { fields } : void 0
      };
    }
    case "23502": {
      const fields = error.detail?.match(/Key \(([^)]+)\)/)?.at(1)?.split(", ");
      return {
        kind: "NullConstraintViolation",
        constraint: fields !== void 0 ? { fields } : void 0
      };
    }
    case "23503": {
      let constraint;
      if (error.column) {
        constraint = { fields: [error.column] };
      } else if (error.constraint) {
        constraint = { index: error.constraint };
      }
      return {
        kind: "ForeignKeyConstraintViolation",
        constraint
      };
    }
    case "3D000":
      return {
        kind: "DatabaseDoesNotExist",
        db: error.message.split(" ").at(1)?.split('"').at(1)
      };
    case "28000":
      return {
        kind: "DatabaseAccessDenied",
        db: error.message.split(",").find((s) => s.startsWith(" database"))?.split('"').at(1)
      };
    case "28P01":
      return {
        kind: "AuthenticationFailed",
        user: error.message.split(" ").pop()?.split('"').at(1)
      };
    case "40001":
      return {
        kind: "TransactionWriteConflict"
      };
    case "42P01":
      return {
        kind: "TableDoesNotExist",
        table: error.message.split(" ").at(1)?.split('"').at(1)
      };
    case "42703": {
      const rawColumn = error.message.match(/^column (.+) does not exist$/)?.at(1);
      return {
        kind: "ColumnNotFound",
        column: rawColumn?.replace(/"((?:""|[^"])*)"/g, (_, id) => id.replaceAll('""', '"'))
      };
    }
    case "42P04":
      return {
        kind: "DatabaseAlreadyExists",
        db: error.message.split(" ").at(1)?.split('"').at(1)
      };
    case "53300":
      return {
        kind: "TooManyConnections",
        cause: error.message
      };
    default:
      return {
        kind: "postgres",
        code: error.code ?? "N/A",
        severity: error.severity ?? "N/A",
        message: error.message,
        detail: error.detail,
        column: error.column,
        hint: error.hint
      };
  }
}
function isDriverError(error) {
  return typeof error.code === "string" && typeof error.message === "string" && typeof error.severity === "string" && (typeof error.detail === "string" || error.detail === void 0) && (typeof error.column === "string" || error.column === void 0) && (typeof error.hint === "string" || error.hint === void 0);
}
function mapSocketError(error) {
  switch (error.code) {
    case "ENOTFOUND":
    case "ECONNREFUSED":
      return {
        kind: "DatabaseNotReachable",
        host: error.address ?? error.hostname,
        port: error.port
      };
    case "ECONNRESET":
      return {
        kind: "ConnectionClosed"
      };
    case "ETIMEDOUT":
      return {
        kind: "SocketTimeout"
      };
  }
}
function isSocketError(error) {
  return typeof error.code === "string" && typeof error.syscall === "string" && typeof error.errno === "number" && SOCKET_ERRORS.has(error.code);
}
function isTlsError(error) {
  if (typeof error.code === "string") {
    return TLS_ERRORS.has(error.code);
  }
  switch (error.message) {
    case "The server does not support SSL connections":
    case "There was an error establishing an SSL connection":
      return true;
  }
  return false;
}
var types22 = esm_default.types;
var debug2 = Debug("prisma:driver-adapter:pg");
var PgQueryable = class {
  constructor(client2, pgOptions) {
    this.client = client2;
    this.pgOptions = pgOptions;
  }
  provider = "postgres";
  adapterName = name;
  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query) {
    const tag = "[js::query_raw]";
    debug2(`${tag} %O`, query);
    const { fields, rows } = await this.performIO(query);
    const columnNames = fields.map((field) => field.name);
    let columnTypes = [];
    try {
      columnTypes = fields.map((field) => fieldToColumnType(field.dataTypeID));
    } catch (e) {
      if (e instanceof UnsupportedNativeDataType) {
        throw new DriverAdapterError({
          kind: "UnsupportedNativeDataType",
          type: e.type
        });
      }
      throw e;
    }
    const udtParser = this.pgOptions?.userDefinedTypeParser;
    if (udtParser) {
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (field.dataTypeID >= FIRST_NORMAL_OBJECT_ID && !Object.hasOwn(customParsers, field.dataTypeID)) {
          for (let j = 0; j < rows.length; j++) {
            rows[j][i] = await udtParser(field.dataTypeID, rows[j][i], this);
          }
        }
      }
    }
    return {
      columnNames,
      columnTypes,
      rows
    };
  }
  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query) {
    const tag = "[js::execute_raw]";
    debug2(`${tag} %O`, query);
    return (await this.performIO(query)).rowCount ?? 0;
  }
  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  async performIO(query) {
    const { sql, args } = query;
    const values = args.map((arg, i) => mapArg(arg, query.argTypes[i]));
    try {
      const result = await this.client.query(
        {
          name: this.pgOptions?.statementNameGenerator?.(query),
          text: sql,
          values,
          rowMode: "array",
          types: {
            getTypeParser: (oid, format) => {
              if (format === "text" && customParsers[oid]) {
                return customParsers[oid];
              }
              return types22.getTypeParser(oid, format);
            }
          }
        },
        values
      );
      return result;
    } catch (e) {
      this.onError(e);
    }
  }
  onError(error) {
    debug2("Error in performIO: %O", error);
    throw new DriverAdapterError(convertDriverError(error));
  }
};
var PgTransaction = class extends PgQueryable {
  constructor(client2, options, pgOptions, cleanup) {
    super(client2, pgOptions);
    this.options = options;
    this.pgOptions = pgOptions;
    this.cleanup = cleanup;
  }
  async commit() {
    debug2(`[js::commit]`);
    this.cleanup?.();
    this.client.release();
  }
  async rollback() {
    debug2(`[js::rollback]`);
    this.cleanup?.();
    this.client.release();
  }
  async createSavepoint(name2) {
    await this.executeRaw({ sql: `SAVEPOINT ${name2}`, args: [], argTypes: [] });
  }
  async rollbackToSavepoint(name2) {
    await this.executeRaw({ sql: `ROLLBACK TO SAVEPOINT ${name2}`, args: [], argTypes: [] });
  }
  async releaseSavepoint(name2) {
    await this.executeRaw({ sql: `RELEASE SAVEPOINT ${name2}`, args: [], argTypes: [] });
  }
};
var PrismaPgAdapter = class extends PgQueryable {
  constructor(client2, pgOptions, release) {
    super(client2);
    this.pgOptions = pgOptions;
    this.release = release;
  }
  async startTransaction(isolationLevel) {
    const options = {
      usePhantomQuery: false
    };
    const tag = "[js::startTransaction]";
    debug2("%s options: %O", tag, options);
    const conn = await this.client.connect().catch((error) => this.onError(error));
    const onError = (err) => {
      debug2(`Error from pool connection: ${err.message} %O`, err);
      this.pgOptions?.onConnectionError?.(err);
    };
    conn.on("error", onError);
    const cleanup = () => {
      conn.removeListener("error", onError);
    };
    try {
      const tx = new PgTransaction(conn, options, this.pgOptions, cleanup);
      await tx.executeRaw({ sql: "BEGIN", args: [], argTypes: [] });
      if (isolationLevel) {
        await tx.executeRaw({
          sql: `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
          args: [],
          argTypes: []
        });
      }
      return tx;
    } catch (error) {
      cleanup();
      conn.release(error);
      this.onError(error);
    }
  }
  async executeScript(script) {
    const statements = script.split(";").map((stmt) => stmt.trim()).filter((stmt) => stmt.length > 0);
    for (const stmt of statements) {
      try {
        await this.client.query(stmt);
      } catch (error) {
        this.onError(error);
      }
    }
  }
  getConnectionInfo() {
    return {
      schemaName: this.pgOptions?.schema,
      supportsRelationJoins: true
    };
  }
  async dispose() {
    return this.release?.();
  }
  underlyingDriver() {
    return this.client;
  }
};
var PrismaPgAdapterFactory = class {
  constructor(poolOrConfig, options) {
    this.options = options;
    if (poolOrConfig instanceof esm_default.Pool) {
      this.externalPool = poolOrConfig;
      this.config = poolOrConfig.options;
    } else if (typeof poolOrConfig === "string") {
      this.externalPool = null;
      this.config = { connectionString: poolOrConfig };
    } else {
      this.externalPool = null;
      this.config = poolOrConfig;
    }
  }
  provider = "postgres";
  adapterName = name;
  config;
  externalPool;
  async connect() {
    const client2 = this.externalPool ?? new esm_default.Pool(this.config);
    const onIdleClientError = (err) => {
      debug2(`Error from idle pool client: ${err.message} %O`, err);
      this.options?.onPoolError?.(err);
    };
    client2.on("error", onIdleClientError);
    return new PrismaPgAdapter(client2, this.options, async () => {
      if (this.externalPool) {
        if (this.options?.disposeExternalPool) {
          await this.externalPool.end();
          this.externalPool = null;
        } else {
          this.externalPool.removeListener("error", onIdleClientError);
        }
      } else {
        await client2.end();
      }
    });
  }
  async connectToShadowDb() {
    const conn = await this.connect();
    const database = `prisma_migrate_shadow_db_${globalThis.crypto.randomUUID()}`;
    await conn.executeScript(`CREATE DATABASE "${database}"`);
    const client2 = new esm_default.Pool({ ...this.config, database });
    return new PrismaPgAdapter(client2, void 0, async () => {
      await conn.executeScript(`DROP DATABASE "${database}"`);
      await client2.end();
    });
  }
};

// src/lib/db/prisma.ts
var client = null;
function getPrisma() {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL manquante : PostgreSQL non configur\xE9 (Gedify tourne en GEDIFY_STORAGE_MODE=json par d\xE9faut)."
      );
    }
    client = new PrismaClient({ adapter: new PrismaPgAdapterFactory({ connectionString }) });
  }
  return client;
}
async function disconnectPrisma() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}

// scripts/backup-json.ts
import { copyFileSync, mkdirSync } from "node:fs";
import path3 from "node:path";

// scripts/_shared.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import path2 from "node:path";
function dataDir() {
  return process.env.JSON_DATA_DIR?.trim() || process.env.DATA_DIR?.trim() || process.env.APP_DATA_DIR?.trim() || path2.join(process.cwd(), ".data");
}
var SKIP_DIRS = /* @__PURE__ */ new Set(["backups", "node_modules", ".next", ".git", "media", "tessdata"]);
function findJsonFiles(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name2 of entries) {
      const full = path2.join(dir, name2);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name2)) walk(full);
      } else if (name2.endsWith(".json")) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}
function findByBasename(root, basename) {
  return findJsonFiles(root).find((f) => path2.basename(f) === basename) ?? null;
}
function loadJson(file) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(file, "utf8")) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
function loadArray(root, basename) {
  const file = findByBasename(root, basename);
  if (!file) return [];
  const res = loadJson(file);
  return res.ok && Array.isArray(res.data) ? res.data : [];
}
function entryCount(data) {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") return Object.keys(data).length;
  return data == null ? 0 : 1;
}
function timestamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
function toDate(v) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// scripts/backup-json.ts
function backupJson() {
  const root = dataDir();
  const backupDir = path3.join(root, "backups", `json-before-migration-${timestamp()}`);
  const files = findJsonFiles(root);
  for (const file of files) {
    const rel = path3.relative(root, file);
    const dest = path3.join(backupDir, rel);
    mkdirSync(path3.dirname(dest), { recursive: true });
    copyFileSync(file, dest);
  }
  return { backupDir, count: files.length };
}
function main() {
  const { backupDir, count } = backupJson();
  console.log(`
\u{1F4BE} Sauvegarde JSON : ${count} fichier(s) copi\xE9(s) dans
   ${backupDir}
(les sources ne sont PAS supprim\xE9es)
`);
}
if (process.argv[1] && process.argv[1].includes("backup-json")) {
  main();
}

// scripts/migrate-json.ts
var DRY = process.argv.includes("--dry-run");
var str = (v) => v == null ? null : String(v);
var obj = (v) => v && typeof v === "object" ? v : {};
var jsonVal = (v) => JSON.parse(JSON.stringify(v ?? null));
var countersSnapshot = {};
var MIGRATORS = [
  {
    table: "tags",
    file: "tags.json",
    async run({ root, prisma, dry, stat }) {
      for (const t of loadArray(root, "tags.json")) {
        stat.read++;
        const id = num(t.id);
        if (id == null) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { name: str(t.name), slug: str(t.slug), color: str(t.color), textColor: str(t.text_color), raw: jsonVal(t) };
          await prisma.tag.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "document_types",
    file: "document_types.json",
    async run({ root, prisma, dry, stat }) {
      for (const t of loadArray(root, "document_types.json")) {
        stat.read++;
        const id = num(t.id);
        if (id == null) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { name: str(t.name), slug: str(t.slug), raw: jsonVal(t) };
          await prisma.documentType.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "correspondents",
    file: "correspondents.json",
    async run({ root, prisma, dry, stat }) {
      for (const c of loadArray(root, "correspondents.json")) {
        stat.read++;
        const id = num(c.id);
        if (id == null) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { name: str(c.name), slug: str(c.slug), raw: jsonVal(c) };
          await prisma.correspondent.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "documents (+ ocr, files, tags, correspondents)",
    file: "documents.json",
    async run({ root, prisma, dry, stat }) {
      for (const d of loadArray(root, "documents.json")) {
        stat.read++;
        const id = num(d.id);
        if (id == null) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = {
            title: str(d.title),
            content: str(d.content),
            created: toDate(d.created),
            createdDate: str(d.created_date),
            added: toDate(d.added),
            modified: toDate(d.modified),
            correspondentId: num(d.correspondent),
            documentTypeId: num(d.document_type),
            storagePath: str(d.storage_path),
            mimeType: str(d.mime_type),
            checksum: str(d.checksum),
            storedFilename: str(d.storedFilename),
            originalFileName: str(d.original_file_name),
            pageCount: num(d.page_count),
            deleted: d.deleted === true,
            deletedAt: toDate(d.deletedAt),
            raw: jsonVal(d)
          };
          await prisma.document.upsert({ where: { id }, create: { id, ...data }, update: data });
          await prisma.documentOcr.upsert({
            where: { documentId: id },
            create: { documentId: id, content: str(d.content), raw: jsonVal({ content: d.content ?? null }) },
            update: { content: str(d.content) }
          });
          if (d.storedFilename) {
            const fid = `${id}:original`;
            await prisma.documentFile.upsert({
              where: { id: fid },
              create: { id: fid, documentId: id, kind: "original", filename: String(d.storedFilename), mimeType: str(d.mime_type), raw: jsonVal(null) },
              update: { filename: String(d.storedFilename), mimeType: str(d.mime_type) }
            });
          }
          if (Array.isArray(d.tags)) {
            for (const t of d.tags) {
              const tid = num(t);
              if (tid != null) {
                await prisma.documentTag.upsert({
                  where: { documentId_tagId: { documentId: id, tagId: tid } },
                  create: { documentId: id, tagId: tid },
                  update: {}
                });
              }
            }
          }
          const cid = num(d.correspondent);
          if (cid != null) {
            await prisma.documentCorrespondent.upsert({
              where: { documentId_correspondentId: { documentId: id, correspondentId: cid } },
              create: { documentId: id, correspondentId: cid, role: "primary" },
              update: {}
            });
          }
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "folders (+ folder_documents)",
    file: "project-folders.json",
    async run({ root, prisma, dry, stat }) {
      for (const f of loadArray(root, "project-folders.json")) {
        stat.read++;
        const id = str(f.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { parentId: str(f.parentId), name: str(f.name), slug: str(f.slug), color: str(f.color), category: str(f.category), status: str(f.status), raw: jsonVal(f) };
          await prisma.folder.upsert({ where: { id }, create: { id, ...data }, update: data });
          if (Array.isArray(f.linkedDocumentIds)) {
            for (const docId of f.linkedDocumentIds) {
              const did = num(docId);
              if (did != null) {
                await prisma.folderDocument.upsert({
                  where: { folderId_documentId: { folderId: id, documentId: did } },
                  create: { folderId: id, documentId: did },
                  update: {}
                });
              }
            }
          }
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "budget_entries (+ payments)",
    file: "financial-items.json",
    async run({ root, prisma, dry, stat }) {
      for (const e of loadArray(root, "financial-items.json")) {
        stat.read++;
        const id = str(e.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = {
            kind: str(e.kind),
            direction: str(e.direction),
            label: str(e.label),
            amount: num(e.amount),
            amountPaid: num(e.amountPaid),
            dueDate: str(e.dueDate),
            status: str(e.status),
            categoryId: str(e.categoryId),
            categoryName: str(e.categoryName),
            sourceDocumentId: num(e.sourceDocumentId),
            raw: jsonVal(e)
          };
          await prisma.budgetEntry.upsert({ where: { id }, create: { id, ...data }, update: data });
          if (Array.isArray(e.payments)) {
            for (const [i, p] of e.payments.entries()) {
              const po = obj(p);
              const pid = str(po.id) ?? `${id}:${i}`;
              await prisma.budgetPayment.upsert({
                where: { id: pid },
                create: { id: pid, budgetEntryId: id, amount: num(po.amount), date: str(po.date), account: str(po.account), raw: jsonVal(po) },
                update: { amount: num(po.amount), date: str(po.date) }
              });
            }
          }
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "mails",
    file: "email-messages.json",
    async run({ root, prisma, dry, stat }) {
      for (const m of loadArray(root, "email-messages.json")) {
        stat.read++;
        const id = str(m.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = {
            accountId: str(m.accountId),
            messageId: str(m.messageId),
            threadId: str(m.threadId),
            fromAddr: str(m.from),
            toAddr: str(m.to),
            subject: str(m.subject),
            date: toDate(m.date),
            snippet: str(m.text)?.slice(0, 400) ?? null,
            body: str(m.text),
            hasAttachments: m.hasAttachments === true,
            raw: jsonVal(m)
          };
          await prisma.mail.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "mail_document_links",
    file: "mail-document-links.json",
    async run({ root, prisma, dry, stat }) {
      for (const l of loadArray(root, "mail-document-links.json")) {
        stat.read++;
        const id = str(l.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = {
            accountId: str(l.accountId),
            mailId: str(l.mailId),
            threadId: str(l.threadId),
            documentId: num(l.paperlessDocumentId),
            filename: str(l.filename),
            status: str(l.status),
            kind: "attachment",
            raw: jsonVal(l)
          };
          await prisma.mailDocumentLink.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
      for (const l of loadArray(root, "email-ged-links.json")) {
        const target = obj(l.target);
        stat.read++;
        const id = str(l.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const documentId = target.kind === "document" ? num(target.documentId) : null;
          const data = { accountId: str(l.accountId), mailId: str(l.emailId), threadId: str(l.emailId), documentId, filename: null, status: str(l.scope), kind: "ged-link", raw: jsonVal(l) };
          await prisma.mailDocumentLink.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "reminders",
    file: "reminders.json",
    async run({ root, prisma, dry, stat }) {
      for (const r of loadArray(root, "reminders.json")) {
        stat.read++;
        const id = str(r.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { title: str(r.title), remindAt: toDate(r.remindAt), status: str(r.status), documentId: num(r.documentId), financialItemId: str(r.financialItemId), raw: jsonVal(r) };
          await prisma.reminder.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "tasks",
    file: "actions.json",
    async run({ root, prisma, dry, stat }) {
      for (const a of loadArray(root, "actions.json")) {
        stat.read++;
        const id = str(a.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { title: str(a.title), status: str(a.status), priority: str(a.priority), dueDate: str(a.dueDate), raw: jsonVal(a) };
          await prisma.task.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "document_ai_analyses",
    file: "analyses.json",
    async run({ root, prisma, dry, stat }) {
      for (const a of loadArray(root, "analyses.json")) {
        stat.read++;
        const id = str(a.id);
        const did = num(a.documentId);
        if (!id || did == null) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { documentId: did, summary: str(a.summary), confidence: str(a.confidence), source: str(a.source), analyzedAt: toDate(a.analyzedAt), raw: jsonVal(a) };
          await prisma.documentAiAnalysis.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "learned_templates",
    file: "learned-templates.json",
    async run({ root, prisma, dry, stat }) {
      for (const t of loadArray(root, "learned-templates.json")) {
        stat.read++;
        const id = str(t.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { label: str(t.label) ?? str(t.name), raw: jsonVal(t) };
          await prisma.learnedTemplate.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "activity_logs",
    file: "ged-logs.json",
    async run({ root, prisma, dry, stat }) {
      for (const l of loadArray(root, "ged-logs.json")) {
        stat.read++;
        const id = str(l.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { level: str(l.level), source: str(l.source), message: str(l.message), documentId: num(l.documentId), projectId: str(l.projectId), user: str(l.user), raw: jsonVal(l), createdAt: toDate(l.createdAt) ?? /* @__PURE__ */ new Date() };
          await prisma.activityLog.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "signatures",
    file: "document-signatures.json",
    async run({ root, prisma, dry, stat }) {
      const sources = [
        { file: "document-signatures.json", scope: "document" },
        { file: "email-signatures.json", scope: "email" },
        { file: "signatures.json", scope: "writer" }
        // index signatures rédaction (image sur disque)
      ];
      for (const src of sources) {
        for (const s of loadArray(root, src.file)) {
          stat.read++;
          const id = str(s.id);
          if (!id) {
            stat.skipped++;
            continue;
          }
          if (!dry && prisma) {
            const data = { scope: src.scope, documentId: num(s.documentId), raw: jsonVal(s) };
            await prisma.signature.upsert({ where: { id }, create: { id, ...data }, update: data });
          }
          stat.migrated++;
        }
      }
    }
  },
  {
    table: "users",
    file: "users.json",
    async run({ root, prisma, dry, stat }) {
      for (const u of loadArray(root, "users.json")) {
        stat.read++;
        const id = num(u.id);
        const username = str(u.username);
        if (id == null || !username) {
          stat.skipped++;
          stat.errors.push(`user sans id/username ignor\xE9 (id=${id ?? "?"}, username=${username ?? "?"})`);
          continue;
        }
        if (!dry && prisma) {
          const data = {
            username,
            email: u.email ? String(u.email) : null,
            passwordHash: str(u.passwordHash),
            isSuperuser: u.is_superuser === true,
            isActive: u.is_active !== false,
            metadata: jsonVal(u)
          };
          await prisma.user.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "counters",
    file: "counters.json",
    async run({ root, prisma, dry, stat }) {
      const counters = readObject(root, "counters.json");
      if (!counters) return;
      countersSnapshot = {};
      for (const [name2, value] of Object.entries(counters)) {
        stat.read++;
        const v = num(value) ?? 0;
        countersSnapshot[name2] = v;
        if (!dry && prisma) {
          await prisma.counter.upsert({ where: { name: name2 }, create: { name: name2, value: v }, update: { value: v } });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "document_ai_suggestions (detected-infos)",
    file: "detected-infos.json",
    async run({ root, prisma, dry, stat }) {
      for (const di of loadArray(root, "detected-infos.json")) {
        stat.read++;
        const id = str(di.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = {
            documentId: num(di.sourceDocumentId),
            analysisId: str(di.sourceAnalysisId),
            suggestionType: str(di.kind),
            fieldName: str(di.fieldKey) ?? str(di.label),
            suggestedValue: str(di.value) ?? str(di.normalizedValue) ?? str(di.textValue) ?? (di.amount != null ? String(di.amount) : null),
            confidence: str(di.confidence),
            source: str(di.source),
            rawPayload: jsonVal(di)
          };
          await prisma.documentAiSuggestion.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "document_title_overrides",
    file: "document-title-overrides.json",
    async run({ root, prisma, dry, stat }) {
      for (const o of loadArray(root, "document-title-overrides.json")) {
        stat.read++;
        const did = num(o.documentId);
        if (did == null) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { title: str(o.displayTitle), source: str(o.source), metadata: jsonVal(o) };
          await prisma.documentTitleOverride.upsert({ where: { documentId: did }, create: { documentId: did, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "email_contacts",
    file: "email-contacts.json",
    async run({ root, prisma, dry, stat }) {
      for (const c of loadArray(root, "email-contacts.json")) {
        stat.read++;
        const id = str(c.resourceName) ?? str(c.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const emails = Array.isArray(c.emails) ? c.emails : [];
          const data = {
            name: str(c.displayName),
            email: str(c.email) ?? (emails[0] != null ? String(emails[0]) : null),
            displayName: str(c.displayName),
            source: str(c.source),
            metadata: jsonVal(c)
          };
          await prisma.emailContact.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "mail_accounts",
    file: "accounts.json",
    async run({ root, prisma, dry, stat }) {
      for (const a of loadArray(root, "accounts.json")) {
        stat.read++;
        const id = str(a.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = {
            provider: str(a.provider),
            email: str(a.email),
            displayName: str(a.name),
            status: str(a.status),
            scopes: a.scopes != null ? jsonVal(a.scopes) : null,
            metadata: jsonVal(a)
          };
          await prisma.mailAccount.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "mail_oauth_tokens",
    file: "gmail-tokens.json",
    async run({ root, prisma, dry, stat }) {
      for (const t of loadArray(root, "gmail-tokens.json")) {
        stat.read++;
        const id = str(t.accountId);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const scopes = Array.isArray(t.scopes) ? t.scopes.join(" ") : null;
          const expiry = typeof t.accessTokenExpiresAt === "number" ? new Date(t.accessTokenExpiresAt) : null;
          const data = {
            accountId: id,
            provider: "gmail",
            email: str(t.email),
            accessTokenEncrypted: str(t.cachedAccessToken),
            refreshTokenEncrypted: str(t.encryptedRefreshToken),
            expiryDate: expiry,
            scope: scopes,
            tokenType: "Bearer",
            metadata: jsonVal(t)
          };
          await prisma.mailOauthToken.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "saved_signatures",
    file: "document-saved-signatures.json",
    async run({ root, prisma, dry, stat }) {
      for (const s of loadArray(root, "document-saved-signatures.json")) {
        stat.read++;
        const id = str(s.id);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = { label: str(s.name), type: str(s.kind), imageData: str(s.dataUrl), metadata: jsonVal(s) };
          await prisma.savedSignature.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "hidden_senders",
    file: "hidden-senders.json",
    async run({ root, prisma, dry, stat }) {
      for (const h of loadArray(root, "hidden-senders.json")) {
        stat.read++;
        const id = str(h.id) ?? str(h.email);
        if (!id) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const email = str(h.email);
          const domain = email && email.includes("@") ? email.split("@")[1] : null;
          const data = { email, domain, reason: str(h.reason), metadata: jsonVal(h) };
          await prisma.hiddenSender.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "custom_fields",
    file: "custom_fields.json",
    async run({ root, prisma, dry, stat }) {
      for (const f of loadArray(root, "custom_fields.json")) {
        stat.read++;
        const id = num(f.id);
        if (id == null) {
          stat.skipped++;
          continue;
        }
        if (!dry && prisma) {
          const data = {
            name: str(f.name),
            label: str(f.label) ?? str(f.name),
            type: str(f.data_type) ?? str(f.type),
            options: f.extra_data != null ? jsonVal(f.extra_data) : null,
            required: f.required === true,
            metadata: jsonVal(f)
          };
          await prisma.customField.upsert({ where: { id }, create: { id, ...data }, update: data });
        }
        stat.migrated++;
      }
    }
  },
  {
    table: "document_correspondents (secondaires)",
    file: "document-secondary-correspondents.json",
    async run({ root, prisma, dry, stat }) {
      for (const e of loadArray(root, "document-secondary-correspondents.json")) {
        const did = num(e.documentId);
        const ids = Array.isArray(e.correspondentIds) ? e.correspondentIds : [];
        if (did == null) {
          stat.skipped++;
          continue;
        }
        for (const cidRaw of ids) {
          const cid = num(cidRaw);
          if (cid == null) continue;
          stat.read++;
          if (!dry && prisma) {
            await prisma.documentCorrespondent.upsert({
              where: { documentId_correspondentId: { documentId: did, correspondentId: cid } },
              create: { documentId: did, correspondentId: cid, role: "secondary" },
              update: {}
            });
          }
          stat.migrated++;
        }
      }
    }
  },
  {
    table: "settings",
    file: "assistant-settings.json",
    async run({ root, prisma, dry, stat }) {
      const keys = ["assistant-settings"];
      for (const key of keys) {
        const value = readObject(root, `${key}.json`);
        if (value == null) continue;
        stat.read++;
        if (!dry && prisma) {
          const v = JSON.parse(JSON.stringify(value));
          await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
        }
        stat.migrated++;
      }
    }
  }
];
var COVERED = /* @__PURE__ */ new Set([
  ...MIGRATORS.map((m) => m.file),
  "email-ged-links.json",
  // lu par mail_document_links
  "email-signatures.json",
  // lu par signatures
  "signatures.json"
  // index signatures rédaction → signatures (scope=writer)
]);
var CLASSIFY = {
  "tasks.json": { level: "\xE9ph\xE9m\xE8re", reason: "t\xE2ches de traitement moteur (OCR/ingestion) \u2014 volontairement non migr\xE9" },
  "document-notes.json": { level: "important", reason: "notes utilisateur sur documents" },
  "categories.json": { level: "mineur", reason: "cat\xE9gories budget" },
  "ged-views.json": { level: "mineur", reason: "vues sauvegard\xE9es" },
  "document-events.json": { level: "mineur", reason: "\xE9v\xE9nements documents" },
  "correction-memory.json": { level: "mineur", reason: "m\xE9moire de corrections IA" },
  "mail-suppressed-attachments.json": { level: "mineur", reason: "pi\xE8ces jointes supprim\xE9es" },
  "scheduled-emails.json": { level: "mineur", reason: "emails programm\xE9s" }
};
function scanUncovered(root) {
  const out = [];
  for (const f of findJsonFiles(root)) {
    const base = path4.basename(f);
    if (COVERED.has(base)) continue;
    const res = loadJson(f);
    const entries = res.ok ? entryCount(res.data) : 0;
    let { level, reason } = CLASSIFY[base] ?? { level: "\xE0 examiner", reason: "non mapp\xE9 \u2014 \xE0 classer" };
    if (entries === 0) {
      level = "vide";
      reason = "fichier vide \u2014 ignor\xE9 volontairement";
    }
    out.push({ file: path4.relative(root, f), entries, level, reason });
  }
  const order = ["critique", "important", "\xE0 examiner", "mineur", "vide", "\xE9ph\xE9m\xE8re", "ignor\xE9"];
  return out.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
}
function readObject(root, basename) {
  const file = findByBasename(root, basename);
  if (!file) return null;
  const res = loadJson(file);
  return res.ok && res.data && typeof res.data === "object" && !Array.isArray(res.data) ? res.data : null;
}
async function main2() {
  const root = dataDir();
  console.log(`
\u{1F5C4}\uFE0F  Migration JSON \u2192 PostgreSQL${DRY ? "  (DRY-RUN \u2014 aucune \xE9criture)" : ""}`);
  console.log(`Data-dir : ${root}
`);
  let backupDir = null;
  if (!DRY) {
    if (!process.env.DATABASE_URL) {
      console.error("\u274C DATABASE_URL absente. Configure-la avant la migration r\xE9elle.");
      process.exit(1);
    }
    const b = backupJson();
    backupDir = b.backupDir;
    console.log(`\u{1F4BE} Backup auto : ${b.count} JSON \u2192 ${b.backupDir}
`);
  }
  const prisma = DRY ? null : getPrisma();
  const report = {};
  for (const m of MIGRATORS) {
    const stat = { read: 0, migrated: 0, skipped: 0, errors: [] };
    try {
      await m.run({ root, prisma, dry: DRY, stat });
    } catch (e) {
      stat.errors.push(e instanceof Error ? e.message : String(e));
    }
    report[m.table] = stat;
    const flag = stat.errors.length ? `\u26A0 ${stat.errors.length} err` : "";
    console.log(`${m.table.padEnd(34)} lu ${String(stat.read).padStart(5)}  ${DRY ? "\xE0 migrer" : "migr\xE9"} ${String(stat.migrated).padStart(5)}  ignor\xE9 ${String(stat.skipped).padStart(3)}  ${flag}`);
    if (stat.errors.length) stat.errors.slice(0, 3).forEach((e) => console.log(`    \u2514\u2500 ${e}`));
  }
  const totals = Object.values(report).reduce(
    (acc, s) => ({ read: acc.read + s.read, migrated: acc.migrated + s.migrated, skipped: acc.skipped + s.skipped, errors: acc.errors + s.errors.length }),
    { read: 0, migrated: 0, skipped: 0, errors: 0 }
  );
  const uncovered = scanUncovered(root);
  const SAFE = (u) => u.level === "\xE9ph\xE9m\xE8re" || u.level === "ignor\xE9" || u.level === "vide";
  const voluntarilyIgnored = uncovered.filter(SAFE);
  const needsAttention = uncovered.filter((u) => !SAFE(u));
  const blocking = needsAttention.filter((u) => u.level === "critique" || u.level === "important");
  console.log(`
\u{1F522} Counters migr\xE9s : ${Object.entries(countersSnapshot).map(([k, v]) => `${k}=${v}`).join(", ") || "(aucun)"}`);
  if (needsAttention.length) {
    console.log(`
\u26A0\uFE0F  Fichiers NON couverts AVEC donn\xE9es (${needsAttention.length}) \u2014 \xE0 traiter avant la migration r\xE9elle :`);
    for (const u of needsAttention) console.log(`   [${u.level.padEnd(11)}] ${u.file} (${u.entries})  \u2014 ${u.reason}`);
  } else {
    console.log("\n\u2705 Aucun fichier important / \xE0 examiner avec donn\xE9es laiss\xE9 de c\xF4t\xE9.");
  }
  if (voluntarilyIgnored.length) {
    console.log(`
\u2139\uFE0F  Ignor\xE9s volontairement (${voluntarilyIgnored.length}) :`);
    for (const u of voluntarilyIgnored) console.log(`   [${u.level.padEnd(11)}] ${u.file} (${u.entries})  \u2014 ${u.reason}`);
  }
  const reportObj = {
    startedAt: (/* @__PURE__ */ new Date()).toISOString(),
    dryRun: DRY,
    dataDir: root,
    backupDir,
    totals,
    counters: countersSnapshot,
    tables: report,
    voluntarilyIgnored,
    uncovered: needsAttention,
    dataLoss: false,
    readyForRealMigration: needsAttention.length === 0,
    note: "Upsert idempotent (r\xE9ex\xE9cutable sans doublon). Aucun JSON source supprim\xE9. Tokens/secrets jamais logg\xE9s."
  };
  const dir = path4.join(root, "backups");
  mkdirSync2(dir, { recursive: true });
  const reportFile = path4.join(dir, `${DRY ? "migration-dryrun" : "migration-report"}-${timestamp()}.json`);
  writeFileSync(reportFile, JSON.stringify(reportObj, null, 2));
  console.log(`
\u{1F4CA} Total : lu ${totals.read}, ${DRY ? "\xE0 migrer" : "migr\xE9"} ${totals.migrated}, ignor\xE9 ${totals.skipped}, erreurs ${totals.errors}, perte de donn\xE9es : non`);
  console.log(`\u{1F4C4} Rapport : ${reportFile}`);
  if (needsAttention.length === 0 && totals.errors === 0) {
    console.log("\n\u2705 PR\xCAT pour la migration r\xE9elle (aucun fichier important/\xE0 examiner non couvert).");
  } else {
    console.log(`
\u26D4 PAS pr\xEAt : ${blocking.length} important(s)/critique(s) + ${needsAttention.length - blocking.length} \xE0 examiner/mineur(s) avec donn\xE9es. \xC0 couvrir d'abord.`);
  }
  console.log("\nLes JSON sources n'ont PAS \xE9t\xE9 supprim\xE9s.\n");
  if (prisma) await disconnectPrisma();
}
main2().catch((e) => {
  console.error(e);
  process.exit(1);
});
