import test from 'node:test';
import assert from 'node:assert/strict';
import {filterTasks,reportEvidence,parisDate,repository,fingerprint} from '../src/nexora.mts';
const c={projects:[{id:'p',name:'Projet'}],statuses:[{id:'s1',name:'À planifier'},{id:'s5',name:'Terminé'}],taskTypes:[{id:'tt1',name:'Tâches'},{id:'tt3',name:'Réunions'}],customFieldDefs:[]};
const tasks=[{id:'a',title:'Réunion dans le titre seulement',projectId:'p',taskTypeId:'tt1',start:'2026-09-04',end:'2026-09-05',progress:0},{id:'b',title:'Point',projectId:'p',taskTypeId:'tt3',start:'2026-09-05',end:'2026-09-05',desc:'Ordre du jour : budget'},{id:'c',taskTypeId:'tt3',start:'2026-09-05',end:'2026-09-06',desc:'## Compte rendu\nDécision validée.'},{id:'d',end:'2026-09-06',completedAt:'2026-09-04T22:30:00Z'}];
test('Paris day and inclusive due/completion dates differ correctly',()=>{assert.equal(parisDate('2026-09-04T22:30:00Z'),'2026-09-05');assert.deepEqual(filterTasks(tasks,c,{dateFrom:'2026-09-05',dateTo:'2026-09-05',dateField:'end'}).map(x=>x.id),['a','b']);assert.equal(filterTasks(tasks,c,{dateFrom:'2026-09-05',dateTo:'2026-09-05',dateField:'completedAt'})[0].id,'d');});
test('Meeting type is explicit; agenda is not a report',()=>{assert.equal(filterTasks(tasks,c,{meetingsOnly:true,dateFrom:'2026-09-05',dateTo:'2026-09-05',dateField:'overlap'}).length,2);assert.equal(reportEvidence(tasks[1]).length,0);assert.equal(reportEvidence(tasks[2]).length,1);assert.equal(filterTasks(tasks,c,{meetingsOnly:true,hasReport:true})[0].id,'c');});
function fakeDb(){const data=new Map();function ref(path){return {path,id:path.split('/').at(-1),collection:n=>collection(path+'/'+n),get:async()=>snap(path)};}function snap(path){return {exists:data.has(path),data:()=>structuredClone(data.get(path))};}function collection(path){return {doc:id=>ref(path+'/'+id)};}const db={collection,getAll:async(...refs)=>refs.map(r=>snap(r.path)),runTransaction:async fn=>{const writes=[];const result=await fn({get:async r=>snap(r.path),getAll:async(...refs)=>refs.map(r=>snap(r.path)),set:(r,v)=>writes.push(()=>data.set(r.path,structuredClone(v))),delete:r=>writes.push(()=>data.delete(r.path))});writes.forEach(f=>f());return result;}};for(const [name,value]of Object.entries({...c,tasks:[],taskArchive:[]}))data.set('users/u/kv_store/nexora:'+name,{value:JSON.stringify(value),revision:'initial',storageMode:'inline'});return {db,data};}
test('Atomic mutations preserve fields, reject stale versions, deduplicate, archive and restore',async()=>{const {db}=fakeDb(),r=repository(db,'u');const a={title:'Test',projectId:'p',idempotencyKey:'create',description:'Original',sourceMessageId:'mail1'};const x=await r.createTask(a);assert.equal(x.created,true);assert.equal((await r.createTask(a)).replayed,true);assert.equal((await r.createTask({...a,idempotencyKey:'other'})).created,false);await assert.rejects(()=>r.createTask({...a,title:'Different'}),/Idempotency/);const updated=await r.mutateTask({taskId:x.task.id,expectedVersion:x.version,idempotencyKey:'update',changes:{assignee:'Q'}});assert.equal(updated.task.desc,'Original');await assert.rejects(()=>r.mutateTask({taskId:x.task.id,expectedVersion:x.version,idempotencyKey:'stale',changes:{title:'Oops'}}),/Conflict/);const arc=await r.mutateTask({taskId:x.task.id,expectedVersion:updated.version,idempotencyKey:'archive'},'archive');assert.equal((await r.get(x.task.id)).tasks[0]._archived,true);const restore=await r.mutateTask({taskId:x.task.id,expectedVersion:arc.version,idempotencyKey:'restore'},'restore');assert.equal(restore.task.archivedAt,undefined);assert.equal((await r.get(x.task.id)).tasks[0]._archived,false);});
test('save_meeting_report writes to meetingReport, never to desc, and preserves earlier reports (#136)',async()=>{const {db}=fakeDb(),r=repository(db,'u');const created=await r.createTask({title:'Point budget',projectId:'p',taskTypeId:'tt3',description:'Ordre du jour : budget',idempotencyKey:'meeting1'});const first=await r.mutateTask({taskId:created.task.id,expectedVersion:created.version,idempotencyKey:'report1',report:'Décision A validée.'},'save_meeting_report');assert.match(first.task.meetingReport,/Décision A validée\./);assert.equal(first.task.desc,'Ordre du jour : budget');const second=await r.mutateTask({taskId:created.task.id,expectedVersion:first.version,idempotencyKey:'report2',report:'Décision B validée.'},'save_meeting_report');assert.match(second.task.meetingReport,/Décision A validée\./);assert.match(second.task.meetingReport,/Décision B validée\./);assert.equal(second.task.desc,'Ordre du jour : budget');const notMeeting=await r.createTask({title:'Tâche ordinaire',projectId:'p',taskTypeId:'tt1',idempotencyKey:'nonmeeting'});await assert.rejects(()=>r.mutateTask({taskId:notMeeting.task.id,expectedVersion:notMeeting.version,idempotencyKey:'report3',report:'Hors sujet'},'save_meeting_report'),/not an explicit meeting/);});
test('Chunk manifest roundtrip and atomic link append retain existing data',async()=>{const {db}=fakeDb(),r=repository(db,'u');const x=await r.createTask({title:'Test',projectId:'p',description:'é'.repeat(180000),idempotencyKey:'large'});assert.equal((await r.get(x.task.id)).tasks[0].desc.length,180000);const input={taskId:x.task.id,expectedVersion:x.version,idempotencyKey:'link',attachment:{name:'Doc',url:'https://drive.google.com/file/d/doc1/view',documentId:'doc1'}};const y=await r.mutateTask(input,'add_attachment');assert.equal(y.task.attachments.length,1);const retry=await r.mutateTask({...input,idempotencyKey:'newlink',expectedVersion:y.version},'add_attachment');assert.equal(retry.task.attachments.length,1);});
test('Pagination rejects changed source revision and validates catalog references',async()=>{const {db}=fakeDb(),r=repository(db,'u');for(let i=0;i<3;i++)await r.createTask({title:'Test'+i,projectId:'p',idempotencyKey:'key'+i});const q={archive:'active',limit:1,detail:'summary'},a=await r.list(q);assert.equal(a.total,3);assert.ok(a.nextCursor);assert.equal((await r.list({...q,cursor:a.nextCursor})).count,1);await r.createTask({title:'Test4',projectId:'p',idempotencyKey:'key4'});await assert.rejects(()=>r.list({...q,cursor:a.nextCursor}),/Data changed/);await assert.rejects(()=>r.createTask({title:'Bad',projectId:'missing',idempotencyKey:'bad'}),/Unknown projectId/);});
test('Malformed legacy dates do not break all searches',()=>{assert.equal(filterTasks([...tasks,{id:'bad',end:'NaN-NaN-NaN'}],c,{dateFrom:'2026-09-05',dateTo:'2026-09-05'}).length,2);});
test('Every task type receives dates, preserving explicit dates and Paris receipt day',async()=>{
 const {ensureTaskDates}=await import('../src/nexora.mts');
 const now=new Date('2026-09-05T22:30:00Z');
 for(const taskTypeId of ['tt1','tt3','tt-information']){const t=ensureTaskDates({taskTypeId},now);assert.equal(t.start,'2026-09-06');assert.equal(t.end,t.start);}
 assert.deepEqual(ensureTaskDates({start:'2026-09-01',end:'2026-09-12'},now),{start:'2026-09-01',end:'2026-09-12'});
 assert.equal(ensureTaskDates({end:'2026-08-12'},now).start,'2026-08-12');
 assert.equal(ensureTaskDates({start:'2026-08-12'},now).end,'2026-08-12');
 assert.equal(ensureTaskDates({start:null,end:null,sourceReceivedAt:'2026-09-02T23:30:00Z'},now).start,'2026-09-03');
 assert.throws(()=>ensureTaskDates({start:'2026-02-30'},now),/Invalid/);
});
test('Create and update cannot persist empty dates',async()=>{const {db}=fakeDb(),r=repository(db,'u');const t=await r.createTask({title:'Dates',projectId:'p',idempotencyKey:'dates',sourceReceivedDate:'2026-09-03'});assert.equal(t.task.start,'2026-09-03');assert.equal(t.task.end,'2026-09-03');const u=await r.mutateTask({taskId:t.task.id,expectedVersion:t.version,idempotencyKey:'clear-dates',changes:{start:null,end:null}});assert.equal(u.task.start,'2026-09-03');assert.equal(u.task.end,'2026-09-03');assert.equal((await r.createTask({title:'Dates',projectId:'p',idempotencyKey:'dates',sourceReceivedDate:'2026-09-03'})).task.start,'2026-09-03');});

