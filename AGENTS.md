# AGENTS.md — Instagram Downloader Userscript

## Scope

These instructions apply to the entire repository unless a more specific `AGENTS.md` in a subdirectory overrides them.

This repository contains a mature, behavior-sensitive Instagram downloader userscript. Treat it as a hostile-target compatibility project, not as a clean-slate example application. Instagram changes its DOM, media delivery, CDN behavior, and internal interfaces without notice. Code that appears redundant, defensive, or inelegant may encode previously discovered failure cases.

## Authority and intent

1. The user's current task prompt is authoritative.
2. Explicit user corrections override earlier assumptions, repository conventions, tests, comments, and generic engineering advice.
3. Never reinterpret a literal instruction merely because it conflicts with normal software-development practice.
4. Do not silently fill gaps in intent when the assumption could change architecture, behavior, media quality, compatibility, permissions, or file deletion.
5. When an ambiguity is material, identify it before making the consequential change. Do not guess and then conceal the guess inside an implementation.
6. More code, a cleaner abstraction, or a more conventional design is not automatically an improvement.

## Primary platform and compatibility target

The primary reference environment is:

- Safari on macOS
- The Userscripts app distributed through the Apple App Store

Tampermonkey is a secondary compatibility target.

All changes must follow these rules:

- Implement against Safari and the Userscripts app first.
- Do not solve a problem only through a Tampermonkey-specific API or behavior.
- Do not assume that a `GM_*` or `GM.*` API behaves identically across userscript managers.
- Feature-detect optional APIs at runtime when practical.
- When a manager-specific capability is necessary, isolate it behind a small compatibility boundary and provide a Safari/Userscripts-compatible path.
- Do not weaken Safari/Userscripts support to simplify Tampermonkey support.
- Preserve ordinary browser behavior whenever it is more reliable than a manager-specific abstraction.
- Do not add a bundler, framework, transpiler, package manager, build system, or external runtime dependency unless the task explicitly requires it.

## Non-negotiable media-quality invariants

The current high-quality behavior was recovered by disabling the media-API and DASH-based paths. Treat that result as established project knowledge.

Unless the user explicitly requests a controlled experiment or a reversal of this decision:

- Do not re-enable, reconstruct, or prefer Instagram media-API retrieval.
- Do not re-enable, reconstruct, or prefer DASH manifest parsing or DASH-derived asset selection.
- Do not replace the working browser/DOM/resource-derived media path with a private API, GraphQL response, manifest, internal endpoint, or metadata shortcut merely because it appears cleaner or more direct.
- Do not assume that API-provided media is the highest-quality media.
- Do not use API metadata as the quality oracle when observed browser-delivered resources contradict it.
- Preserve the current direct-resource download behavior.
- Preserve the current settings and defaults that keep the API/DASH mechanisms disabled.
- Do not alter media URL selection, ranking, deduplication, codec choice, resolution choice, or download routing outside the explicit scope of the task.

If a task explicitly requires work in this area, keep the existing working path intact and make the experiment isolated, reversible, and disabled by default unless the user says otherwise. Validate actual output dimensions, file size, codec/container where relevant, and visible quality. A successful HTTP response is not proof of equivalent quality.

## Change discipline

This codebase is not to be refactored merely because an agent dislikes its shape.

- Make the smallest change that fully solves the stated problem.
- Do not perform unsolicited refactors, rewrites, cleanups, modernizations, reorganizations, renames, formatting passes, comment rewrites, or dependency changes.
- Do not replace working code with a new abstraction solely to reduce line count or duplication.
- Do not consolidate fallback paths unless the task requires it and their behavioral equivalence has been demonstrated.
- Do not delete defensive checks, timing workarounds, observers, retries, compatibility branches, or apparently redundant fallbacks without evidence that they are obsolete.
- Do not broaden the task to nearby defects or stylistic concerns.
- Do not change public behavior, UI text, settings, defaults, keyboard behavior, download naming, or metadata unless explicitly requested.
- Do not reformat unrelated lines. Preserve surrounding style and minimize diff noise.
- Prefer a local patch over a repository-wide redesign.
- If an ugly implementation works because a straightforward implementation failed, preserve the ugly implementation.

## Existing behavior is evidence, not permission to override the user

Preserving working behavior is normally important, but it does not outrank explicit user intent.

When the user explicitly requests deletion, replacement, abandonment, or a complete restart:

- Treat the destructive change as intentional.
- Do not restore deleted files because the repository looks incomplete.
- Do not resurrect the rejected implementation from Git history, another branch, generated output, backups, tests, or copied code.
- Do not rebuild the new solution on top of the architecture the user rejected.
- Do not interpret failing legacy tests as proof that the deleted behavior must return.
- Clearly distinguish code being retained for reference from code authorized for reuse.

Never use `git restore`, `git checkout --`, `git reset --hard`, `git clean`, or an equivalent destructive recovery command unless the user explicitly directs it for the named paths.

