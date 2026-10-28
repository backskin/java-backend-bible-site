
(function(){
  var inp=document.getElementById('q'), box=document.getElementById('res');
  if(!inp||!box) return;
  // индекс заголовков (около 3 МБ) грузится при первом обращении к поиску, а не с каждой страницей:
  // раньше его разбор занимал главный поток на каждой полной загрузке
  var sState=typeof SEARCH!=='undefined'?2:0;
  function needIndex(){
    if(sState) return; sState=1;
    var sc=document.createElement('script'); sc.src='search-index.js?v=bc7eb9228f';
    sc.onload=function(){ sState=2; run(); }; sc.onerror=function(){ sState=0; };
    document.head.appendChild(sc);
  }
  function esc(s){return s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  // полнотекстовый индекс: ft/*.js грузятся при первом запросе, каждый делает FT.push(...)
  window.FT=window.FT||[];
  var ftState=0, LOW=null;
  function loadFT(){
    if(ftState||typeof FT_FILES==='undefined') return;
    ftState=1; var left=FT_FILES.length;
    FT_FILES.forEach(function(f){
      var sc=document.createElement('script'); sc.src=f;
      sc.onload=sc.onerror=function(){ if(--left===0){ftState=2;LOW=null;run();} };
      document.head.appendChild(sc);
    });
  }
  function lows(){
    if(LOW) return LOW;
    LOW=[];
    FT.forEach(function(ch){ ch.s.forEach(function(sec){ LOW.push({ch:ch,sec:sec,low:sec[2].toLowerCase()}); }); });
    return LOW;
  }
  function snippet(text,low,words){
    var mm=matcher(words[0],false).exec(low); var pos=mm?mm.index+(mm[1]?mm[1].length:0):0;
    var a=Math.max(0,pos-90), b=Math.min(text.length,pos+words[0].length+130);
    var frag=(a>0?'…':'')+text.slice(a,b)+(b<text.length?'…':'');
    var h=esc(frag);
    words.forEach(function(w){
      var e2=w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      var re=w.length<=3 ? new RegExp('(^|[^a-zа-яё0-9_])('+e2+')','gi') : new RegExp('()('+e2+')','gi');
      h=h.replace(re,'$1<mark>$2</mark>');
    });
    return h;
  }
  var timer=null;
  // слова до 3 символов (h2, jpa, jvm) ищем только с начала слова: иначе «h2» находится внутри «OAuth2»
  function matcher(w, g){
    var e=w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return w.length<=3 ? new RegExp('(^|[^a-zа-яё0-9_])'+e, g?'gi':'i') : new RegExp(e, g?'gi':'i');
  }
  function count(re, text){
    var n=0, m; re.lastIndex=0;
    while((m=re.exec(text))!==null && n<30){ n++; if(m[0].length===0) re.lastIndex++; }
    return n;
  }
  function run(){
    var v=inp.value.trim().toLowerCase();
    if(v.length<2){box.classList.remove('on');box.innerHTML='';if(document.activeElement===inp)needIndex();return;}
    if(sState<2){ needIndex(); box.innerHTML='<a class="muted">загружаю поиск…</a>'; box.classList.add('on'); return; }
    var words=v.split(/\s+/), res=words.map(function(w){return matcher(w,false);}), heads=[];
    for(var i=0;i<SEARCH.length;i++){
      var e=SEARCH[i], ok=true;
      for(var w=0;w<res.length;w++){ if(!res[w].test(e.s)){ok=false;break;} }
      if(!ok) continue;
      // заголовок, начинающийся со слова запроса или содержащий весь запрос, выше остальных
      var tl=e.t.toLowerCase(), sc=0;
      if(tl.indexOf(v)>=0) sc+=3;
      if(tl.indexOf(words[0])===0) sc+=1;
      if(e.c==='жаргон') sc+=5;   // словарная статья жаргона объясняет слово, поэтому идёт первой
      heads.push({e:e,sc:sc,i:i});
    }
    heads.sort(function(a,b){return b.sc-a.sc||a.i-b.i;});
    heads=heads.slice(0,12);
    var html=heads.map(function(h){
      return '<a href="'+h.e.u+'">'+esc(h.e.t)+'<span class="ch">'+esc(h.e.c)+'</span></a>';
    }).join('');
    if(v.length>=2){
      if(ftState<2){ loadFT(); html+='<a class="muted">ищу по тексту книги…</a>'; }
      else{
        var L=lows(), hits=[], gre=words.map(function(w){return matcher(w,true);});
        for(var j=0;j<L.length;j++){
          var x=L[j], ok2=true, sc2=0;
          for(var k=0;k<res.length;k++){ if(!res[k].test(x.low)){ok2=false;break;} }
          if(!ok2) continue;
          for(var k2=0;k2<gre.length;k2++) sc2+=count(gre[k2], x.low);
          if(x.sec[1] && res[0].test(x.sec[1].toLowerCase())) sc2+=10;   // слово в заголовке подраздела
          hits.push({x:x,sc:sc2,j:j});
        }
        hits.sort(function(a,b){return b.sc-a.sc||a.j-b.j;});
        var total=hits.length, n=Math.min(total,80);
        for(var h2=0;h2<n;h2++){
          var x2=hits[h2].x, u=x2.ch.u+(x2.sec[0]?'#'+x2.sec[0]:'');
          html+='<a href="'+u+'"><span class="sn">'+snippet(x2.sec[2],x2.low,words)+'</span>'
            +'<span class="ch">'+esc(x2.ch.c)+(x2.sec[1]?' › '+esc(x2.sec[1]):'')+'</span></a>';
        }
        if(total>n) html+='<a class="muted">и ещё '+(total-n)+' — уточните запрос</a>';
      }
    }
    if(!html) html='<a class="muted">ничего не найдено</a>';
    box.innerHTML=html; box.classList.add('on');
  }
  inp.addEventListener('input',function(){clearTimeout(timer);timer=setTimeout(run,180);});
  inp.addEventListener('focus',run);
  document.addEventListener('click',function(ev){
    if(!box.contains(ev.target)&&ev.target!==inp) box.classList.remove('on');
  });
  document.addEventListener('keydown',function(ev){
    if(ev.key==='/'&&document.activeElement!==inp){ev.preventDefault();inp.focus();}
    if(ev.key==='Escape') box.classList.remove('on');
  });
})();

(function(){
  var root=document.documentElement;
  // единый набор иконок: контур 24×24, линия 2 px со скруглёнными концами, цвет — от текста кнопки
  var IC={
    '⧉':'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    '✓':'<path d="M20 6 9 17l-5-5"/>',
    '⌨':'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    '↩':'<path d="M3 6h18"/><path d="M3 12h15a3 3 0 0 1 0 6h-4"/><path d="m16 15-3 3 3 3"/><path d="M3 18h6"/>',
    '→':'<path d="M3 6h13M3 12h13M3 18h13"/><path d="m18 9 3 3-3 3"/>',
    '☀':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    '☾':'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    '⛶':'<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    '⤡':'<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>'
  };
  function icon(k){var p=IC[k];return p?'<svg class="svg-ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+p+'</svg>':k;}
  window.JBB_ICON=icon;
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
  // ---------- один раз: тема ----------
  var dark=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;
  var saved=ls('jbb-theme'); if(saved==='dark'||saved==='light') root.setAttribute('data-theme',saved);
  function eff(){var a=root.getAttribute('data-theme');return a||(dark&&dark.matches?'dark':'light');}
  var tb=document.getElementById('theme');
  function label(){if(tb){var d=eff()==='dark',t=d?'Светлая тема':'Тёмная тема';tb.innerHTML='<span class="ic" aria-hidden="true">'+icon(d?'☀':'☾')+'</span><span class="tx">'+t+'</span>';tb.setAttribute('aria-label',t);tb.title=t;}}
  label(); if(dark&&dark.addEventListener) dark.addEventListener('change',label);
  if(tb) tb.addEventListener('click',function(){var nx=eff()==='dark'?'light':'dark';root.setAttribute('data-theme',nx);ls('jbb-theme',nx);label();});

  // ---------- один раз: меню ----------
  var sd=document.getElementById('side'), mb=document.getElementById('menu'), bd=document.querySelector('.backdrop');
  function close(){if(sd){sd.classList.remove('open');if(mb)mb.setAttribute('aria-expanded','false');}}
  if(mb&&sd){
    mb.addEventListener('click',function(e){e.stopPropagation();var o=sd.classList.toggle('open');mb.setAttribute('aria-expanded',String(o));});
    if(bd) bd.addEventListener('click',close);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  }
  // прокрутка меню переживает переход между главами (на случай полной загрузки страницы)
  if(sd){
    var keep=null; try{keep=sessionStorage.getItem('jbb-side-scroll');}catch(e){}
    var cur0=sd.querySelector('a.cur');
    if(keep!==null) sd.scrollTop=+keep;
    if(cur0){var r0=cur0.getBoundingClientRect(),s0=sd.getBoundingClientRect(); if(r0.top<s0.top||r0.bottom>s0.bottom) sd.scrollTop=Math.max(0,cur0.offsetTop-sd.clientHeight/2);}
    window.addEventListener('pagehide',function(){try{sessionStorage.setItem('jbb-side-scroll',String(sd.scrollTop));}catch(e){}});
  }

  var top=document.querySelector('.topbar');
  function vars(){var r=root.style, tocEl=document.getElementById('chapter-toc');
    r.setProperty('--tb',(top&&getComputedStyle(top).position!=='fixed'?top.offsetHeight:0)+'px');
    var hd=tocEl&&tocEl.offsetParent!==null&&tocEl.querySelector('.toc-header');r.setProperty('--tocH',(hd?hd.offsetHeight+10:0)+'px');}
  vars(); window.addEventListener('resize',vars);

  // ---------- первая загрузка: правильная позиция (рамка артефакта сохраняет прокрутку прошлой страницы) ----------
  try{history.scrollRestoration='manual';}catch(e){}
  (function(){
    var nav=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0]||{}).type;
    if(nav==='back_forward')return;
    var touched=false; ['wheel','touchstart','keydown','mousedown'].forEach(function(ev){window.addEventListener(ev,function(){touched=true;},{passive:true,once:true});});
    function fix(){ if(touched)return;
      if(location.hash){var t=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(t){if(Math.abs(t.getBoundingClientRect().top-16)>2)t.scrollIntoView();return;}}
      var top=window.jbbStartY||0;   // читатель был ниже фото-шапки на прошлой странице — начинаем под шапкой (site_xp)
      if(window.scrollY!==top)window.scrollTo(0,top); }
    fix();
    window.addEventListener('load',function(){vars();fix();});
  })();

  // ---------- на каждой главе: состояние, которое пересоздаётся после подмены ----------
  var P={};            // текущая страница: art, heads, links, curT, page, last
  var RT=null;         // панель маршрута рефреша текущей страницы
  var bar=document.querySelector('.progress span');
  function onScroll(){
    if(bar&&P.art){var r=P.art.getBoundingClientRect(),h=window.innerHeight,p=Math.min(1,Math.max(0,(h*0.35-r.top)/Math.max(1,r.height-h*0.5)));bar.style.width=(p*100).toFixed(1)+'%';}
    if(RT)RT.scroll();
    if(!P.heads||!P.heads.length)return;
    var y=(top&&getComputedStyle(top).position!=='fixed'?top.offsetHeight:0)+90, act=null;
    for(var i=0;i<P.heads.length;i++){if(P.heads[i].getBoundingClientRect().top<=y)act=P.heads[i];else break;}
    if(act!==P.last){
      if(P.last&&P.links[P.last.id])P.links[P.last.id].forEach(function(a){a.classList.remove('on');});
      if(act&&P.links[act.id])P.links[act.id].forEach(function(a){a.classList.add('on');});
      if(P.curT)P.curT.textContent=act?act.textContent:'';
      P.last=act;
      if(P.page&&P.art) ls('jbb-last',JSON.stringify({u:P.page,t:document.body.getAttribute('data-title')||document.title,s:act?act.textContent:'',h:act?act.id:'',d:Date.now()}));
    }
  }
  var ticking=false; window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(function(){ticking=false;onScroll();});}},{passive:true});

  // режим чтения: прячем панели при прокрутке вниз, показываем при прокрутке вверх, у начала и конца страницы и по касанию текста
  (function(){
    var root=document.documentElement, lastY=window.scrollY, acc=0, mq=window.matchMedia('(max-width:1439px)');
    function busy(){ var side=document.getElementById('side'); var t=document.getElementById('chapter-toc');
      return (side&&side.classList.contains('open'))||(t&&t.classList.contains('is-open'))||(document.activeElement&&document.activeElement.id==='q'); }
    function set(h){ if(h&&(!mq.matches||busy()))h=false; root.classList.toggle('ch-hide',h); }
    window.jbbChrome=set;
    window.addEventListener('scroll',function(){
      var y=window.scrollY, dy=y-lastY; lastY=y;
      if(y<60||window.innerHeight+y>=document.documentElement.scrollHeight-40){acc=0;set(false);return;}
      if((dy>0)!==(acc>0))acc=0; acc+=dy;
      if(acc>24)set(true); else if(acc<-36)set(false);
    },{passive:true});
    document.addEventListener('click',function(e){
      if(!root.classList.contains('ch-hide'))return;
      var t=e.target; if(!t.closest||!t.closest('.prose'))return;
      if(t.closest('a,button,input,code,pre,table,summary,details,.gl-term,.hl-bar,img'))return;
      var sel=window.getSelection&&window.getSelection(); if(sel&&!sel.isCollapsed)return;
      set(false);
    });
    var fs=document.getElementById('fs'), d=document;
    var can=d.fullscreenEnabled||d.webkitFullscreenEnabled;
    if(fs&&!can) fs.hidden=true;
    if(fs&&can){ fs.hidden=false;
      var upd=function(){var on=!!(d.fullscreenElement||d.webkitFullscreenElement);fs.innerHTML=icon(on?'⤡':'⛶');fs.title=on?'Выйти из полноэкранного режима':'Во весь экран';fs.setAttribute('aria-label',fs.title);};
      fs.addEventListener('click',function(){ try{ if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d);} else {var el=d.documentElement;var r=(el.requestFullscreen||el.webkitRequestFullscreen).call(el,{navigationUI:'hide'});if(r&&r.catch)r.catch(function(){fs.hidden=true;});} }catch(x){fs.hidden=true;} });
      // после входа в полноэкранный режим Chrome на Android не сразу перерисовывает новую часть экрана: подталкиваем перерисовку несколько кадров подряд
      var kick=function(){ upd(); var t0=performance.now(), h0=-1; (function step(){ var h=window.innerHeight;
          if(h!==h0){ h0=h; document.documentElement.style.minHeight=h+'px'; window.scrollBy(0,1); window.scrollBy(0,-1); window.dispatchEvent(new Event('resize')); }
          if(performance.now()-t0<1500) requestAnimationFrame(step); else document.documentElement.style.minHeight=''; })(); };
      d.addEventListener('fullscreenchange',kick); d.addEventListener('webkitfullscreenchange',kick); upd(); }
  })();

  function initToc(){
    var tocEl=document.getElementById('chapter-toc'); if(!tocEl)return;
    var btn=tocEl.querySelector('.toc-toggle');
    var setOpen=function(o){tocEl.classList.toggle('is-open',o);btn.textContent=o?'Скрыть':'Показать';btn.setAttribute('aria-expanded',String(o));};
    setOpen(false);
    btn.addEventListener('click',function(){setOpen(!tocEl.classList.contains('is-open'));});
    tocEl.addEventListener('click',function(e){if(e.target.closest('.toc-list a'))setOpen(false);});
  }
  function initSpy(){
    P={art:document.querySelector('.prose'),page:(location.pathname.split('/').pop()||''),last:null,links:{},curT:document.getElementById('toc-cur')};
    P.heads=P.art?[].slice.call(P.art.querySelectorAll('h2[id]')):[];
    document.querySelectorAll('.toc-list a, .rail a[href^="#"]').forEach(function(a){var id=a.getAttribute('href').slice(1);(P.links[id]=P.links[id]||[]).push(a);});
    onScroll();
  }

  // ---------- панель маршрута рефреша ----------
  var R=null; try{R=JSON.parse(ls('jbb-route-v1')||'null');}catch(e){}
  var hideKey='jbb-route-hide', offKey='jbb-route-off';   // off: рефреш отключён совсем — ни панели, ни значка, ни отметок у заголовков
  var routeOff=function(){return ls(offKey)==='1';};
  var rst=function(){try{return JSON.parse(ls(R.key)||'{}')||{};}catch(e){return {};}};
  var isDone=function(id){var d=rst().done||{};return !!d[id];};
  var setDone=function(id,v){var S=rst();S.done=S.done||{};if(v)S.done[id]=Date.now();else delete S.done[id];ls(R.key,JSON.stringify(S));};
  var pill=null;
  function initRoute(){
    var old=document.querySelector('.rpanel'); if(old&&!document.querySelector('.doc').contains(old)) old.remove();
    RT=null; document.body.classList.remove('has-route');
    if(pill)pill.hidden=true;
    if(routeOff())return;
    if(!(R&&R.items&&R.items.length&&P.art&&P.page))return;
    var mine=R.items.filter(function(i){return i.h.split('#')[0]===P.page;});
    if(!mine.length)return;
    var wpm=R.wpm||230;
    mine.forEach(function(i){i.el=null;var id=decodeURIComponent(i.h.split('#')[1]||''),h=id&&document.getElementById(id);
      if(h){var b=document.createElement('button');b.type='button';b.className='rt-badge';b.setAttribute('data-rid',i.id);h.appendChild(b);i.el=h;}});
    var hid=false; try{hid=sessionStorage.getItem(hideKey)==='1';}catch(e){}
    var rbar=document.createElement('div'); rbar.className='rpanel'; rbar.setAttribute('role','region'); rbar.setAttribute('aria-label','Маршрут рефреша');
    rbar.innerHTML='<div class="route-in"><div class="route-top"><span class="route-tag">Рефреш</span><span class="route-count"></span>'
      +'<button class="route-x" type="button" aria-label="Скрыть панель" title="Скрыть панель">×</button></div>'
      +'<span class="route-bar"><i></i></span>'
      +'<div class="route-cur"><small>Сейчас читаете</small><a href="#"></a></div>'
      +'<div class="route-act"><button class="btn pri r-next" type="button"></button>'
      +'<a class="btn" href="vacancy-refresh.html">Маршрут</a></div></div>';
    if(!pill){pill=document.createElement('button'); pill.type='button'; pill.className='btn route-pill'; pill.hidden=true; document.body.appendChild(pill);
      pill.addEventListener('click',function(){try{sessionStorage.removeItem(hideKey);}catch(e){} if(RT){RT.hid=false;RT.upd();}});}
    (document.querySelector('.doc')||document.body).appendChild(rbar);
    var st={hid:hid,cur:mine[0]};
    var pick=function(){var y=window.innerHeight*0.4,c=null;mine.forEach(function(i){if(i.el&&i.el.getBoundingClientRect().top<=y)c=i;});st.cur=c||mine[0];};
    var nextAfter=function(it){var k=R.items.indexOf(it),j;for(j=k+1;j<R.items.length;j++)if(!isDone(R.items[j].id))return R.items[j];
      for(j=0;j<R.items.length;j++)if(!isDone(R.items[j].id)&&R.items[j]!==it)return R.items[j];return null;};
    var upd=function(){
      var d=0,left=0;R.items.forEach(function(i){if(isDone(i.id))d++;else left+=Math.max(1,Math.round(i.w/wpm));});
      var h=Math.floor(left/60),m=left%60,cur=st.cur;
      rbar.querySelector('.route-count').textContent=d+' из '+R.items.length+' · ещё '+(h?h+' ч '+m+' мин':m+' мин');
      rbar.querySelector('.route-bar i').style.width=(d/R.items.length*100)+'%';
      var a=rbar.querySelector('.route-cur a'); a.textContent=cur.c+' '+cur.t+(isDone(cur.id)?' ✓':''); a.href='#'+(cur.h.split('#')[1]||'');
      var nx=nextAfter(cur), btn=rbar.querySelector('.r-next');
      btn.innerHTML=isDone(cur.id)?(nx?'<span>Дальше: '+(nx.n||nx.c)+' →</span>':'<span>Маршрут пройден</span>'):'<span><span class="lg-only">✓ Прочитано, дальше</span><span class="sm-only">✓ Дальше</span></span>';
      btn.title=isDone(cur.id)&&nx?('Дальше: '+(nx.n||nx.c)+' '+nx.t):'';
      document.querySelectorAll('.rt-badge').forEach(function(b){var ok=isDone(b.getAttribute('data-rid'));b.classList.toggle('ok',ok);b.textContent=ok?'✓ прочитано':'рефреш';b.title=ok?'Снять отметку':'Отметить прочитанным';});
      pill.textContent='Рефреш '+d+'/'+R.items.length;
      rbar.hidden=st.hid; pill.hidden=!st.hid; document.body.classList.toggle('has-route',!st.hid);
    };
    rbar.querySelector('.r-next').addEventListener('click',function(){
      if(!isDone(st.cur.id)) setDone(st.cur.id,true);
      var nx=nextAfter(st.cur); go(nx?nx.h:'vacancy-refresh.html');
    });
    var collapse=function(){st.hid=true;try{sessionStorage.setItem(hideKey,'1');}catch(e){}upd();};
    // крестик спрашивает: свернуть до значка или отключить рефреш совсем (отметки прочитанного сохраняются)
    rbar.querySelector('.route-x').addEventListener('click',function(){
      if(!window.jbbModal){collapse();return;}
      window.jbbModal('Панель рефреша',
        '<p>Свернуть панель до значка внизу или отключить рефреш совсем?</p>'+
        '<p class="bm-where">Если отключить, панель, значок и отметки «рефреш» у заголовков пропадут во всех главах. '+
        'Отметки прочитанного сохранятся: включить рефреш снова можно на странице <a href="vacancy-refresh.html">«Рефреш перед собеседованием»</a>.</p>',
        [{t:'Отключить рефреш',fn:function(){ls(offKey,'1');routeDisable();}},{t:'Свернуть',cls:'def',fn:collapse}]);
    });
    RT={upd:upd,get hid(){return st.hid;},set hid(v){st.hid=v;},scroll:function(){var o=st.cur;pick();if(o!==st.cur)upd();}};
    pick(); upd();
  }
  function routeDisable(){
    var rb=document.querySelector('.rpanel');if(rb)rb.remove();
    document.querySelectorAll('.rt-badge').forEach(function(b){b.remove();});
    if(pill)pill.hidden=true; document.body.classList.remove('has-route'); RT=null;
  }
  // рефреш включили или отключили в другой вкладке
  window.addEventListener('storage',function(e){if(e.key===offKey){if(routeOff())routeDisable();else{try{R=JSON.parse(ls('jbb-route-v1')||'null');}catch(x){}initRoute();}}});
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.rt-badge');if(!b||!RT)return;e.preventDefault();var id=b.getAttribute('data-rid');setDone(id,!isDone(id));RT.upd();});
  window.addEventListener('pageshow',function(){if(RT)RT.upd();});

  // ---------- блоки кода: обработчики общие, подписи кнопок — на каждой странице ----------
  try{if(localStorage.getItem('jbb-code-theme')==='light')root.setAttribute('data-code','light');}catch(e){}
  try{if(localStorage.getItem('jbb-code-wrap')==='1')root.setAttribute('data-wrap','1');}catch(e){}
  var codeMode=function(){return root.getAttribute('data-code')==='light'?'light':'dark';};
  // кнопка = иконка + подпись: на телефоне подпись скрыта, остаётся для подсказки и экранного диктора
  var lbl=function(b,ic,tx,ti){b.innerHTML='<span class="ic" aria-hidden="true">'+icon(ic)+'</span><span class="tx">'+tx+'</span>';b.setAttribute('aria-label',tx);b.title=ti||tx;};
  var paintWrap=function(){var on=root.getAttribute('data-wrap')==='1';document.querySelectorAll('.hl-wrap').forEach(function(w){
    if(on)lbl(w,'→','Без переноса','Показывать длинные строки целиком с прокруткой');else lbl(w,'↩','Переносить строки','Переносить длинные строки, чтобы не прокручивать вбок');});};
  var paintModes=function(){var l=codeMode()==='light';document.querySelectorAll('.hl-mode:not(.hl-wrap)').forEach(function(m){
    if(l)lbl(m,'☾','Тёмный код','Показывать код на тёмном фоне');else lbl(m,'☀','Светлый код','Показывать код на светлом фоне');});};
  document.addEventListener('click',function(e){var w=e.target.closest&&e.target.closest('.hl-wrap');if(!w)return;
    var on=root.getAttribute('data-wrap')!=='1';
    if(on)root.setAttribute('data-wrap','1');else root.removeAttribute('data-wrap');
    try{localStorage.setItem('jbb-code-wrap',on?'1':'0');}catch(err){}
    var y=w.getBoundingClientRect().top;paintWrap();window.scrollBy(0,w.getBoundingClientRect().top-y);});
  document.addEventListener('click',function(e){var m=e.target.closest&&e.target.closest('.hl-mode:not(.hl-wrap)');if(!m)return;
    var next=codeMode()==='light'?'dark':'light';
    if(next==='light')root.setAttribute('data-code','light');else root.removeAttribute('data-code');
    try{localStorage.setItem('jbb-code-theme',next);}catch(err){}
    var y=m.getBoundingClientRect().top;paintModes();window.scrollBy(0,m.getBoundingClientRect().top-y);});
  document.addEventListener('click',function(e){var btn=e.target.closest&&e.target.closest('.hl-copy');if(!btn)return;
    var pre=btn.closest('.hl')&&btn.closest('.hl').querySelector('pre');if(!pre)return;
    var txt=pre.innerText.replace(/\n$/,'');
    var done=function(){lbl(btn,'✓','Скопировано');btn.classList.add('ok');setTimeout(function(){lbl(btn,'⧉','Копировать','Скопировать код');btn.classList.remove('ok');},1600);};
    var fallback=function(){try{var r=document.createRange();r.selectNodeContents(pre);var sel=getSelection();sel.removeAllRanges();sel.addRange(r);lbl(btn,'⌨','Нажмите Ctrl+C');setTimeout(function(){lbl(btn,'⧉','Копировать','Скопировать код');},2400);}catch(err){}};
    try{navigator.clipboard.writeText(txt).then(done,fallback);}catch(err){fallback();}});
  function initCode(){
    document.querySelectorAll('.prose .hl').forEach(function(box){
      var pre=box.querySelector('pre'); if(!pre||box.querySelector('.hl-bar'))return;
      var b=document.createElement('div'); b.className='hl-bar';
      b.innerHTML='<span></span><div class="hl-tools"><button type="button" class="hl-mode hl-wrap"></button><button type="button" class="hl-mode"></button><button type="button" class="hl-copy">Копировать</button></div>';
      b.firstChild.textContent=box.getAttribute('data-lang')||''; box.insertBefore(b,pre);
    });
    document.querySelectorAll('.hl-copy').forEach(function(b){lbl(b,'⧉','Копировать','Скопировать код');});
    paintModes(); paintWrap();
  }

  // ---------- словарь в тексте: данные и всплывающее окно общие, разметка — на каждой странице ----------
  var G=null, GL=null, markGen=0;
  function esc(t){return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function buildGL(chap){
    var latin=[], cyr=[];
    var codeLike=function(f){return /[A-Z].*[A-Z]|[a-z][A-Z]|\d|[_#+.]/.test(f)||/^[A-Z0-9]{2,}$/.test(f);};
    var TRIVIAL={}; 'SQL API HTTP HTTPS JSON XML URL URI ID UI CPU RAM OS IDE JDK JVM JRE REST CI CD UUID DTO ORM TCP IP DNS TLS SSL CSV HTML CSS JS'.split(' ').forEach(function(w){TRIVIAL[w]=1;});
    G.forEach(function(e,i){ var inCh=e.r.some(function(r){return r[0]===chap;}); e.f.forEach(function(f){
      if(f.length<2||(!codeLike(f)&&!inCh)||TRIVIAL[f])return;
      if(/[А-Яа-яЁё]/.test(f)){
        var pat=f.split(/\s+/).map(function(w){ if(!/[А-Яа-яЁё]/.test(w))return esc(w);
          var st=w.length>=5?w.replace(/[аяоеиыуюйьъ]{1,2}$/i,''):w; return esc(st)+'[а-яё]{0,4}'; }).join('\\s+');
        cyr.push({p:pat,i:i,l:f.length});
      }else latin.push({p:esc(f),i:i,l:f.length});
    });});
    latin.sort(function(a,b){return b.l-a.l;}); cyr.sort(function(a,b){return b.l-a.l;});
    return {latin:latin,cyr:cyr,
      reL:latin.length?new RegExp('(?<![A-Za-z0-9_$.])(?:'+latin.map(function(x){return '('+x.p+')';}).join('|')+')(?![A-Za-z0-9_])','g'):null,
      reC:cyr.length?new RegExp('(?<![\\p{L}\\p{N}_])(?:'+cyr.map(function(x){return '('+x.p+')';}).join('|')+')(?![\\p{L}\\p{N}_])','giu'):null};
  }
  function markTerms(){
    var prose=document.querySelector('.prose'), gen=++markGen;
    if(!prose||!G||/A-glossary\.html$/.test(location.pathname))return;
    var mch=location.pathname.match(/(?:^|\/)(?:ws-)?(\d\d)-[^\/]*$/), chap=mch?+mch[1]:-1, gl=buildGL(chap);
    var SKIP='CODE,PRE,A,H1,H2,H3,H4,H5,H6,SCRIPT,STYLE,BUTTON,KBD,SUP';
    function find(re,list,text,out){ if(!re)return; re.lastIndex=0; var m;
      while((m=re.exec(text))){ for(var k=1;k<m.length;k++){ if(m[k]!==undefined){ out.push({s:m.index,e:m.index+m[0].length,i:list[k-1].i}); break; } } } }
    var seen={}, blocks=[].slice.call(prose.children), bi=0;
    function markBlock(el){
      if(el.tagName==='H2'){seen={};return;}
      if(el.matches('.hl,pre,.meta,.toc,.ws-btn,.nav,.ch-mark,table')) return;
      var w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
        for(var p=n.parentNode;p&&p!==el;p=p.parentNode){ if(SKIP.indexOf(p.tagName)>=0||(p.classList&&(p.classList.contains('gl-term')||p.classList.contains('rt-badge'))))return NodeFilter.FILTER_REJECT; }
        return n.nodeValue.length>1?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
      var nodes=[],n; while((n=w.nextNode()))nodes.push(n);
      nodes.forEach(function(node){
        var t=node.nodeValue, hits=[]; find(gl.reL,gl.latin,t,hits); find(gl.reC,gl.cyr,t,hits);
        if(!hits.length)return;
        hits.sort(function(a,b){return a.s-b.s||b.e-a.e;});
        var frag=null,pos=0,last=-1;
        hits.forEach(function(h){
          if(h.s<last||seen[h.i])return;
          seen[h.i]=1; last=h.e;
          if(!frag)frag=document.createDocumentFragment();
          frag.appendChild(document.createTextNode(t.slice(pos,h.s)));
          var sp=document.createElement('span'); sp.className='gl-term'; sp.setAttribute('data-g',h.i); sp.tabIndex=0;
          sp.textContent=t.slice(h.s,h.e); frag.appendChild(sp); pos=h.e;
        });
        if(frag){frag.appendChild(document.createTextNode(t.slice(pos))); node.parentNode.replaceChild(frag,node);}
      });
    }
    var idle=window.requestIdleCallback||function(f){return setTimeout(f,16);};
    (function step(){ if(gen!==markGen)return; var t0=Date.now(); while(bi<blocks.length&&(Date.now()-t0)<12){ markBlock(blocks[bi++]); } if(bi<blocks.length)idle(step); })();
  }
  if(document.querySelector('.prose')){
    // та же метка версии, что у app.js, иначе service worker отдаст словарь из старой сборки
    var me=document.querySelector('script[src^="app.js"]'), vq=me&&me.getAttribute('src').split('?')[1];
    var sc=document.createElement('script'); sc.src='glossary.js'+(vq?'?'+vq:''); sc.async=true;
    sc.onload=function(){ if(window.GLOSSARY){ G=window.GLOSSARY; markTerms(); } };
    document.head.appendChild(sc);
  }
  var pop=document.createElement('div'); pop.className='gl-pop'; pop.hidden=true; pop.setAttribute('role','tooltip'); document.body.appendChild(pop);
  var gcur=null, hideT=null, showT=null;
  function gshow(el){
    clearTimeout(hideT); var e=G&&G[+el.getAttribute('data-g')]; if(!e)return;
    if(gcur&&gcur!==el)gcur.classList.remove('on'); gcur=el; el.classList.add('on');
    var alt=e.f.slice(1).join(', ');
    var lk=e.r.map(function(r){return '<a href="'+r[1]+'">Подробнее: гл. '+r[0]+'. '+r[2]+'</a>';}).join('');
    pop.innerHTML='<b></b>'+(alt?'<span class="alt"></span>':'')+'<p></p><div class="lk">'+lk+'<a href="'+e.a+'">Весь словарь</a></div>';
    pop.querySelector('b').textContent=e.t; if(alt)pop.querySelector('.alt').textContent=alt; pop.querySelector('p').textContent=e.d;
    pop.hidden=false;
    var r=el.getBoundingClientRect(), pw=pop.offsetWidth, ph=pop.offsetHeight, m=12;
    var x=Math.min(Math.max(m,r.left),innerWidth-pw-m), y=r.bottom+8;
    if(y+ph>innerHeight-m)y=Math.max(m,r.top-ph-8);
    pop.style.left=x+'px'; pop.style.top=y+'px';
  }
  function ghide(){ pop.hidden=true; if(gcur)gcur.classList.remove('on'); gcur=null; }
  var hoverable=window.matchMedia('(hover:hover)').matches;
  if(hoverable){
    document.addEventListener('mouseover',function(ev){ var t=ev.target.closest&&ev.target.closest('.gl-term');
      if(t){ clearTimeout(hideT); clearTimeout(showT); showT=setTimeout(function(){gshow(t);},180); }
      else if(ev.target.closest&&ev.target.closest('.gl-pop')){ clearTimeout(hideT); }
      else { clearTimeout(showT); if(!pop.hidden){ clearTimeout(hideT); hideT=setTimeout(ghide,260);} } });
  }
  document.addEventListener('click',function(ev){ var t=ev.target.closest&&ev.target.closest('.gl-term');
    if(t){ ev.preventDefault(); if(gcur===t&&!pop.hidden)ghide(); else gshow(t); return; }
    if(!(ev.target.closest&&ev.target.closest('.gl-pop')))ghide(); });
  document.addEventListener('keydown',function(ev){ if(ev.key==='Escape')ghide();
    if(ev.key==='Enter'&&document.activeElement&&document.activeElement.classList&&document.activeElement.classList.contains('gl-term'))gshow(document.activeElement); });
  window.addEventListener('scroll',function(){ if(!pop.hidden&&!hoverable)ghide(); else if(!pop.hidden&&gcur){ var r=gcur.getBoundingClientRect(); if(r.bottom<0||r.top>innerHeight)ghide(); } },{passive:true});

  // ---------- один раз: масштаб текста ----------
  (function(){
    var STEPS=[.82,.88,.94,1,1.06,1.12,1.18,1.25,1.33], k=3;
    try{var v=parseFloat(localStorage.getItem('jbb-zoom'));var i=STEPS.indexOf(v);if(i>=0)k=i;}catch(e){}
    var z=document.querySelector('.zoom'), made=!z;
    if(made&&document.body.classList.contains('home'))return;   // на главной масштабировать нечего: кнопки не ставим
    if(made){z=document.createElement('div'); z.className='zoom'; z.setAttribute('role','group'); z.setAttribute('aria-label','Масштаб текста');
    z.innerHTML='<button type="button" data-z="-1" title="Мельче" aria-label="Мельче">A−</button><button type="button" class="zv" data-z="0" title="Вернуть 100%"></button><button type="button" data-z="1" title="Крупнее" aria-label="Крупнее">A+</button>';}
    function apply(initial){
      var y=0, anchor=null;
      if(!initial){ var ps=document.querySelectorAll('.prose > *'); for(var j=0;j<ps.length;j++){var r=ps[j].getBoundingClientRect(); if(r.bottom>80){anchor=ps[j];y=r.top;break;}} }
      root.style.setProperty('--zoom',STEPS[k]);
      z.querySelector('.zv').textContent=Math.round(STEPS[k]*100)+'%';
      try{localStorage.setItem('jbb-zoom',STEPS[k]);}catch(e){}
      if(anchor)window.scrollBy(0,anchor.getBoundingClientRect().top-y);
      if(!initial)window.dispatchEvent(new Event('resize'));
    }
    z.addEventListener('click',function(ev){var b=ev.target.closest('button');if(!b)return;var d=+b.getAttribute('data-z');
      k=d===0?3:Math.max(0,Math.min(STEPS.length-1,k+d)); apply(false);});
    var theme=document.getElementById('theme');
    if(made&&theme&&theme.parentNode) theme.parentNode.insertBefore(z,theme);
    apply(true);
  })();

  // ---------- переход между главами без перезагрузки: меню, инструменты и их прокрутка остаются на месте ----------
  // ---------- отметка главы в плане подготовки и значки состояния в меню ----------
  var PLANK='jbb-prep-plan-v1', PMARK={read:1,active:1,review:1};
  function planGet(){try{var o=JSON.parse(ls(PLANK)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{};}catch(e){return {};}}
  function paintSide(){ if(!sd)return; var p=planGet();
    sd.querySelectorAll('li a[href$=".html"]').forEach(function(a){var s=p[a.getAttribute('href').replace(/\.html$/,'.md')];
      if(PMARK[s])a.setAttribute('data-plan',s);else a.removeAttribute('data-plan');}); }
  function paintMark(){ var box=document.querySelector('.ch-mark'); if(!box)return; box.hidden=false;
    var s=planGet()[box.getAttribute('data-file')]||'unread';
    box.querySelectorAll('[data-s]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-s')===s));});
    var o=box.querySelector('.ch-mark-s'); if(o)o.textContent={read:'Глава отмечена прочитанной.',active:'Глава отмечена «Читаю».',review:'Глава отмечена «Повторить».'}[s]||'Глава пока не отмечена.'; }
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.ch-mark [data-s]');if(!b)return;
    var f=b.closest('.ch-mark').getAttribute('data-file'),p=planGet(),s=b.getAttribute('data-s');
    if(p[f]===s)delete p[f];else p[f]=s; ls(PLANK,JSON.stringify(p));
    try{var m=JSON.parse(ls('jbb-prep-meta-v1')||'{}')||{};if(!m.t||typeof m.t!=='object')m.t={};m.t[f]=Date.now();ls('jbb-prep-meta-v1',JSON.stringify(m));}catch(x){}
    paintMark(); paintSide();});
  // отметили главу в другой вкладке — меню и отметка здесь обновляются сами (событие storage)
  window.addEventListener('storage',function(e){if(e.key===PLANK||e.key===null){paintSide();paintMark();}});
  window.jbbPaintPlan=function(){paintSide();paintMark();};
  paintSide();

  function initPage(){ initToc(); initSpy(); initRoute(); initCode(); markTerms(); paintMark(); }
  var busy=null;
  var curPath=location.pathname;
  var FULL=/(^|\/)(index|toc|vacancy-refresh|prep-plan)\.html$/;
  function samePage(u){return u.pathname===curPath;}
  function go(href,opts){
    opts=opts||{};
    var u; try{u=new URL(href,location.href);}catch(e){location.href=href;return;}
    if(u.origin!==location.origin){location.href=href;return;}
    if(samePage(u)&&!opts.pop){ // якорь на той же странице
      if(u.hash){var t=document.getElementById(decodeURIComponent(u.hash.slice(1))); if(t){history.pushState(null,'',u.hash);t.scrollIntoView();return;}}
    }
    var doc=document.querySelector('.doc');
    if(!doc||!/\.html$/.test(u.pathname)||FULL.test(u.pathname)){location.href=href;return;}
    if(samePage(u)&&opts.pop){var t0=u.hash&&document.getElementById(decodeURIComponent(u.hash.slice(1))); if(t0)t0.scrollIntoView(); else window.scrollTo(0,0); return;}
    var my={}; busy=my;
    document.body.classList.add('is-loading');
    // нажатая глава в меню «вщёлкивается» сразу, не дожидаясь загрузки текста
    if(sd){ var nm0=u.pathname.split('/').pop();
      sd.querySelectorAll('a.cur').forEach(function(a){a.classList.remove('cur');});
      sd.querySelectorAll('a[href="'+nm0+'"]').forEach(function(a){a.classList.add('cur');}); }
    fetch(u.pathname,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.text();}).then(function(html){
      if(busy!==my)return;
      var nd=new DOMParser().parseFromString(html,'text/html'), ndoc=nd.querySelector('.doc');
      if(!ndoc||!nd.querySelector('.side')){location.href=href;return;}
      if(!opts.pop) history.pushState({jbb:1},'',u.pathname+u.hash);
      // подмена текста: внутри View Transition браузер делает короткий фейд, меню и шапка стоят на месте
      var swapped=false, swap=function(){
        if(swapped||busy!==my) return; swapped=true;   // устаревшая подмена не перебивает новую
        document.title=nd.title;
        document.body.setAttribute('data-title',nd.body.getAttribute('data-title')||'');
        doc.innerHTML=ndoc.innerHTML; curPath=u.pathname;
        // фото-шапка стоит выше всего, вне .doc: меняем её вместе с главой (или убираем, если у новой страницы её нет)
        // быстрое переключение: прежняя «следующая» шапка ещё проявляется — убираем её, остаётся одна шапка
        document.querySelectorAll('.xp-hero-next').forEach(function(x){x.remove();});
        var hs=document.querySelectorAll('.xp-hero'); for(var hi=1;hi<hs.length;hi++)hs[hi].remove();
        var oh=document.querySelector('.xp-hero'), nh=nd.querySelector('.xp-hero');
        var past=!oh||window.scrollY>=oh.offsetHeight;   // читатель уже ниже фото — не дёргаем экран обратно к нему
        if(oh&&nh&&oh.innerHTML===nh.innerHTML){/* та же картинка — ничего не трогаем */}
        else if(oh&&nh){
          // старое фото стоит, пока новое не загрузится; новое кладём поверх прозрачным и проявляем
          var n=document.importNode(nh,true);n.style.cssText+=';position:absolute;left:0;right:0;top:'+oh.offsetTop+'px;z-index:2;opacity:0;transition:opacity .35s ease;view-transition-name:none';
          n.classList.add('xp-hero-next');oh.parentNode.insertBefore(n,oh.nextSibling);
          var im=Array.prototype.filter.call(n.querySelectorAll('img'),function(i){return getComputedStyle(i).display!=='none';})[0];
          var shown=false,show=function(){if(shown)return;shown=true;n.style.opacity='1';
            setTimeout(function(){n.style.cssText=n.style.cssText.replace(/position:[^;]+;|left:[^;]+;|right:[^;]+;|top:[^;]+;|z-index:[^;]+;|opacity:[^;]+;|transition:[^;]+;|view-transition-name:[^;]+;/g,'');
              if(!n.parentNode)return;n.classList.remove('xp-hero-next');if(oh.parentNode)oh.remove();},380);};
          if(!im||(im.complete&&im.naturalWidth))show();else{im.addEventListener('load',show,{once:true});im.addEventListener('error',show,{once:true});setTimeout(show,4000);}
        }
        else if(oh)oh.remove();
        else if(nh){var lay=document.querySelector('.layout'); if(lay){var n2=document.importNode(nh,true);lay.parentNode.insertBefore(n2,lay);if(window.jbbHeroWait)window.jbbHeroWait(n2);}}
        var res=document.getElementById('res'); if(res)res.classList.remove('on');
        var oc=document.querySelector('.topbar .crumb'), nc=nd.querySelector('.topbar .crumb'); if(oc&&nc)oc.innerHTML=nc.innerHTML;
        if(sd){ var name=u.pathname.split('/').pop();
          sd.querySelectorAll('a.cur').forEach(function(a){a.classList.remove('cur');});
          sd.querySelectorAll('a[href="'+name+'"]').forEach(function(a){a.classList.add('cur');
            var r=a.getBoundingClientRect(),s=sd.getBoundingClientRect(); if(r.top<s.top||r.bottom>s.bottom) sd.scrollTop+=r.top-s.top-sd.clientHeight/2; }); }
        close(); ghide();
        var t=u.hash&&document.getElementById(decodeURIComponent(u.hash.slice(1)));
        var h2=document.querySelector('.xp-hero');
        if(t)t.scrollIntoView(); else window.scrollTo(0,past&&h2?h2.offsetHeight:0);
        initPage(); vars();
        document.body.classList.remove('is-loading');
      };
      if(document.startViewTransition&&document.visibilityState==='visible'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
        var vt=document.startViewTransition(swap), noop=function(){};
        vt.ready.catch(noop); vt.updateCallbackDone.catch(noop);   // пропущенная анимация — не ошибка
        // страховка: если браузер не рисует кадры (вкладка в фоне, свёрнутое окно), колбэк перехода
        // может не вызваться вовсе, и страница застряла бы на старой главе; тогда подменяем без анимации
        var guard=setTimeout(function(){ if(!swapped){ try{vt.skipTransition();}catch(e){} swap(); warm(); } },350);
        vt.finished.then(function(){clearTimeout(guard);warm();},function(){clearTimeout(guard);warm();});
      } else { swap(); warm(); }
    }).catch(function(){location.href=href;});
  }
  window.jbbGo=go;
  // заранее подгружаем главы, куда читатель, скорее всего, пойдёт: соседние по порядку и ту, на ссылку
  // которой навели мышь. Ответ ложится в кэш service worker, и переход потом берёт его оттуда без сети.
  var pre={}, conn=navigator.connection;
  function prefetch(h){
    if(!h||(conn&&conn.saveData)) return;
    var u; try{u=new URL(h,location.href);}catch(e){return;}
    if(u.origin!==location.origin||!/\.html$/.test(u.pathname)||u.pathname===curPath||pre[u.pathname]) return;
    pre[u.pathname]=1;
    fetch(u.pathname,{credentials:'same-origin',priority:'low'}).catch(function(){delete pre[u.pathname];});
  }
  function warm(){
    var idle=window.requestIdleCallback||function(f){return setTimeout(f,1500);};
    idle(function(){ document.querySelectorAll('.nav a.prev, .nav a.next').forEach(function(a){prefetch(a.getAttribute('href'));}); });
  }
  var hovT=null;
  document.addEventListener('pointerover',function(e){
    var a=e.target.closest&&e.target.closest('a[href$=".html"], a[href*=".html#"]'); if(!a) return;
    clearTimeout(hovT); hovT=setTimeout(function(){prefetch(a.getAttribute('href'));},80);
  },{passive:true});
  document.addEventListener('touchstart',function(e){
    var a=e.target.closest&&e.target.closest('a[href$=".html"], a[href*=".html#"]'); if(a) prefetch(a.getAttribute('href'));
  },{passive:true});
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest('a[href]'); if(!a||a.target||a.hasAttribute('download'))return;
    var h=a.getAttribute('href'); if(!h||/^(https?:|mailto:|tel:|javascript:)/i.test(h))return;
    if(h.charAt(0)==='#')return; // обычный якорь на этой же странице
    var u; try{u=new URL(h,location.href);}catch(err){return;}
    if(u.origin!==location.origin||!/\.html$/.test(u.pathname)||FULL.test(u.pathname))return;
    if(!document.querySelector('.doc'))return; // главная и служебные страницы — обычный переход
    e.preventDefault(); go(h);
  });
  window.addEventListener('popstate',function(){ go(location.pathname+location.hash,{pop:true}); });
  // клавиши: [ и ] — предыдущая и следующая глава
  document.addEventListener('keydown',function(e){
    var t=e.target; if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)||e.ctrlKey||e.metaKey||e.altKey)return;
    var a=null; if(e.key==='[')a=document.querySelector('.nav a.prev'); if(e.key===']')a=document.querySelector('.nav a.next');
    if(a){e.preventDefault();go(a.getAttribute('href'));}
  });

  // ---------- главная: продолжить чтение, отметки плана, фильтр ----------
  var rs=document.getElementById('resume');
  if(rs){try{var L=JSON.parse(ls('jbb-last')||'null');
    if(L&&L.u){var a=document.createElement('a');a.href=L.u+(L.h?'#'+L.h:'');a.textContent=L.t.replace(/ — Java Backend Bible$/,'');
      rs.querySelector('.slot').appendChild(a);
      if(L.s){var s=document.createElement('small');s.textContent='раздел: '+L.s;rs.appendChild(s);}
      rs.hidden=false;}}catch(e){}}
  try{var plan=JSON.parse(ls('jbb-prep-plan-v1')||'{}');
    document.querySelectorAll('.chap[data-file]').forEach(function(li){var st=plan[li.getAttribute('data-file')];if(st){li.setAttribute('data-read',st);var r=li.querySelector('.rd');if(r)r.textContent={read:'прочитано',active:'читаю',review:'повторить'}[st]||'';}});
  }catch(e){}
  var fl=document.querySelector('.filter');
  if(fl){var fb=fl.querySelector('[data-f="final"]');if(fb)fb.textContent='Готовые · '+document.querySelectorAll('.chap[data-final]').length;}
  if(fl){fl.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    fl.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});
    var v=b.getAttribute('data-f');
    document.querySelectorAll('.chap').forEach(function(li){var ok=v==='all'||(v==='draft'&&li.hasAttribute('data-draft'))||(v==='final'&&li.hasAttribute('data-final'))||(v==='unread'&&!li.getAttribute('data-read'));li.hidden=!ok;});
    document.querySelectorAll('.part-block').forEach(function(pb){pb.hidden=!pb.querySelector('.chap:not([hidden])');});
  });}

  initPage(); warm();
})();

