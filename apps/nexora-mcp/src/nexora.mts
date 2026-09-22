import {createHash, randomUUID} from 'node:crypto';
import {z} from 'zod';
import {calendarConfig,planCalendarImport} from './calendar.mts';

export const RESOURCES = ['projects','statuses','taskTypes','projectFolders','viewFolders','teamMembers','customFieldDefs','risks','expenses','expenseCategories','budgetLines','deadlines','deadlineSettings','taskBaselines','activityLog','momentumSnapshots','workflows','workflowExecutionLog','notifications','favorites','dashboards','dashboardFolders','dashboardWidgets','enabledViews','appearance','shortcutPrefs','startupPref','metaFilters','syncedCalendarSettings','gcalSyncState','habitThemes','habitLog','proMissions','proTimeEntries','proExpenseCategories','proExpenses','proBillingSchedule','proPayments','financeProSettings'] as const;
/* habitLog est en lecture seule ici : les règles métier du journal (exclusivité
   des thèmes « single », bornage [min,max] des habitudes « numeric », voir
   toggleHabitLogEntry/setHabitLogValue côté front #193) ne sont pas connues
   d'une fusion générique par id — seul log_habit les applique. habitThemes,
   catalogue simple, reste en écriture générique comme les autres catalogues. */
/* Finance PRO (#267, lot #276) : les 7 ressources pro* sont exposées en
   LECTURE SEULE uniquement, comme premier lot MCP — écriture volontairement
   hors périmètre tant que la politique de confirmation (#277, conçue mais
   non activée : voir NEXORA:FINANCEPRO-CONFIRM, part-004) n'est pas mise en
   œuvre côté MCP. Aucune de ces ressources ne touche à l'infrastructure
   KDM360/Supabase — uniquement les clés Firebase nexora:pro*. */
const READ_ONLY = new Set(['activityLog','momentumSnapshots','workflowExecutionLog','gcalSyncState','habitLog','proMissions','proTimeEntries','proExpenseCategories','proExpenses','proBillingSchedule','proPayments','financeProSettings']);
/* Écriture AUTORISÉE mais bornée : seul replace_settings est accepté, et chaque
   entrée est validée avant fusion. taskBaselines porte le plan initial du widget
   Time Machine — une entrée fausse y reste invisible jusqu'au jour où l'on
   compare le réel au prévu, d'où une validation stricte plutôt qu'une écriture
   libre comme sur un réglage ordinaire. */
const SETTINGS_ONLY = new Set(['taskBaselines']);
export const TASK_BASELINE_FIELDS = ['start','end','capturedAt'] as const;
const plainObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
/* Valide et normalise un lot de baselines. Rend un objet NEUF : la fusion se
   fait ensuite sur la valeur lue, donc une tâche absente du lot garde la sienne
   — on ne remplace jamais la carte entière. */
