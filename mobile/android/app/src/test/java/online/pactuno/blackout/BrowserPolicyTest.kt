package online.pactuno.blackout
import org.junit.Test
import org.junit.Assert.*
class BrowserPolicyTest {
 @Test fun unsafeSchemesNeverReachWebView() { for(s in listOf("javascript:alert(1)","file:///data/data/secrets","content://contacts/1","intent://settings","data:text/html,hello","https://user:pass@example.com/","https://appassets.androidplatform.net/assets/ui/index.html","https://blackout.invalid/action/clear"))assertNull(s,BrowserPolicy.navigate(s,"https://duckduckgo.com/?q=%s")) }
 @Test fun addressAndSearchPreserveIntent() { assertEquals("https://pactuno.online/tools/",BrowserPolicy.navigate("pactuno.online/tools/","https://duckduckgo.com/?q=%s"));assertEquals("https://duckduckgo.com/?q=hello+world",BrowserPolicy.navigate("hello world","https://duckduckgo.com/?q=%s"));assertEquals(BrowserPolicy.HOME,BrowserPolicy.navigate(" ","https://duckduckgo.com/?q=%s")) }
 @Test fun downloadsCannotChooseArbitraryPaths() { assertEquals(".._.._secret.pdf",BrowserPolicy.filename("../../secret.pdf"));assertEquals("download",BrowserPolicy.filename(""));assertTrue(BrowserPolicy.filename("a".repeat(200)).length<=120) }
 @Test fun controlsAndMalformedUrlsAreRejected() { for(s in listOf("https://example.com\nsecret", "https://example.com\\@attacker.com", "https://", "https://bad host/"))assertNull(BrowserPolicy.webUrl(s)) }
}
