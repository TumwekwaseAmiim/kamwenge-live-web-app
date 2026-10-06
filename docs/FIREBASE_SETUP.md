# Firebase Setup — Kamwenge Live™

## 1. Create/open the Firebase project
Enable:
- Authentication → Sign-in method → Email/Password
- Cloud Firestore
- Cloud Functions (required for secure LiveKit tokens)
- Hosting if you want to host the frontend on Firebase

## 2. Register the Web App
Firebase Console → Project settings → General → Your apps → Web app.
Copy the config values into `js/firebase-config.js`.

Do not put Firebase Admin credentials or LiveKit secrets in this file.

## 3. Deploy Firestore rules
From the project root after installing Firebase CLI and signing in:

```bash
firebase deploy --only firestore:rules
```

## 4. Create the first admin/broadcaster
In Firebase Authentication create the Email/Password account. Copy its UID.

In Firestore create document:

`users/{uid}`

Fields:
- `displayName`: `Eng. Amiim Tumwekwase`
- `photoURL`: ``
- `bio`: your public bio
- `location`: your public location
- `role`: `admin`

Other broadcasters should use role `broadcaster`.

A broadcaster cannot promote their own role from the profile page.

## 5. Collections used
- `users/{uid}`
- `meetings/{meetingId}`
- `meetings/{meetingId}/comments/{commentId}`
- `meetings/{meetingId}/reactionTotals/{emojiId}`
- `reports/{reportId}`
- `settings/{docId}`