/* taskBaselines — écriture contrôlée (#77).
   La ressource était en lecture seule : impossible de recaler en masse les dates
   de référence. Elle s'écrit désormais, mais par un seul chemin et sous
   validation : c'est le plan initial du Time Machine, une entrée fausse y reste
   invisible jusqu'au jour où l'on compare le réel au prévu. */
test('taskBaselines merges valid entries, keeps the others and stays idempotent',async()=>{
 const {db,data}=fakeDb();const r=repository(db,'u');
 data.set('users/u/kv_store/nexora:taskBaselines',{value:JSON.stringify({garde:{start:'2026-01-01',end:'2026-01-31',capturedAt:'2026-01-01'}}),revision:'initial',storageMode:'inline'});
 const before=await r.readResource({resource:'taskBaselines',offset:0,limit:50});
 const lot={a:{start:'2026-03-01',end:'2026-03-10',capturedAt:'2026-03-01'},b:{start:'2026-04-01',end:'2026-04-01',capturedAt:'2026-04-02'}};
 const out=await r.mutateResource({resource:'taskBaselines',action:'replace_settings',changes:lot,expectedRevision:before.revision,idempotencyKey:'baseline-1'});
 assert.equal(out.ok,true);
 const after=await r.readResource({resource:'taskBaselines',offset:0,limit:50});
 // Fusion : les entrées transmises s'ajoutent, celles qui ne le sont pas restent.
 assert.deepEqual(Object.keys(after.value).sort(),['a','b','garde']);
 assert.equal(after.value.garde.start,'2026-01-01');
 assert.equal(after.value.a.end,'2026-03-10');
 // Même clé d'idempotence : rejeu, pas seconde écriture.
 const replay=await r.mutateResource({resource:'taskBaselines',action:'replace_settings',changes:lot,expectedRevision:before.revision,idempotencyKey:'baseline-1'});
 assert.equal(replay.revision,out.revision);
 // Rejouer le MÊME lot sur la nouvelle révision ne change rien non plus.
 await r.mutateResource({resource:'taskBaselines',action:'replace_settings',changes:lot,expectedRevision:after.revision,idempotencyKey:'baseline-2'});
 const encore=await r.readResource({resource:'taskBaselines',offset:0,limit:50});
 assert.deepEqual(encore.value,after.value);
});

