import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/gateway.mts';
globalThis.Netlify={env:{get:k=>({MCP_PUBLIC_ORIGIN:'https://nexora-chatgpt-mcp.netlify.app',MCP_CLIENT_SIGNING_KEY:'local-test-key-only'}[k])}};
const origin=Netlify.env.get('MCP_PUBLIC_ORIGIN');
async function call(path,method='GET',body){return handler(new Request(origin+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}));}
assert.equal((await call('/health')).status,200);
const meta=await (await call('/.well-known/oauth-authorization-server')).json();assert.deepEqual(meta.code_challenge_methods_supported,['S256']);assert.equal(meta.issuer,origin);
assert.equal((await call('/mcp','POST',{})).status,401);
assert.equal((await call('/oauth/register','POST',{redirect_uris:['https://evil.example/callback']})).status,400);
const reg=await call('/oauth/register','POST',{redirect_uris:['https://chatgpt.com/connector_platform_oauth_redirect']});assert.equal(reg.status,201);const client=await reg.json();
const query=new URLSearchParams({client_id:client.client_id,redirect_uri:client.redirect_uris[0],response_type:'code',resource:origin+'/mcp',code_challenge_method:'S256',code_challenge:'A'.repeat(43),scope:'nexora:read nexora:write'});
assert.equal((await call('/oauth/authorize?'+query)).status,302);
query.set('redirect_uri','https://evil.example/callback');assert.equal((await call('/oauth/authorize?'+query)).status,400);
query.set('redirect_uri',client.redirect_uris[0]);query.set('code_challenge_method','plain');assert.equal((await call('/oauth/authorize?'+query)).status,400);

// Claude : une seule URL de rappel pour toutes les surfaces hébergées (web,
// Desktop, mobile, Cowork). Elle était refusée par la liste blanche, ce qui
// rendait le connecteur inutilisable depuis Claude (issue #43).
const claudeRedirect='https://claude.ai/api/mcp/auth_callback';
const claudeReg=await call('/oauth/register','POST',{redirect_uris:[claudeRedirect]});
assert.equal(claudeReg.status,201,'Claude doit pouvoir s\'enregistrer');
const claudeClient=await claudeReg.json();
assert.deepEqual(claudeClient.redirect_uris,[claudeRedirect]);
const claudeQuery=new URLSearchParams({client_id:claudeClient.client_id,redirect_uri:claudeRedirect,response_type:'code',resource:origin+'/mcp',code_challenge_method:'S256',code_challenge:'a'.repeat(43)});
assert.equal((await call('/oauth/authorize?'+claudeQuery)).status,302,'Le flux d\'autorisation doit aboutir pour Claude');

// La liste blanche reste stricte : ces trois-là doivent rester refusés.
// claude.com n'existe pas ; le loopback du CLI n'est pas autorisé ici ; et un
// sous-domaine suffixé ne doit jamais passer pour claude.ai.
for(const refuse of ['https://claude.com/api/mcp/auth_callback','http://localhost:3118/callback','https://claude.ai.evil.example/api/mcp/auth_callback'])
 assert.equal((await call('/oauth/register','POST',{redirect_uris:[refuse]})).status,400,'doit rester refusé : '+refuse);

// Les deux listes blanches doivent rester en phase. Elles ont divergé une fois :
// la passerelle acceptait Claude, connect.js refusait encore tout ce qui n'était
// pas chatgpt.com, et la connexion échouait sur « Redirection invalide » APRÈS un
// enregistrement réussi — un demi-correctif est ici pire qu'aucun, puisqu'il fait
// croire que le problème est ailleurs.
const connectSource=await readFile(new URL('../public/connect.js',import.meta.url),'utf8');
const gatewaySource=await readFile(new URL('../netlify/functions/gateway.mts',import.meta.url),'utf8');
// On extrait UNIQUEMENT le tableau MCP_CLIENT_ORIGINS. Ramasser toutes les
// chaînes du fichier laisserait passer la panne : l'origine figure aussi dans le
// dictionnaire d'étiquettes, et le contrôle resterait vert alors que la liste
// blanche effective l'aurait perdue.
const originsDecl=connectSource.match(/const MCP_CLIENT_ORIGINS = \[([^\]]*)\]/);
assert.ok(originsDecl,'MCP_CLIENT_ORIGINS introuvable dans connect.js');
const pageOrigins=[...originsDecl[1].matchAll(/'(https:\/\/[a-z.]+)'/g)].map(m=>m[1]);
for(const attendu of ['https://chatgpt.com','https://claude.ai']){
 assert.ok(pageOrigins.includes(attendu),'connect.js doit accepter '+attendu);
 assert.ok(gatewaySource.includes(attendu),'la passerelle doit accepter '+attendu);
}
// Toute origine acceptée par la page doit l'être aussi par la passerelle.
for(const origine of new Set(pageOrigins.filter(o=>o.startsWith('https://'))))
 assert.ok(gatewaySource.includes(origine),'connect.js accepte '+origine+' que la passerelle ignore');

console.log('15 contrôles locaux réussis : découverte, authentification requise, client et redirections, PKCE, enregistrement Claude, liste blanche stricte, cohérence page/passerelle.');
