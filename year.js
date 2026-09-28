function rollingMonthKeys(){
  var end=parseISO(todayISO()),out=[],i,x,m;
  for(i=11;i>=0;i--){
    x=new Date(end.getFullYear(),end.getMonth()-i,1);
    m=String(x.getMonth()+1).padStart(2,'0');
    out.push(x.getFullYear()+'-'+m);
  }
  return out;
}
function monthLabel(key){
  var p=key.split('-');
  return new Date(+p[0],+p[1]-1,1).toLocaleDateString(undefined,{month:'short',year:'numeric'});
}
function renderYear(){
  var keys=rollingMonthKeys(),s=state.settings,logged=[];
  Object.keys(state.days).forEach(function(date){
    if(keys.indexOf(date.slice(0,7))===-1)return;
    var day=state.days[date];
    if(day&&(day.meals||[]).length)logged.push(day);
  });
  var avgP=logged.length?logged.reduce(function(a,d){return a+totals(d).protein;},0)/logged.length:0;
  var avgK=logged.length?logged.reduce(function(a,d){return a+totals(d).calories;},0)/logged.length:0;
  var hit=logged.filter(function(d){return totals(d).protein>=s.protein;}).length;
  var rows=keys.slice().reverse().map(function(key){
    var days=logged.filter(function(d){return d.date.slice(0,7)===key;});
    var ak=days.length?Math.round(days.reduce(function(a,d){return a+totals(d).calories;},0)/days.length):0;
    var ap=days.length?Math.round(days.reduce(function(a,d){return a+totals(d).protein;},0)/days.length):0;
    var right=days.length?(ak+' kcal · P '+ap+' · '+days.length+(days.length===1?' day':' days')):'—';
    return '<div class="yrow"><b>'+monthLabel(key)+'</b><span>'+right+'</span></div>';
  }).join('');
  return '<h2 style="margin:0 0 4px">Year</h2><p class="muted" style="margin:0 0 12px">Rolling 12 months</p><div class="tiles"><div class="tile"><div class="kicker">Avg kcal</div><div class="n">'+Math.round(avgK)+'</div></div><div class="tile"><div class="kicker">Avg protein</div><div class="n">'+Math.round(avgP)+'</div></div><div class="tile"><div class="kicker">Hit protein</div><div class="n">'+hit+'/'+(logged.length||0)+'</div></div></div>'+rows+renderSettings();
}
var _renderFuel=render;
render=function(){
  if(tab!=='year')return _renderFuel();
  if(holdRedraw)return;
  var hash=JSON.stringify({tab:tab,viewDate:viewDate,state:state,form:form,resetArmed:resetArmed});
  if(hash===lastHash)return;
  lastHash=hash;
  document.querySelectorAll('.tabs button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-tab')===tab);});
  var banner=(typeof connectBanner==='function')?connectBanner():'';
  document.getElementById('app').innerHTML=banner+renderYear();
  bind();
};
var _bindToken=bind;
bind=function(){
  _bindToken();
  var old=document.getElementById('token-strip');
  if(old)old.remove();
  var tok=state.settings&&(state.settings.syncToken||'').trim();
  if(!tok)return;
  var strip=document.createElement('div');
  strip.id='token-strip';
  strip.className='hero';
  strip.style.marginBottom='12px';
  var k=document.createElement('div');
  k.className='kicker';
  k.textContent='Sync token';
  var input=document.createElement('input');
  input.id='token-reveal';
  input.readOnly=true;
  input.value=tok;
  input.setAttribute('aria-label','Sync token');
  var btn=document.createElement('button');
  btn.className='primary';
  btn.type='button';
  btn.id='copy-token';
  btn.textContent='Copy';
  btn.style.marginTop='10px';
  btn.onclick=function(){
    input.focus();
    input.select();
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(tok).then(function(){toast('Token copied');}).catch(function(){toast('Hold the token and copy it');});
    }else toast('Hold the token and copy it');
  };
  strip.appendChild(k);
  strip.appendChild(input);
  strip.appendChild(btn);
  var app=document.getElementById('app');
  app.parentNode.insertBefore(strip, app);
};
lastHash='';
render();
