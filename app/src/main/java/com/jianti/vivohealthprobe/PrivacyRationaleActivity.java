package com.jianti.vivohealthprobe;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.LinearLayout;

public class PrivacyRationaleActivity extends Activity {
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().setStatusBarColor(Color.rgb(9,17,29));
    getWindow().setNavigationBarColor(Color.rgb(9,17,29));
    ScrollView scroll=new ScrollView(this);
    scroll.setBackgroundColor(Color.rgb(9,17,29));
    LinearLayout layout=new LinearLayout(this);
    layout.setOrientation(LinearLayout.VERTICAL);
    int p=(int)(24*getResources().getDisplayMetrics().density);
    layout.setPadding(p,p,p,p);
    TextView title=new TextView(this);
    title.setText("健康权限用途说明");
    title.setTextColor(Color.WHITE);
    title.setTextSize(25);
    title.setTypeface(null,Typeface.BOLD);
    layout.addView(title);
    TextView body=new TextView(this);
    body.setText("\n此 App 仅用于确认你的 vivo 健康数据能否通过 Android Health Connect 标准授权接口被第三方 App 读取。\n\n申请权限：运动、距离、心率、静息心率、睡眠、HRV、步数、速度、活动消耗热量、VO₂max、体重及体脂。\n\n访问条件：只有你在系统授权页面同意后，才会读取已授权的项目。可以仅授权部分项目，也可以在系统设置中随时撤销。\n\n数据处理：检测时只统计最近30天各类记录的条数、来源应用，以及是否包含游泳会话；报告仅包含少量会话日期，不会导出或分享你的具体心率、体重或睡眠数值。\n\n隐私保障：应用无网络权限，不会上传健康数据；不会写入或更改任何健康记录；不会持久化保存读取到的原始记录。只有你主动点选导出报告，才会将精简报告保存到你选择的位置。\n\n如果未获得权限或数据为空，检测器无法判断 vivo 手表是否在其他私有接口中存在数据。\n\n检测器由用户自行安装，用于本机接口兼容性测试。");
    body.setTextColor(Color.rgb(198,219,227));body.setTextSize(15);body.setLineSpacing(8,1.05f);
    layout.addView(body);
    scroll.addView(layout);setContentView(scroll);
  }
}