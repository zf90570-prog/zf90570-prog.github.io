package com.fencing.athletic;

import android.app.Activity;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.content.ContentValues;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.widget.Toast;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String HOST="appassets.androidplatform.net";
    private static final int REQ_IMPORT=8411, REQ_EXPORT=8412;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String exportContent="";
    private boolean loaded=false;
    private SQLiteDatabase snapshotDb;
    private synchronized SQLiteDatabase snapshotDB(){
        if(snapshotDb==null || !snapshotDb.isOpen()){
            snapshotDb=openOrCreateDatabase("jianti-snapshots.db",MODE_PRIVATE,null);
            snapshotDb.execSQL("CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT, stored_at INTEGER NOT NULL, payload TEXT NOT NULL)");
        }
        return snapshotDb;
    }
    private synchronized String latestSnapshots(){
        org.json.JSONArray data=new org.json.JSONArray();
        try(Cursor c=snapshotDB().rawQuery("SELECT payload FROM snapshots ORDER BY id DESC LIMIT 3",null)){
            while(c.moveToNext())data.put(c.getString(0));
        }catch(Exception ignored){}
        return data.toString();
    }
    private synchronized boolean putSnapshot(String json){
        if(json==null||json.length()>4000000)return false;
        try{
            new org.json.JSONObject(json);
            SQLiteDatabase db=snapshotDB();
            db.beginTransaction();
            try{
                ContentValues values=new ContentValues();
                values.put("stored_at",System.currentTimeMillis());
                values.put("payload",json);
                if(db.insertOrThrow("snapshots",null,values)<0)return false;
                db.execSQL("DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 5)");
                db.setTransactionSuccessful();
            }finally{db.endTransaction();}
            return true;
        }catch(Exception e){return false;}
    }
    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(7,16,25));
        getWindow().setNavigationBarColor(Color.rgb(7,16,25));
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(7,16,25));
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new BackupBridge(),"AndroidStorage");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                return !("https".equals(uri.getScheme()) && HOST.equals(uri.getHost()));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                if(!"https".equals(uri.getScheme()) || !HOST.equals(uri.getHost())) return missing();
                String path=uri.getPath();
                if(path==null || path.equals("/"))path="/index.html";
                if(path.contains("..")||path.contains("\\"))return missing();
                String name=path.substring(1);
                String mime=name.endsWith(".js")?"application/javascript":name.endsWith(".css")?"text/css":"text/html";
                try{return new WebResourceResponse(mime,"UTF-8",getAssets().open(name));}
                catch(Exception e){return missing();}
            }
            @Override public void onPageFinished(WebView v,String url){loaded=true;}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=cb;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                try{startActivityForResult(intent,REQ_IMPORT);return true;}
                catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;return false;}
            }
        });
        setContentView(web);
        web.loadUrl("https://"+HOST+"/index.html");
    }
    private static WebResourceResponse missing(){
        WebResourceResponse r=new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
        r.setStatusCodeAndReasonPhrase(404,"Not Found");return r;
    }
    private class BackupBridge{
        @JavascriptInterface public String getSnapshots(){return latestSnapshots();}
        @JavascriptInterface public boolean persistSnapshot(String json){return putSnapshot(json);}
        @JavascriptInterface public void saveBackup(String content,String filename){
            runOnUiThread(()->{
                exportContent=content;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(filename.toLowerCase().endsWith(".csv")?"text/csv":"application/json");
                intent.putExtra(Intent.EXTRA_TITLE,filename);
                try{startActivityForResult(intent,REQ_EXPORT);}
                catch(Exception e){Toast.makeText(MainActivity.this,"无法打开文件保存对话框",Toast.LENGTH_LONG).show();}
            });
        }
        @JavascriptInterface public void restFinished(){
            runOnUiThread(()->{
                try{Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);if(v!=null&&v.hasVibrator())v.vibrate(VibrationEffect.createOneShot(180,VibrationEffect.DEFAULT_AMPLITUDE));}catch(Exception ignored){}
                Toast.makeText(MainActivity.this,"休息结束，准备下一组",Toast.LENGTH_SHORT).show();
            });
        }
    }
    @Override protected void onActivityResult(int req,int result,Intent data){
        super.onActivityResult(req,result,data);
        Uri uri=data==null?null:data.getData();
        if(req==REQ_IMPORT && fileCallback!=null){
            fileCallback.onReceiveValue(result==RESULT_OK&&uri!=null?new Uri[]{uri}:null);
            fileCallback=null;
        }
        if(req==REQ_EXPORT && result==RESULT_OK && uri!=null){
            try(OutputStream out=getContentResolver().openOutputStream(uri)){
                if(out==null)throw new Exception("无法写入");
                out.write(exportContent.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this,"备份文件已保存",Toast.LENGTH_SHORT).show();
                if(web!=null)web.evaluateJavascript("window.jiantiBackupConfirmed&&window.jiantiBackupConfirmed();",null);
            }catch(Exception e){Toast.makeText(this,"保存失败："+e.getMessage(),Toast.LENGTH_LONG).show();}
        }
    }
    @Override public void onBackPressed(){
        if(loaded&&web!=null)web.evaluateJavascript("document.querySelector('[data-tab=home]').click();",null);
        else super.onBackPressed();
    }
    @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}if(snapshotDb!=null&&snapshotDb.isOpen()){snapshotDb.close();snapshotDb=null;}super.onDestroy();}
}