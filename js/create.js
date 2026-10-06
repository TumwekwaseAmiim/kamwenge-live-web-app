import {createMeeting,slugify,getMeeting,updateMeeting} from './store.js';
import {requireBroadcaster} from './auth.js';
import {toast} from './app.js';

const form=document.querySelector('#meeting-form');
const titleInput=form?.querySelector('[name="title"]');
const autoLinkPreview=document.querySelector('#auto-link-preview');
const ACTIVE_EVENT_KEY='kamwengeLiveActiveEvent';
const SHARE_WORKER='https://rwamwanja-kamwenge-live.tumwekwaseamiim.workers.dev';
let session=null;
let slugSuffix=Math.random().toString(36).slice(2,7);

function buildFriendlySlug(title){
  return `${slugify(title||'kamwenge-live-event')}-${slugSuffix}`;
}

function refreshAutoLinkPreview(){
  if(!autoLinkPreview)return;
  const title=String(titleInput?.value||'').trim();
  const slug=buildFriendlySlug(title);
  autoLinkPreview.textContent=title
    ? `Automatic event link name: ${slug}`
    : 'Your unique event link will be created automatically from the event title.';
}

titleInput?.addEventListener('input',refreshAutoLinkPreview);
refreshAutoLinkPreview();

(async()=>{
  try{
    session=await requireBroadcaster();
    document.querySelector('#creator-name').textContent=session.profile.displayName||session.user.email;
    const saved=JSON.parse(localStorage.getItem(ACTIVE_EVENT_KEY)||'null');
    if(saved?.eventId){
      const active=await getMeeting(saved.eventId).catch(()=>null);
      if(active?.status==='live'&&(active.hostId===session.user.uid||session.profile.role==='admin')){
        toast('You already have a live room. Resuming it now…');
        setTimeout(()=>location.replace(`studio.html?event=${encodeURIComponent(active.id)}`),500);
        return;
      }
      localStorage.removeItem(ACTIVE_EVENT_KEY);
    }
  }catch(e){toast(e.message);}
})();

form?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!session)return toast('Broadcaster login required.');

  const fd=new FormData(form);
  const title=String(fd.get('title')||'').trim();
  const date=fd.get('date');
  const time=fd.get('time');
  const scheduledAt=new Date(`${date}T${time}`).toISOString();

  if(!title||Number.isNaN(new Date(scheduledAt).getTime())){
    return toast('Add a valid title, date and time.');
  }

  // Always generated automatically. The broadcaster never has to type a link.
  const slug=buildFriendlySlug(title);

  try{
    const id=await createMeeting({
      slug,
      title,
      description:String(fd.get('description')||'').trim(),
      hostId:session.user.uid,
      hostName:session.profile.displayName||session.user.email,
      hostPhotoURL:session.profile.photoURL||'',
      scheduledAt,
      status:'scheduled',
      commentsEnabled:fd.get('comments')==='on',
      viewerCount:0,
      peakViewers:0
    });

    // The public share Worker resolves events by Firestore document ID.
    // Save the exact generated public URL on the meeting as well.
    const shareUrl=`${SHARE_WORKER}/${encodeURIComponent(id)}`;
    await updateMeeting(id,{shareUrl,slug});

    localStorage.setItem('kamwengeLiveLastCreatedEvent',JSON.stringify({
      eventId:id,
      slug,
      shareUrl,
      createdAt:Date.now()
    }));

    toast('Meeting created — your event link was generated automatically 🔗');
    setTimeout(()=>location.href=`studio.html?event=${encodeURIComponent(id)}`,550);
  }catch(err){
    toast(err.message||'Could not create meeting');
  }
});