(function(){
  var root=document.documentElement, reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}

  // код следует теме страницы: светлое окно днём, тёмное в тёмной теме
  var mq=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');
  function codeSync(){var t=root.getAttribute('data-theme'), dark=t==='dark'||(!t&&mq&&mq.matches);
    if(dark)root.removeAttribute('data-code');else root.setAttribute('data-code','light');}
  codeSync(); if(mq&&mq.addEventListener)mq.addEventListener('change',codeSync);
  new MutationObserver(codeSync).observe(root,{attributes:true,attributeFilter:['data-theme']});

  // фото-шапка: пока видимая копия не загрузилась, под ней заглушка, а само фото прозрачно; загрузилось — проявляется
  function heroWait(h){if(!h)return;var im=Array.prototype.filter.call(h.querySelectorAll('img'),function(i){return getComputedStyle(i).display!=='none';})[0];
    if(!im||im.complete&&im.naturalWidth)return;h.classList.add('wait');
    var ok=function(){h.classList.remove('wait');};im.addEventListener('load',ok,{once:true});im.addEventListener('error',ok,{once:true});setTimeout(ok,4000);}
  heroWait(document.querySelector('.xp-hero'));
  window.jbbHeroWait=heroWait;

  // читатель ниже фото-шапки — и после полной загрузки другой страницы (главная, рефреш, план, закладки) он
  // оказывается под шапкой, а не на ней: перед уходом запоминаем, был ли он ниже, новая страница сразу прокручивает
  (function(){
    function below(){var h=document.querySelector('.xp-hero');return !!h&&window.scrollY>=h.offsetHeight-2;}
    function mark(){try{sessionStorage.setItem('jbb-past-hero',below()?'1':'0');}catch(e){}}
    addEventListener('pagehide',mark);
    document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a)mark();},true);
    var was=null;try{was=sessionStorage.getItem('jbb-past-hero');sessionStorage.removeItem('jbb-past-hero');}catch(e){}
    var h=document.querySelector('.xp-hero');
    if(was==='1'&&h&&!location.hash&&window.scrollY<h.offsetHeight){
      window.jbbStartY=h.offsetHeight; window.scrollTo(0,h.offsetHeight);
    }
  })();

  // переход к разделу: браузер прыгает по приблизительным высотам блоков (content-visibility), блоки над заголовком
  // дорисовываются и сдвигают его вниз — виден хвост прошлого раздела, и оглавление отмечает прошлый. Уточняем
  // положение несколько раз, пока разметка не устоится; если читатель сам взялся прокручивать — перестаём
  function settleTo(el){
    if(!el)return; var n=0,stop=false,off=function(){stop=true;};
    ['wheel','touchstart','keydown','mousedown'].forEach(function(ev){addEventListener(ev,off,{passive:true,once:true});});
    var pr=document.querySelector('.prose'),top=el;while(pr&&top.parentElement&&top.parentElement!==pr)top=top.parentElement;
    for(var e=top,i=0;e&&i<4;i++,e=e.previousElementSibling)e.style.contentVisibility='visible';   // будим блоки прямо над заголовком
    (function again(){setTimeout(function(){if(stop)return;
      var want=parseFloat(getComputedStyle(el).scrollMarginTop)||0,dy=el.getBoundingClientRect().top-want;
      if(Math.abs(dy)>2)window.scrollBy(0,dy);
      if(++n<8)again();else window.dispatchEvent(new Event('scroll'));},90);})();   // оглавление пересчитывает текущий раздел по итоговому месту
  }
  window.jbbSettleTo=settleTo;
  addEventListener('hashchange',function(){var id=decodeURIComponent(location.hash.slice(1));if(id&&!/^bm-/.test(id))settleTo(document.getElementById(id));});
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;
    var id=decodeURIComponent(a.getAttribute('href').slice(1));if(id&&('#'+id)===decodeURIComponent(location.hash))setTimeout(function(){settleTo(document.getElementById(id));},0);});

  // подсказка к ссылке: через 250 мс после наведения — куда она ведёт (data-tip ставит сборка; внешний адрес — на месте)
  (function(){
    if(!matchMedia('(hover: hover)').matches)return;
    var tm=0,box=null,cur=null;
    function text(a){var t=a.getAttribute('data-tip');if(t)return t;var h=a.getAttribute('href')||'';
      if(/^https?:/.test(h)){try{var u=new URL(h);return 'Внешний сайт · '+u.host.replace(/^www\./,'')+'\n'+(h.length>90?h.slice(0,88)+'…':h);}catch(e){}}return '';}
    function hide(){clearTimeout(tm);cur=null;if(box){box.remove();box=null;}}
    function show(a){var t=text(a);if(!t)return;hide();cur=a;box=document.createElement('div');box.className='xp-balloon tip';box.textContent=t;
      box.setAttribute('role','tooltip');document.body.appendChild(box);
      var r=a.getBoundingClientRect(),b=box.getBoundingClientRect(),x=Math.min(Math.max(8,r.left),innerWidth-b.width-8),y=r.bottom+6;
      if(y+b.height>innerHeight-8)y=r.top-b.height-6;box.style.left=x+'px';box.style.top=y+'px';}
    document.addEventListener('mouseover',function(e){var a=e.target.closest&&e.target.closest('.prose a[href], .xp-win a[href]');
      if(!a||a===cur||a.closest('.toc, .nav, .toc-list'))return;clearTimeout(tm);if(box)hide();tm=setTimeout(function(){show(a);},250);});
    document.addEventListener('mouseout',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(a&&!a.contains(e.relatedTarget))hide();});
    addEventListener('scroll',hide,{passive:true});document.addEventListener('mousedown',hide);document.addEventListener('keydown',hide);
  })();

  // вид страницы: «с меню» (глава, служебная) или «без меню» (главная). Переход между разными видами — без
  // постоянных элементов: иначе старое меню на долю секунды висит поверх главной
  function kindOf(path){return /(^|\/)(index\.html)?$/.test(path)?'home':'doc';}
  var myKind=kindOf(location.pathname);
  addEventListener('pageswap',function(e){try{var to=e.activation&&e.activation.entry&&new URL(e.activation.entry.url).pathname;
    if(e.viewTransition&&to&&kindOf(to)!==myKind)root.classList.add('vt-plain');}catch(x){}});
  addEventListener('pagereveal',function(e){try{var fr=navigation.activation&&navigation.activation.from&&new URL(navigation.activation.from.url).pathname;
    if(e.viewTransition&&fr&&kindOf(fr)!==myKind){root.classList.add('vt-plain');e.viewTransition.finished.finally(function(){root.classList.remove('vt-plain');});}}catch(x){}});
  addEventListener('pageshow',function(){root.classList.remove('vt-plain');});

  // боковое меню: высота — видимая часть экрана под его верхним краем, иначе под фото-шапкой низ меню не долистать
  (function(){var sd=document.getElementById('side');if(!sd)return;var q=0;
    // высоту задаёт переменная --side-h: её читает только меню-колонка (sticky); выдвижное меню телефона держит свою 100dvh
    function fit(){q=0;if(getComputedStyle(sd).position!=='sticky')return;
      var t=Math.max(0,sd.getBoundingClientRect().top);root.style.setProperty('--side-h',(window.innerHeight-t)+'px');}
    function ask(){if(!q)q=setTimeout(fit,16);}   // таймер, а не кадр: в фоновой вкладке кадры не рисуются
    fit();addEventListener('scroll',ask,{passive:true});addEventListener('resize',ask);addEventListener('load',fit);})();

  // панель задач: сворачивание группы; часть текущей главы открыта
  var side=document.getElementById('side');
  if(side){
    var shut={}; try{shut=JSON.parse(ls('jbb-parts')||'{}')||{};}catch(e){}
    side.querySelectorAll('.part').forEach(function(p){
      var ul=p.nextElementSibling; if(!ul||ul.tagName!=='UL')return;
      var key=(p.textContent||'').trim(), cur=!!ul.querySelector('a.cur');
      p.setAttribute('role','button'); p.setAttribute('tabindex','0');
      if(shut[key]&&!cur)p.classList.add('shut');
      p.setAttribute('aria-expanded',p.classList.contains('shut')?'false':'true');
      // список глав выезжает и уезжает: высота от 0 до своей и обратно, быстро в начале и мягко в конце
      // желаемое состояние хранится отдельно от класса: класс shut ставится только в конце сворачивания,
      // и второй быстрый клик должен развернуть группу обратно, а не свернуть ещё раз
      var anim=null, tm=0, isOpen=!p.classList.contains('shut');
      function tog(){
        isOpen=!isOpen;
        p.setAttribute('aria-expanded',isOpen?'true':'false');
        if(!isOpen)shut[key]=1;else delete shut[key];ls('jbb-parts',JSON.stringify(shut));
        var from=ul.offsetHeight;                       // текущая высота — в том числе на середине прерванной анимации
        if(anim){anim.cancel();anim=null;} clearTimeout(tm);
        p.classList.toggle('turn',!isOpen);             // шеврон поворачивается сразу, не дожидаясь конца
        if(reduce||!ul.animate){p.classList.toggle('shut',!isOpen);return;}
        p.classList.remove('shut');ul.style.overflow='hidden';ul.style.boxSizing='border-box';
        var to=isOpen?ul.scrollHeight:0, ms=isOpen?Math.min(360,180+to/6):Math.min(300,150+from/8);
        anim=ul.animate([{height:from+'px',opacity:isOpen?.3:1},{height:to+'px',opacity:isOpen?1:0,paddingTop:isOpen?undefined:'0px',paddingBottom:isOpen?undefined:'0px'}].map(function(k){
            Object.keys(k).forEach(function(x){if(k[x]===undefined)delete k[x];});return k;}),
          {duration:ms,easing:isOpen?'cubic-bezier(.2,.9,.3,1)':'cubic-bezier(.5,0,.75,0)',fill:'forwards'});
        // итог — по своему таймеру: в свёрнутой вкладке браузер не продвигает анимацию и не шлёт её событий
        tm=setTimeout(function(){if(anim){anim.cancel();anim=null;}ul.style.overflow='';ul.style.boxSizing='';p.classList.toggle('shut',!isOpen);},ms+20);
      }
      p.addEventListener('click',tog);
      p.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}});
      p._open=function(){return isOpen;};
    });
    // кнопка над частями: свернуть или развернуть сразу все группы (той же анимацией)
    var parts=Array.prototype.filter.call(side.querySelectorAll('.part'),function(p){return p._open;});
    var bar=side.querySelector('.parts-all');
    if(parts.length>1&&!(bar&&bar._on)){
      if(!bar){bar=document.createElement('div');bar.className='parts-all';bar.innerHTML='<button type="button"></button>';parts[0].parentNode.insertBefore(bar,parts[0]);}
      bar._on=1;var bt=bar.querySelector('button');
      var label=function(){var any=parts.some(function(p){return p._open();});
        bt.textContent=any?'Свернуть все части':'Развернуть все части';bt.setAttribute('aria-expanded',any?'true':'false');};
      bt.addEventListener('click',function(){var any=parts.some(function(p){return p._open();});
        parts.forEach(function(p){if(p._open()===any)p.click();});label();});
      parts.forEach(function(p){p.addEventListener('click',function(){setTimeout(label,0);});});
      label();
    }
  }

  // полосы прокрутки меню и правого оглавления видны, пока ими пользуются: при прокрутке и под курсором;
  // через секунду после остановки гаснут (прокрутка событием scroll не всплывает — ловим на document при захвате)
  var sbT=new WeakMap();
  document.addEventListener('scroll',function(e){var t=e.target;if(!t||!t.classList||!(t.classList.contains('side')||t.classList.contains('rail-in')))return;
    t.classList.add('scrolling');clearTimeout(sbT.get(t));sbT.set(t,setTimeout(function(){t.classList.remove('scrolling');},1000));},true);

  // «Скопировано» — подсказка XP над кнопкой
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.hl-copy'); if(!b)return;
    setTimeout(function(){
      var r=b.getBoundingClientRect(), d=document.createElement('div');
      d.className='xp-balloon'; d.textContent='Скопировано';
      d.style.left=Math.max(8,r.left-6)+'px'; d.style.top=(r.top-36)+'px';
      document.body.appendChild(d);
      setTimeout(function(){d.classList.add('out');setTimeout(function(){d.remove();},240);},1300);
    },0);
  });

  // смена темы — плавно, через View Transitions
  var tb=document.getElementById('theme'), inner=false;
  if(tb&&document.startViewTransition&&!reduce){
    tb.addEventListener('click',function(e){
      if(inner)return; e.stopImmediatePropagation(); e.preventDefault();
      root.classList.add('xp-theme');
      var t=document.startViewTransition(function(){inner=true;tb.click();inner=false;});
      t.finished.then(function(){root.classList.remove('xp-theme');});
    },true);
  }

  // полоса «Содержание главы»: тонкая, прилипает под строкой заголовка, когда оглавление в тексте ушло вверх;
  // показывает текущий раздел, по нажатию раскрывает список разделов. Место в потоке не занимает — ничего не прыгает.
  var tbIO=null;
  function tocbar(){
    var old=document.querySelector('.xp-tocbar'); if(old)old.remove(); if(tbIO){tbIO.disconnect();tbIO=null;}
    var toc=document.getElementById('chapter-toc'), top=document.querySelector('.topbar'), list=toc&&toc.querySelector('.toc-list ol');
    if(!toc||!top||!list)return;
    root.style.setProperty('--xp-tbh',top.offsetHeight+'px');
    var bar=document.createElement('div'); bar.className='xp-tocbar';
    bar.innerHTML='<div class="xp-tocbar-scrim" hidden></div><div class="xp-tocbar-in"><button type="button" class="xp-tocbar-btn" aria-expanded="false"><span class="xp-tocbar-l">Содержание главы</span><span class="xp-tocbar-cur"></span><i aria-hidden="true"></i></button><nav class="xp-tocbar-list" hidden></nav></div>';
    var nav=bar.querySelector('nav'), btn=bar.querySelector('button'), cur=bar.querySelector('.xp-tocbar-cur');
    nav.appendChild(list.cloneNode(true));
    var scrim=bar.querySelector('.xp-tocbar-scrim');
    function open(o){nav.hidden=!o; scrim.hidden=!o; btn.setAttribute('aria-expanded',String(o)); bar.classList.toggle('open',o);}
    scrim.addEventListener('click',function(){open(false);});
    btn.addEventListener('click',function(){open(nav.hidden);});
    nav.addEventListener('click',function(e){if(e.target.closest('a'))open(false);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')open(false);});
    top.parentNode.insertBefore(bar,top.nextSibling);
    var src=document.getElementById('toc-cur');
    function sync(){var s=src?src.textContent.trim():''; cur.textContent=s;
      nav.querySelectorAll('a').forEach(function(a){a.classList.toggle('on',!!s&&a.textContent.trim()===s);});}
    if(src)new MutationObserver(sync).observe(src,{childList:true,characterData:true,subtree:true}); sync();
    if('IntersectionObserver' in window){
      tbIO=new IntersectionObserver(function(es){es.forEach(function(x){var gone=!x.isIntersecting&&x.boundingClientRect.top<0; bar.classList.toggle('on',gone); if(!gone)open(false);});});
      tbIO.observe(toc);
    } else bar.classList.add('on');
  }
  tocbar();
  var docEl=document.querySelector('.doc');
  if(docEl)new MutationObserver(function(){tocbar();}).observe(docEl,{childList:true});
  window.addEventListener('resize',function(){var tp=document.querySelector('.topbar'); if(tp)root.style.setProperty('--xp-tbh',tp.offsetHeight+'px');});

  // маркер по заголовку, к которому пришли по ссылке
  function flash(){var id=decodeURIComponent(location.hash.slice(1)); if(!id)return; var h=document.getElementById(id);
    if(!h||!/^H[23]$/.test(h.tagName))return;
    document.querySelectorAll('.prose .xp-flash').forEach(function(x){x.classList.remove('xp-flash');});   // прежняя подсветка не остаётся
    void h.offsetWidth; h.classList.add('xp-flash');
    clearTimeout(h._xpf); h._xpf=setTimeout(function(){h.classList.remove('xp-flash');},1900);}
  window.addEventListener('hashchange',flash);

  // «Глава дочитана до конца»
  var nav=document.querySelector('.prose .nav');
  if(nav&&'IntersectionObserver' in window){
    var done=document.createElement('div'); done.className='xp-done'; done.innerHTML='<i aria-hidden="true">✓</i><span>Глава дочитана до конца</span>';
    nav.parentNode.insertBefore(done,nav);
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){done.classList.add('on');io.disconnect();}});},{threshold:.6});
    io.observe(done);
  }
})();

