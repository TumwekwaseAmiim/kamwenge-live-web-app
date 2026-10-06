import {getMeeting,updateMeeting,watchMeeting,watchComments,watchSpeakerRequests,updateSpeakerRequest} from './store.js';
import {requireBroadcaster} from './auth.js';
import {publishStream,replacePublishedStream,stopPublish,onStudioParticipantChange,moderateParticipant,setStudioGuestContainer,clearVoiceConstraints,resumeStudioAudio} from './streaming-adapter.js';
import {escapeHTML,toast} from './app.js';

const MAX_SPEAKERS=4;
const ACTIVE_EVENT_KEY='kamwengeLiveActiveEvent';
const SHARE_WORKER='https://rwamwanja-kamwenge-live.tumwekwaseamiim.workers.dev';
const eventId=new URLSearchParams(location.search).get('event');
const video=document.querySelector('#studio-video'),placeholder=document.querySelector('#studio-placeholder'),sourceLabel=document.querySelector('#source-label'),videoShell=video?.closest('.video-shell');
const startBtn=document.querySelector('#start-camera'),switchBtn=document.querySelector('#switch-camera'),screenBtn=document.querySelector('#share-screen'),fullscreenBtn=document.querySelector('#studio-fullscreen'),micBtn=document.querySelector('#toggle-mic'),guestAudioBtn=document.querySelector('#studio-audio'),liveBtn=document.querySelector('#go-live'),endBtn=document.querySelector('#end-live');
const recordBtn=document.querySelector('#record-device'),recordState=document.querySelector('#record-state'),storageText=document.querySelector('#storage-text'),storageBar=document.querySelector('#storage-bar'),comments=document.querySelector('#studio-comments');
const requestList=document.querySelector('#speaker-requests'),activeSpeakers=document.querySelector('#active-speakers'),speakerCount=document.querySelector('#speaker-count'),guestMedia=document.querySelector('#studio-guest-media');
const shareTitle=document.querySelector('#share-event-title'),shareDescription=document.querySelector('#share-event-description'),shareLinkInput=document.querySelector('#share-event-link'),copyShareBtn=document.querySelector('#copy-share-link'),whatsAppBtn=document.querySelector('#share-whatsapp'),nativeShareBtn=document.querySelector('#share-native'),shareStatus=document.querySelector('#share-event-status'),publicLink=document.querySelector('#public-link');
let session,meeting,cameraStream=null,currentStream=null,facing='environment',recorder=null,writable=null,recording=false,recordTimer=null,recordStartedAt=0,publishing=false;
let speakerRequests=[],roomParticipants=[];
function saveActiveEvent(){if(!meeting?.id)return;localStorage.setItem(ACTIVE_EVENT_KEY,JSON.stringify({eventId:meeting.id,status:'live',role:'broadcaster',updatedAt:Date.now()}));}
function clearActiveEvent(){localStorage.removeItem(ACTIVE_EVENT_KEY);}
setStudioGuestContainer(guestMedia);

(async()=>{try{session=await requireBroadcaster();meeting=await getMeeting(eventId);if(!meeting)throw new Error('Event not found.');if(meeting.hostId!==session.user.uid&&session.profile.role!=='admin')throw new Error('You do not own this broadcast.');document.querySelector('#studio-host-photo').src=session.profile.photoURL||'assets/images/avatar-placeholder.svg';document.querySelector('#studio-host-name').textContent=session.profile.displayName||session.user.email;watchMeeting(meeting.id,syncEvent);if(meeting.status==='live')saveActiveEvent();watchComments(meeting.id,renderComments);watchSpeakerRequests(meeting.id,items=>{speakerRequests=items;renderSpeakerManager();});onStudioParticipantChange(items=>{roomParticipants=items;renderSpeakerManager();});}catch(e){toast(e.message);setTimeout(()=>location.href='dashboard.html',1200)}})();


