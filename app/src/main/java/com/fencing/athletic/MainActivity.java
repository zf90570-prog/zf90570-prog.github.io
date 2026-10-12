package com.fencing.athletic;
import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.text.SimpleDateFormat;
import java.util.*;
public class MainActivity extends Activity {
 final String[] days={"周一 · 上肢力量","周四 · 下肢力量","周六 · 肩背胸"};
 final String[][] moves={
 {"杠铃卧推|65|3|4-6","杠铃前蹲|40|2|5","胸托哑铃划船|15|4|8-12","正手引体向上|0|3|1-2","哑铃侧平举|5|2|12-20"},
 {"杠铃后蹲|80|3|4-6","负重臀桥|20|3|8-12","保加利亚分腿蹲|0|2|6-8/腿"},
 {"正手引体向上|0|4|1-2","单臂哑铃划船|20|4|8-12/侧","上斜哑铃卧推|15|3|8-12","哑铃侧平举|5|2|12-20","上斜凳反向飞鸟|3|2|12-20","单侧哑铃负重站立|10|2|20-30秒/侧"} };
 final String[] morning={"直刺与剑尖控制 · 8分钟","画圈绕剑与刺环 · 7分钟","安静前进与后退 · 6分钟","手脚协调直刺 · 6分钟","准备活动 · 3分钟","脚跟桥式／腘绳肌 · 5分钟","万向盘腿弯举（不力竭） · 5分钟","死虫式 · 4分钟","鸟狗式 · 3分钟","万向盘小幅推出 · 4分钟","侧平板 · 3分钟","平衡板与髋踝活动 · 6分钟"};
 LinearLayout page; android.content.SharedPreferences prefs;
 int ink=Color.rgb(28,47,65);
 @Override public void onCreate(Bundle b){super.onCreate(b);prefs=getSharedPreferences("jianti_v1",MODE_PRIVATE);home();}
 TextView text(String s,int size){TextView t=new TextView(this);t.setText(s);t.setTextColor(ink);t.setTextSize(size);t.setPadding(12,12,12,12);return t;}
 void init(String title){ScrollView sc=new ScrollView(this);page=new LinearLayout(this);page.setOrientation(1);page.setPadding(18,18,18,30);sc.addView(page);setContentView(sc);page.addView(text(title,24));}
 void button(String s,Runnable r){Button b=new Button(this);b.setText(s);page.addView(b);b.setOnClickListener(v->r.run());}
 void home(){init("剑体训练 · 训练记录");page.addView(text("周一18:00、周四18:00、周六15:00\n每次预约2小时；实际训练以质量为准。",15));for(int i=0;i<3;i++){final int d=i;button(days[i],()->workout(d));}button("每天晨练 · 30分钟重剑+30分钟身体素质",()->morning());button("查看历史训练记录",()->history());page.addView(text("重量单位：kg。哑铃重量按单手录入；引体默认填0表示自重。周四速度组属于热身，不计正式组。",13));}
 void workout(int d){init(days[d]);button("← 返回首页",()->home());page.addView(text("记录每组实际重量和重复次数。符合次数上限、仍有余力且动作合格后再考虑加重。",14));
 for(String row:moves[d]){String[] a=row.split("\\|");String name=a[0];page.addView(text(name+"  ·  "+a[2]+"组 × "+a[3],18));
 int n=Integer.parseInt(a[2]);for(int j=1;j<=n;j++){final int k=j;LinearLayout line=new LinearLayout(this);line.setOrientation(0);TextView lbl=text("第"+j+"组",14);line.addView(lbl);EditText kg=new EditText(this);kg.setSingleLine(true);kg.setInputType(8194);kg.setHint("重量kg");kg.setText(prefs.getString("last:"+name+":kg",a[1]));line.addView(kg,new LinearLayout.LayoutParams(0,140,1));EditText reps=new EditText(this);reps.setSingleLine(true);reps.setInputType(2);reps.setHint("次数");line.addView(reps,new LinearLayout.LayoutParams(0,140,1));Button save=new Button(this);save.setText("保存");line.addView(save);save.setOnClickListener(v->{String rr=reps.getText().toString().trim();if(rr.length()==0){Toast.makeText(this,"请填写次数",0).show();return;}String w=kg.getText().toString().trim();String date=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.CHINA).format(new Date());String rec=date+" | "+name+" | 第"+k+"组 | "+w+"kg × "+rr+"次";String old=prefs.getString("log","");prefs.edit().putString("log",rec+"\n"+old).putString("last:"+name+":kg",w).apply();save.setText("已保存");});page.addView(line);}}
 }
 void morning(){init("每日晨练 · 60分钟");button("← 返回首页",()->home());String date=new SimpleDateFormat("yyyy-MM-dd",Locale.CHINA).format(new Date());for(int i=0;i<morning.length;i++){String item=morning[i];CheckBox c=new CheckBox(this);c.setText(item);c.setTextSize(16);String key="morning:"+date+":"+i;c.setChecked(prefs.getBoolean(key,false));page.addView(c);c.setOnCheckedChangeListener((v,yes)->prefs.edit().putBoolean(key,yes).apply());}page.addView(text("周日实战日可休息。大腿后侧每天可练轻量动作，但高负荷腿弯举不要每天做到力竭。使用万向轮须确认脚踩稳定、承重足够。",14));}
 void history(){init("历史训练");button("← 返回首页",()->home());page.addView(text(prefs.getString("log","还没有训练记录"),14));button("清空历史（不可恢复）",()->new AlertDialog.Builder(this).setTitle("确认清空全部历史？").setNegativeButton("取消",null).setPositiveButton("清空",(d,w)->{prefs.edit().remove("log").apply();history();}).show());}
 @Override public void onBackPressed(){home();}
}