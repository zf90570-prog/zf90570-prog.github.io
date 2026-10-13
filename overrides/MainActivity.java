package com.fencing.athletic;

import android.app.Activity;
import android.content.Intent;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapRegionDecoder;
import android.graphics.Color;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.widget.Toast;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.zip.*;

public class MainActivity extends Activity {
 private static final String HOST="appassets.androidplatform.net";
 private static final int REQ_JSON_IMPORT=8411,REQ_FILE_EXPORT=8412,REQ_SWIM_PHOTO=8413,REQ_ZIP_EXPORT=8414,REQ_ZIP_IMPORT=8415;
 private static final long MAX_PHOTO=20L*1024*1024,MAX_ZIP=220L*1024*1024;
 private WebView web;
 private ValueCallback<Uri[]> fileCallback;
 private String exportText="", zipPayload="";
 private SQLiteDatabase snapshotDb;
 private final Object dbMutex=new Object();
 private File photoDir(){File d=new File(getFilesDir(),"swim-photos");if(!d.exists())d.mkdirs();return d;}
 private boolean validPhotoId(String id){return id!=null&&id.matches("[0-9a-fA-F-]{36}\\.(?:png|jpg|jpeg|webp)");}
 private File imageFile(String id){return validPhotoId(id)?new File(photoDir(),id):null;}
 private SQLiteDatabase snapshotDB(){synchronized(dbMutex){if(snapshotDb==null||!snapshotDb.isOpen()){
   snapshotDb=openOrCreateDatabase("jianti-snapshots.db",MODE_PRIVATE,null);
   snapshotDb.execSQL("CREATE TABLE IF NOT EXISTS snapshots(id INTEGER PRIMARY KEY AUTOINCREMENT, stored_at INTEGER NOT NULL, payload TEXT NOT NULL)");
 }return snapshotDb;}}
 private String latestSnapshots(){JSONArray data=new JSONArray();try(Cursor c=snapshotDB().rawQuery("SELECT payload FROM snapshots ORDER BY id DESC LIMIT 3",null)){while(c.moveToNext())data.put(c.getString(0));}catch(Exception ignored){}return data.toString();}
 private boolean putSnapshot(String json){if(json==null||json.length()>8_000_000)return false;try{new JSONObject(json);SQLiteDatabase db=snapshotDB();synchronized(dbMutex){db.beginTransaction();try{
 ContentValues v=new ContentValues();v.put("stored_at",System.currentTimeMillis());v.put("payload",json);db.insertOrThrow("snapshots",null,v);
 db.execSQL("DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 5)");db.setTransactionSuccessful();
 }finally{db.endTransaction();}}return true;}catch(Exception e){return false;}}
 @Override public void onCreate(Bundle b){super.onCreate(b);getWindow().setStatusBarColor(Color.rgb(8,14,24));getWindow().setNavigationBarColor(Color.rgb(8,14,24));
 web=new WebView(this);web.setBackgroundColor(Color.rgb(8,14,24));WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
 s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);
 s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
 web.addJavascriptInterface(new StorageBridge(),"AndroidStorage");web.addJavascriptInterface(new SwimBridge(),"JianTiSwim");
 web.setWebViewClient(new WebViewClient(){
  @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){Uri u=request.getUrl();return !("https".equals(u.getScheme())&&HOST.equals(u.getHost()));}
  @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
   Uri u=request.getUrl();if(!"https".equals(u.getScheme())||!HOST.equals(u.getHost()))return missing();
   String path=u.getPath();if(path==null||path.equals("/"))path="/index.html";
   if(path.startsWith("/swim-photo/")){
    String id=path.substring("/swim-photo/".length());File f=imageFile(id);
    if(f==null||!f.isFile())return missing();
    try{return new WebResourceResponse(photoMime(id),null,new FileInputStream(f));}catch(Exception e){return missing();}
   }
   if(path.contains("..")||path.contains("\\"))return missing();String asset=path.substring(1);
   if(asset.contains("/"))return missing();String mime=asset.endsWith(".js")?"application/javascript":asset.endsWith(".css")?"text/css":"text/html";
   try{return new WebResourceResponse(mime,"UTF-8",getAssets().open(asset));}catch(Exception e){return missing();}
  }
 });
 web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){
  if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;
  Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");
  try{startActivityForResult(i,REQ_JSON_IMPORT);return true;}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;return false;}
 }});
 setContentView(web);web.loadUrl("https://"+HOST+"/index.html");}
 private static WebResourceResponse missing(){WebResourceResponse r=new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream("Not found".getBytes(StandardCharsets.UTF_8)));r.setStatusCodeAndReasonPhrase(404,"Not Found");return r;}
 private static String photoMime(String id){if(id.endsWith(".png"))return "image/png";if(id.endsWith(".webp"))return "image/webp";return "image/jpeg";}
 private void notifyJs(String function,String payload){runOnUiThread(()->{if(web!=null)web.evaluateJavascript("window."+function+"&&window."+function+"("+JSONObject.quote(payload)+");",null);});}
 private void popup(String message){runOnUiThread(()->Toast.makeText(this,message,Toast.LENGTH_LONG).show());}
 private final class StorageBridge{
  @JavascriptInterface public String getSnapshots(){return latestSnapshots();}
  @JavascriptInterface public boolean persistSnapshot(String data){return putSnapshot(data);}
  @JavascriptInterface public void saveBackup(String data,String filename){runOnUiThread(()->openExport(data,filename,REQ_FILE_EXPORT));}
  @JavascriptInterface public void restFinished(){runOnUiThread(()->{try{Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);if(v!=null&&v.hasVibrator())v.vibrate(VibrationEffect.createOneShot(180,VibrationEffect.DEFAULT_AMPLITUDE));}catch(Exception ignored){}Toast.makeText(MainActivity.this,"休息结束",Toast.LENGTH_SHORT).show();});}
 }
 private final class SwimBridge{
  @JavascriptInterface public void pickPhoto(){runOnUiThread(()->{
   Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("image/*");i.addCategory(Intent.CATEGORY_OPENABLE);
   try{startActivityForResult(i,REQ_SWIM_PHOTO);}catch(Exception e){popup("系统相册不可用");}
  });}
  @JavascriptInterface public void deletePhoto(String id){File f=imageFile(id);if(f!=null&&f.isFile())f.delete();}
  @JavascriptInterface public void exportFullBackup(String json){runOnUiThread(()->{zipPayload=json;openExport("","剑体训练_完整照片备份.zip",REQ_ZIP_EXPORT);});}
  @JavascriptInterface public void importFullBackup(){runOnUiThread(()->{
   Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.setType("application/zip");i.addCategory(Intent.CATEGORY_OPENABLE);
   try{startActivityForResult(i,REQ_ZIP_IMPORT);}catch(Exception e){popup("系统文件选择器不可用");}
  });}
 }
 private void openExport(String data,String filename,int req){exportText=data;Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);
  i.setType(filename.endsWith(".zip")?"application/zip":filename.endsWith(".csv")?"text/csv":"application/json");i.putExtra(Intent.EXTRA_TITLE,filename);
  try{startActivityForResult(i,req);}catch(Exception e){popup("打开文件保存对话框失败");}}
 @Override protected void onActivityResult(int req,int result,Intent intent){super.onActivityResult(req,result,intent);Uri uri=intent==null?null:intent.getData();
  if(req==REQ_JSON_IMPORT){if(fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&uri!=null?new Uri[]{uri}:null);fileCallback=null;}return;}
  if(result!=RESULT_OK||uri==null)return;
  if(req==REQ_FILE_EXPORT){try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("无法打开输出");out.write(exportText.getBytes(StandardCharsets.UTF_8));popup("文件保存成功");if(web!=null)web.evaluateJavascript("window.jiantiBackupConfirmed&&window.jiantiBackupConfirmed();",null);}catch(Exception e){popup("保存失败："+e.getMessage());}return;}
  if(req==REQ_SWIM_PHOTO){new Thread(()->processPhoto(uri),"swim-image-ocr").start();return;}
  if(req==REQ_ZIP_EXPORT){new Thread(()->exportZip(uri,zipPayload),"swim-zip-export").start();return;}
  if(req==REQ_ZIP_IMPORT){new Thread(()->importZip(uri),"swim-zip-import").start();}
 }
 private String safeExtension(String mime){if("image/png".equals(mime))return ".png";if("image/webp".equals(mime))return ".webp";if("image/jpeg".equals(mime)||"image/jpg".equals(mime))return ".jpg";return "";}
 private static long copyLimited(InputStream in,OutputStream out,long max)throws IOException{byte[] buffer=new byte[32768];long total=0;int n;while((n=in.read(buffer))!=-1){total+=n;if(total>max)throw new IOException("文件大小超过安全上限");out.write(buffer,0,n);}return total;}
 private static final int OCR_TILE_HEIGHT=1550;
 private static final int OCR_TILE_OVERLAP=180;
 private void processPhoto(Uri uri){String id=null;File destination=null;
  try{
   String mime=getContentResolver().getType(uri);
   String ext=safeExtension(mime);
   if(ext.isEmpty())throw new IOException("仅支持 PNG、JPEG 或 WEBP；实际格式："+mime);
   id=UUID.randomUUID().toString()+ext;destination=imageFile(id);
   try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(destination)){
    if(in==null)throw new IOException("无法读取选中的图片");copyLimited(in,out,MAX_PHOTO);
   }
   BitmapFactory.Options size=new BitmapFactory.Options();size.inJustDecodeBounds=true;
   try(InputStream in=new FileInputStream(destination)){BitmapFactory.decodeStream(in,null,size);}
   if(size.outWidth<80||size.outHeight<100)throw new IOException("图片分辨率过低");
   if((long)size.outWidth*size.outHeight>130_000_000L)throw new IOException("图片像素过大，请缩小后重试");
   // The full long screenshot must NOT be downsampled to one tiny bitmap.
   // Recognize overlapping regions at native resolution to preserve 12-20px labels.
   BitmapRegionDecoder decoder=BitmapRegionDecoder.newInstance(destination.getAbsolutePath(),false);
   TextRecognizer recognizer=TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
   int width=decoder.getWidth(),height=decoder.getHeight();
   int sample=width>2400?4:width>1600?2:1;
   int tileHeight=Math.max(OCR_TILE_HEIGHT, (int)(1800L*sample));
   int step=Math.max(400,tileHeight-OCR_TILE_OVERLAP*sample);
   ArrayList<Integer> starts=new ArrayList<>();
   for(int y=0;y<height; y+=step){starts.add(y);if(y+tileHeight>=height)break;}
   JSONObject info=new JSONObject();info.put("imageWidth",width);info.put("imageHeight",height);info.put("tiles",starts.size());info.put("sampling",sample);
   scanOcrTile(0,starts,decoder,recognizer,sample,tileHeight,new JSONArray(),info,id);
  }catch(Exception e){if(destination!=null)destination.delete();notifyPhotoError("图片准备失败："+e.getMessage());}
 }
 private void scanOcrTile(int index,ArrayList<Integer> starts,BitmapRegionDecoder decoder,TextRecognizer recognizer,int sample,int tileHeight,JSONArray collected,JSONObject info,String photoId){
  if(index>=starts.size()){
   try{
    info.put("lines",collected.length());
    JSONObject res=new JSONObject();res.put("ok",true);res.put("id",photoId);
    res.put("url","https://"+HOST+"/swim-photo/"+photoId);res.put("lines",collected);res.put("ocrInfo",info);
    if(collected.length()==0)res.put("warning","本机OCR未检测到文字；请查看完整原图是否清晰");
    else if(info.optInt("imageWidth")<450)res.put("warning","原始长图宽度较低，部分小字可能无法识别，请尝试导出原始分辨率截图");
    notifyJs("jiantiSwimPhotoResult",res.toString());
   }catch(Exception e){notifyPhotoError("OCR结果组织失败："+e.getMessage());}
   finally{recognizer.close();decoder.recycle();}
   return;
  }
  Bitmap tile=null;
  int top=starts.get(index);
  try{
   Rect region=new Rect(0,top,decoder.getWidth(),Math.min(decoder.getHeight(),top+tileHeight));
   BitmapFactory.Options opts=new BitmapFactory.Options();opts.inSampleSize=sample;opts.inPreferredConfig=Bitmap.Config.ARGB_8888;
   tile=decoder.decodeRegion(region,opts);
   if(tile==null)throw new IOException("第"+(index+1)+"段图片解码失败");
   final Bitmap localTile=tile;
   final int fullHeight=decoder.getHeight(), fullWidth=decoder.getWidth();
   recognizer.process(InputImage.fromBitmap(localTile,0))
    .addOnSuccessListener(result->{
      try{
       for(Text.TextBlock block:result.getTextBlocks())for(Text.Line line:block.getLines()){
        Rect r=line.getBoundingBox();if(r==null)continue;
        double absTop=top+(double)r.top*sample;
        // Exclude duplicate lines in the overlapping part (but not the first tile).
        if(index>0 && absTop<top+OCR_TILE_OVERLAP*sample*0.48)continue;
        JSONObject row=new JSONObject();row.put("text",line.getText());
        row.put("x",Math.max(0,Math.min(1,(double)r.left*sample/fullWidth)));
        row.put("y",Math.max(0,Math.min(1,absTop/fullHeight)));
        row.put("w",Math.max(0,(double)r.width()*sample/fullWidth));
        row.put("h",Math.max(0,(double)r.height()*sample/fullHeight));
        collected.put(row);
       }
      }catch(Exception e){popup("第"+(index+1)+"段文字解析异常");}
      finally{localTile.recycle();scanOcrTile(index+1,starts,decoder,recognizer,sample,tileHeight,collected,info,photoId);}
    }).addOnFailureListener(error->{
      try{localTile.recycle();info.put("tileError"+index,error.getClass().getSimpleName()+":"+error.getMessage());}
      catch(Exception ignored){}
      scanOcrTile(index+1,starts,decoder,recognizer,sample,tileHeight,collected,info,photoId);
    });
  }catch(Throwable e){if(tile!=null&&!tile.isRecycled())tile.recycle();
   try{info.put("tileError"+index,e.getClass().getSimpleName());}catch(Exception ignored){}
   scanOcrTile(index+1,starts,decoder,recognizer,sample,tileHeight,collected,info,photoId);
  }
 }
 private void notifyPhotoError(String message){try{JSONObject o=new JSONObject();o.put("ok",false);o.put("error",message);notifyJs("jiantiSwimPhotoResult",o.toString());}catch(Exception ignored){}}
 private static void zipEntry(ZipOutputStream out,String name,byte[] bytes)throws IOException{ZipEntry e=new ZipEntry(name);out.putNextEntry(e);out.write(bytes);out.closeEntry();}
 private void exportZip(Uri outUri,String json){if(json==null||json.length()>8_000_000){popup("备份数据异常");return;}
  try{JSONObject obj=new JSONObject(json);JSONArray reports=obj.optJSONArray("swimReports");
   try(OutputStream target=getContentResolver().openOutputStream(outUri);ZipOutputStream out=new ZipOutputStream(target)){
    zipEntry(out,"training.json",json.getBytes(StandardCharsets.UTF_8));
    HashSet<String> done=new HashSet<>();if(reports!=null)for(int i=0;i<reports.length();i++){
      String id=reports.optJSONObject(i)==null?null:reports.optJSONObject(i).optString("imageId");File f=imageFile(id);
      if(f==null||!f.isFile()||!done.add(id))continue;
      ZipEntry e=new ZipEntry("photos/"+id);out.putNextEntry(e);
      try(InputStream in=new FileInputStream(f)){copyLimited(in,out,MAX_PHOTO);}out.closeEntry();
    }
   }popup("完整ZIP已保存：包含训练数据和现存游泳原图");
  }catch(Exception e){popup("ZIP备份失败："+e.getMessage());}
 }
 private void importZip(Uri input){JSONObject result=new JSONObject();String json=null;int photoCount=0;long bytes=0;
  try(InputStream source=getContentResolver().openInputStream(input);ZipInputStream zip=new ZipInputStream(source)){
   ZipEntry entry;int count=0;HashMap<String,byte[]> images=new HashMap<>();
   while((entry=zip.getNextEntry())!=null){if(++count>1500)throw new IOException("ZIP文件数超过上限");String name=entry.getName();if(entry.isDirectory()){zip.closeEntry();continue;}
    ByteArrayOutputStream data=new ByteArrayOutputStream();long len=copyLimited(zip,data,MAX_PHOTO);bytes+=len;if(bytes>MAX_ZIP)throw new IOException("备份超过220MB");
    if("training.json".equals(name)){json=data.toString("UTF-8");if(json.length()>8_000_000)throw new IOException("训练JSON过大");}
    else if(name.startsWith("photos/")&&validPhotoId(name.substring(7)))images.put(name.substring(7),data.toByteArray());
    zip.closeEntry();
   }
   if(json==null)throw new IOException("ZIP中缺少 training.json");JSONObject saved=new JSONObject(json);if(saved.optJSONArray("logs")==null||saved.optJSONObject("morning")==null)throw new IOException("训练备份结构错误");
   JSONArray reports=saved.optJSONArray("swimReports");HashSet<String> allowed=new HashSet<>();if(reports!=null)for(int i=0;i<reports.length();i++){JSONObject r=reports.optJSONObject(i);if(r!=null&&validPhotoId(r.optString("imageId")))allowed.add(r.optString("imageId"));}
   for(Map.Entry<String,byte[]> e:images.entrySet()){if(!allowed.contains(e.getKey()))continue;File f=imageFile(e.getKey());try(FileOutputStream out=new FileOutputStream(f)){out.write(e.getValue());}photoCount++;}
   result.put("data",saved);result.put("restoredPhotos",photoCount);
  }catch(Exception e){try{result.put("error",e.getMessage());}catch(Exception ignored){}}
  notifyJs("jiantiSwimImportResult",result.toString());
 }
 @Override public void onBackPressed(){if(web!=null)web.evaluateJavascript("document.querySelector('[data-tab=home]').click()",null);else super.onBackPressed();}
 @Override protected void onDestroy(){if(web!=null){web.destroy();web=null;}if(snapshotDb!=null&&snapshotDb.isOpen())snapshotDb.close();super.onDestroy();}
}