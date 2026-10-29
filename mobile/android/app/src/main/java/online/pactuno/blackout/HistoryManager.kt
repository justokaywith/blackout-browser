package online.pactuno.blackout

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

data class HistoryItem(
    val id: String,
    val title: String,
    val url: String,
    val timestamp: Long
)

class HistoryManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("blackout_history_prefs", Context.MODE_PRIVATE)

    fun addVisit(title: String, url: String) {
        if (url.isBlank() || url.startsWith("file://") || url == "blackout://newtab") {
            return
        }

        val items = getHistory().toMutableList()
        // Deduplicate recent same url so it bumps to the top
        items.removeAll { it.url == url }

        val cleanTitle = if (title.isBlank()) url else title
        val newItem = HistoryItem(
            id = System.currentTimeMillis().toString(),
            title = cleanTitle,
            url = url,
            timestamp = System.currentTimeMillis()
        )
        items.add(0, newItem)

        // Cap at 200 items for sovereign performance
        if (items.size > 200) {
            items.subList(200, items.size).clear()
        }

        saveHistory(items)
    }

    fun getHistory(): List<HistoryItem> {
        val jsonString = prefs.getString("history_items", null) ?: return emptyList()
        val list = mutableListOf<HistoryItem>()
        try {
            val jsonArray = JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                list.add(
                    HistoryItem(
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

    fun deleteItem(id: String) {
        val items = getHistory().toMutableList()
        items.removeAll { it.id == id }
        saveHistory(items)
    }

    fun clearHistory() {
        prefs.edit().remove("history_items").apply()
    }

    private fun saveHistory(items: List<HistoryItem>) {
        val jsonArray = JSONArray()
        for (item in items) {
            val obj = JSONObject()
            obj.put("id", item.id)
            obj.put("title", item.title)
            obj.put("url", item.url)
            obj.put("timestamp", item.timestamp)
            jsonArray.put(obj)
        }
        prefs.edit().putString("history_items", jsonArray.toString()).apply()
    }
}
