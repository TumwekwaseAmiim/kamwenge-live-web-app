# Kamwenge Live™ — Live Streaming Setup

Kamwenge Live now uses **one Cloudflare Worker** for all LiveKit tokens: viewers, broadcasters and approved guest speakers. Firebase Functions are not required for LiveKit.

## 1. Cloudflare Worker

Open **Workers & Pages → kamwenge-live-token → Edit code** and replace the Worker with:

`cloudflare/livekit-token-worker.js`

Keep these existing Worker variables/secrets exactly as configured:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Then click **Deploy**.

The Worker verifies Firebase broadcaster ID tokens, checks event ownership, verifies approved anonymous speaker requests using the request secret hash, and issues the appropriate LiveKit token.

## 2. Firestore rules

Deploy the included rules from the project folder:

```bash
firebase deploy --only firestore:rules
```

## 3. Frontend endpoint

`js/media-config.js` already points both normal and speaker token requests to:

`https://kamwenge-live-token.tumwekwaseamiim.workers.dev`

No LiveKit API secret is stored in browser JavaScript.

## 4. Speaker flow

1. Viewer watches normally.
2. Viewer taps **Request to Speak**.
3. Broadcaster sees the request in Studio and taps **Allow**.
4. Viewer taps **Join Microphone**.
5. The Cloudflare Worker verifies the approved request and grants publishing rights.
6. The speaker can use microphone, camera or screen sharing.
7. Broadcaster can remove the speaker.

## 5. Audio quality

The frontend requests echo cancellation, noise suppression, automatic gain control, mono voice capture, 48 kHz where supported, and browser voice isolation where available. These settings can reduce wind/background noise, but severe outdoor wind cannot be guaranteed away by software; a physical microphone windscreen remains the best protection.