async function enableStudioGuestSound(){
  try{
    await resumeStudioAudio();
    if(guestAudioBtn){guestAudioBtn.textContent='🔊 Guest Sound On';guestAudioBtn.classList.add('active');}
  }catch{toast('Tap again to enable guest sound.');}
}
guestAudioBtn?.addEventListener('click',enableStudioGuestSound);
copyShareBtn?.addEventListener('click',async()=>{
  if(!meeting)return;
  const link=brandedShareUrl(meeting);
  try{await navigator.clipboard.writeText(link);toast('Branded event link copied ✅');}
  catch{shareLinkInput?.select();document.execCommand?.('copy');toast('Event link copied ✅');}
});
whatsAppBtn?.addEventListener('click',()=>{
  if(!meeting)return;
  const url=`https://wa.me/?text=${encodeURIComponent(shareMessage(meeting))}`;
  window.open(url,'_blank','noopener');
});
nativeShareBtn?.addEventListener('click',async()=>{
  if(!meeting)return;
  const url=brandedShareUrl(meeting),text=String(meeting.description||'Join this live event on Kamwenge Live™.').trim();
  if(navigator.share){
    try{await navigator.share({title:meeting.title||'Kamwenge Live Event',text,url});return;}catch(e){if(e?.name==='AbortError')return;}
  }
  try{await navigator.clipboard.writeText(shareMessage(meeting));toast('Share text copied ✅');}
  catch{toast('Use Copy Link or WhatsApp to share this event.');}
});

// Any deliberate tap in Studio is also a chance to satisfy mobile browser audio policies.
document.addEventListener('pointerdown',()=>{if(publishing)resumeStudioAudio().catch(()=>{});},{passive:true});

function setPreview(stream,label){currentStream=stream;video.srcObject=stream;video.muted=true;video.play().catch(()=>{});placeholder.classList.add('hidden');sourceLabel.textContent=label;}
async function refreshPublicStream(){if(!publishing||!meeting||!currentStream)return;try{sourceLabel.textContent+=' • updating viewers…';await replacePublishedStream(meeting.id,currentStream);toast('Live source changed for viewers ✅');}catch(e){toast(e.message);}}
async function openCamera(){
  cameraStream?.getTracks().forEach(t=>t.stop());
  const videoConstraints={facingMode:{ideal:facing},width:{ideal:1920,max:1920},height:{ideal:1080,max:1080},frameRate:{ideal:30,max:30}};
  const attempts=[
    {video:videoConstraints,audio:clearVoiceConstraints()},
    {video:videoConstraints,audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}},
    {video:videoConstraints,audio:true}
  ];
  let lastError;
  for(const constraints of attempts){
    try{
      cameraStream=await navigator.mediaDevices.getUserMedia(constraints);
      if(!cameraStream.getAudioTracks().length){cameraStream.getTracks().forEach(t=>t.stop());continue;}
      cameraStream.getAudioTracks().forEach(t=>{try{t.contentHint='speech';}catch{}});
      setPreview(cameraStream,facing==='environment'?'📷 Back camera • Clear Voice':'🤳 Front camera • Clear Voice');
      await refreshPublicStream();
      return true;
    }catch(e){lastError=e;}
  }
  console.error('Camera/microphone start failed:',lastError);
  toast('Allow both camera and microphone, then try again.');
  return false;
}
startBtn.onclick=openCamera;switchBtn.onclick=async()=>{facing=facing==='environment'?'user':'environment';await openCamera();};
micBtn.onclick=()=>{const t=currentStream?.getAudioTracks?.()[0];if(!t)return toast('No microphone is active.');t.enabled=!t.enabled;micBtn.textContent=t.enabled?'🎤 Mute':'🔇 Unmute';micBtn.classList.toggle('active',!t.enabled);};
if(screenBtn&&!navigator.mediaDevices?.getDisplayMedia){screenBtn.disabled=true;screenBtn.textContent='🖥️ No Screen Share';screenBtn.title='This browser does not support screen sharing. Use a supported desktop browser if you need it.';}
screenBtn.onclick=async()=>{if(!navigator.mediaDevices?.getDisplayMedia)return toast('Screen sharing is not supported in this browser. Camera and microphone still work normally.');try{const screen=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:20,max:30}},audio:false});const mic=cameraStream?.getAudioTracks()?.[0];if(mic)screen.addTrack(mic);setPreview(screen,'🖥️ Shared screen • Microphone live');await refreshPublicStream();screen.getVideoTracks()[0].addEventListener('ended',async()=>{if(cameraStream){setPreview(cameraStream,facing==='environment'?'📷 Back camera • Clear Voice':'🤳 Front camera • Clear Voice');await refreshPublicStream();}},{once:true});}catch(e){if(e?.name!=='AbortError')toast('Could not start screen sharing.');}};
fullscreenBtn?.addEventListener('click',async()=>{const target=videoShell||video;try{if(document.fullscreenElement||document.webkitFullscreenElement){if(document.exitFullscreen)await document.exitFullscreen();else document.webkitExitFullscreen?.();return;}if(target?.requestFullscreen)await target.requestFullscreen();else if(target?.webkitRequestFullscreen)target.webkitRequestFullscreen();else if(video?.webkitEnterFullscreen)video.webkitEnterFullscreen();else toast('Fullscreen is not supported on this device.');}catch{toast('Could not open fullscreen.');}});

