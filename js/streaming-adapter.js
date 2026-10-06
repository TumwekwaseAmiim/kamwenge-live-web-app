import { auth } from './firebase-core.js';
import { livekitConfig, livekitConfigured } from './media-config.js';
import {
  Room,
  RoomEvent,
  Track
} from 'https://cdn.jsdelivr.net/npm/livekit-client@2.15.6/+esm';

let publisherRoom = null;
let publisherTracks = [];
let viewerRoom = null;

async function requestToken(eventId, role) {
  if (!livekitConfigured) {
    throw new Error('Live video is not configured yet. Add the deployed token function URL in js/media-config.js.');
  }

  const headers = {'Content-Type':'application/json'};
  if (role === 'publisher') {
    const user = auth?.currentUser;
    if (!user) throw new Error('Broadcaster authentication is required.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const r = await fetch(livekitConfig.tokenEndpoint, {
    method:'POST',
    headers,
    body: JSON.stringify({eventId, role})
  });
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data?.error || 'Could not create a live streaming session.');
  if (!data.token || !data.wsUrl) throw new Error('Streaming server returned an incomplete session.');
  return data;
}

export async function publishStream(eventId, mediaStream) {
  if (!mediaStream?.getTracks()?.length) throw new Error('No camera or screen stream is active.');
  await stopPublish();
  const session = await requestToken(eventId, 'publisher');
  const room = new Room({adaptiveStream:true, dynacast:true});
  await room.connect(session.wsUrl, session.token);

  const tracks = mediaStream.getTracks().filter(t => t.readyState === 'live');
  for (const track of tracks) {
    await room.localParticipant.publishTrack(track, {
      name: track.kind === 'video' ? 'main-video' : 'main-audio',
      source: track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone
    });
  }
  publisherRoom = room;
  publisherTracks = tracks;
  return {room};
}

export async function replacePublishedStream(eventId, mediaStream) {
  return publishStream(eventId, mediaStream);
}

export async function stopPublish() {
  try {
    if (publisherRoom) {
      for (const track of publisherTracks) {
        try { await publisherRoom.localParticipant.unpublishTrack(track); } catch {}
      }
      await publisherRoom.disconnect();
    }
  } finally {
    publisherRoom = null;
    publisherTracks = [];
  }
}

export async function watchLiveStream(eventId, videoElement, onState=()=>{}) {
  await stopWatching();
  const session = await requestToken(eventId, 'viewer');
  const room = new Room({adaptiveStream:true, dynacast:true});
  viewerRoom = room;

  const attach = (track) => {
    const element = track.attach();
    if (track.kind === Track.Kind.Video) {
      videoElement.srcObject = element.srcObject;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.play().catch(()=>{});
      onState('playing');
      element.remove();
    } else if (track.kind === Track.Kind.Audio) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.srcObject = element.srcObject;
      audio.dataset.kamwengeLiveAudio = '1';
      document.body.appendChild(audio);
      audio.play().catch(()=>{});
      element.remove();
    }
  };

  room.on(RoomEvent.TrackSubscribed, attach);
  room.on(RoomEvent.Disconnected, ()=>onState('disconnected'));
  room.on(RoomEvent.Reconnecting, ()=>onState('reconnecting'));
  room.on(RoomEvent.Reconnected, ()=>onState('playing'));

  await room.connect(session.wsUrl, session.token);
  room.remoteParticipants.forEach(p => p.trackPublications.forEach(pub => {
    if (pub.track) attach(pub.track);
  }));
  onState('connected');
  return room;
}

export async function stopWatching() {
  document.querySelectorAll('audio[data-kamwenge-live-audio="1"]').forEach(x=>x.remove());
  if (viewerRoom) {
    await viewerRoom.disconnect();
    viewerRoom = null;
  }
}
