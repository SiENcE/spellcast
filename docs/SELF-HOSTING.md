# Self-hosting SpellCast (broker, TURN, headers)

SpellCast messages travel **peer-to-peer** over WebRTC and are encrypted in
transit (DTLS). But two pieces of infrastructure are still involved, and by
default they are run by third parties:

1. **The signalling broker** (PeerJS). Peers need a broker to find each other and
   exchange connection offers. SpellCast defaults to the **PeerJS public cloud
   broker**. The broker never sees your message *content*, but it does see **peer
   IDs and who is connecting to whom** — i.e. metadata.
2. **STUN/TURN servers** for NAT traversal. SpellCast ships with public **STUN**
   only. Some peers (behind symmetric NAT) cannot connect with STUN alone and
   need a **TURN relay**.

To keep that metadata off third-party infrastructure, run your own.

## Run your own PeerServer (broker)

```bash
npm install -g peer
peerjs --port 9000 --key spellcast --path /myapp
```

(or use the `peer` Docker image / a hosted PeerServer behind TLS).

Then point SpellCast at it by editing the config block near the top of
[`src/peer-manager.js`](../src/peer-manager.js):

```js
const CUSTOM_PEER_SERVER = {
  host: 'peer.example.com',
  port: 443,
  path: '/myapp',
  key: 'spellcast',
  secure: true,        // wss/https
};
```

Leave it `null` to use the public cloud broker (the default). When set, every
connection path in `peer-manager.js` (new credentials, login, and the fallback
paths) honours it automatically.

## Add a TURN relay

Public STUN only gets most peers connected. For the rest, add authenticated
TURN (e.g. [coturn](https://github.com/coturn/coturn)) in the same config block:

```js
const CUSTOM_TURN_SERVERS = [
  { urls: 'turn:turn.example.com:3478', username: 'user', credential: 'pass' },
];
```

These are appended to the existing STUN servers.

## Deploy-time HTTP headers

Two protections can't be expressed in the in-page `<meta>` CSP and should be set
as real response headers by your web server / CDN:

```
Content-Security-Policy: frame-ancestors 'none';
X-Frame-Options: DENY
Referrer-Policy: no-referrer
```

`frame-ancestors` / `X-Frame-Options` prevent the app from being framed
(clickjacking). The page already ships an in-page CSP for everything that *is*
expressible via `<meta>` (script/style/img/connect sources, etc.) — see
`src/index.html`.

## Serve over HTTPS (or localhost)

The cryptographic identity (signing keys, backup encryption) uses the Web Crypto
API, which requires a **secure context**. `https://` and `http://localhost` work;
plain `http://` on a LAN IP does not — identities there fall back to unsigned.
