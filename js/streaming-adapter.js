import { auth } from './firebase-core.js';
import { livekitConfig, livekitConfigured } from './media-config.js';
import { Room, RoomEvent, Track } from 'https://cdn.jsdelivr.net/npm/livekit-client@2.15.6/+esm';

let publisherRoom = null;
let publisherTracks = [];
let studioParticipantListener = () => {};
let studioGuestContainer = null;
let studioRemoteMedia = new Map();
let studioAudioUnlocked = false;

let viewerRoom = null;
let viewerVideoTrack = null;
let viewerHostAudioTrack = null;
let viewerAudioTracks = [];
let viewerMicTrack = null;
let viewerCameraTrack = null;
let viewerScreenTrack = null;
let viewerCameraStream = null;
let viewerScreenStream = null;
let viewerGuestContainer = null;
let viewerRemoteMedia = new Map();
let viewerVideoElement = null;
let viewerAudioUnlocked = false;

function safePlay(el) {
  if (!el) return Promise.resolve(false);
  return el.play().then(() => true).catch(() => false);
}

export function clearVoiceConstraints() {
  const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
  const audio = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1
  };
  if (supported.sampleRate) audio.sampleRate = { ideal: 48000 };
  if (supported.sampleSize) audio.sampleSize = { ideal: 16 };
  if (supported.latency) audio.latency = { ideal: 0.02 };
  if (supported.voiceIsolation) audio.voiceIsolation = true;
  return audio;
}

async function getClearVoiceAudioStream() {
  const attempts = [
    { audio: clearVoiceConstraints(), video: false },
    { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false },
    { audio: true, video: false }
  ];
  let lastError;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream.getAudioTracks().length) return stream;
      stream.getTracks().forEach(t => t.stop());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Microphone could not be started.');
}

function tuneSpeechTrack(track) {
  if (!track) return;
  try { track.contentHint = 'speech'; } catch {}
  try { track.applyConstraints(clearVoiceConstraints()).catch(() => {}); } catch {}
}

async function requestToken(eventId, role, extra = {}) {
  if (!livekitConfigured) throw new Error('Live video is not configured yet.');
  if (!eventId) throw new Error('Event ID is required for live streaming.');

  const headers = { 'Content-Type': 'application/json' };
  if (role === 'publisher') {
    const user = auth?.currentUser;
    if (!user) throw new Error('Broadcaster authentication is required.');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const endpoint = role === 'speaker'
    ? (livekitConfig.speakerTokenEndpoint || livekitConfig.tokenEndpoint)
    : livekitConfig.tokenEndpoint;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventId, role, ...extra })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Could not create a live streaming session.');
  if (!data.token || !data.wsUrl) throw new Error('Streaming server returned an incomplete session.');
  return data;
}

function makeBackgroundAudioElement(kind) {
  const el = document.createElement('audio');
  el.autoplay = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.dataset.kamwengeAudio = kind;
  // Keep it renderable for stricter mobile browsers without showing it.
  Object.assign(el.style, {
    position: 'fixed',
    width: '1px',
    height: '1px',
    opacity: '0',
    left: '-10px',
    bottom: '0',
    pointerEvents: 'none'
  });
  document.body.appendChild(el);
  return el;
}

function mediaCardKey(track, participant) {
  return `${participant.identity}:${track.sid || track.mediaStreamTrack?.id || crypto.randomUUID()}`;
}

function createRemoteMediaCard(track, participant, container, map, label) {
  if (!container) return;
  const key = mediaCardKey(track, participant);
  if (map.has(key)) return;

  container.classList.remove('hidden');
  const card = document.createElement('article');
  card.className = 'guest-media-card';
  card.dataset.remoteKey = key;

  const head = document.createElement('div');
  head.className = 'guest-media-head';
  head.textContent = `${label} ${participant.name || participant.identity}`;

  const media = track.attach();
  media.autoplay = true;
  media.playsInline = true;
  media.className = 'guest-media-video';
  media.addEventListener('click', async () => {
    try {
      if (media.requestFullscreen) await media.requestFullscreen();
      else media.webkitEnterFullscreen?.();
    } catch {}
  });

  card.append(head, media);
  container.appendChild(card);
  safePlay(media);
  map.set(key, { track, element: media, card });
}