function formatShareDate(value){
  if(!value)return '';
  const d=typeof value?.toDate==='function'?value.toDate():new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  return new Intl.DateTimeFormat('en-UG',{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Africa/Kampala'}).format(d);
}
function brandedShareUrl(m){
  const base=String(m?.shareUrl||`${SHARE_WORKER}/${encodeURIComponent(m?.id||eventId||'')}`).replace(/[?&]v=[^&]*/g,'');
  const version=m?.updatedAt?.seconds||m?.updatedAt?.toMillis?.()||Date.now();
  return `${base}${base.includes('?')?'&':'?'}v=${encodeURIComponent(version)}`;
}
function shareMessage(m){
  const title=String(m?.title||'Kamwenge Live Event').trim();
  const desc=String(m?.description||'Join this live event on Kamwenge Live™.').trim();
  const when=formatShareDate(m?.scheduledAt);
  const link=brandedShareUrl(m);
  return `${title}\n${desc}${when?`\n📅 ${when}`:''}\n\nWatch on Kamwenge Live™:\n${link}`;
}
function renderSharePanel(m){
  if(!m)return;
  const link=brandedShareUrl(m);
  const desc=String(m.description||'Join this live event on Kamwenge Live™.').trim();
  if(shareTitle)shareTitle.textContent=m.title||'Kamwenge Live Event';
  if(shareDescription)shareDescription.textContent=desc;
  if(shareLinkInput)shareLinkInput.value=link;
  if(shareStatus)shareStatus.textContent=m.status==='live'?'🔴 LIVE':m.status==='ended'?'Ended':'Upcoming';
  if(publicLink)publicLink.href=`live.html?event=${encodeURIComponent(m.id)}`;
}
function syncEvent(m){if(!m)return;meeting=m;if(m.status==='live')saveActiveEvent();else if(m.status==='ended')clearActiveEvent();document.querySelector('#studio-title').textContent=m.title;const live=m.status==='live';liveBtn.classList.toggle('hidden',live);endBtn.classList.toggle('hidden',!live);document.querySelector('#studio-live-badge').classList.toggle('hidden',!live);renderSharePanel(m);}
liveBtn.onclick=async()=>{if(!meeting)return;if(!currentStream&&!(await openCamera()))return;try{liveBtn.disabled=true;liveBtn.textContent='Connecting…';await publishStream(meeting.id,currentStream);publishing=true;saveActiveEvent();await resumeStudioAudio().catch(()=>{});await updateMeeting(meeting.id,{status:'live',liveStartedAt:new Date().toISOString(),mediaType:'livekit'});toast('You are LIVE 🔴');}catch(e){await stopPublish().catch(()=>{});publishing=false;toast(e.message);}finally{liveBtn.disabled=false;liveBtn.textContent='🔴 Go Live';}};
endBtn.onclick=async()=>{try{await stopPublish();publishing=false;clearActiveEvent();await updateMeeting(meeting.id,{status:'ended',endedAt:new Date().toISOString()});if(recording)await stopRecording('Broadcast ended. Local recording finalized.');toast('Broadcast ended ✅ It will disappear from listings after 24 hours.');}catch(e){toast(e.message)}};

function renderComments(cs){comments.innerHTML=cs.length?cs.slice(-40).map(c=>`<div class="comment"><div class="comment-top"><span class="comment-name">${escapeHTML(c.name||'Guest')}</span></div><p>${escapeHTML(c.text)}</p></div>`).join(''):'<div class="muted center">Public comments will appear here 💬</div>';comments.scrollTop=comments.scrollHeight;}
function joinedRequestIds(){return new Set(roomParticipants.filter(p=>p.identity.startsWith('speaker-')).map(p=>p.identity.replace(/^speaker-/,'')));}
function renderSpeakerManager(){if(!requestList)return;const joined=joinedRequestIds(),approved=speakerRequests.filter(r=>r.status==='approved'),pending=speakerRequests.filter(r=>r.status==='pending');speakerCount.textContent=`${approved.length} / ${MAX_SPEAKERS}`;requestList.innerHTML=pending.length?pending.map(r=>`<div class="speaker-request-item" data-request-id="${escapeHTML(r.id)}"><strong>🎤 ${escapeHTML(r.name||'Viewer')}</strong><span class="tiny muted">Wants to speak live</span><div class="speaker-request-actions"><button class="btn btn-primary" data-action="approve" type="button">Allow</button><button class="btn btn-light" data-action="decline" type="button">Decline</button></div></div>`).join(''):'<div class="muted center">No pending speaker requests.</div>';activeSpeakers.innerHTML=approved.length?approved.map(r=>`<div class="active-speaker"><span>${joined.has(r.id)?'🎙️':'⏳'} ${escapeHTML(r.name||'Guest speaker')} ${joined.has(r.id)?'LIVE':'approved'}</span><button class="btn btn-light" data-remove-id="${escapeHTML(r.id)}" type="button">Remove</button></div>`).join(''):'';}
requestList?.addEventListener('click',async e=>{const item=e.target.closest('[data-request-id]'),action=e.target.closest('[data-action]')?.dataset.action;if(!item||!action)return;const requestId=item.dataset.requestId;try{if(action==='approve'){const approved=speakerRequests.filter(r=>r.status==='approved').length;if(approved>=MAX_SPEAKERS)return toast(`Maximum ${MAX_SPEAKERS} guest speakers at a time.`);await updateSpeakerRequest(meeting.id,requestId,{status:'approved',approvedAt:new Date().toISOString(),approvedBy:session.user.uid});toast('Speaker approved 🎤');}else await updateSpeakerRequest(meeting.id,requestId,{status:'declined',declinedAt:new Date().toISOString(),declinedBy:session.user.uid});}catch(err){toast(err.message);}});
activeSpeakers?.addEventListener('click',async e=>{const btn=e.target.closest('[data-remove-id]');if(!btn)return;const requestId=btn.dataset.removeId;try{await updateSpeakerRequest(meeting.id,requestId,{status:'removed',removedAt:new Date().toISOString(),removedBy:session.user.uid});const identity=`speaker-${requestId}`;if(roomParticipants.some(p=>p.identity===identity)){try{await moderateParticipant(meeting.id,identity);}catch(err){console.warn('Server removal fallback:',err);}}toast('Speaker removed.');}catch(err){toast(err.message);}});

async function storageEstimate(){if(!navigator.storage?.estimate)return;try{const {usage=0,quota=0}=await navigator.storage.estimate();if(!quota)return;const free=Math.max(0,quota-usage),pct=Math.min(100,(usage/quota)*100);storageBar.style.width=`${pct}%`;storageText.textContent=`Browser storage estimate: ${(free/1073741824).toFixed(1)} GB available`;if(recording&&free<150*1024*1024)await stopRecording('⚠️ Recording stopped because available device storage is very low.');}catch{}}
async function startRecording(){if(recording)return stopRecording('Recording saved to your device.');if(!currentStream)return toast('Start your camera or screen first.');if(!window.showSaveFilePicker)return toast('Direct-to-device recording needs a compatible Chrome/Edge browser.');try{const handle=await showSaveFilePicker({suggestedName:`kamwenge-live-${meeting?.slug||'event'}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.webm`,types:[{description:'WebM video',accept:{'video/webm':['.webm']}}]});writable=await handle.createWritable();const opts={videoBitsPerSecond:2500000};if(MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus'))opts.mimeType='video/webm;codecs=vp8,opus';recorder=new MediaRecorder(currentStream,opts);recorder.ondataavailable=async e=>{if(e.data?.size&&writable){try{await writable.write(e.data);}catch{await stopRecording('⚠️ Recording stopped because the device could no longer save video.');}}};recorder.start(1500);recording=true;recordStartedAt=Date.now();recordState.classList.add('on');recordState.querySelector('strong').textContent='Recording to device';recordBtn.textContent='⏹ Stop Recording';recordTimer=setInterval(()=>{const s=Math.floor((Date.now()-recordStartedAt)/1000),m=Math.floor(s/60);recordState.querySelector('small').textContent=`${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;storageEstimate();},5000);toast('Recording directly to your selected file ⏺️');}catch(e){if(e?.name!=='AbortError')toast('Could not start local recording.');}}
async function stopRecording(message){if(!recording)return;recording=false;clearInterval(recordTimer);if(recorder&&recorder.state!=='inactive'){await new Promise(r=>{recorder.addEventListener('stop',r,{once:true});recorder.stop();});}try{await writable?.close();}catch{}writable=null;recordState.classList.remove('on');recordState.querySelector('strong').textContent='Not recording';recordState.querySelector('small').textContent='00:00';recordBtn.textContent='⏺ Record to Device';if(message)toast(message);}
recordBtn.onclick=startRecording;window.addEventListener('beforeunload',e=>{if(recording||publishing){e.preventDefault();e.returnValue='A live broadcast or local recording is still active.';}});window.addEventListener('pagehide',()=>{stopPublish().catch(()=>{});});storageEstimate();
