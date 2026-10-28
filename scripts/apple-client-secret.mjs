// Generates the "Secret Key (for OAuth)" that Supabase expects for the Apple provider:
// an ES256 JWT signed with the Sign in with Apple .p8 key. Apple caps its lifetime at
// 6 months, so re-run this and paste the new value into Supabase before it expires.
//
// Usage: node scripts/apple-client-secret.mjs <path-to-AuthKey_XXXX.p8>

import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const TEAM_ID = "Q6XQ828994";
const KEY_ID = "VXZ359CB99";
const CLIENT_ID = "com.journeypilot.ai.signin"; // Services ID
const LIFETIME_SECONDS = 180 * 24 * 3600;

const p8Path = process.argv[2];
if (!p8Path) {
  console.error("Usage: node scripts/apple-client-secret.mjs <path-to-AuthKey.p8>");
  process.exit(1);
}

const b64url = (value) => Buffer.from(value).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
const payload = { iss: TEAM_ID, iat: now, exp: now + LIFETIME_SECONDS, aud: "https://appleid.apple.com", sub: CLIENT_ID };

const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const key = createPrivateKey(readFileSync(p8Path));
const signature = sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");

console.log(`\n${input}.${signature}\n`);
console.log(`Expires on ${new Date((now + LIFETIME_SECONDS) * 1000).toISOString().slice(0, 10)} - regenerate before then.`);
