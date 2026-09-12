(()=>{
  let deferredPrompt=null;
  const btn=document.getElementById('installApp');
  const updateInstall=()=>{ if(btn) btn.style.display=deferredPrompt?'inline-flex':'none'; };
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;updateInstall();});
  btn?.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();try{await deferredPrompt.userChoice;}catch(e){}deferredPrompt=null;updateInstall();});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;updateInstall();});
  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(err=>console.warn('Service worker:',err)));
  }
})();
