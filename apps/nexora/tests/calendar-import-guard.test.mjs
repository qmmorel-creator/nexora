import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('The interface cannot run the legacy destructive Calendar rebuild',async()=>{
 const source=await readFile(new URL('../source/index.html.part-001',import.meta.url),'utf8');
 const start=source.indexOf('const syncGoogleCalendar = async () => {');
 const guard=source.indexOf('return;',start);
 const legacy=source.indexOf('PURGE COMPLÈTE des tâches',start);
 assert.ok(start>=0&&guard>start&&legacy>guard,'the legacy rebuild must remain unreachable from the UI');
 assert.match(source.slice(start,guard),/import_google_calendar_events/);
});
