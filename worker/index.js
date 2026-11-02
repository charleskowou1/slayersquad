/* Slayer Squad notifications: a free Cloudflare Worker that sends Web Push.
   The game is static, so this is the only server. It stores push subscriptions in KV (never in the public database), and checks
   each request against the player's Firebase sign-in and the real game state, so a request can only announce what actually happened.
   Limits: one alert per turn; a player can ping once in 30 minutes; everyone gets at most PING_DAY pings a day; one Daily alert at noon local time. If Cloudflare's free
   limits are reached, alerts stop and the game carries on. Secrets: VAPID_PUBLIC and VAPID_PRIVATE (set by setup.sh, never committed). */
const PING_DAY = 6, PING_GAP = 1800, PING_MAX = 300, QUEUE_TTL = 2*864e5, DAILY_HOUR = 12;
const enc = new TextEncoder(), b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')), c=>c.charCodeAt(0));
const join = (...a) => { const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0)); let i=0; a.forEach(x=>{ o.set(x,i); i+=x.length; }); return o; };
const clean = (s,n=20) => String(s||'Someone').replace(/[\u0000-\u001f]/g,'').slice(0,n);
const hash = async s => b64(await crypto.subtle.digest('SHA-256', enc.encode(s))).slice(0,24);

/* ---------- Web Push: VAPID sign-in and RFC 8291 encryption ---------- */
async function hkdf(salt, ikm, info, bytes){
  const k=await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF', hash:'SHA-256', salt, info}, k, bytes*8));
}
export async function encrypt(sub, text, salt=crypto.getRandomValues(new Uint8Array(16))){
  const ua=unb64(sub.keys.p256dh), auth=unb64(sub.keys.auth), pair=await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveBits']);
  const as=new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const peer=await crypto.subtle.importKey('raw', ua, {name:'ECDH', namedCurve:'P-256'}, false, []);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH', public:peer}, pair.privateKey, 256));
  const ikm=await hkdf(auth, shared, join(enc.encode('WebPush: info\0'), ua, as), 32);
  const cek=await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16), nonce=await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key=await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const body=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM', iv:nonce}, key, join(enc.encode(text), new Uint8Array([2]))));
  return join(salt, new Uint8Array([0,0,16,0,65]), as, body);
}
async function vapid(endpoint, env){
  const pub=unb64(env.VAPID_PUBLIC), d=env.VAPID_PRIVATE;
  const key=await crypto.subtle.importKey('jwk', {kty:'EC', crv:'P-256', d, x:b64(pub.slice(1,33)), y:b64(pub.slice(33,65))}, {name:'ECDSA', namedCurve:'P-256'}, false, ['sign']);
  const part=o=>b64(enc.encode(JSON.stringify(o))), head=part({typ:'JWT', alg:'ES256'})+'.'+part({aud:new URL(endpoint).origin, exp:Math.floor(Date.now()/1000)+43200, sub:env.SITE});
  const sig=await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, key, enc.encode(head));
  return `vapid t=${head}.${b64(sig)}, k=${env.VAPID_PUBLIC}`;
}
async function push(env, id, payload){
  const raw=await env.KV.get('s:'+id); if(!raw) return false;
  const sub=JSON.parse(raw), r=await fetch(sub.endpoint, {method:'POST', headers:{Authorization:await vapid(sub.endpoint,env), 'Content-Encoding':'aes128gcm', 'Content-Type':'application/octet-stream', TTL:'3600', Urgency:'high'}, body:await encrypt(sub, JSON.stringify(payload))});
  if(r.status===404 || r.status===410){ await env.KV.delete('s:'+id); await env.KV.delete('m:'+id); await env.KV.delete('d:'+id); return false; }   // the player turned it off or the phone is gone
  return r.ok;
}

