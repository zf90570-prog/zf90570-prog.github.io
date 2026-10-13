
'use strict';
const DAYS=['周日','周一','周二','周三','周四','周五','周六'],NAMES={1:'A · 上肢力量',4:'B · 下肢力量',6:'C · 肩背胸'};
const PLANS={
1:[
{id:'bench',name:'杠铃卧推',sets:3,min:4,max:6,weight:65,step:5,rest:210,description:'力量主项 · 3×4–6，保留约2次余力'},
{id:'frontsquat',name:'杠铃前蹲',sets:2,min:5,max:5,weight:40,step:5,rest:150,description:'辅助下肢 · 不力竭，周二有重剑实战'},
{id:'chestrow',name:'胸托哑铃划船',sets:4,min:8,max:12,weight:15,step:2.5,rest:120,description:'每手重量 · 上斜凳胸部支撑'},
{id:'pullmon',name:'正手引体向上',sets:3,min:1,max:2,weight:null,step:0,rest:150,description:'自重 · 先逐步增加规范总次数'},
{id:'lateralmon',name:'哑铃侧平举',sets:2,min:12,max:20,weight:5,step:1,rest:75,description:'每手重量 · 肩部比例'}
],
4:[
{id:'speedsquat',name:'深蹲速度热身组',sets:2,min:3,max:3,weight:40,step:0,rest:75,warmup:true,description:'热身组 · 下降受控，起身积极发力'},
{id:'backsquat',name:'杠铃后蹲',sets:3,min:4,max:6,weight:80,step:5,rest:210,description:'力量主项 · 80kg历史参考，当前动作稳定才使用'},
{id:'glutebridge',name:'负重臀桥',sets:3,min:8,max:12,weight:20,step:2.5,rest:120,description:'臀部髋伸 · 避免用过度挺腰替代'},
{id:'bulgarian',name:'保加利亚分腿蹲',sets:2,min:6,max:8,weight:0,step:2.5,rest:120,description:'每腿次数 · 自重起，稳定后渐进负重'}
],
6:[
{id:'pullsat',name:'正手引体向上',sets:4,min:1,max:2,weight:null,step:0,rest:150,description:'自重 · 次日击剑，避免握力耗尽'},
{id:'dbrow',name:'单臂哑铃划船',sets:4,min:8,max:12,weight:20,step:2.5,rest:120,description:'每手重量 · 每侧8–12次'},
{id:'incline',name:'上斜哑铃卧推',sets:3,min:8,max:12,weight:15,step:2.5,rest:120,description:'每手重量 · 上胸力量与比例'},
{id:'lateralsat',name:'哑铃侧平举',sets:2,min:12,max:20,weight:5,step:1,rest:75,description:'每手重量 · 不借力摆动'},
{id:'rear',name:'上斜凳反向飞鸟',sets:2,min:12,max:20,weight:3,step:1,rest:75,description:'每手重量 · 肩后束'},
{id:'suitcase',name:'单侧哑铃负重站立',sets:2,min:20,max:30,weight:10,step:2.5,rest:75,timed:true,description:'每侧保持秒数 · 躯干不侧倾'}
]};
const FENCING=[
['f1','持剑放松、准备姿势','3分钟'],
['f2','静止直刺与剑尖稳定','8分钟'],
['f3','小幅画圈、绕剑、刺空心环','7分钟'],
['f4','安静前进步、后退步','6分钟'],
['f5','前后步接直刺','6分钟 · 不做短弓步']
],CORE=[
['c1','脚跟发力桥式','每天1–2组×20秒'],
['c2','万向盘腿弯举','周一/四2组中低负荷，其余日1组轻量'],
['c3','死虫式','2组×6次/侧'],
['c4','鸟狗式','1组×6次/侧'],
['c5','万向健腹盘跪姿小幅推出','1组×3–5次'],
['c6','侧平板支撑','每侧20–30秒'],
['c7','平衡板双脚重心控制','2组×30秒，可靠扶手旁'],
['c8','踝背屈与髋部活动','约4分钟']
];
const ALL=[...FENCING,...CORE],KEY='jian-ti-training-v1',BASE={version:2,startDate:'2026-10-12',logs:[],morning:{},overrides:{},draft:null};
let state,tab='home',live=false,timerEnd=0,timerTick=0,toastTimeout;
try{state={...BASE,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(e){state={...BASE};}
state.logs=Array.isArray(state.logs)?state.logs:[];
state.morning=(state.morning&&typeof state.morning==='object')?state.morning:{};
state.overrides=state.overrides||{};
const screen=document.querySelector('#screen');
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function num(x){const n=Number(x);return Number.isFinite(n)?n:0;}
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function advance(date,n){const a=date.split('-').map(Number),d=new Date(a[0],a[1]-1,a[2]+n,12);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function monday(date=today()){const a=date.split('-').map(Number),d=new Date(a[0],a[1]-1,a[2],12);return advance(date,-((d.getDay()+6)%7));}
function weekday(){return new Date().getDay();}
function fmt(s){const a=String(s||'').split('-');return a.length===3?Number(a[1])+'月'+Number(a[2])+'日':s;}
function exById(id){return Object.values(PLANS).flat().find(x=>x.id===id);}
function cfg(ex){return Object.assign({},ex,state.overrides[ex.id]||{});}
function previous(id){for(let i=state.logs.length-1;i>=0;i--){const z=state.logs[i].exercises?.find(x=>x.id===id);if(z)return z;}return null;}
function progression(ex){const p=previous(ex.id);if(!p||!ex.step||ex.warmup)return null;const valid=p.sets?.length>=cfg(ex).sets && p.sets.every(s=>s.done&&num(s.reps)>=ex.max&&num(s.rir)>=2);if(!valid)return null;const weight=num(p.sets[0].weight);return Number((weight+ex.step).toFixed(2));}
function weekData(){const delta=Math.floor((new Date(today()+'T12:00:00')-new Date(state.startDate+'T12:00:00'))/604800000);const w=Math.max(0,delta);return {week:w%12+1,cycle:Math.floor(w/12)+1};}
function toast(s){const e=document.querySelector('#toast');e.textContent=s;e.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>e.classList.remove('visible'),2800);}
function bar(v){return '<div class="progress"><i style="width:'+Math.min(100,Math.max(0,v))+'%"></i></div>';}
function shell(h){return '<div class="screen">'+h+'</div>';}
function title(head,sub=''){return '<div class="section-head"><h2>'+head+'</h2><span>'+esc(sub)+'</span></div>';}
function nav(){document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));}
function morningDone(dt){return !!state.morning[dt]?.completed;}
function weekGym(){const m=monday();return state.logs.filter(x=>x.date>=m&&x.date<=advance(m,6)).length;}
function weekMorning(){const m=monday();return Array.from({length:7},(_,i)=>advance(m,i)).filter(morningDone).length;}
function home(){
const d=weekday(),g=PLANS[d],dt=today(),p=weekData();
let h='<div class="overline">PERSONAL PERFORMANCE LAB</div><h1 class="heading">今天，继续变强。</h1><p class="subtitle">'+fmt(dt)+' · '+DAYS[d]+' · 第 '+p.cycle+' 周期 / 第 '+p.week+' 周</p>';
h+='<div class="hero"><span class="chip">'+(g?'力量训练日':d===0||d===2?'重剑实战日':'恢复 / 技术日')+'</span><h2>'+(g?NAMES[d]:d===0||d===2?'重剑实战':'身体控制与技术')+'</h2><p>'+(g?(d===6?'15:00–17:00':'18:00–20:00')+' · 预约窗口':d===0||d===2?'20:00–22:00 · 击剑馆':'晨练 30分钟击剑 + 30分钟体能')+'</p><button class="btn" data-act="'+(g?'start':'morning')+'" '+(g?'data-day="'+d+'"':'')+'>'+(g?'开始今日力量 →':'查看晨练 →')+'</button></div>';
if(state.draft){h+='<div class="card row"><div><strong>尚未完成的力量训练</strong><div class="small muted">'+NAMES[state.draft.day]+' · 进度自动保存</div></div><button class="btn small" data-act="resume">继续训练</button></div>';}
h+='<div class="grid2"><div class="metric"><small>本周力量</small><div class="value">'+weekGym()+'<span class="small muted"> / 3</span></div>'+bar(weekGym()/3*100)+'</div><div class="metric"><small>本周晨练</small><div class="value">'+weekMorning()+'<span class="small muted"> / 6</span></div>'+bar(weekMorning()/6*100)+'</div></div>';
h+=title('这一周','固定训练安排');
h+='<div class="weekstrip">';
const m=monday();[1,2,3,4,5,6,0].forEach((day,i)=>{const ds=advance(m,i),work=state.logs.some(x=>x.date===ds),check=morningDone(ds);h+='<div class="weekday '+(ds===dt?'today':'')+'"><strong>'+DAYS[day].slice(1)+'</strong><small>'+fmt(ds)+'</small><span class="point">'+(work?'✓':PLANS[day]?'●':day===0||day===2?'⚔':check?'✓':'·')+'</span></div>';});h+='</div>';
h+=title('训练策略','持续12周渐进');
h+='<div class="card"><div class="row"><div><strong>当前第 '+p.week+' / 12 周</strong><div class="small muted">第 '+p.cycle+' 个训练周期</div></div><span class="chip">'+(p.week===4||p.week===8||p.week===12?'恢复评估':'渐进积累')+'</span></div><div style="margin:13px 0">'+bar(p.week/12*100)+'</div><div class="small muted">先加规范次数，再升工作重量；达标且RIR≥2才建议加重。第4、8、12周检查恢复和击剑表现。</div></div>';
h+='<div class="notice">后蹲80 kg为历史参考，当前应以动作稳定和耐受性为准。传统硬拉依康复建议暂缓。</div>';
return shell(h);
}
function exerciseOverview(x,i){const c=cfg(x),p=previous(x.id),hint=progression(x);
const last=p?p.sets.filter(s=>s.done).map(s=>(s.weight===''?'自重':s.weight+'kg')+'×'+s.reps).join('、'):'首次训练';
return '<div class="list-row"><div class="row"><div><strong><span class="badge-num">'+(i+1)+'</span>'+esc(x.name)+'</strong><small>'+c.sets+'组 · '+c.min+(c.min===c.max?'':'–'+c.max)+(c.timed?'秒/侧':'次')+' · '+(c.weight===null?'自重':c.weight+'kg')+'</small></div><button class="btn secondary small" data-act="edit" data-id="'+x.id+'">修改</button></div><div class="small muted" style="margin-top:7px">'+esc(hint?'上次达标，下次可尝试 '+hint+'kg':'上次：'+last)+'</div></div>';
}
function overview(){let h='<div class="overline">TRAINING PROGRAM</div><h1 class="heading">力量训练</h1><p class="subtitle">3次/周 · 不练到力竭 · 训练草稿自动保存</p>';
if(state.draft)h+='<div class="card row"><div><strong>有未完成训练</strong><div class="small muted">可以从上次位置继续</div></div><button class="btn small" data-act="resume">恢复</button></div>';
[[1,'周一','18:00–20:00'],[4,'周四','18:00–20:00'],[6,'周六','15:00–17:00']].forEach(a=>{
 h+='<div class="card"><div class="row"><div><div class="overline">'+a[1]+' · '+a[2]+'</div><h2 style="font-size:20px;margin:4px 0 8px">'+NAMES[a[0]]+'</h2></div><button class="btn small" data-act="start" data-day="'+a[0]+'">开始</button></div>'+PLANS[a[0]].map(exerciseOverview).join('')+'</div>';
});return shell(h);}
function draftMake(day){return {day,date:today(),started:Date.now(),notes:'',exercises:PLANS[day].map(x=>{const c=cfg(x),p=previous(x.id),prior=p?.sets.find(s=>s.done)?.weight;const w=prior!==undefined?prior:c.weight;return {id:x.id,sets:Array.from({length:c.sets},()=>({weight:w===null?'':w,reps:x.min,rir:2,done:false}))};})};}
function start(day){day=Number(day);if(!PLANS[day])return;if(state.draft && state.draft.day!==day){if(!confirm('目前还有其他训练草稿。确认覆盖旧草稿吗？'))return;state.draft=null;}if(!state.draft)state.draft=draftMake(day);save();live=true;tab='workouts';draw(true);}
function countDraft(){return state.draft?.exercises.reduce((n,x)=>n+x.sets.filter(s=>s.done).length,0)||0;}
function totalDraft(){return state.draft?.exercises.reduce((n,x)=>n+x.sets.length,0)||0;}
function liveView(){const D=state.draft;if(!D){live=false;return overview();}
let h='<div class="row"><div><div class="overline">LIVE WORKOUT</div><h1 class="heading">'+NAMES[D.day]+'</h1><div class="small muted">重量单位 kg · 哑铃填每手重量</div></div><button class="btn secondary small" data-act="close-live">收起</button></div>';
h+='<div class="live-top"><div class="row"><strong>今日完成 '+countDraft()+' / '+totalDraft()+' 组</strong><span class="chip">自动保存</span></div><div style="margin-top:11px">'+bar(countDraft()/Math.max(1,totalDraft())*100)+'</div></div>';
D.exercises.forEach((z,i)=>{const x=exById(z.id),c=cfg(x),hint=progression(x);
h+='<div class="card exercise-card"><div class="row"><div><div class="overline">动作 '+(i+1)+' / '+D.exercises.length+(x.warmup?' · 热身':'')+'</div><h3>'+esc(x.name)+'</h3></div><button class="btn secondary small" data-act="timer" data-s="'+c.rest+'">休息 '+Math.round(c.rest/60)+'分</button></div>';
h+='<p>'+esc(x.description)+'</p>';
if(hint)h+='<div class="row" style="margin:9px 0"><span class="chip">可尝试 '+hint+'kg</span><button class="btn small outline" data-act="suggest" data-id="'+x.id+'" data-w="'+hint+'">填入建议</button></div>';
h+='<div class="sethead"><span>组</span><span>重量 kg</span><span>'+(x.timed?'时长 秒':'次数')+'</span><span>RIR</span><span>完成</span></div>';
z.sets.forEach((s,j)=>{
h+='<div class="setrow '+(s.done?'done':'')+'"><span>'+(j+1)+'</span><input aria-label="'+esc(x.name)+'第'+(j+1)+'组重量" data-set="'+i+'" data-row="'+j+'" data-field="weight" type="number" min="0" step="0.5" inputmode="decimal" value="'+esc(s.weight)+'"><input aria-label="重复次数" data-set="'+i+'" data-row="'+j+'" data-field="reps" type="number" min="0" max="999" inputmode="numeric" value="'+esc(s.reps)+'"><input aria-label="RIR" data-set="'+i+'" data-row="'+j+'" data-field="rir" type="number" min="0" max="10" inputmode="numeric" value="'+esc(s.rir)+'"><button class="checkset '+(s.done?'done':'')+'" data-act="mark" data-set="'+i+'" data-row="'+j+'" aria-label="勾选完成">'+(s.done?'✓':'○')+'</button></div>';
});h+='</div>';});
h+='<div class="card"><strong>训练备注</strong><textarea class="textarea" id="notes" placeholder="今天的状态、动作控制、疲劳和击剑恢复情况……">'+esc(D.notes||'')+'</textarea></div>';
h+='<div class="action-bar"><button class="btn secondary" data-act="close-live">稍后继续</button><button class="btn" data-act="finish">完成并保存训练 ✓</button></div>';
return shell(h);
}
function updateDraft(el){if(!state.draft)return;const a=Number(el.dataset.set),b=Number(el.dataset.row),f=el.dataset.field,z=state.draft.exercises[a]?.sets[b];if(!z)return;z[f]=el.value;save();}
function mark(btn){const a=Number(btn.dataset.set),b=Number(btn.dataset.row);const z=state.draft?.exercises[a]?.sets[b];if(!z)return;const row=btn.closest('.setrow');row.querySelectorAll('input').forEach(updateDraft);if(!z.done && !(num(z.reps)>0)){toast('请先输入次数');return;}z.done=!z.done;save();btn.classList.toggle('done',z.done);row.classList.toggle('done',z.done);btn.textContent=z.done?'✓':'○';const head=screen.querySelector('.live-top strong');if(head)head.textContent='今日完成 '+countDraft()+' / '+totalDraft()+' 组';const prog=screen.querySelector('.live-top .progress i');if(prog)prog.style.width=(countDraft()/Math.max(1,totalDraft())*100)+'%';if(z.done){const x=exById(state.draft.exercises[a].id);startTimer(cfg(x).rest);if(navigator.vibrate)navigator.vibrate(35);}}
function finish(){if(!state.draft||!countDraft()){toast('还没有完成的训练组');return;}const d=state.draft;if(countDraft()<totalDraft()&&!confirm('还有未完成的组，仍然保存这次训练吗？'))return;const log={...d,completedAt:Date.now(),durationMin:Math.round((Date.now()-d.started)/60000)};state.logs.push(log);state.draft=null;save();live=false;tab='history';stopTimer();draw(true);toast('训练已保存，做得好！');}
function morningView(){const key=today(),rec=state.morning[key]||{checks:[],completed:false},set=new Set(rec.checks||[]);let h='<div class="overline">MORNING ROUTINE</div><h1 class="heading">早晨固定训练</h1><p class="subtitle">30分钟重剑技术＋30分钟核心稳定 · 无短弓步</p>';
if(weekday()===0)h+='<div class="notice">周日20:00–22:00重剑实战，早晨建议休息。也可以只做轻松活动。</div>';
h+='<div class="card"><div class="row"><strong>今日完成 '+set.size+' / '+ALL.length+' 项</strong><span class="chip '+(rec.completed?'':'grey')+'">'+(rec.completed?'已打卡':'进行中')+'</span></div><div style="margin-top:12px">'+bar(set.size/ALL.length*100)+'</div></div>';
[[FENCING,'剑术基本功','30分钟'],[CORE,'核心 · 后侧链 · 平衡','30分钟']].forEach(a=>{h+=title(a[1],a[2])+'<div class="card">';a[0].forEach(x=>{h+='<label class="routine '+(set.has(x[0])?'checked':'')+'"><input type="checkbox" data-task="'+x[0]+'" '+(set.has(x[0])?'checked':'')+'><span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></span></label>';});h+='</div>';});
h+='<button class="btn full" data-act="finishmorning">完成今日晨练打卡 ✓</button><p class="small muted">实际未完成的项目可以不勾选。滚盘的高负荷屈膝训练不需要每天做至力竭；平衡板旁须有可靠支撑。</p>';return shell(h);
}
function toggleTask(input){const key=today(),rec=state.morning[key]||{checks:[],completed:false},set=new Set(rec.checks||[]);input.checked?set.add(input.dataset.task):set.delete(input.dataset.task);rec.checks=[...set];if(!input.checked)rec.completed=false;state.morning[key]=rec;save();draw();}
function showHistoryDetails(index){const log=state.logs[index];if(!log)return;let h='<button class="btn secondary small" data-act="backhistory">← 返回记录</button><h1 class="heading">'+fmt(log.date)+' · '+NAMES[log.day]+'</h1><p class="subtitle">训练时长约 '+(log.durationMin||'?')+' 分钟</p>';log.exercises.forEach(z=>{const x=exById(z.id);h+='<div class="card"><strong>'+esc(x?.name||z.id)+'</strong>';z.sets.forEach((s,i)=>{if(s.done)h+='<div class="list-row small">第'+(i+1)+'组 · '+(s.weight===''?'自重':s.weight+' kg')+' × '+s.reps+' · RIR '+s.rir+'</div>';});h+='</div>';});if(log.notes)h+='<div class="card">'+esc(log.notes)+'</div>';return shell(h);}
function stats(){let h='<div class="overline">TRAINING ANALYTICS</div><h1 class="heading">进步与记录</h1><p class="subtitle">每次完成的组数，都会进入本地训练历史。</p>';
h+='<div class="grid2"><div class="metric"><small>力量训练记录</small><div class="value">'+state.logs.length+'</div><small>次</small></div><div class="metric"><small>晨练打卡</small><div class="value">'+Object.values(state.morning).filter(x=>x.completed).length+'</div><small>天</small></div></div>';
h+=title('力量进步趋势','最近6次');
[['bench','杠铃卧推'],['backsquat','杠铃后蹲'],['chestrow','胸托哑铃划船'],['dbrow','单臂哑铃划船']].forEach(a=>{const arr=state.logs.flatMap(l=>l.exercises.filter(z=>z.id===a[0]).map(z=>({date:l.date,max:Math.max(0,...z.sets.filter(s=>s.done).map(s=>num(s.weight)))}))).filter(z=>z.max>0).slice(-6);h+='<div class="card"><div class="row"><strong>'+a[1]+'</strong><span class="chip grey">'+(arr.length?arr[arr.length-1].max+' kg':'暂无数据')+'</span></div>';if(!arr.length)h+='<div class="empty">首次完成训练后显示趋势</div>';else{const top=Math.max(...arr.map(x=>x.max),1);h+='<div class="chart">'+arr.map(x=>'<div class="barcol"><b>'+x.max+'</b><i style="height:'+Math.max(5,x.max/top*86)+'%"></i><small>'+fmt(x.date)+'</small></div>').join('')+'</div>';}h+='</div>';});
const p=weekData();h+=title('12周训练周期','第'+p.week+'周')+'<div class="card">'+bar(p.week/12*100)+'<p class="small muted">第1–3周稳步提高次数；第4周检查恢复。第5–7周继续进步；第8周再评估。第9–11周巩固成绩；第12周阶段复盘。</p></div>';
h+=title('最近训练',state.logs.length+'次');h+='<div class="card">'+(state.logs.length?state.logs.map((l,i)=>({l,i})).reverse().slice(0,30).map(o=>'<button style="display:block;width:100%;text-align:left;color:var(--text);background:transparent;border:0" class="entry" data-act="detail" data-index="'+o.i+'"><div class="row"><strong>'+fmt(o.l.date)+' · '+NAMES[o.l.day]+'</strong><span class="small muted">查看 ›</span></div><div class="detail">完成 '+o.l.exercises.reduce((n,z)=>n+z.sets.filter(s=>s.done).length,0)+' 组 · '+(o.l.durationMin||'?')+' 分钟</div></button>').join(''):'<div class="empty">暂无训练数据。开始第一次力量训练吧。</div>')+'</div>';
h+='<button class="btn secondary full" data-act="settings">备份 / CSV / 修改训练计划</button>';return shell(h);
}
function settings(){return shell('<button class="btn secondary small" data-act="backhome">← 返回</button><div class="overline" style="margin-top:20px">PREFERENCES</div><h1 class="heading">设置与数据</h1><div class="card"><div class="settings-group"><strong>12周周期开始日期</strong><p>可设置为第一周周一的实际日期，首页与统计将按此计算。</p><input type="date" id="cycle-date" value="'+esc(state.startDate)+'"><button class="btn small secondary" data-act="setdate" style="margin-top:10px">保存日期</button></div><div class="settings-group"><strong>完整训练数据备份</strong><p>训练记录保存在本机。建议每月备份一次。卸载 App 或清除数据会使本机记录丢失。</p><div class="stagger"><button class="btn small" data-act="json">导出 JSON</button><button class="btn small secondary" data-act="csv">导出 CSV</button><button class="btn small outline" data-act="import">导入 JSON</button></div><input type="file" id="backup-input" accept=".json,application/json" class="hidden"></div><div class="settings-group"><strong>编辑训练组数和重量</strong><p>到「力量」页，每个动作旁都有「修改」；训练进行时还可更改每组实际重量、次数及 RIR。</p></div><div class="settings-group"><strong>安全与设备</strong><p>传统硬拉继续暂缓。后蹲历史工作重量不是强制训练要求。使用万向轮和平衡板时必须确保产品承重及稳定性，出现疼痛或明显动作失控应暂停。</p></div><div class="settings-group"><strong>版本</strong><p>剑体训练 2.0 · 离线，无账号或广告。数据仅存储在本机。</p></div></div>');}
function render(){nav();screen.innerHTML=tab==='home'?home():tab==='workouts'?(live?liveView():overview()):tab==='morning'?morningView():tab==='history'?stats():settings();}
function draw(top=false){render();if(top)window.scrollTo(0,0);}
function edit(id){const x=exById(id);if(!x)return;const c=cfg(x);const w=prompt('设置 '+x.name+' 的起始重量（kg，单手哑铃填单手；引体填0）',String(c.weight??0));if(w===null)return;if(!Number.isFinite(Number(w))||Number(w)<0){toast('重量不合法');return;}const sets=prompt('训练组数（1～8）',String(c.sets));if(sets===null)return;if(!Number.isInteger(Number(sets))||Number(sets)<1||Number(sets)>8){toast('组数应在1至8之间');return;}state.overrides[id]={weight:x.weight===null?null:Number(w),sets:Number(sets)};save();draw();toast('动作设置已更新');}
function exportFile(filename,content,mime){if(window.AndroidStorage?.saveBackup){window.AndroidStorage.saveBackup(content,filename);toast('请选择文件保存位置');return;}const blob=new Blob([content],{type:mime}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function csvEscape(x){return '"'+String(x??'').replace(/"/g,'""')+'"';}
function exportCSV(){const rows=[['日期','训练日','动作','组序号','重量kg','次数或秒数','剩余次数RIR','备注']];state.logs.forEach(l=>l.exercises.forEach(z=>z.sets.forEach((s,i)=>{if(s.done)rows.push([l.date,DAYS[l.day],exById(z.id)?.name||z.id,i+1,s.weight,s.reps,s.rir,l.notes||'']);})));exportFile('剑体训练记录_'+today()+'.csv','\uFEFF'+rows.map(r=>r.map(csvEscape).join(',')).join('\r\n'),'text/csv;charset=utf-8');}
function importBackup(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const val=JSON.parse(reader.result);if(!val||!Array.isArray(val.logs)||!val.morning||typeof val.morning!=='object')throw Error('格式错误');if(!confirm('导入备份将覆盖当前数据，确定继续？'))return;state={...BASE,...val};save();live=false;tab='home';draw(true);toast('备份恢复成功');}catch(e){toast('备份导入失败：'+e.message);}};reader.readAsText(file);}
function startTimer(n){timerEnd=Date.now()+Math.max(1,num(n))*1000;const existing=document.querySelector('#resttimer');if(!existing){const div=document.createElement('div');div.id='resttimer';div.className='timer';document.body.appendChild(div);}tickTimer();}
function stopTimer(){timerEnd=0;document.querySelector('#resttimer')?.remove();}
function tickTimer(){const div=document.querySelector('#resttimer');if(!div)return;let left=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));div.innerHTML='<span class="small">休息</span><b>'+String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0')+'</b><button data-act="stop">×</button>';if(left===0){stopTimer();toast('休息结束，准备下一组');if(navigator.vibrate)navigator.vibrate([100,80,100]);}}
document.addEventListener('click',e=>{
const n=e.target.closest('[data-tab]');if(n){tab=n.dataset.tab;live=false;draw(true);return;}
const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
if(a==='start')start(b.dataset.day);
else if(a==='resume'){if(state.draft){tab='workouts';live=true;draw(true);}}
else if(a==='close-live'){live=false;draw(true);}
else if(a==='mark')mark(b);
else if(a==='finish')finish();
else if(a==='suggest'){if(state.draft){const z=state.draft.exercises.find(x=>x.id===b.dataset.id);if(z){z.sets.forEach(s=>{if(!s.done)s.weight=num(b.dataset.w);});save();draw();toast('已填入建议重量');}}}
else if(a==='morning'){tab='morning';draw(true);}
else if(a==='finishmorning'){const dt=today(),v=state.morning[dt]||{checks:[]};v.completed=true;state.morning[dt]=v;save();draw();toast('今日晨练打卡完成');}
else if(a==='edit')edit(b.dataset.id);
else if(a==='timer')startTimer(b.dataset.s);
else if(a==='stop')stopTimer();
else if(a==='settings'){tab='settings';draw(true);}
else if(a==='backhome'){tab='home';draw(true);}
else if(a==='backhistory'){tab='history';draw(true);}
else if(a==='detail'){screen.innerHTML=showHistoryDetails(Number(b.dataset.index));window.scrollTo(0,0);}
else if(a==='setdate'){const v=document.querySelector('#cycle-date')?.value;if(v){state.startDate=v;save();draw();toast('周期开始日期已更新');}}
else if(a==='json')exportFile('剑体训练完整备份_'+today()+'.json',JSON.stringify(state,null,2),'application/json');
else if(a==='csv')exportCSV();
else if(a==='import')document.querySelector('#backup-input')?.click();
});
document.addEventListener('change',e=>{if(e.target.matches('[data-task]'))toggleTask(e.target);if(e.target.matches('[data-set]'))updateDraft(e.target);if(e.target.id==='backup-input')importBackup(e.target.files[0]);});
document.addEventListener('input',e=>{if(e.target.matches('[data-set]'))updateDraft(e.target);if(e.target.id==='notes'&&state.draft){state.draft.notes=e.target.value;save();}});
document.querySelector('#settings-button').addEventListener('click',()=>{tab='settings';live=false;draw(true);});
setInterval(tickTimer,400);
draw();
