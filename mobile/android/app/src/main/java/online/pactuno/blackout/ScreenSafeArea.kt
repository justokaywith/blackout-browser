package online.pactuno.blackout
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/** Keep controls clear of system bars, cutouts and TV overscan without scaling websites. */
object ScreenSafeArea {
 fun margin(size:Int,percent:Int):Int=(size.coerceAtLeast(0)*percent.coerceIn(0,10)+99)/100
 fun install(root:View,percent:()->Int){
  ViewCompat.setOnApplyWindowInsetsListener(root){_,insets->refresh(root,percent(),insets);insets}
  root.addOnLayoutChangeListener{_,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom->
   if(right-left!=oldRight-oldLeft||bottom-top!=oldBottom-oldTop)refresh(root,percent())
  }
  root.post{ViewCompat.requestApplyInsets(root);refresh(root,percent())}
 }
 fun refresh(root:View,percent:Int,insets:WindowInsetsCompat?=ViewCompat.getRootWindowInsets(root)){
  val bars=insets?.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
  val x=margin(root.width,percent);val y=margin(root.height,percent)
  val l=maxOf(x,bars?.left?:0);val t=maxOf(y,bars?.top?:0);val r=maxOf(x,bars?.right?:0);val b=maxOf(y,bars?.bottom?:0)
  if(root.paddingLeft!=l||root.paddingTop!=t||root.paddingRight!=r||root.paddingBottom!=b)root.setPadding(l,t,r,b)
 }
}