function removeRemoteTrack(track, map) {
  for (const [key, item] of map) {
    if (item.track !== track) continue;
    const parent = item.card?.parentElement;
    try { item.track.detach(item.element); } catch {}
    try { item.element?.pause?.(); } catch {}
    try { item.element?.remove?.(); } catch {}
    try { item.card?.remove(); } catch {}
    map.delete(key);
    if (parent && !parent.children.length) parent.classList.add('hidden');
  }
}

function clearRemoteMedia(map, container) {
  for (const item of map.values()) {
    try { item.track.detach(item.element); } catch {}
    try { item.element?.pause?.(); } catch {}
    try { item.element?.remove?.(); } catch {}
    try { item.card?.remove(); } catch {}
  }
  map.clear();
  container?.classList.add('hidden');
}

export function setStudioGuestContainer(el) { studioGuestContainer = el; }
export function setViewerGuestContainer(el) { viewerGuestContainer = el; }

function emitStudioParticipants() {
  if (!publisherRoom) return studioParticipantListener([]);
  const list = [];
  publisherRoom.remoteParticipants.forEach(p => {
    list.push({ identity: p.identity, name: p.name || p.identity });
  });
  studioParticipantListener(list);
}

function isSpeakerParticipant(participant) {
  return String(participant?.identity || '').startsWith('speaker-');
}

function attachStudioRemoteTrack(track, publication, participant) {
  if (track.kind === Track.Kind.Audio) {
    const key = mediaCardKey(track, participant);
    if (studioRemoteMedia.has(key)) return;
    const el = track.attach(makeBackgroundAudioElement('studio-guest'));
    el.muted = !studioAudioUnlocked;
    el.volume = 1;
    studioRemoteMedia.set(key, { track, element: el, card: null });
    if (studioAudioUnlocked) {
      publisherRoom?.startAudio?.().catch(() => {});
      safePlay(el);
    } else {
      safePlay(el); // muted playback primes the element on many mobile browsers
    }
    return;
  }

  if (track.kind === Track.Kind.Video) {
    const label = publication?.source === Track.Source.ScreenShare ? '🖥️ Shared screen •' : '🎥 Guest •';
    createRemoteMediaCard(track, participant, studioGuestContainer, studioRemoteMedia, label);
  }
}

export function onStudioParticipantChange(callback) {
  studioParticipantListener = typeof callback === 'function' ? callback : () => {};
  emitStudioParticipants();
}

export async function resumeStudioAudio() {
  studioAudioUnlocked = true;
  let played = false;
  try {
    if (publisherRoom?.startAudio) {
      await publisherRoom.startAudio();
      played = true;
    }
  } catch {}

  for (const item of studioRemoteMedia.values()) {
    if (item.track?.kind !== Track.Kind.Audio || !item.element) continue;
    try {
      item.element.muted = false;
      item.element.volume = 1;
      if (await safePlay(item.element)) played = true;
    } catch {}
  }
  return played;
}

