package online.pactuno.blackout
import android.app.DownloadManager
import org.junit.Assert.*
import org.junit.Test
class DownloadFilesTest{
 private fun entry(status:Int,reason:Int=0)=DownloadFiles.Entry(1,"sample.pdf","https://example.com/sample.pdf","application/pdf",status,reason,1024,2048)
 @Test fun queuedAndFailedAreNeverCalledComplete(){
  assertEquals("Waiting to start",DownloadFiles.status(entry(DownloadManager.STATUS_PENDING)))
  assertTrue(DownloadFiles.status(entry(DownloadManager.STATUS_RUNNING)).contains("50%"))
  assertTrue(DownloadFiles.status(entry(DownloadManager.STATUS_FAILED,DownloadManager.ERROR_INSUFFICIENT_SPACE)).contains("not enough storage"))
  assertTrue(DownloadFiles.status(entry(DownloadManager.STATUS_SUCCESSFUL)).startsWith("Completed"))
 }
 @Test fun actualHttpAndStorageErrorsRemainActionable(){
  assertTrue(DownloadFiles.failure(403).contains("HTTP 403"))
  assertTrue(DownloadFiles.failure(DownloadManager.ERROR_CANNOT_RESUME).contains("download again"))
  assertTrue(DownloadFiles.failure(DownloadManager.ERROR_DEVICE_NOT_FOUND).contains("storage"))
 }
}
