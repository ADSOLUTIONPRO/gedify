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
  "inlineSchema": '// Sch\xE9ma PostgreSQL de Gedify (int\xE9gration progressive, sans casser le JSON).\n// Chaque table a des colonnes \xAB requ\xEAtables \xBB + une colonne `raw Json` qui\n// conserve l\'objet JSON d\'origine INT\xC9GRAL \u2192 migration sans perte de donn\xE9es.\n// Prisma 7 : client TypeScript + driver adapter (pg), pas de moteur natif runtime.\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../src/generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\n/**\n * \u2500\u2500 Documents & taxonomies \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Document {\n  id               Int       @id\n  title            String?\n  content          String?   @db.Text\n  created          DateTime?\n  createdDate      String?   @map("created_date")\n  added            DateTime?\n  modified         DateTime?\n  correspondentId  Int?      @map("correspondent_id")\n  documentTypeId   Int?      @map("document_type_id")\n  storagePath      String?   @map("storage_path")\n  mimeType         String?   @map("mime_type")\n  checksum         String?\n  storedFilename   String?   @map("stored_filename")\n  originalFileName String?   @map("original_file_name")\n  pageCount        Int?      @map("page_count")\n  deleted          Boolean   @default(false)\n  deletedAt        DateTime? @map("deleted_at")\n  raw              Json?\n  tenantId         String?   @map("tenant_id") // multi-tenant Phase 2 (nullable, gated MULTI_TENANT)\n  createdAt        DateTime  @default(now()) @map("created_at")\n  updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@index([correspondentId])\n  @@index([documentTypeId])\n  @@index([deleted])\n  @@index([checksum])\n  @@index([tenantId])\n  @@map("documents")\n}\n\nmodel DocumentFile {\n  id         String  @id\n  documentId Int     @map("document_id")\n  kind       String  @default("original") // original | thumbnail\n  filename   String?\n  mimeType   String? @map("mime_type")\n  sizeBytes  Int?    @map("size_bytes")\n  raw        Json?\n  tenantId   String? @map("tenant_id") // multi-tenant Phase 2 (nullable, gated MULTI_TENANT)\n\n  @@index([documentId])\n  @@index([tenantId])\n  @@map("document_files")\n}\n\nmodel DocumentVersion {\n  id         String   @id\n  documentId Int      @map("document_id")\n  label      String?\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@index([documentId])\n  @@map("document_versions")\n}\n\nmodel DocumentOcr {\n  documentId Int     @id @map("document_id")\n  content    String? @db.Text\n  raw        Json?\n\n  @@map("document_ocr")\n}\n\nmodel DocumentAiAnalysis {\n  id         String    @id\n  documentId Int       @map("document_id")\n  summary    String?   @db.Text\n  confidence String?\n  source     String?\n  analyzedAt DateTime? @map("analyzed_at")\n  raw        Json?\n  createdAt  DateTime  @default(now()) @map("created_at")\n\n  @@index([documentId])\n  @@map("document_ai_analyses")\n}\n\nmodel DocumentAiSuggestion {\n  id             String   @id\n  documentId     Int?     @map("document_id")\n  analysisId     String?  @map("analysis_id")\n  suggestionType String?  @map("suggestion_type")\n  fieldName      String?  @map("field_name")\n  suggestedValue String?  @map("suggested_value") @db.Text\n  confidence     String?\n  source         String?\n  applied        Boolean  @default(false)\n  rawPayload     Json?    @map("raw_payload")\n  createdAt      DateTime @default(now()) @map("created_at")\n  updatedAt      DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@index([documentId])\n  @@index([analysisId])\n  @@map("document_ai_suggestions")\n}\n\nmodel Tag {\n  id        Int     @id\n  name      String?\n  slug      String?\n  color     String?\n  textColor String? @map("text_color")\n  raw       Json?\n  tenantId  String? @map("tenant_id") // multi-tenant Phase 2 (nullable, gated MULTI_TENANT)\n\n  @@index([tenantId])\n  @@map("tags")\n}\n\nmodel DocumentTag {\n  documentId Int @map("document_id")\n  tagId      Int @map("tag_id")\n\n  @@id([documentId, tagId])\n  @@index([tagId])\n  @@map("document_tags")\n}\n\nmodel DocumentType {\n  id       Int     @id\n  name     String?\n  slug     String?\n  raw      Json?\n  tenantId String? @map("tenant_id") // multi-tenant Phase 2 (nullable, gated MULTI_TENANT)\n\n  @@index([tenantId])\n  @@map("document_types")\n}\n\nmodel Correspondent {\n  id       Int     @id\n  name     String?\n  slug     String?\n  raw      Json?\n  tenantId String? @map("tenant_id") // multi-tenant Phase 2 (nullable, gated MULTI_TENANT)\n\n  @@index([tenantId])\n  @@map("correspondents")\n}\n\nmodel DocumentCorrespondent {\n  documentId      Int     @map("document_id")\n  correspondentId Int     @map("correspondent_id")\n  role            String? // primary | secondary\n  tenantId        String? @map("tenant_id") // multi-tenant Phase 2 (nullable, gated MULTI_TENANT)\n\n  @@id([documentId, correspondentId])\n  @@index([correspondentId])\n  @@index([tenantId])\n  @@map("document_correspondents")\n}\n\n/**\n * \u2500\u2500 Dossiers / projets \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Folder {\n  id        String   @id\n  parentId  String?  @map("parent_id")\n  name      String?\n  slug      String?\n  color     String?\n  category  String?\n  status    String?\n  raw       Json?\n  tenantId  String?  @map("tenant_id") // multi-tenant Phase 2 (nullable, gated MULTI_TENANT)\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@index([parentId])\n  @@index([tenantId])\n  @@map("folders")\n}\n\nmodel FolderDocument {\n  folderId   String @map("folder_id")\n  documentId Int    @map("document_id")\n\n  @@id([folderId, documentId])\n  @@index([documentId])\n  @@map("folder_documents")\n}\n\n/**\n * \u2500\u2500 Finances \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel BudgetEntry {\n  id               String   @id\n  kind             String?\n  direction        String?\n  label            String?\n  amount           Float?\n  amountPaid       Float?   @map("amount_paid")\n  dueDate          String?  @map("due_date")\n  status           String?\n  categoryId       String?  @map("category_id")\n  categoryName     String?  @map("category_name")\n  sourceDocumentId Int?     @map("source_document_id")\n  raw              Json?\n  createdAt        DateTime @default(now()) @map("created_at")\n  updatedAt        DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@index([status])\n  @@index([direction])\n  @@index([sourceDocumentId])\n  @@map("budget_entries")\n}\n\nmodel BudgetPayment {\n  id            String  @id\n  budgetEntryId String  @map("budget_entry_id")\n  amount        Float?\n  date          String?\n  account       String?\n  raw           Json?\n\n  @@index([budgetEntryId])\n  @@map("budget_payments")\n}\n\n/**\n * \u2500\u2500 Mails \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Mail {\n  id             String    @id\n  accountId      String?   @map("account_id")\n  messageId      String?   @map("message_id")\n  threadId       String?   @map("thread_id")\n  fromAddr       String?   @map("from_addr")\n  toAddr         String?   @map("to_addr")\n  subject        String?\n  date           DateTime?\n  snippet        String?   @db.Text\n  body           String?   @db.Text\n  hasAttachments Boolean   @default(false) @map("has_attachments")\n  raw            Json?\n\n  @@index([accountId])\n  @@index([threadId])\n  @@map("mails")\n}\n\nmodel MailAttachment {\n  id       String  @id\n  mailId   String? @map("mail_id")\n  threadId String? @map("thread_id")\n  filename String?\n  mimeType String? @map("mime_type")\n  raw      Json?\n\n  @@index([mailId])\n  @@map("mail_attachments")\n}\n\nmodel MailDocumentLink {\n  id         String   @id\n  accountId  String?  @map("account_id")\n  mailId     String?  @map("mail_id")\n  threadId   String?  @map("thread_id")\n  documentId Int?     @map("document_id")\n  filename   String?\n  status     String?\n  kind       String? // attachment | ged-link\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@index([threadId])\n  @@index([documentId])\n  @@map("mail_document_links")\n}\n\n/**\n * \u2500\u2500 Rappels / t\xE2ches \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Reminder {\n  id              String    @id\n  title           String?\n  remindAt        DateTime? @map("remind_at")\n  status          String?\n  documentId      Int?      @map("document_id")\n  financialItemId String?   @map("financial_item_id")\n  raw             Json?\n  createdAt       DateTime  @default(now()) @map("created_at")\n\n  @@index([status])\n  @@index([documentId])\n  @@map("reminders")\n}\n\nmodel Task {\n  id        String   @id\n  title     String?\n  status    String?\n  priority  String?\n  dueDate   String?  @map("due_date")\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n\n  @@index([status])\n  @@map("tasks")\n}\n\n/**\n * \u2500\u2500 Divers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n */\n\nmodel Signature {\n  id         String   @id\n  scope      String? // document | email | writer\n  documentId Int?     @map("document_id")\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@index([documentId])\n  @@map("signatures")\n}\n\nmodel LearnedTemplate {\n  id        String   @id\n  label     String?\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n\n  @@map("learned_templates")\n}\n\nmodel AssistantActionLog {\n  id         String   @id @default(cuid())\n  type       String?\n  message    String?  @db.Text\n  documentId Int?     @map("document_id")\n  user       String?\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@map("assistant_action_logs")\n}\n\nmodel ActivityLog {\n  id         String   @id\n  level      String?\n  source     String?\n  message    String?  @db.Text\n  documentId Int?     @map("document_id")\n  projectId  String?  @map("project_id")\n  user       String?\n  raw        Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n\n  @@index([documentId])\n  @@map("activity_logs")\n}\n\nmodel User {\n  id           Int       @id\n  username     String    @unique\n  email        String?   @unique\n  passwordHash String?   @map("password_hash")\n  isSuperuser  Boolean   @default(false) @map("is_superuser")\n  isActive     Boolean   @default(true) @map("is_active")\n  metadata     Json?\n  createdAt    DateTime  @default(now()) @map("created_at")\n  updatedAt    DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt    DateTime? @map("deleted_at")\n\n  @@map("users")\n}\n\nmodel Counter {\n  name      String   @id\n  value     Int      @default(0)\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("counters")\n}\n\nmodel DocumentTitleOverride {\n  documentId Int      @id @map("document_id")\n  title      String?\n  source     String?\n  metadata   Json?\n  createdAt  DateTime @default(now()) @map("created_at")\n  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("document_title_overrides")\n}\n\nmodel EmailContact {\n  id          String    @id\n  name        String?\n  email       String?\n  displayName String?   @map("display_name")\n  source      String?\n  lastSeenAt  DateTime? @map("last_seen_at")\n  metadata    Json?\n  createdAt   DateTime  @default(now()) @map("created_at")\n  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt   DateTime? @map("deleted_at")\n\n  @@index([email])\n  @@map("email_contacts")\n}\n\nmodel MailAccount {\n  id          String    @id\n  provider    String?\n  email       String?\n  displayName String?   @map("display_name")\n  status      String?\n  scopes      Json?\n  metadata    Json?\n  createdAt   DateTime  @default(now()) @map("created_at")\n  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt   DateTime? @map("deleted_at")\n\n  @@map("mail_accounts")\n}\n\nmodel MailOauthToken {\n  id                    String    @id\n  accountId             String?   @map("account_id")\n  provider              String?\n  email                 String?\n  accessTokenEncrypted  String?   @map("access_token_encrypted") @db.Text\n  refreshTokenEncrypted String?   @map("refresh_token_encrypted") @db.Text\n  expiryDate            DateTime? @map("expiry_date")\n  scope                 String?   @db.Text\n  tokenType             String?   @map("token_type")\n  metadata              Json?\n  createdAt             DateTime  @default(now()) @map("created_at")\n  updatedAt             DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt             DateTime? @map("deleted_at")\n\n  @@index([accountId])\n  @@map("mail_oauth_tokens")\n}\n\nmodel SavedSignature {\n  id        String    @id\n  label     String?\n  type      String?\n  imagePath String?   @map("image_path")\n  imageData String?   @map("image_data") @db.Text\n  width     Int?\n  height    Int?\n  metadata  Json?\n  createdAt DateTime  @default(now()) @map("created_at")\n  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt DateTime? @map("deleted_at")\n\n  @@map("saved_signatures")\n}\n\nmodel HiddenSender {\n  id        String    @id\n  email     String?\n  domain    String?\n  reason    String?\n  metadata  Json?\n  createdAt DateTime  @default(now()) @map("created_at")\n  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt DateTime? @map("deleted_at")\n\n  @@index([email])\n  @@map("hidden_senders")\n}\n\nmodel CustomField {\n  id        Int       @id\n  name      String?\n  label     String?\n  type      String?\n  options   Json?\n  required  Boolean   @default(false)\n  metadata  Json?\n  createdAt DateTime  @default(now()) @map("created_at")\n  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")\n  deletedAt DateTime? @map("deleted_at")\n\n  @@map("custom_fields")\n}\n\nmodel Setting {\n  key   String @id\n  value Json\n\n  @@map("settings")\n}\n\n/**\n * \u2500\u2500 Multi-tenant (FONDATION \u2014 Phase 1) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n * Tables additives, INACTIVES tant que MULTI_TENANT n\'est pas activ\xE9 (env).\n * Aucun impact sur main / Synology / local : non utilis\xE9es en mode mono-tenant.\n * On NE branche PAS encore `tenant_id` sur les tables m\xE9tier (\xE9tape ult\xE9rieure).\n */\n\nmodel Tenant {\n  id        String   @id // slug = id (ex. "azserver-staging")\n  name      String?\n  slug      String   @unique\n  plan      String? // internal | free | pro | enterprise\n  status    String? // active | suspended | archived\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("tenants")\n}\n\nmodel Membership {\n  id        String   @id // `${tenantId}:${userId}`\n  userId    Int      @map("user_id")\n  tenantId  String   @map("tenant_id")\n  role      String // owner | admin | member | viewer\n  raw       Json?\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@unique([tenantId, userId])\n  @@index([userId])\n  @@index([tenantId])\n  @@map("memberships")\n}\n\nmodel TenantSettings {\n  id                 String   @id // = tenantId (une ligne par tenant)\n  tenantId           String   @unique @map("tenant_id")\n  maxUsers           Int?     @map("max_users")\n  maxDocuments       Int?     @map("max_documents")\n  maxStorageMb       Int?     @map("max_storage_mb")\n  aiEnabled          Boolean  @default(true) @map("ai_enabled")\n  ocrEnabled         Boolean  @default(true) @map("ocr_enabled")\n  emailImportEnabled Boolean  @default(true) @map("email_import_enabled")\n  onlyofficeEnabled  Boolean  @default(true) @map("onlyoffice_enabled")\n  featuresOverride   Json?    @map("features_override") // surcharge fine de features par tenant\n  raw                Json?\n  createdAt          DateTime @default(now()) @map("created_at")\n  updatedAt          DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("tenant_settings")\n}\n\n/**\n * \u2500\u2500 Abonnements / facturation (Phase 8 \u2014 pr\xE9paration, compatible Stripe) \u2500\u2500\n * Additif, inactif tant que MULTI_TENANT n\'est pas activ\xE9. Aucun appel Stripe.\n */\n\nmodel Subscription {\n  id                     String    @id\n  tenantId               String    @map("tenant_id")\n  plan                   String?\n  status                 String? // trialing|active|past_due|canceled|unpaid|paused|incomplete\n  provider               String    @default("manual") // manual|stripe\n  providerCustomerId     String?   @map("provider_customer_id")\n  providerSubscriptionId String?   @map("provider_subscription_id")\n  currentPeriodStart     DateTime? @map("current_period_start")\n  currentPeriodEnd       DateTime? @map("current_period_end")\n  trialStart             DateTime? @map("trial_start")\n  trialEnd               DateTime? @map("trial_end")\n  cancelAt               DateTime? @map("cancel_at")\n  canceledAt             DateTime? @map("canceled_at")\n  // Liens commerciaux (gratuit\xE9s / promos) \u2014 cf. SubscriptionGrant / PromoCode.\n  manualGrantId          String?   @map("manual_grant_id")\n  promoCodeId            String?   @map("promo_code_id")\n  discountUntil          DateTime? @map("discount_until")\n  freeUntil              DateTime? @map("free_until")\n  isFreeForever          Boolean   @default(false) @map("is_free_forever")\n  raw                    Json?\n  createdAt              DateTime  @default(now()) @map("created_at")\n  updatedAt              DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@index([tenantId])\n  @@index([status])\n  @@map("subscriptions")\n}\n\nmodel Invoice {\n  id                    String    @id\n  tenantId              String    @map("tenant_id")\n  subscriptionId        String?   @map("subscription_id")\n  provider              String    @default("manual")\n  providerInvoiceId     String?   @map("provider_invoice_id")\n  status                String? // draft|issued|paid|void|canceled|refunded|uncollectible\n  amountDue             Int?      @map("amount_due") // cents\n  amountPaid            Int?      @map("amount_paid") // cents\n  currency              String?   @default("EUR")\n  dueDate               DateTime? @map("due_date")\n  paidAt                DateTime? @map("paid_at")\n  hostedInvoiceUrl      String?   @map("hosted_invoice_url")\n  invoicePdf            String?   @map("invoice_pdf")\n  raw                   Json?\n  // \u2500\u2500 Facture \xAB r\xE9elle \xBB (Module facturation) \u2500\u2500\n  invoiceNumber         String?   @unique @map("invoice_number")\n  billingProfileId      String?   @map("billing_profile_id")\n  templateId            String?   @map("template_id")\n  type                  String?   @default("invoice") // invoice|credit_note|proforma\n  creditNoteOfId        String?   @map("credit_note_of_id")\n  issueDate             DateTime? @map("issue_date")\n  subtotalHtCents       Int?      @map("subtotal_ht_cents")\n  discountCents         Int?      @default(0) @map("discount_cents")\n  taxCents              Int?      @default(0) @map("tax_cents")\n  totalTtcCents         Int?      @map("total_ttc_cents")\n  vatRate               Float?    @map("vat_rate")\n  vatRegime             String?   @map("vat_regime")\n  buyerName             String?   @map("buyer_name")\n  buyerLegalName        String?   @map("buyer_legal_name")\n  buyerEmail            String?   @map("buyer_email")\n  buyerAddressLine1     String?   @map("buyer_address_line1")\n  buyerAddressLine2     String?   @map("buyer_address_line2")\n  buyerPostalCode       String?   @map("buyer_postal_code")\n  buyerCity             String?   @map("buyer_city")\n  buyerCountry          String?   @map("buyer_country")\n  buyerSiren            String?   @map("buyer_siren")\n  buyerSiret            String?   @map("buyer_siret")\n  buyerVatNumber        String?   @map("buyer_vat_number")\n  periodStart           DateTime? @map("period_start")\n  periodEnd             DateTime? @map("period_end")\n  htmlUrl               String?   @map("html_url")\n  pdfUrl                String?   @map("pdf_url")\n  legalMentionsSnapshot Json?     @map("legal_mentions_snapshot")\n  createdAt             DateTime  @default(now()) @map("created_at")\n  updatedAt             DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@index([tenantId])\n  @@index([subscriptionId])\n  @@index([status])\n  @@map("invoices")\n}\n\nmodel InvoiceLine {\n  id               String    @id\n  invoiceId        String    @map("invoice_id")\n  description      String?\n  quantity         Float     @default(1)\n  unitPriceHtCents Int       @default(0) @map("unit_price_ht_cents")\n  discountCents    Int       @default(0) @map("discount_cents")\n  vatRate          Float?    @map("vat_rate")\n  taxCents         Int       @default(0) @map("tax_cents")\n  totalHtCents     Int       @default(0) @map("total_ht_cents")\n  totalTtcCents    Int       @default(0) @map("total_ttc_cents")\n  periodStart      DateTime? @map("period_start")\n  periodEnd        DateTime? @map("period_end")\n  sortOrder        Int       @default(0) @map("sort_order")\n  raw              Json?\n\n  @@index([invoiceId])\n  @@map("invoice_lines")\n}\n\nmodel BillingProfile {\n  id                          String   @id\n  profileName                 String   @map("profile_name")\n  companyName                 String   @map("company_name")\n  legalName                   String?  @map("legal_name")\n  legalForm                   String?  @map("legal_form")\n  siren                       String?\n  siret                       String?\n  vatNumber                   String?  @map("vat_number")\n  rcsCity                     String?  @map("rcs_city")\n  rcsNumber                   String?  @map("rcs_number")\n  rmNumber                    String?  @map("rm_number")\n  apeNaf                      String?  @map("ape_naf")\n  shareCapital                String?  @map("share_capital")\n  addressLine1                String   @map("address_line1")\n  addressLine2                String?  @map("address_line2")\n  postalCode                  String   @map("postal_code")\n  city                        String\n  country                     String   @default("France")\n  email                       String\n  phone                       String?\n  website                     String?\n  logoUrl                     String?  @map("logo_url")\n  signatureUrl                String?  @map("signature_url")\n  iban                        String?\n  bic                         String?\n  paymentTermsDays            Int      @default(30) @map("payment_terms_days")\n  latePaymentRate             String?  @map("late_payment_rate")\n  fixedRecoveryIndemnityCents Int      @default(4000) @map("fixed_recovery_indemnity_cents")\n  vatRegime                   String   @default("standard") @map("vat_regime") // standard|franchise_base|exempt|reverse_charge|intra_eu\n  defaultVatRate              Float?   @map("default_vat_rate")\n  invoicePrefix               String   @default("FAC") @map("invoice_prefix")\n  creditNotePrefix            String   @default("AVOIR") @map("credit_note_prefix")\n  nextInvoiceNumber           Int      @default(1) @map("next_invoice_number")\n  nextCreditNoteNumber        Int      @default(1) @map("next_credit_note_number")\n  isDefault                   Boolean  @default(false) @map("is_default")\n  legalFooterHtml             String?  @map("legal_footer_html")\n  termsFooterHtml             String?  @map("terms_footer_html")\n  raw                         Json?\n  createdAt                   DateTime @default(now()) @map("created_at")\n  updatedAt                   DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("billing_profiles")\n}\n\nmodel InvoiceTemplate {\n  id                 String   @id\n  name               String\n  isDefault          Boolean  @default(false) @map("is_default")\n  locale             String   @default("fr-FR")\n  currency           String   @default("EUR")\n  primaryColor       String?  @map("primary_color")\n  secondaryColor     String?  @map("secondary_color")\n  fontFamily         String?  @map("font_family")\n  logoPosition       String?  @map("logo_position")\n  showLogo           Boolean  @default(true) @map("show_logo")\n  showPaymentDetails Boolean  @default(true) @map("show_payment_details")\n  showLegalFooter    Boolean  @default(true) @map("show_legal_footer")\n  showQrCode         Boolean  @default(false) @map("show_qr_code")\n  headerHtml         String?  @map("header_html")\n  footerHtml         String?  @map("footer_html")\n  customCss          String?  @map("custom_css")\n  raw                Json?\n  createdAt          DateTime @default(now()) @map("created_at")\n  updatedAt          DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("invoice_templates")\n}\n\nmodel PaymentEvent {\n  id              String    @id\n  tenantId        String?   @map("tenant_id")\n  provider        String    @default("manual")\n  eventType       String?   @map("event_type")\n  providerEventId String?   @map("provider_event_id")\n  processedAt     DateTime? @map("processed_at")\n  raw             Json?\n  createdAt       DateTime  @default(now()) @map("created_at")\n\n  @@index([tenantId])\n  @@map("payment_events")\n}\n\n/**\n * \u2500\u2500 Plans administrables, codes promo, gratuit\xE9s (Phase 8 \u2014 compl\xE9ment) \u2500\u2500\u2500\u2500\n */\n\nmodel SaasPlan {\n  id                   String   @id\n  code                 String   @unique // free|test|pro|business|internal|custom_xxx\n  name                 String?\n  description          String?\n  isActive             Boolean  @default(true) @map("is_active")\n  isPublic             Boolean  @default(false) @map("is_public")\n  isDefault            Boolean  @default(false) @map("is_default")\n  sortOrder            Int      @default(0) @map("sort_order")\n  monthlyPriceCents    Int?     @map("monthly_price_cents")\n  yearlyPriceCents     Int?     @map("yearly_price_cents")\n  currency             String   @default("EUR")\n  maxUsers             Int?     @map("max_users")\n  maxDocuments         Int?     @map("max_documents")\n  maxStorageMb         Int?     @map("max_storage_mb")\n  aiEnabled            Boolean  @default(true) @map("ai_enabled")\n  ocrEnabled           Boolean  @default(true) @map("ocr_enabled")\n  emailImportEnabled   Boolean  @default(false) @map("email_import_enabled")\n  onlyofficeEnabled    Boolean  @default(true) @map("onlyoffice_enabled")\n  supportLevel         String?  @map("support_level")\n  features             Json? // feature flags du plan (cf. src/lib/saas/features.ts)\n  stripeProductId      String?  @map("stripe_product_id")\n  stripeMonthlyPriceId String?  @map("stripe_monthly_price_id")\n  stripeYearlyPriceId  String?  @map("stripe_yearly_price_id")\n  raw                  Json?\n  createdAt            DateTime @default(now()) @map("created_at")\n  updatedAt            DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("saas_plans")\n}\n\nmodel PromoCode {\n  id                    String    @id\n  code                  String    @unique\n  name                  String?\n  description           String?\n  discountType          String?   @map("discount_type") // percent|amount|free_period|free_forever\n  percentOff            Int?      @map("percent_off")\n  amountOffCents        Int?      @map("amount_off_cents")\n  currency              String    @default("EUR")\n  freeDurationCount     Int?      @map("free_duration_count")\n  freeDurationUnit      String?   @map("free_duration_unit") // day|month|year|lifetime\n  appliesToPlan         String?   @map("applies_to_plan")\n  maxRedemptions        Int?      @map("max_redemptions")\n  redeemedCount         Int       @default(0) @map("redeemed_count")\n  startsAt              DateTime? @map("starts_at")\n  expiresAt             DateTime? @map("expires_at")\n  isActive              Boolean   @default(true) @map("is_active")\n  stripeCouponId        String?   @map("stripe_coupon_id")\n  stripePromotionCodeId String?   @map("stripe_promotion_code_id")\n  raw                   Json?\n  createdAt             DateTime  @default(now()) @map("created_at")\n  updatedAt             DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@map("promo_codes")\n}\n\nmodel PromoRedemption {\n  id             String    @id\n  promoCodeId    String    @map("promo_code_id")\n  tenantId       String    @map("tenant_id")\n  userId         Int?      @map("user_id")\n  subscriptionId String?   @map("subscription_id")\n  redeemedAt     DateTime  @default(now()) @map("redeemed_at")\n  expiresAt      DateTime? @map("expires_at")\n  raw            Json?\n\n  @@index([promoCodeId])\n  @@index([tenantId])\n  @@map("promo_redemptions")\n}\n\nmodel SubscriptionGrant {\n  id               String    @id\n  tenantId         String    @map("tenant_id")\n  planCode         String    @map("plan_code")\n  grantType        String    @map("grant_type") // free_trial|free_period|free_forever|manual_discount|internal\n  startsAt         DateTime  @default(now()) @map("starts_at")\n  endsAt           DateTime? @map("ends_at")\n  durationCount    Int?      @map("duration_count")\n  durationUnit     String?   @map("duration_unit") // day|month|year|lifetime\n  reason           String?\n  grantedByUserId  Int?      @map("granted_by_user_id")\n  isActive         Boolean   @default(true) @map("is_active")\n  featuresOverride Json?     @map("features_override")\n  raw              Json?\n  createdAt        DateTime  @default(now()) @map("created_at")\n  updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@index([tenantId])\n  @@map("subscription_grants")\n}\n\n/**\n * \u2500\u2500 Mailing transactionnel & campagnes (mini-Brevo) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n * Envoi via SMTP o2switch. Aucun secret stock\xE9 en base (env only).\n */\nmodel MailLayout {\n  id          String   @id\n  name        String\n  isDefault   Boolean  @default(false) @map("is_default")\n  htmlWrapper String   @map("html_wrapper") // doit contenir {{content}}\n  raw         Json?\n  createdAt   DateTime @default(now()) @map("created_at")\n  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("mail_layouts")\n}\n\nmodel MailTemplate {\n  id          String   @id\n  key         String   @unique // ex: billing.invoice_issued\n  name        String\n  category    String   @default("system") // account|billing|subscription|support|system|marketing\n  subject     String\n  htmlBody    String   @map("html_body")\n  textBody    String?  @map("text_body")\n  locale      String   @default("fr-FR")\n  enabled     Boolean  @default(true)\n  layoutId    String?  @map("layout_id")\n  description String?\n  variables   Json? // liste indicative des variables\n  isMarketing Boolean  @default(false) @map("is_marketing")\n  raw         Json?\n  createdAt   DateTime @default(now()) @map("created_at")\n  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@index([category])\n  @@map("mail_templates")\n}\n\nmodel MailQueue {\n  id                String    @id\n  tenantId          String?   @map("tenant_id")\n  toEmail           String    @map("to_email")\n  toName            String?   @map("to_name")\n  templateKey       String?   @map("template_key")\n  category          String    @default("system")\n  subject           String\n  htmlBody          String    @map("html_body")\n  textBody          String?   @map("text_body")\n  status            String    @default("pending") // pending|sending|sent|failed|canceled|skipped\n  attempts          Int       @default(0)\n  maxAttempts       Int       @default(5) @map("max_attempts")\n  lastError         String?   @map("last_error")\n  scheduledAt       DateTime  @default(now()) @map("scheduled_at")\n  sentAt            DateTime? @map("sent_at")\n  providerMessageId String?   @map("provider_message_id")\n  campaignId        String?   @map("campaign_id")\n  dedupeKey         String?   @unique @map("dedupe_key")\n  meta              Json?\n  createdAt         DateTime  @default(now()) @map("created_at")\n  updatedAt         DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@index([status])\n  @@index([tenantId])\n  @@index([campaignId])\n  @@map("mail_queue")\n}\n\nmodel MailEvent {\n  id        String   @id\n  queueId   String?  @map("queue_id")\n  tenantId  String?  @map("tenant_id")\n  type      String // queued|sent|failed|skipped|retry|opened|unsubscribed\n  detail    String?\n  createdAt DateTime @default(now()) @map("created_at")\n\n  @@index([queueId])\n  @@index([tenantId])\n  @@map("mail_events")\n}\n\nmodel MailPreference {\n  id             String   @id\n  email          String\n  tenantId       String?  @map("tenant_id")\n  token          String   @unique // pour lien de d\xE9sinscription\n  unsubAll       Boolean  @default(false) @map("unsub_all")\n  unsubMarketing Boolean  @default(false) @map("unsub_marketing")\n  categories     Json? // map cat\xE9gorie -> bool (d\xE9sinscrit)\n  updatedAt      DateTime @default(now()) @updatedAt @map("updated_at")\n  createdAt      DateTime @default(now()) @map("created_at")\n\n  @@unique([email, tenantId])\n  @@map("mail_preferences")\n}\n\nmodel MailCampaign {\n  id              String    @id\n  name            String\n  templateKey     String?   @map("template_key")\n  subject         String?\n  htmlBody        String?   @map("html_body")\n  category        String    @default("marketing")\n  status          String    @default("draft") // draft|scheduled|sending|sent|canceled\n  audience        Json? // { scope: "all"|"plan"|"status", value?: string }\n  scheduledAt     DateTime? @map("scheduled_at")\n  sentCount       Int       @default(0) @map("sent_count")\n  failedCount     Int       @default(0) @map("failed_count")\n  createdByUserId Int?      @map("created_by_user_id")\n  raw             Json?\n  createdAt       DateTime  @default(now()) @map("created_at")\n  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@index([status])\n  @@map("mail_campaigns")\n}\n\n/**\n * \u2500\u2500 Support humain / chat conseiller \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n * Conversations cloisonn\xE9es par tenant (un client ne voit QUE son tenant).\n * S\xE9paration IA / humain via `channel` + `author_type`.\n */\nmodel SupportConversation {\n  id               String    @id\n  tenantId         String    @map("tenant_id")\n  ref              String    @unique // r\xE9f\xE9rence courte lisible (ex: SUP-0001)\n  subject          String\n  status           String    @default("open") // open|pending|waiting_customer|resolved|closed\n  channel          String    @default("chat") // chat|ticket|ai\n  priority         String    @default("normal") // low|normal|high|urgent\n  category         String?\n  createdByUserId  Int?      @map("created_by_user_id")\n  createdByName    String?   @map("created_by_name")\n  assignedToUserId Int?      @map("assigned_to_user_id")\n  lastMessageAt    DateTime? @map("last_message_at")\n  customerUnread   Int       @default(0) @map("customer_unread")\n  agentUnread      Int       @default(0) @map("agent_unread")\n  firstResponseAt  DateTime? @map("first_response_at")\n  resolvedAt       DateTime? @map("resolved_at")\n  closedAt         DateTime? @map("closed_at")\n  slaDueAt         DateTime? @map("sla_due_at")\n  slaBreached      Boolean   @default(false) @map("sla_breached")\n  ratingScore      Int?      @map("rating_score")\n  ratingComment    String?   @map("rating_comment")\n  meta             Json?\n  createdAt        DateTime  @default(now()) @map("created_at")\n  updatedAt        DateTime  @default(now()) @updatedAt @map("updated_at")\n\n  @@index([tenantId])\n  @@index([status])\n  @@index([assignedToUserId])\n  @@map("support_conversations")\n}\n\nmodel SupportMessage {\n  id             String   @id\n  conversationId String   @map("conversation_id")\n  tenantId       String   @map("tenant_id")\n  authorType     String   @map("author_type") // customer|agent|ai|system\n  authorUserId   Int?     @map("author_user_id")\n  authorName     String?  @map("author_name")\n  body           String\n  isInternal     Boolean  @default(false) @map("is_internal") // note interne (jamais visible client)\n  meta           Json?\n  createdAt      DateTime @default(now()) @map("created_at")\n\n  @@index([conversationId])\n  @@index([tenantId])\n  @@map("support_messages")\n}\n\nmodel SupportAttachment {\n  id             String   @id\n  messageId      String?  @map("message_id")\n  conversationId String   @map("conversation_id")\n  tenantId       String   @map("tenant_id")\n  filename       String\n  mimeType       String?  @map("mime_type")\n  sizeBytes      Int?     @map("size_bytes")\n  storageKey     String   @map("storage_key")\n  createdAt      DateTime @default(now()) @map("created_at")\n\n  @@index([conversationId])\n  @@map("support_attachments")\n}\n\nmodel SupportSlaPolicy {\n  id                String   @id\n  name              String\n  priority          String   @default("normal")\n  firstResponseMins Int      @map("first_response_mins")\n  resolutionMins    Int      @map("resolution_mins")\n  isDefault         Boolean  @default(false) @map("is_default")\n  raw               Json?\n  createdAt         DateTime @default(now()) @map("created_at")\n  updatedAt         DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("support_sla_policies")\n}\n\nmodel SupportCannedReply {\n  id              String   @id\n  title           String\n  body            String\n  category        String?\n  shortcut        String?\n  createdByUserId Int?     @map("created_by_user_id")\n  createdAt       DateTime @default(now()) @map("created_at")\n  updatedAt       DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("support_canned_replies")\n}\n\n/**\n * \u2500\u2500 Chiffrement au repos par tenant (enveloppe) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n * La DEK (cl\xE9 de donn\xE9es du tenant) n\'est JAMAIS stock\xE9e en clair : elle est\n * chiffr\xE9e (wrapped) avec la KEK ma\xEEtre (ENCRYPTION_MASTER_KEY) via AES-256-GCM.\n */\nmodel TenantEncryptionKey {\n  id         String   @id\n  tenantId   String   @unique @map("tenant_id")\n  wrappedDek String   @map("wrapped_dek") // base64(iv|tag|ciphertext) \u2014 DEK chiffr\xE9e par la KEK\n  algo       String   @default("aes-256-gcm")\n  keyVersion Int      @default(1) @map("key_version")\n  status     String   @default("active") // active|rotating|retired\n  createdAt  DateTime @default(now()) @map("created_at")\n  updatedAt  DateTime @default(now()) @updatedAt @map("updated_at")\n\n  @@map("tenant_encryption_keys")\n}\n',
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
config.runtimeDataModel = JSON.parse('{"models":{"Document":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"title","kind":"scalar","type":"String"},{"name":"content","kind":"scalar","type":"String"},{"name":"created","kind":"scalar","type":"DateTime"},{"name":"createdDate","kind":"scalar","type":"String","dbName":"created_date"},{"name":"added","kind":"scalar","type":"DateTime"},{"name":"modified","kind":"scalar","type":"DateTime"},{"name":"correspondentId","kind":"scalar","type":"Int","dbName":"correspondent_id"},{"name":"documentTypeId","kind":"scalar","type":"Int","dbName":"document_type_id"},{"name":"storagePath","kind":"scalar","type":"String","dbName":"storage_path"},{"name":"mimeType","kind":"scalar","type":"String","dbName":"mime_type"},{"name":"checksum","kind":"scalar","type":"String"},{"name":"storedFilename","kind":"scalar","type":"String","dbName":"stored_filename"},{"name":"originalFileName","kind":"scalar","type":"String","dbName":"original_file_name"},{"name":"pageCount","kind":"scalar","type":"Int","dbName":"page_count"},{"name":"deleted","kind":"scalar","type":"Boolean"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"documents"},"DocumentFile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"kind","kind":"scalar","type":"String"},{"name":"filename","kind":"scalar","type":"String"},{"name":"mimeType","kind":"scalar","type":"String","dbName":"mime_type"},{"name":"sizeBytes","kind":"scalar","type":"Int","dbName":"size_bytes"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"}],"dbName":"document_files"},"DocumentVersion":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"label","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"document_versions"},"DocumentOcr":{"fields":[{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"content","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"document_ocr"},"DocumentAiAnalysis":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"summary","kind":"scalar","type":"String"},{"name":"confidence","kind":"scalar","type":"String"},{"name":"source","kind":"scalar","type":"String"},{"name":"analyzedAt","kind":"scalar","type":"DateTime","dbName":"analyzed_at"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"document_ai_analyses"},"DocumentAiSuggestion":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"analysisId","kind":"scalar","type":"String","dbName":"analysis_id"},{"name":"suggestionType","kind":"scalar","type":"String","dbName":"suggestion_type"},{"name":"fieldName","kind":"scalar","type":"String","dbName":"field_name"},{"name":"suggestedValue","kind":"scalar","type":"String","dbName":"suggested_value"},{"name":"confidence","kind":"scalar","type":"String"},{"name":"source","kind":"scalar","type":"String"},{"name":"applied","kind":"scalar","type":"Boolean"},{"name":"rawPayload","kind":"scalar","type":"Json","dbName":"raw_payload"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"document_ai_suggestions"},"Tag":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"color","kind":"scalar","type":"String"},{"name":"textColor","kind":"scalar","type":"String","dbName":"text_color"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"}],"dbName":"tags"},"DocumentTag":{"fields":[{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"tagId","kind":"scalar","type":"Int","dbName":"tag_id"}],"dbName":"document_tags"},"DocumentType":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"}],"dbName":"document_types"},"Correspondent":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"}],"dbName":"correspondents"},"DocumentCorrespondent":{"fields":[{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"correspondentId","kind":"scalar","type":"Int","dbName":"correspondent_id"},{"name":"role","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"}],"dbName":"document_correspondents"},"Folder":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"parentId","kind":"scalar","type":"String","dbName":"parent_id"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"color","kind":"scalar","type":"String"},{"name":"category","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"folders"},"FolderDocument":{"fields":[{"name":"folderId","kind":"scalar","type":"String","dbName":"folder_id"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"}],"dbName":"folder_documents"},"BudgetEntry":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"kind","kind":"scalar","type":"String"},{"name":"direction","kind":"scalar","type":"String"},{"name":"label","kind":"scalar","type":"String"},{"name":"amount","kind":"scalar","type":"Float"},{"name":"amountPaid","kind":"scalar","type":"Float","dbName":"amount_paid"},{"name":"dueDate","kind":"scalar","type":"String","dbName":"due_date"},{"name":"status","kind":"scalar","type":"String"},{"name":"categoryId","kind":"scalar","type":"String","dbName":"category_id"},{"name":"categoryName","kind":"scalar","type":"String","dbName":"category_name"},{"name":"sourceDocumentId","kind":"scalar","type":"Int","dbName":"source_document_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"budget_entries"},"BudgetPayment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"budgetEntryId","kind":"scalar","type":"String","dbName":"budget_entry_id"},{"name":"amount","kind":"scalar","type":"Float"},{"name":"date","kind":"scalar","type":"String"},{"name":"account","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"budget_payments"},"Mail":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String","dbName":"account_id"},{"name":"messageId","kind":"scalar","type":"String","dbName":"message_id"},{"name":"threadId","kind":"scalar","type":"String","dbName":"thread_id"},{"name":"fromAddr","kind":"scalar","type":"String","dbName":"from_addr"},{"name":"toAddr","kind":"scalar","type":"String","dbName":"to_addr"},{"name":"subject","kind":"scalar","type":"String"},{"name":"date","kind":"scalar","type":"DateTime"},{"name":"snippet","kind":"scalar","type":"String"},{"name":"body","kind":"scalar","type":"String"},{"name":"hasAttachments","kind":"scalar","type":"Boolean","dbName":"has_attachments"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"mails"},"MailAttachment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"mailId","kind":"scalar","type":"String","dbName":"mail_id"},{"name":"threadId","kind":"scalar","type":"String","dbName":"thread_id"},{"name":"filename","kind":"scalar","type":"String"},{"name":"mimeType","kind":"scalar","type":"String","dbName":"mime_type"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"mail_attachments"},"MailDocumentLink":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String","dbName":"account_id"},{"name":"mailId","kind":"scalar","type":"String","dbName":"mail_id"},{"name":"threadId","kind":"scalar","type":"String","dbName":"thread_id"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"filename","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"kind","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"mail_document_links"},"Reminder":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"remindAt","kind":"scalar","type":"DateTime","dbName":"remind_at"},{"name":"status","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"financialItemId","kind":"scalar","type":"String","dbName":"financial_item_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"reminders"},"Task":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"priority","kind":"scalar","type":"String"},{"name":"dueDate","kind":"scalar","type":"String","dbName":"due_date"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"tasks"},"Signature":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"scope","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"signatures"},"LearnedTemplate":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"label","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"learned_templates"},"AssistantActionLog":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"user","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"assistant_action_logs"},"ActivityLog":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"level","kind":"scalar","type":"String"},{"name":"source","kind":"scalar","type":"String"},{"name":"message","kind":"scalar","type":"String"},{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"projectId","kind":"scalar","type":"String","dbName":"project_id"},{"name":"user","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"activity_logs"},"User":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"username","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"passwordHash","kind":"scalar","type":"String","dbName":"password_hash"},{"name":"isSuperuser","kind":"scalar","type":"Boolean","dbName":"is_superuser"},{"name":"isActive","kind":"scalar","type":"Boolean","dbName":"is_active"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"users"},"Counter":{"fields":[{"name":"name","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"Int"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"counters"},"DocumentTitleOverride":{"fields":[{"name":"documentId","kind":"scalar","type":"Int","dbName":"document_id"},{"name":"title","kind":"scalar","type":"String"},{"name":"source","kind":"scalar","type":"String"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"document_title_overrides"},"EmailContact":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"displayName","kind":"scalar","type":"String","dbName":"display_name"},{"name":"source","kind":"scalar","type":"String"},{"name":"lastSeenAt","kind":"scalar","type":"DateTime","dbName":"last_seen_at"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"email_contacts"},"MailAccount":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"provider","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"displayName","kind":"scalar","type":"String","dbName":"display_name"},{"name":"status","kind":"scalar","type":"String"},{"name":"scopes","kind":"scalar","type":"Json"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"mail_accounts"},"MailOauthToken":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"accountId","kind":"scalar","type":"String","dbName":"account_id"},{"name":"provider","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"accessTokenEncrypted","kind":"scalar","type":"String","dbName":"access_token_encrypted"},{"name":"refreshTokenEncrypted","kind":"scalar","type":"String","dbName":"refresh_token_encrypted"},{"name":"expiryDate","kind":"scalar","type":"DateTime","dbName":"expiry_date"},{"name":"scope","kind":"scalar","type":"String"},{"name":"tokenType","kind":"scalar","type":"String","dbName":"token_type"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"mail_oauth_tokens"},"SavedSignature":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"label","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"imagePath","kind":"scalar","type":"String","dbName":"image_path"},{"name":"imageData","kind":"scalar","type":"String","dbName":"image_data"},{"name":"width","kind":"scalar","type":"Int"},{"name":"height","kind":"scalar","type":"Int"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"saved_signatures"},"HiddenSender":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"domain","kind":"scalar","type":"String"},{"name":"reason","kind":"scalar","type":"String"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"hidden_senders"},"CustomField":{"fields":[{"name":"id","kind":"scalar","type":"Int"},{"name":"name","kind":"scalar","type":"String"},{"name":"label","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"options","kind":"scalar","type":"Json"},{"name":"required","kind":"scalar","type":"Boolean"},{"name":"metadata","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"deletedAt","kind":"scalar","type":"DateTime","dbName":"deleted_at"}],"dbName":"custom_fields"},"Setting":{"fields":[{"name":"key","kind":"scalar","type":"String"},{"name":"value","kind":"scalar","type":"Json"}],"dbName":"settings"},"Tenant":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"slug","kind":"scalar","type":"String"},{"name":"plan","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"tenants"},"Membership":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"Int","dbName":"user_id"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"role","kind":"scalar","type":"String"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"memberships"},"TenantSettings":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"maxUsers","kind":"scalar","type":"Int","dbName":"max_users"},{"name":"maxDocuments","kind":"scalar","type":"Int","dbName":"max_documents"},{"name":"maxStorageMb","kind":"scalar","type":"Int","dbName":"max_storage_mb"},{"name":"aiEnabled","kind":"scalar","type":"Boolean","dbName":"ai_enabled"},{"name":"ocrEnabled","kind":"scalar","type":"Boolean","dbName":"ocr_enabled"},{"name":"emailImportEnabled","kind":"scalar","type":"Boolean","dbName":"email_import_enabled"},{"name":"onlyofficeEnabled","kind":"scalar","type":"Boolean","dbName":"onlyoffice_enabled"},{"name":"featuresOverride","kind":"scalar","type":"Json","dbName":"features_override"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"tenant_settings"},"Subscription":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"plan","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"provider","kind":"scalar","type":"String"},{"name":"providerCustomerId","kind":"scalar","type":"String","dbName":"provider_customer_id"},{"name":"providerSubscriptionId","kind":"scalar","type":"String","dbName":"provider_subscription_id"},{"name":"currentPeriodStart","kind":"scalar","type":"DateTime","dbName":"current_period_start"},{"name":"currentPeriodEnd","kind":"scalar","type":"DateTime","dbName":"current_period_end"},{"name":"trialStart","kind":"scalar","type":"DateTime","dbName":"trial_start"},{"name":"trialEnd","kind":"scalar","type":"DateTime","dbName":"trial_end"},{"name":"cancelAt","kind":"scalar","type":"DateTime","dbName":"cancel_at"},{"name":"canceledAt","kind":"scalar","type":"DateTime","dbName":"canceled_at"},{"name":"manualGrantId","kind":"scalar","type":"String","dbName":"manual_grant_id"},{"name":"promoCodeId","kind":"scalar","type":"String","dbName":"promo_code_id"},{"name":"discountUntil","kind":"scalar","type":"DateTime","dbName":"discount_until"},{"name":"freeUntil","kind":"scalar","type":"DateTime","dbName":"free_until"},{"name":"isFreeForever","kind":"scalar","type":"Boolean","dbName":"is_free_forever"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"subscriptions"},"Invoice":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"subscriptionId","kind":"scalar","type":"String","dbName":"subscription_id"},{"name":"provider","kind":"scalar","type":"String"},{"name":"providerInvoiceId","kind":"scalar","type":"String","dbName":"provider_invoice_id"},{"name":"status","kind":"scalar","type":"String"},{"name":"amountDue","kind":"scalar","type":"Int","dbName":"amount_due"},{"name":"amountPaid","kind":"scalar","type":"Int","dbName":"amount_paid"},{"name":"currency","kind":"scalar","type":"String"},{"name":"dueDate","kind":"scalar","type":"DateTime","dbName":"due_date"},{"name":"paidAt","kind":"scalar","type":"DateTime","dbName":"paid_at"},{"name":"hostedInvoiceUrl","kind":"scalar","type":"String","dbName":"hosted_invoice_url"},{"name":"invoicePdf","kind":"scalar","type":"String","dbName":"invoice_pdf"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"invoiceNumber","kind":"scalar","type":"String","dbName":"invoice_number"},{"name":"billingProfileId","kind":"scalar","type":"String","dbName":"billing_profile_id"},{"name":"templateId","kind":"scalar","type":"String","dbName":"template_id"},{"name":"type","kind":"scalar","type":"String"},{"name":"creditNoteOfId","kind":"scalar","type":"String","dbName":"credit_note_of_id"},{"name":"issueDate","kind":"scalar","type":"DateTime","dbName":"issue_date"},{"name":"subtotalHtCents","kind":"scalar","type":"Int","dbName":"subtotal_ht_cents"},{"name":"discountCents","kind":"scalar","type":"Int","dbName":"discount_cents"},{"name":"taxCents","kind":"scalar","type":"Int","dbName":"tax_cents"},{"name":"totalTtcCents","kind":"scalar","type":"Int","dbName":"total_ttc_cents"},{"name":"vatRate","kind":"scalar","type":"Float","dbName":"vat_rate"},{"name":"vatRegime","kind":"scalar","type":"String","dbName":"vat_regime"},{"name":"buyerName","kind":"scalar","type":"String","dbName":"buyer_name"},{"name":"buyerLegalName","kind":"scalar","type":"String","dbName":"buyer_legal_name"},{"name":"buyerEmail","kind":"scalar","type":"String","dbName":"buyer_email"},{"name":"buyerAddressLine1","kind":"scalar","type":"String","dbName":"buyer_address_line1"},{"name":"buyerAddressLine2","kind":"scalar","type":"String","dbName":"buyer_address_line2"},{"name":"buyerPostalCode","kind":"scalar","type":"String","dbName":"buyer_postal_code"},{"name":"buyerCity","kind":"scalar","type":"String","dbName":"buyer_city"},{"name":"buyerCountry","kind":"scalar","type":"String","dbName":"buyer_country"},{"name":"buyerSiren","kind":"scalar","type":"String","dbName":"buyer_siren"},{"name":"buyerSiret","kind":"scalar","type":"String","dbName":"buyer_siret"},{"name":"buyerVatNumber","kind":"scalar","type":"String","dbName":"buyer_vat_number"},{"name":"periodStart","kind":"scalar","type":"DateTime","dbName":"period_start"},{"name":"periodEnd","kind":"scalar","type":"DateTime","dbName":"period_end"},{"name":"htmlUrl","kind":"scalar","type":"String","dbName":"html_url"},{"name":"pdfUrl","kind":"scalar","type":"String","dbName":"pdf_url"},{"name":"legalMentionsSnapshot","kind":"scalar","type":"Json","dbName":"legal_mentions_snapshot"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"invoices"},"InvoiceLine":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"invoiceId","kind":"scalar","type":"String","dbName":"invoice_id"},{"name":"description","kind":"scalar","type":"String"},{"name":"quantity","kind":"scalar","type":"Float"},{"name":"unitPriceHtCents","kind":"scalar","type":"Int","dbName":"unit_price_ht_cents"},{"name":"discountCents","kind":"scalar","type":"Int","dbName":"discount_cents"},{"name":"vatRate","kind":"scalar","type":"Float","dbName":"vat_rate"},{"name":"taxCents","kind":"scalar","type":"Int","dbName":"tax_cents"},{"name":"totalHtCents","kind":"scalar","type":"Int","dbName":"total_ht_cents"},{"name":"totalTtcCents","kind":"scalar","type":"Int","dbName":"total_ttc_cents"},{"name":"periodStart","kind":"scalar","type":"DateTime","dbName":"period_start"},{"name":"periodEnd","kind":"scalar","type":"DateTime","dbName":"period_end"},{"name":"sortOrder","kind":"scalar","type":"Int","dbName":"sort_order"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"invoice_lines"},"BillingProfile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"profileName","kind":"scalar","type":"String","dbName":"profile_name"},{"name":"companyName","kind":"scalar","type":"String","dbName":"company_name"},{"name":"legalName","kind":"scalar","type":"String","dbName":"legal_name"},{"name":"legalForm","kind":"scalar","type":"String","dbName":"legal_form"},{"name":"siren","kind":"scalar","type":"String"},{"name":"siret","kind":"scalar","type":"String"},{"name":"vatNumber","kind":"scalar","type":"String","dbName":"vat_number"},{"name":"rcsCity","kind":"scalar","type":"String","dbName":"rcs_city"},{"name":"rcsNumber","kind":"scalar","type":"String","dbName":"rcs_number"},{"name":"rmNumber","kind":"scalar","type":"String","dbName":"rm_number"},{"name":"apeNaf","kind":"scalar","type":"String","dbName":"ape_naf"},{"name":"shareCapital","kind":"scalar","type":"String","dbName":"share_capital"},{"name":"addressLine1","kind":"scalar","type":"String","dbName":"address_line1"},{"name":"addressLine2","kind":"scalar","type":"String","dbName":"address_line2"},{"name":"postalCode","kind":"scalar","type":"String","dbName":"postal_code"},{"name":"city","kind":"scalar","type":"String"},{"name":"country","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"phone","kind":"scalar","type":"String"},{"name":"website","kind":"scalar","type":"String"},{"name":"logoUrl","kind":"scalar","type":"String","dbName":"logo_url"},{"name":"signatureUrl","kind":"scalar","type":"String","dbName":"signature_url"},{"name":"iban","kind":"scalar","type":"String"},{"name":"bic","kind":"scalar","type":"String"},{"name":"paymentTermsDays","kind":"scalar","type":"Int","dbName":"payment_terms_days"},{"name":"latePaymentRate","kind":"scalar","type":"String","dbName":"late_payment_rate"},{"name":"fixedRecoveryIndemnityCents","kind":"scalar","type":"Int","dbName":"fixed_recovery_indemnity_cents"},{"name":"vatRegime","kind":"scalar","type":"String","dbName":"vat_regime"},{"name":"defaultVatRate","kind":"scalar","type":"Float","dbName":"default_vat_rate"},{"name":"invoicePrefix","kind":"scalar","type":"String","dbName":"invoice_prefix"},{"name":"creditNotePrefix","kind":"scalar","type":"String","dbName":"credit_note_prefix"},{"name":"nextInvoiceNumber","kind":"scalar","type":"Int","dbName":"next_invoice_number"},{"name":"nextCreditNoteNumber","kind":"scalar","type":"Int","dbName":"next_credit_note_number"},{"name":"isDefault","kind":"scalar","type":"Boolean","dbName":"is_default"},{"name":"legalFooterHtml","kind":"scalar","type":"String","dbName":"legal_footer_html"},{"name":"termsFooterHtml","kind":"scalar","type":"String","dbName":"terms_footer_html"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"billing_profiles"},"InvoiceTemplate":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"isDefault","kind":"scalar","type":"Boolean","dbName":"is_default"},{"name":"locale","kind":"scalar","type":"String"},{"name":"currency","kind":"scalar","type":"String"},{"name":"primaryColor","kind":"scalar","type":"String","dbName":"primary_color"},{"name":"secondaryColor","kind":"scalar","type":"String","dbName":"secondary_color"},{"name":"fontFamily","kind":"scalar","type":"String","dbName":"font_family"},{"name":"logoPosition","kind":"scalar","type":"String","dbName":"logo_position"},{"name":"showLogo","kind":"scalar","type":"Boolean","dbName":"show_logo"},{"name":"showPaymentDetails","kind":"scalar","type":"Boolean","dbName":"show_payment_details"},{"name":"showLegalFooter","kind":"scalar","type":"Boolean","dbName":"show_legal_footer"},{"name":"showQrCode","kind":"scalar","type":"Boolean","dbName":"show_qr_code"},{"name":"headerHtml","kind":"scalar","type":"String","dbName":"header_html"},{"name":"footerHtml","kind":"scalar","type":"String","dbName":"footer_html"},{"name":"customCss","kind":"scalar","type":"String","dbName":"custom_css"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"invoice_templates"},"PaymentEvent":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"provider","kind":"scalar","type":"String"},{"name":"eventType","kind":"scalar","type":"String","dbName":"event_type"},{"name":"providerEventId","kind":"scalar","type":"String","dbName":"provider_event_id"},{"name":"processedAt","kind":"scalar","type":"DateTime","dbName":"processed_at"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"payment_events"},"SaasPlan":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"code","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"isActive","kind":"scalar","type":"Boolean","dbName":"is_active"},{"name":"isPublic","kind":"scalar","type":"Boolean","dbName":"is_public"},{"name":"isDefault","kind":"scalar","type":"Boolean","dbName":"is_default"},{"name":"sortOrder","kind":"scalar","type":"Int","dbName":"sort_order"},{"name":"monthlyPriceCents","kind":"scalar","type":"Int","dbName":"monthly_price_cents"},{"name":"yearlyPriceCents","kind":"scalar","type":"Int","dbName":"yearly_price_cents"},{"name":"currency","kind":"scalar","type":"String"},{"name":"maxUsers","kind":"scalar","type":"Int","dbName":"max_users"},{"name":"maxDocuments","kind":"scalar","type":"Int","dbName":"max_documents"},{"name":"maxStorageMb","kind":"scalar","type":"Int","dbName":"max_storage_mb"},{"name":"aiEnabled","kind":"scalar","type":"Boolean","dbName":"ai_enabled"},{"name":"ocrEnabled","kind":"scalar","type":"Boolean","dbName":"ocr_enabled"},{"name":"emailImportEnabled","kind":"scalar","type":"Boolean","dbName":"email_import_enabled"},{"name":"onlyofficeEnabled","kind":"scalar","type":"Boolean","dbName":"onlyoffice_enabled"},{"name":"supportLevel","kind":"scalar","type":"String","dbName":"support_level"},{"name":"features","kind":"scalar","type":"Json"},{"name":"stripeProductId","kind":"scalar","type":"String","dbName":"stripe_product_id"},{"name":"stripeMonthlyPriceId","kind":"scalar","type":"String","dbName":"stripe_monthly_price_id"},{"name":"stripeYearlyPriceId","kind":"scalar","type":"String","dbName":"stripe_yearly_price_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"saas_plans"},"PromoCode":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"code","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"description","kind":"scalar","type":"String"},{"name":"discountType","kind":"scalar","type":"String","dbName":"discount_type"},{"name":"percentOff","kind":"scalar","type":"Int","dbName":"percent_off"},{"name":"amountOffCents","kind":"scalar","type":"Int","dbName":"amount_off_cents"},{"name":"currency","kind":"scalar","type":"String"},{"name":"freeDurationCount","kind":"scalar","type":"Int","dbName":"free_duration_count"},{"name":"freeDurationUnit","kind":"scalar","type":"String","dbName":"free_duration_unit"},{"name":"appliesToPlan","kind":"scalar","type":"String","dbName":"applies_to_plan"},{"name":"maxRedemptions","kind":"scalar","type":"Int","dbName":"max_redemptions"},{"name":"redeemedCount","kind":"scalar","type":"Int","dbName":"redeemed_count"},{"name":"startsAt","kind":"scalar","type":"DateTime","dbName":"starts_at"},{"name":"expiresAt","kind":"scalar","type":"DateTime","dbName":"expires_at"},{"name":"isActive","kind":"scalar","type":"Boolean","dbName":"is_active"},{"name":"stripeCouponId","kind":"scalar","type":"String","dbName":"stripe_coupon_id"},{"name":"stripePromotionCodeId","kind":"scalar","type":"String","dbName":"stripe_promotion_code_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"promo_codes"},"PromoRedemption":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"promoCodeId","kind":"scalar","type":"String","dbName":"promo_code_id"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"userId","kind":"scalar","type":"Int","dbName":"user_id"},{"name":"subscriptionId","kind":"scalar","type":"String","dbName":"subscription_id"},{"name":"redeemedAt","kind":"scalar","type":"DateTime","dbName":"redeemed_at"},{"name":"expiresAt","kind":"scalar","type":"DateTime","dbName":"expires_at"},{"name":"raw","kind":"scalar","type":"Json"}],"dbName":"promo_redemptions"},"SubscriptionGrant":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"planCode","kind":"scalar","type":"String","dbName":"plan_code"},{"name":"grantType","kind":"scalar","type":"String","dbName":"grant_type"},{"name":"startsAt","kind":"scalar","type":"DateTime","dbName":"starts_at"},{"name":"endsAt","kind":"scalar","type":"DateTime","dbName":"ends_at"},{"name":"durationCount","kind":"scalar","type":"Int","dbName":"duration_count"},{"name":"durationUnit","kind":"scalar","type":"String","dbName":"duration_unit"},{"name":"reason","kind":"scalar","type":"String"},{"name":"grantedByUserId","kind":"scalar","type":"Int","dbName":"granted_by_user_id"},{"name":"isActive","kind":"scalar","type":"Boolean","dbName":"is_active"},{"name":"featuresOverride","kind":"scalar","type":"Json","dbName":"features_override"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"subscription_grants"},"MailLayout":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"isDefault","kind":"scalar","type":"Boolean","dbName":"is_default"},{"name":"htmlWrapper","kind":"scalar","type":"String","dbName":"html_wrapper"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"mail_layouts"},"MailTemplate":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"key","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"category","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"htmlBody","kind":"scalar","type":"String","dbName":"html_body"},{"name":"textBody","kind":"scalar","type":"String","dbName":"text_body"},{"name":"locale","kind":"scalar","type":"String"},{"name":"enabled","kind":"scalar","type":"Boolean"},{"name":"layoutId","kind":"scalar","type":"String","dbName":"layout_id"},{"name":"description","kind":"scalar","type":"String"},{"name":"variables","kind":"scalar","type":"Json"},{"name":"isMarketing","kind":"scalar","type":"Boolean","dbName":"is_marketing"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"mail_templates"},"MailQueue":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"toEmail","kind":"scalar","type":"String","dbName":"to_email"},{"name":"toName","kind":"scalar","type":"String","dbName":"to_name"},{"name":"templateKey","kind":"scalar","type":"String","dbName":"template_key"},{"name":"category","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"htmlBody","kind":"scalar","type":"String","dbName":"html_body"},{"name":"textBody","kind":"scalar","type":"String","dbName":"text_body"},{"name":"status","kind":"scalar","type":"String"},{"name":"attempts","kind":"scalar","type":"Int"},{"name":"maxAttempts","kind":"scalar","type":"Int","dbName":"max_attempts"},{"name":"lastError","kind":"scalar","type":"String","dbName":"last_error"},{"name":"scheduledAt","kind":"scalar","type":"DateTime","dbName":"scheduled_at"},{"name":"sentAt","kind":"scalar","type":"DateTime","dbName":"sent_at"},{"name":"providerMessageId","kind":"scalar","type":"String","dbName":"provider_message_id"},{"name":"campaignId","kind":"scalar","type":"String","dbName":"campaign_id"},{"name":"dedupeKey","kind":"scalar","type":"String","dbName":"dedupe_key"},{"name":"meta","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"mail_queue"},"MailEvent":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"queueId","kind":"scalar","type":"String","dbName":"queue_id"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"type","kind":"scalar","type":"String"},{"name":"detail","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"mail_events"},"MailPreference":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"token","kind":"scalar","type":"String"},{"name":"unsubAll","kind":"scalar","type":"Boolean","dbName":"unsub_all"},{"name":"unsubMarketing","kind":"scalar","type":"Boolean","dbName":"unsub_marketing"},{"name":"categories","kind":"scalar","type":"Json"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"mail_preferences"},"MailCampaign":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"templateKey","kind":"scalar","type":"String","dbName":"template_key"},{"name":"subject","kind":"scalar","type":"String"},{"name":"htmlBody","kind":"scalar","type":"String","dbName":"html_body"},{"name":"category","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"audience","kind":"scalar","type":"Json"},{"name":"scheduledAt","kind":"scalar","type":"DateTime","dbName":"scheduled_at"},{"name":"sentCount","kind":"scalar","type":"Int","dbName":"sent_count"},{"name":"failedCount","kind":"scalar","type":"Int","dbName":"failed_count"},{"name":"createdByUserId","kind":"scalar","type":"Int","dbName":"created_by_user_id"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"mail_campaigns"},"SupportConversation":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"ref","kind":"scalar","type":"String"},{"name":"subject","kind":"scalar","type":"String"},{"name":"status","kind":"scalar","type":"String"},{"name":"channel","kind":"scalar","type":"String"},{"name":"priority","kind":"scalar","type":"String"},{"name":"category","kind":"scalar","type":"String"},{"name":"createdByUserId","kind":"scalar","type":"Int","dbName":"created_by_user_id"},{"name":"createdByName","kind":"scalar","type":"String","dbName":"created_by_name"},{"name":"assignedToUserId","kind":"scalar","type":"Int","dbName":"assigned_to_user_id"},{"name":"lastMessageAt","kind":"scalar","type":"DateTime","dbName":"last_message_at"},{"name":"customerUnread","kind":"scalar","type":"Int","dbName":"customer_unread"},{"name":"agentUnread","kind":"scalar","type":"Int","dbName":"agent_unread"},{"name":"firstResponseAt","kind":"scalar","type":"DateTime","dbName":"first_response_at"},{"name":"resolvedAt","kind":"scalar","type":"DateTime","dbName":"resolved_at"},{"name":"closedAt","kind":"scalar","type":"DateTime","dbName":"closed_at"},{"name":"slaDueAt","kind":"scalar","type":"DateTime","dbName":"sla_due_at"},{"name":"slaBreached","kind":"scalar","type":"Boolean","dbName":"sla_breached"},{"name":"ratingScore","kind":"scalar","type":"Int","dbName":"rating_score"},{"name":"ratingComment","kind":"scalar","type":"String","dbName":"rating_comment"},{"name":"meta","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"support_conversations"},"SupportMessage":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"conversationId","kind":"scalar","type":"String","dbName":"conversation_id"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"authorType","kind":"scalar","type":"String","dbName":"author_type"},{"name":"authorUserId","kind":"scalar","type":"Int","dbName":"author_user_id"},{"name":"authorName","kind":"scalar","type":"String","dbName":"author_name"},{"name":"body","kind":"scalar","type":"String"},{"name":"isInternal","kind":"scalar","type":"Boolean","dbName":"is_internal"},{"name":"meta","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"support_messages"},"SupportAttachment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"messageId","kind":"scalar","type":"String","dbName":"message_id"},{"name":"conversationId","kind":"scalar","type":"String","dbName":"conversation_id"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"filename","kind":"scalar","type":"String"},{"name":"mimeType","kind":"scalar","type":"String","dbName":"mime_type"},{"name":"sizeBytes","kind":"scalar","type":"Int","dbName":"size_bytes"},{"name":"storageKey","kind":"scalar","type":"String","dbName":"storage_key"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"}],"dbName":"support_attachments"},"SupportSlaPolicy":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"priority","kind":"scalar","type":"String"},{"name":"firstResponseMins","kind":"scalar","type":"Int","dbName":"first_response_mins"},{"name":"resolutionMins","kind":"scalar","type":"Int","dbName":"resolution_mins"},{"name":"isDefault","kind":"scalar","type":"Boolean","dbName":"is_default"},{"name":"raw","kind":"scalar","type":"Json"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"support_sla_policies"},"SupportCannedReply":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"title","kind":"scalar","type":"String"},{"name":"body","kind":"scalar","type":"String"},{"name":"category","kind":"scalar","type":"String"},{"name":"shortcut","kind":"scalar","type":"String"},{"name":"createdByUserId","kind":"scalar","type":"Int","dbName":"created_by_user_id"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"support_canned_replies"},"TenantEncryptionKey":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"tenantId","kind":"scalar","type":"String","dbName":"tenant_id"},{"name":"wrappedDek","kind":"scalar","type":"String","dbName":"wrapped_dek"},{"name":"algo","kind":"scalar","type":"String"},{"name":"keyVersion","kind":"scalar","type":"Int","dbName":"key_version"},{"name":"status","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime","dbName":"created_at"},{"name":"updatedAt","kind":"scalar","type":"DateTime","dbName":"updated_at"}],"dbName":"tenant_encryption_keys"}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","Document.findUnique","Document.findUniqueOrThrow","orderBy","cursor","Document.findFirst","Document.findFirstOrThrow","Document.findMany","data","Document.createOne","Document.createMany","Document.createManyAndReturn","Document.updateOne","Document.updateMany","Document.updateManyAndReturn","create","update","Document.upsertOne","Document.deleteOne","Document.deleteMany","having","_count","_avg","_sum","_min","_max","Document.groupBy","Document.aggregate","DocumentFile.findUnique","DocumentFile.findUniqueOrThrow","DocumentFile.findFirst","DocumentFile.findFirstOrThrow","DocumentFile.findMany","DocumentFile.createOne","DocumentFile.createMany","DocumentFile.createManyAndReturn","DocumentFile.updateOne","DocumentFile.updateMany","DocumentFile.updateManyAndReturn","DocumentFile.upsertOne","DocumentFile.deleteOne","DocumentFile.deleteMany","DocumentFile.groupBy","DocumentFile.aggregate","DocumentVersion.findUnique","DocumentVersion.findUniqueOrThrow","DocumentVersion.findFirst","DocumentVersion.findFirstOrThrow","DocumentVersion.findMany","DocumentVersion.createOne","DocumentVersion.createMany","DocumentVersion.createManyAndReturn","DocumentVersion.updateOne","DocumentVersion.updateMany","DocumentVersion.updateManyAndReturn","DocumentVersion.upsertOne","DocumentVersion.deleteOne","DocumentVersion.deleteMany","DocumentVersion.groupBy","DocumentVersion.aggregate","DocumentOcr.findUnique","DocumentOcr.findUniqueOrThrow","DocumentOcr.findFirst","DocumentOcr.findFirstOrThrow","DocumentOcr.findMany","DocumentOcr.createOne","DocumentOcr.createMany","DocumentOcr.createManyAndReturn","DocumentOcr.updateOne","DocumentOcr.updateMany","DocumentOcr.updateManyAndReturn","DocumentOcr.upsertOne","DocumentOcr.deleteOne","DocumentOcr.deleteMany","DocumentOcr.groupBy","DocumentOcr.aggregate","DocumentAiAnalysis.findUnique","DocumentAiAnalysis.findUniqueOrThrow","DocumentAiAnalysis.findFirst","DocumentAiAnalysis.findFirstOrThrow","DocumentAiAnalysis.findMany","DocumentAiAnalysis.createOne","DocumentAiAnalysis.createMany","DocumentAiAnalysis.createManyAndReturn","DocumentAiAnalysis.updateOne","DocumentAiAnalysis.updateMany","DocumentAiAnalysis.updateManyAndReturn","DocumentAiAnalysis.upsertOne","DocumentAiAnalysis.deleteOne","DocumentAiAnalysis.deleteMany","DocumentAiAnalysis.groupBy","DocumentAiAnalysis.aggregate","DocumentAiSuggestion.findUnique","DocumentAiSuggestion.findUniqueOrThrow","DocumentAiSuggestion.findFirst","DocumentAiSuggestion.findFirstOrThrow","DocumentAiSuggestion.findMany","DocumentAiSuggestion.createOne","DocumentAiSuggestion.createMany","DocumentAiSuggestion.createManyAndReturn","DocumentAiSuggestion.updateOne","DocumentAiSuggestion.updateMany","DocumentAiSuggestion.updateManyAndReturn","DocumentAiSuggestion.upsertOne","DocumentAiSuggestion.deleteOne","DocumentAiSuggestion.deleteMany","DocumentAiSuggestion.groupBy","DocumentAiSuggestion.aggregate","Tag.findUnique","Tag.findUniqueOrThrow","Tag.findFirst","Tag.findFirstOrThrow","Tag.findMany","Tag.createOne","Tag.createMany","Tag.createManyAndReturn","Tag.updateOne","Tag.updateMany","Tag.updateManyAndReturn","Tag.upsertOne","Tag.deleteOne","Tag.deleteMany","Tag.groupBy","Tag.aggregate","DocumentTag.findUnique","DocumentTag.findUniqueOrThrow","DocumentTag.findFirst","DocumentTag.findFirstOrThrow","DocumentTag.findMany","DocumentTag.createOne","DocumentTag.createMany","DocumentTag.createManyAndReturn","DocumentTag.updateOne","DocumentTag.updateMany","DocumentTag.updateManyAndReturn","DocumentTag.upsertOne","DocumentTag.deleteOne","DocumentTag.deleteMany","DocumentTag.groupBy","DocumentTag.aggregate","DocumentType.findUnique","DocumentType.findUniqueOrThrow","DocumentType.findFirst","DocumentType.findFirstOrThrow","DocumentType.findMany","DocumentType.createOne","DocumentType.createMany","DocumentType.createManyAndReturn","DocumentType.updateOne","DocumentType.updateMany","DocumentType.updateManyAndReturn","DocumentType.upsertOne","DocumentType.deleteOne","DocumentType.deleteMany","DocumentType.groupBy","DocumentType.aggregate","Correspondent.findUnique","Correspondent.findUniqueOrThrow","Correspondent.findFirst","Correspondent.findFirstOrThrow","Correspondent.findMany","Correspondent.createOne","Correspondent.createMany","Correspondent.createManyAndReturn","Correspondent.updateOne","Correspondent.updateMany","Correspondent.updateManyAndReturn","Correspondent.upsertOne","Correspondent.deleteOne","Correspondent.deleteMany","Correspondent.groupBy","Correspondent.aggregate","DocumentCorrespondent.findUnique","DocumentCorrespondent.findUniqueOrThrow","DocumentCorrespondent.findFirst","DocumentCorrespondent.findFirstOrThrow","DocumentCorrespondent.findMany","DocumentCorrespondent.createOne","DocumentCorrespondent.createMany","DocumentCorrespondent.createManyAndReturn","DocumentCorrespondent.updateOne","DocumentCorrespondent.updateMany","DocumentCorrespondent.updateManyAndReturn","DocumentCorrespondent.upsertOne","DocumentCorrespondent.deleteOne","DocumentCorrespondent.deleteMany","DocumentCorrespondent.groupBy","DocumentCorrespondent.aggregate","Folder.findUnique","Folder.findUniqueOrThrow","Folder.findFirst","Folder.findFirstOrThrow","Folder.findMany","Folder.createOne","Folder.createMany","Folder.createManyAndReturn","Folder.updateOne","Folder.updateMany","Folder.updateManyAndReturn","Folder.upsertOne","Folder.deleteOne","Folder.deleteMany","Folder.groupBy","Folder.aggregate","FolderDocument.findUnique","FolderDocument.findUniqueOrThrow","FolderDocument.findFirst","FolderDocument.findFirstOrThrow","FolderDocument.findMany","FolderDocument.createOne","FolderDocument.createMany","FolderDocument.createManyAndReturn","FolderDocument.updateOne","FolderDocument.updateMany","FolderDocument.updateManyAndReturn","FolderDocument.upsertOne","FolderDocument.deleteOne","FolderDocument.deleteMany","FolderDocument.groupBy","FolderDocument.aggregate","BudgetEntry.findUnique","BudgetEntry.findUniqueOrThrow","BudgetEntry.findFirst","BudgetEntry.findFirstOrThrow","BudgetEntry.findMany","BudgetEntry.createOne","BudgetEntry.createMany","BudgetEntry.createManyAndReturn","BudgetEntry.updateOne","BudgetEntry.updateMany","BudgetEntry.updateManyAndReturn","BudgetEntry.upsertOne","BudgetEntry.deleteOne","BudgetEntry.deleteMany","BudgetEntry.groupBy","BudgetEntry.aggregate","BudgetPayment.findUnique","BudgetPayment.findUniqueOrThrow","BudgetPayment.findFirst","BudgetPayment.findFirstOrThrow","BudgetPayment.findMany","BudgetPayment.createOne","BudgetPayment.createMany","BudgetPayment.createManyAndReturn","BudgetPayment.updateOne","BudgetPayment.updateMany","BudgetPayment.updateManyAndReturn","BudgetPayment.upsertOne","BudgetPayment.deleteOne","BudgetPayment.deleteMany","BudgetPayment.groupBy","BudgetPayment.aggregate","Mail.findUnique","Mail.findUniqueOrThrow","Mail.findFirst","Mail.findFirstOrThrow","Mail.findMany","Mail.createOne","Mail.createMany","Mail.createManyAndReturn","Mail.updateOne","Mail.updateMany","Mail.updateManyAndReturn","Mail.upsertOne","Mail.deleteOne","Mail.deleteMany","Mail.groupBy","Mail.aggregate","MailAttachment.findUnique","MailAttachment.findUniqueOrThrow","MailAttachment.findFirst","MailAttachment.findFirstOrThrow","MailAttachment.findMany","MailAttachment.createOne","MailAttachment.createMany","MailAttachment.createManyAndReturn","MailAttachment.updateOne","MailAttachment.updateMany","MailAttachment.updateManyAndReturn","MailAttachment.upsertOne","MailAttachment.deleteOne","MailAttachment.deleteMany","MailAttachment.groupBy","MailAttachment.aggregate","MailDocumentLink.findUnique","MailDocumentLink.findUniqueOrThrow","MailDocumentLink.findFirst","MailDocumentLink.findFirstOrThrow","MailDocumentLink.findMany","MailDocumentLink.createOne","MailDocumentLink.createMany","MailDocumentLink.createManyAndReturn","MailDocumentLink.updateOne","MailDocumentLink.updateMany","MailDocumentLink.updateManyAndReturn","MailDocumentLink.upsertOne","MailDocumentLink.deleteOne","MailDocumentLink.deleteMany","MailDocumentLink.groupBy","MailDocumentLink.aggregate","Reminder.findUnique","Reminder.findUniqueOrThrow","Reminder.findFirst","Reminder.findFirstOrThrow","Reminder.findMany","Reminder.createOne","Reminder.createMany","Reminder.createManyAndReturn","Reminder.updateOne","Reminder.updateMany","Reminder.updateManyAndReturn","Reminder.upsertOne","Reminder.deleteOne","Reminder.deleteMany","Reminder.groupBy","Reminder.aggregate","Task.findUnique","Task.findUniqueOrThrow","Task.findFirst","Task.findFirstOrThrow","Task.findMany","Task.createOne","Task.createMany","Task.createManyAndReturn","Task.updateOne","Task.updateMany","Task.updateManyAndReturn","Task.upsertOne","Task.deleteOne","Task.deleteMany","Task.groupBy","Task.aggregate","Signature.findUnique","Signature.findUniqueOrThrow","Signature.findFirst","Signature.findFirstOrThrow","Signature.findMany","Signature.createOne","Signature.createMany","Signature.createManyAndReturn","Signature.updateOne","Signature.updateMany","Signature.updateManyAndReturn","Signature.upsertOne","Signature.deleteOne","Signature.deleteMany","Signature.groupBy","Signature.aggregate","LearnedTemplate.findUnique","LearnedTemplate.findUniqueOrThrow","LearnedTemplate.findFirst","LearnedTemplate.findFirstOrThrow","LearnedTemplate.findMany","LearnedTemplate.createOne","LearnedTemplate.createMany","LearnedTemplate.createManyAndReturn","LearnedTemplate.updateOne","LearnedTemplate.updateMany","LearnedTemplate.updateManyAndReturn","LearnedTemplate.upsertOne","LearnedTemplate.deleteOne","LearnedTemplate.deleteMany","LearnedTemplate.groupBy","LearnedTemplate.aggregate","AssistantActionLog.findUnique","AssistantActionLog.findUniqueOrThrow","AssistantActionLog.findFirst","AssistantActionLog.findFirstOrThrow","AssistantActionLog.findMany","AssistantActionLog.createOne","AssistantActionLog.createMany","AssistantActionLog.createManyAndReturn","AssistantActionLog.updateOne","AssistantActionLog.updateMany","AssistantActionLog.updateManyAndReturn","AssistantActionLog.upsertOne","AssistantActionLog.deleteOne","AssistantActionLog.deleteMany","AssistantActionLog.groupBy","AssistantActionLog.aggregate","ActivityLog.findUnique","ActivityLog.findUniqueOrThrow","ActivityLog.findFirst","ActivityLog.findFirstOrThrow","ActivityLog.findMany","ActivityLog.createOne","ActivityLog.createMany","ActivityLog.createManyAndReturn","ActivityLog.updateOne","ActivityLog.updateMany","ActivityLog.updateManyAndReturn","ActivityLog.upsertOne","ActivityLog.deleteOne","ActivityLog.deleteMany","ActivityLog.groupBy","ActivityLog.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","Counter.findUnique","Counter.findUniqueOrThrow","Counter.findFirst","Counter.findFirstOrThrow","Counter.findMany","Counter.createOne","Counter.createMany","Counter.createManyAndReturn","Counter.updateOne","Counter.updateMany","Counter.updateManyAndReturn","Counter.upsertOne","Counter.deleteOne","Counter.deleteMany","Counter.groupBy","Counter.aggregate","DocumentTitleOverride.findUnique","DocumentTitleOverride.findUniqueOrThrow","DocumentTitleOverride.findFirst","DocumentTitleOverride.findFirstOrThrow","DocumentTitleOverride.findMany","DocumentTitleOverride.createOne","DocumentTitleOverride.createMany","DocumentTitleOverride.createManyAndReturn","DocumentTitleOverride.updateOne","DocumentTitleOverride.updateMany","DocumentTitleOverride.updateManyAndReturn","DocumentTitleOverride.upsertOne","DocumentTitleOverride.deleteOne","DocumentTitleOverride.deleteMany","DocumentTitleOverride.groupBy","DocumentTitleOverride.aggregate","EmailContact.findUnique","EmailContact.findUniqueOrThrow","EmailContact.findFirst","EmailContact.findFirstOrThrow","EmailContact.findMany","EmailContact.createOne","EmailContact.createMany","EmailContact.createManyAndReturn","EmailContact.updateOne","EmailContact.updateMany","EmailContact.updateManyAndReturn","EmailContact.upsertOne","EmailContact.deleteOne","EmailContact.deleteMany","EmailContact.groupBy","EmailContact.aggregate","MailAccount.findUnique","MailAccount.findUniqueOrThrow","MailAccount.findFirst","MailAccount.findFirstOrThrow","MailAccount.findMany","MailAccount.createOne","MailAccount.createMany","MailAccount.createManyAndReturn","MailAccount.updateOne","MailAccount.updateMany","MailAccount.updateManyAndReturn","MailAccount.upsertOne","MailAccount.deleteOne","MailAccount.deleteMany","MailAccount.groupBy","MailAccount.aggregate","MailOauthToken.findUnique","MailOauthToken.findUniqueOrThrow","MailOauthToken.findFirst","MailOauthToken.findFirstOrThrow","MailOauthToken.findMany","MailOauthToken.createOne","MailOauthToken.createMany","MailOauthToken.createManyAndReturn","MailOauthToken.updateOne","MailOauthToken.updateMany","MailOauthToken.updateManyAndReturn","MailOauthToken.upsertOne","MailOauthToken.deleteOne","MailOauthToken.deleteMany","MailOauthToken.groupBy","MailOauthToken.aggregate","SavedSignature.findUnique","SavedSignature.findUniqueOrThrow","SavedSignature.findFirst","SavedSignature.findFirstOrThrow","SavedSignature.findMany","SavedSignature.createOne","SavedSignature.createMany","SavedSignature.createManyAndReturn","SavedSignature.updateOne","SavedSignature.updateMany","SavedSignature.updateManyAndReturn","SavedSignature.upsertOne","SavedSignature.deleteOne","SavedSignature.deleteMany","SavedSignature.groupBy","SavedSignature.aggregate","HiddenSender.findUnique","HiddenSender.findUniqueOrThrow","HiddenSender.findFirst","HiddenSender.findFirstOrThrow","HiddenSender.findMany","HiddenSender.createOne","HiddenSender.createMany","HiddenSender.createManyAndReturn","HiddenSender.updateOne","HiddenSender.updateMany","HiddenSender.updateManyAndReturn","HiddenSender.upsertOne","HiddenSender.deleteOne","HiddenSender.deleteMany","HiddenSender.groupBy","HiddenSender.aggregate","CustomField.findUnique","CustomField.findUniqueOrThrow","CustomField.findFirst","CustomField.findFirstOrThrow","CustomField.findMany","CustomField.createOne","CustomField.createMany","CustomField.createManyAndReturn","CustomField.updateOne","CustomField.updateMany","CustomField.updateManyAndReturn","CustomField.upsertOne","CustomField.deleteOne","CustomField.deleteMany","CustomField.groupBy","CustomField.aggregate","Setting.findUnique","Setting.findUniqueOrThrow","Setting.findFirst","Setting.findFirstOrThrow","Setting.findMany","Setting.createOne","Setting.createMany","Setting.createManyAndReturn","Setting.updateOne","Setting.updateMany","Setting.updateManyAndReturn","Setting.upsertOne","Setting.deleteOne","Setting.deleteMany","Setting.groupBy","Setting.aggregate","Tenant.findUnique","Tenant.findUniqueOrThrow","Tenant.findFirst","Tenant.findFirstOrThrow","Tenant.findMany","Tenant.createOne","Tenant.createMany","Tenant.createManyAndReturn","Tenant.updateOne","Tenant.updateMany","Tenant.updateManyAndReturn","Tenant.upsertOne","Tenant.deleteOne","Tenant.deleteMany","Tenant.groupBy","Tenant.aggregate","Membership.findUnique","Membership.findUniqueOrThrow","Membership.findFirst","Membership.findFirstOrThrow","Membership.findMany","Membership.createOne","Membership.createMany","Membership.createManyAndReturn","Membership.updateOne","Membership.updateMany","Membership.updateManyAndReturn","Membership.upsertOne","Membership.deleteOne","Membership.deleteMany","Membership.groupBy","Membership.aggregate","TenantSettings.findUnique","TenantSettings.findUniqueOrThrow","TenantSettings.findFirst","TenantSettings.findFirstOrThrow","TenantSettings.findMany","TenantSettings.createOne","TenantSettings.createMany","TenantSettings.createManyAndReturn","TenantSettings.updateOne","TenantSettings.updateMany","TenantSettings.updateManyAndReturn","TenantSettings.upsertOne","TenantSettings.deleteOne","TenantSettings.deleteMany","TenantSettings.groupBy","TenantSettings.aggregate","Subscription.findUnique","Subscription.findUniqueOrThrow","Subscription.findFirst","Subscription.findFirstOrThrow","Subscription.findMany","Subscription.createOne","Subscription.createMany","Subscription.createManyAndReturn","Subscription.updateOne","Subscription.updateMany","Subscription.updateManyAndReturn","Subscription.upsertOne","Subscription.deleteOne","Subscription.deleteMany","Subscription.groupBy","Subscription.aggregate","Invoice.findUnique","Invoice.findUniqueOrThrow","Invoice.findFirst","Invoice.findFirstOrThrow","Invoice.findMany","Invoice.createOne","Invoice.createMany","Invoice.createManyAndReturn","Invoice.updateOne","Invoice.updateMany","Invoice.updateManyAndReturn","Invoice.upsertOne","Invoice.deleteOne","Invoice.deleteMany","Invoice.groupBy","Invoice.aggregate","InvoiceLine.findUnique","InvoiceLine.findUniqueOrThrow","InvoiceLine.findFirst","InvoiceLine.findFirstOrThrow","InvoiceLine.findMany","InvoiceLine.createOne","InvoiceLine.createMany","InvoiceLine.createManyAndReturn","InvoiceLine.updateOne","InvoiceLine.updateMany","InvoiceLine.updateManyAndReturn","InvoiceLine.upsertOne","InvoiceLine.deleteOne","InvoiceLine.deleteMany","InvoiceLine.groupBy","InvoiceLine.aggregate","BillingProfile.findUnique","BillingProfile.findUniqueOrThrow","BillingProfile.findFirst","BillingProfile.findFirstOrThrow","BillingProfile.findMany","BillingProfile.createOne","BillingProfile.createMany","BillingProfile.createManyAndReturn","BillingProfile.updateOne","BillingProfile.updateMany","BillingProfile.updateManyAndReturn","BillingProfile.upsertOne","BillingProfile.deleteOne","BillingProfile.deleteMany","BillingProfile.groupBy","BillingProfile.aggregate","InvoiceTemplate.findUnique","InvoiceTemplate.findUniqueOrThrow","InvoiceTemplate.findFirst","InvoiceTemplate.findFirstOrThrow","InvoiceTemplate.findMany","InvoiceTemplate.createOne","InvoiceTemplate.createMany","InvoiceTemplate.createManyAndReturn","InvoiceTemplate.updateOne","InvoiceTemplate.updateMany","InvoiceTemplate.updateManyAndReturn","InvoiceTemplate.upsertOne","InvoiceTemplate.deleteOne","InvoiceTemplate.deleteMany","InvoiceTemplate.groupBy","InvoiceTemplate.aggregate","PaymentEvent.findUnique","PaymentEvent.findUniqueOrThrow","PaymentEvent.findFirst","PaymentEvent.findFirstOrThrow","PaymentEvent.findMany","PaymentEvent.createOne","PaymentEvent.createMany","PaymentEvent.createManyAndReturn","PaymentEvent.updateOne","PaymentEvent.updateMany","PaymentEvent.updateManyAndReturn","PaymentEvent.upsertOne","PaymentEvent.deleteOne","PaymentEvent.deleteMany","PaymentEvent.groupBy","PaymentEvent.aggregate","SaasPlan.findUnique","SaasPlan.findUniqueOrThrow","SaasPlan.findFirst","SaasPlan.findFirstOrThrow","SaasPlan.findMany","SaasPlan.createOne","SaasPlan.createMany","SaasPlan.createManyAndReturn","SaasPlan.updateOne","SaasPlan.updateMany","SaasPlan.updateManyAndReturn","SaasPlan.upsertOne","SaasPlan.deleteOne","SaasPlan.deleteMany","SaasPlan.groupBy","SaasPlan.aggregate","PromoCode.findUnique","PromoCode.findUniqueOrThrow","PromoCode.findFirst","PromoCode.findFirstOrThrow","PromoCode.findMany","PromoCode.createOne","PromoCode.createMany","PromoCode.createManyAndReturn","PromoCode.updateOne","PromoCode.updateMany","PromoCode.updateManyAndReturn","PromoCode.upsertOne","PromoCode.deleteOne","PromoCode.deleteMany","PromoCode.groupBy","PromoCode.aggregate","PromoRedemption.findUnique","PromoRedemption.findUniqueOrThrow","PromoRedemption.findFirst","PromoRedemption.findFirstOrThrow","PromoRedemption.findMany","PromoRedemption.createOne","PromoRedemption.createMany","PromoRedemption.createManyAndReturn","PromoRedemption.updateOne","PromoRedemption.updateMany","PromoRedemption.updateManyAndReturn","PromoRedemption.upsertOne","PromoRedemption.deleteOne","PromoRedemption.deleteMany","PromoRedemption.groupBy","PromoRedemption.aggregate","SubscriptionGrant.findUnique","SubscriptionGrant.findUniqueOrThrow","SubscriptionGrant.findFirst","SubscriptionGrant.findFirstOrThrow","SubscriptionGrant.findMany","SubscriptionGrant.createOne","SubscriptionGrant.createMany","SubscriptionGrant.createManyAndReturn","SubscriptionGrant.updateOne","SubscriptionGrant.updateMany","SubscriptionGrant.updateManyAndReturn","SubscriptionGrant.upsertOne","SubscriptionGrant.deleteOne","SubscriptionGrant.deleteMany","SubscriptionGrant.groupBy","SubscriptionGrant.aggregate","MailLayout.findUnique","MailLayout.findUniqueOrThrow","MailLayout.findFirst","MailLayout.findFirstOrThrow","MailLayout.findMany","MailLayout.createOne","MailLayout.createMany","MailLayout.createManyAndReturn","MailLayout.updateOne","MailLayout.updateMany","MailLayout.updateManyAndReturn","MailLayout.upsertOne","MailLayout.deleteOne","MailLayout.deleteMany","MailLayout.groupBy","MailLayout.aggregate","MailTemplate.findUnique","MailTemplate.findUniqueOrThrow","MailTemplate.findFirst","MailTemplate.findFirstOrThrow","MailTemplate.findMany","MailTemplate.createOne","MailTemplate.createMany","MailTemplate.createManyAndReturn","MailTemplate.updateOne","MailTemplate.updateMany","MailTemplate.updateManyAndReturn","MailTemplate.upsertOne","MailTemplate.deleteOne","MailTemplate.deleteMany","MailTemplate.groupBy","MailTemplate.aggregate","MailQueue.findUnique","MailQueue.findUniqueOrThrow","MailQueue.findFirst","MailQueue.findFirstOrThrow","MailQueue.findMany","MailQueue.createOne","MailQueue.createMany","MailQueue.createManyAndReturn","MailQueue.updateOne","MailQueue.updateMany","MailQueue.updateManyAndReturn","MailQueue.upsertOne","MailQueue.deleteOne","MailQueue.deleteMany","MailQueue.groupBy","MailQueue.aggregate","MailEvent.findUnique","MailEvent.findUniqueOrThrow","MailEvent.findFirst","MailEvent.findFirstOrThrow","MailEvent.findMany","MailEvent.createOne","MailEvent.createMany","MailEvent.createManyAndReturn","MailEvent.updateOne","MailEvent.updateMany","MailEvent.updateManyAndReturn","MailEvent.upsertOne","MailEvent.deleteOne","MailEvent.deleteMany","MailEvent.groupBy","MailEvent.aggregate","MailPreference.findUnique","MailPreference.findUniqueOrThrow","MailPreference.findFirst","MailPreference.findFirstOrThrow","MailPreference.findMany","MailPreference.createOne","MailPreference.createMany","MailPreference.createManyAndReturn","MailPreference.updateOne","MailPreference.updateMany","MailPreference.updateManyAndReturn","MailPreference.upsertOne","MailPreference.deleteOne","MailPreference.deleteMany","MailPreference.groupBy","MailPreference.aggregate","MailCampaign.findUnique","MailCampaign.findUniqueOrThrow","MailCampaign.findFirst","MailCampaign.findFirstOrThrow","MailCampaign.findMany","MailCampaign.createOne","MailCampaign.createMany","MailCampaign.createManyAndReturn","MailCampaign.updateOne","MailCampaign.updateMany","MailCampaign.updateManyAndReturn","MailCampaign.upsertOne","MailCampaign.deleteOne","MailCampaign.deleteMany","MailCampaign.groupBy","MailCampaign.aggregate","SupportConversation.findUnique","SupportConversation.findUniqueOrThrow","SupportConversation.findFirst","SupportConversation.findFirstOrThrow","SupportConversation.findMany","SupportConversation.createOne","SupportConversation.createMany","SupportConversation.createManyAndReturn","SupportConversation.updateOne","SupportConversation.updateMany","SupportConversation.updateManyAndReturn","SupportConversation.upsertOne","SupportConversation.deleteOne","SupportConversation.deleteMany","SupportConversation.groupBy","SupportConversation.aggregate","SupportMessage.findUnique","SupportMessage.findUniqueOrThrow","SupportMessage.findFirst","SupportMessage.findFirstOrThrow","SupportMessage.findMany","SupportMessage.createOne","SupportMessage.createMany","SupportMessage.createManyAndReturn","SupportMessage.updateOne","SupportMessage.updateMany","SupportMessage.updateManyAndReturn","SupportMessage.upsertOne","SupportMessage.deleteOne","SupportMessage.deleteMany","SupportMessage.groupBy","SupportMessage.aggregate","SupportAttachment.findUnique","SupportAttachment.findUniqueOrThrow","SupportAttachment.findFirst","SupportAttachment.findFirstOrThrow","SupportAttachment.findMany","SupportAttachment.createOne","SupportAttachment.createMany","SupportAttachment.createManyAndReturn","SupportAttachment.updateOne","SupportAttachment.updateMany","SupportAttachment.updateManyAndReturn","SupportAttachment.upsertOne","SupportAttachment.deleteOne","SupportAttachment.deleteMany","SupportAttachment.groupBy","SupportAttachment.aggregate","SupportSlaPolicy.findUnique","SupportSlaPolicy.findUniqueOrThrow","SupportSlaPolicy.findFirst","SupportSlaPolicy.findFirstOrThrow","SupportSlaPolicy.findMany","SupportSlaPolicy.createOne","SupportSlaPolicy.createMany","SupportSlaPolicy.createManyAndReturn","SupportSlaPolicy.updateOne","SupportSlaPolicy.updateMany","SupportSlaPolicy.updateManyAndReturn","SupportSlaPolicy.upsertOne","SupportSlaPolicy.deleteOne","SupportSlaPolicy.deleteMany","SupportSlaPolicy.groupBy","SupportSlaPolicy.aggregate","SupportCannedReply.findUnique","SupportCannedReply.findUniqueOrThrow","SupportCannedReply.findFirst","SupportCannedReply.findFirstOrThrow","SupportCannedReply.findMany","SupportCannedReply.createOne","SupportCannedReply.createMany","SupportCannedReply.createManyAndReturn","SupportCannedReply.updateOne","SupportCannedReply.updateMany","SupportCannedReply.updateManyAndReturn","SupportCannedReply.upsertOne","SupportCannedReply.deleteOne","SupportCannedReply.deleteMany","SupportCannedReply.groupBy","SupportCannedReply.aggregate","TenantEncryptionKey.findUnique","TenantEncryptionKey.findUniqueOrThrow","TenantEncryptionKey.findFirst","TenantEncryptionKey.findFirstOrThrow","TenantEncryptionKey.findMany","TenantEncryptionKey.createOne","TenantEncryptionKey.createMany","TenantEncryptionKey.createManyAndReturn","TenantEncryptionKey.updateOne","TenantEncryptionKey.updateMany","TenantEncryptionKey.updateManyAndReturn","TenantEncryptionKey.upsertOne","TenantEncryptionKey.deleteOne","TenantEncryptionKey.deleteMany","TenantEncryptionKey.groupBy","TenantEncryptionKey.aggregate","AND","OR","NOT","id","tenantId","wrappedDek","algo","keyVersion","status","createdAt","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","title","body","category","shortcut","createdByUserId","name","priority","firstResponseMins","resolutionMins","isDefault","raw","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","messageId","conversationId","filename","mimeType","sizeBytes","storageKey","authorType","authorUserId","authorName","isInternal","meta","ref","subject","channel","createdByName","assignedToUserId","lastMessageAt","customerUnread","agentUnread","firstResponseAt","resolvedAt","closedAt","slaDueAt","slaBreached","ratingScore","ratingComment","templateKey","htmlBody","audience","scheduledAt","sentCount","failedCount","email","token","unsubAll","unsubMarketing","categories","email_tenantId","queueId","type","detail","toEmail","toName","textBody","attempts","maxAttempts","lastError","sentAt","providerMessageId","campaignId","dedupeKey","key","locale","enabled","layoutId","description","variables","isMarketing","htmlWrapper","planCode","grantType","startsAt","endsAt","durationCount","durationUnit","reason","grantedByUserId","isActive","featuresOverride","promoCodeId","userId","subscriptionId","redeemedAt","expiresAt","code","discountType","percentOff","amountOffCents","currency","freeDurationCount","freeDurationUnit","appliesToPlan","maxRedemptions","redeemedCount","stripeCouponId","stripePromotionCodeId","isPublic","sortOrder","monthlyPriceCents","yearlyPriceCents","maxUsers","maxDocuments","maxStorageMb","aiEnabled","ocrEnabled","emailImportEnabled","onlyofficeEnabled","supportLevel","features","stripeProductId","stripeMonthlyPriceId","stripeYearlyPriceId","provider","eventType","providerEventId","processedAt","primaryColor","secondaryColor","fontFamily","logoPosition","showLogo","showPaymentDetails","showLegalFooter","showQrCode","headerHtml","footerHtml","customCss","profileName","companyName","legalName","legalForm","siren","siret","vatNumber","rcsCity","rcsNumber","rmNumber","apeNaf","shareCapital","addressLine1","addressLine2","postalCode","city","country","phone","website","logoUrl","signatureUrl","iban","bic","paymentTermsDays","latePaymentRate","fixedRecoveryIndemnityCents","vatRegime","defaultVatRate","invoicePrefix","creditNotePrefix","nextInvoiceNumber","nextCreditNoteNumber","legalFooterHtml","termsFooterHtml","invoiceId","quantity","unitPriceHtCents","discountCents","vatRate","taxCents","totalHtCents","totalTtcCents","periodStart","periodEnd","providerInvoiceId","amountDue","amountPaid","dueDate","paidAt","hostedInvoiceUrl","invoicePdf","invoiceNumber","billingProfileId","templateId","creditNoteOfId","issueDate","subtotalHtCents","buyerName","buyerLegalName","buyerEmail","buyerAddressLine1","buyerAddressLine2","buyerPostalCode","buyerCity","buyerCountry","buyerSiren","buyerSiret","buyerVatNumber","htmlUrl","pdfUrl","legalMentionsSnapshot","plan","providerCustomerId","providerSubscriptionId","currentPeriodStart","currentPeriodEnd","trialStart","trialEnd","cancelAt","canceledAt","manualGrantId","discountUntil","freeUntil","isFreeForever","role","tenantId_userId","slug","value","label","options","required","metadata","deletedAt","domain","imagePath","imageData","width","height","accountId","accessTokenEncrypted","refreshTokenEncrypted","expiryDate","scope","tokenType","displayName","scopes","source","lastSeenAt","documentId","username","passwordHash","isSuperuser","level","message","projectId","user","remindAt","financialItemId","mailId","threadId","kind","fromAddr","toAddr","date","snippet","hasAttachments","budgetEntryId","amount","account","direction","categoryId","categoryName","sourceDocumentId","folderId","folderId_documentId","parentId","color","correspondentId","documentId_correspondentId","tagId","documentId_tagId","textColor","analysisId","suggestionType","fieldName","suggestedValue","confidence","applied","rawPayload","summary","analyzedAt","content","created","createdDate","added","modified","documentTypeId","storagePath","checksum","storedFilename","originalFileName","pageCount","deleted","set","increment","decrement","multiply","divide"]'),
  graph: "9Q6rBLAHGLwHAADoDAAwvQcAAAQAEL4HAADoDAAwvwcCAAAAAcAHAQDcCwAhxQdAANILACHGB0AA0gsAIdIHAQDcCwAh3AcAAOYLACDmBwEA3AsAIbQJQADwCwAh4QkCAN0LACHvCQEA3AsAIfAJQADwCwAh8QkBANwLACHyCUAA8AsAIfMJQADwCwAh9AkCAN0LACH1CQEA3AsAIfYJAQDcCwAh9wkBANwLACH4CQEA3AsAIfkJAgDdCwAh-gkgAOULACEBAAAAAQAgAQAAAAEAIBi8BwAA6AwAML0HAAAEABC-BwAA6AwAML8HAgDRCwAhwAcBANwLACHFB0AA0gsAIcYHQADSCwAh0gcBANwLACHcBwAA5gsAIOYHAQDcCwAhtAlAAPALACHhCQIA3QsAIe8JAQDcCwAh8AlAAPALACHxCQEA3AsAIfIJQADwCwAh8wlAAPALACH0CQIA3QsAIfUJAQDcCwAh9gkBANwLACH3CQEA3AsAIfgJAQDcCwAh-QkCAN0LACH6CSAA5QsAIRHABwAA8QwAINIHAADxDAAg3AcAAPEMACDmBwAA8QwAILQJAADxDAAg4QkAAPEMACDvCQAA8QwAIPAJAADxDAAg8QkAAPEMACDyCQAA8QwAIPMJAADxDAAg9AkAAPEMACD1CQAA8QwAIPYJAADxDAAg9wkAAPEMACD4CQAA8QwAIPkJAADxDAAgAwAAAAQAIAMAAAUAMAQAAAEAIAMAAAAEACADAAAFADAEAAABACADAAAABAAgAwAABQAwBAAAAQAgFb8HAgAAAAHABwEAAAABxQdAAAAAAcYHQAAAAAHSBwEAAAAB3AeAAAAAAeYHAQAAAAG0CUAAAAAB4QkCAAAAAe8JAQAAAAHwCUAAAAAB8QkBAAAAAfIJQAAAAAHzCUAAAAAB9AkCAAAAAfUJAQAAAAH2CQEAAAAB9wkBAAAAAfgJAQAAAAH5CQIAAAAB-gkgAAAAAQEIAAAJACAVvwcCAAAAAcAHAQAAAAHFB0AAAAABxgdAAAAAAdIHAQAAAAHcB4AAAAAB5gcBAAAAAbQJQAAAAAHhCQIAAAAB7wkBAAAAAfAJQAAAAAHxCQEAAAAB8glAAAAAAfMJQAAAAAH0CQIAAAAB9QkBAAAAAfYJAQAAAAH3CQEAAAAB-AkBAAAAAfkJAgAAAAH6CSAAAAABAQgAAAsAMAEIAAALADAVvwcCAO8MACHABwEA9wwAIcUHQADwDAAhxgdAAPAMACHSBwEA9wwAIdwHgAAAAAHmBwEA9wwAIbQJQACODQAh4QkCAPgMACHvCQEA9wwAIfAJQACODQAh8QkBAPcMACHyCUAAjg0AIfMJQACODQAh9AkCAPgMACH1CQEA9wwAIfYJAQD3DAAh9wkBAPcMACH4CQEA9wwAIfkJAgD4DAAh-gkgAP4MACECAAAAAQAgCAAADgAgFb8HAgDvDAAhwAcBAPcMACHFB0AA8AwAIcYHQADwDAAh0gcBAPcMACHcB4AAAAAB5gcBAPcMACG0CUAAjg0AIeEJAgD4DAAh7wkBAPcMACHwCUAAjg0AIfEJAQD3DAAh8glAAI4NACHzCUAAjg0AIfQJAgD4DAAh9QkBAPcMACH2CQEA9wwAIfcJAQD3DAAh-AkBAPcMACH5CQIA-AwAIfoJIAD-DAAhAgAAAAQAIAgAABAAIAIAAAAEACAIAAAQACADAAAAAQAgDwAACQAgEAAADgAgAQAAAAEAIAEAAAAEACAWFQAA8Q4AIBYAAPIOACAXAAD1DgAgGAAA9A4AIBkAAPMOACDABwAA8QwAINIHAADxDAAg3AcAAPEMACDmBwAA8QwAILQJAADxDAAg4QkAAPEMACDvCQAA8QwAIPAJAADxDAAg8QkAAPEMACDyCQAA8QwAIPMJAADxDAAg9AkAAPEMACD1CQAA8QwAIPYJAADxDAAg9wkAAPEMACD4CQAA8QwAIPkJAADxDAAgGLwHAADnDAAwvQcAABcAEL4HAADnDAAwvwcCAMYLACHABwEA1AsAIcUHQADHCwAhxgdAAMcLACHSBwEA1AsAIdwHAADgCwAg5gcBANQLACG0CUAA7AsAIeEJAgDVCwAh7wkBANQLACHwCUAA7AsAIfEJAQDUCwAh8glAAOwLACHzCUAA7AsAIfQJAgDVCwAh9QkBANQLACH2CQEA1AsAIfcJAQDUCwAh-AkBANQLACH5CQIA1QsAIfoJIADfCwAhAwAAAAQAIAMAABYAMBQAABcAIAMAAAAEACADAAAFADAEAAABACALvAcAAOYMADC9BwAAHQAQvgcAAOYMADC_BwEAAAABwAcBANwLACHcBwAA5gsAIOUHAQDcCwAh5gcBANwLACHnBwIA3QsAIcQJAgDRCwAh0AkBANALACEBAAAAGgAgAQAAABoAIAu8BwAA5gwAML0HAAAdABC-BwAA5gwAML8HAQDQCwAhwAcBANwLACHcBwAA5gsAIOUHAQDcCwAh5gcBANwLACHnBwIA3QsAIcQJAgDRCwAh0AkBANALACEFwAcAAPEMACDcBwAA8QwAIOUHAADxDAAg5gcAAPEMACDnBwAA8QwAIAMAAAAdACADAAAeADAEAAAaACADAAAAHQAgAwAAHgAwBAAAGgAgAwAAAB0AIAMAAB4AMAQAABoAIAi_BwEAAAABwAcBAAAAAdwHgAAAAAHlBwEAAAAB5gcBAAAAAecHAgAAAAHECQIAAAAB0AkBAAAAAQEIAAAiACAIvwcBAAAAAcAHAQAAAAHcB4AAAAAB5QcBAAAAAeYHAQAAAAHnBwIAAAABxAkCAAAAAdAJAQAAAAEBCAAAJAAwAQgAACQAMAi_BwEA7gwAIcAHAQD3DAAh3AeAAAAAAeUHAQD3DAAh5gcBAPcMACHnBwIA-AwAIcQJAgDvDAAh0AkBAO4MACECAAAAGgAgCAAAJwAgCL8HAQDuDAAhwAcBAPcMACHcB4AAAAAB5QcBAPcMACHmBwEA9wwAIecHAgD4DAAhxAkCAO8MACHQCQEA7gwAIQIAAAAdACAIAAApACACAAAAHQAgCAAAKQAgAwAAABoAIA8AACIAIBAAACcAIAEAAAAaACABAAAAHQAgChUAAOwOACAWAADtDgAgFwAA8A4AIBgAAO8OACAZAADuDgAgwAcAAPEMACDcBwAA8QwAIOUHAADxDAAg5gcAAPEMACDnBwAA8QwAIAu8BwAA5QwAML0HAAAwABC-BwAA5QwAML8HAQDFCwAhwAcBANQLACHcBwAA4AsAIOUHAQDUCwAh5gcBANQLACHnBwIA1QsAIcQJAgDGCwAh0AkBAMULACEDAAAAHQAgAwAALwAwFAAAMAAgAwAAAB0AIAMAAB4AMAQAABoAIAi8BwAA5AwAML0HAAA2ABC-BwAA5AwAML8HAQAAAAHFB0AA0gsAIdwHAADmCwAgsAkBANwLACHECQIA0QsAIQEAAAAzACABAAAAMwAgCLwHAADkDAAwvQcAADYAEL4HAADkDAAwvwcBANALACHFB0AA0gsAIdwHAADmCwAgsAkBANwLACHECQIA0QsAIQLcBwAA8QwAILAJAADxDAAgAwAAADYAIAMAADcAMAQAADMAIAMAAAA2ACADAAA3ADAEAAAzACADAAAANgAgAwAANwAwBAAAMwAgBb8HAQAAAAHFB0AAAAAB3AeAAAAAAbAJAQAAAAHECQIAAAABAQgAADsAIAW_BwEAAAABxQdAAAAAAdwHgAAAAAGwCQEAAAABxAkCAAAAAQEIAAA9ADABCAAAPQAwBb8HAQDuDAAhxQdAAPAMACHcB4AAAAABsAkBAPcMACHECQIA7wwAIQIAAAAzACAIAABAACAFvwcBAO4MACHFB0AA8AwAIdwHgAAAAAGwCQEA9wwAIcQJAgDvDAAhAgAAADYAIAgAAEIAIAIAAAA2ACAIAABCACADAAAAMwAgDwAAOwAgEAAAQAAgAQAAADMAIAEAAAA2ACAHFQAA5w4AIBYAAOgOACAXAADrDgAgGAAA6g4AIBkAAOkOACDcBwAA8QwAILAJAADxDAAgCLwHAADjDAAwvQcAAEkAEL4HAADjDAAwvwcBAMULACHFB0AAxwsAIdwHAADgCwAgsAkBANQLACHECQIAxgsAIQMAAAA2ACADAABIADAUAABJACADAAAANgAgAwAANwAwBAAAMwAgBrwHAADiDAAwvQcAAE8AEL4HAADiDAAw3AcAAOYLACDECQIAAAAB7wkBANwLACEBAAAATAAgAQAAAEwAIAa8BwAA4gwAML0HAABPABC-BwAA4gwAMNwHAADmCwAgxAkCANELACHvCQEA3AsAIQLcBwAA8QwAIO8JAADxDAAgAwAAAE8AIAMAAFAAMAQAAEwAIAMAAABPACADAABQADAEAABMACADAAAATwAgAwAAUAAwBAAATAAgA9wHgAAAAAHECQIAAAAB7wkBAAAAAQEIAABUACAD3AeAAAAAAcQJAgAAAAHvCQEAAAABAQgAAFYAMAEIAABWADAD3AeAAAAAAcQJAgDvDAAh7wkBAPcMACECAAAATAAgCAAAWQAgA9wHgAAAAAHECQIA7wwAIe8JAQD3DAAhAgAAAE8AIAgAAFsAIAIAAABPACAIAABbACADAAAATAAgDwAAVAAgEAAAWQAgAQAAAEwAIAEAAABPACAHFQAA4g4AIBYAAOMOACAXAADmDgAgGAAA5Q4AIBkAAOQOACDcBwAA8QwAIO8JAADxDAAgBrwHAADhDAAwvQcAAGIAEL4HAADhDAAw3AcAAOALACDECQIAxgsAIe8JAQDUCwAhAwAAAE8AIAMAAGEAMBQAAGIAIAMAAABPACADAABQADAEAABMACALvAcAAOAMADC9BwAAaAAQvgcAAOAMADC_BwEAAAABxQdAANILACHcBwAA5gsAIMIJAQDcCwAhxAkCANELACHqCQEA3AsAIe0JAQDcCwAh7glAAPALACEBAAAAZQAgAQAAAGUAIAu8BwAA4AwAML0HAABoABC-BwAA4AwAML8HAQDQCwAhxQdAANILACHcBwAA5gsAIMIJAQDcCwAhxAkCANELACHqCQEA3AsAIe0JAQDcCwAh7glAAPALACEF3AcAAPEMACDCCQAA8QwAIOoJAADxDAAg7QkAAPEMACDuCQAA8QwAIAMAAABoACADAABpADAEAABlACADAAAAaAAgAwAAaQAwBAAAZQAgAwAAAGgAIAMAAGkAMAQAAGUAIAi_BwEAAAABxQdAAAAAAdwHgAAAAAHCCQEAAAABxAkCAAAAAeoJAQAAAAHtCQEAAAAB7glAAAAAAQEIAABtACAIvwcBAAAAAcUHQAAAAAHcB4AAAAABwgkBAAAAAcQJAgAAAAHqCQEAAAAB7QkBAAAAAe4JQAAAAAEBCAAAbwAwAQgAAG8AMAi_BwEA7gwAIcUHQADwDAAh3AeAAAAAAcIJAQD3DAAhxAkCAO8MACHqCQEA9wwAIe0JAQD3DAAh7glAAI4NACECAAAAZQAgCAAAcgAgCL8HAQDuDAAhxQdAAPAMACHcB4AAAAABwgkBAPcMACHECQIA7wwAIeoJAQD3DAAh7QkBAPcMACHuCUAAjg0AIQIAAABoACAIAAB0ACACAAAAaAAgCAAAdAAgAwAAAGUAIA8AAG0AIBAAAHIAIAEAAABlACABAAAAaAAgChUAAN0OACAWAADeDgAgFwAA4Q4AIBgAAOAOACAZAADfDgAg3AcAAPEMACDCCQAA8QwAIOoJAADxDAAg7QkAAPEMACDuCQAA8QwAIAu8BwAA3wwAML0HAAB7ABC-BwAA3wwAML8HAQDFCwAhxQdAAMcLACHcBwAA4AsAIMIJAQDUCwAhxAkCAMYLACHqCQEA1AsAIe0JAQDUCwAh7glAAOwLACEDAAAAaAAgAwAAegAwFAAAewAgAwAAAGgAIAMAAGkAMAQAAGUAIA-8BwAA3gwAML0HAACBAQAQvgcAAN4MADC_BwEAAAABxQdAANILACHGB0AA0gsAIcIJAQDcCwAhxAkCAN0LACHmCQEA3AsAIecJAQDcCwAh6AkBANwLACHpCQEA3AsAIeoJAQDcCwAh6wkgAOULACHsCQAA5gsAIAEAAAB-ACABAAAAfgAgD7wHAADeDAAwvQcAAIEBABC-BwAA3gwAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIcIJAQDcCwAhxAkCAN0LACHmCQEA3AsAIecJAQDcCwAh6AkBANwLACHpCQEA3AsAIeoJAQDcCwAh6wkgAOULACHsCQAA5gsAIAjCCQAA8QwAIMQJAADxDAAg5gkAAPEMACDnCQAA8QwAIOgJAADxDAAg6QkAAPEMACDqCQAA8QwAIOwJAADxDAAgAwAAAIEBACADAACCAQAwBAAAfgAgAwAAAIEBACADAACCAQAwBAAAfgAgAwAAAIEBACADAACCAQAwBAAAfgAgDL8HAQAAAAHFB0AAAAABxgdAAAAAAcIJAQAAAAHECQIAAAAB5gkBAAAAAecJAQAAAAHoCQEAAAAB6QkBAAAAAeoJAQAAAAHrCSAAAAAB7AmAAAAAAQEIAACGAQAgDL8HAQAAAAHFB0AAAAABxgdAAAAAAcIJAQAAAAHECQIAAAAB5gkBAAAAAecJAQAAAAHoCQEAAAAB6QkBAAAAAeoJAQAAAAHrCSAAAAAB7AmAAAAAAQEIAACIAQAwAQgAAIgBADAMvwcBAO4MACHFB0AA8AwAIcYHQADwDAAhwgkBAPcMACHECQIA-AwAIeYJAQD3DAAh5wkBAPcMACHoCQEA9wwAIekJAQD3DAAh6gkBAPcMACHrCSAA_gwAIewJgAAAAAECAAAAfgAgCAAAiwEAIAy_BwEA7gwAIcUHQADwDAAhxgdAAPAMACHCCQEA9wwAIcQJAgD4DAAh5gkBAPcMACHnCQEA9wwAIegJAQD3DAAh6QkBAPcMACHqCQEA9wwAIesJIAD-DAAh7AmAAAAAAQIAAACBAQAgCAAAjQEAIAIAAACBAQAgCAAAjQEAIAMAAAB-ACAPAACGAQAgEAAAiwEAIAEAAAB-ACABAAAAgQEAIA0VAADYDgAgFgAA2Q4AIBcAANwOACAYAADbDgAgGQAA2g4AIMIJAADxDAAgxAkAAPEMACDmCQAA8QwAIOcJAADxDAAg6AkAAPEMACDpCQAA8QwAIOoJAADxDAAg7AkAAPEMACAPvAcAAN0MADC9BwAAlAEAEL4HAADdDAAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAhwgkBANQLACHECQIA1QsAIeYJAQDUCwAh5wkBANQLACHoCQEA1AsAIekJAQDUCwAh6gkBANQLACHrCSAA3wsAIewJAADgCwAgAwAAAIEBACADAACTAQAwFAAAlAEAIAMAAACBAQAgAwAAggEAMAQAAH4AIAq8BwAA3AwAML0HAACaAQAQvgcAANwMADC_BwIAAAABwAcBANwLACHXBwEA3AsAIdwHAADmCwAgrgkBANwLACHgCQEA3AsAIeUJAQDcCwAhAQAAAJcBACABAAAAlwEAIAq8BwAA3AwAML0HAACaAQAQvgcAANwMADC_BwIA0QsAIcAHAQDcCwAh1wcBANwLACHcBwAA5gsAIK4JAQDcCwAh4AkBANwLACHlCQEA3AsAIQbABwAA8QwAINcHAADxDAAg3AcAAPEMACCuCQAA8QwAIOAJAADxDAAg5QkAAPEMACADAAAAmgEAIAMAAJsBADAEAACXAQAgAwAAAJoBACADAACbAQAwBAAAlwEAIAMAAACaAQAgAwAAmwEAMAQAAJcBACAHvwcCAAAAAcAHAQAAAAHXBwEAAAAB3AeAAAAAAa4JAQAAAAHgCQEAAAAB5QkBAAAAAQEIAACfAQAgB78HAgAAAAHABwEAAAAB1wcBAAAAAdwHgAAAAAGuCQEAAAAB4AkBAAAAAeUJAQAAAAEBCAAAoQEAMAEIAAChAQAwB78HAgDvDAAhwAcBAPcMACHXBwEA9wwAIdwHgAAAAAGuCQEA9wwAIeAJAQD3DAAh5QkBAPcMACECAAAAlwEAIAgAAKQBACAHvwcCAO8MACHABwEA9wwAIdcHAQD3DAAh3AeAAAAAAa4JAQD3DAAh4AkBAPcMACHlCQEA9wwAIQIAAACaAQAgCAAApgEAIAIAAACaAQAgCAAApgEAIAMAAACXAQAgDwAAnwEAIBAAAKQBACABAAAAlwEAIAEAAACaAQAgCxUAANMOACAWAADUDgAgFwAA1w4AIBgAANYOACAZAADVDgAgwAcAAPEMACDXBwAA8QwAINwHAADxDAAgrgkAAPEMACDgCQAA8QwAIOUJAADxDAAgCrwHAADbDAAwvQcAAK0BABC-BwAA2wwAML8HAgDGCwAhwAcBANQLACHXBwEA1AsAIdwHAADgCwAgrgkBANQLACHgCQEA1AsAIeUJAQDUCwAhAwAAAJoBACADAACsAQAwFAAArQEAIAMAAACaAQAgAwAAmwEAMAQAAJcBACAGvAcAANkMADC9BwAAswEAEL4HAADZDAAwxAkCANELACHjCQIA0QsAIeQJAADaDAAgAQAAALABACABAAAAsAEAIAW8BwAA2QwAML0HAACzAQAQvgcAANkMADDECQIA0QsAIeMJAgDRCwAhAAMAAACzAQAgAwAAtAEAMAQAALABACADAAAAswEAIAMAALQBADAEAACwAQAgAwAAALMBACADAAC0AQAwBAAAsAEAIALECQIAAAAB4wkCAAAAAQEIAAC4AQAgAsQJAgAAAAHjCQIAAAABAQgAALoBADABCAAAugEAMALECQIA7wwAIeMJAgDvDAAhAgAAALABACAIAAC9AQAgAsQJAgDvDAAh4wkCAO8MACECAAAAswEAIAgAAL8BACACAAAAswEAIAgAAL8BACADAAAAsAEAIA8AALgBACAQAAC9AQAgAQAAALABACABAAAAswEAIAUVAADODgAgFgAAzw4AIBcAANIOACAYAADRDgAgGQAA0A4AIAW8BwAA2AwAML0HAADGAQAQvgcAANgMADDECQIAxgsAIeMJAgDGCwAhAwAAALMBACADAADFAQAwFAAAxgEAIAMAAACzAQAgAwAAtAEAMAQAALABACAIvAcAANcMADC9BwAAzAEAEL4HAADXDAAwvwcCAAAAAcAHAQDcCwAh1wcBANwLACHcBwAA5gsAIK4JAQDcCwAhAQAAAMkBACABAAAAyQEAIAi8BwAA1wwAML0HAADMAQAQvgcAANcMADC_BwIA0QsAIcAHAQDcCwAh1wcBANwLACHcBwAA5gsAIK4JAQDcCwAhBMAHAADxDAAg1wcAAPEMACDcBwAA8QwAIK4JAADxDAAgAwAAAMwBACADAADNAQAwBAAAyQEAIAMAAADMAQAgAwAAzQEAMAQAAMkBACADAAAAzAEAIAMAAM0BADAEAADJAQAgBb8HAgAAAAHABwEAAAAB1wcBAAAAAdwHgAAAAAGuCQEAAAABAQgAANEBACAFvwcCAAAAAcAHAQAAAAHXBwEAAAAB3AeAAAAAAa4JAQAAAAEBCAAA0wEAMAEIAADTAQAwBb8HAgDvDAAhwAcBAPcMACHXBwEA9wwAIdwHgAAAAAGuCQEA9wwAIQIAAADJAQAgCAAA1gEAIAW_BwIA7wwAIcAHAQD3DAAh1wcBAPcMACHcB4AAAAABrgkBAPcMACECAAAAzAEAIAgAANgBACACAAAAzAEAIAgAANgBACADAAAAyQEAIA8AANEBACAQAADWAQAgAQAAAMkBACABAAAAzAEAIAkVAADJDgAgFgAAyg4AIBcAAM0OACAYAADMDgAgGQAAyw4AIMAHAADxDAAg1wcAAPEMACDcBwAA8QwAIK4JAADxDAAgCLwHAADWDAAwvQcAAN8BABC-BwAA1gwAML8HAgDGCwAhwAcBANQLACHXBwEA1AsAIdwHAADgCwAgrgkBANQLACEDAAAAzAEAIAMAAN4BADAUAADfAQAgAwAAAMwBACADAADNAQAwBAAAyQEAIAi8BwAA1QwAML0HAADlAQAQvgcAANUMADC_BwIAAAABwAcBANwLACHXBwEA3AsAIdwHAADmCwAgrgkBANwLACEBAAAA4gEAIAEAAADiAQAgCLwHAADVDAAwvQcAAOUBABC-BwAA1QwAML8HAgDRCwAhwAcBANwLACHXBwEA3AsAIdwHAADmCwAgrgkBANwLACEEwAcAAPEMACDXBwAA8QwAINwHAADxDAAgrgkAAPEMACADAAAA5QEAIAMAAOYBADAEAADiAQAgAwAAAOUBACADAADmAQAwBAAA4gEAIAMAAADlAQAgAwAA5gEAMAQAAOIBACAFvwcCAAAAAcAHAQAAAAHXBwEAAAAB3AeAAAAAAa4JAQAAAAEBCAAA6gEAIAW_BwIAAAABwAcBAAAAAdcHAQAAAAHcB4AAAAABrgkBAAAAAQEIAADsAQAwAQgAAOwBADAFvwcCAO8MACHABwEA9wwAIdcHAQD3DAAh3AeAAAAAAa4JAQD3DAAhAgAAAOIBACAIAADvAQAgBb8HAgDvDAAhwAcBAPcMACHXBwEA9wwAIdwHgAAAAAGuCQEA9wwAIQIAAADlAQAgCAAA8QEAIAIAAADlAQAgCAAA8QEAIAMAAADiAQAgDwAA6gEAIBAAAO8BACABAAAA4gEAIAEAAADlAQAgCRUAAMQOACAWAADFDgAgFwAAyA4AIBgAAMcOACAZAADGDgAgwAcAAPEMACDXBwAA8QwAINwHAADxDAAgrgkAAPEMACAIvAcAANQMADC9BwAA-AEAEL4HAADUDAAwvwcCAMYLACHABwEA1AsAIdcHAQDUCwAh3AcAAOALACCuCQEA1AsAIQMAAADlAQAgAwAA9wEAMBQAAPgBACADAAAA5QEAIAMAAOYBADAEAADiAQAgCLwHAADSDAAwvQcAAP4BABC-BwAA0gwAMMAHAQDcCwAhrAkBANwLACHECQIA0QsAIeEJAgDRCwAh4gkAANMMACABAAAA-wEAIAEAAAD7AQAgB7wHAADSDAAwvQcAAP4BABC-BwAA0gwAMMAHAQDcCwAhrAkBANwLACHECQIA0QsAIeEJAgDRCwAhAsAHAADxDAAgrAkAAPEMACADAAAA_gEAIAMAAP8BADAEAAD7AQAgAwAAAP4BACADAAD_AQAwBAAA-wEAIAMAAAD-AQAgAwAA_wEAMAQAAPsBACAEwAcBAAAAAawJAQAAAAHECQIAAAAB4QkCAAAAAQEIAACDAgAgBMAHAQAAAAGsCQEAAAABxAkCAAAAAeEJAgAAAAEBCAAAhQIAMAEIAACFAgAwBMAHAQD3DAAhrAkBAPcMACHECQIA7wwAIeEJAgDvDAAhAgAAAPsBACAIAACIAgAgBMAHAQD3DAAhrAkBAPcMACHECQIA7wwAIeEJAgDvDAAhAgAAAP4BACAIAACKAgAgAgAAAP4BACAIAACKAgAgAwAAAPsBACAPAACDAgAgEAAAiAIAIAEAAAD7AQAgAQAAAP4BACAHFQAAvw4AIBYAAMAOACAXAADDDgAgGAAAwg4AIBkAAMEOACDABwAA8QwAIKwJAADxDAAgB7wHAADRDAAwvQcAAJECABC-BwAA0QwAMMAHAQDUCwAhrAkBANQLACHECQIAxgsAIeEJAgDGCwAhAwAAAP4BACADAACQAgAwFAAAkQIAIAMAAAD-AQAgAwAA_wEAMAQAAPsBACAOvAcAANAMADC9BwAAlwIAEL4HAADQDAAwvwcBAAAAAcAHAQDcCwAhxAcBANwLACHFB0AA0gsAIcYHQADSCwAh1AcBANwLACHXBwEA3AsAIdwHAADmCwAgrgkBANwLACHfCQEA3AsAIeAJAQDcCwAhAQAAAJQCACABAAAAlAIAIA68BwAA0AwAML0HAACXAgAQvgcAANAMADC_BwEA0AsAIcAHAQDcCwAhxAcBANwLACHFB0AA0gsAIcYHQADSCwAh1AcBANwLACHXBwEA3AsAIdwHAADmCwAgrgkBANwLACHfCQEA3AsAIeAJAQDcCwAhCMAHAADxDAAgxAcAAPEMACDUBwAA8QwAINcHAADxDAAg3AcAAPEMACCuCQAA8QwAIN8JAADxDAAg4AkAAPEMACADAAAAlwIAIAMAAJgCADAEAACUAgAgAwAAAJcCACADAACYAgAwBAAAlAIAIAMAAACXAgAgAwAAmAIAMAQAAJQCACALvwcBAAAAAcAHAQAAAAHEBwEAAAABxQdAAAAAAcYHQAAAAAHUBwEAAAAB1wcBAAAAAdwHgAAAAAGuCQEAAAAB3wkBAAAAAeAJAQAAAAEBCAAAnAIAIAu_BwEAAAABwAcBAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAdQHAQAAAAHXBwEAAAAB3AeAAAAAAa4JAQAAAAHfCQEAAAAB4AkBAAAAAQEIAACeAgAwAQgAAJ4CADALvwcBAO4MACHABwEA9wwAIcQHAQD3DAAhxQdAAPAMACHGB0AA8AwAIdQHAQD3DAAh1wcBAPcMACHcB4AAAAABrgkBAPcMACHfCQEA9wwAIeAJAQD3DAAhAgAAAJQCACAIAAChAgAgC78HAQDuDAAhwAcBAPcMACHEBwEA9wwAIcUHQADwDAAhxgdAAPAMACHUBwEA9wwAIdcHAQD3DAAh3AeAAAAAAa4JAQD3DAAh3wkBAPcMACHgCQEA9wwAIQIAAACXAgAgCAAAowIAIAIAAACXAgAgCAAAowIAIAMAAACUAgAgDwAAnAIAIBAAAKECACABAAAAlAIAIAEAAACXAgAgCxUAALwOACAYAAC-DgAgGQAAvQ4AIMAHAADxDAAgxAcAAPEMACDUBwAA8QwAINcHAADxDAAg3AcAAPEMACCuCQAA8QwAIN8JAADxDAAg4AkAAPEMACAOvAcAAM8MADC9BwAAqgIAEL4HAADPDAAwvwcBAMULACHABwEA1AsAIcQHAQDUCwAhxQdAAMcLACHGB0AAxwsAIdQHAQDUCwAh1wcBANQLACHcBwAA4AsAIK4JAQDUCwAh3wkBANQLACHgCQEA1AsAIQMAAACXAgAgAwAAqQIAMBQAAKoCACADAAAAlwIAIAMAAJgCADAEAACUAgAgBrwHAADNDAAwvQcAALACABC-BwAAzQwAMMQJAgDRCwAh3QkBANALACHeCQAAzgwAIAEAAACtAgAgAQAAAK0CACAFvAcAAM0MADC9BwAAsAIAEL4HAADNDAAwxAkCANELACHdCQEA0AsAIQADAAAAsAIAIAMAALECADAEAACtAgAgAwAAALACACADAACxAgAwBAAArQIAIAMAAACwAgAgAwAAsQIAMAQAAK0CACACxAkCAAAAAd0JAQAAAAEBCAAAtQIAIALECQIAAAAB3QkBAAAAAQEIAAC3AgAwAQgAALcCADACxAkCAO8MACHdCQEA7gwAIQIAAACtAgAgCAAAugIAIALECQIA7wwAId0JAQDuDAAhAgAAALACACAIAAC8AgAgAgAAALACACAIAAC8AgAgAwAAAK0CACAPAAC1AgAgEAAAugIAIAEAAACtAgAgAQAAALACACAFFQAAtw4AIBYAALgOACAXAAC7DgAgGAAAug4AIBkAALkOACAFvAcAAMwMADC9BwAAwwIAEL4HAADMDAAwxAkCAMYLACHdCQEAxQsAIQMAAACwAgAgAwAAwgIAMBQAAMMCACADAAAAsAIAIAMAALECADAEAACtAgAgEbwHAADLDAAwvQcAAMkCABC-BwAAywwAML8HAQAAAAHEBwEA3AsAIcUHQADSCwAhxgdAANILACHcBwAA5gsAIIYJCACODAAhhwkBANwLACGwCQEA3AsAIdAJAQDcCwAh1wkIAI4MACHZCQEA3AsAIdoJAQDcCwAh2wkBANwLACHcCQIA3QsAIQEAAADGAgAgAQAAAMYCACARvAcAAMsMADC9BwAAyQIAEL4HAADLDAAwvwcBANALACHEBwEA3AsAIcUHQADSCwAhxgdAANILACHcBwAA5gsAIIYJCACODAAhhwkBANwLACGwCQEA3AsAIdAJAQDcCwAh1wkIAI4MACHZCQEA3AsAIdoJAQDcCwAh2wkBANwLACHcCQIA3QsAIQvEBwAA8QwAINwHAADxDAAghgkAAPEMACCHCQAA8QwAILAJAADxDAAg0AkAAPEMACDXCQAA8QwAINkJAADxDAAg2gkAAPEMACDbCQAA8QwAINwJAADxDAAgAwAAAMkCACADAADKAgAwBAAAxgIAIAMAAADJAgAgAwAAygIAMAQAAMYCACADAAAAyQIAIAMAAMoCADAEAADGAgAgDr8HAQAAAAHEBwEAAAABxQdAAAAAAcYHQAAAAAHcB4AAAAABhgkIAAAAAYcJAQAAAAGwCQEAAAAB0AkBAAAAAdcJCAAAAAHZCQEAAAAB2gkBAAAAAdsJAQAAAAHcCQIAAAABAQgAAM4CACAOvwcBAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAdwHgAAAAAGGCQgAAAABhwkBAAAAAbAJAQAAAAHQCQEAAAAB1wkIAAAAAdkJAQAAAAHaCQEAAAAB2wkBAAAAAdwJAgAAAAEBCAAA0AIAMAEIAADQAgAwDr8HAQDuDAAhxAcBAPcMACHFB0AA8AwAIcYHQADwDAAh3AeAAAAAAYYJCADEDQAhhwkBAPcMACGwCQEA9wwAIdAJAQD3DAAh1wkIAMQNACHZCQEA9wwAIdoJAQD3DAAh2wkBAPcMACHcCQIA-AwAIQIAAADGAgAgCAAA0wIAIA6_BwEA7gwAIcQHAQD3DAAhxQdAAPAMACHGB0AA8AwAIdwHgAAAAAGGCQgAxA0AIYcJAQD3DAAhsAkBAPcMACHQCQEA9wwAIdcJCADEDQAh2QkBAPcMACHaCQEA9wwAIdsJAQD3DAAh3AkCAPgMACECAAAAyQIAIAgAANUCACACAAAAyQIAIAgAANUCACADAAAAxgIAIA8AAM4CACAQAADTAgAgAQAAAMYCACABAAAAyQIAIBAVAACyDgAgFgAAsw4AIBcAALYOACAYAAC1DgAgGQAAtA4AIMQHAADxDAAg3AcAAPEMACCGCQAA8QwAIIcJAADxDAAgsAkAAPEMACDQCQAA8QwAINcJAADxDAAg2QkAAPEMACDaCQAA8QwAINsJAADxDAAg3AkAAPEMACARvAcAAMoMADC9BwAA3AIAEL4HAADKDAAwvwcBAMULACHEBwEA1AsAIcUHQADHCwAhxgdAAMcLACHcBwAA4AsAIIYJCACLDAAhhwkBANQLACGwCQEA1AsAIdAJAQDUCwAh1wkIAIsMACHZCQEA1AsAIdoJAQDUCwAh2wkBANQLACHcCQIA1QsAIQMAAADJAgAgAwAA2wIAMBQAANwCACADAAAAyQIAIAMAAMoCADAEAADGAgAgCbwHAADJDAAwvQcAAOICABC-BwAAyQwAML8HAQAAAAHcBwAA5gsAINMJAQDcCwAh1gkBANALACHXCQgAjgwAIdgJAQDcCwAhAQAAAN8CACABAAAA3wIAIAm8BwAAyQwAML0HAADiAgAQvgcAAMkMADC_BwEA0AsAIdwHAADmCwAg0wkBANwLACHWCQEA0AsAIdcJCACODAAh2AkBANwLACEE3AcAAPEMACDTCQAA8QwAINcJAADxDAAg2AkAAPEMACADAAAA4gIAIAMAAOMCADAEAADfAgAgAwAAAOICACADAADjAgAwBAAA3wIAIAMAAADiAgAgAwAA4wIAMAQAAN8CACAGvwcBAAAAAdwHgAAAAAHTCQEAAAAB1gkBAAAAAdcJCAAAAAHYCQEAAAABAQgAAOcCACAGvwcBAAAAAdwHgAAAAAHTCQEAAAAB1gkBAAAAAdcJCAAAAAHYCQEAAAABAQgAAOkCADABCAAA6QIAMAa_BwEA7gwAIdwHgAAAAAHTCQEA9wwAIdYJAQDuDAAh1wkIAMQNACHYCQEA9wwAIQIAAADfAgAgCAAA7AIAIAa_BwEA7gwAIdwHgAAAAAHTCQEA9wwAIdYJAQDuDAAh1wkIAMQNACHYCQEA9wwAIQIAAADiAgAgCAAA7gIAIAIAAADiAgAgCAAA7gIAIAMAAADfAgAgDwAA5wIAIBAAAOwCACABAAAA3wIAIAEAAADiAgAgCRUAAK0OACAWAACuDgAgFwAAsQ4AIBgAALAOACAZAACvDgAg3AcAAPEMACDTCQAA8QwAINcJAADxDAAg2AkAAPEMACAJvAcAAMgMADC9BwAA9QIAEL4HAADIDAAwvwcBAMULACHcBwAA4AsAINMJAQDUCwAh1gkBAMULACHXCQgAiwwAIdgJAQDUCwAhAwAAAOICACADAAD0AgAwFAAA9QIAIAMAAADiAgAgAwAA4wIAMAQAAN8CACAPvAcAAMcMADC9BwAA-wIAEL4HAADHDAAwvwcBAAAAAdMHAQDcCwAh3AcAAOYLACDjBwEA3AsAIe8HAQDcCwAhugkBANwLACHPCQEA3AsAIdEJAQDcCwAh0gkBANwLACHTCUAA8AsAIdQJAQDcCwAh1QkgAOULACEBAAAA-AIAIAEAAAD4AgAgD7wHAADHDAAwvQcAAPsCABC-BwAAxwwAML8HAQDQCwAh0wcBANwLACHcBwAA5gsAIOMHAQDcCwAh7wcBANwLACG6CQEA3AsAIc8JAQDcCwAh0QkBANwLACHSCQEA3AsAIdMJQADwCwAh1AkBANwLACHVCSAA5QsAIQrTBwAA8QwAINwHAADxDAAg4wcAAPEMACDvBwAA8QwAILoJAADxDAAgzwkAAPEMACDRCQAA8QwAINIJAADxDAAg0wkAAPEMACDUCQAA8QwAIAMAAAD7AgAgAwAA_AIAMAQAAPgCACADAAAA-wIAIAMAAPwCADAEAAD4AgAgAwAAAPsCACADAAD8AgAwBAAA-AIAIAy_BwEAAAAB0wcBAAAAAdwHgAAAAAHjBwEAAAAB7wcBAAAAAboJAQAAAAHPCQEAAAAB0QkBAAAAAdIJAQAAAAHTCUAAAAAB1AkBAAAAAdUJIAAAAAEBCAAAgAMAIAy_BwEAAAAB0wcBAAAAAdwHgAAAAAHjBwEAAAAB7wcBAAAAAboJAQAAAAHPCQEAAAAB0QkBAAAAAdIJAQAAAAHTCUAAAAAB1AkBAAAAAdUJIAAAAAEBCAAAggMAMAEIAACCAwAwDL8HAQDuDAAh0wcBAPcMACHcB4AAAAAB4wcBAPcMACHvBwEA9wwAIboJAQD3DAAhzwkBAPcMACHRCQEA9wwAIdIJAQD3DAAh0wlAAI4NACHUCQEA9wwAIdUJIAD-DAAhAgAAAPgCACAIAACFAwAgDL8HAQDuDAAh0wcBAPcMACHcB4AAAAAB4wcBAPcMACHvBwEA9wwAIboJAQD3DAAhzwkBAPcMACHRCQEA9wwAIdIJAQD3DAAh0wlAAI4NACHUCQEA9wwAIdUJIAD-DAAhAgAAAPsCACAIAACHAwAgAgAAAPsCACAIAACHAwAgAwAAAPgCACAPAACAAwAgEAAAhQMAIAEAAAD4AgAgAQAAAPsCACANFQAAqg4AIBgAAKwOACAZAACrDgAg0wcAAPEMACDcBwAA8QwAIOMHAADxDAAg7wcAAPEMACC6CQAA8QwAIM8JAADxDAAg0QkAAPEMACDSCQAA8QwAINMJAADxDAAg1AkAAPEMACAPvAcAAMYMADC9BwAAjgMAEL4HAADGDAAwvwcBAMULACHTBwEA1AsAIdwHAADgCwAg4wcBANQLACHvBwEA1AsAIboJAQDUCwAhzwkBANQLACHRCQEA1AsAIdIJAQDUCwAh0wlAAOwLACHUCQEA1AsAIdUJIADfCwAhAwAAAPsCACADAACNAwAwFAAAjgMAIAMAAAD7AgAgAwAA_AIAMAQAAPgCACAJvAcAAMUMADC9BwAAlAMAEL4HAADFDAAwvwcBAAAAAdwHAADmCwAg5QcBANwLACHmBwEA3AsAIc4JAQDcCwAhzwkBANwLACEBAAAAkQMAIAEAAACRAwAgCbwHAADFDAAwvQcAAJQDABC-BwAAxQwAML8HAQDQCwAh3AcAAOYLACDlBwEA3AsAIeYHAQDcCwAhzgkBANwLACHPCQEA3AsAIQXcBwAA8QwAIOUHAADxDAAg5gcAAPEMACDOCQAA8QwAIM8JAADxDAAgAwAAAJQDACADAACVAwAwBAAAkQMAIAMAAACUAwAgAwAAlQMAMAQAAJEDACADAAAAlAMAIAMAAJUDADAEAACRAwAgBr8HAQAAAAHcB4AAAAAB5QcBAAAAAeYHAQAAAAHOCQEAAAABzwkBAAAAAQEIAACZAwAgBr8HAQAAAAHcB4AAAAAB5QcBAAAAAeYHAQAAAAHOCQEAAAABzwkBAAAAAQEIAACbAwAwAQgAAJsDADAGvwcBAO4MACHcB4AAAAAB5QcBAPcMACHmBwEA9wwAIc4JAQD3DAAhzwkBAPcMACECAAAAkQMAIAgAAJ4DACAGvwcBAO4MACHcB4AAAAAB5QcBAPcMACHmBwEA9wwAIc4JAQD3DAAhzwkBAPcMACECAAAAlAMAIAgAAKADACACAAAAlAMAIAgAAKADACADAAAAkQMAIA8AAJkDACAQAACeAwAgAQAAAJEDACABAAAAlAMAIAgVAACnDgAgGAAAqQ4AIBkAAKgOACDcBwAA8QwAIOUHAADxDAAg5gcAAPEMACDOCQAA8QwAIM8JAADxDAAgCbwHAADEDAAwvQcAAKcDABC-BwAAxAwAML8HAQDFCwAh3AcAAOALACDlBwEA1AsAIeYHAQDUCwAhzgkBANQLACHPCQEA1AsAIQMAAACUAwAgAwAApgMAMBQAAKcDACADAAAAlAMAIAMAAJUDADAEAACRAwAgDbwHAADDDAAwvQcAAK0DABC-BwAAwwwAML8HAQAAAAHEBwEA3AsAIcUHQADSCwAh3AcAAOYLACDlBwEA3AsAIboJAQDcCwAhxAkCAN0LACHOCQEA3AsAIc8JAQDcCwAh0AkBANwLACEBAAAAqgMAIAEAAACqAwAgDbwHAADDDAAwvQcAAK0DABC-BwAAwwwAML8HAQDQCwAhxAcBANwLACHFB0AA0gsAIdwHAADmCwAg5QcBANwLACG6CQEA3AsAIcQJAgDdCwAhzgkBANwLACHPCQEA3AsAIdAJAQDcCwAhCMQHAADxDAAg3AcAAPEMACDlBwAA8QwAILoJAADxDAAgxAkAAPEMACDOCQAA8QwAIM8JAADxDAAg0AkAAPEMACADAAAArQMAIAMAAK4DADAEAACqAwAgAwAAAK0DACADAACuAwAwBAAAqgMAIAMAAACtAwAgAwAArgMAMAQAAKoDACAKvwcBAAAAAcQHAQAAAAHFB0AAAAAB3AeAAAAAAeUHAQAAAAG6CQEAAAABxAkCAAAAAc4JAQAAAAHPCQEAAAAB0AkBAAAAAQEIAACyAwAgCr8HAQAAAAHEBwEAAAABxQdAAAAAAdwHgAAAAAHlBwEAAAABugkBAAAAAcQJAgAAAAHOCQEAAAABzwkBAAAAAdAJAQAAAAEBCAAAtAMAMAEIAAC0AwAwCr8HAQDuDAAhxAcBAPcMACHFB0AA8AwAIdwHgAAAAAHlBwEA9wwAIboJAQD3DAAhxAkCAPgMACHOCQEA9wwAIc8JAQD3DAAh0AkBAPcMACECAAAAqgMAIAgAALcDACAKvwcBAO4MACHEBwEA9wwAIcUHQADwDAAh3AeAAAAAAeUHAQD3DAAhugkBAPcMACHECQIA-AwAIc4JAQD3DAAhzwkBAPcMACHQCQEA9wwAIQIAAACtAwAgCAAAuQMAIAIAAACtAwAgCAAAuQMAIAMAAACqAwAgDwAAsgMAIBAAALcDACABAAAAqgMAIAEAAACtAwAgDRUAAKIOACAWAACjDgAgFwAApg4AIBgAAKUOACAZAACkDgAgxAcAAPEMACDcBwAA8QwAIOUHAADxDAAgugkAAPEMACDECQAA8QwAIM4JAADxDAAgzwkAAPEMACDQCQAA8QwAIA28BwAAwgwAML0HAADAAwAQvgcAAMIMADC_BwEAxQsAIcQHAQDUCwAhxQdAAMcLACHcBwAA4AsAIOUHAQDUCwAhugkBANQLACHECQIA1QsAIc4JAQDUCwAhzwkBANQLACHQCQEA1AsAIQMAAACtAwAgAwAAvwMAMBQAAMADACADAAAArQMAIAMAAK4DADAEAACqAwAgC7wHAADBDAAwvQcAAMYDABC-BwAAwQwAML8HAQAAAAHEBwEA3AsAIcUHQADSCwAh0gcBANwLACHcBwAA5gsAIMQJAgDdCwAhzAlAAPALACHNCQEA3AsAIQEAAADDAwAgAQAAAMMDACALvAcAAMEMADC9BwAAxgMAEL4HAADBDAAwvwcBANALACHEBwEA3AsAIcUHQADSCwAh0gcBANwLACHcBwAA5gsAIMQJAgDdCwAhzAlAAPALACHNCQEA3AsAIQbEBwAA8QwAINIHAADxDAAg3AcAAPEMACDECQAA8QwAIMwJAADxDAAgzQkAAPEMACADAAAAxgMAIAMAAMcDADAEAADDAwAgAwAAAMYDACADAADHAwAwBAAAwwMAIAMAAADGAwAgAwAAxwMAMAQAAMMDACAIvwcBAAAAAcQHAQAAAAHFB0AAAAAB0gcBAAAAAdwHgAAAAAHECQIAAAABzAlAAAAAAc0JAQAAAAEBCAAAywMAIAi_BwEAAAABxAcBAAAAAcUHQAAAAAHSBwEAAAAB3AeAAAAAAcQJAgAAAAHMCUAAAAABzQkBAAAAAQEIAADNAwAwAQgAAM0DADAIvwcBAO4MACHEBwEA9wwAIcUHQADwDAAh0gcBAPcMACHcB4AAAAABxAkCAPgMACHMCUAAjg0AIc0JAQD3DAAhAgAAAMMDACAIAADQAwAgCL8HAQDuDAAhxAcBAPcMACHFB0AA8AwAIdIHAQD3DAAh3AeAAAAAAcQJAgD4DAAhzAlAAI4NACHNCQEA9wwAIQIAAADGAwAgCAAA0gMAIAIAAADGAwAgCAAA0gMAIAMAAADDAwAgDwAAywMAIBAAANADACABAAAAwwMAIAEAAADGAwAgCxUAAJ0OACAWAACeDgAgFwAAoQ4AIBgAAKAOACAZAACfDgAgxAcAAPEMACDSBwAA8QwAINwHAADxDAAgxAkAAPEMACDMCQAA8QwAIM0JAADxDAAgC7wHAADADAAwvQcAANkDABC-BwAAwAwAML8HAQDFCwAhxAcBANQLACHFB0AAxwsAIdIHAQDUCwAh3AcAAOALACDECQIA1QsAIcwJQADsCwAhzQkBANQLACEDAAAAxgMAIAMAANgDADAUAADZAwAgAwAAAMYDACADAADHAwAwBAAAwwMAIAq8BwAAvwwAML0HAADfAwAQvgcAAL8MADC_BwEAAAABxAcBANwLACHFB0AA0gsAIdIHAQDcCwAh2AcBANwLACHcBwAA5gsAIIcJAQDcCwAhAQAAANwDACABAAAA3AMAIAq8BwAAvwwAML0HAADfAwAQvgcAAL8MADC_BwEA0AsAIcQHAQDcCwAhxQdAANILACHSBwEA3AsAIdgHAQDcCwAh3AcAAOYLACCHCQEA3AsAIQXEBwAA8QwAINIHAADxDAAg2AcAAPEMACDcBwAA8QwAIIcJAADxDAAgAwAAAN8DACADAADgAwAwBAAA3AMAIAMAAADfAwAgAwAA4AMAMAQAANwDACADAAAA3wMAIAMAAOADADAEAADcAwAgB78HAQAAAAHEBwEAAAABxQdAAAAAAdIHAQAAAAHYBwEAAAAB3AeAAAAAAYcJAQAAAAEBCAAA5AMAIAe_BwEAAAABxAcBAAAAAcUHQAAAAAHSBwEAAAAB2AcBAAAAAdwHgAAAAAGHCQEAAAABAQgAAOYDADABCAAA5gMAMAe_BwEA7gwAIcQHAQD3DAAhxQdAAPAMACHSBwEA9wwAIdgHAQD3DAAh3AeAAAAAAYcJAQD3DAAhAgAAANwDACAIAADpAwAgB78HAQDuDAAhxAcBAPcMACHFB0AA8AwAIdIHAQD3DAAh2AcBAPcMACHcB4AAAAABhwkBAPcMACECAAAA3wMAIAgAAOsDACACAAAA3wMAIAgAAOsDACADAAAA3AMAIA8AAOQDACAQAADpAwAgAQAAANwDACABAAAA3wMAIAgVAACaDgAgGAAAnA4AIBkAAJsOACDEBwAA8QwAINIHAADxDAAg2AcAAPEMACDcBwAA8QwAIIcJAADxDAAgCrwHAAC-DAAwvQcAAPIDABC-BwAAvgwAML8HAQDFCwAhxAcBANQLACHFB0AAxwsAIdIHAQDUCwAh2AcBANQLACHcBwAA4AsAIIcJAQDUCwAhAwAAAN8DACADAADxAwAwFAAA8gMAIAMAAADfAwAgAwAA4AMAMAQAANwDACAIvAcAAL0MADC9BwAA-AMAEL4HAAC9DAAwvwcBAAAAAcUHQADSCwAh3AcAAOYLACC-CQEA3AsAIcQJAgDdCwAhAQAAAPUDACABAAAA9QMAIAi8BwAAvQwAML0HAAD4AwAQvgcAAL0MADC_BwEA0AsAIcUHQADSCwAh3AcAAOYLACC-CQEA3AsAIcQJAgDdCwAhA9wHAADxDAAgvgkAAPEMACDECQAA8QwAIAMAAAD4AwAgAwAA-QMAMAQAAPUDACADAAAA-AMAIAMAAPkDADAEAAD1AwAgAwAAAPgDACADAAD5AwAwBAAA9QMAIAW_BwEAAAABxQdAAAAAAdwHgAAAAAG-CQEAAAABxAkCAAAAAQEIAAD9AwAgBb8HAQAAAAHFB0AAAAAB3AeAAAAAAb4JAQAAAAHECQIAAAABAQgAAP8DADABCAAA_wMAMAW_BwEA7gwAIcUHQADwDAAh3AeAAAAAAb4JAQD3DAAhxAkCAPgMACECAAAA9QMAIAgAAIIEACAFvwcBAO4MACHFB0AA8AwAIdwHgAAAAAG-CQEA9wwAIcQJAgD4DAAhAgAAAPgDACAIAACEBAAgAgAAAPgDACAIAACEBAAgAwAAAPUDACAPAAD9AwAgEAAAggQAIAEAAAD1AwAgAQAAAPgDACAIFQAAlQ4AIBYAAJYOACAXAACZDgAgGAAAmA4AIBkAAJcOACDcBwAA8QwAIL4JAADxDAAgxAkAAPEMACAIvAcAALwMADC9BwAAiwQAEL4HAAC8DAAwvwcBAMULACHFB0AAxwsAIdwHAADgCwAgvgkBANQLACHECQIA1QsAIQMAAAD4AwAgAwAAigQAMBQAAIsEACADAAAA-AMAIAMAAPkDADAEAAD1AwAgB7wHAAC7DAAwvQcAAJEEABC-BwAAuwwAML8HAQAAAAHFB0AA0gsAIdwHAADmCwAgsAkBANwLACEBAAAAjgQAIAEAAACOBAAgB7wHAAC7DAAwvQcAAJEEABC-BwAAuwwAML8HAQDQCwAhxQdAANILACHcBwAA5gsAILAJAQDcCwAhAtwHAADxDAAgsAkAAPEMACADAAAAkQQAIAMAAJIEADAEAACOBAAgAwAAAJEEACADAACSBAAwBAAAjgQAIAMAAACRBAAgAwAAkgQAMAQAAI4EACAEvwcBAAAAAcUHQAAAAAHcB4AAAAABsAkBAAAAAQEIAACWBAAgBL8HAQAAAAHFB0AAAAAB3AeAAAAAAbAJAQAAAAEBCAAAmAQAMAEIAACYBAAwBL8HAQDuDAAhxQdAAPAMACHcB4AAAAABsAkBAPcMACECAAAAjgQAIAgAAJsEACAEvwcBAO4MACHFB0AA8AwAIdwHgAAAAAGwCQEA9wwAIQIAAACRBAAgCAAAnQQAIAIAAACRBAAgCAAAnQQAIAMAAACOBAAgDwAAlgQAIBAAAJsEACABAAAAjgQAIAEAAACRBAAgBRUAAJIOACAYAACUDgAgGQAAkw4AINwHAADxDAAgsAkAAPEMACAHvAcAALoMADC9BwAApAQAEL4HAAC6DAAwvwcBAMULACHFB0AAxwsAIdwHAADgCwAgsAkBANQLACEDAAAAkQQAIAMAAKMEADAUAACkBAAgAwAAAJEEACADAACSBAAwBAAAjgQAIAq8BwAAuQwAML0HAACqBAAQvgcAALkMADC_BwEAAAABxQdAANILACHcBwAA5gsAIIoIAQDcCwAhxAkCAN0LACHJCQEA3AsAIcsJAQDcCwAhAQAAAKcEACABAAAApwQAIAq8BwAAuQwAML0HAACqBAAQvgcAALkMADC_BwEA0AsAIcUHQADSCwAh3AcAAOYLACCKCAEA3AsAIcQJAgDdCwAhyQkBANwLACHLCQEA3AsAIQXcBwAA8QwAIIoIAADxDAAgxAkAAPEMACDJCQAA8QwAIMsJAADxDAAgAwAAAKoEACADAACrBAAwBAAApwQAIAMAAACqBAAgAwAAqwQAMAQAAKcEACADAAAAqgQAIAMAAKsEADAEAACnBAAgB78HAQAAAAHFB0AAAAAB3AeAAAAAAYoIAQAAAAHECQIAAAAByQkBAAAAAcsJAQAAAAEBCAAArwQAIAe_BwEAAAABxQdAAAAAAdwHgAAAAAGKCAEAAAABxAkCAAAAAckJAQAAAAHLCQEAAAABAQgAALEEADABCAAAsQQAMAe_BwEA7gwAIcUHQADwDAAh3AeAAAAAAYoIAQD3DAAhxAkCAPgMACHJCQEA9wwAIcsJAQD3DAAhAgAAAKcEACAIAAC0BAAgB78HAQDuDAAhxQdAAPAMACHcB4AAAAABiggBAPcMACHECQIA-AwAIckJAQD3DAAhywkBAPcMACECAAAAqgQAIAgAALYEACACAAAAqgQAIAgAALYEACADAAAApwQAIA8AAK8EACAQAAC0BAAgAQAAAKcEACABAAAAqgQAIAoVAACNDgAgFgAAjg4AIBcAAJEOACAYAACQDgAgGQAAjw4AINwHAADxDAAgiggAAPEMACDECQAA8QwAIMkJAADxDAAgywkAAPEMACAKvAcAALgMADC9BwAAvQQAEL4HAAC4DAAwvwcBAMULACHFB0AAxwsAIdwHAADgCwAgiggBANQLACHECQIA1QsAIckJAQDUCwAhywkBANQLACEDAAAAqgQAIAMAALwEADAUAAC9BAAgAwAAAKoEACADAACrBAAwBAAApwQAIAy8BwAAtwwAML0HAADDBAAQvgcAALcMADC_BwEAAAABxQdAANILACHcBwAA5gsAIMIJAQDcCwAhxAkCAN0LACHICQEA3AsAIckJAQDcCwAhygkBANwLACHLCQEA3AsAIQEAAADABAAgAQAAAMAEACAMvAcAALcMADC9BwAAwwQAEL4HAAC3DAAwvwcBANALACHFB0AA0gsAIdwHAADmCwAgwgkBANwLACHECQIA3QsAIcgJAQDcCwAhyQkBANwLACHKCQEA3AsAIcsJAQDcCwAhB9wHAADxDAAgwgkAAPEMACDECQAA8QwAIMgJAADxDAAgyQkAAPEMACDKCQAA8QwAIMsJAADxDAAgAwAAAMMEACADAADEBAAwBAAAwAQAIAMAAADDBAAgAwAAxAQAMAQAAMAEACADAAAAwwQAIAMAAMQEADAEAADABAAgCb8HAQAAAAHFB0AAAAAB3AeAAAAAAcIJAQAAAAHECQIAAAAByAkBAAAAAckJAQAAAAHKCQEAAAABywkBAAAAAQEIAADIBAAgCb8HAQAAAAHFB0AAAAAB3AeAAAAAAcIJAQAAAAHECQIAAAAByAkBAAAAAckJAQAAAAHKCQEAAAABywkBAAAAAQEIAADKBAAwAQgAAMoEADAJvwcBAO4MACHFB0AA8AwAIdwHgAAAAAHCCQEA9wwAIcQJAgD4DAAhyAkBAPcMACHJCQEA9wwAIcoJAQD3DAAhywkBAPcMACECAAAAwAQAIAgAAM0EACAJvwcBAO4MACHFB0AA8AwAIdwHgAAAAAHCCQEA9wwAIcQJAgD4DAAhyAkBAPcMACHJCQEA9wwAIcoJAQD3DAAhywkBAPcMACECAAAAwwQAIAgAAM8EACACAAAAwwQAIAgAAM8EACADAAAAwAQAIA8AAMgEACAQAADNBAAgAQAAAMAEACABAAAAwwQAIAwVAACIDgAgFgAAiQ4AIBcAAIwOACAYAACLDgAgGQAAig4AINwHAADxDAAgwgkAAPEMACDECQAA8QwAIMgJAADxDAAgyQkAAPEMACDKCQAA8QwAIMsJAADxDAAgDLwHAAC2DAAwvQcAANYEABC-BwAAtgwAML8HAQDFCwAhxQdAAMcLACHcBwAA4AsAIMIJAQDUCwAhxAkCANULACHICQEA1AsAIckJAQDUCwAhygkBANQLACHLCQEA1AsAIQMAAADDBAAgAwAA1QQAMBQAANYEACADAAAAwwQAIAMAAMQEADAEAADABAAgDbwHAAC1DAAwvQcAANwEABC-BwAAtQwAML8HAgAAAAHFB0AA0gsAIcYHQADSCwAhgwgBAAAAAaYIIADlCwAhswkAAOYLACC0CUAA8AsAIcUJAQAAAAHGCQEA3AsAIccJIADlCwAhAQAAANkEACABAAAA2QQAIA28BwAAtQwAML0HAADcBAAQvgcAALUMADC_BwIA0QsAIcUHQADSCwAhxgdAANILACGDCAEA3AsAIaYIIADlCwAhswkAAOYLACC0CUAA8AsAIcUJAQDQCwAhxgkBANwLACHHCSAA5QsAIQSDCAAA8QwAILMJAADxDAAgtAkAAPEMACDGCQAA8QwAIAMAAADcBAAgAwAA3QQAMAQAANkEACADAAAA3AQAIAMAAN0EADAEAADZBAAgAwAAANwEACADAADdBAAwBAAA2QQAIAq_BwIAAAABxQdAAAAAAcYHQAAAAAGDCAEAAAABpgggAAAAAbMJgAAAAAG0CUAAAAABxQkBAAAAAcYJAQAAAAHHCSAAAAABAQgAAOEEACAKvwcCAAAAAcUHQAAAAAHGB0AAAAABgwgBAAAAAaYIIAAAAAGzCYAAAAABtAlAAAAAAcUJAQAAAAHGCQEAAAABxwkgAAAAAQEIAADjBAAwAQgAAOMEADAKvwcCAO8MACHFB0AA8AwAIcYHQADwDAAhgwgBAPcMACGmCCAA_gwAIbMJgAAAAAG0CUAAjg0AIcUJAQDuDAAhxgkBAPcMACHHCSAA_gwAIQIAAADZBAAgCAAA5gQAIAq_BwIA7wwAIcUHQADwDAAhxgdAAPAMACGDCAEA9wwAIaYIIAD-DAAhswmAAAAAAbQJQACODQAhxQkBAO4MACHGCQEA9wwAIccJIAD-DAAhAgAAANwEACAIAADoBAAgAgAAANwEACAIAADoBAAgAwAAANkEACAPAADhBAAgEAAA5gQAIAEAAADZBAAgAQAAANwEACAJFQAAgw4AIBYAAIQOACAXAACHDgAgGAAAhg4AIBkAAIUOACCDCAAA8QwAILMJAADxDAAgtAkAAPEMACDGCQAA8QwAIA28BwAAtAwAML0HAADvBAAQvgcAALQMADC_BwIAxgsAIcUHQADHCwAhxgdAAMcLACGDCAEA1AsAIaYIIADfCwAhswkAAOALACC0CUAA7AsAIcUJAQDFCwAhxgkBANQLACHHCSAA3wsAIQMAAADcBAAgAwAA7gQAMBQAAO8EACADAAAA3AQAIAMAAN0EADAEAADZBAAgB7wHAACzDAAwvQcAAPUEABC-BwAAswwAMMUHQADSCwAhxgdAANILACHXBwEAAAABrwkCANELACEBAAAA8gQAIAEAAADyBAAgB7wHAACzDAAwvQcAAPUEABC-BwAAswwAMMUHQADSCwAhxgdAANILACHXBwEA0AsAIa8JAgDRCwAhAAMAAAD1BAAgAwAA9gQAMAQAAPIEACADAAAA9QQAIAMAAPYEADAEAADyBAAgAwAAAPUEACADAAD2BAAwBAAA8gQAIATFB0AAAAABxgdAAAAAAdcHAQAAAAGvCQIAAAABAQgAAPoEACAExQdAAAAAAcYHQAAAAAHXBwEAAAABrwkCAAAAAQEIAAD8BAAwAQgAAPwEADAExQdAAPAMACHGB0AA8AwAIdcHAQDuDAAhrwkCAO8MACECAAAA8gQAIAgAAP8EACAExQdAAPAMACHGB0AA8AwAIdcHAQDuDAAhrwkCAO8MACECAAAA9QQAIAgAAIEFACACAAAA9QQAIAgAAIEFACADAAAA8gQAIA8AAPoEACAQAAD_BAAgAQAAAPIEACABAAAA9QQAIAUVAAD-DQAgFgAA_w0AIBcAAIIOACAYAACBDgAgGQAAgA4AIAe8BwAAsgwAML0HAACIBQAQvgcAALIMADDFB0AAxwsAIcYHQADHCwAh1wcBAMULACGvCQIAxgsAIQMAAAD1BAAgAwAAhwUAMBQAAIgFACADAAAA9QQAIAMAAPYEADAEAADyBAAgCbwHAACxDAAwvQcAAI4FABC-BwAAsQwAMMUHQADSCwAhxgdAANILACHSBwEA3AsAIbMJAADmCwAgwgkBANwLACHECQIAAAABAQAAAIsFACABAAAAiwUAIAm8BwAAsQwAML0HAACOBQAQvgcAALEMADDFB0AA0gsAIcYHQADSCwAh0gcBANwLACGzCQAA5gsAIMIJAQDcCwAhxAkCANELACED0gcAAPEMACCzCQAA8QwAIMIJAADxDAAgAwAAAI4FACADAACPBQAwBAAAiwUAIAMAAACOBQAgAwAAjwUAMAQAAIsFACADAAAAjgUAIAMAAI8FADAEAACLBQAgBsUHQAAAAAHGB0AAAAAB0gcBAAAAAbMJgAAAAAHCCQEAAAABxAkCAAAAAQEIAACTBQAgBsUHQAAAAAHGB0AAAAAB0gcBAAAAAbMJgAAAAAHCCQEAAAABxAkCAAAAAQEIAACVBQAwAQgAAJUFADAGxQdAAPAMACHGB0AA8AwAIdIHAQD3DAAhswmAAAAAAcIJAQD3DAAhxAkCAO8MACECAAAAiwUAIAgAAJgFACAGxQdAAPAMACHGB0AA8AwAIdIHAQD3DAAhswmAAAAAAcIJAQD3DAAhxAkCAO8MACECAAAAjgUAIAgAAJoFACACAAAAjgUAIAgAAJoFACADAAAAiwUAIA8AAJMFACAQAACYBQAgAQAAAIsFACABAAAAjgUAIAgVAAD5DQAgFgAA-g0AIBcAAP0NACAYAAD8DQAgGQAA-w0AINIHAADxDAAgswkAAPEMACDCCQAA8QwAIAm8BwAAsAwAML0HAAChBQAQvgcAALAMADDFB0AAxwsAIcYHQADHCwAh0gcBANQLACGzCQAA4AsAIMIJAQDUCwAhxAkCAMYLACEDAAAAjgUAIAMAAKAFADAUAAChBQAgAwAAAI4FACADAACPBQAwBAAAiwUAIA28BwAArwwAML0HAACnBQAQvgcAAK8MADC_BwEAAAABxQdAANILACHGB0AA0gsAIdcHAQDcCwAhgwgBANwLACGzCQAA5gsAILQJQADwCwAhwAkBANwLACHCCQEA3AsAIcMJQADwCwAhAQAAAKQFACABAAAApAUAIA28BwAArwwAML0HAACnBQAQvgcAAK8MADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHXBwEA3AsAIYMIAQDcCwAhswkAAOYLACC0CUAA8AsAIcAJAQDcCwAhwgkBANwLACHDCUAA8AsAIQfXBwAA8QwAIIMIAADxDAAgswkAAPEMACC0CQAA8QwAIMAJAADxDAAgwgkAAPEMACDDCQAA8QwAIAMAAACnBQAgAwAAqAUAMAQAAKQFACADAAAApwUAIAMAAKgFADAEAACkBQAgAwAAAKcFACADAACoBQAwBAAApAUAIAq_BwEAAAABxQdAAAAAAcYHQAAAAAHXBwEAAAABgwgBAAAAAbMJgAAAAAG0CUAAAAABwAkBAAAAAcIJAQAAAAHDCUAAAAABAQgAAKwFACAKvwcBAAAAAcUHQAAAAAHGB0AAAAAB1wcBAAAAAYMIAQAAAAGzCYAAAAABtAlAAAAAAcAJAQAAAAHCCQEAAAABwwlAAAAAAQEIAACuBQAwAQgAAK4FADAKvwcBAO4MACHFB0AA8AwAIcYHQADwDAAh1wcBAPcMACGDCAEA9wwAIbMJgAAAAAG0CUAAjg0AIcAJAQD3DAAhwgkBAPcMACHDCUAAjg0AIQIAAACkBQAgCAAAsQUAIAq_BwEA7gwAIcUHQADwDAAhxgdAAPAMACHXBwEA9wwAIYMIAQD3DAAhswmAAAAAAbQJQACODQAhwAkBAPcMACHCCQEA9wwAIcMJQACODQAhAgAAAKcFACAIAACzBQAgAgAAAKcFACAIAACzBQAgAwAAAKQFACAPAACsBQAgEAAAsQUAIAEAAACkBQAgAQAAAKcFACAKFQAA9g0AIBgAAPgNACAZAAD3DQAg1wcAAPEMACCDCAAA8QwAILMJAADxDAAgtAkAAPEMACDACQAA8QwAIMIJAADxDAAgwwkAAPEMACANvAcAAK4MADC9BwAAugUAEL4HAACuDAAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAh1wcBANQLACGDCAEA1AsAIbMJAADgCwAgtAlAAOwLACHACQEA1AsAIcIJAQDUCwAhwwlAAOwLACEDAAAApwUAIAMAALkFADAUAAC6BQAgAwAAAKcFACADAACoBQAwBAAApAUAIA28BwAArQwAML0HAADABQAQvgcAAK0MADC_BwEAAAABxAcBANwLACHFB0AA0gsAIcYHQADSCwAhgwgBANwLACHJCAEA3AsAIbMJAADmCwAgtAlAAPALACHACQEA3AsAIcEJAADmCwAgAQAAAL0FACABAAAAvQUAIA28BwAArQwAML0HAADABQAQvgcAAK0MADC_BwEA0AsAIcQHAQDcCwAhxQdAANILACHGB0AA0gsAIYMIAQDcCwAhyQgBANwLACGzCQAA5gsAILQJQADwCwAhwAkBANwLACHBCQAA5gsAIAfEBwAA8QwAIIMIAADxDAAgyQgAAPEMACCzCQAA8QwAILQJAADxDAAgwAkAAPEMACDBCQAA8QwAIAMAAADABQAgAwAAwQUAMAQAAL0FACADAAAAwAUAIAMAAMEFADAEAAC9BQAgAwAAAMAFACADAADBBQAwBAAAvQUAIAq_BwEAAAABxAcBAAAAAcUHQAAAAAHGB0AAAAABgwgBAAAAAckIAQAAAAGzCYAAAAABtAlAAAAAAcAJAQAAAAHBCYAAAAABAQgAAMUFACAKvwcBAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAYMIAQAAAAHJCAEAAAABswmAAAAAAbQJQAAAAAHACQEAAAABwQmAAAAAAQEIAADHBQAwAQgAAMcFADAKvwcBAO4MACHEBwEA9wwAIcUHQADwDAAhxgdAAPAMACGDCAEA9wwAIckIAQD3DAAhswmAAAAAAbQJQACODQAhwAkBAPcMACHBCYAAAAABAgAAAL0FACAIAADKBQAgCr8HAQDuDAAhxAcBAPcMACHFB0AA8AwAIcYHQADwDAAhgwgBAPcMACHJCAEA9wwAIbMJgAAAAAG0CUAAjg0AIcAJAQD3DAAhwQmAAAAAAQIAAADABQAgCAAAzAUAIAIAAADABQAgCAAAzAUAIAMAAAC9BQAgDwAAxQUAIBAAAMoFACABAAAAvQUAIAEAAADABQAgChUAAPMNACAYAAD1DQAgGQAA9A0AIMQHAADxDAAggwgAAPEMACDJCAAA8QwAILMJAADxDAAgtAkAAPEMACDACQAA8QwAIMEJAADxDAAgDbwHAACsDAAwvQcAANMFABC-BwAArAwAML8HAQDFCwAhxAcBANQLACHFB0AAxwsAIcYHQADHCwAhgwgBANQLACHJCAEA1AsAIbMJAADgCwAgtAlAAOwLACHACQEA1AsAIcEJAADgCwAgAwAAAMAFACADAADSBQAwFAAA0wUAIAMAAADABQAgAwAAwQUAMAQAAL0FACAQvAcAAKsMADC9BwAA2QUAEL4HAACrDAAwvwcBAAAAAcUHQADSCwAhxgdAANILACGDCAEA3AsAIckIAQDcCwAhswkAAOYLACC0CUAA8AsAIboJAQDcCwAhuwkBANwLACG8CQEA3AsAIb0JQADwCwAhvgkBANwLACG_CQEA3AsAIQEAAADWBQAgAQAAANYFACAQvAcAAKsMADC9BwAA2QUAEL4HAACrDAAwvwcBANALACHFB0AA0gsAIcYHQADSCwAhgwgBANwLACHJCAEA3AsAIbMJAADmCwAgtAlAAPALACG6CQEA3AsAIbsJAQDcCwAhvAkBANwLACG9CUAA8AsAIb4JAQDcCwAhvwkBANwLACEKgwgAAPEMACDJCAAA8QwAILMJAADxDAAgtAkAAPEMACC6CQAA8QwAILsJAADxDAAgvAkAAPEMACC9CQAA8QwAIL4JAADxDAAgvwkAAPEMACADAAAA2QUAIAMAANoFADAEAADWBQAgAwAAANkFACADAADaBQAwBAAA1gUAIAMAAADZBQAgAwAA2gUAMAQAANYFACANvwcBAAAAAcUHQAAAAAHGB0AAAAABgwgBAAAAAckIAQAAAAGzCYAAAAABtAlAAAAAAboJAQAAAAG7CQEAAAABvAkBAAAAAb0JQAAAAAG-CQEAAAABvwkBAAAAAQEIAADeBQAgDb8HAQAAAAHFB0AAAAABxgdAAAAAAYMIAQAAAAHJCAEAAAABswmAAAAAAbQJQAAAAAG6CQEAAAABuwkBAAAAAbwJAQAAAAG9CUAAAAABvgkBAAAAAb8JAQAAAAEBCAAA4AUAMAEIAADgBQAwDb8HAQDuDAAhxQdAAPAMACHGB0AA8AwAIYMIAQD3DAAhyQgBAPcMACGzCYAAAAABtAlAAI4NACG6CQEA9wwAIbsJAQD3DAAhvAkBAPcMACG9CUAAjg0AIb4JAQD3DAAhvwkBAPcMACECAAAA1gUAIAgAAOMFACANvwcBAO4MACHFB0AA8AwAIcYHQADwDAAhgwgBAPcMACHJCAEA9wwAIbMJgAAAAAG0CUAAjg0AIboJAQD3DAAhuwkBAPcMACG8CQEA9wwAIb0JQACODQAhvgkBAPcMACG_CQEA9wwAIQIAAADZBQAgCAAA5QUAIAIAAADZBQAgCAAA5QUAIAMAAADWBQAgDwAA3gUAIBAAAOMFACABAAAA1gUAIAEAAADZBQAgDRUAAPANACAYAADyDQAgGQAA8Q0AIIMIAADxDAAgyQgAAPEMACCzCQAA8QwAILQJAADxDAAgugkAAPEMACC7CQAA8QwAILwJAADxDAAgvQkAAPEMACC-CQAA8QwAIL8JAADxDAAgELwHAACqDAAwvQcAAOwFABC-BwAAqgwAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIYMIAQDUCwAhyQgBANQLACGzCQAA4AsAILQJQADsCwAhugkBANQLACG7CQEA1AsAIbwJAQDUCwAhvQlAAOwLACG-CQEA1AsAIb8JAQDUCwAhAwAAANkFACADAADrBQAwFAAA7AUAIAMAAADZBQAgAwAA2gUAMAQAANYFACAOvAcAAKkMADC9BwAA8gUAEL4HAACpDAAwvwcBAAAAAcUHQADSCwAhxgdAANILACGKCAEA3AsAIbAJAQDcCwAhswkAAOYLACC0CUAA8AsAIbYJAQDcCwAhtwkBANwLACG4CQIA3QsAIbkJAgDdCwAhAQAAAO8FACABAAAA7wUAIA68BwAAqQwAML0HAADyBQAQvgcAAKkMADC_BwEA0AsAIcUHQADSCwAhxgdAANILACGKCAEA3AsAIbAJAQDcCwAhswkAAOYLACC0CUAA8AsAIbYJAQDcCwAhtwkBANwLACG4CQIA3QsAIbkJAgDdCwAhCIoIAADxDAAgsAkAAPEMACCzCQAA8QwAILQJAADxDAAgtgkAAPEMACC3CQAA8QwAILgJAADxDAAguQkAAPEMACADAAAA8gUAIAMAAPMFADAEAADvBQAgAwAAAPIFACADAADzBQAwBAAA7wUAIAMAAADyBQAgAwAA8wUAMAQAAO8FACALvwcBAAAAAcUHQAAAAAHGB0AAAAABiggBAAAAAbAJAQAAAAGzCYAAAAABtAlAAAAAAbYJAQAAAAG3CQEAAAABuAkCAAAAAbkJAgAAAAEBCAAA9wUAIAu_BwEAAAABxQdAAAAAAcYHQAAAAAGKCAEAAAABsAkBAAAAAbMJgAAAAAG0CUAAAAABtgkBAAAAAbcJAQAAAAG4CQIAAAABuQkCAAAAAQEIAAD5BQAwAQgAAPkFADALvwcBAO4MACHFB0AA8AwAIcYHQADwDAAhiggBAPcMACGwCQEA9wwAIbMJgAAAAAG0CUAAjg0AIbYJAQD3DAAhtwkBAPcMACG4CQIA-AwAIbkJAgD4DAAhAgAAAO8FACAIAAD8BQAgC78HAQDuDAAhxQdAAPAMACHGB0AA8AwAIYoIAQD3DAAhsAkBAPcMACGzCYAAAAABtAlAAI4NACG2CQEA9wwAIbcJAQD3DAAhuAkCAPgMACG5CQIA-AwAIQIAAADyBQAgCAAA_gUAIAIAAADyBQAgCAAA_gUAIAMAAADvBQAgDwAA9wUAIBAAAPwFACABAAAA7wUAIAEAAADyBQAgDRUAAOsNACAWAADsDQAgFwAA7w0AIBgAAO4NACAZAADtDQAgiggAAPEMACCwCQAA8QwAILMJAADxDAAgtAkAAPEMACC2CQAA8QwAILcJAADxDAAguAkAAPEMACC5CQAA8QwAIA68BwAAqAwAML0HAACFBgAQvgcAAKgMADC_BwEAxQsAIcUHQADHCwAhxgdAAMcLACGKCAEA1AsAIbAJAQDUCwAhswkAAOALACC0CUAA7AsAIbYJAQDUCwAhtwkBANQLACG4CQIA1QsAIbkJAgDVCwAhAwAAAPIFACADAACEBgAwFAAAhQYAIAMAAADyBQAgAwAA8wUAMAQAAO8FACALvAcAAKcMADC9BwAAiwYAEL4HAACnDAAwvwcBAAAAAcUHQADSCwAhxgdAANILACGDCAEA3AsAIaQIAQDcCwAhswkAAOYLACC0CUAA8AsAIbUJAQDcCwAhAQAAAIgGACABAAAAiAYAIAu8BwAApwwAML0HAACLBgAQvgcAAKcMADC_BwEA0AsAIcUHQADSCwAhxgdAANILACGDCAEA3AsAIaQIAQDcCwAhswkAAOYLACC0CUAA8AsAIbUJAQDcCwAhBYMIAADxDAAgpAgAAPEMACCzCQAA8QwAILQJAADxDAAgtQkAAPEMACADAAAAiwYAIAMAAIwGADAEAACIBgAgAwAAAIsGACADAACMBgAwBAAAiAYAIAMAAACLBgAgAwAAjAYAMAQAAIgGACAIvwcBAAAAAcUHQAAAAAHGB0AAAAABgwgBAAAAAaQIAQAAAAGzCYAAAAABtAlAAAAAAbUJAQAAAAEBCAAAkAYAIAi_BwEAAAABxQdAAAAAAcYHQAAAAAGDCAEAAAABpAgBAAAAAbMJgAAAAAG0CUAAAAABtQkBAAAAAQEIAACSBgAwAQgAAJIGADAIvwcBAO4MACHFB0AA8AwAIcYHQADwDAAhgwgBAPcMACGkCAEA9wwAIbMJgAAAAAG0CUAAjg0AIbUJAQD3DAAhAgAAAIgGACAIAACVBgAgCL8HAQDuDAAhxQdAAPAMACHGB0AA8AwAIYMIAQD3DAAhpAgBAPcMACGzCYAAAAABtAlAAI4NACG1CQEA9wwAIQIAAACLBgAgCAAAlwYAIAIAAACLBgAgCAAAlwYAIAMAAACIBgAgDwAAkAYAIBAAAJUGACABAAAAiAYAIAEAAACLBgAgCBUAAOgNACAYAADqDQAgGQAA6Q0AIIMIAADxDAAgpAgAAPEMACCzCQAA8QwAILQJAADxDAAgtQkAAPEMACALvAcAAKYMADC9BwAAngYAEL4HAACmDAAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAhgwgBANQLACGkCAEA1AsAIbMJAADgCwAgtAlAAOwLACG1CQEA1AsAIQMAAACLBgAgAwAAnQYAMBQAAJ4GACADAAAAiwYAIAMAAIwGADAEAACIBgAgDbwHAAClDAAwvQcAAKQGABC-BwAApQwAML8HAgAAAAHFB0AA0gsAIcYHQADSCwAh1wcBANwLACGKCAEA3AsAIbAJAQDcCwAhsQkAAOYLACCyCSAA5QsAIbMJAADmCwAgtAlAAPALACEBAAAAoQYAIAEAAAChBgAgDbwHAAClDAAwvQcAAKQGABC-BwAApQwAML8HAgDRCwAhxQdAANILACHGB0AA0gsAIdcHAQDcCwAhiggBANwLACGwCQEA3AsAIbEJAADmCwAgsgkgAOULACGzCQAA5gsAILQJQADwCwAhBtcHAADxDAAgiggAAPEMACCwCQAA8QwAILEJAADxDAAgswkAAPEMACC0CQAA8QwAIAMAAACkBgAgAwAApQYAMAQAAKEGACADAAAApAYAIAMAAKUGADAEAAChBgAgAwAAAKQGACADAAClBgAwBAAAoQYAIAq_BwIAAAABxQdAAAAAAcYHQAAAAAHXBwEAAAABiggBAAAAAbAJAQAAAAGxCYAAAAABsgkgAAAAAbMJgAAAAAG0CUAAAAABAQgAAKkGACAKvwcCAAAAAcUHQAAAAAHGB0AAAAAB1wcBAAAAAYoIAQAAAAGwCQEAAAABsQmAAAAAAbIJIAAAAAGzCYAAAAABtAlAAAAAAQEIAACrBgAwAQgAAKsGADAKvwcCAO8MACHFB0AA8AwAIcYHQADwDAAh1wcBAPcMACGKCAEA9wwAIbAJAQD3DAAhsQmAAAAAAbIJIAD-DAAhswmAAAAAAbQJQACODQAhAgAAAKEGACAIAACuBgAgCr8HAgDvDAAhxQdAAPAMACHGB0AA8AwAIdcHAQD3DAAhiggBAPcMACGwCQEA9wwAIbEJgAAAAAGyCSAA_gwAIbMJgAAAAAG0CUAAjg0AIQIAAACkBgAgCAAAsAYAIAIAAACkBgAgCAAAsAYAIAMAAAChBgAgDwAAqQYAIBAAAK4GACABAAAAoQYAIAEAAACkBgAgCxUAAOMNACAWAADkDQAgFwAA5w0AIBgAAOYNACAZAADlDQAg1wcAAPEMACCKCAAA8QwAILAJAADxDAAgsQkAAPEMACCzCQAA8QwAILQJAADxDAAgDbwHAACkDAAwvQcAALcGABC-BwAApAwAML8HAgDGCwAhxQdAAMcLACHGB0AAxwsAIdcHAQDUCwAhiggBANQLACGwCQEA1AsAIbEJAADgCwAgsgkgAN8LACGzCQAA4AsAILQJQADsCwAhAwAAAKQGACADAAC2BgAwFAAAtwYAIAMAAACkBgAgAwAApQYAMAQAAKEGACAFvAcAAKIMADC9BwAAvQYAEL4HAACiDAAwlggBAAAAAa8JAACjDAAgAQAAALoGACABAAAAugYAIAW8BwAAogwAML0HAAC9BgAQvgcAAKIMADCWCAEA0AsAIa8JAACjDAAgAAMAAAC9BgAgAwAAvgYAMAQAALoGACADAAAAvQYAIAMAAL4GADAEAAC6BgAgAwAAAL0GACADAAC-BgAwBAAAugYAIAKWCAEAAAABrwmAAAAAAQEIAADCBgAgApYIAQAAAAGvCYAAAAABAQgAAMQGADABCAAAxAYAMAKWCAEA7gwAIa8JgAAAAAECAAAAugYAIAgAAMcGACAClggBAO4MACGvCYAAAAABAgAAAL0GACAIAADJBgAgAgAAAL0GACAIAADJBgAgAwAAALoGACAPAADCBgAgEAAAxwYAIAEAAAC6BgAgAQAAAL0GACADFQAA4A0AIBgAAOINACAZAADhDQAgBbwHAACfDAAwvQcAANAGABC-BwAAnwwAMJYIAQDFCwAhrwkAAKAMACADAAAAvQYAIAMAAM8GADAUAADQBgAgAwAAAL0GACADAAC-BgAwBAAAugYAIAu8BwAAngwAML0HAADWBgAQvgcAAJ4MADC_BwEAAAABxAcBANwLACHFB0AA0gsAIcYHQADSCwAh1wcBANwLACHcBwAA5gsAIJ8JAQDcCwAhrgkBAAAAAQEAAADTBgAgAQAAANMGACALvAcAAJ4MADC9BwAA1gYAEL4HAACeDAAwvwcBANALACHEBwEA3AsAIcUHQADSCwAhxgdAANILACHXBwEA3AsAIdwHAADmCwAgnwkBANwLACGuCQEA0AsAIQTEBwAA8QwAINcHAADxDAAg3AcAAPEMACCfCQAA8QwAIAMAAADWBgAgAwAA1wYAMAQAANMGACADAAAA1gYAIAMAANcGADAEAADTBgAgAwAAANYGACADAADXBgAwBAAA0wYAIAi_BwEAAAABxAcBAAAAAcUHQAAAAAHGB0AAAAAB1wcBAAAAAdwHgAAAAAGfCQEAAAABrgkBAAAAAQEIAADbBgAgCL8HAQAAAAHEBwEAAAABxQdAAAAAAcYHQAAAAAHXBwEAAAAB3AeAAAAAAZ8JAQAAAAGuCQEAAAABAQgAAN0GADABCAAA3QYAMAi_BwEA7gwAIcQHAQD3DAAhxQdAAPAMACHGB0AA8AwAIdcHAQD3DAAh3AeAAAAAAZ8JAQD3DAAhrgkBAO4MACECAAAA0wYAIAgAAOAGACAIvwcBAO4MACHEBwEA9wwAIcUHQADwDAAhxgdAAPAMACHXBwEA9wwAIdwHgAAAAAGfCQEA9wwAIa4JAQDuDAAhAgAAANYGACAIAADiBgAgAgAAANYGACAIAADiBgAgAwAAANMGACAPAADbBgAgEAAA4AYAIAEAAADTBgAgAQAAANYGACAHFQAA3Q0AIBgAAN8NACAZAADeDQAgxAcAAPEMACDXBwAA8QwAINwHAADxDAAgnwkAAPEMACALvAcAAJ0MADC9BwAA6QYAEL4HAACdDAAwvwcBAMULACHEBwEA1AsAIcUHQADHCwAhxgdAAMcLACHXBwEA1AsAIdwHAADgCwAgnwkBANQLACGuCQEAxQsAIQMAAADWBgAgAwAA6AYAMBQAAOkGACADAAAA1gYAIAMAANcGADAEAADTBgAgC7wHAACbDAAwvQcAAO8GABC-BwAAmwwAML8HAQAAAAHABwEA0AsAIcUHQADSCwAhxgdAANILACHcBwAA5gsAIKkIAgDRCwAhrAkBANALACGtCQAAnAwAIAEAAADsBgAgAQAAAOwGACAKvAcAAJsMADC9BwAA7wYAEL4HAACbDAAwvwcBANALACHABwEA0AsAIcUHQADSCwAhxgdAANILACHcBwAA5gsAIKkIAgDRCwAhrAkBANALACEB3AcAAPEMACADAAAA7wYAIAMAAPAGADAEAADsBgAgAwAAAO8GACADAADwBgAwBAAA7AYAIAMAAADvBgAgAwAA8AYAMAQAAOwGACAHvwcBAAAAAcAHAQAAAAHFB0AAAAABxgdAAAAAAdwHgAAAAAGpCAIAAAABrAkBAAAAAQEIAAD0BgAgB78HAQAAAAHABwEAAAABxQdAAAAAAcYHQAAAAAHcB4AAAAABqQgCAAAAAawJAQAAAAEBCAAA9gYAMAEIAAD2BgAwB78HAQDuDAAhwAcBAO4MACHFB0AA8AwAIcYHQADwDAAh3AeAAAAAAakIAgDvDAAhrAkBAO4MACECAAAA7AYAIAgAAPkGACAHvwcBAO4MACHABwEA7gwAIcUHQADwDAAhxgdAAPAMACHcB4AAAAABqQgCAO8MACGsCQEA7gwAIQIAAADvBgAgCAAA-wYAIAIAAADvBgAgCAAA-wYAIAMAAADsBgAgDwAA9AYAIBAAAPkGACABAAAA7AYAIAEAAADvBgAgBhUAANgNACAWAADZDQAgFwAA3A0AIBgAANsNACAZAADaDQAg3AcAAPEMACAKvAcAAJoMADC9BwAAggcAEL4HAACaDAAwvwcBAMULACHABwEAxQsAIcUHQADHCwAhxgdAAMcLACHcBwAA4AsAIKkIAgDGCwAhrAkBAMULACEDAAAA7wYAIAMAAIEHADAUAACCBwAgAwAAAO8GACADAADwBgAwBAAA7AYAIBC8BwAAmQwAML0HAACIBwAQvgcAAJkMADC_BwEAAAABwAcBAAAAAcUHQADSCwAhxgdAANILACHcBwAA5gsAIKcIAADmCwAgvQgCAN0LACG-CAIA3QsAIb8IAgDdCwAhwAggAOULACHBCCAA5QsAIcIIIADlCwAhwwggAOULACEBAAAAhQcAIAEAAACFBwAgELwHAACZDAAwvQcAAIgHABC-BwAAmQwAML8HAQDQCwAhwAcBANALACHFB0AA0gsAIcYHQADSCwAh3AcAAOYLACCnCAAA5gsAIL0IAgDdCwAhvggCAN0LACG_CAIA3QsAIcAIIADlCwAhwQggAOULACHCCCAA5QsAIcMIIADlCwAhBdwHAADxDAAgpwgAAPEMACC9CAAA8QwAIL4IAADxDAAgvwgAAPEMACADAAAAiAcAIAMAAIkHADAEAACFBwAgAwAAAIgHACADAACJBwAwBAAAhQcAIAMAAACIBwAgAwAAiQcAMAQAAIUHACANvwcBAAAAAcAHAQAAAAHFB0AAAAABxgdAAAAAAdwHgAAAAAGnCIAAAAABvQgCAAAAAb4IAgAAAAG_CAIAAAABwAggAAAAAcEIIAAAAAHCCCAAAAABwwggAAAAAQEIAACNBwAgDb8HAQAAAAHABwEAAAABxQdAAAAAAcYHQAAAAAHcB4AAAAABpwiAAAAAAb0IAgAAAAG-CAIAAAABvwgCAAAAAcAIIAAAAAHBCCAAAAABwgggAAAAAcMIIAAAAAEBCAAAjwcAMAEIAACPBwAwDb8HAQDuDAAhwAcBAO4MACHFB0AA8AwAIcYHQADwDAAh3AeAAAAAAacIgAAAAAG9CAIA-AwAIb4IAgD4DAAhvwgCAPgMACHACCAA_gwAIcEIIAD-DAAhwgggAP4MACHDCCAA_gwAIQIAAACFBwAgCAAAkgcAIA2_BwEA7gwAIcAHAQDuDAAhxQdAAPAMACHGB0AA8AwAIdwHgAAAAAGnCIAAAAABvQgCAPgMACG-CAIA-AwAIb8IAgD4DAAhwAggAP4MACHBCCAA_gwAIcIIIAD-DAAhwwggAP4MACECAAAAiAcAIAgAAJQHACACAAAAiAcAIAgAAJQHACADAAAAhQcAIA8AAI0HACAQAACSBwAgAQAAAIUHACABAAAAiAcAIAoVAADTDQAgFgAA1A0AIBcAANcNACAYAADWDQAgGQAA1Q0AINwHAADxDAAgpwgAAPEMACC9CAAA8QwAIL4IAADxDAAgvwgAAPEMACAQvAcAAJgMADC9BwAAmwcAEL4HAACYDAAwvwcBAMULACHABwEAxQsAIcUHQADHCwAhxgdAAMcLACHcBwAA4AsAIKcIAADgCwAgvQgCANULACG-CAIA1QsAIb8IAgDVCwAhwAggAN8LACHBCCAA3wsAIcIIIADfCwAhwwggAN8LACEDAAAAiAcAIAMAAJoHADAUAACbBwAgAwAAAIgHACADAACJBwAwBAAAhQcAIBi8BwAAlwwAML0HAAChBwAQvgcAAJcMADC_BwEAAAABwAcBANALACHEBwEA3AsAIcUHQADSCwAhxgdAANILACHcBwAA5gsAIKgIAQDcCwAhyQgBANALACGfCQEA3AsAIaAJAQDcCwAhoQkBANwLACGiCUAA8AsAIaMJQADwCwAhpAlAAPALACGlCUAA8AsAIaYJQADwCwAhpwlAAPALACGoCQEA3AsAIakJQADwCwAhqglAAPALACGrCSAA5QsAIQEAAACeBwAgAQAAAJ4HACAYvAcAAJcMADC9BwAAoQcAEL4HAACXDAAwvwcBANALACHABwEA0AsAIcQHAQDcCwAhxQdAANILACHGB0AA0gsAIdwHAADmCwAgqAgBANwLACHJCAEA0AsAIZ8JAQDcCwAhoAkBANwLACGhCQEA3AsAIaIJQADwCwAhowlAAPALACGkCUAA8AsAIaUJQADwCwAhpglAAPALACGnCUAA8AsAIagJAQDcCwAhqQlAAPALACGqCUAA8AsAIasJIADlCwAhD8QHAADxDAAg3AcAAPEMACCoCAAA8QwAIJ8JAADxDAAgoAkAAPEMACChCQAA8QwAIKIJAADxDAAgowkAAPEMACCkCQAA8QwAIKUJAADxDAAgpgkAAPEMACCnCQAA8QwAIKgJAADxDAAgqQkAAPEMACCqCQAA8QwAIAMAAAChBwAgAwAAogcAMAQAAJ4HACADAAAAoQcAIAMAAKIHADAEAACeBwAgAwAAAKEHACADAACiBwAwBAAAngcAIBW_BwEAAAABwAcBAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAdwHgAAAAAGoCAEAAAAByQgBAAAAAZ8JAQAAAAGgCQEAAAABoQkBAAAAAaIJQAAAAAGjCUAAAAABpAlAAAAAAaUJQAAAAAGmCUAAAAABpwlAAAAAAagJAQAAAAGpCUAAAAABqglAAAAAAasJIAAAAAEBCAAApgcAIBW_BwEAAAABwAcBAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAdwHgAAAAAGoCAEAAAAByQgBAAAAAZ8JAQAAAAGgCQEAAAABoQkBAAAAAaIJQAAAAAGjCUAAAAABpAlAAAAAAaUJQAAAAAGmCUAAAAABpwlAAAAAAagJAQAAAAGpCUAAAAABqglAAAAAAasJIAAAAAEBCAAAqAcAMAEIAACoBwAwFb8HAQDuDAAhwAcBAO4MACHEBwEA9wwAIcUHQADwDAAhxgdAAPAMACHcB4AAAAABqAgBAPcMACHJCAEA7gwAIZ8JAQD3DAAhoAkBAPcMACGhCQEA9wwAIaIJQACODQAhowlAAI4NACGkCUAAjg0AIaUJQACODQAhpglAAI4NACGnCUAAjg0AIagJAQD3DAAhqQlAAI4NACGqCUAAjg0AIasJIAD-DAAhAgAAAJ4HACAIAACrBwAgFb8HAQDuDAAhwAcBAO4MACHEBwEA9wwAIcUHQADwDAAhxgdAAPAMACHcB4AAAAABqAgBAPcMACHJCAEA7gwAIZ8JAQD3DAAhoAkBAPcMACGhCQEA9wwAIaIJQACODQAhowlAAI4NACGkCUAAjg0AIaUJQACODQAhpglAAI4NACGnCUAAjg0AIagJAQD3DAAhqQlAAI4NACGqCUAAjg0AIasJIAD-DAAhAgAAAKEHACAIAACtBwAgAgAAAKEHACAIAACtBwAgAwAAAJ4HACAPAACmBwAgEAAAqwcAIAEAAACeBwAgAQAAAKEHACASFQAA0A0AIBgAANINACAZAADRDQAgxAcAAPEMACDcBwAA8QwAIKgIAADxDAAgnwkAAPEMACCgCQAA8QwAIKEJAADxDAAgogkAAPEMACCjCQAA8QwAIKQJAADxDAAgpQkAAPEMACCmCQAA8QwAIKcJAADxDAAgqAkAAPEMACCpCQAA8QwAIKoJAADxDAAgGLwHAACWDAAwvQcAALQHABC-BwAAlgwAML8HAQDFCwAhwAcBAMULACHEBwEA1AsAIcUHQADHCwAhxgdAAMcLACHcBwAA4AsAIKgIAQDUCwAhyQgBAMULACGfCQEA1AsAIaAJAQDUCwAhoQkBANQLACGiCUAA7AsAIaMJQADsCwAhpAlAAOwLACGlCUAA7AsAIaYJQADsCwAhpwlAAOwLACGoCQEA1AsAIakJQADsCwAhqglAAOwLACGrCSAA3wsAIQMAAAChBwAgAwAAswcAMBQAALQHACADAAAAoQcAIAMAAKIHADAEAACeBwAgL7wHAACVDAAwvQcAALoHABC-BwAAlQwAML8HAQAAAAHABwEA0AsAIcQHAQDcCwAhxQdAANILACHGB0AA0gsAIdwHAADmCwAgiggBANwLACGqCAEA3AsAIbEIAQDcCwAhyQgBANALACHyCAEA3AsAIf0IAgDdCwAh_ggIAI4MACH_CAIA3QsAIYEJAgDdCwAhgglAAPALACGDCUAA8AsAIYQJAQDcCwAhhQkCAN0LACGGCQIA3QsAIYcJQADwCwAhiAlAAPALACGJCQEA3AsAIYoJAQDcCwAhiwkBAAAAAYwJAQDcCwAhjQkBANwLACGOCQEA3AsAIY8JQADwCwAhkAkCAN0LACGRCQEA3AsAIZIJAQDcCwAhkwkBANwLACGUCQEA3AsAIZUJAQDcCwAhlgkBANwLACGXCQEA3AsAIZgJAQDcCwAhmQkBANwLACGaCQEA3AsAIZsJAQDcCwAhnAkBANwLACGdCQEA3AsAIZ4JAADmCwAgAQAAALcHACABAAAAtwcAIC-8BwAAlQwAML0HAAC6BwAQvgcAAJUMADC_BwEA0AsAIcAHAQDQCwAhxAcBANwLACHFB0AA0gsAIcYHQADSCwAh3AcAAOYLACCKCAEA3AsAIaoIAQDcCwAhsQgBANwLACHJCAEA0AsAIfIIAQDcCwAh_QgCAN0LACH-CAgAjgwAIf8IAgDdCwAhgQkCAN0LACGCCUAA8AsAIYMJQADwCwAhhAkBANwLACGFCQIA3QsAIYYJAgDdCwAhhwlAAPALACGICUAA8AsAIYkJAQDcCwAhigkBANwLACGLCQEA3AsAIYwJAQDcCwAhjQkBANwLACGOCQEA3AsAIY8JQADwCwAhkAkCAN0LACGRCQEA3AsAIZIJAQDcCwAhkwkBANwLACGUCQEA3AsAIZUJAQDcCwAhlgkBANwLACGXCQEA3AsAIZgJAQDcCwAhmQkBANwLACGaCQEA3AsAIZsJAQDcCwAhnAkBANwLACGdCQEA3AsAIZ4JAADmCwAgJ8QHAADxDAAg3AcAAPEMACCKCAAA8QwAIKoIAADxDAAgsQgAAPEMACDyCAAA8QwAIP0IAADxDAAg_ggAAPEMACD_CAAA8QwAIIEJAADxDAAgggkAAPEMACCDCQAA8QwAIIQJAADxDAAghQkAAPEMACCGCQAA8QwAIIcJAADxDAAgiAkAAPEMACCJCQAA8QwAIIoJAADxDAAgiwkAAPEMACCMCQAA8QwAII0JAADxDAAgjgkAAPEMACCPCQAA8QwAIJAJAADxDAAgkQkAAPEMACCSCQAA8QwAIJMJAADxDAAglAkAAPEMACCVCQAA8QwAIJYJAADxDAAglwkAAPEMACCYCQAA8QwAIJkJAADxDAAgmgkAAPEMACCbCQAA8QwAIJwJAADxDAAgnQkAAPEMACCeCQAA8QwAIAMAAAC6BwAgAwAAuwcAMAQAALcHACADAAAAugcAIAMAALsHADAEAAC3BwAgAwAAALoHACADAAC7BwAwBAAAtwcAICy_BwEAAAABwAcBAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAdwHgAAAAAGKCAEAAAABqggBAAAAAbEIAQAAAAHJCAEAAAAB8ggBAAAAAf0IAgAAAAH-CAgAAAAB_wgCAAAAAYEJAgAAAAGCCUAAAAABgwlAAAAAAYQJAQAAAAGFCQIAAAABhgkCAAAAAYcJQAAAAAGICUAAAAABiQkBAAAAAYoJAQAAAAGLCQEAAAABjAkBAAAAAY0JAQAAAAGOCQEAAAABjwlAAAAAAZAJAgAAAAGRCQEAAAABkgkBAAAAAZMJAQAAAAGUCQEAAAABlQkBAAAAAZYJAQAAAAGXCQEAAAABmAkBAAAAAZkJAQAAAAGaCQEAAAABmwkBAAAAAZwJAQAAAAGdCQEAAAABngmAAAAAAQEIAAC_BwAgLL8HAQAAAAHABwEAAAABxAcBAAAAAcUHQAAAAAHGB0AAAAAB3AeAAAAAAYoIAQAAAAGqCAEAAAABsQgBAAAAAckIAQAAAAHyCAEAAAAB_QgCAAAAAf4ICAAAAAH_CAIAAAABgQkCAAAAAYIJQAAAAAGDCUAAAAABhAkBAAAAAYUJAgAAAAGGCQIAAAABhwlAAAAAAYgJQAAAAAGJCQEAAAABigkBAAAAAYsJAQAAAAGMCQEAAAABjQkBAAAAAY4JAQAAAAGPCUAAAAABkAkCAAAAAZEJAQAAAAGSCQEAAAABkwkBAAAAAZQJAQAAAAGVCQEAAAABlgkBAAAAAZcJAQAAAAGYCQEAAAABmQkBAAAAAZoJAQAAAAGbCQEAAAABnAkBAAAAAZ0JAQAAAAGeCYAAAAABAQgAAMEHADABCAAAwQcAMCy_BwEA7gwAIcAHAQDuDAAhxAcBAPcMACHFB0AA8AwAIcYHQADwDAAh3AeAAAAAAYoIAQD3DAAhqggBAPcMACGxCAEA9wwAIckIAQDuDAAh8ggBAPcMACH9CAIA-AwAIf4ICADEDQAh_wgCAPgMACGBCQIA-AwAIYIJQACODQAhgwlAAI4NACGECQEA9wwAIYUJAgD4DAAhhgkCAPgMACGHCUAAjg0AIYgJQACODQAhiQkBAPcMACGKCQEA9wwAIYsJAQD3DAAhjAkBAPcMACGNCQEA9wwAIY4JAQD3DAAhjwlAAI4NACGQCQIA-AwAIZEJAQD3DAAhkgkBAPcMACGTCQEA9wwAIZQJAQD3DAAhlQkBAPcMACGWCQEA9wwAIZcJAQD3DAAhmAkBAPcMACGZCQEA9wwAIZoJAQD3DAAhmwkBAPcMACGcCQEA9wwAIZ0JAQD3DAAhngmAAAAAAQIAAAC3BwAgCAAAxAcAICy_BwEA7gwAIcAHAQDuDAAhxAcBAPcMACHFB0AA8AwAIcYHQADwDAAh3AeAAAAAAYoIAQD3DAAhqggBAPcMACGxCAEA9wwAIckIAQDuDAAh8ggBAPcMACH9CAIA-AwAIf4ICADEDQAh_wgCAPgMACGBCQIA-AwAIYIJQACODQAhgwlAAI4NACGECQEA9wwAIYUJAgD4DAAhhgkCAPgMACGHCUAAjg0AIYgJQACODQAhiQkBAPcMACGKCQEA9wwAIYsJAQD3DAAhjAkBAPcMACGNCQEA9wwAIY4JAQD3DAAhjwlAAI4NACGQCQIA-AwAIZEJAQD3DAAhkgkBAPcMACGTCQEA9wwAIZQJAQD3DAAhlQkBAPcMACGWCQEA9wwAIZcJAQD3DAAhmAkBAPcMACGZCQEA9wwAIZoJAQD3DAAhmwkBAPcMACGcCQEA9wwAIZ0JAQD3DAAhngmAAAAAAQIAAAC6BwAgCAAAxgcAIAIAAAC6BwAgCAAAxgcAIAMAAAC3BwAgDwAAvwcAIBAAAMQHACABAAAAtwcAIAEAAAC6BwAgLBUAAMsNACAWAADMDQAgFwAAzw0AIBgAAM4NACAZAADNDQAgxAcAAPEMACDcBwAA8QwAIIoIAADxDAAgqggAAPEMACCxCAAA8QwAIPIIAADxDAAg_QgAAPEMACD-CAAA8QwAIP8IAADxDAAggQkAAPEMACCCCQAA8QwAIIMJAADxDAAghAkAAPEMACCFCQAA8QwAIIYJAADxDAAghwkAAPEMACCICQAA8QwAIIkJAADxDAAgigkAAPEMACCLCQAA8QwAIIwJAADxDAAgjQkAAPEMACCOCQAA8QwAII8JAADxDAAgkAkAAPEMACCRCQAA8QwAIJIJAADxDAAgkwkAAPEMACCUCQAA8QwAIJUJAADxDAAglgkAAPEMACCXCQAA8QwAIJgJAADxDAAgmQkAAPEMACCaCQAA8QwAIJsJAADxDAAgnAkAAPEMACCdCQAA8QwAIJ4JAADxDAAgL7wHAACUDAAwvQcAAM0HABC-BwAAlAwAML8HAQDFCwAhwAcBAMULACHEBwEA1AsAIcUHQADHCwAhxgdAAMcLACHcBwAA4AsAIIoIAQDUCwAhqggBANQLACGxCAEA1AsAIckIAQDFCwAh8ggBANQLACH9CAIA1QsAIf4ICACLDAAh_wgCANULACGBCQIA1QsAIYIJQADsCwAhgwlAAOwLACGECQEA1AsAIYUJAgDVCwAhhgkCANULACGHCUAA7AsAIYgJQADsCwAhiQkBANQLACGKCQEA1AsAIYsJAQDUCwAhjAkBANQLACGNCQEA1AsAIY4JAQDUCwAhjwlAAOwLACGQCQIA1QsAIZEJAQDUCwAhkgkBANQLACGTCQEA1AsAIZQJAQDUCwAhlQkBANQLACGWCQEA1AsAIZcJAQDUCwAhmAkBANQLACGZCQEA1AsAIZoJAQDUCwAhmwkBANQLACGcCQEA1AsAIZ0JAQDUCwAhngkAAOALACADAAAAugcAIAMAAMwHADAUAADNBwAgAwAAALoHACADAAC7BwAwBAAAtwcAIBG8BwAAkgwAML0HAADTBwAQvgcAAJIMADC_BwEAAAAB3AcAAOYLACCaCAEA3AsAIboIAgDRCwAh-ggBANALACH7CAgAkwwAIfwIAgDRCwAh_QgCANELACH-CAgAjgwAIf8IAgDRCwAhgAkCANELACGBCQIA0QsAIYIJQADwCwAhgwlAAPALACEBAAAA0AcAIAEAAADQBwAgEbwHAACSDAAwvQcAANMHABC-BwAAkgwAML8HAQDQCwAh3AcAAOYLACCaCAEA3AsAIboIAgDRCwAh-ggBANALACH7CAgAkwwAIfwIAgDRCwAh_QgCANELACH-CAgAjgwAIf8IAgDRCwAhgAkCANELACGBCQIA0QsAIYIJQADwCwAhgwlAAPALACEF3AcAAPEMACCaCAAA8QwAIP4IAADxDAAgggkAAPEMACCDCQAA8QwAIAMAAADTBwAgAwAA1AcAMAQAANAHACADAAAA0wcAIAMAANQHADAEAADQBwAgAwAAANMHACADAADUBwAwBAAA0AcAIA6_BwEAAAAB3AeAAAAAAZoIAQAAAAG6CAIAAAAB-ggBAAAAAfsICAAAAAH8CAIAAAAB_QgCAAAAAf4ICAAAAAH_CAIAAAABgAkCAAAAAYEJAgAAAAGCCUAAAAABgwlAAAAAAQEIAADYBwAgDr8HAQAAAAHcB4AAAAABmggBAAAAAboIAgAAAAH6CAEAAAAB-wgIAAAAAfwIAgAAAAH9CAIAAAAB_ggIAAAAAf8IAgAAAAGACQIAAAABgQkCAAAAAYIJQAAAAAGDCUAAAAABAQgAANoHADABCAAA2gcAMA6_BwEA7gwAIdwHgAAAAAGaCAEA9wwAIboIAgDvDAAh-ggBAO4MACH7CAgAyg0AIfwIAgDvDAAh_QgCAO8MACH-CAgAxA0AIf8IAgDvDAAhgAkCAO8MACGBCQIA7wwAIYIJQACODQAhgwlAAI4NACECAAAA0AcAIAgAAN0HACAOvwcBAO4MACHcB4AAAAABmggBAPcMACG6CAIA7wwAIfoIAQDuDAAh-wgIAMoNACH8CAIA7wwAIf0IAgDvDAAh_ggIAMQNACH_CAIA7wwAIYAJAgDvDAAhgQkCAO8MACGCCUAAjg0AIYMJQACODQAhAgAAANMHACAIAADfBwAgAgAAANMHACAIAADfBwAgAwAAANAHACAPAADYBwAgEAAA3QcAIAEAAADQBwAgAQAAANMHACAKFQAAxQ0AIBYAAMYNACAXAADJDQAgGAAAyA0AIBkAAMcNACDcBwAA8QwAIJoIAADxDAAg_ggAAPEMACCCCQAA8QwAIIMJAADxDAAgEbwHAACPDAAwvQcAAOYHABC-BwAAjwwAML8HAQDFCwAh3AcAAOALACCaCAEA1AsAIboIAgDGCwAh-ggBAMULACH7CAgAkAwAIfwIAgDGCwAh_QgCAMYLACH-CAgAiwwAIf8IAgDGCwAhgAkCAMYLACGBCQIAxgsAIYIJQADsCwAhgwlAAOwLACEDAAAA0wcAIAMAAOUHADAUAADmBwAgAwAAANMHACADAADUBwAwBAAA0AcAICu8BwAAjQwAML0HAADsBwAQvgcAAI0MADC_BwEAAAABxQdAANILACHGB0AA0gsAIdsHIADlCwAh3AcAAOYLACCDCAEA0AsAIdgIAQDQCwAh2QgBANALACHaCAEA3AsAIdsIAQDcCwAh3AgBANwLACHdCAEA3AsAId4IAQDcCwAh3wgBANwLACHgCAEA3AsAIeEIAQDcCwAh4ggBANwLACHjCAEA3AsAIeQIAQDQCwAh5QgBANwLACHmCAEA0AsAIecIAQDQCwAh6AgBANALACHpCAEA3AsAIeoIAQDcCwAh6wgBANwLACHsCAEA3AsAIe0IAQDcCwAh7ggBANwLACHvCAIA0QsAIfAIAQDcCwAh8QgCANELACHyCAEA0AsAIfMICACODAAh9AgBANALACH1CAEA0AsAIfYIAgDRCwAh9wgCANELACH4CAEA3AsAIfkIAQDcCwAhAQAAAOkHACABAAAA6QcAICu8BwAAjQwAML0HAADsBwAQvgcAAI0MADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHbByAA5QsAIdwHAADmCwAggwgBANALACHYCAEA0AsAIdkIAQDQCwAh2ggBANwLACHbCAEA3AsAIdwIAQDcCwAh3QgBANwLACHeCAEA3AsAId8IAQDcCwAh4AgBANwLACHhCAEA3AsAIeIIAQDcCwAh4wgBANwLACHkCAEA0AsAIeUIAQDcCwAh5ggBANALACHnCAEA0AsAIegIAQDQCwAh6QgBANwLACHqCAEA3AsAIesIAQDcCwAh7AgBANwLACHtCAEA3AsAIe4IAQDcCwAh7wgCANELACHwCAEA3AsAIfEIAgDRCwAh8ggBANALACHzCAgAjgwAIfQIAQDQCwAh9QgBANALACH2CAIA0QsAIfcIAgDRCwAh-AgBANwLACH5CAEA3AsAIRbcBwAA8QwAINoIAADxDAAg2wgAAPEMACDcCAAA8QwAIN0IAADxDAAg3ggAAPEMACDfCAAA8QwAIOAIAADxDAAg4QgAAPEMACDiCAAA8QwAIOMIAADxDAAg5QgAAPEMACDpCAAA8QwAIOoIAADxDAAg6wgAAPEMACDsCAAA8QwAIO0IAADxDAAg7ggAAPEMACDwCAAA8QwAIPMIAADxDAAg-AgAAPEMACD5CAAA8QwAIAMAAADsBwAgAwAA7QcAMAQAAOkHACADAAAA7AcAIAMAAO0HADAEAADpBwAgAwAAAOwHACADAADtBwAwBAAA6QcAICi_BwEAAAABxQdAAAAAAcYHQAAAAAHbByAAAAAB3AeAAAAAAYMIAQAAAAHYCAEAAAAB2QgBAAAAAdoIAQAAAAHbCAEAAAAB3AgBAAAAAd0IAQAAAAHeCAEAAAAB3wgBAAAAAeAIAQAAAAHhCAEAAAAB4ggBAAAAAeMIAQAAAAHkCAEAAAAB5QgBAAAAAeYIAQAAAAHnCAEAAAAB6AgBAAAAAekIAQAAAAHqCAEAAAAB6wgBAAAAAewIAQAAAAHtCAEAAAAB7ggBAAAAAe8IAgAAAAHwCAEAAAAB8QgCAAAAAfIIAQAAAAHzCAgAAAAB9AgBAAAAAfUIAQAAAAH2CAIAAAAB9wgCAAAAAfgIAQAAAAH5CAEAAAABAQgAAPEHACAovwcBAAAAAcUHQAAAAAHGB0AAAAAB2wcgAAAAAdwHgAAAAAGDCAEAAAAB2AgBAAAAAdkIAQAAAAHaCAEAAAAB2wgBAAAAAdwIAQAAAAHdCAEAAAAB3ggBAAAAAd8IAQAAAAHgCAEAAAAB4QgBAAAAAeIIAQAAAAHjCAEAAAAB5AgBAAAAAeUIAQAAAAHmCAEAAAAB5wgBAAAAAegIAQAAAAHpCAEAAAAB6ggBAAAAAesIAQAAAAHsCAEAAAAB7QgBAAAAAe4IAQAAAAHvCAIAAAAB8AgBAAAAAfEIAgAAAAHyCAEAAAAB8wgIAAAAAfQIAQAAAAH1CAEAAAAB9ggCAAAAAfcIAgAAAAH4CAEAAAAB-QgBAAAAAQEIAADzBwAwAQgAAPMHADAovwcBAO4MACHFB0AA8AwAIcYHQADwDAAh2wcgAP4MACHcB4AAAAABgwgBAO4MACHYCAEA7gwAIdkIAQDuDAAh2ggBAPcMACHbCAEA9wwAIdwIAQD3DAAh3QgBAPcMACHeCAEA9wwAId8IAQD3DAAh4AgBAPcMACHhCAEA9wwAIeIIAQD3DAAh4wgBAPcMACHkCAEA7gwAIeUIAQD3DAAh5ggBAO4MACHnCAEA7gwAIegIAQDuDAAh6QgBAPcMACHqCAEA9wwAIesIAQD3DAAh7AgBAPcMACHtCAEA9wwAIe4IAQD3DAAh7wgCAO8MACHwCAEA9wwAIfEIAgDvDAAh8ggBAO4MACHzCAgAxA0AIfQIAQDuDAAh9QgBAO4MACH2CAIA7wwAIfcIAgDvDAAh-AgBAPcMACH5CAEA9wwAIQIAAADpBwAgCAAA9gcAICi_BwEA7gwAIcUHQADwDAAhxgdAAPAMACHbByAA_gwAIdwHgAAAAAGDCAEA7gwAIdgIAQDuDAAh2QgBAO4MACHaCAEA9wwAIdsIAQD3DAAh3AgBAPcMACHdCAEA9wwAId4IAQD3DAAh3wgBAPcMACHgCAEA9wwAIeEIAQD3DAAh4ggBAPcMACHjCAEA9wwAIeQIAQDuDAAh5QgBAPcMACHmCAEA7gwAIecIAQDuDAAh6AgBAO4MACHpCAEA9wwAIeoIAQD3DAAh6wgBAPcMACHsCAEA9wwAIe0IAQD3DAAh7ggBAPcMACHvCAIA7wwAIfAIAQD3DAAh8QgCAO8MACHyCAEA7gwAIfMICADEDQAh9AgBAO4MACH1CAEA7gwAIfYIAgDvDAAh9wgCAO8MACH4CAEA9wwAIfkIAQD3DAAhAgAAAOwHACAIAAD4BwAgAgAAAOwHACAIAAD4BwAgAwAAAOkHACAPAADxBwAgEAAA9gcAIAEAAADpBwAgAQAAAOwHACAbFQAAvw0AIBYAAMANACAXAADDDQAgGAAAwg0AIBkAAMENACDcBwAA8QwAINoIAADxDAAg2wgAAPEMACDcCAAA8QwAIN0IAADxDAAg3ggAAPEMACDfCAAA8QwAIOAIAADxDAAg4QgAAPEMACDiCAAA8QwAIOMIAADxDAAg5QgAAPEMACDpCAAA8QwAIOoIAADxDAAg6wgAAPEMACDsCAAA8QwAIO0IAADxDAAg7ggAAPEMACDwCAAA8QwAIPMIAADxDAAg-AgAAPEMACD5CAAA8QwAICu8BwAAigwAML0HAAD_BwAQvgcAAIoMADC_BwEAxQsAIcUHQADHCwAhxgdAAMcLACHbByAA3wsAIdwHAADgCwAggwgBAMULACHYCAEAxQsAIdkIAQDFCwAh2ggBANQLACHbCAEA1AsAIdwIAQDUCwAh3QgBANQLACHeCAEA1AsAId8IAQDUCwAh4AgBANQLACHhCAEA1AsAIeIIAQDUCwAh4wgBANQLACHkCAEAxQsAIeUIAQDUCwAh5ggBAMULACHnCAEAxQsAIegIAQDFCwAh6QgBANQLACHqCAEA1AsAIesIAQDUCwAh7AgBANQLACHtCAEA1AsAIe4IAQDUCwAh7wgCAMYLACHwCAEA1AsAIfEIAgDGCwAh8ggBAMULACHzCAgAiwwAIfQIAQDFCwAh9QgBAMULACH2CAIAxgsAIfcIAgDGCwAh-AgBANQLACH5CAEA1AsAIQMAAADsBwAgAwAA_gcAMBQAAP8HACADAAAA7AcAIAMAAO0HADAEAADpBwAgFrwHAACJDAAwvQcAAIUIABC-BwAAiQwAML8HAQAAAAHFB0AA0gsAIcYHQADSCwAh1wcBANALACHbByAA5QsAIdwHAADmCwAglwgBANALACGxCAEA0AsAIc0IAQDcCwAhzggBANwLACHPCAEA3AsAIdAIAQDcCwAh0QggAOULACHSCCAA5QsAIdMIIADlCwAh1AggAOULACHVCAEA3AsAIdYIAQDcCwAh1wgBANwLACEBAAAAgggAIAEAAACCCAAgFrwHAACJDAAwvQcAAIUIABC-BwAAiQwAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIdcHAQDQCwAh2wcgAOULACHcBwAA5gsAIJcIAQDQCwAhsQgBANALACHNCAEA3AsAIc4IAQDcCwAhzwgBANwLACHQCAEA3AsAIdEIIADlCwAh0gggAOULACHTCCAA5QsAIdQIIADlCwAh1QgBANwLACHWCAEA3AsAIdcIAQDcCwAhCNwHAADxDAAgzQgAAPEMACDOCAAA8QwAIM8IAADxDAAg0AgAAPEMACDVCAAA8QwAINYIAADxDAAg1wgAAPEMACADAAAAhQgAIAMAAIYIADAEAACCCAAgAwAAAIUIACADAACGCAAwBAAAgggAIAMAAACFCAAgAwAAhggAMAQAAIIIACATvwcBAAAAAcUHQAAAAAHGB0AAAAAB1wcBAAAAAdsHIAAAAAHcB4AAAAABlwgBAAAAAbEIAQAAAAHNCAEAAAABzggBAAAAAc8IAQAAAAHQCAEAAAAB0QggAAAAAdIIIAAAAAHTCCAAAAAB1AggAAAAAdUIAQAAAAHWCAEAAAAB1wgBAAAAAQEIAACKCAAgE78HAQAAAAHFB0AAAAABxgdAAAAAAdcHAQAAAAHbByAAAAAB3AeAAAAAAZcIAQAAAAGxCAEAAAABzQgBAAAAAc4IAQAAAAHPCAEAAAAB0AgBAAAAAdEIIAAAAAHSCCAAAAAB0wggAAAAAdQIIAAAAAHVCAEAAAAB1ggBAAAAAdcIAQAAAAEBCAAAjAgAMAEIAACMCAAwE78HAQDuDAAhxQdAAPAMACHGB0AA8AwAIdcHAQDuDAAh2wcgAP4MACHcB4AAAAABlwgBAO4MACGxCAEA7gwAIc0IAQD3DAAhzggBAPcMACHPCAEA9wwAIdAIAQD3DAAh0QggAP4MACHSCCAA_gwAIdMIIAD-DAAh1AggAP4MACHVCAEA9wwAIdYIAQD3DAAh1wgBAPcMACECAAAAgggAIAgAAI8IACATvwcBAO4MACHFB0AA8AwAIcYHQADwDAAh1wcBAO4MACHbByAA_gwAIdwHgAAAAAGXCAEA7gwAIbEIAQDuDAAhzQgBAPcMACHOCAEA9wwAIc8IAQD3DAAh0AgBAPcMACHRCCAA_gwAIdIIIAD-DAAh0wggAP4MACHUCCAA_gwAIdUIAQD3DAAh1ggBAPcMACHXCAEA9wwAIQIAAACFCAAgCAAAkQgAIAIAAACFCAAgCAAAkQgAIAMAAACCCAAgDwAAiggAIBAAAI8IACABAAAAgggAIAEAAACFCAAgCxUAALwNACAYAAC-DQAgGQAAvQ0AINwHAADxDAAgzQgAAPEMACDOCAAA8QwAIM8IAADxDAAg0AgAAPEMACDVCAAA8QwAINYIAADxDAAg1wgAAPEMACAWvAcAAIgMADC9BwAAmAgAEL4HAACIDAAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAh1wcBAMULACHbByAA3wsAIdwHAADgCwAglwgBAMULACGxCAEAxQsAIc0IAQDUCwAhzggBANQLACHPCAEA1AsAIdAIAQDUCwAh0QggAN8LACHSCCAA3wsAIdMIIADfCwAh1AggAN8LACHVCAEA1AsAIdYIAQDUCwAh1wgBANQLACEDAAAAhQgAIAMAAJcIADAUAACYCAAgAwAAAIUIACADAACGCAAwBAAAgggAIAu8BwAAhwwAML0HAACeCAAQvgcAAIcMADC_BwEAAAABwAcBANwLACHFB0AA0gsAIdwHAADmCwAgyQgBANALACHKCAEA3AsAIcsIAQDcCwAhzAhAAPALACEBAAAAmwgAIAEAAACbCAAgC7wHAACHDAAwvQcAAJ4IABC-BwAAhwwAML8HAQDQCwAhwAcBANwLACHFB0AA0gsAIdwHAADmCwAgyQgBANALACHKCAEA3AsAIcsIAQDcCwAhzAhAAPALACEFwAcAAPEMACDcBwAA8QwAIMoIAADxDAAgywgAAPEMACDMCAAA8QwAIAMAAACeCAAgAwAAnwgAMAQAAJsIACADAAAAnggAIAMAAJ8IADAEAACbCAAgAwAAAJ4IACADAACfCAAwBAAAmwgAIAi_BwEAAAABwAcBAAAAAcUHQAAAAAHcB4AAAAAByQgBAAAAAcoIAQAAAAHLCAEAAAABzAhAAAAAAQEIAACjCAAgCL8HAQAAAAHABwEAAAABxQdAAAAAAdwHgAAAAAHJCAEAAAAByggBAAAAAcsIAQAAAAHMCEAAAAABAQgAAKUIADABCAAApQgAMAi_BwEA7gwAIcAHAQD3DAAhxQdAAPAMACHcB4AAAAAByQgBAO4MACHKCAEA9wwAIcsIAQD3DAAhzAhAAI4NACECAAAAmwgAIAgAAKgIACAIvwcBAO4MACHABwEA9wwAIcUHQADwDAAh3AeAAAAAAckIAQDuDAAhyggBAPcMACHLCAEA9wwAIcwIQACODQAhAgAAAJ4IACAIAACqCAAgAgAAAJ4IACAIAACqCAAgAwAAAJsIACAPAACjCAAgEAAAqAgAIAEAAACbCAAgAQAAAJ4IACAIFQAAuQ0AIBgAALsNACAZAAC6DQAgwAcAAPEMACDcBwAA8QwAIMoIAADxDAAgywgAAPEMACDMCAAA8QwAIAu8BwAAhgwAML0HAACxCAAQvgcAAIYMADC_BwEAxQsAIcAHAQDUCwAhxQdAAMcLACHcBwAA4AsAIMkIAQDFCwAhyggBANQLACHLCAEA1AsAIcwIQADsCwAhAwAAAJ4IACADAACwCAAwFAAAsQgAIAMAAACeCAAgAwAAnwgAMAQAAJsIACAdvAcAAIUMADC9BwAAtwgAEL4HAACFDAAwvwcBAAAAAcUHQADSCwAhxgdAANILACHXBwEA3AsAIdsHIADlCwAh3AcAAOYLACCaCAEA3AsAIaYIIADlCwAhrQgBAAAAAbEIAQDQCwAhuQggAOULACG6CAIA0QsAIbsIAgDdCwAhvAgCAN0LACG9CAIA3QsAIb4IAgDdCwAhvwgCAN0LACHACCAA5QsAIcEIIADlCwAhwgggAOULACHDCCAA5QsAIcQIAQDcCwAhxQgAAOYLACDGCAEA3AsAIccIAQDcCwAhyAgBANwLACEBAAAAtAgAIAEAAAC0CAAgHbwHAACFDAAwvQcAALcIABC-BwAAhQwAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIdcHAQDcCwAh2wcgAOULACHcBwAA5gsAIJoIAQDcCwAhpgggAOULACGtCAEA0AsAIbEIAQDQCwAhuQggAOULACG6CAIA0QsAIbsIAgDdCwAhvAgCAN0LACG9CAIA3QsAIb4IAgDdCwAhvwgCAN0LACHACCAA5QsAIcEIIADlCwAhwgggAOULACHDCCAA5QsAIcQIAQDcCwAhxQgAAOYLACDGCAEA3AsAIccIAQDcCwAhyAgBANwLACEN1wcAAPEMACDcBwAA8QwAIJoIAADxDAAguwgAAPEMACC8CAAA8QwAIL0IAADxDAAgvggAAPEMACC_CAAA8QwAIMQIAADxDAAgxQgAAPEMACDGCAAA8QwAIMcIAADxDAAgyAgAAPEMACADAAAAtwgAIAMAALgIADAEAAC0CAAgAwAAALcIACADAAC4CAAwBAAAtAgAIAMAAAC3CAAgAwAAuAgAMAQAALQIACAavwcBAAAAAcUHQAAAAAHGB0AAAAAB1wcBAAAAAdsHIAAAAAHcB4AAAAABmggBAAAAAaYIIAAAAAGtCAEAAAABsQgBAAAAAbkIIAAAAAG6CAIAAAABuwgCAAAAAbwIAgAAAAG9CAIAAAABvggCAAAAAb8IAgAAAAHACCAAAAABwQggAAAAAcIIIAAAAAHDCCAAAAABxAgBAAAAAcUIgAAAAAHGCAEAAAABxwgBAAAAAcgIAQAAAAEBCAAAvAgAIBq_BwEAAAABxQdAAAAAAcYHQAAAAAHXBwEAAAAB2wcgAAAAAdwHgAAAAAGaCAEAAAABpgggAAAAAa0IAQAAAAGxCAEAAAABuQggAAAAAboIAgAAAAG7CAIAAAABvAgCAAAAAb0IAgAAAAG-CAIAAAABvwgCAAAAAcAIIAAAAAHBCCAAAAABwgggAAAAAcMIIAAAAAHECAEAAAABxQiAAAAAAcYIAQAAAAHHCAEAAAAByAgBAAAAAQEIAAC-CAAwAQgAAL4IADAavwcBAO4MACHFB0AA8AwAIcYHQADwDAAh1wcBAPcMACHbByAA_gwAIdwHgAAAAAGaCAEA9wwAIaYIIAD-DAAhrQgBAO4MACGxCAEA7gwAIbkIIAD-DAAhuggCAO8MACG7CAIA-AwAIbwIAgD4DAAhvQgCAPgMACG-CAIA-AwAIb8IAgD4DAAhwAggAP4MACHBCCAA_gwAIcIIIAD-DAAhwwggAP4MACHECAEA9wwAIcUIgAAAAAHGCAEA9wwAIccIAQD3DAAhyAgBAPcMACECAAAAtAgAIAgAAMEIACAavwcBAO4MACHFB0AA8AwAIcYHQADwDAAh1wcBAPcMACHbByAA_gwAIdwHgAAAAAGaCAEA9wwAIaYIIAD-DAAhrQgBAO4MACGxCAEA7gwAIbkIIAD-DAAhuggCAO8MACG7CAIA-AwAIbwIAgD4DAAhvQgCAPgMACG-CAIA-AwAIb8IAgD4DAAhwAggAP4MACHBCCAA_gwAIcIIIAD-DAAhwwggAP4MACHECAEA9wwAIcUIgAAAAAHGCAEA9wwAIccIAQD3DAAhyAgBAPcMACECAAAAtwgAIAgAAMMIACACAAAAtwgAIAgAAMMIACADAAAAtAgAIA8AALwIACAQAADBCAAgAQAAALQIACABAAAAtwgAIBIVAAC0DQAgFgAAtQ0AIBcAALgNACAYAAC3DQAgGQAAtg0AINcHAADxDAAg3AcAAPEMACCaCAAA8QwAILsIAADxDAAgvAgAAPEMACC9CAAA8QwAIL4IAADxDAAgvwgAAPEMACDECAAA8QwAIMUIAADxDAAgxggAAPEMACDHCAAA8QwAIMgIAADxDAAgHbwHAACEDAAwvQcAAMoIABC-BwAAhAwAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIdcHAQDUCwAh2wcgAN8LACHcBwAA4AsAIJoIAQDUCwAhpgggAN8LACGtCAEAxQsAIbEIAQDFCwAhuQggAN8LACG6CAIAxgsAIbsIAgDVCwAhvAgCANULACG9CAIA1QsAIb4IAgDVCwAhvwgCANULACHACCAA3wsAIcEIIADfCwAhwgggAN8LACHDCCAA3wsAIcQIAQDUCwAhxQgAAOALACDGCAEA1AsAIccIAQDUCwAhyAgBANQLACEDAAAAtwgAIAMAAMkIADAUAADKCAAgAwAAALcIACADAAC4CAAwBAAAtAgAIBi8BwAAgwwAML0HAADQCAAQvgcAAIMMADC_BwEAAAABxQdAANILACHGB0AA0gsAIdcHAQDcCwAh3AcAAOYLACCaCAEA3AsAIaAIQADwCwAhpgggAOULACGsCEAA8AsAIa0IAQAAAAGuCAEA3AsAIa8IAgDdCwAhsAgCAN0LACGxCAEA0AsAIbIIAgDdCwAhswgBANwLACG0CAEA3AsAIbUIAgDdCwAhtggCANELACG3CAEA3AsAIbgIAQDcCwAhAQAAAM0IACABAAAAzQgAIBi8BwAAgwwAML0HAADQCAAQvgcAAIMMADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHXBwEA3AsAIdwHAADmCwAgmggBANwLACGgCEAA8AsAIaYIIADlCwAhrAhAAPALACGtCAEA0AsAIa4IAQDcCwAhrwgCAN0LACGwCAIA3QsAIbEIAQDQCwAhsggCAN0LACGzCAEA3AsAIbQIAQDcCwAhtQgCAN0LACG2CAIA0QsAIbcIAQDcCwAhuAgBANwLACEO1wcAAPEMACDcBwAA8QwAIJoIAADxDAAgoAgAAPEMACCsCAAA8QwAIK4IAADxDAAgrwgAAPEMACCwCAAA8QwAILIIAADxDAAgswgAAPEMACC0CAAA8QwAILUIAADxDAAgtwgAAPEMACC4CAAA8QwAIAMAAADQCAAgAwAA0QgAMAQAAM0IACADAAAA0AgAIAMAANEIADAEAADNCAAgAwAAANAIACADAADRCAAwBAAAzQgAIBW_BwEAAAABxQdAAAAAAcYHQAAAAAHXBwEAAAAB3AeAAAAAAZoIAQAAAAGgCEAAAAABpgggAAAAAawIQAAAAAGtCAEAAAABrggBAAAAAa8IAgAAAAGwCAIAAAABsQgBAAAAAbIIAgAAAAGzCAEAAAABtAgBAAAAAbUIAgAAAAG2CAIAAAABtwgBAAAAAbgIAQAAAAEBCAAA1QgAIBW_BwEAAAABxQdAAAAAAcYHQAAAAAHXBwEAAAAB3AeAAAAAAZoIAQAAAAGgCEAAAAABpgggAAAAAawIQAAAAAGtCAEAAAABrggBAAAAAa8IAgAAAAGwCAIAAAABsQgBAAAAAbIIAgAAAAGzCAEAAAABtAgBAAAAAbUIAgAAAAG2CAIAAAABtwgBAAAAAbgIAQAAAAEBCAAA1wgAMAEIAADXCAAwFb8HAQDuDAAhxQdAAPAMACHGB0AA8AwAIdcHAQD3DAAh3AeAAAAAAZoIAQD3DAAhoAhAAI4NACGmCCAA_gwAIawIQACODQAhrQgBAO4MACGuCAEA9wwAIa8IAgD4DAAhsAgCAPgMACGxCAEA7gwAIbIIAgD4DAAhswgBAPcMACG0CAEA9wwAIbUIAgD4DAAhtggCAO8MACG3CAEA9wwAIbgIAQD3DAAhAgAAAM0IACAIAADaCAAgFb8HAQDuDAAhxQdAAPAMACHGB0AA8AwAIdcHAQD3DAAh3AeAAAAAAZoIAQD3DAAhoAhAAI4NACGmCCAA_gwAIawIQACODQAhrQgBAO4MACGuCAEA9wwAIa8IAgD4DAAhsAgCAPgMACGxCAEA7gwAIbIIAgD4DAAhswgBAPcMACG0CAEA9wwAIbUIAgD4DAAhtggCAO8MACG3CAEA9wwAIbgIAQD3DAAhAgAAANAIACAIAADcCAAgAgAAANAIACAIAADcCAAgAwAAAM0IACAPAADVCAAgEAAA2ggAIAEAAADNCAAgAQAAANAIACATFQAArw0AIBYAALANACAXAACzDQAgGAAAsg0AIBkAALENACDXBwAA8QwAINwHAADxDAAgmggAAPEMACCgCAAA8QwAIKwIAADxDAAgrggAAPEMACCvCAAA8QwAILAIAADxDAAgsggAAPEMACCzCAAA8QwAILQIAADxDAAgtQgAAPEMACC3CAAA8QwAILgIAADxDAAgGLwHAACCDAAwvQcAAOMIABC-BwAAggwAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIdcHAQDUCwAh3AcAAOALACCaCAEA1AsAIaAIQADsCwAhpgggAN8LACGsCEAA7AsAIa0IAQDFCwAhrggBANQLACGvCAIA1QsAIbAIAgDVCwAhsQgBAMULACGyCAIA1QsAIbMIAQDUCwAhtAgBANQLACG1CAIA1QsAIbYIAgDGCwAhtwgBANQLACG4CAEA1AsAIQMAAADQCAAgAwAA4ggAMBQAAOMIACADAAAA0AgAIAMAANEIADAEAADNCAAgC7wHAACBDAAwvQcAAOkIABC-BwAAgQwAML8HAQAAAAHABwEA0AsAIdwHAADmCwAgqAgBANALACGpCAIA3QsAIaoIAQDcCwAhqwhAANILACGsCEAA8AsAIQEAAADmCAAgAQAAAOYIACALvAcAAIEMADC9BwAA6QgAEL4HAACBDAAwvwcBANALACHABwEA0AsAIdwHAADmCwAgqAgBANALACGpCAIA3QsAIaoIAQDcCwAhqwhAANILACGsCEAA8AsAIQTcBwAA8QwAIKkIAADxDAAgqggAAPEMACCsCAAA8QwAIAMAAADpCAAgAwAA6ggAMAQAAOYIACADAAAA6QgAIAMAAOoIADAEAADmCAAgAwAAAOkIACADAADqCAAwBAAA5ggAIAi_BwEAAAABwAcBAAAAAdwHgAAAAAGoCAEAAAABqQgCAAAAAaoIAQAAAAGrCEAAAAABrAhAAAAAAQEIAADuCAAgCL8HAQAAAAHABwEAAAAB3AeAAAAAAagIAQAAAAGpCAIAAAABqggBAAAAAasIQAAAAAGsCEAAAAABAQgAAPAIADABCAAA8AgAMAi_BwEA7gwAIcAHAQDuDAAh3AeAAAAAAagIAQDuDAAhqQgCAPgMACGqCAEA9wwAIasIQADwDAAhrAhAAI4NACECAAAA5ggAIAgAAPMIACAIvwcBAO4MACHABwEA7gwAIdwHgAAAAAGoCAEA7gwAIakIAgD4DAAhqggBAPcMACGrCEAA8AwAIawIQACODQAhAgAAAOkIACAIAAD1CAAgAgAAAOkIACAIAAD1CAAgAwAAAOYIACAPAADuCAAgEAAA8wgAIAEAAADmCAAgAQAAAOkIACAJFQAAqg0AIBYAAKsNACAXAACuDQAgGAAArQ0AIBkAAKwNACDcBwAA8QwAIKkIAADxDAAgqggAAPEMACCsCAAA8QwAIAu8BwAAgAwAML0HAAD8CAAQvgcAAIAMADC_BwEAxQsAIcAHAQDFCwAh3AcAAOALACCoCAEAxQsAIakIAgDVCwAhqggBANQLACGrCEAAxwsAIawIQADsCwAhAwAAAOkIACADAAD7CAAwFAAA_AgAIAMAAADpCAAgAwAA6ggAMAQAAOYIACASvAcAAP8LADC9BwAAggkAEL4HAAD_CwAwvwcBAAAAAcAHAQDQCwAhxQdAANILACHGB0AA0gsAIdwHAADmCwAgnggBANALACGfCAEA0AsAIaAIQADSCwAhoQhAAPALACGiCAIA3QsAIaMIAQDcCwAhpAgBANwLACGlCAIA3QsAIaYIIADlCwAhpwgAAOYLACABAAAA_wgAIAEAAAD_CAAgErwHAAD_CwAwvQcAAIIJABC-BwAA_wsAML8HAQDQCwAhwAcBANALACHFB0AA0gsAIcYHQADSCwAh3AcAAOYLACCeCAEA0AsAIZ8IAQDQCwAhoAhAANILACGhCEAA8AsAIaIIAgDdCwAhowgBANwLACGkCAEA3AsAIaUIAgDdCwAhpgggAOULACGnCAAA5gsAIAfcBwAA8QwAIKEIAADxDAAgoggAAPEMACCjCAAA8QwAIKQIAADxDAAgpQgAAPEMACCnCAAA8QwAIAMAAACCCQAgAwAAgwkAMAQAAP8IACADAAAAggkAIAMAAIMJADAEAAD_CAAgAwAAAIIJACADAACDCQAwBAAA_wgAIA-_BwEAAAABwAcBAAAAAcUHQAAAAAHGB0AAAAAB3AeAAAAAAZ4IAQAAAAGfCAEAAAABoAhAAAAAAaEIQAAAAAGiCAIAAAABowgBAAAAAaQIAQAAAAGlCAIAAAABpgggAAAAAacIgAAAAAEBCAAAhwkAIA-_BwEAAAABwAcBAAAAAcUHQAAAAAHGB0AAAAAB3AeAAAAAAZ4IAQAAAAGfCAEAAAABoAhAAAAAAaEIQAAAAAGiCAIAAAABowgBAAAAAaQIAQAAAAGlCAIAAAABpgggAAAAAacIgAAAAAEBCAAAiQkAMAEIAACJCQAwD78HAQDuDAAhwAcBAO4MACHFB0AA8AwAIcYHQADwDAAh3AeAAAAAAZ4IAQDuDAAhnwgBAO4MACGgCEAA8AwAIaEIQACODQAhoggCAPgMACGjCAEA9wwAIaQIAQD3DAAhpQgCAPgMACGmCCAA_gwAIacIgAAAAAECAAAA_wgAIAgAAIwJACAPvwcBAO4MACHABwEA7gwAIcUHQADwDAAhxgdAAPAMACHcB4AAAAABnggBAO4MACGfCAEA7gwAIaAIQADwDAAhoQhAAI4NACGiCAIA-AwAIaMIAQD3DAAhpAgBAPcMACGlCAIA-AwAIaYIIAD-DAAhpwiAAAAAAQIAAACCCQAgCAAAjgkAIAIAAACCCQAgCAAAjgkAIAMAAAD_CAAgDwAAhwkAIBAAAIwJACABAAAA_wgAIAEAAACCCQAgDBUAAKUNACAWAACmDQAgFwAAqQ0AIBgAAKgNACAZAACnDQAg3AcAAPEMACChCAAA8QwAIKIIAADxDAAgowgAAPEMACCkCAAA8QwAIKUIAADxDAAgpwgAAPEMACASvAcAAP4LADC9BwAAlQkAEL4HAAD-CwAwvwcBAMULACHABwEAxQsAIcUHQADHCwAhxgdAAMcLACHcBwAA4AsAIJ4IAQDFCwAhnwgBAMULACGgCEAAxwsAIaEIQADsCwAhoggCANULACGjCAEA1AsAIaQIAQDUCwAhpQgCANULACGmCCAA3wsAIacIAADgCwAgAwAAAIIJACADAACUCQAwFAAAlQkAIAMAAACCCQAgAwAAgwkAMAQAAP8IACAKvAcAAP0LADC9BwAAmwkAEL4HAAD9CwAwvwcBAAAAAcUHQADSCwAhxgdAANILACHXBwEA0AsAIdsHIADlCwAh3AcAAOYLACCdCAEA0AsAIQEAAACYCQAgAQAAAJgJACAKvAcAAP0LADC9BwAAmwkAEL4HAAD9CwAwvwcBANALACHFB0AA0gsAIcYHQADSCwAh1wcBANALACHbByAA5QsAIdwHAADmCwAgnQgBANALACEB3AcAAPEMACADAAAAmwkAIAMAAJwJADAEAACYCQAgAwAAAJsJACADAACcCQAwBAAAmAkAIAMAAACbCQAgAwAAnAkAMAQAAJgJACAHvwcBAAAAAcUHQAAAAAHGB0AAAAAB1wcBAAAAAdsHIAAAAAHcB4AAAAABnQgBAAAAAQEIAACgCQAgB78HAQAAAAHFB0AAAAABxgdAAAAAAdcHAQAAAAHbByAAAAAB3AeAAAAAAZ0IAQAAAAEBCAAAogkAMAEIAACiCQAwB78HAQDuDAAhxQdAAPAMACHGB0AA8AwAIdcHAQDuDAAh2wcgAP4MACHcB4AAAAABnQgBAO4MACECAAAAmAkAIAgAAKUJACAHvwcBAO4MACHFB0AA8AwAIcYHQADwDAAh1wcBAO4MACHbByAA_gwAIdwHgAAAAAGdCAEA7gwAIQIAAACbCQAgCAAApwkAIAIAAACbCQAgCAAApwkAIAMAAACYCQAgDwAAoAkAIBAAAKUJACABAAAAmAkAIAEAAACbCQAgBBUAAKINACAYAACkDQAgGQAAow0AINwHAADxDAAgCrwHAAD8CwAwvQcAAK4JABC-BwAA_AsAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIdcHAQDFCwAh2wcgAN8LACHcBwAA4AsAIJ0IAQDFCwAhAwAAAJsJACADAACtCQAwFAAArgkAIAMAAACbCQAgAwAAnAkAMAQAAJgJACATvAcAAPsLADC9BwAAtAkAEL4HAAD7CwAwvwcBAAAAAcUHQADSCwAhxgdAANILACHUBwEA0AsAIdcHAQDQCwAh3AcAAOYLACDvBwEA0AsAIf4HAQDQCwAhjggBANwLACGWCAEAAAABlwgBANALACGYCCAA5QsAIZkIAQDcCwAhmggBANwLACGbCAAA5gsAIJwIIADlCwAhAQAAALEJACABAAAAsQkAIBO8BwAA-wsAML0HAAC0CQAQvgcAAPsLADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHUBwEA0AsAIdcHAQDQCwAh3AcAAOYLACDvBwEA0AsAIf4HAQDQCwAhjggBANwLACGWCAEA0AsAIZcIAQDQCwAhmAggAOULACGZCAEA3AsAIZoIAQDcCwAhmwgAAOYLACCcCCAA5QsAIQXcBwAA8QwAII4IAADxDAAgmQgAAPEMACCaCAAA8QwAIJsIAADxDAAgAwAAALQJACADAAC1CQAwBAAAsQkAIAMAAAC0CQAgAwAAtQkAMAQAALEJACADAAAAtAkAIAMAALUJADAEAACxCQAgEL8HAQAAAAHFB0AAAAABxgdAAAAAAdQHAQAAAAHXBwEAAAAB3AeAAAAAAe8HAQAAAAH-BwEAAAABjggBAAAAAZYIAQAAAAGXCAEAAAABmAggAAAAAZkIAQAAAAGaCAEAAAABmwiAAAAAAZwIIAAAAAEBCAAAuQkAIBC_BwEAAAABxQdAAAAAAcYHQAAAAAHUBwEAAAAB1wcBAAAAAdwHgAAAAAHvBwEAAAAB_gcBAAAAAY4IAQAAAAGWCAEAAAABlwgBAAAAAZgIIAAAAAGZCAEAAAABmggBAAAAAZsIgAAAAAGcCCAAAAABAQgAALsJADABCAAAuwkAMBC_BwEA7gwAIcUHQADwDAAhxgdAAPAMACHUBwEA7gwAIdcHAQDuDAAh3AeAAAAAAe8HAQDuDAAh_gcBAO4MACGOCAEA9wwAIZYIAQDuDAAhlwgBAO4MACGYCCAA_gwAIZkIAQD3DAAhmggBAPcMACGbCIAAAAABnAggAP4MACECAAAAsQkAIAgAAL4JACAQvwcBAO4MACHFB0AA8AwAIcYHQADwDAAh1AcBAO4MACHXBwEA7gwAIdwHgAAAAAHvBwEA7gwAIf4HAQDuDAAhjggBAPcMACGWCAEA7gwAIZcIAQDuDAAhmAggAP4MACGZCAEA9wwAIZoIAQD3DAAhmwiAAAAAAZwIIAD-DAAhAgAAALQJACAIAADACQAgAgAAALQJACAIAADACQAgAwAAALEJACAPAAC5CQAgEAAAvgkAIAEAAACxCQAgAQAAALQJACAIFQAAnw0AIBgAAKENACAZAACgDQAg3AcAAPEMACCOCAAA8QwAIJkIAADxDAAgmggAAPEMACCbCAAA8QwAIBO8BwAA-gsAML0HAADHCQAQvgcAAPoLADC_BwEAxQsAIcUHQADHCwAhxgdAAMcLACHUBwEAxQsAIdcHAQDFCwAh3AcAAOALACDvBwEAxQsAIf4HAQDFCwAhjggBANQLACGWCAEAxQsAIZcIAQDFCwAhmAggAN8LACGZCAEA1AsAIZoIAQDUCwAhmwgAAOALACCcCCAA3wsAIQMAAAC0CQAgAwAAxgkAMBQAAMcJACADAAAAtAkAIAMAALUJADAEAACxCQAgGLwHAAD5CwAwvQcAAM0JABC-BwAA-QsAML8HAQAAAAHABwEA3AsAIcQHAQDQCwAhxQdAANILACHGB0AA0gsAIdQHAQDQCwAh7QcAAOYLACDvBwEA0AsAIf0HAQDcCwAh_gcBANALACGACEAA0gsAIYwIAQDQCwAhjQgBANwLACGOCAEA3AsAIY8IAgDRCwAhkAgCANELACGRCAEA3AsAIZIIQADwCwAhkwgBANwLACGUCAEA3AsAIZUIAQAAAAEBAAAAygkAIAEAAADKCQAgGLwHAAD5CwAwvQcAAM0JABC-BwAA-QsAML8HAQDQCwAhwAcBANwLACHEBwEA0AsAIcUHQADSCwAhxgdAANILACHUBwEA0AsAIe0HAADmCwAg7wcBANALACH9BwEA3AsAIf4HAQDQCwAhgAhAANILACGMCAEA0AsAIY0IAQDcCwAhjggBANwLACGPCAIA0QsAIZAIAgDRCwAhkQgBANwLACGSCEAA8AsAIZMIAQDcCwAhlAgBANwLACGVCAEA3AsAIQrABwAA8QwAIO0HAADxDAAg_QcAAPEMACCNCAAA8QwAII4IAADxDAAgkQgAAPEMACCSCAAA8QwAIJMIAADxDAAglAgAAPEMACCVCAAA8QwAIAMAAADNCQAgAwAAzgkAMAQAAMoJACADAAAAzQkAIAMAAM4JADAEAADKCQAgAwAAAM0JACADAADOCQAwBAAAygkAIBW_BwEAAAABwAcBAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAdQHAQAAAAHtB4AAAAAB7wcBAAAAAf0HAQAAAAH-BwEAAAABgAhAAAAAAYwIAQAAAAGNCAEAAAABjggBAAAAAY8IAgAAAAGQCAIAAAABkQgBAAAAAZIIQAAAAAGTCAEAAAABlAgBAAAAAZUIAQAAAAEBCAAA0gkAIBW_BwEAAAABwAcBAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAdQHAQAAAAHtB4AAAAAB7wcBAAAAAf0HAQAAAAH-BwEAAAABgAhAAAAAAYwIAQAAAAGNCAEAAAABjggBAAAAAY8IAgAAAAGQCAIAAAABkQgBAAAAAZIIQAAAAAGTCAEAAAABlAgBAAAAAZUIAQAAAAEBCAAA1AkAMAEIAADUCQAwFb8HAQDuDAAhwAcBAPcMACHEBwEA7gwAIcUHQADwDAAhxgdAAPAMACHUBwEA7gwAIe0HgAAAAAHvBwEA7gwAIf0HAQD3DAAh_gcBAO4MACGACEAA8AwAIYwIAQDuDAAhjQgBAPcMACGOCAEA9wwAIY8IAgDvDAAhkAgCAO8MACGRCAEA9wwAIZIIQACODQAhkwgBAPcMACGUCAEA9wwAIZUIAQD3DAAhAgAAAMoJACAIAADXCQAgFb8HAQDuDAAhwAcBAPcMACHEBwEA7gwAIcUHQADwDAAhxgdAAPAMACHUBwEA7gwAIe0HgAAAAAHvBwEA7gwAIf0HAQD3DAAh_gcBAO4MACGACEAA8AwAIYwIAQDuDAAhjQgBAPcMACGOCAEA9wwAIY8IAgDvDAAhkAgCAO8MACGRCAEA9wwAIZIIQACODQAhkwgBAPcMACGUCAEA9wwAIZUIAQD3DAAhAgAAAM0JACAIAADZCQAgAgAAAM0JACAIAADZCQAgAwAAAMoJACAPAADSCQAgEAAA1wkAIAEAAADKCQAgAQAAAM0JACAPFQAAmg0AIBYAAJsNACAXAACeDQAgGAAAnQ0AIBkAAJwNACDABwAA8QwAIO0HAADxDAAg_QcAAPEMACCNCAAA8QwAII4IAADxDAAgkQgAAPEMACCSCAAA8QwAIJMIAADxDAAglAgAAPEMACCVCAAA8QwAIBi8BwAA-AsAML0HAADgCQAQvgcAAPgLADC_BwEAxQsAIcAHAQDUCwAhxAcBAMULACHFB0AAxwsAIcYHQADHCwAh1AcBAMULACHtBwAA4AsAIO8HAQDFCwAh_QcBANQLACH-BwEAxQsAIYAIQADHCwAhjAgBAMULACGNCAEA1AsAIY4IAQDUCwAhjwgCAMYLACGQCAIAxgsAIZEIAQDUCwAhkghAAOwLACGTCAEA1AsAIZQIAQDUCwAhlQgBANQLACEDAAAAzQkAIAMAAN8JADAUAADgCQAgAwAAAM0JACADAADOCQAwBAAAygkAIAm8BwAA9wsAML0HAADmCQAQvgcAAPcLADC_BwEAAAABwAcBANwLACHFB0AA0gsAIYkIAQDcCwAhiggBANALACGLCAEA3AsAIQEAAADjCQAgAQAAAOMJACAJvAcAAPcLADC9BwAA5gkAEL4HAAD3CwAwvwcBANALACHABwEA3AsAIcUHQADSCwAhiQgBANwLACGKCAEA0AsAIYsIAQDcCwAhA8AHAADxDAAgiQgAAPEMACCLCAAA8QwAIAMAAADmCQAgAwAA5wkAMAQAAOMJACADAAAA5gkAIAMAAOcJADAEAADjCQAgAwAAAOYJACADAADnCQAwBAAA4wkAIAa_BwEAAAABwAcBAAAAAcUHQAAAAAGJCAEAAAABiggBAAAAAYsIAQAAAAEBCAAA6wkAIAa_BwEAAAABwAcBAAAAAcUHQAAAAAGJCAEAAAABiggBAAAAAYsIAQAAAAEBCAAA7QkAMAEIAADtCQAwBr8HAQDuDAAhwAcBAPcMACHFB0AA8AwAIYkIAQD3DAAhiggBAO4MACGLCAEA9wwAIQIAAADjCQAgCAAA8AkAIAa_BwEA7gwAIcAHAQD3DAAhxQdAAPAMACGJCAEA9wwAIYoIAQDuDAAhiwgBAPcMACECAAAA5gkAIAgAAPIJACACAAAA5gkAIAgAAPIJACADAAAA4wkAIA8AAOsJACAQAADwCQAgAQAAAOMJACABAAAA5gkAIAYVAACXDQAgGAAAmQ0AIBkAAJgNACDABwAA8QwAIIkIAADxDAAgiwgAAPEMACAJvAcAAPYLADC9BwAA-QkAEL4HAAD2CwAwvwcBAMULACHABwEA1AsAIcUHQADHCwAhiQgBANQLACGKCAEAxQsAIYsIAQDUCwAhAwAAAOYJACADAAD4CQAwFAAA-QkAIAMAAADmCQAgAwAA5wkAMAQAAOMJACANvAcAAPQLADC9BwAA_wkAEL4HAAD0CwAwvwcBAAAAAcAHAQDcCwAhxQdAANILACHGB0AA0gsAIYMIAQDQCwAhhAgBAAAAAYUIIADlCwAhhgggAOULACGHCAAA5gsAIIgIAAD1CwAgAQAAAPwJACABAAAA_AkAIAy8BwAA9AsAML0HAAD_CQAQvgcAAPQLADC_BwEA0AsAIcAHAQDcCwAhxQdAANILACHGB0AA0gsAIYMIAQDQCwAhhAgBANALACGFCCAA5QsAIYYIIADlCwAhhwgAAOYLACACwAcAAPEMACCHCAAA8QwAIAMAAAD_CQAgAwAAgAoAMAQAAPwJACADAAAA_wkAIAMAAIAKADAEAAD8CQAgAwAAAP8JACADAACACgAwBAAA_AkAIAm_BwEAAAABwAcBAAAAAcUHQAAAAAHGB0AAAAABgwgBAAAAAYQIAQAAAAGFCCAAAAABhgggAAAAAYcIgAAAAAEBCAAAhAoAIAm_BwEAAAABwAcBAAAAAcUHQAAAAAHGB0AAAAABgwgBAAAAAYQIAQAAAAGFCCAAAAABhgggAAAAAYcIgAAAAAEBCAAAhgoAMAEIAACGCgAwCb8HAQDuDAAhwAcBAPcMACHFB0AA8AwAIcYHQADwDAAhgwgBAO4MACGECAEA7gwAIYUIIAD-DAAhhgggAP4MACGHCIAAAAABAgAAAPwJACAIAACJCgAgCb8HAQDuDAAhwAcBAPcMACHFB0AA8AwAIcYHQADwDAAhgwgBAO4MACGECAEA7gwAIYUIIAD-DAAhhgggAP4MACGHCIAAAAABAgAAAP8JACAIAACLCgAgAgAAAP8JACAIAACLCgAgAwAAAPwJACAPAACECgAgEAAAiQoAIAEAAAD8CQAgAQAAAP8JACAFFQAAlA0AIBgAAJYNACAZAACVDQAgwAcAAPEMACCHCAAA8QwAIAy8BwAA8wsAML0HAACSCgAQvgcAAPMLADC_BwEAxQsAIcAHAQDUCwAhxQdAAMcLACHGB0AAxwsAIYMIAQDFCwAhhAgBAMULACGFCCAA3wsAIYYIIADfCwAhhwgAAOALACADAAAA_wkAIAMAAJEKADAUAACSCgAgAwAAAP8JACADAACACgAwBAAA_AkAIBK8BwAA8gsAML0HAACYCgAQvgcAAPILADC_BwEAAAABxAcBANALACHFB0AA0gsAIcYHQADSCwAh1AcBANALACHWBwIA3QsAIdcHAQDQCwAh3AcAAOYLACDvBwEA3AsAIf0HAQDcCwAh_gcBANwLACH_BwAA5gsAIIAIQADwCwAhgQgCANELACGCCAIA0QsAIQEAAACVCgAgAQAAAJUKACASvAcAAPILADC9BwAAmAoAEL4HAADyCwAwvwcBANALACHEBwEA0AsAIcUHQADSCwAhxgdAANILACHUBwEA0AsAIdYHAgDdCwAh1wcBANALACHcBwAA5gsAIO8HAQDcCwAh_QcBANwLACH-BwEA3AsAIf8HAADmCwAggAhAAPALACGBCAIA0QsAIYIIAgDRCwAhB9YHAADxDAAg3AcAAPEMACDvBwAA8QwAIP0HAADxDAAg_gcAAPEMACD_BwAA8QwAIIAIAADxDAAgAwAAAJgKACADAACZCgAwBAAAlQoAIAMAAACYCgAgAwAAmQoAMAQAAJUKACADAAAAmAoAIAMAAJkKADAEAACVCgAgD78HAQAAAAHEBwEAAAABxQdAAAAAAcYHQAAAAAHUBwEAAAAB1gcCAAAAAdcHAQAAAAHcB4AAAAAB7wcBAAAAAf0HAQAAAAH-BwEAAAAB_weAAAAAAYAIQAAAAAGBCAIAAAABgggCAAAAAQEIAACdCgAgD78HAQAAAAHEBwEAAAABxQdAAAAAAcYHQAAAAAHUBwEAAAAB1gcCAAAAAdcHAQAAAAHcB4AAAAAB7wcBAAAAAf0HAQAAAAH-BwEAAAAB_weAAAAAAYAIQAAAAAGBCAIAAAABgggCAAAAAQEIAACfCgAwAQgAAJ8KADAPvwcBAO4MACHEBwEA7gwAIcUHQADwDAAhxgdAAPAMACHUBwEA7gwAIdYHAgD4DAAh1wcBAO4MACHcB4AAAAAB7wcBAPcMACH9BwEA9wwAIf4HAQD3DAAh_weAAAAAAYAIQACODQAhgQgCAO8MACGCCAIA7wwAIQIAAACVCgAgCAAAogoAIA-_BwEA7gwAIcQHAQDuDAAhxQdAAPAMACHGB0AA8AwAIdQHAQDuDAAh1gcCAPgMACHXBwEA7gwAIdwHgAAAAAHvBwEA9wwAIf0HAQD3DAAh_gcBAPcMACH_B4AAAAABgAhAAI4NACGBCAIA7wwAIYIIAgDvDAAhAgAAAJgKACAIAACkCgAgAgAAAJgKACAIAACkCgAgAwAAAJUKACAPAACdCgAgEAAAogoAIAEAAACVCgAgAQAAAJgKACAMFQAAjw0AIBYAAJANACAXAACTDQAgGAAAkg0AIBkAAJENACDWBwAA8QwAINwHAADxDAAg7wcAAPEMACD9BwAA8QwAIP4HAADxDAAg_wcAAPEMACCACAAA8QwAIBK8BwAA8QsAML0HAACrCgAQvgcAAPELADC_BwEAxQsAIcQHAQDFCwAhxQdAAMcLACHGB0AAxwsAIdQHAQDFCwAh1gcCANULACHXBwEAxQsAIdwHAADgCwAg7wcBANQLACH9BwEA1AsAIf4HAQDUCwAh_wcAAOALACCACEAA7AsAIYEIAgDGCwAhgggCAMYLACEDAAAAmAoAIAMAAKoKADAUAACrCgAgAwAAAJgKACADAACZCgAwBAAAlQoAIBu8BwAA7wsAML0HAACxCgAQvgcAAO8LADC_BwEAAAABwAcBANALACHEBwEA0AsAIcUHQADSCwAhxgdAANILACHUBwEA3AsAIdYHAgDdCwAh2AcBANALACHtBwAA5gsAIO4HAQAAAAHvBwEA0AsAIfAHAQDQCwAh8QcBANwLACHyBwIA3QsAIfMHQADwCwAh9AcCANELACH1BwIA0QsAIfYHQADwCwAh9wdAAPALACH4B0AA8AsAIfkHQADwCwAh-gcgAOULACH7BwIA3QsAIfwHAQDcCwAhAQAAAK4KACABAAAArgoAIBu8BwAA7wsAML0HAACxCgAQvgcAAO8LADC_BwEA0AsAIcAHAQDQCwAhxAcBANALACHFB0AA0gsAIcYHQADSCwAh1AcBANwLACHWBwIA3QsAIdgHAQDQCwAh7QcAAOYLACDuBwEA0AsAIe8HAQDQCwAh8AcBANALACHxBwEA3AsAIfIHAgDdCwAh8wdAAPALACH0BwIA0QsAIfUHAgDRCwAh9gdAAPALACH3B0AA8AsAIfgHQADwCwAh-QdAAPALACH6ByAA5QsAIfsHAgDdCwAh_AcBANwLACEM1AcAAPEMACDWBwAA8QwAIO0HAADxDAAg8QcAAPEMACDyBwAA8QwAIPMHAADxDAAg9gcAAPEMACD3BwAA8QwAIPgHAADxDAAg-QcAAPEMACD7BwAA8QwAIPwHAADxDAAgAwAAALEKACADAACyCgAwBAAArgoAIAMAAACxCgAgAwAAsgoAMAQAAK4KACADAAAAsQoAIAMAALIKADAEAACuCgAgGL8HAQAAAAHABwEAAAABxAcBAAAAAcUHQAAAAAHGB0AAAAAB1AcBAAAAAdYHAgAAAAHYBwEAAAAB7QeAAAAAAe4HAQAAAAHvBwEAAAAB8AcBAAAAAfEHAQAAAAHyBwIAAAAB8wdAAAAAAfQHAgAAAAH1BwIAAAAB9gdAAAAAAfcHQAAAAAH4B0AAAAAB-QdAAAAAAfoHIAAAAAH7BwIAAAAB_AcBAAAAAQEIAAC2CgAgGL8HAQAAAAHABwEAAAABxAcBAAAAAcUHQAAAAAHGB0AAAAAB1AcBAAAAAdYHAgAAAAHYBwEAAAAB7QeAAAAAAe4HAQAAAAHvBwEAAAAB8AcBAAAAAfEHAQAAAAHyBwIAAAAB8wdAAAAAAfQHAgAAAAH1BwIAAAAB9gdAAAAAAfcHQAAAAAH4B0AAAAAB-QdAAAAAAfoHIAAAAAH7BwIAAAAB_AcBAAAAAQEIAAC4CgAwAQgAALgKADAYvwcBAO4MACHABwEA7gwAIcQHAQDuDAAhxQdAAPAMACHGB0AA8AwAIdQHAQD3DAAh1gcCAPgMACHYBwEA7gwAIe0HgAAAAAHuBwEA7gwAIe8HAQDuDAAh8AcBAO4MACHxBwEA9wwAIfIHAgD4DAAh8wdAAI4NACH0BwIA7wwAIfUHAgDvDAAh9gdAAI4NACH3B0AAjg0AIfgHQACODQAh-QdAAI4NACH6ByAA_gwAIfsHAgD4DAAh_AcBAPcMACECAAAArgoAIAgAALsKACAYvwcBAO4MACHABwEA7gwAIcQHAQDuDAAhxQdAAPAMACHGB0AA8AwAIdQHAQD3DAAh1gcCAPgMACHYBwEA7gwAIe0HgAAAAAHuBwEA7gwAIe8HAQDuDAAh8AcBAO4MACHxBwEA9wwAIfIHAgD4DAAh8wdAAI4NACH0BwIA7wwAIfUHAgDvDAAh9gdAAI4NACH3B0AAjg0AIfgHQACODQAh-QdAAI4NACH6ByAA_gwAIfsHAgD4DAAh_AcBAPcMACECAAAAsQoAIAgAAL0KACACAAAAsQoAIAgAAL0KACADAAAArgoAIA8AALYKACAQAAC7CgAgAQAAAK4KACABAAAAsQoAIBEVAACJDQAgFgAAig0AIBcAAI0NACAYAACMDQAgGQAAiw0AINQHAADxDAAg1gcAAPEMACDtBwAA8QwAIPEHAADxDAAg8gcAAPEMACDzBwAA8QwAIPYHAADxDAAg9wcAAPEMACD4BwAA8QwAIPkHAADxDAAg-wcAAPEMACD8BwAA8QwAIBu8BwAA6wsAML0HAADECgAQvgcAAOsLADC_BwEAxQsAIcAHAQDFCwAhxAcBAMULACHFB0AAxwsAIcYHQADHCwAh1AcBANQLACHWBwIA1QsAIdgHAQDFCwAh7QcAAOALACDuBwEAxQsAIe8HAQDFCwAh8AcBAMULACHxBwEA1AsAIfIHAgDVCwAh8wdAAOwLACH0BwIAxgsAIfUHAgDGCwAh9gdAAOwLACH3B0AA7AsAIfgHQADsCwAh-QdAAOwLACH6ByAA3wsAIfsHAgDVCwAh_AcBANQLACEDAAAAsQoAIAMAAMMKADAUAADECgAgAwAAALEKACADAACyCgAwBAAArgoAIA28BwAA6gsAML0HAADKCgAQvgcAAOoLADC_BwEAAAABwAcBANALACHFB0AA0gsAIdMHAQDQCwAh5AcBANALACHpBwEA0AsAIeoHAgDdCwAh6wcBANwLACHsByAA5QsAIe0HAADmCwAgAQAAAMcKACABAAAAxwoAIA28BwAA6gsAML0HAADKCgAQvgcAAOoLADC_BwEA0AsAIcAHAQDQCwAhxQdAANILACHTBwEA0AsAIeQHAQDQCwAh6QcBANALACHqBwIA3QsAIesHAQDcCwAh7AcgAOULACHtBwAA5gsAIAPqBwAA8QwAIOsHAADxDAAg7QcAAPEMACADAAAAygoAIAMAAMsKADAEAADHCgAgAwAAAMoKACADAADLCgAwBAAAxwoAIAMAAADKCgAgAwAAywoAMAQAAMcKACAKvwcBAAAAAcAHAQAAAAHFB0AAAAAB0wcBAAAAAeQHAQAAAAHpBwEAAAAB6gcCAAAAAesHAQAAAAHsByAAAAAB7QeAAAAAAQEIAADPCgAgCr8HAQAAAAHABwEAAAABxQdAAAAAAdMHAQAAAAHkBwEAAAAB6QcBAAAAAeoHAgAAAAHrBwEAAAAB7AcgAAAAAe0HgAAAAAEBCAAA0QoAMAEIAADRCgAwCr8HAQDuDAAhwAcBAO4MACHFB0AA8AwAIdMHAQDuDAAh5AcBAO4MACHpBwEA7gwAIeoHAgD4DAAh6wcBAPcMACHsByAA_gwAIe0HgAAAAAECAAAAxwoAIAgAANQKACAKvwcBAO4MACHABwEA7gwAIcUHQADwDAAh0wcBAO4MACHkBwEA7gwAIekHAQDuDAAh6gcCAPgMACHrBwEA9wwAIewHIAD-DAAh7QeAAAAAAQIAAADKCgAgCAAA1goAIAIAAADKCgAgCAAA1goAIAMAAADHCgAgDwAAzwoAIBAAANQKACABAAAAxwoAIAEAAADKCgAgCBUAAIQNACAWAACFDQAgFwAAiA0AIBgAAIcNACAZAACGDQAg6gcAAPEMACDrBwAA8QwAIO0HAADxDAAgDbwHAADpCwAwvQcAAN0KABC-BwAA6QsAML8HAQDFCwAhwAcBAMULACHFB0AAxwsAIdMHAQDFCwAh5AcBAMULACHpBwEAxQsAIeoHAgDVCwAh6wcBANQLACHsByAA3wsAIe0HAADgCwAgAwAAAMoKACADAADcCgAwFAAA3QoAIAMAAADKCgAgAwAAywoAMAQAAMcKACAMvAcAAOgLADC9BwAA4woAEL4HAADoCwAwvwcBAAAAAcAHAQDQCwAhxQdAANILACHjBwEA3AsAIeQHAQDQCwAh5QcBANALACHmBwEA3AsAIecHAgDdCwAh6AcBANALACEBAAAA4AoAIAEAAADgCgAgDLwHAADoCwAwvQcAAOMKABC-BwAA6AsAML8HAQDQCwAhwAcBANALACHFB0AA0gsAIeMHAQDcCwAh5AcBANALACHlBwEA0AsAIeYHAQDcCwAh5wcCAN0LACHoBwEA0AsAIQPjBwAA8QwAIOYHAADxDAAg5wcAAPEMACADAAAA4woAIAMAAOQKADAEAADgCgAgAwAAAOMKACADAADkCgAwBAAA4AoAIAMAAADjCgAgAwAA5AoAMAQAAOAKACAJvwcBAAAAAcAHAQAAAAHFB0AAAAAB4wcBAAAAAeQHAQAAAAHlBwEAAAAB5gcBAAAAAecHAgAAAAHoBwEAAAABAQgAAOgKACAJvwcBAAAAAcAHAQAAAAHFB0AAAAAB4wcBAAAAAeQHAQAAAAHlBwEAAAAB5gcBAAAAAecHAgAAAAHoBwEAAAABAQgAAOoKADABCAAA6goAMAm_BwEA7gwAIcAHAQDuDAAhxQdAAPAMACHjBwEA9wwAIeQHAQDuDAAh5QcBAO4MACHmBwEA9wwAIecHAgD4DAAh6AcBAO4MACECAAAA4AoAIAgAAO0KACAJvwcBAO4MACHABwEA7gwAIcUHQADwDAAh4wcBAPcMACHkBwEA7gwAIeUHAQDuDAAh5gcBAPcMACHnBwIA-AwAIegHAQDuDAAhAgAAAOMKACAIAADvCgAgAgAAAOMKACAIAADvCgAgAwAAAOAKACAPAADoCgAgEAAA7QoAIAEAAADgCgAgAQAAAOMKACAIFQAA_wwAIBYAAIANACAXAACDDQAgGAAAgg0AIBkAAIENACDjBwAA8QwAIOYHAADxDAAg5wcAAPEMACAMvAcAAOcLADC9BwAA9goAEL4HAADnCwAwvwcBAMULACHABwEAxQsAIcUHQADHCwAh4wcBANQLACHkBwEAxQsAIeUHAQDFCwAh5gcBANQLACHnBwIA1QsAIegHAQDFCwAhAwAAAOMKACADAAD1CgAwFAAA9goAIAMAAADjCgAgAwAA5AoAMAQAAOAKACAMvAcAAOQLADC9BwAA_AoAEL4HAADkCwAwvwcBAAAAAcUHQADSCwAhxgdAANILACHXBwEA0AsAIdgHAQDQCwAh2QcCANELACHaBwIA0QsAIdsHIADlCwAh3AcAAOYLACABAAAA-QoAIAEAAAD5CgAgDLwHAADkCwAwvQcAAPwKABC-BwAA5AsAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIdcHAQDQCwAh2AcBANALACHZBwIA0QsAIdoHAgDRCwAh2wcgAOULACHcBwAA5gsAIAHcBwAA8QwAIAMAAAD8CgAgAwAA_QoAMAQAAPkKACADAAAA_AoAIAMAAP0KADAEAAD5CgAgAwAAAPwKACADAAD9CgAwBAAA-QoAIAm_BwEAAAABxQdAAAAAAcYHQAAAAAHXBwEAAAAB2AcBAAAAAdkHAgAAAAHaBwIAAAAB2wcgAAAAAdwHgAAAAAEBCAAAgQsAIAm_BwEAAAABxQdAAAAAAcYHQAAAAAHXBwEAAAAB2AcBAAAAAdkHAgAAAAHaBwIAAAAB2wcgAAAAAdwHgAAAAAEBCAAAgwsAMAEIAACDCwAwCb8HAQDuDAAhxQdAAPAMACHGB0AA8AwAIdcHAQDuDAAh2AcBAO4MACHZBwIA7wwAIdoHAgDvDAAh2wcgAP4MACHcB4AAAAABAgAAAPkKACAIAACGCwAgCb8HAQDuDAAhxQdAAPAMACHGB0AA8AwAIdcHAQDuDAAh2AcBAO4MACHZBwIA7wwAIdoHAgDvDAAh2wcgAP4MACHcB4AAAAABAgAAAPwKACAIAACICwAgAgAAAPwKACAIAACICwAgAwAAAPkKACAPAACBCwAgEAAAhgsAIAEAAAD5CgAgAQAAAPwKACAGFQAA-QwAIBYAAPoMACAXAAD9DAAgGAAA_AwAIBkAAPsMACDcBwAA8QwAIAy8BwAA3gsAML0HAACPCwAQvgcAAN4LADC_BwEAxQsAIcUHQADHCwAhxgdAAMcLACHXBwEAxQsAIdgHAQDFCwAh2QcCAMYLACHaBwIAxgsAIdsHIADfCwAh3AcAAOALACADAAAA_AoAIAMAAI4LADAUAACPCwAgAwAAAPwKACADAAD9CgAwBAAA-QoAIAu8BwAA2wsAML0HAACVCwAQvgcAANsLADC_BwEAAAABxQdAANILACHGB0AA0gsAIdIHAQDQCwAh0wcBANALACHUBwEA3AsAIdUHAQDcCwAh1gcCAN0LACEBAAAAkgsAIAEAAACSCwAgC7wHAADbCwAwvQcAAJULABC-BwAA2wsAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIdIHAQDQCwAh0wcBANALACHUBwEA3AsAIdUHAQDcCwAh1gcCAN0LACED1AcAAPEMACDVBwAA8QwAINYHAADxDAAgAwAAAJULACADAACWCwAwBAAAkgsAIAMAAACVCwAgAwAAlgsAMAQAAJILACADAAAAlQsAIAMAAJYLADAEAACSCwAgCL8HAQAAAAHFB0AAAAABxgdAAAAAAdIHAQAAAAHTBwEAAAAB1AcBAAAAAdUHAQAAAAHWBwIAAAABAQgAAJoLACAIvwcBAAAAAcUHQAAAAAHGB0AAAAAB0gcBAAAAAdMHAQAAAAHUBwEAAAAB1QcBAAAAAdYHAgAAAAEBCAAAnAsAMAEIAACcCwAwCL8HAQDuDAAhxQdAAPAMACHGB0AA8AwAIdIHAQDuDAAh0wcBAO4MACHUBwEA9wwAIdUHAQD3DAAh1gcCAPgMACECAAAAkgsAIAgAAJ8LACAIvwcBAO4MACHFB0AA8AwAIcYHQADwDAAh0gcBAO4MACHTBwEA7gwAIdQHAQD3DAAh1QcBAPcMACHWBwIA-AwAIQIAAACVCwAgCAAAoQsAIAIAAACVCwAgCAAAoQsAIAMAAACSCwAgDwAAmgsAIBAAAJ8LACABAAAAkgsAIAEAAACVCwAgCBUAAPIMACAWAADzDAAgFwAA9gwAIBgAAPUMACAZAAD0DAAg1AcAAPEMACDVBwAA8QwAINYHAADxDAAgC7wHAADTCwAwvQcAAKgLABC-BwAA0wsAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIdIHAQDFCwAh0wcBAMULACHUBwEA1AsAIdUHAQDUCwAh1gcCANULACEDAAAAlQsAIAMAAKcLADAUAACoCwAgAwAAAJULACADAACWCwAwBAAAkgsAIAu8BwAAzwsAML0HAACuCwAQvgcAAM8LADC_BwEAAAABwAcBAAAAAcEHAQDQCwAhwgcBANALACHDBwIA0QsAIcQHAQDQCwAhxQdAANILACHGB0AA0gsAIQEAAACrCwAgAQAAAKsLACALvAcAAM8LADC9BwAArgsAEL4HAADPCwAwvwcBANALACHABwEA0AsAIcEHAQDQCwAhwgcBANALACHDBwIA0QsAIcQHAQDQCwAhxQdAANILACHGB0AA0gsAIQADAAAArgsAIAMAAK8LADAEAACrCwAgAwAAAK4LACADAACvCwAwBAAAqwsAIAMAAACuCwAgAwAArwsAMAQAAKsLACAIvwcBAAAAAcAHAQAAAAHBBwEAAAABwgcBAAAAAcMHAgAAAAHEBwEAAAABxQdAAAAAAcYHQAAAAAEBCAAAswsAIAi_BwEAAAABwAcBAAAAAcEHAQAAAAHCBwEAAAABwwcCAAAAAcQHAQAAAAHFB0AAAAABxgdAAAAAAQEIAAC1CwAwAQgAALULADAIvwcBAO4MACHABwEA7gwAIcEHAQDuDAAhwgcBAO4MACHDBwIA7wwAIcQHAQDuDAAhxQdAAPAMACHGB0AA8AwAIQIAAACrCwAgCAAAuAsAIAi_BwEA7gwAIcAHAQDuDAAhwQcBAO4MACHCBwEA7gwAIcMHAgDvDAAhxAcBAO4MACHFB0AA8AwAIcYHQADwDAAhAgAAAK4LACAIAAC6CwAgAgAAAK4LACAIAAC6CwAgAwAAAKsLACAPAACzCwAgEAAAuAsAIAEAAACrCwAgAQAAAK4LACAFFQAA6QwAIBYAAOoMACAXAADtDAAgGAAA7AwAIBkAAOsMACALvAcAAMQLADC9BwAAwQsAEL4HAADECwAwvwcBAMULACHABwEAxQsAIcEHAQDFCwAhwgcBAMULACHDBwIAxgsAIcQHAQDFCwAhxQdAAMcLACHGB0AAxwsAIQMAAACuCwAgAwAAwAsAMBQAAMELACADAAAArgsAIAMAAK8LADAEAACrCwAgC7wHAADECwAwvQcAAMELABC-BwAAxAsAML8HAQDFCwAhwAcBAMULACHBBwEAxQsAIcIHAQDFCwAhwwcCAMYLACHEBwEAxQsAIcUHQADHCwAhxgdAAMcLACEOFQAAyQsAIBgAAM4LACAZAADOCwAgxwcBAAAAAcgHAQAAAATJBwEAAAAEygcBAAAAAcsHAQAAAAHMBwEAAAABzQcBAAAAAc4HAQDNCwAhzwcBAAAAAdAHAQAAAAHRBwEAAAABDRUAAMkLACAWAADMCwAgFwAAyQsAIBgAAMkLACAZAADJCwAgxwcCAAAAAcgHAgAAAATJBwIAAAAEygcCAAAAAcsHAgAAAAHMBwIAAAABzQcCAAAAAc4HAgDLCwAhCxUAAMkLACAYAADKCwAgGQAAygsAIMcHQAAAAAHIB0AAAAAEyQdAAAAABMoHQAAAAAHLB0AAAAABzAdAAAAAAc0HQAAAAAHOB0AAyAsAIQsVAADJCwAgGAAAygsAIBkAAMoLACDHB0AAAAAByAdAAAAABMkHQAAAAATKB0AAAAABywdAAAAAAcwHQAAAAAHNB0AAAAABzgdAAMgLACEIxwcCAAAAAcgHAgAAAATJBwIAAAAEygcCAAAAAcsHAgAAAAHMBwIAAAABzQcCAAAAAc4HAgDJCwAhCMcHQAAAAAHIB0AAAAAEyQdAAAAABMoHQAAAAAHLB0AAAAABzAdAAAAAAc0HQAAAAAHOB0AAygsAIQ0VAADJCwAgFgAAzAsAIBcAAMkLACAYAADJCwAgGQAAyQsAIMcHAgAAAAHIBwIAAAAEyQcCAAAABMoHAgAAAAHLBwIAAAABzAcCAAAAAc0HAgAAAAHOBwIAywsAIQjHBwgAAAAByAcIAAAABMkHCAAAAATKBwgAAAABywcIAAAAAcwHCAAAAAHNBwgAAAABzgcIAMwLACEOFQAAyQsAIBgAAM4LACAZAADOCwAgxwcBAAAAAcgHAQAAAATJBwEAAAAEygcBAAAAAcsHAQAAAAHMBwEAAAABzQcBAAAAAc4HAQDNCwAhzwcBAAAAAdAHAQAAAAHRBwEAAAABC8cHAQAAAAHIBwEAAAAEyQcBAAAABMoHAQAAAAHLBwEAAAABzAcBAAAAAc0HAQAAAAHOBwEAzgsAIc8HAQAAAAHQBwEAAAAB0QcBAAAAAQu8BwAAzwsAML0HAACuCwAQvgcAAM8LADC_BwEA0AsAIcAHAQDQCwAhwQcBANALACHCBwEA0AsAIcMHAgDRCwAhxAcBANALACHFB0AA0gsAIcYHQADSCwAhC8cHAQAAAAHIBwEAAAAEyQcBAAAABMoHAQAAAAHLBwEAAAABzAcBAAAAAc0HAQAAAAHOBwEAzgsAIc8HAQAAAAHQBwEAAAAB0QcBAAAAAQjHBwIAAAAByAcCAAAABMkHAgAAAATKBwIAAAABywcCAAAAAcwHAgAAAAHNBwIAAAABzgcCAMkLACEIxwdAAAAAAcgHQAAAAATJB0AAAAAEygdAAAAAAcsHQAAAAAHMB0AAAAABzQdAAAAAAc4HQADKCwAhC7wHAADTCwAwvQcAAKgLABC-BwAA0wsAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIdIHAQDFCwAh0wcBAMULACHUBwEA1AsAIdUHAQDUCwAh1gcCANULACEOFQAA1wsAIBgAANoLACAZAADaCwAgxwcBAAAAAcgHAQAAAAXJBwEAAAAFygcBAAAAAcsHAQAAAAHMBwEAAAABzQcBAAAAAc4HAQDZCwAhzwcBAAAAAdAHAQAAAAHRBwEAAAABDRUAANcLACAWAADYCwAgFwAA1wsAIBgAANcLACAZAADXCwAgxwcCAAAAAcgHAgAAAAXJBwIAAAAFygcCAAAAAcsHAgAAAAHMBwIAAAABzQcCAAAAAc4HAgDWCwAhDRUAANcLACAWAADYCwAgFwAA1wsAIBgAANcLACAZAADXCwAgxwcCAAAAAcgHAgAAAAXJBwIAAAAFygcCAAAAAcsHAgAAAAHMBwIAAAABzQcCAAAAAc4HAgDWCwAhCMcHAgAAAAHIBwIAAAAFyQcCAAAABcoHAgAAAAHLBwIAAAABzAcCAAAAAc0HAgAAAAHOBwIA1wsAIQjHBwgAAAAByAcIAAAABckHCAAAAAXKBwgAAAABywcIAAAAAcwHCAAAAAHNBwgAAAABzgcIANgLACEOFQAA1wsAIBgAANoLACAZAADaCwAgxwcBAAAAAcgHAQAAAAXJBwEAAAAFygcBAAAAAcsHAQAAAAHMBwEAAAABzQcBAAAAAc4HAQDZCwAhzwcBAAAAAdAHAQAAAAHRBwEAAAABC8cHAQAAAAHIBwEAAAAFyQcBAAAABcoHAQAAAAHLBwEAAAABzAcBAAAAAc0HAQAAAAHOBwEA2gsAIc8HAQAAAAHQBwEAAAAB0QcBAAAAAQu8BwAA2wsAML0HAACVCwAQvgcAANsLADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHSBwEA0AsAIdMHAQDQCwAh1AcBANwLACHVBwEA3AsAIdYHAgDdCwAhC8cHAQAAAAHIBwEAAAAFyQcBAAAABcoHAQAAAAHLBwEAAAABzAcBAAAAAc0HAQAAAAHOBwEA2gsAIc8HAQAAAAHQBwEAAAAB0QcBAAAAAQjHBwIAAAAByAcCAAAABckHAgAAAAXKBwIAAAABywcCAAAAAcwHAgAAAAHNBwIAAAABzgcCANcLACEMvAcAAN4LADC9BwAAjwsAEL4HAADeCwAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAh1wcBAMULACHYBwEAxQsAIdkHAgDGCwAh2gcCAMYLACHbByAA3wsAIdwHAADgCwAgBRUAAMkLACAYAADjCwAgGQAA4wsAIMcHIAAAAAHOByAA4gsAIQ8VAADXCwAgGAAA4QsAIBkAAOELACDHB4AAAAABygeAAAAAAcsHgAAAAAHMB4AAAAABzQeAAAAAAc4HgAAAAAHdBwEAAAAB3gcBAAAAAd8HAQAAAAHgB4AAAAAB4QeAAAAAAeIHgAAAAAEMxweAAAAAAcoHgAAAAAHLB4AAAAABzAeAAAAAAc0HgAAAAAHOB4AAAAAB3QcBAAAAAd4HAQAAAAHfBwEAAAAB4AeAAAAAAeEHgAAAAAHiB4AAAAABBRUAAMkLACAYAADjCwAgGQAA4wsAIMcHIAAAAAHOByAA4gsAIQLHByAAAAABzgcgAOMLACEMvAcAAOQLADC9BwAA_AoAEL4HAADkCwAwvwcBANALACHFB0AA0gsAIcYHQADSCwAh1wcBANALACHYBwEA0AsAIdkHAgDRCwAh2gcCANELACHbByAA5QsAIdwHAADmCwAgAscHIAAAAAHOByAA4wsAIQzHB4AAAAABygeAAAAAAcsHgAAAAAHMB4AAAAABzQeAAAAAAc4HgAAAAAHdBwEAAAAB3gcBAAAAAd8HAQAAAAHgB4AAAAAB4QeAAAAAAeIHgAAAAAEMvAcAAOcLADC9BwAA9goAEL4HAADnCwAwvwcBAMULACHABwEAxQsAIcUHQADHCwAh4wcBANQLACHkBwEAxQsAIeUHAQDFCwAh5gcBANQLACHnBwIA1QsAIegHAQDFCwAhDLwHAADoCwAwvQcAAOMKABC-BwAA6AsAML8HAQDQCwAhwAcBANALACHFB0AA0gsAIeMHAQDcCwAh5AcBANALACHlBwEA0AsAIeYHAQDcCwAh5wcCAN0LACHoBwEA0AsAIQ28BwAA6QsAML0HAADdCgAQvgcAAOkLADC_BwEAxQsAIcAHAQDFCwAhxQdAAMcLACHTBwEAxQsAIeQHAQDFCwAh6QcBAMULACHqBwIA1QsAIesHAQDUCwAh7AcgAN8LACHtBwAA4AsAIA28BwAA6gsAML0HAADKCgAQvgcAAOoLADC_BwEA0AsAIcAHAQDQCwAhxQdAANILACHTBwEA0AsAIeQHAQDQCwAh6QcBANALACHqBwIA3QsAIesHAQDcCwAh7AcgAOULACHtBwAA5gsAIBu8BwAA6wsAML0HAADECgAQvgcAAOsLADC_BwEAxQsAIcAHAQDFCwAhxAcBAMULACHFB0AAxwsAIcYHQADHCwAh1AcBANQLACHWBwIA1QsAIdgHAQDFCwAh7QcAAOALACDuBwEAxQsAIe8HAQDFCwAh8AcBAMULACHxBwEA1AsAIfIHAgDVCwAh8wdAAOwLACH0BwIAxgsAIfUHAgDGCwAh9gdAAOwLACH3B0AA7AsAIfgHQADsCwAh-QdAAOwLACH6ByAA3wsAIfsHAgDVCwAh_AcBANQLACELFQAA1wsAIBgAAO4LACAZAADuCwAgxwdAAAAAAcgHQAAAAAXJB0AAAAAFygdAAAAAAcsHQAAAAAHMB0AAAAABzQdAAAAAAc4HQADtCwAhCxUAANcLACAYAADuCwAgGQAA7gsAIMcHQAAAAAHIB0AAAAAFyQdAAAAABcoHQAAAAAHLB0AAAAABzAdAAAAAAc0HQAAAAAHOB0AA7QsAIQjHB0AAAAAByAdAAAAABckHQAAAAAXKB0AAAAABywdAAAAAAcwHQAAAAAHNB0AAAAABzgdAAO4LACEbvAcAAO8LADC9BwAAsQoAEL4HAADvCwAwvwcBANALACHABwEA0AsAIcQHAQDQCwAhxQdAANILACHGB0AA0gsAIdQHAQDcCwAh1gcCAN0LACHYBwEA0AsAIe0HAADmCwAg7gcBANALACHvBwEA0AsAIfAHAQDQCwAh8QcBANwLACHyBwIA3QsAIfMHQADwCwAh9AcCANELACH1BwIA0QsAIfYHQADwCwAh9wdAAPALACH4B0AA8AsAIfkHQADwCwAh-gcgAOULACH7BwIA3QsAIfwHAQDcCwAhCMcHQAAAAAHIB0AAAAAFyQdAAAAABcoHQAAAAAHLB0AAAAABzAdAAAAAAc0HQAAAAAHOB0AA7gsAIRK8BwAA8QsAML0HAACrCgAQvgcAAPELADC_BwEAxQsAIcQHAQDFCwAhxQdAAMcLACHGB0AAxwsAIdQHAQDFCwAh1gcCANULACHXBwEAxQsAIdwHAADgCwAg7wcBANQLACH9BwEA1AsAIf4HAQDUCwAh_wcAAOALACCACEAA7AsAIYEIAgDGCwAhgggCAMYLACESvAcAAPILADC9BwAAmAoAEL4HAADyCwAwvwcBANALACHEBwEA0AsAIcUHQADSCwAhxgdAANILACHUBwEA0AsAIdYHAgDdCwAh1wcBANALACHcBwAA5gsAIO8HAQDcCwAh_QcBANwLACH-BwEA3AsAIf8HAADmCwAggAhAAPALACGBCAIA0QsAIYIIAgDRCwAhDLwHAADzCwAwvQcAAJIKABC-BwAA8wsAML8HAQDFCwAhwAcBANQLACHFB0AAxwsAIcYHQADHCwAhgwgBAMULACGECAEAxQsAIYUIIADfCwAhhgggAN8LACGHCAAA4AsAIAy8BwAA9AsAML0HAAD_CQAQvgcAAPQLADC_BwEA0AsAIcAHAQDcCwAhxQdAANILACHGB0AA0gsAIYMIAQDQCwAhhAgBANALACGFCCAA5QsAIYYIIADlCwAhhwgAAOYLACACwAcBAAAAAYMIAQAAAAEJvAcAAPYLADC9BwAA-QkAEL4HAAD2CwAwvwcBAMULACHABwEA1AsAIcUHQADHCwAhiQgBANQLACGKCAEAxQsAIYsIAQDUCwAhCbwHAAD3CwAwvQcAAOYJABC-BwAA9wsAML8HAQDQCwAhwAcBANwLACHFB0AA0gsAIYkIAQDcCwAhiggBANALACGLCAEA3AsAIRi8BwAA-AsAML0HAADgCQAQvgcAAPgLADC_BwEAxQsAIcAHAQDUCwAhxAcBAMULACHFB0AAxwsAIcYHQADHCwAh1AcBAMULACHtBwAA4AsAIO8HAQDFCwAh_QcBANQLACH-BwEAxQsAIYAIQADHCwAhjAgBAMULACGNCAEA1AsAIY4IAQDUCwAhjwgCAMYLACGQCAIAxgsAIZEIAQDUCwAhkghAAOwLACGTCAEA1AsAIZQIAQDUCwAhlQgBANQLACEYvAcAAPkLADC9BwAAzQkAEL4HAAD5CwAwvwcBANALACHABwEA3AsAIcQHAQDQCwAhxQdAANILACHGB0AA0gsAIdQHAQDQCwAh7QcAAOYLACDvBwEA0AsAIf0HAQDcCwAh_gcBANALACGACEAA0gsAIYwIAQDQCwAhjQgBANwLACGOCAEA3AsAIY8IAgDRCwAhkAgCANELACGRCAEA3AsAIZIIQADwCwAhkwgBANwLACGUCAEA3AsAIZUIAQDcCwAhE7wHAAD6CwAwvQcAAMcJABC-BwAA-gsAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIdQHAQDFCwAh1wcBAMULACHcBwAA4AsAIO8HAQDFCwAh_gcBAMULACGOCAEA1AsAIZYIAQDFCwAhlwgBAMULACGYCCAA3wsAIZkIAQDUCwAhmggBANQLACGbCAAA4AsAIJwIIADfCwAhE7wHAAD7CwAwvQcAALQJABC-BwAA-wsAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIdQHAQDQCwAh1wcBANALACHcBwAA5gsAIO8HAQDQCwAh_gcBANALACGOCAEA3AsAIZYIAQDQCwAhlwgBANALACGYCCAA5QsAIZkIAQDcCwAhmggBANwLACGbCAAA5gsAIJwIIADlCwAhCrwHAAD8CwAwvQcAAK4JABC-BwAA_AsAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIdcHAQDFCwAh2wcgAN8LACHcBwAA4AsAIJ0IAQDFCwAhCrwHAAD9CwAwvQcAAJsJABC-BwAA_QsAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIdcHAQDQCwAh2wcgAOULACHcBwAA5gsAIJ0IAQDQCwAhErwHAAD-CwAwvQcAAJUJABC-BwAA_gsAML8HAQDFCwAhwAcBAMULACHFB0AAxwsAIcYHQADHCwAh3AcAAOALACCeCAEAxQsAIZ8IAQDFCwAhoAhAAMcLACGhCEAA7AsAIaIIAgDVCwAhowgBANQLACGkCAEA1AsAIaUIAgDVCwAhpgggAN8LACGnCAAA4AsAIBK8BwAA_wsAML0HAACCCQAQvgcAAP8LADC_BwEA0AsAIcAHAQDQCwAhxQdAANILACHGB0AA0gsAIdwHAADmCwAgnggBANALACGfCAEA0AsAIaAIQADSCwAhoQhAAPALACGiCAIA3QsAIaMIAQDcCwAhpAgBANwLACGlCAIA3QsAIaYIIADlCwAhpwgAAOYLACALvAcAAIAMADC9BwAA_AgAEL4HAACADAAwvwcBAMULACHABwEAxQsAIdwHAADgCwAgqAgBAMULACGpCAIA1QsAIaoIAQDUCwAhqwhAAMcLACGsCEAA7AsAIQu8BwAAgQwAML0HAADpCAAQvgcAAIEMADC_BwEA0AsAIcAHAQDQCwAh3AcAAOYLACCoCAEA0AsAIakIAgDdCwAhqggBANwLACGrCEAA0gsAIawIQADwCwAhGLwHAACCDAAwvQcAAOMIABC-BwAAggwAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIdcHAQDUCwAh3AcAAOALACCaCAEA1AsAIaAIQADsCwAhpgggAN8LACGsCEAA7AsAIa0IAQDFCwAhrggBANQLACGvCAIA1QsAIbAIAgDVCwAhsQgBAMULACGyCAIA1QsAIbMIAQDUCwAhtAgBANQLACG1CAIA1QsAIbYIAgDGCwAhtwgBANQLACG4CAEA1AsAIRi8BwAAgwwAML0HAADQCAAQvgcAAIMMADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHXBwEA3AsAIdwHAADmCwAgmggBANwLACGgCEAA8AsAIaYIIADlCwAhrAhAAPALACGtCAEA0AsAIa4IAQDcCwAhrwgCAN0LACGwCAIA3QsAIbEIAQDQCwAhsggCAN0LACGzCAEA3AsAIbQIAQDcCwAhtQgCAN0LACG2CAIA0QsAIbcIAQDcCwAhuAgBANwLACEdvAcAAIQMADC9BwAAyggAEL4HAACEDAAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAh1wcBANQLACHbByAA3wsAIdwHAADgCwAgmggBANQLACGmCCAA3wsAIa0IAQDFCwAhsQgBAMULACG5CCAA3wsAIboIAgDGCwAhuwgCANULACG8CAIA1QsAIb0IAgDVCwAhvggCANULACG_CAIA1QsAIcAIIADfCwAhwQggAN8LACHCCCAA3wsAIcMIIADfCwAhxAgBANQLACHFCAAA4AsAIMYIAQDUCwAhxwgBANQLACHICAEA1AsAIR28BwAAhQwAML0HAAC3CAAQvgcAAIUMADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHXBwEA3AsAIdsHIADlCwAh3AcAAOYLACCaCAEA3AsAIaYIIADlCwAhrQgBANALACGxCAEA0AsAIbkIIADlCwAhuggCANELACG7CAIA3QsAIbwIAgDdCwAhvQgCAN0LACG-CAIA3QsAIb8IAgDdCwAhwAggAOULACHBCCAA5QsAIcIIIADlCwAhwwggAOULACHECAEA3AsAIcUIAADmCwAgxggBANwLACHHCAEA3AsAIcgIAQDcCwAhC7wHAACGDAAwvQcAALEIABC-BwAAhgwAML8HAQDFCwAhwAcBANQLACHFB0AAxwsAIdwHAADgCwAgyQgBAMULACHKCAEA1AsAIcsIAQDUCwAhzAhAAOwLACELvAcAAIcMADC9BwAAnggAEL4HAACHDAAwvwcBANALACHABwEA3AsAIcUHQADSCwAh3AcAAOYLACDJCAEA0AsAIcoIAQDcCwAhywgBANwLACHMCEAA8AsAIRa8BwAAiAwAML0HAACYCAAQvgcAAIgMADC_BwEAxQsAIcUHQADHCwAhxgdAAMcLACHXBwEAxQsAIdsHIADfCwAh3AcAAOALACCXCAEAxQsAIbEIAQDFCwAhzQgBANQLACHOCAEA1AsAIc8IAQDUCwAh0AgBANQLACHRCCAA3wsAIdIIIADfCwAh0wggAN8LACHUCCAA3wsAIdUIAQDUCwAh1ggBANQLACHXCAEA1AsAIRa8BwAAiQwAML0HAACFCAAQvgcAAIkMADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHXBwEA0AsAIdsHIADlCwAh3AcAAOYLACCXCAEA0AsAIbEIAQDQCwAhzQgBANwLACHOCAEA3AsAIc8IAQDcCwAh0AgBANwLACHRCCAA5QsAIdIIIADlCwAh0wggAOULACHUCCAA5QsAIdUIAQDcCwAh1ggBANwLACHXCAEA3AsAISu8BwAAigwAML0HAAD_BwAQvgcAAIoMADC_BwEAxQsAIcUHQADHCwAhxgdAAMcLACHbByAA3wsAIdwHAADgCwAggwgBAMULACHYCAEAxQsAIdkIAQDFCwAh2ggBANQLACHbCAEA1AsAIdwIAQDUCwAh3QgBANQLACHeCAEA1AsAId8IAQDUCwAh4AgBANQLACHhCAEA1AsAIeIIAQDUCwAh4wgBANQLACHkCAEAxQsAIeUIAQDUCwAh5ggBAMULACHnCAEAxQsAIegIAQDFCwAh6QgBANQLACHqCAEA1AsAIesIAQDUCwAh7AgBANQLACHtCAEA1AsAIe4IAQDUCwAh7wgCAMYLACHwCAEA1AsAIfEIAgDGCwAh8ggBAMULACHzCAgAiwwAIfQIAQDFCwAh9QgBAMULACH2CAIAxgsAIfcIAgDGCwAh-AgBANQLACH5CAEA1AsAIQ0VAADXCwAgFgAA2AsAIBcAANgLACAYAADYCwAgGQAA2AsAIMcHCAAAAAHIBwgAAAAFyQcIAAAABcoHCAAAAAHLBwgAAAABzAcIAAAAAc0HCAAAAAHOBwgAjAwAIQ0VAADXCwAgFgAA2AsAIBcAANgLACAYAADYCwAgGQAA2AsAIMcHCAAAAAHIBwgAAAAFyQcIAAAABcoHCAAAAAHLBwgAAAABzAcIAAAAAc0HCAAAAAHOBwgAjAwAISu8BwAAjQwAML0HAADsBwAQvgcAAI0MADC_BwEA0AsAIcUHQADSCwAhxgdAANILACHbByAA5QsAIdwHAADmCwAggwgBANALACHYCAEA0AsAIdkIAQDQCwAh2ggBANwLACHbCAEA3AsAIdwIAQDcCwAh3QgBANwLACHeCAEA3AsAId8IAQDcCwAh4AgBANwLACHhCAEA3AsAIeIIAQDcCwAh4wgBANwLACHkCAEA0AsAIeUIAQDcCwAh5ggBANALACHnCAEA0AsAIegIAQDQCwAh6QgBANwLACHqCAEA3AsAIesIAQDcCwAh7AgBANwLACHtCAEA3AsAIe4IAQDcCwAh7wgCANELACHwCAEA3AsAIfEIAgDRCwAh8ggBANALACHzCAgAjgwAIfQIAQDQCwAh9QgBANALACH2CAIA0QsAIfcIAgDRCwAh-AgBANwLACH5CAEA3AsAIQjHBwgAAAAByAcIAAAABckHCAAAAAXKBwgAAAABywcIAAAAAcwHCAAAAAHNBwgAAAABzgcIANgLACERvAcAAI8MADC9BwAA5gcAEL4HAACPDAAwvwcBAMULACHcBwAA4AsAIJoIAQDUCwAhuggCAMYLACH6CAEAxQsAIfsICACQDAAh_AgCAMYLACH9CAIAxgsAIf4ICACLDAAh_wgCAMYLACGACQIAxgsAIYEJAgDGCwAhgglAAOwLACGDCUAA7AsAIQ0VAADJCwAgFgAAzAsAIBcAAMwLACAYAADMCwAgGQAAzAsAIMcHCAAAAAHIBwgAAAAEyQcIAAAABMoHCAAAAAHLBwgAAAABzAcIAAAAAc0HCAAAAAHOBwgAkQwAIQ0VAADJCwAgFgAAzAsAIBcAAMwLACAYAADMCwAgGQAAzAsAIMcHCAAAAAHIBwgAAAAEyQcIAAAABMoHCAAAAAHLBwgAAAABzAcIAAAAAc0HCAAAAAHOBwgAkQwAIRG8BwAAkgwAML0HAADTBwAQvgcAAJIMADC_BwEA0AsAIdwHAADmCwAgmggBANwLACG6CAIA0QsAIfoIAQDQCwAh-wgIAJMMACH8CAIA0QsAIf0IAgDRCwAh_ggIAI4MACH_CAIA0QsAIYAJAgDRCwAhgQkCANELACGCCUAA8AsAIYMJQADwCwAhCMcHCAAAAAHIBwgAAAAEyQcIAAAABMoHCAAAAAHLBwgAAAABzAcIAAAAAc0HCAAAAAHOBwgAzAsAIS-8BwAAlAwAML0HAADNBwAQvgcAAJQMADC_BwEAxQsAIcAHAQDFCwAhxAcBANQLACHFB0AAxwsAIcYHQADHCwAh3AcAAOALACCKCAEA1AsAIaoIAQDUCwAhsQgBANQLACHJCAEAxQsAIfIIAQDUCwAh_QgCANULACH-CAgAiwwAIf8IAgDVCwAhgQkCANULACGCCUAA7AsAIYMJQADsCwAhhAkBANQLACGFCQIA1QsAIYYJAgDVCwAhhwlAAOwLACGICUAA7AsAIYkJAQDUCwAhigkBANQLACGLCQEA1AsAIYwJAQDUCwAhjQkBANQLACGOCQEA1AsAIY8JQADsCwAhkAkCANULACGRCQEA1AsAIZIJAQDUCwAhkwkBANQLACGUCQEA1AsAIZUJAQDUCwAhlgkBANQLACGXCQEA1AsAIZgJAQDUCwAhmQkBANQLACGaCQEA1AsAIZsJAQDUCwAhnAkBANQLACGdCQEA1AsAIZ4JAADgCwAgL7wHAACVDAAwvQcAALoHABC-BwAAlQwAML8HAQDQCwAhwAcBANALACHEBwEA3AsAIcUHQADSCwAhxgdAANILACHcBwAA5gsAIIoIAQDcCwAhqggBANwLACGxCAEA3AsAIckIAQDQCwAh8ggBANwLACH9CAIA3QsAIf4ICACODAAh_wgCAN0LACGBCQIA3QsAIYIJQADwCwAhgwlAAPALACGECQEA3AsAIYUJAgDdCwAhhgkCAN0LACGHCUAA8AsAIYgJQADwCwAhiQkBANwLACGKCQEA3AsAIYsJAQDcCwAhjAkBANwLACGNCQEA3AsAIY4JAQDcCwAhjwlAAPALACGQCQIA3QsAIZEJAQDcCwAhkgkBANwLACGTCQEA3AsAIZQJAQDcCwAhlQkBANwLACGWCQEA3AsAIZcJAQDcCwAhmAkBANwLACGZCQEA3AsAIZoJAQDcCwAhmwkBANwLACGcCQEA3AsAIZ0JAQDcCwAhngkAAOYLACAYvAcAAJYMADC9BwAAtAcAEL4HAACWDAAwvwcBAMULACHABwEAxQsAIcQHAQDUCwAhxQdAAMcLACHGB0AAxwsAIdwHAADgCwAgqAgBANQLACHJCAEAxQsAIZ8JAQDUCwAhoAkBANQLACGhCQEA1AsAIaIJQADsCwAhowlAAOwLACGkCUAA7AsAIaUJQADsCwAhpglAAOwLACGnCUAA7AsAIagJAQDUCwAhqQlAAOwLACGqCUAA7AsAIasJIADfCwAhGLwHAACXDAAwvQcAAKEHABC-BwAAlwwAML8HAQDQCwAhwAcBANALACHEBwEA3AsAIcUHQADSCwAhxgdAANILACHcBwAA5gsAIKgIAQDcCwAhyQgBANALACGfCQEA3AsAIaAJAQDcCwAhoQkBANwLACGiCUAA8AsAIaMJQADwCwAhpAlAAPALACGlCUAA8AsAIaYJQADwCwAhpwlAAPALACGoCQEA3AsAIakJQADwCwAhqglAAPALACGrCSAA5QsAIRC8BwAAmAwAML0HAACbBwAQvgcAAJgMADC_BwEAxQsAIcAHAQDFCwAhxQdAAMcLACHGB0AAxwsAIdwHAADgCwAgpwgAAOALACC9CAIA1QsAIb4IAgDVCwAhvwgCANULACHACCAA3wsAIcEIIADfCwAhwgggAN8LACHDCCAA3wsAIRC8BwAAmQwAML0HAACIBwAQvgcAAJkMADC_BwEA0AsAIcAHAQDQCwAhxQdAANILACHGB0AA0gsAIdwHAADmCwAgpwgAAOYLACC9CAIA3QsAIb4IAgDdCwAhvwgCAN0LACHACCAA5QsAIcEIIADlCwAhwgggAOULACHDCCAA5QsAIQq8BwAAmgwAML0HAACCBwAQvgcAAJoMADC_BwEAxQsAIcAHAQDFCwAhxQdAAMcLACHGB0AAxwsAIdwHAADgCwAgqQgCAMYLACGsCQEAxQsAIQq8BwAAmwwAML0HAADvBgAQvgcAAJsMADC_BwEA0AsAIcAHAQDQCwAhxQdAANILACHGB0AA0gsAIdwHAADmCwAgqQgCANELACGsCQEA0AsAIQLABwEAAAABqQgCAAAAAQu8BwAAnQwAML0HAADpBgAQvgcAAJ0MADC_BwEAxQsAIcQHAQDUCwAhxQdAAMcLACHGB0AAxwsAIdcHAQDUCwAh3AcAAOALACCfCQEA1AsAIa4JAQDFCwAhC7wHAACeDAAwvQcAANYGABC-BwAAngwAML8HAQDQCwAhxAcBANwLACHFB0AA0gsAIcYHQADSCwAh1wcBANwLACHcBwAA5gsAIJ8JAQDcCwAhrgkBANALACEFvAcAAJ8MADC9BwAA0AYAEL4HAACfDAAwlggBAMULACGvCQAAoAwAIA8VAADJCwAgGAAAoQwAIBkAAKEMACDHB4AAAAABygeAAAAAAcsHgAAAAAHMB4AAAAABzQeAAAAAAc4HgAAAAAHdBwEAAAAB3gcBAAAAAd8HAQAAAAHgB4AAAAAB4QeAAAAAAeIHgAAAAAEMxweAAAAAAcoHgAAAAAHLB4AAAAABzAeAAAAAAc0HgAAAAAHOB4AAAAAB3QcBAAAAAd4HAQAAAAHfBwEAAAAB4AeAAAAAAeEHgAAAAAHiB4AAAAABBbwHAACiDAAwvQcAAL0GABC-BwAAogwAMJYIAQDQCwAhrwkAAKMMACAMxweAAAAAAcoHgAAAAAHLB4AAAAABzAeAAAAAAc0HgAAAAAHOB4AAAAAB3QcBAAAAAd4HAQAAAAHfBwEAAAAB4AeAAAAAAeEHgAAAAAHiB4AAAAABDbwHAACkDAAwvQcAALcGABC-BwAApAwAML8HAgDGCwAhxQdAAMcLACHGB0AAxwsAIdcHAQDUCwAhiggBANQLACGwCQEA1AsAIbEJAADgCwAgsgkgAN8LACGzCQAA4AsAILQJQADsCwAhDbwHAAClDAAwvQcAAKQGABC-BwAApQwAML8HAgDRCwAhxQdAANILACHGB0AA0gsAIdcHAQDcCwAhiggBANwLACGwCQEA3AsAIbEJAADmCwAgsgkgAOULACGzCQAA5gsAILQJQADwCwAhC7wHAACmDAAwvQcAAJ4GABC-BwAApgwAML8HAQDFCwAhxQdAAMcLACHGB0AAxwsAIYMIAQDUCwAhpAgBANQLACGzCQAA4AsAILQJQADsCwAhtQkBANQLACELvAcAAKcMADC9BwAAiwYAEL4HAACnDAAwvwcBANALACHFB0AA0gsAIcYHQADSCwAhgwgBANwLACGkCAEA3AsAIbMJAADmCwAgtAlAAPALACG1CQEA3AsAIQ68BwAAqAwAML0HAACFBgAQvgcAAKgMADC_BwEAxQsAIcUHQADHCwAhxgdAAMcLACGKCAEA1AsAIbAJAQDUCwAhswkAAOALACC0CUAA7AsAIbYJAQDUCwAhtwkBANQLACG4CQIA1QsAIbkJAgDVCwAhDrwHAACpDAAwvQcAAPIFABC-BwAAqQwAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIYoIAQDcCwAhsAkBANwLACGzCQAA5gsAILQJQADwCwAhtgkBANwLACG3CQEA3AsAIbgJAgDdCwAhuQkCAN0LACEQvAcAAKoMADC9BwAA7AUAEL4HAACqDAAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAhgwgBANQLACHJCAEA1AsAIbMJAADgCwAgtAlAAOwLACG6CQEA1AsAIbsJAQDUCwAhvAkBANQLACG9CUAA7AsAIb4JAQDUCwAhvwkBANQLACEQvAcAAKsMADC9BwAA2QUAEL4HAACrDAAwvwcBANALACHFB0AA0gsAIcYHQADSCwAhgwgBANwLACHJCAEA3AsAIbMJAADmCwAgtAlAAPALACG6CQEA3AsAIbsJAQDcCwAhvAkBANwLACG9CUAA8AsAIb4JAQDcCwAhvwkBANwLACENvAcAAKwMADC9BwAA0wUAEL4HAACsDAAwvwcBAMULACHEBwEA1AsAIcUHQADHCwAhxgdAAMcLACGDCAEA1AsAIckIAQDUCwAhswkAAOALACC0CUAA7AsAIcAJAQDUCwAhwQkAAOALACANvAcAAK0MADC9BwAAwAUAEL4HAACtDAAwvwcBANALACHEBwEA3AsAIcUHQADSCwAhxgdAANILACGDCAEA3AsAIckIAQDcCwAhswkAAOYLACC0CUAA8AsAIcAJAQDcCwAhwQkAAOYLACANvAcAAK4MADC9BwAAugUAEL4HAACuDAAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAh1wcBANQLACGDCAEA1AsAIbMJAADgCwAgtAlAAOwLACHACQEA1AsAIcIJAQDUCwAhwwlAAOwLACENvAcAAK8MADC9BwAApwUAEL4HAACvDAAwvwcBANALACHFB0AA0gsAIcYHQADSCwAh1wcBANwLACGDCAEA3AsAIbMJAADmCwAgtAlAAPALACHACQEA3AsAIcIJAQDcCwAhwwlAAPALACEJvAcAALAMADC9BwAAoQUAEL4HAACwDAAwxQdAAMcLACHGB0AAxwsAIdIHAQDUCwAhswkAAOALACDCCQEA1AsAIcQJAgDGCwAhCbwHAACxDAAwvQcAAI4FABC-BwAAsQwAMMUHQADSCwAhxgdAANILACHSBwEA3AsAIbMJAADmCwAgwgkBANwLACHECQIA0QsAIQe8BwAAsgwAML0HAACIBQAQvgcAALIMADDFB0AAxwsAIcYHQADHCwAh1wcBAMULACGvCQIAxgsAIQe8BwAAswwAML0HAAD1BAAQvgcAALMMADDFB0AA0gsAIcYHQADSCwAh1wcBANALACGvCQIA0QsAIQ28BwAAtAwAML0HAADvBAAQvgcAALQMADC_BwIAxgsAIcUHQADHCwAhxgdAAMcLACGDCAEA1AsAIaYIIADfCwAhswkAAOALACC0CUAA7AsAIcUJAQDFCwAhxgkBANQLACHHCSAA3wsAIQ28BwAAtQwAML0HAADcBAAQvgcAALUMADC_BwIA0QsAIcUHQADSCwAhxgdAANILACGDCAEA3AsAIaYIIADlCwAhswkAAOYLACC0CUAA8AsAIcUJAQDQCwAhxgkBANwLACHHCSAA5QsAIQy8BwAAtgwAML0HAADWBAAQvgcAALYMADC_BwEAxQsAIcUHQADHCwAh3AcAAOALACDCCQEA1AsAIcQJAgDVCwAhyAkBANQLACHJCQEA1AsAIcoJAQDUCwAhywkBANQLACEMvAcAALcMADC9BwAAwwQAEL4HAAC3DAAwvwcBANALACHFB0AA0gsAIdwHAADmCwAgwgkBANwLACHECQIA3QsAIcgJAQDcCwAhyQkBANwLACHKCQEA3AsAIcsJAQDcCwAhCrwHAAC4DAAwvQcAAL0EABC-BwAAuAwAML8HAQDFCwAhxQdAAMcLACHcBwAA4AsAIIoIAQDUCwAhxAkCANULACHJCQEA1AsAIcsJAQDUCwAhCrwHAAC5DAAwvQcAAKoEABC-BwAAuQwAML8HAQDQCwAhxQdAANILACHcBwAA5gsAIIoIAQDcCwAhxAkCAN0LACHJCQEA3AsAIcsJAQDcCwAhB7wHAAC6DAAwvQcAAKQEABC-BwAAugwAML8HAQDFCwAhxQdAAMcLACHcBwAA4AsAILAJAQDUCwAhB7wHAAC7DAAwvQcAAJEEABC-BwAAuwwAML8HAQDQCwAhxQdAANILACHcBwAA5gsAILAJAQDcCwAhCLwHAAC8DAAwvQcAAIsEABC-BwAAvAwAML8HAQDFCwAhxQdAAMcLACHcBwAA4AsAIL4JAQDUCwAhxAkCANULACEIvAcAAL0MADC9BwAA-AMAEL4HAAC9DAAwvwcBANALACHFB0AA0gsAIdwHAADmCwAgvgkBANwLACHECQIA3QsAIQq8BwAAvgwAML0HAADyAwAQvgcAAL4MADC_BwEAxQsAIcQHAQDUCwAhxQdAAMcLACHSBwEA1AsAIdgHAQDUCwAh3AcAAOALACCHCQEA1AsAIQq8BwAAvwwAML0HAADfAwAQvgcAAL8MADC_BwEA0AsAIcQHAQDcCwAhxQdAANILACHSBwEA3AsAIdgHAQDcCwAh3AcAAOYLACCHCQEA3AsAIQu8BwAAwAwAML0HAADZAwAQvgcAAMAMADC_BwEAxQsAIcQHAQDUCwAhxQdAAMcLACHSBwEA1AsAIdwHAADgCwAgxAkCANULACHMCUAA7AsAIc0JAQDUCwAhC7wHAADBDAAwvQcAAMYDABC-BwAAwQwAML8HAQDQCwAhxAcBANwLACHFB0AA0gsAIdIHAQDcCwAh3AcAAOYLACDECQIA3QsAIcwJQADwCwAhzQkBANwLACENvAcAAMIMADC9BwAAwAMAEL4HAADCDAAwvwcBAMULACHEBwEA1AsAIcUHQADHCwAh3AcAAOALACDlBwEA1AsAIboJAQDUCwAhxAkCANULACHOCQEA1AsAIc8JAQDUCwAh0AkBANQLACENvAcAAMMMADC9BwAArQMAEL4HAADDDAAwvwcBANALACHEBwEA3AsAIcUHQADSCwAh3AcAAOYLACDlBwEA3AsAIboJAQDcCwAhxAkCAN0LACHOCQEA3AsAIc8JAQDcCwAh0AkBANwLACEJvAcAAMQMADC9BwAApwMAEL4HAADEDAAwvwcBAMULACHcBwAA4AsAIOUHAQDUCwAh5gcBANQLACHOCQEA1AsAIc8JAQDUCwAhCbwHAADFDAAwvQcAAJQDABC-BwAAxQwAML8HAQDQCwAh3AcAAOYLACDlBwEA3AsAIeYHAQDcCwAhzgkBANwLACHPCQEA3AsAIQ-8BwAAxgwAML0HAACOAwAQvgcAAMYMADC_BwEAxQsAIdMHAQDUCwAh3AcAAOALACDjBwEA1AsAIe8HAQDUCwAhugkBANQLACHPCQEA1AsAIdEJAQDUCwAh0gkBANQLACHTCUAA7AsAIdQJAQDUCwAh1QkgAN8LACEPvAcAAMcMADC9BwAA-wIAEL4HAADHDAAwvwcBANALACHTBwEA3AsAIdwHAADmCwAg4wcBANwLACHvBwEA3AsAIboJAQDcCwAhzwkBANwLACHRCQEA3AsAIdIJAQDcCwAh0wlAAPALACHUCQEA3AsAIdUJIADlCwAhCbwHAADIDAAwvQcAAPUCABC-BwAAyAwAML8HAQDFCwAh3AcAAOALACDTCQEA1AsAIdYJAQDFCwAh1wkIAIsMACHYCQEA1AsAIQm8BwAAyQwAML0HAADiAgAQvgcAAMkMADC_BwEA0AsAIdwHAADmCwAg0wkBANwLACHWCQEA0AsAIdcJCACODAAh2AkBANwLACERvAcAAMoMADC9BwAA3AIAEL4HAADKDAAwvwcBAMULACHEBwEA1AsAIcUHQADHCwAhxgdAAMcLACHcBwAA4AsAIIYJCACLDAAhhwkBANQLACGwCQEA1AsAIdAJAQDUCwAh1wkIAIsMACHZCQEA1AsAIdoJAQDUCwAh2wkBANQLACHcCQIA1QsAIRG8BwAAywwAML0HAADJAgAQvgcAAMsMADC_BwEA0AsAIcQHAQDcCwAhxQdAANILACHGB0AA0gsAIdwHAADmCwAghgkIAI4MACGHCQEA3AsAIbAJAQDcCwAh0AkBANwLACHXCQgAjgwAIdkJAQDcCwAh2gkBANwLACHbCQEA3AsAIdwJAgDdCwAhBbwHAADMDAAwvQcAAMMCABC-BwAAzAwAMMQJAgDGCwAh3QkBAMULACEFvAcAAM0MADC9BwAAsAIAEL4HAADNDAAwxAkCANELACHdCQEA0AsAIQLECQIAAAAB3QkBAAAAAQ68BwAAzwwAML0HAACqAgAQvgcAAM8MADC_BwEAxQsAIcAHAQDUCwAhxAcBANQLACHFB0AAxwsAIcYHQADHCwAh1AcBANQLACHXBwEA1AsAIdwHAADgCwAgrgkBANQLACHfCQEA1AsAIeAJAQDUCwAhDrwHAADQDAAwvQcAAJcCABC-BwAA0AwAML8HAQDQCwAhwAcBANwLACHEBwEA3AsAIcUHQADSCwAhxgdAANILACHUBwEA3AsAIdcHAQDcCwAh3AcAAOYLACCuCQEA3AsAId8JAQDcCwAh4AkBANwLACEHvAcAANEMADC9BwAAkQIAEL4HAADRDAAwwAcBANQLACGsCQEA1AsAIcQJAgDGCwAh4QkCAMYLACEHvAcAANIMADC9BwAA_gEAEL4HAADSDAAwwAcBANwLACGsCQEA3AsAIcQJAgDRCwAh4QkCANELACECxAkCAAAAAeEJAgAAAAEIvAcAANQMADC9BwAA-AEAEL4HAADUDAAwvwcCAMYLACHABwEA1AsAIdcHAQDUCwAh3AcAAOALACCuCQEA1AsAIQi8BwAA1QwAML0HAADlAQAQvgcAANUMADC_BwIA0QsAIcAHAQDcCwAh1wcBANwLACHcBwAA5gsAIK4JAQDcCwAhCLwHAADWDAAwvQcAAN8BABC-BwAA1gwAML8HAgDGCwAhwAcBANQLACHXBwEA1AsAIdwHAADgCwAgrgkBANQLACEIvAcAANcMADC9BwAAzAEAEL4HAADXDAAwvwcCANELACHABwEA3AsAIdcHAQDcCwAh3AcAAOYLACCuCQEA3AsAIQW8BwAA2AwAML0HAADGAQAQvgcAANgMADDECQIAxgsAIeMJAgDGCwAhBbwHAADZDAAwvQcAALMBABC-BwAA2QwAMMQJAgDRCwAh4wkCANELACECxAkCAAAAAeMJAgAAAAEKvAcAANsMADC9BwAArQEAEL4HAADbDAAwvwcCAMYLACHABwEA1AsAIdcHAQDUCwAh3AcAAOALACCuCQEA1AsAIeAJAQDUCwAh5QkBANQLACEKvAcAANwMADC9BwAAmgEAEL4HAADcDAAwvwcCANELACHABwEA3AsAIdcHAQDcCwAh3AcAAOYLACCuCQEA3AsAIeAJAQDcCwAh5QkBANwLACEPvAcAAN0MADC9BwAAlAEAEL4HAADdDAAwvwcBAMULACHFB0AAxwsAIcYHQADHCwAhwgkBANQLACHECQIA1QsAIeYJAQDUCwAh5wkBANQLACHoCQEA1AsAIekJAQDUCwAh6gkBANQLACHrCSAA3wsAIewJAADgCwAgD7wHAADeDAAwvQcAAIEBABC-BwAA3gwAML8HAQDQCwAhxQdAANILACHGB0AA0gsAIcIJAQDcCwAhxAkCAN0LACHmCQEA3AsAIecJAQDcCwAh6AkBANwLACHpCQEA3AsAIeoJAQDcCwAh6wkgAOULACHsCQAA5gsAIAu8BwAA3wwAML0HAAB7ABC-BwAA3wwAML8HAQDFCwAhxQdAAMcLACHcBwAA4AsAIMIJAQDUCwAhxAkCAMYLACHqCQEA1AsAIe0JAQDUCwAh7glAAOwLACELvAcAAOAMADC9BwAAaAAQvgcAAOAMADC_BwEA0AsAIcUHQADSCwAh3AcAAOYLACDCCQEA3AsAIcQJAgDRCwAh6gkBANwLACHtCQEA3AsAIe4JQADwCwAhBrwHAADhDAAwvQcAAGIAEL4HAADhDAAw3AcAAOALACDECQIAxgsAIe8JAQDUCwAhBrwHAADiDAAwvQcAAE8AEL4HAADiDAAw3AcAAOYLACDECQIA0QsAIe8JAQDcCwAhCLwHAADjDAAwvQcAAEkAEL4HAADjDAAwvwcBAMULACHFB0AAxwsAIdwHAADgCwAgsAkBANQLACHECQIAxgsAIQi8BwAA5AwAML0HAAA2ABC-BwAA5AwAML8HAQDQCwAhxQdAANILACHcBwAA5gsAILAJAQDcCwAhxAkCANELACELvAcAAOUMADC9BwAAMAAQvgcAAOUMADC_BwEAxQsAIcAHAQDUCwAh3AcAAOALACDlBwEA1AsAIeYHAQDUCwAh5wcCANULACHECQIAxgsAIdAJAQDFCwAhC7wHAADmDAAwvQcAAB0AEL4HAADmDAAwvwcBANALACHABwEA3AsAIdwHAADmCwAg5QcBANwLACHmBwEA3AsAIecHAgDdCwAhxAkCANELACHQCQEA0AsAIRi8BwAA5wwAML0HAAAXABC-BwAA5wwAML8HAgDGCwAhwAcBANQLACHFB0AAxwsAIcYHQADHCwAh0gcBANQLACHcBwAA4AsAIOYHAQDUCwAhtAlAAOwLACHhCQIA1QsAIe8JAQDUCwAh8AlAAOwLACHxCQEA1AsAIfIJQADsCwAh8wlAAOwLACH0CQIA1QsAIfUJAQDUCwAh9gkBANQLACH3CQEA1AsAIfgJAQDUCwAh-QkCANULACH6CSAA3wsAIRi8BwAA6AwAML0HAAAEABC-BwAA6AwAML8HAgDRCwAhwAcBANwLACHFB0AA0gsAIcYHQADSCwAh0gcBANwLACHcBwAA5gsAIOYHAQDcCwAhtAlAAPALACHhCQIA3QsAIe8JAQDcCwAh8AlAAPALACHxCQEA3AsAIfIJQADwCwAh8wlAAPALACH0CQIA3QsAIfUJAQDcCwAh9gkBANwLACH3CQEA3AsAIfgJAQDcCwAh-QkCAN0LACH6CSAA5QsAIQAAAAAAAfsJAQAAAAEF-wkCAAAAAfwJAgAAAAH9CQIAAAAB_gkCAAAAAf8JAgAAAAEB-wlAAAAAAQAAAAAAAAH7CQEAAAABBfsJAgAAAAH8CQIAAAAB_QkCAAAAAf4JAgAAAAH_CQIAAAABAAAAAAAB-wkgAAAAAQAAAAAAAAAAAAAAAAAAAAH7CUAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAF-wkIAAAAAfwJCAAAAAH9CQgAAAAB_gkIAAAAAf8JCAAAAAEAAAAAAAX7CQgAAAAB_AkIAAAAAf0JCAAAAAH-CQgAAAAB_wkIAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFFQAGFgAHFwAIGAAJGQAKAAAAAAAFFQAGFgAHFwAIGAAJGQAKAAAABRUAEBYAERcAEhgAExkAFAAAAAAABRUAEBYAERcAEhgAExkAFAAAAAUVABoWABsXABwYAB0ZAB4AAAAAAAUVABoWABsXABwYAB0ZAB4AAAAFFQAkFgAlFwAmGAAnGQAoAAAAAAAFFQAkFgAlFwAmGAAnGQAoAAAABRUALhYALxcAMBgAMRkAMgAAAAAABRUALhYALxcAMBgAMRkAMgAAAAUVADgWADkXADoYADsZADwAAAAAAAUVADgWADkXADoYADsZADwAAAAFFQBCFgBDFwBEGABFGQBGAAAAAAAFFQBCFgBDFwBEGABFGQBGAAAABRUATBYATRcAThgATxkAUAAAAAAABRUATBYATRcAThgATxkAUAAAAAUVAFYWAFcXAFgYAFkZAFoAAAAAAAUVAFYWAFcXAFgYAFkZAFoAAAAFFQBgFgBhFwBiGABjGQBkAAAAAAAFFQBgFgBhFwBiGABjGQBkAAAABRUAahYAaxcAbBgAbRkAbgAAAAAABRUAahYAaxcAbBgAbRkAbgAAAAMVAHQYAHUZAHYAAAADFQB0GAB1GQB2AAAABRUAfBYAfRcAfhgAfxkAgAEAAAAAAAUVAHwWAH0XAH4YAH8ZAIABAAAABRUAhgEWAIcBFwCIARgAiQEZAIoBAAAAAAAFFQCGARYAhwEXAIgBGACJARkAigEAAAAFFQCQARYAkQEXAJIBGACTARkAlAEAAAAAAAUVAJABFgCRARcAkgEYAJMBGQCUAQAAAAMVAJoBGACbARkAnAEAAAADFQCaARgAmwEZAJwBAAAAAxUAogEYAKMBGQCkAQAAAAMVAKIBGACjARkApAEAAAAFFQCqARYAqwEXAKwBGACtARkArgEAAAAAAAUVAKoBFgCrARcArAEYAK0BGQCuAQAAAAUVALQBFgC1ARcAtgEYALcBGQC4AQAAAAAABRUAtAEWALUBFwC2ARgAtwEZALgBAAAAAxUAvgEYAL8BGQDAAQAAAAMVAL4BGAC_ARkAwAEAAAAFFQDGARYAxwEXAMgBGADJARkAygEAAAAAAAUVAMYBFgDHARcAyAEYAMkBGQDKAQAAAAMVANABGADRARkA0gEAAAADFQDQARgA0QEZANIBAAAABRUA2AEWANkBFwDaARgA2wEZANwBAAAAAAAFFQDYARYA2QEXANoBGADbARkA3AEAAAAFFQDiARYA4wEXAOQBGADlARkA5gEAAAAAAAUVAOIBFgDjARcA5AEYAOUBGQDmAQAAAAUVAOwBFgDtARcA7gEYAO8BGQDwAQAAAAAABRUA7AEWAO0BFwDuARgA7wEZAPABAAAABRUA9gEWAPcBFwD4ARgA-QEZAPoBAAAAAAAFFQD2ARYA9wEXAPgBGAD5ARkA-gEAAAAFFQCAAhYAgQIXAIICGACDAhkAhAIAAAAAAAUVAIACFgCBAhcAggIYAIMCGQCEAgAAAAMVAIoCGACLAhkAjAIAAAADFQCKAhgAiwIZAIwCAAAAAxUAkgIYAJMCGQCUAgAAAAMVAJICGACTAhkAlAIAAAADFQCaAhgAmwIZAJwCAAAAAxUAmgIYAJsCGQCcAgAAAAUVAKICFgCjAhcApAIYAKUCGQCmAgAAAAAABRUAogIWAKMCFwCkAhgApQIZAKYCAAAAAxUArAIYAK0CGQCuAgAAAAMVAKwCGACtAhkArgIAAAAFFQC0AhYAtQIXALYCGAC3AhkAuAIAAAAAAAUVALQCFgC1AhcAtgIYALcCGQC4AgAAAAMVAL4CGAC_AhkAwAIAAAADFQC-AhgAvwIZAMACAAAAAxUAxgIYAMcCGQDIAgAAAAMVAMYCGADHAhkAyAIAAAAFFQDOAhYAzwIXANACGADRAhkA0gIAAAAAAAUVAM4CFgDPAhcA0AIYANECGQDSAgAAAAUVANgCFgDZAhcA2gIYANsCGQDcAgAAAAAABRUA2AIWANkCFwDaAhgA2wIZANwCAAAAAxUA4gIYAOMCGQDkAgAAAAMVAOICGADjAhkA5AIAAAAFFQDqAhYA6wIXAOwCGADtAhkA7gIAAAAAAAUVAOoCFgDrAhcA7AIYAO0CGQDuAgAAAAUVAPQCFgD1AhcA9gIYAPcCGQD4AgAAAAAABRUA9AIWAPUCFwD2AhgA9wIZAPgCAAAABRUA_gIWAP8CFwCAAxgAgQMZAIIDAAAAAAAFFQD-AhYA_wIXAIADGACBAxkAggMAAAADFQCIAxgAiQMZAIoDAAAAAxUAiAMYAIkDGQCKAwAAAAMVAJADGACRAxkAkgMAAAADFQCQAxgAkQMZAJIDAAAABRUAmAMWAJkDFwCaAxgAmwMZAJwDAAAAAAAFFQCYAxYAmQMXAJoDGACbAxkAnAMAAAAFFQCiAxYAowMXAKQDGAClAxkApgMAAAAAAAUVAKIDFgCjAxcApAMYAKUDGQCmAwAAAAUVAKwDFgCtAxcArgMYAK8DGQCwAwAAAAAABRUArAMWAK0DFwCuAxgArwMZALADAAAABRUAtgMWALcDFwC4AxgAuQMZALoDAAAAAAAFFQC2AxYAtwMXALgDGAC5AxkAugMAAAADFQDAAxgAwQMZAMIDAAAAAxUAwAMYAMEDGQDCAwAAAAMVAMgDGADJAxkAygMAAAADFQDIAxgAyQMZAMoDAAAABRUA0AMWANEDFwDSAxgA0wMZANQDAAAAAAAFFQDQAxYA0QMXANIDGADTAxkA1AMAAAADFQDaAxgA2wMZANwDAAAAAxUA2gMYANsDGQDcAwAAAAMVAOIDGADjAxkA5AMAAAADFQDiAxgA4wMZAOQDAAAABRUA6gMWAOsDFwDsAxgA7QMZAO4DAAAAAAAFFQDqAxYA6wMXAOwDGADtAxkA7gMAAAAFFQD0AxYA9QMXAPYDGAD3AxkA-AMAAAAAAAUVAPQDFgD1AxcA9gMYAPcDGQD4AwAAAAUVAP4DFgD_AxcAgAQYAIEEGQCCBAAAAAAABRUA_gMWAP8DFwCABBgAgQQZAIIEAAAABRUAiAQWAIkEFwCKBBgAiwQZAIwEAAAAAAAFFQCIBBYAiQQXAIoEGACLBBkAjAQAAAAFFQCSBBYAkwQXAJQEGACVBBkAlgQAAAAAAAUVAJIEFgCTBBcAlAQYAJUEGQCWBAAAAAUVAJwEFgCdBBcAngQYAJ8EGQCgBAAAAAAABRUAnAQWAJ0EFwCeBBgAnwQZAKAEAAAABRUApgQWAKcEFwCoBBgAqQQZAKoEAAAAAAAFFQCmBBYApwQXAKgEGACpBBkAqgQBAgECAwEFBgEGBwEHCAEJCgEKDAILDQMMDwENEQIOEgQREwESFAETFQIaGAUbGQscGwwdHAweHwwfIAwgIQwhIwwiJQIjJg0kKAwlKgImKw4nLAwoLQwpLgIqMQ8rMhUsNBYtNRYuOBYvORYwOhYxPBYyPgIzPxc0QRY1QwI2RBg3RRY4RhY5RwI6Shk7Sx88TSA9TiA-USA_UiBAUyBBVSBCVwJDWCFEWiBFXAJGXSJHXiBIXyBJYAJKYyNLZClMZipNZypOaipPaypQbCpRbipScAJTcStUcypVdQJWdixXdypYeCpZeQJafC1bfTNcfzRdgAE0XoMBNF-EATRghQE0YYcBNGKJAQJjigE1ZIwBNGWOAQJmjwE2Z5ABNGiRATRpkgECapUBN2uWAT1smAE-bZkBPm6cAT5vnQE-cJ4BPnGgAT5yogECc6MBP3SlAT51pwECdqgBQHepAT54qgE-easBAnquAUF7rwFHfLEBSH2yAUh-tQFIf7YBSIABtwFIgQG5AUiCAbsBAoMBvAFJhAG-AUiFAcABAoYBwQFKhwHCAUiIAcMBSIkBxAECigHHAUuLAcgBUYwBygFSjQHLAVKOAc4BUo8BzwFSkAHQAVKRAdIBUpIB1AECkwHVAVOUAdcBUpUB2QEClgHaAVSXAdsBUpgB3AFSmQHdAQKaAeABVZsB4QFbnAHjAVydAeQBXJ4B5wFcnwHoAVygAekBXKEB6wFcogHtAQKjAe4BXaQB8AFcpQHyAQKmAfMBXqcB9AFcqAH1AVypAfYBAqoB-QFfqwH6AWWsAfwBZq0B_QFmrgGAAmavAYECZrABggJmsQGEAmayAYYCArMBhwJntAGJAma1AYsCArYBjAJotwGNAma4AY4CZrkBjwICugGSAmm7AZMCb7wBlQJwvQGWAnC-AZkCcL8BmgJwwAGbAnDBAZ0CcMIBnwICwwGgAnHEAaICcMUBpAICxgGlAnLHAaYCcMgBpwJwyQGoAgLKAasCc8sBrAJ3zAGuAnjNAa8CeM4BsgJ4zwGzAnjQAbQCeNEBtgJ40gG4AgLTAbkCedQBuwJ41QG9AgLWAb4CetcBvwJ42AHAAnjZAcECAtoBxAJ72wHFAoEB3AHHAoIB3QHIAoIB3gHLAoIB3wHMAoIB4AHNAoIB4QHPAoIB4gHRAgLjAdICgwHkAdQCggHlAdYCAuYB1wKEAecB2AKCAegB2QKCAekB2gIC6gHdAoUB6wHeAosB7AHgAowB7QHhAowB7gHkAowB7wHlAowB8AHmAowB8QHoAowB8gHqAgLzAesCjQH0Ae0CjAH1Ae8CAvYB8AKOAfcB8QKMAfgB8gKMAfkB8wIC-gH2Ao8B-wH3ApUB_AH5ApYB_QH6ApYB_gH9ApYB_wH-ApYBgAL_ApYBgQKBA5YBggKDAwKDAoQDlwGEAoYDlgGFAogDAoYCiQOYAYcCigOWAYgCiwOWAYkCjAMCigKPA5kBiwKQA50BjAKSA54BjQKTA54BjgKWA54BjwKXA54BkAKYA54BkQKaA54BkgKcAwKTAp0DnwGUAp8DngGVAqEDApYCogOgAZcCowOeAZgCpAOeAZkCpQMCmgKoA6EBmwKpA6UBnAKrA6YBnQKsA6YBngKvA6YBnwKwA6YBoAKxA6YBoQKzA6YBogK1AwKjArYDpwGkArgDpgGlAroDAqYCuwOoAacCvAOmAagCvQOmAakCvgMCqgLBA6kBqwLCA68BrALEA7ABrQLFA7ABrgLIA7ABrwLJA7ABsALKA7ABsQLMA7ABsgLOAwKzAs8DsQG0AtEDsAG1AtMDArYC1AOyAbcC1QOwAbgC1gOwAbkC1wMCugLaA7MBuwLbA7kBvALdA7oBvQLeA7oBvgLhA7oBvwLiA7oBwALjA7oBwQLlA7oBwgLnAwLDAugDuwHEAuoDugHFAuwDAsYC7QO8AccC7gO6AcgC7wO6AckC8AMCygLzA70BywL0A8EBzAL2A8IBzQL3A8IBzgL6A8IBzwL7A8IB0AL8A8IB0QL-A8IB0gKABALTAoEEwwHUAoMEwgHVAoUEAtYChgTEAdcChwTCAdgCiATCAdkCiQQC2gKMBMUB2wKNBMsB3AKPBMwB3QKQBMwB3gKTBMwB3wKUBMwB4AKVBMwB4QKXBMwB4gKZBALjApoEzQHkApwEzAHlAp4EAuYCnwTOAecCoATMAegCoQTMAekCogQC6gKlBM8B6wKmBNMB7AKoBNQB7QKpBNQB7gKsBNQB7wKtBNQB8AKuBNQB8QKwBNQB8gKyBALzArME1QH0ArUE1AH1ArcEAvYCuATWAfcCuQTUAfgCugTUAfkCuwQC-gK-BNcB-wK_BN0B_ALBBN4B_QLCBN4B_gLFBN4B_wLGBN4BgAPHBN4BgQPJBN4BggPLBAKDA8wE3wGEA84E3gGFA9AEAoYD0QTgAYcD0gTeAYgD0wTeAYkD1AQCigPXBOEBiwPYBOcBjAPaBOgBjQPbBOgBjgPeBOgBjwPfBOgBkAPgBOgBkQPiBOgBkgPkBAKTA-UE6QGUA-cE6AGVA-kEApYD6gTqAZcD6wToAZgD7AToAZkD7QQCmgPwBOsBmwPxBPEBnAPzBPIBnQP0BPIBngP3BPIBnwP4BPIBoAP5BPIBoQP7BPIBogP9BAKjA_4E8wGkA4AF8gGlA4IFAqYDgwX0AacDhAXyAagDhQXyAakDhgUCqgOJBfUBqwOKBfsBrAOMBfwBrQONBfwBrgOQBfwBrwORBfwBsAOSBfwBsQOUBfwBsgOWBQKzA5cF_QG0A5kF_AG1A5sFArYDnAX-AbcDnQX8AbgDngX8AbkDnwUCugOiBf8BuwOjBYUCvAOlBYYCvQOmBYYCvgOpBYYCvwOqBYYCwAOrBYYCwQOtBYYCwgOvBQLDA7AFhwLEA7IFhgLFA7QFAsYDtQWIAscDtgWGAsgDtwWGAskDuAUCygO7BYkCywO8BY0CzAO-BY4CzQO_BY4CzgPCBY4CzwPDBY4C0APEBY4C0QPGBY4C0gPIBQLTA8kFjwLUA8sFjgLVA80FAtYDzgWQAtcDzwWOAtgD0AWOAtkD0QUC2gPUBZEC2wPVBZUC3APXBZYC3QPYBZYC3gPbBZYC3wPcBZYC4APdBZYC4QPfBZYC4gPhBQLjA-IFlwLkA-QFlgLlA-YFAuYD5wWYAucD6AWWAugD6QWWAukD6gUC6gPtBZkC6wPuBZ0C7APwBZ4C7QPxBZ4C7gP0BZ4C7wP1BZ4C8AP2BZ4C8QP4BZ4C8gP6BQLzA_sFnwL0A_0FngL1A_8FAvYDgAagAvcDgQaeAvgDggaeAvkDgwYC-gOGBqEC-wOHBqcC_AOJBqgC_QOKBqgC_gONBqgC_wOOBqgCgASPBqgCgQSRBqgCggSTBgKDBJQGqQKEBJYGqAKFBJgGAoYEmQaqAocEmgaoAogEmwaoAokEnAYCigSfBqsCiwSgBq8CjASiBrACjQSjBrACjgSmBrACjwSnBrACkASoBrACkQSqBrACkgSsBgKTBK0GsQKUBK8GsAKVBLEGApYEsgayApcEswawApgEtAawApkEtQYCmgS4BrMCmwS5BrkCnAS7BroCnQS8BroCngS_BroCnwTABroCoATBBroCoQTDBroCogTFBgKjBMYGuwKkBMgGugKlBMoGAqYEywa8AqcEzAa6AqgEzQa6AqkEzgYCqgTRBr0CqwTSBsECrATUBsICrQTVBsICrgTYBsICrwTZBsICsATaBsICsQTcBsICsgTeBgKzBN8GwwK0BOEGwgK1BOMGArYE5AbEArcE5QbCArgE5gbCArkE5wYCugTqBsUCuwTrBskCvATtBsoCvQTuBsoCvgTxBsoCvwTyBsoCwATzBsoCwQT1BsoCwgT3BgLDBPgGywLEBPoGygLFBPwGAsYE_QbMAscE_gbKAsgE_wbKAskEgAcCygSDB80CywSEB9MCzASGB9QCzQSHB9QCzgSKB9QCzwSLB9QC0ASMB9QC0QSOB9QC0gSQBwLTBJEH1QLUBJMH1ALVBJUHAtYElgfWAtcElwfUAtgEmAfUAtkEmQcC2gScB9cC2wSdB90C3ASfB94C3QSgB94C3gSjB94C3wSkB94C4ASlB94C4QSnB94C4gSpBwLjBKoH3wLkBKwH3gLlBK4HAuYErwfgAucEsAfeAugEsQfeAukEsgcC6gS1B-EC6wS2B-UC7AS4B-YC7QS5B-YC7gS8B-YC7wS9B-YC8AS-B-YC8QTAB-YC8gTCBwLzBMMH5wL0BMUH5gL1BMcHAvYEyAfoAvcEyQfmAvgEygfmAvkEywcC-gTOB-kC-wTPB-8C_ATRB_AC_QTSB_AC_gTVB_AC_wTWB_ACgAXXB_ACgQXZB_ACggXbBwKDBdwH8QKEBd4H8AKFBeAHAoYF4QfyAocF4gfwAogF4wfwAokF5AcCigXnB_MCiwXoB_kCjAXqB_oCjQXrB_oCjgXuB_oCjwXvB_oCkAXwB_oCkQXyB_oCkgX0BwKTBfUH-wKUBfcH-gKVBfkHApYF-gf8ApcF-wf6ApgF_Af6ApkF_QcCmgWACP0CmwWBCIMDnAWDCIQDnQWECIQDngWHCIQDnwWICIQDoAWJCIQDoQWLCIQDogWNCAKjBY4IhQOkBZAIhAOlBZIIAqYFkwiGA6cFlAiEA6gFlQiEA6kFlggCqgWZCIcDqwWaCIsDrAWcCIwDrQWdCIwDrgWgCIwDrwWhCIwDsAWiCIwDsQWkCIwDsgWmCAKzBacIjQO0BakIjAO1BasIArYFrAiOA7cFrQiMA7gFrgiMA7kFrwgCugWyCI8DuwWzCJMDvAW1CJQDvQW2CJQDvgW5CJQDvwW6CJQDwAW7CJQDwQW9CJQDwgW_CALDBcAIlQPEBcIIlAPFBcQIAsYFxQiWA8cFxgiUA8gFxwiUA8kFyAgCygXLCJcDywXMCJ0DzAXOCJ4DzQXPCJ4DzgXSCJ4DzwXTCJ4D0AXUCJ4D0QXWCJ4D0gXYCALTBdkInwPUBdsIngPVBd0IAtYF3gigA9cF3wieA9gF4AieA9kF4QgC2gXkCKED2wXlCKcD3AXnCKgD3QXoCKgD3gXrCKgD3wXsCKgD4AXtCKgD4QXvCKgD4gXxCALjBfIIqQPkBfQIqAPlBfYIAuYF9wiqA-cF-AioA-gF-QioA-kF-ggC6gX9CKsD6wX-CLED7AWACbID7QWBCbID7gWECbID7wWFCbID8AWGCbID8QWICbID8gWKCQLzBYsJswP0BY0JsgP1BY8JAvYFkAm0A_cFkQmyA_gFkgmyA_kFkwkC-gWWCbUD-wWXCbsD_AWZCbwD_QWaCbwD_gWdCbwD_wWeCbwDgAafCbwDgQahCbwDggajCQKDBqQJvQOEBqYJvAOFBqgJAoYGqQm-A4cGqgm8A4gGqwm8A4kGrAkCigavCb8DiwawCcMDjAayCcQDjQazCcQDjga2CcQDjwa3CcQDkAa4CcQDkQa6CcQDkga8CQKTBr0JxQOUBr8JxAOVBsEJApYGwgnGA5cGwwnEA5gGxAnEA5kGxQkCmgbICccDmwbJCcsDnAbLCcwDnQbMCcwDngbPCcwDnwbQCcwDoAbRCcwDoQbTCcwDogbVCQKjBtYJzQOkBtgJzAOlBtoJAqYG2wnOA6cG3AnMA6gG3QnMA6kG3gkCqgbhCc8DqwbiCdUDrAbkCdYDrQblCdYDrgboCdYDrwbpCdYDsAbqCdYDsQbsCdYDsgbuCQKzBu8J1wO0BvEJ1gO1BvMJArYG9AnYA7cG9QnWA7gG9gnWA7kG9wkCugb6CdkDuwb7Cd0DvAb9Cd4DvQb-Cd4DvgaBCt4DvwaCCt4DwAaDCt4DwQaFCt4DwgaHCgLDBogK3wPEBooK3gPFBowKAsYGjQrgA8cGjgreA8gGjwreA8kGkAoCygaTCuEDywaUCuUDzAaWCuYDzQaXCuYDzgaaCuYDzwabCuYD0AacCuYD0QaeCuYD0gagCgLTBqEK5wPUBqMK5gPVBqUKAtYGpgroA9cGpwrmA9gGqArmA9kGqQoC2gasCukD2watCu8D3AavCvAD3QawCvAD3gazCvAD3wa0CvAD4Aa1CvAD4Qa3CvAD4ga5CgLjBroK8QPkBrwK8APlBr4KAuYGvwryA-cGwArwA-gGwQrwA-kGwgoC6gbFCvMD6wbGCvkD7AbICvoD7QbJCvoD7gbMCvoD7wbNCvoD8AbOCvoD8QbQCvoD8gbSCgLzBtMK-wP0BtUK-gP1BtcKAvYG2Ar8A_cG2Qr6A_gG2gr6A_kG2woC-gbeCv0D-wbfCoME_AbhCoQE_QbiCoQE_gblCoQE_wbmCoQEgAfnCoQEgQfpCoQEggfrCgKDB-wKhQSEB-4KhASFB_AKAoYH8QqGBIcH8gqEBIgH8wqEBIkH9AoCigf3CocEiwf4Co0EjAf6Co4EjQf7Co4Ejgf-Co4Ejwf_Co4EkAeAC44EkQeCC44EkgeECwKTB4ULjwSUB4cLjgSVB4kLApYHiguQBJcHiwuOBJgHjAuOBJkHjQsCmgeQC5EEmweRC5cEnAeTC5gEnQeUC5gEngeXC5gEnweYC5gEoAeZC5gEoQebC5gEogedCwKjB54LmQSkB6ALmASlB6ILAqYHowuaBKcHpAuYBKgHpQuYBKkHpgsCqgepC5sEqweqC6EErAesC6IErQetC6IErgewC6IErwexC6IEsAeyC6IEsQe0C6IEsge2CwKzB7cLowS0B7kLogS1B7sLArYHvAukBLcHvQuiBLgHvguiBLkHvwsCugfCC6UEuwfDC6sE"
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
