import { db, firebaseConfigured } from './firebase-core.js';
import {
  collection, addDoc, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, serverTimestamp, limit, increment
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

function ready(){ if(!firebaseConfigured || !db) throw new Error('Firebase is not configured. Add your Firebase web config in js/firebase-config.js.'); }
export function slugify(v){return String(v).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,60)||`event-${Date.now()}`}
function mapDoc(s){return {id:s.id,...s.data()};}
function asDate(v){ if(!v) return null; if(typeof v.toDate==='function') return v.toDate(); return new Date(v); }
export { asDate };

export async function createMeeting(data){
  ready();
  const ref=doc(collection(db,'meetings'));
  await setDoc(ref,{...data,id:ref.id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  return ref.id;
}
export async function updateMeeting(id,patch){ready();await updateDoc(doc(db,'meetings',id),{...patch,updatedAt:serverTimestamp()});}
export async function removeMeeting(id){ready();await deleteDoc(doc(db,'meetings',id));}
export async function getMeetingById(id){ready();const s=await getDoc(doc(db,'meetings',id));return s.exists()?mapDoc(s):null;}
export async function getMeeting(slugOrId){
  ready();
  const direct=await getDoc(doc(db,'meetings',slugOrId));
  if(direct.exists()) return mapDoc(direct);
  const q=query(collection(db,'meetings'),where('slug','==',slugOrId),limit(1));
  const snap=await getDocs(q);return snap.empty?null:mapDoc(snap.docs[0]);
}
export function watchMeeting(slugOrId,callback,onError=console.error){
  ready();
  let unsub=()=>{};
  getMeeting(slugOrId).then(m=>{
    if(!m){callback(null);return;}
    unsub=onSnapshot(doc(db,'meetings',m.id),s=>callback(s.exists()?mapDoc(s):null),onError);
  }).catch(onError);
  return ()=>unsub();
}
export function watchMeetings(callback,onError=console.error){
  ready();
  const q=query(collection(db,'meetings'),orderBy('scheduledAt','desc'));
  return onSnapshot(q,s=>callback(s.docs.map(mapDoc)),onError);
}
export function watchHostMeetings(uid,callback,onError=console.error){
  ready();
  const q=query(collection(db,'meetings'),where('hostId','==',uid));
  return onSnapshot(q,s=>callback(s.docs.map(mapDoc).sort((a,b)=>new Date(b.scheduledAt)-new Date(a.scheduledAt))),onError);
}
export async function getPublicProfile(uid){
  if(!uid){return null;} ready();
  const s=await getDoc(doc(db,'users',uid));
  if(!s.exists()) return null; const x=s.data();
  return {uid,displayName:x.displayName||'Broadcaster',photoURL:x.photoURL||'',bio:x.bio||'',location:x.location||'',role:x.role||'viewer'};
}
export async function saveProfile(uid,patch){
  ready();
  const safe={displayName:String(patch.displayName||'').trim(),photoURL:String(patch.photoURL||'').trim(),bio:String(patch.bio||'').trim(),location:String(patch.location||'').trim(),updatedAt:serverTimestamp()};
  await setDoc(doc(db,'users',uid),safe,{merge:true});
}
export function watchComments(meetingId,callback,onError=console.error){
  ready(); const q=query(collection(db,'meetings',meetingId,'comments'),orderBy('createdAt','asc'),limit(300));
  return onSnapshot(q,s=>callback(s.docs.map(mapDoc)),onError);
}
export async function addComment(meetingId,{name,text,authorId=null}){
  ready(); await addDoc(collection(db,'meetings',meetingId,'comments'),{name:String(name||'Guest').trim().slice(0,60),text:String(text||'').trim().slice(0,500),authorId:authorId||null,createdAt:serverTimestamp()});
}
export function watchReactions(meetingId,callback,onError=console.error){
  ready(); return onSnapshot(collection(db,'meetings',meetingId,'reactionTotals'),s=>{const out={};s.forEach(d=>out[d.id]=d.data().count||0);callback(out);},onError);
}
export async function react(meetingId,emoji){
  ready(); const allowed=['❤️','👍','👏','😂','🔥']; if(!allowed.includes(emoji)) return;
  await setDoc(doc(db,'meetings',meetingId,'reactionTotals',encodeURIComponent(emoji)),{emoji,count:increment(1)},{merge:true});
}
