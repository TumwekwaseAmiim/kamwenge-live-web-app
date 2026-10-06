// Kamwenge Live™ — Cloudflare LiveKit token worker
// FINAL INTERACTIVE VERSION
// Required Worker secrets/variables:
// LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
//
// Roles:
// viewer      -> watch/listen only
// publisher   -> broadcaster (mic/camera/screen)
// broadcaster -> broadcaster (mic/camera/screen)
// admin       -> broadcaster (mic/camera/screen)
// speaker     -> approved guest (mic/camera/screen)

const FIREBASE_PROJECT_ID='kamwenge-live';

export default { async fetch(request,env){
  const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization","Content-Type":"application/json"};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return json({error:'Use POST requests only.'},405,cors);
  try{
    if(!env.LIVEKIT_URL||!env.LIVEKIT_API_KEY||!env.LIVEKIT_API_SECRET)throw new Error('LiveKit environment variables are missing.');
    const body=await request.json();
    const roomName=String(body.eventId||body.room_name||body.roomName||'').trim();
    if(!roomName||roomName.length>160)return json({error:'A valid Kamwenge Live event/room ID is required.'},400,cors);

    if(body.action==='removeParticipant'){
      const user=await requireBroadcaster(request,roomName);
      if(!user.ok)return json({error:user.error},user.status,cors);
      const identity=String(body.participantIdentity||'').trim();
      if(!identity.startsWith('speaker-'))return json({error:'Invalid speaker identity.'},400,cors);
      await removeParticipant(env,roomName,identity);
      return json({ok:true},200,cors);
    }

    const role=String(body.role||'viewer').toLowerCase();
    if(!['viewer','publisher','broadcaster','admin','speaker'].includes(role))return json({error:'Invalid participant role.'},400,cors);
    const isPublisher=['publisher','broadcaster','admin'].includes(role),isSpeaker=role==='speaker';
    let identity,name;

    if(isPublisher){
      const user=await requireBroadcaster(request,roomName);
      if(!user.ok)return json({error:user.error},user.status,cors);
      identity=`host-${user.uid}`;name=user.name||'Kamwenge Live Broadcaster';
    }else if(isSpeaker){
      const requestId=String(body.requestId||'').trim(),secret=String(body.secret||'');
      if(!requestId||!secret)return json({error:'Speaker approval is required.'},400,cors);
      const approval=await verifySpeakerApproval(roomName,requestId,secret);
      if(!approval.ok)return json({error:approval.error},approval.status,cors);
      identity=`speaker-${requestId}`;name=String(approval.name||body.name||'Guest speaker').slice(0,60);
    }else{
      identity=`viewer-${crypto.randomUUID()}`;name='Kamwenge Live Viewer';
    }

    const now=Math.floor(Date.now()/1000);
    const payload={iss:env.LIVEKIT_API_KEY,sub:identity,name,nbf:now-5,exp:now+7200,video:{room:roomName,roomJoin:true,canSubscribe:true,canPublish:isPublisher||isSpeaker,canPublishData:isPublisher||isSpeaker}};
    const token=await signJwt(payload,env.LIVEKIT_API_SECRET);
    return json({token,wsUrl:env.LIVEKIT_URL,participant_token:token,server_url:env.LIVEKIT_URL,participantToken:token,serverUrl:env.LIVEKIT_URL,room:roomName,role:isPublisher?'publisher':isSpeaker?'speaker':'viewer',identity,canPublish:isPublisher||isSpeaker,canSubscribe:true,speakerMedia:isSpeaker?'microphone-camera-screen':'none',expiresIn:7200},200,cors);
  }catch(error){console.error('Kamwenge Live token error:',error);return json({error:error?.message||'Unable to create LiveKit token.'},500,cors);}
}};

