# Blackout 0.2.37

Favorites now display one centered website logo instead of an initial with a second image beneath it. Bookmarks and tabs use the same first-party favicon resolver, including direct Pactuno/Relay brand assets and ico/svg/png fallback paths. Missing images use a neutral globe.

Favicon lookups use origin-only targets, omit credentials, enforce HTTPS/image types and bounded response sizes, deduplicate concurrent lookups and keep a bounded in-memory cache.126automated tests pass. Native post-install visual acceptance remains pending.
