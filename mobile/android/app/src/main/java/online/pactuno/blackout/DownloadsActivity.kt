package online.pactuno.blackout
import android.app.DownloadManager
import android.content.*
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.*
import android.provider.Settings
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import java.util.concurrent.Executors

/** Native download list: independent of the optional system Downloads app/file manager. */
class DownloadsActivity:AppCompatActivity(){
 private val io=Executors.newSingleThreadExecutor();private val handler=Handler(Looper.getMainLooper())
 private var alive=true;private var resumed=false;private var busy=false
 private var entries=listOf<DownloadFiles.Entry>();private lateinit var adapter:ArrayAdapter<DownloadFiles.Entry>;private lateinit var message:TextView
 private val light get()=intent.getBooleanExtra("light",false)
 private val ink get()=if(light)Color.rgb(23,24,32)else Color.rgb(244,241,255)
 private val tick=object:Runnable{override fun run(){refresh();if(resumed)handler.postDelayed(this,1500)}}
 override fun onCreate(state:Bundle?){super.onCreate(state)
  val background=if(light)Color.rgb(245,244,250)else Color.rgb(11,12,18)
  window.statusBarColor=background;window.navigationBarColor=background
  WindowCompat.getInsetsController(window,window.decorView).apply{isAppearanceLightStatusBars=light;isAppearanceLightNavigationBars=light}
  val root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setBackgroundColor(background)};setContentView(root)
  ScreenSafeArea.install(root){val tv=packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)||packageManager.hasSystemFeature(PackageManager.FEATURE_TELEVISION)||(resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK)==Configuration.UI_MODE_TYPE_TELEVISION;getSharedPreferences("blackout_display",MODE_PRIVATE).getInt("tv_margin",if(tv)5 else 0)}
  val bar=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL}
  bar.addView(Button(this).apply{text="Close";contentDescription="Close downloads";setOnClickListener{finish()}})
  bar.addView(TextView(this).apply{text="Downloads";textSize=20f;setTextColor(ink);gravity=Gravity.CENTER},LinearLayout.LayoutParams(0,-2,1f))
  bar.addView(Button(this).apply{text="Refresh";contentDescription="Refresh downloads";setOnClickListener{refresh()}});root.addView(bar)
  message=TextView(this).apply{setTextColor(ink);text="Checking downloads…";setPadding(16,8,16,8)};root.addView(message)
  adapter=object:ArrayAdapter<DownloadFiles.Entry>(this,android.R.layout.simple_list_item_2,android.R.id.text1,mutableListOf()){
   override fun getView(position:Int,recycled:View?,parent:ViewGroup):View{
    val view=super.getView(position,recycled,parent);val item=getItem(position)!!
    view.findViewById<TextView>(android.R.id.text1).apply{text=item.title;if(text.isEmpty())text="Downloaded file";setTextColor(ink);maxLines=2}
    view.findViewById<TextView>(android.R.id.text2).apply{text=DownloadFiles.status(item);setTextColor(ink);maxLines=2}
    view.minimumHeight=(72*resources.displayMetrics.density).toInt();return view
   }
  }
  val list=ListView(this).apply{this.adapter=this@DownloadsActivity.adapter;setOnItemClickListener{_,_,position,_->details(entries[position])}}
  root.addView(list,LinearLayout.LayoutParams(-1,0,1f))
 }
 private fun refresh(){if(!alive||busy)return;busy=true;io.execute{
  val result=runCatching{DownloadFiles.list(this)}
  handler.post{busy=false;if(alive){result.onSuccess{rows->entries=rows;adapter.setNotifyOnChange(false);adapter.clear();adapter.addAll(rows);adapter.notifyDataSetChanged();message.text=if(rows.isEmpty())"No Blackout downloads yet. Downloaded files stay in the device Download folder."else "${rows.size} downloads · Select a completed file to open it."}.onFailure{message.text="Android download service is unavailable or disabled. Check the box’s system app settings."}}}
 }}
 private fun details(item:DownloadFiles.Entry){
  val dialog=AlertDialog.Builder(this).setTitle(item.title.ifBlank{"Downloaded file"}).setMessage(DownloadFiles.status(item)+"\nSaved files are in the device Download folder. Files remain after private browsing closes.").setNegativeButton("Close",null)
  if(item.status==DownloadManager.STATUS_SUCCESSFUL)dialog.setPositiveButton(if(item.title.endsWith(".apk",true))"Install APK" else "Open file"){_,_->open(item)}
  dialog.show()
 }
 private fun open(item:DownloadFiles.Entry){
  try{
   val manager=getSystemService(DOWNLOAD_SERVICE) as DownloadManager
   val row=DownloadFiles.list(this).firstOrNull{it.id==item.id&&it.status==DownloadManager.STATUS_SUCCESSFUL}?:throw IllegalStateException()
   val uri=manager.getUriForDownloadedFile(row.id)?.takeIf{it.scheme=="content"}?:throw IllegalStateException()
   contentResolver.openFileDescriptor(uri,"r")?.use{}?:throw IllegalStateException()
   val apk=row.title.endsWith(".apk",true)||row.mime=="application/vnd.android.package-archive"
   if(apk&&!packageManager.canRequestPackageInstalls()){
    AlertDialog.Builder(this).setTitle("Allow APK installation").setMessage("Android needs your approval for Blackout to open APK installers. Enable Allow from this source in the next screen, return here, then select Install APK again. Blackout cannot install apps silently.").setPositiveButton("Open settings"){_,_->try{startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:$packageName")))}catch(_:ActivityNotFoundException){notice("This box does not provide that settings screen. Use its Security / Install unknown apps settings to allow Blackout.")}}.setNegativeButton("Cancel",null).show();return
   }
   if(row.mime=="application/pdf"||row.title.endsWith(".pdf",true)){startActivity(Intent(this,PdfActivity::class.java).setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));return}
   val mime=if(apk)"application/vnd.android.package-archive" else row.mime.takeIf{Regex("[a-zA-Z0-9.+*-]+/[a-zA-Z0-9.+*-]+").matches(it)}?:"application/octet-stream"
   startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).apply{clipData=ClipData.newRawUri("Downloaded file",uri)})
  }catch(_:ActivityNotFoundException){notice("The file is downloaded, but this box has no app that can open this file type. APKs need an Android package installer. Find the file in the device Download folder.")}
   catch(_:Exception){notice("This file is no longer available. Download it again, then open the completed entry.")}
 }
 private fun notice(text:String){AlertDialog.Builder(this).setTitle("Downloaded file").setMessage(text).setPositiveButton("OK",null).show()}
 override fun onResume(){super.onResume();resumed=true;handler.post(tick)}
 override fun onPause(){resumed=false;handler.removeCallbacks(tick);super.onPause()}
 override fun onDestroy(){alive=false;handler.removeCallbacksAndMessages(null);io.shutdownNow();super.onDestroy()}
}
