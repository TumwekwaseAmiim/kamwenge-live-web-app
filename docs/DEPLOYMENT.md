# Deployment — Kamwenge Live™

## Before deploying
Complete Firebase, Cloudinary profile-photo and LiveKit setup first.

## Firebase Hosting
If using Firebase Hosting:

```bash
firebase deploy --only hosting
```

You can deploy rules/functions together when ready:

```bash
firebase deploy
```

## Other static hosts
The frontend can also be hosted on GitHub Pages, Cloudflare Pages, Netlify or another HTTPS static host. Keep the Firebase Function deployed separately and retain its HTTPS URL in `js/media-config.js`.

## HTTPS requirement
Production camera, microphone, screen capture, PWA and file-system features require a secure context. Use HTTPS. `localhost` is accepted by browsers during development.

## Browser/device testing
Test at minimum:
- Android Chrome
- iPhone Safari
- Windows Chrome/Edge
- phone front/back camera switching
- microphone mute/unmute
- screen sharing where browser/OS supports it
- direct-to-device recording on supported browsers
- loss/recovery of mobile data/Wi-Fi

## Scale
Load-test live broadcasting separately from Firestore. LiveKit/SFU capacity and provider plan determine live viewer scale and cost.
