# Live Streaming Setup — LiveKit + Firebase Function

Kamwenge Live uses LiveKit as the actual WebRTC/SFU media layer so a broadcaster can use a phone/PC browser camera or share a screen without OBS/RTMP configuration.

## 1. Create a LiveKit project
Create a project in LiveKit Cloud (or use your own LiveKit server). Obtain:
- WebSocket URL, usually beginning `wss://`
- API key
- API secret

## 2. Install function dependencies
From the project root:

```bash
cd functions
npm install
cd ..
```

## 3. Set Firebase function secrets
Run:

```bash
firebase functions:secrets:set LIVEKIT_API_KEY
firebase functions:secrets:set LIVEKIT_API_SECRET
firebase functions:secrets:set LIVEKIT_WS_URL
```

Enter each actual value when Firebase CLI asks.

## 4. Deploy the token function

```bash
firebase deploy --only functions:livekitToken
```

Firebase will return an HTTPS URL for the function.

## 5. Add the function URL
Open `js/media-config.js` and set:

```js
export const livekitConfig = {
  tokenEndpoint: "https://YOUR-DEPLOYED-FUNCTION-URL"
};
```

## 6. Test with two devices
1. Broadcaster signs in.
2. Create a meeting.
3. Open Studio.
4. Start Camera.
5. Press Go Live.
6. On a second phone/computer open the public event link.
7. Confirm video/audio, comments and reactions.
8. While LIVE, test Share Screen and switching back to camera.
9. End Broadcast.

## Security design
Publisher token requests include the broadcaster's Firebase ID token. The server function verifies the account and confirms that the user owns the Firestore meeting or has the admin role. Viewer tokens are subscribe-only.

Never put the LiveKit API secret in `js/media-config.js` or any other frontend file.
