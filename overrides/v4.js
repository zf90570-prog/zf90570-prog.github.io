'use strict';
/* JianTi 4.0: body composition, general strength, transferable cardiorespiratory signals,
   confirmed screenshot imports; preserves the 3.x state and training workflows. */
const JT4_VERSION='4.1.0';
if(!Array.isArray(state.metrics))state.metrics=[];
if(!Array.isArray(state.swimReports))state.swimReports=[];
let swimPending=null, activeSwimId=null;
const cap=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const average=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const dayInt=d=>Math.floor(Date.parse(d+'T12:00:00')/86400000);
const goodDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d))&&Number.isFinite(dayInt(d));
function aggregateDays(entries,key){let m=new Map();for(let x of entries){const v=+x[key];if(goodDate(x.date)&&Number.isFinite(v)&&v>0)m.set(x.date,v);}return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,value])=>({date,value}));}
function weeklySmoothed(points,windowDays=7){return points.map(p=>{const date=dayInt(p.date),ar=points.filter(x=>dayInt(x.date)>=date-windowDays+1&&dayInt(x.date)<=date).map(x=>x.value);return {date:p.date,value:average(ar)};});}
function robustTrend(data,minPoints=7,minSpan=14){
 const p=data.filter(x=>Number.isFinite(x.value)),span=p.length?dayInt(p.at(-1).date)-dayInt(p[0].date):0;
 if(p.length<minPoints||span<minSpan)return {ready:false,points:p.length,span};
 const slopes=[];for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){const delta=dayInt(p[j].date)-dayInt(p[i].date);if(delta>0)slopes.push((p[j].value-p[i].value)/delta);}
 if(!slopes.length)return {ready:false,points:p.length,span};
 slopes.sort((a,b)=>a-b);const slope=slopes[Math.floor(slopes.length/2)];
 const last=p.at(-1),res=p.map(x=>Math.abs((last.value+slope*(dayInt(x.date)-dayInt(last.date)))-x.value)).sort((a,b)=>a-b);
 const noise=Math.max(.01,res[Math.floor(res.length/2)]*1.4826);
 return {ready:true,points:p.length,span,perWeek:slope*7,last:last.value,noise,slope,lastDate:last.date,confidence:p.length>=20&&span>=28?'中':'初步'};
}
function bodySeries(key){let raw=aggregateDays(state.metrics,key);return key==='weight'?weeklySmoothed(raw,7):weeklySmoothed(raw,14);}
function formatVal(x,u,dp=1){return Number.isFinite(x)?x.toFixed(dp)+u:'—';}
function pctDiff(a,b){return a>0?Math.round((b/a-1)*1000)/10:null;}
function curve(points,{label='',prediction=null,unit='',precision=1}={}){
 if(!points.length)return '<div class="empty">还没有可绘制的数据</div>';
 const last=points.at(-1),start=dayInt(points[0].date),end=dayInt(last.date)+(prediction?28:0);
 const values=points.map(p=>p.value),future=prediction?[prediction.last+14*prediction.slope,prediction.last+28*prediction.slope]:[];
 const all=values.concat(future),lo=Math.min(...all),hi=Math.max(...all),margin=Math.max((hi-lo)*.25,unit==='kg'?.3:.5),low=lo-margin,high=hi+margin;
 const x=d=>38+((d-start)/Math.max(1,end-start))*286,y=v=>124-(v-low)/Math.max(0.01,high-low)*106;
 const trace=points.map((p,i)=>(i?'L':'M')+x(dayInt(p.date)).toFixed(1)+' '+y(p.value).toFixed(1)).join(' ');
 let more='';if(prediction){const t=dayInt(last.date),p14=prediction.last+14*prediction.slope,p28=prediction.last+28*prediction.slope,b=Math.max(margin*.5,prediction.noise*2);more='<path d="M'+x(t)+' '+y(last.value)+' L'+x(t+14)+' '+y(p14)+' L'+x(t+28)+' '+y(p28)+'" stroke="#ffd59e" stroke-width="2.4" stroke-dasharray="6 5" fill="none"/><path d="M'+x(t)+' '+y(last.value)+' L'+x(t+28)+' '+y(p28+b)+' L'+x(t+28)+' '+y(p28-b)+' Z" fill="#ffd59e" opacity=".13"/>';}
 return '<div class="jt4-chart"><svg viewBox="0 0 344 155" aria-label="'+esc(label)+'" role="img"><g stroke="#41586a" stroke-width=".7" opacity=".5"><path d="M38 18H324M38 71H324M38 124H324"/></g><text x="4" y="25" fill="#a0b4c6" font-size="10">'+high.toFixed(precision)+'</text><text x="4" y="126" fill="#a0b4c6" font-size="10">'+low.toFixed(precision)+'</text><path d="'+trace+'" stroke="#6ee8c9" stroke-width="2.7" stroke-linejoin="round" fill="none"/>'+more+'<text x="38" y="147" fill="#91a6ba" font-size="10">'+esc(fmt(points[0].date))+'</text><text x="285" y="147" fill="#91a6ba" font-size="10">'+(prediction?'+4周':esc(fmt(last.date)))+'</text></svg><div class="jt4-legend"><span>● 历史平滑值</span>'+(prediction?'<span style="color:#ffd59e">┄ 条件趋势（非保证）</span>':'')+'</div></div>';
}
function recommendBody(){const w=bodySeries('weight'),wa=bodySeries('waist'),tw=robustTrend(w,14,21),twa=robustTrend(wa,5,21);
 if(!tw.ready||!twa.ready)return {title:'建立身体组成基线',reason:'建议连续记录晨起空腹体重，并在固定位置测量腰围。至少积累3–4周数据后再预测体型趋势。',horizon:'当前不预测达成日期',conf:'数据不足'};
 const wc=twa.perWeek,wt=tw.perWeek;
 if(wc<-.10&&wt>-1.0)return {title:'继续改善腰围，保持训练表现',reason:'近期腰围平滑趋势下降；不必只为体重数字下降而改变训练。',horizon:'未来4周观察腰围是否仍下降',conf:twa.confidence};
 if(wc>.20&&wt>.2)return {title:'优先控制腰围上升趋势',reason:'体重和腰围均出现持续上升信号；结合训练、饮食和恢复再判断是否需要调整。',horizon:'2–4周重新评估',conf:twa.confidence};
 return {title:'保持规律力量与有氧训练',reason:'目前的围度变化不足以支持激进减脂或增重目标。优先稳定训练、睡眠和测量。',horizon:'4周后更新',conf:twa.confidence};
}
function metricCard(name,value,desc){return '<div class="jt4-metric"><small>'+esc(name)+'</small><b>'+esc(value)+'</b><span>'+esc(desc||'')+'</span></div>';}
function bodyView(){const days=state.metrics||[],w=bodySeries('weight'),wa=bodySeries('waist'),tw=robustTrend(w,14,21),twa=robustTrend(wa,5,21),goal=recommendBody(),now=days.find(x=>x.date===today())||days.at(-1)||{};
 let h='<div class="overline">BODY COMPOSITION</div><h1 class="heading">身体变化</h1><p class="subtitle">每天早晨如厕后、进食饮水前测量；同一日期再次保存会更新原记录。</p>';
 h+='<div class="grid2">'+metricCard('最新体重',formatVal(+now.weight,' kg'),'晨间测量')+metricCard('最新腰围',formatVal(+now.waist,' cm'),'固定位置 · 自然呼气末')+'</div>';
 h+='<div class="card"><div class="row"><strong>今天的晨间记录</strong><span class="chip">约20秒</span></div><div class="jt4-fields"><label>日期<input id="jt4-body-date" type="date" value="'+today()+'"></label><label>体重 kg<input id="jt4-body-weight" type="number" min="30" max="250" step="0.05" inputmode="decimal" value="'+(days.find(x=>x.date===today())?.weight??'')+'" placeholder="如 80.25"></label><label>腰围 cm<input id="jt4-body-waist" type="number" min="35" max="200" step="0.1" inputmode="decimal" value="'+(days.find(x=>x.date===today())?.waist??'')+'" placeholder="如 83.5"></label></div><button class="btn full" data-jt4="body-save">保存晨间数据</button><p class="small muted">建议尽量每天记录两项。缺测可以留空，但至少填写一项。</p></div>';
 h+=title('体重趋势',w.length+'次测量');h+='<div class="card">'+curve(w,{label:'体重曲线',unit:'kg',prediction:tw.ready?tw:null})+'<div class="small muted">'+(tw.ready?'近阶段约 '+(tw.perWeek>=0?'+':'')+tw.perWeek.toFixed(2)+' kg/周 · 预测可信度：'+tw.confidence:'数据至少覆盖21天并有14次记录后，才显示未来4周条件趋势')+'</div></div>';
 h+=title('腰围趋势',wa.length+'次测量');h+='<div class="card">'+curve(wa,{label:'腰围曲线',prediction:twa.ready?twa:null,unit:'cm'})+'<p class="small muted">'+(twa.ready?'近阶段约 '+(twa.perWeek>=0?'+':'')+twa.perWeek.toFixed(2)+' cm/周':'需要至少5次、跨越21天的可比较腰围记录')+'</p></div>';
 h+='<div class="card jt4-goal"><div class="overline">自动建议 · '+esc(goal.conf)+'</div><h3>'+esc(goal.title)+'</h3><p>'+esc(goal.reason)+'</p><small>'+esc(goal.horizon)+'。预测仅用于规划，不代表保证结果。</small></div>';
 h+=title('最近测量','长按无须操作');h+='<div class="card">'+(days.length?days.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,28).map(x=>'<div class="jt4-list row"><div><strong>'+esc(x.date)+'</strong><small>'+formatVal(+x.weight,' kg')+' · 腰围 '+formatVal(+x.waist,' cm')+'</small></div><button class="btn small secondary" data-jt4="body-edit" data-date="'+x.date+'">编辑</button></div>').join(''):'<div class="empty">晨起记录后，这里会出现历史数据</div>')+'</div>';
 return shell(h);
}
const GROUPS={push:{name:'上肢推力',ids:['bench','incline'],short:'推'},pull:{name:'上肢拉力',ids:['chestrow','dbrow','pullmon','pullsat'],short:'拉'},legs:{name:'下肢力量',ids:['backsquat','frontsquat','glutebridge','bulgarian'],short:'腿'},core:{name:'躯干稳定训练',ids:['suitcase'],short:'核心'}};
function strengthEvents(group){const ids=new Set(GROUPS[group].ids);const events=[];
 for(const l of state.logs||[])for(const e of l.exercises||[])if(ids.has(e.id)){const ex=exById(e.id);for(const s of e.sets||[])if(s.done&&!ex?.warmup){const reps=+s.reps,w=+s.weight;let perf=Number.isFinite(w)&&w>0&&Number.isFinite(reps)&&reps>0?(reps<=10?w*(1+reps/30):w):Number.isFinite(reps)?reps:0;if(ex?.timed)perf=reps; if(perf>0)events.push({date:l.date,id:e.id,weight:w,reps,perf,kind:ex?.timed?'hold':'strength'});}}
 return events.sort((a,b)=>a.date.localeCompare(b.date));}
