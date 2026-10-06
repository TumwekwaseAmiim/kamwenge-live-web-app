import {createMeeting,slugify,getMeeting} from './store.js';
import {requireBroadcaster} from './auth.js';
import {toast} from './app.js';
const form=document.querySelector('#meeting-form');
const ACTIVE_EVENT_KEY='kamwengeLiveActiveEvent';
let session=null;
(async()=>{try{session=await requireBroadcaster();document.querySelector('#creator-name').textContent=session.profile.displayName||session.user.email;const saved=JSON.parse(localStorage.getItem(ACTIVE_EVENT_KEY)||'null');if(saved?.eventId){const active=await getMeeting(saved.eventId).catch(()=>null);if(active?.status==='live'&&(active.hostId===session.user.uid||session.profile.role==='admin')){toast('You already have a live room. Resuming it now…');setTimeout(()=>location.replace(`studio.html?event=${encodeURIComponent(active.id)}`),500);return;}localStorage.removeItem(ACTIVE_EVENT_KEY);}}catch(e){toast(e.message);}})();
form?.addEventListener('submit',async e=>{
  e.preventDefault(); if(!session)return toast('Broadcaster login required.');
  const fd=new FormData(form),title=String(fd.get('title')||'').trim();
  const date=fd.get('date'),time=fd.get('time');
  const scheduledAt=new Date(`${date}T${time}`).toISOString();
  if(!title||Number.isNaN(new Date(scheduledAt).getTime())) return toast('Add a valid title, date and time.');
  const slug=slugify(fd.get('slug')||title)+'-'+Math.random().toString(36).slice(2,6);
  try{
    const id=await createMeeting({slug,title,description:String(fd.get('description')||'').trim(),hostId:session.user.uid,hostName:session.profile.displayName||session.user.email,hostPhotoURL:session.profile.photoURL||'',scheduledAt,status:'scheduled',commentsEnabled:fd.get('comments')==='on',viewerCount:0,peakViewers:0});
    toast('Meeting created successfully 🗓️'); setTimeout(()=>location.href=`studio.html?event=${encodeURIComponent(id)}`,500);
  }catch(err){toast(err.message||'Could not create meeting');}
});
