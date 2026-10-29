package online.pactuno.blackout
import android.content.Intent
import android.webkit.CookieManager
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.*
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.io.File
import java.net.ServerSocket
import java.util.concurrent.LinkedBlockingQueue
import kotlin.concurrent.thread

@RunWith(AndroidJUnit4::class)
class BrowserJourneyTest{
 private val instrumentation=InstrumentationRegistry.getInstrumentation()
 private val context get()=instrumentation.targetContext
 private val device get()=UiDevice.getInstance(instrumentation)
 private lateinit var server:ServerSocket
 private val requests=LinkedBlockingQueue<String>()
 private val url get()="http://127.0.0.1:${server.localPort}/"
 @Before fun setup(){
  context.getSharedPreferences("blackout_desktop_ui",0).edit().clear().commit()
  server=ServerSocket(0)
  thread(isDaemon=true){while(!server.isClosed)try{server.accept().use{s->s.soTimeout=5000;val reader=s.getInputStream().bufferedReader();val lines=mutableListOf<String>();while(true){val line=reader.readLine()?:break;if(line.isEmpty())break;lines.add(line)};requests.offer(lines.joinToString("\n"));val html="<html><head><title>QA fixture</title></head><body><h1>Fixture ready</h1><p id='bridge'></p><script>document.getElementById('bridge').textContent='nativeBridge='+typeof window.BlackoutNative;</script></body></html>";val bytes=html.toByteArray();s.getOutputStream().write(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n").toByteArray());s.getOutputStream().write(bytes)}}catch(_:Exception){}}
  context.startActivity(Intent(context,BrowserActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
  assertNotNull(device.wait(Until.findObject(By.text("Favourites")),20000))
 }
 @After fun stop(){server.close()}
 private fun click(text:String){var node=device.wait(Until.findObject(By.text(text)),2500);for(i in 0..3){if(node!=null)break;device.swipe(device.displayWidth/2,device.displayHeight*8/10,device.displayWidth/2,device.displayHeight*3/10,30);node=device.wait(Until.findObject(By.text(text)),1500)};assertNotNull("Missing button $text",node);node.click();device.waitForIdle()}
 private fun menu(){device.wait(Until.findObject(By.desc("Menu")),10000).click();device.waitForIdle()}
 private fun address(value:String){val fields=device.findObjects(By.clazz("android.widget.EditText"));assertTrue(fields.isNotEmpty());fields.first().click();fields.first().setText(value);device.pressEnter();device.waitForIdle()}
 @Test fun standardTabsNavigationAndNoNativeBridge(){
  address(url);assertNotNull(device.wait(Until.findObject(By.text("nativeBridge=undefined")),15000))
  device.findObject(By.desc("New tab")).click();assertNotNull(device.wait(Until.findObject(By.text("Favourites")),10000))
  device.wait(Until.findObject(By.desc("Close New tab")),5000).click();assertNotNull(device.wait(Until.findObject(By.text("Fixture ready")),10000));menu();click("Reopen closed tab");assertNotNull(device.wait(Until.findObject(By.text("Favourites")),10000))
  device.executeShellCommand("screencap -p /sdcard/blackout-qa-standard.png")
  menu();click("Themes & appearance");click("Light appearance");assertNotNull(device.wait(Until.findObject(By.text("Favourites")),10000));device.executeShellCommand("screencap -p /sdcard/blackout-qa-light.png")
 }
 @Test fun privateHomeButtonsAndStorageIsolation(){
  instrumentation.runOnMainSync{CookieManager.getInstance().setCookie(url,"blackout_qa=standard; Path=/");CookieManager.getInstance().flush()}
  menu();click("New private session");assertNotNull(device.wait(Until.findObject(By.text("PRIVATE")),20000))
  device.executeShellCommand("screencap -p /sdcard/blackout-qa-private-home.png")
  click("Manage");assertNotNull(device.wait(Until.findObject(By.text("Bookmarks")),5000));device.pressBack()
  click("Open PDF");assertTrue(device.wait(Until.gone(By.pkg(context.packageName)),8000));device.pressBack();assertNotNull(device.wait(Until.findObject(By.text("Private session · separate website storage")),10000))
  click("Music");assertTrue(device.wait(Until.gone(By.pkg(context.packageName)),8000));device.pressBack()
  repeat(3){device.swipe(device.displayWidth/2,device.displayHeight*3/10,device.displayWidth/2,device.displayHeight*8/10,30)}
  val fields=device.findObjects(By.clazz("android.widget.EditText"));assertTrue("Native address and homepage search must exist",fields.size>=2);fields.last().click();fields.last().setText(url)
  assertNotNull("Homepage query value was not applied",device.wait(Until.findObject(By.text(url).clazz("android.widget.EditText").pkg(context.packageName)),5000))
  device.executeShellCommand("screencap -p /sdcard/blackout-qa-private-search.png")
  // Exercise the homepage Search button; native address Enter is covered in the standard journey.
  val submit=device.findObject(By.desc("Search").pkg(context.packageName))?:device.findObject(By.text("Search").pkg(context.packageName))?:device.findObject(By.text("↗").pkg(context.packageName));assertNotNull("Homepage Search button missing",submit);submit!!.click()
  assertNotNull(device.wait(Until.findObject(By.text("Fixture ready")),15000))
  val request=requests.poll(15,java.util.concurrent.TimeUnit.SECONDS);assertNotNull(request);assertFalse("Private session received standard cookies",request!!.contains("blackout_qa=standard"))
  menu();click("Close private session");assertNotNull(device.wait(Until.findObject(By.text("Favourites")),10000))
  instrumentation.runOnMainSync{assertTrue(CookieManager.getInstance().getCookie(url).orEmpty().contains("blackout_qa=standard"))}
 }
}
