import fs from 'node:fs';
const inline = ['layout.js','data.js','engine.js','ui.js'].map(f=>`<script>\n${fs.readFileSync(f,'utf8')}\n</script>`).join('\n');
for (const n of process.argv.slice(2)) {
  const src = fs.readFileSync(`${n}.src.html`,'utf8');
  const pub = src.replace('<!--THREE-->','<script src="https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js"></script>').replace('<!--INLINE-->',()=>inline);
  fs.mkdirSync('out',{recursive:true});
  fs.writeFileSync(`out/rucher-${n}.html`, pub);
  const local = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + src.replace('<!--THREE-->',`<script src="file://${process.cwd()}/node_modules/three/build/three.min.js"></script>`).replace('<!--INLINE-->',()=>inline) + '</body></html>';
  fs.writeFileSync(`out/local-${n}.html`, local);
}
