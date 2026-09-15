// Seconde barrière, indépendante de celle du serveur : la passerelle a déjà
// validé redirect_uri à l'enregistrement puis à l'autorisation, ceci empêche la
// page d'envoyer l'utilisateur ailleurs si la réponse était altérée.
//
// Elle doit rester en phase avec validRedirect() dans
// netlify/functions/gateway.mts. Les deux listes ont divergé une fois : la
// passerelle acceptait Claude, cette page refusait encore tout ce qui n'était
// pas chatgpt.com, et la connexion échouait sur « Redirection invalide » APRÈS
// un enregistrement réussi. Un contrôle de tests vérifie désormais leur
// cohérence.
const MCP_CLIENT_ORIGINS = ['https://chatgpt.com', 'https://claude.ai'];
// Nom lisible du client, déduit de l'origine vers laquelle on repartira : la
// page s'annonçait « à ChatGPT » même quand la demande venait de Claude.
const MCP_CLIENT_LABELS = { 'https://chatgpt.com': 'ChatGPT', 'https://claude.ai': 'Claude' };

// Le client d'où vient la demande est lisible dans redirect_uri, que la
// passerelle a déjà validé avant de nous rediriger ici. On nomme l'assistant
// plutôt que d'en laisser un générique, sans jamais afficher une valeur reçue
// telle quelle : seules les étiquettes connues ci-dessus sont utilisées.
(() => {
 try {
  const origin = new URL(new URLSearchParams(location.search).get('redirect_uri') || '').origin;
  const label = MCP_CLIENT_LABELS[origin];
  if (!label) return;
  document.title = 'Connecter Nexora à ' + label;
  const title = document.querySelector('#title'); if (title) title.textContent = 'Connecter Nexora à ' + label;
  const intro = document.querySelector('#intro');
  if (intro) intro.textContent = intro.textContent.replace('votre assistant', label);
  const revoke = document.querySelector('#revoke');
  if (revoke) revoke.textContent = revoke.textContent.replace('votre assistant', label);
 } catch (_) { /* URL absente ou illisible : on garde la formulation neutre */ }
})();

const form=document.querySelector('#login'),status=document.querySelector('#status');
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Connexion…';
 try{
  const configResponse=await fetch('/client-config');if(!configResponse.ok)throw Error('Configuration indisponible.');const config=await configResponse.json();
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.querySelector('#email').value,password:document.querySelector('#password').value,returnSecureToken:true})});
  document.querySelector('#password').value='';const auth=await response.json();if(!response.ok)throw Error('Connexion refusée. Vérifiez vos identifiants Nexora.');
  const consent=await fetch('/oauth/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:auth.idToken,parameters:location.search.slice(1)})});
  const data=await consent.json();if(!consent.ok)throw Error('Autorisation refusée. Seul le propriétaire Nexora peut connecter ce service.');
  const destination=new URL(data.redirect);if(!MCP_CLIENT_ORIGINS.includes(destination.origin))throw Error('Redirection invalide.');location.assign(destination.href);
 }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