## Before editing

Before changing code, inspect the relevant implementation and produce a concise task understanding containing:

1. The requested outcome.
2. The files, functions, or subsystems expected to change.
3. The behaviors and code paths that must remain untouched.
4. Any material assumption that would affect compatibility, media quality, or architecture.
5. The validation that will demonstrate success.

Do not produce an elaborate ceremonial plan. The purpose is to expose incorrect assumptions before they become code.

When the task prompt already authorizes implementation, proceed after this concise understanding unless the unresolved ambiguity could cause destructive or architectural harm.

## Investigation rules

- Read the actual code before proposing a fix.
- Trace the active execution path instead of inferring behavior from names alone.
- Search for duplicate handlers, fallback implementations, feature flags, settings, and manager-specific branches before editing.
- Treat comments as clues, not infallible truth.
- Treat current runtime observations supplied by the user as strong evidence.
- Do not declare a path dead merely because static inspection did not reveal an obvious caller; userscripts may be driven by DOM mutation, event delegation, injected page context, timers, or dynamically installed handlers.
- Distinguish browser page context from userscript sandbox context.
- Distinguish an Instagram regression from a userscript-manager incompatibility.
- Do not attribute a failure to Safari, Userscripts, Tampermonkey, CSP, CORS, Instagram, or the CDN without evidence.

## Userscript metadata and permissions

Treat the metadata block as part of the program's compatibility and security surface.

- Do not change `@match`, `@include`, `@exclude`, `@grant`, `@connect`, `@run-at`, `@inject-into`, update URLs, download URLs, version fields, or other metadata unless the task requires it.
- Do not widen host permissions or network access preemptively.
- Add the narrowest permission that solves a demonstrated requirement.
- Preserve installation and update behavior unless explicitly changing it.
- Keep Safari/Userscripts limitations in mind before relying on page injection, cross-origin requests, downloads, clipboard access, or privileged APIs.

## Runtime safety

- Avoid duplicate UI injection, duplicate observers, duplicate event listeners, and duplicate downloads.
- Preserve idempotency when initialization may run more than once.
- Clean up observers, timers, temporary DOM nodes, object URLs, and listeners when the existing lifecycle requires it.
- Do not introduce unbounded polling or high-frequency mutation work.
- Do not block the main thread with unnecessary full-page scans.
- Do not log sensitive tokens, cookies, request headers, private responses, or account information.
- Do not send user data to a new third-party service.
- Do not add telemetry or analytics.
- Do not automate account actions unrelated to downloading media.

## Error handling

- Fail locally and visibly rather than corrupting unrelated behavior.
- Preserve a known-good fallback when introducing a new path.
- Do not convert a recoverable failure into a page-wide exception.
- Avoid empty `catch` blocks unless the failure is intentionally ignorable and the reason is documented nearby.
- Do not report success until the media was actually resolved or downloaded as intended.
- Error messages should identify the failed stage without exposing private data.

## Validation

Validate the changed behavior in the environment affected by the task. Safari with the Userscripts app is the reference result.

At minimum:

- Check syntax and startup behavior.
- Confirm the script initializes only once where intended.
- Confirm the targeted Instagram surface still works after dynamic navigation.
- Confirm unaffected download paths remain unchanged.
- Confirm image and video downloads retain the expected quality.
- Confirm no API/DASH path was accidentally reactivated.
- Confirm no new Tampermonkey-only dependency was introduced.
- Confirm the metadata block still grants only the required capabilities.
- Review the final diff for unrelated edits.

For media-resolution changes, test more than one representative post when possible. Include relevant combinations such as a single image, a single video, a carousel, a Reel, a modal/permalink view, or a dynamically loaded feed item only when those surfaces are within scope. Do not claim support for an untested surface.

If a reproducible automated test is practical, add or update it narrowly. Do not build a large test framework merely to satisfy a small task. Legacy tests that encode explicitly rejected behavior are not authoritative.

## Completion report

At the end of a task, report:

- What changed.
- Why that change solves the observed problem.
- What was deliberately left unchanged.
- What validation was performed.
- Any remaining uncertainty or untested environment.

Do not claim that a browser-specific issue is fixed unless it was validated in that browser or the limitation is stated clearly.

## Git and repository safety

- Preserve all user-authored changes, including unstaged changes.
- Do not discard, overwrite, revert, or normalize unrelated work.
- Do not create commits, tags, branches, pull requests, releases, or version bumps unless requested.
- Do not amend or rewrite history unless requested.
- Do not treat an unclean working tree as permission to restore files.
- Before touching a file with unrelated modifications, inspect the diff and work around those changes.
- Keep generated files and source files distinct.

## Default decision rule

When choosing between a clever broad solution and a narrow solution that respects the established behavior, choose the narrow solution.

When choosing between an agent assumption and an explicit user statement, choose the explicit user statement.

When choosing between architectural elegance and demonstrated media quality, choose demonstrated media quality.
