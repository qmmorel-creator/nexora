const form=document.querySelector('#login'),status=document.querySelector('#status');
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Connexion…';
 try{
  const configResponse=await fetch('/client-config');if(!configResponse.ok)throw Error('Configuration indisponible.');const config=await configResponse.json();
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(config.apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.querySelector('#email').value,password:document.querySelector('#password').value,returnSecureToken:true})});
  document.querySelector('#password').value='';const auth=await response.json();if(!response.ok)throw Error('Connexion refusée. Vérifiez vos identifiants Nexora.');
  const consent=await fetch('/oauth/authorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:auth.idToken,parameters:location.search.slice(1)})});
  const data=await consent.json();if(!consent.ok)throw Error('Autorisation refusée. Seul le propriétaire Nexora peut connecter ce service.');
  const destination=new URL(data.redirect);if(destination.origin!=='https://chatgpt.com')throw Error('Redirection invalide.');location.assign(destination.href);
 }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
