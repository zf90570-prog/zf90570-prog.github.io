'use strict';
// JianTi 3.1 durability and usability. Loaded after the 3.0 compatibility layer.
const RELEASE='3.1.0';
let persistedTimer=null, openLogEditor=null, pendingNative=null, lastSavedFingerprint='';
function safeState(s){
 return !!(s && typeof s==='object' && !Array.isArray(s) && Array.isArray(s.logs) && s.logs.length<=50000 &&
 s.morning && typeof s.morning==='object' && !Array.isArray(s.morning) && s.logs.every(l=>l && /^\d{4}-\d\d-\d\d$/.test(String(l.date)) &&
 Array.isArray(l.exercises) && l.exercises.length<100 && l.exercises.every(e=>Array.isArray(e.sets)&&e.sets.length<=30)) &&
 (!s.metrics||Array.isArray(s.metrics))&&(!s.fencing||Array.isArray(s.fencing))&&(!s.swimming||Array.isArray(s.swimming)));
}
function safeCopy(obj){return JSON.parse(JSON.stringify(obj));}
function syncNative(){
 pendingNative=null;
 try {const json=JSON.stringify(state);lastSavedFingerprint=json;
   if(window.AndroidStorage?.persistSnapshot && !window.AndroidStorage.persistSnapshot(json))toast('本机数据库写入失败，请导出备份');
 }catch(err){toast('数据快照失败：'+err.message);}
}
function recoverNative(){
 try{
  if(!window.AndroidStorage?.getSnapshots)return;
  const snapshots=JSON.parse(window.AndroidStorage.getSnapshots());
  const valid=snapshots.map(x=>{try{return JSON.parse(x);}catch(e){return null;}}).filter(safeState);
  valid.sort((a,b)=>num(b.savedAt)-num(a.savedAt));
  // The SQLite copy is preferred only when its timestamp is demonstrably newer.
  if(valid.length && (!safeState(state)||num(valid[0].savedAt)>num(state.savedAt)+1))state={...BASE,...extraDefaults,...valid[0]};
 }catch(err){console.warn('SQLite restore skipped',err);}
}
recoverNative();
const v3save=save;
save=function(){
 state.version=31;state.savedAt=Date.now();
 try{v3save();}catch(e){toast('写入本机失败，请立即备份');}
 if(pendingNative)clearTimeout(pendingNative);
 pendingNative=setTimeout(syncNative,500);
};
window.addEventListener('pagehide',()=>{if(pendingNative){clearTimeout(pendingNative);syncNative();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&pendingNative){clearTimeout(pendingNative);syncNative();}});
// Existing Android storage has the same app ID and web origin: users keep their v3.0 localStorage automatically.
function archiveCopy(log,reason){state.historyArchive=state.historyArchive||[];state.historyArchive.push({...safeCopy(log),archivedAt:Date.now(),reason});if(state.historyArchive.length>150)state.historyArchive.shift();}
const v3previous=previous;
previous=function(id){
 const all=state.logs.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))||num(a.completedAt)-num(b.completedAt));
 for(let i=all.length-1;i>=0;i--){const e=all[i].exercises?.find(z=>z.id===id);if(e)return e;}return null;
};
const v3progression=progression;
progression=function(ex){
 if(state.draft && num(state.draft.readiness)<=2)return null;
 const last=state.logs.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1);
 if(last && Math.floor((Date.now()-new Date(last.date+'T12:00:00'))/86400000)>14)return null;
 const latestFencing=(state.fencing||[]).filter(s=>Date.now()-new Date(s.date+'T12:00:00')<172800000 && num(s.rpe)>=8);
 if(latestFencing.length)return null;
 return v3progression(ex);
};
function editHistory(i){
 const l=state.logs[i];if(!l)return;
 openLogEditor=i;
 let h='<div class="screen"><button class="btn small secondary" data-quality="history-back">← 返回训练记录</button><div class="overline" style="margin-top:16px">EDIT SESSION</div><h1 class="heading">修改历史记录</h1><p class="subtitle">'+esc(NAMES[l.day]||'力量训练')+' · 每个训练组均可更改；保存后自动重新计算统计。</p>';
 h+='<div class="card"><label class="small">训练日期<input type="date" id="log-date" value="'+esc(l.date)+'"></label><p class="small muted">本次恢复评分</p><select id="log-readiness" class="quality-select">'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(num(l.readiness)===n?'selected':'')+'>'+n+' / 5</option>').join('')+'</select></div>';
 l.exercises.forEach((e,x)=>{
 const name=exById(e.id)?.name||e.id;
 h+='<div class="card"><strong>'+esc(name)+'</strong><div class="sethead"><span>组</span><span>kg/手</span><span>次数</span><span>RIR</span><span>完成</span></div>';
 e.sets.forEach((s,y)=>h+='<div class="setrow"><span>'+(y+1)+'</span><input data-hist-set="'+x+'" data-hist-row="'+y+'" data-hist-key="weight" type="number" min="0" max="500" step="0.5" inputmode="decimal" value="'+esc(s.weight)+'"><input data-hist-set="'+x+'" data-hist-row="'+y+'" data-hist-key="reps" type="number" min="0" max="999" inputmode="numeric" value="'+esc(s.reps)+'"><input data-hist-set="'+x+'" data-hist-row="'+y+'" data-hist-key="rir" type="number" min="0" max="10" placeholder="—" inputmode="numeric" value="'+esc(s.rir??'')+'"><input data-hist-set="'+x+'" data-hist-row="'+y+'" data-hist-key="done" type="checkbox" '+(s.done?'checked':'')+'></div>');
 h+='</div>';});
 h+='<div class="card"><strong>训练备注</strong><textarea class="textarea" id="log-notes">'+esc(l.notes||'')+'</textarea></div>';
 h+='<div class="action-bar"><button class="btn secondary" data-quality="history-back">取消</button><button class="btn" data-quality="history-save">保存修改</button></div></div>';
 screen.innerHTML=h;window.scrollTo(0,0);
}
function saveHistory(){
 const i=openLogEditor,old=state.logs[i];if(!old)return;
 const dt=document.querySelector('#log-date')?.value;if(!/^\d{4}-\d\d-\d\d$/.test(dt||'')){toast('日期不合法');return;}
 const next=safeCopy(old);next.date=dt;next.notes=document.querySelector('#log-notes')?.value||'';next.readiness=num(document.querySelector('#log-readiness')?.value);
 let error=false;
 document.querySelectorAll('[data-hist-key]').forEach(node=>{
 const s=next.exercises[+node.dataset.histSet].sets[+node.dataset.histRow],field=node.dataset.histKey;
 if(field==='done')s.done=node.checked;
 else if(field==='rir'){s.rir=node.value;s.rirConfirmed=node.value!=='';}
 else s[field]=node.value;
 });
 next.exercises.forEach(e=>e.sets.forEach(s=>{
 if(s.done&&(!(num(s.reps)>0)||num(s.reps)>999||!Number.isFinite(+s.weight)||num(s.weight)<0||num(s.weight)>500))error=true;
 if(s.rir!==''&&s.rir!=null&&(!Number.isFinite(+s.rir)||num(s.rir)<0||num(s.rir)>10))error=true;
 }));
 if(error||!next.exercises.some(e=>e.sets.some(s=>s.done))){toast('至少保留一组有效记录，并检查重量、次数、RIR');return;}
 archiveCopy(old,'修改前快照');state.logs[i]=next;save();openLogEditor=null;tab='history';draw(true);toast('训练记录已更新，统计已重算');
}
function restoreDeleted(){
 const list=(state.historyArchive||[]).map((x,i)=>({x,i})).filter(z=>z.x.deletedAt||z.x.reason==='删除');
 let h='<div class="screen"><button class="btn small secondary" data-quality="back">← 返回设置</button><h1 class="heading">已归档的训练</h1><p class="subtitle">删除不会立即永久清除，可从归档恢复。</p><div class="card">';
 h+=list.length?list.reverse().map(({x,i})=>'<div class="list-row row"><div><strong>'+esc(fmt(x.date))+' · '+esc(NAMES[x.day]||'力量')+'</strong><small>归档记录 · '+sumSets(x)+'组</small></div><button class="btn small" data-quality="restore" data-index="'+i+'">恢复</button></div>').join(''):'<div class="empty">暂无已删除记录</div>';
 screen.innerHTML=h+'</div></div>';window.scrollTo(0,0);
}
function restoreOne(i){
 const z=state.historyArchive[i];if(!z)return;
 if(state.logs.some(x=>x.uid===z.uid)){toast('此记录已存在');return;}
 const cp=safeCopy(z);delete cp.deletedAt;delete cp.archivedAt;delete cp.reason;
 state.logs.push(cp);state.historyArchive.splice(i,1);save();restoreDeleted();toast('已恢复训练记录');
}
function statsSummary(){
 const all=state.logs;let h='<div class="card quality-summary"><strong>训练质量数据</strong><div class="quality-grid">';
 const work=all.reduce((n,l)=>n+l.exercises.reduce((m,e)=>m+e.sets.filter(s=>s.done&&!exById(e.id)?.warmup).length,0),0);
 const vol=all.reduce((n,l)=>n+trainingVol(l),0);
 h+='<div><small>有效工作组</small><b>'+work+'</b></div><div><small>负重训练容量*</small><b>'+Math.round(vol).toLocaleString()+'</b></div></div><p class="tiny muted">*kg×次，仅包含有负重的组；不把自重引体、单腿侧数和静态保持混入同一容量值。</p></div>';
 for(const [id,label] of [['bench','卧推'],['backsquat','后蹲']]){
  const points=all.flatMap(l=>l.exercises.filter(e=>e.id===id).flatMap(e=>e.sets.filter(s=>s.done&&num(s.weight)>0&&num(s.reps)>=1&&num(s.reps)<=10).map(s=>({date:l.date,w:num(s.weight),r:num(s.reps)})))).sort((a,b)=>a.date.localeCompare(b.date));
  if(!points.length)continue;
  const p=points.slice(-12),best=Math.max(...p.map(x=>x.w*(1+x.r/30)));
  h+='<div class="card"><div class="row"><strong>'+label+' · 估算1RM</strong><span class="chip grey">近期峰值约 '+best.toFixed(1)+' kg</span></div>'+monthChart(p.map(x=>({date:x.date,y:+(x.w*(1+x.r/30)).toFixed(1)})),'Epley估算，1–10次工作组，仅用于观察趋势')+'</div>';
 }
 return h;
}
const v3stats=stats;
stats=function(){const h=v3stats();const p=h.indexOf('近期训练');return h.replace('<button class="btn secondary full" data-act="settings">','<button class="btn secondary full" data-act="settings">').replace(/(<div class="grid2">[\s\S]*?<\/div><\/div>)/, '$1'+statsSummary()).replace(/(<div class="entry row">)/g,'$1');};
// The main v3 stats remains intact; append contextual actions to each history row.
function decorate(){
 if(tab==='history'&&!openLogEditor){document.querySelectorAll('.entry.row').forEach(row=>{const detail=row.querySelector('[data-act=detail]');if(!detail||row.querySelector('[data-quality=edit]'))return;const i=detail.dataset.index;const b=document.createElement('button');b.className='btn small outline';b.textContent='编辑';b.dataset.quality='edit';b.dataset.index=i;row.insertBefore(b,row.lastElementChild);});}
 if(live&&state.draft){document.querySelectorAll('.exercise-card').forEach((card,i)=>{if(card.querySelector('.quality-shortcuts'))return;const ex=exById(state.draft.exercises[i].id),step=ex?.step||2.5;if(ex?.weight===null||ex?.warmup)return;
 const div=document.createElement('div');div.className='quality-shortcuts';div.innerHTML='<span class="small muted">本动作未完成组：</span><button class="btn small secondary" data-quality="adjust" data-i="'+i+'" data-d="-'+step+'">－'+step+'kg</button><button class="btn small secondary" data-quality="adjust" data-i="'+i+'" data-d="'+step+'">＋'+step+'kg</button>';
 const head=card.querySelector('.sethead');if(head)card.insertBefore(div,head);
 });}
}
const oldDraw=draw;
draw=function(top){oldDraw(top);decorate();};
const oldRender=render;
render=function(){oldRender();decorate();};
const v3settings=settings;
settings=function(){const html=v3settings();return html.replace('正式版 v3.0','正式版 v3.1').replace('正式版与v2.0并存。','3.1沿用3.0应用身份；使用相同发布签名可直接覆盖升级。').replace('<div class="settings-group"><strong>关于</strong>', '<div class="settings-group"><strong>数据保护</strong><p>本版将数据同时写入WebView本地存储与安卓SQLite快照（最多保留最近5份）。这并不等于云备份，卸载应用或清除数据仍会丢失全部副本。请至少每两周导出一次JSON。</p><button class="btn small secondary" data-quality="archive">查看已删除训练</button></div><div class="settings-group"><strong>关于</strong>');};
const v3import=importBackup;
importBackup=function(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{
 try{const z=JSON.parse(reader.result);if(!safeState(z))throw Error('备份结构不合法或记录超限');
 const name='力量 '+z.logs.length+' 次 · 晨练 '+Object.values(z.morning||{}).filter(x=>x.completed).length+' 天';
 if(!confirm('备份预览：'+name+'。\n恢复会覆盖现有数据。请确认已经导出旧数据。是否恢复？'))return;
 archiveBeforeImport();state={...BASE,...extraDefaults,...z};state.logs.forEach((l,i)=>{if(!l.uid)l.uid='legacy-'+i+'-'+(l.completedAt||l.date);});state.historyArchive=state.historyArchive||[];
 live=false;tab='home';timerEnd=0;state.timerEnd=0;save();draw(true);toast('备份已恢复');
 }catch(e){toast('恢复失败：'+e.message);}
 };reader.readAsText(file);
};
function archiveBeforeImport(){try{if(window.AndroidStorage?.persistSnapshot)window.AndroidStorage.persistSnapshot(JSON.stringify(state));}catch(e){}}
const oldFinish=finish;
finish=function(){
 if(!state.draft||!countDraft()){toast('请先完成至少一组');return;}
 if(state.draft.date===undefined||!/^\d{4}-\d\d-\d\d$/.test(state.draft.date)){toast('训练日期不合法');return;}
 const date=state.draft.date,day=state.draft.day;
 const repeated=state.logs.some(z=>z.date===date&&z.day===day);
 if(repeated&&!confirm('这一天已经有同类力量训练记录。确定仍要再保存一次吗？'))return;
 // Force unconfirmed RIR to remain unconfirmed; no automatic promotion to heavier weights.
 state.draft.exercises.forEach(e=>e.sets.forEach(s=>{s.rirConfirmed=s.rir!==''&&s.rir!=null&&Number.isFinite(+s.rir); }));
 oldFinish();
};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-quality]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
 const act=b.dataset.quality;
 if(act==='edit')editHistory(+b.dataset.index);
 else if(act==='history-save')saveHistory();
 else if(act==='history-back'){openLogEditor=null;tab='history';draw(true);}
 else if(act==='back'){tab='settings';draw(true);}
 else if(act==='archive')restoreDeleted();
 else if(act==='restore')restoreOne(+b.dataset.index);
 else if(act==='adjust'){
   const e0=state.draft?.exercises[+b.dataset.i];if(!e0)return;
   const amount=Number(b.dataset.d);e0.sets.forEach(s=>{if(!s.done&&s.weight!=='')s.weight=Math.max(0,Math.round((num(s.weight)+amount)*100)/100);});save();draw();toast('未完成组的重量已调整');
 }
},true);
// Keep the editor showing when the user changes a field; avoid the generic navigation rerender.
window.jiantiBackupConfirmed=function(){state.lastBackupAt=Date.now();save();toast('文件保存成功');};
const oldExportFile=exportFile;
exportFile=function(filename,content,mime){oldExportFile(filename,content,mime);if(filename.endsWith('.json')&&!window.AndroidStorage?.saveBackup){state.lastBackupAt=Date.now();save();}};
// Alert rather than pretending we have automatic, cloud-backed backups.
const lastBackup=num(state.lastBackupAt);
if(state.logs.length>0&&(!lastBackup||Date.now()-lastBackup>14*86400000))setTimeout(()=>toast('已有训练数据，请在设置中定期导出JSON备份'),1600);
save();draw();
