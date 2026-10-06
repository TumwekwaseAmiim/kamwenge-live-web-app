# Kamwenge Live™ Architecture

## 1. Firebase application backend
Firebase Authentication identifies broadcasters/admins. Cloud Firestore stores:
- `users/{uid}` public broadcaster profile + role
- `meetings/{meetingId}` meeting metadata and scheduled/live/ended state
- `meetings/{meetingId}/comments/{commentId}` public comments
- `meetings/{meetingId}/reactionTotals/{emojiId}` emoji totals

Firestore never stores the moving camera/screen video.

## 2. Cloudinary
Cloudinary is used only for the broadcaster profile photo. The browser uploads the chosen image using a restricted unsigned upload preset, receives the HTTPS image URL, then Firestore stores that URL in the broadcaster profile.

No meeting covers, sponsor media, live stream, automatic replay or local recording are uploaded to Cloudinary by this project.

## 3. Live video
The broadcaster browser obtains camera/microphone or screen tracks. `js/streaming-adapter.js` publishes those tracks to a LiveKit room named after the Firestore meeting ID.

The browser never contains the LiveKit API secret. It requests a short-lived room token from the included Firebase HTTPS Function. The function verifies that a publisher owns the meeting (or is an admin) before issuing publish permission. Viewers receive subscribe-only tokens.

## 4. Recording
Recording is independent of broadcasting. On compatible Chrome/Edge browsers, MediaRecorder writes WebM chunks directly to a file selected by the broadcaster. The recording is not uploaded or published as a replay.

## 5. Public/private separation
- `index.html` — public event discovery
- `live.html` — public viewer room
- `login.html` — broadcaster/admin sign in
- `dashboard.html` — broadcaster events
- `create.html` — schedule/create event
- `studio.html` — private live controls
- `profile.html` — broadcaster profile/photo
- `admin/index.html` — admin controls
