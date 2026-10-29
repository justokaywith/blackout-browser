package online.pactuno.blackout
import android.content.Intent
import android.graphics.Rect
import android.view.ViewGroup
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.*
import org.junit.Test
import org.junit.Assert.*
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TvViewportTest {
 @Test fun tvChromeInsideSafeBoundsAndScreenFitWorks(){
  val instrumentation=InstrumentationRegistry.getInstrumentation();val context=instrumentation.targetContext
  val device=UiDevice.getInstance(instrumentation)
  val activityClass=Class.forName("online.pactuno.blackout.TvLayoutTestActivity")
  try {
   device.executeShellCommand("wm density 160");device.setOrientationNatural()
   for(size in listOf("960x540","1280x720")){
    device.executeShellCommand("wm size $size")
    context.getSharedPreferences("blackout_desktop_ui",0).edit().clear().commit()
    context.getSharedPreferences("blackout_display",0).edit().clear().commit()
    ActivityScenario.launch<android.app.Activity>(Intent(context,activityClass)).use{scenario->
     assertNotNull(device.wait(Until.findObject(By.desc("Menu")),15000));device.waitForIdle()
     val safe=Rect()
     scenario.onActivity{activity->
      val root=(activity.findViewById<ViewGroup>(android.R.id.content)).getChildAt(0)
      assertTrue("Missing horizontal TV margin",root.paddingLeft>=root.width*.05)
      assertTrue("Missing vertical TV margin",root.paddingTop>=root.height*.05)
      val location=IntArray(2);root.getLocationOnScreen(location)
      safe.set(location[0]+root.paddingLeft,location[1]+root.paddingTop,location[0]+root.width-root.paddingRight,location[1]+root.height-root.paddingBottom)
     }
      for(label in listOf("Back","Reload","Menu","New tab","Previous bookmarks","Next bookmarks")){
       val view=device.findObject(By.desc(label));assertNotNull("Missing $label",view)
       assertTrue("$label outside safe area: ${view.visibleBounds} / $safe",safe.contains(view.visibleBounds))
      }
     device.executeShellCommand("screencap -p /sdcard/blackout-qa-tv-$size.png")
     device.findObject(By.desc("Menu")).click()
     val list=device.wait(Until.findObject(By.clazz("android.widget.ListView")),5000);assertNotNull("Browser menu list missing",list);var fit=device.findObject(By.text("TV screen fit"))
     repeat(5){if(fit==null){list!!.scroll(Direction.DOWN,0.7f);device.waitForIdle();fit=device.wait(Until.findObject(By.text("TV screen fit")),1000)}}
     assertNotNull(fit);fit!!.click();device.wait(Until.findObject(By.text("7% safe margin")),5000).click();device.waitForIdle()
     scenario.onActivity{activity->val root=activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0);assertTrue(root.paddingLeft>=root.width*.07)}
    }
   }
  } finally {context.getSharedPreferences("blackout_display",0).edit().clear().commit();device.executeShellCommand("wm size reset");device.executeShellCommand("wm density reset");device.unfreezeRotation()}
 }
}
