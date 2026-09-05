import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
const cfg=JSON.parse(readFileSync(0,'utf8'));
initializeApp({credential:cert(JSON.parse(cfg.FIREBASE_SERVICE_ACCOUNT_JSON))});
const token=randomBytes(32).toString('base64url'), hash=createHash('sha256').update(token).digest('base64url');
const db=getFirestore(),ref=db.collection('nexora_mcp_access').doc(hash);let taskId;const key='mcp-prod-test-20260905-'+randomBytes(6).toString('hex');
async function call(name,args){const start=Date.now();const r=await fetch(cfg.MCP_PUBLIC_ORIGIN+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});assert.equal(r.status,200);const d=await r.json();assert.ok(!d.error);assert.ok(!d.result.isError);console.log(name,Math.round((Date.now()-start)/1000)+'s');return d.result.structuredContent;}
try{
 await ref.create({uid:cfg.NEXORA_USER_UID,clientId:'internal-production-test',scope:'nexora:read nexora:write',resource:cfg.MCP_PUBLIC_ORIGIN+'/mcp',expiresAt:Timestamp.fromMillis(Date.now()+300000)});
 const args={title:'[TEST MCP] Création directe ChatGPT — recette',projectId:'wdrjzc1s',taskTypeId:'tt1',statusId:'s1',idempotencyKey:key,description:'Recette technique autorisée du serveur MCP. Archivage après vérification.'};
 const created=await call('create_task',args);taskId=created.task.id;assert.equal(created.created,true);
 const read=await call('get_task',{taskId});assert.equal(read.tasks[0].title,args.title);assert.equal(read.tasks[0].projectId,args.projectId);
 const retry=await call('create_task',args);assert.equal(retry.created,false);assert.equal(retry.task.id,taskId);
 console.log('Création MCP en production, relecture et absence de doublon validées.');
}finally{
 if(taskId){const r=await fetch('https://nexora-project.org/api/nexora/tasks/manage',{method:'PATCH',headers:{Authorization:'Bearer '+cfg.NEXORA_ASSISTANT_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({taskId,action:'archive',idempotencyKey:key+'-archive'})});const d=await r.json();assert.equal(d.ok,true);assert.equal(d.action,'archive');console.log('Tâche technique archivée.');}
 await ref.delete();console.log('Accès technique supprimé.');
}
