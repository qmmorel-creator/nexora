import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import handler from '../netlify/functions/gateway.mts';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
const cfg=JSON.parse(readFileSync(0,'utf8'));globalThis.Netlify={env:{get:k=>cfg[k]}};
initializeApp({credential:cert(JSON.parse(cfg.FIREBASE_SERVICE_ACCOUNT_JSON))});const db=getFirestore(),origin=cfg.MCP_PUBLIC_ORIGIN;
const hash=v=>createHash('sha256').update(v).digest('base64url'),code=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
const paths=[];let calls=0;
async function req(path,body,token,form=false){const execute=cfg.TEST_REMOTE?fetch:handler;const r=await execute(new Request(origin+path,{method:'POST',headers:{'Content-Type':form?'application/x-www-form-urlencoded':'application/json','Accept':'application/json, text/event-stream',...(token?{Authorization:'Bearer '+token}:{})},body:form?new URLSearchParams(body):JSON.stringify(body)}));return {status:r.status,data:await r.json()};}
try{
 const registration=await req('/oauth/register',{redirect_uris:['https://chatgpt.com/connector_platform_oauth_redirect']});assert.equal(registration.status,201);
 const client=registration.data.client_id;
 const ref=db.collection('nexora_mcp_codes').doc(hash(code));paths.push(ref.path);await ref.create({uid:cfg.NEXORA_USER_UID,clientId:client,redirectUri:'https://chatgpt.com/connector_platform_oauth_redirect',challenge:hash(verifier),scope:'nexora:read nexora:write',resource:origin+'/mcp',expiresAt:Timestamp.fromMillis(Date.now()+60000)});
 const grant={grant_type:'authorization_code',code,code_verifier:verifier,client_id:client,redirect_uri:'https://chatgpt.com/connector_platform_oauth_redirect',resource:origin+'/mcp'};
 const denied=await req('/oauth/token',{...grant,code_verifier:'x'.repeat(43)},null,true);assert.equal(denied.status,400);
 const token=await req('/oauth/token',grant,null,true);assert.equal(token.status,200);paths.push('nexora_mcp_access/'+hash(token.data.access_token),'nexora_mcp_refresh/'+hash(token.data.refresh_token));
 assert.equal((await req('/oauth/token',grant,null,true)).status,400);
 const initialized=await req('/mcp',{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'nexora-test',version:'1'}}},token.data.access_token);assert.equal(initialized.data.result.serverInfo.name,'nexora');
 const tools=await req('/mcp',{jsonrpc:'2.0',id:2,method:'tools/list',params:{}},token.data.access_token);assert.equal(tools.data.result.tools.length,3);
 const listed=await req('/mcp',{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'list_projects',arguments:{}}},token.data.access_token);assert.ok(listed.data.result.structuredContent.catalogs.projects.some(p=>p.name==='Perso'));
 const fresh=await req('/oauth/token',{grant_type:'refresh_token',refresh_token:token.data.refresh_token,client_id:client,resource:origin+'/mcp'},null,true);assert.equal(fresh.status,200);paths.push('nexora_mcp_access/'+hash(fresh.data.access_token),'nexora_mcp_refresh/'+hash(fresh.data.refresh_token));
 assert.equal((await req('/oauth/token',{grant_type:'refresh_token',refresh_token:token.data.refresh_token,client_id:client,resource:origin+'/mcp'},null,true)).status,400);
 console.log('OAuth/PKCE, usage unique, initialisation MCP, 3 outils, lecture Nexora et rotation de refresh validés. Connexion utilisateur interactive non testée.');
}finally{for(const path of paths)await db.doc(path).delete();console.log('Documents techniques OAuth supprimés.');}