async function verifySpeakerApproval(eventId,requestId,secret){
  const url=`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/meetings/${encodeURIComponent(eventId)}/speakerRequests/${encodeURIComponent(requestId)}`;
  const r=await fetch(url,{headers:{Accept:'application/json'}});if(r.status===404)return{ok:false,status:403,error:'Speaker request was not found.'};if(!r.ok)return{ok:false,status:503,error:'Unable to verify speaker approval.'};
  const d=await r.json(),f=d.fields||{},status=String(f.status?.stringValue||'').toLowerCase(),storedHash=String(f.secretHash?.stringValue||'');
  if(status!=='approved')return{ok:false,status:403,error:status==='pending'?'Your request is still waiting for broadcaster approval.':'You have not been approved to speak.'};
  const incomingHash=await sha256(secret);if(!storedHash||!timingSafeEqual(storedHash,incomingHash))return{ok:false,status:403,error:'Speaker request verification failed.'};
  return{ok:true,status:200,name:String(f.name?.stringValue||'Guest speaker')};
}

async function requireBroadcaster(request,eventId){
  const h=request.headers.get('Authorization')||'',m=h.match(/^Bearer\s+(.+)$/i);if(!m)return{ok:false,status:401,error:'Broadcaster authentication is required.'};
  const verified=await verifyFirebaseJwt(m[1]);if(!verified.ok)return{ok:false,status:401,error:'Broadcaster login could not be verified.'};
  const meeting=await firestoreDoc(`meetings/${eventId}`);if(!meeting)return{ok:false,status:404,error:'Event not found.'};
  const hostId=String(meeting.hostId?.stringValue||'');let isAdmin=false,name='';
  const profile=await firestoreDoc(`users/${verified.uid}`);if(profile){isAdmin=String(profile.role?.stringValue||'')==='admin';name=String(profile.displayName?.stringValue||'');}
  if(hostId!==verified.uid&&!isAdmin)return{ok:false,status:403,error:'You do not own this broadcast.'};
  return{ok:true,uid:verified.uid,name};
}
async function firestoreDoc(path){const r=await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,{headers:{Accept:'application/json'}});if(!r.ok)return null;return (await r.json()).fields||{};}

async function verifyFirebaseJwt(token){
  try{const [h,p,s]=token.split('.');if(!h||!p||!s)return{ok:false};const header=JSON.parse(new TextDecoder().decode(base64UrlToBytes(h))),payload=JSON.parse(new TextDecoder().decode(base64UrlToBytes(p)));if(header.alg!=='RS256'||!header.kid)return{ok:false};const now=Math.floor(Date.now()/1000);if(payload.exp<=now||payload.aud!==FIREBASE_PROJECT_ID||payload.iss!==`https://securetoken.google.com/${FIREBASE_PROJECT_ID}`||!payload.sub)return{ok:false};const jwks=await (await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',{cf:{cacheTtl:3600,cacheEverything:true}})).json();const jwk=jwks.keys?.find(k=>k.kid===header.kid);if(!jwk)return{ok:false};const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64UrlToBytes(s),new TextEncoder().encode(`${h}.${p}`));return ok?{ok:true,uid:payload.sub}:{ok:false};}catch{return{ok:false};}
}

async function removeParticipant(env,room,identity){
  const now=Math.floor(Date.now()/1000),adminToken=await signJwt({iss:env.LIVEKIT_API_KEY,sub:`kamwenge-admin-${crypto.randomUUID()}`,nbf:now-5,exp:now+300,video:{room,roomAdmin:true}},env.LIVEKIT_API_SECRET);
  const httpUrl=env.LIVEKIT_URL.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/$/,'');
  const r=await fetch(`${httpUrl}/twirp/livekit.RoomService/RemoveParticipant`,{method:'POST',headers:{Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json'},body:JSON.stringify({room,identity})});if(!r.ok){const txt=await r.text();throw new Error(`Could not remove participant (${r.status}): ${txt.slice(0,120)}`);}
}
async function sha256(value){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
async function signJwt(payload,secret){const header={alg:'HS256',typ:'JWT'},a=base64UrlEncode(JSON.stringify(header)),b=base64UrlEncode(JSON.stringify(payload)),unsigned=`${a}.${b}`,key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(unsigned));return `${unsigned}.${arrayBufferToBase64Url(sig)}`;}
function base64UrlEncode(v){return btoa(String.fromCharCode(...new TextEncoder().encode(v))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function arrayBufferToBase64Url(b){return btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
function base64UrlToBytes(v){v=v.replace(/-/g,'+').replace(/_/g,'/');while(v.length%4)v+='=';const bin=atob(v),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers});}
