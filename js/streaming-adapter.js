import { auth } from './firebase-core.js';
import { livekitConfig, livekitConfigured } from './media-config.js';
import { Room, RoomEvent, Track } from 'https://cdn.jsdelivr.net/npm/livekit-client@2.15.6/+esm';

let publisherRoom=null;
let publisherTracks=[];
let studioParticipantListener=()=>{};
let studioGuestContainer=null;
let studioRemoteMedia=new Map();

let viewerRoom=null;
let viewerVideoTrack=null;
let viewerAudioTracks=[];
let viewerMicTrack=null;
let viewerCameraTrack=null;
let viewerScreenTrack=null;
let viewerCameraStream=null;
let viewerScreenStream=null;
let viewerGuestContainer=null;
let viewerRemoteMedia=new Map();

function safePlay(el){el.play().catch(()=>{});}

export function clearVoiceConstraints(){
  const supported=navigator.mediaDevices?.getSupportedConstraints?.()||{};
  const audio={echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1};
  if(supported.sampleRate)audio.sampleRate={ideal:48000};
  if(supported.sampleSize)audio.sampleSize={ideal:16};
  if(supported.voiceIsolation)audio.voiceIsolation=true;
  return audio;
}

function tuneSpeechTrack(track){
  if(!track)return;
  try{track.contentHint='speech';}catch{}
  try{track.applyConstraints(clearVoiceConstraints()).catch(()=>{});}catch{}
}

async function requestToken(eventId,role,extra={}){
  if(!livekitConfigured)throw new Error('Live video is not configured yet.');
  if(!eventId)throw new Error('Event ID is required for live streaming.');
  const headers={'Content-Type':'application/json'};
  if(role==='publisher'){
    const user=auth?.currentUser;
    if(!user)throw new Error('Broadcaster authentication is required.');
    headers.Authorization=`Bearer ${await user.getIdToken()}`;
  }
  const endpoint=role==='speaker'?(livekitConfig.speakerTokenEndpoint||livekitConfig.tokenEndpoint):livekitConfig.tokenEndpoint;
  const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({eventId,role,...extra})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data?.error||'Could not create a live streaming session.');
  if(!data.token||!data.wsUrl)throw new Error('Streaming server returned an incomplete session.');
  return data;
}

function mediaCardKey(track,participant){return `${participant.identity}:${track.sid||track.mediaStreamTrack?.id||crypto.randomUUID()}`;}
function createRemoteMediaCard(track,participant,container,map,label){
  if(!container)return;
  const key=mediaCardKey(track,participant);
  container.classList.remove('hidden');
  const card=document.createElement('article'); card.className='guest-media-card'; card.dataset.remoteKey=key;
  const head=document.createElement('div'); head.className='guest-media-head'; head.textContent=`${label} ${participant.name||participant.identity}`;
  const media=track.attach(); media.autoplay=true; media.playsInline=true; media.className='guest-media-video';
  media.addEventListener('click',async()=>{try{if(media.requestFullscreen)await media.requestFullscreen();else media.webkitEnterFullscreen?.();}catch{}});
  card.append(head,media); container.appendChild(card); safePlay(media); map.set(key,{track,element:media,card});
}
function removeRemoteTrack(track,map){
  for(const [key,item] of map){if(item.track===track){const parent=item.card?.parentElement;try{track.detach(item.element);}catch{};item.card?.remove();map.delete(key);if(parent&&!parent.children.length)parent.classList.add('hidden');}}
}

function clearRemoteMedia(map){for(const item of map.values()){try{item.track.detach(item.element);}catch{};item.card?.remove();}map.clear();studioGuestContainer?.classList.add('hidden');viewerGuestContainer?.classList.add('hidden');}

export function setStudioGuestContainer(el){studioGuestContainer=el;}
export function setViewerGuestContainer(el){viewerGuestContainer=el;}

function emitStudioParticipants(){
  if(!publisherRoom)return studioParticipantListener([]);
  const list=[];publisherRoom.remoteParticipants.forEach(p=>list.push({identity:p.identity,name:p.name||p.identity}));studioParticipantListener(list);
}
function attachStudioRemoteTrack(track,_publication,participant){
  if(track.kind===Track.Kind.Audio){const el=track.attach();el.autoplay=true;el.playsInline=true;el.style.display='none';el.dataset.kamwengeStudioGuestAudio='1';document.body.appendChild(el);safePlay(el);publisherRoom?.startAudio?.().catch(()=>{});studioRemoteMedia.set(mediaCardKey(track,participant),{track,element:el,card:null});return;}
  if(track.kind===Track.Kind.Video)createRemoteMediaCard(track,participant,studioGuestContainer,studioRemoteMedia,'🎥');
}

