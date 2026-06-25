# SpellCast — Technical Documentation

Everything under the hood: how to run it locally, the architecture, the
networking model, storage, and the current limitations. For the end-user
overview, see the [main README](../README.md).

SpellCast is built with **vanilla JavaScript** (ES modules, no build step) and a
couple of small libraries:

- **[PeerJS](https://peerjs.com/)** — WebRTC connections for peer-to-peer communication
- **IndexedDB** — persistent storage for messages, media, peers, circles, and identity keys
- **[Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)** — browser-native cryptography for message signing, identities, and circle-message encryption (no crypto library is bundled)
- **[QRCode.js](https://github.com/davidshimjs/qrcodejs)** — generating the QR codes used to share an invite link
- **[jsQR](https://github.com/cozmo/jsQR)** — *vendored locally* (`src/jsQR.min.js`) and lazy-loaded only when the in-app camera scanner is opened, to decode QR codes in browsers without the native [`BarcodeDetector`](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) API

---

## Running locally

1. Clone the repository:
   ```
   git clone https://github.com/SiENcE/spellcast.git
   ```

2. Serve the project with a local web server, then open it in a modern browser
   (Chrome, Firefox, Edge, or Safari).

   > **A local server is required.** SpellCast uses native ES modules
   > (`<script type="module">`), which browsers refuse to load over `file://`.
   > Opening `index.html` directly from the file system will *not* work.

   - On Windows, run the included `start.bat` (serves on port 8080 via Python),
     then browse to `http://localhost:8080/src/`.
   - Or start a server manually from the repository root:
     ```
     # Python
     python -m http.server 8080

     # Node.js
     npx http-server
     ```

3. Open the served page (e.g. `http://localhost:8080/src/`). Edit a file and
   refresh the browser to see changes — there's no build step.

---

## Architecture

The application is structured into a set of manager classes, wired together by
the main controller:

- **SpellCastApp** (`app.js`) — main application controller and bootstrap
- **UserManager** — username, peer id, and the cryptographic identity (loads/mints the keypairs)
- **CryptoIdentity** (`crypto-identity.js`) — all cryptography: keypair generation, message signing/verification, the multi-recipient sealed box for circle posts, the passphrase-encrypted credential backup, and the CSPRNG id helper
- **PeerManager** — peer connections, reconnection, message routing, and per-peer abuse resistance (rate limiting, strikes, blocklist)
- **TweetManager** — message creation, validation, signing/verification, encryption of circle posts, storage, distribution, and reactions
- **MediaManager** — image processing (resize/thumbnail, client-side compression) and storage
- **CircleManager** — local, named groups of peers
- **StorageManager** — persistent storage via IndexedDB (with a localStorage/cookie migration path)
- **UIManager** — DOM rendering and event handling
- **RateLimiter** — reusable sliding-window throttle used for connection, message, and abuse limits

There's also a small `link-preview` helper that turns URLs into clickable links
and renders previews (inline images, YouTube thumbnails, or a favicon/domain
"link card") using only browser-native techniques — no scraping proxy.

---

## How multi-peer networking works

SpellCast forms a mesh network:

1. **Direct connections** — you establish WebRTC connections with peers you know.
2. **Message propagation (multi-hop relay)** — when a message is sent:
   - It's signed with the author's key (see [Security model](#security-model)),
     then stored in local browser storage.
   - It's sent to all directly connected peers.
   - Each peer that receives a *new* message **verifies its signature**, then
     stores it and forwards (relays) it to its own peers, so messages travel
     multiple hops across the network. A relay forwards the *original author's*
     signature unchanged — it cannot alter the message without invalidating it.
   - The system tracks which peers have received each message, so a peer is never
     sent the same message twice — preventing duplicates and relay loops — and a
     hop/fan-out cap bounds how far and wide any single message spreads.
3. **Image propagation** — attached images travel with the message (a thumbnail
   for the feed plus the full-size image) and are stored in each receiving peer's
   IndexedDB, so images survive reloads and propagate across hops like text.
4. **Reconnect sync (pull-based)** — whenever two peers connect, each asks the
   other for anything it's missing (sending the list of message IDs it already
   has). The other peer replies with the rest, images included. This is mutual,
   so a user who just logged in — even on a fresh device or after clearing local
   data — gets the full history and images back from any peer that has them.

There's no central point of failure, and messages can reach their destination
through alternative paths in the network.

### Connecting (QR codes & invite links)

To start talking, two peers need to exchange one peer id. SpellCast makes that
typing-free:

- **QR codes encode a deep link**, not the bare id —
  `<this app's URL>?connect=<peerId>`. Scanning it with a **phone's native
  camera** therefore opens SpellCast (wherever it is served) rather than feeding a
  meaningless string to a search engine. On load, the app reads the `?connect=`
  parameter, strips it from the URL (so a refresh doesn't reconnect), and — once
  you're logged in — offers to connect to that peer.
- **In-app scanner.** The *Connect* tab has a "Scan QR" button that opens the rear
  camera and decodes a peer's QR directly, using the native `BarcodeDetector`
  where available and the vendored `jsQR` decoder otherwise.
- **Invite links.** The profile offers *Share invite link* (via the OS share sheet
  on mobile, using the [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share))
  and *Copy link*, so the same `?connect=` URL can be sent over any messenger. The
  connect field also accepts a pasted invite link or a raw id interchangeably.

These are convenience transports for a public routing id — they carry no secret
(your security comes from the signed identity, not from the id staying private).

### P2P message distribution tracking

The distribution layer tracks which peers hold which messages and which messages
still need to be delivered to which peers:

```javascript
// Simplified message distribution tracking
{
  tweetRecipients: {
    "message-123": ["peer1", "peer3"], // Peers that have this message
    "message-456": ["peer1", "peer2", "peer3"]
  },
  unsentTweets: {
    "peer1": [], // This peer has all messages
    "peer2": ["message-123"], // This peer needs message-123
    "peer3": []
  }
}
```

When a peer connects, the pull-based sync uses the peer's reported list of known
message IDs to decide exactly what to send — which is robust even if local
tracking is stale across sessions.

### Circles (narrow-casting)

Circles are a **local, per-device** construct: each client defines its own
circles and membership.

- A **public** post is broadcast to all peers and is relayed + synced normally,
  in the clear (it is meant to reach everyone).
- A **circle** post is sent only to that circle's currently-connected members and
  is tagged with the audience name. It is **end-to-end encrypted to each
  recipient's key** (see [Confidential circle messages](#confidential-circle-narrow-cast-messages)).
  Circle posts are intentionally **not** multi-hop relayed or bulk-synced, so the
  encrypted form is the only form on the wire and they stay within their audience.
- Feed filtering matches a message's author peer ID (`authorId`) against a
  circle's members, which stays consistent regardless of what other clients name
  their own circles. The global "All Peers" feed shows only public posts; circle
  posts appear under their circle.

---

## Security model

SpellCast layers several independent protections so that — even with no server to
vouch for anyone — messages are authenticated, impersonation is detectable, and
private-audience posts are end-to-end encrypted. This section describes each
layer, how it is implemented, and (at the end) what it deliberately does **not**
protect. All cryptography uses the browser-native
[Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API);
no crypto library is bundled.

### Threat model at a glance

- **Protected:** forging a message as another identity; tampering with a message
  in transit or at a relay; reading a circle (private-audience) post if you are
  not one of its recipients; passive eavesdropping on the WebRTC data channel;
  trivial flooding/DoS from a single misbehaving peer.
- **Not protected (by design):** the contents of **public** posts (they are meant
  to reach everyone); connection *metadata* visible to the signaling broker (who
  connects to whom); a legitimate circle recipient choosing to re-share what they
  received; network-layer anonymity. See
  [What the security model does not cover](#what-the-security-model-does-not-cover).

### Cryptographic identity

Identity is a **keypair, not a name.** On first run (or when new credentials are created) each
client generates two P-256 keypairs via `crypto.subtle.generateKey`:

- an **ECDSA P-256** keypair used to **sign** messages, and
- an **ECDH P-256** keypair used to **receive encrypted** circle posts.

P-256 is used (rather than Ed25519/X25519) because it is supported by every
current browser's Web Crypto implementation. The two **public** keys are what
travel to other peers; the private keys live in IndexedDB as `CryptoKey` objects.
Legacy credentials created before this existed transparently mint a keypair on first
run of an updated build.

The **signing public key is the real identity.** The username is only a
self-asserted display label and the PeerJS id is only a routing address. The
human-facing handle shown on every message and on the profile is
`name#fingerprint` — e.g. `alice#a248` — where the 4-character fingerprint is a
fast hash of the public key. The fingerprint is a visual disambiguator, not the
security boundary (the real checks are the signature and the full-key pin below);
the avatar colour is also seeded from the public key, so two people who pick the
same name look different.

> **Secure context required.** Web Crypto is only available over `https://` or
> `http://localhost`. Served over a plain `http://` LAN address, key generation is
> unavailable and the app falls back to *unsigned* messages (everything shows as
> "unverified"). Always serve SpellCast over HTTPS or localhost.

### Message authenticity (signing & verification)

Every outbound message is signed. The signature covers a **canonical,
fixed-order** encoding — a JSON array prefixed with the domain string
`spellcast-tweet-v1` — of the security-relevant fields:

```
[ "spellcast-tweet-v1", authorKey, username, content, timestamp, id, mediaId, circle ]
```

The fixed order removes any object key-ordering ambiguity between signer and
verifier, and the domain prefix stops a signature from one context being replayed
in another. The message carries the author's public key (`authorKey`) and the
`signature` alongside the content.

On receipt — **before** a message is stored, shown, or relayed — the verifier
recomputes that encoding from the received fields and checks the signature against
`authorKey` (`crypto.subtle.verify`):

- valid signature → accepted and marked **verified**;
- **present but invalid** signature → **dropped** (forged or tampered), and the
  sending peer earns an abuse "strike" (see below);
- **no** signature (an older/legacy peer) → accepted but shown as **unverified**.

Because signing is over the plaintext fields and `authorKey`+`signature` ride
along unchanged, **a relay cannot alter a message** without invalidating the
signature, and it forwards the *original author's* signature rather than re-signing
as itself. Reactions ("Sparks") are signed the same way under the separate domain
`spellcast-reaction-v1`, so reaction counts cannot be forged or attributed to
someone else's key.

### Impersonation resistance (trust-on-first-use)

You cannot stop someone from *typing* the display name "alice" in a server-less
system — that is the [Zooko's Triangle](https://en.wikipedia.org/wiki/Zooko%27s_triangle)
trade-off (an identifier can be at most two of: human-meaningful, decentralized,
secure). SpellCast resolves it by making the *key* unforgeable and binding the
name to a key by **trust-on-first-use (TOFU)**:

- The first time a *verified* message from key K calls itself "alice", the client
  pins `alice → K` in a persisted name registry.
- A later, *different* key claiming a name already pinned to someone else is
  flagged in the UI with a **"⚠ impersonator?"** badge instead of appearing as a
  plain, trusted "alice".
- The client also pins its **own** name→key, so an impostor using *your* name is
  flagged on others' screens.

This is the same idea as SSH `known_hosts` and end-to-end messengers' safety
numbers.

### Confidential circle (narrow-cast) messages

Public posts are intentionally cleartext. **Circle** posts (sent to a named,
private audience) are instead **end-to-end encrypted to each recipient's key**
using a multi-recipient sealed box — an
[ECIES](https://en.wikipedia.org/wiki/Integrated_Encryption_Scheme)-style
construction:

1. A fresh random **AES-256-GCM content key** encrypts the payload **once**. The
   encrypted payload includes the message body *and* any attached image
   (thumbnail + full image); only routing fields (id, timestamp, author key,
   signature, circle name) stay in clear.
2. For each recipient, the sender performs **ephemeral-static ECDH** — a brand-new
   ephemeral keypair per message against that recipient's static ECDH public key —
   derives a wrapping key (SHA-256 of the shared secret), and wraps the content
   key for that recipient. Each recipient gets an envelope only they can open.
3. The fresh ephemeral key per message provides **forward secrecy**, and because
   every message is sealed to the *current* member list there is no long-lived
   group key to manage — removing a member simply excludes them from future posts.

The author still **signs the plaintext**, so a recipient verifies authorship
*after* decrypting. Recipients' ECDH public keys are learned during the connection
handshake. Circle posts are **never relayed or bulk-synced** (they go directly to
targeted members), so the sealed form is the only form on the wire. If a member's
client is too old to advertise an encryption key, that member is skipped for an
encrypted post; if *no* recipient supports encryption the post falls back to
cleartext (with a console warning).

### Credential backup & portability

Because the identity is a private key held in one browser, it can be exported as a
**passphrase-encrypted backup file** (Profile → *Export Credential Backup*) and
restored on another device from the login screen. The backup wraps both private
keys (plus username and peer id) with a key derived from your passphrase using
**PBKDF2-HMAC-SHA-256 (250,000 iterations) → AES-256-GCM**; the file is useless
without the passphrase. Trade-off: to be exportable the private keys are generated
*extractable*, so script running in the page (e.g. via an XSS) could in principle
read them — which is exactly why the Content-Security-Policy below locks scripting
down hard, and why the backup file itself is always encrypted.

### Transport security (WebRTC/DTLS)

Beneath the application-level signing and encryption, the transport is already
encrypted: WebRTC data channels use **DTLS** (Datagram Transport Layer Security —
the datagram cousin of TLS/HTTPS), negotiated with a secure handshake when two
peers connect. DTLS protects data **between directly connected peers**; the
application-level signatures and circle encryption extend protection *across
relays and storage*, which DTLS alone does not.

### Content-Security-Policy & page hardening

`index.html` ships an in-page Content-Security-Policy. The key directive is
`script-src 'self' https://cdnjs.cloudflare.com` with **no** `'unsafe-inline'` and
**no** `'unsafe-eval'` (PeerJS ≥ 1.5 no longer needs eval), so injected markup
cannot execute script — defense-in-depth behind the app's text-only DOM rendering.
The full policy:

```
default-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none';
script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline';
img-src 'self' data: https:; font-src 'self'; connect-src 'self' https: wss:
```

- `img-src … https:` is required because link previews load remote favicons /
  YouTube thumbnails; message *media* is still restricted to inline `data:` URIs
  by message validation.
- `connect-src … https: wss:` allows the PeerJS signaling broker (WebRTC's own
  STUN/TURN traffic is not governed by CSP).
- `style-src 'unsafe-inline'` is retained for a few static inline styles and the
  QR widget; low-risk because scripting is fully locked down.

The CDN `<script>` tags also carry
[Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
hashes (`integrity="sha512-…"`), so a tampered CDN file is refused, and
`<meta name="referrer" content="no-referrer">` keeps the page URL out of the
`Referer` header on remote image loads. One protection cannot be expressed in a
`<meta>` CSP: **`frame-ancestors`** (anti-clickjacking) must be sent as a real
`Content-Security-Policy: frame-ancestors 'none'` (or `X-Frame-Options: DENY`)
**HTTP response header** by whatever serves the page.

### Abuse resistance on the mesh

Several limits bound what one malicious or buggy peer can do. They run in
`PeerManager` / `TweetManager` / `MediaManager`:

- **Inbound rate limiting** — each peer is limited to ~400 messages per 10-second
  window; excess is dropped, and every inbound message is shape-checked before
  dispatch.
- **Strike & blocklist** — a peer sending invalid/forged/oversized payloads (or
  flooding) accrues "strikes"; **10 strikes within 60 s** disconnects it and
  blocklists it for **5 minutes**.
- **Relay caps** — a relayed message has a **hop limit (6)** carried in a
  transport-only `hops` counter and a **fan-out cap (32 peers)**; together with the
  per-message recipient tracking (which already prevents loops/duplicates) this
  bounds broadcast storms.
- **Input validation & size caps** — incoming messages are strictly validated:
  unknown fields are rejected; username ≤ 64 chars; content ≤ 1000 chars; a media
  thumbnail must be an inline `data:image/…` URI ≤ 64 KB (**never** a remote URL,
  which would beacon the viewer's IP); a full image from a peer is capped at 5 MB;
  a bulk-sync message is capped at 500 messages.
- **Bounded media storage** — the local media store is capped at 500 items
  (checked cheaply by key count), so a peer cannot fill your disk; once full,
  incoming media is refused.
- **CSPRNG everywhere it matters** — all non-trivial identifiers (peer ids, media
  ids, circle ids) come from `crypto.getRandomValues`, not `Math.random`.

This throttling is **client-side**: it protects an honest client from others, but
a modified client can ignore *its own* limits. Forgery is prevented by the
signature checks, not by throttling.

### Broker / network-metadata privacy & self-hosting

By default SpellCast uses the **public PeerJS cloud broker** for signaling. The
broker never sees message *content*, but it does see peer ids and who connects to
whom. To keep that metadata off third-party infrastructure, point the app at your
own broker by filling in the `CUSTOM_PEER_SERVER`
(`host`/`port`/`path`/`key`/`secure`) constant near the top of `peer-manager.js`
(run one with `npm install -g peer` then `peerjs --port 9000 --key <key>`). The
adjacent `CUSTOM_TURN_SERVERS` constant adds authenticated TURN relays for peers
behind symmetric NAT (the app ships with public STUN only). Both default to off,
so behaviour is unchanged until configured; when set, every connection path
(new-credentials, login, fallback) honours them.

### What the security model does **not** cover

- **Public posts are not confidential.** Only circle posts are encrypted; public
  ("All Peers") posts are cleartext by design so they can propagate everywhere.
- **The peer id is still address + login.** Anyone who learns your peer id can
  reconnect to the broker under it. They **cannot** forge your signed messages
  (that needs your private key), but the routing identifier itself is not a secret
  — treat it as a contact handle and rely on the *signed identity*, not the peer
  id, for trust.
- **Recipients are trusted.** End-to-end encryption stops outsiders and relays,
  not a legitimate circle member who chooses to re-share or screenshot a message.
- **Metadata & anonymity.** The broker (and your network) can observe connection
  metadata; SpellCast is not an anonymity system.
- **Deletes are local and not tombstoned.** Deleting a message removes it from your
  device only; a peer that still holds it may re-share it on a later sync.
- **Unverified/legacy messages are shown, not blocked.** For interoperability,
  unsigned messages from older peers are displayed (clearly marked "unverified")
  rather than dropped, so a mixed-version network still works.

---

## Storage architecture

SpellCast uses a single IndexedDB database (with a legacy localStorage/cookie
migration path) to persist:

- **User credentials** — username and peer ID
- **Identity keys** — your ECDSA signing and ECDH encryption keypairs, stored as
  Web Crypto `CryptoKey` objects (the private keys are never serialized to plain
  text in storage — IndexedDB persists the key objects directly)
- **Name registry** — the trust-on-first-use pins (`username → first verified
  public key`) that drive impersonation detection
- **Messages** — all created and received messages (each with its author key and
  signature)
- **Reactions** — signed "Spark" reaction records, keyed by message
- **Media** — images attached to messages (stored as base64 data URLs)
- **Peers** — known connections and their status
- **Circles** — your local peer groups
- **Distribution state** — which peers have received which messages

The main store and the media store share one database version to avoid concurrent
open-at-two-versions conflicts. *Delete Credentials* and the data-reset actions clear
the identity keys and name registry along with everything else.

---

## Connection quality monitoring

SpellCast actively monitors connection health:

1. Regular pings are sent to connected peers.
2. Response times are measured to gauge connection quality.
3. Failed connections trigger automatic reconnection attempts.
4. Connection quality is shown in the UI with a simple indicator.

---

## Contributing

Contributions are welcome:

1. **Fork the repository** — create your own copy.
2. **Make your changes** — add features or fix bugs.
3. **Test thoroughly** — verify across different browsers.
4. **Submit a pull request** — share your improvements.

### Coding guidelines

- Use clear, descriptive variable and function names.
- Add comments for complex logic.
- Maintain the existing code structure and patterns.
- Write clean, modular code.
- Test your changes across different browsers.

---

## Known Limitations & Prototype Status

SpellCast is a **prototype**. The cryptographic protections in the
[Security model](#security-model) are real, but several product-level constraints
remain (and are good contributor starting points):

- **The peer id is still an address *and* a login.** Anyone who learns it can
  reconnect to the broker under it. They **cannot** forge your signed messages
  (that needs your private key), but the routing id itself is not secret — trust
  the signed identity, not the peer id.
- **Only circle posts are encrypted.** Public ("All Peers") posts are cleartext by
  design so they can propagate across the whole mesh. Encryption also protects a
  circle post only from *outsiders and relays*, not from a legitimate recipient
  who re-shares it.
- **Images are sent inline.** A thumbnail and the full image travel with the
  message (and during reconnect sync). Large photos are accepted (up to
  15&nbsp;MB) and automatically downscaled/recompressed client-side to roughly
  600&nbsp;KB before sending, but a feed full of images still costs bandwidth.
- **Local deletes are not tombstoned.** Deleting messages affects only your
  device; a peer that still has a message may re-share it on a later connection.
- **Link previews load remote content.** Rendering a preview (image, YouTube
  thumbnail, or favicon) fetches it from its origin, revealing your IP to that
  domain — including for links in messages you *received*. The page sends no
  `Referer` (so the page URL doesn't leak), but the request itself is unavoidable
  without a proxy, which would break the serverless model. True Open Graph
  previews (scraped title/description) are not done for the same reason.
- **Circle feed filtering uses author info.** Messages are matched to a circle by
  the author's peer ID; messages from very old builds without an author ID only
  appear under "All Peers".
- **Throttling is client-side.** The rate limits, strikes, and blocklist protect
  an honest client from others, but a modified client can ignore its own limits.
  Forgery is prevented by signature checks, not by throttling.
- **Signaling still depends on a broker.** Connectivity uses the public PeerJS
  cloud broker by default (retrying with alternate STUN configuration if it is
  unreachable). You can self-host a broker and TURN relay via the config constants
  in `peer-manager.js` (see
  [Broker / network-metadata privacy & self-hosting](#broker--network-metadata-privacy--self-hosting)),
  but there is no automatic *independent* signaling fallback.
