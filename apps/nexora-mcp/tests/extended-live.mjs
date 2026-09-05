import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
let input='';for await(const c of process.stdin){input+=c;if(input.includes('\n'))break;}const cfg=JSON.parse(input);
globalThis.Netlify={env:{get:k=>cfg[k]}};
initializeApp({credential:cert(JSON.parse(cfg.FIREBASE_SERVICE_ACCOUNT_JSON))});
const db=getFirestore(),token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('base64url'),ref=db.collection('nexora_mcp_access').doc(hash);const key='extended-mcp-test-'+Date.now();let taskId,version,resourceId;
const handler=cfg.TEST_REMOTE?null:(await import('../netlify/functions/gateway.mts')).default;
async function rpc(method,params){const req=new Request(cfg.MCP_PUBLIC_ORIGIN+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const r=handler?await handler(req):await fetch(req);assert.equal(r.status,200);const d=await r.json();assert.ok(!d.error,JSON.stringify(d));return d.result;}
async function call(name,args={}){const started=Date.now();const d=await rpc('tools/call',{name,arguments:args});assert.ok(!d.isError,JSON.stringify(d));console.log(name,Date.now()-started,'ms');return d.structuredContent;}
try{
 await ref.create({uid:cfg.NEXORA_USER_UID,clientId:'internal-extension-test',scope:'nexora:read nexora:write',resource:cfg.MCP_PUBLIC_ORIGIN+'/mcp',expiresAt:Timestamp.fromMillis(Date.now()+900000)});
 const tools=await rpc('tools/list',{});assert.ok(tools.tools.length>=17);console.log('tools',tools.tools.map(x=>x.name).join(', '));
 const health=await call('get_health');assert.equal(health.authenticated,true);assert.ok(health.counts.tasks>1000);
 const list=await call('list_tasks',{dateFrom:'2026-09-05',dateTo:'2026-09-05',dateField:'end'});assert.ok(list.tasks.every(t=>t.end==='2026-09-05'));console.log('due today',list.total);
 const meetings=await call('list_meetings',{dateFrom:'2026-09-05',dateTo:'2026-09-05',dateField:'overlap'});assert.ok(meetings.tasks.every(t=>t.taskTypeName==='Réunions'));console.log('meetings today',meetings.total);
 const summary=await call('get_summary',{dateFrom:'2026-09-05',dateTo:'2026-09-05'});assert.equal(summary.counts.due,list.total);
 const a={title:'[TEST MCP] Recette extension — à archiver',projectId:'wdrjzc1s',taskTypeId:'tt3',description:'Ordre du jour technique.',start:'2026-09-05',end:'2026-09-05',sourceMessageId:key,idempotencyKey:key};
 const created=await call('create_task',a);assert.equal(created.created,true);taskId=created.task.id;version=created.version;
 const read=await call('get_task',{taskId});assert.equal(read.tasks[0].version,version);const retry=await call('create_task',a);assert.equal(retry.task.id,taskId);assert.ok(retry.replayed||retry.created===false);
 const updated=await call('update_task',{taskId,expectedVersion:version,idempotencyKey:key+'-update',changes:{assignee:'Recette MCP',checklist:[{id:'test-item',text:'Vérifier',done:false}]}});version=updated.version;assert.equal(updated.task.desc,a.description);
 const conflict=await rpc('tools/call',{name:'update_task',arguments:{taskId,expectedVersion:created.version,idempotencyKey:key+'-conflict',changes:{title:'Do not save'}}});assert.equal(conflict.isError,true);
 const attached=await call('add_attachment',{taskId,expectedVersion:version,idempotencyKey:key+'-link',attachment:{name:'Documentation de recette',provider:'web',url:'https://developers.openai.com/plugins/deploy/connect-chatgpt'}});version=attached.version;
 const report=await call('save_meeting_report',{taskId,expectedVersion:version,idempotencyKey:key+'-report',report:'Recette technique : recherche, relecture et modification vérifiées.'});version=report.version;
 const check=await call('get_task',{taskId});assert.equal(check.tasks[0].hasExplicitReport,true);assert.equal(check.tasks[0].attachments.length,1);assert.equal(check.tasks[0].checklist.length,1);
 const found=await call('list_tasks',{sourceMessageId:key});assert.equal(found.total,1);
 const complete=await call('complete_task',{taskId,expectedVersion:version,idempotencyKey:key+'-complete'});version=complete.version;assert.equal(complete.task.progress,100);
 const archived=await call('archive_task',{taskId,expectedVersion:version,idempotencyKey:key+'-archive'});version=archived.version;
 const restored=await call('restore_task',{taskId,expectedVersion:version,idempotencyKey:key+'-restore'});version=restored.version;assert.equal(restored.task.archivedAt,undefined);
 const resources=await call('read_resource',{resource:'projectFolders'});resourceId='test-mcp-'+Date.now();const resource=await call('mutate_resource',{resource:'projectFolders',action:'create',id:resourceId,expectedRevision:resources.revision,idempotencyKey:key+'-folder',changes:{name:'[TEST MCP] Dossier recette'}});
 const readRes=await call('read_resource',{resource:'projectFolders',id:resourceId});assert.equal(readRes.items.length,1);
 await call('mutate_resource',{resource:'projectFolders',action:'delete',id:resourceId,expectedRevision:resource.revision,idempotencyKey:key+'-folder-delete'});resourceId=null;
 await call('get_activity',{dateFrom:'2026-09-05',dateTo:'2026-09-05',limit:5});
 console.log('Extended integration PASS');
}finally{
 if(taskId){const current=await call('get_task',{taskId});await call('archive_task',{taskId,expectedVersion:current.tasks[0].version,idempotencyKey:key+'-cleanup'});console.log('Technical task archived',taskId);}
 if(resourceId){const x=await call('read_resource',{resource:'projectFolders'});await call('mutate_resource',{resource:'projectFolders',action:'delete',id:resourceId,expectedRevision:x.revision,idempotencyKey:key+'-cleanup-folder'});}
 await ref.delete();console.log('Temporary access removed');
}
process.exit(0);
