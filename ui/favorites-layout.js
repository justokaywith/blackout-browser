(()=>{
 function favoritePage(items,page=0){const count=items.length,pages=Math.max(1,Math.ceil(count/10)),selected=Math.min(pages-1,Math.max(0,Math.floor(Number(page)||0))),start=selected*10;return {page:selected,pages,start,end:Math.min(count,start+10),items:items.slice(start,start+10)}}
 function scrollBookmarks(list,direction,reduced=false){list.scrollBy({left:Math.max(120,list.clientWidth*.8)*(direction<0?-1:1),behavior:reduced?'instant':'smooth'})}
 if(typeof module!=='undefined')module.exports={favoritePage,scrollBookmarks};
 if(typeof window==='undefined')return;
 window.BlackoutFavoriteLayout={favoritePage,scrollBookmarks};
 function init(){const list=document.getElementById('bookmarks-list'),back=document.getElementById('bookmarks-prev'),next=document.getElementById('bookmarks-next');if(!list||!back||!next)return;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const update=()=>{const overflow=list.scrollWidth>list.clientWidth+2;back.hidden=next.hidden=!overflow;back.disabled=list.scrollLeft<=1;next.disabled=list.scrollLeft+list.clientWidth>=list.scrollWidth-2};
  back.addEventListener('click',()=>scrollBookmarks(list,-1,reduced()));next.addEventListener('click',()=>scrollBookmarks(list,1,reduced()));list.addEventListener('scroll',update,{passive:true});
  list.addEventListener('wheel',e=>{if(list.scrollWidth>list.clientWidth&&Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();list.scrollBy({left:e.deltaY,behavior:'instant'})}},{passive:false});
  list.addEventListener('focusin',e=>{if(e.target!==list)e.target.scrollIntoView({block:'nearest',inline:'nearest'})});
  new ResizeObserver(update).observe(list);new MutationObserver(update).observe(list,{childList:true});update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
