// Kamwenge Live™ — branded social share Worker
// Deploy this to the Worker used by SHARE_WORKER in js/live.js.
const FIREBASE_PROJECT_ID = 'kamwenge-live';
const APP_URL = 'https://tumwekwaseamiim.github.io/kamwenge-live-web-app';
const BRAND_NAME = 'Kamwenge Live™';
const BRAND_TAGLINE = 'Homegrown in Uganda. Built to Compete Globally.';
const BRAND_IMAGE = `${APP_URL}/assets/icons/icon-512.png`;

export default { async fetch(request) {
  const url = new URL(request.url);
  let eventId = url.searchParams.get('event') || url.pathname.replace(/^\/+|\/+$/g,'');
  if (!eventId) return html(homePage(), 'public, max-age=300');
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/meetings/${encodeURIComponent(eventId)}`, { headers:{Accept:'application/json'} });
    if (!r.ok) return html(fallback(eventId,url.href),'no-store');
    const f=(await r.json()).fields||{};
    const v=(...names)=>{for(const n of names){const x=f[n];if(!x)continue;for(const k of ['stringValue','timestampValue','integerValue','doubleValue','booleanValue'])if(x[k]!==undefined)return x[k];}return '';};
    const title=v('title','eventTitle','meetingTitle','name')||'Kamwenge Live Event';
    const description=v('description','eventDescription','meetingDescription','details')||'Join this live event on Kamwenge Live™.';
    const host=v('hostName','broadcasterName','host','createdByName')||'Kamwenge Live Broadcaster';
    const status=String(v('status')||'').toLowerCase();
    const rawDate=v('scheduledAt','startAt','startTime','eventDate','dateTime','date');
    let eventDate='Date and time to be announced';
    if(rawDate){const d=new Date(rawDate);if(!Number.isNaN(d.getTime()))eventDate=new Intl.DateTimeFormat('en-UG',{weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'Africa/Kampala'}).format(d);}
    const statusText=status==='live'?'🔴 LIVE NOW':status==='ended'?'Event ended':'Upcoming';
    const socialDescription=`${statusText} • ${eventDate} • Hosted by ${host}. ${description}`.slice(0,300);
    const viewerURL=`${APP_URL}/live.html?event=${encodeURIComponent(eventId)}`;
    const canonical=`${url.origin}/${encodeURIComponent(eventId)}`;
    return html(sharePage({title,description,host,eventDate,statusText,socialDescription,viewerURL,canonical}),'public, max-age=30, s-maxage=30');
  } catch(e){return html(fallback(eventId,url.href),'no-store');}
}};

function sharePage(x){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(x.title)} • ${BRAND_NAME}</title><meta name="description" content="${esc(x.socialDescription)}"><meta property="og:type" content="website"><meta property="og:site_name" content="${BRAND_NAME}"><meta property="og:title" content="${esc(x.title)} • ${BRAND_NAME}"><meta property="og:description" content="${esc(x.socialDescription)}"><meta property="og:image" content="${BRAND_IMAGE}"><meta property="og:image:secure_url" content="${BRAND_IMAGE}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="512"><meta property="og:image:height" content="512"><meta property="og:image:alt" content="Kamwenge Live™ event preview"><meta property="og:url" content="${esc(x.canonical)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(x.title)} • ${BRAND_NAME}"><meta name="twitter:description" content="${esc(x.socialDescription)}"><meta name="twitter:image" content="${BRAND_IMAGE}"><meta http-equiv="refresh" content="1;url=${esc(x.viewerURL)}"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:Arial,sans-serif;background:linear-gradient(145deg,#fff,#f5eaff,#ffe7f4);color:#28133f}.card{max-width:620px;background:#fff;border-radius:26px;padding:28px;text-align:center;box-shadow:0 20px 60px #48205d22}.logo{width:120px;height:120px;border-radius:24px}h1{margin:18px 0 8px}.status{display:inline-block;padding:7px 12px;border-radius:999px;background:#7c3aed;color:#fff;font-weight:800}.desc{line-height:1.6;color:#5c5265}.btn{display:inline-block;margin-top:14px;padding:14px 20px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;text-decoration:none;font-weight:800}</style></head><body><div class="card"><img class="logo" src="${BRAND_IMAGE}" alt="Kamwenge Live"><div><span class="status">${esc(x.statusText)}</span></div><h1>${esc(x.title)}</h1><p>📅 ${esc(x.eventDate)}<br>🎙️ Hosted by ${esc(x.host)}</p><p class="desc">${esc(x.description)}</p><a class="btn" href="${esc(x.viewerURL)}">▶ Watch on Kamwenge Live™</a><p><small>${BRAND_TAGLINE}</small></p></div><script>setTimeout(()=>location.replace(${JSON.stringify(x.viewerURL)}),900)</script></body></html>`;}
function homePage(){return `<!doctype html><html><head><meta charset="utf-8"><meta property="og:title" content="${BRAND_NAME}"><meta property="og:description" content="${BRAND_TAGLINE}"><meta property="og:image" content="${BRAND_IMAGE}"></head><body><h1>${BRAND_NAME}</h1><p>${BRAND_TAGLINE}</p><a href="${APP_URL}">Open Kamwenge Live</a></body></html>`;}
function fallback(id,shareURL){const viewer=`${APP_URL}/live.html?event=${encodeURIComponent(id)}`;return `<!doctype html><html><head><meta charset="utf-8"><meta property="og:title" content="${BRAND_NAME}"><meta property="og:description" content="Watch this event on ${BRAND_NAME} — ${BRAND_TAGLINE}"><meta property="og:image" content="${BRAND_IMAGE}"><meta property="og:url" content="${esc(shareURL)}"><meta http-equiv="refresh" content="1;url=${esc(viewer)}"></head><body><p>Opening Kamwenge Live™…</p></body></html>`;}
function html(body,cache){return new Response(body,{status:200,headers:{'Content-Type':'text/html; charset=UTF-8','Cache-Control':cache,'X-Content-Type-Options':'nosniff'}});}
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