function groupStatus(group){const events=strengthEvents(group),ids=GROUPS[group].ids,sessions=new Set(events.map(x=>x.date)).size;
 const byExercise=new Map();for(let e of events){const a=byExercise.get(e.id)||[];a.push(e);byExercise.set(e.id,a);}
 const recent=[];for(const [id,arr] of byExercise){const p=arr.slice(-30),first=p.slice(0,Math.min(5,p.length)),last=p.slice(-Math.min(5,p.length));const f=Math.max(...first.map(x=>x.perf)),n=Math.max(...last.map(x=>x.perf));if(f>0&&n>0)recent.push({id,name:exById(id)?.name||id,first:f,last:n,change:pctDiff(f,n),data:p,unit:(id==='pullmon'||id==='pullsat')?'次':id==='suitcase'?'秒（保持时长）':'估算指标'});}
 const change=recent.length?average(recent.map(x=>x.change).filter(x=>x!==null)):null;
 return {events,sessions,recent,change,ready:sessions>=4&&events.length>=10};}
function strengthView(){let h='<div class="overline">ATHLETIC DEVELOPMENT</div><h1 class="heading">综合力量与体能</h1><p class="subtitle">保留训练动作明细，但以推、拉、下肢、躯干稳定的整体进步为核心，不伪造绝对百分制。</p>';
 h+='<div class="jt4-grid">';for(const id of Object.keys(GROUPS)){const v=groupStatus(id);h+=metricCard(GROUPS[id].name,v.ready&&v.change!==null?((v.change>=0?'+':'')+v.change.toFixed(1)+'%'):'建立基线中','可比记录 '+v.sessions+' 个训练日');}h+='</div>';
 for(const id of Object.keys(GROUPS)){const group=GROUPS[id],s=groupStatus(id);h+='<div class="card"><div class="row"><strong>'+group.name+'</strong><span class="chip grey">'+s.sessions+'天</span></div>';
 if(id==='core')h+='<p class="small muted">负重站立及晨练完成率只能反映训练参与，不等于客观核心稳定能力。后续需加入标准化测试。</p>';
 else if(!s.ready)h+='<p class="small muted">至少需要4个训练日及足够工作组才能形成趋势。自重、单手哑铃和杠铃重量不简单相加。</p>';
 else h+='<p class="small muted">变化幅度来自各动作自身早期和近期可比表现，不是与你人群比较的力量分数。</p>';
 h+=s.recent.slice(0,4).map(x=>'<div class="jt4-list row"><div><strong>'+esc(x.name)+'</strong><small>近期表现：'+(Number.isFinite(x.last)?x.last.toFixed(1):'—')+' · '+esc(x.unit)+'</small></div><span style="color:'+(x.change>=0?'var(--accent)':'var(--gold)')+'">'+(x.change===null?'—':(x.change>=0?'+':'')+x.change.toFixed(1)+'%')+'</span></div>').join('');
 if(s.ready){let all=s.events.filter(x=>x.id===s.recent[0]?.id).map(x=>({date:x.date,value:x.perf}));if(all.length)h+=curve(all.slice(-12),{label:group.name+'代表动作',precision:0});}
 h+='</div>';}
 h+=title('综合训练记录','可修改历史组');
 h+='<div class="card">'+((state.logs||[]).length?state.logs.map((z,i)=>({z,i})).reverse().slice(0,15).map(o=>'<div class="jt4-list row"><div><strong>'+esc(o.z.date)+' · '+esc(NAMES[o.z.day]||'力量')+'</strong><small>'+o.z.exercises.reduce((n,e)=>n+e.sets.filter(s=>s.done).length,0)+'组 · 历史保留</small></div><button class="btn secondary small" data-jt4="log-edit" data-index="'+o.i+'">编辑</button></div>').join(''):'<div class="empty">完成首次力量训练后显示</div>')+'</div>';
 h+='<div class="notice">自动建议只参考规范完成的工作组。腰部稳定及康复限制优先于任何算法提示。</div>';
 return shell(h);
}
function getReportById(id){return state.swimReports.find(x=>x.id===id);}
function seconds(str){if(str===null||str===undefined||str==='')return null;const s=String(str).trim();if(/^\d+(?:\.\d+)?$/.test(s))return +s;const parts=s.split(':').map(Number);if(parts.some(x=>!Number.isFinite(x))||parts.length>3)return null;return parts.reduce((n,x)=>n*60+x,0);}
function durationText(v){v=Number(v);return Number.isFinite(v)&&v>=0?Math.floor(v/3600)?Math.floor(v/3600)+':'+String(Math.floor(v/60)%60).padStart(2,'0')+':'+String(Math.floor(v%60)).padStart(2,'0'):Math.floor(v/60)+':'+String(Math.floor(v%60)).padStart(2,'0'):'—';}
function findEvidence(lines){
 // Vivo long reports put captions and values in separate grid cells. Match by
 // *position and meaning*, not by assuming both are in the same OCR line.
 const arr=(lines||[]).filter(x=>x&&typeof x.text==='string'&&x.text.trim())
  .map(x=>({text:x.text.replace(/[，]/g,',').replace(/[：]/g,':').trim(),x:Number(x.x)||0,y:Number(x.y)||0,w:Number(x.w)||.08,h:Number(x.h)||.003}))
  .sort((a,b)=>a.y-b.y||a.x-b.x),out={};
 const specs=[
  {key:'distance_m',label:/游泳距离|总距离|运动距离|^距离$|^里程$/,kind:'distance',min:25,max:100000},
  {key:'duration_s',label:/用时|总时长|运动时长|运动时间|持续时间/,kind:'time',min:1,max:86400},
  {key:'active_s',label:/有效游泳时长|有效运动时长|实际游泳时间|活动时间|移动时间/,kind:'time',min:1,max:86400},
  {key:'hr_avg',label:/平均心率|平均心跳/,kind:'integer',min:40,max:230},
  {key:'hr_max',label:/最高心率|最大心率/,kind:'integer',min:40,max:240},
  {key:'swolf',label:/平均\s*SWOLF|平均\s*SW0LF|^SWOLF/i,kind:'integer',min:5,max:300},
  {key:'stroke_rate',label:/平均划水频率|划水频率|平均划频/,kind:'integer',min:1,max:150},
  {key:'laps',label:/泳池趟数|游泳趟数|总趟数|^趟数$/,kind:'integer',min:1,max:2000},
  {key:'aerobic',label:/有氧训练效果|有氧效果/,kind:'decimal',min:0,max:5},
  {key:'anaerobic',label:/无氧训练效果|无氧效果/,kind:'decimal',min:0,max:5}
 ];
 function parse(t,spec){
  if(!t)return null;
  let m;
  if(spec.kind==='time')m=t.match(/(?:^|\D)(\d{1,2}:\d{2}(?::\d{2})?)(?!\d)/);
  else if(spec.kind==='decimal')m=t.match(/(?:^|\D)([0-5][.,]\d)(?!\d)/);
  else if(spec.kind==='distance')m=t.match(/(?:^|\D)(\d{2,5})(?:\s*米|\s*m\b)?/i);
  else m=t.match(/(?:^|\D)(\d{1,3})(?:\s*次|\s*bpm|\s*回)?/i);
  if(!m)return null;
  const value=spec.kind==='time'?seconds(m[1]):Number(m[1].replace(',','.'));
  return Number.isFinite(value)&&value>=spec.min&&value<=spec.max?value:null;
 }
 for(const spec of specs){
  const labels=arr.filter(a=>spec.label.test(a.text));
  let best=null;
  for(const anchor of labels){
   const candidates=[];
   const direct=parse(anchor.text.replace(spec.label,''),spec);
   if(direct!==null)candidates.push({value:direct,source:anchor.text,score:0.01});
   for(const item of arr){
    if(item===anchor)continue;
    const dy=item.y-anchor.y,dx=Math.abs(item.x-anchor.x);
    const maxDy=Math.max(.010,Math.min(.045,anchor.h*6+0.005));
    // Same-column values are below the caption, sometimes on the same line to its right.
    const below=dy>=-Math.max(anchor.h,.003) && dy<=maxDy;
    if(!below||dx>.28)continue;
    // Do not borrow a number from a different caption or a chart axis.
    if(item.text.length>14&&/[\u4e00-\u9fa5]{4}/.test(item.text)&&!/[\d]/.test(item.text))continue;
    const value=parse(item.text,spec);if(value===null)continue;
    let score=(Math.abs(dy)/maxDy)*2+dx*4+(item.y<anchor.y?.6:0);
    if(/[\u4e00-\u9fa5]/.test(item.text)&&!(/米|次|分|秒|bpm/i.test(item.text)))score+=.35;
    candidates.push({value,source:anchor.text+' → '+item.text,score});
   }
   candidates.sort((a,b)=>a.score-b.score);
   if(candidates.length && (!best || candidates[0].score<best.score))best=candidates[0];
  }
  if(best)out[spec.key]={value:best.value,source:best.source,confidence:best.score<.8?'候选':'待重点核对'};
 }
 // Vivo summary usually displays distance as an oversized number with 米,
 // without any text saying 距离. Only accept explicitly unit-marked figures
 // in the top 16% of the screenshot; never pick random chart numbers.
 if(!out.distance_m){
  const top=arr.filter(a=>a.y<.16&&/(?:\d{2,5})\s*(?:米|m\b)/i.test(a.text));
  const hit=top.find(a=>{const n=parse(a.text,specs[0]);return n!==null;});
  if(hit)out.distance_m={value:parse(hit.text,specs[0]),source:'报告顶部：'+hit.text,confidence:'待重点核对'};
 }
 return out;
}
function makePending(photo){const extracted=findEvidence(photo.lines||[]);const values={};for(const [k,x] of Object.entries(extracted))values[k]=x.value;
 swimPending={id:photo.id||('web-'+Date.now()),photoUrl:photo.url||'',date:today(),ocrInfo:photo.ocrInfo||{lines:(photo.lines||[]).length,tiles:0},ocrWarning:photo.warning||'',ocrText:(photo.lines||[]).map(x=>x.text).join('\n'),found:extracted,values,rpe:'',poolLength:50,stroke:'混合/练习',notes:'',fromNative:!!photo.id};
 activeSwimId=null;tab='swim';draw(true);
}
window.jiantiSwimPhotoResult=function(json){try{const res=JSON.parse(json);if(!res.ok){toast('图片读取失败：'+(res.error||'未知原因'));return;}makePending(res);const count=Object.keys(swimPending?.found||{}).length;toast('识别到'+(res.lines||[]).length+'行文字，提取'+count+'项数据；请核对');}catch(e){toast('识别结果解析失败');}};
window.jiantiSwimImportResult=function(json){try{const a=JSON.parse(json);if(a.error){toast('恢复失败：'+a.error);return;}if(!a.data||!Array.isArray(a.data.logs))throw Error('备份内容不合法');if(!confirm('导入含原图的备份将覆盖当前训练数据。继续？'))return;const imported=a.data;if(!safeState(imported))throw Error('备份校验未通过');state={...BASE,...extraDefaults,...imported};state.swimReports=Array.isArray(imported.swimReports)?imported.swimReports:[];save();tab='home';draw(true);toast('含原图备份已恢复');}catch(e){toast('数据导入异常：'+e.message);}};
function photoView(url){return url?'<div class="jt4-photo"><img src="'+esc(url)+'" alt="手表游泳报告原始长截图" loading="lazy"></div>':'<p class="small muted">未绑定可查看的原始图片</p>';}
function swimFields(){return [
 {key:'distance_m',name:'游泳距离',unit:'米',type:'number',min:25,max:100000,step:1},
 {key:'duration_s',name:'运动总时长',unit:'秒',type:'number',min:1,max:86400,step:1},
 {key:'active_s',name:'有效游泳时长（如手表提供）',unit:'秒',type:'number',min:1,max:86400,step:1},
 {key:'hr_avg',name:'平均心率',unit:'次/分',type:'number',min:40,max:230,step:1},
 {key:'hr_max',name:'最高心率',unit:'次/分',type:'number',min:40,max:240,step:1},
 {key:'swolf',name:'平均 SWOLF（辅助）',unit:'',type:'number',min:5,max:300,step:1},
 {key:'stroke_rate',name:'平均划水频率（辅助）',unit:'次/分',type:'number',min:1,max:150,step:1},
 {key:'laps',name:'泳池趟数',unit:'',type:'number',min:1,max:2000,step:1},
 {key:'aerobic',name:'有氧训练效果（设备）',unit:'',type:'number',min:0,max:5,step:.1},
 {key:'anaerobic',name:'无氧训练效果（设备）',unit:'',type:'number',min:0,max:5,step:.1}
 ];}