export function validateTaskBaselines(changes) {
 if(!plainObject(changes))throw new Error('taskBaselines expects an object keyed by task ID');
 const out={};
 for(const [taskId,entry] of Object.entries(changes)){
  if(!taskId.trim())throw new Error('Empty task ID in taskBaselines');
  // Une clé héritée de JSON.parse pourrait réécrire le prototype de l'objet fusionné.
  if(['__proto__','constructor','prototype'].includes(taskId))throw new Error('Reserved task ID in taskBaselines: '+taskId);
  if(!plainObject(entry))throw new Error('Baseline for '+taskId+' must be an object');
  const extra=Object.keys(entry).filter(k=>!TASK_BASELINE_FIELDS.includes(k));
  if(extra.length)throw new Error('Unexpected field in baseline for '+taskId+': '+extra.join(', '));
  for(const field of TASK_BASELINE_FIELDS)if(!isDay(entry[field]))throw new Error('Baseline '+field+' for '+taskId+' must be a YYYY-MM-DD date');
  if(entry.start>entry.end)throw new Error('Baseline start is after end for '+taskId);
  out[taskId]={start:entry.start,end:entry.end,capturedAt:entry.capturedAt};
 }
 return out;
}
// --- Habit Tracker (#193) : mêmes règles que le bloc NEXORA:HABITS du front,
// reproduites ici pour que log_habit les applique côté serveur (single =
// exclusivité radio entre habitudes sœurs, numeric = valeur bornée [min,max]).
function normalizeHabitKind(v) {return ['check','numeric'].includes(v)?v:'check';}
export function normalizeHabits(list) {
 const out=[],seen=new Set();
 (Array.isArray(list)?list:[]).forEach(raw=>{
  if(!raw||typeof raw!=='object')return;
  const name=String(raw.name||'').trim();if(!name)return;
  const id=String(raw.id||'').trim()||name;if(seen.has(id))return;seen.add(id);
  const kind=normalizeHabitKind(raw.kind),min=Number.isFinite(raw.min)?raw.min:0,max=Number.isFinite(raw.max)&&raw.max>min?raw.max:min+10;
  out.push({id,name,color:String(raw.color||'').trim()||'#2C6BE0',kind,min,max});
 });
 return out;
}
export function normalizeHabitThemes(list) {
 const out=[],seen=new Set();
 (Array.isArray(list)?list:[]).forEach(raw=>{
  if(!raw||typeof raw!=='object')return;
  const name=String(raw.name||'').trim();if(!name)return;
  const id=String(raw.id||'').trim()||name;if(seen.has(id))return;seen.add(id);
  out.push({id,name,color:String(raw.color||'').trim()||'#7A8290',selectionMode:['single','multi'].includes(raw.selectionMode)?raw.selectionMode:'single',habits:normalizeHabits(raw.habits)});
 });
 return out;
}
function habitById(themes,habitId) {
 for(const theme of normalizeHabitThemes(themes)){const habit=theme.habits.find(h=>h.id===habitId);if(habit)return {habit,theme};}
 return null;
}
// Résout une habitude par ID (prioritaire) ou par nom, insensible à la casse et
// aux accents (comme normalize()) ; themeId/themeName lève l'ambiguïté quand
// deux thèmes ont une habitude du même nom.
function findHabit(themes,{habitId,habitName,themeId,themeName}) {
 const catalogue=normalizeHabitThemes(themes);
 if(habitId){const found=habitById(catalogue,habitId);if(!found)throw new Error('Unknown habitId');return found;}
 if(!habitName)throw new Error('habitId or habitName required');
 let pool=catalogue;
 if(themeId||themeName){
  const theme=themeId?catalogue.find(t=>t.id===themeId):catalogue.find(t=>normalize(t.name)===normalize(themeName));
  if(!theme)throw new Error('Unknown theme');
  pool=[theme];
 }
 const matches=[];
 for(const theme of pool)for(const habit of theme.habits)if(normalize(habit.name)===normalize(habitName))matches.push({habit,theme});
 if(!matches.length)throw new Error('Habit not found; use list_resources/read_resource on habitThemes for exact names');
 if(matches.length>1)throw new Error('Ambiguous habit name across themes; specify themeId or themeName');
 return matches[0];
}
function habitLogCellId(habitId,date) {return String(habitId||'').trim()+'|'+String(date||'').trim();}
const HABIT_LOG_ISO_RE=/^\d{4}-\d{2}-\d{2}$/;
// Identifiant DÉRIVÉ (habitId|date) : deux écritures concurrentes sur la même
// case fusionnent au lieu de dupliquer, comme staffingCellId.
function normalizeHabitLog(list,knownHabitIds) {
 const known=Array.isArray(knownHabitIds)?new Set(knownHabitIds.map(String)):null,byId=new Map();
 (Array.isArray(list)?list:[]).forEach(entry=>{
  if(!entry||typeof entry!=='object')return;
  const habitId=String(entry.habitId||'').trim(),date=String(entry.date||'').trim();
  if(!habitId||!HABIT_LOG_ISO_RE.test(date))return;
  if(known&&!known.has(habitId))return;
  const id=habitLogCellId(habitId,date),out={id,habitId,date};
  if(Number.isFinite(entry.value))out.value=entry.value;
  byId.set(id,out);
 });
 return [...byId.values()].sort((a,b)=>a.date===b.date?a.habitId.localeCompare(b.habitId):a.date.localeCompare(b.date));
}
export function fingerprint(v) { return createHash('sha256').update(JSON.stringify(v)).digest('hex'); }
export function normalize(v) {return String(v??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();}
export function parisDate(v=new Date()) {return new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));}
export function ensureTaskDates(task, now=new Date()) {
 const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 for(const field of ['start','end'])if(task[field]!=null&&task[field]!==''&&!valid(task[field]))throw new Error('Invalid '+field+' date');
 let receipt=task.sourceReceivedDate||task.receivedDate;
 if(receipt&&!valid(receipt))throw new Error('Invalid received date');
 if(!receipt&&task.sourceReceivedAt){if(!Number.isFinite(Date.parse(task.sourceReceivedAt)))throw new Error('Invalid received timestamp');receipt=parisDate(task.sourceReceivedAt);}
 const fallback=task.start||task.end||receipt||parisDate(now);
 if(!task.start&&!task.end)task.dateFallback=receipt?'email_received':'execution';
 task.start=task.start||fallback;task.end=task.end||fallback;
 if(task.start>task.end)throw new Error('End precedes start');
 return task;
}
function day(v) {if(!v)return null;const parsed=new Date(v);if(!Number.isFinite(parsed.getTime()))return null;return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:parisDate(parsed);}
function clean(v) {if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!/(token|password|secret|credential|apiKey)/i.test(k)).map(([k,x])=>[k,clean(x)]));if(typeof v==='string'&&v.startsWith('data:'))return '[inline binary omitted]';return v;}
export function reportEvidence(t,defs=[]) {
 const evidence=[];
 for(const key of ['meetingMinutes','minutes','meetingReport','report','compteRendu'])if(t[key])evidence.push({field:key,value:t[key]});
 for(const d of defs)if(/compte.?rendu|minutes|rapport.*reunion/i.test(normalize(d.name))&&t.customFields?.[d.id])evidence.push({field:'customFields.'+d.id,name:d.name,value:t.customFields[d.id]});
 if(/(?:^|\n)\s*(?:#{1,6}\s*)?(?:compte[ -]rendu|cr de reunion|minutes)(?:\s|:|$)/i.test(normalize(t.desc)))evidence.push({field:'desc',value:t.desc});
 return evidence;
}
export function isComplete(t,statuses) {return Number(t.progress)>=100||!!t.completedAt||statuses.some(s=>s.id===t.statusId&&['termine','terminee','completed','done','livre'].includes(normalize(s.name)));}
export function filterTasks(tasks,catalogs,args) {
 const meetingIds=new Set(catalogs.taskTypes.filter(x=>['reunion','reunions'].includes(normalize(x.name))).map(x=>x.id));
 const project=args.projectId||(args.projectName?resolve(catalogs.projects,args.projectName):null);
 const type=args.taskTypeId||(args.taskTypeName?resolve(catalogs.taskTypes,args.taskTypeName):null);
 const status=args.statusId||(args.statusName?resolve(catalogs.statuses,args.statusName):null);
 if(args.dateFrom&&args.dateTo&&args.dateFrom>args.dateTo)throw new Error('dateFrom must precede dateTo');
 return tasks.filter(t=>{
  if(project&&t.projectId!==project&&t.secondaryProjectId!==project)return false;
  if(type&&t.taskTypeId!==type)return false;if(status&&t.statusId!==status)return false;
  if(args.meetingsOnly&&!meetingIds.has(t.taskTypeId))return false;
  if(args.completed!==undefined&&isComplete(t,catalogs.statuses)!==args.completed)return false;
  for(const k of ['sourceMessageId','sourceThreadId','documentId','googleEventId'])if(args[k]){
   const match=k==='documentId'?(t.documentId===args[k]||t.document_id===args[k]||(t.attachments||[]).some(a=>a.documentId===args[k]||a.id===args[k]||String(a.url||'').includes(args[k]))):t[k]===args[k];if(!match)return false;
  }
  if(args.query&&!normalize(JSON.stringify(clean(t))).includes(normalize(args.query)))return false;
  if(args.assignee&&!normalize(t.assignee).includes(normalize(args.assignee)))return false;
  if(args.hasReport!==undefined&&(reportEvidence(t,catalogs.customFieldDefs).length>0)!==args.hasReport)return false;
  if(args.dateFrom||args.dateTo){const from=args.dateFrom||'0000-01-01',to=args.dateTo||'9999-12-31';
   if(args.dateField==='overlap'){const start=day(t.start||t.end),end=day(t.end||t.start);if(!start||!end||start>to||end<from)return false;}
   else {const v=args.dateField==='updatedAt'?(t.updatedAt||t.lastInteraction):t[args.dateField||'end'];const d=day(v);if(!d||d<from||d>to)return false;}
  }return true;
 }).sort((a,b)=>String(a[args.sortBy||'end']||'9999').localeCompare(String(b[args.sortBy||'end']||'9999'))||String(a.id).localeCompare(String(b.id)));
}
function resolve(items,name){const matches=items.filter(x=>normalize(x.name)===normalize(name));if(matches.length!==1)throw new Error('Name missing or ambiguous; use an exact ID from list_projects');return matches[0].id;}
export const querySchema={query:z.string().max(500).optional(),projectId:z.string().optional(),projectName:z.string().optional(),statusId:z.string().optional(),statusName:z.string().optional(),taskTypeId:z.string().optional(),taskTypeName:z.string().optional(),assignee:z.string().optional(),dateFrom:z.string().date().optional(),dateTo:z.string().date().optional(),dateField:z.enum(['start','end','overlap','completedAt','updatedAt']).default('end'),completed:z.boolean().optional(),meetingsOnly:z.boolean().optional(),hasReport:z.boolean().optional(),sourceMessageId:z.string().optional(),sourceThreadId:z.string().optional(),documentId:z.string().optional(),googleEventId:z.string().optional(),archive:z.enum(['active','archived','all']).default('active'),sortBy:z.enum(['start','end','title','updatedAt']).default('end'),limit:z.number().int().min(1).max(100).default(40),cursor:z.string().max(1000).optional(),detail:z.enum(['summary','full']).default('summary')};
const jsonObject=z.record(z.unknown());
export const taskChangesSchema=z.object({title:z.string().min(1).max(240).optional(),description:z.string().max(100000).optional(),projectId:z.string().min(1).optional(),secondaryProjectId:z.string().nullable().optional(),statusId:z.string().min(1).optional(),taskTypeId:z.string().min(1).optional(),start:z.string().date().nullable().optional(),end:z.string().date().nullable().optional(),progress:z.number().min(0).max(100).optional(),assignee:z.string().max(500).optional(),priority:z.string().max(80).optional(),milestone:z.boolean().optional(),milestoneIcon:z.string().nullable().optional(),checklist:z.array(jsonObject).max(500).optional(),dependsOn:z.array(z.string()).max(500).optional(),recurrence:jsonObject.nullable().optional(),customFields:jsonObject.optional(),attachments:z.array(jsonObject).max(200).optional(),source:z.string().optional(),sourceUrl:z.string().url().nullable().optional(),sourceMessageId:z.string().nullable().optional(),sourceThreadId:z.string().nullable().optional(),sourceSender:z.string().nullable().optional(),sourceReceivedAt:z.string().datetime({offset:true}).optional(),sourceReceivedDate:z.string().date().optional(),receivedDate:z.string().date().optional(),documentId:z.string().nullable().optional(),orderNumber:z.string().nullable().optional(),trackingNumber:z.string().nullable().optional(),startTime:z.string().optional(),endTime:z.string().optional(),location:z.string().optional(),participants:z.array(z.string()).optional()}).strict();
export function repository(db,uid){
 const col=db.collection('users').doc(uid).collection('kv_store');
 async function read(name,tx){const key='nexora:'+name,ref=col.doc(key);const snap=await (tx?tx.get(ref):ref.get());const meta=snap.data();if(!meta)return {name,ref,meta:null,value:[],revision:null};let raw=meta.value;
  if(meta.storageMode==='chunked-v1'){
   if(!Array.isArray(meta.chunkIds)||meta.chunkCount!==meta.chunkIds.length||!meta.chunkIds.length)throw new Error('Invalid chunk manifest: '+name);
   if(meta.chunkIds.some(id=>!id.startsWith(key+'--nexora-chunk--')||id.includes('/')))throw new Error('Invalid chunk reference');
   const chunks=await (tx?tx.getAll(...meta.chunkIds.map(id=>col.doc(id))):db.getAll(...meta.chunkIds.map(id=>col.doc(id))));
   raw=chunks.map((s,i)=>{const d=s.data();if(!d||d.parentKey!==key||d.revision!==meta.revision||d.index!==i)throw new Error('Inconsistent chunk: '+name);return d.chunk;}).join('');
   if(raw.length!==meta.totalLength)throw new Error('Incomplete data: '+name);
  }
  if(typeof raw!=='string')throw new Error('Invalid stored value: '+name);return {name,ref,meta,value:JSON.parse(raw),revision:meta.revision||meta.updatedAt||null};
 }
 function write(tx,doc,value){const key='nexora:'+doc.name,raw=JSON.stringify(value),revision=randomUUID(),now=new Date().toISOString(),chunks=[];for(let i=0;i<raw.length;i+=150000)chunks.push(raw.slice(i,i+150000));if(chunks.length>200)throw new Error('Resource too large for atomic write');
  for(const id of doc.meta?.chunkIds||[])tx.delete(col.doc(id));
  if(chunks.length<=1)tx.set(doc.ref,{value:raw,revision,updatedAt:now,storageMode:'inline',chunkCount:0,totalLength:raw.length});
  else{const chunkIds=chunks.map((_,i)=>key+'--nexora-chunk--'+revision+'-'+String(i).padStart(4,'0'));chunks.forEach((chunk,index)=>tx.set(col.doc(chunkIds[index]),{parentKey:key,revision,index,chunk,updatedAt:now}));tx.set(doc.ref,{value:null,revision,updatedAt:now,storageMode:'chunked-v1',chunkIds,chunkCount:chunks.length,totalLength:raw.length});}return revision;
 }
 async function snapshot(names){return db.runTransaction(async tx=>Object.fromEntries(await Promise.all(names.map(async n=>[n,await read(n,tx)]))));}
 async function catalogs(){const d=await snapshot(['projects','statuses','taskTypes','customFieldDefs','teamMembers']);return Object.fromEntries(Object.entries(d).map(([k,v])=>[k,clean(v.value)]));}
 async function taskSnapshot(archive='active'){return snapshot(['tasks',...(archive!=='active'?['taskArchive']:[]),'projects','statuses','taskTypes','customFieldDefs']);}
 function selected(d,archive){return [...(archive!=='archived'?d.tasks.value.map(x=>({...x,_archived:false})):[]),...(d.taskArchive?.value||[]).map(x=>({...x,_archived:true}))];}
 function enrich(t,c,full=false){const core=full?clean(t):Object.fromEntries(['id','title','projectId','secondaryProjectId','statusId','taskTypeId','start','end','progress','assignee','completedAt','sourceMessageId','sourceThreadId','documentId','googleEventId','gcalCalendarId','sourceUrl','_archived'].filter(k=>t[k]!==undefined).map(k=>[k,t[k]]));const {_archived,...original}=t;return {...core,version:fingerprint(original),projectName:c.projects.find(x=>x.id===t.projectId)?.name??null,statusName:c.statuses.find(x=>x.id===t.statusId)?.name??null,taskTypeName:c.taskTypes.find(x=>x.id===t.taskTypeId)?.name??null,hasExplicitReport:reportEvidence(t,c.customFieldDefs).length>0,...(full?{reportEvidence:reportEvidence(t,c.customFieldDefs)}:{})};}
 async function list(args){const d=await taskSnapshot(args.archive),c=Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.value]));const items=filterTasks(selected(d,args.archive),c,args);const sig=fingerprint(Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.revision]))),filter=fingerprint({...args,cursor:undefined});let offset=0;if(args.cursor){const cursor=JSON.parse(Buffer.from(args.cursor,'base64url').toString());if(cursor.sig!==sig||cursor.filter!==filter)throw new Error('Data changed or filters differ; restart pagination');offset=cursor.offset;if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Invalid cursor');}const page=[];let pageBytes=0;for(const item of items.slice(offset,offset+args.limit)){const size=Buffer.byteLength(JSON.stringify(enrich(item,c,args.detail==='full')));if(page.length&&pageBytes+size>500000)break;page.push(item);pageBytes+=size;}return {ok:true,timezone:'Europe/Paris',generatedAt:new Date().toISOString(),date:parisDate(),total:items.length,count:page.length,dataQuality:{invalidDateCount:selected(d,args.archive).filter(t=>['start','end','completedAt'].some(k=>t[k]&&!day(t[k]))).length},tasks:page.map(t=>enrich(t,c,args.detail==='full')),nextCursor:offset+page.length<items.length?Buffer.from(JSON.stringify({sig,filter,offset:offset+page.length})).toString('base64url'):null};}
 async function get(taskId){const d=await taskSnapshot('all'),c=Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.value]));const t=selected(d,'all').filter(x=>x.id===taskId);if(t.length!==1)throw new Error('Task missing or duplicate ID');return {ok:true,count:1,tasks:[enrich(t[0],c,true)]};}
 async function atomic(operation,key,request,fn){const ref=db.collection('users').doc(uid).collection('nexora_mcp_operations').doc(fingerprint(key));const requestHash=fingerprint({operation,request});return db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();if(old){if(old.requestHash!==requestHash)throw new Error('Idempotency key already used for another request');return {...old.result,replayed:true,...(operation==='create_task'?{created:false}:{})};}const out=await fn(tx);tx.set(ref,{operation,requestHash,result:out,createdAt:new Date().toISOString()});return out;});}
 function validateTask(t,c){for(const [field,resource] of [['projectId','projects'],['secondaryProjectId','projects'],['statusId','statuses'],['taskTypeId','taskTypes']]){if(t[field]&&!c[resource].some(x=>x.id===t[field]))throw new Error('Unknown '+field);}for(const key of ['statuses','taskTypes']){const item=c[key].find(x=>x.id===t[key==='statuses'?'statusId':'taskTypeId']);if(item?.projectId&&item.projectId!==t.projectId)throw new Error('Catalog item belongs to another project');}if(t.start&&t.end&&t.start>t.end)throw new Error('End precedes start');if(t.dependsOn?.includes(t.id))throw new Error('Task cannot depend on itself');}
 async function mutateTask(args,action='update'){return atomic(action,args.idempotencyKey,args,async tx=>{
  const d=Object.fromEntries(await Promise.all(['tasks','taskArchive','projects','statuses','taskTypes'].map(async n=>[n,await read(n,tx)]))),c=Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.value]));
  const active=c.tasks.find(t=>t.id===args.taskId),archived=c.taskArchive.find(t=>t.id===args.taskId);if(active&&archived)throw new Error('Duplicate task ID');const old=active||archived;if(!old)throw new Error('Task not found');if(args.expectedVersion&&fingerprint(old)!==args.expectedVersion)throw new Error('Conflict: task changed; read it again');
  let next={...old},changes={...(args.changes||{})};if('description'in changes){changes.desc=changes.description;delete changes.description;}
  if(action==='update')next={...old,...changes};
  if(action==='complete'){const done=c.statuses.filter(x=>normalize(x.name)==='termine'&&(!x.projectId||x.projectId===old.projectId));if(done.length!==1)throw new Error('Completion status ambiguous');next={...old,statusId:done[0].id,progress:100,completedAt:new Date().toISOString()};}
  if(action==='update'&&('statusId'in changes||'progress'in changes)){if(Number(next.progress)<100&&normalize(c.statuses.find(x=>x.id===next.statusId)?.name)!=='termine')delete next.completedAt;}
  if(action==='archive')next.archivedAt=new Date().toISOString();if(action==='restore')delete next.archivedAt;
  if(action==='delete'&&!archived)throw new Error('Archive task before permanent deletion');
  if(action==='add_attachment'){const a=args.attachment;const list=old.attachments||[];if(!list.some(x=>x.url===a.url||(a.documentId&&(x.documentId===a.documentId||x.id===a.documentId))))next.attachments=[...list,{...a,id:a.id||a.documentId||randomUUID(),addedAt:new Date().toISOString()}];if(args.documentId)next.documentId=args.documentId;}
  if(action==='save_meeting_report'){if(!c.taskTypes.some(x=>x.id===old.taskTypeId&&['reunion','reunions'].includes(normalize(x.name))))throw new Error('Task is not an explicit meeting');next.meetingReport=(old.meetingReport?old.meetingReport+'\n\n':'')+'## Compte rendu — '+parisDate()+'\n'+args.report;}
  if(action!=='delete')ensureTaskDates(next);validateTask(next,c);next.updatedAt=new Date().toISOString();next.lastInteraction=next.updatedAt;
  const destination=action==='archive'?'taskArchive':action==='restore'?'tasks':active?'tasks':'taskArchive';
  for(const name of ['tasks','taskArchive']){const array=c[name].filter(t=>t.id!==old.id);if(name===destination&&action!=='delete')array.push(next);if(c[name].some(t=>t.id===old.id)||name===destination)write(tx,d[name],array);}
  return {ok:true,action,taskId:old.id,version:action==='delete'?null:fingerprint(next),task:action==='delete'?null:clean(next)};
 });}
 async function createTask(args){return atomic('create_task',args.idempotencyKey,args,async tx=>{
  const d=Object.fromEntries(await Promise.all(['tasks','taskArchive','projects','statuses','taskTypes'].map(async n=>[n,await read(n,tx)]))),c=Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v.value]));
  const existing=[...c.tasks,...c.taskArchive].filter(t=>t.idempotencyKey===args.idempotencyKey||(args.sourceMessageId&&t.sourceMessageId===args.sourceMessageId)||(args.documentId&&t.documentId===args.documentId));
  if(existing.length>1)throw new Error('Multiple source matches; resolve before creating');if(existing.length)return {ok:true,created:false,task:clean(existing[0]),version:fingerprint(existing[0])};
  const {idempotencyKey,description,...fields}=args;const now=new Date().toISOString();
  const task={id:'mcp-'+randomUUID(),projectId:args.projectId,title:args.title,taskTypeId:args.taskTypeId||resolve(c.taskTypes,'Tâches'),statusId:args.statusId||resolve(c.statuses,'À planifier'),progress:0,start:null,end:null,milestone:false,desc:description||'',assignee:'',checklist:[],dependsOn:[],recurrence:null,customFields:{},attachments:[],source:'assistant',...fields,idempotencyKey,createdAt:now,updatedAt:now,lastInteraction:now};
  ensureTaskDates(task);validateTask(task,c);write(tx,d.tasks,[...c.tasks,task]);return {ok:true,created:true,task:clean(task),version:fingerprint(task)};
 });}
 async function readResource(args){if(!RESOURCES.includes(args.resource))throw new Error('Unsupported resource');const d=await read(args.resource);let value=clean(d.value);if(Array.isArray(value)){if(args.id)value=value.filter(x=>x.id===args.id);if(args.query)value=value.filter(x=>normalize(JSON.stringify(x)).includes(normalize(args.query)));const total=value.length;return {ok:true,resource:args.resource,revision:d.revision,total,items:value.slice(args.offset,args.offset+args.limit),nextOffset:args.offset+args.limit<total?args.offset+args.limit:null};}return {ok:true,resource:args.resource,revision:d.revision,value};}
 async function mutateResource(args){if(!RESOURCES.includes(args.resource)||READ_ONLY.has(args.resource))throw new Error('Resource is read-only');
  if(SETTINGS_ONLY.has(args.resource)&&args.action!=='replace_settings')throw new Error('Resource only accepts replace_settings');
  return atomic('resource',args.idempotencyKey,args,async tx=>{if(args.action!=='delete'&&!args.changes)throw new Error('changes required');if(['update','delete'].includes(args.action)&&!args.id)throw new Error('id required');const d=await read(args.resource,tx);if(d.revision!==args.expectedRevision)throw new Error('Conflict: read resource again');let value=d.value;
  if(args.action==='replace_settings'){
   /* Ressource encore jamais écrite : read() rend [] pour une clé absente, ce
      qui faisait passer un réglage-objet pour une liste et refusait la toute
      PREMIÈRE écriture. Une liste non vide, elle, reste une vraie erreur. */
   if(SETTINGS_ONLY.has(args.resource)&&Array.isArray(value)&&!value.length)value={};
   if(Array.isArray(value))throw new Error('Use entity operations for lists');
   // Validé AVANT la fusion : un lot partiellement faux ne doit rien écrire.
   const changes=args.resource==='taskBaselines'?validateTaskBaselines(args.changes):args.changes;
   value={...value,...changes};}
  else {if(!Array.isArray(value))throw new Error('Use replace_settings for object settings');const idx=value.findIndex(x=>x.id===args.id);if(args.action==='create'){if(idx>=0)throw new Error('ID already exists');if(!args.changes?.name&&['projects','statuses','taskTypes','teamMembers','projectFolders'].includes(args.resource))throw new Error('Name required');value=[...value,{...args.changes,id:args.id||randomUUID()}];}
   else {if(idx<0)throw new Error('Entity not found');if(value[idx].locked&&['statuses','taskTypes'].includes(args.resource))throw new Error('Built-in catalog entry is locked');if(args.action==='delete'){
    if(['projects','statuses','taskTypes','projectFolders'].includes(args.resource)){const tasks=await read('tasks',tx),archive=await read('taskArchive',tx),projects=await read('projects',tx);const field={projects:'projectId',statuses:'statusId',taskTypes:'taskTypeId',projectFolders:'folderId'}[args.resource];if([...tasks.value,...archive.value,...projects.value].some(x=>x[field]===args.id||x.secondaryProjectId===args.id))throw new Error('Entity still referenced; move its records first');}
    value=value.filter((_,i)=>i!==idx);
   }else value=value.map((x,i)=>i===idx?{...x,...args.changes,id:x.id}:x);}
  }const revision=write(tx,d,value);const entity=Array.isArray(value)?(args.action==='create'?value[value.length-1]:value.find(x=>x.id===args.id)):null;return {ok:true,resource:args.resource,revision,action:args.action,...(entity?{entity:clean(entity)}:{})};});}
 async function logHabit(args){return atomic('log_habit',args.idempotencyKey,args,async tx=>{
  const themesDoc=await read('habitThemes',tx),logDoc=await read('habitLog',tx);
  const themes=normalizeHabitThemes(themesDoc.value),found=findHabit(themes,args);
  const known=themes.flatMap(t=>t.habits.map(h=>h.id)),date=args.date||parisDate();
  const current=normalizeHabitLog(logDoc.value,known),id=habitLogCellId(found.habit.id,date);
  let next=current.filter(e=>e.id!==id);
  if(found.habit.kind==='numeric'){
   if(args.value===undefined)throw new Error('value required for a numeric habit (a number, or null to clear)');
   if(typeof args.value==='boolean')throw new Error('value must be a number or null for a numeric habit');
   if(args.value!==null){
    const num=Number(args.value);if(!Number.isFinite(num))throw new Error('value must be a finite number');
    next.push({id,habitId:found.habit.id,date,value:Math.max(found.habit.min,Math.min(found.habit.max,num))});
   }
  } else {
   if(typeof args.value==='number')throw new Error('value must be a boolean, null, or omitted (toggle) for a check habit');
   const already=current.some(e=>e.id===id);
   const nextState=args.value===undefined?!already:args.value===null?false:args.value;
   if(nextState){
    if(found.theme.selectionMode==='single'){const siblingIds=new Set(found.theme.habits.map(h=>h.id));next=next.filter(e=>!(e.date===date&&siblingIds.has(e.habitId)));}
    next.push({id,habitId:found.habit.id,date});
   }
  }
  const normalized=normalizeHabitLog(next,known);write(tx,logDoc,normalized);
  const entry=normalized.find(e=>e.id===id)||null;
  return {ok:true,date,habit:{id:found.habit.id,name:found.habit.name,kind:found.habit.kind,themeId:found.theme.id,themeName:found.theme.name,selectionMode:found.theme.selectionMode},entry,checked:!!entry};
 });}
 async function habitLog(args){
  const [themesDoc,logDoc]=await Promise.all([read('habitThemes'),read('habitLog')]);
  const themes=normalizeHabitThemes(themesDoc.value),known=themes.flatMap(t=>t.habits.map(h=>h.id));
  let entries=normalizeHabitLog(logDoc.value,known);
  if(args.dateFrom)entries=entries.filter(e=>e.date>=args.dateFrom);
  if(args.dateTo)entries=entries.filter(e=>e.date<=args.dateTo);
  if(args.habitId)entries=entries.filter(e=>e.habitId===args.habitId);
  if(args.themeId){const theme=themes.find(t=>t.id===args.themeId);if(!theme)throw new Error('Unknown themeId');const ids=new Set(theme.habits.map(h=>h.id));entries=entries.filter(e=>ids.has(e.habitId));}
  const items=entries.map(e=>{const found=habitById(themes,e.habitId);return {...e,habitName:found?.habit.name??null,themeId:found?.theme.id??null,themeName:found?.theme.name??null};});
  return {ok:true,revision:logDoc.revision,count:items.length,entries:items};
 }
 async function googleCalendarConfig(){const d=await snapshot(['gcalSettings','projects']);return {ok:true,...calendarConfig(d.gcalSettings.value,d.projects.value)};}
 async function importGoogleCalendar(args){return atomic('import_google_calendar_events',args.idempotencyKey,args,async tx=>{
  const names=['tasks','taskArchive','projects','statuses','taskTypes','gcalSettings'];
  const d=Object.fromEntries(await Promise.all(names.map(async n=>[n,await read(n,tx)])));
  const plan=planCalendarImport({tasks:d.tasks.value,archive:d.taskArchive.value,projects:d.projects.value,statuses:d.statuses.value,taskTypes:d.taskTypes.value,settings:d.gcalSettings.value},args);
  if(plan.results.some(x=>['created','updated','cancelled'].includes(x.action)))write(tx,d.tasks,plan.tasks);
  if(plan.results.some(x=>x.action==='cancelled'))write(tx,d.taskArchive,plan.archive);
  return {ok:true,calendarId:args.calendarId,mode:'readonly-upsert',results:plan.results,counts:plan.results.reduce((out,x)=>(out[x.action]=(out[x.action]||0)+1,out),{}),coverage:'Batch only; missing events are never deleted. Read back each returned task ID.'};
 });}
 return {read,snapshot,catalogs,list,get,createTask,mutateTask,readResource,mutateResource,taskSnapshot,selected,enrich,googleCalendarConfig,importGoogleCalendar,logHabit,habitLog};
}
