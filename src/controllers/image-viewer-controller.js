/**
 * @typedef {Object} ImageViewerIcons
 * @property {string} close Existing close SVG markup.
 * @property {string} rotate Existing rotation SVG markup.
 */

/**
 * Route-owned implementation of the legacy image viewer. The controller keeps
 * the established DOM and jQuery event behavior while assigning every timer
 * and listener to a DisposableScope supplied by the active route.
 */
export class ImageViewerController {
  /**
   * @param {Object} dependencies
   * @param {import("../core/environment.js").UserscriptEnvironment} dependencies.environment
   * @param {Function} dependencies.$ jQuery bound to the userscript window.
   * @param {ImageViewerIcons} dependencies.icons
   */
  constructor({ environment, $, icons }) {
    if (typeof environment?.getDocument !== "function") {
      throw new TypeError("ImageViewerController requires an environment.");
    }
    if (typeof $ !== "function") {
      throw new TypeError("ImageViewerController requires jQuery.");
    }
    if (typeof icons?.close !== "string" || typeof icons?.rotate !== "string") {
      throw new TypeError("ImageViewerController requires viewer icons.");
    }

    this.environment = environment;
    this.document = environment.getDocument();
    this.$ = $;
    this.icons = icons;
    this.scope = null;
  }

  /** @return {boolean} */
  get opened() {
    return Boolean(this.scope && !this.scope.disposed);
  }

  /**
   * Replace any existing viewer and mount a fresh one in the active route.
   *
   * @param {string} imageUrl
   * @param {import("../core/disposable-scope.js").DisposableScope} routeScope
   * @return {HTMLElement}
   */
  open(imageUrl, routeScope) {
    if (typeof routeScope?.child !== "function" || routeScope.disposed) {
      throw new TypeError(
        "ImageViewerController.open() requires an active route scope.",
      );
    }

    this.dispose();

    const $ = this.$;
    const viewerScope = routeScope.child();
    this.scope = viewerScope;

    try {
      $("body").append(
        `<div id="imageViewer">
        <div id="iv_header">
            <div class="iv_title">Image Viewer</div>
            <div class="iv_actions">
                <div id="rotate_left">${this.icons.rotate}</div>
                <div id="rotate_right">${this.icons.rotate}</div>
            </div>
            <div id="iv_close">${this.icons.close}</div>
        </div>
        <section>
            <div id="iv_transform">
                <div id="iv_rotate">
                    <img id="iv_image" src="" />
                </div>
            </div>
        </section>
    </div>`,
      );

      const $container = $("#imageViewer");
      const $section = $("#imageViewer > section");
      const $wrapT = $("#iv_transform");
      const $wrapR = $("#iv_rotate");
      const $header = $("#iv_header");
      const $closeIcon = $("#iv_close");
      const $image = $("#iv_image");
      const $rotateLeft = $("#rotate_left");
      const $rotateRight = $("#rotate_right");

      viewerScope.defer(() => {
        $container.remove();
        if (this.scope === viewerScope) this.scope = null;
      });

      $image.attr("src", imageUrl);
      $container.css("display", "flex");
      $wrapT.css("transform-origin", "0 0");
      $wrapT.css("transition", `transform 0.15s ease`);
      $wrapR.css("transform-origin", "center");
      $wrapR.css("transition", `transform 0.15s ease`);
      $wrapT.css("will-change", "transform");
      $wrapR.css("will-change", "transform");

      let rotate = 0;
      let scale = 1;
      let posX = 0;
      let posY = 0;
      let isDragging = false;
      let isMovingPhoto = false;
      let startX;
      let startY;
      let previousPosition = {
        x: 0,
        y: 0,
      };

      viewerScope.setInterval(() => {
        const currentPosition = {
          x: posX,
          y: posY,
        };
        if (
          currentPosition.x !== previousPosition.x ||
          currentPosition.y !== previousPosition.y
        ) {
          isMovingPhoto = true;
        } else {
          isMovingPhoto = false;
        }
        previousPosition = currentPosition;
      }, 100);

      const updateImageStyle = () => {
        $wrapT.css(
          "transition",
          isMovingPhoto ? "none" : `transform 0.15s ease`,
        );
        $wrapT.css(
          "transform",
          `translate(${posX}px, ${posY}px) scale(${scale})`,
        );
        $wrapR.css("transform", `rotate(${rotate}deg)`);

        if (scale == 1) {
          $image.css("cursor", "zoom-in");
        } else {
          $image.css("cursor", "grabbing");
        }
      };

      const makeZoomAction = (event, newScale) => {
        event.preventDefault();

        const prevScale = scale;

        // newScale should be null when passing by wheel event
        if (newScale == null) {
          const factor = 0.1;
          const delta = event.originalEvent.deltaY < 0 ? 1 : -1;
          scale = Math.min(5, Math.max(1, scale + delta * factor * scale));
        } else {
          scale = newScale;
        }

        const rect = $section[0].getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;

        const zoomTargetX = (mx - posX) / prevScale;
        const zoomTargetY = (my - posY) / prevScale;

        posX = -zoomTargetX * scale + mx;
        posY = -zoomTargetY * scale + my;

        updateImageStyle();
      };

      viewerScope.listenJQuery($image, "load", () => {
        posX = 0;
        posY = 0;
        updateImageStyle();
      });

      viewerScope.listenJQuery($image, "dragstart drop", (event) => {
        event.preventDefault();
      });

      viewerScope.listenJQuery($image, "click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!isMovingPhoto) {
          if (scale <= 1) {
            makeZoomAction(
              event,
              Math.min(Math.max(1, scale + 1.25), 5),
            );
          } else {
            scale = 1;
            posX = 0;
            posY = 0;
          }

          updateImageStyle();
        }
      });

      viewerScope.listenJQuery($section, "wheel", (event) => {
        event.preventDefault();
        makeZoomAction(event);
      });

      viewerScope.listenJQuery($container, "wheel", (event) => {
        event.preventDefault();
      });

      viewerScope.listenJQuery($image, "mousedown", (event) => {
        if (scale == 1) return;

        isDragging = true;

        startX = event.pageX - posX;
        startY = event.pageY - posY;
        $image.css("cursor", "grabbing");
      });

      viewerScope.listenJQuery($image, "mouseup", () => {
        if (scale == 1) return;

        isDragging = false;
        $image.css("cursor", "grab");
      });

      viewerScope.listenJQuery($rotateLeft, "click", () => {
        rotate -= 90;
        updateImageStyle();
      });

      viewerScope.listenJQuery($rotateRight, "click", () => {
        rotate += 90;
        updateImageStyle();
      });

      viewerScope.listenJQuery(
        $(this.document),
        "mousemove.igHelper",
        (event) => {
          if (!isDragging) return;
          event.preventDefault();

          posX = event.pageX - startX;
          posY = event.pageY - startY;

          updateImageStyle();
        },
      );

      viewerScope.listenJQuery($container, "click", () => {
        this.dispose();
      });

      viewerScope.listenJQuery($closeIcon, "click", () => {
        this.dispose();
      });

      viewerScope.listenJQuery($header, "click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      return $container[0];
    } catch (error) {
      viewerScope.dispose();
      throw error;
    }
  }

  /** @return {*[]} */
  dispose() {
    const scope = this.scope;
    const errors = scope?.dispose() || [];
    if (this.scope === scope) this.scope = null;
    this.$("#imageViewer").remove();
    return errors;
  }
}
