package online.pactuno.blackout
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import java.util.concurrent.Executors

class PdfActivity:AppCompatActivity(){
 private val worker=Executors.newSingleThreadExecutor();private var renderer:PdfRenderer?=null;private var descriptor:ParcelFileDescriptor?=null
 private var index=0;private var generation=0;private var closed=false
 private lateinit var image:ImageView;private lateinit var label:TextView
 override fun onCreate(state:Bundle?){super.onCreate(state)
  val root=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setBackgroundColor(Color.rgb(16,17,25))};setContentView(root)
  val controls=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL}
  val back=Button(this).apply{text="Close";setOnClickListener{finish()}};controls.addView(back)
  val previous=Button(this).apply{text="Previous";setOnClickListener{render(index-1)}};controls.addView(previous)
  label=TextView(this).apply{text="Opening PDF…";setTextColor(Color.WHITE);gravity=Gravity.CENTER};controls.addView(label,LinearLayout.LayoutParams(0,-2,1f))
  controls.addView(Button(this).apply{text="Next";setOnClickListener{render(index+1)}});root.addView(controls)
  image=ImageView(this).apply{adjustViewBounds=true;contentDescription="PDF page preview";setBackgroundColor(Color.WHITE);scaleType=ImageView.ScaleType.FIT_CENTER}
  val scroll=ScrollView(this);scroll.addView(image,ViewGroup.LayoutParams(-1,-2));root.addView(scroll,LinearLayout.LayoutParams(-1,0,1f))
  val uri=intent.data;if(uri?.scheme!="content"){label.text="Select a PDF using Blackout's Open local PDF option.";return}
  worker.execute{try{val fd=contentResolver.openFileDescriptor(uri,"r")?:throw IllegalArgumentException();descriptor=fd;val pdf=PdfRenderer(fd);if(pdf.pageCount !in 1..10000)throw IllegalArgumentException();renderer=pdf;runOnUiThread{if(!closed)render(0)}}catch(_:Exception){runOnUiThread{if(!closed)label.text="Cannot open this PDF. It may be encrypted, damaged or inaccessible."}}}
 }
 private fun render(page:Int){val pdf=renderer?:return;if(page !in 0 until pdf.pageCount)return;index=page;val token=++generation;label.text="Loading page ${page+1}…"
  worker.execute{try{val bitmap=pdf.openPage(page).use{p->val scale=minOf(2f,1800f/maxOf(p.width,p.height));val b=Bitmap.createBitmap(maxOf(1,(p.width*scale).toInt()),maxOf(1,(p.height*scale).toInt()),Bitmap.Config.ARGB_8888);b.eraseColor(Color.WHITE);p.render(b,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);b};runOnUiThread{if(!closed&&token==generation){image.setImageBitmap(bitmap);label.text="${page+1} / ${pdf.pageCount}"}else bitmap.recycle()}}catch(_:Exception){runOnUiThread{if(!closed)label.text="This page could not be rendered."}}}
 }
 override fun onDestroy(){closed=true;generation++;worker.execute{renderer?.close();descriptor?.close()};worker.shutdown();super.onDestroy()}
}
