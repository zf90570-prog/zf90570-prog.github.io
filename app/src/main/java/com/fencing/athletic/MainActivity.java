package com.fencing.athletic;
import android.app.Activity;
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
import android.widget.Toast;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;

public class MainActivity extends Activity {
    private static final String DOMAIN="appassets.androidplatform.net";
    private static final int REQ_IMPORT=3411, REQ_EXPORT=3412;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String exportContent="";
    private boolean loaded=false;
    @Override public void onCreate(Bundle b){
        super.onCreate(b);
        getWindow().setStatusBarColor(Color.rgb(8,14,24));
        getWindow().setNavigationBarColor(Color.rgb(8,14,24));
        getWindow().getDecorView().setSystemUiVisibility(0);
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(8,14,24));
        WebSettings s=web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new BackupBridge(),"AndroidStorage");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){
                Uri u=req.getUrl();return !("https".equals(u.getScheme())&&DOMAIN.equals(u.getHost()));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){
                Uri u=req.getUrl();
                if(!"https".equals(u.getScheme())||!DOMAIN.equals(u.getHost()))return missing();
                String path=u.getPath();
                if(path==null||path.equals("/"))path="/index.html";
                if(path.contains("..")||path.contains("\\"))return missing();
                String file=path.substring(1);
                String mime=file.endsWith(".js")?"application/javascript":file.endsWith(".css")?"text/css":file.endsWith(".png")?"image/png":"text/html";
                try {
                    InputStream stream=getAssets().open(file);
                    WebResourceResponse resp=new WebResourceResponse(mime,"UTF-8",stream);
                    HashMap<String,String> headers=new HashMap<>();
                    headers.put("Cache-Control","no-cache");
                    resp.setResponseHeaders(headers);
                    return resp;
                }catch(Exception e){return missing();}
            }
            @Override public void onPageFinished(WebView view,String url){loaded=true;}
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
        web.loadUrl("https://"+DOMAIN+"/index.html");
    }
    private static WebResourceResponse missing(){
        WebResourceResponse r=new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));
        r.setStatusCodeAndReasonPhrase(404,"Not Found");
        return r;
    }
    private class BackupBridge{
        @JavascriptInterface public void saveBackup(String content,String filename){
            runOnUiThread(()->{
                exportContent=content;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(filename.toLowerCase().endsWith(".csv")?"text/csv":"application/json");
                intent.putExtra(Intent.EXTRA_TITLE,filename);
                try{startActivityForResult(intent,REQ_EXPORT);}
                catch(Exception e){Toast.makeText(MainActivity.this,"无法打开文件保存界面",Toast.LENGTH_LONG).show();}
            });
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        Uri uri=data==null?null:data.getData();
        if(request==REQ_IMPORT&&fileCallback!=null){
            fileCallback.onReceiveValue(result==RESULT_OK&&uri!=null?new Uri[]{uri}:null);
            fileCallback=null;
        }
        if(request==REQ_EXPORT&&result==RESULT_OK&&uri!=null){
            try(OutputStream os=getContentResolver().openOutputStream(uri)){
                if(os==null)throw new Exception("无法写入");
                os.write(exportContent.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this,"文件已保存",Toast.LENGTH_SHORT).show();
            }catch(Exception e){Toast.makeText(this,"保存失败："+e.getMessage(),Toast.LENGTH_LONG).show();}
        }
    }
    @Override public void onBackPressed(){
        if(loaded&&web!=null){web.evaluateJavascript("window.scrollTo(0,0);document.querySelector('[data-tab=home]').click();",null);}
        else super.onBackPressed();
    }
    @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}super.onDestroy();}
}