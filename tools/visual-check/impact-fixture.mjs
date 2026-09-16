import {readFile,writeFile} from 'node:fs/promises';
import {buildHarness} from './build-harness.mjs';
import {compileUi} from '../../apps/nexora/scripts/compile-ui.mjs';
const dir=await buildHarness({compile:false});
const fixture=await readFile(new URL('./harness.jsx',import.meta.url),'utf8');
const template=await readFile(dir+'/index.html','utf8');
const bootstrap=`
function ImpactHarness(){
 const [activity,setActivity]=useState(false),[value,setValue]=useState('');
 const example={...seedTasks[0],projectId:seedProjects[0].id,start:'2026-09-01',end:'2026-09-30',progress:20};
 const upstream=Array.from({length:10},(_,i)=>({...example,id:'before-'+i,title:'Préparation '+i+' — vérifier le dossier et la livraison',dependsOn:[]}));
 const current={...example,id:'current',title:'Coordination du chantier et vérification finale',dependsOn:upstream.map(t=>t.id)};
 const downstream=Array.from({length:10},(_,i)=>({...example,id:'after-'+i,title:'Livraison '+i+' — réception et documentation',dependsOn:['current']}));
 const tasks=[...upstream,current,...downstream];
 const ctx={tasks,projects:seedProjects,statuses:seedStatuses,taskTypes:seedTaskTypes,teamMembers:seedTeamMembers};
 return <div className="lp-theme"><GlobalStyles/>{activity?<div style={{padding:20,maxWidth:480}}><LinkedActivitySelect activities={tasks} projects={seedProjects} value={value} onChange={setValue}/></div>:<ImpactLineModal taskId="current" tasks={tasks} ctx={ctx} risks={[]} onClose={()=>setActivity(true)} onOpenTask={()=>{}}/>}</div>;
}
const root=createRoot(document.getElementById('root'));root.render(<ImpactHarness/>);`;
await writeFile(dir+'/impact.html',await compileUi(template.replace(fixture,bootstrap)));
console.log('Impact fixture ready');
