import {watchMeetings,asDate} from './store.js';
import {escapeHTML,formatDate,toast} from './app.js';
const sections={live:document.querySelector('#live-grid'),scheduled:document.querySelector('#upcoming-grid'),ended:document.querySelector('#ended-grid')};
const avatar='assets/images/avatar-placeholder.svg';
function card(m){
 const status=m.status==='live'?'🔴 LIVE':m.status==='ended'?'✅ ENDED':'⏳ UPCOMING';
 const cls=m.status==='live'?'badge-live':m.status==='ended'?'badge-ended':'badge-upcoming';
 const action=m.status==='live'?'Watch Live':m.status==='ended'?'Event Details':'View Countdown';
 return `<article class="card event-card"><div class="event-card-banner"><span>📡 KAMWENGE LIVE™</span></div><div class="card-body"><div class="event-meta"><span class="badge ${cls}">${status}</span></div><h3>${escapeHTML(m.title)}</h3><div class="host-row"><img class="host-avatar" src="${escapeHTML(m.hostPhotoURL||avatar)}" onerror="this.src='${avatar}'"><div><strong>${escapeHTML(m.hostName||'Broadcaster')}</strong><span>${formatDate(asDate(m.scheduledAt)||m.scheduledAt)}</span></div></div></div><div class="event-footer"><a class="btn ${m.status==='live'?'btn-live':'btn-soft'}" href="live.html?event=${encodeURIComponent(m.id)}">${action}</a><button class="btn btn-light share" data-url="live.html?event=${encodeURIComponent(m.id)}">🔗 Share</button></div></article>`;
}
function render(all){
 Object.entries(sections).forEach(([status,el])=>{const items=all.filter(m=>m.status===status);el.innerHTML=items.length?items.map(card).join(''):`<div class="empty-state"><div class="emoji">${status==='live'?'📡':status==='scheduled'?'🗓️':'✅'}</div><strong>No ${status==='scheduled'?'upcoming':status} events right now.</strong></div>`});
 document.querySelectorAll('.share').forEach(b=>b.onclick=async()=>{const url=new URL(b.dataset.url,location.href).href;try{if(navigator.share)await navigator.share({title:'Kamwenge Live',url});else{await navigator.clipboard.writeText(url);toast('Link copied 🔗')}}catch{}})
}
try{watchMeetings(render,err=>{console.error(err);Object.values(sections).forEach(el=>el.innerHTML='<div class="empty-state">Backend connection unavailable. Check Firebase configuration.</div>')});}catch(e){render([]);toast(e.message);}
