import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarConfig,planCalendarImport} from '../src/calendar.mts';
const now=new Date('2026-09-06T10:00:00Z');
const base=()=>({tasks:[],archive:[],projects:[{id:'p',gcalSource:true,gcalCalendarId:'cal',name:'Calendar'}],statuses:[{id:'done',name:'Terminé'},{id:'active',name:'En cours'},{id:'planned',name:'Planifié'}],taskTypes:[{id:'planning',name:'Planning'}],settings:{calendars:[{id:'cal'}],daysPast:30,daysFuture:365}});
const event=(id='event')=>({id,summary:'Event',start:{date:'2026-09-07'},end:{date:'2026-09-08'}});
const args=(b,events=[event()])=>({calendarId:'cal',configVersion:calendarConfig(b.settings,b.projects,now).configVersion,observedAt:now.toISOString(),events});
test('Same Google identity preserves ID and notes across updates and repeated imports',()=>{
 const b=base(),a=args(b);let p=planCalendarImport(b,a,now);const id=p.tasks[0].id;
 assert.equal(p.tasks[0].end,'2026-09-07');b.tasks=p.tasks;
 assert.equal(planCalendarImport(b,a,now).results[0].action,'unchanged');
 b.tasks[0].desc='Personal notes';b.tasks[0].attachments=[{url:'https://example.org'}];
 const changed={...event(),summary:'Moved',description:'Google description',start:{date:'2026-09-08'},end:{date:'2026-09-09'}};
 p=planCalendarImport(b,args(b,[changed]),now);assert.equal(p.tasks[0].id,id);assert.equal(p.tasks[0].desc,'Personal notes');assert.equal(p.tasks[0].attachments.length,1);assert.equal(p.tasks[0].start,'2026-09-08');
});
test('Cross-midnight UTC and exclusive all-day end preserve Paris dates',()=>{
 const b=base();const p=planCalendarImport(b,args(b,[{id:'timed',start:{dateTime:'2026-09-06T22:30:00Z'},end:{dateTime:'2026-09-06T23:30:00Z'}}]),now);
 assert.equal(p.tasks[0].start,'2026-09-07');assert.equal(p.tasks[0].startTime,'00:30');assert.equal(p.tasks[0].statusId,'planned');
});
test('Only explicit cancellation archives; empty batches preserve all tasks',()=>{
 const b=base();b.tasks=planCalendarImport(b,args(b),now).tasks;
 assert.equal(planCalendarImport(b,args(b,[]),now).tasks.length,1);
 const p=planCalendarImport(b,args(b,[{id:'event',status:'cancelled'}]),now);assert.equal(p.tasks.length,0);assert.equal(p.archive.length,1);
 const again=planCalendarImport({...b,tasks:[],archive:p.archive},args(b),now);assert.equal(again.tasks.length,0);assert.equal(again.results[0].action,'archived-preserved');
});
test('Reject stale observations, wrong scope, duplicate sources and invalid dates before writing',()=>{
 const b=base(),a=args(b);
 assert.throws(()=>planCalendarImport(b,{...a,observedAt:'2026-09-05T10:00:00Z'},now),/stale/);
 assert.throws(()=>planCalendarImport(b,{...a,calendarId:'other'},now),/not selected/);
 assert.throws(()=>planCalendarImport(b,{...a,configVersion:'bad'},now),/changed/);
 assert.throws(()=>planCalendarImport(b,args(b,[event(),event()]),now),/duplicate/);
 assert.throws(()=>planCalendarImport(b,args(b,[{...event(),start:{date:'2026-02-30'}}]),now),/Invalid/);
 b.tasks=planCalendarImport(b,a,now).tasks;b.tasks.push({...b.tasks[0],id:'duplicate'});
 assert.throws(()=>planCalendarImport(b,a,now),/Duplicate existing/);
});
test('Native tasks and other calendars are untouched; calendar IDs disambiguate events',()=>{
 const b=base();b.tasks=[{id:'native',projectId:'p',title:'Native'},{id:'other',googleEventId:'event',gcalCalendarId:'other',gcalImported:true}];
 const p=planCalendarImport(b,args(b),now);assert.deepEqual(p.tasks.slice(0,2),b.tasks);assert.equal(p.tasks.length,3);
});
