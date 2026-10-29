package online.pactuno.blackout

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.app.PictureInPictureParams
import android.content.*
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.*
import android.media.MediaPlayer
import android.net.Uri
import android.net.http.SslError
import android.os.*
import android.util.Rational
import android.view.*
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.*
import android.widget.*
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.core.view.WindowCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.util.UUID

open class BrowserActivity : AppCompatActivity() {
 companion object{private var privateStorageInitialized=false}
 data class Tab(val id:String=UUID.randomUUID().toString(),var url:String=BrowserPolicy.HOME,var title:String="New tab",var web:WebView?=null,var favicon:Bitmap?=null)
 private val tabs=mutableListOf<Tab>();private val closed=ArrayDeque<Tab>();private var active=0;private var restoring=false
 private val privateSession get()=this is PrivateActivity
 protected open val tv get()=packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)||packageManager.hasSystemFeature(PackageManager.FEATURE_TELEVISION)||(resources.configuration.uiMode and Configuration.UI_MODE_TYPE_MASK)==Configuration.UI_MODE_TYPE_TELEVISION
 private val displayPrefs by lazy{getSharedPreferences("blackout_display",MODE_PRIVATE)}
 private val prefs by lazy{getSharedPreferences(if(privateSession)"blackout_private_ui" else "blackout_desktop_ui",MODE_PRIVATE)}
 private lateinit var favorites:FavoritesManager;private lateinit var history:HistoryManager;private lateinit var search:SearchEngineManager
 private lateinit var root:LinearLayout;private lateinit var content:FrameLayout;private lateinit var tabStrip:LinearLayout;private lateinit var tabScroll:HorizontalScrollView;private lateinit var bookmarkStrip:LinearLayout
 private lateinit var address:EditText;private lateinit var status:TextView;private lateinit var progress:ProgressBar;private lateinit var home:WebView
 private var homeReady=false;private var customView:View?=null;private var customCallback:WebChromeClient.CustomViewCallback?=null;private var player:MediaPlayer?=null
 private var uploadCallback:ValueCallback<Array<Uri>>?=null;private var uploadMultiple=false;private var downloadPending:Pair<String,String>?=null;private var destroyed=false
 private var cursorMode=false;private var cursorX=300f;private var cursorY=240f;private var desktopSite=false
 private val blockHosts=setOf("doubleclick.net","googlesyndication.com","google-analytics.com","hotjar.com","taboola.com","outbrain.com","adnxs.com","scorecardresearch.com")
 private val uploadPicker=registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()){uris->val safe=uris.filter{it.scheme=="content"};uploadCallback?.onReceiveValue((if(uploadMultiple)safe else safe.take(1)).toTypedArray());uploadCallback=null}
 private val pdfPicker=registerForActivityResult(ActivityResultContracts.OpenDocument()){uri->if(uri!=null)startActivity(Intent(this,PdfActivity::class.java).setData(uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))}
 private val musicPicker=registerForActivityResult(ActivityResultContracts.OpenDocument()){uri->if(uri!=null)playAudio(uri)}
 private val storagePermission=registerForActivityResult(ActivityResultContracts.RequestPermission()){ok->val pending=downloadPending;downloadPending=null;if(ok&&pending!=null)enqueueDownload(pending.first,pending.second)else if(!ok)toast("Download permission was not granted.")}
 private fun dp(n:Int)=(n*resources.displayMetrics.density).toInt()
 private val light get()=prefs.getString("surface","dark")=="light"
 private val ink get()=Color.parseColor(if(light)"#171820" else "#f4f1ff")
 private val surfaceColor get()=Color.parseColor(if(light)"#f5f4fa" else "#0b0c12")
 private val accent get()=Color.parseColor(when(prefs.getString("theme","eclipse")){"ember"->"#ff875c";"aurora"->"#69e0d2";else->"#a58aff"})
 private fun current()=tabs.getOrNull(active)

 override fun onCreate(savedInstanceState:Bundle?){
  if(privateSession&&Build.VERSION.SDK_INT>=28&&!privateStorageInitialized){WebView.setDataDirectorySuffix("blackout-private");privateStorageInitialized=true}
  super.onCreate(savedInstanceState);favorites=FavoritesManager(this);history=HistoryManager(this);search=SearchEngineManager(this)
  window.statusBarColor=surfaceColor;window.navigationBarColor=surfaceColor;buildChrome();syncSystemBars()
  try{home=createHome()}catch(_:Throwable){AlertDialog.Builder(this).setTitle("Android WebView is unavailable").setMessage("Install or update Android System WebView using your device's app store, then reopen Blackout.").setPositiveButton("Close"){_,_->finish()}.setCancelable(false).show();return}
  onBackPressedDispatcher.addCallback(this,object:OnBackPressedCallback(true){override fun handleOnBackPressed(){when{customView!=null->exitFullscreen();cursorMode->{cursorMode=false;toast("Cursor off")};current()?.url!=BrowserPolicy.HOME&&current()?.web?.canGoBack()==true->current()?.web?.goBack();current()?.url!=BrowserPolicy.HOME->navigate(BrowserPolicy.HOME);tabs.size>1->closeTab(active);else->finish()}}})
  val initial=BrowserPolicy.webUrl(intent?.data?.toString().orEmpty())
  if(privateSession){CookieManager.getInstance().removeAllCookies{WebStorage.getInstance().deleteAllData();if(!destroyed)newTab(initial?:BrowserPolicy.HOME)}}else{restoreTabs();if(initial!=null)newTab(initial);if(tabs.isEmpty())newTab()else selectTab(active)}
 }
 private fun buildChrome(){
  root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setBackgroundColor(surfaceColor)};setContentView(root);ScreenSafeArea.install(root){displayPrefs.getInt("tv_margin",if(tv)5 else 0)}
  val tabsRow=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL;setPadding(dp(6),dp(3),dp(6),dp(3))}
  tabStrip=LinearLayout(this);tabScroll=HorizontalScrollView(this).apply{isHorizontalScrollBarEnabled=false;addView(tabStrip)}
  tabsRow.addView(tabScroll,LinearLayout.LayoutParams(0,dp(46),1f));tabsRow.addView(button("+","New tab"){newTab()});root.addView(tabsRow)
  val nav=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL;setPadding(dp(6),0,dp(6),0)}
  nav.addView(button("‹","Back"){if(current()?.web?.canGoBack()==true)current()?.web?.goBack()else navigate(BrowserPolicy.HOME)})
  if(resources.configuration.screenWidthDp>=600)nav.addView(button("›","Forward"){current()?.web?.goForward()})
  nav.addView(button("↻","Reload"){if(current()?.url==BrowserPolicy.HOME)refreshHome()else if(current()?.web==null)current()?.url?.let{navigate(it)}else current()?.web?.reload()})
  address=EditText(this).apply{setSingleLine(true);textSize=14f;setTextColor(ink);setHintTextColor(Color.GRAY);hint="Search or enter address";inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_URI;imeOptions=EditorInfo.IME_ACTION_GO;setSelectAllOnFocus(true);setPadding(dp(12),0,dp(12),0);setBackgroundResource(R.drawable.bg_chin_omnibar);setOnEditorActionListener{_,id,event->if(id==EditorInfo.IME_ACTION_GO||(event?.keyCode==KeyEvent.KEYCODE_ENTER&&event.action==KeyEvent.ACTION_DOWN)){navigate(text.toString());(getSystemService(INPUT_METHOD_SERVICE)as InputMethodManager).hideSoftInputFromWindow(windowToken,0);clearFocus();true}else false}}
  nav.addView(address,LinearLayout.LayoutParams(0,dp(48),1f));nav.addView(button("⋮","Menu"){showMenu()});root.addView(nav)
  address.background=android.graphics.drawable.GradientDrawable().apply{setColor(if(light)Color.WHITE else Color.parseColor("#171820"));cornerRadius=dp(18).toFloat()}
  val row=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL};val scroll=HorizontalScrollView(this).apply{isHorizontalScrollBarEnabled=false};bookmarkStrip=LinearLayout(this);scroll.addView(bookmarkStrip)
  row.addView(button("‹","Previous bookmarks"){scroll.smoothScrollBy(-dp(240),0)});row.addView(scroll,LinearLayout.LayoutParams(0,dp(40),1f));row.addView(button("›","Next bookmarks"){scroll.smoothScrollBy(dp(240),0)});root.addView(row);refreshBookmarks()
  progress=ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply{visibility=View.GONE;max=100};root.addView(progress,LinearLayout.LayoutParams(-1,dp(3)))
  status=TextView(this).apply{setTextColor(ink);textSize=11f;setPadding(dp(14),dp(2),dp(14),dp(2));text=if(privateSession)"Private session · separate website storage" else "Blackout · Android early access"};root.addView(status)
  content=FrameLayout(this);root.addView(content,LinearLayout.LayoutParams(-1,0,1f))
 }
 private fun button(symbol:String,label:String,action:()->Unit):TextView=TextView(this).apply{text=symbol;contentDescription=label;textSize=22f;gravity=Gravity.CENTER;setTextColor(ink);isClickable=true;isFocusable=true;minWidth=dp(44);minHeight=dp(44);setPadding(dp(8),0,dp(8),0);setBackgroundResource(android.R.drawable.list_selector_background);setOnClickListener{action()};setOnFocusChangeListener{_,focus->setBackgroundColor(if(focus)accent else Color.TRANSPARENT);setTextColor(if(focus)Color.BLACK else ink)}}
 private fun refreshBookmarks(){bookmarkStrip.removeAllViews();favorites.getFavorites().take(100).forEach{item->bookmarkStrip.addView(TextView(this).apply{text=item.title.take(22);contentDescription="Bookmark ${item.title}";setTextColor(ink);textSize=12f;gravity=Gravity.CENTER;isFocusable=true;isClickable=true;setPadding(dp(12),dp(8),dp(12),dp(8));setBackgroundResource(android.R.drawable.list_selector_background);setOnClickListener{navigate(item.url)}})}}
 @SuppressLint("SetJavaScriptEnabled") private fun createHome():WebView{
  val loader=WebViewAssetLoader.Builder().addPathHandler("/assets/",WebViewAssetLoader.AssetsPathHandler(this)).build()
  return WebView(this).apply{setBackgroundColor(surfaceColor);settings.javaScriptEnabled=true;settings.domStorageEnabled=false;settings.allowFileAccess=false;settings.allowContentAccess=false;settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW;settings.setSupportMultipleWindows(false)
   // Trusted static dashboard has no JavaScript interface and cannot host frames.
   webViewClient=object:WebViewClient(){override fun shouldInterceptRequest(view:WebView,request:WebResourceRequest):WebResourceResponse?=if(request.url.host=="appassets.androidplatform.net")loader.shouldInterceptRequest(request.url)else null
    override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean{if(request.isForMainFrame&&request.url.host=="blackout.invalid"){homeAction(request.url);return true};return request.url.host!="appassets.androidplatform.net"}
    override fun onPageFinished(view:WebView,url:String){homeReady=true;refreshHome()}}
   loadUrl("https://appassets.androidplatform.net/assets/ui/index.html")}
 }
 private fun homeAction(u:Uri){when(u.path){"/navigate"->navigate(u.getQueryParameter("url").orEmpty());"/menu"->showMenu();"/bookmarks"->showBookmarks();"/history"->showHistory();"/music"->pickMusic();"/pdf"->pickPdf();"/theme"->{val t=u.getQueryParameter("value");if(t in listOf("eclipse","ember","aurora")){prefs.edit().putString("theme",t).apply();refreshHome()}};"/surface"->{prefs.edit().putString("surface",if(light)"dark" else "light").apply();rebuildChrome()};"/private"->openPrivate()}}
 private fun refreshHome(){if(!homeReady||!::home.isInitialized)return;val items=JSONArray();favorites.getFavorites().take(100).forEach{items.put(JSONObject().put("title",it.title.take(100)).put("url",it.url))};val data=JSONObject().put("favorites",items).put("theme",prefs.getString("theme","eclipse")).put("surface",if(light)"light" else "dark").put("private",privateSession).put("engine",search.getCurrentEngine().name).put("tv",tv);home.evaluateJavascript("window.renderHome && window.renderHome($data);",null)}
 private fun syncSystemBars(){val controller=WindowCompat.getInsetsController(window,window.decorView);controller.isAppearanceLightStatusBars=light;controller.isAppearanceLightNavigationBars=light}
 private fun rebuildChrome(){val selected=active;content.removeAllViews();buildChrome();selectTab(selected);window.statusBarColor=surfaceColor;window.navigationBarColor=surfaceColor;syncSystemBars();address.background=android.graphics.drawable.GradientDrawable().apply{setColor(if(light)Color.WHITE else Color.parseColor("#171820"));cornerRadius=dp(18).toFloat()};refreshHome()}
 @SuppressLint("SetJavaScriptEnabled") private fun website(tab:Tab):WebView=WebView(this).apply{
  setBackgroundColor(Color.WHITE);settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.allowFileAccess=false;settings.allowContentAccess=false;settings.mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW;settings.javaScriptCanOpenWindowsAutomatically=false;settings.setSupportMultipleWindows(true);settings.mediaPlaybackRequiresUserGesture=true;settings.setSupportZoom(true);settings.builtInZoomControls=true;settings.displayZoomControls=false;settings.useWideViewPort=true;settings.loadWithOverviewMode=true;settings.safeBrowsingEnabled=true
  if(Build.VERSION.SDK_INT>=29)settings.forceDark=WebSettings.FORCE_DARK_OFF
  if(Build.VERSION.SDK_INT>=33)settings.isAlgorithmicDarkeningAllowed=false
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(this,false)
  settings.cacheMode=if(privateSession)WebSettings.LOAD_NO_CACHE else WebSettings.LOAD_DEFAULT
  webViewClient=object:WebViewClient(){
   override fun shouldOverrideUrlLoading(view:WebView,request:WebResourceRequest):Boolean{val url=request.url.toString();if(BrowserPolicy.webUrl(url)!=null)return false;if(request.isForMainFrame&&request.hasGesture()&&request.url.scheme in listOf("mailto","tel"))try{startActivity(Intent(Intent.ACTION_VIEW,request.url))}catch(_:Exception){toast("No suitable app is installed.")};return true}
   override fun shouldInterceptRequest(view:WebView,request:WebResourceRequest):WebResourceResponse?{val host=request.url.host?.lowercase().orEmpty();val unsafe=request.url.scheme in listOf("file","content")||host in listOf("appassets.androidplatform.net","blackout.invalid");val tracker=!request.isForMainFrame&&prefs.getBoolean("shield",true)&&blockHosts.any{host==it||host.endsWith(".$it")};return if(unsafe||tracker)WebResourceResponse("text/plain","UTF-8",ByteArrayInputStream(ByteArray(0)))else null}
   override fun onPageStarted(view:WebView,url:String,favicon:Bitmap?){if(BrowserPolicy.webUrl(url)!=null){tab.url=url;updateAddress();saveTabs()}}
   override fun onPageFinished(view:WebView,url:String){if(BrowserPolicy.webUrl(url)!=null){tab.url=url;if(!privateSession)history.addVisit(tab.title,url);updateAddress();saveTabs()}}
   override fun onReceivedSslError(view:WebView,handler:SslErrorHandler,error:SslError){handler.cancel();if(tab==current())status.text="Connection blocked: website certificate is invalid."}
   override fun onReceivedError(view:WebView,request:WebResourceRequest,error:WebResourceError){if(request.isForMainFrame&&tab==current())status.text="Page could not load. Check the address, connection or Android WebView update."}
   override fun onRenderProcessGone(view:WebView,detail:RenderProcessGoneDetail):Boolean{(view.parent as?ViewGroup)?.removeView(view);view.destroy();tab.web=null;if(tab==current()){status.text="This tab stopped. Reload to reopen it.";showHome()};return true}
  }
  webChromeClient=object:WebChromeClient(){
   override fun onProgressChanged(view:WebView,n:Int){if(tab==current()){this@BrowserActivity.progress.progress=n;this@BrowserActivity.progress.visibility=if(n in 1..99)View.VISIBLE else View.GONE}}
   override fun onReceivedTitle(view:WebView,title:String?){tab.title=title?.take(150)?.ifBlank{"Tab"}?:"Tab";renderTabs();saveTabs()}
   override fun onReceivedIcon(view:WebView,icon:Bitmap?){tab.favicon=icon;renderTabs()}
   override fun onPermissionRequest(request:PermissionRequest){runOnUiThread{request.deny()}}
   override fun onGeolocationPermissionsShowPrompt(origin:String,callback:GeolocationPermissions.Callback){callback.invoke(origin,false,false)}
   override fun onShowFileChooser(view:WebView,callback:ValueCallback<Array<Uri>>,params:FileChooserParams):Boolean{uploadCallback?.onReceiveValue(null);uploadCallback=callback;uploadMultiple=params.mode==FileChooserParams.MODE_OPEN_MULTIPLE;try{val types=params.acceptTypes.flatMap{it.split(',')}.map{it.trim()}.filter{Regex("[a-zA-Z0-9.+*-]+/[a-zA-Z0-9.+*-]+").matches(it)}.take(10).toTypedArray();uploadPicker.launch(if(types.isEmpty())arrayOf("*/*")else types)}catch(_:Exception){uploadCallback=null;callback.onReceiveValue(null)};return true}
   override fun onCreateWindow(view:WebView,isDialog:Boolean,isUserGesture:Boolean,resultMsg:Message):Boolean{if(!isUserGesture)return false;newTab();val t=current()?:return false;if(t.web==null)t.web=website(t);content.removeAllViews();content.addView(t.web,FrameLayout.LayoutParams(-1,-1));val transport=resultMsg.obj as WebView.WebViewTransport;transport.webView=t.web;resultMsg.sendToTarget();return true}
   override fun onCloseWindow(window:WebView){val i=tabs.indexOfFirst{it.web==window};if(i>=0)closeTab(i)}
   override fun onShowCustomView(view:View,callback:CustomViewCallback){if(customView!=null){callback.onCustomViewHidden();return};customView=view;customCallback=callback;addContentView(view,ViewGroup.LayoutParams(-1,-1));window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
   override fun onHideCustomView(){exitFullscreen()}
  }
  setDownloadListener{url,_,disposition,mime,_->askDownload(url,URLUtil.guessFileName(url,disposition,mime))}
  setOnLongClickListener{val url=hitTestResult.extra;if(url!=null&&BrowserPolicy.webUrl(url)!=null){AlertDialog.Builder(this@BrowserActivity).setItems(arrayOf("Open in new tab","Copy link")){_,which->if(which==0)newTab(url)else{(getSystemService(CLIPBOARD_SERVICE)as ClipboardManager).setPrimaryClip(ClipData.newPlainText("Link",url));toast("Link copied")}}.show();true}else false}
 }
 private fun newTab(url:String=BrowserPolicy.HOME){if(tabs.size>=32){toast("32 tabs open. Close one first.");return};tabs.add(Tab(url=if(url==BrowserPolicy.HOME)url else BrowserPolicy.webUrl(url)?:BrowserPolicy.HOME));selectTab(tabs.lastIndex)}
 private fun selectTab(index:Int){active=index.coerceIn(0,(tabs.size-1).coerceAtLeast(0));val tab=current()?:return;content.removeAllViews();if(tab.url==BrowserPolicy.HOME)showHome()else{val view=tab.web?:website(tab).also{tab.web=it;it.loadUrl(tab.url)};(view.parent as?ViewGroup)?.removeView(view);content.addView(view,FrameLayout.LayoutParams(-1,-1));view.onResume();view.requestFocus()};renderTabs();revealActiveTab();updateAddress();saveTabs();tabs.filter{it!=tab&&it.web!=null}.dropLast(3).forEach{it.web?.destroy();it.web=null}}
 private fun showHome(){if(!::home.isInitialized)return;(home.parent as?ViewGroup)?.removeView(home);content.removeAllViews();content.addView(home,FrameLayout.LayoutParams(-1,-1));refreshHome()}
 private fun navigate(raw:String){val url=BrowserPolicy.navigate(raw,search.getCurrentEngine().searchUrlTemplate);if(url==null){toast("This address or file type cannot be opened as a website.");return};val tab=current()?:return;(getSystemService(INPUT_METHOD_SERVICE)as InputMethodManager).hideSoftInputFromWindow(window.decorView.windowToken,0);address.clearFocus();tab.url=url;if(url==BrowserPolicy.HOME){tab.title="New tab";showHome()}else{if(tab.web==null)tab.web=website(tab);content.removeAllViews();(tab.web?.parent as?ViewGroup)?.removeView(tab.web);content.addView(tab.web,FrameLayout.LayoutParams(-1,-1));tab.web?.loadUrl(url);tab.web?.requestFocus()};renderTabs();updateAddress();saveTabs()}
 private fun closeTab(index:Int){val tab=tabs.getOrNull(index)?:return;if(!privateSession){closed.addLast(Tab(url=tab.url,title=tab.title));while(closed.size>20)closed.removeFirst()};(tab.web?.parent as?ViewGroup)?.removeView(tab.web);tab.web?.destroy();tabs.removeAt(index);if(tabs.isEmpty())newTab()else selectTab((if(index<active)active-1 else active).coerceAtMost(tabs.lastIndex))}
 private fun reopen(){if(closed.isNotEmpty())newTab(closed.removeLast().url)else toast("No recently closed tabs")}
 private fun renderTabs(){tabStrip.removeAllViews();tabs.forEachIndexed{i,tab->val row=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL;setPadding(dp(8),0,dp(2),0);setBackgroundColor(if(i==active)if(light)Color.WHITE else Color.parseColor("#252630")else Color.TRANSPARENT)};val icon=ImageView(this).apply{contentDescription="Website icon";if(tab.favicon!=null)setImageBitmap(tab.favicon)else setImageResource(R.drawable.ic_launcher_foreground)};row.addView(icon,LinearLayout.LayoutParams(dp(22),dp(22)));val name=TextView(this).apply{text=tab.title.take(24);setTextColor(ink);textSize=12f;maxLines=1;setPadding(dp(8),0,dp(8),0);gravity=Gravity.CENTER;isFocusable=true;isClickable=true;setBackgroundResource(android.R.drawable.list_selector_background);setOnClickListener{selectTab(i)};setOnLongClickListener{tabActions(i);true}};row.addView(name,LinearLayout.LayoutParams(dp(if(tv)170 else 130),dp(42)));row.addView(button("×","Close ${tab.title}"){closeTab(i)});tabStrip.addView(row)}}
 private fun revealActiveTab(){tabScroll.post{tabStrip.getChildAt(active)?.let{tabScroll.smoothScrollTo(it.left,0)}}}
 private fun tabActions(i:Int){AlertDialog.Builder(this).setTitle(tabs[i].title).setItems(arrayOf("Move left","Move right","Close tab")){_,which->when(which){0->moveTab(i,i-1);1->moveTab(i,i+1);2->closeTab(i)}}.show()}
 private fun moveTab(from:Int,to:Int){if(to !in tabs.indices)return;val selected=current();val item=tabs.removeAt(from);tabs.add(to,item);active=tabs.indexOf(selected);renderTabs();saveTabs()}
 private fun updateAddress(){val tab=current()?:return;if(!address.hasFocus())address.setText(if(tab.url==BrowserPolicy.HOME)"" else tab.url);status.text=if(privateSession)"Private session · separate website storage" else if(tab.url.startsWith("https://"))"HTTPS · ${Uri.parse(tab.url).host}" else if(tab.url.startsWith("http://"))"Not secure · HTTP website" else "Blackout · Android early access"}
 private fun saveTabs(){if(privateSession||restoring)return;val arr=JSONArray();tabs.forEach{arr.put(JSONObject().put("url",it.url).put("title",it.title))};prefs.edit().putString("tabs",arr.toString()).putInt("active",active).apply()}
 private fun restoreTabs(){restoring=true;try{val text=prefs.getString("tabs","[]").orEmpty();if(text.length<=65536){val a=JSONArray(text);for(i in 0 until minOf(a.length(),32)){val o=a.getJSONObject(i);val u=o.optString("url");if(u==BrowserPolicy.HOME||BrowserPolicy.webUrl(u)!=null)tabs.add(Tab(url=u,title=o.optString("title","Tab").take(150)))}};active=prefs.getInt("active",0)}catch(_:Exception){};restoring=false}
 override fun onNewIntent(intent:Intent){super.onNewIntent(intent);BrowserPolicy.webUrl(intent.data?.toString().orEmpty())?.let{newTab(it)}}
 private fun openPrivate(){if(privateSession){finish();return};if(Build.VERSION.SDK_INT<28){toast("Isolated private browsing needs Android 9 or newer.");return};startActivity(Intent(this,PrivateActivity::class.java))}
 private fun showMenu(){
  val labels=arrayOf("New tab","Reopen closed tab",if(privateSession)"Close private session" else "New private session","Add page to bookmarks","Bookmarks","History","Downloads","Open local PDF","Music player","Themes & appearance","Search engine","Desktop website: ${if(desktopSite)"On" else "Off"}","Tracker shield: ${if(prefs.getBoolean("shield",true))"On" else "Off"}","TV cursor: ${if(cursorMode)"On" else "Off"}","Picture in Picture","Clear browsing data","About & updates","TV screen fit")
  AlertDialog.Builder(this).setTitle("Blackout").setItems(labels){_,i->when(i){0->newTab();1->reopen();2->openPrivate();3->{val t=current();if(t!=null&&BrowserPolicy.webUrl(t.url)!=null&&!privateSession){favorites.addFavorite(t.title,t.url);refreshBookmarks();refreshHome();toast("Bookmark saved")}else toast("Open a standard website to save a bookmark")};4->showBookmarks();5->showHistory();6->try{startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS))}catch(_:Exception){toast("This device has no Downloads app")};7->pickPdf();8->showMusic();9->showAppearance();10->showEngines();11->{desktopSite=!desktopSite;current()?.web?.let{it.settings.userAgentString=if(desktopSite)WebSettings.getDefaultUserAgent(this).replace("; wv","").replace("Mobile","")else WebSettings.getDefaultUserAgent(this);it.reload()}};12->{prefs.edit().putBoolean("shield",!prefs.getBoolean("shield",true)).apply();current()?.web?.reload()};13->{cursorMode=!cursorMode;toast(if(cursorMode)"D-pad moves cursor; OK clicks; Menu returns to toolbar" else "Cursor off")};14->enterPip();15->clearData();16->about();17->showScreenFit()}}.show()
 }
 private fun showScreenFit(){val values=intArrayOf(0,3,5,7,10);val selected=displayPrefs.getInt("tv_margin",if(tv)5 else 0);AlertDialog.Builder(this).setTitle("TV screen fit").setSingleChoiceItems(values.map{if(it==0)"Full screen (no safe margin)" else "$it% safe margin"}.toTypedArray(),values.indexOf(selected)){dialog,index->displayPrefs.edit().putInt("tv_margin",values[index]).apply();ScreenSafeArea.refresh(root,values[index]);dialog.dismiss()}.setNegativeButton("Close",null).show()}
 private fun showBookmarks(){val list=favorites.getFavorites();if(list.isEmpty()){toast("No bookmarks saved");return};AlertDialog.Builder(this).setTitle("Bookmarks").setItems(list.map{it.title}.toTypedArray()){_,i->navigate(list[i].url)}.setNeutralButton("Remove bookmark"){_,_->AlertDialog.Builder(this).setTitle("Choose bookmark to remove").setItems(list.map{it.title}.toTypedArray()){_,i->favorites.removeFavorite(list[i].url);refreshBookmarks();refreshHome()}.show()}.setNegativeButton("Close",null).show()}
 private fun showHistory(){if(privateSession){toast("Private visits are not saved");return};val list=history.getHistory();AlertDialog.Builder(this).setTitle("History").setItems(list.map{it.title.take(65)+"\n"+it.url.take(80)}.toTypedArray()){_,i->navigate(list[i].url)}.setNeutralButton("Clear history"){_,_->history.clearHistory();toast("History cleared")}.setNegativeButton("Close",null).show()}
 private fun showAppearance(){AlertDialog.Builder(this).setTitle("Appearance").setItems(arrayOf("Eclipse","Ember","Aurora",if(light)"Dark appearance" else "Light appearance")){_,i->if(i<3)prefs.edit().putString("theme",listOf("eclipse","ember","aurora")[i]).apply()else prefs.edit().putString("surface",if(light)"dark" else "light").apply();rebuildChrome()}.show()}
 private fun showEngines(){val engines=search.getAllEngines();AlertDialog.Builder(this).setTitle("Search engine").setItems(engines.map{it.name}.toTypedArray()){_,i->search.setCurrentEngine(engines[i].id);refreshHome();toast("Search engine updated")}.show()}
 private fun askDownload(raw:String,name:String){val url=BrowserPolicy.webUrl(raw);if(url==null){toast("This download URL is not supported. Use the website's direct download.");return};AlertDialog.Builder(this).setTitle("Download file?").setMessage(BrowserPolicy.filename(name)+"\nFrom "+Uri.parse(url).host+(if(privateSession)"\nDownloaded files remain after private browsing closes." else "")).setPositiveButton("Download"){_,_->if(Build.VERSION.SDK_INT<29&&checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)!=PackageManager.PERMISSION_GRANTED){downloadPending=url to name;storagePermission.launch(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)}else enqueueDownload(url,name)}.setNegativeButton("Cancel",null).show()}
 private fun enqueueDownload(url:String,name:String){try{val file=BrowserPolicy.filename(name);val request=DownloadManager.Request(Uri.parse(url)).setTitle(file).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED).setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,file);current()?.web?.settings?.userAgentString?.let{request.addRequestHeader("User-Agent",it)};(getSystemService(DOWNLOAD_SERVICE)as DownloadManager).enqueue(request);toast("Download started. See Downloads.")}catch(_:Exception){toast("Download failed. Check storage permission and available space.")}}

 private fun pickPdf(){try{pdfPicker.launch(arrayOf("application/pdf"))}catch(_:ActivityNotFoundException){missingFilePicker()}}
 private fun pickMusic(){try{musicPicker.launch(arrayOf("audio/*"))}catch(_:ActivityNotFoundException){missingFilePicker()}}
 private fun missingFilePicker(){AlertDialog.Builder(this).setTitle("File picker unavailable").setMessage("This device does not provide Android’s document picker. Install a compatible file manager to choose local PDFs, music or uploads. Browsing still works.").setPositiveButton("OK",null).show()}
 private fun playAudio(uri:Uri){try{player?.release();player=MediaPlayer().apply{setDataSource(this@BrowserActivity,uri);setOnPreparedListener{it.start();showMusic()};setOnErrorListener{_,_,_->toast("This audio format could not be played");true};prepareAsync()}}catch(_:Exception){player?.release();player=null;toast("This audio file could not be opened. Choose an accessible audio file.")}}
 private fun showMusic(){AlertDialog.Builder(this).setTitle("Blackout music").setMessage("Play an audio file selected from your device. Playback continues while you browse inside Blackout.").setPositiveButton("Choose audio"){_,_->pickMusic()}.setNeutralButton(if(player?.isPlaying==true)"Pause" else "Play"){_,_->try{if(player?.isPlaying==true)player?.pause()else player?.start()}catch(_:Exception){toast("Choose an audio file first")}}.setNegativeButton("Close",null).show()}
 private fun clearData(){AlertDialog.Builder(this).setTitle("Clear browsing data?").setMessage("Closes tabs and clears website cookies, storage, cache and browsing history for this ${if(privateSession)"private" else "standard"} profile. Bookmarks and downloaded files stay.").setPositiveButton("Clear data"){_,_->tabs.forEach{it.web?.stopLoading();it.web?.clearCache(true);it.web?.destroy()};tabs.clear();if(!privateSession)history.clearHistory();WebStorage.getInstance().deleteAllData();CookieManager.getInstance().removeAllCookies{CookieManager.getInstance().flush();newTab();toast("Browsing data cleared")}}.setNegativeButton("Cancel",null).show()}
 private fun about(){AlertDialog.Builder(this).setTitle("Blackout ${BuildConfig.VERSION_NAME}").setMessage("Android / Android TV early access\nEngine: Android System WebView\n\nWebsite permissions are denied by default. Private sessions isolate website storage on Android 9+. This is not Tor or a VPN.\n\nChrome extensions, Windows VPN/yt-dlp and desktop updates are not available in this Android build. Keep System WebView updated.").setPositiveButton("Updates"){_,_->newTab("https://pactuno.online/blackout.html")}.setNegativeButton("Close",null).show()}
 private fun exitFullscreen(){(customView?.parent as?ViewGroup)?.removeView(customView);customView=null;customCallback?.onCustomViewHidden();customCallback=null;window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)}
 private fun enterPip(){if(!packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)){toast("Picture in Picture is unavailable on this device");return};try{enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(Rational(16,9)).build())}catch(_:Exception){toast("Picture in Picture could not start")}}
 override fun onPictureInPictureModeChanged(pip:Boolean,configuration:Configuration){super.onPictureInPictureModeChanged(pip,configuration);for(i in 0 until root.childCount)if(root.getChildAt(i)!=content)root.getChildAt(i).visibility=if(pip)View.GONE else View.VISIBLE}
 override fun dispatchKeyEvent(event:KeyEvent):Boolean{
  if(event.action==KeyEvent.ACTION_DOWN&&event.isCtrlPressed){when(event.keyCode){KeyEvent.KEYCODE_L->{address.requestFocus();address.selectAll();return true};KeyEvent.KEYCODE_T->{if(event.isShiftPressed)reopen()else newTab();return true};KeyEvent.KEYCODE_W->{closeTab(active);return true};KeyEvent.KEYCODE_R->{current()?.web?.reload();return true};KeyEvent.KEYCODE_TAB->{if(tabs.isNotEmpty())selectTab((active+if(event.isShiftPressed)tabs.size-1 else 1)%tabs.size);return true}}}
  if(event.keyCode==KeyEvent.KEYCODE_MENU&&event.action==KeyEvent.ACTION_DOWN){cursorMode=false;showMenu();return true}
  if(cursorMode&&event.action==KeyEvent.ACTION_DOWN&&current()?.url!=BrowserPolicy.HOME){val web=current()?.web?:return super.dispatchKeyEvent(event);when(event.keyCode){KeyEvent.KEYCODE_DPAD_LEFT->cursorX-=28;KeyEvent.KEYCODE_DPAD_RIGHT->cursorX+=28;KeyEvent.KEYCODE_DPAD_UP->cursorY-=28;KeyEvent.KEYCODE_DPAD_DOWN->cursorY+=28;KeyEvent.KEYCODE_DPAD_CENTER,KeyEvent.KEYCODE_ENTER->{val now=SystemClock.uptimeMillis();for(action in listOf(MotionEvent.ACTION_DOWN,MotionEvent.ACTION_UP)){val e=MotionEvent.obtain(now,now,action,cursorX,cursorY,0);web.dispatchTouchEvent(e);e.recycle()};return true};else->return super.dispatchKeyEvent(event)};if(cursorY>web.height-20){web.scrollBy(0,80);cursorY=(web.height-25).toFloat()};if(cursorY<20){web.scrollBy(0,-80);cursorY=25f};cursorX=cursorX.coerceIn(1f,maxOf(1,web.width-1).toFloat());web.evaluateJavascript("(()=>{let c=document.getElementById('__blackout_cursor');if(!c){c=document.createElement('div');c.id='__blackout_cursor';document.documentElement.appendChild(c)}c.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;width:14px;height:14px;border:2px solid white;border-radius:50%;background:#9a7aff;left:'+($cursorX/window.devicePixelRatio)+'px;top:'+($cursorY/window.devicePixelRatio)+'px'})()",null);return true}
  return super.dispatchKeyEvent(event)
 }
 private fun toast(text:String){Toast.makeText(this,text,Toast.LENGTH_LONG).show()}
 override fun onPause(){super.onPause();if(::home.isInitialized)saveTabs()}
 override fun onDestroy(){destroyed=true;uploadCallback?.onReceiveValue(null);uploadCallback=null;exitFullscreen();player?.release();player=null;tabs.forEach{if(privateSession)it.web?.clearCache(true);(it.web?.parent as?ViewGroup)?.removeView(it.web);it.web?.destroy()};if(::home.isInitialized){(home.parent as?ViewGroup)?.removeView(home);home.destroy()};if(privateSession){WebStorage.getInstance().deleteAllData();CookieManager.getInstance().removeAllCookies{CookieManager.getInstance().flush()}};super.onDestroy()}
}
