# SpellCast — Open TODO

A running list of what's still open. The authoritative design rationale for most
of these lives in [SECURITY-ROADMAP.md](SECURITY-ROADMAP.md); this file is the
short, checkable summary. Items are grouped by area, not strictly by priority.

> Legend: `[ ]` not started · `[~]` partially done · related roadmap section in
> parentheses.

---

## Identity & address hardening

- [~] **Decouple the network address from the login credential** (P1). The peer
      id is still both the routing address and the login, so a leaked id can be
      squatted on the broker. Sub-tasks:
  - [x] Stop showing other peers' raw ids in the UI (peer list shows
        `name#fingerprint`). _Shipped._
  - [ ] Authenticate broker registration to the identity key (challenge → sign);
        needs a self-hosted PeerServer.
  - [ ] Derive the routing id from the public key so the address is bound to the
        identity.
  - [ ] Make the address rotatable/ephemeral — stable identifier = pinned public
        key, client maps key → current address.
  - [ ] Update onboarding copy that still frames the peer id as the durable login.
- [~] **Compare identity by public key, not name+peerId** (P0a). Circle
      membership and `isMine` still compare on name + peer id; migrate them to the
      verified public key.
- [ ] **Petnames** — let a user locally rename a contact ("Mom"); map the petname
      to the pinned key (P0b).

## Credential backup / portability

- [ ] **BIP-39 mnemonic backup** — offer a 12-word phrase as an alternative to the
      opaque encrypted key file (P0b / P1).
- [ ] **Encrypted-backup-as-QR** — render the passphrase-encrypted backup as a QR
      for device-to-device transfer, reusing the existing QR component (P1).

## Deployment / hosting

- [ ] **Anti-clickjacking header** — `frame-ancestors 'none'` (or
      `X-Frame-Options: DENY`) must be set as a real HTTP response header at deploy
      time; it cannot be expressed in the in-page `<meta>` CSP (P1 CSP).

## Verification / testing

- [ ] **Manual test of the peer-removal fix** (two browsers): remove an online
      peer from B → connection drops; reload B → peer does not reappear; have the
      removed peer try to reconnect → B refuses; then on B paste the peer's id in
      *Connect* → it connects again (deliberate re-add clears the removal).
- [ ] **No committed automated tests.** The crypto round-trips referenced in the
      roadmap were tested ad hoc in Node; there is no test suite in the repo. A
      lightweight Node test harness for `crypto-identity.js` (sign/verify, seal/
      open, backup encrypt/decrypt) would be a good contributor task.

---

_Done items are tracked with `[x]` in [SECURITY-ROADMAP.md](SECURITY-ROADMAP.md);
the by-design non-goals (public posts cleartext, metadata visible to broker,
local non-tombstoned deletes, etc.) are listed under "What the security model does
not cover" in [TECHNICAL.md](TECHNICAL.md) and are intentional, not TODOs._
