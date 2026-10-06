const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { AccessToken } = require('livekit-server-sdk');

admin.initializeApp();
const db = admin.firestore();

const LIVEKIT_API_KEY = defineSecret('LIVEKIT_API_KEY');
const LIVEKIT_API_SECRET = defineSecret('LIVEKIT_API_SECRET');
const LIVEKIT_WS_URL = defineSecret('LIVEKIT_WS_URL');

function cors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

async function verifiedUid(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer (.+)$/i);
  if (!match) return null;
  try { return (await admin.auth().verifyIdToken(match[1])).uid; }
  catch { return null; }
}

exports.livekitToken = onRequest(
  { secrets:[LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL], region:'us-central1' },
  async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({error:'POST required.'});

    try {
      const eventId = String(req.body?.eventId || '').trim();
      const role = req.body?.role === 'publisher' ? 'publisher' : 'viewer';
      if (!eventId) return res.status(400).json({error:'eventId is required.'});

      const meetingSnap = await db.doc(`meetings/${eventId}`).get();
      if (!meetingSnap.exists) return res.status(404).json({error:'Meeting not found.'});
      const meeting = meetingSnap.data();

      let identity;
      if (role === 'publisher') {
        const uid = await verifiedUid(req);
        if (!uid) return res.status(401).json({error:'Broadcaster sign-in required.'});
        const userSnap = await db.doc(`users/${uid}`).get();
        const user = userSnap.exists ? userSnap.data() : {};
        const isOwner = meeting.hostId === uid;
        const isAdmin = user.role === 'admin';
        if (!isOwner && !isAdmin) return res.status(403).json({error:'You do not own this broadcast.'});
        identity = `host-${uid}`;
      } else {
        identity = `viewer-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
      }

      const token = new AccessToken(LIVEKIT_API_KEY.value(), LIVEKIT_API_SECRET.value(), {
        identity,
        ttl:'2h'
      });
      token.addGrant({
        roomJoin:true,
        room:eventId,
        canPublish: role === 'publisher',
        canSubscribe:true,
        canPublishData: role === 'publisher'
      });

      res.json({token:await token.toJwt(), wsUrl:LIVEKIT_WS_URL.value()});
    } catch (error) {
      console.error(error);
      res.status(500).json({error:'Could not create streaming token.'});
    }
  }
);
