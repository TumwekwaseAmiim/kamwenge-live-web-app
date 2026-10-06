import {login,currentProfile} from './auth.js';
import {toast} from './app.js';
const form=document.querySelector('#login-form');
form?.addEventListener('submit',async e=>{
  e.preventDefault(); const btn=form.querySelector('button[type=submit]'); btn.disabled=true;
  try{
    const {user}=await login(form.email.value.trim(),form.password.value);
    const profile=await currentProfile(user);
    if(!profile || !['broadcaster','admin'].includes(profile.role)) throw new Error('Your account has not been approved as a broadcaster yet.');
    toast('Welcome back 🎥'); setTimeout(()=>location.href='dashboard.html',450);
  }catch(err){toast(err.message||'Login failed'); btn.disabled=false;}
});