(function(){
  // ---------- хранение: localStorage ----------
  var KEY='jbb-bookmarks-v1', LIMIT=500;
  function valid(p){return p&&typeof p.u==='string'&&/^[\w.-]+\.html$/.test(p.u)&&typeof p.d==='number';}
  function lsOK(){try{localStorage.setItem('jbb-ls-test','1');localStorage.removeItem('jbb-ls-test');return true;}catch(e){return false;}}
  // перенос из кук первой версии (jbb_bm_0…: base64 от UTF-8 или encodeURIComponent) — один раз, затем куки удаляются
  (function migrate(){try{
    var get=function(n){var m=document.cookie.match('(?:^|; )'+n+'=([^;]*)');return m?m[1]:null;};
    var n=+get('jbb_bm_n')||0;if(!n)return;var s='';for(var i=0;i<n;i++)s+=get('jbb_bm_'+i)||'';
    var old=[];try{old=JSON.parse(decodeURIComponent(escape(atob(s))));}catch(e){try{old=JSON.parse(decodeURIComponent(s));}catch(e2){}}
    var cur=JSON.parse(localStorage.getItem(KEY)||'[]');
    (Array.isArray(old)?old:[]).forEach(function(p){if(p&&typeof p.d==='number'&&p.d>1e11)p.d=Math.floor(p.d/1000);
      if(valid(p)&&!cur.some(function(q){return q.d===p.d;}))cur.push(p);});
    localStorage.setItem(KEY,JSON.stringify(cur));
    var path=location.pathname.replace(/[^\/]*$/,'')||'/';
    ['/',path].forEach(function(pt){for(var j=0;j<Math.max(n,8);j++)document.cookie='jbb_bm_'+j+'=;path='+pt+';max-age=0';
      document.cookie='jbb_bm_n=;path='+pt+';max-age=0';});
  }catch(e){}})();
  function load(){try{var l=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(l)?l.filter(valid):[];}catch(e){return [];}}
  function save(list){try{var s=JSON.stringify(list);localStorage.setItem(KEY,s);return localStorage.getItem(KEY)===s;}catch(e){return false;}}
  window.jbbBookmarks={load:load,save:save};

  // ---------- окно подтверждения в стиле XP ----------
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function modal(title,html,buttons){
    document.querySelectorAll('.xp-modal').forEach(function(m){m.remove();});
    var m=document.createElement('div');m.className='xp-modal';
    m.innerHTML='<div class="xp-win" role="dialog" aria-modal="true" aria-labelledby="xpw-t"><div class="xp-win-t"><span id="xpw-t"></span><button type="button" class="xp-win-x" aria-label="Закрыть">×</button></div><div class="xp-win-b"></div><div class="xp-win-f"></div></div>';
    m.querySelector('#xpw-t').textContent=title; m.querySelector('.xp-win-b').innerHTML=html;
    var f=m.querySelector('.xp-win-f'),prev=document.activeElement,done=false;
    function close(){if(done)return;done=true;m.remove();document.removeEventListener('keydown',key,true);if(prev&&prev.focus)try{prev.focus();}catch(e){}}
    function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
      if(e.key==='Tab'){var fs=m.querySelectorAll('button,a[href],input'),a=fs[0],z=fs[fs.length-1];   // фокус не уходит из окна
        if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}}
    buttons.forEach(function(b){var el=document.createElement('button');el.type='button';el.textContent=b.t;if(b.cls)el.className=b.cls;
      el.addEventListener('click',function(){if(done)return;if(b.fn&&b.fn()===false)return;close();});f.appendChild(el);});
    m.querySelector('.xp-win-x').addEventListener('click',close);
    m.addEventListener('click',function(e){if(e.target===m)close();});
    document.addEventListener('keydown',key,true);document.body.appendChild(m);
    var inp=m.querySelector('input');
    if(inp){inp.focus();inp.select();inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();var d=f.querySelector('.def');if(d)d.click();}});}
    else (f.querySelector('.def')||f.querySelector('button')).focus();
    return m;
  }
  window.jbbModal=modal;   // окно XP общее: им пользуется и панель рефреша
  function info(t,h){modal(t,h,[{t:'OK',cls:'def'}]);}
  // многоточие после подписи — только если строка оборвана, а не кончается знаком препинания
  function ell(x){x=x||'';return /[.!?…:;»)]$/.test(x)?x:x+'…';}
  function nameField(v){return '<p class="bm-where" style="margin-top:10px"><label for="bm-name">Название закладки</label></p>'+
    '<input id="bm-name" class="bm-name" type="text" maxlength="120" autocomplete="off" value="'+esc(v)+'">';}

  // ---------- блоки текста главы ----------
  // до абзаца: врезки, списки, раскрывающиеся блоки, таблицы и сноски разворачиваются в абзацы, пункты и строки таблиц;
  // у окна кода берётся только код, без полосы с кнопками
  function prose(){return document.querySelector('.doc .prose')||document.querySelector('.prose');}
  function norm(s){return s.replace(/\s+/g,' ').trim();}
  function ownText(c){return norm(Array.prototype.filter.call(c.childNodes,function(n){return n.nodeType===3;}).map(function(n){return n.textContent;}).join(''));}
  function flat(){var pr=prose(),out=[];if(!pr)return out;
    (function walk(el){Array.prototype.forEach.call(el.children,function(c){
      var t=c.tagName;
      if(t==='SUMMARY'||t==='NAV'||t==='SCRIPT'||t==='STYLE'||c.classList.contains('bm-flash'))return;
      if(/^(BLOCKQUOTE|UL|OL|DETAILS|TABLE|THEAD|TBODY|FIGURE)$/.test(t)&&c.children.length){walk(c);return;}
      if(t==='DIV'&&c.querySelector('pre')){var ps=Array.prototype.filter.call(c.querySelectorAll('pre'),function(x){return x.offsetParent!==null;});out.push(ps[0]||c.querySelector('pre'));return;}
      if(t==='DIV'&&c.children.length&&!ownText(c)){walk(c);return;}
      if(t==='LI'&&c.querySelector(':scope>p,:scope>ul,:scope>ol')){walk(c);return;}
      out.push(c);});})(pr);
    return out;}
  function readY(){var tb=document.querySelector('.topbar'),bar=document.querySelector('.xp-tocbar.on .xp-tocbar-btn');
    var y=tb?tb.getBoundingClientRect().bottom:0; if(bar)y=Math.max(y,bar.getBoundingClientRect().bottom); return Math.max(0,y)+12;}
  function lineH(el){var cs=getComputedStyle(el),lh=parseFloat(cs.lineHeight);return lh>0?lh:parseFloat(cs.fontSize)*1.5;}
  function caret(px,py){if(document.caretRangeFromPoint){var c=document.caretRangeFromPoint(px,py);return c&&{n:c.startContainer,o:c.startOffset};}
    if(document.caretPositionFromPoint){var q=document.caretPositionFromPoint(px,py);return q&&{n:q.offsetNode,o:q.offset};}return null;}
  // смещение символа от начала блока и обратно — через текстовые узлы (Range.toString считает так же)
  function offsetOf(b,node,off){var r=document.createRange();r.setStart(b,0);try{r.setEnd(node,off);}catch(e){return 0;}return r.toString().length;}
  function pointAt(b,off){var w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT),n,acc=0,last=null;
    while((n=w.nextNode())){var L=n.textContent.length;if(acc+L>off){return {n:n,o:off-acc};}acc+=L;last=n;}
    return last?{n:last,o:Math.max(0,last.textContent.length-1)}:null;}
  function rectAt(b,off){var p=pointAt(b,off);if(!p)return b.getBoundingClientRect();
    var r=document.createRange();r.setStart(p.n,p.o);r.setEnd(p.n,Math.min(p.o+1,p.n.textContent.length));
    var rs=r.getClientRects();return rs.length?rs[0]:b.getBoundingClientRect();}
  // блоки главы помечены content-visibility:auto: пока браузер считает блок далёким от экрана, он не рисует его
  // содержимое, и каретка внутри отдаёт сам абзац вместо текста. Перед поиском строки будим блоки в полосе [y0, y1]
  function wake(y0,y1){var pr=prose();if(!pr)return;Array.prototype.forEach.call(pr.children,function(c){
    var r=c.getBoundingClientRect();if(r.bottom>=y0&&r.top<=y1)c.style.contentVisibility='visible';});void pr.offsetHeight;}
  function wakeAround(b){var pr=prose(),top=b;while(top.parentElement&&top.parentElement!==pr)top=top.parentElement;
    var e=top;for(var i=0;i<6&&e;i++){e.style.contentVisibility='visible';e=e.previousElementSibling;}
    e=top.nextElementSibling;for(var j=0;j<3&&e;j++){e.style.contentVisibility='visible';e=e.nextElementSibling;}}
  function sectionOf(b){var pr=prose(),top=b;while(top.parentElement&&top.parentElement!==pr)top=top.parentElement;
    var h=top;while(h){if(/^H[23]$/.test(h.tagName))return norm(h.textContent);h=h.previousElementSibling;}return '';}

  // ---------- где читаем ----------
  function here(){
    var pr=prose();if(!pr)return null;
    var y=readY();wake(y-40,y+400);
    var all=flat(),box=pr.getBoundingClientRect(),pl=box.left;
    if(box.bottom<y)return null;
    var b=null,c=null,py=0;
    for(var dy=4;dy<160&&!b;dy+=6){
      for(var dx=2;dx<Math.min(pr.clientWidth,360)&&!b;dx+=12){
        var k=caret(pl+dx,y+dy);
        if(k&&k.n&&(k.n.nodeType===3?k.n.textContent.trim():k.n.nodeType===1)){
          for(var i=0;i<all.length;i++)if(all[i].contains(k.n)&&norm(all[i].textContent)){b=all[i];c=k;py=y+dy;break;}
        }
      }
    }
    if(!b){var bs=all.filter(function(e){return e.offsetParent!==null&&e.offsetHeight>0&&norm(e.textContent);});
      for(var j=0;j<bs.length;j++){var rr=bs[j].getBoundingClientRect();if(rr.bottom>y){b=bs[j];py=Math.max(y,rr.top);c={n:b,o:0};break;}}
      if(!b)return null;}
    // строки считаем от начала содержимого блока: у кода и ячеек есть внутренний отступ сверху
    var r=b.getBoundingClientRect(),cs=getComputedStyle(b),lh=lineH(b),
        top=r.top+(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.borderTopWidth)||0),
        left=r.left+(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.borderLeftWidth)||0),
        line=Math.max(0,Math.floor((py-top)/lh));
    // начало строки: каретка к левому краю содержимого на высоте этой строки
    for(var sx=0;sx<48;sx+=3){var s0=caret(left+sx+1,top+line*lh+lh/2);if(s0&&s0.n&&s0.n.nodeType===3&&b.contains(s0.n)){c=s0;break;}}
    var off=c.n.nodeType===3?offsetOf(b,c.n,c.o):0, txt=b.textContent;
    var x=norm(txt.slice(off,off+200)).slice(0,60)||norm(txt).slice(0,60);
    var sec=sectionOf(b), m=sec.match(/^(\d+(?:\.\d+)*)\.?\s/);
    return {u:(location.pathname.split('/').pop()||'index.html'),b:all.indexOf(b),o:off,l:line,x:x,
      s:m?m[1]:sec.slice(0,40),d:Math.floor(Date.now()/1000)};
  }

  // ---------- кнопка в строке заголовка ----------
  var IC='<svg class="svg-ic" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>';
  function chapterTitle(){var h1=prose()&&prose().querySelector('h1');return norm(h1?h1.textContent:document.title);}
  function addButton(){
    var bt=document.getElementById('bm');   // кнопка уже в разметке строки заголовка (site_theme.topbar)
    if(bt){if(!bt._bm){bt._bm=1;bt.addEventListener('click',function(){if(bt.dataset.to)location.href=bt.dataset.to;else ask();});}return;}
    return;   // на главной своей строки заголовка нет, и закладку там ставить некуда — кнопку не добавляем
    var theme=document.getElementById('theme');if(!theme)return;
    bt=document.createElement('button');bt.className='btn bm-btn';bt.id='bm';bt.type='button';bt.title='Закладка на этой строке';bt.setAttribute('aria-label',bt.title);bt.innerHTML=IC;
    theme.parentNode.insertBefore(bt,theme);
    bt.addEventListener('click',ask);
  }
  function ask(){
    var tb=document.querySelector('.xp-tocbar.open .xp-tocbar-btn');if(tb)tb.click();   // открытое оглавление закрываем: читаем текст, а не список
    if(!lsOK()){info('Закладки недоступны','<p>Браузер не даёт сайту хранить данные (приватный режим с запретом хранения или запрет для сайта), поэтому закладку сохранить нельзя.</p>');return;}
    var p=here();
    if(!p){info('Закладка','<p>Здесь нечего отметить: закладку можно поставить в тексте главы.</p>');return;}
    p.t=chapterTitle().slice(0,120);
    var list=load(),same=list.filter(function(q){return q.u===p.u&&q.b===p.b&&Math.abs((q.o|0)-p.o)<3;})[0];
    var where='<p><b>'+esc(p.t)+'</b></p>'+(p.s?'<p class="bm-where">Раздел '+esc(p.s)+'</p>':'')+
      '<p class="bm-where">Строка '+(p.l+1)+' в этом месте текста:</p><q>'+esc(ell(p.x))+'</q>';
    if(same){modal('Закладка уже есть',where+'<p class="bm-where">На этой строке уже стоит закладка «'+esc(same.n||same.x)+'» от '+new Date(same.d*1000).toLocaleDateString('ru-RU')+'.</p>',[{t:'OK',cls:'def'}]);return;}
    if(list.length>=LIMIT){info('Закладок слишком много','<p>Сохранено '+list.length+' закладок. Удалите ненужные на странице <a href="bookmarks.html">«Закладки»</a>.</p>');return;}
    var def=p.s?(p.s+' · '+p.x.slice(0,40)):p.x.slice(0,50);
    var mw=modal('Сохранить закладку?',where+nameField(def),
      [{t:'Сохранить',cls:'def',fn:function(){p.n=norm(mw.querySelector('#bm-name').value).slice(0,120)||def;
         var l=load();while(l.some(function(q){return q.d===p.d;}))p.d++;   // время сохранения — ключ закладки, он единственный
         setTimeout(function(){done([p].concat(l));},0);}},{t:'Отмена'}]);
  }
  function done(l){
    if(!save(l)){info('Закладка не сохранилась','<p>Браузер не записал данные: хранилище сайта переполнено или запрещено.</p>');return;}
    info('Закладка сохранена','<p>Все закладки — на странице <a href="bookmarks.html">«Закладки»</a> в меню.</p>');
  }
  function syncButton(){var bt=document.getElementById('bm');if(!bt)return;
    // в главе кнопка ставит закладку; на служебной странице ведёт к коллекции закладок; на самой коллекции не видна, но место держит
    var on=!!document.querySelector('.doc .prose h1'),coll=/(^|\/)bookmarks\.html$/.test(location.pathname);
    bt.style.visibility=coll?'hidden':'';bt.dataset.to=on||coll?'':'bookmarks.html';
    bt.title=on?'Закладка на этой строке':'Мои закладки';bt.setAttribute('aria-label',bt.title);}

  // ---------- возврат к строке: адрес вида глава.html#bm-<время сохранения> ----------
  var going=0;
  function go(){
    var m=location.hash.match(/^#bm-(\d+)$/);if(!m)return;
    var id=+m[1],p=load().filter(function(q){return q.d===id;})[0];
    history.replaceState(null,'',location.pathname+location.search);
    if(!p){info('Закладка не найдена','<p>Этой закладки нет в этом браузере: её удалили, очистили данные сайта или ссылку открыли в другом браузере.</p>');return;}
    if(p.u!==(location.pathname.split('/').pop()||'index.html'))return;
    var all=flat(),b=all[p.b],key=(p.x||'').slice(0,30);
    function has(e){return key&&norm(e.textContent).indexOf(key)>=0;}
    // главу могли дописать: если блок по номеру не содержит запомненной строки, ищем блок по тексту, ближайший к прежнему номеру
    if(key&&(!b||!has(b))){b=null;var best=1e9;all.forEach(function(e,i){if(has(e)&&Math.abs(i-p.b)<best){best=Math.abs(i-p.b);b=e;}});}
    if(!b){info('Место не найдено','<p>Текст главы изменился, и запомненной строки в нём больше нет. Глава открыта с начала.</p>');return;}
    var off=p.o|0;
    if(key){var t=b.textContent;if(norm(t.slice(off,off+200)).indexOf(key)!==0){   // смещение сдвинулось внутри блока — уточняем по тексту
      var re=new RegExp(key.split(' ').map(function(w){return w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('\\s+')),mm=re.exec(t);if(mm)off=mm.index;}}
    var d=b;while(d&&d!==document.body){if(d.tagName==='DETAILS'&&!d.open)d.open=true;d=d.parentElement;}   // строка внутри свёрнутого блока
    wakeAround(b);
    var tok=++going,lh=lineH(b);
    // блоки отрисовываются лениво (content-visibility): после прыжка соседние меняют высоту — пересчитываем, пока не устоится
    function place(){var r=rectAt(b,off),t=r.top+scrollY;scrollTo({top:Math.max(0,t-readY()+8),behavior:'auto'});return {t:t,h:r.height||lh};}
    place();var n=0;
    // setTimeout, а не requestAnimationFrame: в фоновой вкладке (ссылку открыли в новой вкладке) кадры не рисуются, таймеры идут
    (function again(){setTimeout(function(){if(tok!==going)return;place();if(++n<10)again();else flash();},120);})();
    function flash(){
      var g=place(),pr=prose(),f=document.createElement('div');f.className='bm-flash';
      if(getComputedStyle(pr).position==='static')pr.style.position='relative';
      f.style.top=(g.t-(pr.getBoundingClientRect().top+scrollY))+'px';f.style.height=Math.max(g.h,lh*.8)+'px';
      pr.appendChild(f);setTimeout(function(){f.classList.add('out');},60);
      setTimeout(function(){f.remove();},3200);
    }
  }

  // ---------- страница коллекции ----------
  var TITLES=window.JBB_TITLES||{};
  function list(){
    var box=document.getElementById('bm-list');if(!box)return;
    var l=load(),clr=document.getElementById('bm-clear'),use=document.getElementById('bm-use');
    if(clr)clr.hidden=!l.length;
    if(use)use.textContent=l.length?('Закладок: '+l.length):'';
    if(!lsOK()){box.innerHTML='<p class="bm-empty">Браузер не даёт сайту хранить данные, поэтому закладки здесь не работают.</p>';return;}
    if(!l.length){box.innerHTML='<p class="bm-empty">Закладок пока нет. В любой главе нажмите кнопку с флажком в строке заголовка — закладка встанет на строку, которую вы читаете.</p>';return;}
    box.innerHTML='<ul class="bm-list">'+l.map(function(p){var d=new Date(p.d*1000),t=TITLES[p.u];
      return '<li><div><a class="bm-go" href="'+esc(p.u)+'#bm-'+p.d+'">'+esc(p.n||p.x||t||p.u)+'</a>'+
        '<span class="bm-sec">'+esc(t||p.t||p.u)+(p.s?' · раздел '+esc(p.s):'')+' · строка '+((p.l|0)+1)+(t?'':' · такой главы больше нет')+'</span>'+
        '<span class="bm-x">«'+esc(ell(p.x))+'»</span><span class="bm-d">'+d.toLocaleDateString('ru-RU')+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+'</span></div>'+
        '<span class="bm-acts"><button type="button" class="btn" data-ren="'+p.d+'">Переименовать</button><button type="button" class="btn" data-del="'+p.d+'">Удалить</button></span></li>';}).join('')+'</ul>';
  }
  function byId(id){return load().filter(function(q){return q.d===id;})[0];}
  document.addEventListener('click',function(e){
    if(!e.target.closest)return;
    var rn=e.target.closest('button[data-ren]');
    if(rn){var rid=+rn.getAttribute('data-ren'),rp=byId(rid);if(!rp){list();return;}
      var cur=rp.n||rp.x||'',mw=modal('Переименовать закладку',nameField(cur),
        [{t:'Сохранить',cls:'def',fn:function(){var v=norm(mw.querySelector('#bm-name').value).slice(0,120)||cur,l=load();
          l.forEach(function(q){if(q.d===rid)q.n=v;});if(!save(l))setTimeout(function(){info('Не удалось','<p>Браузер не записал данные.</p>');},0);list();}},{t:'Отмена'}]);return;}
    var dl=e.target.closest('button[data-del]');
    if(dl){var id=+dl.getAttribute('data-del'),p=byId(id);if(!p){list();return;}
      modal('Удалить закладку?','<p><b>'+esc(p.n||TITLES[p.u]||p.u)+'</b></p><q>'+esc(ell(p.x))+'</q>',
        [{t:'Удалить',cls:'danger',fn:function(){if(!save(load().filter(function(q){return q.d!==id;})))setTimeout(function(){info('Не удалось','<p>Браузер не записал данные.</p>');},0);list();}},{t:'Отмена',cls:'def'}]);return;}
    if(e.target.id==='bm-clear'){var n=load().length;
      modal('Очистить все закладки?','<p>Будут удалены все закладки: '+n+'. Вернуть их будет нельзя.</p>',
        [{t:'Очистить',cls:'danger',fn:function(){save([]);list();}},{t:'Отмена',cls:'def'}]);}
  });
  // закладки поменялись в другой вкладке — перерисовать список
  window.addEventListener('storage',function(e){if(e.key===KEY)list();});
  document.addEventListener('visibilitychange',function(){if(!document.hidden)list();});

  function init(){addButton();syncButton();go();list();}
  init();
  window.addEventListener('hashchange',go);
  var docEl=document.querySelector('.doc');
  if(docEl)new MutationObserver(function(){syncButton();go();}).observe(docEl,{childList:true});
})();
