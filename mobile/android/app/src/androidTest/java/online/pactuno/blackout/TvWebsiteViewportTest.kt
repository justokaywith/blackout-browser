package online.pactuno.blackout
import android.content.Intent
import android.graphics.Rect
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.*
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.net.ServerSocket
import kotlin.concurrent.thread

@RunWith(AndroidJUnit4::class)
class TvWebsiteViewportTest {
 @Test fun actualWebsiteGetsHeightAndCompactTabsRemainUsable(){
  val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext
  val device=UiDevice.getInstance(instrumentation);val server=ServerSocket(0)
  val url="http://127.0.0.1:${server.localPort}/"
  thread(isDaemon=true){while(!server.isClosed)try{server.accept().use{s->s.soTimeout=5000;val reader=s.getInputStream().bufferedReader();while(!reader.readLine().isNullOrEmpty()){};val bytes="<html><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>TV viewport fixture</title></head><body style='margin:16px;background:white;color:black;font:20px sans-serif'><h1>TV website starts here</h1><p>The website should fill the usable TV screen below one compact toolbar.</p><a href='#bottom'>Go to bottom</a><div style='height:1500px'></div><p id='bottom'>End of test page</p></body></html>".toByteArray();s.getOutputStream().write(("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n").toByteArray());s.getOutputStream().write(bytes)}}catch(_:Exception){}}
  try {
   device.executeShellCommand("wm density 160");device.setOrientationNatural()
   context.getSharedPreferences("blackout_desktop_ui",0).edit().clear().commit()
   context.getSharedPreferences("blackout_display",0).edit().clear().commit()
   val intent=Intent(context,Class.forName("online.pactuno.blackout.TvLayoutTestActivity")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
   ActivityScenario.launch<android.app.Activity>(intent).use{scenario->
    for(size in listOf("960x540","1280x720")){
     device.executeShellCommand("wm size $size");device.waitForIdle();android.os.SystemClock.sleep(2500)
     val address=device.wait(Until.findObject(By.clazz("android.widget.EditText")),10000);assertNotNull(address)
     address.click();address.setText(url);device.pressEnter()
     assertNotNull(device.wait(Until.findObject(By.text("TV website starts here")),15000));device.waitForIdle()
     val page=Rect()
     scenario.onActivity{activity->
      val root=activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as ViewGroup
      val usable=root.height-root.paddingTop-root.paddingBottom
      val content=root.getChildAt(root.childCount-1) as ViewGroup
      assertTrue("Website squeezed below controls: ${content.height}/$usable",content.height>=usable*.85)
      assertTrue("Actual website missing",content.getChildAt(0) is WebView)
      content.getGlobalVisibleRect(page)
     }
     assertNull("Persistent bookmarks take website height",device.findObject(By.desc("Next bookmarks")))
     assertTrue("Website unexpectedly starts scrolled down",device.findObject(By.text("TV website starts here")).visibleBounds.top<page.top+120)
     device.executeShellCommand("screencap -p /sdcard/blackout-qa-tv-website-$size.png")
     val count=device.findObject(By.desc("Tabs")).text.substringAfterLast(' ').toInt()
     device.findObject(By.desc("Tabs")).click();device.wait(Until.findObject(By.res("android:id/button1")),5000).click()
     assertNotNull("Native tab count did not update",device.wait(Until.findObject(By.text("▣ ${count+1}")),5000))
     device.findObject(By.desc("Tabs")).click();device.wait(Until.findObject(By.text("TV viewport fixture")),5000).click()
     assertNotNull(device.wait(Until.findObject(By.text("TV website starts here")),10000))
     device.pressMenu();device.wait(Until.findObject(By.text("Address bar")),5000).click()
     assertNotNull("TV Menu cannot return focus to address bar",device.wait(Until.findObject(By.clazz("android.widget.EditText").focused(true)),5000))
    }
   }
  } finally {server.close();context.getSharedPreferences("blackout_display",0).edit().clear().commit();device.executeShellCommand("wm size reset");device.executeShellCommand("wm density reset");device.unfreezeRotation()}
 }
}
