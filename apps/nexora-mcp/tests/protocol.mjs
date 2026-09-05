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
console.log('7 contrôles locaux réussis : découverte, authentification requise, client et redirections, PKCE.');