export async function moderateParticipant(eventId, participantIdentity) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Broadcaster authentication is required.');
  const response = await fetch(livekitConfig.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`
    },
    body: JSON.stringify({ action: 'removeParticipant', eventId, participantIdentity })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Could not remove the speaker.');
  return data;
}

export async function publishStream(eventId, mediaStream) {
  if (!mediaStream || !mediaStream.getTracks().length) throw new Error('No camera or screen stream is active.');
  const liveVideoTracks = mediaStream.getVideoTracks().filter(t => t.readyState === 'live');
  const liveAudioTracks = mediaStream.getAudioTracks().filter(t => t.readyState === 'live');
  if (!liveVideoTracks.length) throw new Error('No live camera or screen track is available.');
  if (!liveAudioTracks.length) throw new Error('No live microphone track is available. Please allow microphone access.');

  await stopPublish();
  const session = await requestToken(eventId, 'publisher');
  const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });

  room.on(RoomEvent.Connected, () => {
    emitStudioParticipants();
    if (studioAudioUnlocked) resumeStudioAudio().catch(() => {});
  });
  room.on(RoomEvent.ParticipantConnected, emitStudioParticipants);
  room.on(RoomEvent.ParticipantDisconnected, emitStudioParticipants);
  room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => attachStudioRemoteTrack(track, pub, participant));
  room.on(RoomEvent.TrackUnsubscribed, track => removeRemoteTrack(track, studioRemoteMedia));

  await room.connect(session.wsUrl, session.token, { autoSubscribe: true });
  publisherRoom = room;
  publisherTracks = [];

  for (const videoTrack of liveVideoTracks) {
    await room.localParticipant.publishTrack(videoTrack, {
      name: 'main-video',
      source: Track.Source.Camera,
      simulcast: true
    });
    publisherTracks.push(videoTrack);
  }

  for (const audioTrack of liveAudioTracks) {
    tuneSpeechTrack(audioTrack);
    await room.localParticipant.publishTrack(audioTrack, {
      name: 'main-audio',
      source: Track.Source.Microphone,
      dtx: true,
      red: true
    });
    publisherTracks.push(audioTrack);
  }

  emitStudioParticipants();
  return { room };
}

export async function replacePublishedStream(eventId, mediaStream) {
  return publishStream(eventId, mediaStream);
}

export async function stopPublish() {
  clearRemoteMedia(studioRemoteMedia, studioGuestContainer);
  if (!publisherRoom) {
    publisherTracks = [];
    emitStudioParticipants();
    return;
  }

  try {
    for (const track of publisherTracks) {
      try { await publisherRoom.localParticipant.unpublishTrack(track); } catch {}
    }
    await publisherRoom.disconnect();
  } catch (error) {
    console.warn('Publisher disconnect warning:', error);
  }
  publisherRoom = null;
  publisherTracks = [];
  emitStudioParticipants();
}

function cleanupViewerTracks() {
  if (viewerVideoTrack && viewerVideoElement) {
    try { viewerVideoTrack.detach(viewerVideoElement); } catch {}
  }
  if (viewerHostAudioTrack && viewerVideoElement) {
    try { viewerHostAudioTrack.detach(viewerVideoElement); } catch {}
  }
  viewerVideoTrack = null;
  viewerHostAudioTrack = null;

  for (const item of viewerAudioTracks) {
    try { item.track.detach(item.element); } catch {}
    try {
      item.element.pause();
      item.element.srcObject = null;
      item.element.remove();
    } catch {}
  }
  viewerAudioTracks = [];
  clearRemoteMedia(viewerRemoteMedia, viewerGuestContainer);
}

function attachViewerTrack(track, publication, participant, videoElement, onState) {
  const speaker = isSpeakerParticipant(participant);

  if (track.kind === Track.Kind.Video) {
    if (!speaker) {
      if (viewerVideoTrack && viewerVideoTrack !== track) {
        try { viewerVideoTrack.detach(videoElement); } catch {}
      }
      viewerVideoTrack = track;
      viewerVideoElement = videoElement;
      track.attach(videoElement);
      videoElement.playsInline = true;
      videoElement.autoplay = true;
      // Keep muted until the viewer explicitly enables sound; this protects autoplay.
      if (!viewerAudioUnlocked) videoElement.muted = true;
      safePlay(videoElement);
      onState('playing');
    } else {
      const label = publication?.source === Track.Source.ScreenShare ? '🖥️ Shared screen •' : '🎥 Guest •';
      createRemoteMediaCard(track, participant, viewerGuestContainer, viewerRemoteMedia, label);
    }
    return;
  }

  if (track.kind === Track.Kind.Audio) {
    if (!speaker) {
      viewerHostAudioTrack = track;
      viewerVideoElement = videoElement;
      track.attach(videoElement);
      videoElement.volume = 1;
      videoElement.muted = !viewerAudioUnlocked;
      if (viewerAudioUnlocked) {
        viewerRoom?.startAudio?.().catch(() => {});
        safePlay(videoElement);
      } else {
        safePlay(videoElement);
      }
      onState('audio');
      return;
    }

    const el = track.attach(makeBackgroundAudioElement('viewer-guest'));
    el.volume = 1;
    el.muted = !viewerAudioUnlocked;
    viewerAudioTracks.push({ track, element: el, participantId: participant.identity });
    if (viewerAudioUnlocked) {
      viewerRoom?.startAudio?.().catch(() => {});
      safePlay(el);
    } else {
      safePlay(el);
    }
  }
}

async function connectAudienceRoom(eventId, videoElement, onState, role = 'viewer', extra = {}) {
  await stopWatching();
  viewerVideoElement = videoElement;
  if (viewerVideoElement) {
    viewerVideoElement.autoplay = true;
    viewerVideoElement.playsInline = true;
    viewerVideoElement.muted = !viewerAudioUnlocked;
  }

  const session = await requestToken(eventId, role, extra);
  const room = new Room({ adaptiveStream: true, dynacast: true, disconnectOnPageLeave: true });

  room.on(RoomEvent.Reconnecting, () => onState('reconnecting'));
  room.on(RoomEvent.Reconnected, () => {
    onState('connected');
    if (viewerAudioUnlocked) resumeViewerAudio().catch(() => {});
  });
  room.on(RoomEvent.Disconnected, () => onState('disconnected'));
  room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
    attachViewerTrack(track, pub, participant, videoElement, onState);
  });
  room.on(RoomEvent.TrackUnsubscribed, track => {
    if (viewerVideoTrack === track) viewerVideoTrack = null;
    if (viewerHostAudioTrack === track) viewerHostAudioTrack = null;
    removeRemoteTrack(track, viewerRemoteMedia);
    viewerAudioTracks = viewerAudioTracks.filter(item => {
      if (item.track !== track) return true;
      try { track.detach(item.element); } catch {}
      try { item.element.remove(); } catch {}
      return false;
    });
  });

  await room.connect(session.wsUrl, session.token, { autoSubscribe: true });
  viewerRoom = room;
  onState('connected');

  room.remoteParticipants.forEach(participant => {
    participant.trackPublications.forEach(pub => {
      if (pub.track) attachViewerTrack(pub.track, pub, participant, videoElement, onState);
    });
  });

  if (viewerAudioUnlocked) await resumeViewerAudio().catch(() => {});
  return room;
}

export async function watchLiveStream(eventId, videoElement, onState = () => {}) {
  return connectAudienceRoom(eventId, videoElement, onState, 'viewer');
}

export async function joinAsSpeaker(eventId, videoElement, { requestId, secret, name }, onState = () => {}) {
  const room = await connectAudienceRoom(eventId, videoElement, onState, 'speaker', { requestId, secret, name });
  let micStream;
  try {
    micStream = await getClearVoiceAudioStream();
    viewerMicTrack = micStream.getAudioTracks()[0] || null;
    if (!viewerMicTrack) throw new Error('No microphone was found.');
    tuneSpeechTrack(viewerMicTrack);
    await room.localParticipant.publishTrack(viewerMicTrack, {
      name: 'guest-microphone',
      source: Track.Source.Microphone,
      dtx: true,
      red: true
    });
    onState('speaking');
    return room;
  } catch (error) {
    micStream?.getTracks().forEach(t => t.stop());
    await stopWatching();
    throw error;
  }
}

export function setSpeakerMuted(muted) {
  if (!viewerMicTrack) return false;
  viewerMicTrack.enabled = !muted;
  return true;
}

export function isSpeakerActive() {
  return Boolean(viewerMicTrack && viewerMicTrack.readyState === 'live');
}

export async function setSpeakerCamera(enabled = true) {
  if (!viewerRoom || !viewerMicTrack) throw new Error('Join as a speaker first.');
  if (!enabled) {
    if (viewerCameraTrack) {
      try { await viewerRoom.localParticipant.unpublishTrack(viewerCameraTrack); } catch {}
      try { viewerCameraTrack.stop(); } catch {}
      viewerCameraTrack = null;
    }
    viewerCameraStream?.getTracks().forEach(t => t.stop());
    viewerCameraStream = null;
    return false;
  }
  if (viewerCameraTrack) return true;

  viewerCameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });
  viewerCameraTrack = viewerCameraStream.getVideoTracks()[0];
  await viewerRoom.localParticipant.publishTrack(viewerCameraTrack, {
    name: 'guest-camera',
    source: Track.Source.Camera,
    simulcast: true
  });
  return true;
}

export async function shareSpeakerScreen() {
  if (!viewerRoom || !viewerMicTrack) throw new Error('Join as a speaker first.');
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen sharing is not supported on this browser.');
  if (viewerScreenTrack) {
    await stopSpeakerScreen();
    return false;
  }

  viewerScreenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  viewerScreenTrack = viewerScreenStream.getVideoTracks()[0];
  viewerScreenTrack.addEventListener('ended', () => stopSpeakerScreen().catch(() => {}), { once: true });
  await viewerRoom.localParticipant.publishTrack(viewerScreenTrack, {
    name: 'guest-screen',
    source: Track.Source.ScreenShare,
    simulcast: true
  });
  return true;
}

export async function stopSpeakerScreen() {
  if (viewerScreenTrack && viewerRoom) {
    try { await viewerRoom.localParticipant.unpublishTrack(viewerScreenTrack); } catch {}
    try { viewerScreenTrack.stop(); } catch {}
  }
  viewerScreenTrack = null;
  viewerScreenStream?.getTracks().forEach(t => t.stop());
  viewerScreenStream = null;
  return false;
}

export async function resumeViewerAudio() {
  viewerAudioUnlocked = true;
  let played = false;

  try {
    if (viewerRoom?.startAudio) {
      await viewerRoom.startAudio();
      played = true;
    }
  } catch {}

  if (viewerVideoElement) {
    try {
      viewerVideoElement.muted = false;
      viewerVideoElement.volume = 1;
      if (await safePlay(viewerVideoElement)) played = true;
    } catch {}
  }

  for (const item of viewerAudioTracks) {
    try {
      item.element.muted = false;
      item.element.volume = 1;
      if (await safePlay(item.element)) played = true;
    } catch {}
  }

  return played;
}

export async function stopWatching() {
  if (viewerCameraTrack) {
    try { await viewerRoom?.localParticipant.unpublishTrack(viewerCameraTrack); } catch {}
    try { viewerCameraTrack.stop(); } catch {}
    viewerCameraTrack = null;
  }
  if (viewerScreenTrack) {
    try { await viewerRoom?.localParticipant.unpublishTrack(viewerScreenTrack); } catch {}
    try { viewerScreenTrack.stop(); } catch {}
    viewerScreenTrack = null;
  }

  viewerCameraStream?.getTracks().forEach(t => t.stop());
  viewerScreenStream?.getTracks().forEach(t => t.stop());
  viewerCameraStream = null;
  viewerScreenStream = null;

  if (viewerMicTrack) {
    try { await viewerRoom?.localParticipant.unpublishTrack(viewerMicTrack); } catch {}
    try { viewerMicTrack.stop(); } catch {}
    viewerMicTrack = null;
  }

  cleanupViewerTracks();
  if (viewerRoom) {
    try { await viewerRoom.disconnect(); } catch {}
    viewerRoom = null;
  }
}
