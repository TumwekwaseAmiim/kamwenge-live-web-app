import {requireBroadcaster,logout} from './auth.js';
import {watchHostMeetings,asDate} from './store.js';
import {escapeHTML,formatDate,toast} from './app.js';

const DAY_MS=24*60*60*1000;
let session;

function visibleEvent(m){
  if(m.status!=='ended')return true;
  const ended=asDate(m.endedAt);
  if(!ended||Number.isNaN(ended.getTime()))return false;
  return Date.now()-ended.getTime()<DAY_MS;
}

(async()=>{try{
  session=await requireBroadcaster();
  document.querySelector('#dash-name').textContent=session.profile.displayName||session.user.email;
  document.querySelector('#dash-photo').src=session.profile.photoURL||'assets/images/avatar-placeholder.svg';
  watchHostMeetings(session.user.uid,render);
}catch(e){toast(e.message)}})();

function render(allItems){
  const items=allItems.filter(visibleEvent);
  document.querySelector('#stat-total').textContent=items.length;
  document.querySelector('#stat-live').textContent=items.filter(x=>x.status==='live').length;
  document.querySelector('#stat-upcoming').textContent=items.filter(x=>x.status==='scheduled').length;
  document.querySelector('#events-body').innerHTML=items.length?items.map(m=>`<tr><td><strong>${escapeHTML(m.title)}</strong></td><td>${escapeHTML(m.status)}</td><td>${formatDate(asDate(m.scheduledAt)||m.scheduledAt)}</td><td><a class="btn btn-soft" href="studio.html?event=${m.id}">🎥 Studio</a> <a class="btn btn-light" href="live.html?event=${m.id}">👁 Public</a></td></tr>`).join(''):'<tr><td colspan="4" class="muted">No current meetings. Ended meetings disappear here after 24 hours.</td></tr>';
}

document.querySelector('#logout')?.addEventListener('click',async()=>{await logout();location.href='login.html';});
