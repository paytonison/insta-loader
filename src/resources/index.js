import internalCss from "./internal.css";
import upstreamProvenance from "./upstream-provenance.json";

// Upstream style.css has no terminal newline. The source file keeps the
// repository-standard newline, while the exported runtime value retains the
// exact upstream bytes recorded in upstream-provenance.json.
export const INTERNAL_CSS = internalCss.endsWith("\n")
  ? internalCss.slice(0, -1)
  : internalCss;
export const UPSTREAM_PROVENANCE = Object.freeze(upstreamProvenance);
