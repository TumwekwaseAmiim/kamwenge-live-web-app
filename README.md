# KAMWENGE LIVE™
## Homegrown in Uganda. Built to Compete Globally.

**Concept, Design & Development: Eng. Amiim Tumwekwase**

This is the complete backend-connected project structure for Kamwenge Live. It replaces the earlier local demo flow with real Firebase data/authentication and a real WebRTC/SFU live-video integration using LiveKit.

## What is implemented

### Public experience
- Public Home page with LIVE and Upcoming events; ended direct links show the ended state
- One public event link from countdown → LIVE → ended
- Realtime live video/audio viewing
- Broadcaster profile photo, name and bio beside the event
- Public comments and emoji reactions in real time
- Share event link
- PWA/install support
- No automatic replay library

### Broadcaster experience
- Firebase Email/Password login
- Broadcaster dashboard
- Create/schedule meetings
- Private Broadcaster Studio
- Front/back camera
- Microphone mute/unmute
- Screen sharing while LIVE
- Switching camera/screen updates the public live stream
- Go Live / End Broadcast
- Realtime viewer comments visible inside Studio
- Local recording directly to a chosen device file on compatible browsers
- Broadcaster profile editor
- Cloudinary upload for **broadcaster profile photo only**

### Backend/services
- Firebase Authentication → login/identity
- Cloud Firestore → profiles, roles, meetings, status, comments, reactions
- Cloudflare `kamwenge-live-token` Worker → securely issues short-lived LiveKit room tokens
- LiveKit → actual browser camera/screen WebRTC live video delivery
- Cloudinary → broadcaster profile photo only

## Important service separation
Cloudinary is **not** used for meeting covers, sponsors, recordings or replay storage in this project.

Recordings remain on the broadcaster's own device. Firebase does not transport video. LiveKit is the WebRTC/SFU media transport for the live broadcast.

## Configuration files
- `js/firebase-config.js` → Firebase Web App config
- `js/media-config.js` → Cloudinary public upload values + Cloudflare LiveKit token Worker URL
- `firestore.rules` → Firestore security rules
- `cloudflare/livekit-token-worker.js` → LiveKit token Worker for viewers, broadcasters and approved speakers

## Setup order
1. Configure Firebase using `docs/FIREBASE_SETUP.md`.
2. Configure Cloudinary profile-photo upload using `docs/CLOUDINARY_SETUP.md`.
3. Deploy/update the Cloudflare LiveKit token Worker using `docs/LIVE_STREAM_SETUP.md`.
4. Confirm `js/media-config.js` points to your `kamwenge-live-token` Worker.
5. Test one broadcaster + a second viewer device.
6. Deploy the web app over HTTPS.

## Production note
Live capacity is determined primarily by your LiveKit plan/infrastructure and each viewer's network. Do not assume a fixed number such as 300 viewers without load testing and checking the provider's current limits/costs.


## Viewer sound, fullscreen and branded sharing
The public live page now includes an explicit **Tap for Sound** control because mobile browsers can block autoplay audio until the viewer interacts with the page. It also includes a **Full Screen** control.

The installed PWA icon is supplied by `manifest.webmanifest` from `assets/icons/icon-192.png` and `icon-512.png`. After changing/deploying icons, an already-installed copy may need to be uninstalled and installed again before the phone launcher refreshes the icon.

Event links are currently shared through the Cloudflare share worker configured in `js/home.js` and `js/live.js`. For WhatsApp/Facebook/X preview cards to show the event title/image instead of a plain URL, that worker must return Open Graph metadata (`og:title`, `og:description`, `og:image`) before redirecting/serving the live page. The social-share Worker remains a separate Cloudflare Worker. The LiveKit token Worker source is included under `cloudflare/livekit-token-worker.js`.

## Interactive Live Room (Oct 2026)
- Viewer Request to Speak workflow with broadcaster Allow/Decline.
- Up to 4 approved guest speakers.
- Approved guests join microphone through LiveKit and can mute/leave.
- Broadcaster hears approved speakers and can remove them.
- Existing real-time Firestore chat and reactions retained.
- Mobile live-room layout improved.
- Fullscreen and viewer sound controls retained.
- PWA icon/manifest retained.


## Kamwenge Live 2.1 interactive upgrades

- Real-time LiveKit video/audio with Firebase chat and reactions.
- Viewers can request to speak; broadcaster approves up to four guest speakers.
- Approved speakers can use microphone, camera, or screen sharing.
- Broadcaster and viewers have fullscreen controls; guest media can also be tapped for fullscreen.
- Microphone capture requests echo cancellation, noise suppression, automatic gain control, mono speech capture, and voice isolation where the browser supports it. This reduces background/wind noise but cannot guarantee removal of severe wind; a physical windscreen is still recommended outdoors.
- Ended events stay in Firestore for records but disappear from public/home and broadcaster dashboard listings after 24 hours. Direct event links can still show the ended state.
- The Cloudflare worker in `cloudflare/livekit-token-worker.js` is the matching token service for this frontend. Deploy it to `kamwenge-live-token` while keeping your existing LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET variables/secrets.
