package online.pactuno.blackout
import org.junit.Assert.*
import org.junit.Test
class ScreenSafeAreaTest {
 @Test fun televisionSafeMarginsScaleAndRoundUp(){
  assertEquals(48,ScreenSafeArea.margin(960,5));assertEquals(27,ScreenSafeArea.margin(540,5))
  assertEquals(96,ScreenSafeArea.margin(1920,5));assertEquals(54,ScreenSafeArea.margin(1080,5))
  assertEquals(49,ScreenSafeArea.margin(961,5));assertEquals(0,ScreenSafeArea.margin(960,0))
  assertEquals(96,ScreenSafeArea.margin(960,100));assertEquals(0,ScreenSafeArea.margin(-1,5))
 }
}
