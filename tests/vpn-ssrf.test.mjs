import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ipaddr = (() => {
  try {
    return require("ipaddr.js");
  } catch {
    return require("../packages/dsh-plugin/node_modules/ipaddr.js");
  }
})();
import { patchFakeIpVpnSupport } from "../packages/dsh-plugin/src/vpn-ssrf-patch.mjs";

test("patchFakeIpVpnSupport enables Fake-IP 198.18.0.0/15 for VPN while preserving private IP blocks", () => {
  assert.equal(patchFakeIpVpnSupport(), true);

  // 1. Fake-IP subnet (198.18.0.0/15 used by Clash, Surge, etc. in TUN mode) must be unicast
  const fakeIp1 = ipaddr.parse("198.18.2.64");
  assert.equal(fakeIp1.range(), "unicast");

  const fakeIp2 = ipaddr.parse("198.19.100.200");
  assert.equal(fakeIp2.range(), "unicast");

  // 2. Private LAN networks must remain strictly private
  assert.equal(ipaddr.parse("10.0.0.1").range(), "private");
  assert.equal(ipaddr.parse("172.16.0.1").range(), "private");
  assert.equal(ipaddr.parse("192.168.1.1").range(), "private");

  // 3. Loopback and multicast must remain strictly protected
  assert.equal(ipaddr.parse("127.0.0.1").range(), "loopback");
  assert.equal(ipaddr.parse("224.0.0.1").range(), "multicast");

  // 4. Normal public IPs must remain unicast
  assert.equal(ipaddr.parse("8.8.8.8").range(), "unicast");
  assert.equal(ipaddr.parse("20.205.243.166").range(), "unicast");
});
