var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
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

// packages/dsh-plugin/node_modules/.pnpm/ipaddr.js@2.5.0/node_modules/ipaddr.js/lib/ipaddr.js
var require_ipaddr = __commonJS({
  "packages/dsh-plugin/node_modules/.pnpm/ipaddr.js@2.5.0/node_modules/ipaddr.js/lib/ipaddr.js"(exports, module) {
    (function(root) {
      "use strict";
      const ipv4Part = "(0?\\d+|0x[a-f0-9]+)";
      const ipv4Regexes = {
        fourOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}$`, "i"),
        threeOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}$`, "i"),
        twoOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}$`, "i"),
        longValue: new RegExp(`^${ipv4Part}$`, "i")
      };
      const octalRegex = new RegExp(`^0[0-7]+$`, "i");
      const hexRegex = new RegExp(`^0x[a-f0-9]+$`, "i");
      const zoneIndex = "%[0-9a-z]{1,}";
      const ipv6Part = "(?:[0-9a-f]+::?)+";
      const ipv6Regexes = {
        zoneIndex: new RegExp(zoneIndex, "i"),
        "native": new RegExp(`^(::)?(${ipv6Part})?([0-9a-f]+)?(::)?(${zoneIndex})?$`, "i"),
        deprecatedTransitional: new RegExp(`^(?:::)(${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}(${zoneIndex})?)$`, "i"),
        transitional: new RegExp(`^((?:${ipv6Part})|(?:::)(?:${ipv6Part})?)${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}(${zoneIndex})?$`, "i")
      };
      function expandIPv6(string, parts) {
        if (string.indexOf("::") !== string.lastIndexOf("::")) {
          return null;
        }
        let colonCount = 0;
        let lastColon = -1;
        let zoneId = (string.match(ipv6Regexes.zoneIndex) || [])[0];
        let replacement, replacementCount;
        if (zoneId) {
          zoneId = zoneId.substring(1);
          string = string.replace(/%.+$/, "");
        }
        while ((lastColon = string.indexOf(":", lastColon + 1)) >= 0) {
          colonCount++;
        }
        if (string.substr(0, 2) === "::") {
          colonCount--;
        }
        if (string.substr(-2, 2) === "::") {
          colonCount--;
        }
        if (colonCount >= parts) {
          return null;
        }
        replacementCount = parts - colonCount;
        replacement = ":";
        while (replacementCount--) {
          replacement += "0:";
        }
        string = string.replace("::", replacement);
        if (string[0] === ":") {
          string = string.slice(1);
        }
        if (string[string.length - 1] === ":") {
          string = string.slice(0, -1);
        }
        parts = (function() {
          const ref = string.split(":");
          const results = [];
          for (let i = 0; i < ref.length; i++) {
            results.push(ref[i].length > 4 ? NaN : parseInt(ref[i], 16));
          }
          return results;
        })();
        return {
          parts,
          zoneId
        };
      }
      function matchCIDR(first, second, partSize, cidrBits) {
        if (first.length !== second.length) {
          throw new Error("ipaddr: cannot match CIDR for objects with different lengths");
        }
        let part = 0;
        let shift;
        while (cidrBits > 0) {
          shift = partSize - cidrBits;
          if (shift < 0) {
            shift = 0;
          }
          if (first[part] >> shift !== second[part] >> shift) {
            return false;
          }
          cidrBits -= partSize;
          part += 1;
        }
        return true;
      }
      function parseIntAuto(string) {
        if (hexRegex.test(string)) {
          return parseInt(string, 16);
        }
        if (string[0] === "0" && !isNaN(parseInt(string[1], 10))) {
          if (octalRegex.test(string)) {
            return parseInt(string, 8);
          }
          throw new Error(`ipaddr: cannot parse ${string} as octal`);
        }
        return parseInt(string, 10);
      }
      function padPart(part, length) {
        while (part.length < length) {
          part = `0${part}`;
        }
        return part;
      }
      const ipaddr2 = {};
      ipaddr2.IPv4 = (function() {
        function IPv4(octets) {
          if (octets.length !== 4) {
            throw new Error("ipaddr: ipv4 octet count should be 4");
          }
          let i, octet;
          for (i = 0; i < octets.length; i++) {
            octet = octets[i];
            if (!(0 <= octet && octet <= 255)) {
              throw new Error("ipaddr: ipv4 octet should fit in 8 bits");
            }
          }
          this.octets = octets;
        }
        IPv4.prototype.SpecialRanges = {
          unspecified: [[new IPv4([0, 0, 0, 0]), 8]],
          broadcast: [[new IPv4([255, 255, 255, 255]), 32]],
          // RFC3171
          multicast: [[new IPv4([224, 0, 0, 0]), 4]],
          // RFC3927
          linkLocal: [[new IPv4([169, 254, 0, 0]), 16]],
          // RFC5735
          loopback: [[new IPv4([127, 0, 0, 0]), 8]],
          // RFC6598
          carrierGradeNat: [[new IPv4([100, 64, 0, 0]), 10]],
          // RFC1918
          "private": [
            [new IPv4([10, 0, 0, 0]), 8],
            [new IPv4([172, 16, 0, 0]), 12],
            [new IPv4([192, 168, 0, 0]), 16]
          ],
          // Reserved and testing-only ranges; RFCs 5735, 5737, 2544, 1700
          reserved: [
            [new IPv4([192, 0, 0, 0]), 24],
            [new IPv4([192, 0, 2, 0]), 24],
            [new IPv4([192, 88, 99, 0]), 24],
            [new IPv4([198, 18, 0, 0]), 15],
            [new IPv4([198, 51, 100, 0]), 24],
            [new IPv4([203, 0, 113, 0]), 24],
            [new IPv4([240, 0, 0, 0]), 4]
          ],
          // RFC7534, RFC7535
          as112: [
            [new IPv4([192, 175, 48, 0]), 24],
            [new IPv4([192, 31, 196, 0]), 24]
          ],
          // RFC7450
          amt: [
            [new IPv4([192, 52, 193, 0]), 24]
          ]
        };
        IPv4.prototype.kind = function() {
          return "ipv4";
        };
        IPv4.prototype.match = function(other, cidrRange) {
          let ref;
          if (cidrRange === void 0) {
            ref = other;
            other = ref[0];
            cidrRange = ref[1];
          }
          if (other.kind() !== "ipv4") {
            throw new Error("ipaddr: cannot match ipv4 address with non-ipv4 one");
          }
          return matchCIDR(this.octets, other.octets, 8, cidrRange);
        };
        IPv4.prototype.prefixLengthFromSubnetMask = function() {
          let cidr = 0;
          let stop = false;
          const zerotable = {
            0: 8,
            128: 7,
            192: 6,
            224: 5,
            240: 4,
            248: 3,
            252: 2,
            254: 1,
            255: 0
          };
          let i, octet, zeros;
          for (i = 3; i >= 0; i -= 1) {
            octet = this.octets[i];
            if (octet in zerotable) {
              zeros = zerotable[octet];
              if (stop && zeros !== 0) {
                return null;
              }
              if (zeros !== 8) {
                stop = true;
              }
              cidr += zeros;
            } else {
              return null;
            }
          }
          return 32 - cidr;
        };
        IPv4.prototype.range = function() {
          return ipaddr2.subnetMatch(this, this.SpecialRanges);
        };
        IPv4.prototype.toByteArray = function() {
          return this.octets.slice(0);
        };
        IPv4.prototype.toIPv4MappedAddress = function() {
          return ipaddr2.IPv6.parse(`::ffff:${this.toString()}`);
        };
        IPv4.prototype.toNormalizedString = function() {
          return this.toString();
        };
        IPv4.prototype.toString = function() {
          return this.octets.join(".");
        };
        return IPv4;
      })();
      ipaddr2.IPv4.broadcastAddressFromCIDR = function(string) {
        try {
          const cidr = this.parseCIDR(string);
          const ipInterfaceOctets = cidr[0].toByteArray();
          const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          const octets = [];
          let i = 0;
          while (i < 4) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error("ipaddr: the address does not have IPv4 CIDR format", { cause: e });
        }
      };
      ipaddr2.IPv4.isIPv4 = function(string) {
        return this.parser(string) !== null;
      };
      ipaddr2.IPv4.isValid = function(string) {
        try {
          new this(this.parser(string));
          return true;
        } catch {
          return false;
        }
      };
      ipaddr2.IPv4.isValidCIDR = function(string) {
        try {
          this.parseCIDR(string);
          return true;
        } catch {
          return false;
        }
      };
      ipaddr2.IPv4.isValidFourPartDecimal = function(string) {
        if (ipaddr2.IPv4.isValid(string) && string.match(/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){3}$/)) {
          return true;
        } else {
          return false;
        }
      };
      ipaddr2.IPv4.isValidCIDRFourPartDecimal = function(string) {
        const match = string.match(/^(.+)\/(\d+)$/);
        if (!ipaddr2.IPv4.isValidCIDR(string) || !match) {
          return false;
        }
        return ipaddr2.IPv4.isValidFourPartDecimal(match[1]);
      };
      ipaddr2.IPv4.networkAddressFromCIDR = function(string) {
        let cidr, i, ipInterfaceOctets, octets, subnetMaskOctets;
        try {
          cidr = this.parseCIDR(string);
          ipInterfaceOctets = cidr[0].toByteArray();
          subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          octets = [];
          i = 0;
          while (i < 4) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error("ipaddr: the address does not have IPv4 CIDR format", { cause: e });
        }
      };
      ipaddr2.IPv4.parse = function(string) {
        const parts = this.parser(string);
        if (parts === null) {
          throw new Error("ipaddr: string is not formatted like an IPv4 Address");
        }
        return new this(parts);
      };
      ipaddr2.IPv4.parseCIDR = function(string) {
        let match;
        if (match = string.match(/^(.+)\/(\d+)$/)) {
          const maskLength = parseInt(match[2]);
          if (maskLength >= 0 && maskLength <= 32) {
            const parsed = [this.parse(match[1]), maskLength];
            Object.defineProperty(parsed, "toString", {
              value: function() {
                return this.join("/");
              }
            });
            return parsed;
          }
        }
        throw new Error("ipaddr: string is not formatted like an IPv4 CIDR range");
      };
      ipaddr2.IPv4.parser = function(string) {
        let match, part, value;
        if (match = string.match(ipv4Regexes.fourOctet)) {
          return (function() {
            const ref = match.slice(1, 6);
            const results = [];
            for (let i = 0; i < ref.length; i++) {
              part = ref[i];
              results.push(parseIntAuto(part));
            }
            return results;
          })();
        } else if (match = string.match(ipv4Regexes.longValue)) {
          value = parseIntAuto(match[1]);
          if (value > 4294967295 || value < 0) {
            throw new Error("ipaddr: address outside defined range");
          }
          return (function() {
            const results = [];
            let shift;
            for (shift = 0; shift <= 24; shift += 8) {
              results.push(value >> shift & 255);
            }
            return results;
          })().reverse();
        } else if (match = string.match(ipv4Regexes.twoOctet)) {
          return (function() {
            const ref = match.slice(1, 4);
            const results = [];
            value = parseIntAuto(ref[1]);
            if (value > 16777215 || value < 0) {
              throw new Error("ipaddr: address outside defined range");
            }
            results.push(parseIntAuto(ref[0]));
            results.push(value >> 16 & 255);
            results.push(value >> 8 & 255);
            results.push(value & 255);
            return results;
          })();
        } else if (match = string.match(ipv4Regexes.threeOctet)) {
          return (function() {
            const ref = match.slice(1, 5);
            const results = [];
            value = parseIntAuto(ref[2]);
            if (value > 65535 || value < 0) {
              throw new Error("ipaddr: address outside defined range");
            }
            results.push(parseIntAuto(ref[0]));
            results.push(parseIntAuto(ref[1]));
            results.push(value >> 8 & 255);
            results.push(value & 255);
            return results;
          })();
        } else {
          return null;
        }
      };
      ipaddr2.IPv4.subnetMaskFromPrefixLength = function(prefix) {
        prefix = parseInt(prefix);
        if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
          throw new Error("ipaddr: invalid IPv4 prefix length");
        }
        const octets = [0, 0, 0, 0];
        let j = 0;
        const filledOctetCount = Math.floor(prefix / 8);
        while (j < filledOctetCount) {
          octets[j] = 255;
          j++;
        }
        if (filledOctetCount < 4) {
          octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - prefix % 8;
        }
        return new this(octets);
      };
      ipaddr2.IPv6 = (function() {
        function IPv6(parts, zoneId) {
          let i, part;
          if (parts.length === 16) {
            this.parts = [];
            for (i = 0; i <= 14; i += 2) {
              this.parts.push(parts[i] << 8 | parts[i + 1]);
            }
          } else if (parts.length === 8) {
            this.parts = parts;
          } else {
            throw new Error("ipaddr: ipv6 part count should be 8 or 16");
          }
          for (i = 0; i < this.parts.length; i++) {
            part = this.parts[i];
            if (!(0 <= part && part <= 65535)) {
              throw new Error("ipaddr: ipv6 part should fit in 16 bits");
            }
          }
          if (zoneId) {
            this.zoneId = zoneId;
          }
        }
        IPv6.prototype.SpecialRanges = {
          // RFC4291, here and after
          unspecified: [new IPv6([0, 0, 0, 0, 0, 0, 0, 0]), 128],
          linkLocal: [new IPv6([65152, 0, 0, 0, 0, 0, 0, 0]), 10],
          multicast: [new IPv6([65280, 0, 0, 0, 0, 0, 0, 0]), 8],
          loopback: [new IPv6([0, 0, 0, 0, 0, 0, 0, 1]), 128],
          uniqueLocal: [new IPv6([64512, 0, 0, 0, 0, 0, 0, 0]), 7],
          ipv4Mapped: [new IPv6([0, 0, 0, 0, 0, 65535, 0, 0]), 96],
          // RFC3879
          deprecatedSiteLocal: [new IPv6([65216, 0, 0, 0, 0, 0, 0, 0]), 10],
          // RFC6666
          discard: [new IPv6([256, 0, 0, 0, 0, 0, 0, 0]), 64],
          // RFC6145
          rfc6145: [new IPv6([0, 0, 0, 0, 65535, 0, 0, 0]), 96],
          rfc6052: [
            // RFC6052
            [new IPv6([100, 65435, 0, 0, 0, 0, 0, 0]), 96],
            // RFC8215
            [new IPv6([100, 65435, 1, 0, 0, 0, 0, 0]), 48]
          ],
          // RFC3056
          "6to4": [new IPv6([8194, 0, 0, 0, 0, 0, 0, 0]), 16],
          // RFC6052, RFC6146
          teredo: [new IPv6([8193, 0, 0, 0, 0, 0, 0, 0]), 32],
          // RFC5180
          benchmarking: [new IPv6([8193, 2, 0, 0, 0, 0, 0, 0]), 48],
          // RFC7450
          amt: [new IPv6([8193, 3, 0, 0, 0, 0, 0, 0]), 32],
          as112v6: [
            // RFC7535
            [new IPv6([8193, 4, 274, 0, 0, 0, 0, 0]), 48],
            // RFC7534
            [new IPv6([9760, 79, 32768, 0, 0, 0, 0, 0]), 48]
          ],
          // RFC4843
          deprecatedOrchid: [new IPv6([8193, 16, 0, 0, 0, 0, 0, 0]), 28],
          // RFC7343
          orchid2: [new IPv6([8193, 32, 0, 0, 0, 0, 0, 0]), 28],
          // RFC9374
          droneRemoteIdProtocolEntityTags: [new IPv6([8193, 48, 0, 0, 0, 0, 0, 0]), 28],
          // RFC9602
          segmentRouting: [new IPv6([24320, 0, 0, 0, 0, 0, 0, 0]), 16],
          reserved: [
            // RFC3849
            [new IPv6([8193, 0, 0, 0, 0, 0, 0, 0]), 23],
            // RFC2928
            [new IPv6([8193, 3512, 0, 0, 0, 0, 0, 0]), 32],
            // RFC9637
            [new IPv6([16383, 0, 0, 0, 0, 0, 0, 0]), 20]
          ]
        };
        IPv6.prototype.isIPv4MappedAddress = function() {
          return this.range() === "ipv4Mapped";
        };
        IPv6.prototype.kind = function() {
          return "ipv6";
        };
        IPv6.prototype.match = function(other, cidrRange) {
          let ref;
          if (cidrRange === void 0) {
            ref = other;
            other = ref[0];
            cidrRange = ref[1];
          }
          if (other.kind() !== "ipv6") {
            throw new Error("ipaddr: cannot match ipv6 address with non-ipv6 one");
          }
          return matchCIDR(this.parts, other.parts, 16, cidrRange);
        };
        IPv6.prototype.prefixLengthFromSubnetMask = function() {
          let cidr = 0;
          let stop = false;
          const zerotable = {
            0: 16,
            32768: 15,
            49152: 14,
            57344: 13,
            61440: 12,
            63488: 11,
            64512: 10,
            65024: 9,
            65280: 8,
            65408: 7,
            65472: 6,
            65504: 5,
            65520: 4,
            65528: 3,
            65532: 2,
            65534: 1,
            65535: 0
          };
          let part, zeros;
          for (let i = 7; i >= 0; i -= 1) {
            part = this.parts[i];
            if (part in zerotable) {
              zeros = zerotable[part];
              if (stop && zeros !== 0) {
                return null;
              }
              if (zeros !== 16) {
                stop = true;
              }
              cidr += zeros;
            } else {
              return null;
            }
          }
          return 128 - cidr;
        };
        IPv6.prototype.range = function() {
          return ipaddr2.subnetMatch(this, this.SpecialRanges);
        };
        IPv6.prototype.toByteArray = function() {
          let part;
          const bytes = [];
          const ref = this.parts;
          for (let i = 0; i < ref.length; i++) {
            part = ref[i];
            bytes.push(part >> 8);
            bytes.push(part & 255);
          }
          return bytes;
        };
        IPv6.prototype.toFixedLengthString = function() {
          const addr = (function() {
            const results = [];
            for (let i = 0; i < this.parts.length; i++) {
              results.push(padPart(this.parts[i].toString(16), 4));
            }
            return results;
          }).call(this).join(":");
          let suffix = "";
          if (this.zoneId) {
            suffix = `%${this.zoneId}`;
          }
          return addr + suffix;
        };
        IPv6.prototype.toIPv4Address = function() {
          if (!this.isIPv4MappedAddress()) {
            throw new Error("ipaddr: trying to convert a generic ipv6 address to ipv4");
          }
          const ref = this.parts.slice(-2);
          const high = ref[0];
          const low = ref[1];
          return new ipaddr2.IPv4([high >> 8, high & 255, low >> 8, low & 255]);
        };
        IPv6.prototype.toNormalizedString = function() {
          const addr = (function() {
            const results = [];
            for (let i = 0; i < this.parts.length; i++) {
              results.push(this.parts[i].toString(16));
            }
            return results;
          }).call(this).join(":");
          let suffix = "";
          if (this.zoneId) {
            suffix = `%${this.zoneId}`;
          }
          return addr + suffix;
        };
        IPv6.prototype.toRFC5952String = function() {
          const regex = /((^|:)(0(:|$)){2,})/g;
          let suffix = "";
          if (this.zoneId) {
            suffix = `%${this.zoneId}`;
          }
          const normalized = this.toNormalizedString();
          const string = normalized.slice(0, normalized.length - suffix.length);
          let bestMatchIndex = 0;
          let bestMatchLength = -1;
          let bestMatchGroups = -1;
          let match;
          while (match = regex.exec(string)) {
            const groups = (match[0].match(/0/g) || []).length;
            if (groups > bestMatchGroups) {
              bestMatchGroups = groups;
              bestMatchIndex = match.index;
              bestMatchLength = match[0].length;
            }
          }
          if (bestMatchLength < 0) {
            return string + suffix;
          }
          return `${string.substring(0, bestMatchIndex)}::${string.substring(bestMatchIndex + bestMatchLength)}${suffix}`;
        };
        IPv6.prototype.toString = function() {
          return this.toRFC5952String();
        };
        return IPv6;
      })();
      ipaddr2.IPv6.broadcastAddressFromCIDR = function(string) {
        try {
          const cidr = this.parseCIDR(string);
          const ipInterfaceOctets = cidr[0].toByteArray();
          const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          const octets = [];
          let i = 0;
          while (i < 16) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error("ipaddr: the address does not have IPv6 CIDR format", { cause: e });
        }
      };
      ipaddr2.IPv6.isIPv6 = function(string) {
        return this.parser(string) !== null;
      };
      ipaddr2.IPv6.isValid = function(string) {
        if (typeof string === "string" && string.indexOf(":") === -1) {
          return false;
        }
        try {
          const addr = this.parser(string);
          new this(addr.parts, addr.zoneId);
          return true;
        } catch {
          return false;
        }
      };
      ipaddr2.IPv6.isValidCIDR = function(string) {
        if (typeof string === "string" && string.indexOf(":") === -1) {
          return false;
        }
        try {
          this.parseCIDR(string);
          return true;
        } catch {
          return false;
        }
      };
      ipaddr2.IPv6.networkAddressFromCIDR = function(string) {
        let cidr, i, ipInterfaceOctets, octets, subnetMaskOctets;
        try {
          cidr = this.parseCIDR(string);
          ipInterfaceOctets = cidr[0].toByteArray();
          subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
          octets = [];
          i = 0;
          while (i < 16) {
            octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));
            i++;
          }
          return new this(octets);
        } catch (e) {
          throw new Error("ipaddr: the address does not have IPv6 CIDR format", { cause: e });
        }
      };
      ipaddr2.IPv6.parse = function(string) {
        const addr = this.parser(string);
        if (addr === null) {
          throw new Error("ipaddr: string is not formatted like an IPv6 Address");
        }
        return new this(addr.parts, addr.zoneId);
      };
      ipaddr2.IPv6.parseCIDR = function(string) {
        let maskLength, match, parsed;
        if (match = string.match(/^(.+)\/(\d+)$/)) {
          maskLength = parseInt(match[2]);
          if (maskLength >= 0 && maskLength <= 128) {
            parsed = [this.parse(match[1]), maskLength];
            Object.defineProperty(parsed, "toString", {
              value: function() {
                return this.join("/");
              }
            });
            return parsed;
          }
        }
        throw new Error("ipaddr: string is not formatted like an IPv6 CIDR range");
      };
      ipaddr2.IPv6.parser = function(string) {
        let addr, i, match, octet, octets, zoneId;
        if (match = string.match(ipv6Regexes.deprecatedTransitional)) {
          return this.parser(`::ffff:${match[1]}`);
        }
        if (ipv6Regexes.native.test(string)) {
          return expandIPv6(string, 8);
        }
        if (match = string.match(ipv6Regexes.transitional)) {
          zoneId = match[6] || "";
          addr = match[1];
          if (!match[1].endsWith("::")) {
            addr = addr.slice(0, -1);
          }
          addr = expandIPv6(addr + zoneId, 6);
          if (addr && addr.parts) {
            octets = [
              parseInt(match[2]),
              parseInt(match[3]),
              parseInt(match[4]),
              parseInt(match[5])
            ];
            for (i = 0; i < octets.length; i++) {
              octet = octets[i];
              if (!(0 <= octet && octet <= 255)) {
                return null;
              }
            }
            addr.parts.push(octets[0] << 8 | octets[1]);
            addr.parts.push(octets[2] << 8 | octets[3]);
            return {
              parts: addr.parts,
              zoneId: addr.zoneId
            };
          }
        }
        return null;
      };
      ipaddr2.IPv6.subnetMaskFromPrefixLength = function(prefix) {
        prefix = parseInt(prefix);
        if (Number.isNaN(prefix) || prefix < 0 || prefix > 128) {
          throw new Error("ipaddr: invalid IPv6 prefix length");
        }
        const octets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let j = 0;
        const filledOctetCount = Math.floor(prefix / 8);
        while (j < filledOctetCount) {
          octets[j] = 255;
          j++;
        }
        if (filledOctetCount < 16) {
          octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - prefix % 8;
        }
        return new this(octets);
      };
      ipaddr2.fromByteArray = function(bytes) {
        const length = bytes.length;
        if (length === 4) {
          return new ipaddr2.IPv4(bytes);
        } else if (length === 16) {
          return new ipaddr2.IPv6(bytes);
        } else {
          throw new Error("ipaddr: the binary input is neither an IPv6 nor IPv4 address");
        }
      };
      ipaddr2.isValid = function(string) {
        return ipaddr2.IPv6.isValid(string) || ipaddr2.IPv4.isValid(string);
      };
      ipaddr2.isValidCIDR = function(string) {
        return ipaddr2.IPv6.isValidCIDR(string) || ipaddr2.IPv4.isValidCIDR(string);
      };
      ipaddr2.parse = function(string) {
        if (ipaddr2.IPv6.isValid(string)) {
          return ipaddr2.IPv6.parse(string);
        } else if (ipaddr2.IPv4.isValid(string)) {
          return ipaddr2.IPv4.parse(string);
        } else {
          throw new Error("ipaddr: the address has neither IPv6 nor IPv4 format");
        }
      };
      ipaddr2.parseCIDR = function(string) {
        try {
          return ipaddr2.IPv6.parseCIDR(string);
        } catch {
          try {
            return ipaddr2.IPv4.parseCIDR(string);
          } catch (e) {
            throw new Error("ipaddr: the address has neither IPv6 nor IPv4 CIDR format", { cause: e });
          }
        }
      };
      ipaddr2.process = function(string) {
        const addr = this.parse(string);
        if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
          return addr.toIPv4Address();
        } else {
          return addr;
        }
      };
      ipaddr2.subnetMatch = function(address, rangeList, defaultName) {
        let i, rangeName, rangeSubnets, subnet;
        if (defaultName === void 0 || defaultName === null) {
          defaultName = "unicast";
        }
        for (rangeName in rangeList) {
          if (Object.prototype.hasOwnProperty.call(rangeList, rangeName)) {
            rangeSubnets = rangeList[rangeName];
            if (rangeSubnets[0] && !(rangeSubnets[0] instanceof Array)) {
              rangeSubnets = [rangeSubnets];
            }
            for (i = 0; i < rangeSubnets.length; i++) {
              subnet = rangeSubnets[i];
              if (address.kind() === subnet[0].kind() && address.match.apply(address, subnet)) {
                return rangeName;
              }
            }
          }
        }
        return defaultName;
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = ipaddr2;
      } else {
        root.ipaddr = ipaddr2;
      }
    })(exports);
  }
});

// packages/dsh-plugin/src/dockyard-remote-host.mjs
var dockyard_remote_host_exports = {};
__export(dockyard_remote_host_exports, {
  DockyardRemoteService: () => DockyardRemoteService,
  publicAuthResult: () => publicAuthResult
});
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
function publicAuthResult(result) {
  if (!result || typeof result !== "object") return result;
  return {
    status: result.status,
    ...result.providerId ? { providerId: result.providerId } : {},
    ...result.sessionId ? { sessionId: result.sessionId } : {},
    ...result.authorizationUrl ? { authorizationUrl: result.authorizationUrl } : {},
    ...result.instructions ? { instructions: result.instructions } : {},
    ...result.browserOpened ? { browserOpened: true } : {},
    ...result.inputRequired ? { inputRequired: true } : {},
    ...result.authorizationCodeRequired ? { authorizationCodeRequired: true } : {},
    ...result.diagnostic ? { diagnostic: result.diagnostic } : {},
    ...Array.isArray(result.accounts) ? { accounts: result.accounts } : {}
  };
}
function envelope(result, snapshot) {
  return { result, snapshot };
}
function markRemoteMethods() {
  const target = Object.create(DockyardRemoteService.prototype);
  for (const name2 of [
    "snapshot",
    "refresh",
    "scan",
    "add",
    "login",
    "poll",
    "submitAuthorizationCode",
    "cancel",
    "setPolicy",
    "use",
    "removeAccount",
    "nativeKeyStatus",
    "nativeKeyRefresh",
    "nativeKeyRegister",
    "nativeKeyUnregister",
    "nativeKeySetPolicy",
    "getContextWindowOverride",
    "setContextWindowOverride",
    "getModelSelection",
    "setModelSelection",
    "testModelConnection"
  ]) {
    let initializer;
    Remote(name2)(void 0, {
      kind: "method",
      name: name2,
      static: false,
      private: false,
      addInitializer(callback) {
        initializer = callback;
      }
    });
    initializer?.call(target);
  }
}
var DockyardRemoteService;
var init_dockyard_remote_host = __esm({
  "packages/dsh-plugin/src/dockyard-remote-host.mjs"() {
    DockyardRemoteService = class extends TypertRemoteService {
      static inject = [];
      constructor(ctx, config = {}) {
        super(ctx, "dockyardRemote", { namespace: "dockyard" });
        if (!config.service) throw new Error("Dockyard remote service requires DockyardDshService");
        this.dockyard = config.service;
        this.nativeKeyPool = config.nativeKeyPool ?? null;
      }
      async snapshot() {
        return this.dockyard.snapshot();
      }
      async refresh(request = {}) {
        const providerId = request?.providerId ?? null;
        const result = await this.dockyard.refresh(providerId);
        return envelope(result, await this.dockyard.snapshot());
      }
      async scan(request = {}) {
        const result = await this.dockyard.scan(request?.providerId ?? null);
        return envelope(result, await this.dockyard.snapshot());
      }
      async add(request = {}) {
        const result = await this.dockyard.add(
          request?.providerId ?? null,
          request?.candidateId ?? null,
          {
            apiKey: request?.apiKey ?? null,
            label: request?.label ?? ""
          }
        );
        return envelope(result, await this.dockyard.snapshot());
      }
      async login(request) {
        const result = publicAuthResult(await this.dockyard.startAuthorization(request.providerId, { openBrowser: false }));
        return envelope(result, await this.dockyard.snapshot());
      }
      async poll(request) {
        const result = publicAuthResult(await this.dockyard.pollAuthorization(request.providerId, request.sessionId));
        return envelope(result, await this.dockyard.snapshot());
      }
      async submitAuthorizationCode(request) {
        const result = publicAuthResult(await this.dockyard.submitAuthorizationCode(
          request.providerId,
          request.sessionId,
          request.code
        ));
        return envelope(result, await this.dockyard.snapshot());
      }
      async cancel(request) {
        const result = publicAuthResult(await this.dockyard.cancelAuthorization(request.providerId, request.sessionId));
        return envelope(result, await this.dockyard.snapshot());
      }
      async setPolicy(request) {
        const result = await this.dockyard.setPolicy(request.providerId, request.policy, request.defaultAccountId);
        return envelope(result, await this.dockyard.snapshot());
      }
      async use(request) {
        const result = await this.dockyard.setDefaultAccount(request.providerId, request.accountId);
        return envelope(result, await this.dockyard.snapshot());
      }
      async removeAccount(request) {
        const result = await this.dockyard.removeAccount(request.providerId, request.accountId);
        return envelope(result, await this.dockyard.snapshot());
      }
      async nativeKeyStatus(request = {}) {
        if (!this.nativeKeyPool) return { providerId: request.providerId, runtimeMode: "native-single-key", keys: [] };
        return this.nativeKeyPool.status(request.providerId);
      }
      async nativeKeyRefresh(request = {}) {
        if (!this.nativeKeyPool) return { providerId: request.providerId, runtimeMode: "native-single-key", keys: [] };
        return this.nativeKeyPool.refreshUsage(request.providerId);
      }
      async nativeKeyRegister(request = {}) {
        if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool \u5C1A\u672A\u6302\u8F7D");
        return this.nativeKeyPool.register(request.providerId, request.ref, request.label);
      }
      async nativeKeyUnregister(request = {}) {
        if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool \u5C1A\u672A\u6302\u8F7D");
        return this.nativeKeyPool.unregister(request.providerId, request.ref);
      }
      async nativeKeySetPolicy(request = {}) {
        if (!this.nativeKeyPool) throw new Error("Dockyard Native Key Pool \u5C1A\u672A\u6302\u8F7D");
        return this.nativeKeyPool.setPolicy(request.providerId, request.policy);
      }
      async getContextWindowOverride(request = {}) {
        return this.dockyard.getContextWindowOverride(request);
      }
      async setContextWindowOverride(request = {}) {
        return this.dockyard.setContextWindowOverride(request, request.value);
      }
      async getModelSelection(request = {}) {
        return this.dockyard.getModelSelection(request.providerId, request.accountId ?? null);
      }
      async setModelSelection(request = {}) {
        return this.dockyard.setModelSelection(
          request.providerId,
          request.enabledModelIds,
          request.accountId ?? null
        );
      }
      async testModelConnection(request = {}) {
        return this.dockyard.testModelConnection(request.providerId, request.modelId, {
          timeoutMs: request.timeoutMs ?? 15e3
        });
      }
    };
    markRemoteMethods();
  }
});

// packages/dsh-plugin/src/index.mjs
import { existsSync as existsSync7, readFileSync as readFileSync6 } from "node:fs";
import { join as join18 } from "node:path";

// packages/core/src/errors.mjs
var DockyardError = class extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "DockyardError";
    this.code = code;
    this.details = details;
  }
};
var ValidationError = class extends DockyardError {
  constructor(message, details = {}) {
    super("validation_error", message, details);
    this.name = "ValidationError";
  }
};
var ModuleConflictError = class extends DockyardError {
  constructor(moduleId) {
    super("module_conflict", `Module is already registered: ${moduleId}`, { moduleId });
    this.name = "ModuleConflictError";
  }
};
var ModuleNotFoundError = class extends DockyardError {
  constructor(moduleId) {
    super("module_not_found", `Module is not registered: ${moduleId}`, { moduleId });
    this.name = "ModuleNotFoundError";
  }
};
var AccountSelectionError = class extends DockyardError {
  constructor(message, details = {}) {
    super("account_selection_error", message, details);
    this.name = "AccountSelectionError";
  }
};
var ProviderCapabilityError = class extends DockyardError {
  constructor(providerId, capability) {
    super(
      "provider_capability_unavailable",
      `Provider module ${providerId} does not have an active ${capability} driver`,
      { providerId, capability }
    );
    this.name = "ProviderCapabilityError";
  }
};

// packages/core/src/contracts.mjs
var ACCOUNT_HEALTH = Object.freeze({
  UNKNOWN: "unknown",
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  COOLDOWN: "cooldown",
  EXPIRED: "expired",
  EXHAUSTED: "exhausted"
});
var ACCOUNT_SELECTION_POLICY = Object.freeze({
  MANUAL: "manual",
  STICKY_SESSION: "sticky_session",
  ROUND_ROBIN: "round_robin",
  FAILOVER: "failover",
  // Spread work towards the account with the most headroom left, so accounts
  // whose windows reset later are not drained first. Falls back to round robin
  // when no account reports quota windows.
  ALLOWANCE_FULLEST: "allowance_fullest"
});
var PROVIDER_CAPABILITIES = Object.freeze([
  "oauth_discovery",
  "oauth_import",
  "oauth_authorization",
  "oauth_refresh",
  "quota",
  "catalog",
  "invoke",
  "stream"
]);
var PROVIDER_BEHAVIOR_CAPABILITIES = Object.freeze({
  AUTO_PROVISION_FREE_ACCOUNT: "auto_provision_free_account",
  FORCE_LIVE_CATALOG: "force_live_catalog",
  CATALOG_WARMUP: "catalog_warmup",
  API_KEY_AUTH: "api_key_auth",
  REPAIR_LEGACY_CREDENTIAL: "repair_legacy_credential"
});
function isoOrNull(value, fieldName) {
  if (value === void 0 || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Invalid ISO timestamp for ${fieldName}`, { fieldName, value });
  }
  return date.toISOString();
}
function numberOrNull(value, fieldName) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`Expected a finite number for ${fieldName}`, { fieldName, value });
  }
  return value;
}
function stringOrNull(value) {
  return value === void 0 || value === null || value === "" ? null : String(value);
}
function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? structuredClone(value) : {};
}
function createQuotaWindow(input = {}, now = /* @__PURE__ */ new Date()) {
  return {
    id: stringOrNull(input.id),
    name: stringOrNull(input.name),
    remaining: numberOrNull(input.remaining, "quota.windows.remaining"),
    limit: numberOrNull(input.limit, "quota.windows.limit"),
    unit: stringOrNull(input.unit),
    resetAt: isoOrNull(input.resetAt, "quota.windows.resetAt"),
    updatedAt: isoOrNull(input.updatedAt, "quota.windows.updatedAt") ?? now.toISOString(),
    source: stringOrNull(input.source) ?? "unknown"
  };
}
function createQuotaSnapshot(input = {}, now = /* @__PURE__ */ new Date()) {
  return {
    remaining: numberOrNull(input.remaining, "quota.remaining"),
    limit: numberOrNull(input.limit, "quota.limit"),
    unit: stringOrNull(input.unit),
    resetAt: isoOrNull(input.resetAt, "quota.resetAt"),
    updatedAt: isoOrNull(input.updatedAt, "quota.updatedAt") ?? now.toISOString(),
    source: stringOrNull(input.source) ?? "unknown",
    windows: Array.isArray(input.windows) ? input.windows.map((window) => createQuotaWindow(window, now)) : []
  };
}
function createRefreshState(input = {}) {
  return {
    accessTokenExpiresAt: isoOrNull(input.accessTokenExpiresAt, "refresh.accessTokenExpiresAt"),
    nextRefreshAt: isoOrNull(input.nextRefreshAt, "refresh.nextRefreshAt"),
    lastRefreshedAt: isoOrNull(input.lastRefreshedAt, "refresh.lastRefreshedAt"),
    refreshable: input.refreshable === void 0 ? null : Boolean(input.refreshable)
  };
}
function createAccountRecord(input, now = /* @__PURE__ */ new Date()) {
  if (!input || typeof input !== "object") throw new ValidationError("Account input is required");
  if (!input.providerId) throw new ValidationError("Account providerId is required");
  if (!input.accountId) throw new ValidationError("Account accountId is required");
  const credentialRef = input.credentialRef ?? input.auth?.credentialRef;
  if (!credentialRef) throw new ValidationError("Account credentialRef is required");
  const health = input.health ?? {};
  const createdAt = isoOrNull(input.createdAt, "createdAt") ?? now.toISOString();
  const updatedAt2 = isoOrNull(input.updatedAt, "updatedAt") ?? now.toISOString();
  return {
    providerId: String(input.providerId),
    accountId: String(input.accountId),
    displayName: stringOrNull(input.displayName),
    email: stringOrNull(input.email),
    auth: {
      kind: stringOrNull(input.auth?.kind) ?? "oauth",
      credentialRef: String(credentialRef),
      scopes: Array.isArray(input.auth?.scopes) ? [...input.auth.scopes] : []
    },
    subscription: {
      plan: stringOrNull(input.subscription?.plan),
      status: stringOrNull(input.subscription?.status),
      expiresAt: isoOrNull(input.subscription?.expiresAt, "subscription.expiresAt")
    },
    quota: createQuotaSnapshot(input.quota ?? {}, now),
    balance: input.balance ? createBalanceSnapshot(input.balance, now) : null,
    refresh: createRefreshState(input.refresh ?? {}),
    resources: objectOrEmpty(input.resources),
    health: {
      status: health.status ?? ACCOUNT_HEALTH.UNKNOWN,
      lastCheckedAt: isoOrNull(health.lastCheckedAt, "health.lastCheckedAt"),
      cooldownUntil: isoOrNull(health.cooldownUntil, "health.cooldownUntil"),
      lastError: stringOrNull(health.lastError)
    },
    lastUsedAt: isoOrNull(input.lastUsedAt, "lastUsedAt"),
    createdAt,
    updatedAt: updatedAt2
  };
}
function createBalanceSnapshot(input = {}, now = /* @__PURE__ */ new Date()) {
  return {
    amount: numberOrNull(input.amount, "balance.amount"),
    unit: stringOrNull(input.unit),
    updatedAt: isoOrNull(input.updatedAt, "balance.updatedAt") ?? now.toISOString(),
    source: stringOrNull(input.source) ?? "unknown"
  };
}
function accountSummary(account) {
  return {
    providerId: account.providerId,
    accountId: account.accountId,
    displayName: account.displayName,
    email: account.email,
    subscription: { ...account.subscription },
    quota: structuredClone(account.quota ?? {}),
    balance: account.balance ? structuredClone(account.balance) : null,
    refresh: { ...account.refresh },
    resources: structuredClone(account.resources ?? {}),
    health: { ...account.health },
    lastUsedAt: account.lastUsedAt
  };
}
function accountStorageRecord(account) {
  return {
    ...accountSummary(account),
    auth: {
      kind: account.auth.kind,
      credentialRef: account.auth.credentialRef,
      scopes: [...account.auth.scopes]
    },
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

// packages/core/src/events.mjs
var EventBus = class {
  #handlers = /* @__PURE__ */ new Map();
  on(type, handler) {
    if (typeof type !== "string" || type.length === 0) {
      throw new TypeError("EventBus.on requires a non-empty event type");
    }
    if (typeof handler !== "function") {
      throw new TypeError("EventBus.on requires a handler function");
    }
    if (!this.#handlers.has(type)) this.#handlers.set(type, /* @__PURE__ */ new Set());
    this.#handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }
  off(type, handler) {
    const handlers = this.#handlers.get(type);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) this.#handlers.delete(type);
  }
  async emit(type, payload) {
    const handlers = [...this.#handlers.get(type) ?? []];
    const errors = [];
    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (error) {
        errors.push(error);
      }
    }
    return { handled: handlers.length, errors };
  }
  clear() {
    this.#handlers.clear();
  }
};

// packages/core/src/module-runtime.mjs
var ModuleRuntime = class {
  #modules = /* @__PURE__ */ new Map();
  #services = /* @__PURE__ */ new Map();
  // Per-module lifecycle serialization. activate()/deactivate() are awaited,
  // so without ordering an unregister could remove a module mid-register and
  // let the still-running register mark it active again afterwards.
  #lifecycleQueues = /* @__PURE__ */ new Map();
  constructor({ events = new EventBus(), logger = console } = {}) {
    this.events = events;
    this.logger = logger;
  }
  #enqueueLifecycle(moduleId, task) {
    const previous = this.#lifecycleQueues.get(moduleId) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.#lifecycleQueues.set(moduleId, run.then(() => {
    }, () => {
    }));
    return run;
  }
  register(module) {
    const manifest = module?.manifest;
    if (!manifest?.id || !manifest.kind) {
      throw new ValidationError("A module manifest must contain id and kind");
    }
    return this.#enqueueLifecycle(manifest.id, async () => {
      if (this.#modules.has(manifest.id)) throw new ModuleConflictError(manifest.id);
      const record = { module, manifest: { ...manifest }, services: /* @__PURE__ */ new Set(), active: false };
      this.#modules.set(manifest.id, record);
      const context = this.#contextFor(record);
      try {
        if (typeof module.activate === "function") await module.activate(context);
        record.active = true;
        await this.events.emit("module/registered", { moduleId: manifest.id, manifest: { ...manifest } });
        return module;
      } catch (error) {
        this.#removeServices(record);
        this.#modules.delete(manifest.id);
        throw error;
      }
    });
  }
  unregister(moduleId) {
    return this.#enqueueLifecycle(moduleId, async () => {
      const record = this.#modules.get(moduleId);
      if (!record) throw new ModuleNotFoundError(moduleId);
      if (typeof record.module.deactivate === "function") {
        await record.module.deactivate(this.#contextFor(record));
      }
      this.#removeServices(record);
      this.#modules.delete(moduleId);
      await this.events.emit("module/unregistered", { moduleId });
    });
  }
  has(moduleId) {
    return this.#modules.has(moduleId);
  }
  get(moduleId) {
    const record = this.#modules.get(moduleId);
    if (!record) throw new ModuleNotFoundError(moduleId);
    return record.module;
  }
  list() {
    return [...this.#modules.values()].map(({ manifest, active }) => ({ ...manifest, active }));
  }
  registerService(name2, value, ownerId) {
    if (this.#services.has(name2)) {
      throw new ValidationError(`Service is already registered: ${name2}`, { name: name2 });
    }
    this.#services.set(name2, { value, ownerId });
    const record = this.#modules.get(ownerId);
    if (record) record.services.add(name2);
  }
  getService(name2) {
    const service = this.#services.get(name2);
    if (!service) throw new ValidationError(`Service is not registered: ${name2}`, { name: name2 });
    return service.value;
  }
  hasService(name2) {
    return this.#services.has(name2);
  }
  #contextFor(record) {
    return {
      moduleId: record.manifest.id,
      events: this.events,
      logger: this.logger,
      registerService: (name2, value) => this.registerService(name2, value, record.manifest.id),
      getService: (name2) => this.getService(name2),
      emit: (type, payload = {}) => this.events.emit(type, { ...payload, moduleId: record.manifest.id })
    };
  }
  #removeServices(record) {
    for (const name2 of record.services) this.#services.delete(name2);
    record.services.clear();
  }
};

// packages/core/src/provider-module.mjs
function missingDriver(providerId, capability) {
  return async () => {
    throw new ProviderCapabilityError(providerId, capability);
  };
}
function defineProviderModule({
  id,
  displayName,
  capabilities = [],
  driver = {}
}) {
  if (!id) throw new ValidationError("Provider module id is required");
  const module = {
    manifest: {
      id,
      kind: "provider",
      displayName: displayName ?? id,
      capabilities: [...capabilities],
      dataSource: "live_oauth"
    },
    async activate(context) {
      context.registerService(`provider:${id}`, module);
      await context.emit("provider/registered", { providerId: id });
    },
    async deactivate(context) {
      await context.emit("provider/unregistered", { providerId: id });
    },
    async discover(context) {
      return driver.discover ? driver.discover(context) : missingDriver(id, "oauth_discovery")(context);
    },
    async importAccount(candidate2, context) {
      return driver.importAccount ? driver.importAccount(candidate2, context) : missingDriver(id, "oauth_import")(candidate2, context);
    },
    async importSource(source, context) {
      return driver.importSource ? driver.importSource(source, context) : missingDriver(id, "oauth_source_import")(source, context);
    },
    // A provider may expose an already authenticated official CLI, desktop
    // client, browser, or OAuth-file session. Returning null keeps the normal
    // provider-owned authorization flow unchanged.
    async getActiveSession(context) {
      return typeof driver.getActiveSession === "function" ? driver.getActiveSession(context) : null;
    },
    /**
     * What the user has to do for a provider that has no authorization entry
     * point of its own (a desktop-session provider, for example). Returning
     * null leaves the host's generic message in place, so a provider that does
     * not care keeps working without a new branch here.
     */
    async authorizationInstructions(context) {
      return typeof driver.authorizationInstructions === "function" ? driver.authorizationInstructions(context) : null;
    },
    async startAuthorization(context) {
      return driver.startAuthorization ? driver.startAuthorization(context) : missingDriver(id, "oauth_authorization")(context);
    },
    async pollAuthorization(sessionId, context) {
      return driver.pollAuthorization ? driver.pollAuthorization(sessionId, context) : missingDriver(id, "oauth_authorization")(sessionId, context);
    },
    async cancelAuthorization(sessionId, context) {
      return driver.cancelAuthorization ? driver.cancelAuthorization(sessionId, context) : missingDriver(id, "oauth_authorization")(sessionId, context);
    },
    async submitAuthorizationCode(sessionId, code, context) {
      return driver.submitAuthorizationCode ? driver.submitAuthorizationCode(sessionId, code, context) : missingDriver(id, "oauth_authorization")(sessionId, code, context);
    },
    async refreshAccount(account, context) {
      return driver.refreshAccount ? driver.refreshAccount(account, context) : missingDriver(id, "oauth_refresh")(account, context);
    },
    async getQuota(account, context) {
      return driver.getQuota ? driver.getQuota(account, context) : missingDriver(id, "quota")(account, context);
    },
    async getCatalog(context) {
      return driver.getCatalog ? driver.getCatalog(context) : missingDriver(id, "catalog")(context);
    },
    async invoke(request, invocation, context) {
      return driver.invoke ? driver.invoke(request, invocation, context) : missingDriver(id, "invoke")(request, invocation, context);
    },
    async stream(request, invocation, context) {
      if (driver.stream) return driver.stream(request, invocation, context);
      if (driver.invoke) return driver.invoke(request, invocation, context);
      return missingDriver(id, "stream")(request, invocation, context);
    }
  };
  return Object.freeze(module);
}

// packages/providers/src/provider-utils.mjs
import { readFile } from "node:fs/promises";
async function readJsonFile(path2) {
  try {
    return JSON.parse(await readFile(path2, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}
function decodeJwtPayload(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
function isoFromEpoch(value) {
  if (value === void 0 || value === null || value === "") return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric) ? new Date(numeric < 1e10 ? numeric * 1e3 : numeric) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function addSecondsIso(seconds, now = /* @__PURE__ */ new Date()) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return null;
  return new Date(now.getTime() + numeric * 1e3).toISOString();
}
function finiteNumber(value) {
  if (value === void 0 || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
function stringValue(value) {
  return value === void 0 || value === null || value === "" ? null : String(value);
}
var EXTENDED_THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"];
function resolveContextWindowFromModel(model, fallback = 131072) {
  if (!model) return fallback;
  const values = [
    model.context_length,
    model.contextWindow,
    model.context_window,
    model.maxInputTokens,
    model.max_input_tokens,
    model.context?.contextWindow,
    model.metadata?.contextWindow
  ];
  for (const v of values) {
    if (Number.isInteger(v) && v > 0) return v;
    const num = Number(v);
    if (Number.isInteger(num) && num > 0) return num;
  }
  return fallback;
}
function resolveMaxTokensFromModel(model, fallback = 16384) {
  if (!model) return fallback;
  const values = [
    model.top_provider?.max_completion_tokens,
    model.per_request_limits?.max_completion_tokens,
    model.max_completion_tokens,
    model.maxOutputTokens,
    model.max_output_tokens,
    model.maxTokens,
    model.max_tokens
  ];
  for (const v of values) {
    if (Number.isInteger(v) && v > 0) return v;
    const num = Number(v);
    if (Number.isInteger(num) && num > 0) return num;
  }
  return fallback;
}
function stripVendorPrefix(name2) {
  if (typeof name2 !== "string") return name2;
  const match = /^([A-Za-z][A-Za-z .&+\-]{0,23}):\s+(\S.*)$/u.exec(name2.trim());
  if (!match) return name2;
  return match[2].trim();
}
function resolveReasoningFromModel(model) {
  if (!model) return void 0;
  if (model.reasoning === false) return void 0;
  if (Array.isArray(model.reasoning?.efforts) && model.reasoning.efforts.length > 0) {
    return model.reasoning;
  }
  if (Array.isArray(model.reasoning?.supportedEfforts) && model.reasoning.supportedEfforts.length > 0) {
    const raw = model.reasoning.supportedEfforts;
    const standardEfforts = [
      { id: "minimal", name: "Minimal" },
      { id: "low", name: "Low" },
      { id: "medium", name: "Medium" },
      { id: "high", name: "High" }
    ];
    let efforts;
    if (raw.length >= 2) {
      efforts = raw.map((lvl) => {
        const id = typeof lvl === "string" ? lvl : lvl?.id ?? lvl?.value;
        if (!id) return null;
        const name2 = typeof lvl === "object" && (lvl.name ?? lvl.label) ? lvl.name ?? lvl.label : id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return { id, name: name2 };
      }).filter(Boolean);
    } else {
      efforts = standardEfforts;
    }
    const defaultEffort = model.reasoning.defaultEffort ?? (efforts.some((e) => e.id === "high") ? "high" : efforts.some((e) => e.id === "medium") ? "medium" : efforts[0]?.id);
    return { efforts, defaultEffort };
  }
  if (model.supportsReasoning === true || model.onlyReasoning === true) {
    const defaultEffort = model.reasoning?.defaultEffort ?? "high";
    return {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort
    };
  }
  if (Array.isArray(model.supported_reasoning_levels) && model.supported_reasoning_levels.length > 0) {
    const efforts = model.supported_reasoning_levels.map((lvl) => {
      const id = typeof lvl === "string" ? lvl : lvl?.id;
      if (!id) return null;
      const name2 = typeof lvl === "object" && lvl.name ? lvl.name : id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        id,
        name: name2,
        ...lvl?.description ? { description: lvl.description } : {}
      };
    }).filter(Boolean);
    if (efforts.length > 0) {
      const defaultEffort = model.default_reasoning_level ?? (efforts.some((e) => e.id === "medium") ? "medium" : efforts[0]?.id);
      return { efforts, defaultEffort };
    }
  }
  if (Array.isArray(model.reasoning_efforts) && model.reasoning_efforts.length > 0) {
    const efforts = model.reasoning_efforts.map((lvl) => {
      const id = typeof lvl === "string" ? lvl : lvl?.id ?? lvl?.value;
      if (!id) return null;
      const name2 = typeof lvl === "object" && (lvl.label ?? lvl.name) ? lvl.label ?? lvl.name : id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        id,
        name: name2,
        ...lvl?.description ? { description: lvl.description } : {}
      };
    }).filter(Boolean);
    if (efforts.length > 0) {
      const defaultEffort = model.default_parameters?.reasoning_effort ?? (efforts.some((e) => e.id === "medium") ? "medium" : efforts[0]?.id);
      return { efforts, defaultEffort };
    }
  }
  if (Array.isArray(model.supported_parameters) && model.supported_parameters.includes("reasoning_effort")) {
    const id = String(model.id ?? "").toLowerCase();
    const supportsMax = id.includes("ultra") || id.includes("o1") || id.includes("o3") || id.includes("deepseek-r1");
    const efforts = [
      { id: "low", name: "Low", description: "\u5FEB\u901F\u601D\u8003\uFF0C\u4FDD\u7559\u57FA\u7840\u63A8\u7406" },
      { id: "medium", name: "Medium", description: "\u6807\u51C6\u601D\u8003\uFF0C\u5E73\u8861\u63A8\u7406\u6DF1\u5EA6\u4E0E\u54CD\u5E94\u901F\u5EA6" },
      { id: "high", name: "High", description: "\u6DF1\u5EA6\u601D\u8003\uFF0C\u9002\u5408\u590D\u6742\u903B\u8F91\u4E0E\u591A\u6B65\u9AA4\u5206\u6790" },
      ...supportsMax ? [{ id: "max", name: "Max", description: "\u6781\u81F4\u601D\u8003\uFF0C\u6700\u9AD8\u63A8\u6F14\u6DF1\u5EA6" }] : []
    ];
    const defaultEffort = typeof model.default_parameters?.reasoning_effort === "string" ? model.default_parameters.reasoning_effort : "medium";
    return { efforts, defaultEffort };
  }
  if (model.thinkingLevelMap && typeof model.thinkingLevelMap === "object") {
    const supported = EXTENDED_THINKING_LEVELS.filter((level) => {
      const mapped = model.thinkingLevelMap[level];
      if (mapped === null) return false;
      if (level === "xhigh" || level === "max") return mapped !== void 0 && mapped !== null;
      return true;
    });
    if (supported.length === 0) return void 0;
    const efforts = supported.map((id) => ({
      id,
      name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    }));
    const defaultEffort = supported.includes("medium") ? "medium" : supported.includes("high") ? "high" : supported[0];
    return { efforts, defaultEffort };
  }
  if (model.reasoning === true) {
    const supported = ["minimal", "low", "medium", "high"];
    return {
      efforts: supported.map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) })),
      defaultEffort: "medium"
    };
  }
  return void 0;
}
async function fetchJson(url, init = {}, { timeoutMs = 2e4, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init?.signal;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) controller.abort(externalSignal.reason);
  else externalSignal?.addEventListener?.("abort", abortFromCaller, { once: true });
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const text3 = await response.text();
    let body = null;
    try {
      body = text3 ? JSON.parse(text3) : null;
    } catch {
      body = null;
    }
    if (!response.ok) {
      const error = new Error(`Provider request failed (${response.status})`);
      error.status = response.status;
      error.bodyKeys = body && typeof body === "object" ? Object.keys(body) : [];
      const upstreamError = body?.error;
      const upstreamCode = typeof upstreamError === "string" ? upstreamError : upstreamError && typeof upstreamError === "object" ? upstreamError.code ?? upstreamError.type : body?.error_code ?? body?.code;
      if (typeof upstreamCode === "string" && upstreamCode.length > 0) error.upstreamCode = upstreamCode;
      throw error;
    }
    return { body, response };
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.("abort", abortFromCaller);
  }
}
function redactError(error) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const detail = error?.detail ? ` ${String(error.detail)}` : "";
  const code = error?.code !== void 0 && error?.code !== null ? ` [code ${String(error.code)}]` : "";
  return `${message}${detail}${code}`.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]").replace(/(access|refresh|id)[_-]?token["'=:\s]+[^,\s}]+/gi, "$1_token=[redacted]").replace(/\b(?:sk|sk-ant|sk-proj|sk-svcacct|xai|agy|gsk|ghp|gho|ghu|github_pat|deepseek|pplx|nvapi|zai|glm)[-_][A-Za-z0-9_-]{12,}\b/gi, "[redacted]").replace(/(api[_-]?key|client[_-]?secret|session[_-]?token|private[_-]?key)["'=:\s]+[^,\s}"']+/gi, "$1=[redacted]").slice(0, 300);
}
function recursiveQuotaWindows(value, { source, now = /* @__PURE__ */ new Date(), prefix = "quota" } = {}) {
  const windows = [];
  function visit(node, path2, label) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const usedPercent = finiteNumber(node.used_percent ?? node.usedPercent);
    const remainingFraction = finiteNumber(node.remaining_fraction ?? node.remainingFraction);
    const remainingValue = finiteNumber(node.remaining);
    const limitValue = finiteNumber(node.limit);
    const resetAt = isoFromEpoch(node.reset_at ?? node.resetAt) ?? addSecondsIso(node.reset_after_seconds ?? node.resetAfterSeconds, now);
    const hasQuotaShape = usedPercent !== null || remainingFraction !== null || remainingValue !== null || limitValue !== null;
    if (hasQuotaShape) {
      let remaining = remainingValue;
      let limit = limitValue;
      let unit = stringValue(node.unit);
      if (remaining === null && remainingFraction !== null) {
        remaining = remainingFraction;
        limit = limit ?? 1;
        unit = unit ?? "fraction";
      } else if (remaining === null && usedPercent !== null) {
        remaining = Math.max(0, 100 - usedPercent);
        limit = limit ?? 100;
        unit = unit ?? "percent";
      }
      windows.push({
        id: path2 || prefix,
        name: label || path2 || prefix,
        remaining,
        limit,
        unit,
        resetAt,
        source
      });
    }
    for (const [key, child] of Object.entries(node)) {
      if (child && typeof child === "object" && !Array.isArray(child)) {
        visit(child, path2 ? `${path2}.${key}` : key, key);
      }
    }
  }
  visit(value, "", prefix);
  const unique = /* @__PURE__ */ new Map();
  for (const window of windows) unique.set(window.id, window);
  return [...unique.values()];
}
function selectPrimaryQuotaWindow(windows) {
  if (!windows?.length) return {};
  const preferred = windows.find((window) => /primary|weekly|five.?hour|5h/i.test(`${window.id} ${window.name}`));
  return preferred ?? windows[0];
}
var LOOPBACK_HOSTNAMES = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isLoopbackHostname(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return LOOPBACK_HOSTNAMES.has(bare);
}
function assertSecureEndpointUrl(value, label = "endpoint") {
  const raw = String(value ?? "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${label} must use http(s), got: ${url.protocol}`);
  }
  if (url.protocol === "http:" && !isLoopbackHostname(url.hostname)) {
    throw new Error(`${label} over plain http must target a loopback host, got: ${url.hostname}`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not embed credentials in the URL`);
  }
  if (url.hash) {
    url.hash = "";
  }
  return url.toString();
}

// packages/core/src/dsh-route.mjs
function selectionContext(context, excludedIds) {
  if (excludedIds.size === 0) return context;
  return { ...context, excludeAccountIds: [...excludedIds] };
}
async function requestUsesFreeModel(providerModule, request, context) {
  const modelId = request?.model;
  if (typeof modelId !== "string" || typeof providerModule?.getCatalog !== "function") return false;
  try {
    const catalog = await providerModule.getCatalog(context);
    const entry = (Array.isArray(catalog?.models) ? catalog.models : []).find((candidate2) => candidate2?.id === modelId);
    return entry?.free === true;
  } catch {
    return false;
  }
}
function shouldFailover(error, accountPool, context) {
  return accountPool.policy === ACCOUNT_SELECTION_POLICY.FAILOVER && !context.accountId && (error?.rateLimited || error?.quotaExhausted || error?.authExpired || error?.emptyOutput);
}
function quotaResetAt(account) {
  const candidates = [
    account?.quota?.resetAt,
    ...Array.isArray(account?.quota?.windows) ? account.quota.windows.map((window) => window?.resetAt) : []
  ].filter(Boolean).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()) && value.getTime() > Date.now()).sort((left, right) => left.getTime() - right.getTime());
  return candidates[0]?.toISOString() ?? null;
}
function failureStatus(error) {
  if (error?.authExpired) return "auth_expired";
  if (error?.quotaExhausted) return "quota_exhausted";
  if (error?.rateLimited) return "rate_limited";
  return "error";
}
function failureCooldown(error, account) {
  return error?.cooldownUntil ?? quotaResetAt(account);
}
function reportAccount(accountPool, accountId, result, { opToken } = {}) {
  try {
    const safeResult = result?.message ? { ...result, message: redactError(result.message) } : result;
    accountPool.report(accountId, safeResult, { opToken });
  } catch {
  }
}
function errorFromTerminalChunk(chunk) {
  const failure = chunk?.type === "finish" && chunk.reason?.kind === "error" ? chunk.reason.failure : null;
  if (!failure) return null;
  const error = new Error(String(failure.message ?? "Provider stream failed"));
  if (failure.code !== void 0) error.code = failure.code;
  if (failure.status !== void 0) error.status = failure.status;
  if (failure.upstreamCode !== void 0) error.upstreamCode = failure.upstreamCode;
  if (failure.authExpired) error.authExpired = true;
  if (failure.authForbidden) error.authForbidden = true;
  if (failure.rateLimited) error.rateLimited = true;
  if (failure.quotaExhausted) error.quotaExhausted = true;
  return error;
}
function hasSubstantiveStreamOutput(chunk) {
  if (!chunk || typeof chunk !== "object") return true;
  if (chunk.type === "block-start") return false;
  if (chunk.type === "block-end") {
    return Boolean(chunk.block?.text || chunk.block?.id || chunk.block?.arguments);
  }
  return !["usage", "finish"].includes(chunk.type);
}
function providerAccount(account, auth) {
  return {
    ...account,
    auth: {
      kind: auth.authKind,
      credentialRef: auth.credentialRef,
      scopes: [...auth.scopes]
    }
  };
}
function requestWithContextWindow(request, providerId, modelId, accountId, contextWindowOverrides) {
  if (!modelId || !contextWindowOverrides || typeof contextWindowOverrides.resolve !== "function") return request;
  const contextWindow = contextWindowOverrides.resolve(providerId, modelId, { accountId });
  if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0) return request;
  return {
    ...request,
    modelContext: {
      ...request?.modelContext ?? {},
      contextWindow
    }
  };
}
function createProviderRoute({ providerModule, accountPool, contextWindowOverrides = null }) {
  if (!providerModule?.manifest?.id) throw new ValidationError("Provider module is required");
  if (!accountPool?.select || !accountPool?.resolve) throw new ValidationError("Account pool is required");
  if (accountPool.providerId !== providerModule.manifest.id) {
    throw new ValidationError("Provider module and account pool do not match", {
      providerId: providerModule.manifest.id,
      poolProviderId: accountPool.providerId
    });
  }
  return {
    providerId: providerModule.manifest.id,
    async invoke(request, context = {}) {
      const excludedIds = new Set(context.excludeAccountIds ?? []);
      let lastError = null;
      while (true) {
        let account;
        try {
          account = accountPool.select(selectionContext(context, excludedIds));
        } catch (selectionError) {
          if (!await requestUsesFreeModel(providerModule, request, context)) {
            throw lastError ?? selectionError;
          }
          try {
            account = accountPool.select({ ...selectionContext(context, excludedIds), allowExhausted: true });
          } catch {
            throw lastError ?? selectionError;
          }
        }
        excludedIds.add(account.accountId);
        const auth = accountPool.resolve(account.accountId);
        const selectedAccount = providerAccount(account, auth);
        const selectedRequest = requestWithContextWindow(
          request,
          providerModule.manifest.id,
          request?.model,
          account.accountId,
          contextWindowOverrides
        );
        try {
          const response = await providerModule.invoke(
            selectedRequest,
            { account: selectedAccount, auth },
            context
          );
          reportAccount(accountPool, account.accountId, {
            status: "success",
            quota: response?.quota,
            refresh: response?.refresh
          }, { opToken: account.opToken });
          return response;
        } catch (error) {
          reportAccount(accountPool, account.accountId, {
            status: failureStatus(error),
            cooldownUntil: failureCooldown(error, selectedAccount),
            message: error?.message
          }, { opToken: account.opToken });
          if (!shouldFailover(error, accountPool, context)) throw error;
          lastError = error;
        }
      }
    },
    stream(request, context = {}) {
      return (async function* streamWithHealth() {
        const excludedIds = new Set(context.excludeAccountIds ?? []);
        let lastError = null;
        while (true) {
          let account;
          try {
            account = accountPool.select(selectionContext(context, excludedIds));
          } catch (selectionError) {
            if (!await requestUsesFreeModel(providerModule, request, context)) {
              throw lastError ?? selectionError;
            }
            try {
              account = accountPool.select({ ...selectionContext(context, excludedIds), allowExhausted: true });
            } catch {
              throw lastError ?? selectionError;
            }
          }
          excludedIds.add(account.accountId);
          const auth = accountPool.resolve(account.accountId);
          const selectedAccount = providerAccount(account, auth);
          const selectedRequest = requestWithContextWindow(
            request,
            providerModule.manifest.id,
            request?.model,
            account.accountId,
            contextWindowOverrides
          );
          const pending = [];
          let hasOutput = false;
          try {
            const output = providerModule.stream(selectedRequest, { account: selectedAccount, auth }, context);
            for await (const chunk of await output) {
              if (!hasOutput && !hasSubstantiveStreamOutput(chunk)) {
                pending.push(chunk);
                continue;
              }
              if (!hasOutput) {
                hasOutput = true;
                for (const buffered of pending) yield buffered;
              }
              yield chunk;
            }
            if (!hasOutput) {
              const terminalError = pending.map(errorFromTerminalChunk).find(Boolean);
              const error = terminalError ?? new Error("Provider stream ended without substantive output");
              if (!terminalError) {
                error.code = "EMPTY_STREAM_OUTPUT";
                error.emptyOutput = true;
              }
              throw error;
            }
            reportAccount(accountPool, account.accountId, { status: "success" }, { opToken: account.opToken });
            return;
          } catch (error) {
            reportAccount(accountPool, account.accountId, {
              status: failureStatus(error),
              cooldownUntil: failureCooldown(error, selectedAccount),
              message: error?.message
            }, { opToken: account.opToken });
            if (!hasOutput && shouldFailover(error, accountPool, context)) {
              lastError = error;
              continue;
            }
            throw error;
          }
        }
      })();
    }
  };
}

// packages/core/src/quota-alerts.mjs
var DEFAULT_LOW_SHARE = 0.15;
var DEFAULT_RESET_HORIZON_MS = 6 * 60 * 60 * 1e3;
var DEFAULT_WASTE_SHARE = 0.5;
function ratio(remaining, limit) {
  const left = Number(remaining);
  const total = Number(limit);
  if (!Number.isFinite(left) || !Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(1, left / total));
}
function windowLabel(window, index) {
  return window?.name ?? window?.id ?? `\u7A97\u53E3 ${index + 1}`;
}
function evaluateQuotaAlerts(account, {
  now = /* @__PURE__ */ new Date(),
  lowShare = DEFAULT_LOW_SHARE,
  resetHorizonMs = DEFAULT_RESET_HORIZON_MS,
  wasteShare = DEFAULT_WASTE_SHARE,
  balanceLow = null
} = {}) {
  const alerts = [];
  const windows = Array.isArray(account?.quota?.windows) ? account.quota.windows : [];
  const nowMs = now.getTime();
  windows.forEach((window, index) => {
    const share = ratio(window?.remaining, window?.limit);
    if (share === null) return;
    const label = windowLabel(window, index);
    if (share <= lowShare) {
      alerts.push({
        kind: "low",
        severity: "warning",
        windowId: window?.id ?? null,
        message: `${label} \u4EC5\u5269 ${Math.round(share * 100)}%`,
        data: { remaining: window.remaining, limit: window.limit, share }
      });
    }
    const resetAt = window?.resetAt ? new Date(window.resetAt) : null;
    if (resetAt && Number.isFinite(resetAt.getTime())) {
      const untilReset = resetAt.getTime() - nowMs;
      if (untilReset > 0 && untilReset <= resetHorizonMs && share >= wasteShare) {
        alerts.push({
          kind: "reset_waste",
          severity: "info",
          windowId: window?.id ?? null,
          message: `${label} \u5C06\u5728 ${Math.max(1, Math.round(untilReset / 36e5))} \u5C0F\u65F6\u5185\u91CD\u7F6E\uFF0C\u4F46\u4ECD\u5269 ${Math.round(share * 100)}%`,
          data: { remaining: window.remaining, limit: window.limit, share, resetAt: window.resetAt }
        });
      }
    }
  });
  const balance = Number(account?.balance?.amount);
  if (Number.isFinite(balance) && Number.isFinite(Number(balanceLow)) && balance <= Number(balanceLow)) {
    alerts.push({
      kind: "balance_low",
      severity: "warning",
      windowId: null,
      message: `\u4F59\u989D\u4EC5\u5269 ${balance} ${account?.balance?.unit ?? ""}`.trim(),
      data: { amount: balance, unit: account?.balance?.unit ?? null }
    });
  }
  return alerts;
}

// packages/account-pool/src/account-pool.mjs
function defaultClock() {
  return /* @__PURE__ */ new Date();
}
var STICKY_SESSION_TTL_MS = 30 * 60 * 1e3;
var RELIST_COOLDOWN_MS = 30 * 60 * 1e3;
var MAX_STICKY_ASSIGNMENTS = 1e4;
var AccountPool = class {
  #accounts = /* @__PURE__ */ new Map();
  #sessionAssignments = /* @__PURE__ */ new Map();
  #cursor = 0;
  #defaultAccountId = null;
  // Monotonic operation sequencing: every select() hands out a token and only
  // the newest report per account may commit health/quota changes. This keeps
  // a late result from an older request (e.g. one that used pre-refresh
  // credentials) from flipping a newer auth_expired back to healthy.
  #operationSeq = 0;
  #reportedOpByAccount = /* @__PURE__ */ new Map();
  constructor({ providerId, policy = ACCOUNT_SELECTION_POLICY.ROUND_ROBIN, clock = defaultClock } = {}) {
    if (!providerId) throw new ValidationError("AccountPool providerId is required");
    if (!Object.values(ACCOUNT_SELECTION_POLICY).includes(policy)) {
      throw new ValidationError(`Unknown account selection policy: ${policy}`, { policy });
    }
    this.providerId = providerId;
    this.policy = policy;
    this.clock = clock;
  }
  upsert(input, { resetHealth = false } = {}) {
    if (input.providerId && input.providerId !== this.providerId) {
      throw new ValidationError("Account provider does not match this pool", {
        expected: this.providerId,
        received: input.providerId
      });
    }
    const current = this.#accounts.get(input.accountId);
    const account = createAccountRecord(
      {
        ...current,
        ...input,
        credentialRef: input.credentialRef ?? current?.auth?.credentialRef,
        providerId: this.providerId,
        auth: { ...current?.auth, ...input.auth },
        subscription: { ...current?.subscription, ...input.subscription },
        quota: { ...current?.quota, ...input.quota },
        refresh: { ...current?.refresh, ...input.refresh },
        resources: { ...current?.resources, ...input.resources },
        health: resetHealth ? {
          ...input.health,
          status: input.health?.status === ACCOUNT_HEALTH.EXPIRED ? ACCOUNT_HEALTH.UNKNOWN : input.health?.status ?? ACCOUNT_HEALTH.UNKNOWN,
          cooldownUntil: null,
          lastError: null
        } : { ...current?.health, ...input.health },
        createdAt: current?.createdAt ?? input.createdAt
      },
      this.clock()
    );
    this.#accounts.set(account.accountId, account);
    this.#ensureSingleAccountDefault();
    return accountSummary(account);
  }
  remove(accountId) {
    this.#sessionAssignments.forEach((assignment, key) => {
      const assignedId = typeof assignment === "string" ? assignment : assignment?.accountId;
      if (assignedId === accountId) this.#sessionAssignments.delete(key);
    });
    const removed = this.#accounts.delete(accountId);
    if (removed) this.#reportedOpByAccount.delete(accountId);
    if (removed && this.#defaultAccountId === accountId) this.#defaultAccountId = null;
    this.#ensureSingleAccountDefault();
    return removed;
  }
  get(accountId) {
    const account = this.#accounts.get(accountId);
    return account ? accountSummary(account) : null;
  }
  list() {
    return [...this.#accounts.values()].map(accountSummary);
  }
  listForStorage() {
    return [...this.#accounts.values()].map(accountStorageRecord);
  }
  getDefaultAccountId() {
    return this.#defaultAccountId;
  }
  setPolicy(policy) {
    if (!Object.values(ACCOUNT_SELECTION_POLICY).includes(policy)) {
      throw new ValidationError(`Unknown account selection policy: ${policy}`, { policy });
    }
    this.policy = policy;
    this.#sessionAssignments.clear();
    this.#ensureSingleAccountDefault();
  }
  setDefaultAccount(accountId) {
    if (accountId !== null && !this.#accounts.has(accountId)) {
      throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    }
    this.#defaultAccountId = accountId;
  }
  select(context = {}) {
    const now = this.clock();
    this.#pruneSessionAssignments(now.getTime());
    const eligible = this.#eligibleAccounts(now, { allowExhausted: context.allowExhausted === true });
    if (eligible.length === 0) {
      throw new AccountSelectionError(`No eligible accounts for provider ${this.providerId}`, {
        providerId: this.providerId
      });
    }
    const excludedIds = new Set(Array.isArray(context.excludeAccountIds) ? context.excludeAccountIds : []);
    const selectable = eligible.filter((candidate2) => !excludedIds.has(candidate2.accountId));
    if (selectable.length === 0) {
      throw new AccountSelectionError("No eligible account remains after selection exclusions", {
        providerId: this.providerId,
        excludeAccountIds: [...excludedIds]
      });
    }
    let account;
    if (this.policy === ACCOUNT_SELECTION_POLICY.MANUAL) {
      const requestedId = context.accountId ?? this.#defaultAccountId ?? (selectable.length === 1 ? selectable[0].accountId : null);
      if (!requestedId) throw new AccountSelectionError("Manual policy requires accountId");
      account = selectable.find((candidate2) => candidate2.accountId === requestedId);
      if (!account) throw new AccountSelectionError(`Account is not eligible: ${requestedId}`, { accountId: requestedId });
    } else {
      const sticky = this.policy === ACCOUNT_SELECTION_POLICY.STICKY_SESSION;
      const assignmentKey = sticky ? context.sessionId ?? context.requestId ?? null : null;
      const assignment = assignmentKey ? this.#sessionAssignments.get(assignmentKey) : null;
      const assignedId = typeof assignment === "string" ? assignment : assignment?.accountId;
      account = assignedId ? selectable.find((candidate2) => candidate2.accountId === assignedId) : null;
      if (!account) {
        if (this.policy === ACCOUNT_SELECTION_POLICY.FAILOVER) {
          account = selectable[0];
        } else if (this.policy === ACCOUNT_SELECTION_POLICY.ALLOWANCE_FULLEST) {
          account = this.#fullest(selectable) ?? this.#next(selectable);
        } else {
          account = this.#next(selectable);
        }
      }
      if (assignmentKey) {
        this.#sessionAssignments.delete(assignmentKey);
        this.#sessionAssignments.set(assignmentKey, {
          accountId: account.accountId,
          lastUsedAt: now.getTime()
        });
        this.#pruneSessionAssignments(now.getTime());
      }
    }
    const timestamp = now.toISOString();
    const updated = {
      ...account,
      lastUsedAt: timestamp,
      updatedAt: timestamp
    };
    this.#accounts.set(updated.accountId, updated);
    const summary = accountSummary(updated);
    return { ...summary, opToken: ++this.#operationSeq };
  }
  resolve(accountId) {
    const account = this.#accounts.get(accountId);
    if (!account) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return {
      providerId: account.providerId,
      accountId: account.accountId,
      credentialRef: account.auth.credentialRef,
      authKind: account.auth.kind,
      scopes: [...account.auth.scopes]
    };
  }
  updateQuota(accountId, input) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, {
      quota: createQuotaSnapshot({ ...current.quota, ...input }, this.clock())
    });
  }
  updateRefresh(accountId, input) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, {
      refresh: createRefreshState({ ...current.refresh, ...input })
    });
  }
  updateResources(accountId, input = {}) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    return this.#patch(accountId, { resources: { ...current.resources, ...input } });
  }
  report(accountId, result = {}, { opToken } = {}) {
    const account = this.#accounts.get(accountId);
    if (!account) return null;
    if (opToken !== void 0) {
      const lastReported = this.#reportedOpByAccount.get(accountId) ?? 0;
      if (opToken <= lastReported) return accountSummary(account);
      this.#reportedOpByAccount.set(accountId, opToken);
    }
    const now = this.clock().toISOString();
    const patch = { updatedAt: now, health: { ...account.health, lastCheckedAt: now } };
    if (result.quota) patch.quota = createQuotaSnapshot({ ...account.quota, ...result.quota }, this.clock());
    if (result.balance) patch.balance = createBalanceSnapshot({ ...account.balance, ...result.balance }, this.clock());
    if (result.refresh) patch.refresh = createRefreshState({ ...account.refresh, ...result.refresh });
    switch (result.status) {
      case "success":
        patch.health = { ...patch.health, status: ACCOUNT_HEALTH.HEALTHY, cooldownUntil: null, lastError: null };
        break;
      case "rate_limited":
        patch.health = {
          ...patch.health,
          status: result.cooldownUntil ? ACCOUNT_HEALTH.COOLDOWN : ACCOUNT_HEALTH.DEGRADED,
          cooldownUntil: result.cooldownUntil ?? null,
          lastError: result.message ?? null
        };
        break;
      case "quota_exhausted":
        patch.health = {
          ...patch.health,
          status: ACCOUNT_HEALTH.EXHAUSTED,
          cooldownUntil: result.cooldownUntil ?? null,
          lastError: result.message ?? null
        };
        break;
      case "auth_expired":
        patch.health = {
          ...patch.health,
          status: ACCOUNT_HEALTH.EXPIRED,
          lastError: result.message ?? null,
          cooldownUntil: result.cooldownUntil ?? new Date(
            this.clock().getTime() + RELIST_COOLDOWN_MS
          ).toISOString()
        };
        break;
      case "error":
        patch.health = { ...patch.health, status: ACCOUNT_HEALTH.DEGRADED, lastError: result.message ?? null };
        break;
      default:
        break;
    }
    return this.#patch(accountId, patch);
  }
  #patch(accountId, patch) {
    const current = this.#accounts.get(accountId);
    if (!current) throw new AccountSelectionError(`Account does not exist: ${accountId}`, { accountId });
    const next = {
      ...current,
      ...patch,
      quota: patch.quota ? { ...current.quota, ...patch.quota } : current.quota,
      balance: patch.balance ? { ...current.balance, ...patch.balance } : current.balance,
      refresh: patch.refresh ? { ...current.refresh, ...patch.refresh } : current.refresh,
      resources: patch.resources ? { ...current.resources, ...patch.resources } : current.resources,
      health: patch.health ? { ...current.health, ...patch.health } : current.health
    };
    this.#accounts.set(accountId, next);
    return accountSummary(next);
  }
  /**
   * Accounts parked by an expired authorization whose cooldown has passed.
   * The runtime retries exactly these, so a token that was rotated elsewhere is
   * picked back up without the account staying dead forever.
   */
  relistable(now = this.clock()) {
    return [...this.#accounts.values()].filter((account) => account.health?.status === ACCOUNT_HEALTH.EXPIRED).filter((account) => {
      const until = account.health?.cooldownUntil;
      return !until || new Date(until).getTime() <= now.getTime();
    }).map(accountSummary);
  }
  #eligibleAccounts(now = this.clock(), { allowExhausted = false } = {}) {
    return [...this.#accounts.values()].filter((account) => {
      if (account.health.status === ACCOUNT_HEALTH.EXPIRED) return false;
      if (allowExhausted) return true;
      if (!account.health.cooldownUntil) {
        return account.health.status !== ACCOUNT_HEALTH.EXHAUSTED;
      }
      return new Date(account.health.cooldownUntil).getTime() <= now.getTime();
    });
  }
  #pruneSessionAssignments(nowMs) {
    for (const [key, assignment] of this.#sessionAssignments) {
      const lastUsedAt = typeof assignment === "object" ? assignment.lastUsedAt : nowMs;
      if (nowMs - Number(lastUsedAt) > STICKY_SESSION_TTL_MS) this.#sessionAssignments.delete(key);
    }
    while (this.#sessionAssignments.size > MAX_STICKY_ASSIGNMENTS) {
      const oldest = this.#sessionAssignments.keys().next().value;
      if (oldest === void 0) break;
      this.#sessionAssignments.delete(oldest);
    }
  }
  /**
   * The share of an account's tightest reported window that is still left.
   * The tightest window is the one that will stop the account first, so it is
   * the honest measure of headroom. Returns null when nothing is reported.
   */
  #remainingShare(account) {
    const windows = Array.isArray(account?.quota?.windows) ? account.quota.windows : [];
    let lowest = null;
    for (const window of windows) {
      const remaining = Number(window?.remaining);
      const limit = Number(window?.limit);
      if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) continue;
      const share = Math.max(0, Math.min(1, remaining / limit));
      if (lowest === null || share < lowest) lowest = share;
    }
    return lowest;
  }
  /** The selectable account with the most headroom, if any reports quota. */
  #fullest(selectable) {
    let best = null;
    let bestShare = -1;
    for (const candidate2 of selectable) {
      const share = this.#remainingShare(candidate2);
      if (share === null) continue;
      if (share > bestShare) {
        best = candidate2;
        bestShare = share;
      }
    }
    return best;
  }
  #next(accounts) {
    const account = accounts[this.#cursor % accounts.length];
    this.#cursor = (this.#cursor + 1) % accounts.length;
    return account;
  }
  #ensureSingleAccountDefault() {
    if (this.policy !== ACCOUNT_SELECTION_POLICY.MANUAL || this.#defaultAccountId || this.#accounts.size !== 1) return;
    this.#defaultAccountId = this.#accounts.keys().next().value ?? null;
  }
};

// packages/dsh-bridge/src/llm-adapter.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

// packages/runtime/src/model-selection-store.mjs
function normalizedMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}
function cleanIds(value) {
  return value.map((m) => typeof m === "string" ? m.trim() : "").filter(Boolean);
}
function cleanState(value) {
  const providers = {};
  for (const [providerId, record] of Object.entries(normalizedMap(value?.providers))) {
    const id = typeof providerId === "string" ? providerId.trim() : null;
    if (!id) continue;
    const accounts = {};
    for (const [accountId, accountRecord] of Object.entries(normalizedMap(record?.accounts))) {
      const scoped = typeof accountId === "string" ? accountId.trim() : "";
      if (!scoped || !Array.isArray(accountRecord?.enabled)) continue;
      accounts[scoped] = {
        enabled: cleanIds(accountRecord.enabled),
        updatedAt: accountRecord.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const hasAccounts = Object.keys(accounts).length > 0;
    if (!Array.isArray(record?.enabled) && !hasAccounts) continue;
    providers[id] = {
      ...Array.isArray(record?.enabled) ? { enabled: cleanIds(record.enabled) } : {},
      ...hasAccounts ? { accounts } : {},
      updatedAt: record.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  return { schema: 1, providers };
}
function reconcileModelSelection(enabledModelIds, models) {
  if (!Array.isArray(enabledModelIds)) return null;
  if (enabledModelIds.length === 0) return [];
  const available = new Set(
    (Array.isArray(models) ? models : []).map((model) => typeof model?.id === "string" ? model.id : null).filter(Boolean)
  );
  if (available.size === 0) return enabledModelIds;
  const kept = enabledModelIds.filter((id) => available.has(id));
  return kept.length > 0 ? kept : null;
}
var ModelSelectionStore = class {
  stateStore;
  state = { schema: 1, providers: {} };
  readyPromise;
  constructor({ stateStore } = {}) {
    if (!stateStore || typeof stateStore.load !== "function" || typeof stateStore.update !== "function" && typeof stateStore.save !== "function") {
      throw new TypeError("ModelSelectionStore requires a state store");
    }
    this.stateStore = stateStore;
    this.readyPromise = this.load();
  }
  async load() {
    const snapshot = await this.stateStore.load();
    const raw = snapshot?.modelSelection;
    if (raw && typeof raw === "object") {
      this.state = cleanState(raw);
    }
    return this.state;
  }
  async ready() {
    return this.readyPromise;
  }
  /**
   * A provider can serve a different model list per account, so a selection can
   * be stored per account. Without an account (or before one was ever saved for
   * that account) the provider-wide selection is the fallback, which keeps the
   * pre-existing single-list behaviour working.
   */
  get(providerId, accountId = null) {
    if (!providerId) return null;
    const record = this.state.providers?.[providerId];
    if (!record) return null;
    if (accountId && Array.isArray(record.accounts?.[accountId]?.enabled)) {
      return [...record.accounts[accountId].enabled];
    }
    if (!Array.isArray(record.enabled)) return null;
    return [...record.enabled];
  }
  async set(providerId, enabledModelIds, accountId = null) {
    if (!providerId) throw new Error("providerId is required");
    await this.ready();
    const cleaned = Array.isArray(enabledModelIds) ? cleanIds(enabledModelIds) : null;
    if (!this.state.providers) this.state.providers = {};
    if (accountId) {
      const record = this.state.providers[providerId] ?? {};
      const accounts = { ...record.accounts ?? {} };
      if (cleaned === null) {
        delete accounts[accountId];
      } else {
        accounts[accountId] = { enabled: cleaned, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      }
      const next = {
        ...record,
        ...Object.keys(accounts).length > 0 ? { accounts } : {},
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!Array.isArray(next.enabled) && !next.accounts) delete this.state.providers[providerId];
      else this.state.providers[providerId] = next;
    } else if (cleaned === null) {
      const record = this.state.providers[providerId];
      if (record?.accounts) {
        delete record.enabled;
        record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      } else {
        delete this.state.providers[providerId];
      }
    } else {
      const record = this.state.providers[providerId] ?? {};
      this.state.providers[providerId] = {
        ...record,
        enabled: cleaned,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const saved = structuredClone(this.state);
    if (typeof this.stateStore.update === "function") {
      await this.stateStore.update((latest) => ({
        ...latest,
        modelSelection: saved
      }));
    } else {
      const latest = await this.stateStore.load();
      await this.stateStore.save({
        ...latest,
        modelSelection: saved
      });
    }
    return cleaned;
  }
  isModelEnabled(providerId, modelId) {
    const enabled = this.get(providerId);
    if (enabled === null) return true;
    return enabled.includes(modelId);
  }
  filterModels(providerId, models = []) {
    const enabled = this.get(providerId);
    if (enabled === null) return models;
    const set = new Set(enabled);
    return models.filter((model) => set.has(model.id));
  }
};

// packages/dsh-bridge/src/llm-adapter.mjs
function defaultCatalogCachePath() {
  const home = process.env.DOCKYARD_DSH_HOME || join(homedir(), ".dockyard-dsh");
  return join(home, "catalog-cache.json");
}
function loadDiskCatalogCache(filePath) {
  try {
    if (!filePath || !existsSync(filePath)) return /* @__PURE__ */ new Map();
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const map = /* @__PURE__ */ new Map();
    if (parsed && typeof parsed === "object") {
      for (const [providerId, entry] of Object.entries(parsed)) {
        if (entry && Array.isArray(entry.value?.models) && entry.value.models.length > 0) {
          map.set(providerId, {
            value: entry.value,
            fetchedAt: Number(entry.fetchedAt) || Date.now()
          });
        }
      }
    }
    return map;
  } catch {
    return /* @__PURE__ */ new Map();
  }
}
function saveDiskCatalogCache(filePath, map) {
  try {
    if (!filePath) return;
    const obj = {};
    for (const [providerId, entry] of map) {
      if (entry && Array.isArray(entry.value?.models) && entry.value.models.length > 0) {
        obj[providerId] = {
          value: entry.value,
          fetchedAt: entry.fetchedAt
        };
      }
    }
    mkdirSync(dirname(filePath), { recursive: true, mode: 448 });
    writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
  } catch {
  }
}
function effortName(id) {
  return String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
function modelCapacityText(value) {
  if (!Number.isInteger(value) || value <= 0) return null;
  return `${new Intl.NumberFormat().format(value)} tokens`;
}
function modelDescription(model) {
  const details = [];
  if (typeof model.description === "string" && model.description.length > 0) {
    details.push(model.description);
  }
  const context = modelCapacityText(model.contextWindow);
  details.push(context ? `\u4E0A\u4E0B\u6587 ${context}` : "\u4E0A\u4E0B\u6587\u672A\u7531 provider \u8FD4\u56DE");
  const output = modelCapacityText(model.maxTokens);
  if (output) details.push(`\u8F93\u51FA\u4E0A\u9650 ${output}`);
  return details.join(" \xB7 ");
}
function normalizeDshReasoning(reasoning) {
  if (!reasoning || !Array.isArray(reasoning.efforts)) return void 0;
  const efforts = [];
  const seen = /* @__PURE__ */ new Set();
  for (const effort of reasoning.efforts) {
    if (!effort || typeof effort.id !== "string" || effort.id.length === 0 || seen.has(effort.id)) continue;
    const name2 = typeof effort.name === "string" && effort.name.length > 0 ? effort.name : effortName(effort.id);
    const normalized = {
      id: effort.id,
      name: name2,
      ...typeof effort.description === "string" ? { description: effort.description } : {}
    };
    efforts.push(normalized);
    seen.add(effort.id);
  }
  if (efforts.length === 0) return void 0;
  const defaultEffort = typeof reasoning.defaultEffort === "string" && seen.has(reasoning.defaultEffort) ? reasoning.defaultEffort : void 0;
  return {
    efforts,
    ...defaultEffort === void 0 ? {} : { defaultEffort }
  };
}
function cleanModelDisplayName(name2, id) {
  if (typeof name2 !== "string" || name2.length === 0) return id;
  return name2.replace(/^\[隐秘限免\]\s*/g, "").replace(/^\[限时免费\]\s*/g, "").replace(/\s*\(智能路由全部免费\/隐秘\/限免\)\s*$/g, "").replace(/\s*\[Free\]\s*$/i, "").replace(/\s*\(free\)\s*$/i, "").trim() || id;
}
function providerCatalogModels(providerId, catalog) {
  if (!Array.isArray(catalog?.models)) return [];
  const seen = /* @__PURE__ */ new Set();
  return catalog.models.filter((model) => {
    if (!model || model.unavailable === true) return false;
    if (typeof model.id !== "string" || model.id.length === 0 || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  }).map((model) => {
    const reasoning = normalizeDshReasoning(model.reasoning);
    const contextWindow = Number.isInteger(model.contextWindow) && model.contextWindow > 0 ? model.contextWindow : void 0;
    let defaultMaxTokens = void 0;
    if (Number.isInteger(model.maxTokens) && model.maxTokens > 0) {
      const cap = contextWindow ? Math.max(1024, Math.min(16384, Math.floor(contextWindow * 0.2))) : 16384;
      defaultMaxTokens = Math.min(model.maxTokens, cap);
    } else if (contextWindow) {
      defaultMaxTokens = Math.min(8192, Math.floor(contextWindow * 0.2));
    }
    return {
      provider: providerId,
      id: model.id,
      name: cleanModelDisplayName(model.name, model.id),
      description: modelDescription(model),
      ...Array.isArray(model.inputModalities) ? { inputModalities: [...model.inputModalities] } : {},
      ...contextWindow ? { context: { contextWindow } } : {},
      ...defaultMaxTokens !== void 0 ? { defaultMaxTokens } : {},
      ...reasoning ? { reasoning } : {}
    };
  });
}
function manifestFor(runtime, providerId) {
  return runtime.listProviderManifests?.().find((manifest) => manifest.id === providerId) ?? null;
}
function providerHasConnectedAccount(runtime, providerId) {
  if (runtime.hasProviderCapability?.(providerId, PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT)) return true;
  if (typeof runtime.snapshot !== "function") return true;
  const snapshot = runtime.snapshot();
  if (!Array.isArray(snapshot?.providers)) return true;
  const provider = snapshot.providers.find((entry) => entry?.providerId === providerId);
  return Array.isArray(provider?.accounts) && provider.accounts.length > 0;
}
function requestHasImage(value) {
  if (Array.isArray(value)) return value.some((item) => requestHasImage(item));
  if (!value || typeof value !== "object") return false;
  if (value.type === "image") return true;
  return Object.values(value).some((item) => requestHasImage(item));
}
function requestHasImageInCurrentTurn(request = {}) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  if (messages.length > 0) {
    const current = messages.at(-1)?.role === "user" ? messages.at(-1) : [...messages].reverse().find((message) => message?.role === "user") ?? messages.at(-1);
    return requestHasImage(current?.content ?? current?.text);
  }
  return requestHasImage(request.input);
}
function unsupportedContentError(message) {
  const error = new ValidationError(message);
  error.code = "UNSUPPORTED_CONTENT";
  return error;
}
var CONTEXT_OVERFLOW_PATTERNS = [
  /context[\s_-](?:length|window)[\s_-](?:exceed|overflow|limit)/i,
  /maximum context length/i,
  /max context window/i,
  /too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?(?:model(?:'s)?\s+)?context/i,
  /(?:input|prompt|request|messages?)\b.{0,40}(?:exceed|overflow|is\s+larger\s+than)\b.{0,40}\b(?:model(?:'s)?\s+)?context/i
];
function isContextOverflowError(errorOrMessage) {
  if (!errorOrMessage) return false;
  if (typeof errorOrMessage === "string") {
    return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(errorOrMessage));
  }
  const code = String(errorOrMessage.code ?? errorOrMessage.upstreamCode ?? "");
  if (/CONTEXT_WINDOW_EXCEEDED|CONTEXT_LENGTH_EXCEEDED/i.test(code)) return true;
  const message = String(errorOrMessage.message ?? errorOrMessage.reason ?? "");
  return CONTEXT_OVERFLOW_PATTERNS.some((pattern) => pattern.test(message));
}
function normalizeTransportFailure(chunk) {
  const failure = chunk?.type === "finish" && chunk.reason?.kind === "error" ? chunk.reason.failure : null;
  if (!failure) return chunk;
  if (failure.code !== "TRANSPORT" && /\bWebSocket closed\s+1006\b/i.test(String(failure.message ?? ""))) {
    return {
      ...chunk,
      reason: {
        ...chunk.reason,
        failure: {
          ...failure,
          code: "TRANSPORT"
        }
      }
    };
  }
  if (failure.code !== "CONTEXT_WINDOW_EXCEEDED" && isContextOverflowError(failure)) {
    return {
      ...chunk,
      reason: {
        ...chunk.reason,
        failure: {
          ...failure,
          code: "CONTEXT_WINDOW_EXCEEDED"
        }
      }
    };
  }
  return chunk;
}
var RETRYABLE_THROWN_FAILURE_CODES = /* @__PURE__ */ new Set([
  "CONTEXT_WINDOW_EXCEEDED",
  "EMPTY_RESPONSE",
  "RATE_LIMIT",
  "SERVER",
  "TIMEOUT",
  "TRANSPORT"
]);
function retryFinishFromThrownError(error) {
  let code = error?.code;
  if (code === "EMPTY_STREAM_OUTPUT" && error?.emptyOutput === true) {
    code = "EMPTY_RESPONSE";
  } else if (code === "PI_AI_ERROR" && /\bWebSocket closed\s+1006\b/i.test(String(error.message ?? ""))) {
    code = "TRANSPORT";
  } else if (isContextOverflowError(error)) {
    code = "CONTEXT_WINDOW_EXCEEDED";
  } else if (code === "TRANSPORT" || /\bfetch failed\b/i.test(String(error?.message ?? "")) || error?.cause?.code === "ECONNRESET" || error?.cause?.code === "ETIMEDOUT") {
    code = "TRANSPORT";
  }
  if (!RETRYABLE_THROWN_FAILURE_CODES.has(code)) return null;
  return {
    type: "finish",
    reason: {
      kind: "error",
      failure: {
        code,
        message: String(error.message ?? "Provider stream ended without substantive output"),
        ...Number.isInteger(error.status) ? { status: error.status } : {},
        ...typeof error.providerRetryAfterMs === "number" && Number.isFinite(error.providerRetryAfterMs) ? { providerRetryAfterMs: error.providerRetryAfterMs } : {}
      }
    }
  };
}
function resolveFallbackModelMetadata(provider, model) {
  const id = String(model ?? "").toLowerCase();
  let contextWindow = 131072;
  let maxTokens = 8192;
  if (id.includes("gemini")) {
    contextWindow = 1048576;
    maxTokens = 16384;
  } else if (id.includes("claude-sonnet-4") || id.includes("claude-4")) {
    contextWindow = 1e6;
    maxTokens = 16384;
  } else if (id.includes("claude")) {
    contextWindow = 2e5;
    maxTokens = 8192;
  } else if (id.includes("grok-4")) {
    contextWindow = 256e3;
    maxTokens = 8192;
  } else if (id.includes("qwen")) {
    contextWindow = 262144;
    maxTokens = 8192;
  } else if (id.includes("glm-5")) {
    contextWindow = 204800;
    maxTokens = 8192;
  } else if (id.includes("deepseek-v4") || id.includes("deepseek-v3") || id.includes("deepseek-r1")) {
    contextWindow = 2e5;
    maxTokens = 8192;
  } else if (id.includes("gpt-") || id.includes("codex-") || provider === "openai-codex") {
    contextWindow = 2e5;
    maxTokens = 8192;
  } else if (provider === "commandcode" || provider === "hermes") {
    contextWindow = 1e6;
    maxTokens = 16384;
  } else if (provider === "openrouter-free") {
    if (id === "openrouter/free" || id === "free") {
      contextWindow = 2e5;
      maxTokens = 16384;
    } else if (id.includes("crouton") || id.includes("inkling")) {
      contextWindow = 1048576;
      maxTokens = 16384;
    } else if (id.includes("nemotron-3.5-super") || id.includes("nemotron-3.5-lightning") || id.includes("nemotron-3-ultra")) {
      contextWindow = 1e6;
      maxTokens = 16384;
    } else if (id.includes("dots-3")) {
      contextWindow = 512e3;
      maxTokens = 16384;
    } else if (id.includes("lfm-2.5")) {
      contextWindow = 65536;
      maxTokens = 8192;
    } else {
      contextWindow = 262144;
      maxTokens = 16384;
    }
  }
  return {
    provider,
    id: model,
    name: model,
    context: { contextWindow },
    defaultMaxTokens: maxTokens
  };
}
function createDockyardLlmAdapter({
  runtime,
  providerIds,
  attachmentsResolver = null,
  catalogCachePath = null,
  onCatalogChanged = null
} = {}) {
  if (!runtime) throw new ValidationError("Dockyard runtime is required");
  const owned = [...providerIds ?? runtime.listProviderIds?.() ?? []];
  if (owned.length === 0) throw new ValidationError("At least one Dockyard provider is required");
  const catalogPromises = /* @__PURE__ */ new Map();
  const catalogCache = catalogCachePath ? loadDiskCatalogCache(catalogCachePath) : /* @__PURE__ */ new Map();
  const STREAM_CATALOG_REFRESH_MS = 6e4;
  async function ensureRuntimeReady() {
    if (typeof runtime.init === "function") await runtime.init();
  }
  async function ensurePreparedForListing() {
    if (typeof runtime.whenPrepared === "function") await runtime.whenPrepared();
    else await ensureRuntimeReady();
  }
  function abortedCallerError(signal) {
    const error = new Error("This model lookup was aborted");
    error.name = "AbortError";
    if (signal?.reason !== void 0) error.cause = signal.reason;
    return error;
  }
  function raceCallerSignal(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(abortedCallerError(signal));
    return new Promise((resolve2, reject) => {
      const onAbort = () => reject(abortedCallerError(signal));
      signal.addEventListener("abort", onAbort, { once: true });
      promise.then(
        (value) => {
          signal.removeEventListener("abort", onAbort);
          resolve2(value);
        },
        (error) => {
          signal.removeEventListener("abort", onAbort);
          reject(error);
        }
      );
    });
  }
  function modelSignature(catalog) {
    const ids = Array.isArray(catalog?.models) ? catalog.models.map((model) => model?.id).filter(Boolean) : [];
    return ids.sort().join("\n");
  }
  function catalogAccountId(provider) {
    try {
      return runtime.getDefaultAccountId?.(provider) ?? null;
    } catch {
      return null;
    }
  }
  function catalogKey(provider) {
    const accountId = catalogAccountId(provider);
    return accountId ? `${provider}::${accountId}` : provider;
  }
  async function providerCatalog(provider, signal, { force = false } = {}) {
    if (!force) {
      const cached = cachedProviderCatalog(provider);
      if (cached) return cached;
    }
    const key = catalogKey(provider);
    let promise = catalogPromises.get(key);
    if (!promise) {
      const accountId = catalogAccountId(provider);
      promise = Promise.resolve().then(() => runtime.getCatalog(provider, { force, ...accountId ? { accountId } : {} })).then((catalog) => {
        if (Array.isArray(catalog?.models) && catalog.models.length > 0) {
          const previous = catalogCache.get(key)?.value;
          catalogCache.set(key, { value: catalog, fetchedAt: Date.now() });
          saveDiskCatalogCache(catalogCachePath, catalogCache);
          if (previous && modelSignature(previous) !== modelSignature(catalog)) {
            try {
              onCatalogChanged?.(provider);
            } catch {
            }
          }
        }
        return catalog;
      }).finally(() => {
        if (catalogPromises.get(key) === promise) catalogPromises.delete(key);
      });
      catalogPromises.set(key, promise);
    }
    return raceCallerSignal(promise, signal);
  }
  function cachedProviderCatalog(provider) {
    const key = catalogKey(provider);
    let entry = catalogCache.get(key);
    if (!entry) {
      const legacy = catalogCache.get(provider);
      if (legacy) {
        catalogCache.set(key, { ...legacy, fetchedAt: 0 });
        entry = catalogCache.get(key);
      }
    }
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt >= STREAM_CATALOG_REFRESH_MS && !catalogPromises.has(key)) {
      void providerCatalog(provider, void 0, { force: true }).catch(() => {
      });
    }
    return entry.value;
  }
  function warmProviderCatalog(provider) {
    const key = catalogKey(provider);
    if (!catalogCache.has(key) && !catalogPromises.has(key)) {
      void providerCatalog(provider).catch(() => {
      });
    }
  }
  function fastResolveModel(provider, model) {
    const fallback = resolveFallbackModelMetadata(provider, model);
    const catalog = cachedProviderCatalog(provider);
    if (!catalog) {
      warmProviderCatalog(provider);
      return fallback;
    }
    return providerCatalogModels(provider, catalog).find((entry) => entry.id === model) ?? fallback;
  }
  return {
    providerInfo(provider) {
      const manifest = manifestFor(runtime, provider);
      return { id: provider, name: manifest?.displayName ?? provider };
    },
    providerRetryPolicy() {
      return void 0;
    },
    imageRequestPricing(_provider, _model) {
      return void 0;
    },
    imageRequestTarget(_provider, _model, image) {
      return {
        width: image?.width ?? 0,
        height: image?.height ?? 0,
        maxBytes: image?.bytes ?? 0
      };
    },
    async listModels(provider, signal) {
      await ensurePreparedForListing();
      if (!providerHasConnectedAccount(runtime, provider)) return [];
      const cached = cachedProviderCatalog(provider);
      const catalog = cached ?? await providerCatalog(provider, signal);
      const allModels = providerCatalogModels(provider, catalog);
      const servingAccountId = typeof runtime.getDefaultAccountId === "function" ? runtime.getDefaultAccountId(provider) : null;
      const enabled = runtime.getModelSelection?.(provider, servingAccountId);
      const reconciled = reconcileModelSelection(enabled, allModels);
      if (Array.isArray(reconciled)) {
        const set = new Set(reconciled);
        return allModels.filter((entry) => set.has(entry.id));
      }
      return allModels;
    },
    async resolveModel(provider, model, signal) {
      await ensurePreparedForListing();
      const fallback = resolveFallbackModelMetadata(provider, model);
      if (!providerHasConnectedAccount(runtime, provider)) return fallback;
      const cached = cachedProviderCatalog(provider);
      if (cached) {
        return providerCatalogModels(provider, cached).find((entry) => entry.id === model) ?? fallback;
      }
      const catalog = await providerCatalog(provider, signal);
      return providerCatalogModels(provider, catalog).find((entry) => entry.id === model) ?? fallback;
    },
    async prepareCall(provider, model, signal) {
      return {
        // DSH may call prepareCall immediately before generation. Do not make
        // that path wait for a cold provider catalog; listModels/resolveModel
        // remain the explicit, authoritative discovery APIs.
        model: fastResolveModel(provider, model),
        stream: (options = {}) => this.stream(
          signal && options.signal === void 0 ? { ...options, signal } : options
        )
      };
    },
    async *stream(options) {
      if (typeof runtime.whenPrepared === "function") {
        await runtime.whenPrepared();
        if (!providerHasConnectedAccount(runtime, options.provider)) await ensureRuntimeReady();
      } else {
        await ensureRuntimeReady();
      }
      if (!providerHasConnectedAccount(runtime, options.provider)) {
        throw new ValidationError(`Provider ${options.provider} has no connected Dockyard account`);
      }
      const catalog = cachedProviderCatalog(options.provider);
      if (!catalog) warmProviderCatalog(options.provider);
      const model = catalog ? providerCatalogModels(options.provider, catalog).find((entry) => entry.id === options.model) : null;
      if (requestHasImageInCurrentTurn(options) && Array.isArray(model?.inputModalities) && !model.inputModalities.includes("image")) {
        throw unsupportedContentError(
          `\u6A21\u578B ${model.name ?? model.id} \u7684\u5B9E\u65F6 provider catalog \u672A\u58F0\u660E\u56FE\u7247\u8F93\u5165\u80FD\u529B`
        );
      }
      const request = model ? {
        ...options,
        ...model.context ? { modelContext: { ...model.context } } : {},
        ...model.defaultMaxTokens !== void 0 ? { modelContext: { ...model.context ?? {}, maxTokens: model.defaultMaxTokens } } : {}
      } : { ...options };
      if (options.purpose === "compaction") {
        request.purpose = "compaction";
        request.reasoningEffort = "minimal";
        request.reasoning_effort = "minimal";
        request.thinking = false;
      }
      const attachments = typeof attachmentsResolver === "function" ? attachmentsResolver() : void 0;
      const stream = await runtime.stream(options.provider, request, {
        accountId: options.accountId,
        requestId: options.requestId,
        sessionId: options.sessionId,
        ...options.signal ? { signal: options.signal } : {},
        ...attachments ? { attachments } : {}
      });
      let emittedChunk = false;
      try {
        for await (const chunk of stream) {
          emittedChunk = true;
          yield normalizeTransportFailure(chunk);
        }
      } catch (error) {
        if (!emittedChunk || isContextOverflowError(error)) {
          const retryFinish = retryFinishFromThrownError(error);
          if (retryFinish) {
            yield retryFinish;
            return;
          }
        }
        throw error;
      }
    },
    providers() {
      return [...owned];
    },
    invalidateCatalog(provider) {
      if (provider) {
        catalogCache.delete(provider);
        catalogPromises.delete(provider);
      } else {
        catalogCache.clear();
        catalogPromises.clear();
      }
    }
  };
}

// packages/dsh-bridge/src/index.mjs
var DshInjectionBridge = class {
  #routes = /* @__PURE__ */ new Map();
  constructor({ runtime, adapter = null, contextWindowOverrides = null } = {}) {
    if (!runtime) throw new ValidationError("DSH runtime is required");
    this.runtime = runtime;
    this.adapter = adapter;
    this.contextWindowOverrides = contextWindowOverrides;
  }
  async mountProvider(providerModule, accountPool) {
    const providerId = providerModule?.manifest?.id;
    if (!providerId) throw new ValidationError("Provider module is required");
    if (!this.runtime.has(providerId)) await this.runtime.register(providerModule);
    const previous = this.#routes.get(providerId) ?? null;
    const route = createProviderRoute({
      providerModule,
      accountPool,
      contextWindowOverrides: this.contextWindowOverrides
    });
    let adapterMounted = false;
    try {
      if (this.adapter?.registerProviderRoute) {
        await this.adapter.registerProviderRoute(route, providerModule.manifest);
        adapterMounted = true;
      }
      this.#routes.set(providerId, route);
      await this.runtime.events.emit("dsh/provider-mounted", {
        providerId,
        manifest: { ...providerModule.manifest }
      });
      return route;
    } catch (error) {
      if (this.#routes.get(providerId) === route) this.#routes.delete(providerId);
      if (adapterMounted && this.adapter?.unregisterProviderRoute) {
        await this.adapter.unregisterProviderRoute(providerId).catch(() => {
        });
        if (previous) {
          await this.adapter.registerProviderRoute(previous, providerModule.manifest).catch(() => {
          });
          this.#routes.set(providerId, previous);
        }
      }
      throw error;
    }
  }
  async unmountProvider(providerId) {
    const route = this.#routes.get(providerId);
    if (!route) return false;
    if (this.adapter?.unregisterProviderRoute) await this.adapter.unregisterProviderRoute(providerId);
    this.#routes.delete(providerId);
    await this.runtime.events.emit("dsh/provider-unmounted", { providerId });
    return true;
  }
  getRoute(providerId) {
    return this.#routes.get(providerId) ?? null;
  }
  listRoutes() {
    return [...this.#routes.keys()];
  }
};

// packages/vault/src/index.mjs
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { dirname as dirname2, join as join2 } from "node:path";
import { fileURLToPath } from "node:url";
var KEYCHAIN_SERVICE = "com.dockyard-dsh.credentials";
var SWIFT_BIN = "/usr/bin/swift";
var KEYCHAIN_HELPER = join2(dirname2(fileURLToPath(import.meta.url)), "macos-keychain-helper.swift");
function stableKey(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
function runKeychainHelper(request, { timeoutMs = 3e4 } = {}) {
  return new Promise((resolve2, reject) => {
    let settled = false;
    let timer;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const child = spawn(SWIFT_BIN, [KEYCHAIN_HELPER], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout = [];
    let exitError = "";
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => {
      exitError += chunk.toString();
    });
    child.on("error", (error) => finish(reject, error));
    child.on("close", (code) => {
      if (settled) return;
      if (code === 0) {
        try {
          finish(resolve2, JSON.parse(Buffer.concat(stdout).toString("utf8")));
        } catch {
          finish(reject, new Error("macOS Keychain helper returned invalid data"));
        }
        return;
      }
      const error = new Error("macOS Keychain operation failed");
      error.code = code;
      error.detail = exitError.replace(/\s+/g, " ").trim().slice(0, 300);
      finish(reject, error);
    });
    timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error("macOS Keychain operation timed out");
      error.code = "ETIMEDOUT";
      finish(reject, error);
    }, timeoutMs);
    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}
function createCredentialRef(providerId, accountId) {
  return `keychain://dockyard-dsh/${stableKey(`${providerId}:${accountId}`)}`;
}
var UnavailableSecretStore = class {
  constructor({ platform = process.platform } = {}) {
    this.platform = platform;
  }
  async read() {
    return null;
  }
  async write() {
    throw new Error(`Secure credential storage is unavailable on ${this.platform}; configure the host credential service`);
  }
  async delete() {
  }
};
var MacOSKeychainStore = class {
  constructor({ service = KEYCHAIN_SERVICE } = {}) {
    this.service = service;
  }
  async read(ref) {
    try {
      const output = await runKeychainHelper({ operation: "read", service: this.service, account: ref, value: null });
      return output.found ? JSON.parse(output.value) : null;
    } catch (error) {
      throw error;
    }
  }
  async write(ref, value) {
    await runKeychainHelper({
      operation: "write",
      service: this.service,
      account: ref,
      value: JSON.stringify(value)
    });
    return ref;
  }
  async delete(ref) {
    await runKeychainHelper({ operation: "delete", service: this.service, account: ref, value: null });
  }
};
function createDefaultSecretStore({ platform = process.platform } = {}) {
  if (platform !== "darwin") return new UnavailableSecretStore({ platform });
  return new MacOSKeychainStore();
}
var secretStoreConstants = Object.freeze({
  keychainService: KEYCHAIN_SERVICE
});

// packages/runtime/src/state-store.mjs
import { mkdir, open, readFile as readFile2, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname as dirname3, join as join3 } from "node:path";
import { homedir as homedir2 } from "node:os";
import { randomUUID } from "node:crypto";
var LOCK_RETRY_MS = 25;
var LOCK_TIMEOUT_MS = 3e4;
var LOCK_STALE_MS = 12e4;
function delay(milliseconds) {
  return new Promise((resolve2) => setTimeout(resolve2, milliseconds));
}
function parseLockOwner(value) {
  const [pidText, token] = String(value ?? "").trim().split(/\s+/, 2);
  const pid = Number(pidText);
  return Number.isInteger(pid) && pid > 0 && token ? { pid, token } : null;
}
function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}
async function removeLockIfOwned(lockPath, token) {
  try {
    const owner = parseLockOwner(await readFile2(lockPath, "utf8"));
    if (!owner && !token) {
      await rm(lockPath, { force: true });
      return true;
    }
    if (owner?.token !== token) return false;
    await rm(lockPath, { force: true });
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
async function acquireFileLock(filePath) {
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  await mkdir(dirname3(filePath), { recursive: true, mode: 448 });
  while (true) {
    try {
      const handle = await open(lockPath, "wx", 384);
      const token = randomUUID();
      try {
        await handle.writeFile(`${process.pid} ${token}
`, "utf8");
      } catch (error) {
        await handle.close().catch(() => {
        });
        await removeLockIfOwned(lockPath, token).catch(() => {
        });
        throw error;
      }
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        await handle.close().catch(() => {
        });
        await removeLockIfOwned(lockPath, token).catch(() => {
        });
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        const metadata = await stat(lockPath);
        if (Date.now() - metadata.mtimeMs > LOCK_STALE_MS) {
          const owner = parseLockOwner(await readFile2(lockPath, "utf8").catch(() => ""));
          if (!owner || !processIsAlive(owner.pid)) {
            await removeLockIfOwned(lockPath, owner?.token ?? "");
            continue;
          }
        }
      } catch (lockError) {
        if (lockError?.code !== "ENOENT") throw lockError;
        continue;
      }
      if (Date.now() >= deadline) {
        const timeout = new Error(`Timed out waiting for state file lock: ${filePath}`);
        timeout.code = "ELOCKTIMEOUT";
        throw timeout;
      }
      await delay(LOCK_RETRY_MS);
    }
  }
}
async function withFileLock(filePath, operation) {
  const release = await acquireFileLock(filePath);
  try {
    return await operation();
  } finally {
    await release();
  }
}
function defaultDockyardHome({ env = process.env, home = homedir2() } = {}) {
  return env.DOCKYARD_DSH_HOME || join3(home, ".dockyard-dsh");
}
function defaultDockyardStatePath(options = {}) {
  return join3(defaultDockyardHome(options), "state.json");
}
function emptyState() {
  return {
    schema: 1,
    pools: {},
    updatedAt: null
  };
}
var JsonStateStore = class {
  constructor({ filePath, home, env } = {}) {
    this.filePath = filePath ?? defaultDockyardStatePath({ home, env });
  }
  async load() {
    return withFileLock(this.filePath, () => this.#loadUnlocked());
  }
  /**
   * Load without acquiring the file lock. Callers already holding the lock
   * (save/update) use this to avoid re-entrant lock acquisition.
   */
  async #loadUnlocked() {
    let raw;
    try {
      raw = await readFile2(this.filePath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return emptyState();
      throw error;
    }
    try {
      return this.#parse(raw);
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      try {
        raw = await readFile2(this.filePath, "utf8");
        return this.#parse(raw);
      } catch (retryError) {
        if (retryError?.code === "ENOENT") return emptyState();
        if (!(retryError instanceof SyntaxError)) throw retryError;
      }
      const archivePath = `${this.filePath}.corrupted.${Date.now()}`;
      await rename(this.filePath, archivePath).catch(() => {
      });
      return emptyState();
    }
  }
  #parse(raw) {
    const parsed = JSON.parse(raw);
    return {
      ...emptyState(),
      ...parsed,
      pools: parsed?.pools && typeof parsed.pools === "object" ? parsed.pools : {}
    };
  }
  async save(state) {
    return withFileLock(this.filePath, async () => {
      const current = await this.#loadUnlocked();
      return this.#write({ ...current, ...state ?? {} });
    });
  }
  async update(mutator) {
    if (typeof mutator !== "function") throw new TypeError("State update mutator must be a function");
    return withFileLock(this.filePath, async () => {
      const current = await this.#loadUnlocked();
      const next = await mutator(current);
      return this.#write(next);
    });
  }
  async #write(state) {
    const next = {
      ...emptyState(),
      ...state,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await mkdir(dirname3(this.filePath), { recursive: true, mode: 448 });
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    let committed = false;
    try {
      await writeFile(tempPath, `${JSON.stringify(next, null, 2)}
`, { mode: 384 });
      const handle = await open(tempPath, "r+");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(tempPath, this.filePath);
      committed = true;
      try {
        const directory = await open(dirname3(this.filePath), "r");
        try {
          await directory.sync();
        } catch {
        } finally {
          await directory.close();
        }
      } catch {
      }
      return next;
    } finally {
      if (!committed) await rm(tempPath, { force: true }).catch(() => {
      });
    }
  }
};

// packages/runtime/src/context-window-overrides.mjs
var MAX_CONTEXT_WINDOW = Number.MAX_SAFE_INTEGER;
function text(value) {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}
function normalizeContextWindow(value) {
  if (value === null || value === void 0 || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replaceAll(",", "").trim());
  if (!Number.isSafeInteger(numeric) || numeric <= 0 || numeric > MAX_CONTEXT_WINDOW) return null;
  return numeric;
}
function normalizedMap2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}
function cleanModelMap(value) {
  const output = {};
  for (const [modelId, raw] of Object.entries(normalizedMap2(value))) {
    const id = text(modelId);
    const contextWindow = normalizeContextWindow(raw);
    if (id && contextWindow !== null) output[id] = contextWindow;
  }
  return output;
}
function cleanNestedModelMap(value) {
  const output = {};
  for (const [scopeId, models] of Object.entries(normalizedMap2(value))) {
    const id = text(scopeId);
    const cleaned = cleanModelMap(models);
    if (id && Object.keys(cleaned).length > 0) output[id] = cleaned;
  }
  return output;
}
function cleanProviderRecord(value) {
  return {
    models: cleanModelMap(value?.models),
    accounts: cleanNestedModelMap(value?.accounts),
    keys: cleanNestedModelMap(value?.keys)
  };
}
function cleanState2(value) {
  const providers = {};
  for (const [providerId, record] of Object.entries(normalizedMap2(value?.providers))) {
    const id = text(providerId);
    if (!id) continue;
    const cleaned = cleanProviderRecord(record);
    if (Object.values(cleaned).some((map) => Object.keys(map).length > 0)) providers[id] = cleaned;
  }
  return { schema: 1, providers };
}
function assertScope(scope = {}) {
  const providerId = text(scope.providerId);
  const modelId = text(scope.modelId);
  const accountId = text(scope.accountId);
  const keyRef = text(scope.keyRef);
  if (!providerId) throw new Error("\u4E0A\u4E0B\u6587\u8986\u76D6\u914D\u7F6E\u9700\u8981 providerId");
  if (!modelId) throw new Error("\u4E0A\u4E0B\u6587\u8986\u76D6\u914D\u7F6E\u9700\u8981 modelId");
  if (accountId && keyRef) throw new Error("\u4E0A\u4E0B\u6587\u8986\u76D6\u914D\u7F6E\u4E0D\u80FD\u540C\u65F6\u7ED1\u5B9A\u8D26\u53F7\u548C Key");
  return {
    providerId,
    modelId,
    ...accountId ? { accountId } : {},
    ...keyRef ? { keyRef } : {}
  };
}
function bucketFor(scope) {
  if (scope.keyRef) return ["keys", scope.keyRef];
  if (scope.accountId) return ["accounts", scope.accountId];
  return ["models", null];
}
function exactValue(state, scope) {
  const provider = state.providers?.[scope.providerId];
  if (!provider) return null;
  const [bucket, scopeId] = bucketFor(scope);
  const models = scopeId ? provider[bucket]?.[scopeId] : provider.models;
  return normalizeContextWindow(models?.[scope.modelId]);
}
function resolveValue(state, scope) {
  const provider = state.providers?.[scope.providerId];
  if (!provider) return null;
  if (scope.keyRef) {
    const keyValue = normalizeContextWindow(provider.keys?.[scope.keyRef]?.[scope.modelId]);
    if (keyValue !== null) return keyValue;
  }
  if (scope.accountId) {
    const accountValue = normalizeContextWindow(provider.accounts?.[scope.accountId]?.[scope.modelId]);
    if (accountValue !== null) return accountValue;
  }
  return normalizeContextWindow(provider.models?.[scope.modelId]);
}
function cloneState(value) {
  return structuredClone(cleanState2(value));
}
function removeEmptyScopes(provider, bucket, scopeId) {
  if (bucket === "models") return;
  if (Object.keys(provider[bucket]?.[scopeId] ?? {}).length === 0) delete provider[bucket][scopeId];
}
function removeEmptyProvider(state, providerId) {
  const provider = state.providers?.[providerId];
  if (!provider) return;
  if (Object.values(provider).every((map) => Object.keys(map).length === 0)) delete state.providers[providerId];
}
var ContextWindowOverrideStore = class {
  stateStore;
  state = { schema: 1, providers: {} };
  readyPromise;
  constructor({ stateStore } = {}) {
    if (!stateStore || typeof stateStore.load !== "function" || typeof stateStore.update !== "function" && typeof stateStore.save !== "function") {
      throw new TypeError("Context window override store requires a state store");
    }
    this.stateStore = stateStore;
    this.readyPromise = this.load();
  }
  async load() {
    const snapshot = await this.stateStore.load();
    this.state = cleanState2(snapshot?.contextWindowOverrides);
    return this;
  }
  async ready() {
    await this.readyPromise;
    return this;
  }
  describe(input) {
    const scope = assertScope(input);
    const override = exactValue(this.state, scope);
    const inherited = resolveValue(this.state, {
      providerId: scope.providerId,
      modelId: scope.modelId,
      ...scope.accountId ? { accountId: scope.accountId } : {},
      ...scope.keyRef ? { keyRef: scope.keyRef } : {}
    });
    return {
      ...scope,
      override,
      effectiveOverride: inherited,
      source: override !== null ? "custom" : inherited !== null ? "inherited" : "auto"
    };
  }
  resolve(providerId, modelId, scope = {}) {
    const normalized = assertScope({ providerId, modelId, ...scope });
    return resolveValue(this.state, normalized);
  }
  hasAny(providerId, modelId) {
    const normalizedProvider = text(providerId);
    const normalizedModel = text(modelId);
    if (!normalizedProvider || !normalizedModel) return false;
    const provider = this.state.providers?.[normalizedProvider];
    if (!provider) return false;
    if (normalizeContextWindow(provider.models?.[normalizedModel]) !== null) return true;
    return [provider.accounts, provider.keys].some((scopes) => Object.values(scopes ?? {}).some((models) => normalizeContextWindow(models?.[normalizedModel]) !== null));
  }
  async get(input) {
    await this.ready();
    return this.describe(input);
  }
  async set(input, value) {
    await this.ready();
    const scope = assertScope(input);
    const contextWindow = value === null || value === void 0 || value === "" ? null : normalizeContextWindow(value);
    if (value !== null && value !== void 0 && value !== "" && contextWindow === null) {
      throw new Error("\u4E0A\u4E0B\u6587\u4E0A\u9650\u5FC5\u987B\u662F\u6B63\u6574\u6570 token \u6570");
    }
    const mutate = (current) => {
      const next = {
        ...current,
        contextWindowOverrides: cloneState(current?.contextWindowOverrides)
      };
      const overrides = next.contextWindowOverrides;
      const provider = overrides.providers[scope.providerId] ?? {
        models: {},
        accounts: {},
        keys: {}
      };
      overrides.providers[scope.providerId] = provider;
      const [bucket, scopeId] = bucketFor(scope);
      const models = scopeId ? provider[bucket][scopeId] ??= {} : provider.models;
      if (contextWindow === null) delete models[scope.modelId];
      else models[scope.modelId] = contextWindow;
      removeEmptyScopes(provider, bucket, scopeId);
      removeEmptyProvider(overrides, scope.providerId);
      return { ...next, contextWindowOverrides: cleanState2(overrides) };
    };
    const saved = typeof this.stateStore.update === "function" ? await this.stateStore.update(mutate) : await this.stateStore.save(mutate(await this.stateStore.load()));
    this.state = cleanState2(saved?.contextWindowOverrides);
    return this.describe(scope);
  }
};

// modules/provider-codex/src/driver.mjs
import { createHash as createHash3 } from "node:crypto";
import { homedir as homedir3 } from "node:os";
import { dirname as dirname5, join as join6 } from "node:path";

// packages/oauth/src/browser-oauth-authorizer.mjs
import { createHash as createHash2, randomBytes, randomUUID as randomUUID2 } from "node:crypto";
import { createServer } from "node:http";
var DEFAULT_TIMEOUT_MS = 10 * 60 * 1e3;
var DEFAULT_CALLBACK_PATH = "/oauth/callback";
function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}
function createPkce() {
  const verifier = base64Url(randomBytes(32));
  const challenge = createHash2("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
function publicSession(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status,
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...session.browserOpened ? { browserOpened: true } : {},
    ...session.authorizationCodeRequired ? { authorizationCodeRequired: true } : {}
  };
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}
var LOOPBACK_HOSTNAMES2 = /* @__PURE__ */ new Set(["localhost", "127.0.0.1", "::1"]);
function isLoopbackHostname2(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return LOOPBACK_HOSTNAMES2.has(bare);
}
function assertSafeCallbackHost(host) {
  const value = String(host ?? "").trim();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value.toLowerCase();
  if (!isLoopbackHostname2(bare)) {
    throw new Error(`OAuth callback host must be loopback (localhost / 127.0.0.1 / ::1), got: ${value || "<empty>"}`);
  }
}
function resolveLoopbackListenHost(host) {
  const bare = String(host ?? "").trim().toLowerCase();
  return bare === "::1" || bare === "[::1]" ? "::1" : "127.0.0.1";
}
function missingSession(sessionId, providerId, instructions) {
  return {
    sessionId,
    providerId,
    status: "missing",
    instructions,
    diagnostic: "OAuth \u767B\u5F55\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002"
  };
}
function extractCodeInput(input) {
  const text3 = String(input ?? "").trim();
  if (!text3) return { code: "", state: "" };
  try {
    const url = new URL(text3);
    return {
      code: url.searchParams.get("code") ?? "",
      state: url.searchParams.get("state") ?? "",
      error: url.searchParams.get("error") ?? ""
    };
  } catch {
    const [code, state] = text3.split("#", 2);
    return { code: code.trim(), state: state?.trim() ?? "" };
  }
}
function createBrowserOAuthAuthorizer({
  providerId,
  authorizationUrlBuilder,
  exchangeCode = null,
  pollSession = null,
  importCredentials,
  redirectUri,
  callbackPath = DEFAULT_CALLBACK_PATH,
  callbackHost = "localhost",
  callbackPort = null,
  instructions = "\u8BF7\u5728\u5B98\u65B9\u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\u3002",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  browserOpened = false,
  authorizationCodeRequired = false
} = {}) {
  if (!providerId) throw new Error("Browser OAuth authorizer requires providerId");
  if (typeof authorizationUrlBuilder !== "function") {
    throw new Error(`Browser OAuth authorizer requires an authorization URL builder for ${providerId}`);
  }
  if (typeof exchangeCode !== "function" && typeof pollSession !== "function") {
    throw new Error(`Browser OAuth authorizer requires a code exchange or session poller for ${providerId}`);
  }
  if (typeof importCredentials !== "function") {
    throw new Error(`Browser OAuth authorizer requires an import callback for ${providerId}`);
  }
  if (!redirectUri && callbackPort === null && typeof pollSession !== "function") {
    throw new Error(`Browser OAuth authorizer requires redirectUri or callbackPort for ${providerId}`);
  }
  assertSafeCallbackHost(callbackHost ?? "localhost");
  if (redirectUri) {
    let parsedRedirectUri = null;
    try {
      parsedRedirectUri = new URL(redirectUri);
    } catch {
      throw new Error(`Browser OAuth authorizer has an invalid redirectUri for ${providerId}`);
    }
    if (parsedRedirectUri.protocol === "http:" && !isLoopbackHostname2(parsedRedirectUri.hostname)) {
      throw new Error(
        `Browser OAuth redirectUri over plain http must use a loopback host for ${providerId}, got: ${parsedRedirectUri.hostname}`
      );
    }
  }
  const sessions = /* @__PURE__ */ new Map();
  async function closeServer(session) {
    if (!session.server) return;
    const server = session.server;
    session.server = null;
    await new Promise((resolve2) => {
      server.close(() => resolve2());
      server.closeAllConnections?.();
    }).catch(() => {
    });
  }
  async function cleanup(session) {
    if (session.timer) clearTimeout(session.timer);
    await closeServer(session);
  }
  function responseHtml(res, title, message, statusCode = 200) {
    res.statusCode = statusCode;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><p>${escapeHtml(message)}</p><p>\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u5E76\u8FD4\u56DE Dockyard DSH\u3002</p>`);
  }
  async function handleCallback(session, req, res) {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    if (requestUrl.pathname !== session.callbackPath) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const error = requestUrl.searchParams.get("error");
    const code = requestUrl.searchParams.get("code") ?? "";
    const state = requestUrl.searchParams.get("state") ?? "";
    if (state !== session.state) {
      session.status = "failed";
      session.diagnostic = "OAuth state \u6821\u9A8C\u5931\u8D25";
      responseHtml(res, "\u6388\u6743\u672A\u5B8C\u6210", "\u5B89\u5168\u6821\u9A8C\u5931\u8D25\uFF0C\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u5E76\u91CD\u65B0\u5F00\u59CB\u6388\u6743\u3002", 400);
      await cleanup(session);
      return;
    }
    if (error) {
      session.callback = { error, state };
      responseHtml(res, "\u6388\u6743\u672A\u5B8C\u6210", "\u5B98\u65B9\u6388\u6743\u88AB\u62D2\u7EDD\uFF0C\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u3002");
      return;
    }
    if (!code) {
      session.callback = { error: "\u6388\u6743\u56DE\u8C03\u6CA1\u6709\u8FD4\u56DE code", state };
      responseHtml(res, "\u6388\u6743\u672A\u5B8C\u6210", "\u56DE\u8C03\u7F3A\u5C11\u6388\u6743\u7801\uFF0C\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u3002");
      return;
    }
    session.callback = { code, state };
    responseHtml(res, "\u6388\u6743\u6210\u529F", "\u5DF2\u6536\u5230\u6388\u6743\u56DE\u8C03\uFF0C\u6B63\u5728\u8FD4\u56DE Dockyard DSH\u3002");
  }
  async function openCallbackServer(session) {
    if (session.callbackPort === null || session.callbackPort === void 0) return;
    const server = createServer((req, res) => {
      void handleCallback(session, req, res).catch((error) => {
        session.callback = { error: redactError(error) };
        res.statusCode = 500;
        res.end("OAuth callback failed");
      });
    });
    session.server = server;
    const listenOnPort = (port) => new Promise((resolve2, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve2();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen({ host: resolveLoopbackListenHost(callbackHost), port });
    });
    try {
      await listenOnPort(session.callbackPort);
    } catch (error) {
      if (error?.code === "EADDRINUSE" && session.callbackPort !== 0) {
        await listenOnPort(0);
      } else {
        throw error;
      }
    }
    server.unref?.();
    const address = server.address();
    if (address && typeof address === "object" && address.port && session.redirectUri) {
      try {
        const parsed = new URL(session.redirectUri);
        if (isLoopbackHostname2(parsed.hostname) && Number(parsed.port || 80) !== address.port) {
          parsed.port = String(address.port);
          session.redirectUri = parsed.toString();
        }
      } catch {
      }
    }
    session.redirectUri = session.redirectUri ?? `http://${callbackHost}:${address.port}${callbackPath}`;
  }
  async function finalize(session, context = {}) {
    if (session.result) return session.result;
    if (session.cancelled || session.status === "cancelled") return publicSession(session);
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        const callback = session.callback;
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        if (!callback && !session.credentials) return publicSession(session);
        if (callback?.error) throw new Error(callback.error);
        const exchanged = session.credentials ?? await exchangeCode({
          code: callback.code,
          state: callback.state,
          codeVerifier: session.codeVerifier,
          redirectUri: session.redirectUri,
          context
        });
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        const accounts = await importCredentials(exchanged, context);
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          throw new Error("\u5B98\u65B9\u6388\u6743\u5B8C\u6210\uFF0C\u4F46 provider \u6CA1\u6709\u8FD4\u56DE\u53EF\u63A5\u5165\u7684\u8BA2\u9605\u8D26\u53F7");
        }
        session.status = "completed";
        session.result = {
          ...publicSession(session),
          accounts,
          diagnostic: null
        };
        return session.result;
      } catch (error) {
        if (session.cancelled || session.status === "cancelled") return publicSession(session);
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicSession(session);
      } finally {
        await cleanup(session);
      }
    })();
    return session.finalizing;
  }
  async function begin() {
    const pkce = createPkce();
    const session = {
      sessionId: `${providerId}:browser:${randomUUID2()}`,
      providerId,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      browserOpened,
      authorizationCodeRequired,
      callbackPath,
      callbackPort,
      redirectUri,
      state: base64Url(randomBytes(24)),
      codeVerifier: pkce.verifier,
      callback: null,
      server: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null
    };
    sessions.set(session.sessionId, session);
    try {
      await openCallbackServer(session);
      session.nonce = base64Url(randomBytes(24));
      const built = await authorizationUrlBuilder({
        state: session.state,
        codeChallenge: pkce.challenge,
        redirectUri: session.redirectUri,
        nonce: session.nonce
      });
      session.authorizationUrl = typeof built === "string" ? built : built?.url;
      session.metadata = typeof built === "object" ? built.metadata ?? null : null;
      if (!session.authorizationUrl) throw new Error("\u5B98\u65B9 OAuth \u6CA1\u6709\u8FD4\u56DE\u6388\u6743\u9875\u9762\u5730\u5740");
      session.timer = setTimeout(() => {
        if (session.status !== "pending") return;
        session.status = "failed";
        session.diagnostic = "\u5B98\u65B9 OAuth \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002";
        session.cancelled = true;
        void cleanup(session).finally(() => sessions.delete(session.sessionId));
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.status = "failed";
      session.diagnostic = `\u65E0\u6CD5\u542F\u52A8\u5B98\u65B9\u6D4F\u89C8\u5668\u6388\u6743\uFF1A${redactError(error)}`;
      await cleanup(session);
    }
    return publicSession(session);
  }
  async function poll(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missingSession(sessionId, providerId, instructions);
    if (session.status === "failed" || session.status === "completed") {
      const result2 = session.result ?? publicSession(session);
      sessions.delete(sessionId);
      return result2;
    }
    if (!session.callback && typeof pollSession === "function") {
      try {
        const credentials = await pollSession({ metadata: session.metadata, context });
        if (credentials) session.credentials = credentials;
      } catch (error) {
        session.diagnostic = redactError(error);
      }
    }
    if (!session.callback && !session.credentials) return publicSession(session);
    const result = await finalize(session, context);
    if (!["pending", "processing"].includes(result.status)) sessions.delete(sessionId);
    return result;
  }
  async function submitAuthorizationCode(sessionId, input, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missingSession(sessionId, providerId, instructions);
    const parsed = extractCodeInput(input);
    if (String(input ?? "").length > 8192) {
      session.diagnostic = "\u6388\u6743\u56DE\u8C03\u8F93\u5165\u8FC7\u957F\uFF0C\u8BF7\u7C98\u8D34\u5B98\u65B9\u8FD4\u56DE\u7684\u5B8C\u6574\u56DE\u8C03\u5730\u5740\u3002";
      return publicSession(session);
    }
    if (parsed.state !== session.state) {
      session.status = "failed";
      session.diagnostic = "OAuth state \u6821\u9A8C\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u63D0\u4EA4\u5F53\u524D\u4F1A\u8BDD\u8FD4\u56DE\u7684\u56DE\u8C03\u5730\u5740\u3002";
      await cleanup(session);
      return publicSession(session);
    } else if (parsed.error) {
      session.callback = { error: parsed.error, state: parsed.state };
    } else if (!parsed.code) {
      session.diagnostic = "\u8BF7\u7C98\u8D34\u5305\u542B state \u7684\u5B8C\u6574\u56DE\u8C03\u5730\u5740\uFF0C\u6216\u4F7F\u7528 code#state \u683C\u5F0F\u3002";
      return publicSession(session);
    } else {
      session.callback = { code: parsed.code, state: parsed.state };
    }
    return finalize(session, context);
  }
  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    session.cancelled = true;
    session.status = "cancelled";
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }
  return Object.freeze({ begin, poll, submitAuthorizationCode, cancel });
}
var browserOAuthAuthorizerConstants = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
  defaultCallbackPath: DEFAULT_CALLBACK_PATH
});

// packages/oauth/src/cli-oauth-authorizer.mjs
import { randomUUID as randomUUID3 } from "node:crypto";
import { mkdir as mkdir2, mkdtemp, readFile as readFile3, rm as rm2 } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as join5 } from "node:path";

// packages/providers/src/win32-command.mjs
import { spawn as spawn2 } from "node:child_process";
import { statSync } from "node:fs";
import { basename, delimiter, dirname as dirname4, extname, isAbsolute, join as join4, sep } from "node:path";
var DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";
var SHELL_SCRIPT_EXTENSIONS = /* @__PURE__ */ new Set([".cmd", ".bat"]);
var CMD_META_CHARS = /([()\][%!^"`<>&|;, *?])/g;
function pathSeparators(platform) {
  return platform === "win32" ? /* @__PURE__ */ new Set(["/", "\\"]) : /* @__PURE__ */ new Set([sep]);
}
function hasPathSeparator(command, platform) {
  const separators = pathSeparators(platform);
  for (const character of command) {
    if (separators.has(character)) return true;
  }
  return false;
}
function searchPathDirectories(env, platform) {
  const raw = platform === "win32" ? env.PATH ?? env.Path ?? env.path ?? "" : env.PATH ?? "";
  const separator = platform === "win32" ? ";" : delimiter;
  return String(raw).split(separator).filter(Boolean);
}
function extensionCandidates(command, env, platform) {
  if (platform !== "win32") return [command];
  if (extname(command) !== "") return [command];
  const raw = env.PATHEXT ?? DEFAULT_PATHEXT;
  const extensions = String(raw).split(";").map((value) => value.trim()).filter(Boolean);
  const candidates = [];
  for (const extension of extensions) {
    candidates.push(`${command}${extension.toLowerCase()}`);
    candidates.push(`${command}${extension}`);
  }
  candidates.push(command);
  return candidates;
}
function isFile(candidate2) {
  try {
    return statSync(candidate2).isFile();
  } catch {
    return false;
  }
}
function locateWindowsExecutable(command, { env = process.env } = {}) {
  if (isAbsolute(command) || hasPathSeparator(command, "win32") || hasPathSeparator(command, process.platform)) {
    const directory = dirname4(command);
    const name2 = basename(command);
    for (const candidate2 of extensionCandidates(name2, env, "win32")) {
      const resolved = join4(directory, candidate2);
      if (isFile(resolved)) return resolved;
    }
    return null;
  }
  for (const directory of searchPathDirectories(env, "win32")) {
    for (const candidate2 of extensionCandidates(command, env, "win32")) {
      const resolved = join4(directory, candidate2);
      if (isFile(resolved)) return resolved;
    }
  }
  return null;
}
function resolveCliCommand(command, { platform = process.platform, env = process.env } = {}) {
  const name2 = String(command ?? "");
  if (platform !== "win32" || name2.length === 0) {
    return { file: name2, viaShell: false, resolved: name2 };
  }
  const resolved = locateWindowsExecutable(name2, { env }) ?? name2;
  const extension = extname(resolved).toLowerCase();
  return {
    file: resolved,
    viaShell: SHELL_SCRIPT_EXTENSIONS.has(extension),
    resolved
  };
}
function escapeCmdArgument(value) {
  let argument = String(value ?? "");
  argument = argument.replace(/(\\*)"/g, '$1$1\\"');
  argument = argument.replace(/(\\*)$/, "$1$1");
  argument = `"${argument}"`;
  return argument.replace(CMD_META_CHARS, "^$1");
}
function escapeCmdCommand(value) {
  return String(value ?? "").replace(CMD_META_CHARS, "^$1");
}
function buildCmdInvocation(scriptPath, args = [], { env = process.env } = {}) {
  const comspec = env.ComSpec ?? env.COMSPEC ?? env.comspec ?? "cmd.exe";
  const line = [escapeCmdCommand(scriptPath), ...args.map(escapeCmdArgument)].join(" ");
  return {
    file: comspec,
    args: ["/d", "/s", "/c", `"${line}"`],
    windowsVerbatimArguments: true
  };
}
function spawnCli(command, args = [], options = {}) {
  const {
    platform = process.platform,
    spawnImpl = spawn2,
    env = process.env,
    ...spawnOptions
  } = options;
  const target = resolveCliCommand(command, { platform, env });
  if (!target.viaShell) {
    return spawnImpl(target.file, args, { env, ...spawnOptions });
  }
  const invocation = buildCmdInvocation(target.file, args, { env });
  return spawnImpl(invocation.file, invocation.args, {
    env,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    ...spawnOptions
  });
}
var win32CommandConstants = Object.freeze({
  defaultPathExt: DEFAULT_PATHEXT,
  shellScriptExtensions: Object.freeze([...SHELL_SCRIPT_EXTENSIONS])
});

// packages/oauth/src/cli-url-sanitizer.mjs
var URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
var SENSITIVE_URL_QUERY_PARAMS = /* @__PURE__ */ new Set([
  "code",
  "error",
  "error_description",
  "error_uri",
  "error_code",
  "access_token",
  "refresh_token",
  "id_token",
  "token",
  "identy_token",
  "session_token",
  "sessiontoken",
  "secret",
  "jwt",
  "authcode",
  "authorization_code"
]);
function stripAnsiAndControl(value) {
  return String(value ?? "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\u0000-\u001f\u007f].*$/, "");
}
function trimTrailingPunctuation(value) {
  return value.replace(/[),.;]+$/, "");
}
function isLoopbackHostname3(hostname) {
  const value = String(hostname ?? "").trim().toLowerCase();
  const bare = value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;
  return bare === "localhost" || bare === "127.0.0.1" || bare === "::1";
}
function carriesResponseParameters(url) {
  const scopes = [url.search];
  if (url.hash && url.hash.length > 1) scopes.push(url.hash.slice(1));
  for (const scope of scopes) {
    if (!scope) continue;
    for (const [key] of new URLSearchParams(scope)) {
      if (SENSITIVE_URL_QUERY_PARAMS.has(key.toLowerCase())) return true;
    }
  }
  return false;
}
function extractSafeAuthorizationUrl(text3) {
  const match = String(text3 ?? "").match(URL_PATTERN);
  if (!match?.[0]) return null;
  const raw = trimTrailingPunctuation(stripAnsiAndControl(match[0]));
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHostname3(url.hostname))) {
    return null;
  }
  if (carriesResponseParameters(url)) return null;
  if (url.hash) url.hash = "";
  return url.toString();
}

// packages/oauth/src/cli-oauth-authorizer.mjs
var DEFAULT_TIMEOUT_MS2 = 10 * 60 * 1e3;
var CHILD_STOP_GRACE_MS = 2e3;
function publicSession2(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status ?? (session.exitCode === null ? "pending" : "processing"),
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...session.browserOpened ? { browserOpened: true } : {}
  };
}
function stopChild(session) {
  const child = session.child;
  if (!child || session.exitCode !== null) return Promise.resolve();
  return new Promise((resolve2) => {
    let settled = false;
    let timer;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (session.exitCode === null) session.exitCode = -1;
      resolve2();
    };
    child.once("close", finish);
    if (session.exitCode !== null) {
      finish();
      return;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }
    timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
      }
      finish();
    }, CHILD_STOP_GRACE_MS);
    timer.unref?.();
  });
}
function createCliOAuthAuthorizer({
  providerId,
  cliPath,
  loginArgs,
  environmentKey,
  authFileName = "auth.json",
  environment = process.env,
  profilePrefix = `dockyard-${providerId ?? "provider"}-oauth-`,
  instructions = "\u8BF7\u5728\u5B98\u65B9\u6388\u6743\u9875\u9762\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
  timeoutMs = DEFAULT_TIMEOUT_MS2,
  importCredentials,
  profileDirectory = null,
  browserOpened = false
} = {}) {
  if (!providerId) throw new Error("CLI OAuth authorizer requires providerId");
  if (!cliPath) throw new Error(`CLI OAuth authorizer requires a ${providerId} CLI path`);
  if (!Array.isArray(loginArgs) || loginArgs.length === 0) {
    throw new Error(`CLI OAuth authorizer requires login arguments for ${providerId}`);
  }
  if (!environmentKey) throw new Error(`CLI OAuth authorizer requires an environment key for ${providerId}`);
  if (typeof importCredentials !== "function") {
    throw new Error(`CLI OAuth authorizer requires an import callback for ${providerId}`);
  }
  const sessions = /* @__PURE__ */ new Map();
  async function cleanup(session) {
    if (session.cleanupProfile && session.profileDir) {
      await rm2(session.profileDir, { recursive: true, force: true }).catch(() => {
      });
      session.profileDir = null;
    }
  }
  function captureOutput(session, chunk) {
    const text3 = String(chunk ?? "");
    session.output = `${session.output}${text3}`.slice(-32e3);
    if (!session.authorizationUrl) {
      session.authorizationUrl = extractSafeAuthorizationUrl(session.output);
    }
  }
  async function finalize(session, context) {
    if (session.result) return session.result;
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        if (session.timedOut) {
          session.status = "failed";
          session.diagnostic = "\u5B98\u65B9 OAuth \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002";
          return publicSession2(session);
        }
        if (session.launchError) {
          session.status = "failed";
          session.diagnostic = `\u65E0\u6CD5\u542F\u52A8\u5B98\u65B9\u767B\u5F55\u547D\u4EE4\uFF1A${session.launchError}`;
          return publicSession2(session);
        }
        if (session.exitCode !== 0) {
          session.status = "failed";
          session.diagnostic = `\u5B98\u65B9 OAuth \u767B\u5F55\u672A\u5B8C\u6210\uFF08\u9000\u51FA\u7801 ${session.exitCode ?? "unknown"}\uFF09\u3002`;
          return publicSession2(session);
        }
        let raw;
        try {
          raw = JSON.parse(await readFile3(join5(session.profileDir, authFileName), "utf8"));
        } catch (error) {
          session.status = "failed";
          session.diagnostic = `\u5B98\u65B9\u767B\u5F55\u5B8C\u6210\uFF0C\u4F46\u6CA1\u6709\u627E\u5230\u53EF\u8BFB\u53D6\u7684 OAuth \u72B6\u6001\uFF1A${redactError(error)}`;
          return publicSession2(session);
        }
        const accounts = await importCredentials(raw, context);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          session.status = "failed";
          session.diagnostic = "\u5B98\u65B9\u767B\u5F55\u5B8C\u6210\uFF0C\u4F46 provider \u6CA1\u6709\u8FD4\u56DE\u53EF\u63A5\u5165\u7684\u8D26\u53F7\u3002";
          return publicSession2(session);
        }
        session.status = "completed";
        session.result = {
          ...publicSession2(session),
          accounts,
          diagnostic: null
        };
        return session.result;
      } catch (error) {
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicSession2(session);
      } finally {
        await cleanup(session);
      }
    })();
    return session.finalizing;
  }
  async function begin() {
    const cleanupProfile = !profileDirectory;
    const profileDir = profileDirectory ?? await mkdtemp(join5(tmpdir(), profilePrefix));
    if (!cleanupProfile) await mkdir2(profileDir, { recursive: true });
    const session = {
      sessionId: `${providerId}:${randomUUID3()}`,
      providerId,
      profileDir,
      cleanupProfile,
      browserOpened,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exitCode: null,
      launchError: null,
      output: "",
      timedOut: false,
      child: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null
    };
    sessions.set(session.sessionId, session);
    try {
      const child = spawnCli(cliPath, loginArgs, {
        env: { ...environment, [environmentKey]: profileDir },
        stdio: ["ignore", "pipe", "pipe"]
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => captureOutput(session, chunk));
      child.stderr?.on("data", (chunk) => captureOutput(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => {
        session.exitCode = typeof code === "number" ? code : -1;
      });
      session.timer = setTimeout(() => {
        if (session.exitCode !== null) return;
        session.timedOut = true;
        void stopChild(session);
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.launchError = redactError(error);
      session.exitCode = -1;
    }
    return publicSession2(session);
  }
  async function poll(sessionId, context) {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        providerId,
        status: "missing",
        instructions,
        diagnostic: "OAuth \u767B\u5F55\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002"
      };
    }
    if (session.exitCode === null) return publicSession2(session);
    if (session.timer) clearTimeout(session.timer);
    const result = await finalize(session, context);
    if (result.status !== "pending" && result.status !== "processing") sessions.delete(sessionId);
    return result;
  }
  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    await stopChild(session);
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }
  return Object.freeze({ begin, poll, cancel });
}
var cliOAuthAuthorizerConstants = Object.freeze({ defaultTimeoutMs: DEFAULT_TIMEOUT_MS2 });

// packages/providers/src/session-source.mjs
var OFFICIAL_SESSION_AUTH_KIND = "official_session";
var LEGACY_OFFICIAL_SESSION_AUTH_KINDS = Object.freeze(["official_cli_session"]);
var OFFICIAL_SESSION_SOURCE_KINDS = Object.freeze({
  CLI: "cli",
  DESKTOP_APP: "desktop_app",
  BROWSER: "browser",
  OAUTH_FILE: "oauth_file",
  OTHER: "other"
});
function isOfficialSessionAuthKind(value) {
  const kind = typeof value === "string" ? value : value?.kind;
  return kind === OFFICIAL_SESSION_AUTH_KIND || LEGACY_OFFICIAL_SESSION_AUTH_KINDS.includes(kind);
}
function normalizeOfficialSessionResult(value, {
  source = "official_session",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.OTHER
} = {}) {
  if (value === null || value === void 0) return null;
  if (typeof value === "string") return { output: value, source, sourceKind };
  if (typeof value !== "object") return null;
  let payload = typeof value.output === "string" ? value.output : "";
  if (!payload) {
    try {
      payload = JSON.stringify(value.status ?? value);
    } catch {
      payload = "";
    }
  }
  return {
    ...value,
    output: payload,
    source: value.source ?? source,
    sourceKind: value.sourceKind ?? sourceKind
  };
}
function officialSessionResources({
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.OTHER,
  authSource = null,
  extra = {}
} = {}) {
  return {
    accountScope: "active_official_session",
    sessionSource: sourceKind,
    ...authSource ? { authSource } : {},
    ...extra
  };
}

// modules/provider-codex/src/driver.mjs
var PROVIDER_ID = "openai-codex";
var AUTH_BASE_URL = "https://auth.openai.com";
var DEFAULT_AUTHORIZATION_URL = `${AUTH_BASE_URL}/oauth/authorize`;
var DEFAULT_TOKEN_URL = `${AUTH_BASE_URL}/oauth/token`;
var DEFAULT_REDIRECT_URI = "http://localhost:1455/auth/callback";
var DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api";
var DEFAULT_CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models";
var DEFAULT_CODEX_CLIENT_VERSION = "0.163.0";
var DEFAULT_CODEX_CATALOG_TTL_MS = 6e4;
var DEFAULT_USAGE_URLS = Object.freeze([
  "https://chatgpt.com/backend-api/wham/usage",
  "https://chatgpt.com/backend-api/codex/usage"
]);
var DEFAULT_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
var CREDENTIAL_SLOT = Symbol("dockyard-codex-credential");
function hash(value) {
  return createHash3("sha256").update(String(value)).digest("hex");
}
function codexHomePath({ env = process.env, home = homedir3(), codexHome, authFilePath } = {}) {
  if (codexHome) return codexHome;
  if (authFilePath) return dirname5(authFilePath);
  return env.CODEX_HOME || join6(home, ".codex");
}
function codexAuthPath({ env = process.env, home = homedir3(), authFilePath, codexHome } = {}) {
  if (authFilePath) return authFilePath;
  const baseHome = codexHomePath({ env, home, codexHome, authFilePath });
  return join6(baseHome, "auth.json");
}
function profileClaims(payload) {
  return payload?.["https://api.openai.com/profile"] ?? payload?.profile ?? {};
}
function authClaims(payload) {
  return payload?.["https://api.openai.com/auth"] ?? payload?.auth ?? {};
}
function normalizeTokens(raw) {
  const tokens = raw?.tokens ?? raw ?? {};
  const access2 = tokens.access_token ?? tokens.access;
  const refresh = tokens.refresh_token ?? tokens.refresh;
  const idToken = tokens.id_token ?? tokens.idToken ?? null;
  if (typeof access2 !== "string" || typeof refresh !== "string") return null;
  const accessPayload = decodeJwtPayload(access2) ?? {};
  const idPayload = decodeJwtPayload(idToken) ?? {};
  const auth = authClaims(accessPayload);
  const idAuth = authClaims(idPayload);
  const accountId = stringValue(
    tokens.account_id ?? tokens.accountId ?? auth.chatgpt_account_id ?? idAuth.chatgpt_account_id
  );
  if (!accountId) return null;
  const profile = { ...profileClaims(idPayload), ...profileClaims(accessPayload) };
  const expiresAt = isoFromEpoch(accessPayload.exp ?? idPayload.exp);
  return {
    access: access2,
    refresh,
    idToken,
    accountId,
    email: stringValue(tokens.email ?? profile.email),
    displayName: stringValue(tokens.name ?? profile.name),
    plan: stringValue(
      tokens.plan_type ?? auth.chatgpt_plan_type ?? idAuth.chatgpt_plan_type
    ),
    scopes: Array.isArray(tokens.scopes) ? tokens.scopes.map(String) : [],
    expiresAt,
    authFileLastRefresh: stringValue(raw?.last_refresh),
    accessPayload,
    idPayload
  };
}
function accountInput(tokens, credentialRef, now = /* @__PURE__ */ new Date(), { source = "official_codex_oauth" } = {}) {
  return {
    providerId: PROVIDER_ID,
    accountId: tokens.accountId,
    credentialRef,
    displayName: tokens.displayName,
    email: tokens.email,
    auth: {
      kind: "oauth",
      credentialRef,
      scopes: tokens.scopes
    },
    subscription: {
      plan: tokens.plan,
      status: null,
      expiresAt: null
    },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.authFileLastRefresh ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh)
    },
    resources: {
      sessionSource: source.includes("browser") ? OFFICIAL_SESSION_SOURCE_KINDS.BROWSER : OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE,
      authSource: source
    }
  };
}
function attachCredential(candidate2, tokens) {
  Object.defineProperty(candidate2, CREDENTIAL_SLOT, {
    value: tokens,
    enumerable: false,
    configurable: false
  });
  return candidate2;
}
function summarizeCodexCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID,
    candidateId: candidate2.candidateId,
    source: candidate2.source,
    accountId: candidate2.accountId,
    displayName: candidate2.displayName,
    email: candidate2.email,
    subscription: { ...candidate2.subscription },
    refresh: { ...candidate2.refresh },
    imported: Boolean(candidate2.imported),
    status: candidate2.status ?? "available",
    diagnostic: candidate2.diagnostic ?? null
  };
}
function candidateFromTokens(tokens, { source, imported = false, now = /* @__PURE__ */ new Date() } = {}) {
  const credentialRef = createCredentialRef(PROVIDER_ID, tokens.accountId);
  return attachCredential({
    candidateId: `codex:${hash(tokens.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID,
    source,
    accountId: tokens.accountId,
    displayName: tokens.displayName ?? tokens.email ?? tokens.accountId,
    email: tokens.email,
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.authFileLastRefresh ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh)
    },
    credentialRef,
    imported,
    status: "available"
  }, tokens);
}
function isExpiring(tokens, now, leewaySeconds) {
  if (!tokens.expiresAt) return true;
  return new Date(tokens.expiresAt).getTime() <= now.getTime() + leewaySeconds * 1e3;
}
function reasoningFromThinkingLevelMap(thinkingLevelMap) {
  if (!thinkingLevelMap || typeof thinkingLevelMap !== "object") return void 0;
  const efforts = Object.entries(thinkingLevelMap).filter(([id, providerValue]) => id !== "off" && typeof providerValue === "string" && providerValue.length > 0).map(([id, providerValue]) => ({
    id,
    name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()),
    ...providerValue === id ? {} : { description: `provider value: ${providerValue}` }
  }));
  return efforts.length > 0 ? { efforts } : void 0;
}
function parseCodexReasoning(model) {
  if (Array.isArray(model?.supported_reasoning_levels) && model.supported_reasoning_levels.length > 0) {
    const efforts = model.supported_reasoning_levels.map((lvl) => {
      const id = typeof lvl === "string" ? lvl : lvl.effort;
      const name2 = id.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
      const description = typeof lvl?.description === "string" ? lvl.description : void 0;
      return {
        id,
        name: name2,
        ...description ? { description } : {}
      };
    });
    const defaultEffort = typeof model.default_reasoning_level === "string" ? model.default_reasoning_level : void 0;
    return {
      efforts,
      ...defaultEffort && efforts.some((effort) => effort.id === defaultEffort) ? { defaultEffort } : {}
    };
  }
  return reasoningFromThinkingLevelMap(model?.thinkingLevelMap);
}
function codexModelToDshCatalog(model) {
  const id = model.slug ?? model.id;
  const name2 = model.display_name ?? model.name ?? id;
  const reasoning = parseCodexReasoning(model);
  const input = Array.isArray(model.input_modalities) ? model.input_modalities : Array.isArray(model.input) ? model.input : void 0;
  const contextWindow = Number.isInteger(model.context_window) ? model.context_window : Number.isInteger(model.contextWindow) ? model.contextWindow : void 0;
  const maxTokens = Number.isInteger(model.max_output_tokens) ? Math.min(model.max_output_tokens, 16384) : Number.isInteger(model.maxTokens) ? Math.min(model.maxTokens, 16384) : 8192;
  return {
    id,
    name: name2,
    ...input ? { inputModalities: [...input] } : {},
    ...contextWindow ? { contextWindow } : {},
    ...maxTokens ? { maxTokens } : {},
    ...reasoning ? { reasoning } : {}
  };
}
function parseCodexModelCatalog(raw) {
  const modelsList = Array.isArray(raw?.models) ? raw.models : Array.isArray(raw) ? raw : [];
  if (modelsList.length === 0) return [];
  const visible = modelsList.filter((m) => m?.visibility !== "hide");
  const candidates = visible.length > 0 ? visible : modelsList;
  const sorted = [...candidates].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  return sorted.map(codexModelToDshCatalog);
}
function createCodexCatalogLoader({
  env = process.env,
  home = homedir3(),
  codexHome,
  authFilePath,
  modelsCachePath,
  modelsUrl = env.DOCKYARD_CODEX_MODELS_URL || DEFAULT_CODEX_MODELS_URL,
  clientVersion = env.DOCKYARD_CODEX_CLIENT_VERSION || DEFAULT_CODEX_CLIENT_VERSION,
  fetchImpl = fetch,
  cacheTtlMs = Number(process.env.DOCKYARD_CODEX_CATALOG_TTL_MS) || DEFAULT_CODEX_CATALOG_TTL_MS,
  fallbackLoader = null
} = {}) {
  const resolvedHome = codexHomePath({ env, home, codexHome, authFilePath });
  const resolvedAuthPath = codexAuthPath({ env, home, authFilePath, codexHome: resolvedHome });
  const resolvedCachePath = modelsCachePath || join6(resolvedHome, "models_cache.json");
  let cached = null;
  let cachedAt = 0;
  let pending = null;
  return async function loadCatalog({ force = false, credential = null, signal = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;
    if (pending) return pending;
    pending = (async () => {
      let discoveredModels = [];
      let source = "official_codex_models_api";
      let liveToken = credential?.access ?? null;
      let liveAccountId = credential?.accountId ?? null;
      if (!liveToken) {
        try {
          const authRaw = await readJsonFile(resolvedAuthPath);
          if (authRaw) {
            const tokens = normalizeTokens(authRaw);
            if (tokens?.access) {
              liveToken = tokens.access;
              liveAccountId = tokens.accountId;
            }
          }
        } catch {
        }
      }
      if (liveToken) {
        try {
          const url = new URL(modelsUrl);
          url.searchParams.set("client_version", clientVersion);
          const headers = {
            authorization: `Bearer ${liveToken}`,
            "user-agent": `Codex/${clientVersion}`,
            accept: "application/json"
          };
          if (liveAccountId) {
            headers["chatgpt-account-id"] = liveAccountId;
          }
          const res = await fetchImpl(url.href, {
            method: "GET",
            headers,
            ...signal ? { signal } : {}
          });
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            discoveredModels = parseCodexModelCatalog(data);
            if (discoveredModels.length > 0) {
              source = "official_codex_models_api";
            }
          }
        } catch {
        }
      }
      if (discoveredModels.length === 0) {
        try {
          const cacheData = await readJsonFile(resolvedCachePath);
          if (cacheData) {
            discoveredModels = parseCodexModelCatalog(cacheData);
            if (discoveredModels.length > 0) {
              source = "official_codex_models_cache";
            }
          }
        } catch {
        }
      }
      if (discoveredModels.length === 0 && typeof fallbackLoader === "function") {
        try {
          const fallback = await fallbackLoader();
          if (Array.isArray(fallback?.models) && fallback.models.length > 0) {
            discoveredModels = fallback.models;
            source = fallback.source ?? "dsh_pi_ai_provider_catalog";
          }
        } catch {
        }
      }
      const result = {
        models: discoveredModels,
        source
      };
      if (discoveredModels.length > 0) {
        cached = result;
        cachedAt = Date.now();
      }
      return result;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
var CodexOAuthDriver = class {
  constructor({
    authFilePath,
    codexHome,
    modelsCachePath,
    env = process.env,
    home = homedir3(),
    tokenUrl = env.DOCKYARD_CODEX_TOKEN_URL || DEFAULT_TOKEN_URL,
    usageUrls = env.DOCKYARD_CODEX_USAGE_URL ? [env.DOCKYARD_CODEX_USAGE_URL] : [...DEFAULT_USAGE_URLS],
    modelsUrl = env.DOCKYARD_CODEX_MODELS_URL || DEFAULT_CODEX_MODELS_URL,
    clientVersion = env.DOCKYARD_CODEX_CLIENT_VERSION || DEFAULT_CODEX_CLIENT_VERSION,
    clientId = env.DOCKYARD_CODEX_CLIENT_ID || DEFAULT_CLIENT_ID,
    fetchImpl = fetch,
    requestExecutor = null,
    catalogLoader = null,
    refreshLeewaySeconds = 60,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CODEX_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_CODEX_AUTHORIZATION_URL || DEFAULT_AUTHORIZATION_URL,
    redirectUri = env.DOCKYARD_CODEX_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    browserCallbackPort = Number(env.DOCKYARD_CODEX_CALLBACK_PORT || 1455),
    cliPath = env.DOCKYARD_CODEX_CLI || "codex"
  } = {}) {
    this.authFilePath = codexAuthPath({ env, home, authFilePath, codexHome });
    this.tokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_CODEX_TOKEN_URL");
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_CODEX_AUTHORIZATION_URL");
    this.usageUrls = usageUrls.map((url) => assertSecureEndpointUrl(url, "DOCKYARD_CODEX_USAGE_URL"));
    this.clientId = clientId;
    this.fetchImpl = fetchImpl;
    this.requestExecutor = requestExecutor;
    this.catalogLoader = catalogLoader ?? createCodexCatalogLoader({
      env,
      home,
      codexHome,
      authFilePath: this.authFilePath,
      modelsCachePath,
      modelsUrl,
      clientVersion,
      fetchImpl
    });
    this.refreshLeewaySeconds = refreshLeewaySeconds;
    this.cliAuthorizer = createCliOAuthAuthorizer({
      providerId: PROVIDER_ID,
      cliPath,
      loginArgs: ["login", "--device-auth"],
      environmentKey: "CODEX_HOME",
      instructions: "\u5DF2\u542F\u52A8\u5B98\u65B9 Codex CLI OAuth \u767B\u5F55\u3002\u8BF7\u5728\u5B98\u65B9\u7F51\u9875\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      importCredentials: (raw, context) => this.#importOAuthState(raw, context)
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID,
      redirectUri,
      callbackPath: new URL(redirectUri).pathname,
      callbackHost: "localhost",
      callbackPort: browserCallbackPort,
      instructions: "\u8BF7\u5728\u5B98\u65B9 Codex \u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF1B\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u8FD4\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri: callback }) => {
        const url = new URL(authorizationUrl);
        url.search = new URLSearchParams({
          client_id: clientId,
          response_type: "code",
          redirect_uri: callback,
          scope: "openid email profile offline_access",
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          prompt: "login",
          id_token_add_organizations: "true",
          codex_cli_simplified_flow: "true"
        });
        return url.toString();
      },
      exchangeCode: async ({ code, codeVerifier, redirectUri: callback, context }) => {
        const response = await fetchJson(this.tokenUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            redirect_uri: callback,
            code_verifier: codeVerifier
          }),
          ...context.signal ? { signal: context.signal } : {}
        }, { fetchImpl: this.fetchImpl });
        return response.body ?? {};
      },
      importCredentials: (raw, context) => this.#importOAuthState(raw, context, "official_codex_browser_oauth")
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }
  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const raw = await readJsonFile(this.authFilePath);
    if (!raw) {
      return {
        candidates: [],
        source: this.authFilePath,
        diagnostics: [`\u672A\u53D1\u73B0 Codex OAuth \u6587\u4EF6\uFF1A${this.authFilePath}`]
      };
    }
    const tokens = normalizeTokens(raw);
    if (!tokens) {
      return {
        candidates: [],
        source: this.authFilePath,
        diagnostics: ["Codex OAuth \u6587\u4EF6\u5B58\u5728\uFF0C\u4F46\u5B57\u6BB5\u4E0D\u5B8C\u6574\u6216\u65E0\u6CD5\u89E3\u6790\u8D26\u53F7\u8EAB\u4EFD"]
      };
    }
    const candidate2 = candidateFromTokens(tokens, { source: this.authFilePath, now });
    return {
      candidates: [candidate2],
      source: this.authFilePath,
      diagnostics: []
    };
  }
  async importAccount(candidate2, context = {}) {
    const tokens = candidate2?.[CREDENTIAL_SLOT];
    if (!tokens) throw new Error("Codex candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = createCredentialRef(PROVIDER_ID, tokens.accountId);
    await context.secretStore.write(credentialRef, {
      type: "oauth",
      providerId: PROVIDER_ID,
      access: tokens.access,
      refresh: tokens.refresh,
      idToken: tokens.idToken,
      accountId: tokens.accountId,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes
    });
    return accountInput(tokens, credentialRef, context.now instanceof Date ? context.now : /* @__PURE__ */ new Date(), {
      source: candidate2.source
    });
  }
  async importSource(source, context = {}) {
    let raw;
    try {
      raw = typeof source?.content === "string" ? JSON.parse(source.content) : source?.content;
    } catch {
      throw new Error("Codex OAuth source is not valid JSON");
    }
    return this.#importOAuthState(raw, context, source?.fileName || "user_selected_oauth.json");
  }
  async #importOAuthState(raw, context = {}, source = "official_codex_oauth") {
    const tokens = normalizeTokens(raw);
    if (!tokens) throw new Error("Codex OAuth state does not contain a complete account token set");
    const candidate2 = candidateFromTokens(tokens, {
      source,
      now: context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()
    });
    return [await this.importAccount(candidate2, context)];
  }
  async getActiveSession(context = {}) {
    try {
      const discovered = await this.discover(context);
      if (!discovered.candidates?.length) return null;
      const accounts = [];
      for (const candidate2 of discovered.candidates) {
        accounts.push(await this.importAccount(candidate2, context));
      }
      return {
        status: "completed",
        providerId: PROVIDER_ID,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Codex \u5B98\u65B9 OAuth \u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts,
        diagnostic: null
      };
    } catch {
      return null;
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }
  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }
  async submitAuthorizationCode(sessionId, code, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    if (typeof authorizer?.submitAuthorizationCode !== "function") {
      throw new Error("\u5F53\u524D Codex \u6388\u6743\u6D41\u7A0B\u4E0D\u63A5\u6536\u624B\u52A8\u6388\u6743\u7801");
    }
    return authorizer.submitAuthorizationCode(sessionId, code, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }
  async #readCredential(account, context) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const stored = await context.secretStore.read(credentialRef);
    if (!stored?.access || !stored?.refresh) {
      const error = new Error("Codex credential is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    return {
      ...stored,
      accountId: stored.accountId ?? account.accountId,
      expiresAt: stored.expiresAt ?? account.refresh.accessTokenExpiresAt
    };
  }
  async #refreshCredential(credential, context) {
    const response = await fetchJson(this.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credential.refresh,
        client_id: this.clientId
      }),
      ...context.signal ? { signal: context.signal } : {}
    }, { fetchImpl: this.fetchImpl });
    const body = response.body ?? {};
    if (!body.access_token || !Number.isFinite(Number(body.expires_in))) {
      throw new Error("Codex OAuth refresh response is incomplete");
    }
    if (body.refresh_token !== void 0 && body.refresh_token !== null && typeof body.refresh_token !== "string") {
      throw new Error("Codex OAuth refresh response returned an invalid refresh token");
    }
    const payload = decodeJwtPayload(body.access_token) ?? {};
    const auth = authClaims(payload);
    const accountId = stringValue(auth.chatgpt_account_id) ?? credential.accountId;
    return {
      ...credential,
      type: "oauth",
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      idToken: body.id_token ?? credential.idToken ?? null,
      accountId,
      expiresAt: addSecondsIso(body.expires_in, context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()),
      lastRefreshedAt: (context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()).toISOString()
    };
  }
  async #liveCredential(account, context = {}, { force = false } = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    let credential = await this.#readCredential(account, context);
    if (credential.refresh && (force || isExpiring(credential, now, this.refreshLeewaySeconds))) {
      try {
        credential = await this.#refreshCredential(credential, context);
        await context.secretStore.write(account.auth?.credentialRef ?? account.credentialRef, credential);
      } catch (error) {
        const wrapped = new Error(`Codex OAuth refresh failed: ${redactError(error)}`);
        wrapped.authForbidden = error?.status === 403;
        wrapped.authExpired = error?.status === 401 || error?.status === 400 && ["invalid_grant", "invalid_token"].includes(String(error?.upstreamCode ?? "").toLowerCase());
        throw wrapped;
      }
    }
    return credential;
  }
  async refreshAccount(account, context = {}) {
    const credential = await this.#liveCredential(account, context, { force: Boolean(context.force) });
    return {
      refresh: {
        accessTokenExpiresAt: credential.expiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: credential.lastRefreshedAt ?? account.refresh.lastRefreshedAt,
        refreshable: Boolean(credential.refresh)
      }
    };
  }
  async getQuota(account, context = {}) {
    const credential = await this.#liveCredential(account, context);
    let lastError = null;
    let sawAuthExpired = false;
    let sawAuthForbidden = false;
    for (const url of this.usageUrls) {
      try {
        const response = await fetchJson(url, {
          headers: {
            authorization: `Bearer ${credential.access}`,
            "chatgpt-account-id": credential.accountId ?? account.accountId
          },
          ...context.signal ? { signal: context.signal } : {}
        }, { fetchImpl: this.fetchImpl });
        const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
        const windows = recursiveQuotaWindows(response.body, {
          source: "codex_usage",
          now,
          prefix: "rate_limit"
        });
        const primary = selectPrimaryQuotaWindow(windows);
        return {
          quota: {
            ...primary,
            windows,
            updatedAt: now.toISOString(),
            source: "codex_usage"
          },
          subscription: {
            plan: stringValue(response.body?.plan_type),
            status: stringValue(response.body?.subscription_status),
            expiresAt: null
          },
          identity: {
            accountId: stringValue(response.body?.account_id) ?? account.accountId,
            email: stringValue(response.body?.email) ?? account.email
          },
          refresh: {
            accessTokenExpiresAt: credential.expiresAt ?? account.refresh.accessTokenExpiresAt,
            lastRefreshedAt: credential.lastRefreshedAt ?? account.refresh.lastRefreshedAt,
            refreshable: Boolean(credential.refresh)
          }
        };
      } catch (error) {
        lastError = error;
        sawAuthExpired ||= error?.status === 401;
        sawAuthForbidden ||= error?.status === 403;
      }
    }
    const wrapped = new Error(sawAuthExpired ? "Codex OAuth credential rejected (401); reauthorization required" : `Codex quota request failed: ${redactError(lastError)}`);
    wrapped.rateLimited = lastError?.status === 429;
    wrapped.authExpired = sawAuthExpired;
    wrapped.authForbidden = !sawAuthExpired && sawAuthForbidden;
    throw wrapped;
  }
  async getCatalog(context = {}) {
    let credential = null;
    if (context.accounts?.[0] && context.secretStore) {
      try {
        credential = await this.#liveCredential(context.accounts[0], context);
      } catch {
      }
    }
    if (this.catalogLoader) {
      try {
        const catalog = await this.catalogLoader({
          force: Boolean(context.force),
          credential,
          accounts: context.accounts
        });
        if (Array.isArray(catalog?.models) && catalog.models.length > 0) return catalog;
      } catch {
      }
    }
    return {
      models: [],
      source: "no_live_catalog_endpoint",
      diagnostic: "Codex model identifiers are accepted from the active DSH configuration; this module does not invent a model list."
    };
  }
  async invoke(request, invocation, context = {}) {
    const credential = await this.#liveCredential(invocation.account, context);
    const executor = context.requestExecutor ?? this.requestExecutor ?? nativeCodexExecutor;
    return executor({ request, invocation, credential, context });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createCodexPiAiExecutor({
  PiAiAdapter,
  createProvider,
  openAICodexResponsesApi,
  modelResolver = null
}) {
  if (!PiAiAdapter || !createProvider || !openAICodexResponsesApi) {
    throw new Error("Codex DSH transport dependencies are incomplete");
  }
  return async function executeCodex({ request, credential, context = {} }) {
    const modelId = String(request.model);
    const requestedEffort = typeof request.reasoningEffort === "string" ? request.reasoningEffort : void 0;
    const catalogModel2 = typeof modelResolver === "function" ? modelResolver(modelId) : null;
    const contextWindow = Number.isInteger(catalogModel2?.contextWindow) && catalogModel2.contextWindow > 0 ? catalogModel2.contextWindow : 272e3;
    const maxTokens = Number.isInteger(catalogModel2?.maxTokens) && catalogModel2.maxTokens > 0 ? Math.min(catalogModel2.maxTokens, 16384) : 16384;
    const thinkingLevelMap = catalogModel2?.thinkingLevelMap ?? {
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: "xhigh",
      max: "max",
      ultra: "ultra"
    };
    const model = {
      id: modelId,
      name: typeof catalogModel2?.name === "string" && catalogModel2.name.length > 0 ? catalogModel2.name : modelId,
      api: "openai-codex-responses",
      provider: PROVIDER_ID,
      baseUrl: DEFAULT_CODEX_BASE_URL,
      reasoning: typeof catalogModel2?.reasoning === "boolean" ? catalogModel2.reasoning : requestedEffort !== void 0,
      ...thinkingLevelMap ? { thinkingLevelMap: { ...thinkingLevelMap } } : {},
      input: Array.isArray(catalogModel2?.input) && catalogModel2.input.length > 0 ? [...catalogModel2.input] : Array.isArray(catalogModel2?.inputModalities) && catalogModel2.inputModalities.length > 0 ? [...catalogModel2.inputModalities] : ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow,
      maxTokens
    };
    const provider = createProvider({
      id: PROVIDER_ID,
      name: "OpenAI Codex",
      baseUrl: DEFAULT_CODEX_BASE_URL,
      auth: {
        apiKey: {
          name: "Dockyard DSH OAuth",
          resolve: ({ credential: supplied }) => ({
            auth: { apiKey: supplied?.key },
            source: "Dockyard DSH OAuth"
          })
        }
      },
      models: [model],
      api: openAICodexResponsesApi()
    });
    const profile = {
      provider: PROVIDER_ID,
      displayName: "OpenAI Codex",
      piProvider: provider,
      modelErrors: /* @__PURE__ */ new Map(),
      configuredMaxTokens: /* @__PURE__ */ new Map(),
      streamIdleTimeoutMs: 3e5
    };
    const adapter = new PiAiAdapter({
      profiles: () => /* @__PURE__ */ new Map([[PROVIDER_ID, profile]]),
      resolveApiKey: async () => credential.access,
      // DSH's durable attachment store is required for image input. Keep the
      // resolver lazy so text-only requests remain compatible with standalone
      // Codex driver callers and tests that do not mount attachments.
      resolveAttachments: () => context.attachments
    });
    return adapter.stream(request);
  };
}
async function nativeCodexExecutor(envelope2) {
  try {
    const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }] = await Promise.all([
      import("@deepseek-ai/dsh-llm-pi-ai"),
      import("@earendil-works/pi-ai"),
      import("@earendil-works/pi-ai/api/openai-codex-responses.lazy")
    ]);
    return createCodexPiAiExecutor({ PiAiAdapter, createProvider, openAICodexResponsesApi })(envelope2);
  } catch (error) {
    throw new Error(`Codex DSH transport dependencies are unavailable: ${redactError(error)}`);
  }
}
function createCodexDriver(options = {}) {
  return new CodexOAuthDriver(options);
}
var codexDriverConstants = Object.freeze({
  providerId: PROVIDER_ID,
  defaultUsageUrls: DEFAULT_USAGE_URLS,
  defaultBaseUrl: DEFAULT_CODEX_BASE_URL
});

// modules/provider-codex/src/index.mjs
function createCodexModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "openai-codex",
    displayName: "Codex",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream",
      PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP
    ],
    driver
  });
}

// modules/provider-antigravity/src/driver.mjs
import { createHash as createHash4, randomUUID as randomUUID4 } from "node:crypto";
import { existsSync as existsSync3 } from "node:fs";
import { mkdir as mkdir3, mkdtemp as mkdtemp2, readFile as readFile4, rename as rename2, rm as rm3, writeFile as writeFile2 } from "node:fs/promises";
import { homedir as homedir5, tmpdir as tmpdir2 } from "node:os";
import { dirname as dirname7, join as join8 } from "node:path";

// packages/providers/src/cli-agent-transport.mjs
import { execFileSync, spawn as spawn3 } from "node:child_process";
var MAX_CLI_OUTPUT_BYTES = 4 * 1024 * 1024;
var PROCESS_GROUP_PLATFORM = process.platform !== "win32";
var KILL_GRACE_MS = 1e3;
function appendBounded(chunks, chunk, state) {
  const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ""));
  const remaining = MAX_CLI_OUTPUT_BYTES - state.total;
  if (remaining <= 0) return;
  const accepted = value.subarray(0, remaining);
  chunks.push(accepted);
  state.total += accepted.byteLength;
}
function boundedCliDetail(output, errorOutput) {
  return String(errorOutput || output || "").replace(/\s+/g, " ").trim().slice(0, 500);
}
function cliFailure(code, signal, output, errorOutput, providerId) {
  const error = new Error(`${providerId ?? "provider"} CLI failed (${signal ?? code})`);
  error.code = code;
  error.detail = String(errorOutput || output || "").replace(/\s+/g, " ").trim().slice(0, 500);
  return error;
}
function cliTimeoutError(providerId, output, errorOutput) {
  const error = new Error(`${providerId ?? "provider"} CLI request timed out`);
  error.code = "ETIMEDOUT";
  error.providerId = providerId ?? null;
  error.detail = boundedCliDetail(output, errorOutput);
  return error;
}
function cliAbortError(providerId, output, errorOutput) {
  const error = new Error(`${providerId ?? "provider"} CLI request aborted`);
  error.name = "AbortError";
  error.code = "ABORT_ERR";
  error.providerId = providerId ?? null;
  error.detail = boundedCliDetail(output, errorOutput);
  return error;
}
function killProcessTree(child, sig, { detached = PROCESS_GROUP_PLATFORM } = {}) {
  const pid = child?.pid;
  if (process.platform === "win32") {
    if (Number.isFinite(pid)) {
      try {
        execFileSync("taskkill", ["/pid", String(pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true
        });
      } catch {
      }
    }
    try {
      child.kill(sig);
    } catch {
    }
    return;
  }
  if (detached && Number.isFinite(pid)) {
    try {
      process.kill(-pid, sig);
    } catch (error) {
      if (error?.code !== "ESRCH") {
        try {
          child.kill(sig);
        } catch {
        }
      }
    }
  }
  try {
    child.kill(sig);
  } catch {
  }
}
function parseJsonOutput(output) {
  if (output && typeof output === "object") return output;
  try {
    return JSON.parse(String(output));
  } catch {
    for (const line of String(output ?? "").split(/\r?\n/).reverse()) {
      if (!line.trim()) continue;
      try {
        return JSON.parse(line);
      } catch {
      }
    }
    return null;
  }
}
function runCliCommand(command, args, {
  env = process.env,
  cwd,
  timeoutMs = 3e4,
  signal,
  providerId
} = {}) {
  return new Promise((resolve2, reject) => {
    const detached = PROCESS_GROUP_PLATFORM;
    const child = spawnCli(command, args, {
      env,
      ...cwd ? { cwd } : {},
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached,
      ...signal ? { signal } : {}
    });
    const stdout = [];
    const stderr = [];
    const stdoutSize = { total: 0 };
    const stderrSize = { total: 0 };
    let timedOut = false;
    let abortRequested = Boolean(signal?.aborted);
    let settled = false;
    let terminationRequested = false;
    let forceTimer = null;
    let timer = null;
    const finish = (settle, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      signal?.removeEventListener?.("abort", onAbort);
      settle(value);
    };
    const terminate = () => {
      if (terminationRequested) return;
      terminationRequested = true;
      killProcessTree(child, "SIGTERM", { detached });
      forceTimer = setTimeout(() => {
        killProcessTree(child, "SIGKILL", { detached });
      }, KILL_GRACE_MS);
      forceTimer.unref?.();
    };
    const onAbort = () => {
      abortRequested = true;
      terminate();
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on("data", (chunk) => appendBounded(stdout, chunk, stdoutSize));
    child.stderr.on("data", (chunk) => appendBounded(stderr, chunk, stderrSize));
    child.once("error", (error) => {
      if (error?.name === "AbortError" || abortRequested || signal?.aborted) {
        finish(reject, cliAbortError(
          providerId,
          Buffer.concat(stdout).toString("utf8"),
          Buffer.concat(stderr).toString("utf8")
        ));
        return;
      }
      finish(reject, error);
    });
    child.once("close", (code, closeSignal) => {
      const output = Buffer.concat(stdout).toString("utf8");
      const errorOutput = Buffer.concat(stderr).toString("utf8");
      if (timedOut) {
        finish(reject, cliTimeoutError(providerId, output, errorOutput));
        return;
      }
      if (abortRequested || signal?.aborted) {
        finish(reject, cliAbortError(providerId, output, errorOutput));
        return;
      }
      if (code === 0) {
        finish(resolve2, { output, errorOutput });
        return;
      }
      finish(reject, cliFailure(code, closeSignal, output, errorOutput, providerId));
    });
  });
}
var cliAgentTransportConstants = Object.freeze({
  defaultOutputFormat: "stream-json"
});

// modules/provider-antigravity/src/driver.mjs
import { spawn as spawn4 } from "node:child_process";

// modules/provider-antigravity/src/native-transport.mjs
import { closeSync, existsSync as existsSync2, mkdirSync as mkdirSync2, openSync, readFileSync as readFileSync2, readSync, writeFileSync as writeFileSync2 } from "node:fs";
import { homedir as homedir4 } from "node:os";
import { dirname as dirname6, join as join7 } from "node:path";
import { execFileSync as execFileSync2 } from "node:child_process";

// packages/providers/src/native-transport.mjs
function numericStatus(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function isLoopbackHostname4(hostname) {
  const normalized = String(hostname ?? "").toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}
function validateNativeEndpoint(value, { providerId = "provider" } = {}) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${providerId} endpoint is required`);
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`${providerId} endpoint is invalid`);
  }
  if (url.username || url.password) {
    throw new Error(`${providerId} endpoint must not include embedded credentials`);
  }
  if (url.hash) {
    throw new Error(`${providerId} endpoint must not include a URL fragment`);
  }
  const localHttp = url.protocol === "http:" && isLoopbackHostname4(url.hostname);
  if (url.protocol !== "https:" && !localHttp) {
    throw new Error(`${providerId} endpoint must use HTTPS; HTTP is only allowed for loopback development`);
  }
  return url.toString();
}
function diagnosticText(value) {
  if (typeof value === "string") return value;
  if (value === void 0 || value === null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
function errorDetails(value) {
  if (value === void 0 || value === null) return {};
  if (typeof value === "string") {
    const text3 = value.replace(/\s+/g, " ").trim();
    if (!text3) return {};
    try {
      return errorDetails(JSON.parse(value));
    } catch {
      return { message: text3 };
    }
  }
  if (typeof value !== "object") return { message: String(value) };
  const nested = value.error;
  const nestedObject = nested && typeof nested === "object" ? nested : null;
  const message = [
    nestedObject?.message,
    typeof nested === "string" ? nested : null,
    value.message,
    nestedObject?.status,
    value.status
  ].find((candidate2) => typeof candidate2 === "string" && candidate2.trim().length > 0);
  const code = [
    nestedObject?.code,
    value.code,
    nestedObject?.status,
    value.status
  ].find((candidate2) => candidate2 !== void 0 && candidate2 !== null && candidate2 !== "");
  const status = [nestedObject?.status, value.status].find((candidate2) => candidate2 !== void 0 && candidate2 !== null && candidate2 !== "");
  return {
    ...message ? { message: String(message).replace(/\s+/g, " ").trim().slice(0, 500) } : {},
    ...code !== void 0 ? { code } : {},
    ...status !== void 0 ? { status } : {}
  };
}
function boundedErrorBody(value, limit = 4096) {
  if (typeof value === "string") return value.slice(0, limit);
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= limit ? value : `${serialized.slice(0, limit)}\u2026`;
  } catch {
    return String(value ?? "").slice(0, limit);
  }
}
function isAuthenticationFailure(message, body, { status = null, code = null } = {}) {
  const text3 = `${diagnosticText(message)} ${diagnosticText(body)}`.toLowerCase().replace(/[_-]+/g, " ");
  if (/\b(?:token|tokens)\s+(?:count|limit|length|budget)\b|\b(?:max|input|output)_?tokens?\b/.test(text3)) return false;
  const normalizedCode = String(code ?? body?.error?.code ?? body?.code ?? "").toLowerCase();
  if (/invalid[_ -]?grant|invalid[_ -]?token|token[_ -]?expired|unauthorized|authentication[_ -]?failed/.test(normalizedCode)) return true;
  if (Number(status) === 401) return true;
  if (Number(status) === 403 && /(?:access token|oauth|credential|api key|authentication|unauthorized)/.test(text3)) return true;
  return [
    /access token.{0,80}(?:could not be validated|invalid|expired|revok|not valid|unauthor)/,
    /(?:invalid|expired|revok|unauthor|not valid).{0,80}(?:access token|oauth token|refresh token|credential|api key)/,
    /\b(?:unauthorized|authentication failed|login required)\b/,
    /\b(?:credentials?|api keys?)\b.{0,50}\b(?:invalid|expired|missing|unavailable|not valid)\b/
  ].some((pattern) => pattern.test(text3));
}
function nativeProviderError(providerId, message, { status, body, code } = {}) {
  const bodyDetails = errorDetails(body);
  const messageDetails = errorDetails(message);
  const resolvedMessage = messageDetails.message ?? bodyDetails.message ?? (message ? String(message) : null);
  const resolvedCode = code ?? messageDetails.code ?? bodyDetails.code;
  const upstreamStatus = messageDetails.status ?? bodyDetails.status;
  const statusCode = numericStatus(status);
  const codeText = String(upstreamStatus ?? resolvedCode ?? "").toUpperCase();
  const exhaustionText = `${resolvedMessage ?? ""} ${diagnosticText(body)} ${diagnosticText(upstreamStatus)} ${diagnosticText(resolvedCode)}`.toLowerCase();
  const quotaExhausted = codeText === "RESOURCE_EXHAUSTED" || /\bresources?\b[\s\S]{0,80}\bexhausted\b/.test(exhaustionText) || /\bquota\b[\s\S]{0,80}\b(?:exhausted|depleted|exceeded)\b/.test(exhaustionText) || /\busage limit\b[\s\S]{0,80}\breached\b/.test(exhaustionText) || /\bfree[\s\S]{0,40}limit reached\b/.test(exhaustionText) || /\bcapacity\b[\s\S]{0,80}\bexhausted\b/.test(exhaustionText);
  const rateLimited = statusCode === 429 || numericStatus(resolvedCode) === 429 || numericStatus(upstreamStatus) === 429 || codeText === "RESOURCE_EXHAUSTED" || codeText === "RATE_LIMITED" || quotaExhausted;
  const displayMessage = quotaExhausted ? "\u989D\u5EA6\u6216\u4E0A\u6E38\u8D44\u6E90\u5DF2\u8017\u5C3D\uFF0C\u8BF7\u5237\u65B0\u989D\u5EA6\u3001\u5207\u6362\u8D26\u53F7\u6216\u7A0D\u540E\u91CD\u8BD5" : rateLimited ? "\u8BF7\u6C42\u9891\u7387\u53D7\u9650\uFF0C\u8BF7\u5207\u6362\u8D26\u53F7\u6216\u7A0D\u540E\u91CD\u8BD5" : resolvedMessage;
  const error = new Error(`${providerId ?? "provider"} native request failed${displayMessage ? `: ${displayMessage}` : ""}`);
  error.providerId = providerId ?? null;
  if (status !== void 0 && status !== null) error.status = status;
  if (resolvedCode !== void 0 && resolvedCode !== null) {
    error.code = resolvedCode;
    error.upstreamCode = resolvedCode;
  }
  if (resolvedMessage) error.upstreamMessage = resolvedMessage;
  if (upstreamStatus !== void 0 && upstreamStatus !== null) error.upstreamStatus = upstreamStatus;
  error.authExpired = isAuthenticationFailure(resolvedMessage, body, {
    status: statusCode,
    code: resolvedCode ?? upstreamStatus
  });
  error.authForbidden = !error.authExpired && statusCode === 403;
  error.quotaExhausted = quotaExhausted;
  error.rateLimited = rateLimited;
  if (body !== void 0) error.body = boundedErrorBody(body);
  return error;
}
var nativeResponseControls = /* @__PURE__ */ new WeakMap();
var MAX_SSE_EVENT_BYTES = 4 * 1024 * 1024;
var MAX_ERROR_BODY_BYTES = 64 * 1024;
async function readBoundedResponseText(response, limit = MAX_ERROR_BODY_BYTES) {
  const reader = response?.body?.getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let text3 = "";
    let total = 0;
    try {
      while (total < limit) {
        const next = await reader.read();
        if (next.done) break;
        const bytes = next.value instanceof Uint8Array ? next.value : Uint8Array.from(next.value ?? []);
        const accepted = bytes.slice(0, limit - total);
        total += accepted.byteLength;
        text3 += decoder.decode(accepted, { stream: total < limit });
        if (accepted.byteLength < bytes.byteLength) {
          await reader.cancel?.();
          break;
        }
      }
      return `${text3}${decoder.decode()}`;
    } finally {
      reader.releaseLock?.();
    }
  }
  if (response?.body && typeof response.body[Symbol.asyncIterator] === "function") {
    const decoder = new TextDecoder();
    let text3 = "";
    let total = 0;
    for await (const chunk of response.body) {
      const bytes = chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk ?? []);
      const accepted = bytes.slice(0, limit - total);
      total += accepted.byteLength;
      text3 += decoder.decode(accepted, { stream: total < limit });
      if (accepted.byteLength < bytes.byteLength) break;
    }
    return `${text3}${decoder.decode()}`;
  }
  const raw = typeof response?.text === "function" ? await response.text() : "";
  return String(raw ?? "").slice(0, limit);
}
async function fetchNativeResponse(url, init = {}, {
  providerId,
  timeoutMs = 3e5,
  fetchImpl = fetch
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  let cleaned = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const upstreamSignal = init.signal;
  const abort = () => controller.abort(upstreamSignal?.reason);
  const timeoutError = nativeProviderError(providerId, "request timed out");
  timeoutError.code = "ETIMEDOUT";
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timer);
    upstreamSignal?.removeEventListener?.("abort", abort);
  };
  const control = { providerId, cleanup, get timedOut() {
    return timedOut;
  }, timeoutError };
  let handedOff = false;
  if (upstreamSignal) {
    if (upstreamSignal.aborted) abort();
    else upstreamSignal.addEventListener("abort", abort, { once: true });
  }
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (response.ok === false || response.status !== void 0 && response.status >= 400) {
      let body = null;
      try {
        body = await readBoundedResponseText(response);
      } catch {
      }
      const details = errorDetails(body);
      throw nativeProviderError(providerId, details.message, {
        status: response.status,
        body,
        code: details.code
      });
    }
    nativeResponseControls.set(response, control);
    handedOff = true;
    return response;
  } catch (error) {
    if (error?.name === "AbortError" && timedOut && !error.providerId) {
      throw timeoutError;
    }
    if (/\bfetch failed\b/i.test(String(error?.message ?? "")) || error?.cause?.code === "ECONNRESET" || error?.cause?.code === "ETIMEDOUT") {
      const err = nativeProviderError(providerId, `\u7F51\u7EDC\u8FDE\u63A5\u5F02\u5E38 (${error.message})\uFF0C\u53EF\u80FD\u7531\u4E8E\u7F51\u7EDC\u6296\u52A8\u6216\u4EE3\u7406\u65AD\u5F00`, {
        code: "TRANSPORT"
      });
      err.cause = error;
      throw err;
    }
    throw error;
  } finally {
    if (!handedOff) cleanup();
  }
}
function cleanupNativeResponse(response) {
  const control = nativeResponseControls.get(response);
  control?.cleanup();
  nativeResponseControls.delete(response);
}
async function* responseChunks(response) {
  const body = response?.body;
  if (!body) return;
  if (typeof body[Symbol.asyncIterator] === "function") {
    try {
      for await (const chunk of body) yield chunk;
    } finally {
      try {
        await body.cancel?.();
      } catch {
      }
    }
    return;
  }
  const reader = body.getReader?.();
  if (!reader) return;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    try {
      await reader.cancel?.();
    } catch {
    }
    reader.releaseLock?.();
  }
}
function parseSseEvent(lines) {
  let event = "message";
  const data = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  const raw = data.join("\n");
  if (raw.trim() === "[DONE]") return { event, data: null, done: true };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { event, data: raw, raw, parseError: error };
  }
  return { event, data: parsed, raw };
}
function sseProtocolError(providerId, event, raw, cause) {
  const snippet = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const error = new Error(
    `${providerId ?? "provider"} SSE data payload is not valid JSON${event ? ` (event: ${event})` : ""}${snippet ? `: ${snippet}` : ""}${cause?.message ? ` [${cause.message}]` : ""}`
  );
  error.code = "SSE_PROTOCOL_ERROR";
  error.providerId = providerId ?? null;
  if (event) error.sseEvent = event;
  if (cause !== void 0) error.cause = cause;
  return error;
}
async function* readSseEvents(response) {
  const control = nativeResponseControls.get(response);
  const decoder = new TextDecoder();
  let pendingLine = "";
  let lines = [];
  let eventBytes = 0;
  let trailingCarriageReturn = false;
  const oversizeError = () => nativeProviderError(
    control?.providerId,
    "SSE event exceeded the maximum allowed size"
  );
  const scanChunk = (rawText) => {
    let text3 = rawText;
    if (trailingCarriageReturn) {
      trailingCarriageReturn = false;
      if (text3.startsWith("\n")) text3 = text3.slice(1);
    }
    const completeLines = [];
    eventBytes -= pendingLine.length;
    let start = 0;
    for (let index = 0; index < text3.length; index += 1) {
      const character = text3[index];
      if (character !== "\n" && character !== "\r") continue;
      let end = index;
      if (character === "\r") {
        if (text3[index + 1] === "\n") index += 1;
        else trailingCarriageReturn = true;
      }
      completeLines.push(pendingLine + text3.slice(start, end));
      pendingLine = "";
      start = index + 1;
    }
    pendingLine += text3.slice(start);
    eventBytes += pendingLine.length;
    return completeLines;
  };
  const drainLines = (completeLines, { final = false } = {}) => {
    const events = [];
    const ingest = (line) => {
      if (line !== "") {
        eventBytes += line.length + (lines.length > 0 ? 1 : 0);
        lines.push(line);
        if (eventBytes > MAX_SSE_EVENT_BYTES) throw oversizeError();
        return;
      }
      const parsed = parseSseEvent(lines);
      lines = [];
      eventBytes = pendingLine.length;
      if (!parsed) return;
      if (parsed.parseError) {
        throw sseProtocolError(control?.providerId, parsed.event, parsed.raw, parsed.parseError);
      }
      events.push(parsed);
    };
    for (const line of completeLines) ingest(line);
    if (final && pendingLine) {
      const line = pendingLine;
      pendingLine = "";
      eventBytes = 0;
      ingest(line);
    }
    return events;
  };
  try {
    for await (const chunk of responseChunks(response)) {
      const batch = drainLines(scanChunk(decoder.decode(chunk, { stream: true })));
      for (const parsed of batch) {
        yield parsed;
        if (parsed.done) return;
      }
    }
    const finalBatch = drainLines(scanChunk(decoder.decode()), { final: true });
    for (const parsed of finalBatch) {
      yield parsed;
      if (parsed.done) return;
    }
  } catch (error) {
    if (control?.timedOut && !error?.providerId) throw control.timeoutError;
    throw error;
  } finally {
    control?.cleanup();
    nativeResponseControls.delete(response);
  }
}
function normalizeUsage(value) {
  if (!value || typeof value !== "object") return null;
  const rawCacheRead = value.cache_read_input_tokens ?? value.cacheReadInputTokens ?? value.cachedInputTokens ?? value.inputTokenDetails?.cacheReadTokens ?? value.prompt_tokens_details?.cached_tokens ?? value.prompt_tokens_details?.cache_read_tokens ?? value.prompt_cache_hit_tokens ?? value.cached_tokens ?? value.cachedContentTokenCount ?? value.cacheReadTokens;
  const rawCacheWrite = value.cache_creation_input_tokens ?? value.cacheCreationInputTokens ?? value.inputTokenDetails?.cacheCreationInputTokens ?? value.prompt_tokens_details?.cache_write_tokens ?? value.prompt_tokens_details?.cache_creation_tokens ?? value.cacheWriteTokens;
  const cacheReadTokens = Number(rawCacheRead);
  const cacheWriteTokens = Number(rawCacheWrite);
  const rawInput = Number(
    value.inputTokenDetails?.noCacheTokens ?? value.input_tokens ?? value.inputTokens ?? value.prompt_tokens ?? value.promptTokens ?? value.promptTokenCount
  );
  const outputTokens = Number(
    value.output_tokens ?? value.outputTokens ?? value.completion_tokens ?? value.completionTokens ?? value.candidatesTokenCount
  );
  const totalTokens = Number(value.total_tokens ?? value.totalTokens ?? value.totalTokenCount);
  let inputTokens = rawInput;
  if (value.inputTokenDetails?.noCacheTokens !== void 0) {
    inputTokens = Number(value.inputTokenDetails.noCacheTokens);
  } else if (Number.isFinite(inputTokens) && (Number.isFinite(cacheReadTokens) || Number.isFinite(cacheWriteTokens))) {
    const hasOpenAiStyleCache = value.prompt_tokens_details?.cached_tokens !== void 0 || value.prompt_tokens_details?.cache_read_tokens !== void 0 || value.prompt_cache_hit_tokens !== void 0 || value.cached_tokens !== void 0 || value.cachedInputTokens !== void 0;
    const totalEqualsPromptPlusOutput = Number.isFinite(totalTokens) && Number.isFinite(outputTokens) && totalTokens === inputTokens + outputTokens;
    const isAnthropicStyle = (value.cache_read_input_tokens !== void 0 || value.cache_creation_input_tokens !== void 0) && !hasOpenAiStyleCache && !totalEqualsPromptPlusOutput;
    if ((hasOpenAiStyleCache || totalEqualsPromptPlusOutput && !value.cachedContentTokenCount) && !isAnthropicStyle) {
      const read = Number.isFinite(cacheReadTokens) ? cacheReadTokens : 0;
      const write = Number.isFinite(cacheWriteTokens) ? cacheWriteTokens : 0;
      if (inputTokens >= read + write) {
        inputTokens = Math.max(0, inputTokens - read - write);
      }
    }
  }
  const result = {};
  if (Number.isFinite(inputTokens)) result.inputTokens = inputTokens;
  if (Number.isFinite(outputTokens)) result.outputTokens = outputTokens;
  if (Number.isFinite(totalTokens)) result.totalTokens = totalTokens;
  if (Number.isFinite(cacheReadTokens)) result.cacheReadTokens = cacheReadTokens;
  if (Number.isFinite(cacheWriteTokens)) result.cacheWriteTokens = cacheWriteTokens;
  return Object.keys(result).length > 0 ? result : null;
}
function textFromContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => textFromContent(part)).filter(Boolean).join("");
  if (!content || typeof content !== "object") return "";
  if (content.type === "image" || content.type === "reasoning" || content.type === "thinking") return "";
  if (content.type === "tool-result" || content.type === "tool_result") {
    return textFromContent(content.content ?? content.output ?? content.result ?? content.text);
  }
  return content.text ?? content.value ?? content.content ?? content.delta ?? "";
}
function parseToolArguments(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
function base64FromBytes(value) {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return Buffer.from(value).toString("base64");
  return null;
}
function dataUrlParts(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) return null;
  const mediaType = match[1] || "application/octet-stream";
  const encoded = match[0].includes(";base64,") ? match[2] : (() => {
    try {
      return Buffer.from(decodeURIComponent(match[2]), "utf8").toString("base64");
    } catch {
      return Buffer.from(match[2], "utf8").toString("base64");
    }
  })();
  return { mediaType, data: encoded };
}
async function resolveImageData(content, attachments) {
  const direct = content?.data ?? content?.base64 ?? content?.source?.data;
  const directData = base64FromBytes(direct);
  if (directData) {
    return {
      mediaType: content.mediaType ?? content.mimeType ?? content.source?.media_type ?? "application/octet-stream",
      data: directData
    };
  }
  const dataUrl = dataUrlParts(content?.url ?? content?.source?.url);
  if (dataUrl) return dataUrl;
  const reference = content?.attachment ?? content?.ref ?? content?.source;
  if (!reference || !attachments?.readImage) return null;
  const image = await attachments.readImage(reference);
  const data = base64FromBytes(image?.data ?? image?.bytes ?? image?.base64);
  if (!data) return null;
  return {
    mediaType: content.mediaType ?? content.mimeType ?? image?.ref?.mediaType ?? image?.mediaType ?? "application/octet-stream",
    data
  };
}
function finishReason(value, fallback = "stop") {
  const reason = String(value ?? fallback).toLowerCase();
  if (reason.includes("tool") || reason === "function_call" || reason === "tool_use") {
    return { kind: "tool-calls" };
  }
  if (reason.includes("length") || reason.includes("max")) return { kind: "length" };
  if (reason.includes("error") || reason.includes("cancel")) return { kind: "error" };
  return { kind: "stop" };
}
var EMPTY_COMPLETION_NUDGE = "\u4E0A\u4E00\u6B21\u56DE\u590D\u53EA\u5199\u4E86\u601D\u8003\u8FC7\u7A0B\uFF0C\u6CA1\u6709\u7ED9\u51FA\u56DE\u7B54\u4E5F\u6CA1\u6709\u8C03\u7528\u5DE5\u5177\u3002\u8BF7\u76F4\u63A5\u7528\u6B63\u6587\u56DE\u7B54\uFF0C\u6216\u76F4\u63A5\u8C03\u7528\u9700\u8981\u7684\u5DE5\u5177\uFF0C\u4E0D\u8981\u518D\u8F93\u51FA\u601D\u8003\u8FC7\u7A0B\u3002";
function isEmptyCompletionOutput(event) {
  if (event?.type === "text-delta" || event?.type === "tool-call-delta") return true;
  if (event?.type === "block-start") return event.blockType !== "reasoning";
  if (event?.type === "block-end") return event.block?.type !== "reasoning";
  return false;
}
function withEmptyCompletionNudge(envelope2, nudge) {
  const base = envelope2 && typeof envelope2 === "object" && "request" in envelope2 ? envelope2 : { request: envelope2 ?? {} };
  const request = base.request ?? {};
  if (Array.isArray(request.messages)) {
    return { ...base, request: { ...request, messages: [...request.messages, { role: "system", content: nudge }] } };
  }
  const system = typeof request.system === "string" && request.system.length > 0 ? `${request.system}

${nudge}` : nudge;
  return { ...base, request: { ...request, system } };
}
function guardEmptyCompletion(executor, {
  providerId = "provider",
  nudge = EMPTY_COMPLETION_NUDGE,
  maxEmptyAttempts = 2
} = {}) {
  return async function* guardedExecutor(...args) {
    const envelope2 = args[0] ?? {};
    const signal = envelope2?.signal ?? envelope2?.request?.signal;
    const canNudge = Boolean(nudge) && envelope2 && typeof envelope2 === "object" && ("request" in envelope2 || "credential" in envelope2);
    for (let attempt = 0; ; attempt += 1) {
      if (signal?.aborted) {
        const abort = new Error("aborted");
        abort.name = "AbortError";
        throw abort;
      }
      const attemptArgs = attempt === 0 || !canNudge ? args : [withEmptyCompletionNudge(envelope2, nudge), ...args.slice(1)];
      const buffered = [];
      let sawOutput = false;
      const attemptResult = executor(...attemptArgs);
      const attemptStream = attemptResult && typeof attemptResult[Symbol.asyncIterator] === "function" ? attemptResult : await attemptResult;
      if (!attemptStream || typeof attemptStream[Symbol.asyncIterator] !== "function") {
        throw nativeProviderError(providerId, "provider executor did not return a stream");
      }
      for await (const event of attemptStream) {
        if (sawOutput) {
          yield event;
          continue;
        }
        buffered.push(event);
        if (isEmptyCompletionOutput(event)) {
          sawOutput = true;
          for (const pending of buffered) yield pending;
          buffered.length = 0;
        }
      }
      if (sawOutput) return;
      if (attempt >= maxEmptyAttempts) {
        throw nativeProviderError(
          providerId,
          "\u6A21\u578B\u53EA\u8F93\u51FA\u4E86\u601D\u8003\u5185\u5BB9\uFF0C\u6CA1\u6709\u7ED9\u51FA\u56DE\u7B54\u6216\u5DE5\u5177\u8C03\u7528\uFF1B\u5DF2\u81EA\u52A8\u91CD\u8BD5\u4ECD\u65E0\u7ED3\u679C\uFF0C\u8BF7\u91CD\u8BD5\u6216\u6362\u4E00\u4E2A\u6A21\u578B",
          { code: "EMPTY_COMPLETION" }
        );
      }
    }
  };
}
function buildOpenAiTools(tools) {
  if (!Array.isArray(tools)) return void 0;
  const result = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool?.name ?? tool?.function?.name ?? "tool",
      ...tool?.description ? { description: String(tool.description) } : {},
      parameters: tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" }
    }
  }));
  return result.length > 0 ? result : void 0;
}
function parseDsmlCalls(text3) {
  if (typeof text3 !== "string" || !text3.includes("DSML")) return null;
  const callsRe = /[<＜][ |｜]*DSML[ |｜]*calls[>＞]([\s\S]*?)(?:[<＜][\/／][ |｜]*DSML[ |｜]*calls[>＞]|$)/i;
  const match = text3.match(callsRe);
  if (!match) return null;
  const inner = match[1];
  const invokeRe = /[<＜][ |｜]*DSML[ |｜]*invoke\s+name=["']?([^"'>＞\s]+)["']?[>＞]([\s\S]*?)(?:[<＜][\/／][ |｜]*DSML[ |｜]*invoke[>＞]|$)/gi;
  const paramRe = /[<＜][ |｜]*DSML[ |｜]*parameter\s+name=["']?([^"'>＞\s]+)["']?[^>＞]*[>＞]([\s\S]*?)(?:[<＜][\/／][ |｜]*DSML[ |｜]*parameter[>＞]|$)/gi;
  const toolCalls = [];
  let invokeMatch;
  while ((invokeMatch = invokeRe.exec(inner)) !== null) {
    const name2 = invokeMatch[1];
    const paramsBody = invokeMatch[2];
    const args = {};
    let paramMatch;
    while ((paramMatch = paramRe.exec(paramsBody)) !== null) {
      const paramName = paramMatch[1];
      const paramVal = paramMatch[2].trim();
      let parsedVal = paramVal;
      if (paramVal === "true") parsedVal = true;
      else if (paramVal === "false") parsedVal = false;
      else if (!isNaN(Number(paramVal)) && paramVal !== "") parsedVal = Number(paramVal);
      else {
        try {
          parsedVal = JSON.parse(paramVal);
        } catch {
        }
      }
      args[paramName] = parsedVal;
    }
    toolCalls.push({
      name: name2,
      arguments: JSON.stringify(args)
    });
  }
  return toolCalls.length > 0 ? toolCalls : null;
}
function stripDsmlCalls(text3) {
  if (typeof text3 !== "string") return "";
  return text3.replace(/[<＜][ |｜]*DSML[ |｜]*calls[>＞][\s\S]*?(?:[<＜][\/／][ |｜]*DSML[ |｜]*calls[>＞]|$)/gi, "").trim();
}
function sanitizeToolCallId(rawId, maxLength = 64) {
  if (!rawId || typeof rawId !== "string") return "call_tool";
  if (rawId.includes("|")) {
    const separatorIndex = rawId.indexOf("|");
    const callPart = rawId.slice(0, separatorIndex);
    const itemPart = rawId.slice(separatorIndex + 1);
    const cleanCall = callPart.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanItem = itemPart.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (!cleanItem) return cleanCall.slice(0, maxLength) || "call_tool";
    const itemSuffix = cleanItem.slice(-16);
    const callPrefix = cleanCall.slice(0, Math.max(1, maxLength - 1 - itemSuffix.length));
    return `${callPrefix}_${itemSuffix}`;
  }
  const clean = rawId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return clean.slice(0, maxLength) || "call_tool";
}
var DsmlStreamFilter = class {
  constructor({ onTextDelta, onTextBlockStart, onTextBlockEnd } = {}) {
    this.onTextDelta = onTextDelta;
    this.onTextBlockStart = onTextBlockStart;
    this.onTextBlockEnd = onTextBlockEnd;
    this.textIndex = 0;
    this.textOpen = false;
    this.cleanText = "";
    this.pending = "";
    this.inDsml = false;
    this.dsmlBuffer = "";
  }
  push(content, getNextIndex) {
    if (!content) return;
    if (this.inDsml) {
      this.dsmlBuffer += content;
      return;
    }
    const combined = this.pending + content;
    this.pending = "";
    const dsmlMatch = combined.match(/[<＜][ |｜]*DSML/i);
    if (dsmlMatch) {
      const matchIndex = dsmlMatch.index;
      const textPart = combined.slice(0, matchIndex);
      if (textPart) {
        this.#emitText(textPart, getNextIndex);
      }
      if (this.textOpen) {
        this.onTextBlockEnd?.(this.textIndex, this.cleanText);
        this.textOpen = false;
      }
      this.inDsml = true;
      this.dsmlBuffer = combined.slice(matchIndex);
      return;
    }
    const prefixMatch = combined.match(/[<＜][ |｜]*(?:D(?:S(?:M(?:L)?)?)?)?$/i);
    if (prefixMatch) {
      const safeText = combined.slice(0, prefixMatch.index);
      if (safeText) {
        this.#emitText(safeText, getNextIndex);
      }
      this.pending = prefixMatch[0];
    } else {
      this.#emitText(combined, getNextIndex);
    }
  }
  #emitText(text3, getNextIndex) {
    if (!text3) return;
    if (!this.textOpen) {
      this.textIndex = getNextIndex();
      this.textOpen = true;
      this.onTextBlockStart?.(this.textIndex);
    }
    this.cleanText += text3;
    this.onTextDelta?.(this.textIndex, text3);
  }
  closeText() {
    if (this.pending) {
      if (!this.inDsml) {
        this.#emitText(this.pending, () => this.textIndex || 1);
      }
      this.pending = "";
    }
    if (this.textOpen) {
      this.onTextBlockEnd?.(this.textIndex, this.cleanText);
      this.textOpen = false;
    }
  }
  flush(getNextIndex) {
    this.closeText();
    if (this.inDsml && this.dsmlBuffer) {
      const calls = parseDsmlCalls(this.dsmlBuffer);
      if (calls && calls.length > 0) {
        return { toolCalls: calls };
      }
      const fallbackIndex = getNextIndex();
      this.onTextBlockStart?.(fallbackIndex);
      this.onTextDelta?.(fallbackIndex, this.dsmlBuffer);
      this.onTextBlockEnd?.(fallbackIndex, this.dsmlBuffer);
    }
    return null;
  }
};

// modules/provider-antigravity/src/native-transport.mjs
var PROVIDER_ID2 = "antigravity";
var DEFAULT_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse";
var DEFAULT_QUOTA_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary";
var DEFAULT_PROJECT_ENDPOINT = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
var DEFAULT_ONBOARD_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com/v1internal:onboardUser";
var MACOS_SECURITY_BIN = "/usr/bin/security";
var AGY_KEYCHAIN_SERVICE = "gemini";
var AGY_KEYCHAIN_ACCOUNT = "antigravity";
var AGY_KEYCHAIN_VALUE_PREFIX = "go-keyring-base64:";
var ANTIGRAVITY_INFO_PATHS = [
  "/Applications/Antigravity.app/Contents/Info.plist",
  join7(homedir4(), "Applications/Antigravity.app/Contents/Info.plist")
];
function normalizeAntigravityClientVersion(value) {
  const version = String(value ?? "").trim();
  return /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : null;
}
function detectAntigravityUserAgent() {
  for (const infoPath of ANTIGRAVITY_INFO_PATHS) {
    try {
      const version = normalizeAntigravityClientVersion(execFileSync2(
        "/usr/libexec/PlistBuddy",
        ["-c", "Print :CFBundleShortVersionString", infoPath],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
      ));
      if (version) return `antigravity/hub/${version} ${process.platform}/${process.arch}`;
    } catch {
    }
  }
  return `antigravity/hub/2.29.0 ${process.platform}/${process.arch}`;
}
var GOOGLE_CLIENT_SECRET_PATTERN = /GOCSPX-[A-Za-z0-9_-]{28}/g;
var SCAN_CHUNK_BYTES = 8 * 1024 * 1024;
var SCAN_OVERLAP_BYTES = 512;
function antigravityClientScanPaths({ env = process.env, home = homedir4(), platform = process.platform } = {}) {
  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA || join7(home, "AppData", "Local");
    const appData = env.APPDATA || join7(home, "AppData", "Roaming");
    return [
      join7(localAppData, "Programs", "Antigravity", "resources", "bin", "language_server.exe"),
      join7(localAppData, "Programs", "Antigravity", "resources", "bin", "language_server"),
      join7(appData, "npm", "agy.cmd"),
      join7(home, ".local", "bin", "agy.exe"),
      join7(home, ".local", "bin", "agy.cmd")
    ];
  }
  return [
    "/Applications/Antigravity.app/Contents/Resources/bin/language_server",
    join7(home, "Applications/Antigravity.app/Contents/Resources/bin/language_server"),
    join7(home, ".local", "bin", "agy")
  ];
}
var ANTIGRAVITY_CLIENT_SCAN_PATHS = antigravityClientScanPaths();
var scannedSecrets = /* @__PURE__ */ new Map();
function scanAntigravityClientSecrets({ paths = null, env = process.env, home = homedir4(), platform = process.platform } = {}) {
  const resolved = Array.isArray(paths) ? paths : antigravityClientScanPaths({ env, home, platform });
  const cacheKey = resolved.join("|");
  const memoized = scannedSecrets.get(cacheKey);
  if (memoized) return memoized;
  const secrets = [];
  for (const file of resolved) {
    if (!existsSync2(file)) continue;
    let descriptor;
    try {
      descriptor = openSync(file, "r");
      const buffer = Buffer.allocUnsafe(SCAN_CHUNK_BYTES);
      let carry = "";
      while (true) {
        const bytes = readSync(descriptor, buffer, 0, SCAN_CHUNK_BYTES, null);
        if (bytes <= 0) break;
        const text3 = carry + buffer.subarray(0, bytes).toString("latin1");
        for (const match of text3.match(GOOGLE_CLIENT_SECRET_PATTERN) ?? []) {
          if (!secrets.includes(match)) secrets.push(match);
        }
        carry = text3.slice(-SCAN_OVERLAP_BYTES);
      }
    } catch {
    } finally {
      if (descriptor !== void 0) {
        try {
          closeSync(descriptor);
        } catch {
        }
      }
    }
    if (secrets.length > 0) break;
  }
  scannedSecrets.set(cacheKey, secrets);
  return secrets;
}
function antigravityClientCachePath({ env = process.env, home = homedir4() } = {}) {
  const root = env.DOCKYARD_DSH_HOME || join7(home, ".dockyard-dsh");
  return join7(root, "antigravity-oauth-client.json");
}
function readClientSecretCache(clientId, file) {
  try {
    const parsed = JSON.parse(readFileSync2(file, "utf8"));
    const secret = parsed?.clients?.[clientId];
    return typeof secret === "string" && secret.startsWith("GOCSPX-") ? secret : null;
  } catch {
    return null;
  }
}
function writeClientSecretCache(clientId, file, secret) {
  try {
    mkdirSync2(dirname6(file), { recursive: true });
    let parsed = {};
    try {
      parsed = JSON.parse(readFileSync2(file, "utf8")) ?? {};
    } catch {
      parsed = {};
    }
    parsed.clients = { ...parsed.clients ?? {}, [clientId]: secret };
    writeFileSync2(file, `${JSON.stringify(parsed, null, 2)}
`, { mode: 384 });
  } catch {
  }
}
async function resolveAntigravityClientSecret({
  clientId,
  env = process.env,
  home = homedir4(),
  fetchImpl = fetch,
  paths,
  tokenUrl = "https://oauth2.googleapis.com/token"
} = {}) {
  if (!clientId) return null;
  const cacheFile = antigravityClientCachePath({ env, home });
  const cached = readClientSecretCache(clientId, cacheFile);
  if (cached) return cached;
  const candidates = scanAntigravityClientSecrets(paths ? { paths } : {});
  for (const secret of candidates) {
    let response;
    try {
      response = await fetchImpl(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: secret,
          code: "dockyard-client-probe",
          grant_type: "authorization_code",
          redirect_uri: "http://localhost"
        }).toString(),
        signal: AbortSignal.timeout(15e3)
      });
    } catch {
      continue;
    }
    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }
    if (body?.error === "invalid_grant") {
      writeClientSecretCache(clientId, cacheFile, secret);
      return secret;
    }
  }
  return null;
}
function firstString(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
var THOUGHT_SIGNATURE_CACHE_LIMIT = 4096;
var thoughtSignaturesByToolId = /* @__PURE__ */ new Map();
function rememberThoughtSignature(id, signature) {
  if (typeof id !== "string" || id.length === 0) return;
  if (typeof signature !== "string" || signature.length === 0) return;
  if (thoughtSignaturesByToolId.has(id)) thoughtSignaturesByToolId.delete(id);
  thoughtSignaturesByToolId.set(id, signature);
  if (thoughtSignaturesByToolId.size > THOUGHT_SIGNATURE_CACHE_LIMIT) {
    const oldest = thoughtSignaturesByToolId.keys().next().value;
    thoughtSignaturesByToolId.delete(oldest);
  }
}
function thoughtSignatureFrom(value) {
  if (!value || typeof value !== "object") return null;
  return firstString(
    value.thoughtSignature,
    value.thought_signature,
    value.providerMetadata?.thoughtSignature,
    value.providerMetadata?.thought_signature,
    value.providerMetadata?.google?.thoughtSignature,
    value.providerMetadata?.google?.thought_signature,
    value.providerMetadata?.antigravity?.thoughtSignature,
    value.providerMetadata?.antigravity?.thought_signature,
    value.function?.thoughtSignature,
    value.function?.thought_signature,
    value.functionCall?.thoughtSignature,
    value.functionCall?.thought_signature,
    value.function_call?.thoughtSignature,
    value.function_call?.thought_signature
  );
}
function thoughtSignatureForToolPart(part) {
  return thoughtSignatureFrom(part) ?? thoughtSignaturesByToolId.get(part?.id) ?? thoughtSignaturesByToolId.get(part?.toolCallId) ?? null;
}
function partTypeKey(part) {
  return String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
}
function isToolCallPart(part) {
  if (!part || typeof part !== "object") return false;
  if (part.functionCall || part.function_call) return true;
  const type = partTypeKey(part);
  return type === "toolcall" || type === "functioncall";
}
function isToolResultPart(part) {
  if (!part || typeof part !== "object") return false;
  if (part.functionResponse || part.function_response) return true;
  const type = partTypeKey(part);
  return type === "toolresult" || type === "functionresponse";
}
function toolCallIdOf(part) {
  return firstString(part?.id, part?.toolCallId, part?.tool_call_id, part?.functionCall?.id);
}
function toolCallNameOf(part) {
  return firstString(
    part?.name,
    part?.toolName,
    part?.function?.name,
    part?.functionCall?.name,
    part?.function_call?.name,
    part?.functionResponse?.name,
    part?.function_response?.name
  ) ?? "tool";
}
function toolCallArgsOf(part) {
  return parseToolArguments(
    part?.arguments ?? part?.input ?? part?.function?.arguments ?? part?.functionCall?.args ?? part?.functionCall?.arguments ?? part?.function_call?.args ?? part?.function_call?.arguments
  );
}
function toolCallText(name2, args) {
  const serialized = typeof args === "string" ? args : JSON.stringify(args ?? {});
  return `[tool call: ${name2}] ${serialized}`;
}
function toolResultText(part) {
  const name2 = toolCallNameOf(part);
  if (part?.functionResponse || part?.function_response) {
    const response = part.functionResponse?.response ?? part.function_response?.response;
    const content = response?.content ?? response ?? part?.content ?? part?.output ?? part?.result ?? part?.text;
    return `[tool result: ${name2}] ${textFromContent(content)}`;
  }
  return `[tool result: ${name2}] ${textFromContent(part?.content ?? part?.output ?? part?.result ?? part?.text)}`;
}
function messageContentValues(message) {
  const parts = [];
  if (Array.isArray(message?.content)) {
    parts.push(...message.content);
  } else if (Array.isArray(message?.parts)) {
    parts.push(...message.parts);
  } else if (message?.content != null && message.content !== "") {
    parts.push(message.content);
  } else if (message?.text != null && message.text !== "") {
    parts.push(message.text);
  }
  if (Array.isArray(message?.tool_calls)) {
    parts.push(...message.tool_calls.map((call) => ({
      type: "tool-call",
      id: call?.id,
      name: call?.function?.name ?? call?.name,
      arguments: call?.function?.arguments ?? call?.arguments,
      thoughtSignature: call?.thoughtSignature ?? call?.thought_signature,
      thought_signature: call?.thought_signature ?? call?.thoughtSignature
    })));
  }
  return parts.length > 0 ? parts : message != null ? [message] : [];
}
function collectSignedToolCallIds(messages) {
  const signed = /* @__PURE__ */ new Set();
  for (const message of Array.isArray(messages) ? messages : []) {
    for (const part of messageContentValues(message)) {
      if (!isToolCallPart(part)) continue;
      const signature = thoughtSignatureForToolPart(part);
      if (!signature) continue;
      const id = toolCallIdOf(part);
      if (id) {
        rememberThoughtSignature(id, signature);
        signed.add(id);
      }
    }
  }
  return signed;
}
function emailFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const direct = firstString(value.email, value.userEmail, value.email_address, value.account?.email);
  if (direct) return direct;
  const idToken = firstString(value.id_token, value.idToken);
  if (idToken) {
    try {
      const payload = decodeJwtPayload(idToken);
      const fromClaims = firstString(payload?.email);
      if (fromClaims) return fromClaims;
    } catch {
    }
  }
  for (const child of Object.values(value)) {
    const email = emailFromObject(child, depth + 1);
    if (email) return email;
  }
  return null;
}
function tokenFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const direct = firstString(value.access_token, value.accessToken);
  if (direct) return direct;
  for (const child of Object.values(value)) {
    const token = tokenFromObject(child, depth + 1);
    if (token) return token;
  }
  return null;
}
function oauthRecordFromObject(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  const token = firstString(value.access_token, value.accessToken);
  if (token) {
    const expiresAt = isoFromEpoch(
      value.expires_at ?? value.expiresAt ?? value.expiry_date ?? value.expiryDate ?? value.expiry
    ) ?? addSecondsIso(value.expires_in ?? value.expiresIn);
    return {
      token,
      refreshToken: firstString(value.refresh_token, value.refreshToken),
      ...expiresAt ? { expiresAt } : {}
    };
  }
  for (const child of Object.values(value)) {
    const record = oauthRecordFromObject(child, depth + 1);
    if (record) return record;
  }
  return null;
}
function readOfficialTokenFile(path2) {
  try {
    const parsed = JSON.parse(readFileSync2(path2, "utf8"));
    const record = oauthRecordFromObject(parsed);
    return record ? {
      ...record,
      kind: "oauth",
      email: emailFromObject(parsed)
    } : null;
  } catch {
    return null;
  }
}
function readAntigravityTokenFile({ env = process.env, home = homedir4() } = {}) {
  return readOfficialTokenFile(
    env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE || join7(home, ".gemini", "antigravity-cli", "antigravity-oauth-token")
  );
}
function parseAntigravityKeychainValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const encoded = raw.startsWith(AGY_KEYCHAIN_VALUE_PREFIX) ? raw.slice(AGY_KEYCHAIN_VALUE_PREFIX.length) : null;
  const decoded = encoded ? Buffer.from(encoded, "base64").toString("utf8") : raw;
  try {
    const parsed = JSON.parse(decoded);
    const record = oauthRecordFromObject(parsed);
    return record ? {
      ...record,
      kind: "oauth",
      source: "antigravity_keychain",
      email: emailFromObject(parsed)
    } : null;
  } catch {
    return null;
  }
}
var cachedKeychainToken = null;
var lastKeychainReadTime = 0;
var KEYCHAIN_CACHE_TTL_MS = 6e4;
function readAntigravityKeychainToken({ home = homedir4() } = {}) {
  if (process.platform !== "darwin") return null;
  const now = Date.now();
  if (cachedKeychainToken && now - lastKeychainReadTime < KEYCHAIN_CACHE_TTL_MS) {
    return cachedKeychainToken;
  }
  try {
    const keychainPath = join7(home, "Library", "Keychains", "login.keychain-db");
    const value = execFileSync2(MACOS_SECURITY_BIN, [
      "find-generic-password",
      "-s",
      AGY_KEYCHAIN_SERVICE,
      "-a",
      AGY_KEYCHAIN_ACCOUNT,
      "-w",
      keychainPath
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2e3,
      maxBuffer: 1048576
    });
    const parsed = parseAntigravityKeychainValue(value);
    if (parsed) {
      cachedKeychainToken = parsed;
      lastKeychainReadTime = now;
    }
    return parsed;
  } catch {
    lastKeychainReadTime = now;
    return null;
  }
}
function resolveAntigravityAccessToken({ credential, env = process.env, home = homedir4() } = {}) {
  const stored = firstString(credential?.access, credential?.token);
  if (stored) {
    return { token: stored, kind: "oauth", email: emailFromObject(credential) };
  }
  const fromCredentialObject = tokenFromObject(credential);
  if (fromCredentialObject) {
    return { token: fromCredentialObject, kind: "oauth", email: emailFromObject(credential) };
  }
  const fromEnv = firstString(env.DOCKYARD_ANTIGRAVITY_ACCESS_TOKEN, env.GEMINI_ACCESS_TOKEN);
  if (fromEnv) return { token: fromEnv, kind: "oauth" };
  if (!env.DOCKYARD_ANTIGRAVITY_TOKEN_FILE) {
    const fromKeychain = readAntigravityKeychainToken({ home });
    if (fromKeychain?.token) return fromKeychain;
  }
  return readAntigravityTokenFile({ env, home });
}
function projectIdFromLoadCodeAssist(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return null;
  for (const key of ["cloudaicompanionProject", "cloudaicompanion_project", "projectId", "project_id", "project"]) {
    const candidate2 = value[key];
    if (typeof candidate2 === "string" && candidate2.trim()) return candidate2.trim();
    if (candidate2 && typeof candidate2 === "object") {
      const nested = firstString(candidate2.id, candidate2.projectId, candidate2.project_id, candidate2.name);
      if (nested) return nested.trim();
    }
  }
  for (const child of Object.values(value)) {
    const nested = projectIdFromLoadCodeAssist(child, depth + 1);
    if (nested) return nested;
  }
  return null;
}
async function onboardCodeAssistProject({
  metadata,
  tierId,
  base,
  headers,
  signal,
  timeoutMs,
  fetchImpl
}) {
  const deadline = Date.now() + Math.min(timeoutMs, 2e4);
  const pollDelayMs = 2e3;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (Date.now() > deadline) break;
    const operation = await callCodeAssist(base, "onboardUser", {
      tier_id: tierId,
      metadata
    }, { headers, signal, timeoutMs, fetchImpl });
    const project = projectIdFromLoadCodeAssist(operation);
    if (project) return project;
    if (operation?.done === true) return null;
    await new Promise((resolve2) => setTimeout(resolve2, pollDelayMs));
  }
  return null;
}
async function callCodeAssist(base, method, body, { headers, signal, timeoutMs, fetchImpl }) {
  const response = await fetchNativeResponse(`${base}/v1internal:${method}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal
  }, { providerId: PROVIDER_ID2, timeoutMs, fetchImpl });
  try {
    return typeof response.json === "function" ? await response.json() : JSON.parse(await response.text());
  } finally {
    cleanupNativeResponse(response);
  }
}
function describeMissingProject(raw) {
  const tiers = Array.isArray(raw?.allowedTiers) ? raw.allowedTiers.filter(Boolean) : [];
  const ineligible = Array.isArray(raw?.ineligibleTiers) ? raw.ineligibleTiers.filter(Boolean) : [];
  const needsOwnProject = tiers.some((tier) => tier?.userDefinedCloudaicompanionProject === true);
  const reason = ineligible.find((tier) => typeof tier?.reasonMessage === "string" && tier.reasonMessage.trim());
  if (needsOwnProject && reason) {
    return `Antigravity \u672A\u8FD4\u56DE Code Assist \u9879\u76EE\uFF1A${reason.reasonMessage.trim()}`;
  }
  if (needsOwnProject) {
    return "Antigravity \u672A\u8FD4\u56DE Code Assist \u9879\u76EE\uFF1A\u8BE5\u8D26\u53F7\u7684\u6863\u4F4D\u8981\u6C42\u81EA\u5E26 Google Cloud \u9879\u76EE\u3002";
  }
  if (reason) return `Antigravity \u672A\u8FD4\u56DE Code Assist \u9879\u76EE\uFF1A${reason.reasonMessage.trim()}`;
  return "Antigravity did not return a Code Assist project for the selected account";
}
async function fetchAntigravityAvailableModels({
  token,
  project,
  endpoint: endpoint2 = process.env.DOCKYARD_ANTIGRAVITY_MODELS_ENDPOINT || "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
  fetchImpl = fetch,
  timeoutMs = 2e4,
  signal,
  userAgent = process.env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent()
} = {}) {
  if (!token) return null;
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID2 });
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    accept: "application/json"
  };
  if (userAgent) headers["user-agent"] = userAgent;
  const response = await fetchNativeResponse(safeEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(project ? { project } : {}),
    signal
  }, { providerId: PROVIDER_ID2, timeoutMs, fetchImpl });
  let raw;
  try {
    raw = typeof response.json === "function" ? await response.json() : JSON.parse(await response.text());
  } finally {
    cleanupNativeResponse(response);
  }
  return modelsFromFetchAvailableModels(raw);
}
function antigravityModelTier(model) {
  const id = typeof model?.id === "string" ? model.id : "";
  const match = /^(.*)-(minimal|low|medium|high|xhigh|max)$/u.exec(id);
  if (!match || !match[1]) return null;
  return { familyId: match[1], tierId: match[2] };
}
function tierLabel(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}
function stripTierLabel(name2) {
  if (typeof name2 !== "string") return null;
  const stripped = name2.replace(/\s*\((minimal|low|medium|high|xhigh|max)\)\s*$/iu, "").trim();
  return stripped && stripped !== name2 ? stripped : null;
}
function collapseAntigravityTierFamilies(models, { defaultModelId = null } = {}) {
  const rows = (Array.isArray(models) ? models : []).filter(
    (model) => model && typeof model.id === "string" && model.id.length > 0
  );
  const families = /* @__PURE__ */ new Map();
  for (const model of rows) {
    const tier = antigravityModelTier(model);
    if (!tier) continue;
    const members = families.get(tier.familyId) ?? [];
    members.push({ model, tierId: tier.tierId });
    families.set(tier.familyId, members);
  }
  const collapsed = /* @__PURE__ */ new Map();
  for (const [familyId, members] of families) {
    const tiers = [...new Set(members.map((member) => member.tierId))];
    if (tiers.length < 2) continue;
    const preferred = members.find((member) => member.model.id === defaultModelId) ?? members.find((member) => member.tierId === "medium") ?? members[0];
    const name2 = stripTierLabel(preferred.model.name) ?? stripTierLabel(members[0].model.name) ?? familyId;
    const familyRow = {
      ...preferred.model,
      id: preferred.model.id,
      name: name2,
      reasoning: {
        efforts: tiers.map((tierId) => ({ id: tierId, name: tierLabel(tierId) })),
        defaultEffort: preferred.tierId
      }
    };
    if (!members.every((member) => member.model.unavailable === true)) delete familyRow.unavailable;
    collapsed.set(familyId, familyRow);
  }
  if (collapsed.size === 0) return rows;
  const result = [];
  const emitted = /* @__PURE__ */ new Set();
  for (const model of rows) {
    const tier = antigravityModelTier(model);
    if (!tier || !collapsed.has(tier.familyId)) {
      result.push(model);
      continue;
    }
    if (emitted.has(tier.familyId)) continue;
    emitted.add(tier.familyId);
    result.push(collapsed.get(tier.familyId));
  }
  return result;
}
function modelsFromFetchAvailableModels(raw) {
  const table = raw?.models;
  if (!table || typeof table !== "object") return null;
  const order = [];
  for (const sort of Array.isArray(raw?.agentModelSorts) ? raw.agentModelSorts : []) {
    for (const group of Array.isArray(sort?.groups) ? sort.groups : []) {
      for (const id of Array.isArray(group?.modelIds) ? group.modelIds : []) {
        if (typeof id === "string" && id.length > 0 && !order.includes(id)) order.push(id);
      }
    }
  }
  const agentRows = Object.entries(table).filter(([id, info]) => typeof id === "string" && id.length > 0 && info && info.isInternal !== true);
  const enabledRows = agentRows.filter(([, info]) => info.disabled !== true);
  const picked = order.length > 0 ? agentRows.filter(([id]) => order.includes(id)) : enabledRows;
  const entries = picked.length > 0 ? picked : enabledRows;
  if (entries.length === 0) return null;
  const models = entries.map(([id, info]) => ({
    id,
    name: typeof info.displayName === "string" && info.displayName.trim() ? info.displayName.trim() : id,
    ...info.disabled === true ? { unavailable: true } : {},
    ...Number.isFinite(info.maxTokens) && info.maxTokens > 0 ? { contextWindow: info.maxTokens } : {},
    ...Number.isFinite(info.maxOutputTokens) && info.maxOutputTokens > 0 ? { maxTokens: info.maxOutputTokens } : {},
    ...info.supportsImages === true ? { inputModalities: ["text", "image"] } : {}
  }));
  const rank = (id) => {
    const index = order.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  models.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
  return collapseAntigravityTierFamilies(models, {
    defaultModelId: typeof raw?.defaultAgentModelId === "string" ? raw.defaultAgentModelId : null
  });
}
function createAntigravityProjectResolver({
  endpoint: endpoint2 = process.env.DOCKYARD_ANTIGRAVITY_PROJECT_ENDPOINT || DEFAULT_PROJECT_ENDPOINT,
  onboardEndpoint = process.env.DOCKYARD_ANTIGRAVITY_ONBOARD_ENDPOINT || DEFAULT_ONBOARD_ENDPOINT,
  env = process.env,
  home = homedir4(),
  timeoutMs = 2e4,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  project = void 0,
  userAgent = process.env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent()
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID2 });
  const safeOnboard = validateNativeEndpoint(onboardEndpoint, { providerId: PROVIDER_ID2 });
  const configuredProject = typeof project === "string" && project.trim() ? project.trim() : null;
  const cache = /* @__PURE__ */ new Map();
  return async ({ credential = null, account = null, context = {} } = {}) => {
    if (configuredProject) return configuredProject;
    const cacheKey = account?.accountId ?? context.accountId ?? "default";
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const auth = await tokenResolver({
      credential,
      env: { ...env, ...context.env ?? {} },
      home
    });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID2, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
      accept: "application/json"
    };
    if (userAgent) headers["user-agent"] = userAgent;
    const load = await callCodeAssist(safeEndpoint.replace(/\/v1internal:.*$/u, ""), "loadCodeAssist", {
      metadata: { ideType: "ANTIGRAVITY" }
    }, { headers, signal: context.signal, timeoutMs, fetchImpl });
    let resolved = projectIdFromLoadCodeAssist(load);
    if (!resolved) {
      const tier = defaultCodeAssistTier(load);
      if (tier?.id && !tier.userDefinedCloudaicompanionProject) {
        resolved = await onboardCodeAssistProject({
          metadata: {
            ide_type: "ANTIGRAVITY",
            ide_name: "antigravity",
            ide_version: antigravityIdeVersion()
          },
          tierId: tier.id,
          base: safeOnboard.replace(/\/v1internal:.*$/u, ""),
          headers: {
            ...headers,
            "user-agent": `${userAgent ?? "antigravity/hub/2.29.0"} google-api-nodejs-client/10.3.0`,
            "x-goog-api-client": "gl-node/22.21.1"
          },
          signal: context.signal,
          timeoutMs,
          fetchImpl
        }).catch(() => null);
      }
      if (!resolved) throw nativeProviderError(PROVIDER_ID2, describeMissingProject(load), { body: load });
    }
    cache.set(cacheKey, resolved);
    return resolved;
  };
}
function defaultCodeAssistTier(load) {
  const tiers = Array.isArray(load?.allowedTiers) ? load.allowedTiers.filter(Boolean) : [];
  const current = load?.currentTier && typeof load.currentTier === "object" ? load.currentTier : null;
  return current ?? tiers.find((tier) => tier?.isDefault === true) ?? tiers[0] ?? null;
}
function antigravityIdeVersion() {
  return process.env.DOCKYARD_ANTIGRAVITY_IDE_VERSION || "2.9.1";
}
async function geminiParts(content, attachments, {
  signedToolCallIds = /* @__PURE__ */ new Set(),
  requireThoughtSignatures = false,
  toolIds = null,
  requireToolIds = false,
  textToolHistory = false
} = {}) {
  const values = Array.isArray(content) ? content : [content];
  const parts = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) parts.push({ text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID2, "image attachment could not be resolved");
      parts.push({ inlineData: { mimeType: image.mediaType, data: image.data } });
      continue;
    }
    if (isToolResultPart(part)) {
      if (textToolHistory) {
        parts.push({ text: toolResultText(part) });
        continue;
      }
      const callName = toolCallNameOf(part);
      const callId = toolCallIdOf(part);
      const pairedId = requireToolIds ? callId ?? toolIds?.take(callName) ?? null : null;
      const gateId = callId ?? pairedId;
      const keepFunctionResponse = !requireThoughtSignatures || Boolean(gateId && signedToolCallIds.has(gateId));
      if (keepFunctionResponse) {
        parts.push({
          functionResponse: {
            name: callName,
            ...pairedId ? { id: pairedId } : {},
            response: {
              name: callName,
              content: textFromContent(part.content ?? part.output ?? part.result ?? part.text)
            }
          }
        });
      } else {
        parts.push({ text: toolResultText(part) });
      }
      continue;
    }
    if (isToolCallPart(part)) {
      if (textToolHistory) {
        parts.push({ text: toolCallText(toolCallNameOf(part), toolCallArgsOf(part)) });
        continue;
      }
      const name2 = toolCallNameOf(part);
      const args = toolCallArgsOf(part);
      const signature = thoughtSignatureForToolPart(part);
      const callId = toolCallIdOf(part);
      const callIdForPart = requireToolIds ? callId ?? (toolIds?.issue(name2) ?? null) : null;
      if (callIdForPart && toolIds && requireToolIds) toolIds.remember(name2, callIdForPart);
      if (signature) {
        if (callIdForPart) {
          rememberThoughtSignature(callIdForPart, signature);
          signedToolCallIds.add(callIdForPart);
        }
        parts.push({
          functionCall: {
            name: name2,
            args,
            ...callIdForPart ? { id: callIdForPart } : {}
          },
          thoughtSignature: signature,
          thought_signature: signature
        });
      } else if (requireThoughtSignatures) {
        parts.push({ text: toolCallText(name2, args) });
      } else {
        parts.push({
          functionCall: {
            name: name2,
            args,
            ...callIdForPart ? { id: callIdForPart } : {}
          }
        });
      }
      continue;
    }
    const extracted = textFromContent(part);
    if (extracted) parts.push({ text: extracted });
  }
  return parts;
}
function modelNeedsToolCallIds(model) {
  return /claude/iu.test(String(model ?? ""));
}
function modelUsesTextToolHistory() {
  return true;
}
function createToolIdAllocator() {
  let counter = 0;
  const pendingByToolName = /* @__PURE__ */ new Map();
  return {
    issue(name2) {
      counter += 1;
      return `call_${counter}_${String(name2 ?? "tool").replace(/[^A-Za-z0-9_]/gu, "_").slice(0, 24)}`;
    },
    remember(name2, id) {
      const key = String(name2 ?? "tool");
      const queue = pendingByToolName.get(key) ?? [];
      queue.push(id);
      pendingByToolName.set(key, queue);
    },
    take(name2) {
      const queue = pendingByToolName.get(String(name2 ?? "tool"));
      if (!queue || queue.length === 0) return null;
      return queue.shift() ?? null;
    }
  };
}
function modelRequiresThoughtSignatures(model) {
  const id = String(model ?? "").toLowerCase();
  if (id === "gemini-2.5-flash") return false;
  return true;
}
var DEFAULT_SLIDING_WINDOW_MESSAGES = 40;
var SLIDING_WINDOW_QUANTUM = 20;
function resolveMaxMessages(request) {
  const envLimit = Number.parseInt(process.env.DOCKYARD_ANTIGRAVITY_MAX_MESSAGES ?? "", 10);
  if (Number.isSafeInteger(envLimit) && envLimit > 0) return envLimit;
  if (Number.isSafeInteger(request?.maxMessages) && request.maxMessages > 0) return request.maxMessages;
  const contextWindow = request?.modelContext?.contextWindow;
  if (Number.isSafeInteger(contextWindow) && contextWindow >= 5e5) {
    return 500;
  }
  return DEFAULT_SLIDING_WINDOW_MESSAGES;
}
function compactMessagesForContext(messages, { maxMessages = DEFAULT_SLIDING_WINDOW_MESSAGES, quantum = SLIDING_WINDOW_QUANTUM } = {}) {
  if (!Array.isArray(messages) || messages.length <= maxMessages) return messages;
  const initialIndex = messages.findIndex((m) => m?.role === "user" || m?.role === "system");
  const prefix = initialIndex >= 0 ? [messages[initialIndex]] : [];
  const rawWindowCount = Math.max(10, maxMessages - prefix.length - 1);
  const excess = messages.length - maxMessages;
  const quantOffset = excess > 0 ? Math.floor(excess / quantum) * quantum : 0;
  const windowCount = Math.max(10, rawWindowCount + (excess - quantOffset));
  const recent = messages.slice(-windowCount);
  const startIndex = messages.length - windowCount;
  if (startIndex > 0) {
    const firstRecent = recent[0];
    const isToolResult = firstRecent?.role === "tool" || Array.isArray(firstRecent?.content) && firstRecent.content.some(isToolResultPart);
    if (isToolResult && messages[startIndex - 1]) {
      recent.unshift(messages[startIndex - 1]);
    }
  }
  const compactedCount = messages.length - prefix.length - recent.length;
  if (compactedCount <= 0) return messages;
  const milestone = {
    role: "user",
    content: "[System Note: Context sliding window active. Intermediate messages were compacted to maintain low latency and prevent token exhaustion. Initial requirements and recent active turns are preserved.]"
  };
  return [...prefix, milestone, ...recent];
}
function sanitizeContentsForThoughtSignatures(contents, requireThoughtSignatures) {
  if (!requireThoughtSignatures || !Array.isArray(contents)) return contents;
  const unsignedCallNames = /* @__PURE__ */ new Set();
  for (const content of contents) {
    for (const part of content?.parts ?? []) {
      const rawCall = part?.functionCall ?? part?.function_call;
      if (rawCall && !thoughtSignatureFrom(part)) {
        unsignedCallNames.add(rawCall.name);
      }
    }
  }
  if (unsignedCallNames.size === 0) {
    return contents.map((content) => ({
      ...content,
      parts: (content?.parts ?? []).map((part) => {
        const rawCall = part?.functionCall ?? part?.function_call;
        if (rawCall) {
          const signature = thoughtSignatureFrom(part);
          const {
            thoughtSignature: _ignoredTs1,
            thought_signature: _ignoredTs2,
            ...cleanedCall
          } = rawCall;
          const callKey = part.functionCall ? "functionCall" : "function_call";
          if (signature) {
            return {
              ...part,
              thoughtSignature: signature,
              thought_signature: signature,
              [callKey]: cleanedCall
            };
          }
          return {
            ...part,
            [callKey]: cleanedCall
          };
        }
        return part;
      })
    }));
  }
  return contents.map((content) => ({
    ...content,
    parts: (content?.parts ?? []).map((part) => {
      const rawCall = part?.functionCall ?? part?.function_call;
      if (rawCall) {
        const signature = thoughtSignatureFrom(part);
        if (!signature) {
          return { text: toolCallText(rawCall.name, rawCall.args ?? rawCall.arguments) };
        }
        const {
          thoughtSignature: _ignoredTs1,
          thought_signature: _ignoredTs2,
          ...cleanedCall
        } = rawCall;
        const callKey = part.functionCall ? "functionCall" : "function_call";
        return {
          ...part,
          thoughtSignature: signature,
          thought_signature: signature,
          [callKey]: cleanedCall
        };
      }
      const resp = part?.functionResponse ?? part?.function_response;
      if (resp) {
        const name2 = resp.name ?? "tool";
        if (unsignedCallNames.has(name2)) {
          const result = resp.response?.content ?? resp.response ?? "";
          return { text: `[tool result: ${name2}] ${typeof result === "string" ? result : JSON.stringify(result)}` };
        }
      }
      return part;
    })
  }));
}
async function buildGeminiContents(request, attachments) {
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  const maxMessages = resolveMaxMessages(request);
  const messages = compactMessagesForContext(rawMessages, { maxMessages });
  const signedToolCallIds = collectSignedToolCallIds(messages);
  const requireToolIds = modelNeedsToolCallIds(request.model);
  const textToolHistory = modelUsesTextToolHistory();
  const requireThoughtSignatures = !textToolHistory && modelRequiresThoughtSignatures(request.model);
  const toolIds = createToolIdAllocator();
  const contents = [];
  for (const message of messages) {
    const parts = await geminiParts(messageContentValues(message), attachments, {
      signedToolCallIds,
      requireThoughtSignatures,
      toolIds,
      requireToolIds,
      textToolHistory
    });
    if (parts.length === 0) continue;
    contents.push({
      role: message?.role === "assistant" ? "model" : "user",
      parts
    });
  }
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Continue the conversation." }] });
  return sanitizeContentsForThoughtSignatures(contents, requireThoughtSignatures);
}
function sanitizeSchema(value) {
  if (Array.isArray(value)) return value.map(sanitizeSchema);
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (["$schema", "additionalProperties", "strict"].includes(key)) continue;
    result[key] = sanitizeSchema(child);
  }
  return result;
}
function buildGeminiTools(tools) {
  if (!Array.isArray(tools)) return void 0;
  const declarations = tools.map((tool) => ({
    name: tool?.name ?? tool?.function?.name ?? "tool",
    ...tool?.description ? { description: String(tool.description) } : {},
    parameters: sanitizeSchema(tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" })
  }));
  declarations.sort((a, b) => a.name.localeCompare(b.name));
  return declarations.length > 0 ? [{ functionDeclarations: declarations }] : void 0;
}
function resolveAntigravityThinkingConfig(request = {}) {
  if (request.thinkingConfig && typeof request.thinkingConfig === "object") {
    return {
      includeThoughts: true,
      ...request.thinkingConfig
    };
  }
  const effort = String(
    request.reasoningEffort ?? request.reasoning_effort ?? (typeof request.thinking === "string" ? request.thinking : null) ?? ""
  ).toLowerCase().trim();
  if (request.purpose === "compaction" || effort === "none" || effort === "off" || request.thinking === false) {
    return {
      includeThoughts: false,
      thinkingBudget: 0
    };
  }
  if (effort === "low") {
    return {
      includeThoughts: true,
      thinkingBudget: 1024
    };
  }
  if (effort === "medium") {
    return {
      includeThoughts: true,
      thinkingBudget: 8192
    };
  }
  if (effort === "high") {
    return {
      includeThoughts: true,
      thinkingBudget: -1
    };
  }
  if (Number.isInteger(request.thinkingBudget)) {
    return {
      includeThoughts: request.thinkingBudget > 0,
      thinkingBudget: request.thinkingBudget
    };
  }
  const modelName = String(request.model ?? "").toLowerCase();
  if (modelName.endsWith("-low")) {
    return {
      includeThoughts: true,
      thinkingBudget: 1024
    };
  }
  if (modelName.endsWith("-medium")) {
    return {
      includeThoughts: true,
      thinkingBudget: 8192
    };
  }
  if (modelName.endsWith("-high")) {
    return {
      includeThoughts: true,
      thinkingBudget: -1
    };
  }
  return {
    includeThoughts: true
  };
}
async function buildAntigravityRequest(request = {}, context = {}) {
  const nativeRequest = {
    contents: await buildGeminiContents(request, context.attachments)
  };
  const tools = buildGeminiTools(request.tools);
  if (tools) {
    nativeRequest.tools = tools;
    const toolRule = "IMPORTANT: You MUST invoke tools using native function calls. NEVER output '[tool call: ...]' or pseudo-code text.";
    const existingSystem = typeof request.system === "string" && request.system.length > 0 ? `${request.system}

` : "";
    nativeRequest.systemInstruction = { parts: [{ text: `${existingSystem}${toolRule}` }] };
  } else if (typeof request.system === "string" && request.system.length > 0) {
    nativeRequest.systemInstruction = { parts: [{ text: request.system }] };
  }
  nativeRequest.generationConfig = {
    temperature: request.temperature ?? 0.7,
    maxOutputTokens: Number.isInteger(request.maxTokens) && request.maxTokens > 0 ? request.maxTokens : Number.isInteger(request.modelContext?.maxTokens) && request.modelContext.maxTokens > 0 ? request.modelContext.maxTokens : 65536,
    ...Array.isArray(request.responseModalities) ? { responseModalities: request.responseModalities } : request.modalities ? { responseModalities: request.modalities } : {}
  };
  const thinkingConfig = resolveAntigravityThinkingConfig(request);
  if (thinkingConfig) {
    nativeRequest.generationConfig.thinkingConfig = thinkingConfig;
  }
  return nativeRequest;
}
function responsePayload(value) {
  if (!value || typeof value !== "object") return null;
  return value.response && typeof value.response === "object" ? value.response : value;
}
function googleErrorStatusText(error) {
  const raw = firstString(
    typeof error?.status === "string" ? error.status : null,
    typeof error?.code === "string" ? error.code : null
  );
  return String(raw ?? "").trim().toUpperCase();
}
function extensionFromMimeType(mimeType) {
  const normalized = String(mimeType ?? "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "png";
}
function saveInlineImageToArtifacts(inlineData, workingDir = process.cwd()) {
  try {
    const mediaType = inlineData?.mimeType ?? inlineData?.mediaType ?? "image/png";
    const base64Data = inlineData?.data;
    if (!base64Data || typeof base64Data !== "string") return null;
    const ext = extensionFromMimeType(mediaType);
    const artifactsDir = join7(workingDir, "artifacts");
    mkdirSync2(artifactsDir, { recursive: true });
    const filename = `imagen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = join7(artifactsDir, filename);
    writeFileSync2(filePath, Buffer.from(base64Data, "base64"));
    return `/artifacts/${filename}`;
  } catch {
    return null;
  }
}
function parseTextToolCall(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(?:^|\n)\s*\[(?:tool call|Tool Call):\s*([a-zA-Z0-9_.:-]+)\]\s*([\s\S]*)$/i);
  if (!match) return null;
  const leadingText = value.slice(0, match.index).trim();
  let name2 = match[1];
  if (name2.startsWith("default_api:")) {
    name2 = name2.slice("default_api:".length);
  }
  if (name2 === "run_command") {
    name2 = "bash";
  }
  let argumentsValue = match[2].trim();
  if (argumentsValue.startsWith("{") && argumentsValue.endsWith("}")) {
    try {
      const parsed = JSON.parse(argumentsValue);
      if (name2 === "bash" && !parsed.command && parsed.CommandLine) {
        parsed.command = parsed.CommandLine;
      }
      argumentsValue = JSON.stringify(parsed);
    } catch {
      argumentsValue = JSON.stringify({ input: argumentsValue });
    }
  } else if (argumentsValue) {
    argumentsValue = JSON.stringify({ input: argumentsValue });
  } else {
    argumentsValue = "{}";
  }
  return { name: name2, argumentsValue, leadingText };
}
function isPotentialTextToolCall(text3) {
  if (typeof text3 !== "string" || text3.length === 0) return false;
  const trimmed = text3.trimStart();
  if (trimmed.startsWith("[")) {
    const prefix = "[tool call:";
    const lower = trimmed.toLowerCase();
    if (prefix.startsWith(lower) || lower.startsWith(prefix)) return true;
  }
  return /\[(?:tool call|Tool Call):/i.test(text3);
}
async function* streamAntigravityResponse(response, context) {
  let text3 = "";
  let textIndex = 0;
  let textOpen = false;
  let textStarted = false;
  let textBuffered = false;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  let pendingThoughtSignature = null;
  for await (const event of readSseEvents(response)) {
    const payload = responsePayload(event.data);
    if (!payload) continue;
    if (payload.error) {
      const upstreamError = payload.error;
      const error = nativeProviderError(PROVIDER_ID2, upstreamError.message ?? "Antigravity returned an error", {
        status: upstreamError.code,
        body: upstreamError
      });
      const statusText = googleErrorStatusText(upstreamError);
      if (statusText === "UNAUTHENTICATED" || statusText === "NOTAUTHENTICATED") {
        error.authExpired = true;
      } else if (statusText === "PERMISSION_DENIED") {
        error.authForbidden = true;
      } else if (statusText === "RESOURCE_EXHAUSTED") {
        error.quotaExhausted = true;
        error.rateLimited = true;
      }
      throw error;
    }
    usage = normalizeUsage(payload.usageMetadata ?? payload.usage) ?? usage;
    const candidate2 = payload.candidates?.[0] ?? payload.candidate ?? payload;
    stop = candidate2.finishReason ?? stop;
    for (const part of candidate2.content?.parts ?? candidate2.parts ?? []) {
      if (part?.text) {
        if (part.thought === true || part.thoughtSignature || part.thought_signature) {
          const thoughtPartSignature = thoughtSignatureFrom(part);
          if (thoughtPartSignature) pendingThoughtSignature = thoughtPartSignature;
          if (textOpen) {
            if (textBuffered) {
              yield { type: "block-start", index: textIndex, blockType: "text" };
              yield { type: "text-delta", index: textIndex, text: text3 };
              textBuffered = false;
            }
            yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
            textOpen = false;
          }
          if (!reasoning) {
            reasoning = { index: nextIndex++, text: "" };
            yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
          }
          reasoning.text += part.text;
          yield { type: "reasoning-delta", index: reasoning.index, text: part.text };
          continue;
        }
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          textStarted = false;
          textBuffered = false;
        }
        text3 += part.text;
        if (!textStarted && isPotentialTextToolCall(text3)) {
          textBuffered = true;
        } else {
          if (!textStarted) {
            yield { type: "block-start", index: textIndex, blockType: "text" };
            textStarted = true;
            textBuffered = false;
            yield { type: "text-delta", index: textIndex, text: text3 };
          } else {
            yield { type: "text-delta", index: textIndex, text: part.text };
          }
        }
        continue;
      }
      const inlineData = part?.inlineData ?? part?.inline_data;
      if (inlineData?.data) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          textStarted = true;
          textBuffered = false;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        } else if (textBuffered) {
          yield { type: "block-start", index: textIndex, blockType: "text" };
          yield { type: "text-delta", index: textIndex, text: text3 };
          textStarted = true;
          textBuffered = false;
        }
        const savedPath = saveInlineImageToArtifacts(inlineData, context?.cwd ?? process.cwd());
        const mediaType = inlineData?.mimeType ?? inlineData?.mediaType ?? "image/png";
        const imageMarkdown = savedPath ? `

![Generated Image](${savedPath})

*(Image saved to \`${savedPath}\`)*

` : `

![Generated Image](data:${mediaType};base64,${inlineData.data})

`;
        text3 += imageMarkdown;
        yield { type: "text-delta", index: textIndex, text: imageMarkdown };
        continue;
      }
      const partSignature = thoughtSignatureFrom(part);
      if (partSignature) pendingThoughtSignature = partSignature;
      const call = part?.functionCall ?? part?.function_call;
      if (!call) continue;
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }
      if (textOpen) {
        const textTool = parseTextToolCall(text3);
        if (textTool) {
          if (!textStarted) {
            if (textTool.leadingText) {
              yield { type: "block-start", index: textIndex, blockType: "text" };
              yield { type: "text-delta", index: textIndex, text: textTool.leadingText };
              yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText } };
            }
          } else {
            yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText || text3 } };
          }
          const toolIndex = nextIndex++;
          const toolId = firstString(textTool.name, `tool-${toolIndex}`);
          const toolBlock = { type: "tool-call", id: toolId, name: textTool.name, arguments: textTool.argumentsValue };
          yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
          yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: textTool.name, argumentsDelta: textTool.argumentsValue };
          yield { type: "block-end", index: toolIndex, block: toolBlock };
        } else {
          if (textBuffered) {
            yield { type: "block-start", index: textIndex, blockType: "text" };
            yield { type: "text-delta", index: textIndex, text: text3 };
          }
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
        }
        textOpen = false;
        textStarted = false;
        textBuffered = false;
      }
      const index = nextIndex++;
      const name2 = firstString(call.name, "tool");
      const id = firstString(call.id, `${name2}-${index}`);
      const argumentsValue = JSON.stringify(call.args ?? call.arguments ?? {});
      const thoughtSignature = thoughtSignatureFrom(part) ?? thoughtSignatureFrom(call) ?? pendingThoughtSignature;
      pendingThoughtSignature = null;
      if (thoughtSignature) rememberThoughtSignature(id, thoughtSignature);
      const block = { type: "tool-call", id, name: name2, arguments: argumentsValue };
      if (thoughtSignature) {
        block.thoughtSignature = thoughtSignature;
        block.thought_signature = thoughtSignature;
      }
      yield { type: "block-start", index, blockType: "tool-call" };
      yield { type: "tool-call-delta", index, id, name: name2, argumentsDelta: argumentsValue };
      yield { type: "block-end", index, block };
      stop = "tool_calls";
    }
  }
  if (reasoning) yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  if (textOpen) {
    const textTool = parseTextToolCall(text3);
    if (textTool) {
      if (!textStarted) {
        if (textTool.leadingText) {
          yield { type: "block-start", index: textIndex, blockType: "text" };
          yield { type: "text-delta", index: textIndex, text: textTool.leadingText };
          yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText } };
        }
      } else {
        yield { type: "block-end", index: textIndex, block: { type: "text", text: textTool.leadingText || text3 } };
      }
      const toolIndex = nextIndex++;
      const toolId = firstString(textTool.name, `tool-${toolIndex}`);
      const toolBlock = { type: "tool-call", id: toolId, name: textTool.name, arguments: textTool.argumentsValue };
      yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
      yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: textTool.name, argumentsDelta: textTool.argumentsValue };
      yield { type: "block-end", index: toolIndex, block: toolBlock };
      stop = "tool_calls";
    } else {
      if (textBuffered) {
        yield { type: "block-start", index: textIndex, blockType: "text" };
        yield { type: "text-delta", index: textIndex, text: text3 };
      }
      yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
    }
  } else if (stop !== "tool_calls") {
    yield { type: "block-start", index: 0, blockType: "text" };
    yield { type: "block-end", index: 0, block: { type: "text", text: "" } };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}
function createAntigravityNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_ANTIGRAVITY_ENDPOINT || DEFAULT_ENDPOINT,
  // Never fabricate an upstream project: when neither configuration nor a
  // resolver yields the account's Code Assist project, the request fails with
  // a clear diagnostic instead of sending a guessed envelope value.
  project = process.env.DOCKYARD_ANTIGRAVITY_PROJECT || null,
  env = process.env,
  timeoutMs = 3e5,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  projectResolver = null,
  userAgent = process.env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent()
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID2 });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    if (context.secretStore) {
      const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
      if (ref) credential = await context.secretStore.read(ref);
    }
    const authPromise = tokenResolver({ credential, env: { ...env, ...context.env ?? {} }, home: homedir4() });
    const projectPromise = typeof projectResolver === "function" ? projectResolver({ credential, account: invocation?.account, context }) : Promise.resolve(project);
    const nativeRequestPromise = buildAntigravityRequest(request, context);
    const [auth, resolvedProject, nativeRequest] = await Promise.all([
      authPromise,
      projectPromise,
      nativeRequestPromise
    ]);
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID2, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    if (!resolvedProject) {
      const error = nativeProviderError(
        PROVIDER_ID2,
        "Antigravity Code Assist project is unavailable for the selected account; set DOCKYARD_ANTIGRAVITY_PROJECT or reauthorize so loadCodeAssist can resolve it"
      );
      error.degraded = true;
      throw error;
    }
    const body = {
      project: resolvedProject,
      model: request.model,
      request: nativeRequest
    };
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json"
    };
    const resolvedUserAgent = userAgent ?? context.env?.DOCKYARD_ANTIGRAVITY_USER_AGENT ?? detectAntigravityUserAgent();
    if (resolvedUserAgent) headers["user-agent"] = resolvedUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: context.signal
    }, { providerId: PROVIDER_ID2, timeoutMs, fetchImpl });
    return streamAntigravityResponse(response, context);
  };
  executor.nativeTransport = "gemini-stream-generate-content";
  return guardEmptyCompletion(executor, { providerId: PROVIDER_ID2 });
}
function createAntigravityNativeQuotaReader({
  endpoint: endpoint2 = process.env.DOCKYARD_ANTIGRAVITY_QUOTA_ENDPOINT || DEFAULT_QUOTA_ENDPOINT,
  env = process.env,
  home = homedir4(),
  timeoutMs = 2e4,
  fetchImpl = fetch,
  tokenResolver = resolveAntigravityAccessToken,
  project = env.DOCKYARD_ANTIGRAVITY_PROJECT,
  projectResolver = null,
  userAgent = env.DOCKYARD_ANTIGRAVITY_USER_AGENT || detectAntigravityUserAgent()
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID2 });
  return async ({ credential = null, account = null, context = {} } = {}) => {
    const auth = await tokenResolver({
      credential,
      env: { ...env, ...context.env ?? {} },
      home
    });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID2, "Antigravity OAuth token is unavailable; authorize Antigravity first");
      error.authExpired = true;
      throw error;
    }
    const resolvedProject = typeof projectResolver === "function" ? await projectResolver({ credential, account, context }) : project;
    const body = resolvedProject ? { project: resolvedProject } : {};
    const resolvedUserAgent = userAgent ?? context.env?.DOCKYARD_ANTIGRAVITY_USER_AGENT ?? detectAntigravityUserAgent();
    const headers = {
      authorization: `Bearer ${auth.token}`,
      "content-type": "application/json",
      accept: "application/json"
    };
    if (resolvedUserAgent) headers["user-agent"] = resolvedUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: context.signal
    }, { providerId: PROVIDER_ID2, timeoutMs, fetchImpl });
    let raw;
    try {
      raw = typeof response.json === "function" ? await response.json() : JSON.parse(await response.text());
    } finally {
      cleanupNativeResponse(response);
    }
    if (!raw || typeof raw !== "object") {
      throw nativeProviderError(PROVIDER_ID2, "quota summary response was not an object");
    }
    return raw;
  };
}
var antigravityNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID2,
  endpoint: DEFAULT_ENDPOINT,
  quotaEndpoint: DEFAULT_QUOTA_ENDPOINT
});

// modules/provider-antigravity/src/driver.mjs
var PROVIDER_ID3 = "antigravity";
var DEFAULT_CLI = "agy";
function windowsAgyCandidates(env = process.env, home = homedir5()) {
  const appData = env.APPDATA || join8(home, "AppData", "Roaming");
  const localAppData = env.LOCALAPPDATA || join8(home, "AppData", "Local");
  return [
    join8(appData, "npm", "agy.cmd"),
    join8(appData, "npm", "agy.exe"),
    join8(localAppData, "Programs", "agy", "agy.exe"),
    join8(localAppData, "agy", "agy.exe"),
    join8(home, ".local", "bin", "agy.cmd"),
    join8(home, ".gemini", "antigravity", "bin", "agy.cmd"),
    join8(home, ".gemini", "antigravity", "bin", "agy.exe")
  ];
}
function resolveAgyCliPath(configured, { env = process.env, home = homedir5(), platform = process.platform } = {}) {
  const envPath = configured ?? env.DOCKYARD_ANTIGRAVITY_CLI;
  if (envPath && envPath !== "agy" && envPath !== DEFAULT_CLI) {
    return envPath;
  }
  const candidates = platform === "win32" ? windowsAgyCandidates(env, home) : [
    join8(home, ".local", "bin", "agy"),
    join8(home, ".gemini", "antigravity", "bin", "agy"),
    "/usr/local/bin/agy",
    "/opt/homebrew/bin/agy",
    "/usr/bin/agy"
  ];
  for (const candidate2 of candidates) {
    if (existsSync3(candidate2)) return candidate2;
  }
  return envPath || DEFAULT_CLI;
}
function augmentPathWithUserBins(env = process.env, home = homedir5(), platform = process.platform) {
  if (platform === "win32") {
    const appData = env?.APPDATA || join8(home, "AppData", "Roaming");
    const extraPaths2 = [
      join8(appData, "npm"),
      join8(home, ".local", "bin"),
      join8(home, ".gemini", "antigravity", "bin")
    ];
    const currentPath2 = env?.PATH || "";
    const parts2 = currentPath2.split(";");
    const toPrepend2 = extraPaths2.filter((p) => existsSync3(p) && !parts2.includes(p));
    if (toPrepend2.length === 0) return currentPath2;
    return [...toPrepend2, currentPath2].filter(Boolean).join(";");
  }
  const extraPaths = [
    join8(home, ".local", "bin"),
    join8(home, ".gemini", "antigravity", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin"
  ];
  const currentPath = env?.PATH || "";
  const parts = currentPath.split(":");
  const toPrepend = extraPaths.filter((p) => existsSync3(p) && !parts.includes(p));
  if (toPrepend.length === 0) return currentPath;
  return [...toPrepend, currentPath].filter(Boolean).join(":");
}
var DEFAULT_CATALOG_TTL_MS = 6e4;
var DEFAULT_AUTH_TIMEOUT_MS = 10 * 60 * 1e3;
var CREDENTIAL_SLOT2 = Symbol("dockyard-antigravity-session");
var ANTIGRAVITY_CREDENTIAL_REFRESH_MODES = Object.freeze({
  DSH_BROWSER_OAUTH: "dockyard_browser_oauth",
  AGY_SESSION: "agy_session"
});
var AGY_FILE_STORAGE_ENV = "GEMINI_FORCE_FILE_STORAGE";
var ANTIGRAVITY_OFFICIAL_CLIENT = ["1071006060591", "tmhssin2h21lcre235vtolojh4g403ep"].join("-");
var ANTIGRAVITY_BROWSER_CLIENT_ID = process.env.DOCKYARD_ANTIGRAVITY_CLIENT_ID || `${ANTIGRAVITY_OFFICIAL_CLIENT}.apps.googleusercontent.com`;
var ANTIGRAVITY_BROWSER_CLIENT_SECRET = process.env.DOCKYARD_ANTIGRAVITY_CLIENT_SECRET || "";
var ANTIGRAVITY_BROWSER_AUTHORIZATION_URL = process.env.DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL || "https://accounts.google.com/o/oauth2/v2/auth";
var ANTIGRAVITY_BROWSER_TOKEN_URL = process.env.DOCKYARD_ANTIGRAVITY_TOKEN_URL || "https://oauth2.googleapis.com/token";
var ANTIGRAVITY_BROWSER_USERINFO_URL = process.env.DOCKYARD_ANTIGRAVITY_USERINFO_URL || "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
var ANTIGRAVITY_BROWSER_REDIRECT_URI = process.env.DOCKYARD_ANTIGRAVITY_REDIRECT_URI || "http://localhost:51121/oauth-callback";
var ANTIGRAVITY_BROWSER_SCOPES = process.env.DOCKYARD_ANTIGRAVITY_OAUTH_SCOPE || [
  // The same OAuth token is used both for userinfo and Google's Code Assist
  // endpoints. Keep the upstream API scope instead of authorizing a token
  // that can identify the user but cannot call streamGenerateContent.
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  // Both are requested by the official client and neither is optional in
  // practice: without them Code Assist treats the caller as an unknown client.
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs"
].join(" ");
var OFFICIAL_ANTIGRAVITY_MODEL_METADATA = Object.freeze([
  Object.freeze({
    id: "gemini-3.8-flash",
    contextWindow: 1048576,
    maxTokens: 65536
  }),
  Object.freeze({
    id: "gemini-3.8-pro",
    contextWindow: 1048576,
    maxTokens: 65536
  }),
  Object.freeze({
    id: "gemini-3.7-flash",
    contextWindow: 1048576,
    maxTokens: 65536
  }),
  Object.freeze({
    id: "gemini-3.7-pro",
    contextWindow: 1048576,
    maxTokens: 65536
  })
]);
var ANTIGRAVITY_PTY_SCRIPT = String.raw`
import os
import pty
import select
import signal
import sys

command = sys.argv[1]
command_args = sys.argv[1:]
child_pid, pty_fd = pty.fork()
if child_pid == 0:
    os.execvpe(command, command_args, os.environ)

def terminate(_signum, _frame):
    try:
        os.kill(child_pid, signal.SIGTERM)
    except OSError:
        pass
    os._exit(143)

signal.signal(signal.SIGTERM, terminate)
signal.signal(signal.SIGINT, terminate)
stdin_open = True
exit_code = 1
try:
    while True:
        inputs = [pty_fd]
        if stdin_open:
            inputs.append(0)
        ready, _, _ = select.select(inputs, [], [], 0.25)
        if pty_fd in ready:
            try:
                data = os.read(pty_fd, 8192)
            except OSError:
                data = b""
            if not data:
                break
            os.write(1, data)
        if stdin_open and 0 in ready:
            data = os.read(0, 8192)
            if data:
                os.write(pty_fd, data)
            else:
                stdin_open = False
        waited_pid, status = os.waitpid(child_pid, os.WNOHANG)
        if waited_pid:
            exit_code = os.waitstatus_to_exitcode(status)
            break
finally:
    try:
        os.close(pty_fd)
    except OSError:
        pass
    try:
        os.kill(child_pid, signal.SIGTERM)
    except OSError:
        pass
sys.exit(exit_code)
`;
function hash2(value) {
  return createHash4("sha256").update(String(value)).digest("hex");
}
var EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
function normalizeEmail(value) {
  const email = String(value ?? "").trim();
  return email.match(EMAIL_PATTERN)?.[0] ?? null;
}
function findEmailField(value, depth = 0, seen = /* @__PURE__ */ new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (/email/i.test(key)) {
      const direct = normalizeEmail(nested);
      if (direct) return direct;
    }
    const child = findEmailField(nested, depth + 1, seen);
    if (child) return child;
  }
  return null;
}
function extractAntigravityAccountEmail(...values) {
  for (const value of values) {
    const direct = normalizeEmail(
      value?.email ?? value?.account?.email ?? value?.user?.email ?? value?.identity?.email ?? value?.accountEmail ?? value?.userEmail ?? value?.email_address ?? value?.command?.data?.email ?? value?.command?.data?.email_address
    );
    if (direct) return direct;
    if (value?.id_token || value?.idToken) {
      try {
        const decoded = decodeJwtPayload(value.id_token || value.idToken);
        const email = normalizeEmail(decoded?.email);
        if (email) return email;
      } catch {
      }
    }
    const nested = findEmailField(value);
    if (nested) return nested;
    const text3 = typeof value === "string" ? value : "";
    const explicit = text3.match(
      /(?:applyAuthResult:\s*)?email\s*=\s*([^\s,;]+)|authenticated\s+successfully\s+as\s+([^\s,;]+)/i
    );
    const matched = normalizeEmail(explicit?.[1] ?? explicit?.[2]);
    if (matched) return matched;
  }
  return null;
}
function sessionFingerprint(session) {
  const email = typeof session?.email === "string" && session.email.length > 0 ? session.email : null;
  const token = typeof session?.token === "string" && session.token.length > 0 ? session.token : null;
  if (email) return hash2(`antigravity-session:email:${email.toLowerCase()}`).slice(0, 10).toUpperCase();
  return token ? hash2(`antigravity-session:${token}`).slice(0, 10).toUpperCase() : null;
}
function activeSessionError(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}
function sameEmail(left, right) {
  const a = normalizeEmail(left)?.toLowerCase();
  const b = normalizeEmail(right)?.toLowerCase();
  return Boolean(a && b && a === b);
}
function tokenExpiresAt(tokens, now = /* @__PURE__ */ new Date()) {
  return isoFromEpoch(tokens?.expiresAt ?? tokens?.expires_at) ?? addSecondsIso(tokens?.expires_in ?? tokens?.expiresIn, now);
}
function tokenNeedsRefresh(credential, now, leewayMs = 6e4) {
  if (!credential?.refresh) return false;
  if (!credential.expiresAt) return true;
  const expiresAt = Date.parse(credential.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now.getTime() + leewayMs;
}
function officialAntigravityTokenPath(environment) {
  const home = environment?.HOME || homedir5();
  return environment?.DOCKYARD_ANTIGRAVITY_TOKEN_FILE || join8(home, ".gemini", "antigravity-cli", "antigravity-oauth-token");
}
function agyRefreshEnvironment(environment, tokenPath) {
  return {
    ...environment,
    DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath,
    [AGY_FILE_STORAGE_ENV]: "true",
    AGY_CLI_HIDE_ACCOUNT_INFO: "1"
  };
}
function credentialRefreshMode(account, { hasExplicitBrowserClient = false } = {}) {
  const explicit = account?.resources?.credentialRefreshMode;
  if (explicit) return explicit;
  if (account?.resources?.sessionPersistence === "captured" && !hasExplicitBrowserClient) {
    return ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION;
  }
  return null;
}
function cliFailure2(code, signal, output, errorOutput) {
  const error = new Error(`Antigravity CLI failed (${signal ?? code})`);
  error.code = code;
  const structured = parseJsonOutput2(output);
  const structuredDetail = structured?.error ?? structured?.response ?? structured?.result?.error ?? structured?.result?.response;
  error.detail = String(errorOutput || structuredDetail || "").replace(/\s+/g, " ").trim().slice(0, 300);
  return error;
}
function runCommand(command, args, {
  env = process.env,
  timeoutMs = 3e4,
  signal,
  includeAccountInfo = false
} = {}) {
  return new Promise((resolve2, reject) => {
    const childEnv = { ...env, [AGY_FILE_STORAGE_ENV]: "true" };
    if (includeAccountInfo) delete childEnv.AGY_CLI_HIDE_ACCOUNT_INFO;
    else childEnv.AGY_CLI_HIDE_ACCOUNT_INFO ??= "1";
    childEnv.PATH = augmentPathWithUserBins(childEnv, childEnv.HOME || childEnv.USERPROFILE || homedir5());
    const resolvedCommand = command === DEFAULT_CLI || command === "agy" ? resolveAgyCliPath(command, { env: childEnv, home: childEnv.HOME || childEnv.USERPROFILE || homedir5() }) : command;
    const child = spawnCli(resolvedCommand, args, {
      env: childEnv,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      ...signal ? { signal } : {}
    });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    let killTimer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
      }
      killTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
        }
      }, 2e3);
      killTimer.unref?.();
    }, timeoutMs);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      reject(error);
    });
    child.on("close", (code, closeSignal) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      const output = Buffer.concat(stdout).toString("utf8");
      const errorOutput = Buffer.concat(stderr).toString("utf8");
      if (!timedOut && code === 0) {
        resolve2({ output, errorOutput });
        return;
      }
      const failure = cliFailure2(code, closeSignal, output, errorOutput);
      if (timedOut) failure.message = `Antigravity CLI timed out after ${timeoutMs}ms`;
      reject(failure);
    });
  });
}
function parseJsonOutput2(output) {
  try {
    return JSON.parse(output);
  } catch {
    for (const line of String(output).split(/\r?\n/).reverse()) {
      if (!line.trim()) continue;
      try {
        return JSON.parse(line);
      } catch {
      }
    }
    return null;
  }
}
function normalizeToken(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function parseAntigravityModelCatalog(output) {
  const rows = String(output).split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^fetching available models/i.test(line)).map((line) => {
    const [id, ...nameParts] = line.split("	");
    return { id, name: nameParts.join("	") || id };
  }).filter((model) => model.id);
  return collapseAntigravityTierFamilies(rows);
}
function registryModels(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.models)) return value.models;
  return [];
}
function mergedAntigravityRegistry(registry, liveModelIds = []) {
  const byId = /* @__PURE__ */ new Map();
  for (const candidate2 of registryModels(registry)) {
    if (!candidate2 || typeof candidate2.id !== "string" || candidate2.id.length === 0) continue;
    const defined = Object.fromEntries(Object.entries(candidate2).filter(([, value]) => value !== void 0 && value !== null));
    byId.set(candidate2.id, { ...byId.get(candidate2.id) ?? {}, ...defined });
  }
  for (const official of OFFICIAL_ANTIGRAVITY_MODEL_METADATA) {
    const referenced = byId.has(official.id) || liveModelIds.some((id) => id === official.id || id.startsWith(`${official.id}-`));
    if (!referenced) continue;
    byId.set(official.id, { ...official, ...byId.get(official.id) ?? {} });
  }
  return [...byId.values()];
}
function catalogScopeKey(accounts) {
  const accountIds = (Array.isArray(accounts) ? accounts : []).map((account) => typeof account?.accountId === "string" ? account.accountId : "").filter(Boolean).sort();
  return accountIds.length > 0 ? `accounts:${hash2(accountIds.join("\n")).slice(0, 32)}` : "unscoped";
}
function defaultAntigravityCatalogCachePath({ env = process.env, home = homedir5() } = {}) {
  const dockyardHome = env.DOCKYARD_DSH_HOME || join8(home, ".dockyard-dsh");
  return join8(dockyardHome, "antigravity-catalog.json");
}
function persistableCatalog(value) {
  return {
    models: Array.isArray(value?.models) ? value.models : [],
    source: typeof value?.source === "string" ? value.source : "official_antigravity_cli"
  };
}
var ANTIGRAVITY_CATALOG_CACHE_SCHEMA = 2;
async function readAntigravityCatalogCache(filePath) {
  if (!filePath) return { schema: ANTIGRAVITY_CATALOG_CACHE_SCHEMA, entries: {} };
  try {
    const parsed = JSON.parse(await readFile4(filePath, "utf8"));
    const usable = parsed?.schema === ANTIGRAVITY_CATALOG_CACHE_SCHEMA;
    return {
      schema: ANTIGRAVITY_CATALOG_CACHE_SCHEMA,
      entries: usable && parsed?.entries && typeof parsed.entries === "object" ? parsed.entries : {}
    };
  } catch {
    return { schema: ANTIGRAVITY_CATALOG_CACHE_SCHEMA, entries: {} };
  }
}
async function writeAntigravityCatalogCache(filePath, cache) {
  if (!filePath) return;
  await mkdir3(dirname7(filePath), { recursive: true, mode: 448 });
  const entries = Object.entries(cache.entries ?? {}).slice(-8);
  const tempPath = `${filePath}.${randomUUID4()}.tmp`;
  try {
    await writeFile2(tempPath, JSON.stringify({ schema: ANTIGRAVITY_CATALOG_CACHE_SCHEMA, entries: Object.fromEntries(entries) }), {
      encoding: "utf8",
      mode: 384
    });
    await rename2(tempPath, filePath);
  } finally {
    await rm3(tempPath, { force: true }).catch(() => {
    });
  }
}
function registryMatch(model, registry) {
  const candidates = registryModels(registry).filter((candidate2) => candidate2 && typeof candidate2.id === "string" && candidate2.id.length > 0).filter((candidate2) => model.id === candidate2.id || model.id.startsWith(`${candidate2.id}-`)).sort((left, right) => right.id.length - left.id.length);
  const exact = candidates.find((candidate2) => candidate2.id === model.id);
  if (exact) return exact;
  const family = candidates[0];
  if (!family || !model.reasoning?.efforts?.length) return null;
  const suffix = model.id.slice(family.id.length + 1);
  return model.reasoning.efforts.some((effort) => normalizeToken(effort.id) === normalizeToken(suffix)) ? family : null;
}
function enrichAntigravityModelCatalog(models, registry) {
  return (Array.isArray(models) ? models : []).map((model) => {
    const match = registryMatch(model, registry);
    if (!match) return model;
    const contextWindow = finiteNumber(model.contextWindow ?? match.contextWindow ?? match.context_window ?? match.context_length);
    const maxTokens = finiteNumber(model.maxTokens ?? match.maxTokens ?? match.max_tokens ?? match.max_output_tokens);
    const inputModalities = Array.isArray(model.inputModalities) ? model.inputModalities : Array.isArray(match.input) ? match.input : void 0;
    return {
      ...model,
      ...Number.isInteger(contextWindow) ? { contextWindow } : {},
      ...Number.isInteger(maxTokens) ? { maxTokens } : {},
      ...inputModalities?.length ? { inputModalities: [...inputModalities] } : {}
    };
  });
}
function createAntigravityCatalogLoader({
  cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
  env = process.env,
  home = homedir5(),
  cacheFilePath = env.DOCKYARD_ANTIGRAVITY_CATALOG_CACHE ?? defaultAntigravityCatalogCachePath({ env, home }),
  timeoutMs = 3e4,
  cacheTtlMs = Number(process.env.DOCKYARD_ANTIGRAVITY_CATALOG_TTL_MS) || DEFAULT_CATALOG_TTL_MS,
  commandRunner = runCommand,
  registryLoader = null,
  projectResolver = null
} = {}) {
  const resolvedCliPath = resolveAgyCliPath(cliPath, { env, home });
  const cached = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  const pendingRefreshes = /* @__PURE__ */ new Set();
  let persistentPromise = null;
  let persistentCache = null;
  let persistWrite = Promise.resolve();
  const loadPersistent = () => {
    persistentPromise ??= readAntigravityCatalogCache(cacheFilePath).then((value) => {
      persistentCache = value;
      return value;
    });
    return persistentPromise;
  };
  const persist = (scope, value) => {
    if (!cacheFilePath || !Array.isArray(value?.models) || value.models.length === 0) return Promise.resolve();
    persistWrite = persistWrite.then(async () => {
      const cache = await loadPersistent();
      cache.entries[scope] = {
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
        value: persistableCatalog(value)
      };
      const scopes = Object.keys(cache.entries);
      if (scopes.length > 8) {
        for (const staleScope of scopes.slice(0, scopes.length - 8)) delete cache.entries[staleScope];
      }
      await writeAntigravityCatalogCache(cacheFilePath, cache);
    }).catch(() => {
    });
    return persistWrite;
  };
  const modelsFromAccount = async (source = {}) => {
    const account = source.account ?? null;
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef ?? null;
    if (!credentialRef || typeof source.secretStore?.read !== "function") return null;
    let credential = null;
    try {
      credential = await source.secretStore.read(credentialRef);
    } catch {
      return null;
    }
    if (!credential) return null;
    let auth = null;
    try {
      auth = await resolveAntigravityAccessToken({ credential, env, home });
    } catch {
      return null;
    }
    if (!auth?.token) return null;
    let project = null;
    if (typeof projectResolver === "function") {
      try {
        project = await projectResolver({ credential, account });
      } catch {
        project = null;
      }
    }
    try {
      const models = await fetchAntigravityAvailableModels({
        token: auth.token,
        project,
        fetchImpl: fetch,
        timeoutMs
      });
      if (!Array.isArray(models) || models.length === 0) return null;
      return models;
    } catch {
      return null;
    }
  };
  const refresh = (scope, source = {}) => {
    if (pending.has(scope)) return pending.get(scope);
    const promise = modelsFromAccount(source).then((accountModels) => {
      if (accountModels) {
        const value = { models: accountModels, source: "official_fetch_available_models" };
        cached.set(scope, { value, cachedAt: Date.now() });
        void persist(scope, value);
        return value;
      }
      return Promise.resolve(commandRunner(resolvedCliPath, ["models"], {
        env,
        timeoutMs
      })).then(async (result) => {
        let registry = [];
        if (typeof registryLoader === "function") {
          try {
            registry = await registryLoader();
          } catch {
          }
        }
        const liveModels = parseAntigravityModelCatalog(result.output);
        const models = enrichAntigravityModelCatalog(
          liveModels,
          mergedAntigravityRegistry(registry, liveModels.map((model) => model.id))
        );
        const enriched = models.some((model, index) => {
          const original = liveModels[index];
          return model.contextWindow !== original?.contextWindow || model.maxTokens !== original?.maxTokens;
        });
        const value = {
          models,
          source: enriched ? "official_antigravity_cli+model_registry" : "official_antigravity_cli"
        };
        cached.set(scope, { value, cachedAt: Date.now() });
        await persist(scope, value);
        return value;
      }).catch((error) => {
        const previous = cached.get(scope)?.value;
        if (previous?.models?.length) {
          return {
            ...previous,
            source: `${previous.source ?? "official_antigravity_cli"}_stale`,
            diagnostics: [redactError(error)]
          };
        }
        if (persistentCache?.entries && typeof persistentCache.entries === "object") {
          const anyCached = Object.values(persistentCache.entries).find((item) => Array.isArray(item?.value?.models) && item.value.models.length > 0);
          if (anyCached?.value) {
            const fallbackValue = {
              ...anyCached.value,
              source: `${anyCached.value.source ?? "official_antigravity_cli"}_persistent_cache`,
              diagnostics: [redactError(error)]
            };
            cached.set(scope, { value: fallbackValue, cachedAt: Date.now() });
            return fallbackValue;
          }
        }
        const unavailable = {
          models: [],
          source: error?.code === "ENOENT" ? "antigravity_cli_not_found" : "antigravity_cli_unavailable",
          diagnostics: [redactError(error)]
        };
        cached.set(scope, { value: unavailable, cachedAt: Date.now() });
        return unavailable;
      }).finally(() => {
        pending.delete(scope);
      });
    });
    pendingRefreshes.add(promise);
    promise.finally(() => pendingRefreshes.delete(promise)).catch(() => {
    });
    pending.set(scope, promise);
    return promise;
  };
  const loadCatalog = async function loadCatalog2({ force = false, accounts = [], accountId = null, secretStore = null } = {}) {
    const account = accountId ? (Array.isArray(accounts) ? accounts.find((candidate2) => candidate2?.accountId === accountId) : null) ?? null : null;
    const scope = accountId ? `account:${accountId}` : catalogScopeKey(accounts);
    const source = { account, secretStore };
    let entry = cached.get(scope);
    if (!entry) {
      const persisted = await loadPersistent();
      const stored = persistentCache?.entries?.[scope] ?? persisted.entries?.[scope] ?? persistentCache?.entries?.unscoped ?? persisted.entries?.unscoped ?? Object.values(persisted.entries ?? {}).find((item) => Array.isArray(item?.value?.models) && item.value.models.length > 0);
      if (stored?.value && Array.isArray(stored.value.models)) {
        entry = {
          value: {
            ...stored.value,
            source: `${stored.value.source ?? "official_antigravity_cli"}_persistent_cache`
          },
          cachedAt: 0
        };
        cached.set(scope, entry);
      }
    }
    const fresh = entry && entry.cachedAt > 0 && Date.now() - entry.cachedAt < cacheTtlMs;
    if (!force && fresh) return entry.value;
    if (!force && entry) {
      void refresh(scope, source).catch(() => {
      });
      return entry.value;
    }
    return refresh(scope, source);
  };
  loadCatalog.whenIdle = async () => {
    await Promise.allSettled([...pendingRefreshes]);
    await persistWrite.catch(() => {
    });
  };
  return loadCatalog;
}
function familyPrefixForModel(model) {
  const defaultEffort = model?.reasoning?.defaultEffort;
  if (typeof defaultEffort !== "string" || defaultEffort.length === 0) return null;
  const suffix = `-${defaultEffort}`;
  return model.id.endsWith(suffix) ? model.id.slice(0, -suffix.length) : null;
}
async function resolveAntigravityInvocationModel({ catalogLoader, model, reasoningEffort } = {}) {
  if (typeof model !== "string" || typeof reasoningEffort !== "string" || !catalogLoader) {
    return { model, reasoningEffort };
  }
  try {
    const catalog = await catalogLoader();
    const models = Array.isArray(catalog?.models) ? catalog.models : [];
    const selected = models.find((candidate2) => candidate2?.id === model);
    const prefix = familyPrefixForModel(selected);
    if (!selected || !prefix) return { model, reasoningEffort };
    const declaredTier = (selected.reasoning?.efforts ?? []).some(
      (effort) => effort?.id === reasoningEffort
    );
    if (declaredTier) {
      const explicit = models.find((candidate2) => candidate2?.id === `${prefix}-${reasoningEffort}`);
      return { model: explicit?.id ?? `${prefix}-${reasoningEffort}`, reasoningEffort: void 0 };
    }
    const target = models.find((candidate2) => {
      return candidate2?.id?.startsWith(`${prefix}-`) && candidate2.reasoning?.defaultEffort === reasoningEffort;
    });
    if (!target) return { model, reasoningEffort };
    return { model: target.id, reasoningEffort: void 0 };
  } catch {
    return { model, reasoningEffort };
  }
}
async function resolveAntigravityNativeInvocationModel(options = {}) {
  return resolveAntigravityInvocationModel(options);
}
function quotaGroups(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.groups)) return data.groups;
  if (Array.isArray(data.quota_groups)) return data.quota_groups;
  if (Array.isArray(data.quotaGroups)) return data.quotaGroups;
  return [];
}
function findQuotaData(value, depth = 0, seen = /* @__PURE__ */ new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  if (quotaGroups(value).length > 0) return value;
  for (const key of ["command", "data", "response", "quota_summary", "quotaSummary", "result"]) {
    const found = findQuotaData(value[key], depth + 1, seen);
    if (found) return found;
  }
  return null;
}
function findCreditsData(value, depth = 0, seen = /* @__PURE__ */ new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  if (Object.hasOwn(value, "remaining_credits") || Object.hasOwn(value, "remainingCredits")) return value;
  for (const child of Object.values(value)) {
    const found = findCreditsData(child, depth + 1, seen);
    if (found) return found;
  }
  return null;
}
function creditsFromData(data) {
  if (!data || typeof data !== "object") return null;
  const remaining = finiteNumber(data.remaining_credits ?? data.remainingCredits);
  const upgradeUri = stringValue(data.upgrade_uri ?? data.upgradeUri);
  if (remaining === null && upgradeUri === null) return null;
  return { remaining, upgradeUri };
}
function parseQuotaData(data, now = /* @__PURE__ */ new Date(), source = "antigravity_cli") {
  const windows = [];
  for (const group of quotaGroups(data)) {
    const groupName = stringValue(group?.displayName ?? group?.name);
    for (const bucket of group?.buckets ?? []) {
      const fraction = finiteNumber(bucket.remaining_fraction ?? bucket.remainingFraction);
      const percent = finiteNumber(bucket.remaining_percent ?? bucket.remainingPercent);
      const remaining = fraction ?? (percent === null ? null : percent / 100);
      const bucketName = stringValue(bucket?.displayName ?? bucket?.name);
      const bucketId = stringValue(bucket.bucketId ?? bucket.id) ?? (groupName && bucketName ? `${groupName}:${bucketName}` : `${groupName ?? "group"}:${bucketName ?? "window"}`);
      windows.push({
        id: bucketId,
        name: [groupName, bucketName].filter(Boolean).join(" / ") || null,
        remaining,
        limit: remaining === null ? null : 1,
        unit: remaining === null ? null : "fraction",
        resetAt: isoFromEpoch(bucket.reset_time ?? bucket.resetTime),
        updatedAt: now.toISOString(),
        source
      });
    }
  }
  return windows;
}
function parseQuotaText(text3, now = /* @__PURE__ */ new Date(), source = "antigravity_cli") {
  const windows = [];
  for (const line of text3.split(/\r?\n/)) {
    const parts = line.split("	");
    if (parts.length < 3 || !/%$/.test(parts[2])) continue;
    const remaining = finiteNumber(parts[2].replace(/%$/, ""));
    if (remaining === null) continue;
    windows.push({
      id: `${parts[0]}:${parts[1]}`,
      name: `${parts[0]} / ${parts[1]}`,
      remaining,
      limit: 100,
      unit: "percent",
      resetAt: isoFromEpoch(parts[3]),
      updatedAt: now.toISOString(),
      source
    });
  }
  return windows;
}
function parseAntigravityNativeQuota(value, now = /* @__PURE__ */ new Date()) {
  const data = findQuotaData(value);
  let windows = parseQuotaData(data, now, "antigravity_native");
  if (windows.length === 0) {
    windows = recursiveQuotaWindows(value, { source: "antigravity_native", now, prefix: "antigravity" });
  }
  const credits = findCreditsData(value);
  return {
    windows,
    credits: credits ? {
      remaining: finiteNumber(credits.remaining_credits ?? credits.remainingCredits),
      upgradeUri: stringValue(credits.upgrade_uri ?? credits.upgradeUri)
    } : null
  };
}
function candidate(now, {
  email = null,
  session = null,
  existingAccounts = [],
  source = "official_antigravity_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  credentialRefreshMode: credentialRefreshMode2 = null
} = {}) {
  const normalizedEmail = normalizeEmail(email);
  const capturedSession = normalizedEmail && session && !session.email ? { ...session, email: normalizedEmail } : session;
  const fingerprint = sessionFingerprint(capturedSession);
  const stableAccountId = normalizedEmail ? `antigravity:google:${hash2(`email:${normalizedEmail.toLowerCase()}`).slice(0, 20)}` : fingerprint ? `antigravity:session:${hash2(`fingerprint:${fingerprint}`).slice(0, 20)}` : "antigravity:active";
  const known = existingAccounts.find((account) => fingerprint && account?.resources?.sessionFingerprint === fingerprint || sameEmail(account?.email, normalizedEmail));
  const legacy = existingAccounts.find((account) => account?.accountId === "antigravity:active");
  const accountId = known?.accountId ?? (legacy && !legacy.resources?.sessionFingerprint && stableAccountId !== "antigravity:active" ? legacy.accountId : stableAccountId);
  const identityLabel = normalizedEmail ?? (fingerprint ? `Antigravity \u5B98\u65B9\u4F1A\u8BDD \xB7 ${fingerprint}` : "Antigravity \u5B98\u65B9\u5F53\u524D\u4F1A\u8BDD");
  const identitySource = normalizedEmail ? sourceKind === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER ? "official_browser_oauth" : "official_cli_auth_status" : fingerprint ? "local_oauth_session_fingerprint" : "official_active_session";
  const credentialRef = createCredentialRef(PROVIDER_ID3, accountId);
  const value = {
    candidateId: `antigravity:${hash2(accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID3,
    source,
    accountId,
    displayName: identityLabel,
    email: normalizedEmail,
    subscription: { plan: null, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: capturedSession?.expiresAt ?? null,
      nextRefreshAt: null,
      lastRefreshedAt: capturedSession?.lastRefreshedAt ?? null,
      refreshable: capturedSession?.refreshToken ? true : null
    },
    imported: false,
    status: "available",
    diagnostic: null,
    credentialRef,
    resources: {
      ...officialSessionResources({ sourceKind, authSource: source }),
      ...credentialRefreshMode2 ? { credentialRefreshMode: credentialRefreshMode2 } : {},
      identitySource,
      identityLabel,
      ...fingerprint ? { sessionFingerprint: fingerprint } : {},
      identityNote: normalizedEmail ? sourceKind === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER ? "Google \u8D26\u53F7\u5DF2\u6388\u6743" : "\u8D26\u53F7\u90AE\u7BB1\u6765\u81EA\u5B98\u65B9 Antigravity \u767B\u5F55\u6001" : fingerprint ? "\u5B98\u65B9\u767B\u5F55\u6001\u672A\u8FD4\u56DE\u90AE\u7BB1\uFF1B\u4F7F\u7528\u4F1A\u8BDD\u6307\u7EB9\u533A\u5206\u8D26\u53F7" : "\u5B98\u65B9\u53EA\u8FD4\u56DE\u5F53\u524D\u4F1A\u8BDD\uFF1B\u5207\u6362\u8D26\u53F7\u540E\u8BF7\u91CD\u65B0\u626B\u63CF",
      sessionPersistence: capturedSession?.token ? "captured" : "active"
    }
  };
  Object.defineProperty(value, CREDENTIAL_SLOT2, {
    value: {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID3,
      ...capturedSession?.token ? { access: capturedSession.token } : {},
      ...capturedSession?.refreshToken ? { refresh: capturedSession.refreshToken } : {},
      ...normalizedEmail ? { email: normalizedEmail } : {},
      ...capturedSession?.expiresAt ? { expiresAt: capturedSession.expiresAt } : {},
      ...capturedSession?.lastRefreshedAt ? { lastRefreshedAt: capturedSession.lastRefreshedAt } : {}
    },
    enumerable: false
  });
  return value;
}
function summarizeAntigravityCandidate(value) {
  return {
    providerId: PROVIDER_ID3,
    candidateId: value.candidateId,
    source: value.source,
    accountId: value.accountId,
    displayName: value.displayName,
    email: value.email,
    subscription: { ...value.subscription },
    refresh: { ...value.refresh },
    resources: { ...value.resources },
    imported: Boolean(value.imported),
    status: value.status ?? "available",
    diagnostic: value.diagnostic ?? null
  };
}
var ANTIGRAVITY_AUTH_URL_PATTERN = /https:\/\/accounts\.google\.com\/o\/oauth2\/(?:v2\/)?auth\?[^\s"'<>]+/i;
function cleanAntigravityAuthUrl(value) {
  return String(value ?? "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[),.;]+$/, "");
}
function publicAntigravityAuthSession(session) {
  return {
    sessionId: session.sessionId,
    providerId: PROVIDER_ID3,
    status: session.status ?? (session.exitCode === null ? "pending" : "processing"),
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    ...session.browserOpened ? { browserOpened: true } : {},
    ...session.inputRequired ? { inputRequired: true } : {},
    diagnostic: session.diagnostic ?? null
  };
}
function createAntigravityOAuthAuthorizer({
  cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
  environment = process.env,
  home = homedir5(),
  timeoutMs = DEFAULT_AUTH_TIMEOUT_MS,
  prompt = "Reply with OK",
  spawnImpl = spawn4,
  tokenReader = readAntigravityTokenFile,
  usePty = process.platform === "darwin",
  ptyPythonPath = process.env.DOCKYARD_ANTIGRAVITY_PTY_PYTHON || "python3",
  instructions = "\u5DF2\u6253\u5F00 Google \u5B98\u65B9\u9A8C\u8BC1\u9875\uFF1B\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u9A8C\u8BC1\u540E\uFF0CDSH \u4F1A\u81EA\u52A8\u63A5\u5165\u3002"
} = {}) {
  const resolvedCliPath = resolveAgyCliPath(cliPath, { env: environment, home });
  if (!resolvedCliPath) throw new Error("Antigravity OAuth authorizer requires an agy CLI path");
  if (typeof spawnImpl !== "function") throw new Error("Antigravity OAuth authorizer requires a process spawner");
  if (typeof tokenReader !== "function") throw new Error("Antigravity OAuth authorizer requires a token reader");
  const sessions = /* @__PURE__ */ new Map();
  async function cleanup(session) {
    if (!session.profileDir) return;
    await rm3(session.profileDir, { recursive: true, force: true }).catch(() => {
    });
    session.profileDir = null;
  }
  function capture(session, chunk) {
    session.output = `${session.output}${String(chunk ?? "")}`.slice(-32e3);
    if (!session.authorizationUrl) {
      const match = session.output.match(ANTIGRAVITY_AUTH_URL_PATTERN);
      if (match?.[0]) session.authorizationUrl = cleanAntigravityAuthUrl(match[0]);
    }
    if (/authorization code|redirect URL/i.test(session.output)) session.inputRequired = true;
  }
  function readToken(session) {
    try {
      return tokenReader({ env: session.childEnv, home: session.profileDir });
    } catch {
      return null;
    }
  }
  async function finalize(session, context, credential = null) {
    if (session.result) return session.result;
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        const auth = credential ?? readToken(session);
        if (!auth?.token) {
          if (session.exitCode === null) return publicAntigravityAuthSession(session);
          session.status = "failed";
          session.diagnostic = session.timedOut ? "Google \u9A8C\u8BC1\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002" : session.launchError ? `\u65E0\u6CD5\u542F\u52A8 agy \u5B98\u65B9\u9A8C\u8BC1\uFF1A${session.launchError}` : `agy \u5B98\u65B9\u9A8C\u8BC1\u672A\u5B8C\u6210\uFF08\u9000\u51FA\u7801 ${session.exitCode ?? "unknown"}\uFF09\u3002`;
          return publicAntigravityAuthSession(session);
        }
        if (session.child && session.exitCode === null) session.child.kill("SIGTERM");
        const account = candidate(context?.now instanceof Date ? context.now : /* @__PURE__ */ new Date(), {
          email: extractAntigravityAccountEmail(session.output),
          session: auth,
          existingAccounts: context?.accounts ?? [],
          // agy's isolated temporary profile is a browser OAuth session, not
          // the user's active local CLI session. Mark it accordingly so quota
          // refresh and request execution use the captured credential instead
          // of rejecting it as a session mismatch. Its refresh token belongs
          // to agy's own OAuth client, so DSH must not exchange it with an
          // unrelated/empty browser client.
          source: "official_antigravity_browser_oauth",
          sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
          credentialRefreshMode: ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION
        });
        session.status = "completed";
        session.result = {
          ...publicAntigravityAuthSession(session),
          status: "completed",
          accounts: [account],
          diagnostic: null
        };
        return session.result;
      } catch (error) {
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicAntigravityAuthSession(session);
      } finally {
        if (session.status === "completed" || session.status === "failed") {
          if (session.timer) clearTimeout(session.timer);
          await cleanup(session);
        }
      }
    })();
    return session.finalizing;
  }
  async function begin() {
    const profileDir = await mkdtemp2(join8(tmpdir2(), "dockyard-antigravity-oauth-"));
    const tokenPath = join8(profileDir, ".gemini", "antigravity-cli", "antigravity-oauth-token");
    const childEnv = {
      ...environment,
      HOME: profileDir,
      XDG_CONFIG_HOME: join8(profileDir, ".config"),
      DOCKYARD_ANTIGRAVITY_TOKEN_FILE: tokenPath,
      [AGY_FILE_STORAGE_ENV]: "true"
    };
    childEnv.PATH = augmentPathWithUserBins(childEnv, home);
    delete childEnv.AGY_CLI_HIDE_ACCOUNT_INFO;
    const session = {
      sessionId: `${PROVIDER_ID3}:${randomUUID4()}`,
      providerId: PROVIDER_ID3,
      profileDir,
      childEnv,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      // agy owns the official browser OAuth flow and opens this URL itself.
      // The DSH host must not open the captured URL a second time.
      browserOpened: true,
      exitCode: null,
      launchError: null,
      output: "",
      inputRequired: false,
      timedOut: false,
      child: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null
    };
    sessions.set(session.sessionId, session);
    try {
      const command = usePty ? ptyPythonPath : resolvedCliPath;
      const args = usePty ? ["-u", "-c", ANTIGRAVITY_PTY_SCRIPT, resolvedCliPath, "-p", prompt, "--output-format", "json"] : ["-p", prompt, "--output-format", "json"];
      const child = spawnImpl(command, args, {
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => capture(session, chunk));
      child.stderr?.on("data", (chunk) => capture(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => {
        session.exitCode = typeof code === "number" ? code : -1;
      });
      session.timer = setTimeout(() => {
        if (session.exitCode !== null) return;
        session.timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.launchError = redactError(error);
      session.exitCode = -1;
    }
    return publicAntigravityAuthSession(session);
  }
  async function poll(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        providerId: PROVIDER_ID3,
        status: "missing",
        instructions,
        diagnostic: "\u9A8C\u8BC1\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002"
      };
    }
    if (session.result) return session.result;
    const credential = readToken(session);
    if (!credential?.token && session.exitCode === null) return publicAntigravityAuthSession(session);
    const result = await finalize(session, context, credential);
    if (!["pending", "processing"].includes(result.status)) sessions.delete(sessionId);
    return result;
  }
  async function submitAuthorizationCode(sessionId, value) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error("\u9A8C\u8BC1\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7");
    const code = String(value ?? "").trim();
    if (!code) throw new Error("\u8BF7\u8F93\u5165 Google \u9A8C\u8BC1\u7801\u6216\u56DE\u8C03\u5730\u5740");
    if (code.length > 4096 || /[\u0000-\u001f\u007f]/.test(code)) {
      throw new Error("Google \u9A8C\u8BC1\u7801\u6216\u56DE\u8C03\u5730\u5740\u683C\u5F0F\u65E0\u6548");
    }
    if (!session.child || session.exitCode !== null || !session.child.stdin?.writable) {
      throw new Error("agy \u9A8C\u8BC1\u8FDB\u7A0B\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7");
    }
    session.child.stdin.write(`${code}
`);
    session.inputRequired = false;
    session.status = "processing";
    session.instructions = "\u6388\u6743\u7801\u5DF2\u63D0\u4EA4\uFF0C\u6B63\u5728\u7B49\u5F85\u5B98\u65B9\u767B\u5F55\u5B8C\u6210\u3002";
    return publicAntigravityAuthSession(session);
  }
  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId: PROVIDER_ID3, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    if (session.child && session.exitCode === null) session.child.kill("SIGTERM");
    await cleanup(session);
    sessions.delete(sessionId);
    return { sessionId, providerId: PROVIDER_ID3, status: "cancelled" };
  }
  return Object.freeze({ begin, poll, cancel, submitAuthorizationCode });
}
var AntigravityOfficialSessionDriver = class {
  constructor({
    cliPath = process.env.DOCKYARD_ANTIGRAVITY_CLI || DEFAULT_CLI,
    env = process.env,
    home = homedir5(),
    cacheFilePath,
    timeoutMs = 3e4,
    commandRunner = runCommand,
    ptyPythonPath = process.env.DOCKYARD_ANTIGRAVITY_PTY_PYTHON || "python3",
    // Background refresh is a non-interactive `agy models` call. The PTY is
    // only needed for the browser bootstrap authorizer; wrapping this refresh
    // in a PTY makes agy report a false exit-code failure on macOS.
    usePtyForSessionRefresh = false,
    requestExecutor = null,
    catalogLoader = null,
    quotaReader = null,
    tokenResolver = resolveAntigravityAccessToken,
    identityFromOfficialCli = true,
    identityFromOfficialSession = identityFromOfficialCli,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_ANTIGRAVITY_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL || ANTIGRAVITY_BROWSER_AUTHORIZATION_URL,
    tokenUrl = env.DOCKYARD_ANTIGRAVITY_TOKEN_URL || ANTIGRAVITY_BROWSER_TOKEN_URL,
    userInfoUrl = env.DOCKYARD_ANTIGRAVITY_USERINFO_URL || ANTIGRAVITY_BROWSER_USERINFO_URL,
    clientId = env.DOCKYARD_ANTIGRAVITY_DISABLE_BROWSER === "1" ? "" : env.DOCKYARD_ANTIGRAVITY_CLIENT_ID || ANTIGRAVITY_BROWSER_CLIENT_ID,
    clientSecret = env.DOCKYARD_ANTIGRAVITY_DISABLE_BROWSER === "1" ? "" : env.DOCKYARD_ANTIGRAVITY_CLIENT_SECRET || ANTIGRAVITY_BROWSER_CLIENT_SECRET,
    oauthScope = env.DOCKYARD_ANTIGRAVITY_OAUTH_SCOPE || ANTIGRAVITY_BROWSER_SCOPES,
    redirectUri = env.DOCKYARD_ANTIGRAVITY_REDIRECT_URI || ANTIGRAVITY_BROWSER_REDIRECT_URI,
    fetchImpl = fetch,
    authorizationTimeoutMs = DEFAULT_AUTH_TIMEOUT_MS
  } = {}) {
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_ANTIGRAVITY_AUTHORIZATION_URL");
    const resolvedCli = resolveAgyCliPath(cliPath, { env, home });
    this.cliPath = resolvedCli;
    this.env = env;
    this.home = home;
    this.timeoutMs = timeoutMs;
    this.commandRunner = commandRunner;
    this.ptyPythonPath = ptyPythonPath;
    this.usePtyForSessionRefresh = usePtyForSessionRefresh;
    this.fetchImpl = fetchImpl;
    this.browserTokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_ANTIGRAVITY_TOKEN_URL");
    this.browserUserInfoUrl = userInfoUrl ? assertSecureEndpointUrl(userInfoUrl, "DOCKYARD_ANTIGRAVITY_USERINFO_URL") : userInfoUrl;
    this.browserClientId = clientId;
    this.browserClientSecret = clientSecret;
    this.hasExplicitBrowserClient = Boolean(clientId && clientSecret);
    this.requestExecutor = requestExecutor;
    this.quotaReader = quotaReader;
    this.tokenResolver = tokenResolver;
    this.identityFromOfficialSession = identityFromOfficialSession;
    this.cliOAuthAuthorizer = createAntigravityOAuthAuthorizer({
      cliPath: resolvedCli,
      environment: env,
      home,
      timeoutMs: authorizationTimeoutMs
    });
    const browserOAuthConfigured = Boolean(clientId && clientSecret);
    this.hasExplicitBrowserClient = browserOAuthConfigured;
    this.createBrowserAuthorizer = (resolvedId, resolvedSecret) => browserAuthorizer ?? (browserOAuth && resolvedId && resolvedSecret ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID3,
      redirectUri,
      callbackPath: new URL(redirectUri).pathname,
      callbackHost: new URL(redirectUri).hostname,
      callbackPort: Number(new URL(redirectUri).port || 51121),
      instructions: "\u8BF7\u5728 Google \u5B98\u65B9\u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF1B\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u8FD4\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: ({ state, codeChallenge, redirectUri: callback }) => `${authorizationUrl}?${new URLSearchParams({
        access_type: "offline",
        client_id: resolvedId,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account consent",
        redirect_uri: callback,
        response_type: "code",
        scope: oauthScope,
        state
      })}`,
      exchangeCode: async ({ code, codeVerifier, redirectUri: redirectUri2, context }) => {
        const response = await this.fetchImpl(tokenUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: resolvedSecret,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri2
          }),
          ...context.signal ? { signal: context.signal } : {}
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.access_token) {
          const reason = typeof body?.error === "string" ? ` ${body.error}${typeof body.error_description === "string" ? `: ${body.error_description}` : ""}` : "";
          throw new Error(`Antigravity Google token exchange failed (${response.status})${reason}`);
        }
        return body;
      },
      importCredentials: async (tokens, context) => {
        const access2 = tokens?.access_token ?? tokens?.accessToken;
        const refresh = tokens?.refresh_token ?? tokens?.refreshToken;
        if (!access2) throw new Error("Antigravity Google OAuth did not return an access token");
        let profile = null;
        if (tokens?.id_token || tokens?.idToken) {
          try {
            profile = decodeJwtPayload(tokens.id_token || tokens.idToken);
          } catch {
          }
        }
        if (!profile?.email) {
          try {
            const response = await this.fetchImpl(userInfoUrl, {
              headers: { authorization: `Bearer ${access2}` },
              ...context.signal ? { signal: context.signal } : {}
            });
            if (response.ok) profile = await response.json().catch(() => null);
          } catch {
          }
        }
        const email = profile?.email ?? extractAntigravityAccountEmail(tokens);
        const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
        const candidateValue = candidate(now, {
          email,
          session: {
            token: access2,
            refreshToken: refresh,
            expiresAt: tokenExpiresAt(tokens, now),
            lastRefreshedAt: now.toISOString(),
            ...email ? { email } : {}
          },
          existingAccounts: context.accounts ?? [],
          source: "official_antigravity_browser_oauth",
          sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
          credentialRefreshMode: ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.DSH_BROWSER_OAUTH
        });
        return [await this.importAccount(candidateValue, context)];
      }
    }) : null);
    this.browserAuthorizer = clientId && clientSecret ? this.createBrowserAuthorizer(clientId, clientSecret) : null;
    this.injectedOauthAuthorizer = oauthAuthorizer ?? null;
    this.oauthAuthorizer = this.injectedOauthAuthorizer ?? this.browserAuthorizer ?? this.cliOAuthAuthorizer;
    this.catalogLoader = catalogLoader ?? createAntigravityCatalogLoader({
      cliPath: resolvedCli,
      env,
      home,
      ...cacheFilePath !== void 0 ? { cacheFilePath } : {},
      timeoutMs,
      commandRunner
    });
  }
  async #slash(command, signal) {
    const result = await this.commandRunner(this.cliPath, ["-p", command, "--output-format", "json"], {
      env: this.env,
      timeoutMs: this.timeoutMs,
      includeAccountInfo: true,
      ...signal ? { signal } : {}
    });
    const parsed = parseJsonOutput2(result.output);
    return { ...result, parsed };
  }
  async #resolveSessionEmail(session, context = {}) {
    const direct = extractAntigravityAccountEmail(session);
    if (direct) return direct;
    if (!session?.token || typeof this.fetchImpl !== "function" || !this.browserUserInfoUrl) return null;
    try {
      const response = await this.fetchImpl(this.browserUserInfoUrl, {
        headers: { authorization: `Bearer ${session.token}` },
        ...context.signal ? { signal: context.signal } : {}
      });
      if (!response?.ok) return null;
      return extractAntigravityAccountEmail(await response.json().catch(() => null));
    } catch {
      return null;
    }
  }
  async #assertActiveSession(account, context = {}) {
    if (!isOfficialSessionAuthKind(account?.auth?.kind)) return;
    if (account.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return;
    const expectedFingerprint = account.resources?.sessionFingerprint;
    if (expectedFingerprint) {
      let current;
      try {
        current = await this.tokenResolver({ env: this.env });
      } catch {
        throw activeSessionError("Antigravity OAuth session is unavailable; authorize again");
      }
      if (!current?.token || sessionFingerprint(current) !== expectedFingerprint) {
        if (current?.token && context.allowSessionTokenRotation === true) return;
        const currentEmail = await this.#resolveSessionEmail(current, context);
        if (currentEmail && account.email && sameEmail(currentEmail, account.email)) return;
        throw activeSessionError(
          "Antigravity selected account is not the active local session; authorize it again",
          { mismatch: true }
        );
      }
      return;
    }
    if (account.accountId === "antigravity:active" && !account.email) return;
    let result;
    try {
      result = await this.#slash("/quota", context.signal);
    } catch {
      throw activeSessionError("Antigravity active session could not be verified; authorize again");
    }
    const email = extractAntigravityAccountEmail(result.parsed, result.output, result.errorOutput);
    if (account.email && email && sameEmail(account.email, email)) return;
    throw activeSessionError(
      "Antigravity selected account is not the active local session; authorize it again",
      { mismatch: true }
    );
  }
  async #refreshOfficialCredential(account, context = {}) {
    if (account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return null;
    if (typeof this.tokenResolver !== "function") return null;
    let current;
    try {
      current = await this.tokenResolver({ env: this.env });
    } catch (error) {
      const wrapped = activeSessionError(`Antigravity official session could not be read: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
    if (!current?.token) return null;
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const credential = {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID3,
      access: current.token,
      ...current.refreshToken ? { refresh: current.refreshToken } : {},
      ...current.expiresAt ? { expiresAt: current.expiresAt } : {}
    };
    const rotated = current.source === "antigravity_keychain" && Boolean(account?.resources?.sessionFingerprint) && sessionFingerprint(current) !== account.resources?.sessionFingerprint;
    if (!tokenNeedsRefresh(credential, now)) {
      const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
      if (current.source === "antigravity_keychain" && credentialRef && typeof context.secretStore?.write === "function") {
        await context.secretStore.write(credentialRef, credential);
      }
      return { session: current, credential, rotated };
    }
    if (!current.refreshToken) {
      throw activeSessionError("Antigravity official session has expired; authorize again");
    }
    const officialTokenPath = officialAntigravityTokenPath(this.env);
    const officialHome = this.env.HOME || homedir5();
    const childEnv = agyRefreshEnvironment(this.env, officialTokenPath);
    try {
      await mkdir3(dirname7(officialTokenPath), { recursive: true, mode: 448 });
      const refreshCommand = this.usePtyForSessionRefresh ? this.ptyPythonPath : this.cliPath;
      const refreshArgs = this.usePtyForSessionRefresh ? ["-u", "-c", ANTIGRAVITY_PTY_SCRIPT, this.cliPath, "models"] : ["models"];
      await this.commandRunner(refreshCommand, refreshArgs, {
        env: childEnv,
        timeoutMs: this.timeoutMs,
        signal: context.signal
      });
      let refreshed = null;
      try {
        refreshed = await this.tokenResolver({ env: this.env });
      } catch {
      }
      refreshed = refreshed?.token ? refreshed : readAntigravityTokenFile({ env: childEnv, home: officialHome });
      if (!refreshed?.token) throw new Error("agy did not persist a refreshed OAuth token");
      const nextCredential = {
        ...credential,
        access: refreshed.token,
        ...refreshed.refreshToken ? { refresh: refreshed.refreshToken } : {},
        ...refreshed.expiresAt ? { expiresAt: refreshed.expiresAt } : {},
        lastRefreshedAt: now.toISOString()
      };
      const expiry = nextCredential.expiresAt ? Date.parse(nextCredential.expiresAt) : Number.NaN;
      const expiryAdvanced = Number.isFinite(expiry) && expiry > now.getTime() + 6e4;
      if (nextCredential.access === credential.access && !expiryAdvanced) {
        throw new Error("agy did not advance the Antigravity OAuth token expiry");
      }
      await mkdir3(dirname7(officialTokenPath), { recursive: true, mode: 448 });
      const persistedPath = `${officialTokenPath}.${randomUUID4()}.tmp`;
      try {
        await writeFile2(persistedPath, JSON.stringify({
          auth_method: "consumer",
          token: {
            access_token: nextCredential.access,
            refresh_token: nextCredential.refresh,
            token_type: "Bearer",
            ...nextCredential.expiresAt ? { expiry: nextCredential.expiresAt } : {}
          }
        }), { encoding: "utf8", mode: 384 });
        await rename2(persistedPath, officialTokenPath);
      } finally {
        await rm3(persistedPath, { force: true }).catch(() => {
        });
      }
      const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
      if (credentialRef && typeof context.secretStore?.write === "function") {
        await context.secretStore.write(credentialRef, nextCredential);
      }
      return { session: refreshed, credential: nextCredential, rotated: true };
    } catch (error) {
      if (error?.authExpired) throw error;
      const wrapped = activeSessionError(`Antigravity official session refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }
  async #refreshAgyCredential(credential, context = {}) {
    if (!credential?.refresh) {
      throw activeSessionError("Antigravity agy session has no refresh token; authorize again");
    }
    const tokenPath = officialAntigravityTokenPath(this.env);
    const officialHome = this.env.HOME || homedir5();
    const childEnv = agyRefreshEnvironment(this.env, tokenPath);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    try {
      await mkdir3(dirname7(tokenPath), { recursive: true, mode: 448 });
      if (!readAntigravityTokenFile({ env: childEnv, home: officialHome })?.token) {
        await writeFile2(tokenPath, JSON.stringify({
          auth_method: "consumer",
          token: {
            access_token: credential.access,
            refresh_token: credential.refresh,
            token_type: "Bearer",
            ...credential.expiresAt ? { expiry: credential.expiresAt } : {}
          }
        }), { encoding: "utf8", mode: 384 });
      }
      await this.commandRunner(this.cliPath, ["models"], {
        env: childEnv,
        timeoutMs: this.timeoutMs,
        signal: context.signal
      });
      let refreshed = null;
      try {
        refreshed = await this.tokenResolver({ env: this.env });
      } catch {
      }
      refreshed = refreshed?.token ? refreshed : readAntigravityTokenFile({ env: childEnv, home: officialHome });
      if (!refreshed?.token) {
        throw new Error("agy did not persist a refreshed OAuth token");
      }
      const next = {
        ...credential,
        access: refreshed.token,
        ...refreshed.refreshToken ? { refresh: refreshed.refreshToken } : {},
        ...refreshed.expiresAt ? { expiresAt: refreshed.expiresAt } : {},
        lastRefreshedAt: now.toISOString()
      };
      const accessChanged = next.access !== credential.access;
      const expiry = next.expiresAt ? Date.parse(next.expiresAt) : Number.NaN;
      const expiryAdvanced = Number.isFinite(expiry) && expiry > now.getTime() + 6e4;
      if (!accessChanged && !expiryAdvanced) {
        throw new Error("agy did not advance the Antigravity OAuth token expiry");
      }
      return next;
    } catch (error) {
      if (error?.authExpired) throw error;
      const wrapped = activeSessionError(`Antigravity agy session refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }
  async #refreshBrowserCredential(account, context = {}) {
    if (account?.resources?.sessionSource !== OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) return null;
    await this.ensureBrowserAuthorizer().catch(() => null);
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
    if (!credentialRef || typeof context.secretStore?.read !== "function") {
      throw activeSessionError("Antigravity browser OAuth credential is unavailable; authorize again");
    }
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) {
      throw activeSessionError("Antigravity browser OAuth credential is missing; authorize again");
    }
    const refreshMode = credentialRefreshMode(account, {
      hasExplicitBrowserClient: Boolean(this.hasExplicitBrowserClient)
    });
    const useAgyCliRefresh = refreshMode === ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION && (this.commandRunner !== runCommand || !this.browserClientId || !this.browserClientSecret);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    if (useAgyCliRefresh) {
      if (!tokenNeedsRefresh(credential, now)) return credential;
      const updated2 = await this.#refreshAgyCredential(credential, context);
      await context.secretStore.write(credentialRef, updated2);
      return updated2;
    }
    if (!this.browserClientId || !this.browserClientSecret) return credential;
    if (!tokenNeedsRefresh(credential, now)) return credential;
    if (!credential.refresh) {
      throw activeSessionError("Antigravity browser OAuth token expired; authorize again");
    }
    let response;
    try {
      response = await this.fetchImpl(this.browserTokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.browserClientId,
          client_secret: this.browserClientSecret,
          grant_type: "refresh_token",
          refresh_token: credential.refresh
        }),
        ...context.signal ? { signal: context.signal } : {}
      });
    } catch (error) {
      const wrapped = activeSessionError(`Antigravity Google OAuth refresh failed: ${redactError(error)}`);
      wrapped.cause = error;
      throw wrapped;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      const error = activeSessionError("Antigravity Google OAuth refresh failed; authorize again");
      error.status = response.status;
      throw error;
    }
    const updated = {
      ...credential,
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      expiresAt: tokenExpiresAt(body, now) ?? credential.expiresAt ?? null,
      lastRefreshedAt: now.toISOString()
    };
    await context.secretStore.write(credentialRef, updated);
    return updated;
  }
  async #nativeQuota(account, context, now) {
    if (typeof this.quotaReader !== "function") return null;
    let credential = null;
    const credentialRef = account?.auth?.credentialRef;
    if (context.browserCredential) {
      credential = context.browserCredential;
    } else if (account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER) {
      credential = await this.#refreshBrowserCredential(account, context);
    } else if (context.officialCredential) {
      credential = context.officialCredential;
    } else if (credentialRef && context.secretStore && typeof context.secretStore.read === "function") {
      credential = await context.secretStore.read(credentialRef);
    }
    const value = await this.quotaReader({ account, credential, context });
    const parsed = parseAntigravityNativeQuota(value, now);
    if (parsed.windows.length === 0 && !parsed.credits) return null;
    return parsed;
  }
  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    try {
      let session = null;
      try {
        session = typeof this.tokenResolver === "function" ? await this.tokenResolver({ env: this.env }) : null;
      } catch {
      }
      let windows = [];
      let source = "official_antigravity_cli";
      try {
        const native = await this.#nativeQuota(null, context, now);
        windows = native?.windows ?? [];
        if (windows.length > 0) source = "antigravity_native";
      } catch {
      }
      let result = null;
      let cliIdentityError = null;
      if (windows.length === 0 || this.identityFromOfficialSession) {
        try {
          result = await this.#slash("/quota", context.signal);
          const data = result.parsed?.command?.data;
          if (windows.length === 0) {
            windows = parseQuotaData(data, now);
            if (windows.length === 0) windows = parseQuotaText(result.parsed?.response ?? "", now);
          }
        } catch (error) {
          cliIdentityError = error;
          if (windows.length === 0) throw error;
        }
      }
      const email = extractAntigravityAccountEmail(
        result?.parsed,
        result?.output,
        result?.errorOutput
      ) ?? await this.#resolveSessionEmail(session, context);
      const found = candidate(now, {
        email,
        session,
        existingAccounts: context.accounts ?? [],
        source,
        sourceKind: source === "antigravity_native" ? session?.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE : OFFICIAL_SESSION_SOURCE_KINDS.CLI
      });
      found.status = windows.length ? "available" : "degraded";
      found.diagnostic = windows.length ? null : source === "antigravity_native" ? "\u5B98\u65B9\u4F1A\u8BDD\u5DF2\u8BFB\u53D6\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u7ED3\u6784\u5316 quota \u7A97\u53E3" : "\u5B98\u65B9 CLI \u5DF2\u542F\u52A8\uFF0C\u4F46\u6CA1\u6709\u8FD4\u56DE\u7ED3\u6784\u5316 quota \u7A97\u53E3";
      return {
        candidates: [found],
        source,
        diagnostics: [
          ...result?.parsed?.status === "SUCCESS" || !result ? [] : ["Antigravity CLI \u8FD4\u56DE\u4E86\u975E\u6210\u529F\u72B6\u6001"],
          ...cliIdentityError && windows.length ? ["\u5B98\u65B9 CLI \u8D26\u53F7\u8EAB\u4EFD\u6682\u672A\u8FD4\u56DE\uFF1B\u5DF2\u4F7F\u7528\u672C\u5730\u4F1A\u8BDD\u6807\u8BC6"] : []
        ]
      };
    } catch (error) {
      return {
        candidates: [],
        source: "official_antigravity_cli",
        diagnostics: [`\u65E0\u6CD5\u8BFB\u53D6 Antigravity \u5B98\u65B9\u4F1A\u8BDD\uFF1A${redactError(error)}`]
      };
    }
  }
  async importAccount(value, context = {}) {
    const session = value?.[CREDENTIAL_SLOT2];
    if (!session) throw new Error("Antigravity candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(value.credentialRef, session);
    return {
      providerId: PROVIDER_ID3,
      accountId: value.accountId,
      credentialRef: value.credentialRef,
      displayName: value.displayName,
      email: value.email ?? null,
      auth: { kind: OFFICIAL_SESSION_AUTH_KIND, scopes: [] },
      subscription: { plan: null, status: null, expiresAt: null },
      refresh: {
        accessTokenExpiresAt: session.expiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: session.lastRefreshedAt ?? null,
        refreshable: session.refresh ? true : null
      },
      resources: {
        ...officialSessionResources({
          sourceKind: value.resources?.sessionSource ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
          authSource: value.source ?? "official_antigravity_cli_session"
        }),
        transport: "gemini_stream_generate_content_sse",
        quotaSource: value.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP ? "official_client_status" : value.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER ? "antigravity_browser_oauth" : "antigravity_cli_status",
        ...value.resources ?? {}
      }
    };
  }
  async getActiveSession(context = {}) {
    try {
      const discovered = await this.discover(context);
      const candidateValue = discovered?.candidates?.[0];
      if (!candidateValue) return null;
      const account = await this.importAccount(candidateValue, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID3,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Antigravity \u5B98\u65B9\u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts: [account],
        diagnostic: null
      };
    } catch (error) {
      return {
        status: "failed",
        providerId: PROVIDER_ID3,
        instructions: "\u672A\u80FD\u8BFB\u53D6 Antigravity \u5B98\u65B9\u4F1A\u8BDD\uFF0C\u8BF7\u91CD\u65B0\u626B\u63CF\u6216\u767B\u5F55\u3002",
        accounts: [],
        diagnostic: redactError(error)
      };
    }
  }
  /**
   * Browser OAuth needs a Google client secret. The operator may configure one,
   * otherwise it is read from the official Antigravity build installed on this
   * machine and cached locally — never committed to the repository.
   *
   * @returns {Promise<object|null>} The authorizer, or null when none can exist.
   */
  async ensureBrowserAuthorizer() {
    if (this.browserAuthorizer) return this.browserAuthorizer;
    if (this.browserAuthorizerPromise) return this.browserAuthorizerPromise;
    this.browserAuthorizerPromise = (async () => {
      const clientId = this.browserClientId;
      if (!clientId) return null;
      let secret = this.browserClientSecret;
      if (!secret) {
        secret = await resolveAntigravityClientSecret({ clientId });
        if (!secret) return null;
        this.browserClientSecret = secret;
      }
      this.hasExplicitBrowserClient = true;
      this.browserAuthorizer = this.createBrowserAuthorizer(clientId, secret);
      return this.browserAuthorizer;
    })().finally(() => {
      this.browserAuthorizerPromise = null;
    });
    return this.browserAuthorizerPromise;
  }
  async startAuthorization(context = {}) {
    if (this.injectedOauthAuthorizer) return this.injectedOauthAuthorizer.begin(context);
    await this.ensureBrowserAuthorizer().catch(() => null);
    if (!this.browserAuthorizer) {
      return {
        status: "unsupported",
        providerId: PROVIDER_ID3,
        instructions: "Antigravity \u6D4F\u89C8\u5668\u6388\u6743\u9700\u8981\u4E00\u4E2A Google OAuth client\u3002\u8BF7\u5B89\u88C5\u5B98\u65B9 Antigravity \u684C\u9762\u7AEF\uFF08\u63D2\u4EF6\u4F1A\u76F4\u63A5\u4F7F\u7528\u5B83\u81EA\u5E26\u7684\u5BA2\u6237\u7AEF\uFF09\uFF0C\u6216\u8BBE\u7F6E DOCKYARD_ANTIGRAVITY_CLIENT_ID \u4E0E DOCKYARD_ANTIGRAVITY_CLIENT_SECRET\u3002"
      };
    }
    return this.browserAuthorizer.begin(context);
  }
  #authorizationAuthorizer(sessionId) {
    if (sessionId?.includes(":browser:")) return this.browserAuthorizer;
    return this.oauthAuthorizer === this.browserAuthorizer ? this.cliOAuthAuthorizer : this.oauthAuthorizer;
  }
  async pollAuthorization(sessionId, context = {}) {
    return this.#authorizationAuthorizer(sessionId).poll(sessionId, context);
  }
  async submitAuthorizationCode(sessionId, code, context = {}) {
    return this.#authorizationAuthorizer(sessionId).submitAuthorizationCode(sessionId, code, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    return this.#authorizationAuthorizer(sessionId).cancel(sessionId, context);
  }
  async refreshAccount(account, context = {}) {
    const browserCredential = await this.#refreshBrowserCredential(account, context);
    const officialCredential = await this.#refreshOfficialCredential(account, context);
    await this.#assertActiveSession(account, {
      ...context,
      ...officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}
    });
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const isBrowserAccount = account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER;
    const isTestAgyMock = isBrowserAccount && credentialRefreshMode(account, {
      hasExplicitBrowserClient: Boolean(this.hasExplicitBrowserClient)
    }) === ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION && this.commandRunner !== runCommand;
    let session = officialCredential?.session ?? (browserCredential && !isTestAgyMock ? {
      token: browserCredential.access,
      refreshToken: browserCredential.refresh,
      expiresAt: browserCredential.expiresAt,
      email: browserCredential.email ?? null
    } : null);
    if (!session && !isBrowserAccount) {
      try {
        session = await this.tokenResolver({ env: this.env });
      } catch {
      }
    }
    const sessionEmail = await this.#resolveSessionEmail(session, context) ?? normalizeEmail(account?.email);
    if (sessionEmail && browserCredential && !browserCredential.email) {
      const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
      if (credentialRef && typeof context.secretStore?.write === "function") {
        await context.secretStore.write(credentialRef, { ...browserCredential, email: sessionEmail }).catch(() => {
        });
      }
    }
    const fingerprint = sessionFingerprint(sessionEmail && session && !session.email ? { ...session, email: sessionEmail } : session);
    const fingerprintResources = {
      ...fingerprint ? { sessionFingerprint: fingerprint } : {},
      ...sessionEmail ? {
        identitySource: "official_cli_auth_status",
        identityLabel: sessionEmail,
        identityNote: "\u8D26\u53F7\u90AE\u7BB1\u6765\u81EA\u5B98\u65B9 Antigravity \u767B\u5F55\u6001"
      } : {}
    };
    const persistedRefreshMode = isBrowserAccount ? credentialRefreshMode(account, {
      hasExplicitBrowserClient: Boolean(this.hasExplicitBrowserClient)
    }) ?? (!this.browserClientId || !this.browserClientSecret ? ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.AGY_SESSION : ANTIGRAVITY_CREDENTIAL_REFRESH_MODES.DSH_BROWSER_OAUTH) : null;
    const shouldUpdateDisplayName = Boolean(
      sessionEmail && (!account?.displayName || account.displayName.startsWith("Antigravity \u5B98\u65B9") || account.displayName === account.accountId)
    );
    const identityPatch = {
      ...sessionEmail ? { email: sessionEmail } : {},
      ...shouldUpdateDisplayName ? { displayName: sessionEmail } : {}
    };
    let nativeError = null;
    try {
      const native = await this.#nativeQuota(account, {
        ...context,
        ...browserCredential ? { browserCredential } : {},
        ...officialCredential?.credential ? { officialCredential: officialCredential.credential } : {}
      }, now);
      if (native) {
        const primary2 = selectPrimaryQuotaWindow(native.windows);
        return {
          ...identityPatch,
          subscription: {
            plan: account?.subscription?.plan ?? "Google Code Assist",
            status: "active",
            expiresAt: account?.subscription?.expiresAt ?? null
          },
          quota: {
            ...primary2,
            windows: native.windows,
            updatedAt: now.toISOString(),
            source: "antigravity_native"
          },
          credits: native.credits,
          resources: {
            quotaSource: "antigravity_native",
            ...persistedRefreshMode ? { credentialRefreshMode: persistedRefreshMode } : {},
            ...fingerprintResources
          },
          refresh: {
            accessTokenExpiresAt: browserCredential?.expiresAt ?? officialCredential?.credential?.expiresAt ?? account.refresh?.accessTokenExpiresAt ?? null,
            nextRefreshAt: null,
            lastRefreshedAt: browserCredential?.lastRefreshedAt ?? account.refresh?.lastRefreshedAt ?? now.toISOString(),
            refreshable: browserCredential ? Boolean(browserCredential.refresh) : officialCredential?.credential ? Boolean(officialCredential.credential.refresh) : account.refresh?.refreshable ?? null
          }
        };
      }
    } catch (error) {
      nativeError = error;
    }
    if (isBrowserAccount || account?.auth?.credentialRef) {
      throw nativeError ?? new Error("Antigravity native quota did not return data for the selected account");
    }
    const [result, creditsResult] = await Promise.all([
      this.#slash("/quota", context.signal),
      this.#slash("/credits", context.signal).catch(() => null)
    ]);
    if (result.parsed?.status && result.parsed.status !== "SUCCESS") {
      throw new Error("Antigravity official quota command did not complete");
    }
    const windows = parseQuotaData(result.parsed?.command?.data, now);
    const fallbackWindows = windows.length ? windows : parseQuotaText(result.parsed?.response ?? "", now);
    const primary = selectPrimaryQuotaWindow(fallbackWindows);
    return {
      ...identityPatch,
      quota: {
        ...primary,
        windows: fallbackWindows,
        updatedAt: now.toISOString(),
        source: "antigravity_cli"
      },
      credits: creditsFromData(creditsResult?.parsed?.command?.data),
      resources: fingerprintResources,
      refresh: {
        accessTokenExpiresAt: null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: null
      }
    };
  }
  async getQuota(account, context = {}) {
    const browserCredential = await this.#refreshBrowserCredential(account, context);
    const officialCredential = await this.#refreshOfficialCredential(account, context);
    await this.#assertActiveSession(account, {
      ...context,
      ...officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}
    });
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    let nativeError = null;
    try {
      const native = await this.#nativeQuota(account, {
        ...context,
        ...browserCredential ? { browserCredential } : {},
        ...officialCredential?.credential ? { officialCredential: officialCredential.credential } : {}
      }, now);
      if (native) {
        const primary2 = selectPrimaryQuotaWindow(native.windows);
        return {
          quota: {
            ...primary2,
            windows: native.windows,
            updatedAt: now.toISOString(),
            source: "antigravity_native"
          },
          credits: native.credits,
          resources: { quotaSource: "antigravity_native" },
          refresh: {
            accessTokenExpiresAt: null,
            nextRefreshAt: null,
            lastRefreshedAt: now.toISOString(),
            refreshable: null
          }
        };
      }
    } catch (error) {
      nativeError = error;
    }
    if (account?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER || account?.auth?.credentialRef) {
      throw nativeError ?? new Error("Antigravity native quota did not return data for the selected account");
    }
    const [quotaResult, creditsResult] = await Promise.all([
      this.#slash("/quota", context.signal),
      this.#slash("/credits", context.signal).catch(() => null)
    ]);
    const data = quotaResult.parsed?.command?.data;
    const windows = parseQuotaData(data, now);
    const fallbackWindows = windows.length ? windows : parseQuotaText(quotaResult.parsed?.response ?? "", now);
    const credits = creditsFromData(creditsResult?.parsed?.command?.data);
    const primary = selectPrimaryQuotaWindow(fallbackWindows);
    return {
      quota: {
        ...primary,
        windows: fallbackWindows,
        updatedAt: now.toISOString(),
        source: "antigravity_cli"
      },
      credits,
      refresh: {
        accessTokenExpiresAt: null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: null
      }
    };
  }
  async getCatalog(context = {}) {
    return this.catalogLoader({
      force: Boolean(context.force),
      accounts: context.accounts,
      accountId: context.accountId ?? null,
      secretStore: context.secretStore ?? null
    });
  }
  async invoke(request, invocation, context = {}) {
    await this.#refreshBrowserCredential(invocation?.account, context);
    const officialCredential = await this.#refreshOfficialCredential(invocation?.account, context);
    await this.#assertActiveSession(invocation?.account, {
      ...context,
      ...officialCredential?.rotated ? { allowSessionTokenRotation: true } : {}
    });
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") {
      throw new Error("Antigravity native invocation transport is not mounted");
    }
    const resolved = await resolveAntigravityNativeInvocationModel({
      catalogLoader: this.catalogLoader,
      model: request?.model,
      reasoningEffort: request?.reasoningEffort ?? request?.reasoning_effort
    });
    const resolvedRequest = resolved.model === request?.model && resolved.reasoningEffort === (request?.reasoningEffort ?? request?.reasoning_effort) ? request : {
      ...request,
      model: resolved.model,
      ...resolved.reasoningEffort === void 0 ? {} : { reasoningEffort: resolved.reasoningEffort }
    };
    return executor({ request: resolvedRequest, invocation, context });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createAntigravityDriver(options = {}) {
  return new AntigravityOfficialSessionDriver(options);
}
var antigravityDriverConstants = Object.freeze({ providerId: PROVIDER_ID3 });

// modules/provider-antigravity/src/index.mjs
function createAntigravityModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "antigravity",
    displayName: "Antigravity",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-grok/src/driver.mjs
import { createHash as createHash5 } from "node:crypto";
import { mkdtemp as mkdtemp3, readFile as readFile5, rm as rm4, writeFile as writeFile3 } from "node:fs/promises";
import { homedir as homedir6 } from "node:os";
import { tmpdir as tmpdir3 } from "node:os";
import { join as join9 } from "node:path";
var PROVIDER_ID4 = "grok";
var DEFAULT_AUTHORIZATION_URL2 = "https://auth.x.ai/oauth2/authorize";
var DEFAULT_TOKEN_URL2 = "https://auth.x.ai/oauth2/token";
var DEFAULT_USERINFO_URL = "https://auth.x.ai/oauth2/userinfo";
var DEFAULT_GROK_MODELS_URL = "https://cli-chat-proxy.grok.com/v1/models";
var DEFAULT_CLIENT_ID2 = "b1a00492-073a-47ea-816f-4c329264a828";
var DEFAULT_OAUTH_SCOPE = "openid profile email offline_access grok-cli:access api:access conversations:read conversations:write workspaces:read workspaces:write";
var DEFAULT_GROK_HOME = join9(homedir6(), ".grok");
var DEFAULT_CATALOG_TTL_MS2 = 6e4;
var DEFAULT_GROK_USAGE_URL = "https://grok.com/?_s=usage";
var DEFAULT_GROK_CREDITS_URL = "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
var DEFAULT_GROK_TOKEN_HEADER = "xai-grok-cli";
var DEFAULT_GROK_CLIENT_VERSION = "1.0.13";
var CREDENTIAL_SLOT3 = Symbol("dockyard-grok-credential");
function hash3(value) {
  return createHash5("sha256").update(String(value)).digest("hex");
}
function firstString2(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function grokTokenExpiresAt(value, payload = {}, now = /* @__PURE__ */ new Date()) {
  return isoFromEpoch(value?.expires_at ?? value?.expiresAt ?? payload.exp) ?? addSecondsIso(value?.expires_in ?? value?.expiresIn, now);
}
function grokTokenNeedsRefresh(credential, now = /* @__PURE__ */ new Date(), leewayMs = 6e4) {
  if (!credential?.refresh || !credential.expiresAt) return false;
  const expiresAt = Date.parse(credential.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now.getTime() + leewayMs;
}
function grokHomePath({ env = process.env, home = homedir6(), grokHome } = {}) {
  return grokHome ?? env.GROK_HOME ?? join9(home, ".grok");
}
function grokCommandEnvironment(env, grokHome) {
  return { ...env, GROK_HOME: grokHome };
}
function authRecords(raw) {
  if (!raw || typeof raw !== "object") return [];
  if (typeof raw.key === "string" || typeof raw.access_token === "string" || typeof raw.accessToken === "string") {
    return [{ scopeKey: "default", value: raw }];
  }
  return Object.entries(raw).filter(([, value]) => value && typeof value === "object").map(([scopeKey, value]) => ({ scopeKey, value }));
}
function grokPlanFromTier(tier) {
  if (typeof tier === "string" && tier.length > 0) return tier;
  if (tier === 3) return "Premium";
  if (tier === 4) return "Premium+";
  if (tier === 2) return "Basic";
  if (tier === 1) return "Free";
  if (tier === 5) return "Enterprise";
  return null;
}
function parseGrokAuth(raw) {
  return authRecords(raw).map(({ scopeKey, value }) => {
    const access2 = firstString2(value.key, value.access_token, value.accessToken);
    if (!access2) return null;
    const accessPayload = decodeJwtPayload(access2) ?? {};
    const idPayload = decodeJwtPayload(value.id_token ?? value.idToken) ?? {};
    const expiresAt = grokTokenExpiresAt(value, accessPayload);
    const accountId = firstString2(
      value.user_id,
      value.userId,
      value.principal_id,
      value.principalId,
      value.team_id,
      value.teamId,
      accessPayload.sub,
      accessPayload.user_id,
      accessPayload.userId,
      idPayload.sub
    ) ?? `${scopeKey}:${hash3(access2).slice(0, 20)}`;
    const email = firstString2(value.email, value.user_email, value.userEmail, idPayload.email, accessPayload.email);
    const displayName = firstString2(
      value.first_name,
      value.firstName,
      value.name,
      idPayload.preferred_username,
      idPayload.name,
      idPayload.nickname,
      accessPayload.name,
      email,
      accountId
    );
    const plan = firstString2(
      value.subscription_level,
      value.subscriptionLevel,
      value.subscription_tier,
      value.subscriptionTier,
      grokPlanFromTier(accessPayload.tier),
      grokPlanFromTier(idPayload.tier)
    );
    return {
      access: access2,
      refresh: firstString2(value.refresh_token, value.refreshToken),
      accountId,
      email,
      displayName,
      plan,
      expiresAt,
      createdAt: firstString2(value.create_time, value.createdAt),
      scopes: Array.isArray(value.scopes) ? value.scopes.map(String) : typeof value.scope === "string" ? value.scope.split(/\s+/).filter(Boolean) : [],
      issuer: firstString2(value.oidc_issuer, value.oidcIssuer, scopeKey.split("::")[0]),
      clientId: firstString2(value.oidc_client_id, value.oidcClientId),
      authMode: firstString2(value.auth_mode, value.authMode),
      scopeKey
    };
  }).filter(Boolean);
}
function accountInput2(tokens, credentialRef, now = /* @__PURE__ */ new Date(), { source = "official_grok_oauth" } = {}) {
  return {
    providerId: PROVIDER_ID4,
    accountId: tokens.accountId,
    credentialRef,
    displayName: tokens.displayName,
    email: tokens.email,
    auth: { kind: "oauth", scopes: tokens.scopes },
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.createdAt ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh)
    },
    resources: {
      transport: "xai_chat_completions_sse",
      accountScope: "oauth_account",
      sessionSource: source.includes("browser") ? OFFICIAL_SESSION_SOURCE_KINDS.BROWSER : OFFICIAL_SESSION_SOURCE_KINDS.OAUTH_FILE,
      authSource: source,
      quotaSource: source.includes("browser") ? "official_browser_session" : "official_grok_session",
      quotaUrl: DEFAULT_GROK_USAGE_URL
    }
  };
}
function attachCredential2(candidate2, tokens) {
  Object.defineProperty(candidate2, CREDENTIAL_SLOT3, {
    value: tokens,
    enumerable: false,
    configurable: false
  });
  return candidate2;
}
function candidateFromTokens2(tokens, { source, now = /* @__PURE__ */ new Date() } = {}) {
  const expired = tokens.expiresAt && new Date(tokens.expiresAt).getTime() <= now.getTime();
  return attachCredential2({
    candidateId: `grok:${hash3(tokens.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID4,
    source,
    accountId: tokens.accountId,
    displayName: tokens.displayName ?? tokens.email ?? tokens.accountId,
    email: tokens.email,
    subscription: { plan: tokens.plan, status: null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: tokens.expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: tokens.createdAt ?? now.toISOString(),
      refreshable: Boolean(tokens.refresh)
    },
    credentialRef: createCredentialRef(PROVIDER_ID4, tokens.accountId),
    imported: false,
    status: expired ? "degraded" : "available",
    diagnostic: expired ? "Grok OAuth access token \u5DF2\u8FC7\u671F\uFF0C\u5BFC\u5165\u540E\u9700\u8981\u5B98\u65B9 OAuth \u5237\u65B0" : null
  }, tokens);
}
function summarizeGrokCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID4,
    candidateId: candidate2.candidateId,
    source: candidate2.source,
    accountId: candidate2.accountId,
    displayName: candidate2.displayName,
    email: candidate2.email,
    subscription: { ...candidate2.subscription },
    refresh: { ...candidate2.refresh },
    imported: Boolean(candidate2.imported),
    status: candidate2.status ?? "available",
    diagnostic: candidate2.diagnostic ?? null
  };
}
function cacheEntries(cache) {
  if (!cache || typeof cache !== "object") return [];
  const entries = cache.models ?? cache.data;
  if (!entries || typeof entries !== "object") return [];
  return Array.isArray(entries) ? entries.map((value) => [value?.id, value]).filter(([id]) => id) : Object.entries(entries);
}
function normalizeReasoning(info) {
  const raw = Array.isArray(info?.reasoning_efforts) ? info.reasoning_efforts : [];
  const efforts = raw.map((effort) => {
    const id = firstString2(effort?.id, effort?.value);
    if (!id) return null;
    return {
      id,
      name: firstString2(effort?.label, effort?.name, id),
      ...typeof effort?.description === "string" ? { description: effort.description } : {},
      ...effort?.default === true ? { default: true } : {}
    };
  }).filter(Boolean);
  if (!efforts.length) return void 0;
  const preferred = efforts.find((effort) => effort.default)?.id ?? firstString2(info?.reasoning_effort);
  return {
    efforts: efforts.map(({ default: _default, ...effort }) => effort),
    ...preferred && efforts.some((effort) => effort.id === preferred) ? { defaultEffort: preferred } : {}
  };
}
function parseGrokModelCatalog(output = "", cache = null) {
  const discovered = [...String(output).matchAll(/^\s*[*-]\s+(\S+)(?:\s+\(([^)]+)\))?/gm)].map((match) => ({ id: match[1], name: match[2] ?? match[1] }));
  const cached = new Map(cacheEntries(cache).map(([id, value]) => [id, value?.info ?? value ?? {}]));
  const ids = [.../* @__PURE__ */ new Set([...discovered.map((model) => model.id), ...cached.keys()])];
  return ids.map((id) => {
    const fromOutput = discovered.find((model2) => model2.id === id);
    const info = cached.get(id) ?? {};
    const outputName = fromOutput?.name === "default" ? null : fromOutput?.name;
    const model = { id, name: firstString2(info.name, info.model, outputName, id) };
    const reasoning = normalizeReasoning(info);
    if (reasoning) model.reasoning = reasoning;
    const contextWindow = finiteNumber(info.context_window ?? info.contextWindow);
    const maxTokens = finiteNumber(info.max_completion_tokens ?? info.maxTokens);
    if (Number.isInteger(contextWindow)) model.contextWindow = contextWindow;
    if (Number.isInteger(maxTokens)) model.maxTokens = Math.min(maxTokens, 16384);
    if (Array.isArray(info.input) && info.input.length > 0) model.inputModalities = [...info.input];
    return model;
  });
}
function finiteValue(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}
function centValue(value) {
  return finiteValue(value?.val ?? value);
}
function periodLabel(periodType) {
  const value = String(periodType ?? "").toUpperCase();
  if (value.includes("WEEK")) return "\u5B98\u65B9\u5468\u989D\u5EA6\u5468\u671F";
  if (value.includes("MONTH")) return "\u5B98\u65B9\u6708\u989D\u5EA6\u5468\u671F";
  return "\u5B98\u65B9\u989D\u5EA6\u5468\u671F";
}
function parseGrokCreditsConfig(body, { now = /* @__PURE__ */ new Date() } = {}) {
  const config = body?.config && typeof body.config === "object" ? body.config : {};
  const updatedAt2 = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const usagePercent = finiteValue(config.creditUsagePercent);
  const monthlyLimit = centValue(config.monthlyLimit);
  const used = centValue(config.used);
  const currentPeriod = config.currentPeriod && typeof config.currentPeriod === "object" ? config.currentPeriod : {};
  const periodType = currentPeriod.type ?? config.periodType;
  const periodStart = currentPeriod.start ?? config.billingPeriodStart ?? null;
  const periodEnd = currentPeriod.end ?? config.billingPeriodEnd ?? null;
  let remaining = null;
  let limit = null;
  let unit = null;
  if (usagePercent !== null && usagePercent >= 0 && usagePercent <= 100) {
    remaining = Math.max(0, 100 - usagePercent);
    limit = 100;
    unit = "percent";
  } else if (monthlyLimit !== null && used !== null && monthlyLimit >= 0) {
    remaining = Math.max(0, monthlyLimit - used);
    limit = monthlyLimit;
    unit = "USD cents";
  }
  const windows = periodEnd || remaining !== null || limit !== null ? [{
    id: "grok.current_period",
    name: periodLabel(periodType),
    remaining,
    limit,
    unit,
    resetAt: periodEnd,
    updatedAt: updatedAt2,
    source: "official_grok_build_billing"
  }] : [];
  return {
    quota: {
      remaining,
      limit,
      unit,
      resetAt: periodEnd,
      windows,
      updatedAt: updatedAt2,
      source: "official_grok_build_billing"
    },
    subscription: {
      plan: typeof body?.subscriptionTier === "string" ? body.subscriptionTier : null,
      status: null,
      expiresAt: null
    },
    resources: {
      quotaSource: "official_grok_build_billing",
      quotaDiagnostic: windows.length === 0 ? "Grok \u5B98\u65B9 credits config \u672A\u8FD4\u56DE\u5F53\u524D\u989D\u5EA6\u5468\u671F\u6216\u5269\u4F59\u503C" : remaining === null ? "Grok \u5B98\u65B9\u5DF2\u8FD4\u56DE\u5F53\u524D\u989D\u5EA6\u5468\u671F\uFF0C\u4F46\u672A\u8FD4\u56DE\u5269\u4F59\u767E\u5206\u6BD4" : null,
      quotaPeriodType: periodType ?? null,
      quotaPeriodStart: periodStart,
      quotaUrl: DEFAULT_GROK_USAGE_URL
    }
  };
}
var DEFAULT_GROK_REASONING_EFFORTS = Object.freeze([
  { id: "low", name: "Low", description: "\u5FEB\u901F\u601D\u8003\uFF0C\u4FDD\u7559\u57FA\u7840\u63A8\u7406" },
  { id: "medium", name: "Medium", description: "\u6807\u51C6\u601D\u8003\uFF0C\u5E73\u8861\u63A8\u7406\u6DF1\u5EA6\u4E0E\u54CD\u5E94\u901F\u5EA6" },
  { id: "high", name: "High", description: "\u6DF1\u5EA6\u601D\u8003\uFF0C\u9002\u5408\u590D\u6742\u903B\u8F91\u4E0E\u591A\u6B65\u9AA4\u5206\u6790" }
]);
var BUILTIN_GROK_MODELS = Object.freeze([
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    contextWindow: 256e3,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "xhigh", name: "Extra High", description: "Maximum reasoning for the hardest tasks." },
        { id: "high", name: "High", description: "Thorough reasoning and quality. Recommended.", default: true },
        { id: "medium", name: "Medium", description: "Strong quality with a faster turnaround." },
        { id: "low", name: "Low", description: "Fastest responses. Best for simple tasks." }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-4.7-build-fast",
    name: "Grok 4.7 Fast",
    contextWindow: 256e3,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "xhigh", name: "Extra High", description: "Maximum reasoning for the hardest tasks." },
        { id: "high", name: "High", description: "Thorough reasoning and quality. Recommended.", default: true },
        { id: "medium", name: "Medium", description: "Strong quality with a faster turnaround." },
        { id: "low", name: "Low", description: "Fastest responses. Best for simple tasks." }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-4.6",
    name: "Grok 4.6",
    contextWindow: 256e3,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "xhigh", name: "Extra High", description: "Highest effort and reasoning level" },
        { id: "high", name: "High", description: "Higher implementation quality with extensive reasoning", default: true },
        { id: "medium", name: "Medium", description: "Balanced effort with standard implementation and testing" },
        { id: "low", name: "Low", description: "Quick, fast implementations" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    contextWindow: 256e3,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "high", name: "High", description: "Highest implementation quality with extensive reasoning", default: true },
        { id: "medium", name: "Medium", description: "Balanced effort with standard implementation and testing" },
        { id: "low", name: "Low", description: "Quick, fast implementations" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-build-0.1",
    name: "Grok Build 0.1",
    contextWindow: 131072,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "high", name: "High", description: "Deep thinking mode", default: true }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "grok-3",
    name: "Grok 3",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [...DEFAULT_GROK_REASONING_EFFORTS],
      defaultEffort: "medium"
    },
    inputModalities: ["text"]
  },
  {
    id: "grok-3-mini",
    name: "Grok 3 Mini",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [...DEFAULT_GROK_REASONING_EFFORTS],
      defaultEffort: "medium"
    },
    inputModalities: ["text"]
  },
  {
    id: "grok-2",
    name: "Grok 2",
    contextWindow: 131072,
    maxTokens: 8192,
    inputModalities: ["text"]
  },
  {
    id: "grok-2-mini",
    name: "Grok 2 Mini",
    contextWindow: 131072,
    maxTokens: 8192,
    inputModalities: ["text"]
  }
]);
function createGrokCatalogLoader({
  env = process.env,
  home = homedir6(),
  grokHome,
  cliPath = env.DOCKYARD_GROK_CLI || "grok",
  commandRunner = null,
  timeoutMs = 3e4,
  readJson: readJson3 = readJsonFile,
  cacheTtlMs = Number(process.env.DOCKYARD_GROK_CATALOG_TTL_MS) || DEFAULT_CATALOG_TTL_MS2,
  registryLoader = null,
  fetchImpl = fetch,
  modelsUrl = env.DOCKYARD_GROK_MODELS_URL || DEFAULT_GROK_MODELS_URL,
  tokenHeader = env.DOCKYARD_GROK_TOKEN_HEADER || DEFAULT_GROK_TOKEN_HEADER,
  clientVersion = env.DOCKYARD_GROK_CLIENT_VERSION || DEFAULT_GROK_CLIENT_VERSION
} = {}) {
  const resolvedHome = grokHomePath({ env, home, grokHome });
  let cached = null;
  let cachedAt = 0;
  let pending = null;
  return async function loadCatalog({ force = false, credential = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;
    if (pending) return pending;
    pending = (async () => {
      const cache = await readJson3(join9(resolvedHome, "models_cache.json"));
      let discoveredModels = [];
      let source = "official_grok_cli";
      let cliError = null;
      if (credential?.access) {
        try {
          const res = await fetchImpl(modelsUrl, {
            method: "GET",
            headers: {
              authorization: `Bearer ${credential.access}`,
              "x-xai-token-auth": tokenHeader,
              "x-userid": credential.accountId,
              "x-grok-client-version": clientVersion,
              accept: "application/json"
            }
          });
          if (res.ok) {
            const json = await res.json().catch(() => ({}));
            discoveredModels = parseGrokModelCatalog("", json);
            if (discoveredModels.length > 0) {
              source = "official_grok_models_api";
            }
          }
        } catch (error) {
          cliError = error;
        }
      }
      if (discoveredModels.length === 0 && typeof commandRunner === "function") {
        try {
          const result = await commandRunner(cliPath, ["models"], {
            env,
            timeoutMs,
            providerId: PROVIDER_ID4
          });
          discoveredModels = parseGrokModelCatalog(result.output, cache);
        } catch (error) {
          cliError = error;
          discoveredModels = parseGrokModelCatalog("", cache);
          source = cache ? "official_grok_local_cache" : "official_grok_cli";
        }
      } else if (discoveredModels.length === 0) {
        discoveredModels = parseGrokModelCatalog("", cache);
        source = "official_grok_local_cache";
      }
      if (discoveredModels.length > 0) {
        const modelsMap2 = /* @__PURE__ */ new Map();
        for (const m of discoveredModels) modelsMap2.set(m.id, { ...m });
        for (const m of BUILTIN_GROK_MODELS) {
          if (!modelsMap2.has(m.id)) {
            modelsMap2.set(m.id, { ...m });
          } else {
            const existing = modelsMap2.get(m.id);
            modelsMap2.set(m.id, {
              ...m,
              ...existing,
              reasoning: existing.reasoning ?? m.reasoning,
              inputModalities: existing.inputModalities ?? m.inputModalities
            });
          }
        }
        const finalModels = [...modelsMap2.values()];
        cached = {
          models: finalModels,
          source,
          ...cliError ? { diagnostics: [`Grok \u5B98\u65B9\u6A21\u578B\u76EE\u5F55\u63D0\u793A\uFF1A${cliError.message}`] } : {}
        };
        cachedAt = Date.now();
        return cached;
      }
      const modelsMap = /* @__PURE__ */ new Map();
      for (const m of BUILTIN_GROK_MODELS) {
        modelsMap.set(m.id, { ...m });
      }
      if (typeof registryLoader === "function") {
        try {
          const registry = await registryLoader();
          for (const item of Array.isArray(registry) ? registry : []) {
            if (!item?.id) continue;
            if (item.provider === "xai" || String(item.id).startsWith("grok-")) {
              const previous = modelsMap.get(item.id);
              if (!previous) {
                const reasoning = resolveReasoningFromModel(item);
                modelsMap.set(item.id, {
                  id: item.id,
                  name: item.name ?? item.id,
                  ...Number.isInteger(item.contextWindow) ? { contextWindow: item.contextWindow } : {},
                  ...Number.isInteger(item.maxTokens) ? { maxTokens: Math.min(item.maxTokens, 16384) } : {},
                  ...Array.isArray(item.input) ? { inputModalities: [...item.input] } : {},
                  ...reasoning ? { reasoning } : {}
                });
              }
            }
          }
        } catch {
        }
      }
      const models = [...modelsMap.values()];
      cached = {
        models,
        source: discoveredModels.length > 0 ? source : "official_grok_builtin",
        ...cliError ? { diagnostics: [`Grok \u5B98\u65B9\u6A21\u578B\u76EE\u5F55\u63D0\u793A\uFF1A${cliError.message}`] } : {}
      };
      cachedAt = Date.now();
      return cached;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
var GrokOAuthDriver = class {
  constructor({
    authFilePath,
    env = process.env,
    home = homedir6(),
    grokHome,
    catalogLoader = null,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_GROK_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_GROK_AUTHORIZATION_URL || DEFAULT_AUTHORIZATION_URL2,
    tokenUrl = env.DOCKYARD_GROK_TOKEN_URL || DEFAULT_TOKEN_URL2,
    userinfoUrl = env.DOCKYARD_GROK_USERINFO_URL || DEFAULT_USERINFO_URL,
    modelsUrl = env.DOCKYARD_GROK_MODELS_URL || DEFAULT_GROK_MODELS_URL,
    clientId = env.DOCKYARD_GROK_CLIENT_ID || DEFAULT_CLIENT_ID2,
    oauthScope = env.DOCKYARD_GROK_OAUTH_SCOPE || DEFAULT_OAUTH_SCOPE,
    cliPath = env.DOCKYARD_GROK_CLI || "grok",
    commandRunner = runCliCommand,
    requestExecutor = null,
    fetchImpl = fetch,
    creditsUrl = env.DOCKYARD_GROK_CREDITS_URL || DEFAULT_GROK_CREDITS_URL,
    tokenHeader = env.DOCKYARD_GROK_TOKEN_HEADER || DEFAULT_GROK_TOKEN_HEADER,
    clientVersion = env.DOCKYARD_GROK_CLIENT_VERSION || DEFAULT_GROK_CLIENT_VERSION,
    timeoutMs = 3e4,
    registryLoader = null
  } = {}) {
    this.env = env;
    this.grokHome = grokHomePath({ env, home, grokHome });
    this.authFilePath = authFilePath ?? join9(this.grokHome, "auth.json");
    this.cliPath = cliPath;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.creditsUrl = validateNativeEndpoint(creditsUrl, { providerId: PROVIDER_ID4 });
    this.modelsUrl = validateNativeEndpoint(modelsUrl, { providerId: PROVIDER_ID4 });
    this.tokenHeader = String(tokenHeader || DEFAULT_GROK_TOKEN_HEADER);
    this.clientVersion = String(clientVersion || DEFAULT_GROK_CLIENT_VERSION);
    this.timeoutMs = timeoutMs;
    this.authorizationUrl = assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_GROK_AUTHORIZATION_URL");
    this.tokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_GROK_TOKEN_URL");
    this.userinfoUrl = assertSecureEndpointUrl(userinfoUrl, "DOCKYARD_GROK_USERINFO_URL");
    this.clientId = clientId;
    this.oauthScope = oauthScope;
    this.catalogLoader = catalogLoader ?? createGrokCatalogLoader({
      env,
      home,
      grokHome: this.grokHome,
      cliPath,
      commandRunner,
      timeoutMs,
      registryLoader,
      fetchImpl: this.fetchImpl,
      modelsUrl: this.modelsUrl,
      tokenHeader: this.tokenHeader,
      clientVersion: this.clientVersion
    });
    this.cliAuthorizer = createCliOAuthAuthorizer({
      providerId: PROVIDER_ID4,
      cliPath,
      loginArgs: ["login", "--oauth"],
      environmentKey: "GROK_HOME",
      environment: env,
      profileDirectory: this.grokHome,
      browserOpened: true,
      instructions: "\u5DF2\u542F\u52A8\u5B98\u65B9 Grok CLI OAuth \u767B\u5F55\u3002\u8BF7\u5728 auth.x.ai \u5B98\u65B9\u7F51\u9875\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      importCredentials: (raw, context) => this.#importOAuthState(raw, context)
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID4,
      callbackPath: "/callback",
      callbackHost: "127.0.0.1",
      callbackPort: 0,
      instructions: "\u8BF7\u5728\u5B98\u65B9 Grok \u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF1B\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u8FD4\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri, nonce }) => {
        const url = new URL(authorizationUrl);
        url.search = new URLSearchParams({
          response_type: "code",
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: oauthScope,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          nonce,
          referrer: "grok-build"
        });
        return url.toString();
      },
      exchangeCode: async ({ code, codeVerifier, redirectUri, context }) => {
        const response = await this.fetchImpl(`${tokenUrl}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
          }),
          ...context.signal ? { signal: context.signal } : {}
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(`Grok OAuth token exchange failed (${response.status})`);
          error.status = response.status;
          error.upstreamCode = body.error ?? body.error_code;
          throw error;
        }
        const access2 = firstString2(body.access_token, body.accessToken, body.key);
        if (access2) {
          try {
            const userinfoRes = await this.fetchImpl(this.userinfoUrl, {
              method: "GET",
              headers: { authorization: `Bearer ${access2}`, accept: "application/json" },
              ...context.signal ? { signal: context.signal } : {}
            });
            if (userinfoRes.ok) {
              const userinfo = await userinfoRes.json().catch(() => ({}));
              if (userinfo?.name) body.name = userinfo.name;
              if (userinfo?.email) body.email = userinfo.email;
              if (userinfo?.sub) body.user_id = userinfo.sub;
            }
          } catch {
          }
        }
        return {
          ...body,
          oidc_client_id: body.oidc_client_id ?? body.client_id ?? clientId,
          auth_mode: "oauth",
          scope: body.scope ?? oauthScope
        };
      },
      importCredentials: (raw, context) => this.#importOAuthState(raw, context, "official_grok_browser_oauth")
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }
  async discover(context = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const raw = await readJsonFile(this.authFilePath);
    if (!raw) {
      return { candidates: [], source: this.authFilePath, diagnostics: [`\u672A\u53D1\u73B0 Grok OAuth \u6587\u4EF6\uFF1A${this.authFilePath}`] };
    }
    const candidates = parseGrokAuth(raw).map((tokens) => candidateFromTokens2(tokens, { source: "official_grok_oauth", now }));
    return {
      candidates,
      source: "official_grok_oauth",
      diagnostics: candidates.length ? [] : ["Grok OAuth \u6587\u4EF6\u5B58\u5728\uFF0C\u4F46\u6CA1\u6709\u53EF\u8BC6\u522B\u7684 access token"]
    };
  }
  async importAccount(candidate2, context = {}) {
    const tokens = candidate2?.[CREDENTIAL_SLOT3];
    if (!tokens) throw new Error("Grok candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = createCredentialRef(PROVIDER_ID4, tokens.accountId);
    await context.secretStore.write(credentialRef, {
      type: "oauth",
      providerId: PROVIDER_ID4,
      access: tokens.access,
      refresh: tokens.refresh,
      accountId: tokens.accountId,
      email: tokens.email,
      displayName: tokens.displayName,
      expiresAt: tokens.expiresAt,
      issuer: tokens.issuer,
      clientId: tokens.clientId,
      scopes: tokens.scopes,
      scopeKey: tokens.scopeKey
    });
    return accountInput2(tokens, credentialRef, context.now instanceof Date ? context.now : /* @__PURE__ */ new Date(), {
      source: candidate2.source
    });
  }
  async importSource(source, context = {}) {
    let raw;
    try {
      raw = typeof source?.content === "string" ? JSON.parse(source.content) : source?.content;
    } catch {
      throw new Error("Grok OAuth source is not valid JSON");
    }
    return this.#importOAuthState(raw, context, source?.fileName || "user_selected_oauth.json");
  }
  async #importOAuthState(raw, context = {}, source = "official_grok_oauth") {
    const tokens = parseGrokAuth(raw);
    if (!tokens.length) throw new Error("Grok OAuth state does not contain a supported account token");
    const accounts = [];
    for (const value of tokens) {
      accounts.push(await this.importAccount(candidateFromTokens2(value, {
        source,
        now: context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()
      }), context));
    }
    return accounts;
  }
  async getActiveSession(context = {}) {
    try {
      const discovered = await this.discover(context);
      if (!discovered.candidates?.length) return null;
      const accounts = [];
      for (const candidate2 of discovered.candidates) {
        accounts.push(await this.importAccount(candidate2, context));
      }
      return {
        status: "completed",
        providerId: PROVIDER_ID4,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Grok \u5B98\u65B9 OAuth \u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts,
        diagnostic: null
      };
    } catch {
      return null;
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }
  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }
  async submitAuthorizationCode(sessionId, code, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    if (typeof authorizer?.submitAuthorizationCode !== "function") {
      throw new Error("\u5F53\u524D Grok \u6388\u6743\u6D41\u7A0B\u4E0D\u63A5\u6536\u624B\u52A8\u6388\u6743\u7801");
    }
    return authorizer.submitAuthorizationCode(sessionId, code, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }
  async #readCredential(account, context = {}) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) {
      const error = new Error("Grok OAuth credential is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    return { ...credential, accountId: credential.accountId ?? account.accountId };
  }
  async #refreshOAuthCredential(account, context = {}, { strict = false } = {}) {
    const credential = await this.#readCredential(account, context);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    if (!grokTokenNeedsRefresh(credential, now)) return credential;
    if (!credential.refresh) {
      if (!strict) return credential;
      const error = new Error("Grok OAuth access token expired; authorize again");
      error.authExpired = true;
      throw error;
    }
    let response;
    try {
      response = await this.fetchImpl(this.tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          client_id: credential.clientId ?? this.clientId,
          grant_type: "refresh_token",
          refresh_token: credential.refresh
        }),
        ...context.signal ? { signal: context.signal } : {}
      });
    } catch (cause) {
      const error = new Error("Grok OAuth refresh failed; authorize again");
      error.authExpired = true;
      error.cause = cause;
      throw error;
    }
    const body = await response.json().catch(() => ({}));
    const access2 = firstString2(body.access_token, body.accessToken, body.key);
    if (!response.ok || !access2) {
      const error = new Error("Grok OAuth refresh failed; authorize again");
      error.status = response.status;
      error.authExpired = response.status === 401 || response.status === 400;
      throw error;
    }
    const updated = {
      ...credential,
      access: access2,
      refresh: firstString2(body.refresh_token, body.refreshToken, credential.refresh),
      expiresAt: grokTokenExpiresAt(body, decodeJwtPayload(access2) ?? {}, now) ?? credential.expiresAt,
      lastRefreshedAt: now.toISOString()
    };
    await context.secretStore.write(account.auth?.credentialRef ?? account.credentialRef, updated);
    return updated;
  }
  async #prepareCredentialEnvironment(account, context = {}) {
    const credential = await this.#readCredential(account, context);
    const profileDir = await mkdtemp3(join9(tmpdir3(), "dockyard-grok-run-"));
    const authPath = join9(profileDir, "auth.json");
    const key = account.accountId ?? credential.accountId;
    const raw = {
      [key]: {
        key: credential.access,
        ...credential.refresh ? { refresh_token: credential.refresh } : {},
        user_id: credential.accountId ?? account.accountId,
        ...credential.email ?? account.email ? { email: credential.email ?? account.email } : {},
        ...account.subscription?.plan ? { subscription_level: account.subscription.plan } : {},
        ...credential.expiresAt ? { expires_at: credential.expiresAt } : {}
      }
    };
    await writeFile3(authPath, JSON.stringify(raw), { mode: 384 });
    return { profileDir, authPath, credential, env: grokCommandEnvironment(this.env, profileDir) };
  }
  async #finishCredentialEnvironment(prepared, account, context = {}) {
    try {
      const raw = JSON.parse(await readFile5(prepared.authPath, "utf8"));
      const updated = parseGrokAuth(raw).find((value) => value.accountId === (account.accountId ?? prepared.credential.accountId)) ?? parseGrokAuth(raw)[0];
      if (updated && context.secretStore) {
        const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
        await context.secretStore.write(credentialRef, {
          ...prepared.credential,
          access: updated.access,
          ...updated.refresh ? { refresh: updated.refresh } : {},
          ...updated.email ? { email: updated.email } : prepared.credential.email ? { email: prepared.credential.email } : {},
          ...updated.displayName ? { displayName: updated.displayName } : prepared.credential.displayName ? { displayName: prepared.credential.displayName } : {},
          ...updated.expiresAt ? { expiresAt: updated.expiresAt } : {},
          accountId: updated.accountId,
          lastRefreshedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      return updated;
    } finally {
      await rm4(prepared.profileDir, { recursive: true, force: true }).catch(() => {
      });
    }
  }
  #isBrowserAccount(account) {
    return account?.resources?.authSource === "official_grok_browser_oauth" || account?.resources?.sessionSource === "browser" || !account?.resources?.cliProfile && Boolean(account?.refresh?.refreshable);
  }
  async refreshAccount(account, context = {}) {
    const credential = await this.#refreshOAuthCredential(account, context);
    const isBrowser = this.#isBrowserAccount(account);
    let updated = null;
    let commandError2 = null;
    if (!isBrowser) {
      const prepared = await this.#prepareCredentialEnvironment(account, context);
      try {
        await this.commandRunner(this.cliPath, ["models"], {
          env: prepared.env,
          timeoutMs: this.timeoutMs,
          providerId: PROVIDER_ID4
        });
      } catch (error) {
        if (error?.code !== "ENOENT" && !/ENOENT|not found/i.test(String(error?.message))) {
          error.authExpired = error.code === 401 || /auth|login|expired|credential|access token.{0,80}(?:valid|invalid|expired|revok)/i.test(String(error.message));
          commandError2 = error;
        }
      }
      let finishError = null;
      try {
        updated = await this.#finishCredentialEnvironment(prepared, account, context);
      } catch (error) {
        finishError = error;
      }
      if (commandError2) {
        if (finishError && !commandError2.cause) commandError2.cause = finishError;
        throw commandError2;
      }
      if (finishError) throw finishError;
    }
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const effective = updated ?? credential;
    const accessPayload = decodeJwtPayload(effective.access) ?? {};
    const plan = firstString2(
      effective.plan,
      grokPlanFromTier(accessPayload.tier),
      account.subscription?.plan
    );
    let email = firstString2(effective.email, account.email);
    let displayName = firstString2(effective.displayName, account.displayName);
    const isUuidOrMissingName = !displayName || displayName === account.accountId || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(displayName);
    if ((!email || isUuidOrMissingName) && effective.access) {
      try {
        const userinfoRes = await this.fetchImpl(this.userinfoUrl, {
          method: "GET",
          headers: { authorization: `Bearer ${effective.access}`, accept: "application/json" },
          ...context.signal ? { signal: context.signal } : {}
        });
        if (userinfoRes?.ok) {
          const userinfo = await userinfoRes.json().catch(() => ({}));
          if (userinfo?.name) displayName = userinfo.name;
          if (userinfo?.email) email = userinfo.email;
          if (context.secretStore) {
            const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
            await context.secretStore.write(credentialRef, {
              ...effective,
              ...email ? { email } : {},
              ...displayName ? { displayName } : {},
              ...plan ? { plan } : {}
            });
          }
        }
      } catch {
      }
    }
    return {
      ...email ? { email } : {},
      ...displayName ? { displayName } : {},
      subscription: {
        ...account.subscription,
        ...plan ? { plan } : {}
      },
      refresh: {
        accessTokenExpiresAt: effective?.expiresAt ?? account.refresh?.accessTokenExpiresAt ?? null,
        nextRefreshAt: null,
        lastRefreshedAt: now.toISOString(),
        refreshable: Boolean(effective?.refresh ?? account.refresh?.refreshable)
      }
    };
  }
  async getQuota(account, context = {}) {
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const credential = await this.#refreshOAuthCredential(account, context, { strict: true });
    const accountId = credential.accountId ?? account.accountId;
    const response = await this.fetchImpl(this.creditsUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${credential.access}`,
        "x-xai-token-auth": this.tokenHeader,
        "x-userid": accountId,
        "x-grok-client-version": this.clientVersion
      },
      ...context.signal ? { signal: context.signal } : {}
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`Grok credits request failed (${response.status})`);
      error.status = response.status;
      error.quotaUnavailable = response.status === 401 || response.status === 403;
      throw error;
    }
    const parsed = parseGrokCreditsConfig(body, { now });
    const accessPayload = decodeJwtPayload(credential.access) ?? {};
    const plan = firstString2(
      parsed.subscription?.plan,
      grokPlanFromTier(accessPayload.tier),
      account.subscription?.plan
    );
    return {
      ...parsed,
      subscription: {
        ...account.subscription,
        ...plan ? { plan } : {}
      }
    };
  }
  async getCatalog(context = {}) {
    let credential = null;
    if (context.accounts?.[0] && context.secretStore) {
      try {
        credential = await this.#readCredential(context.accounts[0], context);
      } catch {
      }
    }
    return this.catalogLoader({ force: Boolean(context.force), credential });
  }
  async invoke(request, invocation, context = {}) {
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Grok native invocation transport is not mounted");
    const account = invocation?.account;
    if (executor.nativeTransport === "xai-chat-completions") {
      const credential = account && context.secretStore ? await this.#refreshOAuthCredential(account, context, { strict: true }) : null;
      return executor({ request, invocation, credential, context });
    }
    if (!account || !context.secretStore) return executor({ request, invocation, context });
    const prepared = await this.#prepareCredentialEnvironment(account, context);
    let output;
    try {
      output = await executor({
        request,
        invocation,
        context: { ...context, env: prepared.env }
      });
    } catch (error) {
      try {
        await this.#finishCredentialEnvironment(prepared, account, context);
      } catch (finishError) {
        if (!error.cause) error.cause = finishError;
      }
      throw error;
    }
    return (async function* streamWithCleanup() {
      const driver = this;
      let streamError = null;
      try {
        for await (const chunk of output) yield chunk;
      } catch (error) {
        streamError = error;
        throw error;
      } finally {
        try {
          await driver.#finishCredentialEnvironment(prepared, account, context);
        } catch (finishError) {
          if (streamError) {
            if (!streamError.cause) streamError.cause = finishError;
          } else {
            throw finishError;
          }
        }
      }
    }).call(this);
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createGrokDriver(options = {}) {
  return new GrokOAuthDriver(options);
}
var grokDriverConstants = Object.freeze({ providerId: PROVIDER_ID4 });

// modules/provider-grok/src/native-transport.mjs
var PROVIDER_ID5 = "grok";
var DEFAULT_ENDPOINT2 = "https://api.x.ai/v1/chat/completions";
function firstString3(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function toolCallPart(part) {
  const type = String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "functioncall" || type === "tooluse" ? part : null;
}
async function openAiContent(content, attachments) {
  const values = Array.isArray(content) ? content : [content];
  const blocks = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) blocks.push({ type: "text", text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID5, "image attachment could not be resolved");
      blocks.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } });
      continue;
    }
    if (part.type === "tool-result" || part.type === "tool_result") {
      blocks.push({ type: "text", text: `[Tool Result ${part.toolCallId ?? part.id ?? ""}]
${textFromContent(part.content ?? part.output ?? part.result ?? part.text)}` });
      continue;
    }
    if (toolCallPart(part)) continue;
    const text3 = textFromContent(part);
    if (text3) blocks.push({ type: "text", text: text3 });
  }
  return blocks;
}
async function buildGrokMessages(request, attachments) {
  const result = [];
  if (typeof request.system === "string" && request.system.length > 0) {
    result.push({ role: "system", content: request.system });
  }
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "tool" : "user";
    if (role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: sanitizeToolCallId(firstString3(message.toolCallId, message.tool_call_id, message.id, "tool-result")),
        content: textFromContent(message.content ?? message.text ?? message.output ?? message.result)
      });
      continue;
    }
    const content = await openAiContent(message?.content ?? message?.text, attachments);
    const calls = (Array.isArray(message?.content) ? message.content : [message?.content]).map(toolCallPart).filter(Boolean).map((call, index) => ({
      id: sanitizeToolCallId(firstString3(call.id, call.toolCallId, call.tool_call_id, `tool-${index}`)),
      type: "function",
      function: {
        name: firstString3(call.name, call.function?.name, "tool"),
        arguments: typeof (call.arguments ?? call.function?.arguments) === "string" ? call.arguments ?? call.function.arguments : JSON.stringify(call.arguments ?? call.input ?? call.function?.arguments ?? {})
      }
    }));
    const messageValue = {
      role,
      content: content.length === 0 ? "" : content.length === 1 && content[0].type === "text" ? content[0].text : content
    };
    if (role === "assistant" && calls.length > 0) messageValue.tool_calls = calls;
    result.push(messageValue);
  }
  if (!result.some((message) => message.role === "user")) result.push({ role: "user", content: "Continue the conversation." });
  return result;
}
function buildGrokTools(tools) {
  if (!Array.isArray(tools)) return void 0;
  const result = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool?.name ?? tool?.function?.name ?? "tool",
      ...tool?.description ? { description: String(tool.description) } : {},
      parameters: tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" }
    }
  }));
  return result.length > 0 ? result : void 0;
}
async function buildGrokRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    messages: await buildGrokMessages(request, context.attachments),
    stream: true,
    stream_options: { include_usage: true }
  };
  if (request.temperature !== void 0) body.temperature = request.temperature;
  const maxTokens = request.maxTokens ?? request.modelContext?.maxTokens;
  if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
  if (request.reasoningEffort && request.purpose !== "compaction") body.reasoning_effort = request.reasoningEffort;
  const tools = buildGrokTools(request.tools);
  if (tools) body.tools = tools;
  return body;
}
async function* streamGrokResponse(response) {
  let text3 = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  const tools = /* @__PURE__ */ new Map();
  let terminated = false;
  yield { type: "block-start", index: textIndex, blockType: "text" };
  for await (const event of readSseEvents(response)) {
    if (event?.done) {
      terminated = true;
      continue;
    }
    const payload = event.data;
    if (!payload || typeof payload !== "object") continue;
    if (payload.error) {
      throw nativeProviderError(PROVIDER_ID5, payload.error.message ?? "xAI returned an error", {
        status: payload.error.code ?? payload.error.status,
        body: payload.error
      });
    }
    usage = normalizeUsage(payload.usage) ?? usage;
    const choice = payload.choices?.[0];
    if (!choice) continue;
    stop = choice.finish_reason ?? stop;
    if (typeof choice.finish_reason === "string" && choice.finish_reason.trim()) terminated = true;
    const delta = choice.delta ?? {};
    const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
    if (content) {
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }
      if (!textOpen) {
        textIndex = nextIndex++;
        text3 = "";
        textOpen = true;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }
      text3 += content;
      yield { type: "text-delta", index: textIndex, text: content };
    }
    const reasoningDelta = delta.reasoning_content ?? delta.reasoningContent;
    if (reasoningDelta) {
      if (textOpen) {
        yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
        textOpen = false;
      }
      if (!reasoning) {
        reasoning = { index: nextIndex++, text: "" };
        yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
      }
      const value = String(reasoningDelta);
      reasoning.text += value;
      yield { type: "reasoning-delta", index: reasoning.index, text: value };
    }
    for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      const key = Number(call.index ?? tools.size);
      if (!tools.has(key)) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
          textOpen = false;
        }
        const state2 = {
          index: nextIndex++,
          id: firstString3(call.id, `tool-${key}`),
          name: firstString3(call.function?.name, call.name, "tool"),
          arguments: ""
        };
        tools.set(key, state2);
        yield { type: "block-start", index: state2.index, blockType: "tool-call" };
      }
      const state = tools.get(key);
      const argumentDelta = call.function?.arguments ?? call.arguments ?? "";
      if (call.id) state.id = call.id;
      if (call.function?.name) state.name = call.function.name;
      state.arguments += argumentDelta;
      if (argumentDelta) {
        yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argumentDelta };
      }
    }
  }
  if (!terminated) {
    throw nativeProviderError(
      PROVIDER_ID5,
      "xAI stream ended without a finish_reason or [DONE] terminator; the response may be truncated",
      { code: "GROK_TRUNCATED_STREAM" }
    );
  }
  if (reasoning) yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  if (textOpen) yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
  for (const state of tools.values()) {
    yield { type: "block-end", index: state.index, block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" } };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}
function createGrokNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_GROK_ENDPOINT || DEFAULT_ENDPOINT2,
  env = process.env,
  timeoutMs = 3e5,
  fetchImpl = fetch,
  userAgent = process.env.DOCKYARD_GROK_USER_AGENT
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID5 });
  const executor = async ({ request = {}, credential, context = {} } = {}) => {
    const effectiveEnv = { ...env, ...context.env ?? {} };
    const token = firstString3(credential?.access, effectiveEnv.XAI_API_KEY, effectiveEnv.GROK_API_KEY);
    if (!token) {
      const error = nativeProviderError(PROVIDER_ID5, "Grok OAuth token is missing from secure storage");
      error.authExpired = true;
      throw error;
    }
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "text/event-stream"
    };
    const configuredUserAgent = userAgent ?? effectiveEnv.DOCKYARD_GROK_USER_AGENT;
    if (configuredUserAgent) headers["user-agent"] = configuredUserAgent;
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(await buildGrokRequest(request, context)),
      signal: context.signal
    }, { providerId: PROVIDER_ID5, timeoutMs, fetchImpl });
    return streamGrokResponse(response);
  };
  executor.nativeTransport = "xai-chat-completions";
  return guardEmptyCompletion(executor, { providerId: PROVIDER_ID5 });
}
var grokNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID5,
  endpoint: DEFAULT_ENDPOINT2
});

// modules/provider-grok/src/index.mjs
function createGrokModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "grok",
    displayName: "Grok",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream",
      PROVIDER_BEHAVIOR_CAPABILITIES.REPAIR_LEGACY_CREDENTIAL
    ],
    driver
  });
}

// modules/provider-claude/src/driver.mjs
import { createHash as createHash6 } from "node:crypto";
import { homedir as homedir8 } from "node:os";

// packages/oauth/src/cli-status-authorizer.mjs
import { randomUUID as randomUUID5 } from "node:crypto";
var CHILD_STOP_GRACE_MS2 = 2e3;
function publicSession3(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status ?? (session.exitCode === null ? "pending" : "processing"),
    authorizationUrl: session.authorizationUrl,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...session.browserOpened ? { browserOpened: true } : {}
  };
}
function stopChild2(session) {
  const child = session.child;
  if (!child || session.exitCode !== null) return Promise.resolve();
  return new Promise((resolve2) => {
    let settled = false;
    let timer;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (session.exitCode === null) session.exitCode = -1;
      resolve2();
    };
    child.once("close", finish);
    if (session.exitCode !== null) {
      finish();
      return;
    }
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }
    timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
      }
      finish();
    }, CHILD_STOP_GRACE_MS2);
    timer.unref?.();
  });
}
function createCliStatusAuthorizer({
  providerId,
  cliPath,
  loginArgs,
  environment = process.env,
  timeoutMs = 10 * 60 * 1e3,
  instructions = "\u8BF7\u5728\u5B98\u65B9\u6388\u6743\u9875\u9762\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
  browserOpened = false,
  importStatus
} = {}) {
  if (!providerId || !cliPath || !Array.isArray(loginArgs) || loginArgs.length === 0) {
    throw new Error(`Invalid CLI status authorizer configuration for ${providerId ?? "provider"}`);
  }
  if (typeof importStatus !== "function") throw new Error(`Missing status importer for ${providerId}`);
  const sessions = /* @__PURE__ */ new Map();
  function capture(session, chunk) {
    session.output = `${session.output}${String(chunk ?? "")}`.slice(-32e3);
    if (!session.authorizationUrl) {
      session.authorizationUrl = extractSafeAuthorizationUrl(session.output);
    }
  }
  async function finalize(session, context) {
    if (session.result) return session.result;
    if (session.finalizing) return session.finalizing;
    session.finalizing = (async () => {
      try {
        if (session.timedOut) {
          session.status = "failed";
          session.diagnostic = "\u5B98\u65B9 OAuth \u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002";
          return publicSession3(session);
        }
        if (session.launchError) {
          session.status = "failed";
          session.diagnostic = `\u65E0\u6CD5\u542F\u52A8\u5B98\u65B9\u767B\u5F55\u547D\u4EE4\uFF1A${session.launchError}`;
          return publicSession3(session);
        }
        if (session.exitCode !== 0) {
          session.status = "failed";
          session.diagnostic = `\u5B98\u65B9 OAuth \u767B\u5F55\u672A\u5B8C\u6210\uFF08\u9000\u51FA\u7801 ${session.exitCode ?? "unknown"}\uFF09\u3002`;
          return publicSession3(session);
        }
        const accounts = await importStatus(context);
        if (!Array.isArray(accounts) || accounts.length === 0) {
          session.status = "failed";
          session.diagnostic = "\u5B98\u65B9\u767B\u5F55\u5B8C\u6210\uFF0C\u4F46 provider status \u6CA1\u6709\u8FD4\u56DE\u53EF\u63A5\u5165\u7684\u8BA2\u9605\u8D26\u53F7\u3002";
          return publicSession3(session);
        }
        session.status = "completed";
        session.result = { ...publicSession3(session), accounts, diagnostic: null };
        return session.result;
      } catch (error) {
        session.status = "failed";
        session.diagnostic = redactError(error);
        return publicSession3(session);
      } finally {
        if (session.timer) clearTimeout(session.timer);
      }
    })();
    return session.finalizing;
  }
  async function begin() {
    const session = {
      sessionId: `${providerId}:${randomUUID5()}`,
      providerId,
      browserOpened,
      status: "pending",
      authorizationUrl: null,
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exitCode: null,
      launchError: null,
      output: "",
      timedOut: false,
      child: null,
      timer: null,
      finalizing: null,
      result: null,
      diagnostic: null
    };
    sessions.set(session.sessionId, session);
    try {
      const child = spawnCli(cliPath, loginArgs, {
        env: environment,
        stdio: ["ignore", "pipe", "pipe"]
      });
      session.child = child;
      child.stdout?.on("data", (chunk) => capture(session, chunk));
      child.stderr?.on("data", (chunk) => capture(session, chunk));
      child.once("error", (error) => {
        session.launchError = redactError(error);
        session.exitCode = -1;
      });
      child.once("close", (code) => {
        session.exitCode = typeof code === "number" ? code : -1;
      });
      session.timer = setTimeout(() => {
        if (session.exitCode !== null) return;
        session.timedOut = true;
        void stopChild2(session);
      }, timeoutMs);
      session.timer.unref?.();
    } catch (error) {
      session.launchError = redactError(error);
      session.exitCode = -1;
    }
    return publicSession3(session);
  }
  async function poll(sessionId, context) {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        providerId,
        status: "missing",
        instructions,
        diagnostic: "OAuth \u767B\u5F55\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u70B9\u51FB\u767B\u5F55\u6DFB\u52A0\u8D26\u53F7\u3002"
      };
    }
    if (session.exitCode === null) return publicSession3(session);
    const result = await finalize(session, context);
    if (result.status !== "pending" && result.status !== "processing") sessions.delete(sessionId);
    return result;
  }
  async function cancel(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return { sessionId, providerId, status: "missing" };
    if (session.timer) clearTimeout(session.timer);
    await stopChild2(session);
    sessions.delete(sessionId);
    return { sessionId, providerId, status: "cancelled" };
  }
  return Object.freeze({ begin, poll, cancel });
}

// packages/oauth/src/official-session-authorizer.mjs
import { randomUUID as randomUUID6 } from "node:crypto";
var DEFAULT_TIMEOUT_MS3 = 10 * 60 * 1e3;
function publicSession4(session) {
  return {
    sessionId: session.sessionId,
    providerId: session.providerId,
    status: session.status,
    instructions: session.instructions,
    startedAt: session.startedAt,
    diagnostic: session.diagnostic ?? null,
    ...session.browserOpened ? { browserOpened: true } : {}
  };
}
function createOfficialSessionAuthorizer({
  providerId,
  source = "official_client",
  instructions = "\u8BF7\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
  timeoutMs = DEFAULT_TIMEOUT_MS3,
  browserOpened = false,
  readSession,
  onCancel = null
} = {}) {
  if (!providerId) throw new Error("Official session authorizer requires providerId");
  if (typeof readSession !== "function") throw new Error(`Official session authorizer requires a reader for ${providerId}`);
  const sessions = /* @__PURE__ */ new Map();
  function missing(sessionId) {
    return {
      sessionId,
      providerId,
      status: "missing",
      instructions,
      diagnostic: "\u5B98\u65B9\u5BA2\u6237\u7AEF\u767B\u5F55\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u5DF2\u7ED3\u675F\uFF0C\u8BF7\u91CD\u65B0\u5F00\u59CB\u6388\u6743\u3002"
    };
  }
  async function begin() {
    const session = {
      sessionId: `${providerId}:official-session:${randomUUID6()}`,
      providerId,
      source,
      browserOpened,
      status: "pending",
      instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      diagnostic: null,
      result: null
    };
    sessions.set(session.sessionId, session);
    return publicSession4(session);
  }
  async function poll(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missing(sessionId);
    if (session.result) return session.result;
    if (Date.now() - Date.parse(session.startedAt) >= timeoutMs) {
      session.status = "failed";
      session.diagnostic = "\u5B98\u65B9\u5BA2\u6237\u7AEF\u767B\u5F55\u8D85\u65F6\uFF0C\u8BF7\u5B8C\u6210\u767B\u5F55\u540E\u91CD\u65B0\u5F00\u59CB\u6388\u6743\u3002";
      sessions.delete(sessionId);
      return publicSession4(session);
    }
    try {
      const value = await readSession(context);
      const accounts = Array.isArray(value) ? value : value?.accounts;
      if (Array.isArray(accounts) && accounts.length > 0) {
        session.status = "completed";
        session.result = {
          ...publicSession4(session),
          accounts,
          diagnostic: null
        };
        sessions.delete(sessionId);
        return session.result;
      }
      session.status = value?.status === "processing" ? "processing" : "pending";
      session.diagnostic = value?.diagnostic ?? null;
      return publicSession4(session);
    } catch (error) {
      session.status = "processing";
      session.diagnostic = redactError(error);
      return publicSession4(session);
    }
  }
  async function cancel(sessionId, context = {}) {
    const session = sessions.get(sessionId);
    if (!session) return missing(sessionId);
    try {
      await onCancel?.(context);
    } finally {
      sessions.delete(sessionId);
    }
    return { sessionId, providerId, status: "cancelled" };
  }
  async function submitAuthorizationCode(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return missing(sessionId);
    throw new Error("\u5F53\u524D\u5B98\u65B9\u5BA2\u6237\u7AEF\u6388\u6743\u6D41\u7A0B\u4E0D\u63A5\u6536\u9A8C\u8BC1\u7801");
  }
  return Object.freeze({ begin, poll, cancel, submitAuthorizationCode });
}
var officialSessionAuthorizerConstants = Object.freeze({
  defaultTimeoutMs: DEFAULT_TIMEOUT_MS3
});

// modules/provider-claude/src/native-transport.mjs
import { readFile as readFile6 } from "node:fs/promises";
import { homedir as homedir7 } from "node:os";
import { join as join10 } from "node:path";
var PROVIDER_ID6 = "claude";
var DEFAULT_ENDPOINT3 = "https://api.anthropic.com/v1/messages";
function firstString4(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
async function readJson(path2) {
  try {
    return JSON.parse(await readFile6(path2, "utf8"));
  } catch {
    return null;
  }
}
function oauthTokenFromJson(value) {
  const oauth = value?.claudeAiOauth ?? value?.oauth ?? value?.credentials ?? value;
  const token = firstString4(oauth?.accessToken, oauth?.access_token, value?.accessToken, value?.access_token);
  return token ? { token, kind: "oauth" } : null;
}
function claudeOAuthCredentialFromJson(value) {
  const oauth = value?.claudeAiOauth ?? value?.oauth ?? value?.credentials ?? value;
  const access2 = firstString4(oauth?.accessToken, oauth?.access_token, value?.accessToken, value?.access_token);
  if (!access2) return null;
  const refresh = firstString4(oauth?.refreshToken, oauth?.refresh_token, value?.refreshToken, value?.refresh_token);
  const expiresAt = isoFromEpoch(
    oauth?.expiresAt ?? oauth?.expires_at ?? oauth?.expiryDate ?? oauth?.expiry_date ?? value?.expiresAt ?? value?.expires_at
  ) ?? addSecondsIso(oauth?.expiresIn ?? oauth?.expires_in ?? value?.expiresIn ?? value?.expires_in);
  return {
    type: "oauth",
    providerId: "claude",
    access: access2,
    ...refresh ? { refresh } : {},
    ...expiresAt ? { expiresAt } : {},
    ...Array.isArray(oauth?.scopes) ? { scopes: oauth.scopes.map(String) } : {}
  };
}
async function readClaudeOAuthCredential({ home = homedir7() } = {}) {
  for (const path2 of [
    join10(home, ".claude", ".credentials.json"),
    join10(home, ".opencodex", "claude_desktop_auth.json")
  ]) {
    const credential = claudeOAuthCredentialFromJson(await readJson(path2));
    if (credential) return credential;
  }
  return null;
}
async function resolveClaudeAccessToken({
  credential,
  env = process.env,
  home = homedir7(),
  accountBound = false
} = {}) {
  const stored = firstString4(credential?.access, credential?.token);
  if (stored) return { token: stored, kind: credential?.type === "api_key" ? "apiKey" : "oauth" };
  if (accountBound) return null;
  const apiKey = firstString4(env.ANTHROPIC_API_KEY);
  if (apiKey) return { token: apiKey, kind: "apiKey" };
  const envToken = firstString4(env.CLAUDE_CODE_OAUTH_TOKEN, env.ANTHROPIC_AUTH_TOKEN);
  if (envToken) return { token: envToken, kind: "oauth" };
  for (const path2 of [
    join10(home, ".claude", ".credentials.json"),
    join10(home, ".opencodex", "claude_desktop_auth.json")
  ]) {
    const found = oauthTokenFromJson(await readJson(path2));
    if (found) return found;
  }
  return null;
}
function toolCallPart2(part) {
  const type = String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "tooluse" || type === "functioncall" ? part : null;
}
async function anthropicContent(content, attachments) {
  const values = Array.isArray(content) ? content : [content];
  const blocks = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) blocks.push({ type: "text", text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID6, "image attachment could not be resolved");
      blocks.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
      continue;
    }
    if (part.type === "tool-result" || part.type === "tool_result") {
      blocks.push({
        type: "tool_result",
        tool_use_id: firstString4(part.toolCallId, part.tool_call_id, part.id, "tool-result"),
        content: textFromContent(part.content ?? part.output ?? part.result ?? part.text),
        ...part.isError || part.is_error ? { is_error: true } : {}
      });
      continue;
    }
    const tool = toolCallPart2(part);
    if (tool) {
      blocks.push({
        type: "tool_use",
        id: firstString4(tool.id, tool.toolCallId, tool.tool_call_id, `tool-${blocks.length}`),
        name: firstString4(tool.name, tool.function?.name, "tool"),
        input: parseToolArguments(tool.arguments ?? tool.input ?? tool.function?.arguments)
      });
      continue;
    }
    const text3 = textFromContent(part);
    if (text3) blocks.push({ type: "text", text: text3 });
  }
  return blocks;
}
async function buildAnthropicMessages(request, attachments) {
  const messages = [];
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "user" : "user";
    const content = await anthropicContent(message?.content ?? message?.text, attachments);
    if (role === "user" && message?.role === "tool" && content.length === 0) continue;
    if (content.length > 0) messages.push({ role, content: content.length === 1 && content[0].type === "text" ? content[0].text : content });
  }
  if (messages.length === 0) messages.push({ role: "user", content: "Continue the conversation." });
  return messages;
}
function buildAnthropicTools(tools) {
  if (!Array.isArray(tools)) return void 0;
  const result = tools.map((tool) => ({
    name: firstString4(tool?.name, tool?.function?.name, "tool"),
    ...tool?.description ? { description: String(tool.description) } : {},
    input_schema: tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" }
  }));
  return result.length > 0 ? result : void 0;
}
function thinkingBudget(request) {
  const value = request?.reasoningBudget ?? request?.thinkingBudget;
  if (Number.isInteger(value) && value > 0) return value;
  const effort = String(request?.reasoningEffort ?? "").toLowerCase();
  if (effort === "high" || effort === "xhigh") return 16e3;
  if (effort === "medium") return 8e3;
  if (effort === "low") return 4e3;
  return null;
}
function invalidRequestError(message) {
  const error = new Error(message);
  error.code = "INVALID_ARGUMENT";
  error.providerId = PROVIDER_ID6;
  return error;
}
function resolveMaxTokens(request) {
  const value = Number.isInteger(request.maxTokens) ? request.maxTokens : Number.isInteger(request.modelContext?.maxTokens) ? request.modelContext.maxTokens : 4096;
  if (!Number.isInteger(value) || value <= 0) {
    throw invalidRequestError(`Claude max_tokens must be a positive integer, received ${value}`);
  }
  return value;
}
async function buildClaudeRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    messages: await buildAnthropicMessages(request, context.attachments),
    max_tokens: resolveMaxTokens(request),
    stream: true
  };
  if (typeof request.system === "string" && request.system.length > 0) body.system = request.system;
  const tools = buildAnthropicTools(request.tools);
  if (tools) body.tools = tools;
  const budget = thinkingBudget(request);
  if (budget && body.max_tokens > budget) {
    body.thinking = { type: "enabled", budget_tokens: budget };
  } else if (request.temperature !== void 0) {
    body.temperature = request.temperature;
  }
  return body;
}
function headersForToken(auth) {
  const headers = {
    "content-type": "application/json",
    accept: "text/event-stream",
    "anthropic-version": "2023-06-01"
  };
  if (auth.kind === "apiKey" || auth.token.startsWith("sk-ant-")) {
    headers["x-api-key"] = auth.token;
  } else {
    headers.authorization = `Bearer ${auth.token}`;
    headers["anthropic-beta"] = "oauth-2025-04-20";
    headers["anthropic-client-platform"] = "DESKTOP_APP";
    headers["anthropic-client-version"] = "1.0.0";
  }
  return headers;
}
function mergeUsage(previous, next) {
  return next ? { ...previous ?? {}, ...next } : previous;
}
function claudeStreamProtocolError() {
  const error = nativeProviderError(PROVIDER_ID6, "SSE stream ended before message_stop; the response was truncated");
  error.code = "SSE_PROTOCOL_ERROR";
  error.protocolError = true;
  return error;
}
async function* streamClaudeResponse(response) {
  let text3 = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let messageOpened = false;
  let terminated = false;
  const tools = /* @__PURE__ */ new Map();
  const reasoning = /* @__PURE__ */ new Map();
  yield { type: "block-start", index: textIndex, blockType: "text" };
  for await (const event of readSseEvents(response)) {
    const payload = event.data;
    if (!payload || typeof payload !== "object") continue;
    if (payload.type === "message_start") {
      messageOpened = true;
      usage = mergeUsage(usage, normalizeUsage(payload.message?.usage));
      continue;
    }
    if (payload.type === "content_block_start") {
      const block = payload.content_block ?? {};
      if (block.type === "tool_use" || block.type === "thinking" || block.type === "redacted_thinking") {
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
          textOpen = false;
        }
        const index = nextIndex++;
        if (block.type === "tool_use") {
          tools.set(payload.index, {
            index,
            id: firstString4(block.id, `tool-${payload.index}`),
            name: firstString4(block.name, "tool"),
            arguments: ""
          });
          yield { type: "block-start", index, blockType: "tool-call" };
        } else {
          reasoning.set(payload.index, { index, text: "" });
          yield { type: "block-start", index, blockType: "reasoning" };
        }
        continue;
      }
      if (block.type === "text" && !textOpen) {
        textIndex = nextIndex++;
        text3 = "";
        textOpen = true;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }
      continue;
    }
    if (payload.type === "content_block_delta") {
      const delta = payload.delta ?? {};
      if (delta.type === "text_delta" && delta.text) {
        if (!textOpen) {
          textIndex = nextIndex++;
          text3 = "";
          textOpen = true;
          yield { type: "block-start", index: textIndex, blockType: "text" };
        }
        text3 += delta.text;
        yield { type: "text-delta", index: textIndex, text: delta.text };
      } else if (delta.type === "thinking_delta" && delta.thinking) {
        let state = reasoning.get(payload.index);
        if (!state) {
          if (textOpen) {
            yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
            textOpen = false;
          }
          state = { index: nextIndex++, text: "" };
          reasoning.set(payload.index, state);
          yield { type: "block-start", index: state.index, blockType: "reasoning" };
        }
        state.text += delta.thinking;
        yield { type: "reasoning-delta", index: state.index, text: delta.thinking };
      } else if (delta.type === "input_json_delta" && tools.has(payload.index)) {
        const tool = tools.get(payload.index);
        tool.arguments += delta.partial_json ?? "";
        yield { type: "tool-call-delta", index: tool.index, id: tool.id, name: tool.name, argumentsDelta: delta.partial_json ?? "" };
      }
      continue;
    }
    if (payload.type === "content_block_stop") {
      const thought = reasoning.get(payload.index);
      if (thought) {
        yield { type: "block-end", index: thought.index, block: { type: "reasoning", text: thought.text } };
        reasoning.delete(payload.index);
      }
      const tool = tools.get(payload.index);
      if (tool) {
        yield {
          type: "block-end",
          index: tool.index,
          block: { type: "tool-call", id: tool.id, name: tool.name, arguments: tool.arguments || "{}" }
        };
        tools.delete(payload.index);
      }
      continue;
    }
    if (payload.type === "message_delta") {
      terminated = true;
      stop = payload.delta?.stop_reason ?? stop;
      usage = mergeUsage(usage, normalizeUsage(payload.usage));
      continue;
    }
    if (payload.type === "message_stop") {
      terminated = true;
      continue;
    }
    if (payload.type === "error") {
      throw nativeProviderError(PROVIDER_ID6, payload.error?.message ?? "Anthropic returned an error", {
        status: payload.error?.status,
        body: payload.error
      });
    }
  }
  if (messageOpened && !terminated) throw claudeStreamProtocolError();
  for (const thought of reasoning.values()) {
    yield { type: "block-end", index: thought.index, block: { type: "reasoning", text: thought.text } };
  }
  if (textOpen) yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
  for (const tool of tools.values()) {
    yield {
      type: "block-end",
      index: tool.index,
      block: { type: "tool-call", id: tool.id, name: tool.name, arguments: tool.arguments || "{}" }
    };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}
function createClaudeNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_CLAUDE_ENDPOINT || DEFAULT_ENDPOINT3,
  env = process.env,
  home = homedir7(),
  timeoutMs = 3e5,
  fetchImpl = fetch,
  tokenResolver = resolveClaudeAccessToken
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID6 });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
    const accountBound = Boolean(ref || invocation?.account?.accountId);
    if (context.secretStore && ref) {
      credential = await context.secretStore.read(ref);
    }
    const auth = await tokenResolver({ credential, env: { ...env, ...context.env ?? {} }, home, accountBound });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID6, accountBound ? "Claude subscription OAuth token is unavailable for the selected account; authorize Claude again" : "Claude OAuth token is unavailable; authorize Claude first");
      error.authExpired = true;
      throw error;
    }
    const body = await buildClaudeRequest(request, context);
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers: headersForToken(auth),
      body: JSON.stringify(body),
      signal: context.signal
    }, { providerId: PROVIDER_ID6, timeoutMs, fetchImpl });
    return streamClaudeResponse(response);
  };
  executor.nativeTransport = "anthropic-messages";
  return guardEmptyCompletion(executor, { providerId: PROVIDER_ID6 });
}
var claudeNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID6,
  endpoint: DEFAULT_ENDPOINT3
});

// modules/provider-claude/src/driver.mjs
var PROVIDER_ID7 = "claude";
var DEFAULT_BROWSER_AUTHORIZATION_URL = "https://claude.com/cai/oauth/authorize";
var DEFAULT_BROWSER_TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
var DEFAULT_BROWSER_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
var DEFAULT_BROWSER_REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
var DEFAULT_BROWSER_SCOPE = "user:profile user:inference";
var CREDENTIAL_SLOT4 = Symbol("dockyard-claude-session");
function hash4(value) {
  return createHash6("sha256").update(String(value)).digest("hex");
}
function firstString5(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function statusObject(raw, output = "") {
  if (raw && typeof raw === "object") return raw;
  return parseJsonOutput(output) ?? {};
}
function statusLoggedIn(value, output = "") {
  if (typeof value.loggedIn === "boolean") return value.loggedIn;
  if (typeof value.authenticated === "boolean") return value.authenticated;
  return !/not logged in|logged out|unauthenticated/i.test(String(output));
}
function isApiKeyStatus(value) {
  const method = String(value.authMethod ?? value.auth_method ?? "").toLowerCase();
  const source = String(value.apiKeySource ?? value.api_key_source ?? "").toLowerCase();
  return method.includes("api_key") || method.includes("apikey") || source.length > 0;
}
function isSubscriptionStatus(value) {
  if (isApiKeyStatus(value)) return false;
  const method = String(value.authMethod ?? value.auth_method ?? "").toLowerCase();
  const provider = String(value.apiProvider ?? value.api_provider ?? "").toLowerCase();
  return method.includes("oauth") || method.includes("claude") || method.includes("subscription") || provider.includes("claude") || provider.includes("firstparty");
}
function statusIdentity(value) {
  const profile = value.profile ?? value.user ?? value.account ?? {};
  const email = firstString5(value.email, value.userEmail, profile.email, profile.userEmail);
  const accountId = firstString5(
    value.accountId,
    value.account_id,
    value.userId,
    value.user_id,
    profile.accountId,
    profile.id,
    email
  ) ?? "claude:active";
  const plan = firstString5(
    value.plan,
    value.planName,
    value.plan_type,
    value.subscriptionType,
    value.subscription?.plan,
    value.subscription?.name
  );
  const displayName = firstString5(value.name, profile.name, email, accountId);
  return { accountId, email, plan, displayName };
}
function parseClaudeAuthStatus(output) {
  const value = statusObject(null, output);
  const identity = statusIdentity(value);
  return {
    loggedIn: statusLoggedIn(value, output),
    authMethod: firstString5(value.authMethod, value.auth_method),
    apiProvider: firstString5(value.apiProvider, value.api_provider),
    apiKeySource: firstString5(value.apiKeySource, value.api_key_source),
    isApiKey: isApiKeyStatus(value),
    isSubscription: isSubscriptionStatus(value),
    ...identity,
    raw: value
  };
}
function activeSessionError2(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}
function candidateFromStatus(status, {
  source = "official_claude_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  imported = false,
  credential = null
} = {}) {
  const sourceCredential = credential ?? status.credential ?? null;
  const persistedCredential = sourceCredential?.access && sourceCredential?.refresh ? {
    ...sourceCredential,
    type: sourceCredential.type ?? "oauth",
    providerId: PROVIDER_ID7,
    accountId: sourceCredential.accountId ?? status.accountId
  } : null;
  const credentialRef = createCredentialRef(PROVIDER_ID7, status.accountId);
  const candidate2 = {
    candidateId: `claude:${hash4(status.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID7,
    source,
    accountId: status.accountId,
    displayName: status.displayName ?? status.accountId,
    email: status.email,
    subscription: { plan: status.plan, status: status.isSubscription ? "active" : null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: persistedCredential?.expiresAt ?? null,
      nextRefreshAt: null,
      lastRefreshedAt: persistedCredential?.lastRefreshedAt ?? null,
      refreshable: Boolean(persistedCredential?.refresh)
    },
    credentialRef,
    resources: officialSessionResources({ sourceKind, authSource: source }),
    imported,
    status: status.isSubscription ? "available" : "degraded",
    diagnostic: status.isApiKey ? "\u5F53\u524D Claude \u5B98\u65B9\u4F1A\u8BDD\u4F7F\u7528 API key\uFF0C\u4E0D\u662F Claude Pro/Max \u8BA2\u9605 OAuth" : status.isSubscription ? null : "Claude \u5B98\u65B9\u4F1A\u8BDD\u6CA1\u6709\u8FD4\u56DE\u53EF\u8BC6\u522B\u7684\u8BA2\u9605 OAuth \u72B6\u6001"
  };
  Object.defineProperty(candidate2, CREDENTIAL_SLOT4, {
    value: persistedCredential ?? {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID7,
      accountId: status.accountId,
      authMethod: status.authMethod,
      sourceKind
    },
    enumerable: false
  });
  return candidate2;
}
function browserTokenExpiry(raw, now = /* @__PURE__ */ new Date()) {
  if (typeof raw?.expires_at === "string") return raw.expires_at;
  const expiresIn = Number(raw?.expires_in);
  return Number.isFinite(expiresIn) ? new Date(now.getTime() + expiresIn * 1e3).toISOString() : null;
}
function candidateFromBrowserToken(raw, { source = "official_claude_browser_oauth", now = /* @__PURE__ */ new Date() } = {}) {
  const access2 = firstString5(raw?.access_token, raw?.accessToken);
  const refresh = firstString5(raw?.refresh_token, raw?.refreshToken);
  if (!access2 || !refresh) throw new Error("Claude browser OAuth response is missing access and refresh tokens");
  const account = raw.account ?? {};
  const organization = raw.organization ?? {};
  const email = firstString5(raw.email, account.email, account.email_address, account.emailAddress);
  const accountId = firstString5(raw.accountId, raw.account_id, account.uuid, account.id, email) ?? "claude:active";
  const candidate2 = candidateFromStatus({
    loggedIn: true,
    authMethod: "oauth",
    apiProvider: "firstParty",
    isApiKey: false,
    isSubscription: true,
    accountId,
    email,
    displayName: firstString5(raw.name, account.name, email, accountId),
    plan: firstString5(raw.plan, raw.plan_type, organization.name)
  }, {
    source,
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
    credential: {
      type: "oauth",
      providerId: PROVIDER_ID7,
      accountId,
      access: access2,
      refresh,
      expiresAt: browserTokenExpiry(raw, now),
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
      clientId: raw.client_id ?? raw.clientId ?? null
    }
  });
  candidate2.refresh = {
    ...candidate2.refresh,
    accessTokenExpiresAt: browserTokenExpiry(raw, now),
    refreshable: true
  };
  return candidate2;
}
function summarizeClaudeCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID7,
    candidateId: candidate2.candidateId,
    source: candidate2.source,
    accountId: candidate2.accountId,
    displayName: candidate2.displayName,
    email: candidate2.email,
    subscription: { ...candidate2.subscription },
    refresh: { ...candidate2.refresh },
    imported: Boolean(candidate2.imported),
    status: candidate2.status ?? "available",
    diagnostic: candidate2.diagnostic ?? null
  };
}
function catalogModel(model) {
  const reasoning = model?.thinkingLevelMap && typeof model.thinkingLevelMap === "object" ? {
    efforts: Object.keys(model.thinkingLevelMap).filter((id) => id !== "off").map((id) => ({ id, name: id.replace(/[-_]+/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()) }))
  } : model?.reasoning && typeof model.reasoning === "object" ? model.reasoning : void 0;
  return {
    id: model.id,
    name: model.name ?? model.id,
    ...Array.isArray(model.input) ? { inputModalities: [...model.input] } : {},
    ...Number.isInteger(model.contextWindow) ? { contextWindow: model.contextWindow } : {},
    ...Number.isInteger(model.maxTokens) ? { maxTokens: model.maxTokens } : {},
    ...reasoning ? { reasoning } : {}
  };
}
function createClaudeCatalogLoader({ registryLoader = null } = {}) {
  let cached = null;
  return async function loadCatalog({ force = false } = {}) {
    if (cached && !force) return cached;
    const registry = typeof registryLoader === "function" ? await registryLoader() : [];
    const rows = Array.isArray(registry) ? registry.filter(Boolean) : [];
    const isClaudeRow = (rawModel) => rawModel.provider === "anthropic" || rawModel.provider == null && rawModel.api === "anthropic-messages" && /^claude-/u.test(String(rawModel.id ?? ""));
    const modelsById = /* @__PURE__ */ new Map();
    for (const rawModel of rows) {
      if (!isClaudeRow(rawModel)) continue;
      const model = catalogModel(rawModel);
      if (typeof model.id !== "string" || model.id.length === 0) continue;
      const previous = modelsById.get(model.id);
      if (!previous) {
        modelsById.set(model.id, model);
        continue;
      }
      modelsById.set(model.id, {
        ...previous,
        ...previous.name === model.id && model.name !== model.id ? { name: model.name } : {},
        ...previous.inputModalities === void 0 && model.inputModalities !== void 0 ? { inputModalities: [...model.inputModalities] } : {},
        ...previous.contextWindow === void 0 && model.contextWindow !== void 0 ? { contextWindow: model.contextWindow } : {},
        ...previous.maxTokens === void 0 && model.maxTokens !== void 0 ? { maxTokens: model.maxTokens } : {},
        ...previous.reasoning === void 0 && model.reasoning !== void 0 ? { reasoning: model.reasoning } : {}
      });
    }
    const models = [...modelsById.values()];
    cached = {
      models,
      source: "dsh_live_provider_registry",
      ...models.length ? {} : { diagnostics: ["Claude \u5B98\u65B9\u6CA1\u6709\u516C\u5F00\u6A21\u578B\u76EE\u5F55\uFF0C\u4E14\u5F53\u524D DSH registry \u672A\u8FD4\u56DE Anthropic \u6A21\u578B"] }
    };
    return cached;
  };
}
var ClaudeSubscriptionDriver = class {
  constructor({
    cliPath = process.env.DOCKYARD_CLAUDE_CLI || "claude",
    env = process.env,
    commandRunner = runCliCommand,
    requestExecutor = null,
    catalogLoader = null,
    sessionReader = null,
    sessionSource = "official_claude_client",
    sessionSourceKind = OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CLAUDE_BROWSER_OAUTH !== "0",
    authorizationUrl = env.DOCKYARD_CLAUDE_AUTHORIZATION_URL || DEFAULT_BROWSER_AUTHORIZATION_URL,
    tokenUrl = env.DOCKYARD_CLAUDE_TOKEN_URL || DEFAULT_BROWSER_TOKEN_URL,
    clientId = env.DOCKYARD_CLAUDE_CLIENT_ID || DEFAULT_BROWSER_CLIENT_ID,
    redirectUri = env.DOCKYARD_CLAUDE_REDIRECT_URI || DEFAULT_BROWSER_REDIRECT_URI,
    oauthScope = env.DOCKYARD_CLAUDE_OAUTH_SCOPE || DEFAULT_BROWSER_SCOPE,
    home = homedir8(),
    fetchImpl = fetch
  } = {}) {
    assertSecureEndpointUrl(authorizationUrl, "DOCKYARD_CLAUDE_AUTHORIZATION_URL");
    this.cliPath = cliPath;
    this.env = env;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.home = home;
    this.browserTokenUrl = assertSecureEndpointUrl(tokenUrl, "DOCKYARD_CLAUDE_TOKEN_URL");
    this.browserClientId = clientId;
    this.sessionReader = sessionReader;
    this.sessionSource = sessionSource;
    this.sessionSourceKind = sessionSourceKind;
    this.catalogLoader = catalogLoader ?? createClaudeCatalogLoader();
    this.clientSessionAuthorizer = typeof sessionReader === "function" ? createOfficialSessionAuthorizer({
      providerId: PROVIDER_ID7,
      source: sessionSource,
      instructions: "\u8BF7\u5728 Claude \u5B98\u65B9\u5BA2\u6237\u7AEF\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      readSession: async (context = {}) => {
        const status = await this.#activeStatus(context.signal);
        const candidate2 = candidateFromStatus(status, {
          source: status.source,
          sourceKind: status.sourceKind
        });
        return { accounts: [await this.importAccount(candidate2, context)] };
      }
    }) : null;
    this.cliAuthorizer = createCliStatusAuthorizer({
      providerId: PROVIDER_ID7,
      cliPath,
      loginArgs: ["auth", "login", "--claudeai"],
      environment: env,
      browserOpened: true,
      instructions: "\u5DF2\u542F\u52A8\u5B98\u65B9 Claude CLI OAuth \u767B\u5F55\u3002\u8BF7\u5728 Claude \u5B98\u65B9\u7F51\u9875\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      importStatus: async (context) => {
        const status = await this.#activeStatus();
        if (!status.loggedIn || !status.isSubscription) return [];
        return [await this.importAccount(candidateFromStatus(status, {
          source: status.source,
          sourceKind: status.sourceKind
        }), context)];
      }
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID7,
      redirectUri,
      callbackPort: 0,
      authorizationCodeRequired: true,
      instructions: "\u8BF7\u5728\u5B98\u65B9 Claude \u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF0C\u7136\u540E\u5C06\u9875\u9762\u8FD4\u56DE\u7684\u6388\u6743\u7801\u7C98\u8D34\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: async ({ state, codeChallenge, redirectUri: callback }) => {
        const url = new URL(authorizationUrl);
        url.search = new URLSearchParams({
          code: "true",
          client_id: clientId,
          response_type: "code",
          redirect_uri: callback,
          scope: oauthScope,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state
        });
        return url.toString();
      },
      exchangeCode: async ({ code, state, codeVerifier, redirectUri: callback, context }) => {
        const response = await this.fetchImpl(tokenUrl, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code: code.includes("#") ? code.split("#", 1)[0] : code,
            redirect_uri: callback,
            client_id: clientId,
            code_verifier: codeVerifier,
            state
          }),
          ...context.signal ? { signal: context.signal } : {}
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(`Claude OAuth token exchange failed (${response.status})`);
          error.status = response.status;
          error.upstreamCode = body.error;
          throw error;
        }
        return body;
      },
      importCredentials: async (raw, context) => [await this.importAccount(candidateFromBrowserToken(raw, {
        source: "official_claude_browser_oauth",
        now: context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()
      }), context)]
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }
  #statusFromResult(result, defaults = {}) {
    const normalized = normalizeOfficialSessionResult(result, {
      source: defaults.source ?? "official_claude_cli",
      sourceKind: defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI
    });
    const status = parseClaudeAuthStatus(normalized?.output ?? "");
    return {
      ...status,
      source: normalized?.source ?? defaults.source ?? "official_claude_cli",
      sourceKind: normalized?.sourceKind ?? defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
      credential: normalized?.credential ?? null
    };
  }
  async #persistedOAuthCredential() {
    try {
      return await readClaudeOAuthCredential({ home: this.home });
    } catch {
      return null;
    }
  }
  async #readStatus(signal) {
    if (typeof this.sessionReader === "function") {
      try {
        const value = await this.sessionReader({ env: this.env, signal });
        const normalized2 = normalizeOfficialSessionResult(value, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind
        });
        if (normalized2) return {
          ...normalized2,
          credential: normalized2.credential ?? await this.#persistedOAuthCredential()
        };
      } catch {
      }
    }
    const result = await this.commandRunner(this.cliPath, ["auth", "status", "--json"], {
      env: this.env,
      providerId: PROVIDER_ID7,
      timeoutMs: 3e4,
      ...signal ? { signal } : {}
    });
    const normalized = normalizeOfficialSessionResult(result, {
      source: "official_claude_cli",
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.CLI
    });
    return normalized ? { ...normalized, credential: normalized.credential ?? await this.#persistedOAuthCredential() } : null;
  }
  #isBrowserAccount(account) {
    return account?.resources?.authSource === "official_claude_browser_oauth" || account?.refresh?.refreshable === true;
  }
  async #readBrowserCredential(account, context = {}) {
    if (!context.secretStore) throw new Error("A secure credential store is required");
    const credentialRef = account.auth?.credentialRef ?? account.credentialRef;
    const credential = await context.secretStore.read(credentialRef);
    if (!credential?.access) throw activeSessionError2("Claude browser OAuth credential is missing; authorize again");
    return { ...credential, credentialRef };
  }
  async #refreshBrowserCredential(account, context = {}) {
    const credential = await this.#readBrowserCredential(account, context);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const expiresAt = Date.parse(credential.expiresAt ?? "");
    if (!credential.refresh || Number.isFinite(expiresAt) && expiresAt - now.getTime() > 6e4) return credential;
    const response = await this.fetchImpl(this.browserTokenUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: credential.refresh,
        client_id: credential.clientId ?? this.browserClientId
      }),
      ...context.signal ? { signal: context.signal } : {}
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      const error = new Error(`Claude browser OAuth refresh failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    const updated = {
      ...credential,
      access: body.access_token,
      refresh: body.refresh_token ?? credential.refresh,
      expiresAt: typeof body.expires_in === "number" ? new Date(now.getTime() + body.expires_in * 1e3).toISOString() : credential.expiresAt
    };
    await context.secretStore.write(credential.credentialRef, updated);
    return updated;
  }
  async #browserStatus(account, context = {}) {
    const credential = await this.#refreshBrowserCredential(account, context);
    return {
      loggedIn: true,
      authMethod: "oauth",
      apiProvider: "firstParty",
      isApiKey: false,
      isSubscription: true,
      accountId: account.accountId,
      email: account.email,
      displayName: account.displayName,
      plan: account.subscription?.plan ?? null,
      raw: {},
      source: "official_claude_browser_oauth",
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
      credential
    };
  }
  async #activeStatus(signal, account = null, context = {}) {
    if (this.#isBrowserAccount(account)) return this.#browserStatus(account, context);
    const result = await this.#readStatus(signal);
    const status = this.#statusFromResult(result, {
      source: this.sessionSource,
      sourceKind: this.sessionSourceKind
    });
    if (!status.loggedIn || status.isApiKey || !status.isSubscription) {
      throw activeSessionError2("Claude subscription OAuth is not the active official session; authorize again");
    }
    return status;
  }
  async #assertActiveSession(account, signal, context = {}) {
    const status = await this.#activeStatus(signal, account, context);
    if (account?.accountId !== status.accountId && account?.accountId !== "claude:active") {
      throw activeSessionError2(
        "Claude only exposes its active official session; select the active account or authorize it again",
        { mismatch: true }
      );
    }
    return status;
  }
  async discover() {
    try {
      const result = await this.#readStatus();
      const status = this.#statusFromResult(result, {
        source: this.sessionSource,
        sourceKind: this.sessionSourceKind
      });
      const source = status.source ?? "official_claude_cli";
      if (!status.loggedIn) {
        return { candidates: [], source, diagnostics: ["Claude \u5B98\u65B9\u4F1A\u8BDD\u5F53\u524D\u672A\u767B\u5F55"] };
      }
      if (status.isApiKey) {
        return { candidates: [], source, diagnostics: ["Claude \u5B98\u65B9\u4F1A\u8BDD\u5F53\u524D\u4F7F\u7528 API key\uFF1B\u8BF7\u4F7F\u7528\u8BA2\u9605 OAuth \u767B\u5F55"] };
      }
      if (!status.isSubscription) {
        return { candidates: [], source, diagnostics: ["Claude \u5B98\u65B9\u4F1A\u8BDD\u4E0D\u662F\u53EF\u8BC6\u522B\u7684\u8BA2\u9605 OAuth"] };
      }
      return {
        candidates: [candidateFromStatus(status, { source, sourceKind: status.sourceKind })],
        source,
        diagnostics: []
      };
    } catch (error) {
      return { candidates: [], source: this.sessionSource, diagnostics: [`\u65E0\u6CD5\u8BFB\u53D6 Claude \u5B98\u65B9\u4F1A\u8BDD\uFF1A${error.message}`] };
    }
  }
  async importAccount(candidate2, context = {}) {
    const session = candidate2?.[CREDENTIAL_SLOT4];
    if (!session) throw new Error("Claude candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(candidate2.credentialRef, session);
    return {
      providerId: PROVIDER_ID7,
      accountId: candidate2.accountId,
      credentialRef: candidate2.credentialRef,
      displayName: candidate2.displayName,
      email: candidate2.email,
      auth: { kind: OFFICIAL_SESSION_AUTH_KIND, scopes: [] },
      subscription: { ...candidate2.subscription },
      refresh: { ...candidate2.refresh },
      resources: {
        ...officialSessionResources({
          sourceKind: candidate2.resources?.sessionSource ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI,
          authSource: candidate2.source
        }),
        transport: "anthropic_messages_sse",
        quotaSource: candidate2.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP ? "official_client_status" : candidate2.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER ? "official_browser_status" : "official_cli_status"
      }
    };
  }
  async getActiveSession(context = {}) {
    try {
      const status = await this.#activeStatus(context.signal);
      const candidate2 = candidateFromStatus(status, {
        source: status.source,
        sourceKind: status.sourceKind
      });
      const account = await this.importAccount(candidate2, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID7,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Claude \u5B98\u65B9\u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts: [account],
        diagnostic: null
      };
    } catch {
      return null;
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }
  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:") ? this.clientSessionAuthorizer : sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }
  async submitAuthorizationCode(sessionId, code, context = {}) {
    const authorizer = sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    if (typeof authorizer?.submitAuthorizationCode !== "function") {
      throw new Error("\u5F53\u524D Claude \u6388\u6743\u6D41\u7A0B\u4E0D\u63A5\u6536\u624B\u52A8\u6388\u6743\u7801");
    }
    return authorizer.submitAuthorizationCode(sessionId, code, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:") ? this.clientSessionAuthorizer : sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }
  async refreshAccount(account, context = {}) {
    if (this.#isBrowserAccount(account)) await this.#refreshBrowserCredential(account, context);
    const status = await this.#assertActiveSession(account, context.signal, context);
    return {
      identity: { email: status.email, displayName: status.displayName },
      subscription: { plan: status.plan, status: "active", expiresAt: null },
      refresh: {
        accessTokenExpiresAt: status.credential?.expiresAt ?? null,
        lastRefreshedAt: (context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()).toISOString(),
        refreshable: Boolean(status.credential?.refresh)
      }
    };
  }
  async getQuota(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const quotaSource = status.sourceKind === OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP ? "official_client_status" : "claude_cli_status";
    const windows = recursiveQuotaWindows(status.raw, { source: quotaSource, now, prefix: "claude" });
    const primary = selectPrimaryQuotaWindow(windows);
    return {
      quota: {
        remaining: primary.remaining ?? null,
        limit: primary.limit ?? null,
        unit: primary.unit ?? null,
        resetAt: primary.resetAt ?? null,
        windows,
        updatedAt: now.toISOString(),
        source: quotaSource
      },
      subscription: { plan: status.plan, status: status.isSubscription ? "active" : null, expiresAt: null },
      resources: {
        quotaDiagnostic: windows.length ? null : "Claude \u5B98\u65B9\u4F1A\u8BDD\u72B6\u6001\u672A\u8FD4\u56DE\u5B9E\u65F6\u8BA2\u9605\u989D\u5EA6\uFF1BDockyard \u4E0D\u663E\u793A\u4F30\u7B97\u767E\u5206\u6BD4"
      }
    };
  }
  async getCatalog(context = {}) {
    return this.catalogLoader({ force: Boolean(context.force) });
  }
  async invoke(request, invocation, context = {}) {
    await this.#assertActiveSession(invocation?.account, context.signal, context);
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Claude native invocation transport is not mounted");
    return executor({ request, invocation, context });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createClaudeDriver(options = {}) {
  return new ClaudeSubscriptionDriver(options);
}
var claudeDriverConstants = Object.freeze({ providerId: PROVIDER_ID7 });

// modules/provider-claude/src/index.mjs
function createClaudeModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "claude",
    displayName: "Claude",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-cursor/src/driver.mjs
import { createHash as createHash8, randomBytes as randomBytes3, randomUUID as randomUUID9 } from "node:crypto";
import { homedir as homedir10 } from "node:os";

// modules/provider-cursor/src/native-transport.mjs
import { execFileSync as execFileSync3 } from "node:child_process";
import * as http2 from "node:http2";
import { homedir as homedir9 } from "node:os";
import { join as join11 } from "node:path";
import { randomBytes as randomBytes2, randomUUID as randomUUID8 } from "node:crypto";

// modules/provider-cursor/src/native-protocol.mjs
import { createHash as createHash7, randomUUID as randomUUID7 } from "node:crypto";
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}
function encodeVarint(value) {
  let current = BigInt(Math.max(0, Number(value) || 0));
  const result = [];
  while (current >= 0x80n) {
    result.push(Number(current & 0x7fn | 0x80n));
    current >>= 7n;
  }
  result.push(Number(current));
  return Uint8Array.from(result);
}
function fieldKey(field, wireType) {
  return encodeVarint(field << 3 | wireType);
}
function bytesField(field, value) {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value instanceof Uint8Array ? value : Uint8Array.from(value ?? []);
  return concatBytes([fieldKey(field, 2), encodeVarint(bytes.byteLength), bytes]);
}
function stringField(field, value) {
  return bytesField(field, textEncoder.encode(String(value ?? "")));
}
function varintField(field, value) {
  return concatBytes([fieldKey(field, 0), encodeVarint(value)]);
}
function frameConnectMessage(message, flags = 0) {
  const payload = message instanceof Uint8Array ? message : Uint8Array.from(message ?? []);
  const header = new Uint8Array(5);
  header[0] = flags & 255;
  new DataView(header.buffer).setUint32(1, payload.byteLength, false);
  return concatBytes([header, payload]);
}
function decodeProtoFields(bytes) {
  const value = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes ?? []);
  const fields = [];
  let offset = 0;
  while (offset < value.length) {
    const key = readVarint(value, offset);
    if (!key) break;
    offset = key.offset;
    const field = Number(key.value >> 3n);
    const wireType = Number(key.value & 7n);
    if (wireType === 0) {
      const parsed = readVarint(value, offset);
      if (!parsed) break;
      offset = parsed.offset;
      fields.push({ field, wireType, value: Number(parsed.value) });
      continue;
    }
    if (wireType === 1) {
      if (offset + 8 > value.length) break;
      fields.push({ field, wireType, value: value.slice(offset, offset + 8) });
      offset += 8;
      continue;
    }
    if (wireType === 2) {
      const length = readVarint(value, offset);
      if (!length) break;
      offset = length.offset;
      const end = offset + Number(length.value);
      if (end > value.length) break;
      fields.push({ field, wireType, value: value.slice(offset, end) });
      offset = end;
      continue;
    }
    if (wireType === 5) {
      if (offset + 4 > value.length) break;
      fields.push({ field, wireType, value: value.slice(offset, offset + 4) });
      offset += 4;
      continue;
    }
    break;
  }
  return fields;
}
function readVarint(bytes, start) {
  let offset = start;
  let value = 0n;
  let shift = 0n;
  while (offset < bytes.length && shift <= 63n) {
    const byte = bytes[offset++];
    value |= BigInt(byte & 127) << shift;
    if ((byte & 128) === 0) return { value, offset };
    shift += 7n;
  }
  return null;
}
function firstBytes(fields, field) {
  return fields.find((entry) => entry.field === field && entry.wireType === 2)?.value ?? null;
}
function firstString6(fields, field) {
  const bytes = firstBytes(fields, field);
  return bytes ? textDecoder.decode(bytes) : "";
}
function sha256(bytes) {
  return new Uint8Array(createHash7("sha256").update(bytes).digest());
}
function putBlob(store, value) {
  const bytes = value instanceof Uint8Array ? value : textEncoder.encode(String(value));
  const id = sha256(bytes);
  store.set(Buffer.from(id).toString("hex"), bytes);
  return id;
}
function jsonBlob(store, value) {
  return putBlob(store, textEncoder.encode(JSON.stringify(value)));
}
function isInlineBase64(value) {
  const compact = value.replace(/\s+/g, "");
  return compact.length > 0 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
}
function normalizeText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(normalizeText).filter(Boolean).join("");
  if (!content || typeof content !== "object") return "";
  if (content.type === "image") {
    const mimeType = String(content.mimeType ?? content.mediaType ?? content.source?.media_type ?? "image/png");
    const raw = content.data ?? content.source?.data ?? content.source?.url ?? null;
    if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
      return `[Image ${mimeType}] data:${mimeType};base64,${Buffer.from(raw).toString("base64")}`;
    }
    if (typeof raw === "string" && raw.length > 0) {
      if (/^https?:\/\//i.test(raw)) return `[Image ${mimeType}] ${raw}`;
      if (raw.startsWith("data:")) return `[Image ${mimeType}] ${raw}`;
      if (!isInlineBase64(raw)) return "[image attachment without inline data]";
      return `[Image ${mimeType}] data:${mimeType};base64,${raw}`;
    }
    return "[image attachment without inline data]";
  }
  if (content.type === "tool-result" || content.type === "tool_result") {
    return `[Tool Result]
${normalizeText(content.content ?? content.output ?? content.result ?? content.text)}`;
  }
  if (content.type === "tool-call" || content.type === "tool_call") {
    return `[Tool Call ${content.name ?? "tool"}] ${content.arguments ?? "{}"}`;
  }
  return String(content.text ?? content.value ?? content.content ?? content.delta ?? "");
}
function normalizedMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    role: String(message?.role ?? "user"),
    content: normalizeText(message?.content ?? message?.text).trim()
  })).filter((message) => message.content.length > 0);
}
function encodeUserMessage(text3, messageId, mode = 1) {
  return concatBytes([stringField(1, text3), stringField(2, messageId), varintField(4, mode)]);
}
function encodeAssistantStep(text3) {
  const assistantMessage = stringField(1, text3);
  const conversationStep = bytesField(1, assistantMessage);
  return conversationStep;
}
function encodeConversationTurn(userMessageId, stepIds, requestId) {
  return concatBytes([
    bytesField(1, userMessageId),
    ...stepIds.map((id) => bytesField(2, id)),
    ...requestId ? [stringField(3, requestId)] : []
  ]);
}
function encodeConversationState(messages, blobStore, requestId) {
  const roots = [];
  const turns = [];
  const turnRecords = [];
  for (const message of messages) {
    if (message.role === "system") {
      roots.push(jsonBlob(blobStore, { role: "system", content: message.content }));
      continue;
    }
    if (message.role === "user") {
      const userMessage = { role: "user", content: [{ type: "text", text: message.content }] };
      roots.push(jsonBlob(blobStore, userMessage));
      turnRecords.push({ text: message.content, steps: [] });
      continue;
    }
    if (message.role === "assistant") {
      roots.push(jsonBlob(blobStore, { role: "assistant", content: [{ type: "text", text: message.content }] }));
      turnRecords.at(-1)?.steps.push(putBlob(blobStore, encodeAssistantStep(message.content)));
      continue;
    }
    const resultText = `[Tool Result]
${message.content}`;
    roots.push(jsonBlob(blobStore, { role: "user", content: [{ type: "text", text: resultText }] }));
    turnRecords.at(-1)?.steps.push(putBlob(blobStore, encodeAssistantStep(resultText)));
  }
  for (const record of turnRecords.slice(0, -1)) {
    const userMessageId = putBlob(blobStore, encodeUserMessage(record.text, randomUUID7()));
    const turn = encodeConversationTurn(userMessageId, record.steps, requestId);
    turns.push(putBlob(blobStore, turn));
  }
  return concatBytes([
    ...roots.map((id) => bytesField(1, id)),
    ...turns.map((id) => bytesField(8, id))
  ]);
}
function encodeRequestContext(timeZone = "UTC") {
  const env = stringField(10, timeZone);
  const requestContext = bytesField(4, env);
  return bytesField(2, requestContext);
}
function encodeModelDetails(model) {
  return concatBytes([
    stringField(1, model),
    stringField(3, model),
    stringField(4, model),
    stringField(5, model)
  ]);
}
function encodeMcpTools(tools) {
  const supported = (Array.isArray(tools) ? tools : []).map((tool) => {
    const name2 = String(tool?.name ?? tool?.function?.name ?? "").trim();
    if (!name2) return null;
    const fn = tool?.function ?? tool;
    const definition = concatBytes([
      stringField(1, name2),
      stringField(4, "opencodex-responses"),
      stringField(5, name2),
      stringField(2, fn?.description ?? "")
      // Cursor accepts a protobuf Value. A JSON string is intentionally not
      // sent here; unsupported schemas are omitted so the Agent turn does not
      // enter the heartbeat-only state caused by an invalid Value payload.
    ]);
    return bytesField(1, definition);
  }).filter(Boolean);
  return concatBytes(supported);
}
function encodeAgentRunRequest({
  messages,
  model,
  requestId = randomUUID7(),
  conversationId = requestId,
  tools = [],
  timeZone = "UTC"
} = {}) {
  const normalized = normalizedMessages(messages);
  const blobStore = /* @__PURE__ */ new Map();
  const latestUserIndex = normalized.map((message) => message.role).lastIndexOf("user");
  const latestUserText = latestUserIndex >= 0 ? normalized[latestUserIndex].content : normalized.at(-1)?.content ?? "Continue the conversation.";
  const priorConversation = latestUserIndex > 0 ? normalized.slice(0, latestUserIndex).filter((message) => message.role !== "system").map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`).join("\n\n") : "";
  const userText = priorConversation ? `Conversation history:
${priorConversation}

Current user message:
${latestUserText}` : latestUserText;
  const userMessage = encodeUserMessage(userText, requestId, 1);
  const userAction = concatBytes([
    bytesField(1, userMessage),
    encodeRequestContext(timeZone)
  ]);
  const action = bytesField(1, userAction);
  const run = concatBytes([
    bytesField(1, encodeConversationState(normalized, blobStore, requestId)),
    bytesField(2, action),
    bytesField(3, encodeModelDetails(String(model ?? ""))),
    bytesField(4, encodeMcpTools(tools)),
    stringField(5, conversationId)
  ]);
  const clientMessage = bytesField(1, run);
  return { frame: frameConnectMessage(clientMessage), blobs: blobStore, requestId, conversationId };
}
function encodeHeartbeat() {
  return frameConnectMessage(bytesField(7, new Uint8Array()));
}
function decodeConnectFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (buffer.length - offset >= 5) {
    const flags = buffer[offset];
    const length = new DataView(buffer.buffer, buffer.byteOffset + offset + 1, 4).getUint32(0, false);
    if (buffer.length - offset - 5 < length) break;
    frames.push({ flags, payload: buffer.slice(offset + 5, offset + 5 + length) });
    offset += 5 + length;
  }
  return { frames, rest: buffer.slice(offset) };
}
function cursorFrameMetadata(message, flags = null) {
  const bytes = message instanceof Uint8Array ? message : Uint8Array.from(message ?? []);
  const fieldPaths = [];
  const visit = (value, prefix = [], depth = 0) => {
    if (depth > 4 || fieldPaths.length >= 64) return;
    for (const field of decodeProtoFields(value).slice(0, 32)) {
      const path2 = [...prefix, field.field].join(".");
      fieldPaths.push({ path: path2, wireType: field.wireType, byteLength: field.value instanceof Uint8Array ? field.value.byteLength : null });
      if (field.wireType === 2) visit(field.value, [...prefix, field.field], depth + 1);
      if (fieldPaths.length >= 64) return;
    }
  };
  visit(bytes);
  return {
    ...Number.isInteger(flags) ? { flags } : {},
    payloadLength: bytes.byteLength,
    fieldPaths
  };
}
function decodeCursorConnectTrailer(payload) {
  const bytes = payload instanceof Uint8Array ? payload : Uint8Array.from(payload ?? []);
  const text3 = textDecoder.decode(bytes).trim();
  if (!text3) return null;
  if (text3.startsWith("{")) {
    let parsed = null;
    try {
      parsed = JSON.parse(text3);
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === "object") {
      const error = parsed.error && typeof parsed.error === "object" ? parsed.error : null;
      const rawCode = error ? error.code : parsed.status ?? parsed.code;
      const label = rawCode === void 0 || rawCode === null || !String(rawCode).trim() ? null : grpcStatusLabel(rawCode);
      if (!label) {
        if (!error) return null;
        const fallbackMessage = typeof error.message === "string" && error.message.trim() ? error.message.trim().slice(0, 500) : "CURSOR_CONNECT_ERROR";
        return { code: "CURSOR_CONNECT_ERROR", message: fallbackMessage };
      }
      const messageSource = error?.message ?? parsed.message;
      return {
        code: label,
        message: typeof messageSource === "string" && messageSource.trim() ? messageSource.trim().slice(0, 500) : label
      };
    }
  }
  const status = decodeGoogleRpcStatus(bytes);
  if (status) {
    const code = grpcStatusLabel(status.code);
    return {
      code,
      message: status.message.trim() ? status.message.trim().slice(0, 500) : code
    };
  }
  return { code: "CURSOR_CONNECT_ERROR", message: text3.slice(0, 500) };
}
var GRPC_STATUS_NAMES = /* @__PURE__ */ new Map([
  [0, "OK"],
  [1, "CANCELLED"],
  [2, "UNKNOWN"],
  [3, "INVALID_ARGUMENT"],
  [4, "DEADLINE_EXCEEDED"],
  [5, "NOT_FOUND"],
  [6, "ALREADY_EXISTS"],
  [7, "PERMISSION_DENIED"],
  [8, "RESOURCE_EXHAUSTED"],
  [9, "FAILED_PRECONDITION"],
  [10, "ABORTED"],
  [11, "OUT_OF_RANGE"],
  [12, "UNIMPLEMENTED"],
  [13, "INTERNAL"],
  [14, "UNAVAILABLE"],
  [15, "DATA_LOSS"],
  [16, "UNAUTHENTICATED"]
]);
function grpcStatusLabel(value) {
  const text3 = String(value ?? "").trim();
  if (/^\d+$/.test(text3)) return GRPC_STATUS_NAMES.get(Number(text3)) ?? text3;
  return text3;
}
function cursorGrpcStatusFlags(code) {
  const label = grpcStatusLabel(code).toUpperCase();
  const flags = {};
  if (label === "UNAUTHENTICATED") flags.authExpired = true;
  else if (label === "PERMISSION_DENIED") flags.authForbidden = true;
  if (label === "RESOURCE_EXHAUSTED") flags.quotaExhausted = true;
  return flags;
}
function decodeGoogleRpcStatus(payload) {
  const bytes = payload instanceof Uint8Array ? payload : Uint8Array.from(payload ?? []);
  let offset = 0;
  let code = null;
  let message = "";
  while (offset < bytes.length) {
    const key = readVarint(bytes, offset);
    if (!key) return null;
    offset = key.offset;
    const field = Number(key.value >> 3n);
    const wireType = Number(key.value & 7n);
    if (field === 1 && wireType === 0) {
      const value = readVarint(bytes, offset);
      if (!value) return null;
      const numeric = Number(BigInt.asIntN(32, value.value));
      if (!Number.isInteger(numeric) || numeric < 0 || numeric > 16) return null;
      code = numeric;
      offset = value.offset;
      continue;
    }
    if ((field === 2 || field === 3) && wireType === 2) {
      const length = readVarint(bytes, offset);
      if (!length) return null;
      const end = length.offset + Number(length.value);
      if (end > bytes.length) return null;
      if (field === 2) message = textDecoder.decode(bytes.slice(length.offset, end));
      offset = end;
      continue;
    }
    return null;
  }
  if (code === null && message.length === 0) return null;
  return { code: code ?? 2, message };
}
function decodeCursorText(message) {
  try {
    const interaction = firstBytes(decodeProtoFields(message), 1);
    if (!interaction) return "";
    const update = firstBytes(decodeProtoFields(interaction), 1);
    if (!update) return "";
    return firstString6(decodeProtoFields(update), 1);
  } catch {
    return "";
  }
}
function cursorTurnComplete(message) {
  try {
    const interaction = firstBytes(decodeProtoFields(message), 1);
    if (!interaction) return false;
    return decodeProtoFields(interaction).some((field) => field.wireType === 2 && [14, 18, 19].includes(field.field));
  } catch {
    return false;
  }
}
function decodeKvRequest(message) {
  const kv = firstBytes(decodeProtoFields(message), 4);
  if (!kv) return null;
  const fields = decodeProtoFields(kv);
  const id = fields.find((field) => field.field === 1 && field.wireType === 0)?.value ?? 0;
  const getArgs = firstBytes(fields, 2);
  const setArgs = firstBytes(fields, 3);
  if (getArgs) return { id, kind: "get", blobId: firstBytes(decodeProtoFields(getArgs), 1) };
  if (setArgs) return { id, kind: "set" };
  return null;
}
function encodeKvResponse(request, blobs) {
  if (request.kind === "get") {
    const key = request.blobId ? Buffer.from(request.blobId).toString("hex") : "";
    const value = blobs.get(key) ?? new Uint8Array();
    const result = bytesField(1, value);
    return frameConnectMessage(bytesField(3, concatBytes([varintField(1, request.id), bytesField(2, result)])));
  }
  return frameConnectMessage(bytesField(3, concatBytes([varintField(1, request.id), bytesField(3, new Uint8Array())])));
}
function decodeCursorKvRequest(message) {
  return decodeKvRequest(message);
}
var CURSOR_TOOL_CALL_UPDATE_FIELDS = /* @__PURE__ */ new Map([
  [2, "tool_call_started"],
  [3, "tool_call_completed"],
  [7, "partial_tool_call"],
  [15, "tool_call_delta"]
]);
var CURSOR_TOOL_KINDS = /* @__PURE__ */ new Map([
  [1, "shell"],
  [3, "delete"],
  [4, "glob"],
  [5, "grep"],
  [8, "read"],
  [9, "update-todos"],
  [10, "read-todos"],
  [12, "edit"],
  [13, "ls"],
  [14, "read-lints"],
  [15, "mcp"],
  [16, "sem-search"],
  [17, "create-plan"],
  [18, "web-search"],
  [19, "task"],
  [20, "list-mcp-resources"],
  [21, "read-mcp-resource"],
  [22, "apply-agent-diff"],
  [23, "ask-question"],
  [24, "fetch"],
  [25, "switch-mode"],
  [26, "exa-search"],
  [27, "exa-fetch"],
  [28, "generate-image"],
  [29, "record-screen"],
  [30, "computer-use"],
  [31, "write-shell-stdin"],
  [32, "reflect"],
  [33, "setup-vm-environment"],
  [34, "truncated-tool-call"]
]);
function decodeCursorToolMessage(message) {
  try {
    const interaction = firstBytes(decodeProtoFields(message), 1);
    if (!interaction) return null;
    const updates = decodeProtoFields(interaction).filter((field) => field.wireType === 2 && CURSOR_TOOL_CALL_UPDATE_FIELDS.has(field.field));
    if (updates.length === 0) return null;
    let callId = "";
    let toolKind = null;
    for (const update of updates.slice(0, 8)) {
      const fields = decodeProtoFields(update.value);
      callId = callId || firstString6(fields, 1);
      const toolCall = firstBytes(fields, 2);
      const kindField = toolCall ? decodeProtoFields(toolCall).find((field) => CURSOR_TOOL_KINDS.has(field.field)) : null;
      if (kindField) toolKind = CURSOR_TOOL_KINDS.get(kindField.field);
    }
    return {
      updates: updates.map((update) => CURSOR_TOOL_CALL_UPDATE_FIELDS.get(update.field)),
      ...callId ? { callId } : {},
      ...toolKind ? { toolKind } : {}
    };
  } catch {
    return null;
  }
}
var cursorNativeProtocolConstants = Object.freeze({
  endpoint: "https://agent.api5.cursor.sh/agent.v1.AgentService/Run",
  providerIdentifier: "opencodex-responses"
});

// modules/provider-cursor/src/native-transport.mjs
var PROVIDER_ID8 = "cursor";
var DEFAULT_ENDPOINT4 = cursorNativeProtocolConstants.endpoint;
var DEFAULT_TOTAL_TIMEOUT_MS = 12e4;
var DEFAULT_IDLE_TIMEOUT_MS = 3e4;
var DEFAULT_CURSOR_CLIENT_VERSION = "cli-2025.09.17-agent-host";
var CURSOR_SESSION_KEYS = [
  "cursorAuth/accessToken",
  "cursorAuth/refreshToken",
  "cursorAuth/cachedEmail",
  "cursorAuth/stripeMembershipType"
];
function firstString7(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function createAsyncQueue() {
  const values = [];
  const waiters = [];
  let closed = false;
  let failure = null;
  return {
    push(value) {
      if (closed || failure) return;
      const waiter = waiters.shift();
      if (waiter) waiter.resolve({ value, done: false });
      else values.push(value);
    },
    close() {
      if (closed || failure) return;
      closed = true;
      while (waiters.length) waiters.shift().resolve({ value: void 0, done: true });
    },
    fail(error) {
      if (closed || failure) return;
      failure = error;
      while (waiters.length) waiters.shift().reject(error);
    },
    async next() {
      if (values.length) return { value: values.shift(), done: false };
      if (failure) throw failure;
      if (closed) return { value: void 0, done: true };
      return new Promise((resolve2, reject) => waiters.push({ resolve: resolve2, reject }));
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
function readCursorDesktopSession({
  credential,
  env = process.env,
  home = homedir9()
} = {}) {
  const stored = firstString7(credential?.access, credential?.token);
  if (stored) {
    return {
      token: stored,
      refreshToken: firstString7(credential?.refresh, credential?.refreshToken),
      expiresAt: firstString7(credential?.expiresAt, credential?.expires_at),
      email: firstString7(credential?.email),
      plan: firstString7(credential?.plan),
      kind: "oauth",
      source: "dockyard_credential"
    };
  }
  const fromEnv = firstString7(env.CURSOR_API_KEY, env.DOCKYARD_CURSOR_ACCESS_TOKEN);
  if (fromEnv) return { token: fromEnv, kind: "apiKey", source: "environment" };
  if (process.platform !== "darwin") return null;
  const dbPath = join11(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb");
  try {
    const quotedKeys = CURSOR_SESSION_KEYS.map((key) => `'${key}'`).join(",");
    const output = execFileSync3("sqlite3", ["-json", dbPath, `SELECT key, CAST(value AS TEXT) AS value FROM ItemTable WHERE key IN (${quotedKeys});`], {
      encoding: "utf8",
      timeout: 5e3,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const rows = JSON.parse(output || "[]");
    const valueFor = (key) => rows.find((row) => row.key === key)?.value;
    const access2 = valueFor("cursorAuth/accessToken");
    return access2 ? {
      token: access2,
      refreshToken: firstString7(valueFor("cursorAuth/refreshToken")),
      email: firstString7(valueFor("cursorAuth/cachedEmail")),
      plan: firstString7(valueFor("cursorAuth/stripeMembershipType")),
      kind: "oauth",
      source: "cursor_desktop_app"
    } : null;
  } catch {
    return null;
  }
}
function resolveCursorAccessToken(options = {}) {
  const session = readCursorDesktopSession(options);
  return session ? { token: session.token, kind: session.kind, ...session.expiresAt ? { expiresAt: session.expiresAt } : {} } : null;
}
function cursorHeaders(endpoint2, token, requestId, env) {
  const clientVersion = env.DOCKYARD_CURSOR_CLIENT_VERSION || DEFAULT_CURSOR_CLIENT_VERSION;
  const clientKey = randomBytes2(32).toString("hex");
  return {
    ":method": "POST",
    ":path": `${endpoint2.pathname}${endpoint2.search}`,
    ":scheme": "https",
    ":authority": endpoint2.host,
    authorization: `Bearer ${token}`,
    "content-type": "application/connect+proto",
    accept: "application/connect+proto",
    "connect-protocol-version": "1",
    "x-request-id": requestId,
    "x-cursor-client-version": clientVersion,
    "x-cursor-client-type": "cli",
    "x-cursor-client-key": clientKey,
    "x-cursor-streaming": "true"
  };
}
function cursorStatusError(status) {
  return nativeProviderError(PROVIDER_ID8, `Cursor AgentService returned HTTP ${status}`, { status });
}
function streamCursor({
  endpoint: endpoint2,
  token,
  request,
  context,
  http2Module = http2,
  timeoutMs = DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS
}) {
  return (async function* cursorStream() {
    const requestId = firstString7(request.requestId, context.requestId, randomUUID8());
    const conversationId = firstString7(request.sessionId, context.sessionId, requestId);
    const model = firstString7(request.model);
    if (!model) throw nativeProviderError(PROVIDER_ID8, "Cursor model is missing");
    const timeZone = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      } catch {
        return "UTC";
      }
    })();
    const encoded = encodeAgentRunRequest({
      messages: request.messages,
      model,
      requestId,
      conversationId,
      // Cursor's AgentService uses its own native tool/exec protocol. Keep
      // this request on the text path until DSH's tool bridge answers those
      // bidirectional ExecServer messages; no CLI prompt is involved.
      tools: [],
      timeZone
    });
    const url = new URL(endpoint2);
    const session = http2Module.connect(url.origin);
    const queue = createAsyncQueue();
    let stream = null;
    let responseStatus = 0;
    let responseBuffer = new Uint8Array();
    const responseDiagnostics = [];
    const protocolError = (message, code) => {
      const error = nativeProviderError(PROVIDER_ID8, message, { code });
      if (responseDiagnostics.length > 0) error.cursorDiagnostics = responseDiagnostics.slice(0, 32);
      return error;
    };
    let completed = false;
    let cleaned = false;
    let heartbeat;
    let totalTimer;
    let idleTimer;
    const timeoutFailure = (message, code) => {
      const error = nativeProviderError(PROVIDER_ID8, message, { code });
      error.code = code;
      queue.fail(error);
      stream?.close(http2Module.constants?.NGHTTP2_CANCEL);
      session.close();
    };
    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => timeoutFailure("Cursor AgentService response idle timeout", "ETIMEDOUT"), idleTimeoutMs);
      idleTimer.unref?.();
    };
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      clearInterval(heartbeat);
      clearTimeout(totalTimer);
      clearTimeout(idleTimer);
      context.signal?.removeEventListener?.("abort", onAbort);
      if (stream && !stream.destroyed && !stream.closed) stream.close();
      if (!session.closed && !session.destroyed) session.close();
    };
    const onAbort = () => {
      const error = nativeProviderError(PROVIDER_ID8, "Cursor request aborted");
      error.code = "ABORT_ERR";
      queue.fail(error);
      stream?.close(http2Module.constants?.NGHTTP2_CANCEL);
      session.close();
    };
    totalTimer = setTimeout(() => timeoutFailure("Cursor AgentService total request timeout", "ETIMEDOUT"), timeoutMs);
    totalTimer.unref?.();
    armIdleTimer();
    context.signal?.addEventListener?.("abort", onAbort, { once: true });
    if (context.signal?.aborted) onAbort();
    session.once("error", (error) => queue.fail(error));
    try {
      stream = session.request(cursorHeaders(url, token, requestId, context.env ?? process.env));
      stream.once("response", (headers) => {
        armIdleTimer();
        responseStatus = Number(headers[":status"] ?? 0);
        if (responseStatus >= 400) queue.fail(cursorStatusError(responseStatus));
      });
      stream.on("data", (chunk) => {
        armIdleTimer();
        const incoming = new Uint8Array(chunk);
        const merged = new Uint8Array(responseBuffer.byteLength + incoming.byteLength);
        merged.set(responseBuffer);
        merged.set(incoming, responseBuffer.byteLength);
        const decoded = decodeConnectFrames(merged);
        responseBuffer = decoded.rest;
        for (const frame of decoded.frames) {
          if ((frame.flags & 2) !== 0) {
            const trailer = decodeCursorConnectTrailer(frame.payload);
            if (trailer) {
              let displayMessage = trailer.message;
              if (displayMessage.includes("Grok Build isn't available for this account yet")) {
                displayMessage = `${trailer.message} (\u5F53\u524D Cursor \u8D26\u53F7\u4E3A\u514D\u8D39\u7248 Free\uFF0CCursor \u5B98\u65B9 Agent \u8FD0\u884C\u63A5\u53E3\u9700\u8981 Pro \u6216\u8BA2\u9605\u6743\u9650)`;
              }
              const error = nativeProviderError(PROVIDER_ID8, displayMessage, {
                code: trailer.code,
                body: { code: trailer.code, message: displayMessage }
              });
              Object.assign(error, cursorGrpcStatusFlags(trailer.code));
              queue.fail(error);
            } else {
              completed = true;
              queue.push({ type: "complete" });
            }
            continue;
          }
          if ((frame.flags & 1) !== 0) {
            responseDiagnostics.push(cursorFrameMetadata(frame.payload, frame.flags));
            queue.fail(protocolError("Cursor returned a compressed protobuf frame", "CURSOR_COMPRESSED_RESPONSE"));
            continue;
          }
          const kv = decodeCursorKvRequest(frame.payload);
          if (kv) {
            try {
              stream?.write(Buffer.from(encodeKvResponse(kv, encoded.blobs)));
            } catch (error) {
              queue.fail(error);
            }
            continue;
          }
          const toolCall = decodeCursorToolMessage(frame.payload);
          if (toolCall) {
            queue.fail(protocolError(
              `Cursor AgentService requested an unsupported native tool call${toolCall.toolKind ? ` (${toolCall.toolKind})` : ""}${toolCall.callId ? ` [${toolCall.callId}]` : ""}; DSH's Cursor transport does not execute server-side tools`,
              "CURSOR_UNSUPPORTED_TOOL_CALL"
            ));
            continue;
          }
          const text4 = decodeCursorText(frame.payload);
          const turnComplete = cursorTurnComplete(frame.payload);
          if (text4) queue.push({ type: "text", text: text4 });
          if (!text4) responseDiagnostics.push(cursorFrameMetadata(frame.payload, frame.flags));
          if (turnComplete) {
            completed = true;
            queue.push({ type: "complete" });
          }
        }
      });
      stream.once("end", () => {
        if (responseBuffer.byteLength > 0) {
          responseDiagnostics.push({
            payloadLength: responseBuffer.byteLength,
            incomplete: true
          });
          queue.fail(protocolError("Cursor AgentService returned an incomplete Connect frame", "CURSOR_INCOMPLETE_RESPONSE"));
        } else {
          queue.close();
        }
      });
      stream.once("error", (error) => queue.fail(error));
      stream.write(Buffer.from(encoded.frame));
      heartbeat = setInterval(() => {
        if (!stream || stream.destroyed || stream.closed) return;
        try {
          stream.write(Buffer.from(encodeHeartbeat()));
        } catch {
        }
      }, 5e3);
      let text3 = "";
      let failed = false;
      yield { type: "block-start", index: 0, blockType: "text" };
      try {
        for await (const item of queue) {
          if (item.type === "text") {
            text3 += item.text;
            yield { type: "text-delta", index: 0, text: item.text };
          } else if (item.type === "complete") {
            completed = true;
            break;
          }
        }
      } catch (error) {
        failed = true;
        if (error?.status === 401 || error?.status === 403) error.authExpired = error.status === 401;
        throw error;
      } finally {
        cleanup();
      }
      if (!failed) {
        if (!completed) {
          throw protocolError("Cursor AgentService ended before completing the turn", "CURSOR_INCOMPLETE_RESPONSE");
        }
        if (text3.trim().length === 0) {
          throw protocolError("Cursor AgentService completed without assistant text", "CURSOR_EMPTY_RESPONSE");
        }
        yield { type: "block-end", index: 0, block: { type: "text", text: text3 } };
        yield { type: "finish", reason: { kind: "stop" } };
      }
    } catch (error) {
      cleanup();
      throw error;
    }
  })();
}
function createCursorNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_CURSOR_ENDPOINT || DEFAULT_ENDPOINT4,
  env = process.env,
  home = homedir9(),
  tokenResolver = resolveCursorAccessToken,
  http2Module = http2,
  timeoutMs = Number(process.env.DOCKYARD_CURSOR_TIMEOUT_MS) || DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs = Number(process.env.DOCKYARD_CURSOR_IDLE_TIMEOUT_MS) || DEFAULT_IDLE_TIMEOUT_MS
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID8 });
  const executor = async ({ request = {}, invocation, context = {} } = {}) => {
    let credential = null;
    if (context.secretStore) {
      const ref = invocation?.auth?.credentialRef ?? invocation?.account?.auth?.credentialRef ?? invocation?.account?.credentialRef;
      if (ref) credential = await context.secretStore.read(ref);
    }
    const auth = await tokenResolver({ credential, env: { ...env, ...context.env ?? {} }, home });
    if (!auth?.token) {
      const error = nativeProviderError(PROVIDER_ID8, "Cursor OAuth token is unavailable; authorize Cursor first");
      error.authExpired = true;
      throw error;
    }
    if (auth.expiresAt) {
      const expiry = Date.parse(auth.expiresAt);
      if (Number.isFinite(expiry) && expiry <= Date.now()) {
        const error = nativeProviderError(PROVIDER_ID8, "Cursor OAuth access token expired; authorize Cursor again", {
          code: "CURSOR_TOKEN_EXPIRED"
        });
        error.authExpired = true;
        throw error;
      }
    }
    return streamCursor({
      endpoint: safeEndpoint,
      token: auth.token,
      request,
      context,
      http2Module,
      timeoutMs,
      idleTimeoutMs
    });
  };
  executor.nativeTransport = "cursor-connect-agent-service";
  return executor;
}
var cursorNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID8,
  endpoint: DEFAULT_ENDPOINT4,
  clientVersion: DEFAULT_CURSOR_CLIENT_VERSION,
  totalTimeoutMs: DEFAULT_TOTAL_TIMEOUT_MS,
  idleTimeoutMs: DEFAULT_IDLE_TIMEOUT_MS
});

// modules/provider-cursor/src/driver.mjs
var PROVIDER_ID9 = "cursor";
var CREDENTIAL_SLOT5 = Symbol("dockyard-cursor-session");
function hash5(value) {
  return createHash8("sha256").update(String(value)).digest("hex");
}
function firstString8(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function normalizeTokenExpiry(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1e3;
    const date2 = new Date(millis);
    return Number.isNaN(date2.getTime()) ? null : date2.toISOString();
  }
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function cursorTokenExpiresAt(raw = {}, payload = {}) {
  const direct = normalizeTokenExpiry(raw.expiresAt ?? raw.expires_at);
  if (direct) return direct;
  const expiresIn = raw.expiresIn ?? raw.expires_in;
  if (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0) {
    return new Date(Date.now() + expiresIn * 1e3).toISOString();
  }
  return normalizeTokenExpiry(payload.exp);
}
function tokenIsExpired(value, now = Date.now()) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp <= now;
}
function tokenNeedsRefresh2(value, now = Date.now(), leewayMs = 6e4) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) && timestamp <= now + leewayMs;
}
function statusObject2(output) {
  return parseJsonOutput(output) ?? {};
}
function statusValue(value, ...keys) {
  for (const key of keys) {
    const parts = key.split(".");
    let current = value;
    for (const part of parts) current = current?.[part];
    if (typeof current === "string" && current.length > 0) return current;
    if (typeof current === "number" || typeof current === "boolean") return current;
    if (Array.isArray(current)) return current;
    if (current && typeof current === "object") return current;
  }
  return null;
}
function parseTextEmail(output) {
  return String(output).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}
function parseCursorAuthStatus(output) {
  const raw = statusObject2(output);
  const email = firstString8(
    statusValue(raw, "email", "user.email", "account.email", "accountEmail"),
    parseTextEmail(output)
  );
  const explicitLoggedIn = statusValue(raw, "loggedIn", "authenticated", "isAuthenticated");
  const text3 = String(output);
  const loggedIn = typeof explicitLoggedIn === "boolean" ? explicitLoggedIn : !/not authenticated|not logged in|unauthenticated|please login/i.test(text3) && /authenticated|logged in|account|endpoint/i.test(text3);
  const accountId = firstString8(
    statusValue(raw, "accountId", "account_id", "userId", "user_id", "user.id", "account.id"),
    email,
    "cursor:active"
  );
  const plan = firstString8(
    statusValue(raw, "plan", "planName", "subscription.plan", "subscription.name", "tier", "subscriptionTier")
  );
  const displayName = firstString8(statusValue(raw, "name", "user.name", "account.name"), email, accountId);
  const models = [
    statusValue(raw, "models"),
    statusValue(raw, "availableModels"),
    statusValue(raw, "modelCatalog")
  ].find((value) => Array.isArray(value)) ?? [];
  return {
    loggedIn,
    accountId,
    email,
    plan,
    displayName,
    models,
    raw
  };
}
function activeSessionError3(message, { mismatch = false } = {}) {
  const error = new Error(message);
  error.authExpired = true;
  if (mismatch) error.accountMismatch = true;
  return error;
}
function candidateFromStatus2(status, {
  source = "official_cursor_cli",
  sourceKind = OFFICIAL_SESSION_SOURCE_KINDS.CLI,
  imported = false,
  credential = null
} = {}) {
  const credentialRef = createCredentialRef(PROVIDER_ID9, status.accountId);
  const candidate2 = {
    candidateId: `cursor:${hash5(status.accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID9,
    source,
    accountId: status.accountId,
    displayName: status.displayName ?? status.accountId,
    email: status.email,
    subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
    refresh: {
      accessTokenExpiresAt: null,
      nextRefreshAt: null,
      lastRefreshedAt: null,
      refreshable: false
    },
    credentialRef,
    resources: officialSessionResources({ sourceKind, authSource: source }),
    imported,
    status: status.loggedIn ? "available" : "degraded",
    diagnostic: status.loggedIn ? null : "Cursor \u5B98\u65B9\u4F1A\u8BDD\u5F53\u524D\u672A\u8FD4\u56DE\u5DF2\u767B\u5F55\u72B6\u6001"
  };
  Object.defineProperty(candidate2, CREDENTIAL_SLOT5, {
    value: credential ?? {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID9,
      accountId: status.accountId,
      sourceKind
    },
    enumerable: false
  });
  return candidate2;
}
async function resolveCursorBrowserEmail(raw, access2, {
  fetchImpl = null,
  apiBaseUrl = "https://api2.cursor.sh",
  home = homedir10(),
  signal
} = {}) {
  const payload = decodeJwtPayload(access2) ?? {};
  const direct = firstString8(
    raw?.email,
    raw?.user?.email,
    raw?.profile?.email,
    payload.email,
    payload.user_email,
    payload.email_address,
    payload["https://cursor.com/email"]
  );
  if (direct) return direct;
  try {
    const desktop = readCursorDesktopSession({ home });
    if (desktop?.email) return desktop.email;
  } catch {
  }
  if (typeof fetchImpl !== "function") return null;
  try {
    const response = await fetchImpl(`${apiBaseUrl.replace(/\/+$/, "")}/aiserver.v1.AuthService/GetEmail`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${access2}`
      },
      body: "{}",
      ...signal ? { signal } : {}
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => ({}));
    return firstString8(body?.email, body?.user?.email, body?.profile?.email);
  } catch {
    return null;
  }
}
async function candidateFromBrowserTokens(raw, options = {}) {
  const access2 = firstString8(raw?.accessToken, raw?.access_token);
  const refresh = firstString8(raw?.refreshToken, raw?.refresh_token);
  if (!access2 || !refresh) throw new Error("Cursor browser login did not return access and refresh tokens");
  const payload = decodeJwtPayload(access2) ?? {};
  const expiresAt = cursorTokenExpiresAt(raw, payload);
  const email = await resolveCursorBrowserEmail(raw, access2, options);
  const accountId = firstString8(raw.accountId, raw.account_id, raw.userId, raw.user_id, payload.sub, payload.user_id, email) ?? `cursor:${hash5(access2).slice(0, 20)}`;
  const candidate2 = candidateFromStatus2({
    loggedIn: true,
    accountId,
    email,
    plan: firstString8(raw.plan, raw.subscription?.plan, raw.membershipType, payload.plan),
    displayName: firstString8(raw.name, raw.user?.name, email, accountId)
  }, {
    source: "official_cursor_browser_oauth",
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER,
    credential: {
      type: "oauth",
      providerId: PROVIDER_ID9,
      accountId,
      access: access2,
      refresh,
      ...expiresAt ? { expiresAt } : {},
      email,
      sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.BROWSER
    }
  });
  candidate2.refresh = {
    ...candidate2.refresh,
    accessTokenExpiresAt: expiresAt,
    refreshable: true
  };
  return candidate2;
}
function desktopSessionAccountId(session) {
  return session.email ? `cursor:${hash5(session.email.toLowerCase()).slice(0, 20)}` : "cursor:desktop";
}
function statusFromDesktopSession(session) {
  return {
    source: "cursor_desktop_app",
    sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    loggedIn: true,
    accountId: session.accountId,
    email: session.email,
    plan: session.plan,
    displayName: session.email ?? "Cursor desktop session",
    models: [],
    raw: {
      source: "cursor_desktop_app",
      loggedIn: true,
      email: session.email,
      plan: session.plan
    }
  };
}
function candidateFromDesktopSession(session) {
  const accountId = session.accountId ?? desktopSessionAccountId(session);
  const expiresAt = cursorTokenExpiresAt({}, decodeJwtPayload(session.token) ?? {});
  const candidate2 = {
    candidateId: `cursor:desktop:${hash5(accountId).slice(0, 20)}`,
    providerId: PROVIDER_ID9,
    source: "cursor_desktop_app",
    accountId,
    displayName: session.email ?? "Cursor desktop session",
    email: session.email,
    subscription: { plan: session.plan, status: "active", expiresAt: null },
    refresh: {
      accessTokenExpiresAt: expiresAt,
      nextRefreshAt: null,
      lastRefreshedAt: null,
      refreshable: Boolean(session.refreshToken)
    },
    credentialRef: createCredentialRef(PROVIDER_ID9, accountId),
    imported: false,
    status: "available",
    diagnostic: null,
    resources: {
      ...officialSessionResources({
        sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
        authSource: "cursor_desktop_app"
      }),
      transport: "cursor_connect_agent_service",
      identitySource: "cursor_desktop_app",
      sessionPersistence: "captured",
      quotaSource: "cursor_desktop_app"
    }
  };
  Object.defineProperty(candidate2, CREDENTIAL_SLOT5, {
    value: {
      type: OFFICIAL_SESSION_AUTH_KIND,
      providerId: PROVIDER_ID9,
      accountId,
      access: session.token,
      ...session.refreshToken ? { refresh: session.refreshToken } : {},
      ...expiresAt ? { expiresAt } : {}
    },
    enumerable: false
  });
  return candidate2;
}
function summarizeCursorCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID9,
    candidateId: candidate2.candidateId,
    source: candidate2.source,
    accountId: candidate2.accountId,
    displayName: candidate2.displayName,
    email: candidate2.email,
    subscription: { ...candidate2.subscription },
    refresh: { ...candidate2.refresh },
    imported: Boolean(candidate2.imported),
    status: candidate2.status ?? "available",
    diagnostic: candidate2.diagnostic ?? null
  };
}
function effortName2(id) {
  return String(id).replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
function extractCursorReasoning(value) {
  if (value.reasoning && Array.isArray(value.reasoning.efforts) && value.reasoning.efforts.length > 0) {
    return value.reasoning;
  }
  const paramDefs = Array.isArray(value.parameterDefinitions) ? value.parameterDefinitions : [];
  const effortParam = paramDefs.find((param) => param?.id === "reasoning_effort" || param?.id === "effort" || param?.id === "reasoning");
  const enumValues = effortParam?.parameterType?.enumParameter?.values;
  if (Array.isArray(enumValues) && enumValues.length > 0) {
    const validValues = enumValues.filter((entry) => entry?.value && entry.value !== "none" && entry.value !== "off");
    if (validValues.length > 0) {
      const efforts = validValues.map((entry) => ({
        id: entry.value,
        name: firstString8(entry.displayName, effortName2(entry.value))
      }));
      const defaultEffort = efforts.some((e) => e.id === "medium") ? "medium" : efforts.some((e) => e.id === "low") ? "low" : efforts[0]?.id;
      return { efforts, ...defaultEffort ? { defaultEffort } : {} };
    }
  }
  if (value.supportsThinking || value.supports_thinking) {
    return {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    };
  }
  return null;
}
function normalizeModel(value) {
  if (typeof value === "string") return { id: value, name: value };
  if (!value || typeof value !== "object") return null;
  const id = firstString8(value.id, value.model, value.modelId, value.name);
  if (!id) return null;
  const contextWindow = value.contextWindow ?? value.context_window ?? value.contextTokenLimit ?? value.context_token_limit;
  const maxTokens = value.maxTokens ?? value.max_tokens ?? value.maxOutputTokens ?? value.max_output_tokens;
  const inputModalities = value.input ?? value.inputModalities ?? value.input_modalities ?? (value.supportsImages || value.supports_images ? ["text", "image"] : null);
  const reasoning = extractCursorReasoning(value);
  return {
    id,
    name: firstString8(
      value.clientDisplayName,
      value.client_display_name,
      value.displayName,
      value.display_name,
      value.name,
      value.label,
      id
    ),
    ...Number.isInteger(contextWindow) ? { contextWindow } : {},
    ...Number.isInteger(maxTokens) ? { maxTokens } : {},
    ...Array.isArray(inputModalities) ? { inputModalities: [...inputModalities] } : {},
    ...reasoning ? { reasoning } : {}
  };
}
function browserCatalogAccount(accounts) {
  return (Array.isArray(accounts) ? accounts : []).find((entry) => entry?.resources?.sessionSource === OFFICIAL_SESSION_SOURCE_KINDS.BROWSER || entry?.resources?.authSource === "official_cursor_browser_oauth");
}
function createCursorCatalogLoader({
  cliPath = process.env.DOCKYARD_CURSOR_CLI || "cursor-agent",
  env = process.env,
  commandRunner = runCliCommand,
  apiBaseUrl = process.env.CURSOR_API_BASE_URL || "https://api2.cursor.sh",
  fetchImpl = fetch
} = {}) {
  const cachedBuckets = /* @__PURE__ */ new Map();
  const pendingBuckets = /* @__PURE__ */ new Map();
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
  function catalogBucketKey(accounts) {
    const account = browserCatalogAccount(accounts);
    const identity = account?.auth?.credentialRef ?? account?.credentialRef ?? account?.accountId;
    return identity ? String(identity) : "shared";
  }
  async function loadBrowserCatalog({ accounts, secretStore, signal }) {
    const account = browserCatalogAccount(accounts);
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef ?? (account?.accountId ? createCredentialRef(PROVIDER_ID9, account.accountId) : null);
    if (!account || !credentialRef || typeof secretStore?.read !== "function") return null;
    const credential = await secretStore.read(credentialRef);
    if (!credential?.access) return null;
    const response = await fetchImpl(`${normalizedApiBaseUrl}/aiserver.v1.AiService/AvailableModels`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${credential.access}`
      },
      body: JSON.stringify({
        isNightly: false,
        excludeMaxNamedModels: true,
        additionalModelNames: [],
        useModelParameters: true,
        useReactModelPicker: true
      }),
      ...signal ? { signal } : {}
    });
    if (!response.ok) return null;
    const body = await response.json().catch(() => ({}));
    const values = Array.isArray(body?.models) ? body.models : body?.modelNames ?? body?.model_names;
    const models = (Array.isArray(values) ? values : []).map(normalizeModel).filter(Boolean);
    if (models.length === 0) return null;
    return {
      models,
      source: "official_cursor_browser_oauth_api"
    };
  }
  return async function loadCatalog({ force = false, accounts = [], secretStore, signal } = {}) {
    const bucketKey = catalogBucketKey(accounts);
    const hasBrowserAccount = bucketKey !== "shared";
    const cached = cachedBuckets.get(bucketKey);
    if (!force && cached && (hasBrowserAccount ? cached.source === "official_cursor_browser_oauth_api" : cached.source !== "official_cursor_browser_oauth_api")) return cached;
    const pending = pendingBuckets.get(bucketKey);
    if (pending) return pending;
    const promise = (async () => {
      try {
        const browser = await loadBrowserCatalog({ accounts, secretStore, signal });
        if (browser) {
          cachedBuckets.set(bucketKey, browser);
          return browser;
        }
      } catch {
      }
      try {
        const result = await commandRunner(cliPath, ["status"], {
          env,
          providerId: PROVIDER_ID9,
          timeoutMs: 3e4,
          ...signal ? { signal } : {}
        });
        const status = parseCursorAuthStatus(result.output);
        const models = status.models.map(normalizeModel).filter(Boolean);
        const catalog = {
          models,
          source: "official_cursor_cli_status",
          ...models.length ? {} : { diagnostics: ["Cursor \u5B98\u65B9 status \u6CA1\u6709\u8FD4\u56DE\u6A21\u578B\u76EE\u5F55"] }
        };
        if (models.length) cachedBuckets.set(bucketKey, catalog);
        else cachedBuckets.delete(bucketKey);
        return catalog;
      } catch (error) {
        const desktop = readCursorDesktopSession({ env });
        const catalog = {
          models: [],
          source: error?.code === "ENOENT" ? desktop ? "cursor_desktop_app" : "cursor_cli_not_found" : "official_cursor_cli_status",
          diagnostics: [desktop ? "\u5DF2\u68C0\u6D4B\u5230 Cursor \u5B98\u65B9 OAuth\uFF1B\u5B98\u65B9\u6A21\u578B\u76EE\u5F55\u8BF7\u6C42\u672A\u8FD4\u56DE\u7ED3\u679C" : `\u65E0\u6CD5\u8BFB\u53D6 Cursor \u5B98\u65B9\u6A21\u578B\u76EE\u5F55\uFF1A${error.message}`]
        };
        cachedBuckets.delete(bucketKey);
        return catalog;
      }
    })().finally(() => {
      pendingBuckets.delete(bucketKey);
    });
    pendingBuckets.set(bucketKey, promise);
    return promise;
  };
}
var CursorSubscriptionDriver = class {
  constructor({
    cliPath = process.env.DOCKYARD_CURSOR_CLI || "cursor-agent",
    env = process.env,
    home = homedir10(),
    commandRunner = runCliCommand,
    requestExecutor = null,
    catalogLoader = null,
    sessionReader = null,
    sessionSource = "official_cursor_client",
    sessionSourceKind = OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP,
    oauthAuthorizer = null,
    browserAuthorizer = null,
    browserOAuth = env.DOCKYARD_CURSOR_BROWSER_OAUTH !== "0",
    websiteUrl = env.CURSOR_WEBSITE_URL || "https://cursor.com",
    apiBaseUrl = env.CURSOR_API_BASE_URL || "https://api2.cursor.sh",
    refreshUrl = env.CURSOR_REFRESH_URL || `${apiBaseUrl}/auth/exchange_user_api_key`,
    fetchImpl = fetch
  } = {}) {
    this.cliPath = cliPath;
    this.env = env;
    this.home = home;
    this.commandRunner = commandRunner;
    this.requestExecutor = requestExecutor;
    this.fetchImpl = fetchImpl;
    this.websiteUrl = websiteUrl.replace(/\/+$/, "");
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    const refreshEndpoint = new URL(refreshUrl);
    if (refreshEndpoint.protocol !== "https:") {
      throw new Error("Cursor OAuth refresh endpoint must use HTTPS");
    }
    this.refreshUrl = refreshEndpoint.toString().replace(/\/$/, "");
    this.sessionReader = sessionReader;
    this.sessionSource = sessionSource;
    this.sessionSourceKind = sessionSourceKind;
    this.catalogLoader = catalogLoader ?? createCursorCatalogLoader({
      cliPath,
      env,
      commandRunner,
      apiBaseUrl: this.apiBaseUrl,
      fetchImpl: this.fetchImpl
    });
    this.clientSessionAuthorizer = createOfficialSessionAuthorizer({
      providerId: PROVIDER_ID9,
      source: sessionSource,
      instructions: "\u8BF7\u5728 Cursor \u5B98\u65B9\u5BA2\u6237\u7AEF\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      readSession: async (context = {}) => {
        const status = this.sessionReader ? await this.#readStatus(context.signal) : (() => {
          const desktop2 = this.#readDesktopSession();
          return desktop2 ? statusFromDesktopSession(desktop2) : null;
        })();
        if (!status?.loggedIn) return { accounts: [] };
        const desktop = status.source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
        const candidate2 = desktop ? candidateFromDesktopSession(desktop) : candidateFromStatus2(status, { source: status.source, sourceKind: status.sourceKind });
        return { accounts: [await this.importAccount(candidate2, context)] };
      }
    });
    this.cliAuthorizer = createCliStatusAuthorizer({
      providerId: PROVIDER_ID9,
      cliPath,
      loginArgs: ["login"],
      environment: env,
      browserOpened: true,
      instructions: "\u5DF2\u542F\u52A8\u5B98\u65B9 Cursor CLI OAuth \u767B\u5F55\u3002\u8BF7\u5728 Cursor \u5B98\u65B9\u7F51\u9875\u5B8C\u6210\u767B\u5F55\uFF0C\u5B8C\u6210\u540E\u56DE\u5230 Dockyard DSH\u3002",
      importStatus: async (context) => {
        const status = await this.#readStatus();
        if (!status.loggedIn) return [];
        return [await this.importAccount(candidateFromStatus2(status, {
          source: status.source,
          sourceKind: status.sourceKind
        }), context)];
      }
    });
    this.browserAuthorizer = browserAuthorizer ?? (browserOAuth ? createBrowserOAuthAuthorizer({
      providerId: PROVIDER_ID9,
      instructions: "\u8BF7\u5728\u5B98\u65B9 Cursor \u6388\u6743\u9875\u9762\u9009\u62E9\u8D26\u53F7\u5E76\u5B8C\u6210\u6388\u6743\uFF1B\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u8FD4\u56DE Dockyard DSH\u3002",
      authorizationUrlBuilder: async () => {
        const verifier = randomBytes3(32).toString("base64url");
        const challenge = createHash8("sha256").update(verifier).digest("base64url");
        const uuid = randomUUID9();
        return {
          url: `${this.websiteUrl}/loginDeepControl?${new URLSearchParams({
            challenge,
            uuid,
            mode: "login",
            redirectTarget: "cli"
          })}`,
          metadata: { uuid, verifier }
        };
      },
      pollSession: async ({ metadata, context }) => {
        if (!metadata?.uuid || !metadata.verifier) return null;
        const response = await this.fetchImpl(`${this.apiBaseUrl}/auth/poll?${new URLSearchParams({
          uuid: metadata.uuid,
          verifier: metadata.verifier
        })}`, {
          headers: { "content-type": "application/json" },
          ...context.signal ? { signal: context.signal } : {}
        });
        if (response.status === 404) return null;
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Cursor browser OAuth polling failed (${response.status})`);
        return body?.accessToken && body?.refreshToken ? body : null;
      },
      importCredentials: async (raw, context) => [await this.importAccount(await candidateFromBrowserTokens(raw, {
        fetchImpl: this.fetchImpl,
        apiBaseUrl: this.apiBaseUrl,
        home: this.home,
        signal: context.signal
      }), context)]
    }) : null);
    this.oauthAuthorizer = oauthAuthorizer ?? this.browserAuthorizer ?? this.cliAuthorizer;
  }
  #readDesktopSession() {
    const session = readCursorDesktopSession({ env: this.env, home: this.home });
    if (!session?.token || session.source !== "cursor_desktop_app") return null;
    return {
      ...session,
      accountId: desktopSessionAccountId(session)
    };
  }
  #statusFromResult(result, defaults = {}) {
    const normalized = normalizeOfficialSessionResult(result, {
      source: defaults.source ?? "official_cursor_cli",
      sourceKind: defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI
    });
    const status = parseCursorAuthStatus(normalized?.output ?? "");
    return {
      ...status,
      source: normalized?.source ?? defaults.source ?? "official_cursor_cli",
      sourceKind: normalized?.sourceKind ?? defaults.sourceKind ?? OFFICIAL_SESSION_SOURCE_KINDS.CLI
    };
  }
  async #readStatus(signal) {
    if (typeof this.sessionReader === "function") {
      try {
        const value = await this.sessionReader({ env: this.env, home: this.home, signal });
        const normalized = normalizeOfficialSessionResult(value, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind
        });
        if (normalized) return this.#statusFromResult(normalized, {
          source: this.sessionSource,
          sourceKind: this.sessionSourceKind
        });
      } catch {
      }
    }
    try {
      const result = await this.commandRunner(this.cliPath, ["status"], {
        env: this.env,
        providerId: PROVIDER_ID9,
        timeoutMs: 3e4,
        ...signal ? { signal } : {}
      });
      const status = this.#statusFromResult(result, {
        source: "official_cursor_cli",
        sourceKind: OFFICIAL_SESSION_SOURCE_KINDS.CLI
      });
      if (status.loggedIn) return status;
      const desktop = this.#readDesktopSession();
      return desktop ? statusFromDesktopSession(desktop) : status;
    } catch (error) {
      const desktop = this.#readDesktopSession();
      if (desktop) return statusFromDesktopSession(desktop);
      throw error;
    }
  }
  #isBrowserAccount(account) {
    return account?.resources?.authSource === "official_cursor_browser_oauth" || account?.refresh?.refreshable === true;
  }
  async #refreshBrowserCredential(account, context = {}) {
    const credentialRef = account?.auth?.credentialRef ?? account?.credentialRef;
    const credential = context.secretStore && credentialRef ? await context.secretStore.read(credentialRef) : null;
    if (!credential?.access) throw activeSessionError3("Cursor browser OAuth credential is missing; authorize again");
    const expiresAt = cursorTokenExpiresAt(credential, decodeJwtPayload(credential.access) ?? {});
    const now = context.now instanceof Date ? context.now.getTime() : Date.now();
    if (!tokenNeedsRefresh2(expiresAt, now)) return credential;
    if (!credential.refresh) throw activeSessionError3("Cursor browser OAuth token expired; authorize again");
    let response;
    try {
      response = await this.fetchImpl(this.refreshUrl, {
        method: "POST",
        headers: {
          authorization: `Bearer ${credential.refresh}`,
          "content-type": "application/json",
          accept: "application/json"
        },
        body: "{}",
        ...context.signal ? { signal: context.signal } : {}
      });
    } catch (error) {
      const wrapped = activeSessionError3("Cursor browser OAuth access token expired and refresh failed; authorize again");
      wrapped.cause = error;
      throw wrapped;
    }
    const body = await response.json().catch(() => ({}));
    const access2 = firstString8(body?.accessToken, body?.access_token);
    if (!response.ok || !access2) {
      const error = activeSessionError3("Cursor browser OAuth access token expired and refresh failed; authorize again");
      error.status = response.status;
      throw error;
    }
    const refresh = firstString8(body?.refreshToken, body?.refresh_token, credential.refresh);
    const refreshedExpiresAt = cursorTokenExpiresAt({
      expiresAt: body?.expiresAt ?? body?.expires_at,
      expiresIn: body?.expiresIn ?? body?.expires_in
    }, decodeJwtPayload(access2) ?? {});
    const updated = {
      ...credential,
      access: access2,
      refresh,
      ...refreshedExpiresAt ? { expiresAt: refreshedExpiresAt } : {},
      lastRefreshedAt: new Date(now).toISOString()
    };
    await context.secretStore.write(credentialRef, updated);
    return updated;
  }
  async #browserStatus(account, context = {}) {
    const credential = await this.#refreshBrowserCredential(account, context);
    const expiresAt = cursorTokenExpiresAt(credential, decodeJwtPayload(credential.access) ?? {});
    if (tokenIsExpired(expiresAt)) {
      throw activeSessionError3("Cursor browser OAuth access token expired; authorize again");
    }
    const email = account.email ?? await resolveCursorBrowserEmail({}, credential.access, {
      fetchImpl: this.fetchImpl,
      apiBaseUrl: this.apiBaseUrl,
      home: this.home,
      signal: context.signal
    });
    return {
      loggedIn: true,
      accountId: account.accountId,
      email,
      displayName: email ?? account.displayName,
      plan: account.subscription?.plan ?? null,
      credential,
      raw: {}
    };
  }
  async #assertActiveSession(account, signal, context = {}) {
    if (this.#isBrowserAccount(account)) return this.#browserStatus(account, context);
    const status = await this.#readStatus(signal);
    if (!status.loggedIn) throw activeSessionError3("Cursor OAuth session is not active; authorize again");
    if (account?.accountId !== status.accountId && account?.accountId !== "cursor:active") {
      throw activeSessionError3(
        "Cursor only exposes its active official session; authorize the selected account again",
        { mismatch: true }
      );
    }
    return status;
  }
  async discover() {
    try {
      const status = await this.#readStatus();
      const source = status.source ?? "official_cursor_cli";
      if (!status.loggedIn) return { candidates: [], source, diagnostics: ["Cursor \u5B98\u65B9\u73AF\u5883\u5F53\u524D\u672A\u767B\u5F55"] };
      const desktop = source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
      const candidate2 = desktop ? candidateFromDesktopSession(desktop) : candidateFromStatus2(status, { source, sourceKind: status.sourceKind });
      return { candidates: candidate2 ? [candidate2] : [], source, diagnostics: [] };
    } catch (error) {
      return { candidates: [], source: "official_cursor_cli", diagnostics: [`\u65E0\u6CD5\u8BFB\u53D6 Cursor \u5B98\u65B9\u767B\u5F55\u6001\uFF1A${error.message}`] };
    }
  }
  async importAccount(candidate2, context = {}) {
    const session = candidate2?.[CREDENTIAL_SLOT5];
    if (!session) throw new Error("Cursor candidate is no longer available; scan again");
    if (!context.secretStore) throw new Error("A secure credential store is required");
    await context.secretStore.write(candidate2.credentialRef, session);
    return {
      providerId: PROVIDER_ID9,
      accountId: candidate2.accountId,
      credentialRef: candidate2.credentialRef,
      displayName: candidate2.displayName,
      email: candidate2.email,
      auth: {
        kind: OFFICIAL_SESSION_AUTH_KIND,
        scopes: []
      },
      subscription: { ...candidate2.subscription },
      refresh: { ...candidate2.refresh },
      resources: {
        ...officialSessionResources({
          sourceKind: candidate2.resources?.sessionSource ?? (candidate2.source === "cursor_desktop_app" ? OFFICIAL_SESSION_SOURCE_KINDS.DESKTOP_APP : OFFICIAL_SESSION_SOURCE_KINDS.CLI),
          authSource: candidate2.source
        }),
        transport: "cursor_agentservice_connect_proto",
        quotaSource: candidate2.resources?.quotaSource ?? "official_cursor_cli_status",
        ...candidate2.resources ?? {}
      }
    };
  }
  async getActiveSession(context = {}) {
    try {
      const status = await this.#readStatus(context.signal);
      if (!status.loggedIn) return null;
      const desktop = status.source === "cursor_desktop_app" ? this.#readDesktopSession() : null;
      const candidate2 = desktop ? candidateFromDesktopSession(desktop) : candidateFromStatus2(status, {
        source: status.source,
        sourceKind: status.sourceKind
      });
      const account = await this.importAccount(candidate2, context);
      return {
        status: "completed",
        providerId: PROVIDER_ID9,
        instructions: "\u5DF2\u68C0\u6D4B\u5230 Cursor \u5B98\u65B9\u4F1A\u8BDD\uFF0C\u5F53\u524D\u8D26\u53F7\u5DF2\u63A5\u5165 Dockyard DSH\u3002",
        accounts: [account],
        diagnostic: null
      };
    } catch {
      return null;
    }
  }
  async startAuthorization(context = {}) {
    if (this.oauthAuthorizer !== this.browserAuthorizer || !this.browserAuthorizer) {
      return this.oauthAuthorizer.begin(context);
    }
    const started = await this.browserAuthorizer.begin(context);
    if (started.status === "failed") return this.cliAuthorizer.begin(context);
    return started;
  }
  async pollAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:") ? this.clientSessionAuthorizer : sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.poll(sessionId, context);
  }
  async cancelAuthorization(sessionId, context = {}) {
    const authorizer = sessionId?.includes(":official-session:") ? this.clientSessionAuthorizer : sessionId?.includes(":browser:") ? this.browserAuthorizer : this.oauthAuthorizer === this.browserAuthorizer ? this.cliAuthorizer : this.oauthAuthorizer;
    return authorizer.cancel(sessionId, context);
  }
  async refreshAccount(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    return {
      identity: { email: status.email, displayName: status.displayName },
      subscription: { plan: status.plan, status: "active", expiresAt: null },
      refresh: {
        accessTokenExpiresAt: this.#isBrowserAccount(account) ? cursorTokenExpiresAt(status.credential, decodeJwtPayload(status.credential?.access ?? "") ?? {}) : account.refresh?.accessTokenExpiresAt ?? null,
        lastRefreshedAt: (context.now instanceof Date ? context.now : /* @__PURE__ */ new Date()).toISOString(),
        refreshable: this.#isBrowserAccount(account) ? Boolean(status.credential?.refresh) : false
      }
    };
  }
  async getQuota(account, context = {}) {
    const status = await this.#assertActiveSession(account, context.signal, context);
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    const quotaSource = this.#isBrowserAccount(account) ? "official_cursor_browser_oauth" : "cursor_cli_status";
    const windows = recursiveQuotaWindows(status.raw, { source: quotaSource, now, prefix: "cursor" });
    if (windows.length === 0) {
      return {
        quota: null,
        subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
        resources: {
          quotaSource,
          quotaAvailable: false,
          quotaDiagnostic: this.#isBrowserAccount(account) ? "Cursor \u5B98\u65B9\u6D4F\u89C8\u5668\u4F1A\u8BDD\u672A\u8FD4\u56DE\u4EFB\u4F55\u5B9E\u65F6\u989D\u5EA6\u7A97\u53E3\uFF1B\u989D\u5EA6\u6570\u636E\u6682\u4E0D\u53EF\u7528\uFF08degraded\uFF09\uFF0C\u8BF7\u4EE5 Cursor \u5B98\u65B9 Dashboard \u4E3A\u51C6" : "Cursor \u5B98\u65B9 CLI status \u672A\u8FD4\u56DE\u4EFB\u4F55\u5B9E\u65F6\u989D\u5EA6\u7A97\u53E3\uFF1B\u989D\u5EA6\u6570\u636E\u6682\u4E0D\u53EF\u7528\uFF08degraded\uFF09\uFF0C\u8BF7\u4EE5 Cursor \u5B98\u65B9 Dashboard \u4E3A\u51C6"
        }
      };
    }
    const primary = selectPrimaryQuotaWindow(windows);
    return {
      quota: {
        remaining: primary.remaining ?? null,
        limit: primary.limit ?? null,
        unit: primary.unit ?? null,
        resetAt: primary.resetAt ?? null,
        windows,
        updatedAt: now.toISOString(),
        source: quotaSource
      },
      subscription: { plan: status.plan, status: status.loggedIn ? "active" : null, expiresAt: null },
      resources: {
        quotaAvailable: true,
        quotaDiagnostic: null
      }
    };
  }
  async getCatalog(context = {}) {
    return this.catalogLoader({
      force: Boolean(context.force),
      accounts: context.accounts,
      secretStore: context.secretStore,
      signal: context.signal
    });
  }
  async invoke(request, invocation, context = {}) {
    await this.#assertActiveSession(invocation?.account, context.signal, context);
    const executor = context.requestExecutor ?? this.requestExecutor;
    if (typeof executor !== "function") throw new Error("Cursor native invocation transport is not mounted");
    return executor({ request, invocation, context });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createCursorDriver(options = {}) {
  return new CursorSubscriptionDriver(options);
}
var cursorDriverConstants = Object.freeze({ providerId: PROVIDER_ID9 });

// modules/provider-cursor/src/index.mjs
function createCursorModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "cursor",
    displayName: "Cursor",
    capabilities: [
      "oauth_discovery",
      "oauth_import",
      "oauth_authorization",
      "oauth_refresh",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-opencode/src/driver.mjs
var BUILTIN_OPENCODE_FREE_MODELS = Object.freeze([
  {
    id: "big-pickle",
    name: "Big Pickle (Free)",
    free: true,
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "beam-free",
    name: "Beam (Free)",
    contextWindow: 131072,
    maxTokens: 8192
  },
  {
    id: "mimo-v2.6-flash-free",
    name: "MIMO v2.6 Flash (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "nemotron-3.5-super-vl-free",
    name: "Nemotron 3.5 Super VL (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    inputModalities: ["text", "image"]
  },
  {
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning (Free)",
    contextWindow: 131072,
    maxTokens: 8192
  },
  {
    id: "nemotron-3-ultra-free",
    name: "Nemotron 3 Ultra (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "jev-1.13-free",
    name: "JEV 1.13 (Free)",
    contextWindow: 131072,
    maxTokens: 8192
  },
  {
    id: "longcat-2.5-preview-free",
    name: "Longcat 2.5 Preview (Free)",
    contextWindow: 131072,
    maxTokens: 8192
  },
  {
    id: "flint-40b-free",
    name: "Flint 40B (Free)",
    contextWindow: 131072,
    maxTokens: 8192
  },
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek v4.1 Flash (Free)",
    contextWindow: 2e5,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "high", name: "High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "glm-5.3-flash-free",
    name: "GLM 5.3 Flash (Free)",
    contextWindow: 204800,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "high", name: "High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "minimax-m3.1-flash-free",
    name: "MiniMax M3.1 Flash (Free)",
    contextWindow: 131072,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "qwen3.6-plus-free",
    name: "Qwen 3.6 Plus (Free)",
    contextWindow: 262144,
    maxTokens: 8192,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (OpenCode)",
    contextWindow: 1e6,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "minimal", name: "Minimal" },
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "medium"
    }
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash (OpenCode)",
    contextWindow: 1048576,
    maxTokens: 16384
  }
]);
function summarizeOpencodeCandidate(candidate2) {
  return candidate2?.displayName ?? candidate2?.email ?? candidate2?.accountId ?? "OpenCode Free";
}

// modules/provider-kilo/src/driver.mjs
var PROVIDER_ID10 = "kilo";
var STANDARD_KILO_REASONING_EFFORTS = Object.freeze([
  { id: "low", name: "Low", description: "\u5FEB\u901F\u601D\u8003\uFF0C\u4FDD\u7559\u57FA\u7840\u63A8\u7406" },
  { id: "medium", name: "Medium", description: "\u6807\u51C6\u601D\u8003\uFF0C\u5E73\u8861\u63A8\u7406\u6DF1\u5EA6\u4E0E\u54CD\u5E94\u901F\u5EA6" },
  { id: "high", name: "High", description: "\u6DF1\u5EA6\u601D\u8003\uFF0C\u9002\u5408\u590D\u6742\u903B\u8F91\u4E0E\u591A\u6B65\u9AA4\u5206\u6790" }
]);
var EXTENDED_KILO_REASONING_EFFORTS = Object.freeze([
  { id: "low", name: "Low", description: "\u5FEB\u901F\u601D\u8003\uFF0C\u4FDD\u7559\u57FA\u7840\u63A8\u7406" },
  { id: "medium", name: "Medium", description: "\u6807\u51C6\u601D\u8003\uFF0C\u5E73\u8861\u63A8\u7406\u6DF1\u5EA6\u4E0E\u54CD\u5E94\u901F\u5EA6" },
  { id: "high", name: "High", description: "\u6DF1\u5EA6\u601D\u8003\uFF0C\u9002\u5408\u590D\u6742\u903B\u8F91\u4E0E\u591A\u6B65\u9AA4\u5206\u6790" },
  { id: "max", name: "Max", description: "\u6781\u81F4\u601D\u8003\uFF0C\u6700\u9AD8\u903B\u8F91\u63A8\u5BFC\u6DF1\u5EA6" }
]);
var DEFAULT_KILO_REASONING = Object.freeze({
  efforts: [...STANDARD_KILO_REASONING_EFFORTS],
  defaultEffort: "medium"
});
var EXTENDED_KILO_REASONING = Object.freeze({
  efforts: [...EXTENDED_KILO_REASONING_EFFORTS],
  defaultEffort: "medium"
});
var BUILTIN_KILO_FREE_MODELS = Object.freeze([
  {
    id: "kilo-auto/free",
    name: "Auto Free (Kilo)",
    contextWindow: 256e3,
    maxTokens: 32768,
    inputModalities: ["text"],
    reasoning: DEFAULT_KILO_REASONING,
    free: true
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA Nemotron 3.5 Super VL (Free)",
    contextWindow: 1e6,
    maxTokens: 131072,
    inputModalities: ["text", "image", "video"],
    free: true
  },
  {
    id: "reflection/beam-free",
    name: "Reflection Beam 1.0 (Free)",
    contextWindow: 1048576,
    maxTokens: 131072,
    inputModalities: ["text"],
    free: true
  },
  {
    id: "inclusionai/ling-3.1-flash-1019-free",
    name: "inclusionAI Ling 3.1 Flash (Free)",
    contextWindow: 1e6,
    maxTokens: 262144,
    inputModalities: ["text"],
    free: true
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA Nemotron 3 Ultra (Free)",
    contextWindow: 1e6,
    maxTokens: 65536,
    inputModalities: ["text"],
    reasoning: EXTENDED_KILO_REASONING,
    free: true
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 Lightning (Free)",
    contextWindow: 1e6,
    maxTokens: 65536,
    inputModalities: ["text"],
    free: true
  },
  {
    id: "recursive/flint-v1.0:free",
    name: "Recursive Flint (Free)",
    contextWindow: 262144,
    maxTokens: 235929,
    inputModalities: ["text"],
    free: true
  },
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Poolside Laguna S 2.1 (Free)",
    contextWindow: 262144,
    maxTokens: 32768,
    inputModalities: ["text"],
    free: true
  },
  {
    id: "openrouter/free",
    name: "OpenRouter Free Models Router",
    contextWindow: 2e5,
    maxTokens: 32768,
    inputModalities: ["text", "image"],
    reasoning: DEFAULT_KILO_REASONING,
    free: true
  },
  {
    id: "stealth/glyph-cluster",
    name: "Stealth Glyph Cluster (Free)",
    contextWindow: 256e3,
    maxTokens: 256e3,
    inputModalities: ["text"],
    free: true
  }
]);
function summarizeKiloCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID10,
    candidateId: candidate2?.candidateId ?? "kilo-free",
    accountId: candidate2?.accountId ?? "kilo-free",
    displayName: candidate2?.displayName ?? "Kilo Free Tier",
    email: candidate2?.email ?? "free@kilo.ai",
    source: candidate2?.source ?? "kilo_free_tier"
  };
}

// modules/provider-commandcode/src/driver.mjs
import { createHash as createHash10 } from "node:crypto";
import { existsSync as existsSync5, readdirSync, readFileSync as readFileSync4 } from "node:fs";
import { homedir as homedir12 } from "node:os";
import { join as join13 } from "node:path";

// modules/provider-commandcode/src/native-transport.mjs
import { createHash as createHash9, randomBytes as randomBytes4, randomUUID as randomUUID10 } from "node:crypto";
import { existsSync as existsSync4, readFileSync as readFileSync3 } from "node:fs";
import { homedir as homedir11 } from "node:os";
import { join as join12 } from "node:path";
function firstString9(...values) {
  for (const val of values) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}
var PROVIDER_ID11 = "commandcode";
var DEFAULT_COMMANDCODE_GENERATE_ENDPOINT = "https://api.commandcode.ai/alpha/generate";
var DEFAULT_COMMANDCODE_WHOAMI_ENDPOINT = "https://api.commandcode.ai/alpha/whoami";
var DEFAULT_COMMANDCODE_CREDITS_ENDPOINT = "https://api.commandcode.ai/alpha/billing/credits";
var DEFAULT_COMMANDCODE_SUBSCRIPTIONS_ENDPOINT = "https://api.commandcode.ai/alpha/billing/subscriptions";
var DEFAULT_COMMANDCODE_MODELS_ENDPOINT = "https://api.commandcode.ai/provider/v1/models?view=client";
function findCommandCodeAuthFilePath() {
  if (process.env.COMMAND_CODE_AUTH_PATH && existsSync4(process.env.COMMAND_CODE_AUTH_PATH)) {
    return process.env.COMMAND_CODE_AUTH_PATH;
  }
  const candidate2 = join12(homedir11(), ".commandcode", "auth.json");
  if (existsSync4(candidate2)) return candidate2;
  return null;
}
function extractCommandCodeAuth({ force = false } = {}) {
  const envKey = firstString9(process.env.COMMAND_CODE_API_KEY, process.env.COMMANDCODE_API_KEY);
  if (envKey) {
    return {
      apiKey: envKey,
      userId: process.env.COMMAND_CODE_USER_ID || "env-user",
      userName: process.env.COMMAND_CODE_USER_NAME || "API Key User",
      source: "env"
    };
  }
  const authPath = findCommandCodeAuthFilePath();
  if (!authPath) return null;
  try {
    const raw = readFileSync3(authPath, "utf8");
    const json = JSON.parse(raw);
    if (!json?.apiKey) return null;
    return {
      apiKey: json.apiKey,
      userId: json.userId || null,
      userName: json.userName || null,
      keyName: json.keyName || null,
      authenticatedAt: json.authenticatedAt || null,
      source: "local_auth_json"
    };
  } catch {
    return null;
  }
}
function toWireTools(tools = []) {
  if (!Array.isArray(tools) || tools.length === 0) return null;
  return tools.map((tool) => {
    const fn = tool.function || tool;
    const name2 = fn.name || tool.name;
    const description = fn.description || tool.description || "";
    const inputSchema = fn.parameters || fn.input_schema || tool.input_schema || tool.parameters || { type: "object", properties: {} };
    return {
      name: name2,
      description,
      input_schema: inputSchema
    };
  });
}
function isLikelyReasoningModel(modelId = "") {
  const m = String(modelId || "").toLowerCase();
  return m.includes("beam") || m.includes("r1") || m.includes("reason") || m.includes("reflection") || m.includes("deepseek-r") || m.includes("qwq") || m.includes("qvq") || m.includes("deepseek-reasoner");
}
async function buildCommandCodeMessages(request = {}, attachments = null) {
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  let systemPrompt = "";
  const wireMessages = [];
  const toolNameById = /* @__PURE__ */ new Map();
  const needsReasoningPadding = isLikelyReasoningModel(request.model) || Boolean(request.reasoning?.effort);
  for (const msg of rawMessages) {
    if (!msg) continue;
    const role = msg.role;
    if (role === "system") {
      const text3 = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
      if (text3) {
        systemPrompt = systemPrompt ? `${systemPrompt}

${text3}` : text3;
      }
      continue;
    }
    if (role === "assistant") {
      let reasoningContent = firstString9(
        msg.reasoning_content,
        msg.reasoning,
        msg.thought,
        msg.thinking
      );
      if (Array.isArray(msg.content)) {
        const content = [];
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            content.push({ type: "text", text: block.text });
          } else if (block.type === "reasoning" || block.type === "thinking") {
            const rText = block.text || block.thinking || "";
            if (rText) {
              content.push({ type: "reasoning", text: rText });
              if (!reasoningContent) reasoningContent = rText;
            }
          } else if (block.type === "tool_use" || block.type === "tool-call") {
            const rawId = block.id || block.toolCallId || `call_${randomUUID10().slice(0, 8)}`;
            const toolCallId = sanitizeToolCallId(rawId);
            const toolName = block.name || block.toolName || "tool";
            toolNameById.set(toolCallId, toolName);
            const rawInput = block.arguments ?? block.input ?? block.args ?? {};
            let input = rawInput;
            if (typeof rawInput === "string") {
              try {
                input = JSON.parse(rawInput);
              } catch {
                input = { raw: rawInput };
              }
            }
            content.push({
              type: "tool-call",
              toolCallId,
              toolName,
              input: input && typeof input === "object" ? input : {}
            });
          }
        }
        const asstMsg = {
          role: "assistant",
          content: content.length > 0 ? content : [{ type: "text", text: "" }]
        };
        if (reasoningContent) {
          asstMsg.reasoning_content = reasoningContent;
        } else if (needsReasoningPadding) {
          asstMsg.reasoning_content = "";
        }
        wireMessages.push(asstMsg);
      } else {
        const text3 = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
        const asstMsg = { role: "assistant", content: text3 || "" };
        if (reasoningContent) {
          asstMsg.reasoning_content = reasoningContent;
        } else if (needsReasoningPadding) {
          asstMsg.reasoning_content = "";
        }
        wireMessages.push(asstMsg);
      }
      continue;
    }
    if (role === "tool") {
      const rawId = msg.tool_call_id || msg.toolCallId;
      const toolCallId = sanitizeToolCallId(rawId || "unknown");
      const toolName = msg.name || msg.toolName || (toolCallId ? toolNameById.get(toolCallId) : null) || "unknown";
      const text3 = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
      wireMessages.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: toolCallId || "unknown",
            toolName,
            output: { type: "text", value: text3 || "" }
          }
        ]
      });
      continue;
    }
    if (Array.isArray(msg.content)) {
      const parts = [];
      for (const block of msg.content) {
        if (block.type === "text" && block.text) {
          parts.push({ type: "text", text: block.text });
        } else if (block.type === "image") {
          const resolved = await resolveImageData(block, attachments);
          if (!resolved) {
            throw nativeProviderError(
              PROVIDER_ID11,
              "\u56FE\u7247\u9644\u4EF6\u65E0\u6CD5\u8BFB\u53D6\uFF1A\u7F3A\u5C11 DSH \u9644\u4EF6\u670D\u52A1\u6216\u9644\u4EF6\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u7C98\u8D34\u56FE\u7247"
            );
          }
          parts.push({
            type: "image",
            image: `data:${resolved.mediaType || "image/png"};base64,${resolved.data}`,
            mimeType: resolved.mediaType || "image/png"
          });
        }
      }
      wireMessages.push({ role: "user", content: parts.length > 0 ? parts : [{ type: "text", text: "" }] });
    } else {
      const text3 = typeof msg.content === "string" ? msg.content : textFromContent(msg.content);
      wireMessages.push({ role: "user", content: text3 || "" });
    }
  }
  if (request.system && typeof request.system === "string") {
    systemPrompt = systemPrompt ? `${request.system}

${systemPrompt}` : request.system;
  }
  return { systemPrompt, wireMessages };
}
async function* readNdjsonLines(response, { signal, timeoutMs, providerId } = {}) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) {
        const err = new Error("Request aborted");
        err.name = "AbortError";
        throw err;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line) {
          try {
            yield JSON.parse(line);
          } catch {
          }
        }
        newline = buffer.indexOf("\n");
      }
    }
    const last = buffer.trim();
    if (last) {
      try {
        yield JSON.parse(last);
      } catch {
      }
    }
  } finally {
    reader.releaseLock();
    cleanupNativeResponse(response);
  }
}
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toWireUuid(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (UUID_REGEX.test(trimmed)) return trimmed;
    const stripped = trimmed.replace(/^(?:session|dsh|thread)[-_:]+/i, "");
    if (UUID_REGEX.test(stripped)) return stripped;
  }
  return null;
}
function deriveConversationSessionId(request, explicitSessionId) {
  const direct = toWireUuid(explicitSessionId) || toWireUuid(request?.sessionId);
  if (direct) return direct;
  const firstMsg = request?.messages?.[0];
  const seed = firstMsg ? typeof firstMsg.content === "string" ? firstMsg.content : JSON.stringify(firstMsg.content || "") : "default-dsh-session";
  const hash6 = createHash9("sha256").update(seed.slice(0, 500)).digest("hex");
  return `${hash6.slice(0, 8)}-${hash6.slice(8, 12)}-4${hash6.slice(13, 16)}-a${hash6.slice(17, 20)}-${hash6.slice(20, 32)}`;
}
function createCommandCodeNativeExecutor({
  endpoint: endpoint2 = DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
  fetchImpl = fetch,
  timeoutMs = 18e4
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint2, "COMMANDCODE_ENDPOINT", {
    defaultEndpoint: DEFAULT_COMMANDCODE_GENERATE_ENDPOINT
  });
  async function* commandCodeNativeExecutor({
    request = {},
    account = null,
    credential = null,
    signal = null,
    sessionId: explicitSessionId = null,
    attachments = null
  } = {}) {
    const auth = credential || account?.auth || extractCommandCodeAuth();
    const apiKey = auth?.apiKey || auth?.access || auth?.token;
    if (!apiKey) {
      const err = new Error("Command Code API Key \u672A\u914D\u7F6E\uFF0C\u8BF7\u5148\u8FD0\u884C cmd login \u6216\u5728\u9762\u677F\u4E2D\u8BBE\u7F6E API Key\u3002");
      err.code = "AUTH_REQUIRED";
      err.providerId = PROVIDER_ID11;
      throw err;
    }
    const sessionId = deriveConversationSessionId(request, explicitSessionId);
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "command-code/1.88.1",
      "x-command-code-version": "1.88.1",
      "x-cli-environment": "production",
      "x-session-id": sessionId,
      "x-api-key": apiKey,
      Authorization: `Bearer ${apiKey}`
    };
    const { systemPrompt, wireMessages } = await buildCommandCodeMessages(request, attachments);
    const wireTools = toWireTools(request.tools);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const threadId = toWireUuid(sessionId);
    let attemptMessages = wireMessages;
    let retriedReasoning = false;
    while (true) {
      const body = {
        config: {
          workingDir: process.cwd(),
          date: today,
          environment: process.platform,
          structure: [],
          isGitRepo: false,
          currentBranch: "main",
          mainBranch: "main",
          gitStatus: "",
          recentCommits: []
        },
        memory: null,
        taste: null,
        skills: null,
        permissionMode: "standard",
        ...threadId ? { threadId } : {},
        params: {
          model: request.model || "deepseek/deepseek-v4.1-flash",
          messages: attemptMessages,
          ...wireTools ? { tools: wireTools } : {},
          ...systemPrompt ? { system: systemPrompt } : {},
          stream: true,
          ...typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {},
          ...typeof request.temperature === "number" ? { temperature: request.temperature } : {},
          ...request.reasoning?.effort ? { reasoning_effort: request.reasoning.effort } : {}
        }
      };
      let response;
      try {
        response = await fetchNativeResponse(
          validatedEndpoint,
          {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal
          },
          {
            providerId: PROVIDER_ID11,
            timeoutMs,
            fetchImpl
          }
        );
      } catch (fetchErr) {
        if (/fetch failed/i.test(fetchErr?.message) && !signal?.aborted) {
          await new Promise((r) => setTimeout(r, 600));
          response = await fetchNativeResponse(
            validatedEndpoint,
            {
              method: "POST",
              headers,
              body: JSON.stringify(body),
              signal
            },
            {
              providerId: PROVIDER_ID11,
              timeoutMs,
              fetchImpl
            }
          );
        } else {
          throw fetchErr;
        }
      }
      const streamEvents = [];
      let nextIndex = 1;
      let reasoning = null;
      let rawUsage = null;
      let stop = "stop";
      let yieldedAny = false;
      let shouldRetryReasoning = false;
      const activeTools = /* @__PURE__ */ new Map();
      const textFilter = new DsmlStreamFilter({
        onTextBlockStart: (index) => streamEvents.push({ type: "block-start", index, blockType: "text" }),
        onTextDelta: (index, text3) => streamEvents.push({ type: "text-delta", index, text: text3 }),
        onTextBlockEnd: (index, text3) => streamEvents.push({ type: "block-end", index, block: { type: "text", text: text3 } })
      });
      for await (const event of readNdjsonLines(response, { signal, timeoutMs, providerId: PROVIDER_ID11 })) {
        if (!event || typeof event !== "object") continue;
        if (event.type === "error") {
          const errObj = event.error || {};
          const msg = errObj.message || "Command Code upstream stream error";
          const status = errObj.statusCode || 500;
          if (!yieldedAny && !retriedReasoning && /reasoning_content/i.test(msg)) {
            shouldRetryReasoning = true;
            break;
          }
          throw nativeProviderError(PROVIDER_ID11, msg, {
            status,
            code: errObj.type || "server_error"
          });
        }
        if (event.type === "reasoning-start") {
          textFilter.closeText();
          while (streamEvents.length > 0) yield streamEvents.shift();
          if (!reasoning) {
            reasoning = { index: nextIndex++, text: "" };
            yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
          }
          continue;
        }
        if (event.type === "reasoning-delta") {
          const text3 = event.text ?? "";
          if (text3) {
            if (!reasoning) {
              reasoning = { index: nextIndex++, text: "" };
              yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
            }
            reasoning.text += text3;
            yield { type: "reasoning-delta", index: reasoning.index, text: text3 };
          }
          continue;
        }
        if (event.type === "reasoning-end") {
          if (reasoning) {
            yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
            reasoning = null;
          }
          continue;
        }
        if (event.type === "text-delta") {
          const text3 = event.text ?? "";
          if (text3) {
            if (reasoning) {
              yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
              reasoning = null;
            }
            textFilter.push(text3, () => nextIndex++);
            while (streamEvents.length > 0) yield streamEvents.shift();
          }
          continue;
        }
        if (event.type === "tool-input-start") {
          if (reasoning) {
            yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
            reasoning = null;
          }
          textFilter.closeText();
          while (streamEvents.length > 0) yield streamEvents.shift();
          const toolId = event.id || `call_${activeTools.size}_${randomUUID10().slice(0, 8)}`;
          const state = {
            index: nextIndex++,
            id: toolId,
            name: event.toolName || "tool",
            arguments: ""
          };
          activeTools.set(toolId, state);
          yield { type: "block-start", index: state.index, blockType: "tool-call" };
          continue;
        }
        if (event.type === "tool-input-delta") {
          const toolId = event.id;
          const state = activeTools.get(toolId);
          const delta = event.delta ?? "";
          if (state && delta) {
            state.arguments += delta;
            yield {
              type: "tool-call-delta",
              index: state.index,
              id: state.id,
              name: state.name,
              argumentsDelta: delta
            };
          }
          continue;
        }
        if (event.type === "tool-call") {
          const toolId = event.toolCallId || event.id;
          const existing = activeTools.get(toolId);
          if (!existing) {
            if (reasoning) {
              yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
              reasoning = null;
            }
            textFilter.closeText();
            while (streamEvents.length > 0) yield streamEvents.shift();
            const argsStr = typeof event.input === "string" ? event.input : JSON.stringify(event.input ?? {});
            const state = {
              index: nextIndex++,
              id: toolId || `call_${randomUUID10().slice(0, 8)}`,
              name: event.toolName || "tool",
              arguments: argsStr
            };
            yield { type: "block-start", index: state.index, blockType: "tool-call" };
            yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argsStr };
            yield { type: "block-end", index: state.index, block: { type: "tool-call", id: state.id, name: state.name, arguments: argsStr } };
          } else {
            yield {
              type: "block-end",
              index: existing.index,
              block: { type: "tool-call", id: existing.id, name: existing.name, arguments: existing.arguments }
            };
            activeTools.delete(toolId);
          }
          continue;
        }
        if (event.type === "finish" || event.type === "finish-step") {
          if (event.totalUsage) rawUsage = event.totalUsage;
          else if (event.usage) rawUsage = event.usage;
          if (event.finishReason) {
            stop = event.finishReason === "tool-calls" ? "tool_calls" : event.finishReason;
          }
          if (event.type === "finish-step" && rawUsage) {
            const stepUsage = normalizeUsage(rawUsage);
            if (stepUsage) {
              yield {
                type: "usage",
                usage: stepUsage
              };
            }
          }
        }
      }
      if (shouldRetryReasoning) {
        retriedReasoning = true;
        attemptMessages = attemptMessages.map((m) => {
          if (m.role === "assistant" && typeof m.reasoning_content !== "string") {
            return { ...m, reasoning_content: "" };
          }
          return m;
        });
        continue;
      }
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }
      textFilter.closeText();
      while (streamEvents.length > 0) yield streamEvents.shift();
      for (const [, state] of activeTools) {
        yield {
          type: "block-end",
          index: state.index,
          block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments }
        };
      }
      if (activeTools.size > 0 && (!stop || stop === "stop")) {
        stop = "tool_calls";
      }
      const finalUsage = normalizeUsage(rawUsage);
      if (finalUsage) {
        yield {
          type: "usage",
          usage: finalUsage
        };
      }
      yield {
        type: "finish",
        reason: finishReason(stop),
        ...finalUsage ? { usage: finalUsage } : {}
      };
      break;
    }
  }
  ;
  return guardEmptyCompletion(commandCodeNativeExecutor, { providerId: PROVIDER_ID11 });
}

// modules/provider-commandcode/src/driver.mjs
var PROVIDER_ID12 = "commandcode";
function fingerprintApiKey(apiKey) {
  return createHash10("sha256").update(String(apiKey)).digest("hex").slice(0, 16);
}
function maskApiKey(apiKey) {
  const value = String(apiKey ?? "");
  if (value.length <= 8) return "\u2022\u2022\u2022\u2022";
  return `${value.slice(0, 4)}\u2026${value.slice(-4)}`;
}
function capitalize(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
var BUILTIN_COMMANDCODE_MODELS = Object.freeze([
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    contextWindow: 1e6,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    },
    // The live provider catalog reports ["text","image"] for this model, and a
    // direct request proves the gateway forwards image parts to it (verified
    // 2026-11-04: image token delta was +195 and the model read a red/green/blue
    // test chart correctly). The builtin fallback must not be more restrictive
    // than the catalog, or images are silently dropped whenever the live
    // catalog is unavailable or stale.
    inputModalities: ["text", "image"]
  },
  {
    id: "deepseek/deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    contextWindow: 1e6,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "high", name: "High", default: true },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text"]
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    contextWindow: 1e6,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "xhigh", name: "Extra High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    contextWindow: 1e6,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "xai/grok-4.7",
    name: "Grok 4.7",
    contextWindow: 5e5,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "xhigh", name: "Extra High" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "meta/muse-spark-1.2",
    name: "Muse Spark 1.2",
    contextWindow: 1048576,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true },
        { id: "xhigh", name: "Extra High" }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  },
  {
    id: "mistral/mistral-large-4",
    name: "Mistral Large 4",
    contextWindow: 524288,
    maxTokens: 16384,
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium" },
        { id: "high", name: "High", default: true }
      ],
      defaultEffort: "high"
    },
    inputModalities: ["text", "image"]
  }
]);
function summarizeCommandCodeCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID12,
    candidateId: candidate2?.candidateId ?? "commandcode-default",
    accountId: candidate2?.accountId ?? "commandcode-default",
    displayName: candidate2?.displayName ?? "Command Code",
    email: candidate2?.email ?? "user@commandcode.ai",
    source: candidate2?.source ?? "commandcode_auth",
    subscription: { ...candidate2?.subscription },
    quota: { ...candidate2?.quota }
  };
}
function findLocalCommandCodeCatalogFile() {
  const dir = join13(homedir12(), ".commandcode", "cache", "model-catalog", "v1");
  if (existsSync5(dir)) {
    try {
      const files = readdirSync(dir).filter((f) => f.startsWith("catalog-") && f.endsWith(".json"));
      if (files.length > 0) {
        return join13(dir, files[0]);
      }
    } catch {
    }
  }
  const devJson = join13(homedir12(), ".commandcode", "cache", "models-dev.json");
  if (existsSync5(devJson)) return devJson;
  return null;
}
var KNOWN_RETIRED_COMMANDCODE_MODELS = /* @__PURE__ */ new Set([
  "poolside/laguna-s-2.1-free"
]);
function parseCommandCodeCatalog(data) {
  let rawModels = [];
  if (Array.isArray(data?.data)) {
    rawModels = data.data;
  } else if (Array.isArray(data?.models)) {
    rawModels = data.models;
  } else if (data?.data && typeof data.data === "object") {
    for (const providerGroup of Object.values(data.data)) {
      if (providerGroup?.models && typeof providerGroup.models === "object") {
        for (const [mId, mObj] of Object.entries(providerGroup.models)) {
          rawModels.push({ id: mId, ...mObj });
        }
      }
    }
  }
  if (!rawModels || rawModels.length === 0) {
    return { models: [...BUILTIN_COMMANDCODE_MODELS] };
  }
  const models = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of rawModels) {
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    if (item?.hidden === true || item?.deprecated === true || item?.disabled === true || KNOWN_RETIRED_COMMANDCODE_MODELS.has(id)) {
      continue;
    }
    seen.add(id);
    const isFree = Boolean(
      (item?.display?.badge === "free" || item?.pricing && item.pricing.inputCost === 0 && item.pricing.outputCost === 0 || id.endsWith(":free")) && !(item?.pricing && (item.pricing.inputCost > 0 || item.pricing.outputCost > 0))
    );
    const baseName = stringValue(item?.display?.label) || stringValue(item?.name) || stringValue(item?.display?.name) || id;
    const name2 = baseName;
    const contextWindow = Number.isInteger(item?.context_length) ? item.context_length : resolveContextWindowFromModel(item, 131072);
    const maxTokens = Number.isInteger(item?.maxOutputTokens) ? Math.min(item.maxOutputTokens, 32768) : resolveMaxTokensFromModel(item, 16384);
    let reasoning = null;
    if (Array.isArray(item?.reasoningEfforts) && item.reasoningEfforts.length > 0) {
      const efforts = item.reasoningEfforts.filter((e) => e && e !== "off" && e !== "none").map((e) => ({ id: e, name: capitalize(e), default: e === "high" }));
      if (efforts.length > 0) {
        reasoning = {
          efforts,
          defaultEffort: efforts.find((e) => e.default)?.id || efforts[0].id
        };
      }
    } else {
      reasoning = resolveReasoningFromModel(item);
    }
    const inputModalities = Array.isArray(item?.inputModalities) ? item.inputModalities : Array.isArray(item?.modalities?.input) ? item.modalities.input : ["text"];
    models.push({
      id,
      name: name2,
      contextWindow,
      maxTokens,
      inputModalities,
      free: isFree,
      ...item?.display?.description ? { description: item.display.description } : {},
      ...reasoning ? { reasoning } : {}
    });
  }
  for (const builtin of BUILTIN_COMMANDCODE_MODELS) {
    if (!seen.has(builtin.id)) {
      models.unshift(builtin);
      seen.add(builtin.id);
    }
  }
  return { models };
}
function createCommandCodeCatalogLoader({
  modelsUrl = DEFAULT_COMMANDCODE_MODELS_ENDPOINT,
  cacheTtlMs = 6e4,
  fetchImpl = fetch
} = {}) {
  let cached = null;
  let cachedAt = 0;
  return async function commandCodeCatalogLoader({ force = false, credential = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) {
      return cached;
    }
    const auth = credential || extractCommandCodeAuth();
    if (auth?.apiKey && typeof fetchImpl === "function") {
      try {
        const res = await fetchImpl(modelsUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${auth.apiKey}`,
            "User-Agent": "command-code/1.88.1",
            "x-command-code-version": "1.88.1",
            "x-cli-environment": "production"
          }
        });
        if (res.ok) {
          const json = await res.json();
          cached = parseCommandCodeCatalog(json);
          cachedAt = Date.now();
          return cached;
        }
      } catch {
      }
    }
    const localCatalog = findLocalCommandCodeCatalogFile();
    if (localCatalog) {
      try {
        const raw = readFileSync4(localCatalog, "utf8");
        const json = JSON.parse(raw);
        cached = parseCommandCodeCatalog(json);
        cachedAt = Date.now();
        return cached;
      } catch {
      }
    }
    cached = { models: [...BUILTIN_COMMANDCODE_MODELS] };
    cachedAt = Date.now();
    return cached;
  };
}
function formatCommandCodePlan(planId) {
  if (!planId) return "Command Code Subscription";
  if (planId.includes("go")) return "Command Code Go Plan";
  if (planId.includes("goat")) return "Command Code GOAT Plan";
  if (planId.includes("pro")) return "Command Code Pro Plan";
  if (planId.includes("max")) return "Command Code Max Plan";
  return `Command Code (${planId})`;
}
var CommandCodeDriver = class {
  constructor({
    endpoint: endpoint2 = DEFAULT_COMMANDCODE_GENERATE_ENDPOINT,
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    timeoutMs = 18e4
  } = {}) {
    this.endpoint = endpoint2;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogLoader = catalogLoader ?? createCommandCodeCatalogLoader({ fetchImpl });
    this.requestExecutor = requestExecutor ?? createCommandCodeNativeExecutor({
      endpoint: endpoint2,
      fetchImpl,
      timeoutMs
    });
  }
  async discover() {
    const auth = extractCommandCodeAuth();
    if (!auth || !auth.apiKey) {
      return {
        candidates: [],
        source: "commandcode_auth",
        diagnostics: ["\u672A\u5728 ~/.commandcode/auth.json \u68C0\u6D4B\u5230\u767B\u5F55\u6001\uFF0C\u53EF\u5728\u9762\u677F\u4E2D\u914D\u7F6E API Key\u3002"]
      };
    }
    let whoamiData = null;
    let creditsData = null;
    let subData = null;
    try {
      const headers = {
        Authorization: `Bearer ${auth.apiKey}`,
        "User-Agent": "command-code/1.88.1",
        "x-command-code-version": "1.88.1",
        "x-cli-environment": "production"
      };
      const [whoamiRes, creditsRes, subRes] = await Promise.all([
        this.fetchImpl(DEFAULT_COMMANDCODE_WHOAMI_ENDPOINT, { headers }).catch(() => null),
        this.fetchImpl(DEFAULT_COMMANDCODE_CREDITS_ENDPOINT, { headers }).catch(() => null),
        this.fetchImpl(DEFAULT_COMMANDCODE_SUBSCRIPTIONS_ENDPOINT, { headers }).catch(() => null)
      ]);
      if (whoamiRes?.ok) whoamiData = await whoamiRes.json().catch(() => null);
      if (creditsRes?.ok) creditsData = await creditsRes.json().catch(() => null);
      if (subRes?.ok) subData = await subRes.json().catch(() => null);
    } catch {
    }
    const userId = whoamiData?.user?.id || auth.userId || "commandcode-user";
    const userName = whoamiData?.user?.name || whoamiData?.user?.userName || auth.userName || "Command Code User";
    const email = whoamiData?.user?.email || "user@commandcode.ai";
    const displayName = `${userName} (${email})`;
    const planId = subData?.data?.planId;
    const planName = formatCommandCodePlan(planId);
    const subStatus = subData?.data?.status || "active";
    const currentPeriodEnd = subData?.data?.currentPeriodEnd || null;
    const remainingCredits = typeof creditsData?.credits?.monthlyCredits === "number" ? creditsData.credits.monthlyCredits : 10;
    const windows = [];
    if (creditsData?.windowLimits?.fiveHour) {
      const fh = creditsData.windowLimits.fiveHour;
      windows.push({
        id: "commandcode:5h",
        name: "5 \u5C0F\u65F6\u7A97\u53E3\u989D\u5EA6",
        remaining: Math.max(0, (fh.cap ?? 3) - (fh.used ?? 0)),
        limit: fh.cap ?? 3,
        unit: "credits",
        resetAt: fh.resetAt ? new Date(fh.resetAt).toISOString() : null
      });
    }
    if (creditsData?.windowLimits?.weekly) {
      const wk = creditsData.windowLimits.weekly;
      windows.push({
        id: "commandcode:weekly",
        name: "\u5468\u5EA6\u989D\u5EA6",
        remaining: Math.max(0, (wk.cap ?? 6) - (wk.used ?? 0)),
        limit: wk.cap ?? 6,
        unit: "credits",
        resetAt: wk.resetAt ? new Date(wk.resetAt).toISOString() : null
      });
    }
    return {
      candidates: [
        {
          candidateId: userId,
          accountId: userId,
          displayName,
          email,
          subscription: {
            plan: planName,
            status: subStatus,
            expiresAt: currentPeriodEnd
          },
          quota: {
            remaining: remainingCredits,
            limit: 10,
            unit: "credits",
            resetAt: currentPeriodEnd,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            windows
          },
          source: "commandcode_auth",
          health: {
            status: "healthy"
          }
        }
      ],
      source: "commandcode_auth",
      diagnostics: []
    };
  }
  async importAccount(candidate2, context = {}) {
    const auth = extractCommandCodeAuth();
    const manual = candidate2?.source === "manual_api_key";
    const apiKey = candidate2?.apiKey || auth?.apiKey || "";
    const accountId = candidate2?.accountId || (manual ? `commandcode-${fingerprintApiKey(apiKey)}` : auth?.userId) || "commandcode-default";
    const ref = createCredentialRef(PROVIDER_ID12, accountId);
    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "commandcode_auth",
        apiKey,
        userId: accountId,
        userName: candidate2?.displayName || auth?.userName || null,
        email: candidate2?.email || null
      }).catch(() => {
      });
    }
    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID12,
      displayName: candidate2?.displayName || "Command Code User",
      email: candidate2?.email || "user@commandcode.ai",
      auth: {
        kind: "commandcode_auth",
        credentialRef: ref
      },
      subscription: {
        plan: candidate2?.subscription?.plan || "Command Code Subscription",
        status: candidate2?.subscription?.status || "active",
        expiresAt: candidate2?.subscription?.expiresAt || null
      },
      quota: createQuotaSnapshot(candidate2?.quota || {
        remaining: 10,
        limit: 10,
        unit: "credits"
      }),
      health: {
        status: "healthy"
      }
    });
  }
  /**
   * Import a manually entered API Key. Command Code authenticates with a static
   * key (environment variable or ~/.commandcode/auth.json), never OAuth, so this
   * is the panel's account entry point for users who have no official CLI.
   */
  async importSource(source, context = {}) {
    const rawKey = typeof source === "string" ? source : source?.apiKey ?? source?.key ?? source?.token ?? "";
    const apiKey = String(rawKey ?? "").trim();
    if (!apiKey) throw new ValidationError("\u8BF7\u8F93\u5165\u6709\u6548\u7684 Command Code API Key");
    const label = typeof source === "object" && typeof source?.label === "string" ? source.label.trim() : "";
    const masked = maskApiKey(apiKey);
    return [await this.importAccount({
      apiKey,
      source: "manual_api_key",
      displayName: label || `Command Code Key (${masked})`,
      email: masked
    }, context)];
  }
  async getActiveSession() {
    return this.discover().then((res) => Array.isArray(res?.candidates) ? res.candidates[0] : null);
  }
  async refreshAccount(account, context = {}) {
    let apiKey = null;
    if (context.secretStore && account?.auth?.credentialRef) {
      try {
        const secret = await context.secretStore.read(account.auth.credentialRef);
        apiKey = secret?.apiKey;
      } catch {
      }
    }
    if (!apiKey) {
      const auth = extractCommandCodeAuth();
      apiKey = auth?.apiKey;
    }
    if (!apiKey) {
      return {
        health: { status: "auth_expired" }
      };
    }
    try {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "command-code/1.88.1",
        "x-command-code-version": "1.88.1",
        "x-cli-environment": "production"
      };
      const [creditsRes, subRes] = await Promise.all([
        this.fetchImpl(DEFAULT_COMMANDCODE_CREDITS_ENDPOINT, { headers }).catch(() => null),
        this.fetchImpl(DEFAULT_COMMANDCODE_SUBSCRIPTIONS_ENDPOINT, { headers }).catch(() => null)
      ]);
      const creditsData = creditsRes?.ok ? await creditsRes.json().catch(() => null) : null;
      const subData = subRes?.ok ? await subRes.json().catch(() => null) : null;
      const remainingCredits = typeof creditsData?.credits?.monthlyCredits === "number" ? creditsData.credits.monthlyCredits : account.quota?.remaining ?? 10;
      const windows = [];
      if (creditsData?.windowLimits?.fiveHour) {
        const fh = creditsData.windowLimits.fiveHour;
        windows.push({
          id: "commandcode:5h",
          name: "5 \u5C0F\u65F6\u7A97\u53E3\u989D\u5EA6",
          remaining: Math.max(0, (fh.cap ?? 3) - (fh.used ?? 0)),
          limit: fh.cap ?? 3,
          unit: "credits",
          resetAt: fh.resetAt ? new Date(fh.resetAt).toISOString() : null
        });
      }
      if (creditsData?.windowLimits?.weekly) {
        const wk = creditsData.windowLimits.weekly;
        windows.push({
          id: "commandcode:weekly",
          name: "\u5468\u5EA6\u989D\u5EA6",
          remaining: Math.max(0, (wk.cap ?? 6) - (wk.used ?? 0)),
          limit: wk.cap ?? 6,
          unit: "credits",
          resetAt: wk.resetAt ? new Date(wk.resetAt).toISOString() : null
        });
      }
      const planId = subData?.data?.planId;
      const planName = planId ? formatCommandCodePlan(planId) : account.subscription?.plan;
      const subStatus = subData?.data?.status || account.subscription?.status || "active";
      const currentPeriodEnd = subData?.data?.currentPeriodEnd || account.subscription?.expiresAt || null;
      return {
        subscription: {
          ...account.subscription,
          plan: planName,
          status: subStatus,
          expiresAt: currentPeriodEnd
        },
        quota: createQuotaSnapshot({
          remaining: remainingCredits,
          limit: account.quota?.limit ?? 10,
          unit: "credits",
          resetAt: currentPeriodEnd,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          windows
        }),
        health: {
          status: "healthy",
          lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    } catch {
      return {
        health: { status: "degraded", lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString() }
      };
    }
  }
  async getCatalog(context = {}) {
    let credential = null;
    if (context.secretStore && context.accounts?.[0]?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(context.accounts[0].auth.credentialRef);
      } catch {
      }
    }
    return this.catalogLoader({ force: Boolean(context.force), credential });
  }
  async invoke(request, invocation, context = {}) {
    let output = "";
    for await (const chunk of this.stream(request, invocation, context)) {
      if (chunk.type === "text-delta" && chunk.text) {
        output += chunk.text;
      }
    }
    return { output };
  }
  async *stream(request, invocation, context = {}) {
    let credential = null;
    if (context.secretStore && invocation?.account?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(invocation.account.auth.credentialRef);
      } catch {
      }
    }
    yield* this.requestExecutor({
      request,
      account: invocation?.account ?? null,
      credential,
      signal: context.signal ?? null,
      sessionId: context.sessionId ?? request.sessionId ?? null,
      // DSH passes the durable attachment service on the provider context; the
      // transport needs it to turn opaque image references into real bytes.
      attachments: context.attachments ?? invocation?.attachments ?? null
    });
  }
};
function createCommandCodeDriver(options = {}) {
  return new CommandCodeDriver(options);
}

// modules/provider-commandcode/src/index.mjs
function createCommandCodeModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "commandcode",
    displayName: "Command Code",
    capabilities: [
      "quota",
      "catalog",
      "invoke",
      "stream",
      PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT,
      PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP,
      // Authenticates with a static API Key; the panel renders a key field for it.
      PROVIDER_BEHAVIOR_CAPABILITIES.API_KEY_AUTH
    ],
    driver
  });
}

// modules/provider-hermes/src/driver.mjs
import { createHash as createHash11 } from "node:crypto";

// modules/provider-hermes/src/native-transport.mjs
import { existsSync as existsSync6, readFileSync as readFileSync5, statSync as statSync2 } from "node:fs";
import { homedir as homedir13 } from "node:os";
import { join as join14 } from "node:path";
import { randomUUID as randomUUID11 } from "node:crypto";
function firstString10(...values) {
  for (const val of values) {
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}
var PROVIDER_ID13 = "hermes";
var DEFAULT_HERMES_CHAT_ENDPOINT = "https://inference-api.nousresearch.com/v1/chat/completions";
var DEFAULT_HERMES_MODELS_ENDPOINT = "https://inference-api.nousresearch.com/v1/models";
var cachedAuth = null;
var cachedAuthMtime = 0;
function findHermesAuthFilePath() {
  if (process.env.HERMES_AUTH_PATH && existsSync6(process.env.HERMES_AUTH_PATH)) {
    return process.env.HERMES_AUTH_PATH;
  }
  const hermesPath = join14(homedir13(), ".hermes", "auth.json");
  if (existsSync6(hermesPath)) return hermesPath;
  const nousPath = join14(homedir13(), ".nous", "auth.json");
  if (existsSync6(nousPath)) return nousPath;
  return null;
}
function extractHermesAuth({ force = false } = {}) {
  const envKeys = [
    process.env.HERMES_API_KEY,
    process.env.NOUS_API_KEY,
    process.env.HERMES_API_KEY_1,
    process.env.HERMES_API_KEY_2
  ].filter(Boolean);
  const authFile = findHermesAuthFilePath();
  if (authFile) {
    try {
      const stats = statSync2(authFile);
      if (force || !cachedAuth || stats.mtimeMs !== cachedAuthMtime) {
        const raw = readFileSync5(authFile, "utf8");
        const parsed = JSON.parse(raw);
        cachedAuth = parsed;
        cachedAuthMtime = stats.mtimeMs;
      }
      if (Array.isArray(cachedAuth?.accounts) && cachedAuth.accounts.length > 0) {
        return {
          accounts: cachedAuth.accounts.map((acc, idx) => ({
            accountId: acc.accountId || acc.id || `hermes-acc-${idx + 1}`,
            displayName: acc.displayName || acc.name || `Hermes Account ${idx + 1}`,
            apiKey: acc.apiKey || acc.key || "",
            balance: typeof acc.balance === "number" ? acc.balance : null,
            email: acc.email || null
          }))
        };
      }
      if (cachedAuth?.apiKey || cachedAuth?.access || cachedAuth?.token) {
        const key = cachedAuth.apiKey || cachedAuth.access || cachedAuth.token;
        return {
          accounts: [
            {
              accountId: cachedAuth.accountId || cachedAuth.userId || "hermes-default",
              displayName: cachedAuth.displayName || cachedAuth.name || "Hermes User",
              apiKey: key,
              balance: typeof cachedAuth.balance === "number" ? cachedAuth.balance : null,
              email: cachedAuth.email || null
            }
          ]
        };
      }
    } catch {
    }
  }
  if (envKeys.length > 0) {
    return {
      accounts: envKeys.map((key, idx) => ({
        accountId: `hermes-env-${idx + 1}`,
        displayName: `Hermes Env Key ${idx + 1}`,
        apiKey: key,
        balance: null,
        email: null
      }))
    };
  }
  return null;
}
function contentPartText(part) {
  if (typeof part === "string") return part;
  if (!part || typeof part !== "object") return "";
  if (typeof part.text === "string") return part.text;
  if (typeof part.content === "string") return part.content;
  return "";
}
async function openAiContent2(content, attachments = null) {
  if (typeof content === "string") {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return content;
    }
    const parts = [{ type: "text", text: content }];
    for (const attachment of attachments) {
      const data = await resolveImageData(attachment, attachments);
      if (data) {
        parts.push({
          type: "image_url",
          image_url: { url: `data:${data.mediaType};base64,${data.data}` }
        });
      }
    }
    return parts;
  }
  if (Array.isArray(content)) {
    const parts = [];
    for (const part of content) {
      if (typeof part === "string") {
        parts.push({ type: "text", text: part });
      } else if (part && typeof part === "object") {
        if (part.type === "text" && typeof part.text === "string") {
          parts.push(part);
        } else if (part.type === "image") {
          const image = await resolveImageData(part, attachments);
          if (image) {
            parts.push({
              type: "image_url",
              image_url: { url: `data:${image.mediaType};base64,${image.data}` }
            });
          }
        } else if (part.type === "image_url") {
          parts.push(part);
        } else {
          const text3 = contentPartText(part);
          if (text3) parts.push({ type: "text", text: text3 });
        }
      }
    }
    if (Array.isArray(attachments)) {
      for (const attachment of attachments) {
        const data = await resolveImageData(attachment, attachments);
        if (data) {
          parts.push({
            type: "image_url",
            image_url: { url: `data:${data.mediaType};base64,${data.data}` }
          });
        }
      }
    }
    return parts;
  }
  return "";
}
async function buildHermesMessages(request = {}, attachments = null) {
  const result = [];
  const rawMessages = Array.isArray(request.messages) ? request.messages : [];
  for (const message of rawMessages) {
    if (message?.role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: sanitizeToolCallId(firstString10(message.toolCallId, message.tool_call_id, message.id, "tool-result")),
        content: typeof message.content === "string" ? message.content : textFromContent(message.content ?? message.text ?? message.output ?? message.result)
      });
      continue;
    }
    const role = message?.role === "assistant" ? "assistant" : message?.role === "system" ? "system" : "user";
    const content = await openAiContent2(message?.content ?? message?.text, attachments);
    const calls = [];
    if (Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part?.type === "tool-call" || part?.type === "tool_call") {
          calls.push({
            id: sanitizeToolCallId(firstString10(part.id, part.toolCallId, `call_${calls.length}`)),
            type: "function",
            function: {
              name: firstString10(part.name, part.function?.name, "tool"),
              arguments: typeof (part.arguments ?? part.function?.arguments) === "string" ? part.arguments ?? part.function?.arguments : JSON.stringify(part.arguments ?? part.input ?? {})
            }
          });
        }
      }
    }
    if (Array.isArray(message?.tool_calls)) {
      for (const tc of message.tool_calls) {
        calls.push({
          id: sanitizeToolCallId(firstString10(tc.id, tc.toolCallId, `call_${calls.length}`)),
          type: "function",
          function: {
            name: firstString10(tc.name, tc.function?.name, "tool"),
            arguments: typeof (tc.arguments ?? tc.function?.arguments) === "string" ? tc.arguments ?? tc.function?.arguments : JSON.stringify(tc.arguments ?? tc.input ?? {})
          }
        });
      }
    }
    if (Array.isArray(content) && content.length === 0 && calls.length === 0) {
      continue;
    }
    const msgObj = {
      role,
      content: Array.isArray(content) && content.length === 1 && content[0]?.type === "text" ? content[0].text : Array.isArray(content) && content.length === 0 ? "" : content
    };
    if (role === "assistant" && calls.length > 0) {
      msgObj.tool_calls = calls;
    }
    result.push(msgObj);
  }
  if (result.length === 0 && typeof request.prompt === "string" && request.prompt.trim()) {
    result.push({
      role: "user",
      content: request.prompt.trim()
    });
  }
  return result;
}
function extractReasoningDelta(delta) {
  if (!delta || typeof delta !== "object") return null;
  const direct = firstString10(delta.reasoning_content, delta.reasoning, delta.thought);
  if (direct) return direct;
  if (Array.isArray(delta.reasoning_details)) {
    for (const item of delta.reasoning_details) {
      if (item && item.type !== "reasoning.encrypted") {
        const text3 = firstString10(item.text, item.content, item.summary);
        if (text3) return text3;
      }
    }
  }
  return null;
}
function createHermesNativeExecutor({
  endpoint: endpoint2 = DEFAULT_HERMES_CHAT_ENDPOINT,
  apiKey = null,
  fetchImpl = fetch,
  timeoutMs = 18e4
} = {}) {
  const validatedEndpoint = validateNativeEndpoint(endpoint2, {
    providerId: PROVIDER_ID13,
    defaultEndpoint: DEFAULT_HERMES_CHAT_ENDPOINT
  });
  async function* runHermesAttempt(envelope2 = {}) {
    const req = envelope2 && typeof envelope2 === "object" && "request" in envelope2 ? envelope2.request ?? {} : envelope2 ?? {};
    const attachments = envelope2?.attachments ?? req?.attachments;
    const credential = envelope2?.credential ?? req?.credential;
    const signal = envelope2?.signal ?? req?.signal;
    let token = apiKey ?? (credential?.apiKey && credential.apiKey !== "free-tier" ? credential.apiKey : null) ?? (credential?.token && credential.token !== "free-tier" ? credential.token : null) ?? (credential?.accessToken && credential.accessToken !== "free-tier" ? credential.accessToken : null);
    if (!token) {
      const extracted = extractHermesAuth();
      if (extracted?.accounts?.length) {
        token = extracted.accounts[0].apiKey;
      }
    }
    if (!token) {
      const err = new Error("Hermes API Key \u672A\u914D\u7F6E\uFF0C\u53EF\u5728 ~/.hermes/auth.json \u4E2D\u914D\u7F6E\u6216\u5728\u9762\u677F\u4E2D\u8BBE\u7F6E API Key\u3002");
      err.code = "AUTH_REQUIRED";
      err.providerId = PROVIDER_ID13;
      throw err;
    }
    const messages = await buildHermesMessages(req, attachments);
    const headers = {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
    const rawEffort = req.reasoningEffort ?? req.reasoning_effort ?? req.reasoning?.effort;
    let reasoningEffort = null;
    if (typeof rawEffort === "string" && rawEffort.length > 0) {
      const lower = rawEffort.toLowerCase();
      if (lower === "none" || lower === "off") {
        reasoningEffort = "none";
      } else if (lower === "minimal") {
        reasoningEffort = "low";
      } else {
        reasoningEffort = lower;
      }
    }
    const tools = buildOpenAiTools(req.tools);
    const body = {
      model: req.model ?? "deepseek/deepseek-v4.1-flash",
      messages,
      stream: true,
      tags: ["user=dockyard"],
      ...typeof req.temperature === "number" ? { temperature: req.temperature } : {},
      ...typeof req.maxTokens === "number" ? { max_tokens: req.maxTokens } : {},
      ...reasoningEffort && reasoningEffort !== "none" ? { reasoning_effort: reasoningEffort } : {},
      ...tools ? { tools } : {}
    };
    let response;
    try {
      response = await fetchNativeResponse(
        validatedEndpoint,
        {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal
        },
        {
          providerId: PROVIDER_ID13,
          timeoutMs,
          fetchImpl
        }
      );
    } catch (err) {
      if (!req.probe && !req.noFallback && body.model !== "deepseek/deepseek-v4.1-flash" && (err?.status === 503 || err?.status === 502 || err?.status === 504 || err?.status === 404)) {
        const fallbackBody = { ...body, model: "deepseek/deepseek-v4.1-flash" };
        response = await fetchNativeResponse(
          validatedEndpoint,
          {
            method: "POST",
            headers,
            body: JSON.stringify(fallbackBody),
            signal
          },
          {
            providerId: PROVIDER_ID13,
            timeoutMs,
            fetchImpl
          }
        );
      } else {
        throw err;
      }
    }
    const streamEvents = [];
    let nextIndex = 1;
    let rawUsage = null;
    let stop = "stop";
    let probeYielded = false;
    const activeTools = /* @__PURE__ */ new Map();
    const reasoningFilter = new DsmlStreamFilter({
      onTextBlockStart: (index) => streamEvents.push({ type: "block-start", index, blockType: "reasoning" }),
      onTextDelta: (index, text3) => streamEvents.push({ type: "reasoning-delta", index, text: text3 }),
      onTextBlockEnd: (index, text3) => streamEvents.push({ type: "block-end", index, block: { type: "reasoning", text: text3 } })
    });
    const textFilter = new DsmlStreamFilter({
      onTextBlockStart: (index) => streamEvents.push({ type: "block-start", index, blockType: "text" }),
      onTextDelta: (index, text3) => streamEvents.push({ type: "text-delta", index, text: text3 }),
      onTextBlockEnd: (index, text3) => streamEvents.push({ type: "block-end", index, block: { type: "text", text: text3 } })
    });
    for await (const event of readSseEvents(response, { signal, timeoutMs, providerId: PROVIDER_ID13 })) {
      if (event?.done) continue;
      const parsed = event?.data;
      if (!parsed || typeof parsed !== "object") continue;
      if (parsed.usage) rawUsage = parsed.usage;
      const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
      if (!choice) continue;
      if (req.probe && !probeYielded) {
        probeYielded = true;
        yield { type: "text-delta", index: 0, text: " " };
      }
      const delta = choice.delta ?? {};
      const reasoningDelta = extractReasoningDelta(delta);
      if (reasoningDelta) {
        textFilter.closeText();
        while (streamEvents.length > 0) yield streamEvents.shift();
        reasoningFilter.push(reasoningDelta, () => nextIndex++);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }
      for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
        const key = Number(call.index ?? activeTools.size);
        if (!activeTools.has(key)) {
          reasoningFilter.closeText();
          textFilter.closeText();
          while (streamEvents.length > 0) yield streamEvents.shift();
          const state2 = {
            index: nextIndex++,
            id: firstString10(call.id, `call_${key}_${randomUUID11().slice(0, 8)}`),
            name: firstString10(call.function?.name, call.name, "tool"),
            arguments: ""
          };
          activeTools.set(key, state2);
          yield { type: "block-start", index: state2.index, blockType: "tool-call" };
        }
        const state = activeTools.get(key);
        const argumentDelta = call.function?.arguments ?? call.arguments ?? "";
        if (call.id) state.id = call.id;
        if (call.function?.name) state.name = call.function.name;
        state.arguments += argumentDelta;
        if (argumentDelta) {
          yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argumentDelta };
        }
      }
      const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
      if (content) {
        reasoningFilter.closeText();
        while (streamEvents.length > 0) yield streamEvents.shift();
        textFilter.push(content, () => nextIndex++);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }
      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }
    reasoningFilter.closeText();
    textFilter.closeText();
    const reasoningDsml = reasoningFilter.flush(() => nextIndex++);
    const textDsml = textFilter.flush(() => nextIndex++);
    while (streamEvents.length > 0) yield streamEvents.shift();
    const allDsmlCalls = [
      ...reasoningDsml?.toolCalls || [],
      ...textDsml?.toolCalls || []
    ];
    if (activeTools.size > 0) {
      for (const state of activeTools.values()) {
        yield {
          type: "block-end",
          index: state.index,
          block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" }
        };
      }
      stop = "tool_calls";
    } else if (allDsmlCalls.length > 0) {
      for (const dsml of allDsmlCalls) {
        const toolIndex = nextIndex++;
        const toolId = `call_${randomUUID11().slice(0, 8)}`;
        yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
        yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: dsml.name, argumentsDelta: dsml.arguments };
        yield {
          type: "block-end",
          index: toolIndex,
          block: { type: "tool-call", id: toolId, name: dsml.name, arguments: dsml.arguments }
        };
      }
      stop = "tool_calls";
    }
    if (rawUsage) {
      yield {
        type: "usage",
        usage: normalizeUsage(rawUsage)
      };
    }
    yield {
      type: "finish",
      reason: finishReason(stop),
      ...rawUsage ? { usage: normalizeUsage(rawUsage) } : {}
    };
  }
  ;
  return guardEmptyCompletion(runHermesAttempt, { providerId: PROVIDER_ID13 });
}

// modules/provider-hermes/src/driver.mjs
var PROVIDER_ID14 = "hermes";
function fingerprintApiKey2(apiKey) {
  return createHash11("sha256").update(String(apiKey)).digest("hex").slice(0, 16);
}
function maskApiKey2(apiKey) {
  const value = String(apiKey ?? "");
  if (value.length <= 8) return "\u2022\u2022\u2022\u2022";
  return `${value.slice(0, 4)}\u2026${value.slice(-4)}`;
}
var BUILTIN_HERMES_MODELS = Object.freeze([
  {
    id: "deepseek/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    contextWindow: 1048576,
    maxTokens: 131072,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "high", name: "High", default: true },
        { id: "xhigh", name: "Extra High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "reflection/beam-1.0-501b-a23b:free",
    name: "Beam 1.0 501B A23B (Free)",
    contextWindow: 262144,
    maxTokens: 131072,
    inputModalities: ["text"],
    reasoning: {
      efforts: [
        { id: "low", name: "Low" },
        { id: "medium", name: "Medium", default: true },
        { id: "high", name: "High" },
        { id: "xhigh", name: "Extra High" },
        { id: "max", name: "Max" }
      ],
      defaultEffort: "medium"
    },
    free: true
  },
  {
    id: "ornith/ornith-1.5-122b:free",
    name: "Ornith 1.5 122B (Free)",
    contextWindow: 262144,
    maxTokens: 262144,
    inputModalities: ["text", "image"],
    free: true
  },
  {
    id: "stepfun/step-3.7-flash:free",
    name: "Step 3.7 Flash (Free)",
    contextWindow: 262144,
    maxTokens: 32768,
    inputModalities: ["text"],
    free: true
  },
  {
    id: "openai/gpt-6.1-terra-pro",
    name: "GPT-6.1 Terra Pro",
    contextWindow: 1e6,
    maxTokens: 65536,
    inputModalities: ["text", "image"]
  },
  {
    id: "anthropic/claude-haiku-5.5",
    name: "Claude Haiku 5.5",
    contextWindow: 1e6,
    maxTokens: 65536,
    inputModalities: ["text", "image"]
  },
  {
    id: "z-ai/glm-5.3",
    name: "GLM 5.3",
    contextWindow: 1048576,
    maxTokens: 131072,
    inputModalities: ["text"]
  },
  {
    id: "particle-ai/particle-1",
    name: "Particle-1",
    contextWindow: 1048576,
    maxTokens: 131072,
    inputModalities: ["text", "image"]
  }
]);
function parseHermesCatalog(data) {
  const payload = data && typeof data === "object" && "body" in data ? data.body : data;
  const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  if (!items.length) {
    return { models: [...BUILTIN_HERMES_MODELS] };
  }
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  const builtinMap = new Map(BUILTIN_HERMES_MODELS.map((m) => [m.id, m]));
  for (const item of items) {
    const id = stringValue(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (Array.isArray(item?.endpoints) && !item.endpoints.some((e) => e.includes("chat") || e.includes("completions") || e.includes("messages"))) {
      if (item.architecture?.modality === "text->embeddings" || item.architecture?.output_modalities?.includes("embeddings")) {
        continue;
      }
    }
    const builtin = builtinMap.get(id);
    const name2 = stripVendorPrefix(stringValue(item?.name) ?? builtin?.name ?? id);
    const contextWindow = resolveContextWindowFromModel(item, builtin?.contextWindow ?? 262144);
    const maxTokens = resolveMaxTokensFromModel(item, builtin?.maxTokens ?? 32768);
    const inputModalities = Array.isArray(item?.architecture?.input_modalities) ? [...item.architecture.input_modalities] : builtin?.inputModalities ? [...builtin.inputModalities] : ["text"];
    let reasoning = null;
    if (Array.isArray(item?.reasoning?.supported_efforts) && item.reasoning.supported_efforts.length > 0) {
      const efforts = item.reasoning.supported_efforts.map((lvl) => ({
        id: lvl,
        name: lvl.charAt(0).toUpperCase() + lvl.slice(1),
        ...lvl === (item.reasoning.default_effort ?? "high") ? { default: true } : {}
      }));
      reasoning = {
        efforts,
        defaultEffort: item.reasoning.default_effort ?? "high"
      };
    } else {
      reasoning = resolveReasoningFromModel(item) ?? builtin?.reasoning;
    }
    const isFree = id.endsWith(":free") || item?.isFree === true || item?.pricing?.prompt === "0.0000000000" && item?.pricing?.completion === "0.0000000000";
    result.push({
      id,
      name: name2,
      contextWindow,
      maxTokens,
      inputModalities,
      ...reasoning ? { reasoning } : {},
      ...isFree ? { free: true } : {}
    });
  }
  if (result.length === 0) {
    return { models: [...BUILTIN_HERMES_MODELS] };
  }
  return { models: result };
}
function createHermesCatalogLoader({
  modelsUrl = DEFAULT_HERMES_MODELS_ENDPOINT,
  fetchImpl = fetch,
  cacheTtlMs = 3e5
} = {}) {
  let cached = null;
  let cachedAt = 0;
  return async function hermesCatalogLoader({ force = false, credential = null, accounts = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) {
      return cached;
    }
    let token = credential?.apiKey;
    if (!token && Array.isArray(accounts) && accounts.length > 0) {
      token = accounts[0]?.auth?.apiKey;
    }
    if (!token) {
      const auth = extractHermesAuth();
      token = auth?.accounts?.[0]?.apiKey;
    }
    try {
      assertSecureEndpointUrl(modelsUrl, { providerId: PROVIDER_ID14 });
      const headers = {
        Accept: "application/json",
        ...token ? { Authorization: `Bearer ${token}` } : {}
      };
      const { body: data } = await fetchJson(
        modelsUrl,
        { headers },
        { fetchImpl, timeoutMs: 15e3 }
      );
      const parsed = parseHermesCatalog(data);
      if (parsed.models.length > 0) {
        cached = parsed;
        cachedAt = now;
        return cached;
      }
    } catch {
    }
    cached = { models: [...BUILTIN_HERMES_MODELS] };
    cachedAt = now;
    return cached;
  };
}
function summarizeHermesCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID14,
    candidateId: candidate2?.candidateId ?? "hermes-default",
    displayName: candidate2?.displayName ?? "Hermes Account",
    email: candidate2?.email ?? null,
    plan: candidate2?.subscription?.plan ?? "Nous Portal \u6309\u91CF\u8D26\u6237",
    quota: candidate2?.quota ?? null
  };
}
var HermesDriver = class {
  constructor({
    endpoint: endpoint2 = DEFAULT_HERMES_CHAT_ENDPOINT,
    modelsUrl = DEFAULT_HERMES_MODELS_ENDPOINT,
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    timeoutMs = 18e4
  } = {}) {
    this.endpoint = endpoint2;
    this.modelsUrl = modelsUrl;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.catalogLoader = catalogLoader ?? createHermesCatalogLoader({ modelsUrl, fetchImpl });
    this.requestExecutor = requestExecutor ?? createHermesNativeExecutor({
      endpoint: endpoint2,
      fetchImpl,
      timeoutMs
    });
  }
  async discover() {
    const auth = extractHermesAuth();
    if (!auth || !Array.isArray(auth.accounts) || auth.accounts.length === 0) {
      return {
        candidates: [],
        source: "hermes_auth",
        diagnostics: ["\u672A\u5728 ~/.hermes/auth.json \u68C0\u6D4B\u5230\u53EF\u7528 Key\uFF0C\u53EF\u5728\u9762\u677F\u4E2D\u914D\u7F6E API Key\u3002"]
      };
    }
    const candidates = auth.accounts.map((acc, index) => {
      const amount = typeof acc.balance === "number" && Number.isFinite(acc.balance) ? acc.balance : null;
      return {
        candidateId: acc.accountId || `hermes-acc-${index + 1}`,
        accountId: acc.accountId || `hermes-acc-${index + 1}`,
        displayName: acc.displayName || `Hermes Account ${index + 1}`,
        email: acc.email || null,
        apiKey: acc.apiKey,
        subscription: {
          plan: amount === null ? "Nous Portal" : `Nous Portal (\u672C\u5730\u8BB0\u5F55 $${amount.toFixed(2)})`
        },
        // A balance is not a quota window: it has no cap to divide by and never
        // resets, so reporting one produced a meaningless 100% bar.
        balance: amount === null ? null : createBalanceSnapshot({ amount, unit: "USD", source: "nous_portal_billing" }),
        // Kept as an empty snapshot so every candidate has the same shape; a
        // balance provider has no windows to report.
        quota: createQuotaSnapshot({}),
        resources: {
          quotaSource: "nous_portal_billing",
          quotaAvailable: true,
          quotaDiagnostic: "\u6309\u91CF\u5145\u503C\u4F59\u989D\uFF1B\u4EE5 Portal \u63A7\u5236\u53F0\u4E3A\u51C6",
          quotaUrl: "https://portal.nousresearch.com"
        },
        source: "hermes_auth",
        health: {
          status: "healthy"
        }
      };
    });
    return {
      candidates,
      source: "hermes_auth",
      diagnostics: []
    };
  }
  async importAccount(candidate2, context = {}) {
    const manual = candidate2?.source === "manual_api_key";
    const accountId = candidate2?.accountId || (manual ? `hermes-${fingerprintApiKey2(candidate2?.apiKey)}` : null) || "hermes-default";
    const ref = createCredentialRef(PROVIDER_ID14, accountId);
    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "hermes_auth",
        apiKey: candidate2?.apiKey || "",
        userId: accountId,
        displayName: candidate2?.displayName || "Hermes User",
        email: candidate2?.email || null
      }).catch(() => {
      });
    }
    const amount = typeof candidate2?.balance?.amount === "number" && Number.isFinite(candidate2.balance.amount) ? candidate2.balance.amount : null;
    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID14,
      displayName: candidate2?.displayName || "Hermes Account",
      email: candidate2?.email || null,
      auth: {
        kind: "hermes_auth",
        credentialRef: ref
      },
      subscription: {
        plan: candidate2?.subscription?.plan || (amount === null ? "Nous Portal" : `Nous Portal ($${amount.toFixed(2)} \u4E0D\u9650\u65F6)`)
      },
      balance: amount === null ? null : createBalanceSnapshot({ amount, unit: "USD", source: "nous_portal_billing" }),
      resources: {
        quotaSource: "nous_portal_billing",
        quotaAvailable: true,
        quotaDiagnostic: "\u6309\u91CF\u5145\u503C\u4F59\u989D\uFF1B\u4EE5 Portal \u63A7\u5236\u53F0\u4E3A\u51C6",
        quotaUrl: "https://portal.nousresearch.com"
      },
      health: {
        status: "healthy"
      }
    });
  }
  /**
   * Import a manually entered API Key. Hermes authenticates with static keys
   * (~/.hermes/auth.json, ~/.nous/auth.json or an environment variable), never
   * OAuth, so this is the panel's account entry point without the official CLI.
   */
  async importSource(source, context = {}) {
    const rawKey = typeof source === "string" ? source : source?.apiKey ?? source?.key ?? source?.token ?? "";
    const apiKey = String(rawKey ?? "").trim();
    if (!apiKey) throw new ValidationError("\u8BF7\u8F93\u5165\u6709\u6548\u7684 Hermes / Nous API Key");
    const label = typeof source === "object" && typeof source?.label === "string" ? source.label.trim() : "";
    const masked = maskApiKey2(apiKey);
    return [await this.importAccount({
      apiKey,
      source: "manual_api_key",
      displayName: label || `Hermes Key (${masked})`,
      email: masked
    }, context)];
  }
  async getActiveSession() {
    return this.discover().then((res) => Array.isArray(res?.candidates) ? res.candidates[0] : null);
  }
  async refreshAccount(account, context = {}) {
    let apiKey = null;
    if (context.secretStore && account?.auth?.credentialRef) {
      try {
        const secret = await context.secretStore.read(account.auth.credentialRef);
        apiKey = secret?.apiKey;
      } catch {
      }
    }
    if (!apiKey) {
      const auth = extractHermesAuth();
      const match = auth?.accounts?.find((a) => a.accountId === account?.accountId);
      apiKey = match?.apiKey || auth?.accounts?.[0]?.apiKey;
    }
    if (!apiKey) {
      return {
        health: { status: "auth_expired" }
      };
    }
    const authNow = extractHermesAuth();
    const authMatch = Array.isArray(authNow?.accounts) ? authNow.accounts.find((entry) => entry?.accountId === account?.accountId) : null;
    const amount = typeof authMatch?.balance === "number" && Number.isFinite(authMatch.balance) ? authMatch.balance : typeof account?.balance?.amount === "number" && Number.isFinite(account.balance.amount) ? account.balance.amount : null;
    return {
      health: { status: "healthy" },
      // An empty quota snapshot keeps the shape stable and tells the runtime this
      // refresh already answered the quota question; the money travels beside it.
      quota: createQuotaSnapshot({}),
      balance: amount === null ? null : createBalanceSnapshot({ amount, unit: "USD", source: "nous_portal_billing" }),
      resources: {
        quotaSource: "nous_portal_billing",
        quotaAvailable: true,
        quotaDiagnostic: "\u6309\u91CF\u5145\u503C\u4F59\u989D\uFF1B\u4EE5 Portal \u63A7\u5236\u53F0\u4E3A\u51C6",
        quotaUrl: "https://portal.nousresearch.com"
      }
    };
  }
  /**
   * Quota for a balance provider: there is no window to report, only what is
   * left to spend. The auth file is re-read so a top-up shows up without
   * re-importing the account.
   */
  async getQuota(account, context = {}) {
    const auth = extractHermesAuth();
    const match = Array.isArray(auth?.accounts) ? auth.accounts.find((entry) => entry?.accountId === account?.accountId) : null;
    const amount = typeof match?.balance === "number" && Number.isFinite(match.balance) ? match.balance : typeof account?.balance?.amount === "number" ? account.balance.amount : null;
    return {
      quota: createQuotaSnapshot({}),
      balance: amount === null ? null : createBalanceSnapshot({ amount, unit: "USD", source: "nous_portal_billing" }),
      resources: {
        quotaSource: "nous_portal_billing",
        quotaDiagnostic: "\u6309\u91CF\u5145\u503C\u4F59\u989D\uFF1B\u4EE5 Portal \u63A7\u5236\u53F0\u4E3A\u51C6",
        quotaUrl: "https://portal.nousresearch.com"
      }
    };
  }
  async getCatalog(context = {}) {
    let credential = null;
    if (context.secretStore && context.accounts?.[0]?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(context.accounts[0].auth.credentialRef);
      } catch {
      }
    }
    return this.catalogLoader({
      force: Boolean(context?.force),
      credential,
      accounts: context?.accounts ?? null
    });
  }
  async invoke(request, invocation, context = {}) {
    return this.stream(request, invocation, context);
  }
  async stream(request, invocation, context = {}) {
    let credential = null;
    if (context.secretStore && invocation?.account?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(invocation.account.auth.credentialRef);
      } catch {
      }
    }
    return this.requestExecutor({
      request,
      account: invocation?.account ?? null,
      credential,
      signal: context.signal ?? null,
      // Images reach the provider as opaque attachment references; without the
      // durable attachment service the transport silently drops them.
      attachments: context.attachments ?? invocation?.attachments ?? null
    });
  }
};
function createHermesDriver(options = {}) {
  return new HermesDriver(options);
}

// modules/provider-hermes/src/index.mjs
function createHermesModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "hermes",
    displayName: "Hermes (Nous Research)",
    capabilities: [
      "quota",
      "catalog",
      "invoke",
      "stream",
      PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT,
      PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP,
      // Authenticates with a static API Key; the panel renders a key field for it.
      PROVIDER_BEHAVIOR_CAPABILITIES.API_KEY_AUTH
    ],
    driver
  });
}

// modules/provider-openrouter-free/src/driver.mjs
import os2 from "node:os";

// modules/provider-openrouter-free/src/native-transport.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto, { randomUUID as randomUUID12 } from "node:crypto";
var OPENROUTER_API_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
var OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
var OPENROUTER_CREDITS_ENDPOINT = "https://openrouter.ai/api/v1/credits";
var OPENROUTER_KEY_ENDPOINT = "https://openrouter.ai/api/v1/key";
var OPENROUTER_AGENTIC_HEADERS = Object.freeze({
  "HTTP-Referer": "https://opencode.ai",
  "X-Title": "OpenCode"
});
var OPENROUTER_FREE_ROUTER_ID = "openrouter/free";
var PRIORITIZED_FREE_MODELS = [
  "stealth/crouton-alpha",
  "thinkingmachines/inkling:free",
  "thinkingmachines/inkling-small:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3.5-super-vl:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
  "dots-studio/dots-3-note-preview:free",
  "recursive/flint-v1.0:free",
  "liquid/lfm-2.5-2.6b:free"
];
var MODEL_COOLDOWN_MS = 2 * 60 * 1e3;
var failedFreeModels = /* @__PURE__ */ new Map();
var cachedLiveModels = null;
var cachedLiveModelsAt = 0;
var LIVE_MODELS_CACHE_TTL_MS = 10 * 1e3;
function createOpenRouterExecutionError(message, details = {}) {
  const err = new DockyardError("provider_execution_error", message, details);
  if (details.status) err.status = details.status;
  if (details.code) err.code = details.code;
  if (details.accountStatus === "expired") err.authExpired = true;
  if (details.status === 429) err.rateLimited = true;
  return err;
}
function estimateOpenRouterRequestTokens(request = {}) {
  let chars = 0;
  const sysText = request.system ?? request.systemPrompt ?? request.instructions;
  if (typeof sysText === "string") chars += sysText.length;
  const messages = Array.isArray(request.messages) ? request.messages : [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    if (typeof msg.content === "string") {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === "string") chars += block.length;
        else if (typeof block?.text === "string") chars += block.text.length;
        else if (typeof block?.thinking === "string") chars += block.thinking.length;
        else if (typeof block?.arguments === "string") chars += block.arguments.length;
      }
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (typeof tc?.function?.arguments === "string") chars += tc.function.arguments.length;
      }
    }
  }
  if (Array.isArray(request.tools)) {
    for (const tool of request.tools) {
      chars += JSON.stringify(tool ?? {}).length;
    }
  }
  return Math.ceil(chars / 3.5) + 512;
}
function isOpenRouterContextOverflowBody(status, errBody = "") {
  if (status !== 400 && status !== 413 && status !== 422) return false;
  return /context[\s_-]*(?:length|window)|maximum context|tokens.*exceed|too\s+(?:long|large)\s+for|prompt is too long|input is too long/i.test(String(errBody));
}
function markOpenRouterModelCooldown(modelId, nowMs = Date.now()) {
  if (!modelId || modelId === OPENROUTER_FREE_ROUTER_ID) return;
  failedFreeModels.set(modelId, nowMs);
}
function isOpenRouterModelCoolingDown(modelId, nowMs = Date.now()) {
  const failedAt = failedFreeModels.get(modelId);
  if (!failedAt) return false;
  if (nowMs - failedAt >= MODEL_COOLDOWN_MS) {
    failedFreeModels.delete(modelId);
    return false;
  }
  return true;
}
function hashApiKeyFingerprint(apiKey) {
  return crypto.createHash("sha256").update(String(apiKey ?? "")).digest("hex").slice(0, 12);
}
function maskApiKey3(apiKey) {
  const trimmed = String(apiKey ?? "").trim();
  if (trimmed.length <= 12) return "sk-or-***";
  return `${trimmed.slice(0, 9)}\u2026${trimmed.slice(-4)}`;
}
function stripYamlQuotes(raw) {
  const val = String(raw ?? "").trim();
  if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1);
  }
  return val;
}
function parseDshCredentialsYaml(rawText) {
  const entries = [];
  if (typeof rawText !== "string" || !rawText.trim()) return entries;
  const lines = rawText.split(/\r?\n/);
  let currentRef = null;
  let currentValue = null;
  for (const line of lines) {
    const inlineMatch = line.match(/^\s{2}([A-Za-z0-9_.-]+):\s*(\S.+?)\s*$/);
    if (inlineMatch) {
      if (currentRef && currentValue) {
        entries.push({ ref: currentRef, apiKey: currentValue });
      }
      currentRef = null;
      currentValue = null;
      entries.push({ ref: inlineMatch[1], apiKey: stripYamlQuotes(inlineMatch[2]) });
      continue;
    }
    const refMatch = line.match(/^\s{2}([A-Za-z0-9_.-]+):\s*$/);
    if (refMatch) {
      if (currentRef && currentValue) {
        entries.push({ ref: currentRef, apiKey: currentValue });
      }
      currentRef = refMatch[1];
      currentValue = null;
      continue;
    }
    if (currentRef) {
      const valMatch = line.match(/^\s{4}value:\s*(.+?)\s*$/);
      if (valMatch) {
        currentValue = stripYamlQuotes(valMatch[1]);
      }
    }
  }
  if (currentRef && currentValue) {
    entries.push({ ref: currentRef, apiKey: currentValue });
  }
  const results = [];
  for (const entry of entries) {
    if ((entry.ref === "OPENROUTER_API_KEY" || entry.ref.startsWith("OPENROUTER_DOCKYARD_") || entry.ref.startsWith("OPENROUTER_FREE_")) && entry.apiKey.startsWith("sk-or-")) {
      results.push(entry);
      continue;
    }
    if (entry.ref.startsWith("DOCKYARD_DSH_") && entry.apiKey.startsWith("{")) {
      try {
        const parsed = JSON.parse(entry.apiKey);
        if (parsed?.providerId === "openrouter-free" && typeof parsed?.apiKey === "string" && parsed.apiKey.startsWith("sk-or-")) {
          results.push({ ref: entry.ref, apiKey: parsed.apiKey, label: parsed.label });
        }
      } catch {
      }
    }
  }
  return results;
}
function discoverLocalOpenRouterKeys({ homeDir = os.homedir(), env = process.env } = {}) {
  const discovered = [];
  const seenKeys = /* @__PURE__ */ new Set();
  const addCandidate = (apiKey, source, label) => {
    const trimmed = typeof apiKey === "string" ? apiKey.trim() : "";
    if (!trimmed) return;
    const fp = hashApiKeyFingerprint(trimmed);
    if (seenKeys.has(fp)) return;
    seenKeys.add(fp);
    discovered.push({
      apiKey: trimmed,
      fingerprint: fp,
      maskedKey: maskApiKey3(trimmed),
      source,
      label: label || `OpenRouter Key (${maskApiKey3(trimmed)})`
    });
  };
  if (env?.OPENROUTER_FREE_API_KEY) {
    addCandidate(env.OPENROUTER_FREE_API_KEY, "env:OPENROUTER_FREE_API_KEY", "Env OPENROUTER_FREE_API_KEY");
  }
  if (env?.OPENROUTER_API_KEY) {
    addCandidate(env.OPENROUTER_API_KEY, "env:OPENROUTER_API_KEY", "Env OPENROUTER_API_KEY");
  }
  try {
    const credPath = path.join(homeDir, ".dsh", ".credentials.yaml");
    if (fs.existsSync(credPath)) {
      const raw = fs.readFileSync(credPath, "utf8");
      const parsed = parseDshCredentialsYaml(raw);
      for (const item of parsed) {
        addCandidate(
          item.apiKey,
          `dsh_credentials:${item.ref}`,
          item.label || `OpenRouter Key (${maskApiKey3(item.apiKey)})`
        );
      }
    }
  } catch {
  }
  return discovered;
}
function extractOpenRouterFreeAuth({ homeDir = os.homedir(), env = process.env } = {}) {
  const keys = discoverLocalOpenRouterKeys({ homeDir, env });
  return keys[0] ?? null;
}
function classifyOpenRouterFreeKind(item) {
  const id = String(item?.id ?? "").trim();
  const lowerId = id.toLowerCase();
  const desc = String(item?.description ?? "").toLowerCase();
  if (id === OPENROUTER_FREE_ROUTER_ID) return "router";
  if (lowerId.startsWith("stealth/") || lowerId.includes("stealth") || lowerId.includes("cloak") || !lowerId.endsWith(":free") && (lowerId.includes("-alpha") || desc.includes("stealth") || desc.includes("cloaked"))) {
    return "stealth";
  }
  if (!lowerId.endsWith(":free")) {
    return "limited_free";
  }
  return "free";
}
function isUsableOpenRouterFreeModel(item) {
  if (!item || typeof item.id !== "string") return false;
  const id = item.id.trim();
  if (!id) return false;
  if (id === OPENROUTER_FREE_ROUTER_ID) return true;
  const lowerId = id.toLowerCase();
  if (lowerId.includes("content-safety") || lowerId.includes("llama-guard") || lowerId.includes("prompt-guard") || lowerId.startsWith("google/lyria") || lowerId.startsWith("openrouter/auto") || lowerId.startsWith("openrouter/bodybuilder") || lowerId.startsWith("openrouter/fusion") || lowerId.startsWith("openrouter/pareto")) {
    return false;
  }
  const isFreeSuffix = lowerId.endsWith(":free");
  const promptPrice = item.pricing?.prompt;
  const completionPrice = item.pricing?.completion;
  const requestPrice = item.pricing?.request;
  const isZeroPriced = promptPrice !== void 0 && completionPrice !== void 0 && Number(promptPrice) === 0 && Number(completionPrice) === 0 && (requestPrice === void 0 || Number(requestPrice) === 0);
  if (!isFreeSuffix && !isZeroPriced) return false;
  const outputModalities = item.architecture?.output_modalities;
  if (Array.isArray(outputModalities)) {
    if (outputModalities.length > 0 && !outputModalities.includes("text")) {
      return false;
    }
    if (outputModalities.includes("audio") && !isFreeSuffix) {
      return false;
    }
  }
  const supportedParams = item.supported_parameters;
  if (Array.isArray(supportedParams) && supportedParams.length === 0) {
    return false;
  }
  return true;
}
function normalizeOpenRouterFreeModelEntry(item) {
  const id = String(item.id).trim();
  const kind = classifyOpenRouterFreeKind(item);
  const isRouter = kind === "router";
  const rawName = String(item.name || id).replace(/\s*\(free\)\s*$/i, "").replace(/\s*\[free\]\s*$/i, "").trim();
  const name2 = isRouter ? "Free Models Router" : stripVendorPrefix(rawName);
  const rawContextLength = Number(item.top_provider?.context_length || item.context_length);
  const contextWindow = rawContextLength > 0 ? rawContextLength : isRouter ? 2e5 : 131072;
  const rawMaxCompletion = Number(item.top_provider?.max_completion_tokens);
  const maxTokens = rawMaxCompletion > 0 ? rawMaxCompletion : isRouter ? 32768 : Math.min(contextWindow, 16384);
  const inputModalities = ["text"];
  if (isRouter || item.architecture?.input_modalities?.includes("image")) {
    inputModalities.push("image");
  }
  const supportedParams = Array.isArray(item.supported_parameters) ? item.supported_parameters : [];
  const supportsTools = isRouter || supportedParams.length === 0 || supportedParams.includes("tools");
  const supportsReasoning = isRouter || supportedParams.includes("reasoning") || supportedParams.includes("include_reasoning");
  const created = Number(item.created) || 0;
  return {
    id,
    name: name2,
    free: true,
    freeKind: kind,
    created,
    contextWindow,
    maxTokens,
    inputModalities,
    supportsTools,
    supportsReasoning,
    ...supportsReasoning ? {
      reasoning: {
        defaultEffort: "medium",
        efforts: [
          { id: "low", name: "Low" },
          { id: "medium", name: "Medium" },
          { id: "high", name: "High" },
          { id: "xhigh", name: "Extra High" }
        ]
      }
    } : {}
  };
}
function buildOpenRouterFreeCatalogFromRaw(rawModels = []) {
  const entriesById = /* @__PURE__ */ new Map();
  entriesById.set(OPENROUTER_FREE_ROUTER_ID, normalizeOpenRouterFreeModelEntry({
    id: OPENROUTER_FREE_ROUTER_ID,
    name: "Free Models Router",
    context_length: 2e5,
    top_provider: { context_length: 2e5, max_completion_tokens: 32768 },
    architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
    supported_parameters: ["tools", "reasoning", "include_reasoning", "max_tokens", "temperature"]
  }));
  const rawArray = Array.isArray(rawModels) ? rawModels : [];
  for (let i = 0; i < rawArray.length; i++) {
    const item = rawArray[i];
    if (!isUsableOpenRouterFreeModel(item)) continue;
    const normalized = normalizeOpenRouterFreeModelEntry({
      ...item,
      // Preserve OpenRouter's natural newest-first ordering when `created` is equal or missing
      created: Number(item.created) || 1e6 - i
    });
    entriesById.set(normalized.id, normalized);
  }
  const routerEntry = entriesById.get(OPENROUTER_FREE_ROUTER_ID);
  const specificEntries = [...entriesById.values()].filter((m) => m.id !== OPENROUTER_FREE_ROUTER_ID);
  const kindRank = (m) => m.freeKind === "stealth" ? 0 : m.freeKind === "limited_free" ? 1 : 2;
  specificEntries.sort((a, b) => {
    const rA = kindRank(a);
    const rB = kindRank(b);
    if (rA !== rB) return rA - rB;
    if (b.created !== a.created) return b.created - a.created;
    return a.id.localeCompare(b.id);
  });
  return [routerEntry, ...specificEntries];
}
async function fetchLiveOpenRouterFreeModels({
  fetchImpl = globalThis.fetch,
  apiKey = null,
  forceRefresh = false
} = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedLiveModels && now - cachedLiveModelsAt < LIVE_MODELS_CACHE_TTL_MS) {
    return cachedLiveModels;
  }
  if (typeof fetchImpl !== "function") {
    return cachedLiveModels ?? buildOpenRouterFreeCatalogFromRaw(
      PRIORITIZED_FREE_MODELS.map((id, idx) => ({
        id,
        name: id,
        created: 1e6 - idx,
        pricing: { prompt: "0", completion: "0" }
      }))
    );
  }
  try {
    const headers = {
      Accept: "application/json",
      "Cache-Control": "no-cache",
      ...OPENROUTER_AGENTIC_HEADERS,
      ...apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
    };
    const response = await fetchImpl(OPENROUTER_MODELS_ENDPOINT, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(1e4)
    });
    if (response.ok) {
      const payload = await response.json();
      const rawData = Array.isArray(payload?.data) ? payload.data : [];
      const catalog = buildOpenRouterFreeCatalogFromRaw(rawData);
      if (catalog.length > 1) {
        cachedLiveModels = catalog;
        cachedLiveModelsAt = Date.now();
        return catalog;
      }
    }
  } catch {
  }
  return cachedLiveModels ?? buildOpenRouterFreeCatalogFromRaw(
    PRIORITIZED_FREE_MODELS.map((id, idx) => ({
      id,
      name: id,
      created: 1e6 - idx,
      pricing: { prompt: "0", completion: "0" }
    }))
  );
}
function contentToText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return textFromContent(content);
  return content.map((block) => {
    if (typeof block === "string") return block;
    if (block?.type === "text") return block.text ?? "";
    if (block?.type === "tool-result" || block?.type === "tool_result") {
      return textFromContent(block.content ?? block.output ?? block.result ?? block.text);
    }
    return textFromContent(block);
  }).filter(Boolean).join("\n");
}
function isToolCallBlock(block) {
  if (!block || typeof block !== "object") return false;
  const type = String(block.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "tooluse" || type === "functioncall" || Boolean(block.functionCall);
}
function isToolResultBlock(block) {
  if (!block || typeof block !== "object") return false;
  const type = String(block.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolresult";
}
function extractNormalizedToolCall(block, fallbackIndex = 1) {
  const fnObj = block.function ?? block.functionCall ?? null;
  const rawId = block.id ?? block.toolCallId ?? block.tool_call_id ?? fnObj?.id ?? `call_${fallbackIndex}`;
  const rawName = block.name ?? block.toolName ?? block.tool_name ?? fnObj?.name ?? "tool";
  const rawArgs = block.arguments ?? block.input ?? block.args ?? fnObj?.arguments ?? fnObj?.args ?? {};
  return {
    id: sanitizeToolCallId(String(rawId)),
    type: "function",
    function: {
      name: String(rawName),
      arguments: typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs ?? {})
    }
  };
}
async function normalizeMessages(request = {}, { includeReasoningContent = false, attachments = null } = {}) {
  const out = [];
  const sysText = request.system ?? request.systemPrompt ?? request.instructions;
  if (typeof sysText === "string" && sysText.trim()) {
    out.push({ role: "system", content: sysText.trim() });
  }
  const messages = Array.isArray(request.messages) ? request.messages : [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const role = msg.role === "developer" ? "system" : msg.role ?? "user";
    if (role === "tool" || role === "toolResult" || role === "tool_result") {
      if (Array.isArray(msg.content) && msg.content.some(isToolResultBlock)) {
        for (const block of msg.content) {
          if (!isToolResultBlock(block)) continue;
          const toolCallId2 = sanitizeToolCallId(
            block.toolCallId ?? block.tool_call_id ?? block.id ?? msg.tool_call_id ?? msg.toolCallId ?? msg.id ?? "call_1"
          );
          const resultText = typeof block.content === "string" ? block.content : textFromContent(block.content ?? block.output ?? block.result ?? block.text);
          out.push({
            role: "tool",
            tool_call_id: toolCallId2,
            content: resultText || ""
          });
        }
        continue;
      }
      const toolCallId = sanitizeToolCallId(msg.tool_call_id ?? msg.toolCallId ?? msg.id ?? "call_1");
      const rawContent = msg.content ?? msg.output ?? msg.result ?? msg.text;
      out.push({
        role: "tool",
        tool_call_id: toolCallId,
        content: typeof rawContent === "string" ? rawContent : contentToText(rawContent)
      });
      continue;
    }
    if (role === "assistant" && Array.isArray(msg.content)) {
      const textParts = [];
      const thinkingParts = [];
      const toolCalls = [];
      for (const block of msg.content) {
        if (typeof block === "string") {
          textParts.push(block);
        } else if (block?.type === "text" && block.text) {
          textParts.push(block.text);
        } else if ((block?.type === "thinking" || block?.type === "reasoning") && (block.thinking ?? block.text)) {
          thinkingParts.push(block.thinking ?? block.text);
        } else if (isToolCallBlock(block)) {
          toolCalls.push(extractNormalizedToolCall(block, toolCalls.length + 1));
        }
      }
      if (Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const normalizedTc = extractNormalizedToolCall(tc, toolCalls.length + 1);
          if (!toolCalls.some((existing) => existing.id === normalizedTc.id)) {
            toolCalls.push(normalizedTc);
          }
        }
      }
      const joinedText = textParts.join("\n").replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "").trim();
      const entry2 = {
        role: "assistant",
        content: joinedText || (toolCalls.length > 0 ? null : "")
      };
      const existingReasoning = msg.reasoning_content ?? msg.reasoning ?? (thinkingParts.length > 0 ? thinkingParts.join("\n") : void 0);
      if (existingReasoning !== void 0) {
        entry2.reasoning_content = existingReasoning;
      } else if (includeReasoningContent) {
        entry2.reasoning_content = " ";
      }
      if (toolCalls.length > 0) entry2.tool_calls = toolCalls;
      out.push(entry2);
      continue;
    }
    if (role === "user" && Array.isArray(msg.content)) {
      const toolResults = msg.content.filter(isToolResultBlock);
      const nonToolBlocks = msg.content.filter((b) => !isToolResultBlock(b));
      for (const block of toolResults) {
        const toolCallId = sanitizeToolCallId(block.toolCallId ?? block.tool_call_id ?? block.id ?? "call_1");
        const resultText = typeof block.content === "string" ? block.content : textFromContent(block.content ?? block.output ?? block.result ?? block.text);
        out.push({
          role: "tool",
          tool_call_id: toolCallId,
          content: resultText || ""
        });
      }
      if (nonToolBlocks.length === 0 && toolResults.length > 0) {
        continue;
      }
      const parts = [];
      for (const block of nonToolBlocks) {
        if (typeof block === "string") {
          parts.push({ type: "text", text: block });
        } else if (block?.type === "text" && block.text) {
          parts.push({ type: "text", text: block.text });
        } else if (block?.type === "image") {
          let url = block.url ?? (block.data ? `data:${block.mimeType ?? "image/png"};base64,${block.data}` : null);
          if (!url && block.attachment) {
            const resolved = await resolveImageData(block, attachments);
            if (resolved) {
              url = `data:${resolved.mediaType || "image/png"};base64,${resolved.data}`;
            } else {
              throw new Error("\u56FE\u7247\u9644\u4EF6\u65E0\u6CD5\u8BFB\u53D6\uFF1A\u7F3A\u5C11 DSH \u9644\u4EF6\u670D\u52A1\u6216\u9644\u4EF6\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u7C98\u8D34\u56FE\u7247");
            }
          }
          if (url) parts.push({ type: "image_url", image_url: { url } });
        } else if (block?.type === "image_url" && block.image_url) {
          parts.push({ type: "image_url", image_url: block.image_url });
        }
      }
      if (parts.some((p) => p.type === "image_url")) {
        out.push({ role: "user", content: parts });
        continue;
      }
      const textOnly = parts.map((p) => p.text).filter(Boolean).join("\n");
      out.push({ role: "user", content: textOnly });
      continue;
    }
    const rawText = typeof msg.content === "string" ? msg.content : contentToText(msg.content);
    const cleanedText = role === "assistant" ? rawText.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "").trim() : rawText;
    const entry = {
      role,
      content: cleanedText
    };
    if (role === "assistant") {
      if (msg.reasoning_content !== void 0) {
        entry.reasoning_content = msg.reasoning_content;
      } else if (includeReasoningContent) {
        entry.reasoning_content = " ";
      }
    }
    if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
      entry.tool_calls = msg.tool_calls.map((tc, idx) => extractNormalizedToolCall(tc, idx + 1));
      if (!entry.content) entry.content = null;
    }
    out.push(entry);
  }
  let lastAssistant = null;
  for (let i = 0; i < out.length; i++) {
    const item = out[i];
    if (item.role === "assistant") {
      lastAssistant = item;
    } else if (item.role === "tool") {
      const tcId = item.tool_call_id || "call_1";
      if (!lastAssistant) {
        lastAssistant = {
          role: "assistant",
          content: null,
          ...includeReasoningContent ? { reasoning_content: " " } : {},
          tool_calls: [{
            id: tcId,
            type: "function",
            function: { name: "tool", arguments: "{}" }
          }]
        };
        out.splice(i, 0, lastAssistant);
        i += 1;
      } else {
        if (!Array.isArray(lastAssistant.tool_calls)) {
          lastAssistant.tool_calls = [];
          if (!lastAssistant.content) lastAssistant.content = null;
        }
        if (!lastAssistant.tool_calls.some((tc) => tc.id === tcId)) {
          lastAssistant.tool_calls.push({
            id: tcId,
            type: "function",
            function: { name: "tool", arguments: "{}" }
          });
        }
      }
    } else if (item.role === "user") {
      lastAssistant = null;
    }
  }
  return out;
}
function normalizeTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return void 0;
  return tools.map((tool) => {
    if (tool?.type === "function" && tool.function) return tool;
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: tool.parameters ?? tool.inputSchema ?? { type: "object", properties: {} }
      }
    };
  });
}
function requestHasImages(messages = []) {
  return messages.some((m) => Array.isArray(m?.content) && m.content.some((part) => part?.type === "image" || part?.type === "image_url"));
}
function normalizeReasoningParam(request = {}) {
  const rawEffort = request.reasoningEffort ?? request.reasoning?.effort ?? null;
  if (!rawEffort || rawEffort === "none" || rawEffort === "off" || rawEffort === "default") {
    return void 0;
  }
  const validEfforts = /* @__PURE__ */ new Set(["minimal", "low", "medium", "high", "xhigh", "max"]);
  const normalized = String(rawEffort).toLowerCase().trim();
  if (validEfforts.has(normalized)) {
    return { effort: normalized };
  }
  return void 0;
}
function extractReasoningDelta2(delta = {}) {
  if (typeof delta.reasoning_content === "string" && delta.reasoning_content) return delta.reasoning_content;
  if (typeof delta.reasoning === "string" && delta.reasoning) return delta.reasoning;
  if (Array.isArray(delta.reasoning_details)) {
    for (const detail of delta.reasoning_details) {
      if (typeof detail?.text === "string" && detail.text) return detail.text;
      if (typeof detail?.summary === "string" && detail.summary) return detail.summary;
    }
  }
  return "";
}
function selectOpenRouterFreeCandidateQueue({
  requestedModel,
  liveCatalog = [],
  hasTools = false,
  hasImages = false,
  estimatedTokens = 0,
  noFallback = false,
  nowMs = Date.now()
} = {}) {
  const rawModel = String(requestedModel || OPENROUTER_FREE_ROUTER_ID).replace(/^openrouter-free\//, "");
  const isRouter = rawModel === OPENROUTER_FREE_ROUTER_ID || rawModel === "free";
  if (!isRouter && noFallback) {
    return [rawModel];
  }
  const catalogEntries = liveCatalog.filter((entry) => entry.id && entry.id !== OPENROUTER_FREE_ROUTER_ID);
  const entryMap = new Map(catalogEntries.map((entry) => [entry.id, entry]));
  const orderedIds = [];
  const seen = /* @__PURE__ */ new Set();
  const pushCandidate = (id) => {
    if (!id || seen.has(id)) return;
    if (isOpenRouterModelCoolingDown(id, nowMs)) return;
    seen.add(id);
    orderedIds.push(id);
  };
  if (!isRouter) {
    pushCandidate(rawModel);
  }
  const compatiblePool = [];
  const contextFallbackPool = [];
  const secondaryPool = [];
  const allKnownIds = [
    ...PRIORITIZED_FREE_MODELS.filter((id) => entryMap.size === 0 || entryMap.has(id)),
    ...catalogEntries.map((e) => e.id)
  ];
  const requiredContextWindow = estimatedTokens > 0 ? estimatedTokens + 4096 : 0;
  for (const id of allKnownIds) {
    const meta = entryMap.get(id);
    const toolsOk = !hasTools || !meta || meta.supportsTools !== false;
    const imagesOk = !hasImages || !meta || Array.isArray(meta.inputModalities) && meta.inputModalities.includes("image");
    const contextOk = !requiredContextWindow || !meta?.contextWindow || meta.contextWindow >= requiredContextWindow;
    if (toolsOk && imagesOk && contextOk) {
      compatiblePool.push(id);
    } else if (toolsOk && imagesOk) {
      contextFallbackPool.push(id);
    } else {
      secondaryPool.push(id);
    }
  }
  contextFallbackPool.sort((a, b) => {
    const ctxA = entryMap.get(a)?.contextWindow || 0;
    const ctxB = entryMap.get(b)?.contextWindow || 0;
    return ctxB - ctxA;
  });
  for (const id of compatiblePool) pushCandidate(id);
  for (const id of contextFallbackPool) pushCandidate(id);
  for (const id of secondaryPool) pushCandidate(id);
  if (!seen.has(OPENROUTER_FREE_ROUTER_ID)) {
    orderedIds.push(OPENROUTER_FREE_ROUTER_ID);
  }
  if (orderedIds.length === 0) {
    return [isRouter ? OPENROUTER_FREE_ROUTER_ID : rawModel];
  }
  return orderedIds;
}
function createOpenRouterFreeNativeExecutor({
  fetchImpl = globalThis.fetch,
  homeDir = os.homedir(),
  env = process.env,
  timeoutMs = 12e4
} = {}) {
  const executeOpenRouterFreeStream = async function* (input = {}, maybeInvocation = {}, maybeContext = {}) {
    const isWrappedInput = input && typeof input === "object" && ("request" in input || "credential" in input);
    const request = isWrappedInput ? input.request ?? {} : input ?? {};
    const secret = isWrappedInput ? input.credential ?? input.secret ?? null : maybeInvocation?.secret ?? maybeInvocation?.credential ?? maybeContext?.secret ?? null;
    const signal = (isWrappedInput ? input.signal : null) ?? request.signal ?? maybeContext?.signal ?? null;
    const attachments = (isWrappedInput ? input.attachments : null) ?? maybeInvocation?.attachments ?? maybeContext?.attachments ?? null;
    const localAuth = extractOpenRouterFreeAuth({ homeDir, env });
    const apiKey = secret?.apiKey ?? secret?.accessToken ?? secret?.token ?? localAuth?.apiKey;
    if (!apiKey) {
      throw createOpenRouterExecutionError(
        "\u672A\u627E\u5230 OpenRouter API Key\u3002\u8BF7\u5728 Dockyard \u7684 OpenRouter Free \u8BA2\u9605\u5F39\u7A97\u4E2D\u7C98\u8D34\u60A8\u7684 API Key\uFF08\u6216\u626B\u63CF\u672C\u673A\u5DF2\u914D\u7F6E\u7684 OPENROUTER_API_KEY\uFF09\u3002",
        { retryable: false, accountStatus: "expired" }
      );
    }
    const rawModel = String(request.model || OPENROUTER_FREE_ROUTER_ID).replace(/^openrouter-free\//, "");
    const isRouterRequest = rawModel === OPENROUTER_FREE_ROUTER_ID || rawModel === "free";
    const noFallback = Boolean(request.noFallback || request.probe);
    const tools = normalizeTools(request.tools);
    const hasTools = Boolean(tools && tools.length > 0);
    const hasImages = requestHasImages(request.messages);
    const liveCatalog = await fetchLiveOpenRouterFreeModels({ fetchImpl, apiKey });
    const estimatedTokens = estimateOpenRouterRequestTokens(request);
    const candidateQueue = selectOpenRouterFreeCandidateQueue({
      requestedModel: rawModel,
      liveCatalog,
      hasTools,
      hasImages,
      estimatedTokens,
      noFallback: noFallback && !isRouterRequest
    });
    const reasoningParam = normalizeReasoningParam(request);
    const normalizedCache = /* @__PURE__ */ new Map();
    const normalizedMessagesFor = async (includeReasoningContent2) => {
      const key = includeReasoningContent2 ? "1" : "0";
      if (!normalizedCache.has(key)) {
        normalizedCache.set(key, await normalizeMessages(request, { includeReasoningContent: includeReasoningContent2, attachments }));
      }
      return normalizedCache.get(key);
    };
    const buildBodyForModels = async (modelsSlice, { includeReasoningContent: includeReasoningContent2 = false } = {}) => {
      const primaryModel = modelsSlice[0];
      const fallbackModels = modelsSlice.slice(1, 3);
      return {
        model: primaryModel,
        ...fallbackModels.length > 0 ? { models: [primaryModel, ...fallbackModels] } : {},
        messages: await normalizedMessagesFor(includeReasoningContent2),
        stream: true,
        ...tools ? { tools } : {},
        ...reasoningParam ? { reasoning: reasoningParam } : {},
        ...typeof request.maxTokens === "number" ? { max_tokens: request.maxTokens } : {},
        ...typeof request.temperature === "number" ? { temperature: request.temperature } : {}
      };
    };
    const doFetch = async (bodyObj) => {
      let lastNetworkErr = null;
      const maxNetworkAttempts = 2;
      for (let attempt = 1; attempt <= maxNetworkAttempts; attempt++) {
        try {
          return await fetchImpl(OPENROUTER_API_ENDPOINT, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              Accept: "text/event-stream, application/json",
              ...OPENROUTER_AGENTIC_HEADERS
            },
            body: JSON.stringify(bodyObj),
            ...signal ? { signal } : {}
          });
        } catch (err) {
          lastNetworkErr = err;
          if (signal?.aborted || attempt >= maxNetworkAttempts) {
            throw createOpenRouterExecutionError(
              `OpenRouter Free network request failed: ${err?.message || String(err)}`,
              { retryable: true, cause: err }
            );
          }
          await new Promise((resolve2) => setTimeout(resolve2, 250 * attempt));
        }
      }
      throw lastNetworkErr;
    };
    const batches = [];
    if (noFallback && !isRouterRequest) {
      batches.push([rawModel]);
    } else {
      for (let i = 0; i < candidateQueue.length && batches.length < 6; i += 1) {
        const slice = isRouterRequest ? candidateQueue.slice(i, i + 3) : [candidateQueue[i]];
        batches.push(slice);
      }
    }
    let lastStatus = 500;
    let lastErrBody = "Unknown OpenRouter error";
    let sawContextOverflow = false;
    let includeReasoningContent = false;
    let response = null;
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];
      let candidateRes = await doFetch(await buildBodyForModels(batch, { includeReasoningContent }));
      if (!candidateRes.ok) {
        const errBody = await candidateRes.text().catch(() => "");
        if (candidateRes.status === 400 && errBody.includes("reasoning_content") && !includeReasoningContent) {
          includeReasoningContent = true;
          candidateRes = await doFetch(await buildBodyForModels(batch, { includeReasoningContent: true }));
        } else {
          lastStatus = candidateRes.status;
          lastErrBody = errBody || `HTTP ${candidateRes.status}`;
          if (isOpenRouterContextOverflowBody(candidateRes.status, errBody)) {
            sawContextOverflow = true;
          }
          if (candidateRes.status === 401) {
            throw createOpenRouterExecutionError(
              `OpenRouter API Key \u65E0\u6548\u6216\u5DF2\u8FC7\u671F (${candidateRes.status}): ${lastErrBody.slice(0, 300)}`,
              { status: candidateRes.status, retryable: false, accountStatus: "expired" }
            );
          }
          markOpenRouterModelCooldown(batch[0]);
          continue;
        }
      }
      if (!candidateRes.ok) {
        const errBody = await candidateRes.text().catch(() => "");
        lastStatus = candidateRes.status;
        lastErrBody = errBody || `HTTP ${candidateRes.status}`;
        if (isOpenRouterContextOverflowBody(candidateRes.status, errBody)) {
          sawContextOverflow = true;
        }
        markOpenRouterModelCooldown(batch[0]);
        continue;
      }
      response = candidateRes;
      break;
    }
    if (!response) {
      throw createOpenRouterExecutionError(
        `OpenRouter Free request failed (${lastStatus}): ${String(lastErrBody).slice(0, 300)}`,
        {
          status: lastStatus,
          ...sawContextOverflow ? { code: "CONTEXT_WINDOW_EXCEEDED" } : {},
          retryable: sawContextOverflow || lastStatus === 429 || lastStatus >= 500
        }
      );
    }
    const streamEvents = [];
    let nextIndex = 1;
    let reasoning = null;
    let rawUsage = null;
    let stop = "stop";
    let probeYielded = false;
    let substantiveYielded = false;
    const activeTools = /* @__PURE__ */ new Map();
    let inThinkTag = false;
    let thinkPending = "";
    const pushReasoningChunk = (text3) => {
      if (!text3) return;
      substantiveYielded = true;
      textFilter.closeText();
      if (!reasoning) {
        reasoning = { index: nextIndex++, text: "" };
        streamEvents.push({ type: "block-start", index: reasoning.index, blockType: "reasoning" });
      }
      reasoning.text += text3;
      streamEvents.push({ type: "reasoning-delta", index: reasoning.index, text: text3 });
    };
    const reasoningDsmlCalls = [];
    const closeReasoningBlock = () => {
      if (!reasoning) return;
      if (typeof reasoning.text === "string" && reasoning.text.includes("DSML")) {
        const calls = parseDsmlCalls(reasoning.text);
        if (calls?.length > 0) {
          reasoningDsmlCalls.push(...calls);
          reasoning.text = stripDsmlCalls(reasoning.text);
        }
      }
      streamEvents.push({ type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } });
      reasoning = null;
    };
    const pushContentChunk = (rawChunk) => {
      if (!rawChunk) return;
      let buf = thinkPending + rawChunk;
      thinkPending = "";
      while (buf.length > 0) {
        if (inThinkTag) {
          const closeMatch = buf.match(/<\/think(?:ing)?>/i);
          if (closeMatch) {
            const thoughtPart = buf.slice(0, closeMatch.index);
            if (thoughtPart) pushReasoningChunk(thoughtPart);
            closeReasoningBlock();
            inThinkTag = false;
            buf = buf.slice(closeMatch.index + closeMatch[0].length);
            continue;
          }
          const partialClose = buf.match(/<\/(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/i);
          if (partialClose) {
            const safeThought = buf.slice(0, partialClose.index);
            if (safeThought) pushReasoningChunk(safeThought);
            thinkPending = partialClose[0];
          } else {
            pushReasoningChunk(buf);
          }
          break;
        } else {
          const openMatch = buf.match(/<think(?:ing)?>/i);
          if (openMatch) {
            const beforeText = buf.slice(0, openMatch.index);
            if (beforeText) {
              closeReasoningBlock();
              textFilter.push(beforeText, () => nextIndex++);
            }
            inThinkTag = true;
            buf = buf.slice(openMatch.index + openMatch[0].length);
            continue;
          }
          const partialOpen = buf.match(/<(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/i);
          if (partialOpen) {
            const safeText = buf.slice(0, partialOpen.index);
            if (safeText) {
              closeReasoningBlock();
              textFilter.push(safeText, () => nextIndex++);
            }
            thinkPending = partialOpen[0];
          } else {
            closeReasoningBlock();
            textFilter.push(buf, () => nextIndex++);
          }
          break;
        }
      }
    };
    const textFilter = new DsmlStreamFilter({
      onTextBlockStart: (index) => streamEvents.push({ type: "block-start", index, blockType: "text" }),
      onTextDelta: (index, text3) => streamEvents.push({ type: "text-delta", index, text: text3 }),
      onTextBlockEnd: (index, text3) => streamEvents.push({ type: "block-end", index, block: { type: "text", text: text3 } })
    });
    for await (const event of readSseEvents(response, { signal, timeoutMs, providerId: "openrouter-free" })) {
      if (event?.done) continue;
      const parsed = event?.data;
      if (!parsed || typeof parsed !== "object") continue;
      if (parsed.error && !substantiveYielded) {
        const errMsg = parsed.error?.message || JSON.stringify(parsed.error);
        const errCode = Number(parsed.error?.code) || 502;
        throw createOpenRouterExecutionError(
          `OpenRouter Free stream error (${errCode}): ${errMsg}`,
          { status: errCode, retryable: errCode === 429 || errCode >= 500 }
        );
      }
      if (parsed.usage) rawUsage = parsed.usage;
      const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null;
      if (!choice) continue;
      if (request.probe && !probeYielded) {
        probeYielded = true;
        substantiveYielded = true;
        yield { type: "text-delta", index: 0, text: " " };
        yield { type: "finish", reason: finishReason("stop") };
        return;
      }
      const delta = choice.delta ?? choice.message ?? {};
      const reasoningDelta = extractReasoningDelta2(delta);
      if (reasoningDelta) {
        pushReasoningChunk(reasoningDelta);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }
      for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
        substantiveYielded = true;
        const key = Number(call.index ?? activeTools.size);
        if (!activeTools.has(key)) {
          closeReasoningBlock();
          textFilter.closeText();
          while (streamEvents.length > 0) yield streamEvents.shift();
          const state2 = {
            index: nextIndex++,
            id: sanitizeToolCallId(call.id || `call_${key}_${randomUUID12().slice(0, 8)}`),
            name: call.function?.name || call.name || "tool",
            arguments: ""
          };
          activeTools.set(key, state2);
          yield { type: "block-start", index: state2.index, blockType: "tool-call" };
        }
        const state = activeTools.get(key);
        const argumentDelta = call.function?.arguments ?? call.arguments ?? "";
        if (call.id) state.id = sanitizeToolCallId(call.id);
        if (call.function?.name) state.name = call.function.name;
        state.arguments += argumentDelta;
        if (argumentDelta) {
          yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argumentDelta };
        }
      }
      const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
      if (content) {
        substantiveYielded = true;
        pushContentChunk(content);
        while (streamEvents.length > 0) yield streamEvents.shift();
      }
      if (choice.finish_reason) {
        stop = choice.finish_reason;
      }
    }
    if (thinkPending) {
      if (inThinkTag) pushReasoningChunk(thinkPending);
      else {
        closeReasoningBlock();
        textFilter.push(thinkPending, () => nextIndex++);
      }
      thinkPending = "";
    }
    closeReasoningBlock();
    const dsmlResult = textFilter.flush(() => nextIndex++);
    while (streamEvents.length > 0) yield streamEvents.shift();
    const allDsmlCalls = [
      ...reasoningDsmlCalls,
      ...dsmlResult?.toolCalls || []
    ];
    if (activeTools.size > 0) {
      for (const state of activeTools.values()) {
        yield {
          type: "block-end",
          index: state.index,
          block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" }
        };
      }
      stop = "tool_calls";
    } else if (allDsmlCalls.length > 0) {
      for (const dsml of allDsmlCalls) {
        substantiveYielded = true;
        const toolIndex = nextIndex++;
        const toolId = `call_${randomUUID12().slice(0, 8)}`;
        yield { type: "block-start", index: toolIndex, blockType: "tool-call" };
        yield { type: "tool-call-delta", index: toolIndex, id: toolId, name: dsml.name, argumentsDelta: dsml.arguments };
        yield {
          type: "block-end",
          index: toolIndex,
          block: { type: "tool-call", id: toolId, name: dsml.name, arguments: dsml.arguments }
        };
      }
      stop = "tool_calls";
    }
    if (rawUsage) {
      yield {
        type: "usage",
        usage: normalizeUsage(rawUsage)
      };
    }
    yield {
      type: "finish",
      reason: finishReason(stop),
      ...rawUsage ? { usage: normalizeUsage(rawUsage) } : {}
    };
  };
  return guardEmptyCompletion(executeOpenRouterFreeStream, { providerId: "openrouter-free" });
}

// modules/provider-openrouter-free/src/driver.mjs
var PROVIDER_ID15 = "openrouter-free";
var OPENROUTER_KEYS_PAGE = "https://openrouter.ai/settings/keys";
async function readSecret(secretStore, ref) {
  if (!secretStore || !ref) return null;
  try {
    if (typeof secretStore.read === "function") return await secretStore.read(ref);
    if (typeof secretStore.get === "function") return await secretStore.get(ref);
  } catch {
  }
  return null;
}
async function writeSecret(secretStore, ref, value) {
  if (!secretStore || !ref) return;
  if (typeof secretStore.write === "function") {
    await secretStore.write(ref, value);
    return;
  }
  if (typeof secretStore.put === "function") {
    await secretStore.put(ref, value);
  }
}
function createOpenRouterFreeCatalogLoader({
  fetchImpl = globalThis.fetch,
  homeDir = os2.homedir(),
  env = process.env
} = {}) {
  return async function loadOpenRouterFreeCatalog(context = {}) {
    const localAuth = extractOpenRouterFreeAuth({ homeDir, env });
    const apiKey = context?.credential?.apiKey ?? context?.secret?.apiKey ?? localAuth?.apiKey ?? null;
    const models = await fetchLiveOpenRouterFreeModels({
      fetchImpl,
      apiKey,
      forceRefresh: Boolean(context?.force)
    });
    return {
      providerId: PROVIDER_ID15,
      source: "openrouter_live_free_catalog",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      models
    };
  };
}
async function fetchOpenRouterAccountQuota(apiKey, fetchImpl = globalThis.fetch, now = /* @__PURE__ */ new Date()) {
  const nowIso = now.toISOString();
  if (typeof fetchImpl !== "function" || !apiKey) {
    return {
      plan: "OpenRouter Free Router",
      quota: createQuotaSnapshot({
        remaining: null,
        limit: null,
        unit: "USD",
        resetAt: null,
        updatedAt: nowIso,
        source: "openrouter_free_key",
        windows: []
      }, now),
      quotaDiagnostic: "OpenRouter Free Key \u5DF2\u5C31\u7EEA \xB7 \u5B9E\u65F6\u540C\u6B65\u5E38\u9A7B\u514D\u8D39\u3001\u9690\u79D8\u4E0E\u9650\u65F6\u514D\u8D39\u6A21\u578B"
    };
  }
  let totalCredits = null;
  let totalUsage = null;
  let isFreeTier = null;
  let keyLabel = null;
  let keyLimit = null;
  let keyLimitRemaining = null;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    ...OPENROUTER_AGENTIC_HEADERS
  };
  const [creditsRes, keyRes] = await Promise.allSettled([
    fetchImpl(OPENROUTER_CREDITS_ENDPOINT, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8e3)
    }),
    fetchImpl(OPENROUTER_KEY_ENDPOINT, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(8e3)
    })
  ]);
  if (keyRes.status === "fulfilled") {
    if (keyRes.value.status === 401 || keyRes.value.status === 403) {
      const err = new Error(`OpenRouter API Key \u65E0\u6548 (${keyRes.value.status})`);
      err.status = keyRes.value.status;
      throw err;
    }
    if (keyRes.value.ok) {
      const body = await keyRes.value.json().catch(() => ({}));
      const data = body?.data ?? body ?? {};
      if (typeof data.is_free_tier === "boolean") isFreeTier = data.is_free_tier;
      if (typeof data.label === "string" && data.label.trim()) keyLabel = data.label.trim();
      if (typeof data.limit === "number" && Number.isFinite(data.limit)) keyLimit = data.limit;
      if (typeof data.limit_remaining === "number" && Number.isFinite(data.limit_remaining)) {
        keyLimitRemaining = data.limit_remaining;
      }
    }
  }
  if (creditsRes.status === "fulfilled") {
    if (creditsRes.value.status === 401 || creditsRes.value.status === 403) {
      const err = new Error(`OpenRouter API Key \u65E0\u6548 (${creditsRes.value.status})`);
      err.status = creditsRes.value.status;
      throw err;
    }
    if (creditsRes.value.ok) {
      const body = await creditsRes.value.json().catch(() => ({}));
      const data = body?.data ?? body ?? {};
      if (typeof data.total_credits === "number" && Number.isFinite(data.total_credits)) {
        totalCredits = data.total_credits;
      }
      if (typeof data.total_usage === "number" && Number.isFinite(data.total_usage)) {
        totalUsage = data.total_usage;
      }
    }
  }
  const rawRemaining = totalCredits !== null && totalUsage !== null ? Math.max(0, Number((totalCredits - totalUsage).toFixed(4))) : keyLimitRemaining;
  const limitCredits = totalCredits !== null && totalCredits > 0 ? Number(totalCredits.toFixed(4)) : keyLimit;
  const hasPositiveBalance = typeof rawRemaining === "number" && rawRemaining > 0;
  const effectiveRemaining = hasPositiveBalance ? rawRemaining : null;
  const windows = [];
  if (hasPositiveBalance) {
    windows.push({
      id: "credits",
      name: "OpenRouter Credits (\u514D\u8D39/\u9690\u79D8\u6A21\u578B\u4E0D\u6263\u8D39)",
      remaining: rawRemaining,
      limit: limitCredits !== null && limitCredits > 0 ? limitCredits : null,
      unit: "USD",
      resetAt: null,
      updatedAt: nowIso,
      source: "openrouter_credits_api"
    });
  }
  const plan = isFreeTier === false || hasPositiveBalance ? "OpenRouter Key (\u9AD8\u5E76\u53D1\u514D\u8D39\u989D\u5EA6)" : "OpenRouter Free Key (0 \u6263\u8D39\u65E0\u9650\u7545\u4EAB)";
  return {
    plan,
    keyLabel,
    quota: createQuotaSnapshot({
      remaining: effectiveRemaining,
      limit: hasPositiveBalance ? limitCredits : null,
      unit: "USD",
      resetAt: null,
      updatedAt: nowIso,
      source: "openrouter_credits_api",
      windows
    }, now),
    quotaDiagnostic: hasPositiveBalance ? `\u8D26\u6237\u4F59\u989D $${rawRemaining.toFixed(2)} \xB7 \u8C03\u7528\u514D\u8D39/\u9690\u79D8\u9650\u514D\u6A21\u578B\u5B8C\u5168 0 \u6263\u8D39` : "\u5DF2\u7ED1\u5B9A OpenRouter API Key \xB7 \u514D\u8D39\u6A21\u578B\u3001\u9690\u79D8\u6A21\u578B\u4E0E\u9650\u65F6\u514D\u8D39\u6A21\u578B\u5168\u90E8 0 \u6263\u8D39\u53EF\u7528"
  };
}
var OpenRouterFreeDriver = class {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.homeDir = options.homeDir ?? os2.homedir();
    this.env = options.env ?? process.env;
    this.catalogLoader = options.catalogLoader ?? createOpenRouterFreeCatalogLoader({
      fetchImpl: this.fetchImpl,
      homeDir: this.homeDir,
      env: this.env
    });
    this.requestExecutor = options.requestExecutor ?? createOpenRouterFreeNativeExecutor({
      fetchImpl: this.fetchImpl,
      homeDir: this.homeDir,
      env: this.env
    });
  }
  async discover() {
    const keys = discoverLocalOpenRouterKeys({ homeDir: this.homeDir, env: this.env });
    if (keys.length === 0) {
      return {
        source: "openrouter_local_credentials",
        candidates: [],
        diagnostics: ["\u672A\u5728\u672C\u673A\u73AF\u5883\u53D8\u91CF\u6216 DSH Credentials \u4E2D\u53D1\u73B0 OPENROUTER_API_KEY\uFF1B\u53EF\u76F4\u63A5\u5728\u4E0A\u65B9\u7C98\u8D34 API Key \u6DFB\u52A0\u3002"]
      };
    }
    const candidates = keys.map((item) => {
      const accountId = `openrouter-free-${item.fingerprint}`;
      return {
        candidateId: `openrouter-free:${accountId}`,
        accountId,
        providerId: PROVIDER_ID15,
        displayName: item.label,
        email: item.maskedKey,
        status: "available",
        source: item.source,
        apiKey: item.apiKey,
        fingerprint: item.fingerprint,
        resources: {
          authSource: item.source,
          identitySource: "openrouter_api_key",
          identityLabel: item.maskedKey,
          sessionFingerprint: item.fingerprint,
          identityNote: `OpenRouter API Key (${item.maskedKey}) \xB7 \u81EA\u52A8\u540C\u6B65\u5B9E\u65F6\u514D\u8D39\u4E0E\u9690\u79D8\u9650\u514D\u6A21\u578B`,
          quotaUrl: OPENROUTER_KEYS_PAGE
        }
      };
    });
    return {
      source: "openrouter_local_credentials",
      candidates,
      diagnostics: []
    };
  }
  async importAccount(candidate2, context = {}) {
    if (!candidate2?.accountId) {
      throw new ValidationError("OpenRouter Free candidate accountId is required");
    }
    const localAuth = extractOpenRouterFreeAuth({ homeDir: this.homeDir, env: this.env });
    const apiKey = candidate2.apiKey ?? localAuth?.apiKey;
    if (!apiKey) {
      throw new ValidationError("OpenRouter API Key is required to import account");
    }
    const fingerprint = candidate2.fingerprint ?? hashApiKeyFingerprint(apiKey);
    const masked = maskApiKey3(apiKey);
    const credentialRef = createCredentialRef(PROVIDER_ID15, candidate2.accountId);
    await writeSecret(context.secretStore, credentialRef, {
      type: "openrouter_free_auth",
      providerId: PROVIDER_ID15,
      accountId: candidate2.accountId,
      apiKey,
      label: candidate2.displayName ?? `OpenRouter Key (${masked})`,
      source: candidate2.source ?? "manual_api_key",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    let quotaInfo;
    try {
      quotaInfo = await fetchOpenRouterAccountQuota(apiKey, this.fetchImpl, now);
    } catch {
      quotaInfo = {
        plan: "OpenRouter Free Key (0 \u6263\u8D39\u65E0\u9650\u7545\u4EAB)",
        quota: createQuotaSnapshot({
          remaining: null,
          limit: null,
          unit: "USD",
          resetAt: null,
          updatedAt: now.toISOString(),
          source: "openrouter_free_key",
          windows: []
        }, now),
        quotaDiagnostic: "OpenRouter API Key \u5DF2\u63A5\u5165 \xB7 \u81EA\u52A8\u540C\u6B65\u5B9E\u65F6\u514D\u8D39\u4E0E\u9690\u79D8\u9650\u514D\u6A21\u578B"
      };
    }
    return createAccountRecord({
      providerId: PROVIDER_ID15,
      accountId: candidate2.accountId,
      displayName: candidate2.displayName || quotaInfo.keyLabel || `OpenRouter Key (${masked})`,
      email: candidate2.email || masked,
      credentialRef,
      auth: {
        kind: "api_key",
        credentialRef,
        scopes: ["chat", "models", "credits"]
      },
      subscription: {
        plan: quotaInfo.plan,
        status: "active"
      },
      quota: quotaInfo.quota,
      refresh: {
        refreshable: true,
        lastRefreshedAt: now.toISOString()
      },
      resources: {
        ...candidate2.resources ?? {},
        authSource: candidate2.source ?? "manual_api_key",
        identitySource: "openrouter_api_key",
        identityLabel: masked,
        sessionFingerprint: fingerprint,
        identityNote: `OpenRouter API Key (${masked}) \xB7 \u5B9E\u65F6\u514D\u8D39\u3001\u9690\u79D8\u4E0E\u9650\u65F6\u514D\u8D39\u6A21\u578B`,
        quotaDiagnostic: quotaInfo.quotaDiagnostic,
        quotaUrl: OPENROUTER_KEYS_PAGE
      },
      health: {
        status: ACCOUNT_HEALTH.HEALTHY
      }
    }, now);
  }
  async importSource(source, context = {}) {
    const rawKey = typeof source === "string" ? source : source?.apiKey ?? source?.key ?? source?.token ?? source?.content ?? "";
    const apiKey = String(rawKey ?? "").trim();
    if (!apiKey) {
      throw new ValidationError("\u8BF7\u8F93\u5165\u6709\u6548\u7684 OpenRouter API Key\uFF08\u4F8B\u5982 sk-or-v1-...\uFF09");
    }
    const customLabel = typeof source === "object" && typeof source?.label === "string" ? source.label.trim() : "";
    const fingerprint = hashApiKeyFingerprint(apiKey);
    const masked = maskApiKey3(apiKey);
    const accountId = `openrouter-free-${fingerprint}`;
    const account = await this.importAccount({
      candidateId: `openrouter-free:${accountId}`,
      accountId,
      providerId: PROVIDER_ID15,
      displayName: customLabel || `OpenRouter Key (${masked})`,
      email: masked,
      source: "manual_api_key",
      apiKey,
      fingerprint
    }, context);
    return [account];
  }
  async getActiveSession(context = {}) {
    const discovered = await this.discover(context);
    if (!discovered.candidates?.length) return null;
    const accounts = [];
    for (const candidate2 of discovered.candidates) {
      accounts.push(await this.importAccount(candidate2, context));
    }
    return {
      status: "completed",
      providerId: PROVIDER_ID15,
      instructions: "\u5DF2\u81EA\u52A8\u5BFC\u5165\u672C\u673A OpenRouter API Key\u3002",
      accounts
    };
  }
  async startAuthorization(context = {}) {
    const active = await this.getActiveSession(context);
    if (active) return active;
    return {
      status: "opened",
      providerId: PROVIDER_ID15,
      authorizationUrl: OPENROUTER_KEYS_PAGE,
      instructions: "\u8BF7\u5728\u4E0B\u65B9\u76F4\u63A5\u7C98\u8D34\u60A8\u7684 OpenRouter API Key\uFF08sk-or-v1-...\uFF09\uFF0C\u6216\u5728\u6253\u5F00\u7684 OpenRouter \u9875\u9762\u521B\u5EFA\u65B0 Key \u540E\u7C98\u8D34\u6DFB\u52A0\u3002"
    };
  }
  async refreshAccount(account, context = {}) {
    const stored = await readSecret(context.secretStore, account?.auth?.credentialRef);
    const localAuth = extractOpenRouterFreeAuth({ homeDir: this.homeDir, env: this.env });
    const apiKey = stored?.apiKey ?? localAuth?.apiKey;
    if (!apiKey) {
      return {
        account: {
          ...account,
          health: {
            status: ACCOUNT_HEALTH.EXPIRED,
            lastError: "\u672A\u627E\u5230\u5BF9\u5E94\u7684 OpenRouter API Key\uFF0C\u8BF7\u5728\u4E0A\u65B9\u91CD\u65B0\u7C98\u8D34\u6DFB\u52A0\u3002"
          }
        }
      };
    }
    await fetchLiveOpenRouterFreeModels({
      fetchImpl: this.fetchImpl,
      apiKey,
      forceRefresh: true
    }).catch(() => {
    });
    const now = context.now instanceof Date ? context.now : /* @__PURE__ */ new Date();
    try {
      const quotaInfo = await fetchOpenRouterAccountQuota(apiKey, this.fetchImpl, now);
      return {
        account: {
          ...account,
          subscription: {
            plan: quotaInfo.plan,
            status: "active"
          },
          quota: quotaInfo.quota,
          refresh: {
            ...account.refresh,
            refreshable: true,
            lastRefreshedAt: now.toISOString()
          },
          resources: {
            ...account.resources ?? {},
            quotaDiagnostic: quotaInfo.quotaDiagnostic,
            quotaUrl: OPENROUTER_KEYS_PAGE
          },
          health: {
            status: ACCOUNT_HEALTH.HEALTHY,
            lastError: null
          }
        }
      };
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        return {
          account: {
            ...account,
            health: {
              status: ACCOUNT_HEALTH.EXPIRED,
              lastError: err.message
            }
          }
        };
      }
      return {
        account: {
          ...account,
          refresh: {
            ...account.refresh,
            refreshable: true,
            lastRefreshedAt: now.toISOString()
          },
          health: {
            status: ACCOUNT_HEALTH.HEALTHY,
            lastError: null
          }
        }
      };
    }
  }
  async getQuota(account, context = {}) {
    const refreshed = await this.refreshAccount(account, context);
    return refreshed.account.quota;
  }
  async getCatalog(context = {}) {
    let credential = null;
    if (context?.secretStore && context?.accounts?.[0]?.auth?.credentialRef) {
      credential = await readSecret(context.secretStore, context.accounts[0].auth.credentialRef);
    }
    return this.catalogLoader({
      ...context,
      force: Boolean(context?.force),
      credential
    });
  }
  async invoke(request, invocation, context = {}) {
    return this.stream(request, invocation, context);
  }
  async stream(request, invocation, context = {}) {
    if (typeof this.requestExecutor !== "function") {
      throw new DockyardError("provider_execution_error", "OpenRouter Free requestExecutor is not configured", {
        retryable: false
      });
    }
    const credential = await readSecret(context.secretStore, invocation?.account?.auth?.credentialRef);
    return this.requestExecutor({
      request,
      account: invocation?.account ?? null,
      credential,
      signal: context.signal ?? request?.signal ?? null,
      // Images reach the provider as opaque attachment references; without the
      // durable attachment service the transport silently drops them.
      attachments: context.attachments ?? invocation?.attachments ?? null
    });
  }
};
function createOpenRouterFreeDriver(options = {}) {
  return new OpenRouterFreeDriver(options);
}

// modules/provider-openrouter-free/src/index.mjs
function summarizeOpenRouterFreeCandidate(candidate2) {
  return {
    candidateId: candidate2.candidateId,
    accountId: candidate2.accountId,
    providerId: candidate2.providerId ?? "openrouter-free",
    displayName: candidate2.displayName ?? null,
    email: candidate2.email ?? null,
    status: candidate2.status ?? "available",
    source: candidate2.source ?? "openrouter_local_credentials",
    resources: candidate2.resources ?? {}
  };
}
function createOpenRouterFreeModule(options = {}) {
  const driver = options.driver ?? createOpenRouterFreeDriver(options);
  return defineProviderModule({
    id: "openrouter-free",
    displayName: "OpenRouter Free",
    capabilities: [
      ...PROVIDER_CAPABILITIES,
      PROVIDER_BEHAVIOR_CAPABILITIES.API_KEY_AUTH,
      PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT,
      PROVIDER_BEHAVIOR_CAPABILITIES.FORCE_LIVE_CATALOG,
      PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP
    ],
    driver
  });
}

// modules/provider-trae-cn/src/driver.mjs
import { randomUUID as randomUUID14 } from "node:crypto";

// modules/provider-trae-cn/src/native-transport.mjs
import { createServer as createServer2 } from "node:http";
import { randomBytes as randomBytes5, randomInt, randomUUID as randomUUID13 } from "node:crypto";
var PROVIDER_ID16 = "trae-cn";
var TRAE_CN_SITE = Object.freeze({
  id: PROVIDER_ID16,
  name: "Trae CN",
  webHost: "https://www.trae.cn",
  authHost: "https://api.trae.cn",
  apiHost: "https://trae-api-cn.mchost.guru",
  clientId: "ono9krqynydwx5",
  appId: "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8",
  pluginVersion: "2.3.24254",
  // The IDE version named to the authorization page, and the client version
  // the model host is told it serves.
  ideVersion: "3.3.65",
  clientVersion: "0.1.69",
  clientVersionCode: "20260917",
  brand: "ASUS TUF Gaming A15 FA507RM_FA507RM",
  deviceType: "windows",
  osVersion: "Windows 10",
  systemType: "Windows",
  deviceCpu: "AMD"
});
var TRAE_CN_REASONING = Object.freeze({
  efforts: [
    { id: "ultra", name: "Ultra", description: "Maximum reasoning depth." },
    { id: "high", name: "High", description: "Thorough reasoning for hard tasks.", default: true },
    { id: "light", name: "Light", description: "Fast, light reasoning for simple tasks." }
  ],
  defaultEffort: "high"
});
var TRAE_CN_MODELS = Object.freeze([
  {
    id: "deepseek-v4.1-flash",
    name: "DeepSeek-V4.1-Flash",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "DeepSeek-V4-Pro-Official",
    name: "DeepSeek-V4-Pro",
    contextWindow: 1e6,
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "glm-5.3",
    name: "GLM-5.3",
    contextWindow: 1e6,
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "glm-5.3-flash",
    name: "GLM-5.3-Flash",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "glm-5.3-flashx",
    name: "GLM-5.3-FlashX",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "kimi-k3",
    name: "Kimi-K3",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "kimi-k2.7-code",
    name: "kimi-k2.7-code",
    contextWindow: 2e5
  },
  {
    id: "mimo-v2.6-flash",
    name: "MiMo-V2.6-Flash",
    contextWindow: 981504,
    inputModalities: ["text", "image"]
  },
  {
    id: "mimo-v2.6-pro",
    name: "MiMo-V2.6-Pro",
    contextWindow: 981504,
    inputModalities: ["text", "image"]
  },
  {
    id: "minimax-m3",
    name: "MiniMax-M3",
    contextWindow: 1e6,
    inputModalities: ["text", "image"]
  },
  {
    id: "minimax-m3.1-flash",
    name: "MiniMax-M3.1-Flash",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "step-5-preview",
    name: "Step-5-Preview",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "qwen3.8-flash",
    name: "Qwen3.8-Flash",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "qwen3.8-max",
    name: "Qwen3.8-Max",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true },
        { id: "extra_high", name: "Extra High" }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "qwen-3.7-plus",
    name: "Qwen3.7-Plus",
    contextWindow: 2e5,
    inputModalities: ["text", "image"]
  },
  {
    id: "Doubao-Seed-Evolving",
    name: "Seed-Evolving",
    contextWindow: 1e6,
    inputModalities: ["text", "image"]
  },
  {
    id: "Doubao-Seed-2.1-Pro",
    name: "Seed-2.1-Pro-0915",
    contextWindow: 1e6,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "Doubao-Seed-2.1-Turbo",
    name: "Seed-2.1-Turbo",
    contextWindow: 256e3,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "DeepSeek-V4-Flash",
    name: "DeepSeek-V4-Flash",
    contextWindow: 2e5
  },
  {
    id: "glm-5.2",
    name: "glm-5.2",
    contextWindow: 2e5
  },
  {
    id: "glm-5.1",
    name: "GLM-5.1",
    contextWindow: 2e5
  },
  {
    id: "glm-5",
    name: "GLM-5",
    contextWindow: 2e5
  },
  {
    id: "glm-5v-turbo",
    name: "GLM-5V-Turbo",
    contextWindow: 2e5,
    inputModalities: ["text", "image"]
  },
  {
    id: "kimi-k2.6",
    name: "Kimi-K2.6",
    contextWindow: 2e5,
    inputModalities: ["text", "image"]
  },
  {
    id: "kimi-k2.5",
    name: "Kimi-K2.5",
    contextWindow: 2e5,
    inputModalities: ["text", "image"]
  },
  {
    id: "minimax-m2.7",
    name: "MiniMax-M2.7",
    contextWindow: 2e5
  },
  {
    id: "minimax-m2.5",
    name: "minimax-m2.5",
    contextWindow: 2e5
  },
  {
    id: "qwen-3.6-plus",
    name: "Qwen3.6-Plus",
    contextWindow: 2e5,
    inputModalities: ["text", "image"]
  },
  {
    id: "qwen-3.5",
    name: "Qwen3.5-Plus",
    contextWindow: 2e5,
    inputModalities: ["text", "image"]
  },
  {
    id: "Doubao-Seed-Code",
    name: "Seed-Code",
    contextWindow: 256e3,
    inputModalities: ["text", "image"],
    reasoning: {
      efforts: [
        { id: "light", name: "Light" },
        { id: "high", name: "High", default: true }
      ],
      defaultEffort: "high"
    }
  },
  {
    id: "Doubao-Seed-2.0-Code",
    name: "Doubao-Seed-2.0-Code",
    contextWindow: 184e3,
    inputModalities: ["text", "image"]
  }
]);
var TRAE_CN_CHAT_FUNCTION = "chat_v3";
var digits = (count) => Array.from(
  { length: count },
  (_, index) => index === 0 ? randomInt(1, 10) : randomInt(0, 10)
).join("");
function newTraeDevice() {
  return {
    deviceId: digits(16),
    machineId: randomBytes5(16).toString("hex")
  };
}
function traeWhen(value) {
  if (value === void 0 || value === null || value === "") return 0;
  if (typeof value === "string" && !/^\d+$/u.test(value.trim())) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return number < 1e11 ? number * 1e3 : number;
}
function parseJsonish(value) {
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function readTraeCallback(params, { site = TRAE_CN_SITE, device } = {}) {
  const jwt = parseJsonish(params.get("userJwt"));
  const info = parseJsonish(params.get("userInfo"));
  const token = jwt.Token ?? jwt.token ?? "";
  const refreshToken = jwt.RefreshToken ?? jwt.refreshToken ?? params.get("refreshToken") ?? "";
  if (!token && !refreshToken) {
    throw new Error(`${site.name} \u6CA1\u6709\u8FD4\u56DE\u767B\u5F55\u51ED\u636E\uFF08userJwt / refreshToken \u90FD\u662F\u7A7A\u7684\uFF09`);
  }
  return {
    token,
    refreshToken,
    // `TokenExpireAt` is what the page sends; a bare JWT's exp is the fallback.
    expiresAt: traeWhen(jwt.TokenExpireAt ?? jwt.tokenExpireAt) || traeWhen(jwt.exp * 1e3),
    refreshExpiresAt: traeWhen(params.get("refreshExpireAt") ?? jwt.RefreshExpireAt),
    clientId: jwt.ClientID ?? jwt.clientId ?? params.get("clientId") ?? site.clientId,
    uid: String(info.UserID ?? info.userId ?? params.get("userId") ?? jwt.UserID ?? jwt.userId ?? ""),
    name: String(info.ScreenName ?? info.screenName ?? info.UserName ?? ""),
    email: String(info.Email ?? info.email ?? ""),
    device: device ?? newTraeDevice(),
    region: String(params.get("userRegion") ?? ""),
    host: String(params.get("host") ?? "")
  };
}
function traeAuthorizationUrl({ callback, device, site = TRAE_CN_SITE, traceId = randomUUID13() }) {
  const query = new URLSearchParams({
    login_version: "1",
    auth_from: "solo",
    login_channel: "native_ide",
    plugin_version: site.pluginVersion,
    auth_type: "local",
    client_id: site.clientId,
    redirect: "0",
    login_trace_id: traceId,
    auth_callback_url: callback,
    machine_id: device.machineId,
    device_id: device.deviceId,
    x_device_id: device.deviceId,
    x_machine_id: device.machineId,
    x_device_brand: site.brand,
    x_device_type: site.deviceType,
    x_os_version: `${site.osVersion} Pro`,
    x_env: "",
    x_app_version: site.ideVersion,
    x_app_type: "stable",
    hide_saas_login: "false"
  });
  return `${site.webHost}/authorization?${query}`;
}
var SIGN_IN_PAGE = (ok, title, message) => `<!doctype html><html><head><meta charset="utf-8">
<title>${title}</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:40px;max-width:640px;line-height:1.6">
<h2>${ok ? "\u2705" : "\u274C"} ${title}</h2><p>${message}</p></body></html>`;
async function startTraeSignIn({ site = TRAE_CN_SITE, timeoutMs = 6e5, device = newTraeDevice() } = {}) {
  let settle;
  const done = new Promise((resolve2) => {
    settle = resolve2;
  });
  let finished = false;
  const finish = (value) => {
    if (finished) return;
    finished = true;
    settle(value);
  };
  const server = createServer2((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors).end();
      return;
    }
    const html = (body) => {
      res.writeHead(200, { ...cors, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(body);
    };
    if (url.pathname !== "/authorize") {
      res.writeHead(404, cors).end();
      return;
    }
    if (finished) {
      html(SIGN_IN_PAGE(false, "\u8FD9\u6B21\u767B\u5F55\u5DF2\u7ECF\u7ED3\u675F", "\u8BF7\u91CD\u65B0\u4ECE Dockyard \u53D1\u8D77\u767B\u5F55\u3002"));
      return;
    }
    const params = url.searchParams;
    if (params.get("error")) {
      const message = params.get("error_description") || params.get("error");
      finish({ ok: false, error: message });
      html(SIGN_IN_PAGE(false, "\u767B\u5F55\u6CA1\u6709\u5B8C\u6210", message));
      return;
    }
    try {
      const credential = readTraeCallback(params, { site, device });
      finish({ ok: true, credential });
      html(SIGN_IN_PAGE(true, "\u767B\u5F55\u6210\u529F", `${credential.name || credential.uid || "\u8D26\u53F7"} \u5DF2\u63A5\u5165 Dockyard DSH\uFF0C\u53EF\u4EE5\u5173\u95ED\u6B64\u9875\u9762\u3002`));
    } catch (error) {
      finish({ ok: false, error: error.message });
      html(SIGN_IN_PAGE(false, "\u767B\u5F55\u6CA1\u6709\u5B8C\u6210", error.message));
    }
  });
  await new Promise((resolve2, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve2);
  });
  const callback = `http://127.0.0.1:${server.address().port}/authorize`;
  const authorizationUrl = traeAuthorizationUrl({ callback, device, site });
  const timer = setTimeout(() => finish({ ok: false, error: "\u767B\u5F55\u8D85\u65F6" }), timeoutMs);
  const close = () => {
    clearTimeout(timer);
    try {
      server.close();
    } catch {
    }
  };
  done.then(() => setTimeout(close, 5e3).unref?.());
  return {
    authorizationUrl,
    instructions: `\u5728\u6D4F\u89C8\u5668\u4E2D\u767B\u5F55 ${site.name} \u5E76\u540C\u610F\u6388\u6743\uFF1B\u6388\u6743\u5B8C\u6210\u540E\u672C\u9875\u4F1A\u81EA\u52A8\u56DE\u5230 Dockyard\uFF0C\u4E0D\u9700\u8981\u590D\u5236\u4EFB\u4F55\u4EE3\u7801\u3002`,
    device,
    result: done,
    cancel: () => {
      finish({ ok: false, error: "\u5DF2\u53D6\u6D88" });
      close();
    }
  };
}
function traeHeaders(account, { site = TRAE_CN_SITE, extra = {} } = {}) {
  const token = String(account?.token ?? "");
  return {
    "Content-Type": "application/json",
    Authorization: `Cloud-IDE-JWT ${token}`,
    "X-Cloudide-Token": token,
    "x-ide-token": token,
    "x-uid": String(account?.uid ?? ""),
    "x-app-id": site.appId,
    "x-device-id": String(account?.device?.deviceId ?? ""),
    "x-machine-id": String(account?.device?.machineId ?? ""),
    "x-request-id": randomUUID13(),
    "x-app-version": site.clientVersion,
    "x-app-version-code": site.clientVersionCode,
    "x-ide-version": site.clientVersion,
    "x-ide-version-code": site.clientVersionCode,
    "x-ide-version-type": "stable",
    "x-device-cpu": site.deviceCpu,
    "x-device-brand": site.brand,
    "x-device-type": site.deviceType,
    "x-os-version": site.osVersion,
    "x-system-type": site.systemType,
    ...extra
  };
}
function messageText(message) {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((part) => part && (part.type === "text" || typeof part.text === "string")).map((part) => part.text ?? "").filter(Boolean).join("\n");
}
function traeMessages(request = {}) {
  const messages = [];
  if (typeof request.system === "string" && request.system.trim().length > 0) {
    messages.push({ role: "system", content: [{ type: "text", text: request.system }] });
  }
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "developer" ? "system" : message?.role ?? "user";
    const calls = role === "assistant" ? assistantCalls(message) : [];
    if (role === "tool") {
      const text4 = messageText(message);
      const toolCallId = toolResultId(message);
      messages.push({
        role: "tool",
        tool_call_id: toolCallId,
        content: [{ type: "text", text: text4 || "(no output)" }]
      });
      continue;
    }
    const text3 = messageText(message);
    if (!text3 && calls.length === 0) continue;
    const entry = { role, content: [{ type: "text", text: text3 ?? "" }] };
    if (calls.length > 0) entry.tool_calls = calls;
    messages.push(entry);
  }
  return messages;
}
function assistantCalls(message) {
  const calls = [];
  const push = (id, name2, args) => {
    const trimmed = String(name2 ?? "").trim();
    if (!trimmed) return;
    calls.push({
      id: String(id ?? `call_${calls.length + 1}`),
      type: "function",
      // Trae's own name for this: `function_call` (a `function` key is read as
      // a ToolCall without a name and the whole stream fails).
      function_call: { name: trimmed, arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) }
    });
  };
  for (const block of Array.isArray(message?.content) ? message.content : []) {
    if (block?.type !== "tool-call" && block?.type !== "tool_call") continue;
    push(block.id ?? block.toolCallId, block.name ?? block.toolName, block.arguments ?? block.input ?? "{}");
  }
  for (const call of Array.isArray(message?.tool_calls) ? message.tool_calls : []) {
    push(call.id, call.function?.name ?? call.name, call.function?.arguments ?? call.arguments ?? "{}");
  }
  return calls;
}
function toolResultId(message) {
  const direct = message?.tool_call_id ?? message?.toolCallId ?? message?.id;
  if (typeof direct === "string" && direct) return direct;
  for (const block of Array.isArray(message?.content) ? message.content : []) {
    const id = block?.toolCallId ?? block?.tool_call_id ?? block?.id;
    if (typeof id === "string" && id) return id;
  }
  return "call_1";
}
function traeTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return void 0;
  const mapped = [];
  for (const tool of tools) {
    const fn = tool?.function ?? tool;
    const name2 = String(fn?.name ?? "").trim();
    if (!name2) continue;
    const parameters = typeof fn.parameters === "string" ? fn.parameters : JSON.stringify(fn.parameters ?? fn.input_schema ?? { type: "object", properties: {} });
    mapped.push({
      type: "function",
      function: { name: name2, description: String(fn.description ?? ""), parameters }
    });
  }
  return mapped.length > 0 ? mapped : void 0;
}
function traeChatBody(request = {}, { site = TRAE_CN_SITE, model } = {}) {
  const chosen = model ?? request.model ?? TRAE_CN_MODELS[0].id;
  const body = {
    messages: traeMessages(request),
    function: TRAE_CN_CHAT_FUNCTION,
    // A real model id is required: `"auto"` is answered with
    // `4001 param is invalid`.
    config_name: chosen,
    model: chosen,
    stream: true,
    request_id: randomUUID13(),
    session_id: String(request.sessionId ?? randomUUID13())
  };
  if (typeof request.reasoningEffort === "string" && request.reasoningEffort.trim()) {
    body.reasoning_effort = request.reasoningEffort.trim();
  }
  const toolChoice = request.toolChoice ?? request.tool_choice;
  const tools = traeTools(request.tools);
  if (tools && toolChoice !== "none") {
    body.tools = tools;
    const choice = typeof toolChoice === "object" ? toolChoice.function?.name ?? toolChoice.name : toolChoice;
    if (typeof choice === "string" && choice && choice !== "none") body.tool_choice = choice;
    else body.tool_choice = "auto";
    if (typeof request.parallelToolCalls === "boolean") body.parallel_tool_calls = request.parallelToolCalls;
  }
  return body;
}
async function* traeSseEvents(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";
  const pending = [];
  try {
    for (; ; ) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/u, "");
        buffer = buffer.slice(index + 1);
        if (line === "") {
          if (pending.length > 0) {
            const raw = pending.join("\n");
            pending.length = 0;
            let data = raw;
            try {
              data = JSON.parse(raw);
            } catch {
            }
            yield { event, data };
            event = "";
          }
          continue;
        }
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
          continue;
        }
        if (line.startsWith("data:")) {
          pending.push(line.slice(5).replace(/^ /u, ""));
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}
function traeRequestError(status, detail = "") {
  const parsed = (() => {
    try {
      return JSON.parse(detail);
    } catch {
      return null;
    }
  })();
  const code = Number(parsed?.code) || 0;
  const message = String(parsed?.message ?? "");
  if (code === 4026 || /context length has exceeded/u.test(message)) {
    const error2 = new Error("\u4E0A\u4E0B\u6587\u8D85\u957F\uFF1A\u8FD9\u4E2A\u6A21\u578B\u88C5\u4E0D\u4E0B\u5F53\u524D\u5BF9\u8BDD\uFF0C\u8BF7\u538B\u7F29\u6216\u6362\u4E2A\u4E0A\u4E0B\u6587\u66F4\u5927\u7684\u6A21\u578B");
    error2.code = "CONTEXT_TOO_LONG";
    error2.detail = detail.slice(0, 500);
    return error2;
  }
  if (code === 1001) {
    const error2 = new Error("Trae CN \u767B\u5F55\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55");
    error2.code = "AUTH_EXPIRED";
    error2.detail = detail.slice(0, 500);
    return error2;
  }
  const error = new Error(`Trae CN \u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${status}\uFF09${code ? ` code=${code}` : ""}`);
  error.detail = detail.slice(0, 500);
  return error;
}
function createTraeNativeExecutor({
  site = TRAE_CN_SITE,
  fetchImpl = fetch,
  timeoutMs = 3e5
} = {}) {
  async function executeTrae({ request = {}, credential, signal } = {}) {
    const account = credential ?? {};
    const body = traeChatBody(request, { site, model: request.model });
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener?.("abort", abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    return (async function* responseStream() {
      let nextIndex = 0;
      let textOpen = false;
      let textIndex = 0;
      let text3 = "";
      let reasoningOpen = false;
      let reasoningIndex = 0;
      let reasoning = "";
      const calls = /* @__PURE__ */ new Map();
      let callIndex = null;
      function* closeText() {
        if (!textOpen) return;
        yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
        textOpen = false;
        text3 = "";
      }
      function* closeReasoning() {
        if (!reasoningOpen) return;
        yield { type: "block-end", index: reasoningIndex, block: { type: "reasoning", text: reasoning } };
        reasoningOpen = false;
        reasoning = "";
      }
      function* openText() {
        if (textOpen) return;
        textIndex = nextIndex;
        nextIndex += 1;
        textOpen = true;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }
      function* openReasoning() {
        if (reasoningOpen) return;
        reasoningIndex = nextIndex;
        nextIndex += 1;
        reasoningOpen = true;
        yield { type: "block-start", index: reasoningIndex, blockType: "reasoning" };
      }
      try {
        const response = await fetchImpl(`${site.apiHost}/api/agent/v3/llm_utils_chat`, {
          method: "POST",
          headers: traeHeaders(account, {
            site,
            extra: { Accept: "text/event-stream", ...request.headers ?? {} }
          }),
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw traeRequestError(response.status, detail);
        }
        for await (const { event, data } of traeSseEvents(response.body)) {
          if (event === "error") {
            const message = data?.message ?? "Trae CN \u8FD4\u56DE\u4E86\u9519\u8BEF";
            const error = new Error(message);
            error.detail = data;
            throw error;
          }
          if (event !== "output" || !data || typeof data !== "object") continue;
          for (const piece of Array.isArray(data.tool_calls) ? data.tool_calls : []) {
            const key = piece?.index ?? piece?.id ?? 0;
            const existing = calls.get(key);
            const fn = piece?.function_call ?? piece?.function ?? piece;
            const name2 = fn?.name;
            const args = fn?.arguments;
            if (!existing) {
              yield* closeReasoning();
              yield* closeText();
              callIndex = { index: nextIndex, id: String(piece?.id ?? `call_${key}`), name: "", arguments: "" };
              nextIndex += 1;
              calls.set(key, callIndex);
              yield { type: "block-start", index: callIndex.index, blockType: "tool-call" };
            }
            const state = calls.get(key);
            if (typeof piece?.id === "string" && piece.id) state.id = piece.id;
            if (typeof name2 === "string" && name2) state.name = name2;
            const delta = typeof args === "string" ? args : args ? JSON.stringify(args) : "";
            if (delta) {
              state.arguments += delta;
              yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: delta };
            }
          }
          const thought = typeof data.reasoning_content === "string" ? data.reasoning_content : "";
          if (thought) {
            yield* closeText();
            yield* openReasoning();
            reasoning += thought;
            yield { type: "reasoning-delta", index: reasoningIndex, text: thought };
          }
          const answer = typeof data.response === "string" ? data.response : "";
          if (answer) {
            yield* closeReasoning();
            yield* openText();
            text3 += answer;
            yield { type: "text-delta", index: textIndex, text: answer };
          }
        }
        yield* closeReasoning();
        yield* closeText();
        for (const state of calls.values()) {
          yield {
            type: "block-end",
            index: state.index,
            block: { type: "tool-call", id: state.id, name: state.name || "tool", arguments: state.arguments || "{}" }
          };
        }
        yield { type: "finish", reason: calls.size === 0 ? { kind: "stop" } : { kind: "tool-calls" } };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener?.("abort", abort);
      }
    })();
  }
  ;
  return guardEmptyCompletion(executeTrae, { providerId: PROVIDER_ID16 });
}
async function readTraeCredits({ credential, site = TRAE_CN_SITE, fetchImpl = fetch, timeoutMs = 2e4 } = {}) {
  const response = await fetchImpl(`${site.authHost}/trae/api/v2/pay/ide_user_ent_usage`, {
    method: "POST",
    headers: traeHeaders(credential, { site, extra: { Accept: "application/json" } }),
    body: JSON.stringify({ require_usage: true, req_source: 0 }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    const error = new Error(`Trae CN \u989D\u5EA6\u67E5\u8BE2\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
    error.status = response.status;
    error.detail = await response.text().catch(() => "");
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  const payload = data?.data ?? data;
  const summary = payload?.usage_summary ?? payload?.usageSummary ?? {};
  const used = Number(summary.consumed_amount ?? summary.consumedAmount ?? payload?.used_credits ?? 0);
  const limit = Number(summary.total_amount ?? summary.totalAmount ?? payload?.total_credits ?? 0);
  const resetsAt = payload?.expire_time ?? payload?.expireTime ?? summary?.expire_time ?? null;
  return {
    used: Number.isFinite(used) ? used : 0,
    limit: Number.isFinite(limit) ? limit : 0,
    ...resetsAt ? { resetsAt: new Date(traeWhen(resetsAt)).toISOString() } : {},
    raw: payload
  };
}
async function readTraeModelRoster({ credential, site = TRAE_CN_SITE, fetchImpl = fetch, timeoutMs = 2e4 } = {}) {
  const response = await fetchImpl(`${site.apiHost}/api/remote/v1/models`, {
    method: "GET",
    headers: traeHeaders(credential, { site, extra: { Accept: "application/json" } }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) {
    const error = new Error(`Trae CN \u6A21\u578B\u76EE\u5F55\u8BFB\u53D6\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  const groups = data?.data?.list ?? [];
  const roster = /* @__PURE__ */ new Map();
  for (const group of groups) {
    for (const model of group?.models ?? []) {
      if (!model?.name) continue;
      const features = parseTraeFeatures(model.features);
      const dev = Number(model.context_window_tokens?.dev) || 0;
      const max = Number(model.context_window_tokens?.max) || 0;
      const contextWindow = Math.max(dev, max);
      roster.set(String(model.name).toLowerCase(), {
        id: String(model.name),
        name: model.display_name ?? String(model.name),
        ...contextWindow > 0 ? { contextWindow } : {},
        multimodal: model.multimodal === true,
        reasoning: features.reasoning?.enable !== false,
        ...Number(features.consumption_rate?.data?.rate) > 0 ? { creditRate: Number(features.consumption_rate.data.rate) } : {}
      });
    }
  }
  return roster;
}
function parseTraeFeatures(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
async function claimTraeDailyCredits({ credential, site = TRAE_CN_SITE, fetchImpl = fetch, timeoutMs = 15e3 } = {}) {
  const call = async (path2) => {
    const response = await fetchImpl(`${site.authHost}${path2}`, {
      method: "POST",
      headers: traeHeaders(credential, { site, extra: { Accept: "application/json" } }),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) {
      const error = new Error(`Trae CN \u7B7E\u5230\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
      error.status = response.status;
      throw error;
    }
    return response.json().catch(() => ({}));
  };
  const status = await call("/trae/api/v2/ug/checkin_credits/status");
  const enabled = status?.enable === true;
  const already = status?.checked_in === true;
  const credits = Number(status?.credits) + Number(status?.extra_credits ?? 0) || Number(status?.credits) || 0;
  if (!enabled || already) return { enabled, claimed: false, credits };
  await call("/trae/api/v2/ug/checkin_credits/claim");
  return { enabled, claimed: true, credits };
}

// modules/provider-trae-cn/src/driver.mjs
var CREDENTIAL_SLOT6 = Symbol("dockyard-trae-cn-credential");
function accountIdFor(credential) {
  const uid = stringValue(credential?.uid);
  if (!uid) return "trae-cn";
  return `trae-cn-${uid}`;
}
function summarizeTraeCnCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID16,
    candidateId: candidate2?.candidateId ?? "trae-cn",
    accountId: candidate2?.accountId ?? "trae-cn",
    displayName: candidate2?.displayName ?? "Trae CN",
    email: candidate2?.email ?? null,
    source: candidate2?.source ?? "trae_cn_browser_oauth"
  };
}
function parseTraeCnCatalog(models = TRAE_CN_MODELS) {
  return {
    models: models.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      ...model.contextWindow ? { contextWindow: model.contextWindow } : {},
      ...model.maxTokens ? { maxTokens: model.maxTokens } : {},
      ...model.reasoning ? { reasoning: model.reasoning } : {},
      inputModalities: model.inputModalities ?? ["text"]
    }))
  };
}
function mergeTraeCnRoster(models, roster) {
  if (!roster || roster.size === 0) return models;
  return models.map((model) => {
    const live = roster.get(String(model.id).toLowerCase());
    if (!live) return model;
    const creditRate = live.creditRate && live.creditRate !== 1 ? ` (x${live.creditRate})` : "";
    const merged = {
      ...model,
      name: `${live.name ?? model.name}${creditRate}`,
      contextWindow: live.contextWindow ?? model.contextWindow,
      inputModalities: live.multimodal ? ["text", "image"] : ["text"]
    };
    if (live.reasoning === false) delete merged.reasoning;
    return merged;
  });
}
var TraeCnSubscriptionDriver = class {
  #sessions = /* @__PURE__ */ new Map();
  #requestExecutor;
  constructor({
    site = TRAE_CN_SITE,
    fetchImpl = fetch,
    timeoutMs = 3e5,
    signInTimeoutMs = 6e5,
    catalogLoader = null,
    requestExecutor = null
  } = {}) {
    this.site = site;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.signInTimeoutMs = signInTimeoutMs;
    this.#requestExecutor = requestExecutor ?? createTraeNativeExecutor({ site, fetchImpl, timeoutMs });
    this.catalogLoader = catalogLoader ?? (async () => parseTraeCnCatalog());
  }
  /**
   * Trae CN signs in through its own authorization page, which calls back to a
   * loopback server this plugin runs. There is no API key to paste, so the
   * panel's "log in" button is the only entry point.
   */
  async authorizationInstructions() {
    return "Trae CN \u4F7F\u7528\u5B98\u65B9\u6388\u6743\u9875\u767B\u5F55\uFF0C\u6CA1\u6709\u53EF\u586B\u5199\u7684 API Key\u3002\u70B9\u300C\u767B\u5F55\u300D\u4F1A\u5728\u6D4F\u89C8\u5668\u6253\u5F00 Trae CN \u7684\u6388\u6743\u9875\u9762\uFF1B\u5728\u9875\u9762\u4E0A\u540C\u610F\u6388\u6743\u540E\uFF0C\u56DE\u8C03\u4F1A\u81EA\u52A8\u56DE\u5230\u672C\u673A\u5E76\u5B8C\u6210\u63A5\u5165\uFF0C\u4E0D\u9700\u8981\u590D\u5236\u4EFB\u4F55\u4EE3\u7801\u3002";
  }
  async startAuthorization(context = {}) {
    const session = await startTraeSignIn({
      site: this.site,
      timeoutMs: this.signInTimeoutMs
    });
    const sessionId = `${PROVIDER_ID16}:${randomUUID14()}`;
    const state = { status: "pending", credential: null, error: null };
    session.result.then((result) => {
      if (result?.ok) {
        state.credential = result.credential;
        return;
      }
      state.status = "failed";
      state.error = result?.error ?? "\u767B\u5F55\u5931\u8D25";
    }).catch((error) => {
      state.status = "failed";
      state.error = redactError(error);
    });
    this.#sessions.set(sessionId, { session, state, startedAt: (/* @__PURE__ */ new Date()).toISOString() });
    return {
      status: "pending",
      providerId: PROVIDER_ID16,
      sessionId,
      authorizationUrl: session.authorizationUrl,
      instructions: session.instructions,
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async pollAuthorization(sessionId, context = {}) {
    const entry = this.#sessions.get(sessionId);
    if (!entry) {
      return {
        status: "failed",
        providerId: PROVIDER_ID16,
        sessionId,
        diagnostic: "\u8FD9\u6B21\u767B\u5F55\u4F1A\u8BDD\u5DF2\u7ECF\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u53D1\u8D77\u767B\u5F55\u3002"
      };
    }
    if (entry.state.status === "failed") {
      this.#sessions.delete(sessionId);
      return {
        status: "failed",
        providerId: PROVIDER_ID16,
        sessionId,
        diagnostic: entry.state.error
      };
    }
    if (entry.state.result) return entry.state.result;
    const credential = entry.state.credential;
    if (!credential) {
      return { status: "pending", providerId: PROVIDER_ID16, sessionId };
    }
    const accountId = accountIdFor(credential);
    const candidate2 = {
      candidateId: accountId,
      accountId,
      displayName: credential.name || credential.uid || "Trae CN",
      email: credential.email || null,
      source: "trae_cn_browser_oauth"
    };
    Object.defineProperty(candidate2, CREDENTIAL_SLOT6, { value: credential, enumerable: false });
    const completed = {
      status: "completed",
      providerId: PROVIDER_ID16,
      sessionId,
      diagnostic: null,
      accounts: [candidate2]
    };
    entry.state.result = completed;
    setTimeout(() => this.#sessions.delete(sessionId), 12e4).unref?.();
    return completed;
  }
  async cancelAuthorization(sessionId, context = {}) {
    const entry = this.#sessions.get(sessionId);
    if (entry) {
      entry.session.cancel();
      this.#sessions.delete(sessionId);
    }
    return { status: "cancelled", providerId: PROVIDER_ID16, sessionId };
  }
  async importAccount(candidate2, context = {}) {
    const credential = candidate2?.[CREDENTIAL_SLOT6];
    if (!credential) throw new Error("Trae CN \u7684\u767B\u5F55\u4FE1\u606F\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55");
    const accountId = candidate2?.accountId ?? accountIdFor(credential);
    const ref = createCredentialRef(PROVIDER_ID16, accountId);
    if (!context.secretStore) {
      throw new Error("Trae CN \u9700\u8981\u5B89\u5168\u51ED\u636E\u5B58\u50A8\uFF0C\u4F46\u5F53\u524D\u73AF\u5883\u6CA1\u6709\u63D0\u4F9B secretStore");
    }
    {
      await context.secretStore.write(ref, {
        token: credential.token,
        refreshToken: credential.refreshToken,
        expiresAt: credential.expiresAt ?? null,
        refreshExpiresAt: credential.refreshExpiresAt ?? null,
        clientId: credential.clientId ?? this.site.clientId,
        uid: credential.uid,
        name: credential.name ?? null,
        email: credential.email ?? null,
        device: credential.device
      });
      const stored = await context.secretStore.read(ref).catch(() => null);
      if (!stored?.token) {
        throw new Error("Trae CN \u767B\u5F55\u51ED\u636E\u6CA1\u6709\u5199\u5165\u5B89\u5168\u5B58\u50A8\uFF08\u56DE\u8BFB\u4E3A\u7A7A\uFF09");
      }
    }
    return createAccountRecord({
      providerId: PROVIDER_ID16,
      accountId,
      credentialRef: ref,
      displayName: candidate2?.displayName ?? credential.name ?? "Trae CN",
      email: candidate2?.email ?? credential.email ?? null,
      auth: { kind: "oauth", scopes: [] },
      subscription: { plan: null, status: "active" },
      refresh: {
        accessTokenExpiresAt: credential.expiresAt ? new Date(credential.expiresAt).toISOString() : null,
        refreshable: Boolean(credential.refreshToken)
      },
      resources: {
        transport: "trae_cn_llm_utils_chat",
        quotaSource: "trae_cn_credits",
        uid: credential.uid ?? null
      }
    });
  }
  getActiveSession() {
    return Promise.resolve(null);
  }
  async getCatalog(context = {}) {
    const accounts = context?.accounts ?? [];
    const account = accounts.find((candidate2) => candidate2?.accountId === context?.accountId) ?? accounts[0];
    if (account) {
      const credential = await this.#credentialOf(account, context);
      if (credential) {
        try {
          const roster = await readTraeModelRoster({
            credential,
            site: this.site,
            fetchImpl: this.fetchImpl
          });
          return parseTraeCnCatalog(mergeTraeCnRoster(TRAE_CN_MODELS, roster));
        } catch {
        }
      }
    }
    return this.catalogLoader({ force: Boolean(context?.force) });
  }
  async getQuota(account, context = {}) {
    const credential = await this.#credentialOf(account, context);
    if (!credential) {
      return createQuotaSnapshot({ unit: "credits", source: "trae_cn_credits" });
    }
    try {
      const credits = await readTraeCredits({
        credential,
        site: this.site,
        fetchImpl: this.fetchImpl
      });
      return createQuotaSnapshot({
        unit: "credits",
        source: "trae_cn_credits",
        ...credits.limit > 0 ? { limit: credits.limit, remaining: Math.max(0, credits.limit - credits.used) } : {},
        ...credits.resetsAt ? { resetAt: credits.resetsAt } : {},
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        const expired = new Error("Trae CN \u767B\u5F55\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55");
        expired.code = "AUTH_EXPIRED";
        throw expired;
      }
      return createQuotaSnapshot({ unit: "credits", source: "trae_cn_credits", updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
  }
  async refreshAccount(account, context = {}) {
    const credential = await this.#credentialOf(account, context);
    if (credential) {
      await claimTraeDailyCredits({
        credential,
        site: this.site,
        fetchImpl: this.fetchImpl
      }).catch(() => {
      });
    }
    return {
      health: {
        status: "healthy",
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      quota: await this.getQuota(account, context)
    };
  }
  async #credentialOf(account, context = {}) {
    const ref = account?.auth?.credentialRef ?? account?.credentialRef;
    if (ref && context.secretStore) {
      const stored = await context.secretStore.read(ref).catch(() => null);
      if (stored?.token) return stored;
    }
    return null;
  }
  async invoke(requestOrEnvelope, invocation, context = {}) {
    const isEnvelope = requestOrEnvelope && typeof requestOrEnvelope === "object" && "request" in requestOrEnvelope;
    const request = isEnvelope ? requestOrEnvelope.request : requestOrEnvelope;
    const inv = isEnvelope ? requestOrEnvelope.invocation : invocation;
    const ctx = isEnvelope ? requestOrEnvelope.context ?? {} : context;
    const executor = ctx?.requestExecutor ?? this.#requestExecutor;
    const credential = (isEnvelope ? requestOrEnvelope.credential : null) ?? await this.#credentialOf(inv?.auth ?? inv ?? {}, ctx);
    if (!credential) {
      throw new Error("Trae CN \u8D26\u53F7\u7F3A\u5C11\u767B\u5F55\u51ED\u636E\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55");
    }
    return executor({
      request: {
        ...request,
        signal: request?.signal ?? ctx?.signal ?? inv?.signal
      },
      credential,
      signal: request?.signal ?? ctx?.signal ?? inv?.signal
    });
  }
  async stream(request, invocation, context = {}) {
    return this.invoke(request, invocation, context);
  }
};
function createTraeCnDriver(options = {}) {
  return new TraeCnSubscriptionDriver(options);
}

// modules/provider-trae-cn/src/index.mjs
function createTraeCnModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "trae-cn",
    displayName: "Trae CN",
    // Trae CN has its own authorization page, so the panel offers a real
    // "log in" button: the plugin runs the loopback callback and takes the
    // credential from the page, exactly as the IDE itself does.
    capabilities: [
      "oauth_authorization",
      "oauth_import",
      "quota",
      "catalog",
      "invoke",
      "stream"
    ],
    driver
  });
}

// modules/provider-agentrouter/src/driver.mjs
import { createHash as createHash12 } from "node:crypto";

// modules/provider-agentrouter/src/native-transport.mjs
var PROVIDER_ID17 = "agentrouter";
var DEFAULT_AGENTROUTER_ENDPOINT = "https://agentrouter.org/v1/chat/completions";
var DEFAULT_AGENTROUTER_MODELS_ENDPOINT = "https://agentrouter.org/v1/models";
var DEFAULT_AGENTROUTER_USER_AGENT = "Cline/3.2.0";
function firstString11(...values) {
  return values.find((value) => typeof value === "string" && value.length > 0) ?? null;
}
function toolCallPart3(part) {
  const type = String(part?.type ?? "").toLowerCase().replace(/[_-]/g, "");
  return type === "toolcall" || type === "functioncall" || type === "tooluse" ? part : null;
}
async function openAiContent3(content, attachments) {
  const values = Array.isArray(content) ? content : [content];
  const blocks = [];
  for (const part of values) {
    if (typeof part === "string") {
      if (part) blocks.push({ type: "text", text: part });
      continue;
    }
    if (!part || typeof part !== "object") continue;
    if (part.type === "image") {
      const image = await resolveImageData(part, attachments);
      if (!image) throw nativeProviderError(PROVIDER_ID17, "image attachment could not be resolved");
      blocks.push({ type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.data}` } });
      continue;
    }
    if (part.type === "tool-result" || part.type === "tool_result") {
      blocks.push({
        type: "text",
        text: `[Tool Result ${part.toolCallId ?? part.id ?? ""}]
${textFromContent(part.content ?? part.output ?? part.result ?? part.text)}`
      });
      continue;
    }
    if (toolCallPart3(part)) continue;
    const text3 = textFromContent(part);
    if (text3) blocks.push({ type: "text", text: text3 });
  }
  return blocks;
}
async function buildAgentRouterMessages(request, attachments) {
  const result = [];
  if (typeof request.system === "string" && request.system.length > 0) {
    result.push({ role: "system", content: request.system });
  }
  for (const message of Array.isArray(request.messages) ? request.messages : []) {
    const role = message?.role === "assistant" ? "assistant" : message?.role === "tool" ? "tool" : "user";
    if (role === "tool") {
      result.push({
        role: "tool",
        tool_call_id: sanitizeToolCallId(firstString11(message.toolCallId, message.tool_call_id, message.id, "tool-result")),
        content: textFromContent(message.content ?? message.text ?? message.output ?? message.result)
      });
      continue;
    }
    const content = await openAiContent3(message?.content ?? message?.text, attachments);
    const calls = (Array.isArray(message?.content) ? message.content : [message?.content]).map(toolCallPart3).filter(Boolean).map((call, index) => ({
      id: sanitizeToolCallId(firstString11(call.id, call.toolCallId, call.tool_call_id, `tool-${index}`)),
      type: "function",
      function: {
        name: firstString11(call.name, call.function?.name, "tool"),
        arguments: typeof (call.arguments ?? call.function?.arguments) === "string" ? call.arguments ?? call.function.arguments : JSON.stringify(call.arguments ?? call.input ?? call.function?.arguments ?? {})
      }
    }));
    const value = {
      role,
      content: content.length === 0 ? "" : content.length === 1 && content[0].type === "text" ? content[0].text : content
    };
    if (role === "assistant" && calls.length > 0) value.tool_calls = calls;
    result.push(value);
  }
  if (!result.some((message) => message.role === "user")) result.push({ role: "user", content: "Continue the conversation." });
  return result;
}
function buildAgentRouterTools(tools) {
  if (!Array.isArray(tools)) return void 0;
  const result = tools.map((tool) => ({
    type: "function",
    function: {
      name: tool?.name ?? tool?.function?.name ?? "tool",
      ...tool?.description ? { description: String(tool.description) } : {},
      parameters: tool?.parameters ?? tool?.input_schema ?? tool?.function?.parameters ?? { type: "object" }
    }
  }));
  return result.length > 0 ? result : void 0;
}
async function buildAgentRouterRequest(request = {}, context = {}) {
  const body = {
    model: request.model,
    messages: await buildAgentRouterMessages(request, context.attachments),
    stream: true,
    stream_options: { include_usage: true }
  };
  if (request.temperature !== void 0) body.temperature = request.temperature;
  const maxTokens = request.maxTokens ?? request.modelContext?.maxTokens;
  if (Number.isInteger(maxTokens) && maxTokens > 0) body.max_tokens = maxTokens;
  const tools = buildAgentRouterTools(request.tools);
  if (tools) body.tools = tools;
  return body;
}
async function* streamAgentRouterResponse(response) {
  let text3 = "";
  let textIndex = 0;
  let textOpen = true;
  let nextIndex = 1;
  let usage = null;
  let stop = "stop";
  let reasoning = null;
  const tools = /* @__PURE__ */ new Map();
  let terminated = false;
  yield { type: "block-start", index: textIndex, blockType: "text" };
  for await (const event of readSseEvents(response)) {
    if (event?.done) {
      terminated = true;
      continue;
    }
    const payload = event.data;
    if (!payload || typeof payload !== "object") continue;
    if (payload.error) {
      throw nativeProviderError(PROVIDER_ID17, payload.error.message ?? "AgentRouter returned an error", {
        status: payload.error.code ?? payload.error.status,
        body: payload.error
      });
    }
    usage = normalizeUsage(payload.usage) ?? usage;
    const choice = payload.choices?.[0];
    if (!choice) continue;
    stop = choice.finish_reason ?? stop;
    if (typeof choice.finish_reason === "string" && choice.finish_reason.trim()) terminated = true;
    const delta = choice.delta ?? {};
    const content = typeof delta.content === "string" ? delta.content : textFromContent(delta.content);
    if (content) {
      if (reasoning) {
        yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
        reasoning = null;
      }
      if (!textOpen) {
        textIndex = nextIndex++;
        text3 = "";
        textOpen = true;
        yield { type: "block-start", index: textIndex, blockType: "text" };
      }
      text3 += content;
      yield { type: "text-delta", index: textIndex, text: content };
    }
    const reasoningDelta = delta.reasoning_content ?? delta.reasoningContent;
    if (reasoningDelta) {
      if (textOpen) {
        yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
        textOpen = false;
      }
      if (!reasoning) {
        reasoning = { index: nextIndex++, text: "" };
        yield { type: "block-start", index: reasoning.index, blockType: "reasoning" };
      }
      const value = String(reasoningDelta);
      reasoning.text += value;
      yield { type: "reasoning-delta", index: reasoning.index, text: value };
    }
    for (const call of Array.isArray(delta.tool_calls) ? delta.tool_calls : []) {
      const key = Number(call.index ?? tools.size);
      if (!tools.has(key)) {
        if (reasoning) {
          yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
          reasoning = null;
        }
        if (textOpen) {
          yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
          textOpen = false;
        }
        const state2 = {
          index: nextIndex++,
          id: firstString11(call.id, `tool-${key}`),
          name: firstString11(call.function?.name, call.name, "tool"),
          arguments: ""
        };
        tools.set(key, state2);
        yield { type: "block-start", index: state2.index, blockType: "tool-call" };
      }
      const state = tools.get(key);
      const argumentDelta = call.function?.arguments ?? call.arguments ?? "";
      if (call.id) state.id = call.id;
      if (call.function?.name) state.name = call.function.name;
      state.arguments += argumentDelta;
      if (argumentDelta) {
        yield { type: "tool-call-delta", index: state.index, id: state.id, name: state.name, argumentsDelta: argumentDelta };
      }
    }
  }
  if (!terminated) {
    throw nativeProviderError(
      PROVIDER_ID17,
      "AgentRouter \u6D41\u5728\u6CA1\u6709 finish_reason \u6216 [DONE] \u7684\u60C5\u51B5\u4E0B\u7ED3\u675F\uFF0C\u54CD\u5E94\u53EF\u80FD\u88AB\u622A\u65AD",
      { code: "AGENTROUTER_TRUNCATED_STREAM" }
    );
  }
  if (reasoning) yield { type: "block-end", index: reasoning.index, block: { type: "reasoning", text: reasoning.text } };
  if (textOpen) yield { type: "block-end", index: textIndex, block: { type: "text", text: text3 } };
  for (const state of tools.values()) {
    yield { type: "block-end", index: state.index, block: { type: "tool-call", id: state.id, name: state.name, arguments: state.arguments || "{}" } };
  }
  if (usage) yield { type: "usage", usage };
  yield { type: "finish", reason: finishReason(stop) };
}
function createAgentRouterNativeExecutor({
  endpoint: endpoint2 = process.env.DOCKYARD_AGENTROUTER_ENDPOINT || DEFAULT_AGENTROUTER_ENDPOINT,
  env = process.env,
  timeoutMs = 3e5,
  fetchImpl = fetch,
  userAgent = process.env.DOCKYARD_AGENTROUTER_USER_AGENT || DEFAULT_AGENTROUTER_USER_AGENT
} = {}) {
  const safeEndpoint = validateNativeEndpoint(endpoint2, { providerId: PROVIDER_ID17 });
  const executor = async ({ request = {}, credential, context = {} } = {}) => {
    const token = firstString11(credential?.apiKey, credential?.access, env.AGENTROUTER_API_KEY);
    if (!token) {
      const error = nativeProviderError(PROVIDER_ID17, "AgentRouter API Key \u672A\u914D\u7F6E\uFF0C\u8BF7\u5728\u9762\u677F\u4E2D\u7C98\u8D34 sk- \u5F00\u5934\u7684 Key");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      accept: "text/event-stream",
      // Without an allow-listed client string the endpoint rejects the request
      // before it ever checks the key.
      "user-agent": userAgent
    };
    const response = await fetchNativeResponse(safeEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(await buildAgentRouterRequest(request, context)),
      signal: context.signal
    }, { providerId: PROVIDER_ID17, timeoutMs, fetchImpl });
    return streamAgentRouterResponse(response);
  };
  executor.nativeTransport = "agentrouter-openai-completions";
  return guardEmptyCompletion(executor, { providerId: PROVIDER_ID17 });
}
var agentRouterNativeTransportConstants = Object.freeze({
  providerId: PROVIDER_ID17,
  endpoint: DEFAULT_AGENTROUTER_ENDPOINT,
  modelsEndpoint: DEFAULT_AGENTROUTER_MODELS_ENDPOINT,
  userAgent: DEFAULT_AGENTROUTER_USER_AGENT
});

// modules/provider-agentrouter/src/driver.mjs
var PROVIDER_ID18 = "agentrouter";
var BUILTIN_AGENTROUTER_MODELS = Object.freeze([
  { id: "gpt-6.1-sol", name: "GPT-6.1 Sol", contextWindow: 1e6, maxTokens: 128e3, inputModalities: ["text"] },
  { id: "gpt-6-astra", name: "GPT-6 Astra", contextWindow: 4e5, maxTokens: 128e3, inputModalities: ["text"] },
  { id: "gpt-5.6-sol", name: "GPT-5.6 Sol", contextWindow: 4e5, maxTokens: 128e3, inputModalities: ["text"] }
]);
function fingerprintApiKey3(apiKey) {
  return createHash12("sha256").update(String(apiKey)).digest("hex").slice(0, 16);
}
function maskApiKey4(apiKey) {
  const value = String(apiKey ?? "");
  if (value.length <= 10) return "****";
  return `${value.slice(0, 6)}\u2026${value.slice(-4)}`;
}
function parseAgentRouterCatalog(data) {
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const builtinById = new Map(BUILTIN_AGENTROUTER_MODELS.map((model) => [model.id, model]));
  const models = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of list) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const known = builtinById.get(id) ?? null;
    models.push({
      id,
      name: typeof item?.name === "string" && item.name.length > 0 ? item.name : id,
      contextWindow: known?.contextWindow ?? resolveContextWindowFromModel(item, 128e3),
      maxTokens: known?.maxTokens ?? resolveMaxTokensFromModel(item, 32768),
      inputModalities: ["text"]
    });
  }
  return models.length > 0 ? { models, source: "agentrouter_live_catalog" } : null;
}
function createAgentRouterCatalogLoader({
  modelsUrl = DEFAULT_AGENTROUTER_MODELS_ENDPOINT,
  fetchImpl = fetch,
  userAgent = DEFAULT_AGENTROUTER_USER_AGENT,
  cacheTtlMs = 3e5
} = {}) {
  let cached = null;
  let cachedAt = 0;
  return async function agentRouterCatalogLoader({ force = false, credential = null, accounts = null } = {}) {
    const now = Date.now();
    if (!force && cached && now - cachedAt < cacheTtlMs) return cached;
    let token = credential?.apiKey ?? credential?.access ?? null;
    if (!token && Array.isArray(accounts) && accounts.length > 0) token = accounts[0]?.auth?.apiKey ?? null;
    if (token) {
      try {
        assertSecureEndpointUrl(modelsUrl, { providerId: PROVIDER_ID18 });
        const { body } = await fetchJson(
          modelsUrl,
          {
            headers: {
              Accept: "application/json",
              // The allow-list is enforced on the client string, even for reads.
              "user-agent": userAgent,
              ...token ? { Authorization: `Bearer ${token}` } : {}
            }
          },
          { fetchImpl, timeoutMs: 2e4 }
        );
        const parsed = parseAgentRouterCatalog(body);
        if (parsed) {
          cached = parsed;
          cachedAt = now;
          return cached;
        }
      } catch {
      }
    }
    cached = {
      models: BUILTIN_AGENTROUTER_MODELS.map((model) => ({ ...model })),
      source: "agentrouter_builtin_catalog",
      ...token ? {} : { diagnostics: ["\u5C1A\u672A\u914D\u7F6E API Key\uFF0C\u4EE5\u4E0B\u4E3A\u9ED8\u8BA4\u6A21\u578B\uFF1B\u6DFB\u52A0\u8D26\u53F7\u540E\u53EF\u8BFB\u53D6\u5B9E\u65F6\u76EE\u5F55"] }
    };
    cachedAt = now;
    return cached;
  };
}
function summarizeAgentRouterCandidate(candidate2) {
  return {
    providerId: PROVIDER_ID18,
    candidateId: candidate2?.candidateId ?? "agentrouter-default",
    displayName: candidate2?.displayName ?? "AgentRouter",
    email: candidate2?.email ?? null,
    plan: candidate2?.subscription?.plan ?? "AgentRouter \u4F59\u989D\u8D26\u6237",
    quota: candidate2?.quota ?? null
  };
}
var AgentRouterDriver = class {
  constructor({
    catalogLoader = null,
    requestExecutor = null,
    fetchImpl = fetch,
    env = process.env,
    userAgent = env.DOCKYARD_AGENTROUTER_USER_AGENT || DEFAULT_AGENTROUTER_USER_AGENT
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.env = env;
    this.userAgent = userAgent;
    this.catalogLoader = catalogLoader ?? createAgentRouterCatalogLoader({ fetchImpl, userAgent });
    this.requestExecutor = requestExecutor ?? createAgentRouterNativeExecutor({ fetchImpl, env, userAgent });
  }
  async discover() {
    const envKey = typeof this.env.AGENTROUTER_API_KEY === "string" && this.env.AGENTROUTER_API_KEY.length > 0 ? this.env.AGENTROUTER_API_KEY : null;
    if (!envKey) {
      return {
        source: "agentrouter_env",
        candidates: [],
        diagnostics: ["\u672A\u5728\u73AF\u5883\u53D8\u91CF\u4E2D\u53D1\u73B0 AGENTROUTER_API_KEY\uFF1B\u53EF\u5728\u9762\u677F\u4E2D\u76F4\u63A5\u7C98\u8D34 AgentRouter \u7684 sk- Key\u3002"]
      };
    }
    return {
      source: "agentrouter_env",
      candidates: [{
        candidateId: `agentrouter:${fingerprintApiKey3(envKey)}`,
        accountId: `agentrouter-${fingerprintApiKey3(envKey)}`,
        providerId: PROVIDER_ID18,
        displayName: `AgentRouter Key (${maskApiKey4(envKey)})`,
        apiKey: envKey,
        subscription: { plan: "AgentRouter \u4F59\u989D\u8D26\u6237", status: "active" }
      }]
    };
  }
  async importAccount(candidate2, context = {}) {
    const apiKey = String(candidate2?.apiKey ?? "").trim();
    const accountId = candidate2?.accountId || `agentrouter-${fingerprintApiKey3(apiKey)}`;
    const ref = createCredentialRef(PROVIDER_ID18, accountId);
    if (context.secretStore) {
      await context.secretStore.write(ref, {
        type: "agentrouter_api_key",
        providerId: PROVIDER_ID18,
        apiKey,
        displayName: candidate2?.displayName || "AgentRouter"
      }).catch(() => {
      });
    }
    return createAccountRecord({
      accountId,
      providerId: PROVIDER_ID18,
      displayName: candidate2?.displayName || `AgentRouter Key (${maskApiKey4(apiKey)})`,
      email: candidate2?.email ?? null,
      auth: { kind: "api_key", credentialRef: ref },
      subscription: { plan: "AgentRouter \u4F59\u989D\u8D26\u6237", status: "active", expiresAt: null },
      resources: {
        quotaSource: "agentrouter_balance",
        quotaAvailable: false,
        quotaDiagnostic: "\u4F59\u989D\u5728 AgentRouter \u63A7\u5236\u53F0\u7684\u300C\u94B1\u5305\u300D\u67E5\u770B\uFF1B\u63A5\u53E3\u672A\u63D0\u4F9B\u4F59\u989D\u67E5\u8BE2",
        quotaUrl: "https://agentrouter.org"
      },
      health: { status: "healthy" }
    });
  }
  async importSource(source, context = {}) {
    const raw = typeof source === "string" ? source : source?.apiKey ?? source?.key ?? source?.token ?? "";
    const apiKey = String(raw ?? "").trim();
    if (!apiKey) throw new ValidationError("\u8BF7\u8F93\u5165 AgentRouter API Key");
    const label = typeof source === "object" && typeof source?.label === "string" ? source.label.trim() : "";
    return [await this.importAccount({
      apiKey,
      source: "manual_api_key",
      displayName: label || `AgentRouter Key (${maskApiKey4(apiKey)})`,
      email: maskApiKey4(apiKey)
    }, context)];
  }
  async refreshAccount(account, context = {}) {
    let apiKey = null;
    if (context.secretStore && account?.auth?.credentialRef) {
      try {
        const stored = await context.secretStore.read(account.auth.credentialRef);
        apiKey = stored?.apiKey ?? null;
      } catch {
      }
    }
    return {
      health: {
        status: apiKey || account?.auth?.credentialRef ? "healthy" : "expired",
        lastCheckedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      quota: await this.getQuota(account, context)
    };
  }
  async getQuota(account, context = {}) {
    return {
      quota: createQuotaSnapshot({}),
      resources: {
        quotaSource: "agentrouter_balance",
        quotaDiagnostic: "\u4F59\u989D\u5728 AgentRouter \u63A7\u5236\u53F0\u7684\u300C\u94B1\u5305\u300D\u67E5\u770B\uFF1B\u63A5\u53E3\u672A\u63D0\u4F9B\u4F59\u989D\u67E5\u8BE2",
        quotaUrl: "https://agentrouter.org"
      }
    };
  }
  async getCatalog(context = {}) {
    let credential = null;
    if (context.secretStore && context.accounts?.[0]?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(context.accounts[0].auth.credentialRef);
      } catch {
      }
    }
    return this.catalogLoader({
      force: Boolean(context?.force),
      credential,
      accounts: context?.accounts ?? null
    });
  }
  async invoke(request, invocation, context = {}) {
    return this.stream(request, invocation, context);
  }
  async stream(request, invocation, context = {}) {
    let credential = null;
    if (context.secretStore && invocation?.account?.auth?.credentialRef) {
      try {
        credential = await context.secretStore.read(invocation.account.auth.credentialRef);
      } catch {
      }
    }
    return this.requestExecutor({
      request,
      account: invocation?.account ?? null,
      credential,
      signal: context.signal ?? null,
      attachments: context.attachments ?? invocation?.attachments ?? null
    });
  }
};
function createAgentRouterDriver(options = {}) {
  return new AgentRouterDriver(options);
}

// modules/provider-agentrouter/src/index.mjs
function createAgentRouterModule({ driver = {} } = {}) {
  return defineProviderModule({
    id: "agentrouter",
    displayName: "AgentRouter",
    capabilities: [
      "api_key_auth",
      "catalog",
      "quota",
      "invoke",
      "stream"
    ],
    driver
  });
}

// packages/runtime/src/dockyard-runtime.mjs
var candidateSummarizers = /* @__PURE__ */ new Map([
  ["openai-codex", summarizeCodexCandidate],
  ["antigravity", summarizeAntigravityCandidate],
  ["grok", summarizeGrokCandidate],
  ["claude", summarizeClaudeCandidate],
  ["cursor", summarizeCursorCandidate],
  ["opencode", summarizeOpencodeCandidate],
  ["kilo", summarizeKiloCandidate],
  ["commandcode", summarizeCommandCodeCandidate],
  ["hermes", summarizeHermesCandidate],
  ["openrouter-free", summarizeOpenRouterFreeCandidate],
  ["trae-cn", summarizeTraeCnCandidate],
  ["agentrouter", summarizeAgentRouterCandidate]
]);
var DEFAULT_REFRESH_TIMEOUT_MS = 3e4;
function numericOption(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function refreshTimeoutError(providerId, accountId, timeoutMs) {
  const error = new Error(`\u5237\u65B0 ${providerId}/${accountId} \u8D85\u65F6\uFF08${Math.ceil(timeoutMs / 1e3)} \u79D2\uFF09\uFF1B\u5DF2\u4FDD\u7559\u4E0A\u6B21\u989D\u5EA6`);
  error.code = "ETIMEDOUT";
  error.refreshTimeout = true;
  error.timeoutMs = timeoutMs;
  return error;
}
function reportPostRefreshHealth(pool, accountId, { allowExpiredRecovery = false } = {}) {
  const account = pool.get(accountId);
  if (!account || account.health?.status === ACCOUNT_HEALTH.EXPIRED && !allowExpiredRecovery) return;
  const remaining = account.quota?.remaining;
  if (typeof remaining === "number" && remaining <= 0) {
    pool.report(accountId, {
      status: "quota_exhausted",
      message: "\u5237\u65B0\u540E\u5B98\u65B9\u989D\u5EA6\u4ECD\u4E3A 0\uFF0C\u8BF7\u5207\u6362\u8D26\u53F7\u6216\u7A0D\u540E\u91CD\u8BD5"
    });
    return;
  }
  pool.report(accountId, { status: "success" });
}
function withRefreshTimeout(task, { providerId, accountId, timeoutMs }) {
  const controller = new AbortController();
  let timer = null;
  const operation = Promise.resolve().then(() => task(controller.signal));
  operation.catch(() => {
  });
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(refreshTimeoutError(providerId, accountId, timeoutMs));
    }, timeoutMs);
  });
  return Promise.race([operation, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
function withRequestExecutor(providerId, driverOptions, requestExecutors = {}) {
  const executor = requestExecutors[providerId];
  return executor ? { ...driverOptions ?? {}, requestExecutor: executor } : driverOptions;
}
function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function providerStorageSnapshot(entry) {
  return {
    policy: entry.pool.policy,
    defaultAccountId: entry.pool.getDefaultAccountId(),
    accounts: entry.pool.listForStorage()
  };
}
function restorePoolSnapshot(pool, snapshot) {
  const desired = new Map((snapshot.accounts ?? []).map((account) => [account.accountId, account]));
  for (const account of pool.list()) {
    if (!desired.has(account.accountId)) pool.remove(account.accountId);
  }
  for (const account of desired.values()) {
    pool.upsert({ ...account, credentialRef: account.auth?.credentialRef }, { resetHealth: false });
  }
  pool.setPolicy(snapshot.policy);
  pool.setDefaultAccount(snapshot.defaultAccountId ?? null);
}
async function deleteUncommittedCredentials(secretStore, beforeRefs, accounts) {
  if (typeof secretStore?.delete !== "function") return;
  const refs = new Set(accounts.map((account) => account?.auth?.credentialRef ?? account?.credentialRef).filter(Boolean));
  for (const ref of refs) {
    if (!beforeRefs.has(ref)) await secretStore.delete(ref).catch(() => {
    });
  }
}
function mergeProviderStorage(latestInput, current, baseline = {}) {
  const latest = latestInput && typeof latestInput === "object" ? latestInput : {};
  const merged = { ...latest };
  if (current.policy !== baseline.policy) merged.policy = current.policy;
  if ((current.defaultAccountId ?? null) !== (baseline.defaultAccountId ?? null)) {
    merged.defaultAccountId = current.defaultAccountId ?? null;
  }
  const latestById = new Map((Array.isArray(latest.accounts) ? latest.accounts : []).filter((account) => account?.accountId).map((account) => [account.accountId, account]));
  const currentById = new Map((Array.isArray(current.accounts) ? current.accounts : []).filter((account) => account?.accountId).map((account) => [account.accountId, account]));
  const baselineById = new Map((Array.isArray(baseline.accounts) ? baseline.accounts : []).filter((account) => account?.accountId).map((account) => [account.accountId, account]));
  for (const [accountId, currentAccount] of currentById) {
    const baselineAccount = baselineById.get(accountId);
    const latestAccount = latestById.get(accountId);
    if (!baselineAccount) {
      latestById.set(accountId, structuredClone(currentAccount));
      continue;
    }
    if (!latestAccount) {
      continue;
    }
    if (jsonEqual(currentAccount, baselineAccount)) continue;
    const changedAccount = { ...latestAccount };
    for (const [key, value] of Object.entries(currentAccount)) {
      if (!jsonEqual(value, baselineAccount[key])) changedAccount[key] = structuredClone(value);
    }
    latestById.set(accountId, changedAccount);
  }
  for (const accountId of baselineById.keys()) {
    if (!currentById.has(accountId)) latestById.delete(accountId);
  }
  merged.accounts = [...latestById.values()];
  return merged;
}
function createDefaultProviderEntries(options = {}) {
  const requestExecutors = options.requestExecutors ?? {};
  const catalogLoaders = options.catalogLoaders ?? {};
  return [
    {
      module: createCodexModule({
        driver: options.codexDriver ?? createCodexDriver({
          ...withRequestExecutor("openai-codex", options.codex, requestExecutors),
          ...catalogLoaders["openai-codex"] ? { catalogLoader: catalogLoaders["openai-codex"] } : {}
        })
      }),
      driver: options.codexDriver
    },
    {
      module: createAntigravityModule({
        driver: options.antigravityDriver ?? createAntigravityDriver({
          ...withRequestExecutor("antigravity", options.antigravity, requestExecutors),
          ...catalogLoaders.antigravity ? { catalogLoader: catalogLoaders.antigravity } : {}
        })
      }),
      driver: options.antigravityDriver
    },
    {
      module: createGrokModule({
        driver: options.grokDriver ?? createGrokDriver({
          ...withRequestExecutor("grok", options.grok, requestExecutors),
          ...catalogLoaders.grok ? { catalogLoader: catalogLoaders.grok } : {}
        })
      }),
      driver: options.grokDriver
    },
    {
      module: createClaudeModule({
        driver: options.claudeDriver ?? createClaudeDriver({
          ...withRequestExecutor("claude", options.claude, requestExecutors),
          ...catalogLoaders.claude ? { catalogLoader: catalogLoaders.claude } : {}
        })
      }),
      driver: options.claudeDriver
    },
    {
      module: createCursorModule({
        driver: options.cursorDriver ?? createCursorDriver({
          ...withRequestExecutor("cursor", options.cursor, requestExecutors),
          ...catalogLoaders.cursor ? { catalogLoader: catalogLoaders.cursor } : {}
        })
      }),
      driver: options.cursorDriver
    },
    {
      module: createCommandCodeModule({
        driver: options.commandcodeDriver ?? createCommandCodeDriver({
          ...withRequestExecutor("commandcode", options.commandcode, requestExecutors),
          ...catalogLoaders.commandcode ? { catalogLoader: catalogLoaders.commandcode } : {}
        })
      }),
      driver: options.commandcodeDriver
    },
    {
      module: createHermesModule({
        driver: options.hermesDriver ?? createHermesDriver({
          ...withRequestExecutor("hermes", options.hermes, requestExecutors),
          ...catalogLoaders.hermes ? { catalogLoader: catalogLoaders.hermes } : {}
        })
      }),
      driver: options.hermesDriver
    },
    {
      module: createOpenRouterFreeModule({
        driver: options.openrouterFreeDriver ?? createOpenRouterFreeDriver({
          ...withRequestExecutor("openrouter-free", options["openrouter-free"] ?? options.openrouterFree, requestExecutors),
          ...catalogLoaders["openrouter-free"] ? { catalogLoader: catalogLoaders["openrouter-free"] } : {}
        })
      }),
      driver: options.openrouterFreeDriver
    },
    {
      module: createAgentRouterModule({
        driver: options.agentrouterDriver ?? createAgentRouterDriver({
          ...withRequestExecutor("agentrouter", options.agentrouter, requestExecutors),
          ...catalogLoaders.agentrouter ? { catalogLoader: catalogLoaders.agentrouter } : {}
        })
      }),
      driver: options.agentrouterDriver
    },
    {
      module: createTraeCnModule({
        driver: options.traeCnDriver ?? createTraeCnDriver({
          ...withRequestExecutor("trae-cn", options.traeCn, requestExecutors),
          ...catalogLoaders["trae-cn"] ? { catalogLoader: catalogLoaders["trae-cn"] } : {}
        })
      }),
      driver: options.traeCnDriver
    }
  ];
}
function providerContext(app, extra = {}) {
  return {
    secretStore: app.secretStore,
    now: /* @__PURE__ */ new Date(),
    ...extra
  };
}
function providerAccount2(pool, accountId) {
  const account = pool.get(accountId);
  if (!account) throw new Error(`Account does not exist: ${accountId}`);
  const auth = pool.resolve(accountId);
  return {
    ...account,
    auth: {
      kind: auth.authKind,
      credentialRef: auth.credentialRef,
      scopes: [...auth.scopes]
    }
  };
}
function providerErrorStatus(error) {
  if (error?.quotaUnavailable) return "error";
  if (error?.authExpired || error?.accountMismatch) return "auth_expired";
  if (error?.authForbidden) return "error";
  if (error?.quotaExhausted) return "quota_exhausted";
  if (error?.rateLimited) return "rate_limited";
  return "error";
}
var DockyardRuntime = class {
  #entries = /* @__PURE__ */ new Map();
  #candidates = /* @__PURE__ */ new Map();
  #refreshPromises = /* @__PURE__ */ new Map();
  #accountRefreshPromises = /* @__PURE__ */ new Map();
  #stateBaselines = /* @__PURE__ */ new Map();
  #saveQueue = Promise.resolve();
  // Per-provider import transactions. Import work is async (OAuth, network);
  // without serialization two concurrent imports could roll each other back
  // through stale pool snapshots.
  #providerImportQueues = /* @__PURE__ */ new Map();
  #initialized = false;
  #initPromise = null;
  // Phase 1 (pools, module registration, injection bridge) resolves here. The
  // model picker only needs phase 1: auto-provisioning a free account can wait
  // on a provider round-trip and must not hold the picker hostage.
  #prepared = false;
  #preparePromise = null;
  constructor({
    providers = createDefaultProviderEntries(),
    runtime = new ModuleRuntime({ logger: { error() {
    }, warn() {
    }, info() {
    } } }),
    stateStore = new JsonStateStore(),
    secretStore = createDefaultSecretStore(),
    dshAdapter = null,
    refreshTimeoutMs = numericOption(process.env.DOCKYARD_DSH_REFRESH_TIMEOUT_MS, DEFAULT_REFRESH_TIMEOUT_MS)
  } = {}) {
    this.runtime = runtime;
    this.stateStore = stateStore;
    this.secretStore = secretStore;
    this.contextWindowOverrides = new ContextWindowOverrideStore({ stateStore });
    this.modelSelection = new ModelSelectionStore({ stateStore });
    this.bridge = new DshInjectionBridge({
      runtime,
      adapter: dshAdapter,
      contextWindowOverrides: this.contextWindowOverrides,
      modelSelection: this.modelSelection
    });
    this.providers = providers;
    this.refreshTimeoutMs = refreshTimeoutMs;
  }
  setSecretStore(secretStore) {
    if (!secretStore || typeof secretStore.read !== "function" || typeof secretStore.write !== "function") {
      throw new TypeError("Dockyard secret store requires read() and write() methods");
    }
    this.secretStore = secretStore;
    return this;
  }
  /**
   * Phase 1 of startup: build every account pool, register the provider
   * modules, and mount the DSH injection bridge. Disk-bound and fast. The
   * account auto-provisioning in {@link init} is deliberately not part of this
   * phase, because it can wait on a provider's network round-trip.
   *
   * @returns The runtime, once the pools and routes exist.
   */
  async whenPrepared() {
    if (this.#prepared) return this;
    if (this.#preparePromise) return this.#preparePromise;
    this.#preparePromise = (async () => {
      const state = await this.stateStore.load();
      if (state?.pools?.opencode || state?.pools?.kilo || state?.modelSelection?.providers?.opencode || state?.modelSelection?.providers?.kilo) {
        if (typeof this.stateStore.update === "function") {
          await this.stateStore.update((latest) => {
            if (latest?.pools) {
              delete latest.pools.opencode;
              delete latest.pools.kilo;
            }
            if (latest?.modelSelection?.providers) {
              delete latest.modelSelection.providers.opencode;
              delete latest.modelSelection.providers.kilo;
            }
            return latest;
          }).catch(() => {
          });
        }
      }
      await this.contextWindowOverrides.ready();
      await this.modelSelection.ready();
      for (const entry of this.providers) {
        const providerId = entry.module.manifest.id;
        const stored = state.pools?.[providerId] ?? {};
        this.#stateBaselines.set(providerId, structuredClone({
          policy: stored.policy ?? ACCOUNT_SELECTION_POLICY.ROUND_ROBIN,
          defaultAccountId: stored.defaultAccountId ?? null,
          accounts: Array.isArray(stored.accounts) ? stored.accounts : []
        }));
        const pool = new AccountPool({
          providerId,
          policy: stored.policy ?? ACCOUNT_SELECTION_POLICY.ROUND_ROBIN
        });
        for (const account of Array.isArray(stored.accounts) ? stored.accounts : []) {
          if (account?.auth?.credentialRef) {
            pool.upsert({ ...account, credentialRef: account.auth.credentialRef });
          }
        }
        if (stored.defaultAccountId && pool.get(stored.defaultAccountId)) {
          pool.setDefaultAccount(stored.defaultAccountId);
        }
        this.#entries.set(providerId, { ...entry, pool });
        if (!this.runtime.has(providerId)) await this.runtime.register(entry.module);
        await this.bridge.mountProvider(entry.module, pool);
      }
      this.#prepared = true;
      return this;
    })();
    try {
      return await this.#preparePromise;
    } finally {
      this.#preparePromise = null;
    }
  }
  async init() {
    if (this.#initialized) return this;
    if (this.#initPromise) return this.#initPromise;
    this.#initPromise = (async () => {
      await this.whenPrepared();
      const autoImported = /* @__PURE__ */ new Set();
      for (const [providerId, entry] of this.#entries) {
        const pool = entry.pool;
        const hasExpiredOfficialSession = pool.list().some((a) => a.resources?.accountScope === "active_official_session" && a.health?.status === ACCOUNT_HEALTH.EXPIRED);
        const hasNoEligible = pool.list().filter((a) => a.health?.status !== ACCOUNT_HEALTH.EXPIRED).length === 0;
        const autoProvision = this.hasProviderCapability(providerId, PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT) && pool.list().length === 0;
        if (autoProvision || hasExpiredOfficialSession && hasNoEligible) {
          try {
            const discovery = await (entry.module?.discover?.(providerContext(this)) ?? entry.driver?.discover?.(providerContext(this)));
            const candidates = Array.isArray(discovery?.candidates) ? discovery.candidates : Array.isArray(discovery) ? discovery : [];
            for (const candidate2 of candidates) {
              if (candidate2 && candidate2.status !== "unavailable" && typeof entry.module?.importAccount === "function") {
                if (!pool.get(candidate2.accountId)) {
                  const account = await entry.module.importAccount(candidate2, providerContext(this));
                  const obsoleteOfficial = pool.list().find((a) => a.resources?.accountScope === "active_official_session" && candidate2.resources?.accountScope === "active_official_session" && a.accountId !== account.accountId);
                  if (obsoleteOfficial) {
                    pool.remove(obsoleteOfficial.accountId);
                  }
                  pool.upsert(account, { resetHealth: true });
                  if (!pool.getDefaultAccountId()) {
                    pool.setDefaultAccount(account.accountId);
                  }
                  autoImported.add(providerId);
                }
              }
            }
          } catch {
          }
        }
      }
      for (const [id, entry] of this.#entries) {
        if (this.hasProviderCapability(id, PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT) && entry.pool?.list()?.length > 0) {
          autoImported.add(id);
        }
      }
      if (autoImported.size > 0) {
        await this.#saveState([...autoImported]).catch(() => {
        });
      }
      this.#initialized = true;
      return this;
    })();
    try {
      return await this.#initPromise;
    } finally {
      this.#initPromise = null;
    }
  }
  #entry(providerId) {
    const entry = this.#entries.get(providerId);
    if (!entry) throw new Error(`Unknown Dockyard provider: ${providerId}`);
    return entry;
  }
  listProviderManifests() {
    return this.providers.map(({ module }) => ({ ...module.manifest }));
  }
  // Host code should ask the module what it supports instead of branching on
  // provider ids. Capabilities are declared once in each provider module.
  getProviderCapabilities(providerId) {
    const manifest = this.providers.find(({ module }) => module.manifest.id === providerId)?.module.manifest;
    return new Set(Array.isArray(manifest?.capabilities) ? manifest.capabilities : []);
  }
  hasProviderCapability(providerId, capability) {
    return this.getProviderCapabilities(providerId).has(capability);
  }
  listProviderIds() {
    return this.providers.map(({ module }) => module.manifest.id);
  }
  /**
   * Ask a provider what the user has to do when it has no authorization entry
   * point of its own (a desktop-session provider, for example). The host keeps
   * one generic message for every provider that answers null.
   */
  async authorizationInstructions(providerId) {
    const module = this.providers.find((entry) => entry.module.manifest.id === providerId)?.module;
    if (typeof module?.authorizationInstructions !== "function") return null;
    try {
      const text3 = await module.authorizationInstructions(providerContext(this, {}));
      return typeof text3 === "string" && text3.trim().length > 0 ? text3.trim() : null;
    } catch {
      return null;
    }
  }
  async scan(providerId = null) {
    await this.init();
    const entries = providerId ? [[providerId, this.#entry(providerId)]] : [...this.#entries];
    const providers = [];
    const changedProviderIds = /* @__PURE__ */ new Set();
    for (const [currentProviderId, entry] of entries) {
      let result;
      try {
        result = await entry.module.discover(providerContext(this, {
          accounts: entry.pool.list()
        }));
      } catch (error) {
        result = { candidates: [], source: "provider", diagnostics: [redactError(error)] };
      }
      const rawCandidates = Array.isArray(result?.candidates) ? result.candidates : [];
      this.#candidates.set(currentProviderId, new Map(rawCandidates.map((candidate2) => [candidate2.candidateId, candidate2])));
      for (const candidate2 of rawCandidates) {
        const existing = entry.pool.get(candidate2.accountId);
        const candidateIdentity = candidate2.resources ?? {};
        const existingIdentity = existing?.resources ?? {};
        if (!existing) {
          const obsoleteOfficial = entry.pool.list().find((a) => a.resources?.accountScope === "active_official_session" && candidate2.resources?.accountScope === "active_official_session" && a.accountId !== candidate2.accountId && a.health?.status === ACCOUNT_HEALTH.EXPIRED);
          if (obsoleteOfficial && typeof entry.module.importAccount === "function") {
            try {
              const imported = await entry.module.importAccount(candidate2, providerContext(this));
              entry.pool.remove(obsoleteOfficial.accountId);
              entry.pool.upsert(imported, { resetHealth: true });
              if (entry.pool.getDefaultAccountId() === obsoleteOfficial.accountId) {
                entry.pool.setDefaultAccount(imported.accountId);
              }
              changedProviderIds.add(currentProviderId);
            } catch {
            }
          }
          continue;
        }
        const identityChanged = candidate2.email !== existing.email || candidate2.displayName !== existing.displayName || candidateIdentity.identitySource !== existingIdentity.identitySource || candidateIdentity.identityLabel !== existingIdentity.identityLabel || candidateIdentity.sessionFingerprint !== existingIdentity.sessionFingerprint || candidateIdentity.identityNote !== existingIdentity.identityNote || candidateIdentity.sessionPersistence !== existingIdentity.sessionPersistence;
        if (identityChanged) {
          entry.pool.upsert({
            accountId: candidate2.accountId,
            ...candidate2.email !== void 0 ? { email: candidate2.email } : {},
            ...candidate2.displayName !== void 0 ? { displayName: candidate2.displayName } : {},
            ...candidate2.resources ? { resources: candidate2.resources } : {}
          });
          changedProviderIds.add(currentProviderId);
        }
        const fingerprintChanged = candidate2.resources?.sessionPersistence === "captured" && candidate2.resources.sessionFingerprint && candidate2.resources.sessionFingerprint !== existing.resources?.sessionFingerprint;
        if (fingerprintChanged && typeof entry.module.importAccount === "function") {
          try {
            const captured = await entry.module.importAccount(candidate2, providerContext(this));
            entry.pool.upsert(captured, { resetHealth: true });
            changedProviderIds.add(currentProviderId);
          } catch {
          }
        }
        const shouldRepairLegacyCredential = this.hasProviderCapability(
          currentProviderId,
          PROVIDER_BEHAVIOR_CAPABILITIES.REPAIR_LEGACY_CREDENTIAL
        ) && typeof entry.module.importAccount === "function" && (candidate2.email && !existing.email || candidate2.source && candidate2.source !== existingIdentity.authSource);
        if (shouldRepairLegacyCredential) {
          try {
            const repaired = await entry.module.importAccount(candidate2, providerContext(this));
            entry.pool.upsert(repaired, { resetHealth: true });
            changedProviderIds.add(currentProviderId);
          } catch {
          }
        }
      }
      const summarize = candidateSummarizers.get(currentProviderId) ?? ((candidate2) => ({ ...candidate2 }));
      const candidates = rawCandidates.map((candidate2) => ({
        ...summarize(candidate2),
        imported: Boolean(entry.pool.get(candidate2.accountId))
      }));
      providers.push({
        providerId: currentProviderId,
        manifest: { ...entry.module.manifest },
        policy: entry.pool.policy,
        accounts: entry.pool.list(),
        candidates,
        source: result?.source ?? "unknown",
        diagnostics: result?.diagnostics ?? []
      });
    }
    if (changedProviderIds.size > 0) await this.#saveState(changedProviderIds);
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      providers,
      routes: this.bridge.listRoutes()
    };
  }
  async importCandidate(providerId, candidateId) {
    await this.init();
    const entry = this.#entry(providerId);
    const candidate2 = this.#candidates.get(providerId)?.get(candidateId);
    if (!candidate2) throw new Error("Candidate is missing; scan local OAuth states again");
    return this.#enqueueProviderImport(providerId, async () => {
      const before = providerStorageSnapshot(entry);
      const beforeRefs = new Set(before.accounts.map((account) => account?.auth?.credentialRef).filter(Boolean));
      let rawAccount;
      try {
        rawAccount = await entry.module.importAccount(candidate2, providerContext(this));
        entry.pool.upsert(rawAccount, { resetHealth: true });
        await this.#saveState([providerId]);
      } catch (error) {
        restorePoolSnapshot(entry.pool, before);
        await deleteUncommittedCredentials(this.secretStore, beforeRefs, rawAccount ? [rawAccount] : []);
        throw error;
      }
      return {
        account: entry.pool.get(rawAccount.accountId),
        diagnostics: [],
        needsRefresh: true
      };
    });
  }
  async importSource(providerId, source) {
    await this.init();
    const entry = this.#entry(providerId);
    if (typeof entry.module.importSource !== "function") {
      throw new Error(`Provider ${providerId} does not support OAuth source import`);
    }
    return this.#enqueueProviderImport(providerId, async () => {
      const before = providerStorageSnapshot(entry);
      const beforeRefs = new Set(before.accounts.map((account) => account?.auth?.credentialRef).filter(Boolean));
      let rawAccounts = [];
      try {
        const imported = await entry.module.importSource(source, providerContext(this));
        rawAccounts = Array.isArray(imported) ? imported : Array.isArray(imported?.accounts) ? imported.accounts : [imported];
        const importable = rawAccounts.filter((account) => account?.accountId);
        if (importable.length === 0) throw new Error("OAuth source did not contain an importable account");
        for (const account of importable) entry.pool.upsert(account, { resetHealth: true });
        await this.#saveState([providerId]);
        return {
          accounts: importable.map((account) => entry.pool.get(account.accountId)),
          diagnostics: []
        };
      } catch (error) {
        restorePoolSnapshot(entry.pool, before);
        await deleteUncommittedCredentials(this.secretStore, beforeRefs, rawAccounts);
        throw error;
      }
    });
  }
  async startAuthorization(providerId) {
    await this.init();
    const entry = this.#entry(providerId);
    const context = providerContext(this, {
      accounts: entry.pool.list()
    });
    const result = await entry.module.startAuthorization(context);
    return this.#persistAuthorizationResult(entry, providerId, result);
  }
  async pollAuthorization(providerId, sessionId) {
    await this.init();
    const entry = this.#entry(providerId);
    const result = await entry.module.pollAuthorization(sessionId, providerContext(this, {
      accounts: entry.pool.list()
    }));
    return this.#persistAuthorizationResult(entry, providerId, result);
  }
  async cancelAuthorization(providerId, sessionId) {
    await this.init();
    return this.#entry(providerId).module.cancelAuthorization(sessionId, providerContext(this));
  }
  async submitAuthorizationCode(providerId, sessionId, code) {
    await this.init();
    const entry = this.#entry(providerId);
    return entry.module.submitAuthorizationCode(sessionId, code, providerContext(this, {
      accounts: entry.pool.list()
    }));
  }
  async refreshAccount(providerId, accountId, { force = false, tolerateFailure = false } = {}) {
    await this.init();
    const key = `${providerId}\0${accountId}\0${force ? "force" : "auto"}\0${tolerateFailure ? "lenient" : "strict"}`;
    const existing = this.#accountRefreshPromises.get(key);
    if (existing) return existing;
    const promise = (async () => {
      try {
        return await withRefreshTimeout(
          (signal) => this.#refreshAccountNow(providerId, accountId, { force, tolerateFailure, signal }),
          { providerId, accountId, timeoutMs: this.refreshTimeoutMs }
        );
      } catch (error) {
        if (!error?.refreshTimeout || !tolerateFailure) throw error;
        await this.init();
        const entry = this.#entry(providerId);
        if (entry.pool.get(accountId)) {
          entry.pool.report(accountId, { status: "error", message: error.message });
          await this.#saveState([providerId]);
        }
        return { account: entry.pool.get(accountId), diagnostics: [error.message] };
      }
    })();
    this.#accountRefreshPromises.set(key, promise);
    try {
      return await promise;
    } finally {
      if (this.#accountRefreshPromises.get(key) === promise) this.#accountRefreshPromises.delete(key);
    }
  }
  async #refreshAccountNow(providerId, accountId, { force = false, tolerateFailure = false, signal } = {}) {
    await this.init();
    const entry = this.#entry(providerId);
    providerAccount2(entry.pool, accountId);
    const diagnostics = [];
    let authorizationFailure = null;
    let refresh = null;
    try {
      refresh = await entry.module.refreshAccount(
        providerAccount2(entry.pool, accountId),
        providerContext(this, { force, signal })
      );
      if (signal?.aborted) throw signal.reason ?? refreshTimeoutError(providerId, accountId, this.refreshTimeoutMs);
      this.#applyPatch(entry.pool, accountId, refresh);
    } catch (error) {
      if (signal?.aborted) throw error;
      authorizationFailure = error;
      diagnostics.push(`\u5237\u65B0 OAuth \u72B6\u6001\u5931\u8D25\uFF1A${redactError(error)}`);
      entry.pool.report(accountId, {
        status: providerErrorStatus(error),
        message: diagnostics.at(-1)
      });
      if (!tolerateFailure) await this.#saveState([providerId]);
      if (!tolerateFailure) throw error;
    }
    if (authorizationFailure?.authExpired || authorizationFailure?.authForbidden) {
      await this.#saveState([providerId]);
      return { account: entry.pool.get(accountId), diagnostics };
    }
    try {
      if (refresh && Object.hasOwn(refresh, "quota")) {
        reportPostRefreshHealth(entry.pool, accountId, {
          allowExpiredRecovery: refresh.resources?.quotaSource === "antigravity_native"
        });
        await this.#saveState([providerId]);
        return { account: entry.pool.get(accountId), diagnostics };
      }
      const quota = await entry.module.getQuota(
        providerAccount2(entry.pool, accountId),
        providerContext(this, { signal })
      );
      if (signal?.aborted) throw signal.reason ?? refreshTimeoutError(providerId, accountId, this.refreshTimeoutMs);
      this.#applyPatch(entry.pool, accountId, quota);
      reportPostRefreshHealth(entry.pool, accountId, {
        allowExpiredRecovery: quota.resources?.quotaSource === "antigravity_native"
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      diagnostics.push(`\u5237\u65B0\u5B9E\u65F6\u989D\u5EA6\u5931\u8D25\uFF1A${redactError(error)}`);
      entry.pool.report(accountId, {
        status: providerErrorStatus(error),
        message: diagnostics.at(-1)
      });
      if (!tolerateFailure) await this.#saveState([providerId]);
      if (!tolerateFailure) throw error;
    }
    await this.#saveState([providerId]);
    return { account: entry.pool.get(accountId), diagnostics };
  }
  /**
   * Retry accounts parked by an expired authorization once their cooldown has
   * passed. Cheap when nothing is parked, so a host may call it on a timer.
   *
   * @returns {Promise<Array<{providerId: string, accountId: string}>>} Accounts
   *   that were retried (whether or not they came back healthy).
   */
  async relistExpiredAccounts(providerId = null) {
    await this.whenPrepared();
    const providerIds = providerId ? [providerId] : [...this.#entries.keys()];
    const relisted = [];
    for (const id of providerIds) {
      const pool = this.#entries.get(id)?.pool;
      if (typeof pool?.relistable !== "function") continue;
      for (const account of pool.relistable()) {
        try {
          await this.refreshAccount(id, account.accountId, { tolerateFailure: true });
          relisted.push({ providerId: id, accountId: account.accountId });
        } catch {
        }
      }
    }
    return relisted;
  }
  async refreshAll(providerId = null) {
    await this.init();
    if (!providerId) {
      const batches = await Promise.all([...this.#entries].map(([id]) => this.refreshAll(id)));
      return batches.flat();
    }
    this.#entry(providerId);
    const existing = this.#refreshPromises.get(providerId);
    if (existing) return existing;
    const promise = (async () => {
      const entry = this.#entry(providerId);
      const results = await Promise.all(entry.pool.list().map(async (account) => {
        try {
          return await this.refreshAccount(providerId, account.accountId, { tolerateFailure: true });
        } catch (error) {
          return { account: entry.pool.get(account.accountId), diagnostics: [redactError(error)] };
        }
      }));
      return results;
    })();
    this.#refreshPromises.set(providerId, promise);
    try {
      return await promise;
    } finally {
      if (this.#refreshPromises.get(providerId) === promise) this.#refreshPromises.delete(providerId);
    }
  }
  async setPolicy(providerId, policy, defaultAccountId = void 0) {
    await this.init();
    const pool = this.#entry(providerId).pool;
    pool.setPolicy(policy);
    if (defaultAccountId !== void 0) pool.setDefaultAccount(defaultAccountId);
    await this.#saveState([providerId]);
    return { providerId, policy: pool.policy, defaultAccountId: pool.getDefaultAccountId() };
  }
  async setDefaultAccount(providerId, accountId) {
    await this.init();
    const pool = this.#entry(providerId).pool;
    pool.setDefaultAccount(accountId);
    await this.#saveState([providerId]);
    return { providerId, defaultAccountId: pool.getDefaultAccountId() };
  }
  async removeAccount(providerId, accountId) {
    await this.init();
    const entry = this.#entry(providerId);
    const credential = entry.pool.resolve(accountId);
    if (!entry.pool.remove(accountId)) {
      throw new Error(`Account does not exist: ${accountId}`);
    }
    await this.#saveState([providerId]);
    const diagnostics = [];
    if (credential.credentialRef && typeof this.secretStore?.delete === "function") {
      try {
        await this.secretStore.delete(credential.credentialRef);
      } catch (error) {
        diagnostics.push(`\u6E05\u7406\u672C\u673A Keychain \u5F15\u7528\u5931\u8D25\uFF1A${redactError(error)}`);
      }
    }
    return {
      providerId,
      accountId,
      removed: true,
      defaultAccountId: entry.pool.getDefaultAccountId(),
      diagnostics
    };
  }
  async getContextWindowOverride(input) {
    await this.init();
    return this.contextWindowOverrides.get(input);
  }
  async setContextWindowOverride(input, value) {
    await this.init();
    return this.contextWindowOverrides.set(input, value);
  }
  getModelSelection(providerId, accountId = null) {
    return this.modelSelection.get(providerId, accountId);
  }
  async setModelSelection(providerId, enabledModelIds, accountId = null) {
    await this.init();
    return this.modelSelection.set(providerId, enabledModelIds, accountId);
  }
  async getCatalog(providerId, context = {}) {
    await this.init();
    const entry = this.#entry(providerId);
    const accounts = entry.pool.list().map((account) => providerAccount2(entry.pool, account.accountId));
    const accountId = context.accountId ?? entry.pool.getDefaultAccountId() ?? (accounts.length === 1 ? accounts[0].accountId : null);
    return entry.module.getCatalog(providerContext(this, { ...context, accounts, accountId }));
  }
  /** The account a provider would use by default, if it has one. */
  getDefaultAccountId(providerId) {
    const pool = this.#entries.get(providerId)?.pool;
    return typeof pool?.getDefaultAccountId === "function" ? pool.getDefaultAccountId() : null;
  }
  async invoke(providerId, request, context = {}) {
    await this.init();
    const route = this.bridge.getRoute(providerId);
    if (!route) throw new Error(`Unknown Dockyard provider route: ${providerId}`);
    try {
      return await route.invoke(request, providerContext(this, context));
    } finally {
      await this.#saveState([providerId]).catch(() => {
      });
    }
  }
  async stream(providerId, request, context = {}) {
    await this.init();
    const route = this.bridge.getRoute(providerId);
    if (!route) throw new Error(`Unknown Dockyard provider route: ${providerId}`);
    const output = route.stream(request, providerContext(this, context));
    const runtime = this;
    return (async function* streamWithPersistedHealth() {
      try {
        for await (const chunk of await output) yield chunk;
      } finally {
        try {
          await runtime.#saveState([providerId]);
        } catch {
        }
      }
    })();
  }
  snapshot() {
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      providers: [...this.#entries].map(([providerId, entry]) => ({
        providerId,
        manifest: { ...entry.module.manifest },
        policy: entry.pool.policy,
        defaultAccountId: entry.pool.getDefaultAccountId(),
        // Advisory warnings derived from what the provider already reported: a
        // window nearly spent, or one that resets soon while mostly unused.
        accounts: entry.pool.list().map((account) => ({
          ...account,
          alerts: evaluateQuotaAlerts(account)
        }))
      })),
      routes: this.bridge.listRoutes()
    };
  }
  #applyPatch(pool, accountId, patch = {}) {
    if (!patch || typeof patch !== "object") return;
    const input = { accountId };
    for (const key of ["email", "displayName", "subscription", "quota", "balance", "refresh", "resources"]) {
      if (patch[key] !== void 0) input[key] = patch[key];
    }
    if (patch.identity?.email !== void 0) input.email = patch.identity.email;
    if (patch.identity?.displayName !== void 0) input.displayName = patch.identity.displayName;
    if (patch.credits !== void 0) input.resources = { credits: patch.credits };
    pool.upsert(input);
  }
  async #persistAuthorizationResult(entry, providerId, result) {
    if (result?.status !== "completed") return result;
    const rawAccounts = Array.isArray(result.accounts) ? result.accounts : result.account ? [result.account] : [];
    return this.#enqueueProviderImport(providerId, async () => {
      const before = providerStorageSnapshot(entry);
      const beforeRefs = new Set(before.accounts.map((account) => account?.auth?.credentialRef).filter(Boolean));
      let accounts = [];
      try {
        accounts = await this.#storeImportedAccounts(entry, rawAccounts);
        await this.#saveState([providerId]);
      } catch (error) {
        restorePoolSnapshot(entry.pool, before);
        await deleteUncommittedCredentials(this.secretStore, beforeRefs, rawAccounts.filter((value) => value?.accountId));
        throw error;
      }
      return { ...result, accounts };
    });
  }
  /**
   * Serialize per-provider import transactions (candidate/source imports and
   * completed OAuth authorizations). Each task takes its pool snapshot inside
   * the critical section, so a failure rolls back against the newest state
   * instead of resurrecting stale snapshots over concurrent successes.
   */
  #enqueueProviderImport(providerId, task) {
    const previous = this.#providerImportQueues.get(providerId) ?? Promise.resolve();
    const run = previous.then(task, task);
    this.#providerImportQueues.set(providerId, run.then(() => {
    }, () => {
    }));
    return run;
  }
  async #storeImportedAccounts(entry, rawAccounts) {
    const accounts = [];
    for (const account of rawAccounts.filter((value) => value?.accountId)) {
      const alreadyImported = Boolean(
        account?.auth?.credentialRef || account?.auth?.kind && account?.credentialRef && !account?.candidateId
      );
      const imported = alreadyImported || typeof entry.module.importAccount !== "function" ? account : await entry.module.importAccount(account, providerContext(this));
      entry.pool.upsert(imported, { resetHealth: true });
      accounts.push(entry.pool.get(imported.accountId));
    }
    return accounts;
  }
  async #saveState(changedProviderIds = null) {
    const write = async () => {
      const changed = changedProviderIds === null ? new Set(this.#entries.keys()) : new Set(changedProviderIds);
      const merge = (latest) => {
        const pools = {
          ...latest?.pools && typeof latest.pools === "object" ? latest.pools : {}
        };
        for (const [providerId, entry] of this.#entries) {
          if (!changed.has(providerId) && Object.hasOwn(pools, providerId)) continue;
          const current = providerStorageSnapshot(entry);
          pools[providerId] = mergeProviderStorage(
            pools[providerId],
            current,
            this.#stateBaselines.get(providerId)
          );
        }
        return { ...latest, pools };
      };
      if (typeof this.stateStore.update === "function") {
        await this.stateStore.update(merge);
      } else {
        const latest = await this.stateStore.load();
        await this.stateStore.save(merge(latest));
      }
      for (const providerId of changed) {
        const entry = this.#entries.get(providerId);
        if (entry) this.#stateBaselines.set(providerId, structuredClone(providerStorageSnapshot(entry)));
      }
    };
    const queued = this.#saveQueue.then(write, write);
    this.#saveQueue = queued.catch(() => {
    });
    await queued;
  }
};

// packages/dsh-plugin/src/codex-transport.mjs
import { access, readFile as readFile7 } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname as dirname8, join as join15, resolve } from "node:path";
import { pathToFileURL } from "node:url";
var activeCodexModels = /* @__PURE__ */ new Map();
function recordCodexModels(models) {
  if (Array.isArray(models)) {
    for (const m of models) {
      if (m?.id) activeCodexModels.set(m.id, m);
    }
  }
}
var DSH_LLM_PI_AI = "@deepseek-ai/dsh-llm-pi-ai";
var PI_AI = "@earendil-works/pi-ai";
var PI_AI_CODEX_API = "@earendil-works/pi-ai/api/openai-codex-responses.lazy";
var PI_AI_CODEX_PROVIDER = "@earendil-works/pi-ai/providers/openai-codex";
var PI_AI_BUILTIN_PROVIDERS = "@earendil-works/pi-ai/providers/all";
async function importBareDependencies() {
  const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }, { openaiCodexProvider }, builtinProviders2] = await Promise.all([
    import(DSH_LLM_PI_AI),
    import(PI_AI),
    import(PI_AI_CODEX_API),
    import(PI_AI_CODEX_PROVIDER),
    import(PI_AI_BUILTIN_PROVIDERS)
  ]);
  return { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider, builtinProviders: builtinProviders2 };
}
function exportTarget(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  for (const condition of ["import", "node", "default"]) {
    const target = exportTarget(value[condition]);
    if (target) return target;
  }
  return null;
}
async function isFile2(path2) {
  try {
    await access(path2);
    return true;
  } catch {
    return false;
  }
}
async function findPackageRoot(startDirectory, packageName) {
  const packageParts = packageName.split("/");
  let current = resolve(startDirectory);
  while (true) {
    const candidate2 = join15(current, "node_modules", ...packageParts);
    if (await isFile2(join15(candidate2, "package.json"))) return candidate2;
    const parent = dirname8(current);
    if (parent === current) return null;
    current = parent;
  }
}
async function packageImportUrl(packageRoot, subpath = null) {
  const packageJson = JSON.parse(await readFile7(join15(packageRoot, "package.json"), "utf8"));
  const exports = packageJson.exports;
  let target = null;
  if (!subpath) {
    target = exportTarget(exports?.["."] ?? exports) ?? packageJson.module ?? packageJson.main;
  } else {
    const key = `./${subpath}`;
    target = exportTarget(exports?.[key]);
    if (!target && exports && typeof exports === "object") {
      for (const [pattern, value] of Object.entries(exports)) {
        if (!pattern.includes("*")) continue;
        const prefix = pattern.slice(0, pattern.indexOf("*"));
        const suffix = pattern.slice(pattern.indexOf("*") + 1);
        if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
        target = exportTarget(value)?.replace("*", key.slice(prefix.length, key.length - suffix.length));
        break;
      }
    }
  }
  if (typeof target !== "string") {
    throw new Error(`Cannot resolve ${subpath ?? "."} from ${packageRoot}`);
  }
  return pathToFileURL(join15(packageRoot, target)).href;
}
async function importFromDshInstall(moduleAnchor) {
  const anchor = moduleAnchor ?? process.env.DOCKYARD_DSH_CLI_PATH ?? process.argv[1] ?? import.meta.url;
  const dshRequire = createRequire(anchor);
  const dshLlmPath = dshRequire.resolve(DSH_LLM_PI_AI);
  const dshPackageRoot = dirname8(dirname8(dshLlmPath));
  const piRoot = await findPackageRoot(dshPackageRoot, PI_AI);
  if (!piRoot) throw new Error(`Cannot find ${PI_AI} beside ${DSH_LLM_PI_AI}`);
  const [{ PiAiAdapter }, { createProvider }, { openAICodexResponsesApi }, { openaiCodexProvider }, builtinProviders2] = await Promise.all([
    import(pathToFileURL(dshLlmPath).href),
    import(await packageImportUrl(piRoot)),
    import(await packageImportUrl(piRoot, "api/openai-codex-responses.lazy")),
    import(await packageImportUrl(piRoot, "providers/openai-codex")),
    import(await packageImportUrl(piRoot, "providers/all"))
  ]);
  return { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider, builtinProviders: builtinProviders2 };
}
async function loadExecutor(moduleAnchor) {
  let dependencies;
  try {
    dependencies = await importBareDependencies();
  } catch {
    dependencies = await importFromDshInstall(moduleAnchor);
  }
  const { PiAiAdapter, createProvider, openAICodexResponsesApi, openaiCodexProvider } = dependencies;
  const models = openaiCodexProvider().getModels();
  const modelById = new Map(models.map((model) => [model.id, model]));
  return createCodexPiAiExecutor({
    PiAiAdapter,
    createProvider,
    openAICodexResponsesApi,
    modelResolver: (modelId) => modelById.get(modelId) ?? activeCodexModels.get(modelId) ?? null
  });
}
async function loadDependencies(moduleAnchor) {
  try {
    return await importBareDependencies();
  } catch {
    return importFromDshInstall(moduleAnchor);
  }
}
function createCodexDshRequestExecutor({ moduleAnchor = null } = {}) {
  let executorPromise;
  return (envelope2) => {
    executorPromise ??= loadExecutor(moduleAnchor);
    return executorPromise.then((executor) => executor(envelope2));
  };
}
function createPiAiModelRegistryLoader({ moduleAnchor = null } = {}) {
  let registryPromise;
  return async () => {
    registryPromise ??= loadDependencies(moduleAnchor).then(({ builtinProviders: builtinProviders2 }) => {
      if (typeof builtinProviders2?.getBuiltinModels !== "function" || typeof builtinProviders2?.getBuiltinProviders !== "function") return [];
      return builtinProviders2.getBuiltinProviders().flatMap((provider) => builtinProviders2.getBuiltinModels(provider));
    });
    return registryPromise;
  };
}
function createCodexDshCatalogLoader({ moduleAnchor = null, ...options } = {}) {
  let dependenciesPromise;
  const fallbackLoader = async () => {
    dependenciesPromise ??= loadDependencies(moduleAnchor);
    const { openaiCodexProvider } = await dependenciesPromise;
    const models = openaiCodexProvider().getModels();
    return {
      models: models.map(codexModelToDshCatalog),
      source: "dsh_pi_ai_provider_catalog"
    };
  };
  const loader = createCodexCatalogLoader({
    fallbackLoader,
    ...options
  });
  return async (context = {}) => {
    const result = await loader(context);
    recordCodexModels(result?.models);
    return result;
  };
}

// packages/dsh-plugin/src/dockyard-service.mjs
import { spawn as spawn5 } from "node:child_process";
var DEFAULT_REFRESH_INTERVAL_MS = 5 * 60 * 1e3;
var AUTH_POLL_INTERVAL_MS = 750;
var AUTH_URL_WAIT_MS = 2e3;
var POLICY_ALIASES = /* @__PURE__ */ new Map([
  ["manual", ACCOUNT_SELECTION_POLICY.MANUAL],
  ["sticky", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["sticky-session", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["sticky_session", ACCOUNT_SELECTION_POLICY.STICKY_SESSION],
  ["round-robin", ACCOUNT_SELECTION_POLICY.ROUND_ROBIN],
  ["round_robin", ACCOUNT_SELECTION_POLICY.ROUND_ROBIN],
  ["failover", ACCOUNT_SELECTION_POLICY.FAILOVER]
]);
function sleep(milliseconds) {
  return new Promise((resolve2) => setTimeout(resolve2, milliseconds));
}
function numericOption2(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function providerName(manifest) {
  return manifest?.displayName ?? manifest?.id ?? "provider";
}
function displayNumber(value, unit = "") {
  if (value === null || value === void 0) return "\u672A\u77E5";
  return `${value}${unit ? ` ${unit}` : ""}`;
}
function displayTime(value) {
  return value ? new Date(value).toLocaleString() : "\u672A\u77E5";
}
function displayQuota(quota) {
  if (!quota) return "\u989D\u5EA6\uFF1A\u672A\u77E5";
  const topLevel = quota.limit === null || quota.limit === void 0 ? displayNumber(quota.remaining, quota.unit) : `${displayNumber(quota.remaining)} / ${displayNumber(quota.limit)}${quota.unit ? ` ${quota.unit}` : ""}`;
  const windows = Array.isArray(quota.windows) ? quota.windows.map((window) => {
    const label = window.name ?? window.id ?? "window";
    const value = window.limit === null || window.limit === void 0 ? displayNumber(window.remaining, window.unit) : `${displayNumber(window.remaining)} / ${displayNumber(window.limit)}${window.unit ? ` ${window.unit}` : ""}`;
    return `${label}: ${value}\uFF0C\u91CD\u7F6E ${displayTime(window.resetAt)}`;
  }) : [];
  return [
    `\u989D\u5EA6\uFF1A${topLevel}`,
    ...windows,
    `\u989D\u5EA6\u66F4\u65B0\u65F6\u95F4\uFF1A${displayTime(quota.updatedAt)}`
  ].join("\uFF1B");
}
function displayAccount(account) {
  const identity = account.email ?? account.displayName ?? account.accountId;
  const plan = account.subscription?.plan ?? "\u8BA2\u9605\u672A\u77E5";
  const health = account.health?.status ?? "unknown";
  const lastChecked = account.health?.lastCheckedAt ?? account.quota?.updatedAt;
  const oauthState = health === "expired" ? "OAuth \u6388\u6743\uFF1A\u9700\u91CD\u65B0\u6388\u6743" : `OAuth token \u6709\u6548\u81F3\uFF1A${displayTime(account.refresh?.accessTokenExpiresAt)}`;
  return [
    `${identity} (${account.accountId})`,
    `\u72B6\u6001\uFF1A${health}`,
    `\u5957\u9910\uFF1A${plan}`,
    `\u8BA2\u9605\u5230\u671F\uFF1A${displayTime(account.subscription?.expiresAt)}`,
    displayQuota(account.quota),
    `\u989D\u5EA6\u68C0\u67E5\uFF1A${displayTime(lastChecked)}`,
    oauthState,
    `OAuth \u4E0B\u6B21\u5237\u65B0\uFF1A${displayTime(account.refresh?.nextRefreshAt)}`
  ].join("\uFF1B");
}
function manifestFor2(runtime, input) {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value) return null;
  const manifests = runtime.listProviderManifests?.() ?? [];
  return manifests.find((manifest) => String(manifest.id).toLowerCase() === value) ?? manifests.find((manifest) => String(manifest.displayName ?? "").toLowerCase() === value) ?? manifests.find((manifest) => String(manifest.id).toLowerCase().endsWith(`-${value}`)) ?? null;
}
function providerIdFor(runtime, input) {
  return manifestFor2(runtime, input)?.id ?? null;
}
function commandTokens(rawInput) {
  return String(rawInput ?? "").trim().split(/\s+/).filter(Boolean);
}
function commandSuccess(text3) {
  return { kind: "success", text: text3 };
}
function commandError(text3) {
  return { kind: "error", text: text3 };
}
function openDefaultBrowser(url) {
  if (!url) return;
  try {
    let child;
    if (process.platform === "darwin") {
      child = spawn5("open", [url], { detached: true, stdio: "ignore" });
    } else if (process.platform === "win32") {
      const comspec = process.env.ComSpec || process.env.COMSPEC || "cmd.exe";
      child = spawn5(comspec, ["/d", "/s", "/c", `start "" "${String(url).replace(/"/g, "")}"`], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        windowsVerbatimArguments: true
      });
    } else {
      child = spawn5("xdg-open", [url], { detached: true, stdio: "ignore" });
    }
    child.unref();
  } catch {
  }
}
var DockyardDshService = class {
  #refreshTimer = null;
  #refreshPromises = /* @__PURE__ */ new Map();
  #started = false;
  #disposed = false;
  #authSessions = /* @__PURE__ */ new Map();
  #authOpened = /* @__PURE__ */ new Set();
  #authStartPromises = /* @__PURE__ */ new Map();
  constructor({
    runtime,
    refreshIntervalMs = numericOption2(process.env.DOCKYARD_DSH_REFRESH_INTERVAL_MS, DEFAULT_REFRESH_INTERVAL_MS),
    autoRefresh = true,
    openBrowser = openDefaultBrowser,
    logger = console,
    notifyAdaptersUpdated = null
  } = {}) {
    if (!runtime) throw new Error("Dockyard DSH service requires a runtime");
    this.runtime = runtime;
    this.refreshIntervalMs = refreshIntervalMs;
    this.autoRefresh = autoRefresh;
    this.openBrowser = openBrowser;
    this.logger = logger;
    this.notifyAdaptersUpdated = notifyAdaptersUpdated;
    this.ready = runtime.init();
  }
  async start() {
    await this.ready;
    if (this.#started || this.#disposed) return this;
    this.#started = true;
    if (this.autoRefresh) {
      this.#refreshTimer = setInterval(() => {
        void this.refresh().catch((error) => this.#warn("scheduled quota refresh failed", error));
      }, this.refreshIntervalMs);
      this.#refreshTimer.unref?.();
    }
    return this;
  }
  async dispose() {
    this.#disposed = true;
    if (this.#refreshTimer) clearInterval(this.#refreshTimer);
    this.#refreshTimer = null;
    this.#refreshPromises.clear();
    this.#authStartPromises.clear();
    for (const { providerId, sessionId, timer } of this.#authSessions.values()) {
      if (timer) clearTimeout(timer);
      await this.runtime.cancelAuthorization(providerId, sessionId).catch(() => {
      });
    }
    this.#authSessions.clear();
    this.#authOpened.clear();
  }
  async snapshot() {
    await this.ready;
    return this.runtime.snapshot();
  }
  async scan(providerInput = null) {
    await this.ready;
    const providerId = providerInput ? providerIdFor(this.runtime, providerInput) : null;
    if (providerInput && !providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    const result = await this.runtime.scan(providerId);
    if (!providerInput) return result;
    return {
      ...result,
      providers: result.providers.filter((provider) => provider.providerId === providerId)
    };
  }
  async addApiKey(providerInput, apiKey, label = "") {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    const trimmedKey = String(apiKey ?? "").trim();
    if (!trimmedKey) throw new Error("\u8BF7\u8F93\u5165\u6709\u6548\u7684 API Key");
    const imported = await this.runtime.importSource(providerId, {
      apiKey: trimmedKey,
      label: String(label ?? "").trim()
    });
    const accounts = Array.isArray(imported?.accounts) ? imported.accounts : [];
    if (accounts.length > 0) {
      const firstId = accounts[0].accountId;
      await this.runtime.setDefaultAccount(providerId, firstId).catch(() => {
      });
      await this.runtime.getCatalog(providerId, { force: true }).catch(() => null);
    }
    try {
      this.notifyAdaptersUpdated?.();
    } catch {
    }
    return {
      accounts,
      diagnostics: imported?.diagnostics ?? []
    };
  }
  async add(providerInput = null, candidateId = null, options = {}) {
    if (options?.apiKey) {
      return this.addApiKey(providerInput, options.apiKey, options.label);
    }
    const scan = await this.scan(providerInput);
    const imports = [];
    const diagnostics = [];
    for (const provider of scan.providers) {
      const candidates = provider.candidates.filter((candidate2) => !candidate2.imported);
      const selected = candidateId ? candidates.filter((candidate2) => candidate2.candidateId === candidateId) : candidates;
      if (candidateId && selected.length === 0) continue;
      for (const candidate2 of selected) {
        try {
          const imported = await this.runtime.importCandidate(provider.providerId, candidate2.candidateId);
          let refreshed = imported.account;
          try {
            refreshed = (await this.runtime.refreshAccount(provider.providerId, imported.account.accountId, {
              tolerateFailure: true
            })).account;
          } catch (error) {
            diagnostics.push(`${providerName(provider.manifest)} ${candidate2.candidateId} \u5237\u65B0\u5931\u8D25\uFF1A${redactError(error)}`);
          }
          imports.push(refreshed);
        } catch (error) {
          diagnostics.push(`${providerName(provider.manifest)} ${candidate2.candidateId} \u6DFB\u52A0\u5931\u8D25\uFF1A${redactError(error)}`);
        }
      }
    }
    if (candidateId && imports.length === 0 && diagnostics.length === 0) {
      throw new Error(`\u6CA1\u6709\u627E\u5230\u672A\u6DFB\u52A0\u7684 OAuth \u5019\u9009\uFF1A${candidateId}`);
    }
    if (imports.length > 0) {
      try {
        this.notifyAdaptersUpdated?.();
      } catch {
      }
    }
    return { accounts: imports, diagnostics, scan };
  }
  async refresh(providerInput = null, { forceCatalog = false } = {}) {
    await this.ready;
    const providerId = providerInput ? providerIdFor(this.runtime, providerInput) : null;
    if (providerInput && !providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    const refreshKey = providerId ?? "*";
    const existing = this.#refreshPromises.get(refreshKey);
    if (existing) return existing;
    const promise = (async () => {
      const results = await this.runtime.refreshAll(providerId);
      if (forceCatalog) {
        if (providerId) {
          await this.runtime.getCatalog(providerId, { force: true }).catch(() => null);
        } else {
          const manifests = this.runtime.listProviderManifests?.() ?? [];
          await Promise.all(manifests.map((m) => this.runtime.getCatalog(m.id, { force: true }).catch(() => null)));
        }
        try {
          this.notifyAdaptersUpdated?.();
        } catch {
        }
      }
      return results;
    })().finally(() => {
      if (this.#refreshPromises.get(refreshKey) === promise) this.#refreshPromises.delete(refreshKey);
    });
    this.#refreshPromises.set(refreshKey, promise);
    return promise;
  }
  async catalog(providerInput) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    return { providerId, manifest: manifestFor2(this.runtime, providerInput), catalog: await this.runtime.getCatalog(providerId) };
  }
  async setPolicy(providerInput, policyInput, defaultAccountId = void 0) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    const policy = POLICY_ALIASES.get(String(policyInput ?? "").toLowerCase());
    if (!policy) throw new Error(`\u672A\u77E5\u8D26\u53F7\u7B56\u7565\uFF1A${policyInput}\uFF1B\u53EF\u7528\u503C\uFF1A${[...new Set(POLICY_ALIASES.values())].join(", ")}`);
    return this.runtime.setPolicy(providerId, policy, defaultAccountId);
  }
  async setDefaultAccount(providerInput, accountId) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    const result = await this.runtime.setDefaultAccount(providerId, accountId);
    void this.runtime.getCatalog(providerId, { force: true, accountId }).catch(() => {
    });
    return result;
  }
  async removeAccount(providerInput, accountId) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    if (!accountId) throw new Error("\u79FB\u9664\u8D26\u53F7\u9700\u8981 accountId");
    return this.runtime.removeAccount(providerId, accountId);
  }
  async getContextWindowOverride(input) {
    await this.ready;
    return this.runtime.getContextWindowOverride(input);
  }
  async setContextWindowOverride(input, value) {
    await this.ready;
    return this.runtime.setContextWindowOverride(input, value);
  }
  #hasCapability(providerId, capability) {
    return Boolean(this.runtime.hasProviderCapability?.(providerId, capability));
  }
  async #autoProvisionIfNeeded(providerId) {
    if (!this.#hasCapability(providerId, PROVIDER_BEHAVIOR_CAPABILITIES.AUTO_PROVISION_FREE_ACCOUNT)) return;
    const snap = this.runtime.snapshot?.();
    const provider = snap?.providers?.find((p) => p.providerId === providerId);
    if (provider && (!Array.isArray(provider.accounts) || provider.accounts.length === 0)) {
      await this.add(providerId).catch(() => {
      });
    }
  }
  async getModelSelection(providerId, accountId = null) {
    await this.ready;
    await this.#autoProvisionIfNeeded(providerId);
    const forceLiveCatalog = this.#hasCapability(providerId, PROVIDER_BEHAVIOR_CAPABILITIES.FORCE_LIVE_CATALOG);
    const catalog = await this.runtime.getCatalog(providerId, {
      force: forceLiveCatalog,
      ...accountId ? { accountId } : {}
    }).catch(() => ({ models: [] }));
    if (forceLiveCatalog) {
      try {
        this.notifyAdaptersUpdated?.();
      } catch {
      }
    }
    const models = catalog?.models ?? [];
    const usable = models.filter((model) => model?.unavailable !== true);
    const enabledModelIds = reconcileModelSelection(
      this.runtime.getModelSelection(providerId, accountId),
      usable.length > 0 ? usable : models
    );
    return {
      providerId,
      models,
      enabledModelIds
    };
  }
  async setModelSelection(providerId, enabledModelIds, accountId = null) {
    await this.ready;
    const saved = await this.runtime.setModelSelection(providerId, enabledModelIds, accountId);
    try {
      this.notifyAdaptersUpdated?.();
    } catch {
    }
    return {
      providerId,
      enabledModelIds: saved,
      saved: true
    };
  }
  async testModelConnection(providerInput, modelId, { timeoutMs = 15e3 } = {}) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput);
    if (!providerId) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    if (!modelId || typeof modelId !== "string") throw new Error("\u7F3A\u5C11\u6709\u6548\u7684 modelId");
    await this.#autoProvisionIfNeeded(providerId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("\u8FDE\u63A5\u6D4B\u8BD5\u8D85\u65F6 (15s)")), timeoutMs);
    const startTime = Date.now();
    let receivedChunk = false;
    let latencyMs = 0;
    try {
      const stream = await this.runtime.stream(
        providerId,
        {
          model: modelId,
          messages: [{ role: "user", content: "hi" }],
          maxTokens: 512,
          probe: true,
          noFallback: true
        },
        { signal: controller.signal }
      );
      for await (const chunk of stream) {
        receivedChunk = true;
        latencyMs = Date.now() - startTime;
        break;
      }
      if (!receivedChunk) {
        latencyMs = Date.now() - startTime;
      }
      return {
        ok: true,
        providerId,
        modelId,
        latencyMs
      };
    } catch (error) {
      latencyMs = Date.now() - startTime;
      const message = redactError(error);
      const status = error?.status ?? error?.statusCode ?? null;
      return {
        ok: false,
        providerId,
        modelId,
        latencyMs,
        status,
        error: message || "\u8FDE\u63A5\u5931\u8D25"
      };
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  }
  async startAuthorization(providerInput, { openBrowser = true } = {}) {
    await this.ready;
    const manifest = manifestFor2(this.runtime, providerInput);
    if (!manifest) throw new Error(`\u672A\u77E5 provider\uFF1A${providerInput}`);
    if (!manifest.capabilities?.includes("oauth_authorization")) {
      const provided = typeof this.runtime.authorizationInstructions === "function" ? await this.runtime.authorizationInstructions(manifest.id) : null;
      const keyOnly = manifest.capabilities?.includes("api_key_auth");
      const fallback = keyOnly ? `${providerName(manifest)} \u4F7F\u7528 API Key \u8BA4\u8BC1\uFF1B\u8BF7\u5728\u9762\u677F\u7684\u300C\u6DFB\u52A0\u65B0\u7684 API Key\u300D\u4E2D\u586B\u5165\uFF0C\u6216\u626B\u63CF\u672C\u673A\u5DF2\u6709\u7684\u767B\u5F55\u6001\u3002` : `${providerName(manifest)} \u6CA1\u6709\u72EC\u7ACB\u7684\u5B98\u65B9\u6388\u6743\u5165\u53E3\uFF1B\u8BF7\u5148\u5728\u5B98\u65B9\u5BA2\u6237\u7AEF\u6216\u5B98\u65B9\u73AF\u5883\u767B\u5F55/\u5207\u6362\u8D26\u53F7\uFF0C\u7136\u540E\u626B\u63CF\u672C\u673A\u767B\u5F55\u6001\uFF0C\u518D\u6DFB\u52A0\u5019\u9009\u3002`;
      return {
        status: "unsupported",
        providerId: manifest.id,
        instructions: provided ?? fallback
      };
    }
    const existingStart = this.#authStartPromises.get(manifest.id);
    if (existingStart) return existingStart;
    const startPromise = this.#startAuthorization(manifest, { openBrowser });
    const trackedStart = startPromise.finally(() => {
      if (this.#authStartPromises.get(manifest.id) === trackedStart) {
        this.#authStartPromises.delete(manifest.id);
      }
    });
    this.#authStartPromises.set(manifest.id, trackedStart);
    return trackedStart;
  }
  async #startAuthorization(manifest, { openBrowser = true } = {}) {
    const existing = this.#activeAuthSession(manifest.id);
    if (existing) {
      let current;
      try {
        current = await this.pollAuthorization(manifest.id, existing.sessionId);
      } catch (error) {
        current = {
          status: "processing",
          providerId: manifest.id,
          sessionId: existing.sessionId,
          ...existing.authorizationUrl ? { authorizationUrl: existing.authorizationUrl } : {},
          diagnostic: `\u5DF2\u6709\u767B\u5F55\u9A8C\u8BC1\u8FDB\u884C\u4E2D\uFF0C\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6\u6700\u65B0\u72B6\u6001\uFF1A${redactError(error)}`
        };
      }
      if (current?.status === "completed") return current;
      if (current && ["pending", "processing"].includes(current.status)) {
        this.#scheduleAuthorization(manifest.id, existing.sessionId);
        return {
          ...current,
          instructions: current.instructions ?? "\u5DF2\u6709\u767B\u5F55\u9A8C\u8BC1\u8FDB\u884C\u4E2D\uFF0C\u8BF7\u4F7F\u7528\u5F53\u524D Google \u9875\u9762\uFF1B\u4E0D\u4F1A\u91CD\u590D\u6253\u5F00\u767B\u5F55\u9875\u3002"
        };
      }
    }
    const started = await this.runtime.startAuthorization(manifest.id);
    this.#authSessions.set(started.sessionId, {
      providerId: manifest.id,
      sessionId: started.sessionId,
      status: started.status,
      authorizationUrl: started.authorizationUrl ?? null,
      openBrowser
    });
    const result = await this.#waitForAuthorizationUrl(manifest.id, started, openBrowser);
    const tracked = this.#authSessions.get(started.sessionId);
    if (tracked) Object.assign(tracked, {
      status: result.status,
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null
    });
    if (result.status === "pending" || result.status === "processing") this.#scheduleAuthorization(manifest.id, started.sessionId);
    else if (result.status === "completed") {
      this.#authSessions.delete(started.sessionId);
      await this.refresh(manifest.id).catch((error) => this.#warn("post-login quota refresh failed", error));
    }
    return result;
  }
  async pollAuthorization(providerId, sessionId) {
    const tracked = this.#authSessions.get(sessionId);
    const result = await this.runtime.pollAuthorization(providerId, sessionId);
    this.#openAuthorizationUrl(result, tracked?.openBrowser ?? true);
    if (tracked) Object.assign(tracked, {
      status: result.status,
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null
    });
    if (result.status === "completed") {
      this.#authSessions.delete(sessionId);
      await this.refresh(providerId).catch((error) => this.#warn("post-login quota refresh failed", error));
    } else if (!["pending", "processing"].includes(result.status)) {
      this.#authSessions.delete(sessionId);
    }
    return result;
  }
  async cancelAuthorization(providerInput, sessionId) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput) ?? String(providerInput);
    const tracked = this.#authSessions.get(sessionId);
    if (tracked?.timer) clearTimeout(tracked.timer);
    const result = await this.runtime.cancelAuthorization(providerId, sessionId);
    this.#authSessions.delete(sessionId);
    this.#authOpened.delete(sessionId);
    return result;
  }
  async submitAuthorizationCode(providerInput, sessionId, code) {
    await this.ready;
    const providerId = providerIdFor(this.runtime, providerInput) ?? String(providerInput);
    const tracked = this.#authSessions.get(sessionId);
    const result = await this.runtime.submitAuthorizationCode(providerId, sessionId, code);
    this.#openAuthorizationUrl(result, tracked?.openBrowser ?? true);
    if (tracked) Object.assign(tracked, {
      status: result.status,
      authorizationUrl: result.authorizationUrl ?? tracked.authorizationUrl ?? null
    });
    if (result.status === "pending" || result.status === "processing") this.#scheduleAuthorization(providerId, sessionId);
    else if (result.status === "completed") {
      this.#authSessions.delete(sessionId);
      await this.refresh(providerId).catch((error) => this.#warn("post-login quota refresh failed", error));
    } else if (result.status !== "pending" && result.status !== "processing") {
      this.#authSessions.delete(sessionId);
    }
    return result;
  }
  helpText() {
    const providers = (this.runtime.listProviderManifests?.() ?? []).map((manifest) => `${manifest.id} (${providerName(manifest)})`);
    return [
      "Dockyard DSH \u539F\u751F\u547D\u4EE4\uFF1A",
      "/dockyard status                         \u67E5\u770B\u8D26\u53F7\u3001\u5B9E\u65F6\u989D\u5EA6\u548C\u5237\u65B0\u65F6\u95F4",
      "/dockyard scan [provider]                \u626B\u63CF\u672C\u673A\u5B98\u65B9\u767B\u5F55\u6001",
      "/dockyard add [provider] [candidateId]   \u6DFB\u52A0\u626B\u63CF\u5230\u7684 OAuth \u8D26\u53F7",
      "/dockyard login <provider>               \u542F\u52A8 provider \u5B98\u65B9\u6388\u6743\u6D41\u7A0B\u5E76\u767B\u5F55",
      "/dockyard refresh [provider]             \u5F3A\u5236\u8BFB\u53D6\u5B9E\u65F6\u989D\u5EA6",
      "/dockyard models <provider>              \u8BFB\u53D6 provider \u5B9E\u65F6\u6A21\u578B/\u6863\u4F4D",
      "/dockyard policy <provider> <policy>     \u8BBE\u7F6E manual/sticky_session/round_robin/failover",
      "/dockyard use <provider> <accountId>      \u624B\u52A8\u6307\u5B9A\u8D26\u53F7",
      "/dockyard remove <provider> <accountId>   \u4ECE\u8D26\u53F7\u6C60\u79FB\u9664\u8D26\u53F7\u5E76\u6E05\u7406\u672C\u673A Keychain \u5F15\u7528",
      "/dockyard cancel <provider> <sessionId>  \u53D6\u6D88 OAuth \u767B\u5F55",
      `\u5F53\u524D providers\uFF1A${providers.length ? providers.join("\u3001") : "\u6682\u65E0"}`
    ].join("\n");
  }
  #openAuthorizationUrl(result, openBrowser = true) {
    if (!openBrowser || !result?.authorizationUrl || this.#authOpened.has(result.sessionId)) return;
    this.#authOpened.add(result.sessionId);
    if (result.browserOpened) return;
    void Promise.resolve(this.openBrowser(result.authorizationUrl)).catch((error) => {
      this.#warn("could not open authorization URL", error);
    });
  }
  #activeAuthSession(providerId) {
    return [...this.#authSessions.values()].find((session) => session.providerId === providerId && ["pending", "processing"].includes(session.status ?? "pending")) ?? null;
  }
  async #waitForAuthorizationUrl(providerId, started, openBrowser = true) {
    this.#openAuthorizationUrl(started, openBrowser);
    if (started.authorizationUrl || !["pending", "processing"].includes(started.status)) return started;
    const deadline = Date.now() + AUTH_URL_WAIT_MS;
    let result = started;
    while (Date.now() < deadline && ["pending", "processing"].includes(result.status)) {
      await sleep(100);
      result = await this.runtime.pollAuthorization(providerId, started.sessionId);
      this.#openAuthorizationUrl(result, openBrowser);
    }
    return result;
  }
  #scheduleAuthorization(providerId, sessionId) {
    const current = this.#authSessions.get(sessionId);
    if (!current || current.timer) return;
    current.timer = setTimeout(async () => {
      current.timer = null;
      if (this.#disposed) return;
      try {
        const result = await this.pollAuthorization(providerId, sessionId);
        if (["pending", "processing"].includes(result.status)) this.#scheduleAuthorization(providerId, sessionId);
      } catch (error) {
        this.#authSessions.delete(sessionId);
        this.#warn("OAuth authorization polling failed", error);
      }
    }, AUTH_POLL_INTERVAL_MS);
    current.timer.unref?.();
  }
  #warn(message, error) {
    this.logger?.warn?.(`[dockyard-dsh] ${message}: ${redactError(error)}`);
  }
};
function createDockyardCommand(service) {
  return {
    name: "dockyard",
    description: "Manage Dockyard DSH providers, OAuth accounts, quotas, models, and account selection",
    input: { hint: "status | scan | add | login | refresh | models | policy | use | cancel" },
    handler: async ({ rawInput, signal }) => {
      if (signal?.aborted) return commandError("Dockyard \u547D\u4EE4\u5DF2\u53D6\u6D88\u3002");
      const [verb = "help", ...args] = commandTokens(rawInput);
      try {
        switch (verb.toLowerCase()) {
          case "help":
            return commandSuccess(service.helpText());
          case "status": {
            const snapshot = await service.snapshot();
            const lines = ["Dockyard DSH \u72B6\u6001", `\u66F4\u65B0\u65F6\u95F4\uFF1A${displayTime(snapshot.generatedAt)}`];
            for (const provider of snapshot.providers ?? []) {
              lines.push(`
${providerName(provider.manifest)} [${provider.providerId}]`);
              lines.push(`\u7B56\u7565\uFF1A${provider.policy}\uFF1B\u5F53\u524D\u8D26\u53F7\uFF1A${provider.defaultAccountId ?? "\u8DDF\u968F\u7B56\u7565"}`);
              if (!provider.accounts?.length) lines.push("\u6682\u65E0\u5DF2\u6DFB\u52A0\u8D26\u53F7");
              for (const account of provider.accounts ?? []) lines.push(`- ${displayAccount(account)}`);
            }
            return commandSuccess(lines.join("\n"));
          }
          case "scan": {
            const result = await service.scan(args[0] ?? null);
            const lines = ["\u672C\u673A OAuth \u767B\u5F55\u6001\u626B\u63CF\u7ED3\u679C\uFF1A"];
            for (const provider of result.providers ?? []) {
              lines.push(`
${providerName(provider.manifest)} [${provider.providerId}]`);
              if (!provider.candidates?.length) lines.push(`\u672A\u53D1\u73B0\uFF1A${provider.diagnostics?.join("\uFF1B") || "provider \u672A\u8FD4\u56DE\u5019\u9009"}`);
              for (const candidate2 of provider.candidates ?? []) {
                lines.push(`- ${candidate2.imported ? "\u5DF2\u6DFB\u52A0" : "\u53EF\u6DFB\u52A0"} ${candidate2.candidateId}\uFF1A${candidate2.email ?? candidate2.displayName ?? candidate2.accountId}`);
              }
            }
            return commandSuccess(lines.join("\n"));
          }
          case "add": {
            const result = await service.add(args[0] ?? null, args[1] ?? null);
            const lines = [`\u5DF2\u6DFB\u52A0\u8D26\u53F7\uFF1A${result.accounts.length}`];
            for (const account of result.accounts) lines.push(`- ${account.email ?? account.displayName ?? account.accountId}`);
            if (!result.accounts.length) lines.push("\u6CA1\u6709\u65B0\u7684 OAuth \u5019\u9009\uFF1B\u5148\u6267\u884C /dockyard scan \u67E5\u770B\u672C\u673A\u767B\u5F55\u6001\u3002");
            if (result.diagnostics.length) lines.push(`\u8BCA\u65AD\uFF1A${result.diagnostics.join("\uFF1B")}`);
            return commandSuccess(lines.join("\n"));
          }
          case "login": {
            if (!args[0]) return commandError("\u7528\u6CD5\uFF1A/dockyard login <provider>");
            const result = await service.startAuthorization(args[0]);
            if (["unsupported", "opened", "failed"].includes(result.status)) {
              return result.status === "failed" ? commandError(result.diagnostic ?? result.instructions) : commandSuccess(result.instructions);
            }
            const lines = [`OAuth \u72B6\u6001\uFF1A${result.status}`, `\u4F1A\u8BDD\uFF1A${result.sessionId}`];
            if (result.authorizationUrl) lines.push(`\u5B98\u65B9\u6388\u6743\u9875\uFF1A${result.authorizationUrl}`);
            if (result.instructions) lines.push(result.instructions);
            if (result.diagnostic) lines.push(`\u8BCA\u65AD\uFF1A${result.diagnostic}`);
            return commandSuccess(lines.join("\n"));
          }
          case "refresh": {
            const results = await service.refresh(args[0] ?? null);
            const lines = [`\u5DF2\u5237\u65B0\u8D26\u53F7\uFF1A${results.length}`];
            for (const result of results) {
              const account = result.account;
              lines.push(`- ${account?.providerId ?? "provider"}/${account?.email ?? account?.accountId ?? "unknown"}\uFF1A${result.diagnostics?.join("\uFF1B") || "\u6210\u529F"}`);
            }
            return commandSuccess(lines.join("\n"));
          }
          case "models": {
            if (!args[0]) return commandError("\u7528\u6CD5\uFF1A/dockyard models <provider>");
            const { providerId, manifest, catalog } = await service.catalog(args[0]);
            const lines = [`${providerName(manifest)} [${providerId}] \u5B9E\u65F6\u6A21\u578B\u76EE\u5F55\uFF1A`];
            for (const model of catalog.models ?? []) {
              const efforts = model.reasoning?.efforts?.map((effort) => effort.id).join(", ");
              lines.push(`- ${model.id}${model.name && model.name !== model.id ? `\uFF1A${model.name}` : ""}${efforts ? `\uFF1B\u6863\u4F4D\uFF1A${efforts}` : ""}`);
            }
            if (!(catalog.models ?? []).length) lines.push("provider \u5F53\u524D\u6CA1\u6709\u8FD4\u56DE\u6A21\u578B\u3002");
            return commandSuccess(lines.join("\n"));
          }
          case "policy": {
            if (!args[0] || !args[1]) return commandError("\u7528\u6CD5\uFF1A/dockyard policy <provider> <manual|sticky_session|round_robin|failover> [accountId]");
            const result = await service.setPolicy(args[0], args[1], args[2]);
            return commandSuccess(`\u5DF2\u8BBE\u7F6E ${result.providerId} \u7B56\u7565\u4E3A ${result.policy}\uFF1B\u9ED8\u8BA4\u8D26\u53F7\uFF1A${result.defaultAccountId ?? "\u8DDF\u968F\u7B56\u7565"}`);
          }
          case "use": {
            if (!args[0] || !args[1]) return commandError("\u7528\u6CD5\uFF1A/dockyard use <provider> <accountId>");
            const result = await service.setDefaultAccount(args[0], args[1]);
            return commandSuccess(`\u5DF2\u5C06 ${result.providerId} \u5F53\u524D\u8D26\u53F7\u8BBE\u4E3A ${result.defaultAccountId}`);
          }
          case "remove": {
            if (!args[0] || !args[1]) return commandError("\u7528\u6CD5\uFF1A/dockyard remove <provider> <accountId>");
            const result = await service.removeAccount(args[0], args[1]);
            const diagnostic = result.diagnostics?.length ? `\uFF1B${result.diagnostics.join("\uFF1B")}` : "";
            return commandSuccess(`\u5DF2\u79FB\u9664 ${result.providerId}/${result.accountId}\uFF1B\u5F53\u524D\u8D26\u53F7\uFF1A${result.defaultAccountId ?? "\u8DDF\u968F\u7B56\u7565"}${diagnostic}`);
          }
          case "cancel": {
            if (!args[0] || !args[1]) return commandError("\u7528\u6CD5\uFF1A/dockyard cancel <provider> <sessionId>");
            const result = await service.cancelAuthorization(args[0], args[1]);
            return commandSuccess(`OAuth \u4F1A\u8BDD ${result.sessionId}\uFF1A${result.status}`);
          }
          default:
            return commandError(`\u672A\u77E5 Dockyard \u5B50\u547D\u4EE4\uFF1A${verb}

${service.helpText()}`);
        }
      } catch (error) {
        return commandError(`Dockyard \u547D\u4EE4\u5931\u8D25\uFF1A${redactError(error)}`);
      }
    }
  };
}
var dockyardDshConstants = Object.freeze({
  defaultRefreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
  authPollIntervalMs: AUTH_POLL_INTERVAL_MS
});

// packages/dsh-plugin/src/dockyard-credential-store.mjs
import { createHash as createHash13 } from "node:crypto";
function dshCredentialRef(ref) {
  const digest = createHash13("sha256").update(String(ref)).digest("hex");
  return `DOCKYARD_DSH_${digest}`;
}
function parseCredential(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("DSH Credentials \u4E2D\u7684 Dockyard \u51ED\u8BC1\u683C\u5F0F\u65E0\u6548");
  }
}
function createDockyardCredentialStore(credentials, fallback = null) {
  const usable = credentials && typeof credentials.resolve === "function" && typeof credentials.set === "function" && typeof credentials.unset === "function";
  return {
    async read(ref) {
      if (usable) {
        const resolved = await credentials.resolve(dshCredentialRef(ref));
        const parsed = parseCredential(resolved?.value);
        if (parsed !== null) return parsed;
      }
      return typeof fallback?.read === "function" ? fallback.read(ref) : null;
    },
    async write(ref, value) {
      if (usable) {
        await credentials.set(dshCredentialRef(ref), JSON.stringify(value));
        return ref;
      }
      if (typeof fallback?.write !== "function") throw new Error("DSH Credentials \u5C1A\u672A\u5C31\u7EEA");
      return fallback.write(ref, value);
    },
    async delete(ref) {
      if (usable) await credentials.unset(dshCredentialRef(ref));
      if (typeof fallback?.delete === "function") await fallback.delete(ref);
    }
  };
}

// packages/dsh-plugin/src/native-key-pool-host.mjs
import { AsyncLocalStorage } from "node:async_hooks";
import { isAgentLoopRequest, markAgentLoopRequest } from "@deepseek-ai/dsh-llm";
import { join as join16 } from "node:path";

// packages/dsh-plugin/src/native-usage.mjs
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
var builtinBaseUrls = /* @__PURE__ */ new Map();
for (const provider of builtinProviders()) {
  if (typeof provider?.id === "string" && typeof provider?.baseUrl === "string") {
    builtinBaseUrls.set(provider.id, provider.baseUrl);
  }
}
function baseUrlFor(providerId, profile) {
  const configured = typeof profile?.baseURL === "string" ? profile.baseURL.trim() : "";
  const baseUrl = configured || builtinBaseUrls.get(providerId) || null;
  return baseUrl ? validateNativeEndpoint(baseUrl, { providerId }) : null;
}
function endpoint(baseUrl, path2) {
  if (!baseUrl) throw new Error("provider \u6CA1\u6709\u8FD4\u56DE\u53EF\u7528\u7684 base URL");
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path2.replace(/^\//, ""), base).toString();
}
async function readJson2(response) {
  const raw = await response.text();
  let body;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail = typeof body?.error === "string" ? body.error : body?.error?.message ?? body?.message ?? response.statusText;
    throw new Error(`${response.status} ${detail || "provider usage \u8BF7\u6C42\u5931\u8D25"}`);
  }
  if (!body || typeof body !== "object") throw new Error("provider usage \u8FD4\u56DE\u4E86\u65E0\u6548 JSON");
  return body;
}
function bearerHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
}
function updatedAt() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function deepseekBalanceModule() {
  return {
    id: "deepseek-balance",
    supports: ["deepseek", "deepseek-official"],
    async fetch({ providerId, profile, apiKey, signal }) {
      const body = await readJson2(await fetch(endpoint(baseUrlFor(providerId, profile), "user/balance"), {
        method: "GET",
        headers: bearerHeaders(apiKey),
        signal
      }));
      const refreshedAt = updatedAt();
      const balances = Array.isArray(body.balance_infos) ? body.balance_infos : [];
      return {
        status: "ok",
        source: "DeepSeek /user/balance",
        updatedAt: refreshedAt,
        available: body.is_available === true,
        quota: {
          windows: balances.map((balance) => ({
            id: `balance-${balance.currency ?? "unknown"}`,
            name: "\u8D26\u6237\u4F59\u989D",
            kind: "balance",
            remaining: typeof balance.total_balance === "string" || typeof balance.total_balance === "number" ? balance.total_balance : null,
            limit: null,
            unit: balance.currency ?? null,
            resetAt: null,
            updatedAt: refreshedAt
          }))
        },
        details: balances.map((balance) => ({
          currency: balance.currency ?? null,
          totalBalance: balance.total_balance ?? null,
          grantedBalance: balance.granted_balance ?? null,
          toppedUpBalance: balance.topped_up_balance ?? null
        }))
      };
    }
  };
}
function openRouterCreditsModule() {
  return {
    id: "openrouter-credits",
    supports: ["openrouter"],
    async fetch({ providerId, profile, apiKey, signal }) {
      const body = await readJson2(await fetch(endpoint(baseUrlFor(providerId, profile), "credits"), {
        method: "GET",
        headers: bearerHeaders(apiKey),
        signal
      }));
      const data = body.data ?? body;
      const total = typeof data.total_credits === "number" ? data.total_credits : null;
      const used = typeof data.total_usage === "number" ? data.total_usage : null;
      const refreshedAt = updatedAt();
      return {
        status: "ok",
        source: "OpenRouter /api/v1/credits",
        updatedAt: refreshedAt,
        quota: {
          windows: [{
            id: "credits",
            name: "\u5269\u4F59 credits",
            kind: "balance",
            remaining: total !== null && used !== null ? total - used : null,
            limit: total,
            unit: "USD",
            resetAt: null,
            updatedAt: refreshedAt
          }]
        },
        details: { totalCredits: total, totalUsage: used }
      };
    }
  };
}
function unsupportedModule(providerIds, message, helpUrl = null) {
  return {
    id: `unsupported-${providerIds.join("-")}`,
    supports: providerIds,
    async fetch({ providerId }) {
      return {
        status: "unsupported",
        source: "provider official API",
        providerId,
        message,
        ...helpUrl ? { helpUrl } : {},
        updatedAt: updatedAt()
      };
    }
  };
}
var MODULES = [
  deepseekBalanceModule(),
  openRouterCreditsModule(),
  unsupportedModule(
    ["opencode", "opencode-go"],
    "OpenCode \u5B98\u65B9\u76EE\u524D\u516C\u5F00\u6A21\u578B\u76EE\u5F55\u548C\u63A7\u5236\u53F0\u7528\u91CF\uFF0C\u6CA1\u6709\u516C\u5F00\u7ED9 API Key \u8C03\u7528\u7684\u5B9E\u65F6\u4F59\u989D/\u989D\u5EA6\u63A5\u53E3\u3002",
    "https://opencode.ai/zen"
  )
];
var modulesByProvider = /* @__PURE__ */ new Map();
for (const module of MODULES) {
  for (const providerId of module.supports) modulesByProvider.set(providerId, module);
}
var genericUnsupported = unsupportedModule([], "\u8BE5 provider \u5F53\u524D\u6CA1\u6709\u53EF\u9A8C\u8BC1\u7684\u5B98\u65B9\u4F59\u989D/\u989D\u5EA6\u63A5\u53E3\uFF1B\u4E0D\u4F1A\u7528\u8BF7\u6C42\u6B21\u6570\u6216\u56FA\u5B9A\u767E\u5206\u6BD4\u66FF\u4EE3\u3002", null);
function usageModuleFor(providerId) {
  return modulesByProvider.get(providerId) ?? genericUnsupported;
}

// packages/dsh-plugin/src/native-key-pool-host.mjs
var POLICIES = /* @__PURE__ */ new Set(["manual", "round_robin", "failover"]);
var PATCH_MARK = Symbol("dockyard-native-key-pool");
var VISIBLE_STREAM_CHUNKS = /* @__PURE__ */ new Set(["text-delta", "reasoning-delta", "tool-call-delta"]);
function retryableStreamError(error) {
  if (!error || typeof error !== "object") return false;
  const statuses = [error.status, error.upstreamStatus, error.upstreamCode].map((value) => Number(value)).filter((value) => Number.isFinite(value));
  return Boolean(
    error.rateLimited || error.quotaExhausted || error.authExpired || error.authForbidden || statuses.some((status) => [401, 403, 429].includes(status))
  );
}
var NON_RETRYABLE_FAILURE_STATUSES = /* @__PURE__ */ new Set([400, 404, 405, 413, 422]);
var NON_RETRYABLE_FAILURE_CODES = /INVALID_ARGUMENT|BAD_REQUEST|UNSUPPORTED|NOT_FOUND|CONTEXT_LENGTH|PAYLOAD/i;
function nonRetryableStreamFailure(failure) {
  if (!failure || typeof failure !== "object") return false;
  const statuses = [failure.status, failure.upstreamStatus].map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (statuses.some((status) => NON_RETRYABLE_FAILURE_STATUSES.has(status))) return true;
  const codes = [failure.code, failure.upstreamCode].filter((value) => typeof value === "string");
  return codes.some((code) => NON_RETRYABLE_FAILURE_CODES.test(code));
}
function text2(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function applyContextWindowOverride(request, contextWindow) {
  if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0) return request;
  const next = {
    ...request,
    modelContext: {
      ...request?.modelContext ?? {},
      contextWindow
    }
  };
  if (isAgentLoopRequest(request)) markAgentLoopRequest(next);
  return next;
}
function applyModelContextWindow(model, contextWindow) {
  if (!Number.isSafeInteger(contextWindow) || contextWindow <= 0 || !model || typeof model !== "object") return model;
  return {
    ...model,
    context: {
      ...model.context ?? {},
      contextWindow
    },
    // dsh-llm-pi-ai keeps its internal resolved model in this flat shape.
    // Preserve it as well so its stream-side overflow classification uses the
    // same effective capacity as the durable DSH request/context event.
    ...Number.isInteger(model.contextWindow) ? { contextWindow } : {}
  };
}
function applyNativeProviderModelCompat(providerId, model) {
  if (!model || typeof model !== "object") return model;
  if (providerId === "openrouter") {
    return {
      ...model,
      thinkingLevelMap: {
        ...model.thinkingLevelMap ?? {},
        off: null
      },
      headers: {
        "HTTP-Referer": "https://opencode.ai",
        "X-Title": "OpenCode",
        ...model.headers ?? {}
      }
    };
  }
  return model;
}
async function* iterateWithContext(storage, state, next) {
  const output = await storage.run(state, () => next());
  const iterator = await storage.run(state, () => {
    if (output?.[Symbol.asyncIterator]) return output[Symbol.asyncIterator]();
    if (output?.[Symbol.iterator]) return output[Symbol.iterator]();
    return null;
  });
  if (!iterator) return;
  try {
    while (true) {
      const result = await storage.run(state, () => iterator.next());
      if (result.done) return;
      yield result.value;
    }
  } finally {
    await storage.run(state, () => iterator.return?.());
  }
}
function pathValue(source, path2 = []) {
  let current = source;
  for (const segment of path2) {
    if (!current || typeof current !== "object") return void 0;
    current = current[segment];
  }
  return current;
}
function cleanRecord(raw) {
  const keys = Array.isArray(raw?.keys) ? raw.keys.filter((entry) => text2(entry?.ref)).map((entry) => ({
    ref: text2(entry.ref),
    label: text2(entry.label) ?? text2(entry.ref),
    createdAt: text2(entry.createdAt)
  })) : [];
  return {
    policy: POLICIES.has(raw?.policy) ? raw.policy : "manual",
    keys
  };
}
function publicCredential(info) {
  if (!info || typeof info !== "object") return { configured: false };
  return {
    configured: info.configured === true,
    ...typeof info.source === "string" ? { source: info.source } : {},
    ...typeof info.writable === "boolean" ? { writable: info.writable } : {}
  };
}
function failureMessage(error) {
  return error instanceof Error ? error.message : String(error ?? "\u672A\u77E5\u9519\u8BEF");
}
function nativeProfile(ctx, providerId) {
  const hasGetter = typeof ctx?.get === "function";
  const llm = hasGetter ? ctx.get("llm") : ctx.llm;
  const settings = hasGetter ? ctx.get("settings") : ctx.settings;
  const entry = llm?.listConfigurableProviders?.().find((candidate2) => candidate2.provider === providerId) ?? null;
  const profile = entry && settings?.get ? pathValue(settings.get(entry.settingsNs), entry.settingsPath) : null;
  if (!entry || !profile || typeof profile !== "object") return { entry, profile: null };
  const native = entry.settingsNs === "llm-pi-ai" || text2(profile.apiKeyEnv) !== null;
  return { entry, profile: native ? profile : null };
}
var NativeKeyPoolHost = class {
  ctx;
  credentials;
  settings;
  llm;
  logger;
  stateStore;
  contextWindowOverrides;
  records = /* @__PURE__ */ new Map();
  cursors = /* @__PURE__ */ new Map();
  #requestContext = new AsyncLocalStorage();
  #contextOverrideRequests = /* @__PURE__ */ new WeakSet();
  patches = [];
  offAdapters = null;
  offStreams = null;
  readyPromise;
  constructor(ctx, { logger = null, stateStore = null, contextWindowOverrides = null } = {}) {
    this.ctx = ctx;
    this.credentials = null;
    this.settings = null;
    this.llm = null;
    this.logger = logger ?? console;
    this.contextWindowOverrides = contextWindowOverrides;
    this.stateStore = stateStore ?? new JsonStateStore({
      filePath: join16(defaultDockyardHome(), "native-key-pools.json")
    });
    this.readyPromise = this.loadState();
  }
  resolveServices() {
    const get = (name2) => {
      try {
        if (typeof this.ctx?.get === "function") return this.ctx.get(name2);
        return this.ctx?.[name2];
      } catch {
        return null;
      }
    };
    this.credentials = get("credentials");
    this.settings = get("settings");
    this.llm = get("llm");
  }
  async loadState() {
    try {
      const state = await this.stateStore.load();
      const providers = state?.nativeKeyPools;
      if (providers && typeof providers === "object") {
        for (const [providerId, record] of Object.entries(providers)) {
          this.records.set(providerId, cleanRecord(record));
        }
      }
    } catch (error) {
      this.logger.warn?.(`native Key \u6C60\u72B6\u6001\u8BFB\u53D6\u5931\u8D25\uFF1A${failureMessage(error)}`);
    }
    return this;
  }
  async saveState() {
    const nativeKeyPools = Object.fromEntries([...this.records].map(([providerId, record]) => [
      providerId,
      cleanRecord(record)
    ]));
    await this.stateStore.save({ nativeKeyPools });
  }
  async start() {
    await this.readyPromise;
    await this.contextWindowOverrides?.ready?.();
    this.resolveServices();
    this.patchAdapters();
    if (typeof this.ctx.on === "function") {
      this.offAdapters = this.ctx.on("llm/adapters-updated", () => this.patchAdapters());
      this.offStreams = this.ctx.on("llm/stream", (options, next) => this.stream(options, next));
    }
    this.patchAdapters();
    return this;
  }
  dispose() {
    this.offAdapters?.();
    this.offStreams?.();
    this.offAdapters = null;
    this.offStreams = null;
    for (const patch of this.patches.splice(0)) {
      if (patch.config?.resolveApiKey?.[PATCH_MARK] === patch.wrapper) {
        patch.config.resolveApiKey = patch.original;
      }
      if (patch.target?.[patch.method]?.[PATCH_MARK] === patch.wrapper) {
        patch.target[patch.method] = patch.original;
      }
    }
  }
  contextWindowForModel(providerId, modelId) {
    if (!text2(providerId) || !text2(modelId) || !this.contextWindowOverrides?.hasAny?.(providerId, modelId)) return null;
    const profile = nativeProfile(this.ctx, providerId).profile;
    const keyRef = text2(profile?.apiKeyEnv);
    return this.contextWindowOverrides.resolve(providerId, modelId, {
      ...keyRef ? { keyRef } : {}
    });
  }
  patchAdapterMethod(adapter, method, transform) {
    const original = adapter?.[method];
    if (typeof original !== "function" || original?.[PATCH_MARK]) return;
    const wrapper = transform(original);
    Object.defineProperty(wrapper, PATCH_MARK, { value: wrapper });
    adapter[method] = wrapper;
    this.patches.push({ target: adapter, method, original, wrapper });
  }
  patchAdapters() {
    const adapters = this.llm?.adapters;
    if (!adapters || typeof adapters.values !== "function") return;
    const thisHost = this;
    for (const registration of adapters.values()) {
      const adapter = registration?.adapter;
      const config = adapter?.config;
      const original = config?.resolveApiKey;
      if (!config || typeof original !== "function" || original?.[PATCH_MARK]) continue;
      const directConnectionResolver = typeof config.options === "function" && typeof config.resolveUserId === "function";
      const wrapper = directConnectionResolver ? async (connection) => this.resolveDirectApiKey(connection, original) : async (providerId, profile) => this.resolveApiKey(providerId, profile, original);
      Object.defineProperty(wrapper, PATCH_MARK, { value: wrapper });
      config.resolveApiKey = wrapper;
      this.patches.push({ config, original, wrapper });
      this.patchAdapterMethod(adapter, "modelOf", (modelOf) => function(...args) {
        const model = applyNativeProviderModelCompat(args[1], modelOf.apply(this, args));
        const contextWindow = thisHost.contextWindowForModel(args[1], args[2]);
        return applyModelContextWindow(model, contextWindow);
      });
      this.patchAdapterMethod(adapter, "resolveModel", (resolveModel) => async function(...args) {
        const model = applyNativeProviderModelCompat(args[0], await resolveModel.apply(this, args));
        const contextWindow = thisHost.contextWindowForModel(args[0], args[1]);
        return applyModelContextWindow(model, contextWindow);
      });
      this.patchAdapterMethod(adapter, "prepareCall", (prepareCall) => async function(...args) {
        const prepared = await prepareCall.apply(this, args);
        if (!prepared || typeof prepared !== "object") return prepared;
        const compatModel = applyNativeProviderModelCompat(args[0], prepared.model);
        const contextWindow = thisHost.contextWindowForModel(args[0], args[1]);
        return {
          ...prepared,
          model: applyModelContextWindow(compatModel, contextWindow)
        };
      });
    }
  }
  record(providerId) {
    let record = this.records.get(providerId);
    if (!record) {
      record = cleanRecord({});
      this.records.set(providerId, record);
    }
    return record;
  }
  async syncProvider(providerId, profileHint = null) {
    await this.readyPromise;
    const profile = profileHint ?? nativeProfile(this.ctx, providerId).profile;
    const activeRef = text2(profile?.apiKeyEnv);
    if (!activeRef) return { profile, activeRef: null, record: this.record(providerId) };
    const record = this.record(providerId);
    if (!record.keys.some((entry) => entry.ref === activeRef)) {
      record.keys.push({ ref: activeRef, label: "\u5F53\u524D DSH Key", createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      await this.saveState();
    }
    return { profile, activeRef, record };
  }
  async register(providerId, ref, label = "") {
    const keyRef = text2(ref);
    if (!text2(providerId) || !keyRef) throw new Error("provider \u548C Key \u5F15\u7528\u4E0D\u80FD\u4E3A\u7A7A");
    const { record } = await this.syncProvider(providerId);
    const current = record.keys.find((entry) => entry.ref === keyRef);
    if (current) {
      current.label = text2(label) ?? current.label;
    } else {
      record.keys.push({ ref: keyRef, label: text2(label) ?? `Key ${record.keys.length + 1}`, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
    await this.saveState();
    return this.status(providerId);
  }
  async unregister(providerId, ref) {
    const record = this.record(providerId);
    record.keys = record.keys.filter((entry) => entry.ref !== ref);
    await this.saveState();
    return this.status(providerId);
  }
  async setPolicy(providerId, policy) {
    if (!POLICIES.has(policy)) throw new Error(`\u4E0D\u652F\u6301\u7684 Key \u7B56\u7565\uFF1A${policy}`);
    const record = this.record(providerId);
    record.policy = policy;
    this.cursors.delete(providerId);
    await this.saveState();
    return this.status(providerId);
  }
  async credentialInfo(ref) {
    try {
      if (typeof this.credentials?.describe !== "function") return { configured: false };
      return publicCredential(await this.credentials.describe(ref));
    } catch (error) {
      return { configured: false, error: failureMessage(error) };
    }
  }
  async configuredKeys(record) {
    const rows = [];
    for (const entry of record.keys) {
      const credential = await this.credentialInfo(entry.ref);
      rows.push({ ...entry, configured: credential.configured, credential });
    }
    return rows;
  }
  async status(providerId) {
    const synced = await this.syncProvider(providerId);
    const rows = await this.configuredKeys(synced.record);
    return {
      providerId,
      policy: synced.record.policy,
      activeRef: synced.activeRef,
      runtimeMode: this.patches.length > 0 ? "request-key-pool" : "native-single-key",
      keys: rows.map((entry) => ({ ...entry, active: entry.ref === synced.activeRef })),
      quota: null,
      usage: null
    };
  }
  async pickKey(providerId, record, activeRef, { excluded = [] } = {}) {
    const candidates = [];
    for (const entry of record.keys) {
      const credential = await this.credentialInfo(entry.ref);
      if (credential.configured) candidates.push(entry);
    }
    if (candidates.length === 0) return null;
    const excludedSet = new Set(excluded);
    const available = candidates.filter((entry) => !excludedSet.has(entry.ref));
    const pool = available.length > 0 ? available : candidates;
    const policy = record.policy;
    if (policy === "manual") {
      return pool.find((entry) => entry.ref === activeRef) ?? pool[0];
    }
    if (policy === "failover") {
      return pool.find((entry) => entry.ref === activeRef) ?? pool[0];
    }
    const cursor = this.cursors.get(providerId) ?? 0;
    const chosen = pool[cursor % pool.length];
    this.cursors.set(providerId, (cursor + 1) % pool.length);
    return chosen;
  }
  async prepareContextWindow(options, requestState) {
    const providerId = text2(options?.provider);
    const modelId = text2(options?.model);
    if (!providerId || !modelId || !this.contextWindowOverrides?.hasAny?.(providerId, modelId)) return options;
    const profile = nativeProfile(this.ctx, providerId).profile;
    const synced = await this.syncProvider(providerId, profile);
    let chosen = null;
    if (synced.profile && synced.activeRef && typeof this.credentials?.resolve === "function") {
      chosen = await this.pickKey(providerId, synced.record, synced.activeRef, {
        excluded: [...requestState?.excluded ?? []]
      });
      if (chosen) requestState.preselectedKeyRef = chosen.ref;
    }
    const contextWindow = this.contextWindowOverrides.resolve(providerId, modelId, {
      ...chosen?.ref ? { keyRef: chosen.ref } : {}
    });
    return applyContextWindowOverride(options, contextWindow);
  }
  async *streamWithContextWindow(options, next, requestState) {
    requestState.preselectedKeyRef = null;
    const prepared = await this.prepareContextWindow(options, requestState);
    if (prepared === options || typeof this.llm?.stream !== "function") {
      yield* next();
      return;
    }
    this.#contextOverrideRequests.add(prepared);
    try {
      yield* iterateWithContext(this.#requestContext, requestState, () => this.llm.stream(prepared));
    } finally {
      this.#contextOverrideRequests.delete(prepared);
    }
  }
  async resolveApiKey(providerId, profile, original) {
    const synced = await this.syncProvider(providerId, profile);
    if (!synced.profile || !synced.activeRef || synced.record.policy === "manual" || typeof this.credentials?.resolve !== "function") {
      return original(providerId, profile);
    }
    const requestState = this.#requestContext.getStore();
    const excluded = [...requestState?.excluded ?? []];
    const forced = text2(requestState?.preselectedKeyRef);
    const chosen = forced ? synced.record.keys.find((entry) => entry.ref === forced) ?? await this.pickKey(providerId, synced.record, synced.activeRef, { excluded }) : await this.pickKey(providerId, synced.record, synced.activeRef, { excluded });
    if (!chosen) return original(providerId, profile);
    if (synced.record.policy === "failover" && requestState) requestState.lastResolvedKey = chosen.ref;
    const resolved = await this.credentials.resolve(chosen.ref);
    const value = text2(resolved?.value);
    if (value) return value;
    return original(providerId, profile);
  }
  async resolveDirectApiKey(connection, original) {
    const providerId = "deepseek-official";
    const synced = await this.syncProvider(providerId, connection);
    if (!synced.profile || !synced.activeRef || synced.record.policy === "manual" || typeof this.credentials?.resolve !== "function") {
      return original(connection);
    }
    const requestState = this.#requestContext.getStore();
    const excluded = [...requestState?.excluded ?? []];
    const forced = text2(requestState?.preselectedKeyRef);
    const chosen = forced ? synced.record.keys.find((entry) => entry.ref === forced) ?? await this.pickKey(providerId, synced.record, synced.activeRef, { excluded }) : await this.pickKey(providerId, synced.record, synced.activeRef, { excluded });
    if (!chosen) return original(connection);
    if (synced.record.policy === "failover" && requestState) requestState.lastResolvedKey = chosen.ref;
    const resolved = await this.credentials.resolve(chosen.ref);
    const value = text2(resolved?.value);
    if (value) return value;
    return original(connection);
  }
  shouldRetry(providerId) {
    const record = this.records.get(providerId);
    return record?.policy === "failover" && record.keys.length > 1;
  }
  async *stream(options, next) {
    if (typeof next !== "function") return;
    if (this.#contextOverrideRequests.delete(options)) {
      yield* next();
      return;
    }
    const requestState = { excluded: /* @__PURE__ */ new Set(), lastResolvedKey: null };
    if (!this.shouldRetry(options?.provider)) {
      yield* iterateWithContext(this.#requestContext, requestState, async () => {
        return this.streamWithContextWindow(options, next, requestState);
      });
      return;
    }
    const configured = await this.configuredKeys(this.records.get(options.provider));
    const attempts = Math.max(1, configured.filter((entry) => entry.configured).length);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0 && requestState.lastResolvedKey) {
        requestState.excluded.add(requestState.lastResolvedKey);
      }
      const buffered = [];
      let emitted = false;
      let retryable = false;
      try {
        const output = iterateWithContext(this.#requestContext, requestState, async () => {
          return this.streamWithContextWindow(options, next, requestState);
        });
        for await (const chunk of output) {
          if (VISIBLE_STREAM_CHUNKS.has(chunk?.type)) emitted = true;
          if (!emitted) buffered.push(chunk);
          else if (buffered.length > 0) {
            yield* buffered.splice(0);
            yield chunk;
          } else yield chunk;
          if (chunk?.type === "finish" && chunk.reason?.kind === "error") {
            retryable = !emitted && !nonRetryableStreamFailure(chunk.reason.failure);
            if (retryable && attempt + 1 < attempts) break;
          }
        }
      } catch (error) {
        retryable = !emitted && retryableStreamError(error);
        if (!retryable || attempt + 1 >= attempts) throw error;
      }
      if (retryable && !emitted && attempt + 1 < attempts) continue;
      if (buffered.length > 0) yield* buffered;
      return;
    }
  }
  async refreshUsage(providerId, signal) {
    const synced = await this.syncProvider(providerId);
    const rows = await this.configuredKeys(synced.record);
    const module = usageModuleFor(providerId);
    const nextRows = [];
    for (const row of rows) {
      let usage;
      if (!row.configured || typeof this.credentials?.resolve !== "function") {
        usage = { status: "unconfigured", message: "\u8BE5 Key \u5C1A\u672A\u914D\u7F6E" };
      } else {
        try {
          const resolved = await this.credentials.resolve(row.ref);
          const apiKey = text2(resolved?.value);
          usage = apiKey ? await module.fetch({ providerId, profile: synced.profile, apiKey, signal }) : { status: "unconfigured", message: "\u8BE5 Key \u5C1A\u672A\u914D\u7F6E" };
        } catch (error) {
          usage = { status: "error", message: failureMessage(error), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
        }
      }
      nextRows.push({ ...row, active: row.ref === synced.activeRef, usage, quota: usage?.quota ?? null });
    }
    const active = nextRows.find((entry) => entry.active) ?? nextRows[0] ?? null;
    return {
      providerId,
      policy: synced.record.policy,
      activeRef: synced.activeRef,
      runtimeMode: this.patches.length > 0 ? "request-key-pool" : "native-single-key",
      keys: nextRows,
      usage: active?.usage ?? { status: "unsupported", message: "provider \u5C1A\u672A\u8FD4\u56DE\u989D\u5EA6\u6570\u636E" },
      quota: active?.quota ?? null,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
};

// packages/dsh-plugin/src/vpn-ssrf-patch.mjs
var import_ipaddr = __toESM(require_ipaddr(), 1);
import { createRequire as createRequire2 } from "node:module";
import { dirname as dirname9, join as join17 } from "node:path";
var isPatched = false;
function patchFakeIpVpnSupport() {
  if (isPatched) return true;
  const patchedPrototypes = /* @__PURE__ */ new Set();
  const applyProtoPatch = (proto) => {
    if (!proto?.range || patchedPrototypes.has(proto)) return;
    const origRange = proto.range;
    proto.range = function() {
      if (this.octets?.[0] === 198 && (this.octets?.[1] === 18 || this.octets?.[1] === 19)) {
        return "unicast";
      }
      return origRange.call(this);
    };
    patchedPrototypes.add(proto);
  };
  if (import_ipaddr.default?.IPv4?.prototype) {
    applyProtoPatch(import_ipaddr.default.IPv4.prototype);
  }
  const req = createRequire2(import.meta.url);
  const candidates = [
    "ipaddr.js",
    "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/ipaddr.js"
  ];
  if (typeof process?.execPath === "string") {
    try {
      candidates.push(join17(dirname9(dirname9(process.execPath)), "Resources/app.asar/dsh/node_modules/ipaddr.js"));
    } catch {
    }
  }
  for (const cand of candidates) {
    try {
      const mod = req(cand);
      if (mod?.IPv4?.prototype) applyProtoPatch(mod.IPv4.prototype);
    } catch {
    }
  }
  if (typeof req?.cache === "object" && req.cache) {
    for (const [key, val] of Object.entries(req.cache)) {
      if (key.includes("ipaddr") && val?.exports?.IPv4?.prototype) {
        applyProtoPatch(val.exports.IPv4.prototype);
      }
    }
  }
  isPatched = true;
  return true;
}

// packages/dsh-plugin/src/index.mjs
patchFakeIpVpnSupport();
var name = "dockyard-dsh";
var inject = ["llm", "commands", "credentials", "settings", "webServer"];
function contextLogger(ctx, name2) {
  try {
    const factory = typeof ctx?.get === "function" ? ctx.get("logger") : null;
    if (typeof factory === "function") return factory(name2);
  } catch {
  }
  return console;
}
var RELIST_INTERVAL_MS = 5 * 60 * 1e3;
function apply(ctx, config = {}) {
  patchFakeIpVpnSupport();
  const runtimeOptions = { ...config.runtimeOptions ?? {} };
  let catalogWarmers = [];
  if (!config.runtime && !runtimeOptions.providers) {
    const antigravityOptions = {
      ...runtimeOptions.antigravity ?? {}
    };
    antigravityOptions.projectResolver = antigravityOptions.projectResolver ?? createAntigravityProjectResolver(antigravityOptions);
    antigravityOptions.quotaReader = runtimeOptions.antigravity?.quotaReader ?? createAntigravityNativeQuotaReader(antigravityOptions);
    runtimeOptions.antigravity = antigravityOptions;
    const modelRegistryLoader = runtimeOptions.modelRegistryLoader ?? createPiAiModelRegistryLoader();
    const antigravityCatalogLoader = runtimeOptions.catalogLoaders?.antigravity ?? createAntigravityCatalogLoader({ ...antigravityOptions, registryLoader: modelRegistryLoader });
    runtimeOptions.requestExecutors = {
      ...runtimeOptions.requestExecutors ?? {},
      "openai-codex": runtimeOptions.requestExecutors?.["openai-codex"] ?? createCodexDshRequestExecutor(),
      antigravity: runtimeOptions.requestExecutors?.antigravity ?? createAntigravityNativeExecutor({
        ...antigravityOptions
      }),
      claude: runtimeOptions.requestExecutors?.claude ?? createClaudeNativeExecutor(runtimeOptions.claude ?? {}),
      cursor: runtimeOptions.requestExecutors?.cursor ?? createCursorNativeExecutor(runtimeOptions.cursor ?? {}),
      grok: runtimeOptions.requestExecutors?.grok ?? createGrokNativeExecutor(runtimeOptions.grok ?? {}),
      commandcode: runtimeOptions.requestExecutors?.commandcode ?? createCommandCodeNativeExecutor(runtimeOptions.commandcode ?? {}),
      hermes: runtimeOptions.requestExecutors?.hermes ?? createHermesNativeExecutor(runtimeOptions.hermes ?? {}),
      "openrouter-free": runtimeOptions.requestExecutors?.["openrouter-free"] ?? createOpenRouterFreeNativeExecutor(runtimeOptions["openrouter-free"] ?? runtimeOptions.openrouterFree ?? {}),
      agentrouter: runtimeOptions.requestExecutors?.agentrouter ?? createAgentRouterNativeExecutor(runtimeOptions.agentrouter ?? {})
    };
    runtimeOptions.catalogLoaders = {
      ...runtimeOptions.catalogLoaders ?? {},
      "openai-codex": runtimeOptions.catalogLoaders?.["openai-codex"] ?? createCodexDshCatalogLoader(runtimeOptions.codex ?? {}),
      antigravity: antigravityCatalogLoader,
      grok: runtimeOptions.catalogLoaders?.grok ?? createGrokCatalogLoader({
        ...runtimeOptions.grok ?? {},
        commandRunner: runtimeOptions.grok?.commandRunner ?? runCliCommand,
        registryLoader: modelRegistryLoader
      }),
      claude: runtimeOptions.catalogLoaders?.claude ?? createClaudeCatalogLoader({ registryLoader: modelRegistryLoader }),
      cursor: runtimeOptions.catalogLoaders?.cursor ?? createCursorCatalogLoader(runtimeOptions.cursor ?? {}),
      commandcode: runtimeOptions.catalogLoaders?.commandcode ?? createCommandCodeCatalogLoader(runtimeOptions.commandcode ?? {}),
      hermes: runtimeOptions.catalogLoaders?.hermes ?? createHermesCatalogLoader(runtimeOptions.hermes ?? {}),
      "openrouter-free": runtimeOptions.catalogLoaders?.["openrouter-free"] ?? createOpenRouterFreeCatalogLoader(runtimeOptions["openrouter-free"] ?? runtimeOptions.openrouterFree ?? {}),
      agentrouter: runtimeOptions.catalogLoaders?.agentrouter ?? createAgentRouterCatalogLoader(runtimeOptions.agentrouter ?? {})
    };
    runtimeOptions.providers = createDefaultProviderEntries(runtimeOptions);
    catalogWarmers = Object.entries(runtimeOptions.catalogLoaders).filter(([, loader]) => typeof loader === "function");
  }
  const runtime = config.runtime ?? new DockyardRuntime(runtimeOptions);
  if (catalogWarmers.length > 0 && typeof runtime.init === "function") {
    void (async () => {
      await runtime.init();
      const providers = runtime.snapshot?.().providers ?? [];
      const connected = new Set(
        providers.filter((provider) => Array.isArray(provider.accounts) && provider.accounts.length > 0).map((provider) => provider.providerId)
      );
      const accountsByProvider = new Map(providers.map((provider) => [provider.providerId, provider.accounts ?? []]));
      await Promise.all(catalogWarmers.filter(([providerId]) => connected.has(providerId) || runtime.hasProviderCapability?.(providerId, PROVIDER_BEHAVIOR_CAPABILITIES.CATALOG_WARMUP)).map(([providerId, loader]) => loader({ accounts: accountsByProvider.get(providerId) ?? [], secretStore: runtime.secretStore }).catch(() => null)));
      const relistTimer = setInterval(() => {
        Promise.resolve(runtime.relistExpiredAccounts?.() ?? null).catch(() => {
        });
      }, RELIST_INTERVAL_MS);
      relistTimer.unref?.();
      if (typeof ctx.on === "function") ctx.on("dispose", () => clearInterval(relistTimer));
    })().catch((error) => {
      contextLogger(ctx, "dockyard-dsh").warn?.(error);
    });
  }
  const adapter = createDockyardLlmAdapter({
    runtime,
    providerIds: config.providers ?? runtime.listProviderIds(),
    // Only announced when a catalog's model set really changed, so the picker
    // is not re-listed on every poll.
    onCatalogChanged: () => {
      try {
        ctx.emit("llm/adapters-updated");
        ctx.llm?.emitAdaptersUpdated?.();
      } catch {
      }
    },
    catalogCachePath: config.catalogCachePath ?? defaultCatalogCachePath(),
    // Resolve this only when a request is actually streamed. The attachment
    // service is installed by DSH's base profile after plugin composition;
    // reading it while the plugin graph is being composed breaks boot.
    attachmentsResolver: () => {
      try {
        return typeof ctx.get === "function" ? ctx.get("attachments") : ctx.attachments;
      } catch {
        return void 0;
      }
    }
  });
  const installAdapter = () => {
    const result = ctx.llm.registerAdapter(adapter.providers(), adapter);
    return typeof result?.dispose === "function" ? result.dispose.bind(result) : typeof result === "function" ? result : null;
  };
  if (typeof ctx.effect === "function") {
    ctx.effect(() => {
      const disposeAdapter = installAdapter();
      return () => {
        try {
          disposeAdapter?.();
        } catch {
        }
      };
    }, "dockyard-dsh: llm adapter");
  } else {
    installAdapter();
  }
  if (typeof runtime.init === "function") {
    const notifyAdaptersUpdated = () => {
      try {
        adapter.invalidateCatalog?.();
        ctx.emit("llm/adapters-updated");
        ctx.llm?.emitAdaptersUpdated?.();
      } catch {
      }
    };
    const service = config.service ?? new DockyardDshService({
      runtime,
      ...config.serviceOptions ?? {},
      logger: config.serviceOptions?.logger ?? contextLogger(ctx, "dockyard-dsh"),
      notifyAdaptersUpdated
    });
    if (typeof ctx.provide === "function") ctx.provide("dockyard", service);
    let nativeKeyPool = config.nativeKeyPool ?? null;
    const install = () => {
      try {
        const credentials = typeof ctx.get === "function" ? ctx.get("credentials") : ctx.credentials;
        if (credentials && typeof runtime.setSecretStore === "function") {
          runtime.setSecretStore(createDockyardCredentialStore(credentials, runtime.secretStore));
        }
      } catch (error) {
        contextLogger(ctx, "dockyard-dsh").warn?.(`DSH Credentials \u63A5\u5165\u5931\u8D25\uFF0C\u5C06\u4FDD\u7559\u539F\u6709\u5B89\u5168\u5B58\u50A8\uFF1A${error.message}`);
      }
      nativeKeyPool ??= new NativeKeyPoolHost(ctx, {
        logger: config.serviceOptions?.logger ?? contextLogger(ctx, "dockyard-dsh"),
        contextWindowOverrides: runtime.contextWindowOverrides
      });
      const nativeKeyPoolReady = nativeKeyPool.start();
      void nativeKeyPoolReady.catch((error) => {
        contextLogger(ctx, "dockyard-dsh").warn?.(error);
      });
      const unregister = ctx.commands?.register?.(createDockyardCommand(service));
      void service.start().catch((error) => {
        contextLogger(ctx, "dockyard-dsh").error?.(error);
      });
      let remoteFiberPromise;
      if (typeof ctx.plugin === "function") {
        remoteFiberPromise = Promise.resolve().then(() => (init_dockyard_remote_host(), dockyard_remote_host_exports)).then(({ DockyardRemoteService: DockyardRemoteService2 }) => ctx.plugin(DockyardRemoteService2, { service, nativeKeyPool })).catch((error) => {
          contextLogger(ctx, "dockyard-dsh").error?.(error);
          return null;
        });
      }
      let unregisterArtifactsRoute;
      try {
        const webServer = ctx.webServer ?? (typeof ctx.get === "function" ? ctx.get("webServer") : null);
        if (webServer && typeof webServer.register === "function") {
          unregisterArtifactsRoute = webServer.register({
            kind: "prefix",
            path: "/artifacts",
            handler: async (req, res) => {
              try {
                const url = new URL(req.url, "http://127.0.0.1");
                const cleanPath = url.pathname.replace(/^\/artifacts\/?/, "");
                if (!cleanPath || cleanPath.includes("..")) {
                  res.writeHead(403);
                  res.end("Forbidden");
                  return;
                }
                const filePath = join18(process.cwd(), "artifacts", cleanPath);
                if (!existsSync7(filePath)) {
                  res.writeHead(404);
                  res.end("Not Found");
                  return;
                }
                const ext = cleanPath.split(".").pop()?.toLowerCase();
                const mimeTypes = {
                  png: "image/png",
                  jpg: "image/jpeg",
                  jpeg: "image/jpeg",
                  webp: "image/webp",
                  gif: "image/gif",
                  svg: "image/svg+xml"
                };
                const contentType = mimeTypes[ext] ?? "application/octet-stream";
                const content = readFileSync6(filePath);
                res.writeHead(200, {
                  "Content-Type": contentType,
                  "Content-Length": content.length,
                  "Cache-Control": "public, max-age=3600"
                });
                res.end(content);
              } catch (err) {
                res.writeHead(500);
                res.end("Internal Server Error");
              }
            }
          });
        }
      } catch (error) {
        contextLogger(ctx, "dockyard-dsh").warn?.(`Failed to register /artifacts/ route: ${error.message}`);
      }
      return async () => {
        try {
          unregisterArtifactsRoute?.();
        } catch {
        }
        try {
          await remoteFiberPromise?.catch?.(() => null);
        } catch {
        }
        try {
          await nativeKeyPoolReady.catch?.(() => null);
        } catch {
        }
        try {
          nativeKeyPool?.dispose?.();
        } catch {
        }
        try {
          unregister?.();
        } catch {
        }
        try {
          await service.dispose();
        } catch {
        }
      };
    };
    if (typeof ctx.effect === "function") {
      ctx.effect(install, "dockyard-dsh: service and commands");
    } else {
      install();
    }
  }
}
export {
  DockyardDshService,
  DockyardRuntime,
  NativeKeyPoolHost,
  apply,
  createDockyardCommand,
  createDockyardLlmAdapter,
  inject,
  name
};
