package com.jianti.vivohealthprobe;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.health.connect.HealthConnectManager;
import android.health.connect.HealthConnectException;
import android.health.connect.ReadRecordsRequestUsingFilters;
import android.health.connect.ReadRecordsResponse;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.*;
import android.os.Build;
import android.os.Bundle;
import android.os.OutcomeReceiver;
import android.view.View;
import android.widget.*;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.Executor;

public class MainActivity extends Activity {
    static final int BG = Color.rgb(9,17,29), PANEL=Color.rgb(22,35,52), FG=Color.rgb(238,248,249), MUTED=Color.rgb(153,179,195), MINT=Color.rgb(105,230,194);
    static final int REQ_PERM=9003,REQ_EXPORT=9004;
    static final String PREFIX="android.permission.health.";
    final String[][] TYPES={
      {"运动会话","READ_EXERCISE"}, {"心率曲线","READ_HEART_RATE"}, {"游泳/其他距离","READ_DISTANCE"},
      {"静息心率","READ_RESTING_HEART_RATE"}, {"睡眠记录","READ_SLEEP"}, {"心率变异性HRV","READ_HEART_RATE_VARIABILITY"},
      {"移动步数","READ_STEPS"}, {"运动速度","READ_SPEED"}, {"活动消耗热量","READ_ACTIVE_CALORIES_BURNED"},
      {"手表估算VO₂max","READ_VO2_MAX"}, {"体重","READ_WEIGHT"}, {"体脂率","READ_BODY_FAT"}
    };
    final Class<?>[] RECORD_TYPES={
      ExerciseSessionRecord.class, HeartRateRecord.class, DistanceRecord.class,
      RestingHeartRateRecord.class, SleepSessionRecord.class, HeartRateVariabilityRmssdRecord.class,
      StepsRecord.class, SpeedRecord.class, ActiveCaloriesBurnedRecord.class,
      Vo2MaxRecord.class,WeightRecord.class,BodyFatRecord.class
    };
    HealthConnectManager health;
    LinearLayout main, resultBox;
    TextView status, reportText;
    String report="尚未读取。\n";
    boolean running=false;
    int done=0, swimmingSessions=0;
    boolean sourceVivo=false;
    StringBuilder scan = new StringBuilder();
    LinkedHashSet<String> allOrigins=new LinkedHashSet<>();
    StringBuilder sessionDetails=new StringBuilder();
    int vivoInstalled=0;

