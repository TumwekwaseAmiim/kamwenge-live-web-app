import {
  watchMeeting,watchComments,addComment,react,watchReactions,
  asDate,getPublicProfile,createSpeakerRequest,watchSpeakerRequest
} from './store.js';
import {
  watchLiveStream,stopWatching,resumeViewerAudio,joinAsSpeaker,setSpeakerMuted,isSpeakerActive,
  setSpeakerCamera,shareSpeakerScreen,setViewerGuestContainer
} from './streaming-adapter.js';
import {escapeHTML,formatDate,toast} from './app.js';

const SHARE_WORKER='https://rwamwanja-kamwenge-live.tumwekwaseamiim.workers.dev';
const id=new URLSearchParams(location.search).get('event');
const avatar='assets/images/avatar-placeholder.svg';
let meeting=null,commentsUnsub=()=>{},reactionUnsub=()=>{},watchingEventId=null;
let speakerRequestUnsub=()=>{},speakerRequestId=null,speakerSecret=null,speakerMuted=false,speakerCameraOn=false,speakerScreenOn=false;

const els={
  title:document.querySelector('#event-title'),host:document.querySelector('#event-host'),hostPhoto:document.querySelector('#event-host-photo'),hostBio:document.querySelector('#event-host-bio'),date:document.querySelector('#event-date'),status:document.querySelector('#event-status'),countdown:document.querySelector('#countdown'),pre:document.querySelector('#pre-live'),live:document.querySelector('#live-stage'),ended:document.querySelector('#ended-stage'),comments:document.querySelector('#comments'),compose:document.querySelector('#comment-form'),video:document.querySelector('#viewer-video'),placeholder:document.querySelector('#viewer-placeholder'),reactions:document.querySelector('#reaction-row'),share:document.querySelector('#share-event'),sound:document.querySelector('#enable-sound'),fullscreen:document.querySelector('#viewer-fullscreen'),videoShell:document.querySelector('.video-shell'),guestMedia:document.querySelector('#viewer-guest-media'),speakerName:document.querySelector('#speaker-name'),requestSpeak:document.querySelector('#request-to-speak'),speakerState:document.querySelector('#speaker-request-state'),speakerForm:document.querySelector('#speaker-request-form'),speakerActions:document.querySelector('#speaker-join-actions'),joinSpeaker:document.querySelector('#join-speaker'),muteSpeaker:document.querySelector('#mute-speaker'),speakerCamera:document.querySelector('#speaker-camera'),speakerScreen:document.querySelector('#speaker-screen'),leaveSpeaker:document.querySelector('#leave-speaker')
};
setViewerGuestContainer(els.guestMedia);

async function enableViewerSound(){try{await resumeViewerAudio();els.sound.textContent='🔊 Sound On';els.sound.classList.add('sound-on');toast('Live sound enabled 🔊');}catch{toast('Tap again to enable live sound.')}}
els.sound?.addEventListener('click',enableViewerSound);els.video?.addEventListener('click',()=>resumeViewerAudio().catch(()=>{}));
async function toggleFullscreen(target=els.videoShell||els.video){if(!target)return;try{if(document.fullscreenElement||document.webkitFullscreenElement){if(document.exitFullscreen)await document.exitFullscreen();else document.webkitExitFullscreen?.();return;}if(target.requestFullscreen)await target.requestFullscreen();else if(target.webkitRequestFullscreen)target.webkitRequestFullscreen();else if(els.video?.webkitEnterFullscreen)els.video.webkitEnterFullscreen();else toast('Fullscreen is not supported by this browser.');}catch{toast('Could not open fullscreen on this device.')}}
els.fullscreen?.addEventListener('click',()=>toggleFullscreen());