function pendingForm(){const p=swimPending;if(!p)return '';
 let h='<div class="screen"><button class="btn secondary small" data-jt4="swim-cancel">← 返回游泳</button><div class="overline" style="margin-top:16px">REVIEW BEFORE SAVE</div><h1 class="heading">核对识别结果</h1><p class="subtitle">绿色并不代表已核实。请与截图逐项对照，不能确认的字段留空；保存后可再编辑。</p><div class="notice">本机识别：'+(p.ocrInfo?.lines??0)+' 行文字 · 自动提取 '+Object.keys(p.found||{}).length+' 项 · 分段识别 '+(p.ocrInfo?.tiles??'?')+' 区'+(p.ocrWarning?' · '+esc(p.ocrWarning):'')+'。如果文字行数为0，请查看下方原始OCR内容并反馈。</div>';
 h+='<div class="card"><strong>原始长截图</strong><p class="small muted">点击图片可放大查看；App 在本机保留原图。</p>'+photoView(p.photoUrl)+'</div>';
 h+='<div class="card jt4-form"><label>运动日期<input id="swim-date" type="date" value="'+esc(p.date)+'"></label><label>泳池长度<select id="swim-pool"><option value="25" '+(p.poolLength===25?'selected':'')+'>25米</option><option value="50" '+(p.poolLength===50?'selected':'')+'>50米</option><option value="0" '+(p.poolLength===0?'selected':'')+'>未知 / 非标准</option></select></label><label>泳姿<select id="swim-stroke">'+['混合/练习','自由泳','蛙泳','仰泳','蝶泳'].map(x=>'<option value="'+x+'" '+(p.stroke===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>';
 for(const f of swimFields()){const found=p.found?.[f.key];h+='<label>'+f.name+' <small>'+f.unit+'</small> <span class="jt4-confidence">'+(found?'OCR候选·请确认':'未识别·可留空')+'</span><input data-jt4-field="'+f.key+'" type="'+f.type+'" step="'+f.step+'" min="'+f.min+'" max="'+f.max+'" inputmode="decimal" placeholder="未识别，可手动填入" value="'+esc(p.values?.[f.key]??'')+'"></label>';}
 h+='<label>这次感觉多累？（sRPE，0–10，可留空）<input id="swim-rpe" type="number" min="0" max="10" step="1" value="'+esc(p.rpe)+'" placeholder="请主动填写，不自动假定"></label><label>备注<textarea id="swim-notes" class="textarea" placeholder="游泳技术练习、休息情况、心率异常等">'+esc(p.notes)+'</textarea></label>';
 h+='<div class="notice">有效配速只能用真实有效游泳时间计算；本 App 不会用包含休息的总时长直接推断游泳速度。设备 SWOLF 不参与核心心肺评分。</div><button class="btn full" data-jt4="swim-confirm">确认并保存游泳记录</button><details class="jt4-ocr"><summary>查看OCR原文（排查识别问题）</summary><pre>'+esc(p.ocrText||'未识别到文字')+'</pre></details></div></div>';
 return h;
}
function validateSwim(data){if(!goodDate(data.date))return '运动日期无效';const checks=Object.fromEntries(swimFields().map(x=>[x.key,x]));for(const [k,f] of Object.entries(checks)){let v=data[k];if(v==null||v==='')continue;if(!Number.isFinite(+v)||+v<f.min||+v>f.max)return f.name+'超出合理范围';}
 if(data.hr_max!=null&&data.hr_avg!=null&&data.hr_max<data.hr_avg)return '最高心率不能低于平均心率';if(data.active_s!=null&&data.duration_s!=null&&data.active_s>data.duration_s)return '有效游泳时长不能超过运动总时长';
 if(data.rpe!==''&&data.rpe!=null&&(!Number.isInteger(+data.rpe)||+data.rpe<0||+data.rpe>10))return '主观强度须为0–10整数';
 if(data.distance_m!=null&&data.poolLength>0&&data.laps!=null&&Math.abs(data.poolLength*data.laps-data.distance_m)>data.poolLength) return '距离与趟数不一致，请检查泳池长度或留空趟数';
 return null;}
function saveSwimReview(){if(!swimPending)return;const p=swimPending,data={id:p.id,imageId:p.fromNative?p.id:null,date:document.querySelector('#swim-date').value,poolLength:+document.querySelector('#swim-pool').value,stroke:document.querySelector('#swim-stroke').value,notes:document.querySelector('#swim-notes').value.slice(0,400),rpe:document.querySelector('#swim-rpe').value,confirmedAt:Date.now(),origin:'vivo截图·人工确认',ocrReview:true};
 for(const f of swimFields()){const v=document.querySelector('[data-jt4-field="'+f.key+'"]').value.trim();data[f.key]=v===''?null:Number(v);}
 const err=validateSwim(data);if(err){toast(err);return;}if(data.distance_m==null&&data.duration_s==null&&data.hr_avg==null){toast('至少核对距离、运动时长或平均心率中的一项');return;}
 const dupe=state.swimReports.find(x=>x.date===data.date&&x.distance_m===data.distance_m&&x.duration_s===data.duration_s&&x.id!==data.id);
 if(dupe&&!confirm('已存在同一天、相同距离和时长的游泳记录。确定仍保存？'))return;
 const idx=state.swimReports.findIndex(x=>x.id===data.id);if(idx>=0)state.swimReports[idx]=data;else state.swimReports.push(data);
 state.swimReports.sort((a,b)=>a.date.localeCompare(b.date));swimPending=null;activeSwimId=data.id;save();tab='swim';draw(true);toast('游泳已确认保存，心肺趋势已更新');}
function showSwimDetail(id){const r=getReportById(id);if(!r)return swimView();let h='<button class="btn secondary small" data-jt4="swim-close-detail">← 返回游泳</button><h1 class="heading">'+esc(fmt(r.date))+' · 运动记录</h1><p class="subtitle">已核对保存 · 来源：'+esc(r.origin||'手动')+'</p>';
 h+='<div class="grid2">'+metricCard('距离',formatVal(r.distance_m,' 米',0),'运动距离')+metricCard('总时长',durationText(r.duration_s),'包括休息时间')+metricCard('平均心率',formatVal(r.hr_avg,' bpm',0),'腕式测量可能有误差')+metricCard('主观强度',r.rpe===''||r.rpe==null?'未记录':r.rpe+'/10','sRPE')+'</div>';
 h+='<div class="card"><strong>原始报告截图</strong>'+photoView(r.imageId?'https://appassets.androidplatform.net/swim-photo/'+encodeURIComponent(r.imageId):'')+'</div>';
 h+='<div class="card"><strong>其他原始指标</strong>'+swimFields().map(f=>'<div class="jt4-list row"><span class="small muted">'+f.name+'</span><strong>'+formatVal(r[f.key],f.unit?(' '+f.unit):'',f.step===.1?1:0)+'</strong></div>').join('')+'</div>';
 h+='<div class="row"><button class="btn secondary" data-jt4="swim-edit" data-id="'+esc(id)+'">修改数据</button><button class="btn danger" data-jt4="swim-delete" data-id="'+esc(id)+'">删除</button></div>';
 return shell(h);}
function swimView(){if(swimPending)return pendingForm();if(activeSwimId)return showSwimDetail(activeSwimId);
 let h='<div class="overline">CARDIO · ENDURANCE</div><h1 class="heading">游泳报告</h1><p class="subtitle">vivo WATCH GT 2 · 从相册上传长截图 → 本机OCR → 人工核对 → 保存原图和分析。</p>';
 h+='<div class="hero jt4-swim-hero"><div class="overline">OFFLINE OCR</div><h2>游完上传，数据自动整理。</h2><p>不需要联网，不要求照片完美识别。没有把握的字段保持空白，确认后才进入统计。</p><button class="btn" data-jt4="swim-pick">＋ 从相册导入游泳长截图</button><input id="jt4-browser-photo" class="hidden" type="file" accept="image/*"></div>';
 const reports=state.swimReports||[];let total=reports.length,mins=reports.reduce((x,r)=>x+(+r.duration_s||0)/60,0),rated=reports.filter(x=>x.rpe!==''&&x.rpe!=null&&rpeValid(x.rpe));
 h+='<div class="jt4-grid">'+metricCard('已核对游泳',String(total)+' 次','每次保留原图')+metricCard('累计运动时间',Math.round(mins)+' 分钟','包含休息时间')+metricCard('含强度反馈',rated.length+' 次','用于sRPE负荷')+metricCard('数据来源','截图确认','不会虚构未识别字段')+'</div>';
 h+='<div class="card"><strong>如何判断心肺进步？</strong><p class="small muted">关注相近训练模式下的心率、持续时间、主观强度与恢复。SWOLF、泳姿、配速用于辨别技术因素，不直接作为跨项目体能得分。</p></div>';
 h+=title('游泳历史',reports.length+'次');h+='<div class="card">'+(reports.length?reports.slice().reverse().map(x=>'<button class="jt4-history-item" data-jt4="swim-detail" data-id="'+esc(x.id)+'"><div class="row"><strong>'+esc(fmt(x.date))+'</strong><span class="chip grey">查看原图 ›</span></div><small>'+formatVal(x.distance_m,'米',0)+' · '+durationText(x.duration_s)+' · 平均心率 '+formatVal(x.hr_avg,'bpm',0)+'</small></button>').join(''):'<div class="empty">还没有确认保存的游泳记录</div>')+'</div>';
 return shell(h);
}
function rpeValid(v){return Number.isInteger(+v)&&+v>=0&&+v<=10;}
function cardioAnalytics(){const reports=(state.swimReports||[]).slice().sort((a,b)=>a.date.localeCompare(b.date)),full=reports.filter(x=>Number.isFinite(+x.duration_s)&&+x.duration_s>0),hr=reports.filter(x=>Number.isFinite(+x.hr_avg)&&+x.hr_avg>0);
 const load=reports.filter(r=>rpeValid(r.rpe)&&r.rpe!==''&&+r.duration_s>0).map(r=>({date:r.date,value:(+r.duration_s/60)*(+r.rpe)}));
 let h='<div class="card"><div class="overline">TRANSFERABLE FITNESS</div><h3>心肺与持续运动能力</h3><p class="small muted">心肺负荷和耐力进步不等于游泳专项速度；设备训练效果仅供参考，不直接换算VO₂max。</p><div class="jt4-grid">'+metricCard('已核对会话',String(reports.length)+' 次','以原始报告为依据')+metricCard('近期累计时长',Math.round(full.filter(x=>dayInt(today())-dayInt(x.date)<=28).reduce((s,x)=>s+x.duration_s/60,0))+' 分','最近28天·包括休息')+metricCard('sRPE 可用',load.length+' 次','主观强度×总时长')+metricCard('一般耐力趋势',reports.length>=6?'分析中':'建立基线','至少6次可比较记录')+'</div></div>';
 if(load.length){h+='<div class="card"><strong>主观训练负荷 · 任意单位</strong>'+curve(load.slice(-15),{label:'单次主观训练负荷',precision:0})+'<p class="small muted">负荷数值高仅表示训练刺激较大，不代表体能水平更高。技术课和休息较多时应结合训练备注判断。</p></div>';}
 if(hr.length>=4){const p=hr.map(r=>({date:r.date,value:r.hr_avg}));h+='<div class="card"><strong>游泳平均心率</strong>'+curve(p.slice(-20),{label:'平均心率',precision:0})+'<p class="small muted">不同泳姿、距离、休息比例和水温之间不直接比较效率；腕部光学心率可能偏差较大。</p></div>';}
 else h+='<div class="card"><strong>心肺趋势</strong><p class="small muted">至少还需更多可比游泳记录。一次平均心率无法推导VO₂max，也不能判断长期进步。</p></div>';
 const recent=reports.slice(-6);const withActive=recent.filter(x=>x.active_s!=null&&x.distance_m!=null&&x.poolLength>0),styleSet=new Set(withActive.map(x=>x.poolLength+':'+x.stroke));
 if(withActive.length>=4&&styleSet.size===1){const p=withActive.map(x=>({date:x.date,value:x.distance_m/x.active_s}));h+='<div class="card"><strong>相同条件下的有效速度（米/秒）</strong>'+curve(p,{label:'有效游泳速度'})+'<p class="small muted">有效速度是条件辅助变量；技术提升、出发方式及划水变化也会影响结果。</p></div>';}
 const ready=reports.length>=6&&hr.length>=4&&load.length>=4;
 h+='<div class="card jt4-goal"><div class="overline">自动阶段目标 · '+(ready?'初步趋势':'证据不足')+'</div><h3>'+(ready?'保持可持续有氧训练并观察同条件效率':'先建立心肺训练基线')+'</h3><p>'+(ready?'下一阶段重点是维持规律游泳、记录强度和逐步增加可持续活动量。仅在相近泳姿、池长及休息安排下观察效率，暂不估算VO₂max。':'建议未来4周积累至少6次游泳，尽量保留有效游泳时长并填写每次主观强度。数据可比后再估算阶段里程碑。')+'</p><small>当前无法可靠估算特定目标的达成日期；避免虚假的精确预测。</small></div>';
 return h;
}
function insightView(){const body=recommendBody();let h='<div class="overline">PROGRESS INTELLIGENCE</div><h1 class="heading">综合能力</h1><p class="subtitle">分维度看趋势与目标，避免简单把不同运动的单位混成一个总分。</p>';
 h+='<div class="card jt4-goal"><div class="overline">当前身体方向</div><h3>'+esc(body.title)+'</h3><p>'+esc(body.reason)+'</p><small>'+esc(body.horizon)+'</small></div>';
 h+=title('力量发展','保留所有原始动作数据');h+='<div class="jt4-grid">'+Object.keys(GROUPS).map(id=>{const x=groupStatus(id);return metricCard(GROUPS[id].name,x.ready&&x.change!==null?(x.change>=0?'+':'')+x.change.toFixed(1)+'%':'基线中',x.sessions+'个训练日');}).join('')+'</div><button class="btn secondary full" data-jt4="view-strength">查看力量明细与历史编辑</button>';
 h+=title('心肺与耐力','基于确认后的游泳数据');h+=cardioAnalytics();h+='<div class="notice">这套分析只能评估个人趋势和负荷，不是医疗评估或心肺功能检查。心率及游泳有效时长缺失时不会补造数值。</div>';
 return shell(h);
}
const jt4PriorHome=home;
home=function(){const d=weekday(),isWorkout=!!PLANS[d],latest=state.metrics.slice().sort((a,b)=>b.date.localeCompare(a.date))[0]||{},swims=state.swimReports.length,work=weekGym(),body=recommendBody();let h='<div class="overline">JIANTI · PERSONAL PERFORMANCE</div><h1 class="heading">坚持记录，让变化有据。</h1><p class="subtitle">'+esc(fmt(today()))+' · '+DAYS[d]+' · 力量＋身体组成＋心肺耐力</p>';
 h+='<div class="hero"><span class="chip">'+(isWorkout?'力量训练日':'恢复与技术日')+'</span><h2>'+(isWorkout?NAMES[d]:d===0||d===2?'重剑训练日':'训练与恢复并重')+'</h2><p>保留原有周一、周四、周六力量计划，以及晨间技术与躯干控制练习。</p><button class="btn" data-jt4="'+(isWorkout?'go-workout':'go-morning')+'" '+(isWorkout?'data-day="'+d+'"':'')+'>'+(isWorkout?'开始力量训练':'查看晨练安排')+' →</button></div>';
 h+='<div class="jt4-grid">'+metricCard('最近体重',formatVal(+latest.weight,' kg'),'晨间空腹')+metricCard('最近腰围',formatVal(+latest.waist,' cm'),'测量趋势')+metricCard('本周力量',work+' / 3','按训练日')+metricCard('游泳记录',swims+' 次','截图核对')+'</div>';
 h+='<div class="card"><div class="row"><strong>晨间数据</strong><button class="btn small secondary" data-jt4="go-body">立即记录 →</button></div><p class="small muted">建议早晨如厕后、早餐和饮水前记录体重与腰围；App 自动计算长期曲线。</p></div>';
 h+='<div class="card"><div class="row"><strong>游泳报告识别</strong><button class="btn small secondary" data-jt4="go-swim">上传截图 →</button></div><p class="small muted">拍照或相册选择 vivo 健康长图，本地OCR识别，核对后绑定原始截图保存。</p></div>';
 h+='<div class="card jt4-goal"><div class="overline">自动阶段目标</div><h3>'+esc(body.title)+'</h3><p>'+esc(body.reason)+'</p><button class="btn small outline" data-jt4="go-insight">查看综合分析</button></div>';
 if(state.draft)h+='<div class="card row"><strong>有未完成的力量草稿</strong><button class="btn small" data-jt4="resume">继续</button></div>';
 return shell(h);};
const jt4OldDraw=draw;
draw=function(top=false){if(['body','swim','insights','strength'].includes(tab)){
  nav();screen.innerHTML=tab==='body'?bodyView():tab==='swim'?swimView():tab==='insights'?insightView():strengthView();
  if(top)window.scrollTo(0,0);
 }else jt4OldDraw(top);
 document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab||(tab==='strength'&&b.dataset.tab==='insights')));
};
function go(t){tab=t;activeSwimId=null;live=false;draw(true);}
function bodySave(){const date=document.querySelector('#jt4-body-date')?.value,weightText=document.querySelector('#jt4-body-weight')?.value.trim(),waistText=document.querySelector('#jt4-body-waist')?.value.trim();const w=weightText===''?null:Number(weightText),wa=waistText===''?null:Number(waistText);
 if(!goodDate(date)||w===null&&wa===null||w!==null&&(!Number.isFinite(w)||w<30||w>250)||wa!==null&&(!Number.isFinite(wa)||wa<35||wa>200)){toast('检查日期、体重（30–250kg）、腰围（35–200cm）');return;}
 const existing=state.metrics.find(x=>x.date===date);if(existing){if(w!==null)existing.weight=w;else delete existing.weight;if(wa!==null)existing.waist=wa;else delete existing.waist;}else state.metrics.push({date,...(w!==null?{weight:w}:{}),...(wa!==null?{waist:wa}:{})});
 state.metrics.sort((a,b)=>a.date.localeCompare(b.date));save();draw();toast('身体数据已保存，趋势已更新');}
