package online.pactuno.blackout

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class FavoriteItem(
    val id: String,
    val title: String,
    val url: String,
    val timestamp: Long
)

class FavoritesManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("blackout_favorites_prefs", Context.MODE_PRIVATE)

    init {
        // Seed initial default favorites on first launch
        if (!prefs.contains("favorites_initialized")) {
            seedDefaultFavorites()
            prefs.edit().putBoolean("favorites_initialized", true).apply()
        }
    }

    private fun seedDefaultFavorites() {
        val defaults = listOf(
            FavoriteItem("1", "Pactuno Sovereign", "https://pactuno.online", System.currentTimeMillis()),
            FavoriteItem("2", "DuckDuckGo", "https://duckduckgo.com", System.currentTimeMillis()),
            FavoriteItem("3", "YouTube", "https://m.youtube.com", System.currentTimeMillis()),
            FavoriteItem("4", "GitHub", "https://github.com", System.currentTimeMillis()),
            FavoriteItem("5", "Wikipedia", "https://en.wikipedia.org", System.currentTimeMillis())
        )
        saveFavorites(defaults)
    }

    fun addFavorite(title: String, url: String): Boolean {
        if (url.isBlank() || url.startsWith("file://") || url == "blackout://newtab") {
            return false
        }

        val items = getFavorites().toMutableList()
        if (items.any { it.url == url }) {
            return false // Already favorited
        }

        val cleanTitle = if (title.isBlank()) url else title
        items.add(
            0,
            FavoriteItem(
                id = System.currentTimeMillis().toString(),
                title = cleanTitle,
                url = url,
                timestamp = System.currentTimeMillis()
            )
        )
        saveFavorites(items)
        return true
    }

    fun removeFavorite(url: String): Boolean {
        val items = getFavorites().toMutableList()
        val removed = items.removeAll { it.url == url }
        if (removed) {
            saveFavorites(items)
        }
        return removed
    }

    fun deleteById(id: String) {
        val items = getFavorites().toMutableList()
        items.removeAll { it.id == id }
        saveFavorites(items)
    }

    fun isFavorite(url: String): Boolean {
        if (url.isBlank() || url.startsWith("file://") || url == "blackout://newtab") return false
        return getFavorites().any { it.url == url }
    }

    fun getFavorites(): List<FavoriteItem> {
        val jsonString = prefs.getString("favorites_items", null) ?: return emptyList()
        val list = mutableListOf<FavoriteItem>()
        try {
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                list.add(
                    FavoriteItem(
                        id = obj.getString("id"),
                        title = obj.getString("title"),
                        url = obj.getString("url"),
                        timestamp = obj.getLong("timestamp")
                    )
                )
            }
        } catch (e: Exception) {}
        return list
    }

    private fun saveFavorites(items: List<FavoriteItem>) {
        val jsonArray = JSONArray()
        for (item in items) {
            val obj = JSONObject()
            obj.put("id", item.id)
            obj.put("title", item.title)
            obj.put("url", item.url)
            obj.put("timestamp", item.timestamp)
            jsonArray.put(obj)
        }
        prefs.edit().putString("favorites_items", jsonArray.toString()).apply()
    }
}