    int dp(float n){return (int)(getResources().getDisplayMetrics().density*n+0.5f);}
    GradientDrawable bg(int color,int r){GradientDrawable d=new GradientDrawable(); d.setColor(color);d.setCornerRadius(dp(r));return d;}
    TextView label(String s,int sp,int color){TextView t=new TextView(this);t.setText(s);t.setTextSize(sp);t.setTextColor(color);return t;}
    void addSpace(LinearLayout l,int h){View v=new View(this);l.addView(v,new LinearLayout.LayoutParams(1,dp(h)));}
    void addCard(String title,String body) {
      LinearLayout card=new LinearLayout(this);card.setOrientation(1);card.setPadding(dp(16),dp(15),dp(16),dp(15));card.setBackground(bg(PANEL,18));
      TextView t=label(title,17,FG);t.setTypeface(null,Typeface.BOLD);card.addView(t);addSpace(card,7);
      TextView b=label(body,13,MUTED);b.setLineSpacing(dp(3),1f);card.addView(b);
      LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);main.addView(card,p);
    }
    Button button(String s,boolean primary,Runnable fn){
      Button b=new Button(this);b.setText(s);b.setAllCaps(false);b.setTextSize(14);b.setTypeface(null,Typeface.BOLD);
      b.setTextColor(primary?BG:FG);b.setBackground(bg(primary?MINT:PANEL,15));
      LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(52));p.bottomMargin=dp(10);main.addView(b,p);
      b.setOnClickListener(v->fn.run());return b;
    }
    @Override public void onCreate(Bundle b){
      super.onCreate(b);
      getWindow().setStatusBarColor(BG);getWindow().setNavigationBarColor(BG);
      ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackgroundColor(BG);
      main=new LinearLayout(this);main.setOrientation(1);main.setPadding(dp(19),dp(22),dp(19),dp(35));
      scroll.addView(main);setContentView(scroll);
      TextView kicker=label("JIANTI · DATA CONNECTION PROBE",11,MINT);kicker.setLetterSpacing(0.12f);main.addView(kicker);
      addSpace(main,7);TextView title=label("vivo 健康授权检测",26,FG);title.setTypeface(null,Typeface.BOLD);main.addView(title);
      addSpace(main,8);TextView sub=label("X200 Pro × WATCH GT 2\n不需要账号，不联网，不保存你的生理原始数据。",13,MUTED);main.addView(sub);
      addSpace(main,18);
      status=label("准备检测环境……",14,MINT);main.addView(status);addSpace(main,14);
      button("① 检测系统与 vivo 健康",true,this::environment);
      button("② 请求健康数据读取授权",false,this::askPermission);
      button("③ 读取最近30天（只读）",false,this::startScan);
      button("复制精简检测报告",false,this::copyReport);
      button("保存精简报告 .txt",false,this::exportReport);
      addCard("检测的12类数据","运动会话、心率、距离、静息心率、睡眠、HRV、步数、速度、活动热量、VO₂max、体重、体脂。\n\n游泳每趟时间、SWOLF、划水次数等 vivo 专有明细不一定通过标准接口共享。");
      addCard("如何解读","有权限 ≠ 有数据；数据来自其他 App ≠ 数据来自 vivo。\n未找到记录也可能是：vivo 未向公共数据层写入、尚未打开健康同步、记录超过30天、权限未获批或设备不支持。");
      reportText=label("",12,FG);reportText.setTextIsSelectable(true);reportText.setPadding(dp(12),dp(8),dp(12),dp(8));
      resultBox=new LinearLayout(this);resultBox.setOrientation(1);resultBox.setBackground(bg(PANEL,14));resultBox.addView(reportText);
      main.addView(resultBox,new LinearLayout.LayoutParams(-1,-2));
      environment();
    }
    boolean isInstalled(String pkg){
      try{getPackageManager().getPackageInfo(pkg,0);return true;}catch(Exception e){return false;}
    }
    void environment(){
      if(running)return;
      boolean vivo=isInstalled("com.vivo.health"), hcPkg=isInstalled("com.google.android.apps.healthdata");
      vivoInstalled=vivo?1:0;
      if(Build.VERSION.SDK_INT>=34){try{health=getSystemService(HealthConnectManager.class);}catch(Throwable e){health=null;}}
      else health=null;
      String healthState=(health!=null?"可获取 Android Health Connect 服务":"未找到 Android Health Connect 服务");
      status.setText("vivo 健康："+(vivo?"已安装":"未检测到")+"；"+healthState);
      StringBuilder s=new StringBuilder();
      s.append("设备：").append(Build.MANUFACTURER).append(" ").append(Build.MODEL)
       .append("\nAndroid API：").append(Build.VERSION.SDK_INT)
       .append("\nvivo健康 com.vivo.health：").append(vivo?"已安装":"未检测到")
       .append("\nHealth Connect APK：").append(hcPkg?"检测到":"未检测到（部分新版Android以系统模块形式提供）")
       .append("\nHealth Connect 系统服务：").append(health!=null?"可用":"不可用或受系统限制")
       .append("\n已授予读取权限：");
      int granted=0;for(String[] t:TYPES){if(checkSelfPermission(PREFIX+t[1])==PackageManager.PERMISSION_GRANTED)granted++;}
      s.append(granted).append("/").append(TYPES.length);
      s.append("\n\n这里只检测可用性，还未读取健康数据。\n");
      report=s.toString();reportText.setText(report);
    }
    void askPermission(){
      if(running)return;
      environment();
      if(health==null){new AlertDialog.Builder(this).setTitle("公共健康接口不可用").setMessage("没有获取到系统 Health Connect 服务。\n\n这不代表 vivo 健康没有手表数据；它只表示当前无法通过此标准接口请求访问。").setPositiveButton("知道了",null).show();return;}
      new AlertDialog.Builder(this).setTitle("请求读取权限（由你决定）")
       .setMessage("本检测器只申请运动、心率、睡眠、HRV等12类只读权限，用于判断数据是否被共享。\n\n不会申请写入、网络、蓝牙、通讯录或文件权限，也不会上传数据。你可以只批准部分权限。")
       .setNegativeButton("暂不授权",null)
       .setPositiveButton("打开系统授权页",(d,w)->{
         String[] p=new String[TYPES.length];for(int i=0;i<TYPES.length;i++)p[i]=PREFIX+TYPES[i][1];
         try{requestPermissions(p,REQ_PERM);}
         catch(Throwable e){status.setText("请求权限失败："+e.getClass().getSimpleName()+":"+e.getMessage());}
       }).show();
    }
    @Override public void onRequestPermissionsResult(int req,String[] p,int[] grants){
      super.onRequestPermissionsResult(req,p,grants);
      if(req==REQ_PERM){environment();Toast.makeText(this,"授权窗口已返回；可开始读取",Toast.LENGTH_LONG).show();}
    }
    static final class Counts{
      int n=0,samples=0,swim=0,laps=0;
      boolean truncated=false;
      LinkedHashSet<String> origins=new LinkedHashSet<>();
      String example="";
    }
    void startScan(){
      if(running)return;
      environment();
      if(health==null){status.setText("不能读取：系统未开放 Health Connect 服务。");return;}
      running=true;done=0;swimmingSessions=0;sourceVivo=false;allOrigins.clear();sessionDetails.setLength(0);scan.setLength(0);
      scan.append("【vivo 健康数据授权检测 · 最近30天】\n");
      scan.append("设备 ").append(Build.MANUFACTURER).append(" ").append(Build.MODEL).append(" · Android API ").append(Build.VERSION.SDK_INT).append("\n");
      scan.append("vivo健康安装：").append(vivoInstalled==1?"是":"未检测到").append("\n");
      scan.append("Health Connect：服务可用\n");
      scan.append("采样时间：").append(new Date()).append("\n");
      scan.append("范围：本次操作前30天；最多每类3000条记录，不代表完整历史。\n\n");
      status.setText("正在读取，请稍等……");
      scanItem(0);
    }
    @SuppressWarnings("unchecked")
    <T extends android.health.connect.datatypes.Record> void scanItem(int i){
      if(i>=TYPES.length){finishScan();return;}
      String name=TYPES[i][0], permission=PREFIX+TYPES[i][1];
      if(checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED){
        scan.append("• ").append(name).append("：未授权/已拒绝\n");
        scanItem(i+1);return;
      }
      try{
        Class<T> type=(Class<T>)RECORD_TYPES[i];
        Counts counts=new Counts();
        readPages(type,i,counts,-1,0);
      }catch(Throwable e){
        scan.append("• ").append(name).append("：接口异常 ").append(e.getClass().getSimpleName()).append("\n");
        scanItem(i+1);
      }
    }
    <T extends android.health.connect.datatypes.Record> void readPages(Class<T> type,int idx,Counts total,long token,int pages){
      try{
        ReadRecordsRequestUsingFilters.Builder<T> builder=new ReadRecordsRequestUsingFilters.Builder<>(type)
            .setTimeRangeFilter(new TimeInstantRangeFilter.Builder().setStartTime(Instant.now().minus(30,ChronoUnit.DAYS)).setEndTime(Instant.now()).build())
            .setPageSize(500);
        if(token!=-1)builder.setPageToken(token);
        health.readRecords(builder.build(),getMainExecutor(),new OutcomeReceiver<ReadRecordsResponse<T>,HealthConnectException>(){
          @Override public void onResult(ReadRecordsResponse<T> res){
            for(T r:res.getRecords()){
              total.n++;
              String src="?";try{src=r.getMetadata().getDataOrigin().getPackageName();}catch(Exception ignored){}
              if(src==null)src="?";
              total.origins.add(src);allOrigins.add(src);
              if(src.equals("com.vivo.health"))sourceVivo=true;
              if(r instanceof HeartRateRecord)total.samples+=((HeartRateRecord)r).getSamples().size();
              if(r instanceof ExerciseSessionRecord){
                 ExerciseSessionRecord ex=(ExerciseSessionRecord)r;
                 int type=ex.getExerciseType();
                 if(type==ExerciseSessionType.EXERCISE_SESSION_TYPE_SWIMMING_POOL || type==ExerciseSessionType.EXERCISE_SESSION_TYPE_SWIMMING_OPEN_WATER){
                   total.swim++;swimmingSessions++;
                   int lapCount=ex.getLaps().size();total.laps+=lapCount;
                   if(total.swim<=5){
                     sessionDetails.append("泳池/开放水域运动：").append(ex.getStartTime())
                      .append(" · ").append((ex.getEndTime().toEpochMilli()-ex.getStartTime().toEpochMilli())/60000)
                      .append(" 分钟 · laps=").append(lapCount).append(" · 数据来源=").append(src).append("\n");
                   }
                 }
              }
            }
            if(res.getNextPageToken()!=-1 && pages<5 && total.n<3000) {
               readPages(type,idx,total,res.getNextPageToken(),pages+1);
            }else{
               if(res.getNextPageToken()!=-1)total.truncated=true;
               scan.append("• ").append(TYPES[idx][0]).append("：").append(total.n)
               .append(total.truncated?"（达到本次上限）":"").append(" 条");
               if(total.samples>0)scan.append("，心率样本").append(total.samples).append("个");
               if(total.swim>0)scan.append("，游泳").append(total.swim).append("次、laps=").append(total.laps);
               scan.append("\n   数据来源：").append(total.origins.isEmpty()?"无":String.join(", ",total.origins)).append("\n");
               status.setText("已检测 "+(idx+1)+"/"+TYPES.length+" 类数据");
               scanItem(idx+1);
            }
          }
          @Override public void onError(HealthConnectException e){
            scan.append("• ").append(TYPES[idx][0]).append("：读取失败 [").append(e.getErrorCode()).append("] ").append(e.getMessage()).append("\n");
            scanItem(idx+1);
          }
        });
      }catch(Throwable t){
        scan.append("• ").append(TYPES[idx][0]).append("：运行异常 ").append(t.getClass().getSimpleName()).append("：").append(t.getMessage()).append("\n");
        scanItem(idx+1);
      }
    }
    void finishScan(){
      running=false;
      scan.append("\n【游泳可用性】\n");
      scan.append("检测到游泳会话：").append(swimmingSessions).append(" 次\n");
      scan.append("检测到 vivo 作为共享来源：").append(sourceVivo?"是":"否/本次未检出").append("\n");
      scan.append("所有检测到的数据来源：").append(allOrigins.isEmpty()?"无":String.join(", ",allOrigins)).append("\n");
      if(sessionDetails.length()>0){scan.append("\n【最近游泳记录（无心率数值）】\n").append(sessionDetails);}
      scan.append("\n【如何判断】\n");
      scan.append("1. 有 vivo 来源 + 游泳会话 + 心率或距离：可能可以直接导入基本训练数据。\n");
      scan.append("2. 有心率/运动但无 vivo 来源：说明标准接口有数据，不能确认是 WATCH GT 2 写入。\n");
      scan.append("3. 无记录：可能未同步、未授权或公共接口未承载 vivo 数据；不能据此证明无法通过合作API读取。\n");
      scan.append("4. SWOLF、划水频率、每趟配速不属于本测试保证可读取的标准字段；需要单独确认 vivo 是否共享。\n");
      scan.append("\n隐私：只显示记录数量、应用来源和部分会话时间；不包含具体心率、体重、睡眠值；本 App 不联网，不保留历史扫描原始数据。");
      report=scan.toString();
      reportText.setText(report);status.setText("检测完成 · "+swimmingSessions+" 次游泳记录 · "+(sourceVivo?"发现vivo数据来源":"未检出vivo来源"));
    }
    void copyReport(){
      ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("vivo健康检测报告",report));
      Toast.makeText(this,"已复制精简报告，可粘贴给 ChatGPT",Toast.LENGTH_SHORT).show();
    }
    void exportReport(){
      Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.setType("text/plain");i.addCategory(Intent.CATEGORY_OPENABLE);i.putExtra(Intent.EXTRA_TITLE,"vivo健康授权检测报告.txt");
      try{startActivityForResult(i,REQ_EXPORT);}catch(Exception e){Toast.makeText(this,"无法打开文件保存窗口",Toast.LENGTH_LONG).show();}
    }
    @Override protected void onActivityResult(int req,int result,Intent data){
      super.onActivityResult(req,result,data);
      if(req==REQ_EXPORT&&result==RESULT_OK&&data!=null&&data.getData()!=null){
        try(OutputStream out=getContentResolver().openOutputStream(data.getData())){
          if(out!=null){out.write(report.getBytes(StandardCharsets.UTF_8));Toast.makeText(this,"报告已保存",Toast.LENGTH_SHORT).show();}
        }catch(Exception e){Toast.makeText(this,"保存失败："+e.getMessage(),Toast.LENGTH_LONG).show();}
      }
    }
}