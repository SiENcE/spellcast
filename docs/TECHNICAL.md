# SpellCast — Technical Documentation

Everything under the hood: how to run it locally, the architecture, the
networking model, storage, and the current limitations. For the end-user
overview, see the [main README](../README.md).

SpellCast is built with **vanilla JavaScript** (ES modules, no build step) and a
couple of small libraries:

- **[PeerJS](https://peerjs.com/)** — WebRTC connections for peer-to-peer communication
- **IndexedDB** — persistent storage for messages, media, peers, and circles
- **[QRCode.js](https://github.com/davidshimjs/qrcodejs)** — QR codes for sharing peer IDs

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
- **UserManager** — user credentials and identity
- **PeerManager** — peer connections, reconnection, and message routing
- **TweetManager** — message creation, validation, storage, and distribution
- **MediaManager** — image processing (resize/thumbnail) and storage
- **CircleManager** — local, named groups of peers
- **StorageManager** — persistent storage via IndexedDB (with a localStorage/cookie migration path)
- **UIManager** — DOM rendering and event handling
- **RateLimiter** — client-side spam/abuse throttling

There's also a small `link-preview` helper that turns URLs into clickable links
and renders previews (inline images, YouTube thumbnails, or a favicon/domain
"link card") using only browser-native techniques — no scraping proxy.

---

## How multi-peer networking works

SpellCast forms a mesh network:

1. **Direct connections** — you establish WebRTC connections with peers you know.
2. **Message propagation (multi-hop relay)** — when a message is sent:
   - It's stored in local browser storage.
   - It's sent to all directly connected peers.
   - Each peer that receives a *new* message stores it and forwards (relays) it
     to its own peers, so messages travel multiple hops across the network.
   - The system tracks which peers have received each message, so a peer is never
     sent the same message twice — preventing duplicates and relay loops.
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

- A **public** post is broadcast to all peers and is relayed + synced normally.
- A **circle** post is sent only to that circle's currently-connected members and
  is tagged with the audience name. Circle posts are intentionally **not**
  multi-hop relayed or bulk-synced, so they stay within their audience.
- Feed filtering matches a message's author peer ID (`authorId`) against a
  circle's members, which stays consistent regardless of what other clients name
  their own circles.

Circles are an organizational/audience tool, **not** an access-control or privacy
boundary — see [Known Limitations](#known-limitations--prototype-status).

---

## WebRTC encryption

SpellCast relies on WebRTC's built-in security features:

1. **DTLS encryption** — all data channels are encrypted using Datagram Transport
   Layer Security (similar to HTTPS for websites).
2. **Connection security** — each connection begins with a secure handshake;
   communication is encrypted between directly connected peers.

**The transport is secure, but the application itself does not implement an
additional end-to-end encryption layer.** For stronger guarantees you would add
message-level end-to-end encryption.

---

## Storage architecture

SpellCast uses a single IndexedDB database (with a legacy localStorage/cookie
migration path) to persist:

- **User credentials** — username and peer ID
- **Messages** — all created and received messages
- **Media** — images attached to messages (stored as base64 data URLs)
- **Peers** — known connections and their status
- **Circles** — your local peer groups
- **Distribution state** — which peers have received which messages

The main store and the media store share one database version to avoid
concurrent open-at-two-versions conflicts.

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

SpellCast is a **prototype**. These are known design constraints (and good
starting points for contributors):

- **Peer ID is both your address and your login.** The same ID you share via QR
  code to let others connect is also the only thing (besides a username) needed
  to log in as you. The PeerJS public signaling server performs no account
  authentication, so the "keep this private" wording in the UI is aspirational —
  treat identities as non-authenticated.
- **No application-level encryption.** Security relies entirely on WebRTC/DTLS
  transport encryption between *directly* connected peers. Messages relayed
  through intermediaries are re-sent by each hop, not end-to-end encrypted.
- **Images are sent inline over the data channel.** Full images travel with the
  message (and during reconnect sync), so a feed with many large images increases
  bandwidth and message size. Images are capped at 2&nbsp;MB and downscaled to
  1200&nbsp;px before sending to keep this reasonable.
- **Local deletes are not tombstoned.** "Delete All Messages" / deleting a single
  message only affects your own device; a peer that still has the message may
  re-share it with you on a later connection.
- **Link previews load remote content.** Rendering a preview (image, YouTube
  thumbnail, or site favicon) fetches that resource from its origin, which
  reveals your IP address to that domain — including for links in messages you
  *received*. True Open Graph previews (scraped title/description) aren't done at
  all, since that would require a server/proxy and break the serverless model.
- **Circles are not private.** A narrow-cast (circle) message is best-effort
  delivered only to that circle's currently-connected members and isn't relayed
  or bulk-synced, but it is not encrypted to the group — any peer who receives it
  can read it. Treat circles as organization/audience, not security.
- **Circle feed filtering needs author info.** Messages are matched to a circle
  by the author's peer ID; messages from peers running older builds (without an
  author ID) only appear under "All Peers".
- **Rate limiting is client-side only** and can be bypassed by a modified peer.
- **Single signaling server.** Connectivity depends on the default PeerJS cloud
  server. If it is unreachable, the app retries with alternate STUN configuration
  but does not currently run its own independent signaling fallback.