function useSwimPhoto(){if(window.JianTiSwim?.pickPhoto){window.JianTiSwim.pickPhoto();toast('请选择 vivo 健康长截图');}else {document.querySelector('#jt4-browser-photo')?.click();}}
function recoverSwimEdit(id){const r=getReportById(id);if(!r)return;swimPending={id:r.id,photoUrl:r.imageId?'https://appassets.androidplatform.net/swim-photo/'+encodeURIComponent(r.imageId):'',date:r.date,poolLength:r.poolLength??0,stroke:r.stroke||'混合/练习',notes:r.notes||'',rpe:r.rpe??'',fromNative:!!r.imageId,found:{},values:Object.fromEntries(swimFields().map(f=>[f.key,r[f.key]])),ocrText:'历史已核对数据，可直接修正后保存'};activeSwimId=null;tab='swim';draw(true);}
function newerSettings(){let h=settings();return h.replace('</div></div></div>','<div class="settings-group"><strong>带游泳原图的完整备份</strong><p>推荐定期导出 ZIP，包含训练JSON和所有已保存的游泳截图。普通JSON备份不包含图片。</p><div class="stagger"><button class="btn small" data-jt4="full-export">导出完整ZIP</button><button class="btn small secondary" data-jt4="full-import">导入完整ZIP</button></div></div><div class="settings-group"><strong>剑体训练 v4.1</strong><p>截图在本机识别，数据在你确认后保存；无联网权限。OCR结果并不等于真实测量。</p></div></div></div></div>');}
const jt4Settings=settings;settings=function(){return newerSettingsPlain(jt4Settings());};
function newerSettingsPlain(h){return h.replace('剑体训练 正式版 v3.0','剑体训练 v4.1').replace('剑体训练 正式版 v3.1','剑体训练 v4.1').replace('重剑游泳','历史运动').replace('</div></div></div>','<div class="settings-group"><strong>完整 ZIP（保留游泳原图）</strong><p>使用完整ZIP备份会同时保存训练JSON与游泳截图。仅JSON备份不会包含原图。卸载前请导出。</p><div class="stagger"><button class="btn small" data-jt4="full-export">导出含原图 ZIP</button><button class="btn small secondary" data-jt4="full-import">导入含原图 ZIP</button></div></div></div></div></div>');}
document.addEventListener('click',e=>{
 const navBtn=e.target.closest('.bottom-nav [data-tab]');if(navBtn){e.preventDefault();e.stopImmediatePropagation();tab=navBtn.dataset.tab;activeSwimId=null;live=false;draw(true);return;}
 const b=e.target.closest('[data-jt4]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const a=b.dataset.jt4;
 if(a==='go-workout')start(b.dataset.day);
 else if(a==='go-morning')go('morning');
 else if(a==='resume'){tab='workouts';live=true;draw(true);}
 else if(a==='go-body')go('body');else if(a==='go-swim')go('swim');else if(a==='go-insight')go('insights');
 else if(a==='body-save')bodySave();else if(a==='body-edit'){const x=state.metrics.find(z=>z.date===b.dataset.date);if(x){document.querySelector('#jt4-body-date').value=x.date;document.querySelector('#jt4-body-weight').value=x.weight??'';document.querySelector('#jt4-body-waist').value=x.waist??'';document.querySelector('#jt4-body-date').scrollIntoView({behavior:'smooth'});}}
 else if(a==='swim-pick')useSwimPhoto();else if(a==='swim-cancel'){if(swimPending&&!getReportById(swimPending.id)&&swimPending.fromNative)window.JianTiSwim?.deletePhoto?.(swimPending.id);swimPending=null;go('swim');}
 else if(a==='swim-confirm')saveSwimReview();else if(a==='swim-detail'){activeSwimId=b.dataset.id;draw(true);}
 else if(a==='swim-close-detail'){activeSwimId=null;draw(true);}else if(a==='swim-edit')recoverSwimEdit(b.dataset.id);
 else if(a==='swim-delete'){const r=getReportById(b.dataset.id);if(r&&confirm('确定删除本次游泳记录和其原始截图吗？建议先导出ZIP备份。')){state.swimReports=state.swimReports.filter(z=>z.id!==r.id);save();if(r.imageId)window.JianTiSwim?.deletePhoto?.(r.imageId);activeSwimId=null;draw(true);toast('记录与原图已删除');}}
 else if(a==='view-strength')go('strength');
 else if(a==='log-edit'){openLogEditor=null;editHistory(+b.dataset.index);}
 else if(a==='full-export'){if(window.JianTiSwim?.exportFullBackup){window.JianTiSwim.exportFullBackup(JSON.stringify(state));toast('请选择ZIP保存位置');}else toast('含图片ZIP仅在安卓安装版中支持');}
 else if(a==='full-import'){if(window.JianTiSwim?.importFullBackup)window.JianTiSwim.importFullBackup();else toast('含图片ZIP仅在安卓安装版中支持');}
},true);
document.addEventListener('change',e=>{if(e.target.id==='jt4-browser-photo'){const f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith('image/')){toast('请选择图片');return;}const reader=new FileReader();reader.onload=()=>makePending({id:null,url:reader.result,lines:[]});reader.readAsDataURL(f);}},true);
// Add secondary entry to morning routine even when bottom navigation is replaced.
const nav4=document.querySelector('.bottom-nav');nav4.innerHTML='<button data-tab="home"><span class="ico">⌂</span>首页</button><button data-tab="workouts"><span class="ico">▤</span>训练</button><button data-tab="body"><span class="ico">◯</span>身体</button><button data-tab="swim"><span class="ico">≈</span>游泳</button><button data-tab="insights"><span class="ico">▥</span>分析</button>';
const oldSettingsClick=document.querySelector('#settings-button');if(oldSettingsClick)oldSettingsClick.addEventListener('click',()=>{tab='settings';draw(true);},true);
state.version=4;save();draw();