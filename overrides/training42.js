'use strict';
// 4.2 training programme migration: leave historical sessions and the active 4.1 draft intact.
// All new exercise IDs are distinct from old bench/front squat training records.
const jt42Legacy = Object.fromEntries(Object.values(PLANS).flat().map(e => [e.id, {...e}]));
Object.assign(NAMES, {
  1:'A · 坐姿推举与肩背', 4:'B · 深蹲与站姿辅助', 6:'C · 硬拉与背部'
});
PLANS[1] = [
 {id:'ohp_seated',name:'坐姿杠铃推举（有靠背）',sets:4,min:4,max:6,weight:20,step:5,rest:180,description:'肩部主项 · 使用有靠背牢固座椅；20kg仅为起始试探值，RIR 2–3；从安全架位置起杠'},
 {id:'chestrow',name:'胸托哑铃划船',sets:4,min:8,max:12,weight:15,step:2.5,rest:120,description:'每手重量 · 上斜凳支撑，减少腰部代偿'},
 {id:'pullmon',name:'正手引体向上',sets:3,min:1,max:3,weight:null,step:0,rest:150,description:'自重 · 使用安全可靠的引体杆，逐渐增加规范次数'},
 {id:'lateralmon',name:'哑铃侧平举',sets:3,min:12,max:20,weight:5,step:1,rest:75,description:'每手重量 · 重点发展三角肌中束，避免借力'}
];
PLANS[4] = [
 {id:'backsquat',name:'杠铃后蹲',sets:3,min:4,max:6,weight:80,step:5,rest:210,description:'主项 · 80kg是历史参考，不代表今天必须做80kg'},
 {id:'ohp_stand',name:'站姿杠铃严格推举',sets:3,min:6,max:10,weight:20,step:5,rest:150,description:'轻负荷辅助 · RIR 3–4，躯干稳定，不以举得更重为主要目标；20kg仅是试探值'},
 {id:'glutebridge',name:'负重臀桥',sets:3,min:8,max:12,weight:20,step:2.5,rest:120,description:'臀部髋伸 · 不通过挺腰代偿'},
 {id:'bulgarian',name:'保加利亚分腿蹲',sets:2,min:6,max:8,weight:0,step:2.5,rest:120,description:'每条腿次数 · 自重开始，双足稳定后逐步负重'}
];
PLANS[6] = [
 {id:'deadlift',name:'传统杠铃硬拉（恢复试训）',sets:3,min:5,max:5,weight:40,step:5,rest:210,description:'动作复评允许后试训40–50kg；工作组3×5、RIR约4以上，未获允许或动作失控则不做'},
 {id:'dbrow',name:'单臂哑铃划船',sets:3,min:8,max:12,weight:20,step:2.5,rest:120,description:'每侧次数 · 保持躯干稳定，周日击剑前保留握力'},
 {id:'incline',name:'上斜哑铃卧推',sets:2,min:8,max:12,weight:15,step:2.5,rest:120,description:'胸部维持的辅项 · 每手重量'},
 {id:'rear',name:'上斜凳反向飞鸟',sets:2,min:12,max:20,weight:3,step:1,rest:75,description:'每手重量 · 肩后束，质量优先'},
 {id:'suitcase',name:'单侧哑铃负重站立',sets:2,min:20,max:30,weight:10,step:2.5,rest:75,timed:true,description:'每侧秒数 · 骨盆保持水平，不侧倾'}
];
const jt42Current = Object.fromEntries(Object.values(PLANS).flat().map(e=>[e.id,e]));
exById=function(id){return jt42Current[id]||jt42Legacy[id]||null;};
// Update the morning plan without requiring any new equipment.
for(const item of CORE)if(item[0]==='c2')item[2]='周一/三适量，周四/六轻量或跳过；先核实器械稳定和承重';
const jt42Cues={
 ohp_stand:'周四轻负荷辅项。双脚稳定，肋骨与骨盆协调控制；避免后仰借力。若20kg空杠仍不稳，改用较轻哑铃或短杠。',
 ohp_seated:'周一主要推举。使用牢固、有靠背的训练椅和适当高度的安全杠架；维持躯干稳定，不用挺腰代偿，也不追求极限重量。',
 deadlift:'首次恢复前先请康复师或现场教练确认负重动作。热身：臀桥1×8、Dead Bug每侧1×6，杠铃空杠8次、30kg×5、40kg×3（根据工作重量调整）。20kg杠铃片尺寸不足时使用合适高度，勿强迫降低起杠。工作组保持余力；疼痛、麻木或明显失控则停止。'
};
const jt42OldCue=keyCue;
keyCue=function(id){return jt42Cues[id]||jt42OldCue(id);};
// Specific loads are not automatically prescribed as rehabilitation clearance.
const jt42OldProgression=progression;
progression=function(ex){if(ex?.id==='deadlift'||ex?.id==='ohp_stand')return null;return jt42OldProgression(ex);};
// Replace only the group membership used by long-term analysis.
Object.keys(GROUPS).forEach(k=>delete GROUPS[k]);
Object.assign(GROUPS,{
 push:{name:'肩部推举',ids:['ohp_seated','ohp_stand'],short:'推'},
 pull:{name:'上肢拉力',ids:['chestrow','dbrow','pullmon','pullsat'],short:'拉'},
 squat:{name:'蹲起力量',ids:['backsquat','frontsquat','bulgarian'],short:'蹲'},
 hinge:{name:'髋伸与后链',ids:['deadlift','glutebridge'],short:'髋'},
 core:{name:'核心抗侧屈训练',ids:['suitcase'],short:'核'}
});
// Display old records under their own IDs; do not blend bench strength with OHP.
const jt42PriorStrength=strengthView;
strengthView=function(){let content=jt42PriorStrength();
 content=content.replace('以推、拉、下肢、躯干稳定的整体进步为核心','分别跟踪推举、拉力、蹲起、后链与核心训练的个人趋势');
 content=content.replace('腰部稳定及康复限制优先于任何算法提示。','新推举成绩不与旧卧推成绩换算。硬拉回归期不自动加重；骨盆静态前倾不等于禁忌，负重动态控制仍需现场评估。');
 return content;
};
const jt42PriorHome=home;
home=function(){let h=jt42PriorHome();return h.replace('保留原有周一、周四、周六力量计划，以及晨间技术与躯干控制练习。','周一坐姿推举与肩背，周四深蹲与轻负荷站姿推举，周六硬拉回归与划船；兼顾周二、周日重剑实战。');};
const jt42PriorSettings=settings;
settings=function(){return jt42PriorSettings()
 .replace(/剑体训练 v4\.1/g,'剑体训练 v4.2')
 .replace('传统硬拉在康复允许前继续暂缓。','硬拉恢复试训应在现场动作评估确认后进行；静态骨盆前倾不等于硬拉禁忌。')
 .replace('周一18:00上肢 · 周四18:00下肢 · 周六15:00肩背胸','周一18:00坐姿推举与肩背 · 周四18:00深蹲与站姿轻推举 · 周六15:00硬拉与背部');};
// If a 4.1 draft is unfinished, exById can still render its legacy exercises.
// We intentionally do not discard or rewrite any user's existing training history.
state.version=42;
save();draw(true);