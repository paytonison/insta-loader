# AGENTS.md — Instagram Downloader Rebuild

## Mission and scope

Build a new, standalone Instagram downloader for Safari on macOS using the Userscripts app. Support one-click downloads of photos, carousels, Reels, and Stories, with the best available media quality and audio intact when the source contains audio. No framework, bundler, transpiler, package-manager requirement, or external runtime dependency unless the user requests one.

These instructions govern the rebuild and replace the previous preservation-first policy. The user's current task defines the required outcome; old implementation details are not requirements. Keep the existing working third-party downloader intact as a separate comparison reference, not a foundation that the new implementation must inherit.

## Standing permission to delete and replace code

You have explicit, standing permission to delete, replace, consolidate, or rewrite implementation code whenever your engineering judgment says it improves the requested result. This includes correct, working code, code you just wrote, entire files, and whole subsystems. You do not need separate approval merely because a change removes code or replaces an architecture.

**It is better to delete good code than tack on more bad code. Preserve required behavior, not existing implementation.**

A function can work correctly and still be unnecessary, duplicate another mechanism, or force a worse overall design. You do not have to prove that every removed function is broken. Explain the reason for substantial replacements and validate the resulting behavior; do not turn that explanation into an approval gate.

Choose the simplest coherent implementation that meets the requirements, not the smallest diff. Do not retain an architecture merely because it already exists or took effort to build. Conversely, do not delete required capabilities or obscure logic merely to reduce line count. Correctness, reliability, understandable control flow, and total maintenance burden matter more than code size.

## Replace failed approaches; do not accumulate them

Before adding a workaround, trace the active failure and consider whether removing or replacing the responsible mechanism solves it more directly. A patch is appropriate when it is the clearest complete fix, not simply because it preserves more code.

When replacing an implementation, remove its superseded callers, handlers, settings, flags, helpers, comments, and other dependencies that no longer serve a requirement. Do not keep parallel old/new implementations, commented-out bodies, disabled experiments, or fallback chains solely "just in case." Use existing version history for historical reference rather than shipping a code museum.

A fallback must address an identified failure mode and remain independently understandable and testable. Defensive behavior is not automatically unnecessary, but its existence does not make its particular implementation untouchable. Keep or reimplement necessary safeguards; remove unsupported baggage. Clean up unsuccessful experiments before layering on a different approach.

Do not resurrect an intentionally rejected implementation merely to satisfy legacy architecture assumptions or tests. Update tests that encode obsolete implementation details. Never delete or weaken a test of a still-required behavior just to make the results pass.

## Platform and media constraints

Implement and validate for Safari with Userscripts first. Tampermonkey compatibility is secondary and must not compromise that target. Feature-detect optional manager APIs and keep any necessary compatibility boundary small. Do not assume identical behavior across userscript managers or between page and userscript execution contexts.

Start with media resources actually loaded by the browser. Do not revive Instagram private media-API/GraphQL retrieval, DASH parsing, manifest-based selection, or a streaming-reconstruction subsystem without an explicit user request for that experiment. Code-deletion authority does not authorize reversing this project decision.

Select media belonging to the intended post or carousel/Story item, not a nearby preview or stale item. Preserve carousel order. Deliver one usable video file with its audio when audio exists, rather than separate video/audio files. Do not silently substitute a lower-quality asset and call it the best available source.

Validate downloaded output, not just metadata or a successful request. Check identity, dimensions, playback, audio, filenames, and relevant codec/container properties. Do not infer quality from file size alone or claim "original" or "maximum" quality without supporting evidence. Failure to resolve an acceptable source should produce an honest, useful error, not a speculative new subsystem.

## Work from evidence

Read relevant code and trace active execution before changing it. Treat user runtime observations as evidence and comments as hypotheses. Check dynamic handlers and lifecycle hooks before declaring a path unused. Investigate rather than inventing browser, manager, network, or CDN explanations.

Before implementation, briefly identify the outcome, material assumptions, and the check that would demonstrate success. Then proceed within the authorized scope. Do not repeatedly ask permission for implementation-level deletion already authorized here. Clarify genuine changes to user requirements or protected scope; do not conceal them as refactoring.

Prefer direct control flow and small, purposeful functions. Add abstractions, configuration, retries, and observers only for concrete needs. Do not introduce speculative general-purpose frameworks or unrelated features.

## Runtime behavior and privacy

Make initialization and UI attachment safe to repeat without duplicate buttons, listeners, observers, or downloads. Handle dynamic navigation without carrying stale media identity into a new post. Bound retries and polling, avoid repeated full-page scans, and clean up observers, timers, listeners, temporary nodes, and object URLs when no longer needed.

Keep failures local and understandable. Do not swallow relevant errors or claim a completed download when only initiation is observable. State what actually succeeded.

Use the narrowest demonstrated userscript permissions. Do not widen host access preemptively, add telemetry or third-party data transfers, log credentials or private account data, or automate account actions unrelated to the requested download.

## Validation and completion

Use the separate working downloader as a behavioral comparison on the same media. Check correct item selection, output quality, audio, filenames, carousel order, and navigation behavior. Run the two scripts separately when comparing them so overlapping controls or hooks do not contaminate the result.

Check syntax and startup, then exercise representative photos, mixed carousels, Reels, and Stories as their support is implemented. Include direct loads and in-page navigation, repeated initialization, and a failure case. Add focused reproducible tests where useful without creating a large testing infrastructure for its own sake.

Deletion is part of the validation scope: check that removed code has no stale references and that still-required behavior remains covered. A smaller program that loses required behavior is not a successful simplification.

Report what changed or was removed, why, what was actually tested, and what remains uncertain. Static inspection, mocks, or testing in another browser do not establish Safari/Userscripts compatibility. Without access to the target environment, deliver the implementation and precise remaining checks, explicitly marked unverified. Never fabricate test results.

## Boundaries of deletion authority

The standing permission applies to implementation work within this project. It does not authorize deleting the separate reference downloader, unrelated user work, credentials, downloaded media, external files, or repository history. Inspect the working tree and preserve unrelated uncommitted changes. Ordinary scoped source deletion is authorized; destructive resets, broad cleanup commands, and history rewriting are not substitutes for editing.

Do not create commits, branches, pull requests, releases, or version bumps unless requested. Do not alter these instructions to excuse a violation of the requirements.

**Default decision: fix the system, even when that means removing good code. Do not preserve the system's mistakes by surrounding them with more code.**
