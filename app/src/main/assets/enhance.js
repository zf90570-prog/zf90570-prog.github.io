
'use strict';
// JianTi 3.0 enhancement layer, loaded after the compatible v2 foundation.
const FINAL_VERSION="3.0";
const extraDefaults={metrics:[],fencing:[],swimming:[],historyArchive:[],timerEnd:0};
for(const k of Object.keys(extraDefaults))if(state[k]===undefined)state[k]=extraDefaults[k];
state.logs.forEach((x,i)=>{if(!x.uid)x.uid="legacy-"+i+"-"+(x.completedAt||x.date)});
const oldSave=save;
save=function(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){alert("本机存储失败，请先备份："+e.message)}};
const oldNum=num;
weekGym=function(){let m=monday();return new Set(state.logs.filter(x=>x.date>=m&&x.date<=advance(m,6)).map(x=>x.day).filter(x=>PLANS[x])).size};
progression=function(ex){
 const prev=previous(ex.id),c=cfg(ex);
 if(!prev||!ex.step||ex.warmup||prev.sets.length<c.sets)return null;
 const sets=prev.sets.slice(0,c.sets);
 if(!sets.every(s=>s.done&&num(s.reps)>=ex.max&&s.rirConfirmed===true&&s.rir!==""&&num(s.rir)>=2&&num(s.weight)===num(sets[0].weight)))return null;
 return +((num(sets[0].weight)+ex.step).toFixed(2));
};
draftMake=function(day){
 return {day,date:today(),started:Date.now(),notes:"",readiness:3,exercises:PLANS[day].map(x=>{
 const c=cfg(x),prev=previous(x.id),prior=prev?.sets.find(s=>s.done)?.weight;
 const w=prior!==undefined?prior:c.weight;
 return {id:x.id,sets:Array.from({length:c.sets},()=>({weight:w==null?"":w,reps:x.min,rir:"",rirConfirmed:false,done:false}))};
 })};
};
updateDraft=function(el){
 if(!state.draft)return;
 const s=state.draft.exercises[+el.dataset.set]?.sets[+el.dataset.row];
 if(!s)return;s[el.dataset.field]=el.value;
 if(el.dataset.field==="rir")s.rirConfirmed=el.value!==""&&Number.isFinite(Number(el.value));
 save();
};
mark=function(button){
 const i=+button.dataset.set,j=+button.dataset.row,s=state.draft?.exercises[i]?.sets[j];
 if(!s)return;
 const line=button.closest(".setrow");line.querySelectorAll("input").forEach(updateDraft);
 if(!s.done&&(!(num(s.reps)>0)||num(s.reps)>999||s.weight!==""&&(!Number.isFinite(Number(s.weight))||num(s.weight)<0||num(s.weight)>500)||s.rir!==""&&(!Number.isFinite(Number(s.rir))||num(s.rir)<0||num(s.rir)>10))){toast("请检查重量、次数及RIR（可不填）");return}
 s.done=!s.done;save();button.textContent=s.done?"✓":"○";button.classList.toggle("done",s.done);line.classList.toggle("done",s.done);
 const heading=screen.querySelector(".live-top strong");
 if(heading)heading.textContent="已完成 "+countDraft()+" / "+totalDraft()+" 组";
 const bar=screen.querySelector(".live-top .progress i");if(bar)bar.style.width=(countDraft()/Math.max(1,totalDraft())*100)+"%";
 if(s.done){startTimer(cfg(exById(state.draft.exercises[i].id)).rest);if(navigator.vibrate)navigator.vibrate(35)}
};
const originalStartTimer=startTimer;
startTimer=function(seconds){originalStartTimer(seconds);state.timerEnd=timerEnd;save()};
const originalStopTimer=stopTimer;
stopTimer=function(){originalStopTimer();state.timerEnd=0;save()};
const originalTickTimer=tickTimer;
tickTimer=function(){
 const hasTimer=timerEnd>0,expired=hasTimer&&Date.now()>=timerEnd;
 originalTickTimer();
 if(expired&&window.AndroidStorage?.restFinished)window.AndroidStorage.restFinished();
};
if(state.timerEnd>Date.now()){timerEnd=state.timerEnd;setTimeout(()=>{let t=document.querySelector("#resttimer");if(!t){t=document.createElement("div");t.id="resttimer";t.className="timer";document.body.appendChild(t)}tickTimer()},50)}
finish=function(){
 if(!state.draft||!countDraft()){toast("还没有完成的组");return}
 if(countDraft()<totalDraft()&&!confirm("还有未完成的组，仍然保存本次训练吗？"))return;
 const d=state.draft;
 const item={...d,uid:"session-"+Date.now()+"-"+Math.floor(Math.random()*100000),completedAt:Date.now(),durationMin:Math.max(1,Math.round((Date.now()-d.started)/60000))};
 state.logs.push(item);state.draft=null;save();live=false;tab="history";stopTimer();draw(true);toast("训练已保存！");
};
function monthChart(rows,label){
 if(!rows.length)return '<div class="empty">暂无数据</div>';
 const max=Math.max(1,...rows.map(x=>x.y));
 return '<div class="chart">'+rows.slice(-8).map(x=>'<div class="barcol"><b>'+Number(x.y).toFixed(x.y%1?1:0)+'</b><i style="height:'+Math.max(5,x.y/max*85)+'%"></i><small>'+esc(x.date.slice(5))+'</small></div>').join("")+'</div><p class="tiny muted">'+esc(label)+'</p>';
}
function trainingVol(log){return log.exercises.reduce((n,e)=>n+e.sets.reduce((t,s)=>t+(s.done&&!exById(e.id)?.warmup&&!exById(e.id)?.timed&&s.weight!==""?num(s.weight)*num(s.reps):0),0),0)}
function lastWeight(id){let r=previous(id);return r?r.sets.filter(s=>s.done).map(s=>(s.weight===""?"自重":s.weight+"kg")+"×"+s.reps).join(" / "):"首次记录"}
function keyCue(id){return ({bench:"肩胛保持稳定，下降受控；动作失稳则停止加重。",frontsquat:"轻重量辅助，动作控制优先，不影响周二重剑。",chestrow:"胸部始终贴靠上斜凳，不借腰背甩动。",pullmon:"须使用可靠的固定引体杆；没有器械时用胸托划船替代。",lateralmon:"肘微屈、避免身体摆动。",speedsquat:"属热身组，下降受控，上升意图快速。",backsquat:"维持腹压与骨盆控制，80kg是历史参考，不是硬性起始重量。",glutebridge:"臀部发力，不使用过度腰椎伸展。",bulgarian:"脚掌稳定，下降缓慢，先自重再加重。",pullsat:"周日重剑前不把握力练到力竭。",dbrow:"躯干稳定、用背部完成划船。",incline:"上斜角度适中，手腕稳定。",lateralsat:"动作质量优先，不做甩动。",rear:"上斜凳胸部支撑，轻重量控制。",suitcase:"肩与骨盆保持水平，单侧负重不要侧倾。"})[id]||"姿势稳定优先。疼痛时暂停。"}
liveView=function(){
 if(!state.draft)return overview();
 const d=state.draft;
 let html='<div class="row"><div><div class="overline">LIVE SESSION</div><h1 class="heading">'+esc(NAMES[d.day])+'</h1><p class="small muted">逐组记录 · 草稿实时保存 · RIR可留空</p></div><button class="btn small secondary" data-act="close-live">收起</button></div>';
 html+='<div class="live-top"><div class="row"><strong>已完成 '+countDraft()+' / '+totalDraft()+' 组</strong><span class="chip">自动保存</span></div><div style="margin-top:12px">'+bar(countDraft()/Math.max(1,totalDraft())*100)+'</div></div>';
 html+='<div class="card"><strong>今天的恢复状态</strong><div class="stagger" style="margin-top:10px">'+[1,2,3,4,5].map(x=>'<button class="btn small '+(d.readiness===x?'':'secondary')+'" data-final="ready" data-val="'+x+'">'+x+'</button>').join("")+'</div><p class="small muted">1疲惫—5很好；评分低时建议不强求加重。</p></div>';
 d.exercises.forEach((entry,i)=>{
 const ex=exById(entry.id),c=cfg(ex),hint=progression(ex);
 html+='<div class="card exercise-card"><div class="row"><div><div class="overline">动作 '+(i+1)+' / '+d.exercises.length+(ex.warmup?" · 热身":"")+'</div><h3>'+esc(ex.name)+'</h3></div><button class="btn small secondary" data-act="timer" data-s="'+c.rest+'">休息计时</button></div>';
 html+='<p>'+esc(ex.description)+'</p><details class="technique"><summary>动作要领与替代建议</summary><p>'+esc(keyCue(ex.id))+'</p></details><p class="small muted">上次：'+esc(lastWeight(ex.id))+'</p>';
 if(hint)html+='<div class="row"><span class="chip">可考虑'+hint+'kg</span><button class="btn small outline" data-act="suggest" data-id="'+ex.id+'" data-w="'+hint+'">填入</button></div>';
 html+='<div class="sethead"><span>组</span><span>重量 kg</span><span>'+(ex.timed?"秒数":"次数")+'</span><span>RIR</span><span>完成</span></div>';
 entry.sets.forEach((s,j)=>html+='<div class="setrow '+(s.done?"done":"")+'"><span>'+(j+1)+'</span><input data-set="'+i+'" data-row="'+j+'" data-field="weight" type="number" min="0" max="500" step="0.5" inputmode="decimal" value="'+esc(s.weight)+'"><input data-set="'+i+'" data-row="'+j+'" data-field="reps" type="number" min="0" max="999" inputmode="numeric" value="'+esc(s.reps)+'"><input data-set="'+i+'" data-row="'+j+'" data-field="rir" type="number" min="0" max="10" placeholder="—" inputmode="numeric" value="'+esc(s.rir??"")+'"><button class="checkset '+(s.done?"done":"")+'" data-act="mark" data-set="'+i+'" data-row="'+j+'">'+(s.done?"✓":"○")+'</button></div>');
 html+='</div>'});
 html+='<div class="card"><strong>训练日期</strong><p class="small muted">补记旧训练时可修改</p><input type="date" id="session-date" value="'+esc(d.date)+'"><p><strong>本次训练备注</strong></p><textarea class="textarea" id="notes" placeholder="动作状态、疲劳与恢复情况……">'+esc(d.notes||"")+'</textarea></div><div class="action-bar"><button class="btn secondary" data-act="close-live">稍后继续</button><button class="btn" data-act="finish">保存训练 ✓</button></div>';
 return '<div class="screen">'+html+'</div>';
};
morningView=function(){
 const dt=today(),r=state.morning[dt]||{checks:[],completed:false},checked=new Set(r.checks||[]);
 let h='<div class="overline">MORNING TECHNIQUE & CORE</div><h1 class="heading">每天的60分钟</h1><p class="subtitle">30分钟持剑与步伐 + 30分钟核心后侧链</p><div class="card"><div class="row"><strong>今日完成 '+checked.size+' / '+ALL.length+' 项</strong><span class="chip">'+(r.completed?"已打卡":"进行中")+'</span></div><div style="margin-top:12px">'+bar(checked.size/ALL.length*100)+'</div></div>';
 if(weekday()===1||weekday()===3)h+='<div class="notice">昨晚实战结束较晚：睡眠优先，可以缩短晨练或取消9点游泳。</div>';
 if(weekday()===4)h+='<div class="notice">周四晚上练后蹲，晨间腘绳肌保持轻量，不追求力竭。</div>';
 if(weekday()===0)h+='<div class="notice">周日晚间20–22点重剑实战，早晨建议休息。</div>';
 [[FENCING,"持剑技术 · 30分钟"],[CORE,"后侧链与核心 · 30分钟"]].forEach(([arr,label])=>{
 h+=title(label)+'<div class="card">'+arr.map(x=>'<label class="routine '+(checked.has(x[0])?"checked":"")+'"><input type="checkbox" data-task="'+x[0]+'" '+(checked.has(x[0])?"checked":"")+'><span><strong>'+esc(x[1])+'</strong><small>'+esc(x[2])+'</small></span></label>').join("")+'</div>'});
 h+='<button class="btn full" data-act="finishmorning">完成今日实际训练 ✓</button><p class="small muted">万向盘需确认承重及防滑，平衡板旁应有稳定支撑；没有必要每天高负荷练腿弯举。</p>';
 return '<div class="screen">'+h+'</div>';
};
function sumSets(log){return log.exercises.reduce((n,x)=>n+x.sets.filter(z=>z.done).length,0)}
function showHistoryV3(idx){
 const z=state.logs[idx];if(!z)return '<div class="screen">记录不存在</div>';
 let h='<div class="screen"><button class="btn secondary small" data-act="backhistory">← 返回</button><h1 class="heading">'+esc(fmt(z.date))+' · '+esc(NAMES[z.day]||"训练")+'</h1><p class="subtitle">已完成'+sumSets(z)+'组 · 自评'+(z.readiness||"未记录")+'/5</p>';
 z.exercises.forEach(ex=>{h+='<div class="card"><strong>'+esc(exById(ex.id)?.name||ex.id)+'</strong>'+ex.sets.filter(s=>s.done).map(s=>'<div class="list-row small">'+(s.weight===""?"自重":s.weight+"kg")+' × '+s.reps+' · RIR '+(s.rirConfirmed===true?s.rir:"未确认")+'</div>').join("")+'</div>'});
 h+='<div class="card"><strong>训练备注</strong><textarea class="textarea" id="history-note">'+esc(z.notes||"")+'</textarea><button class="btn small" data-final="save-note" data-index="'+idx+'">保存修改</button></div></div>';return h;
}
showHistoryDetails=showHistoryV3;
function statsRows(id){
 return state.logs.flatMap(l=>l.exercises.filter(x=>x.id===id).map(x=>({date:l.date,y:Math.max(0,...x.sets.filter(s=>s.done).map(s=>num(s.weight)))}))).filter(x=>x.y>0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-8)
}
stats=function(){
 const total=state.logs.length,sets=state.logs.reduce((n,l)=>n+sumSets(l),0);
 let h='<div class="overline">PROGRESS TRACKING</div><h1 class="heading">训练记录与统计</h1><p class="subtitle">估算数据仅供比较趋势，不替代实际力量测试。</p><div class="grid2"><div class="metric"><small>力量训练</small><div class="value">'+total+'</div><small>次</small></div><div class="metric"><small>完成组数</small><div class="value">'+sets+'</div><small>组</small></div></div>';
 h+=title("主要力量动作趋势","近8次");
 [["bench","卧推"],["backsquat","后蹲"],["chestrow","胸托划船"],["dbrow","单臂划船"]].forEach(([id,label])=>h+='<div class="card"><strong>'+label+'</strong>'+monthChart(statsRows(id),"最高工作组重量kg")+'</div>');
 const w=weekData();h+=title("12周进度","周期 "+w.cycle)+'<div class="card"><strong>第'+w.week+' / 12周</strong><div style="margin:10px 0">'+bar(w.week/12*100)+'</div><p class="small muted">第4、8、12周检查疲劳与表现；必要时减量，非自动强制降重量。</p></div>';
 h+=title("综合追踪")+'<div class="grid2"><button class="btn secondary" data-final="metrics">体重 / 腰围</button><button class="btn secondary" data-final="sports">重剑 / 游泳</button></div>';
 h+=title("近期训练",total+"次")+'<div class="card">'+(total?state.logs.map((x,i)=>({x,i})).reverse().slice(0,50).map(o=>'<div class="entry row"><button class="history-link" data-act="detail" data-index="'+o.i+'"><strong>'+fmt(o.x.date)+' · '+esc(NAMES[o.x.day]||"力量训练")+'</strong><div class="detail">完成'+sumSets(o.x)+'组 · '+Math.round(trainingVol(o.x))+'kg×次</div></button><button class="icon-button" data-final="delete" data-index="'+o.i+'">×</button></div>').join(""):'<div class="empty">暂无训练数据</div>')+'</div>';
 h+='<button class="btn secondary full" data-act="settings">备份、导出与其他设置</button>';
 return '<div class="screen">'+h+'</div>';
};
function metricsView(){
 let h='<button class="btn secondary small" data-final="back">← 返回统计</button><h1 class="heading">身体测量</h1><p class="subtitle">体重、腰围、体脂趋势</p><div class="card"><div class="measure-grid"><label>日期<input type="date" id="measure-date" value="'+today()+'"></label><label>体重 kg<input type="number" id="measure-weight" step="0.1" placeholder="如 80.0"></label><label>腰围 cm<input type="number" id="measure-waist" step="0.1" placeholder="可留空"></label><label>体脂 %<input type="number" id="measure-fat" step="0.1" placeholder="可留空"></label></div><button class="btn full" data-final="save-metric">保存测量</button></div>';
 h+=title("历史测量",state.metrics.length+"条")+'<div class="card">'+(state.metrics.length?state.metrics.slice().reverse().map(x=>'<div class="entry"><strong>'+fmt(x.date)+' · '+x.weight+'kg</strong><div class="detail">腰围：'+(x.waist||"—")+'cm · 体脂：'+(x.fat||"—")+'%</div></div>').join(""):'<div class="empty">暂无数据</div>')+'</div>';
 return '<div class="screen">'+h+'</div>';
}
function sportsView(){
 const all=[...state.fencing.map(x=>({...x,label:"重剑"})),...state.swimming.map(x=>({...x,label:"游泳"}))].sort((a,b)=>b.date.localeCompare(a.date));
 let h='<button class="btn secondary small" data-final="back">← 返回统计</button><h1 class="heading">重剑与游泳</h1><p class="subtitle">追踪跨项目运动负荷</p><div class="card"><div class="measure-grid"><label>日期<input type="date" id="sport-date" value="'+today()+'"></label><label>项目<select id="sport-kind"><option value="fencing">重剑</option><option value="swimming">游泳</option></select></label><label>时长 分钟<input type="number" id="sport-min" min="1" max="300" value="45"></label><label>强度 1–10<input type="number" id="sport-rpe" min="1" max="10" value="4"></label></div><textarea class="textarea" id="sport-note" placeholder="技术重点、疲劳状况、实战复盘"></textarea><button class="btn full" data-final="save-sport">保存本次运动</button></div>';
 h+=title("运动历史",all.length+"次")+'<div class="card">'+(all.length?all.map(x=>'<div class="entry"><strong>'+fmt(x.date)+' · '+x.label+' · '+x.minutes+'分钟</strong><div class="detail">主观强度'+x.rpe+'/10'+(x.notes?" · "+esc(x.notes):"")+'</div></div>').join(""):'<div class="empty">暂无数据</div>')+'</div>';return '<div class="screen">'+h+'</div>';
}
settings=function(){
 return '<div class="screen"><div class="overline">YOUR DATA</div><h1 class="heading">设置与数据</h1><p class="subtitle">离线优先 · 数据存于本机</p><div class="card"><div class="settings-group"><strong>12周周期开始日期</strong><p>选择周期第一周的周一。</p><input type="date" id="cycle-date" value="'+esc(state.startDate)+'"><button class="btn small" data-act="setdate">保存</button></div><div class="settings-group"><strong>完整JSON备份与恢复</strong><p>包含力量、晨练、体重、重剑游泳及未完成草稿。可导入v2 JSON备份。卸载前务必先导出。</p><div class="stagger"><button class="btn small" data-act="json">导出完整备份</button><button class="btn small secondary" data-act="csv">力量CSV</button><button class="btn small secondary" data-final="csv-sport">其他运动CSV</button><button class="btn small outline" data-act="import">恢复JSON</button></div><input type="file" id="backup-input" accept=".json,application/json" class="hidden"></div><div class="settings-group"><strong>旧版本迁移</strong><p>正式版与v2.0并存。请在旧版导出JSON，在这里恢复。应用间的数据不会自动复制。</p></div><div class="settings-group"><strong>安全提示</strong><p>传统硬拉在康复允许前继续暂缓。严格动作标准优先于增加重量。晨练器械请先核实产品承重与安全性。</p></div><div class="settings-group"><strong>关于</strong><p>剑体训练 正式版 v3.0 · 私人离线运动记录系统。</p></div></div></div>';
};
home=function(){
 const day=weekday(),isWorkout=!!PLANS[day],w=weekData(),m=monday(),weekWork=state.logs.filter(l=>l.date>=m&&l.date<=advance(m,6));
 let h='<div class="overline">ATHLETIC PERFORMANCE</div><h1 class="heading">练得精确，进步可见。</h1><p class="subtitle">'+fmt(today())+' · '+DAYS[day]+' · 周期'+w.cycle+' / 第'+w.week+'周</p>';
 h+='<div class="hero"><span class="chip">'+(isWorkout?"力量训练":"恢复与技术")+'</span><h2>'+(NAMES[day]||([0,2].includes(day)?"重剑实战":"技术与身体控制"))+'</h2><p>'+(isWorkout?(day===6?"15:00":"18:00")+"健身房预约":"周二/日20:00重剑实战 · 晨练睡眠优先")+'</p><button class="btn" data-act="'+(isWorkout?"start":"morning")+'" '+(isWorkout?'data-day="'+day+'"':"")+'>'+(isWorkout?"开始训练":"进入晨练")+" →</button></div>";
 if(state.draft)h+='<div class="card row"><strong>未完成训练：'+countDraft()+'/'+totalDraft()+'组</strong><button class="btn small" data-act="resume">继续</button></div>';
 h+='<div class="grid2"><div class="metric"><small>本周力量课表</small><div class="value">'+weekGym()+'/3</div>'+bar(weekGym()/3*100)+'</div><div class="metric"><small>本周晨练</small><div class="value">'+weekMorning()+'/6</div>'+bar(weekMorning()/6*100)+'</div></div>';
 h+=title("12周力量进度")+"<div class=\"card\"><div class=\"row\"><strong>第"+w.week+" / 12 周</strong><span class=\"chip\">"+(w.week%4===0?"评估周":"渐进周")+"</span></div><div style=\"margin:12px 0\">"+bar(w.week/12*100)+'</div><p class="small muted">达到规定次数、主动确认RIR且动作稳定，才会给出下一次加重建议。</p></div>';
 h+=title("一周固定时间")+"<div class=\"card\"><p class=\"small muted\">周一18:00上肢 · 周四18:00下肢 · 周六15:00肩背胸</p><p class=\"small muted\">周二、日20:00–22:00重剑实战 · 通常9:00游泳 · 其余时间按课程和净办公约40小时协调。</p></div>";
 h+='<div class="notice">恢复优先于打卡。周日实战后、周二实战后可调整次日晨练时间。后蹲80kg为历史重量，不是强制起始重量。</div>';
 return '<div class="screen">'+h+'</div>';
};
const originalEdit=edit;
edit=function(id){
 const ex=exById(id);if(!ex)return;
 const cfg0=cfg(ex),newWeight=prompt("工作重量kg（单手哑铃填每手，正手引体填0）",String(cfg0.weight??0));
 if(newWeight===null)return;
 if(!Number.isFinite(+newWeight)||+newWeight<0||+newWeight>500){toast("重量应在0到500kg之间");return}
 const newSets=prompt("组数，1到8组",String(cfg0.sets));
 if(newSets===null)return;
 if(!Number.isInteger(+newSets)||+newSets<1||+newSets>8){toast("组数应为1–8");return}
 const newRest=prompt("组间休息秒数，30到600秒",String(cfg0.rest));
 if(newRest===null)return;
 if(!Number.isInteger(+newRest)||+newRest<30||+newRest>600){toast("休息时间应为30–600秒");return}
 state.overrides[id]={weight:ex.weight===null?null:+newWeight,sets:+newSets,rest:+newRest};save();draw();toast("动作设置已保存");
};
const originalImport=importBackup;
importBackup=function(file){
 if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   let z=JSON.parse(reader.result);
   if(!z||!Array.isArray(z.logs)||!z.morning||typeof z.morning!=="object")throw Error("备份格式无效");
   if(z.logs.length>100000)throw Error("记录数量超出限制");
   if(!confirm("备份内有"+z.logs.length+"条力量训练，本机有"+state.logs.length+"条。恢复将覆盖本机记录，请确认当前数据已备份。继续？"))return;
   state={...BASE,...z,...extraDefaults,metrics:Array.isArray(z.metrics)?z.metrics:[],fencing:Array.isArray(z.fencing)?z.fencing:[],swimming:Array.isArray(z.swimming)?z.swimming:[],historyArchive:Array.isArray(z.historyArchive)?z.historyArchive:[]};
   state.logs.forEach((x,i)=>{if(!x.uid)x.uid="import-"+i+"-"+(x.completedAt||x.date)});
   live=false;tab="home";state.timerEnd=0;timerEnd=0;save();draw(true);toast("备份恢复成功");
  }catch(err){toast("恢复失败："+err.message)}
 };
 reader.readAsText(file);
};
function extraCSV(){
 const rows=[["项目","日期","分钟","强度","备注"]];
 state.fencing.forEach(x=>rows.push(["重剑",x.date,x.minutes,x.rpe,x.notes||""]));
 state.swimming.forEach(x=>rows.push(["游泳",x.date,x.minutes,x.rpe,x.notes||""]));
 exportFile("剑体训练_其他运动_"+today()+".csv","\uFEFF"+rows.map(x=>x.map(csvEscape).join(",")).join("\r\n"),"text/csv;charset=utf-8");
}
document.addEventListener("click",event=>{
 const b=event.target.closest("[data-final]");
 if(!b)return;event.stopImmediatePropagation();event.preventDefault();
 const a=b.dataset.final;
 if(a==="ready"&&state.draft){state.draft.readiness=+b.dataset.val;save();draw()}
 else if(a==="metrics"){tab="history";screen.innerHTML=metricsView();scrollTo(0,0)}
 else if(a==="sports"){tab="history";screen.innerHTML=sportsView();scrollTo(0,0)}
 else if(a==="back"){tab="history";draw(true)}
 else if(a==="save-note"){const x=state.logs[+b.dataset.index];if(x){x.notes=document.querySelector("#history-note").value;save();toast("备注已更新")}}
 else if(a==="delete"){
  const x=state.logs[+b.dataset.index];if(x&&confirm("确认删除"+x.date+"的训练记录？建议先做备份。")){state.historyArchive.push({...x,deletedAt:Date.now()});state.logs.splice(+b.dataset.index,1);save();draw();toast("记录已删除，保留归档备份")}
 }
 else if(a==="save-metric"){
  const dt=document.querySelector("#measure-date").value,w=Number(document.querySelector("#measure-weight").value),wa=document.querySelector("#measure-waist").value,fa=document.querySelector("#measure-fat").value;
  if(!dt||!(w>=30&&w<=250)||wa!==""&&!(+wa>=35&&+wa<=200)||fa!==""&&!(+fa>=2&&+fa<=65)){toast("请核对日期、体重和围度");return}
  state.metrics.push({date:dt,weight:w,waist:wa===""?"":+wa,fat:fa===""?"":+fa});
  state.metrics.sort((a,b)=>a.date.localeCompare(b.date));save();screen.innerHTML=metricsView();toast("测量记录已保存");
 }
 else if(a==="save-sport"){
  const dt=document.querySelector("#sport-date").value,kind=document.querySelector("#sport-kind").value,n=+document.querySelector("#sport-min").value,r=+document.querySelector("#sport-rpe").value,note=document.querySelector("#sport-note").value;
  if(!dt||!Number.isInteger(n)||n<1||n>300||r<1||r>10){toast("请检查时长和强度");return}
  state[kind].push({date:dt,minutes:n,rpe:r,notes:note});save();screen.innerHTML=sportsView();toast("运动已记录");
 }
 else if(a==="csv-sport")extraCSV();
},true);
document.addEventListener("change",event=>{if(event.target.id==="session-date"&&state.draft){state.draft.date=event.target.value;save()}},true);
const oldClickFinish=undefined;
// Prevent empty morning checkins; legacy v2's finish action is intercepted first.
document.addEventListener("click",event=>{
 const b=event.target.closest("[data-act=finishmorning]");
 if(!b)return;
 const record=state.morning[today()]||{};
 if(!Array.isArray(record.checks)||!record.checks.length){event.stopImmediatePropagation();event.preventDefault();toast("请先勾选至少一项真实完成的练习")}
},true);
draw();
