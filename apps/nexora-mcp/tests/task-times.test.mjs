import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTaskTimes,taskChangesSchema} from '../src/nexora.mts';

// #299 : ChatGPT écrit les heures lues par la vue Calendrier (#294).
const day={start:'2026-09-24',end:'2026-09-24'};
test('HH:MM times are kept and a missing end lasts one hour',()=>{
 assert.deepEqual(resolveTaskTimes({...day,startTime:'17:30',endTime:'18:30'}),{...day,startTime:'17:30',endTime:'18:30'});
 assert.equal(resolveTaskTimes({...day,startTime:'17:30'}).endTime,'18:30');
 assert.equal(resolveTaskTimes({...day,startTime:'23:30'}).endTime,'23:59');
});
test('Empty or null times mean all day and clear both fields',()=>{
 assert.deepEqual(resolveTaskTimes({...day,startTime:'',endTime:''}),{...day,startTime:'',endTime:''});
 assert.deepEqual(resolveTaskTimes({...day,startTime:null}),{...day,startTime:'',endTime:''});
 assert.deepEqual(resolveTaskTimes({...day}),{...day},'a task without any time field gains none');
});
test('Incoherent times are refused rather than silently fixed',()=>{
 assert.throws(()=>resolveTaskTimes({...day,endTime:'10:00'}),/endTime requires startTime/);
 assert.throws(()=>resolveTaskTimes({...day,startTime:'17:30',endTime:'09:00'}),/after startTime/);
 assert.throws(()=>resolveTaskTimes({...day,startTime:'5:30 PM'}),/Invalid startTime/);
 assert.deepEqual(resolveTaskTimes({start:'2026-09-24',end:'2026-09-26',startTime:'18:00',endTime:'09:00'}).endTime,'09:00','an earlier clock time on a later day is legitimate');
});
test('Tool schema only accepts HH:MM or an empty value',()=>{
 for(const ok of ['08:00','23:59','',null])assert.equal(taskChangesSchema.safeParse({startTime:ok}).success,true,String(ok));
 for(const bad of ['8:00','17h30','24:00','5:30 PM'])assert.equal(taskChangesSchema.safeParse({startTime:bad}).success,false,bad);
});
