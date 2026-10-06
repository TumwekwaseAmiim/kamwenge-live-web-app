import { auth, db, firebaseConfigured } from './firebase-core.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export async function login(email,password){
  if(!firebaseConfigured) throw new Error('Firebase is not configured yet.');
  return signInWithEmailAndPassword(auth,email,password);
}
export async function logout(){ if(auth) await signOut(auth); }
export function watchAuth(callback){
  if(!auth){ callback(null); return ()=>{}; }
  return onAuthStateChanged(auth,callback);
}
export async function currentProfile(user=auth?.currentUser){
  if(!user || !db) return null;
  const snap=await getDoc(doc(db,'users',user.uid));
  return snap.exists()?{uid:user.uid,...snap.data()}:null;
}
export async function requireBroadcaster(){
  if(!auth) throw new Error('Firebase is not configured yet.');
  const user=await new Promise(resolve=>{const unsub=onAuthStateChanged(auth,u=>{unsub();resolve(u);});});
  if(!user){ location.href=location.pathname.includes('/admin/')?'../login.html':'login.html'; throw new Error('Login required'); }
  const profile=await currentProfile(user);
  if(!profile || !['broadcaster','admin'].includes(profile.role)){
    throw new Error('This account does not have broadcaster access.');
  }
  return {user,profile};
}
