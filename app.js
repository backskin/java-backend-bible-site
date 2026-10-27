
(function(){
  var inp=document.getElementById('q'), box=document.getElementById('res');
  if(!inp||!box) return;
  // индекс заголовков (около 3 МБ) грузится при первом обращении к поиску, а не с каждой страницей:
  // раньше его разбор занимал главный поток на каждой полной загрузке
  var sState=typeof SEARCH!=='undefined'?2:0;
  function needIndex(){
    if(sState) return; sState=1;
    var sc=document.createElement('script'); sc.src='search-index.js?v=2c72881a66';
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
      if(window.scrollY!==0)window.scrollTo(0,0); }
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
  var hideKey='jbb-route-hide';
  var rst=function(){try{return JSON.parse(ls(R.key)||'{}')||{};}catch(e){return {};}};
  var isDone=function(id){var d=rst().done||{};return !!d[id];};
  var setDone=function(id,v){var S=rst();S.done=S.done||{};if(v)S.done[id]=Date.now();else delete S.done[id];ls(R.key,JSON.stringify(S));};
  var pill=null;
  function initRoute(){
    var old=document.querySelector('.rpanel'); if(old&&!document.querySelector('.doc').contains(old)) old.remove();
    RT=null; document.body.classList.remove('has-route');
    if(pill)pill.hidden=true;
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
    rbar.querySelector('.route-x').addEventListener('click',function(){st.hid=true;try{sessionStorage.setItem(hideKey,'1');}catch(e){}upd();});
    RT={upd:upd,get hid(){return st.hid;},set hid(v){st.hid=v;},scroll:function(){var o=st.cur;pick();if(o!==st.cur)upd();}};
    pick(); upd();
  }
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
        var oh=document.querySelector('.xp-hero'), nh=nd.querySelector('.xp-hero');
        var past=!oh||window.scrollY>=oh.offsetHeight;   // читатель уже ниже фото — не дёргаем экран обратно к нему
        if(oh&&nh)oh.replaceWith(document.importNode(nh,true)); else if(oh)oh.remove();
        else if(nh){var lay=document.querySelector('.layout'); if(lay)lay.parentNode.insertBefore(document.importNode(nh,true),lay);}
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
  if(fl){fl.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    fl.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});
    var v=b.getAttribute('data-f');
    document.querySelectorAll('.chap').forEach(function(li){var ok=v==='all'||(v==='draft'&&li.hasAttribute('data-draft'))||(v==='unread'&&!li.getAttribute('data-read'));li.hidden=!ok;});
    document.querySelectorAll('.part-block').forEach(function(pb){pb.hidden=!pb.querySelector('.chap:not([hidden])');});
  });}

  initPage(); warm();
})();

(function(){
  var root=document.documentElement, reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
  var PC=['#3d6fa8','#c2593a','#6b8e23','#7b4fc4','#12949f','#d9456a','#b8860b','#a8324a','#2b9fd0','#4e8f6e','#9a6a32','#5560c8'], RN={I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12};
  function pc(t){var m=/Часть\s+([IVX]+)/.exec(t||'');return m&&RN[m[1]]?PC[RN[m[1]]-1]:null;}

  // код следует теме страницы: светлое окно днём, тёмное в тёмной теме
  var mq=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');
  function codeSync(){var t=root.getAttribute('data-theme'), dark=t==='dark'||(!t&&mq&&mq.matches);
    if(dark)root.removeAttribute('data-code');else root.setAttribute('data-code','light');}
  codeSync(); if(mq&&mq.addEventListener)mq.addEventListener('change',codeSync);
  new MutationObserver(codeSync).observe(root,{attributes:true,attributeFilter:['data-theme']});

  // панель задач: квадратик краски части и сворачивание группы; часть текущей главы открыта
  var side=document.getElementById('side');
  if(side){
    var shut={}; try{shut=JSON.parse(ls('jbb-parts')||'{}')||{};}catch(e){}
    side.querySelectorAll('.part').forEach(function(p){
      var c=pc(p.textContent); if(c)p.style.setProperty('--pc',c);
      var ul=p.nextElementSibling; if(!ul||ul.tagName!=='UL')return;
      var key=(p.textContent||'').trim(), cur=!!ul.querySelector('a.cur');
      p.setAttribute('role','button'); p.setAttribute('tabindex','0');
      if(shut[key]&&!cur)p.classList.add('shut');
      p.setAttribute('aria-expanded',p.classList.contains('shut')?'false':'true');
      function tog(){p.classList.toggle('shut');var s=p.classList.contains('shut');p.setAttribute('aria-expanded',s?'false':'true');
        if(s)shut[key]=1;else delete shut[key];ls('jbb-parts',JSON.stringify(shut));}
      p.addEventListener('click',tog);
      p.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}});
    });
  }
  var tag=document.querySelector('.meta .part-tag'), c0=tag&&pc(tag.textContent); if(c0)root.style.setProperty('--pc',c0);
  document.querySelectorAll('.home .part-block').forEach(function(b){var h=b.querySelector('.pn');var c=h&&pc(h.textContent);if(c)b.style.setProperty('--pc',c);});

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
    bar.innerHTML='<div class="xp-tocbar-in"><button type="button" class="xp-tocbar-btn" aria-expanded="false"><span class="xp-tocbar-l">Содержание главы</span><span class="xp-tocbar-cur"></span><i aria-hidden="true"></i></button><nav class="xp-tocbar-list" hidden></nav></div>';
    var nav=bar.querySelector('nav'), btn=bar.querySelector('button'), cur=bar.querySelector('.xp-tocbar-cur');
    nav.appendChild(list.cloneNode(true));
    function open(o){nav.hidden=!o; btn.setAttribute('aria-expanded',String(o)); bar.classList.toggle('open',o);}
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
    if(!h||!/^H[23]$/.test(h.tagName))return; h.classList.remove('xp-flash'); void h.offsetWidth; h.classList.add('xp-flash');}
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
