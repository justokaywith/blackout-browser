package online.pactuno.blackout

import java.net.URI
import java.net.URLEncoder

object BrowserPolicy {
    const val HOME = "blackout://newtab"
    fun webUrl(value: String): String? = try {
        val u = URI(value)
        if (value.length > 8192 || value.any { it.code < 32 || it == '\\' } ||
            u.scheme?.lowercase() !in listOf("https", "http") || u.host.isNullOrBlank() ||
            u.rawUserInfo != null || u.host.lowercase() in listOf("appassets.androidplatform.net", "blackout.invalid")) null
        else u.toASCIIString()
    } catch (_: Exception) { null }
    fun navigate(input: String, search: String): String? {
        val s = input.trim()
        if (s.isEmpty() || s == HOME) return HOME
        if (s.length > 8192 || s.any { it.code < 32 || it == '\\' }) return null
        if (Regex("^[a-zA-Z][a-zA-Z0-9+.-]*:").containsMatchIn(s)) return webUrl(s)
        if (!s.contains(' ') && (s.contains('.') || s == "localhost")) return webUrl("https://$s")
        return webUrl(search.replace("%s", URLEncoder.encode(s, "UTF-8")))
    }
    fun filename(value: String): String = value.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), "_").trim().take(120).ifEmpty { "download" }
}
