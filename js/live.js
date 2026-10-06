import {watchMeeting,watchComments,addComment,react,watchReactions,asDate,getPublicProfile} from './store.js';
import {watchLiveStream,stopWatching} from './streaming-adapter.js';
import {escapeHTML,formatDate,toast} from './app.js';
const id=new URLSearchParams(location.search).get('event');
const avatar='assets/images/avatar-placeholder.svg'; let meeting=null,commentsUnsub=()=>{},reactionUnsub=()=>{},watchingEventId=null;
const els={title:document.querySelector('#event-title'),host:document.querySelector('#event-host'),hostPhoto:document.querySelector('#event-host-photo'),hostBio:document.querySelector('#event-host-bio'),date:document.querySelector('#event-date'),status:document.querySelector('#event-status'),countdown:document.querySelector('#countdown'),pre:document.querySelector('#pre-live'),live:document.querySelector('#live-stage'),ended:document.querySelector('#ended-stage'),comments:document.querySelector('#comments'),compose:document.querySelector('#comment-form'),video:document.querySelector('#viewer-video'),placeholder:document.querySelector('#viewer-placeholder'),reactions:document.querySelector('#reaction-row')};
function diffText(date){let s=Math.max(0,Math.floor((date-Date.now())/1000));const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60),sec=s%60;return `${d?String(d).padStart(2,'0')+':':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`}

async function ensureWatching(m){
  if(m.status!=='live'){
    if(watchingEventId){await stopWatching().catch(()=>{});watchingEventId=null;}
    return;
  }
  if(watchingEventId===m.id)return;
  watchingEventId=m.id;
  els.placeholder.classList.remove('hidden');
  els.placeholder.querySelector('h2').textContent='Connecting to live video…';
  els.placeholder.querySelector('p').textContent='The broadcaster is live. Video will start automatically.';
  try{
    await watchLiveStream(m.id,els.video,state=>{
      if(state==='playing') els.placeholder.classList.add('hidden');
      if(state==='reconnecting'){
        els.placeholder.classList.remove('hidden');
        els.placeholder.querySelector('h2').textContent='Reconnecting…';
      }
    });
  }catch(e){
    watchingEventId=null;
    els.placeholder.classList.remove('hidden');
    els.placeholder.querySelector('h2').textContent='Live video unavailable';
    els.placeholder.querySelector('p').textContent=e.message;
  }
}

async function render(m){meeting=m;if(!m){els.title.textContent='Event not found';return;}els.title.textContent=m.title;els.host.textContent=m.hostName||'Broadcaster';document.querySelector('#event-host-mini').textContent=m.hostName||'Broadcaster';els.hostPhoto.src=m.hostPhotoURL||avatar;els.date.textContent=formatDate(asDate(m.scheduledAt)||m.scheduledAt);const p=await getPublicProfile(m.hostId).catch(()=>null);els.host.textContent=p?.displayName||m.hostName||'Broadcaster';document.querySelector('#event-host-mini').textContent=p?.displayName||m.hostName||'Broadcaster';els.hostPhoto.src=p?.photoURL||m.hostPhotoURL||avatar;els.hostBio.textContent=p?.bio||'Kamwenge Live broadcaster';
 els.pre.classList.toggle('hidden',m.status!=='scheduled');els.live.classList.toggle('hidden',m.status!=='live');els.ended.classList.toggle('hidden',m.status!=='ended');els.status.className=`badge ${m.status==='live'?'badge-live':m.status==='ended'?'badge-ended':'badge-upcoming'}`;els.status.textContent=m.status==='live'?'🔴 LIVE NOW':m.status==='ended'?'✅ ENDED':'⏳ UPCOMING';
 await ensureWatching(m);
 if(m.commentsEnabled!==false){commentsUnsub();commentsUnsub=watchComments(m.id,renderComments);} else {els.comments.innerHTML='<div class="muted center">Comments are disabled for this event.</div>';}
 reactionUnsub();reactionUnsub=watchReactions(m.id,renderReactions);
}
function renderComments(cs){els.comments.innerHTML=cs.length?cs.map(c=>`<div class="comment"><div class="comment-top"><span class="comment-name">${escapeHTML(c.name||'Guest')}</span></div><p>${escapeHTML(c.text)}</p></div>`).join(''):'<div class="muted center">No comments yet. Start the discussion 💬</div>';els.comments.scrollTop=els.comments.scrollHeight}
function renderReactions(c){els.reactions?.querySelectorAll('button').forEach(b=>{const n=c[encodeURIComponent(b.dataset.emoji)]||c[b.dataset.emoji]||0;b.querySelector('span').textContent=n?` ${n}`:''})}
els.compose?.addEventListener('submit',async e=>{e.preventDefault();if(!meeting||meeting.commentsEnabled===false)return;const name=document.querySelector('#comment-name').value.trim()||'Viewer',input=document.querySelector('#comment-text'),text=input.value.trim();if(!text)return;try{await addComment(meeting.id,{name,text});input.value=''}catch(e){toast(e.message)}});
els.reactions?.addEventListener('click',async e=>{const b=e.target.closest('button[data-emoji]');if(b&&meeting){await react(meeting.id,b.dataset.emoji).catch(err=>toast(err.message));b.animate([{transform:'scale(1)'},{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:240})}});
document.querySelector('#share-event')?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:meeting?.title||'Kamwenge Live',url:location.href});else{await navigator.clipboard.writeText(location.href);toast('Event link copied 🔗')}}catch{}});
setInterval(()=>{if(meeting?.status==='scheduled')els.countdown.textContent=diffText(asDate(meeting.scheduledAt)||new Date(meeting.scheduledAt));},1000);
window.addEventListener('pagehide',()=>stopWatching().catch(()=>{}));
if(id){try{watchMeeting(id,render,err=>toast(err.message));}catch(e){toast(e.message)}}else els.title.textContent='Event link is missing';
