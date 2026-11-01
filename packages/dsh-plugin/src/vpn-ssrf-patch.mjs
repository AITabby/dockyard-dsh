import ipaddr from "ipaddr.js";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

let isPatched = false;

/**
 * Patch ipaddr.js to treat 198.18.0.0/15 (RFC 2544 benchmark network) as unicast.
 *
 * Why this is necessary:
 * On macOS, VPN / proxy clients (Clash, Clash Verge, Surge, Mihomo, Sing-box, etc.)
 * in TUN mode universally use 198.18.0.0/15 as the Fake-IP subnet. When TUN is active,
 * public hostnames like "github.com" resolve to 198.18.x.x locally.
 *
 * DSH's web_fetch tool uses @deepseek-ai/dsh-web-fetch-http, which calls ipaddr.js
 * to validate that destinations are public. By default, ipaddr.js marks 198.18.0.0/15
 * as "reserved", causing DSH to reject legitimate public websites as "non-public IP address".
 *
 * When web_fetch fails, the DSH agent falls back to heavy autonomous measures (git clone,
 * multi-agent teams, static analysis), taking 5+ minutes instead of 20 seconds.
 *
 * This patch selectively reclassifies 198.18.0.0/15 as "unicast" while preserving
 * strict blocking for true private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
 * 127.0.0.0/8, link-local, multicast, etc.).
 */
export function patchFakeIpVpnSupport() {
  if (isPatched) return true;

  const patchedPrototypes = new Set();
  const applyProtoPatch = (proto) => {
    if (!proto?.range || patchedPrototypes.has(proto)) return;
    const origRange = proto.range;
    proto.range = function () {
      if (this.octets?.[0] === 198 && (this.octets?.[1] === 18 || this.octets?.[1] === 19)) {
        return "unicast";
      }
      return origRange.call(this);
    };
    patchedPrototypes.add(proto);
  };

  // 1. Patch the statically imported ipaddr.js
  if (ipaddr?.IPv4?.prototype) {
    applyProtoPatch(ipaddr.IPv4.prototype);
  }

  // 2. Discover and patch any other ipaddr.js instances in the runtime (e.g. Electron asar)
  const req = createRequire(import.meta.url);
  const candidates = [
    "ipaddr.js",
    "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules/ipaddr.js",
  ];
  if (typeof process?.execPath === "string") {
    try {
      candidates.push(join(dirname(dirname(process.execPath)), "Resources/app.asar/dsh/node_modules/ipaddr.js"));
    } catch {}
  }

  for (const cand of candidates) {
    try {
      const mod = req(cand);
      if (mod?.IPv4?.prototype) applyProtoPatch(mod.IPv4.prototype);
    } catch {}
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
