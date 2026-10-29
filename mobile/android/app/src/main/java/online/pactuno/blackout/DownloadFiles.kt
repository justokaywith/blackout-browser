package online.pactuno.blackout
import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import java.util.UUID

/** Only uses this app's DownloadManager rows. Never forwards website cookies. */
object DownloadFiles {
 data class Entry(val id:Long,val title:String,val url:String,val mime:String,val status:Int,val reason:Int,val received:Long,val total:Long)
 fun list(context:Context):List<Entry>{
  val manager=context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  val rows=mutableListOf<Entry>()
  manager.query(DownloadManager.Query())?.use{c->
   fun text(name:String)=c.getString(c.getColumnIndexOrThrow(name)).orEmpty()
   fun number(name:String)=c.getLong(c.getColumnIndexOrThrow(name))
   while(c.moveToNext()&&rows.size<200)rows.add(Entry(number(DownloadManager.COLUMN_ID),text(DownloadManager.COLUMN_TITLE).take(180),text(DownloadManager.COLUMN_URI),text(DownloadManager.COLUMN_MEDIA_TYPE),number(DownloadManager.COLUMN_STATUS).toInt(),number(DownloadManager.COLUMN_REASON).toInt(),number(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR),number(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)))
  }
  return rows.sortedByDescending{it.id}
 }
 @Synchronized fun enqueue(context:Context,raw:String,name:String,userAgent:String?):Long{
  val url=BrowserPolicy.webUrl(raw)?:throw IllegalArgumentException("Unsupported download address")
  val manager=context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  // Repeated clicks on an active download return the original row instead of creating duplicates.
  list(context).firstOrNull{it.url==url&&it.status in listOf(DownloadManager.STATUS_PENDING,DownloadManager.STATUS_RUNNING,DownloadManager.STATUS_PAUSED)}?.let{return it.id}
  val safe=BrowserPolicy.filename(name)
  val dot=safe.lastIndexOf('.');val suffix="-"+UUID.randomUUID().toString().take(8)
  val destination=if(dot>0)safe.substring(0,dot)+suffix+safe.substring(dot)else safe+suffix
  val request=DownloadManager.Request(Uri.parse(url)).setTitle(safe).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED).setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,destination)
  if(!userAgent.isNullOrBlank())request.addRequestHeader("User-Agent",userAgent.take(512))
  return manager.enqueue(request)
 }
 fun status(entry:Entry):String=when(entry.status){
  DownloadManager.STATUS_SUCCESSFUL->"Completed · "+bytes(entry.received)
  DownloadManager.STATUS_RUNNING->"Downloading · "+bytes(entry.received)+(if(entry.total>0)" / "+bytes(entry.total)+" · "+(100.0*entry.received/entry.total).toInt().coerceIn(0,100)+"%" else "")
  DownloadManager.STATUS_PENDING->"Waiting to start"
  DownloadManager.STATUS_PAUSED->when(entry.reason){DownloadManager.PAUSED_WAITING_FOR_NETWORK->"Paused · waiting for connection";DownloadManager.PAUSED_QUEUED_FOR_WIFI->"Paused · waiting for Wi-Fi";else->"Paused · Android will retry"}
  DownloadManager.STATUS_FAILED->"Failed · "+failure(entry.reason)
  else->"Status unavailable"
 }
 fun failure(reason:Int):String=when(reason){
  DownloadManager.ERROR_INSUFFICIENT_SPACE->"not enough storage"
  DownloadManager.ERROR_DEVICE_NOT_FOUND->"download storage is unavailable"
  DownloadManager.ERROR_FILE_ALREADY_EXISTS->"file already exists"
  DownloadManager.ERROR_TOO_MANY_REDIRECTS->"too many redirects"
  DownloadManager.ERROR_CANNOT_RESUME->"connection interrupted; download again"
  DownloadManager.ERROR_HTTP_DATA_ERROR->"network transfer interrupted"
  DownloadManager.ERROR_FILE_ERROR->"file could not be saved"
  in 400..599->"server returned HTTP $reason"
  else->"download could not complete (code $reason)"
 }
 private fun bytes(n:Long):String=if(n>=1048576)String.format(java.util.Locale.ROOT,"%.1f MB",n/1048576.0)else if(n>=1024)"${n/1024} KB" else "${n.coerceAtLeast(0)} B"
}
