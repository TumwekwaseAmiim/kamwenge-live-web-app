# KAMWENGE LIVE™
## Homegrown in Uganda. Built to Compete Globally.

**Concept, Design & Development: Eng. Amiim Tumwekwase**

This is the complete backend-connected project structure for Kamwenge Live. It replaces the earlier local demo flow with real Firebase data/authentication and a real WebRTC/SFU live-video integration using LiveKit.

## What is implemented

### Public experience
- Public Home page with LIVE, Upcoming and Ended events
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
- Firebase Function → securely issues short-lived LiveKit room tokens
- LiveKit → actual browser camera/screen WebRTC live video delivery
- Cloudinary → broadcaster profile photo only

## Important service separation
Cloudinary is **not** used for meeting covers, sponsors, recordings or replay storage in this project.

Recordings remain on the broadcaster's own device. Firebase does not transport video. LiveKit is the WebRTC/SFU media transport for the live broadcast.

## Configuration files
- `js/firebase-config.js` → Firebase Web App config
- `js/media-config.js` → Cloudinary public upload values + deployed LiveKit token-function URL
- `firestore.rules` → Firestore security rules
- `functions/index.js` → secure LiveKit token endpoint
- `functions/package.json` → Firebase Functions dependencies

## Setup order
1. Configure Firebase using `docs/FIREBASE_SETUP.md`.
2. Configure Cloudinary profile-photo upload using `docs/CLOUDINARY_SETUP.md`.
3. Create a LiveKit project and deploy the Firebase token function using `docs/LIVE_STREAM_SETUP.md`.
4. Put the deployed token-function URL in `js/media-config.js`.
5. Test one broadcaster + a second viewer device.
6. Deploy the web app over HTTPS.

## Production note
Live capacity is determined primarily by your LiveKit plan/infrastructure and each viewer's network. Do not assume a fixed number such as 300 viewers without load testing and checking the provider's current limits/costs.