function diffText(date){let seconds=Math.max(0,Math.floor((date-Date.now())/1000));const days=Math.floor(seconds/86400);seconds%=86400;const hours=Math.floor(seconds/3600);seconds%=3600;const minutes=Math.floor(seconds/60),secs=seconds%60;return `${days?String(days).padStart(2,'0')+':':''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;}
function setViewerPlaceholder(title,text){if(!els.placeholder)return;els.placeholder.classList.remove('hidden');const h=els.placeholder.querySelector('h2'),p=els.placeholder.querySelector('p');if(h)h.textContent=title;if(p)p.textContent=text;}
async function ensureWatching(m){
  if(m.status!=='live'){if(watchingEventId){await stopWatching().catch(()=>{});watchingEventId=null;}return;}
  if(watchingEventId===m.id)return;watchingEventId=m.id;setViewerPlaceholder('Connecting to live video…','The broadcaster is live. Video will start automatically.');
  try{await watchLiveStream(m.id,els.video,state=>{if(state==='playing')els.placeholder?.classList.add('hidden');if(state==='reconnecting')setViewerPlaceholder('Reconnecting…','Please wait while Kamwenge Live reconnects.');if(state==='disconnected')setViewerPlaceholder('Connection interrupted','Trying to reconnect to the live room…');});}catch(error){watchingEventId=null;setViewerPlaceholder('Live video unavailable',error.message);}
}
async function render(m){
  meeting=m;if(!m){els.title.textContent='Event not found';return;}
  els.title.textContent=m.title||'Kamwenge Live Event';els.host.textContent=m.hostName||'Broadcaster';const miniHost=document.querySelector('#event-host-mini');if(miniHost)miniHost.textContent=m.hostName||'Broadcaster';els.hostPhoto.src=m.hostPhotoURL||avatar;els.date.textContent=formatDate(asDate(m.scheduledAt)||m.scheduledAt);
  const profile=await getPublicProfile(m.hostId).catch(()=>null),displayName=profile?.displayName||m.hostName||'Broadcaster';els.host.textContent=displayName;if(miniHost)miniHost.textContent=displayName;els.hostPhoto.src=profile?.photoURL||m.hostPhotoURL||avatar;els.hostBio.textContent=profile?.bio||'Kamwenge Live broadcaster';
  els.pre?.classList.toggle('hidden',m.status!=='scheduled');els.live?.classList.toggle('hidden',m.status!=='live');els.ended?.classList.toggle('hidden',m.status!=='ended');els.status.className=`badge ${m.status==='live'?'badge-live':m.status==='ended'?'badge-ended':'badge-upcoming'}`;els.status.textContent=m.status==='live'?'🔴 LIVE NOW':m.status==='ended'?'✅ ENDED':'⏳ UPCOMING';
  await ensureWatching(m);commentsUnsub();if(m.commentsEnabled!==false)commentsUnsub=watchComments(m.id,renderComments);else els.comments.innerHTML='<div class="muted center">Comments are disabled for this event.</div>';reactionUnsub();reactionUnsub=watchReactions(m.id,renderReactions);
  if(m.status!=='live'&&isSpeakerActive()){await stopWatching().catch(()=>{});watchingEventId=null;resetSpeakerUi('Broadcast ended.');}
}
function renderComments(items){if(!items.length){els.comments.innerHTML='<div class="muted center">No comments yet. Start the discussion 💬</div>';return;}els.comments.innerHTML=items.map(c=>`<div class="comment"><div class="comment-top"><span class="comment-name">${escapeHTML(c.name||'Guest')}</span></div><p>${escapeHTML(c.text)}</p></div>`).join('');els.comments.scrollTop=els.comments.scrollHeight;}
function renderReactions(counts){els.reactions?.querySelectorAll('button').forEach(button=>{const emoji=button.dataset.emoji,number=counts[encodeURIComponent(emoji)]||counts[emoji]||0,span=button.querySelector('span');if(span)span.textContent=number?` ${number}`:'';});}
els.compose?.addEventListener('submit',async e=>{e.preventDefault();if(!meeting||meeting.commentsEnabled===false)return;const name=document.querySelector('#comment-name')?.value.trim()||'Viewer',input=document.querySelector('#comment-text'),text=input?.value.trim();if(!text)return;try{await addComment(meeting.id,{name,text});input.value='';if(els.speakerName&&!els.speakerName.value)els.speakerName.value=name;}catch(error){toast(error.message);}});
els.reactions?.addEventListener('click',async e=>{const button=e.target.closest('button[data-emoji]');if(!button||!meeting)return;try{await react(meeting.id,button.dataset.emoji);button.animate([{transform:'scale(1)'},{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:240});}catch(error){toast(error.message);}});

function randomSecret(){const a=new Uint8Array(24);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');}
async function hashSecret(value){const data=new TextEncoder().encode(value),hash=await crypto.subtle.digest('SHA-256',data);return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
function showSpeakerState(text,type=''){els.speakerState.textContent=text;els.speakerState.className=`speaker-state ${type}`.trim();}
function setSpeakingControls(active){els.joinSpeaker?.classList.toggle('hidden',active);for(const x of [els.muteSpeaker,els.speakerCamera,els.speakerScreen,els.leaveSpeaker])x?.classList.toggle('hidden',!active);}
function resetSpeakerUi(message=''){speakerRequestUnsub();speakerRequestUnsub=()=>{};speakerRequestId=null;speakerSecret=null;speakerMuted=false;speakerCameraOn=false;speakerScreenOn=false;els.speakerForm?.classList.remove('hidden');els.speakerActions?.classList.add('hidden');setSpeakingControls(false);if(message)showSpeakerState(message);else els.speakerState?.classList.add('hidden');}

els.requestSpeak?.addEventListener('click',async()=>{if(!meeting||meeting.status!=='live')return toast('The broadcast is not live yet.');const name=els.speakerName?.value.trim()||document.querySelector('#comment-name')?.value.trim()||'Viewer';try{els.requestSpeak.disabled=true;els.requestSpeak.textContent='Sending…';speakerSecret=randomSecret();speakerRequestId=await createSpeakerRequest(meeting.id,{name,secretHash:await hashSecret(speakerSecret)});els.speakerForm.classList.add('hidden');showSpeakerState('⏳ Request sent. Waiting for the broadcaster…');speakerRequestUnsub();speakerRequestUnsub=watchSpeakerRequest(meeting.id,speakerRequestId,async r=>{if(!r)return;if(r.status==='approved'){showSpeakerState('✅ Approved! Tap Join Microphone when you are ready.','approved');els.speakerActions.classList.remove('hidden');}if(r.status==='declined'||r.status==='removed'){if(isSpeakerActive()){await stopWatching().catch(()=>{});watchingEventId=null;await ensureWatching(meeting).catch(()=>{});}showSpeakerState(r.status==='removed'?'Your speaking access has ended.':'The broadcaster declined this request.','declined');setSpeakingControls(false);}});}catch(error){speakerSecret=null;speakerRequestId=null;toast(error.message);}finally{els.requestSpeak.disabled=false;els.requestSpeak.textContent='🎤 Request to Speak';}});

els.joinSpeaker?.addEventListener('click',async()=>{if(!meeting||!speakerRequestId||!speakerSecret)return;try{els.joinSpeaker.disabled=true;els.joinSpeaker.textContent='Joining…';await joinAsSpeaker(meeting.id,els.video,{requestId:speakerRequestId,secret:speakerSecret,name:els.speakerName?.value.trim()||'Guest speaker'},state=>{if(state==='playing')els.placeholder?.classList.add('hidden');});watchingEventId=meeting.id;setSpeakingControls(true);showSpeakerState('🎙️ You are now speaking live. Your microphone has clear-voice noise suppression enabled.','approved');await resumeViewerAudio();}catch(error){toast(error.message);}finally{els.joinSpeaker.disabled=false;els.joinSpeaker.textContent='🎙️ Join Microphone';}});
els.muteSpeaker?.addEventListener('click',()=>{speakerMuted=!speakerMuted;if(!setSpeakerMuted(speakerMuted))return;els.muteSpeaker.textContent=speakerMuted?'🎤 Unmute Me':'🔇 Mute Me';});
els.speakerCamera?.addEventListener('click',async()=>{try{speakerCameraOn=await setSpeakerCamera(!speakerCameraOn);els.speakerCamera.textContent=speakerCameraOn?'📹 Stop Camera':'📹 Camera';toast(speakerCameraOn?'Camera shared with the live room.':'Camera stopped.');}catch(e){toast(e.message);}});
els.speakerScreen?.addEventListener('click',async()=>{try{speakerScreenOn=await shareSpeakerScreen();els.speakerScreen.textContent=speakerScreenOn?'🛑 Stop Screen':'🖥️ Share Screen';}catch(e){toast(e.message);}});
els.leaveSpeaker?.addEventListener('click',async()=>{await stopWatching().catch(()=>{});watchingEventId=null;setSpeakingControls(false);showSpeakerState('You left the microphone. You can rejoin while approval remains active.','approved');await ensureWatching(meeting).catch(()=>{});});

els.share?.addEventListener('click',async()=>{if(!meeting)return;const url=`${SHARE_WORKER}/?event=${encodeURIComponent(meeting.id)}`;try{if(navigator.share){await navigator.share({title:`${meeting.title||'Kamwenge Live Event'} • Kamwenge Live™`,text:'Watch or join this live event on Kamwenge Live™',url});}else{await navigator.clipboard.writeText(url);toast('Event link copied 🔗');}}catch(e){if(e?.name!=='AbortError')toast('Could not share this event.');}});

if(id){watchMeeting(id,render,error=>toast(error.message));setInterval(()=>{if(meeting?.status==='scheduled'){const d=asDate(meeting.scheduledAt);if(d)els.countdown.textContent=diffText(d);}},1000);}else{els.title.textContent='Event not found';}
window.addEventListener('pagehide',()=>stopWatching().catch(()=>{}));
