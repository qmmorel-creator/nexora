import {createHash} from 'node:crypto';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const date=v=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Invalid calendar date');return v;};
const paris=v=>new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
const add=(v,n)=>{const d=new Date(date(v)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function calendarConfig(settings,projects,now=new Date()){
 if(!settings||!Array.isArray(settings.calendars)||!settings.calendars.length)throw Error('No selected Google calendars in gcalSettings');
 const calendars=settings.calendars.map(c=>{
  const matches=projects.filter(p=>p.gcalSource&&p.gcalCalendarId===c.id);
  if(matches.length!==1)throw Error('Calendar project missing or ambiguous: '+c.id);
  return {calendarId:c.id,projectId:matches[0].id,name:matches[0].name};
 });
 if(new Set(calendars.map(c=>c.calendarId)).size!==calendars.length)throw Error('Duplicate selected calendar');
 const past=settings.daysPast??30,future=settings.daysFuture??365;
 if(!Number.isInteger(past)||past<0||past>3660||!Number.isInteger(future)||future<1||future>3660)throw Error('Invalid calendar window');
 const today=paris(now);
 return {calendars,window:{from:add(today,-past),to:add(today,future)},configVersion:hash({calendars,past,future}),timezone:'Europe/Paris'};
}
const clock=v=>{if(!/^\d{2}:\d{2}$/.test(v||''))throw Error('Invalid calendar time');const [h,m]=v.split(':').map(Number);if(h>23||m>59)throw Error('Invalid calendar time');return v;};
export function normalizeGoogleCalendarEventDates(event){
 const a=event.start,b=event.end;
 if(a?.date&&b?.date){const start=date(a.date),end=add(date(b.date),-1);if(end<start)throw Error('Invalid all-day interval');return {start,end,startTime:'',endTime:'',gcalAllDay:true};}
 if(!a?.dateTime||!b?.dateTime||!/(Z|[+-]\d{2}:\d{2})$/.test(a.dateTime)||!/(Z|[+-]\d{2}:\d{2})$/.test(b.dateTime)||!Number.isFinite(Date.parse(a.dateTime))||!Number.isFinite(Date.parse(b.dateTime))||Date.parse(b.dateTime)<=Date.parse(a.dateTime))throw Error('Invalid timed event interval');
 const time=v=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(v));
 const dates={start:date(paris(a.dateTime)),end:date(paris(b.dateTime)),startTime:clock(time(a.dateTime)),endTime:clock(time(b.dateTime)),gcalAllDay:false};
 if(dates.start>dates.end)throw Error('Invalid timed event interval');
 return dates;
}
export function planCalendarImport({tasks,archive,projects,statuses,taskTypes,settings},args,now=new Date()){
 const config=calendarConfig(settings,projects,now);
 if(args.configVersion!==config.configVersion)throw Error('Calendar configuration changed; read config again');
 const target=config.calendars.find(c=>c.calendarId===args.calendarId);if(!target)throw Error('Calendar not selected');
 const age=now.getTime()-Date.parse(args.observedAt);if(!Number.isFinite(age)||age< -300000||age>3600000)throw Error('Read Google Calendar again: observation is stale');
 if(!Array.isArray(args.events)||args.events.length>50)throw Error('At most 50 events per batch');
 const planning=taskTypes.filter(t=>t.name.toLowerCase()==='planning'&&(!t.projectId||t.projectId===target.projectId));if(planning.length!==1)throw Error('Planning type missing or ambiguous');
 const today=paris(now),next=[...tasks],archived=[...archive],results=[];const seen=new Set();
 for(const event of args.events){
  if(!event.id||seen.has(event.id))throw Error('Missing or duplicate event ID in batch');seen.add(event.id);
  const matches=[...next,...archived].filter(t=>t.googleEventId===event.id&&t.gcalCalendarId===args.calendarId);
  if(matches.length>1)throw Error('Duplicate existing Google identity');
  const old=matches[0];if(old&&(!old.gcalImported||old.projectId!==target.projectId))throw Error('Existing task is not an imported task in the selected project');
  if(old?.gcalObservedAt&&Date.parse(old.gcalObservedAt)>Date.parse(args.observedAt))throw Error('Newer observation already imported');
  if(old?.gcalEventUpdated&&event.updated&&Date.parse(old.gcalEventUpdated)>Date.parse(event.updated))throw Error('Older Google event version');
  if(event.status==='cancelled'){
   if(!old){results.push({eventId:event.id,action:'absent'});continue;}
   if(archived.some(t=>t.id===old.id)){results.push({eventId:event.id,taskId:old.id,action:'archived'});continue;}
   next.splice(next.findIndex(t=>t.id===old.id),1);archived.push({...old,gcalCancelled:true,archivedAt:now.toISOString(),gcalObservedAt:args.observedAt,updatedAt:now.toISOString()});results.push({eventId:event.id,taskId:old.id,action:'cancelled'});continue;
  }
  // Cette normalisation et sa validation sont faites avant toute construction de
  // tâche : un événement invalide fait échouer le lot entier, sans écriture.
  const dates=normalizeGoogleCalendarEventDates(event);if(dates.start>config.window.to||dates.end<config.window.from)throw Error('Event outside configured window');
  if(old&&archived.some(t=>t.id===old.id)){results.push({eventId:event.id,taskId:old.id,action:'archived-preserved'});continue;}
  const statusName=dates.end<today?'Terminé':dates.start<=today?'En cours':'Planifié';
  const state=statuses.filter(s=>s.name===statusName&&(!s.projectId||s.projectId===target.projectId));if(state.length!==1)throw Error('Computed calendar status missing or ambiguous');
  const fields={...dates,title:event.summary||'(Sans titre)',location:event.location||'',googleEventId:event.id,gcalCalendarId:args.calendarId,gcalImported:true,projectId:target.projectId,taskTypeId:planning[0].id,statusId:state[0].id,gcalSourceDescription:event.description||'',gcalEventUpdated:event.updated||null,gcalRecurringEventId:event.recurringEventId||null,gcalOriginalStartTime:event.originalStartTime||null};
  const sourceHash=hash(fields);
  if(old?.gcalSourceHash===sourceHash){results.push({eventId:event.id,taskId:old.id,action:'unchanged'});continue;}
  const task={id:old?.id||'gcal-'+hash([args.calendarId,event.id]).slice(0,40),progress:0,assignee:'',checklist:[],attachments:[],dependsOn:[],customFields:{},milestone:dates.start===dates.end,...old,...fields,desc:old?((old.gcalSourceDescription!==undefined&&old.desc===old.gcalSourceDescription)?fields.gcalSourceDescription:old.desc||fields.gcalSourceDescription):fields.gcalSourceDescription,gcalSourceHash:sourceHash,gcalObservedAt:args.observedAt,updatedAt:now.toISOString()};
  if(next.some(t=>t.id===task.id&&t!==old)||archived.some(t=>t.id===task.id))throw Error('Task ID collision');
  if(old)next[next.findIndex(t=>t.id===old.id)]=task;else next.push(task);
  results.push({eventId:event.id,taskId:task.id,action:old?'updated':'created'});
 }
 return {tasks:next,archive:archived,results,config};
}
