/**
 * Application-lifetime owner for DOM discovery that must survive route
 * transitions. Feature-specific listeners discovered here are still handed to
 * the active route scope by the injected callbacks.
 */
export class ApplicationDomLifecycleService {
  /**
   * @param {Object} options
   * @param {import("../core/environment.js").UserscriptEnvironment} options.environment
   * @param {() => (Element|null)} options.findMountRoot
   * @param {(node: Node, root: Element) => void} [options.onAddedNode]
   * @param {(root: Element, change: *) => void} [options.onMountScan]
   * @param {() => (*|null)} [options.registerPerformanceObserver]
   * @param {(error: *, details: Object) => void} [options.onError]
   */
  constructor({
    environment,
    findMountRoot,
    onAddedNode,
    onMountScan,
    registerPerformanceObserver,
    onError,
  }) {
    if (typeof environment?.getDocument !== "function") {
      throw new TypeError(
        "ApplicationDomLifecycleService requires an environment.",
      );
    }
    if (typeof findMountRoot !== "function") {
      throw new TypeError(
        "ApplicationDomLifecycleService requires a mount-root locator.",
      );
    }

    this.environment = environment;
    this.document = environment.getDocument();
    this.findMountRoot = findMountRoot;
    this.onAddedNode = onAddedNode || (() => {});
    this.onMountScan = onMountScan || (() => {});
    this.registerPerformanceObserver =
      registerPerformanceObserver || (() => null);
    this.onError = onError || (() => {});

    this.scope = null;
    this.mountRoot = null;
    this.mutationObserver = null;
    this.performanceObserver = null;
    this.observationTarget = null;
    this.mounted = false;
  }

  /**
   * @param {import("../core/disposable-scope.js").DisposableScope} parentScope
   * @return {boolean}
   */
  mount(parentScope) {
    if (this.mounted) return false;
    if (typeof parentScope?.child !== "function") {
      throw new TypeError(
        "ApplicationDomLifecycleService.mount() requires a DisposableScope.",
      );
    }

    this.mounted = true;
    this.scope = parentScope.child();
    this.performanceObserver = this.registerPerformanceObserver();
    if (typeof this.performanceObserver?.disconnect === "function") {
      this.scope.defer(() => this.performanceObserver?.disconnect());
    }

    const MutationObserver = this.environment.window?.MutationObserver;
    if (typeof MutationObserver === "function") {
      this.mutationObserver = new MutationObserver((records) => {
        this.handleMutations(records);
      });
      this.scope.defer(() => this.mutationObserver?.disconnect());
      this.connectObserver();
    }

    this.scanMount({ reason: "application-start", type: "mount" });
    return true;
  }

  /**
   * Rescan synchronously. In particular, the application reload path calls
   * this after the route coordinator has recreated its private scope, so
   * retained Story DOM does not need another mutation before being rebound.
   *
   * @param {*} change
   * @return {boolean}
   */
  refresh(change) {
    if (!this.mounted) return false;
    this.connectObserver();
    this.scanMount(change || { type: "refresh" });
    return true;
  }

  /** @return {*[]} */
  dispose() {
    if (!this.mounted) return [];
    this.mounted = false;
    const errors = this.scope?.dispose() || [];
    this.scope = null;
    this.mountRoot = null;
    this.mutationObserver = null;
    this.performanceObserver = null;
    this.observationTarget = null;
    return errors;
  }

  /** @private */
  connectObserver() {
    if (!this.mutationObserver) return;

    const mountRoot = this.findMountRoot();
    const target =
      mountRoot ||
      this.document.documentElement ||
      this.document.body ||
      this.document;
    this.mountRoot = mountRoot;

    if (!target || target === this.observationTarget) return;

    try {
      this.mutationObserver.disconnect();
      this.mutationObserver.observe(target, {
        childList: true,
        subtree: true,
      });
      this.observationTarget = target;
    } catch (error) {
      this.observationTarget = null;
      this.onError(error, { phase: "mutation-observe", target });
    }
  }

  /**
   * @param {MutationRecord[]} records
   * @private
   */
  handleMutations(records) {
    if (!this.mounted) return;

    const previousRoot = this.mountRoot;
    this.connectObserver();
    if (!this.mountRoot) return;

    if (this.mountRoot !== previousRoot) {
      this.scanMount({ reason: "mount-root-discovered", type: "mount" });
      return;
    }

    for (const mutation of records || []) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes || []) {
        if (
          node === this.mountRoot ||
          this.mountRoot.contains?.(node) === true
        ) {
          try {
            this.onAddedNode(node, this.mountRoot);
          } catch (error) {
            this.onError(error, { node, phase: "mutation-callback" });
          }
        }
      }
    }
  }

  /**
   * @param {*} change
   * @private
   */
  scanMount(change) {
    const currentRoot = this.findMountRoot();
    if (!currentRoot) return;
    this.mountRoot = currentRoot;
    try {
      this.onMountScan(currentRoot, change);
    } catch (error) {
      this.onError(error, { change, phase: "mount-scan" });
    }
  }
}
