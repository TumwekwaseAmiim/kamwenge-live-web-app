export const qs=(s,r=document)=>r.querySelector(s);
export const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
export function escapeHTML(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
export function formatDate(value){if(!value)return 'Not scheduled';const d=new Date(value);return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(d)}
export function toast(message,ms=3400){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),ms)}
export function setupNav(){const nav=qs('.nav'),btn=qs('.menu-btn');btn?.addEventListener('click',()=>nav?.classList.toggle('open'));qsa('[data-install]').forEach(b=>b.addEventListener('click',async()=>{if(window.__installPrompt){window.__installPrompt.prompt();await window.__installPrompt.userChoice;window.__installPrompt=null}else toast('Install option will appear when your browser makes the PWA installable. 📲')}));}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window.__installPrompt=e;});
if('serviceWorker' in navigator) window.addEventListener('load',()=>{const sw=location.pathname.includes('/admin/')?'../sw.js':'./sw.js';navigator.serviceWorker.register(sw).catch(()=>{});});
document.addEventListener('DOMContentLoaded',setupNav);