export function onStudioParticipantChange(callback){studioParticipantListener=typeof callback==='function'?callback:()=>{};emitStudioParticipants();}

export async function moderateParticipant(eventId,participantIdentity){
  const user=auth?.currentUser;if(!user)throw new Error('Broadcaster authentication is required.');
  const response=await fetch(livekitConfig.tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${await user.getIdToken()}`},body:JSON.stringify({action:'removeParticipant',eventId,participantIdentity})});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||'Could not remove the speaker.');return data;
}

export async function publishStream(eventId,mediaStream){
  if(!mediaStream||!mediaStream.getTracks().length)throw new Error('No camera or screen stream is active.');
  await stopPublish();
  const session=await requestToken(eventId,'publisher');
  const room=new Room({adaptiveStream:true,dynacast:true});
  room.on(RoomEvent.Connected,()=>{emitStudioParticipants();room.startAudio?.().catch(()=>{});});
  room.on(RoomEvent.ParticipantConnected,emitStudioParticipants);room.on(RoomEvent.ParticipantDisconnected,emitStudioParticipants);
  room.on(RoomEvent.TrackSubscribed,(track,pub,participant)=>attachStudioRemoteTrack(track,pub,participant));
  room.on(RoomEvent.TrackUnsubscribed,track=>removeRemoteTrack(track,studioRemoteMedia));
  await room.connect(session.wsUrl,session.token);publisherRoom=room;publisherTracks=[];
  for(const videoTrack of mediaStream.getVideoTracks().filter(t=>t.readyState==='live')){await room.localParticipant.publishTrack(videoTrack,{name:'main-video',source:Track.Source.Camera,simulcast:true});publisherTracks.push(videoTrack);}
  for(const audioTrack of mediaStream.getAudioTracks().filter(t=>t.readyState==='live')){tuneSpeechTrack(audioTrack);await room.localParticipant.publishTrack(audioTrack,{name:'main-audio',source:Track.Source.Microphone});publisherTracks.push(audioTrack);}
  emitStudioParticipants();return{room};
}
export async function replacePublishedStream(eventId,mediaStream){return publishStream(eventId,mediaStream);}
export async function stopPublish(){
  clearRemoteMedia(studioRemoteMedia);
  if(!publisherRoom){publisherTracks=[];emitStudioParticipants();return;}
  try{for(const track of publisherTracks){try{await publisherRoom.localParticipant.unpublishTrack(track);}catch{}}await publisherRoom.disconnect();}catch(error){console.warn('Publisher disconnect warning:',error);}
  publisherRoom=null;publisherTracks=[];emitStudioParticipants();
}

function cleanupViewerTracks(){
  if(viewerVideoTrack){try{viewerVideoTrack.detach();}catch{}viewerVideoTrack=null;}
  for(const item of viewerAudioTracks){try{item.track.detach(item.element);}catch{};try{item.element.pause();item.element.srcObject=null;item.element.remove();}catch{}}viewerAudioTracks=[];clearRemoteMedia(viewerRemoteMedia);
}
function attachViewerTrack(track,publication,participant,videoElement,onState){
  if(track.kind===Track.Kind.Video){
    if(participant.identity.startsWith('host-')){if(viewerVideoTrack&&viewerVideoTrack!==track){try{viewerVideoTrack.detach(videoElement);}catch{}}viewerVideoTrack=track;track.attach(videoElement);safePlay(videoElement);onState('playing');}
    else if(participant.identity.startsWith('speaker-')){const label=publication?.source===Track.Source.ScreenShare?'🖥️ Shared screen •':'🎥 Guest •';createRemoteMediaCard(track,participant,viewerGuestContainer,viewerRemoteMedia,label);}
    return;
  }
  if(track.kind===Track.Kind.Audio){const el=track.attach();el.autoplay=true;el.playsInline=true;el.dataset.kamwengeLiveAudio='1';el.style.display='none';document.body.appendChild(el);viewerAudioTracks.push({track,element:el,participantId:participant.identity});safePlay(el);}
}
async function connectAudienceRoom(eventId,videoElement,onState,role='viewer',extra={}){
  await stopWatching();const session=await requestToken(eventId,role,extra);const room=new Room({adaptiveStream:true,dynacast:true});
  room.on(RoomEvent.Reconnecting,()=>onState('reconnecting'));room.on(RoomEvent.Reconnected,()=>onState('connected'));room.on(RoomEvent.Disconnected,()=>onState('disconnected'));
  room.on(RoomEvent.TrackSubscribed,(track,pub,participant)=>attachViewerTrack(track,pub,participant,videoElement,onState));
  room.on(RoomEvent.TrackUnsubscribed,track=>{if(viewerVideoTrack===track)viewerVideoTrack=null;removeRemoteTrack(track,viewerRemoteMedia);viewerAudioTracks=viewerAudioTracks.filter(item=>{if(item.track!==track)return true;try{track.detach(item.element);item.element.remove();}catch{}return false;});});
  await room.connect(session.wsUrl,session.token);viewerRoom=room;onState('connected');room.remoteParticipants.forEach(participant=>participant.trackPublications.forEach(pub=>{if(pub.track)attachViewerTrack(pub.track,pub,participant,videoElement,onState);}));return room;
}
export async function watchLiveStream(eventId,videoElement,onState=()=>{}){return connectAudienceRoom(eventId,videoElement,onState,'viewer');}
export async function joinAsSpeaker(eventId,videoElement,{requestId,secret,name},onState=()=>{}){
  const room=await connectAudienceRoom(eventId,videoElement,onState,'speaker',{requestId,secret,name});
  try{const mic=await navigator.mediaDevices.getUserMedia({audio:clearVoiceConstraints(),video:false});viewerMicTrack=mic.getAudioTracks()[0]||null;if(!viewerMicTrack)throw new Error('No microphone was found.');tuneSpeechTrack(viewerMicTrack);await room.localParticipant.publishTrack(viewerMicTrack,{name:'guest-microphone',source:Track.Source.Microphone});onState('speaking');return room;}catch(error){await stopWatching();throw error;}
}
export function setSpeakerMuted(muted){if(!viewerMicTrack)return false;viewerMicTrack.enabled=!muted;return true;}
export function isSpeakerActive(){return Boolean(viewerMicTrack&&viewerMicTrack.readyState==='live');}

export async function setSpeakerCamera(enabled=true){
  if(!viewerRoom||!viewerMicTrack)throw new Error('Join as a speaker first.');
  if(!enabled){if(viewerCameraTrack){try{await viewerRoom.localParticipant.unpublishTrack(viewerCameraTrack);}catch{};viewerCameraTrack.stop();viewerCameraTrack=null;}viewerCameraStream?.getTracks().forEach(t=>t.stop());viewerCameraStream=null;return false;}
  if(viewerCameraTrack)return true;
  viewerCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720}},audio:false});viewerCameraTrack=viewerCameraStream.getVideoTracks()[0];
  await viewerRoom.localParticipant.publishTrack(viewerCameraTrack,{name:'guest-camera',source:Track.Source.Camera,simulcast:true});return true;
}
export async function shareSpeakerScreen(){
  if(!viewerRoom||!viewerMicTrack)throw new Error('Join as a speaker first.');
  if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen sharing is not supported on this browser.');
  if(viewerScreenTrack){await stopSpeakerScreen();return false;}
  viewerScreenStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});viewerScreenTrack=viewerScreenStream.getVideoTracks()[0];
  viewerScreenTrack.addEventListener('ended',()=>stopSpeakerScreen().catch(()=>{}),{once:true});await viewerRoom.localParticipant.publishTrack(viewerScreenTrack,{name:'guest-screen',source:Track.Source.ScreenShare,simulcast:true});return true;
}
export async function stopSpeakerScreen(){if(viewerScreenTrack&&viewerRoom){try{await viewerRoom.localParticipant.unpublishTrack(viewerScreenTrack);}catch{};try{viewerScreenTrack.stop();}catch{}}viewerScreenTrack=null;viewerScreenStream?.getTracks().forEach(t=>t.stop());viewerScreenStream=null;return false;}

export async function resumeViewerAudio(){let played=false;try{if(viewerRoom?.startAudio){await viewerRoom.startAudio();played=true;}}catch{}for(const item of viewerAudioTracks){try{item.element.muted=false;item.element.volume=1;await item.element.play();played=true;}catch{}}return played;}
export async function stopWatching(){
  if(viewerCameraTrack){try{await viewerRoom?.localParticipant.unpublishTrack(viewerCameraTrack);}catch{};try{viewerCameraTrack.stop();}catch{}viewerCameraTrack=null;}
  if(viewerScreenTrack){try{await viewerRoom?.localParticipant.unpublishTrack(viewerScreenTrack);}catch{};try{viewerScreenTrack.stop();}catch{}viewerScreenTrack=null;}
  viewerCameraStream?.getTracks().forEach(t=>t.stop());viewerScreenStream?.getTracks().forEach(t=>t.stop());viewerCameraStream=null;viewerScreenStream=null;
  if(viewerMicTrack){try{viewerMicTrack.stop();}catch{}viewerMicTrack=null;}cleanupViewerTracks();if(viewerRoom){try{await viewerRoom.disconnect();}catch{}viewerRoom=null;}
}