/* ---------- who's asking: a Firebase ID token, checked against Google's public keys ---------- */
export async function verifyToken(token, env, keys){
  const [h,p,s]=String(token||'').split('.'); if(!s) return null;
  let head, body; try{ head=JSON.parse(new TextDecoder().decode(unb64(h))); body=JSON.parse(new TextDecoder().decode(unb64(p))); }catch(e){ return null; }
  const now=Date.now()/1000;
  if(body.aud!==env.PROJECT_ID || body.iss!==`https://securetoken.google.com/${env.PROJECT_ID}` || body.exp<now || !body.sub) return null;
  const set=keys || await (await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', {cf:{cacheTtl:3600}})).json();
  const jwk=(set.keys||[]).find(k=>k.kid===head.kid); if(!jwk) return null;
  const key=await crypto.subtle.importKey('jwk', jwk, {name:'RSASSA-PKCS1-v1_5', hash:'SHA-256'}, false, ['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64(s), enc.encode(h+'.'+p)) ? body.sub : null;
}
const dbGet = async (env, path, token) => { const r=await fetch(`${env.DB_URL}/${path}.json?auth=${token}`); return r.ok ? r.json() : null; };

/* ---------- routes ---------- */
const routes = {
  // turn alerts or match pings on or off for this phone
  async subscribe(b, env){
    const sub=b.sub; if(!sub || !/^https:\/\//.test(sub.endpoint||'') || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return {error:'bad subscription'};
    const id=await hash(sub.endpoint); await env.KV.put('s:'+id, JSON.stringify({endpoint:sub.endpoint, keys:sub.keys}), {expirationTtl:90*864e2});
    if(b.ping) await env.KV.put('m:'+id, '1', {expirationTtl:90*864e2}); else await env.KV.delete('m:'+id);
    if(b.daily) await env.KV.put('d:'+id, '1', {expirationTtl:90*864e2, metadata:{tz:clean(b.tz,40)}}); else await env.KV.delete('d:'+id);
    return {id};
  },
  async unsubscribe(b, env){ if(b.id){ await env.KV.delete('s:'+b.id); await env.KV.delete('m:'+b.id); await env.KV.delete('d:'+b.id); } return {ok:true}; },
  // this phone is in that seat of an own-pace game
  async game(b, env){ if(!/^[A-Z]{6}$/.test(b.code||'') || !(b.seat===0||b.seat===1) || !b.id) return {error:'bad game'}; await env.KV.put(`g:${b.code}:${b.seat}`, b.id, {expirationTtl:30*864e2}); return {ok:true}; },
  // a turn was played: tell the other player if it really is their move, once per turn
  async turn(b, env, token){
    if(!/^[A-Z]{6}$/.test(b.code||'')) return {error:'bad game'};
    const m=await dbGet(env, `games/${b.code}/meta`, token); if(!m || m.final || m.phase==='lobby') return {sent:0};
    const who=(m.turn||[]).filter(q=>q!==b.seat); let sent=0;
    for(const q of who){ const once=`n:${b.code}:${m.matchNo}:${m.roundId}:${m.phase}:${m.turn}:${q}`; if(await env.KV.get(once)) continue;
      const id=await env.KV.get(`g:${b.code}:${q}`); if(!id) continue; await env.KV.put(once,'1',{expirationTtl:86400});
      if(await push(env, id, {title:'Your move', body:`${clean((m.names||[])[1-q])} is waiting on you.`, url:`/?open=${b.code}`})) sent++; }
    return {sent};
  },
  // Quick Match found nobody: tell the players who opted in. It must be this player's real waiting game.
  async match(b, env, token, uid){
    const q=await dbGet(env, 'games/QUEUED', token); if(!q || q.code!==b.code || Date.now()-q.at>QUEUE_TTL) return {sent:0, why:'no queue'};
    if(await env.KV.get('u:'+uid)) return {sent:0, why:'wait'};
    const day='p:'+new Date().toISOString().slice(0,10), n=+(await env.KV.get(day))||0; if(n>=PING_DAY) return {sent:0, why:'daily cap'};
    await env.KV.put('u:'+uid,'1',{expirationTtl:PING_GAP}); await env.KV.put(day,String(n+1),{expirationTtl:172800});
    const m=await dbGet(env, `games/${b.code}/meta`, token), list=await env.KV.list({prefix:'m:', limit:PING_MAX}); let sent=0;
    for(const k of list.keys){ const id=k.name.slice(2); if(id===b.id) continue; if(await push(env, id, {title:'Someone wants a match', body:`${clean((m&&m.names||[])[0])} is looking for a game.`, url:`/?join=${b.code}`})) sent++; }
    return {sent};
  },
};
// Runs every hour: the Daily Challenge alert goes to whoever it's now noon for, in their own time zone (metadata means no extra reads per player)
const localHour = (tz, now) => { try{ return +new Intl.DateTimeFormat('en-US',{timeZone:tz, hour:'numeric', hourCycle:'h23'}).format(now); }catch(e){ return -1; } };
export async function dailyAlerts(env, now=new Date()){
  let cursor, sent=0;
  do{ const page=await env.KV.list({prefix:'d:', limit:1000, cursor}); cursor=page.list_complete?null:page.cursor;
    for(const k of page.keys) if(localHour((k.metadata||{}).tz||'UTC', now)===DAILY_HOUR && await push(env, k.name.slice(2), {title:'Daily Challenge', body:'Today’s battle is ready.', url:'/'})) sent++;
  }while(cursor);
  return sent;
}
export default {
  scheduled(ev, env, ctx){ ctx.waitUntil(dailyAlerts(env)); },
  async fetch(req, env){
    const origin=req.headers.get('Origin'), ok=origin===env.SITE || /^http:\/\/localhost(:\d+)?$/.test(origin||''), cors={'Access-Control-Allow-Origin':ok?origin:env.SITE, 'Access-Control-Allow-Headers':'Content-Type', 'Access-Control-Allow-Methods':'POST', Vary:'Origin'};
    if(req.method==='OPTIONS') return new Response(null,{headers:cors});
    const name=new URL(req.url).pathname.slice(1), fn=routes[name];
    if(req.method!=='POST' || !fn || !ok) return new Response('{}',{status:404,headers:cors});
    try{ const b=await req.json(), uid=await verifyToken(b.token,env); if(!uid) return new Response('{"error":"sign in"}',{status:401,headers:cors});
      return new Response(JSON.stringify(await fn(b,env,b.token,uid)),{headers:{...cors,'Content-Type':'application/json'}});
    }catch(e){ return new Response('{"error":"failed"}',{status:500,headers:cors}); }
  },
};
