// The headed Chrome the dev tools drive (tools/page.mjs, scripts/generators/giant_tree.mjs).
// Plain JavaScript: its callers run under bare `node`.
import { chromium } from "playwright-core";

/**
 * The first Chrome-shaped browser this machine actually has — headed, because
 * a headless Chrome does not dependably hand out a WebGPU device, and on this
 * machine's real GPU rather than a software rasteriser, because the GPU is the
 * thing under test.
 *
 * @param {string[]} channels Branded channel names, stable first; `chromium`
 *   means "whatever playwright has installed".
 * @param {string[]} [args] More switches, after the blocklist one.
 */
export async function launchChrome(channels, args = []) {
  const tried = [];
  for (const channel of channels) {
    try {
      return await chromium.launch({
        headless: false,
        channel: channel === "chromium" ? undefined : channel,
        // WebGPU on whatever GPU this is, blocklist or not: the checks run on
        // one adapter, and which adapter is not their business.
        args: ["--ignore-gpu-blocklist", ...args],
      });
    } catch (error) {
      tried.push(`${channel}: ${String(error).split("\n")[0]}`);
    }
  }
  throw new Error(`no browser to drive (pass --no-open to open the URL by hand). Tried —\n    ${tried.join("\n    ")}`);
}
