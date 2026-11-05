// The page's entry: what has to stand before the game, then the game. The game is fetched from here rather than being
// the entry itself so that it can wait, at its top level, on a chunk of tools that shares its modules (devtools.ts):
// were it the entry, that chunk would be waiting on the very module waiting for it.
if (new URLSearchParams(location.search).has('errors')) await import('./errorbox')
await import('./main')

export {}