test('taskBaselines accepts its very first write on an untouched account',async()=>{
 // read() rend [] pour une clé absente : sans traitement, la toute première
 // écriture était refusée comme si le réglage était une liste.
 const {db}=fakeDb();const r=repository(db,'u');
 const out=await r.mutateResource({resource:'taskBaselines',action:'replace_settings',changes:{a:{start:'2026-03-01',end:'2026-03-10',capturedAt:'2026-03-01'}},expectedRevision:null,idempotencyKey:'premiere'});
 assert.equal(out.ok,true);
 assert.deepEqual((await r.readResource({resource:'taskBaselines',offset:0,limit:50})).value,{a:{start:'2026-03-01',end:'2026-03-10',capturedAt:'2026-03-01'}});
});

test('taskBaselines refuses any other action, and any malformed entry',async()=>{
 const {db}=fakeDb();const r=repository(db,'u');
 const rev=async()=>(await r.readResource({resource:'taskBaselines',offset:0,limit:50})).revision;
 const envoi=(changes,key)=>r.mutateResource({resource:'taskBaselines',action:'replace_settings',changes,expectedRevision:null,idempotencyKey:key});
 // Une ressource historiquement en lecture seule le reste.
 await assert.rejects(()=>r.mutateResource({resource:'activityLog',action:'replace_settings',changes:{},expectedRevision:null,idempotencyKey:'ro'}),/read-only/);
 // Seul replace_settings est accepté : pas de create/update/delete d'entité.
 for(const action of ['create','update','delete'])
  await assert.rejects(()=>r.mutateResource({resource:'taskBaselines',action,id:'a',changes:{start:'2026-03-01'},expectedRevision:null,idempotencyKey:'act-'+action}),/only accepts replace_settings/);
 await assert.rejects(()=>envoi([{id:'a'}],'liste'),/object keyed by task ID/);
 await assert.rejects(()=>envoi({'':{start:'2026-03-01',end:'2026-03-02',capturedAt:'2026-03-01'}},'vide'),/Empty task ID/);
 await assert.rejects(()=>envoi({a:'2026-03-01'},'scalaire'),/must be an object/);
 await assert.rejects(()=>envoi({a:{start:'2026-03-01',end:'2026-03-02',capturedAt:'2026-03-01',note:'x'}},'extra'),/Unexpected field/);
 await assert.rejects(()=>envoi({a:{start:'2026-03-01',end:'2026-03-02'}},'manquant'),/capturedAt .* must be a YYYY-MM-DD date/);
 await assert.rejects(()=>envoi({a:{start:'01/03/2026',end:'2026-03-02',capturedAt:'2026-03-01'}},'format'),/start .* must be a YYYY-MM-DD date/);
 await assert.rejects(()=>envoi({a:{start:'2026-02-30',end:'2026-03-02',capturedAt:'2026-03-01'}},'inexistante'),/start .* must be a YYYY-MM-DD date/);
 await assert.rejects(()=>envoi({a:{start:'2026-03-10',end:'2026-03-01',capturedAt:'2026-03-01'}},'inverse'),/start is after end/);
 // JSON.parse, et non un littéral : c'est ainsi qu'un lot arrive du réseau, et
 // c'est le seul cas où __proto__ devient une propriété propre — donc dangereuse.
 await assert.rejects(()=>envoi(JSON.parse('{"__proto__":{"start":"2026-03-01","end":"2026-03-02","capturedAt":"2026-03-01"}}'),'proto'),/Reserved task ID/);
 // Un lot partiellement faux n'écrit RIEN : la ressource est intacte.
 await assert.rejects(()=>envoi({bon:{start:'2026-03-01',end:'2026-03-02',capturedAt:'2026-03-01'},mauvais:{start:'2026-03-10',end:'2026-03-01',capturedAt:'2026-03-01'}},'partiel'),/start is after end/);
 // read() rend [] pour une clé jamais écrite : rien n'a été créé au passage.
 assert.deepEqual((await r.readResource({resource:'taskBaselines',offset:0,limit:50})).items,[]);
 assert.equal(await rev(),null);
});
