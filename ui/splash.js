(()=>{
 const button=document.getElementById('open-browser'),status=document.getElementById('opening-status');let done=false,timer;
 const open=()=>{if(done)return;if(typeof window.__blackout_splash?.done!=='function'){status.textContent='Open this welcome screen from the Blackout desktop app.';return}done=true;clearTimeout(timer);status.textContent='Opening Blackout…';window.__blackout_splash.done()};
 button.addEventListener('click',open);
 document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();open()}});
 if(typeof window.__blackout_splash?.done==='function')timer=setTimeout(open,1600);
})();
