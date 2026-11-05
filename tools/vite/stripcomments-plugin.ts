// The comments in index.html's inline styles and scripts are for whoever edits the page, not whoever views its source:
// a build leaves them out. Whole lines only in the scripts, so nothing inside a string or a pattern is touched.
import type { Plugin } from 'vite'

export function stripComments(): Plugin {
  return {
    name: 'a-goose-tale-strip-comments',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(/<style>[\s\S]*?<\/style>/g, (style) => style.replace(/[ \t]*\/\*[\s\S]*?\*\/\r?\n?/g, ''))
          .replace(/<script>[\s\S]*?<\/script>/g, (script) => script.replace(/^[ \t]*(\/\/.*|\/\*\*.*\*\/)\r?\n/gm, '')),
    },
  }
}
