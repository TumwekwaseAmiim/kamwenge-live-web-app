import {getMeeting,updateMeeting,watchMeeting,watchComments} from './store.js';
import {requireBroadcaster} from './auth.js';
import {publishStream,replacePublishedStream,stopPublish} from './streaming-adapter.js';
import {escapeHTML,toast} from './app.js';

const eventId=new URLSearchParams(location.search).get('event');
const video=document.querySelector('#studio-video'),placeholder=document.querySelector('#studio-placeholder'),sourceLabel=document.querySelector('#source-label');
const startBtn=document.querySelector('#start-camera'),switchBtn=document.querySelector('#switch-camera'),screenBtn=document.querySelector('#share-screen'),micBtn=document.querySelector('#toggle-mic'),liveBtn=document.querySelector('#go-live'),endBtn=document.querySelector('#end-live');
const recordBtn=document.querySelector('#record-device'),recordState=document.querySelector('#record-state'),storageText=document.querySelector('#storage-text'),storageBar=document.querySelector('#storage-bar'),comments=document.querySelector('#studio-comments');
let session,meeting,cameraStream=null,currentStream=null,facing='environment',recorder=null,writable=null,recording=false,recordTimer=null,recordStartedAt=0,publishing=false;

(async()=>{try{
  session=await requireBroadcaster();
  meeting=await getMeeting(eventId);
  if(!meeting)throw new Error('Event not found.');
  if(meeting.hostId!==session.user.uid&&session.profile.role!=='admin')throw new Error('You do not own this broadcast.');
  document.querySelector('#studio-host-photo').src=session.profile.photoURL||'assets/images/avatar-placeholder.svg';
  document.querySelector('#studio-host-name').textContent=session.profile.displayName||session.user.email;
  watchMeeting(meeting.id,syncEvent);
  watchComments(meeting.id,renderComments);
}catch(e){toast(e.message);setTimeout(()=>location.href='dashboard.html',1200)}})();

function setPreview(stream,label){
  currentStream=stream;
  video.srcObject=stream;
  video.muted=true;
  video.play().catch(()=>{});
  placeholder.classList.add('hidden');
  sourceLabel.textContent=label;
}

async function refreshPublicStream(){
  if(!publishing||!meeting||!currentStream)return;
  try{
    sourceLabel.textContent+=' • updating viewers…';
    await replacePublishedStream(meeting.id,currentStream);
    toast('Live source changed for viewers ✅');
  }catch(e){toast(e.message);}
}

async function openCamera(){
  try{
    cameraStream?.getTracks().forEach(t=>t.stop());
    cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing}},audio:true});
    setPreview(cameraStream,facing==='environment'?'📷 Back camera':'🤳 Front camera');
    await refreshPublicStream();
    return true;
  }catch(e){toast('Camera or microphone permission was not granted.');return false}
}
startBtn.onclick=openCamera;
switchBtn.onclick=async()=>{facing=facing==='environment'?'user':'environment';await openCamera()};
micBtn.onclick=()=>{
  const t=currentStream?.getAudioTracks?.()[0];
  if(!t)return toast('No microphone is active.');
  t.enabled=!t.enabled;
  micBtn.textContent=t.enabled?'🎤 Mute':'🔇 Unmute';
  micBtn.classList.toggle('active',!t.enabled);
};
screenBtn.onclick=async()=>{
  if(!navigator.mediaDevices?.getDisplayMedia)return toast('Screen sharing is not supported in this browser.');
  try{
    const screen=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
    // If the browser did not provide screen audio, keep microphone audio if available.
    if(!screen.getAudioTracks().length && cameraStream?.getAudioTracks()?.[0]) screen.addTrack(cameraStream.getAudioTracks()[0]);
    setPreview(screen,'🖥️ Shared screen');
    await refreshPublicStream();
    screen.getVideoTracks()[0].addEventListener('ended',async()=>{
      if(cameraStream){setPreview(cameraStream,facing==='environment'?'📷 Back camera':'🤳 Front camera');await refreshPublicStream();}
    });
  }catch{}
};

