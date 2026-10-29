package online.pactuno.blackout
import android.app.DownloadManager
import android.content.Intent
import android.graphics.pdf.PdfDocument
import android.graphics.Paint
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream
import java.net.ServerSocket
import kotlin.concurrent.thread

@RunWith(AndroidJUnit4::class)
class DownloadsJourneyTest{
 private val instrumentation=InstrumentationRegistry.getInstrumentation()
 private val context get()=instrumentation.targetContext
 private val device get()=UiDevice.getInstance(instrumentation)
 private fun completedRow(name:String):UiObject2{val end=android.os.SystemClock.uptimeMillis()+10000;while(android.os.SystemClock.uptimeMillis()<end){val row=device.findObject(By.text(name));if(row?.parent?.findObject(By.textStartsWith("Completed"))!=null)return row;android.os.SystemClock.sleep(100)};throw AssertionError("Downloads UI did not show completed file: $name")}
 private lateinit var server:ServerSocket
 @Test fun browserDownloadsOpenInternallyAndCompletedPdfAndApkAreUsable(){
  val document=PdfDocument();val pdf=try{val page=document.startPage(PdfDocument.PageInfo.Builder(300,400,1).create());page.canvas.drawText("Blackout PDF download QA",20f,40f,Paint().apply{textSize=14f});document.finishPage(page);ByteArrayOutputStream().use{out->document.writeTo(out);out.toByteArray()}}finally{document.close()}
  val apk=java.io.File(context.applicationInfo.sourceDir).readBytes()
  server=ServerSocket(0);val root="http://127.0.0.1:${server.localPort}"
  val ids=mutableListOf<Long>()
  thread(isDaemon=true){while(!server.isClosed)try{server.accept().use{s->s.soTimeout=5000;val reader=s.getInputStream().bufferedReader();val request=reader.readLine().orEmpty();while(!reader.readLine().isNullOrEmpty()){};val isApk=request.contains("sample.apk");val body=if(isApk)apk else pdf;val mime=if(isApk)"application/vnd.android.package-archive" else "application/pdf";val disposition="Content-Disposition: attachment; filename=blackout-qa-sample."+(if(isApk)"apk" else "pdf")+"\r\n";s.getOutputStream().write(("HTTP/1.1 200 OK\r\nContent-Type: $mime\r\n${disposition}Content-Length: ${body.size}\r\nConnection: close\r\n\r\n").toByteArray());s.getOutputStream().write(body)}}catch(_:Exception){}}
  try{
   context.startActivity(Intent(context,BrowserActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
   assertNotNull(device.wait(Until.findObject(By.text("Favourites")),20000))
   // Drive the actual browser's native address, download confirmation and in-app progress.
   val address=device.findObjects(By.clazz("android.widget.EditText")).first();address.click();address.setText("$root/sample.pdf");device.pressEnter()
   device.wait(Until.findObject(By.text("Download")),10000).click()
   assertNotNull(device.wait(Until.findObject(By.text("Downloads")),15000))
   assertEquals("Downloads must stay inside Blackout",context.packageName,device.currentPackageName)
   val pdfId=DownloadFiles.list(context).first{it.url=="$root/sample.pdf"}.id;ids.add(pdfId)
   var done=false;val deadline=android.os.SystemClock.uptimeMillis()+30000
   while(!done&&android.os.SystemClock.uptimeMillis()<deadline){done=DownloadFiles.list(context).any{it.id==pdfId&&it.status==DownloadManager.STATUS_SUCCESSFUL};android.os.SystemClock.sleep(200)}
   assertTrue("PDF download did not complete",done)
   device.executeShellCommand("screencap -p /sdcard/blackout-qa-download-list.png")
   completedRow("blackout-qa-sample.pdf").click()
   device.wait(Until.findObject(By.text("Open file")),5000).click()
   assertNotNull(device.wait(Until.findObject(By.text("1 / 1")),15000))
   device.executeShellCommand("screencap -p /sdcard/blackout-qa-download-pdf.png");device.pressBack()
   device.wait(Until.findObject(By.desc("Close downloads")),5000).click()
   val apkAddress=device.findObjects(By.clazz("android.widget.EditText")).first();apkAddress.click();apkAddress.setText("$root/sample.apk");device.pressEnter()
   device.wait(Until.findObject(By.text("Download")),10000).click()
   assertNotNull(device.wait(Until.findObject(By.text("Downloads")),10000))
   val apkId=DownloadFiles.list(context).first{it.url=="$root/sample.apk"}.id;ids.add(apkId)
   val until=android.os.SystemClock.uptimeMillis()+30000;done=false
   while(!done&&android.os.SystemClock.uptimeMillis()<until){done=DownloadFiles.list(context).any{it.id==apkId&&it.status==DownloadManager.STATUS_SUCCESSFUL};android.os.SystemClock.sleep(200)}
   assertTrue("APK download did not complete",done)
   completedRow("blackout-qa-sample.apk").click()
   device.wait(Until.findObject(By.text("Install APK")),5000).click()
   assertNotNull(device.wait(Until.findObject(By.text("Allow APK installation")),10000))
   device.executeShellCommand("screencap -p /sdcard/blackout-qa-download-apk-permission.png")
   device.findObject(By.text("Cancel")).click()
   device.executeShellCommand("appops set ${context.packageName} REQUEST_INSTALL_PACKAGES allow")
   completedRow("blackout-qa-sample.apk").click();device.wait(Until.findObject(By.text("Install APK")),5000).click()
   assertTrue("Android installer must open after user selects Install APK",device.wait(Until.gone(By.pkg(context.packageName)),15000))
   device.executeShellCommand("screencap -p /sdcard/blackout-qa-download-installer.png")
   device.pressBack()
  } finally {server.close();(context.getSystemService(android.content.Context.DOWNLOAD_SERVICE)as DownloadManager).remove(*ids.toLongArray());device.executeShellCommand("appops set ${context.packageName} REQUEST_INSTALL_PACKAGES default")}
 }
}
