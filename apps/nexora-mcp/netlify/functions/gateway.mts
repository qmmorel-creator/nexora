import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

function env(k) { const v = Netlify.env.get(k); if (!v) throw new Error('Missing configuration'); return v; }
function base() { return env('MCP_PUBLIC_ORIGIN'); }
function hash(v) { return createHash('sha256').update(v).digest('base64url'); }
function random() { return randomBytes(32).toString('base64url'); }
function db() { if (!getApps().length) initializeApp({credential:cert(JSON.parse(env('FIREBASE_SERVICE_ACCOUNT_JSON')))}); return getFirestore(); }
function json(d, status=200, headers={}) { return Response.json(d,{status,headers:{'Cache-Control':'no-store',...headers}}); }
function error(code, status=400) { return json({error:code},status); }
function sign(s) { return createHmac('sha256',env('MCP_CLIENT_SIGNING_KEY')).update(s).digest('base64url'); }
function equal(a,b) { const x=Buffer.from(a), y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
function validRedirect(s) { return s==='https://chatgpt.com/connector_platform_oauth_redirect' || /^https:\/\/chatgpt\.com\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(s); }
function client(id) { const [s,sig,...rest]=String(id).split('.'); if(rest.length||!s||!sig||!equal(sign(s),sig)) throw new Error('Invalid client'); const d=JSON.parse(Buffer.from(s,'base64url').toString()); if(!Array.isArray(d.redirect_uris)||!d.redirect_uris.every(validRedirect)) throw new Error('Invalid redirects'); return d; }
function flow(q) {
 const p=Object.fromEntries(q); const c=client(p.client_id);
 if(p.response_type!=='code'||p.code_challenge_method!=='S256'||!/^[-_a-zA-Z0-9]{43}$/.test(p.code_challenge||'')||!c.redirect_uris.includes(p.redirect_uri)||p.resource!==base()+'/mcp') throw new Error('Invalid authorization request');
 const scopes=(p.scope||'nexora:read nexora:write').split(' ').filter(Boolean);
 if(scopes.some(s=>!['nexora:read','nexora:write'].includes(s))) throw new Error('Invalid scope');
 return {...p,scope:scopes.join(' ')};
}
function doc(kind,token) { return db().collection('nexora_mcp_'+kind).doc(hash(token)); }
function record(data, seconds) { return {...data,expiresAt:Timestamp.fromMillis(Date.now()+seconds*1000)}; }
function active(d) { return d && d.expiresAt.toMillis()>Date.now(); }
async function issue(transaction, data) {
 const access=random(), refresh=random();
 transaction.set(doc('access',access),record(data,3600));
 transaction.set(doc('refresh',refresh),record(data,30*86400));
 return {access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:data.scope};
}
async function api(path,method='GET',body=null) {
 const r=await fetch('https://nexora-project.org'+path,{method,redirect:'error',headers:{Authorization:'Bearer '+env('NEXORA_ASSISTANT_API_KEY'),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
 if(!r.ok) throw new Error('Nexora API HTTP '+r.status);
 const d=await r.json(); if(d.ok!==true) throw new Error('Nexora rejected operation'); return d;
}
function result(data) { return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data}; }
function server(scope) {
 const s=new McpServer({name:'nexora',version:'0.1.0'},{instructions:'Use Europe/Paris for relative dates. Resolve project IDs with list_projects. Create only requested tasks. Reuse idempotencyKey when retrying the same request. Read back a task before confirming success.'});
 if(scope.includes('nexora:read')) {
  s.registerTool('list_projects',{description:'Lister projets, statuts et types Nexora pour résoudre les noms.',inputSchema:{},annotations:{readOnlyHint:true,openWorldHint:false}},async()=>{
   const d=await api('/api/nexora/read?scope=catalogs');
   return result({catalogs:Object.fromEntries(['projects','statuses','taskTypes'].map(k=>[k,(d.catalogs[k]||[]).map(v=>({id:v.id,name:v.name,projectId:v.projectId??null}))]))});
  });
  s.registerTool('get_task',{description:'Relire une tâche Nexora par son identifiant.',inputSchema:{taskId:z.string().min(1).max(200)},annotations:{readOnlyHint:true,openWorldHint:false}},async({taskId})=>result(await api('/api/nexora/tasks/manage?taskId='+encodeURIComponent(taskId))));
 }
 if(scope.includes('nexora:write')) {
  s.registerTool('create_task',{description:'Créer une tâche Nexora demandée par l’utilisateur. Résoudre les identifiants via list_projects, réutiliser idempotencyKey en cas de réessai et joindre les documents Google Drive pertinents.',inputSchema:{title:z.string().min(1).max(240),projectId:z.string().min(1),idempotencyKey:z.string().min(1).max(500),description:z.string().max(10000).optional(),taskTypeId:z.string().optional(),statusId:z.string().optional(),start:z.string().date().optional(),end:z.string().date().optional(),sourceUrl:z.string().url().optional(),attachments:z.array(z.object({type:z.literal('link'),provider:z.literal('google-drive'),driveKind:z.enum(['file','folder']),name:z.string().min(1).max(300),url:z.string().url().refine(v=>{try{return ['drive.google.com','docs.google.com'].includes(new URL(v).hostname);}catch{return false;}})})).max(20).optional()},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async(args)=>result(await api('/api/nexora/tasks','POST',{...args,source:'assistant'})));
 }
 return s;
}
export default async function handler(req) {
 try {
  const url=new URL(req.url), path=url.pathname;
  if(path==='/client-config') return json({apiKey:env('FIREBASE_WEB_API_KEY')});
  if(path==='/health') return json({ok:true,service:'nexora-mcp',version:'0.1.0'});
  if(path.startsWith('/.well-known/oauth-protected-resource')) return json({resource:base()+'/mcp',authorization_servers:[base()],scopes_supported:['nexora:read','nexora:write']});
  if(path==='/.well-known/oauth-authorization-server') return json({issuer:base(),authorization_endpoint:base()+'/oauth/authorize',token_endpoint:base()+'/oauth/token',registration_endpoint:base()+'/oauth/register',revocation_endpoint:base()+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],scopes_supported:['nexora:read','nexora:write'],authorization_response_iss_parameter_supported:true});
  if(Number(req.headers.get('content-length')||0)>32768) return error('request_too_large',413);
  if(path==='/oauth/register'&&req.method==='POST') {
   const p=await req.json(); if(!Array.isArray(p.redirect_uris)||!p.redirect_uris.length||p.redirect_uris.length>5||!p.redirect_uris.every(validRedirect)) return error('invalid_redirect_uri');
   if(p.token_endpoint_auth_method&&p.token_endpoint_auth_method!=='none') return error('invalid_client_metadata');
   const data={redirect_uris:[...new Set(p.redirect_uris)],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']};
   const v=Buffer.from(JSON.stringify(data)).toString('base64url'); return json({...data,client_id:v+'.'+sign(v)},201);
  }
  if(path==='/oauth/authorize'&&req.method==='GET') {
   flow(url.searchParams);
   const target=new URL('/connect.html',base()); target.search=url.search; return Response.redirect(target,302);
  }
  if(path==='/oauth/authorize'&&req.method==='POST') {
   if(req.headers.get('origin')!==base()) return error('invalid_origin',403);
   const input=await req.json(), p=flow(new URLSearchParams(input.parameters));
   db(); const identity=await getAuth().verifyIdToken(input.idToken,true);
   if(identity.uid!==env('NEXORA_USER_UID')) return error('access_denied',403);
   const code=random(); await doc('codes',code).create(record({uid:identity.uid,clientId:p.client_id,redirectUri:p.redirect_uri,challenge:p.code_challenge,scope:p.scope,resource:p.resource},300));
   const redirect=new URL(p.redirect_uri); redirect.searchParams.set('code',code); redirect.searchParams.set('iss',base()); if(p.state) redirect.searchParams.set('state',p.state);
   return json({redirect:redirect.toString()});
  }
  if(path==='/oauth/token'&&req.method==='POST') {
   const p=Object.fromEntries(new URLSearchParams(await req.text())); client(p.client_id);
   if(p.resource!==base()+'/mcp') return error('invalid_target');
   const refresh=p.grant_type==='refresh_token';
   if(!refresh&&p.grant_type!=='authorization_code') return error('unsupported_grant_type');
   const token=refresh?p.refresh_token:p.code; if(!token||token.length>200) return error('invalid_grant');
   const output=await db().runTransaction(async t=>{
    const ref=doc(refresh?'refresh':'codes',token), snap=await t.get(ref), d=snap.data();
    if(!active(d)||d.clientId!==p.client_id||d.resource!==p.resource) throw new Error('Invalid grant');
    if(!refresh&&(!/^[A-Za-z0-9._~-]{43,128}$/.test(p.code_verifier||'')||hash(p.code_verifier)!==d.challenge||p.redirect_uri!==d.redirectUri)) throw new Error('Invalid PKCE');
    if(refresh&&p.scope&&p.scope!==d.scope) throw new Error('Invalid scope');
    t.delete(ref); return issue(t,{uid:d.uid,clientId:d.clientId,scope:d.scope,resource:d.resource});
   });
   return json(output);
  }
  if(path==='/oauth/revoke'&&req.method==='POST') {
   const p=Object.fromEntries(new URLSearchParams(await req.text())); client(p.client_id);
   if(p.token) for(const kind of ['access','refresh']) await db().runTransaction(async t=>{const ref=doc(kind,p.token),snap=await t.get(ref);if(snap.data()?.clientId===p.client_id)t.delete(ref);});
   return json({});
  }
  if(path==='/mcp') {
   const token=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
   const d=token?(await doc('access',token).get()).data():null;
   if(!active(d)||d.uid!==env('NEXORA_USER_UID')||d.resource!==base()+'/mcp') return json({error:'unauthorized'},401,{'WWW-Authenticate':'Bearer resource_metadata="'+base()+'/.well-known/oauth-protected-resource/mcp"'});
   if(req.method!=='POST') return new Response(null,{status:405,headers:{Allow:'POST'}});
   const origin=req.headers.get('origin'); if(origin&&origin!==base()&&origin!=='https://chatgpt.com') return error('invalid_origin',403);
   const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
   const mcp=server(d.scope.split(' ')); await mcp.connect(transport);
   try{return await transport.handleRequest(req);}finally{await transport.close();await mcp.close();}
  }
  return error('not_found',404);
 } catch { return error('request_failed',400); }
}
export const config={path:['/mcp','/health','/client-config','/oauth/*','/.well-known/*']};