function syncEvent(m){
  if(!m)return;
  meeting=m;
  document.querySelector('#studio-title').textContent=m.title;
  const live=m.status==='live';
  liveBtn.classList.toggle('hidden',live);
  endBtn.classList.toggle('hidden',!live);
  document.querySelector('#studio-live-badge').classList.toggle('hidden',!live);
  document.querySelector('#public-link').href=`live.html?event=${m.id}`;
}

liveBtn.onclick=async()=>{
  if(!meeting)return;
  if(!currentStream&&!(await openCamera()))return;
  try{
    liveBtn.disabled=true;
    liveBtn.textContent='Connecting…';
    await publishStream(meeting.id,currentStream);
    publishing=true;
    await updateMeeting(meeting.id,{status:'live',liveStartedAt:new Date().toISOString(),mediaType:'livekit'});
    toast('You are LIVE 🔴');
  }catch(e){
    await stopPublish().catch(()=>{});
    publishing=false;
    toast(e.message);
  }finally{
    liveBtn.disabled=false;
    liveBtn.textContent='🔴 Go Live';
  }
};

endBtn.onclick=async()=>{
  try{
    await stopPublish();
    publishing=false;
    await updateMeeting(meeting.id,{status:'ended',endedAt:new Date().toISOString()});
    if(recording)await stopRecording('Broadcast ended. Local recording finalized.');
    toast('Broadcast ended ✅');
  }catch(e){toast(e.message)}
};

function renderComments(cs){comments.innerHTML=cs.length?cs.slice(-40).map(c=>`<div class="comment"><div class="comment-top"><span class="comment-name">${escapeHTML(c.name||'Guest')}</span></div><p>${escapeHTML(c.text)}</p></div>`).join(''):'<div class="muted center">Public comments will appear here 💬</div>';comments.scrollTop=comments.scrollHeight}

async function storageEstimate(){if(!navigator.storage?.estimate)return;try{const {usage=0,quota=0}=await navigator.storage.estimate();if(!quota)return;const free=Math.max(0,quota-usage),pct=Math.min(100,(usage/quota)*100);storageBar.style.width=`${pct}%`;storageText.textContent=`Browser storage estimate: ${(free/1073741824).toFixed(1)} GB available`;if(recording&&free<150*1024*1024)await stopRecording('⚠️ Recording stopped because available device storage is very low.')}catch{}}
async function startRecording(){if(recording)return stopRecording('Recording saved to your device.');if(!currentStream)return toast('Start your camera or screen first.');if(!window.showSaveFilePicker)return toast('Direct-to-device recording needs a compatible Chrome/Edge browser.');try{const handle=await showSaveFilePicker({suggestedName:`kamwenge-live-${meeting?.slug||'event'}-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.webm`,types:[{description:'WebM video',accept:{'video/webm':['.webm']}}]});writable=await handle.createWritable();recorder=new MediaRecorder(currentStream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:2500000});recorder.ondataavailable=async e=>{if(e.data?.size&&writable){try{await writable.write(e.data)}catch{await stopRecording('⚠️ Recording stopped because the device could no longer save video.')}}};recorder.start(1500);recording=true;recordStartedAt=Date.now();recordState.classList.add('on');recordState.querySelector('strong').textContent='Recording to device';recordBtn.textContent='⏹ Stop Recording';recordTimer=setInterval(()=>{const s=Math.floor((Date.now()-recordStartedAt)/1000),m=Math.floor(s/60);recordState.querySelector('small').textContent=`${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;storageEstimate()},5000);toast('Recording directly to your selected file ⏺️')}catch(e){if(e?.name!=='AbortError')toast('Could not start local recording.')}}
async function stopRecording(message){if(!recording)return;recording=false;clearInterval(recordTimer);if(recorder&&recorder.state!=='inactive'){await new Promise(r=>{recorder.addEventListener('stop',r,{once:true});recorder.stop()})}try{await writable?.close()}catch{}writable=null;recordState.classList.remove('on');recordState.querySelector('strong').textContent='Not recording';recordState.querySelector('small').textContent='00:00';recordBtn.textContent='⏺ Record to Device';if(message)toast(message)}
recordBtn.onclick=startRecording;
window.addEventListener('beforeunload',e=>{if(recording||publishing){e.preventDefault();e.returnValue='A live broadcast or local recording is still active.'}});
window.addEventListener('pagehide',()=>{stopPublish().catch(()=>{})});
storageEstimate();
