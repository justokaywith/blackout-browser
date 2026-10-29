package online.pactuno.blackout

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri

data class SearchEngine(
    val id: String,
    val name: String,
    val searchUrlTemplate: String,
    val homeUrl: String,
    val iconEmoji: String
)

class SearchEngineManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("blackout_search_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SEARCH_ENGINE_ID = "selected_search_engine_id"

        val ENGINES = listOf(
            SearchEngine(
                id = "duckduckgo",
                name = "DuckDuckGo",
                searchUrlTemplate = "https://duckduckgo.com/?q=%s",
                homeUrl = "https://duckduckgo.com",
                iconEmoji = "🦆"
            ),
            SearchEngine(
                id = "brave",
                name = "Brave Search",
                searchUrlTemplate = "https://search.brave.com/search?q=%s",
                homeUrl = "https://search.brave.com",
                iconEmoji = "🦁"
            ),
            SearchEngine(
                id = "google",
                name = "Google",
                searchUrlTemplate = "https://www.google.com/search?q=%s",
                homeUrl = "https://www.google.com",
                iconEmoji = "🔍"
            ),
            SearchEngine(
                id = "startpage",
                name = "Startpage",
                searchUrlTemplate = "https://www.startpage.com/sp/search?query=%s",
                homeUrl = "https://www.startpage.com",
                iconEmoji = "🛡️"
            ),
            SearchEngine(
                id = "ecosia",
                name = "Ecosia",
                searchUrlTemplate = "https://www.ecosia.org/search?q=%s",
                homeUrl = "https://www.ecosia.org",
                iconEmoji = "🌱"
            ),
            SearchEngine(
                id = "bing",
                name = "Bing",
                searchUrlTemplate = "https://www.bing.com/search?q=%s",
                homeUrl = "https://www.bing.com",
                iconEmoji = "🌐"
            )
        )
    }

    fun getAllEngines(): List<SearchEngine> = ENGINES

    fun getCurrentEngine(): SearchEngine {
        val savedId = prefs.getString(KEY_SEARCH_ENGINE_ID, "duckduckgo") ?: "duckduckgo"
        return ENGINES.find { it.id == savedId } ?: ENGINES.first()
    }

    fun setCurrentEngine(id: String) {
        prefs.edit().putString(KEY_SEARCH_ENGINE_ID, id).apply()
    }

    fun buildSearchUrl(query: String): String {
        val engine = getCurrentEngine()
        val encoded = Uri.encode(query)
        return String.format(engine.searchUrlTemplate, encoded)
    }
}
