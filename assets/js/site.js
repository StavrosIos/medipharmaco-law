(function () {
  "use strict";

  var body = document.body;
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-site-nav]");
  var smoother = null;
  var smootherHeader = document.querySelector("[data-site-header]");
  var smootherMain = document.querySelector("#main-content");
  var smootherContent = document.querySelector("#smooth-content");
  var smootherOffset = 0;
  var scrollSmootherMedia;

  if (window.gsap && window.ScrollTrigger && window.ScrollSmoother && smootherHeader && smootherMain && smootherContent && window.gsap.matchMedia) {
    window.gsap.registerPlugin(window.ScrollTrigger, window.ScrollSmoother);
    scrollSmootherMedia = window.gsap.matchMedia();
    scrollSmootherMedia.add("(min-width: 66.001rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)", function () {
      var priorOffset = body.style.getPropertyValue("--smoother-content-offset");
      smootherOffset = smootherHeader.getBoundingClientRect().height;
      // Replace the header's removed flow space; main already has its own hero overlap.
      body.style.setProperty("--smoother-content-offset", smootherOffset.toFixed(2) + "px");
      body.classList.add("has-scroll-smoother");

      var pinTriggers = [];
      function pinTallSidebars() {
        var selectors = [".v4-solution-nav", ".v4-founders-grid > div:first-child", ".service-nav"];
        selectors.forEach(function (selector) {
          document.querySelectorAll(selector).forEach(function (element) {
            if (element.dataset.smootherPin === "true") return;
            if (element.getBoundingClientRect().height > window.innerHeight - smootherOffset - 32) {
              element.dataset.smootherPin = "static";
              return;
            }
            var parent = element.parentElement;
            if (!parent) return;
            element.dataset.smootherPin = "true";
            pinTriggers.push(window.ScrollTrigger.create({
              trigger: element,
              pin: element,
              start: "top " + smootherOffset + "px",
              endTrigger: parent,
              end: "bottom bottom",
              pinSpacing: false,
              invalidateOnRefresh: true
            }));
          });
        });
      }

      try {
        smoother = window.ScrollSmoother.create({ smooth: 0.8, smoothTouch: 0, effects: false, ignoreMobileResize: true });
        pinTallSidebars();
        window.ScrollTrigger.refresh();
      } catch (error) {
        pinTriggers.forEach(function (trigger) { trigger.kill(); });
        document.querySelectorAll("[data-smoother-pin]").forEach(function (element) { delete element.dataset.smootherPin; });
        var partialSmoother = window.ScrollSmoother.get && window.ScrollSmoother.get();
        if (partialSmoother) partialSmoother.kill();
        smoother = null;
        body.classList.remove("has-scroll-smoother");
        if (priorOffset) body.style.setProperty("--smoother-content-offset", priorOffset);
        else body.style.removeProperty("--smoother-content-offset");
        return;
      }

      var refreshFrame = 0;
      var pinResizeFrame = 0;
      function syncSidebarPins() {
        pinTriggers = pinTriggers.filter(function (trigger) {
          var element = trigger.trigger;
          if (!element || element.getBoundingClientRect().height <= window.innerHeight - smootherOffset - 32) return true;
          trigger.kill();
          delete element.dataset.smootherPin;
          return false;
        });
        pinTallSidebars();
        window.ScrollTrigger.refresh();
      }
      function scheduleSidebarPinSync() {
        if (pinResizeFrame) window.cancelAnimationFrame(pinResizeFrame);
        pinResizeFrame = window.requestAnimationFrame(function () { pinResizeFrame = 0; syncSidebarPins(); });
      }
      window.addEventListener("resize", scheduleSidebarPinSync);
      function scheduleScrollRefresh() {
        if (refreshFrame) return;
        refreshFrame = window.requestAnimationFrame(function () {
          refreshFrame = 0;
          if (smoother && window.ScrollTrigger) window.ScrollTrigger.refresh();
        });
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleScrollRefresh);
      window.addEventListener("load", scheduleScrollRefresh, { once: true });
      var smootherResizeObserver = "ResizeObserver" in window ? new ResizeObserver(scheduleScrollRefresh) : null;
      if (smootherResizeObserver) smootherResizeObserver.observe(smootherContent);

      if (window.location.hash) {
        var initialTarget = null;
        try { initialTarget = document.getElementById(decodeURIComponent(window.location.hash.slice(1))); } catch (error) {}
        var initialAlignedAt = null;
        function alignInitialHash() {
          if (!smoother || !initialTarget) return;
          if (initialAlignedAt !== null && Math.abs(smoother.scrollTop() - initialAlignedAt) > 3) return;
          window.ScrollTrigger.refresh();
          smoother.scrollTo(initialTarget, false, "top " + smootherOffset + "px");
          initialAlignedAt = smoother.scrollTop();
        }
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            if (!smoother || !initialTarget) return;
            alignInitialHash();
            if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignInitialHash);
            window.addEventListener("load", alignInitialHash, { once: true });
          });
        });
      }

      return function () {
        if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
        if (pinResizeFrame) window.cancelAnimationFrame(pinResizeFrame);
        window.removeEventListener("resize", scheduleSidebarPinSync);
        if (smootherResizeObserver) smootherResizeObserver.disconnect();
        pinTriggers.forEach(function (trigger) {
          trigger.kill();
        });
        document.querySelectorAll("[data-smoother-pin]").forEach(function (element) { delete element.dataset.smootherPin; });
        var currentScroll = smoother ? smoother.scrollTop() : window.scrollY;
        if (smoother) smoother.kill();
        smoother = null;
        body.classList.remove("has-scroll-smoother");
        if (priorOffset) body.style.setProperty("--smoother-content-offset", priorOffset);
        else body.style.removeProperty("--smoother-content-offset");
        window.scrollTo(0, currentScroll);
      };
    });
  }

  function scrollToSection(section, smooth) {
    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (smoother) {
      smoother.scrollTo(section, Boolean(smooth && !reducedMotion), "top " + smootherOffset + "px");
      return;
    }
    var headerBottom = smootherHeader ? smootherHeader.getBoundingClientRect().bottom : 0;
    var top = Math.max(0, section.getBoundingClientRect().top + window.scrollY - headerBottom);
    window.scrollTo({ top: top, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
  }

  var backToTop = document.createElement("button");
  backToTop.type = "button";
  backToTop.className = "back-to-top";
  backToTop.setAttribute("aria-label", "Back to top");
  backToTop.hidden = true;
  backToTop.innerHTML = '<svg class="back-to-top__progress" viewBox="0 0 48 48" aria-hidden="true"><circle class="back-to-top__track" cx="24" cy="24" r="21"></circle><circle class="back-to-top__value" cx="24" cy="24" r="21"></circle></svg><svg class="back-to-top__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"></path></svg>';
  body.appendChild(backToTop);

  var backToTopProgress = backToTop.querySelector(".back-to-top__value");
  var backToTopCircumference = 2 * Math.PI * 21;
  var backToTopFrame = 0;
  var consentModalForTop = document.querySelector("[data-consent-modal]");
  var searchDialogForTop = document.querySelector("[data-search-dialog]");

  backToTopProgress.style.strokeDasharray = String(backToTopCircumference);
  backToTopProgress.style.strokeDashoffset = String(backToTopCircumference);

  function updateBackToTop() {
    backToTopFrame = 0;
    var scrollPosition = smoother ? smoother.scrollTop() : window.scrollY;
    var scrollRange = smoother && window.ScrollTrigger
      ? window.ScrollTrigger.maxScroll(window)
      : document.documentElement.scrollHeight - window.innerHeight;
    var progress = scrollRange > 0 ? Math.max(0, Math.min(1, scrollPosition / scrollRange)) : 0;

    backToTopProgress.style.strokeDashoffset = String(backToTopCircumference * (1 - progress));
    backToTop.hidden = scrollPosition <= 200 || body.classList.contains("nav-open") || body.classList.contains("has-consent-banner") || Boolean(consentModalForTop && !consentModalForTop.hidden) || Boolean(searchDialogForTop && searchDialogForTop.open);
  }

  function scheduleBackToTopUpdate() {
    if (backToTopFrame) return;
    backToTopFrame = window.requestAnimationFrame(updateBackToTop);
  }

  window.addEventListener("scroll", scheduleBackToTopUpdate, { passive: true });
  window.addEventListener("resize", scheduleBackToTopUpdate, { passive: true });
  if (window.ScrollTrigger) window.ScrollTrigger.addEventListener("refresh", scheduleBackToTopUpdate);
  if ("ResizeObserver" in window && smootherContent) {
    new ResizeObserver(scheduleBackToTopUpdate).observe(smootherContent);
  }
  if ("MutationObserver" in window) {
    new MutationObserver(scheduleBackToTopUpdate).observe(body, { attributes: true, attributeFilter: ["class"] });
    if (consentModalForTop) new MutationObserver(scheduleBackToTopUpdate).observe(consentModalForTop, { attributes: true, attributeFilter: ["class", "hidden"] });
    if (searchDialogForTop) new MutationObserver(scheduleBackToTopUpdate).observe(searchDialogForTop, { attributes: true, attributeFilter: ["open"] });
  }

  backToTop.addEventListener("click", function () {
    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (smoother) smoother.scrollTo(0, !reducedMotion);
    else window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  });
  scheduleBackToTopUpdate();

  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || link.hasAttribute("download") || link.target && link.target !== "_self") return;
    var targetUrl;
    try { targetUrl = new URL(link.href); } catch (error) { return; }
    if (!targetUrl.hash || targetUrl.origin !== window.location.origin || targetUrl.pathname !== window.location.pathname) return;
    var target;
    try { target = document.getElementById(decodeURIComponent(targetUrl.hash.slice(1))); } catch (error) { return; }
    if (!target) return;
    event.preventDefault();
    if (targetUrl.href !== window.location.href) window.history.pushState(null, "", targetUrl.href);
    scrollToSection(target, true);
  });

  var innerScrollFrames = Array.prototype.slice.call(document.querySelectorAll("[data-inner-scroll-image]"));
  if (innerScrollFrames.length) {
    var innerMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    var innerImages = innerScrollFrames.map(function (frame) {
      return { frame: frame, image: frame.querySelector("[data-inner-scroll-target]"), visible: false, current: 0 };
    }).filter(function (item) { return item.image; });
    var innerScrollTick = 0;

    function clearInnerImageTransforms() {
      innerImages.forEach(function (item) {
        item.current = 0;
        item.image.style.transform = "";
      });
    }
    function renderInnerImages() {
      innerScrollTick = 0;
      if (innerMotionPreference.matches || document.hidden) return;
      var viewportHeight = window.innerHeight;
      var needsAnotherFrame = false;
      innerImages.forEach(function (item) {
        if (!item.visible) return;
        var bounds = item.frame.getBoundingClientRect();
        var overflow = Math.abs(parseFloat(window.getComputedStyle(item.image).top)) || 0;
        var progress = Math.max(0, Math.min(1, (viewportHeight - bounds.top) / (viewportHeight + bounds.height)));
        var destination = (progress * 2 - 1) * overflow;
        item.current += (destination - item.current) * 0.14;
        if (Math.abs(destination - item.current) < 0.08) item.current = destination;
        else needsAnotherFrame = true;
        item.image.style.transform = "translate3d(0, " + item.current.toFixed(2) + "px, 0)";
      });
      if (needsAnotherFrame) innerScrollTick = window.requestAnimationFrame(renderInnerImages);
    }
    function requestInnerImageRender() {
      if (innerMotionPreference.matches) {
        clearInnerImageTransforms();
        return;
      }
      if (!innerScrollTick) innerScrollTick = window.requestAnimationFrame(renderInnerImages);
    }
    function updateInnerImageVisibility(entries) {
      entries.forEach(function (entry) {
        var item = innerImages.filter(function (candidate) { return candidate.frame === entry.target; })[0];
        if (item) item.visible = entry.isIntersecting;
      });
      requestInnerImageRender();
    }

    if ("IntersectionObserver" in window) {
      var innerImageObserver = new IntersectionObserver(updateInnerImageVisibility, { rootMargin: "100px 0px", threshold: 0 });
      innerImages.forEach(function (item) { innerImageObserver.observe(item.frame); });
    } else {
      innerImages.forEach(function (item) { item.visible = true; });
    }
    window.addEventListener("scroll", requestInnerImageRender, { passive: true });
    window.addEventListener("resize", requestInnerImageRender);
    document.addEventListener("visibilitychange", requestInnerImageRender);
    if (innerMotionPreference.addEventListener) innerMotionPreference.addEventListener("change", requestInnerImageRender);
    else if (innerMotionPreference.addListener) innerMotionPreference.addListener(requestInnerImageRender);
  }

  var mobileMap = document.querySelector("[data-mobile-map]");
  if (mobileMap) {
    var mapToggle = document.querySelector("[data-map-toggle]");
    var mapMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    var mapMobileViewport = window.matchMedia("(max-width: 48rem)");
    var mapVisible = false;
    var mapFocused = false;
    var mapUserPaused = false;
    var mapFrame = 0;
    var mapLastTime = 0;
    var mapElapsed = 0;
    var mapDirection = 1;
    var mapDuration = 28000;

    function stopMapPan() {
      if (mapFrame) window.cancelAnimationFrame(mapFrame);
      mapFrame = 0;
      mapLastTime = 0;
    }
    function syncMapToggle() {
      if (!mapToggle) return;
      mapToggle.hidden = mapMotionPreference.matches || !mapMobileViewport.matches;
      mapToggle.textContent = mapUserPaused ? "Resume map" : "Pause map";
      mapToggle.setAttribute("aria-pressed", mapUserPaused ? "true" : "false");
    }
    function mapPanAllowed() {
      return mapMobileViewport.matches && mapVisible && !document.hidden && !mapMotionPreference.matches && !mapUserPaused && !mapFocused;
    }
    function panMap(time) {
      if (!mapPanAllowed()) { stopMapPan(); return; }
      if (mapLastTime) mapElapsed += time - mapLastTime;
      mapLastTime = time;
      var maxScroll = Math.max(0, mobileMap.scrollWidth - mobileMap.clientWidth);
      if (maxScroll > 0) {
        var progress = (mapElapsed % mapDuration) / mapDuration;
        mobileMap.scrollLeft = maxScroll * (1 - Math.cos(progress * Math.PI * 2)) / 2;
        mapDirection = Math.sin(progress * Math.PI * 2) < 0 ? -1 : 1;
      }
      mapFrame = window.requestAnimationFrame(panMap);
    }
    function updateMapPan() {
      syncMapToggle();
      if (mapPanAllowed()) {
        if (!mapFrame) mapFrame = window.requestAnimationFrame(panMap);
      } else stopMapPan();
    }
    function pauseMapForManualUse() {
      mapUserPaused = true;
      syncMapToggle();
      stopMapPan();
    }
    function alignMapPhaseToScroll() {
      var maxScroll = Math.max(0, mobileMap.scrollWidth - mobileMap.clientWidth);
      if (!maxScroll) { mapElapsed = 0; return; }
      var position = Math.max(0, Math.min(1, mobileMap.scrollLeft / maxScroll));
      var phase = Math.acos(1 - position * 2) / (Math.PI * 2);
      if (mapDirection < 0) phase = 1 - phase;
      mapElapsed = phase * mapDuration;
    }
    function refreshMapBounds() {
      var maxScroll = Math.max(0, mobileMap.scrollWidth - mobileMap.clientWidth);
      if (mobileMap.scrollLeft > maxScroll) mobileMap.scrollLeft = maxScroll;
      alignMapPhaseToScroll();
      updateMapPan();
    }

    if ("IntersectionObserver" in window) {
      var mapObserver = new IntersectionObserver(function (entries) {
        mapVisible = entries[0].isIntersecting;
        updateMapPan();
      }, { threshold: 0.01 });
      mapObserver.observe(mobileMap);
    } else {
      function checkMapVisibility() {
        var bounds = mobileMap.getBoundingClientRect();
        mapVisible = bounds.bottom > 0 && bounds.top < window.innerHeight;
        updateMapPan();
      }
      window.addEventListener("scroll", checkMapVisibility, { passive: true });
      window.addEventListener("resize", checkMapVisibility);
      checkMapVisibility();
    }
    mobileMap.addEventListener("pointerdown", pauseMapForManualUse, { passive: true });
    mobileMap.addEventListener("touchstart", pauseMapForManualUse, { passive: true });
    mobileMap.addEventListener("wheel", pauseMapForManualUse, { passive: true });
    mobileMap.addEventListener("keydown", function (event) {
      if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", " "].indexOf(event.key) !== -1) pauseMapForManualUse();
    });
    mobileMap.addEventListener("focusin", function () {
      mapFocused = true;
      updateMapPan();
    });
    mobileMap.addEventListener("focusout", function () {
      window.setTimeout(function () {
        mapFocused = mobileMap.contains(document.activeElement);
        updateMapPan();
      }, 0);
    });
    if (mapToggle) {
      mapToggle.addEventListener("click", function () {
        if (mapUserPaused) alignMapPhaseToScroll();
        mapUserPaused = !mapUserPaused;
        syncMapToggle();
        updateMapPan();
      });
    }
    window.addEventListener("resize", refreshMapBounds);
    document.addEventListener("visibilitychange", updateMapPan);
    if (mapMobileViewport.addEventListener) mapMobileViewport.addEventListener("change", refreshMapBounds);
    else if (mapMobileViewport.addListener) mapMobileViewport.addListener(refreshMapBounds);
    if (mapMotionPreference.addEventListener) mapMotionPreference.addEventListener("change", updateMapPan);
    else if (mapMotionPreference.addListener) mapMotionPreference.addListener(updateMapPan);
    syncMapToggle();
  }

  var rotatingSector = document.querySelector('[data-hero-rotation]');
  document.querySelectorAll('[data-firm-video-player]').forEach(function (player) {
    var firmVideo = player.querySelector('[data-firm-video]');
    var videoToggle = player.querySelector('[data-firm-video-toggle]');
    if (!firmVideo) return;

    var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    var isVisible = !('IntersectionObserver' in window);
    var userPaused = false;
    var retryUsed = false;
    var playWasBlocked = false;
    firmVideo.muted = true;
    firmVideo.defaultMuted = true;

    function pauseForReducedMotion() {
      firmVideo.pause();
      player.classList.add('is-reduced-motion');
    }
    function attemptPlayback() {
      if (!isVisible || document.hidden || motionPreference.matches || userPaused) return;
      var playback = firmVideo.play();
      if (playback && typeof playback.catch === 'function') {
        playback.then(function () {
          playWasBlocked = false;
          if (videoToggle) videoToggle.hidden = motionPreference.matches;
        }).catch(function () {
          playWasBlocked = true;
          if (videoToggle) videoToggle.hidden = true;
        });
      }
    }
    function syncPlayback() {
      firmVideo.autoplay = !motionPreference.matches && !userPaused;
      if (videoToggle) videoToggle.hidden = motionPreference.matches;
      if (document.hidden) { firmVideo.pause(); return; }
      if (motionPreference.matches) pauseForReducedMotion();
      else {
        player.classList.remove('is-reduced-motion');
        attemptPlayback();
      }
    }
    function retryAfterInteraction(event) {
      if (retryUsed || !playWasBlocked || !event.isTrusted || !isVisible || document.hidden || motionPreference.matches || userPaused) return;
      retryUsed = true;
      attemptPlayback();
      document.removeEventListener('pointerdown', retryAfterInteraction);
      document.removeEventListener('keydown', retryAfterInteraction);
    }

    document.addEventListener('visibilitychange', syncPlayback);
    window.addEventListener('pageshow', syncPlayback);
    document.addEventListener('pointerdown', retryAfterInteraction);
    document.addEventListener('keydown', retryAfterInteraction);
    if (videoToggle) {
      videoToggle.addEventListener('click', function () {
        userPaused = !userPaused;
        firmVideo.autoplay = !motionPreference.matches && !userPaused;
        videoToggle.textContent = userPaused ? 'Resume video' : 'Pause video';
        videoToggle.setAttribute('aria-label', userPaused ? 'Resume background video' : 'Pause background video');
        if (userPaused) firmVideo.pause();
        else attemptPlayback();
      });
    }
    if (motionPreference.addEventListener) motionPreference.addEventListener('change', syncPlayback);
    else if (motionPreference.addListener) motionPreference.addListener(syncPlayback);

    if ('IntersectionObserver' in window) {
      var videoObserver = new IntersectionObserver(function (entries) {
        isVisible = entries[0].isIntersecting;
        if (isVisible) attemptPlayback();
        else firmVideo.pause();
      }, { threshold: 0.01 });
      videoObserver.observe(firmVideo);
    }
    syncPlayback();
  });
  var rotationControl = document.querySelector('[data-rotation-control]');
  if (rotatingSector && rotationControl) {
    var rotationTrack = rotatingSector.querySelector('[data-hero-rotation-track]');
    var rotationRows = rotationTrack ? Array.prototype.slice.call(rotationTrack.children) : [];
    var sectorNames = rotationRows.slice(0, -1).map(function (row) { return row.textContent; });
    var rotationIndex = 0;
    var rotationTimer;
    var rotationPhaseTimer;
    var rotationFrame;
    var rotationPaused = false;
    var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    var observedWidth = 0;
    var rotationTransitionMs = 250;
    var rotationTravel = 0;
    function showRotationRow(index, offset) {
      rotationRows.forEach(function (row, rowIndex) {
        row.style.transition = 'none';
        row.style.visibility = rowIndex === index ? 'visible' : 'hidden';
        row.style.transform = 'translateY(' + (rowIndex === index ? offset : 0) + 'px)';
      });
    }
    function measureRotationRows() {
      if (!rotationTrack || !rotationRows.length) return;
      clearRotationTimers();
      observedWidth = rotatingSector.clientWidth;
      rotatingSector.style.height = 'auto';
      rotationRows.forEach(function (row) {
        row.style.position = 'static';
        row.style.visibility = 'hidden';
        row.style.height = 'auto';
        row.style.width = '100%';
      });
      var maxHeight = rotationRows.slice(0, -1).reduce(function (height, row) {
        return Math.max(height, row.getBoundingClientRect().height);
      }, 0);
      rotatingSector.style.height = maxHeight + 'px';
      rotationTravel = maxHeight + 15;
      rotationTrack.style.position = 'absolute';
      rotationTrack.style.top = '0';
      rotationTrack.style.left = '0';
      rotationTrack.style.width = '100%';
      rotationTrack.style.height = '100%';
      rotationRows.forEach(function (row) {
        row.style.position = 'absolute';
        row.style.top = '0';
        row.style.left = '0';
        row.style.height = 'auto';
      });
      showRotationRow(motionPreference.matches ? 0 : rotationIndex, 0);
      scheduleRotation();
    }
    function clearRotationTimers() {
      window.clearTimeout(rotationTimer);
      window.clearTimeout(rotationPhaseTimer);
      window.cancelAnimationFrame(rotationFrame);
      rotationFrame = null;
    }
    function settleRotation() {
      clearRotationTimers();
      showRotationRow(motionPreference.matches ? 0 : rotationIndex, 0);
    }
    function scheduleRotation() {
      clearRotationTimers();
      if (rotationPaused || document.hidden || motionPreference.matches || !rotationTrack || sectorNames.length < 2) return;
      rotationTimer = window.setTimeout(function () {
        var currentRow = rotationIndex;
        rotationRows[currentRow].style.transition = 'transform ' + rotationTransitionMs + 'ms ease-in';
        rotationRows[currentRow].style.transform = 'translateY(-' + rotationTravel + 'px)';
        rotationPhaseTimer = window.setTimeout(function () {
          rotationRows[currentRow].style.visibility = 'hidden';
          rotationIndex = (rotationIndex + 1) % sectorNames.length;
          showRotationRow(rotationIndex, 0);
          showRotationRow(rotationIndex, rotationTravel);
          rotationRows[rotationIndex].getBoundingClientRect();
          rotationFrame = window.requestAnimationFrame(function () {
            rotationRows[rotationIndex].style.transition = 'transform ' + rotationTransitionMs + 'ms ease-out';
            rotationRows[rotationIndex].style.transform = 'translateY(0)';
            rotationPhaseTimer = window.setTimeout(scheduleRotation, rotationTransitionMs);
          });
        }, rotationTransitionMs);
      }, 1500);
    }
    function updateRotationPreference() {
      if (motionPreference.matches) rotationIndex = 0;
      rotationControl.hidden = motionPreference.matches;
      settleRotation();
      scheduleRotation();
    }
    rotationControl.addEventListener('click', function () {
      rotationPaused = !rotationPaused;
      rotationControl.textContent = rotationPaused ? 'Resume animation' : 'Pause animation';
      rotationControl.setAttribute('aria-label', rotationPaused ? 'Resume rotating sectors' : 'Pause rotating sectors');
      settleRotation();
      scheduleRotation();
    });
    document.addEventListener('visibilitychange', function () {
      settleRotation();
      scheduleRotation();
    });
    if (motionPreference.addEventListener) motionPreference.addEventListener('change', updateRotationPreference);
    else if (motionPreference.addListener) motionPreference.addListener(updateRotationPreference);
    window.addEventListener('resize', function () {
      if (rotatingSector.clientWidth !== observedWidth) measureRotationRows();
    }, { passive: true });
    if ('ResizeObserver' in window) {
      var rotationResizeObserver = new ResizeObserver(function () {
        if (rotatingSector.clientWidth !== observedWidth) measureRotationRows();
      });
      rotationResizeObserver.observe(rotatingSector.parentElement);
    }
    measureRotationRows();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureRotationRows);
    updateRotationPreference();
  }

  var searchDialog = document.querySelector('[data-search-dialog]');
  if (searchDialog) {
    var searchInput = searchDialog.querySelector('[data-search-input]');
    var searchResults = searchDialog.querySelector('[data-search-results]');
    var searchStatus = searchDialog.querySelector('[data-search-status]');
    var searchOpener = null;
    var siteScript = Array.prototype.find.call(document.scripts, function (script) { return script.src.indexOf('/assets/js/site.js') >= 0; });
    var siteBase = new URL('../../', siteScript.src);
    function searchUrl(url) {
      var target = new URL(url.replace(/^\//, ''), siteBase);
      if (target.protocol === 'file:' && target.pathname.endsWith('/')) target.pathname += 'index.html';
      return target.href;
    }
    document.querySelectorAll('[data-search-open]').forEach(function (button) {
      button.addEventListener('click', function () {
        searchOpener = button;
        if (toggle && nav && body.classList.contains('nav-open')) {
          toggle.click();
        } else {
          body.classList.remove('nav-open');
          if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu'); }
        }
        if (smoother) smoother.paused(true);
        searchDialog.showModal();
        searchInput.focus();
      });
    });
    searchDialog.querySelector('[data-search-close]').addEventListener('click', function () { searchDialog.close(); });
    searchResults.addEventListener('click', function (event) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest('a');
      if (!link || !link.hash) return;
      var target = new URL(link.href);
      if (target.origin !== window.location.origin || target.pathname !== window.location.pathname) return;
      var section;
      try { section = document.getElementById(decodeURIComponent(target.hash.slice(1))); } catch (error) { return; }
      if (!section) return;
      event.preventDefault();
      var opener = searchOpener;
      searchDialog.addEventListener('close', function () {
        if (opener) opener.blur();
        window.history.pushState(null, '', target.href);
        scrollToSection(section, true);
      }, { once: true });
      searchDialog.close();
    });
    searchDialog.addEventListener('click', function (event) {
      if (event.target === searchDialog) {
        var bounds = searchDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) searchDialog.close();
      }
    });
    searchDialog.addEventListener('close', function () {
      if (smoother) smoother.paused(false);
      if (searchOpener && searchOpener.getClientRects().length) searchOpener.focus();
      else if (toggle) toggle.focus();
    });
    searchInput.addEventListener('input', function () {
      var query = searchInput.value.trim().toLowerCase();
      searchResults.replaceChildren();
      if (query.length < 2) { searchStatus.textContent = 'Enter at least two characters to search.'; return; }
      var normalise = function (value) { return value.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); };
      var normalQuery = normalise(query), words = normalQuery.split(' ');
      if (!normalQuery) { searchStatus.textContent = 'Enter a word or phrase to search.'; return; }
      var matches = (window.MPL_SEARCH_INDEX || []).map(function (entry) {
        var title = normalise(entry.title), aliases = (entry.aliases || []).map(normalise), corpus = normalise(entry.title + ' ' + entry.description + ' ' + entry.text + ' ' + aliases.join(' '));
        var exactAlias = aliases.indexOf(normalQuery) >= 0;
        var titleWords = title.split(' '), aliasWords = aliases.join(' ').split(' ');
        var corpusWords = corpus.split(' ');
        var startsWithWord = function (tokens, word) { return tokens.some(function (token) { return token.indexOf(word) === 0; }); };
        var allInCorpus = words.every(function (word) { return startsWithWord(corpusWords, word); });
        var allInTitle = words.every(function (word) { return startsWithWord(titleWords, word); });
        var score = 0;
        if (normalQuery === title) score = 1000;
        else if (exactAlias) score = 1000;
        else if (title.indexOf(normalQuery) === 0) score = 800;
        else if (aliases.some(function (alias) { return alias.indexOf(normalQuery) === 0; })) score = 750;
        else if (allInTitle) score = 600;
        else if ((entry.relatedTerms || []).map(normalise).indexOf(normalQuery) >= 0) score = 400;
        else if (allInCorpus) {
          score = 100 + words.reduce(function (sum, word) { return sum + (startsWithWord(titleWords, word) ? 20 : startsWithWord(aliasWords, word) ? 12 : 1); }, 0);
        }
        return { entry: entry, score: score };
      }).filter(function (match) { return match.score > 0; }).sort(function (a, b) { return b.score - a.score || Number(b.entry.url.indexOf('#') >= 0) - Number(a.entry.url.indexOf('#') >= 0); });
      searchStatus.textContent = matches.length ? matches.length + ' result' + (matches.length === 1 ? '' : 's') + '. Showing up to 12.' : 'No results. Try a sector or solution name.';
      matches.slice(0, 12).forEach(function (match) {
        var entry = match.entry, link = document.createElement('a'), category = document.createElement('span'), title = document.createElement('h3'), snippet = document.createElement('p');
        link.href = searchUrl(entry.url);
        if (entry.kind) { category.className = 'search-result-category'; category.textContent = entry.kind; link.append(category); }
        title.textContent = entry.title;
        var text = entry.description || entry.text;
        if (text.length > 180) text = text.slice(0, 177) + '…';
        snippet.textContent = text;
        link.append(title, snippet);
        searchResults.append(link);
      });
    });
  }

  document.querySelectorAll('[data-sector-carousel]').forEach(function (carousel) {
    var track = carousel.querySelector('[data-carousel-track]');
    var previous = carousel.querySelector('[data-carousel-prev]');
    var next = carousel.querySelector('[data-carousel-next]');
    var autoplayToggle = carousel.querySelector('[data-carousel-toggle]');
    var status = carousel.querySelector('[data-carousel-status]');
    var cards = Array.prototype.slice.call(track.querySelectorAll('.sector-slide'));
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var gsap = window.gsap;

    if (!cards.length) return;

    if (!gsap || typeof gsap.to !== 'function') {
      var nativeAutoplayTimer = 0;
      var nativePausedByUser = false;
      var nativeVisible = false;
      var nativeHovered = false;
      var nativeFocused = false;
      var nativeAutoplayStarted = false;
      var nativeAutoplayDelay = 4400;
      function nativeStep() {
        var styles = window.getComputedStyle(track);
        var gap = parseFloat(styles.columnGap || styles.gap) || 0;
        return cards[0].getBoundingClientRect().width + gap;
      }
      function updateNativeCarousel() {
        previous.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
        var index = Math.round(track.scrollLeft / nativeStep());
        var label = 'Sector ' + Math.min(index + 1, cards.length) + ' of ' + cards.length;
        if (status.textContent !== label) status.textContent = label;
      }
      function moveNativeCarousel(direction) {
        track.scrollBy({left: direction * nativeStep(), behavior: reducedMotion.matches ? 'auto' : 'smooth'});
      }
      function canRunNativeAutoplay() {
        return !nativePausedByUser && !nativeHovered && !nativeFocused && nativeVisible && !document.hidden && !reducedMotion.matches;
      }
      function updateNativeAutoplayControl() {
        if (!autoplayToggle) return;
        var paused = nativePausedByUser || reducedMotion.matches;
        autoplayToggle.hidden = false;
        autoplayToggle.dataset.paused = String(paused);
        autoplayToggle.setAttribute('aria-pressed', String(paused));
        autoplayToggle.setAttribute('aria-label', paused ? 'Resume sector autoplay' : 'Pause sector autoplay');
        autoplayToggle.textContent = paused ? 'Play' : 'Pause';
      }
      function scheduleNativeAutoplay() {
        window.clearTimeout(nativeAutoplayTimer);
        nativeAutoplayTimer = 0;
        if (!canRunNativeAutoplay()) return;
        nativeAutoplayTimer = window.setTimeout(function () {
          nativeAutoplayTimer = 0;
          nativeAutoplayStarted = true;
          if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 2) {
            track.scrollTo({left:0, behavior:'smooth'});
          } else {
            moveNativeCarousel(1);
          }
          scheduleNativeAutoplay();
        }, nativeAutoplayStarted ? nativeAutoplayDelay : 900);
      }
      previous.addEventListener('click', function () { moveNativeCarousel(-1); scheduleNativeAutoplay(); });
      next.addEventListener('click', function () { moveNativeCarousel(1); scheduleNativeAutoplay(); });
      if (autoplayToggle) autoplayToggle.addEventListener('click', function () {
        nativePausedByUser = !nativePausedByUser;
        updateNativeAutoplayControl();
        scheduleNativeAutoplay();
      });
      track.addEventListener('scroll', updateNativeCarousel, {passive:true});
      window.addEventListener('resize', function () { updateNativeCarousel(); scheduleNativeAutoplay(); });
      carousel.addEventListener('pointerenter', function () { nativeHovered = true; scheduleNativeAutoplay(); });
      carousel.addEventListener('pointerleave', function () { nativeHovered = false; scheduleNativeAutoplay(); });
      carousel.addEventListener('focusin', function (event) {
        nativeFocused = event.target !== autoplayToggle;
        scheduleNativeAutoplay();
      });
      carousel.addEventListener('focusout', function () {
        window.setTimeout(function () {
          nativeFocused = carousel.contains(document.activeElement) && document.activeElement !== autoplayToggle;
          scheduleNativeAutoplay();
        }, 0);
      });
      document.addEventListener('visibilitychange', scheduleNativeAutoplay);
      if ('IntersectionObserver' in window) {
        var nativeCarouselObserver = new IntersectionObserver(function (entries) {
          nativeVisible = entries.some(function (entry) { return entry.isIntersecting; });
          scheduleNativeAutoplay();
        }, {threshold:0.18});
        nativeCarouselObserver.observe(track);
      } else {
        nativeVisible = true;
      }
      if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', function () {
        updateNativeAutoplayControl();
        scheduleNativeAutoplay();
      });
      else if (reducedMotion.addListener) reducedMotion.addListener(function () {
        updateNativeAutoplayControl();
        scheduleNativeAutoplay();
      });
      updateNativeCarousel();
      updateNativeAutoplayControl();
      scheduleNativeAutoplay();
      return;
    }

    var activeIndex = 0;
    var pausedByUser = false;
    var pointerDown = null;
    var dragging = false;
    var suppressClick = false;
    var visible = false;
    var hovered = false;
    var focused = false;
    var autoplayTimer = 0;
    var announceTimer = 0;
    var autoplayDelay = 4400;
    var autoplayStarted = false;
    var animationDuration = 0.68;

    function wrapIndex(index) { return (index % cards.length + cards.length) % cards.length; }
    function relativeIndex(index, base) {
      var offset = wrapIndex(index - base);
      return offset > cards.length / 2 ? offset - cards.length : offset;
    }
    function manualStatus(label) {
      if (status.textContent !== label) status.textContent = label;
      status.setAttribute('aria-live', 'polite');
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(function () { status.setAttribute('aria-live', 'off'); }, 1400);
    }
    function updateCardAccessibility() {
      cards.forEach(function (card, index) {
        var isNear = Math.abs(relativeIndex(index, activeIndex)) <= 1;
        card.setAttribute('aria-hidden', String(!isNear));
        if ('inert' in card) card.inert = !isNear;
        else if (!isNear) card.setAttribute('tabindex', '-1');
        else card.removeAttribute('tabindex');
        card.classList.toggle('is-active', index === activeIndex);
      });
    }
    function geometry() {
      var width = cards[0].offsetWidth;
      var gap = window.innerWidth <= 768 ? 22 : 34;
      return { width: width, step: Math.min(width * (window.innerWidth <= 768 ? 0.76 : 0.79) + gap, track.clientWidth * 0.72) };
    }
    function renderCards(duration, dragProgress) {
      var metrics = geometry();
      var progress = dragProgress || 0;
      cards.forEach(function (card, index) {
        var offset = relativeIndex(index, activeIndex) - progress;
        var distance = Math.abs(offset);
        var scale = distance < 1 ? 1 - distance * 0.21 : distance < 2 ? 0.79 - (distance - 1) * 0.22 : 0.57;
        var opacity = distance < 1 ? 1 - distance * 0.36 : distance < 2 ? 0.64 - (distance - 1) * 0.64 : 0;
        var vars = {
          x: offset * metrics.step,
          scale: scale,
          autoAlpha: opacity,
          zIndex: Math.max(0, 20 - Math.round(distance * 10)),
          duration: reducedMotion.matches ? 0 : duration,
          ease: 'power3.inOut',
          overwrite: 'auto'
        };
        if (duration > 0 && !reducedMotion.matches) gsap.to(card, vars);
        else gsap.set(card, vars);
      });
    }
    function updateStatus(announce) {
      var label = 'Sector ' + (activeIndex + 1) + ' of ' + cards.length;
      if (announce) manualStatus(label);
      else if (status.textContent !== label) status.textContent = label;
    }
    function canAutoplay() {
      return !pausedByUser && !hovered && !focused && visible && !document.hidden && !reducedMotion.matches && !pointerDown;
    }
    function scheduleAutoplay() {
      window.clearTimeout(autoplayTimer);
      autoplayTimer = 0;
      if (!canAutoplay()) return;
      autoplayTimer = window.setTimeout(function () {
        autoplayTimer = 0;
        autoplayStarted = true;
        moveCarousel(1, false);
      }, autoplayStarted ? autoplayDelay : 900);
    }
    function updateAutoplayControl() {
      if (!autoplayToggle) return;
      autoplayToggle.dataset.paused = String(pausedByUser || reducedMotion.matches);
      autoplayToggle.setAttribute('aria-pressed', String(pausedByUser || reducedMotion.matches));
      autoplayToggle.setAttribute('aria-label', pausedByUser || reducedMotion.matches ? 'Resume sector autoplay' : 'Pause sector autoplay');
      autoplayToggle.textContent = pausedByUser || reducedMotion.matches ? 'Play' : 'Pause';
    }
    function moveCarousel(direction, announce) {
      if (dragging) return;
      window.clearTimeout(autoplayTimer);
      autoplayTimer = 0;
      activeIndex = wrapIndex(activeIndex + direction);
      updateStatus(announce);
      updateCardAccessibility();
      renderCards(animationDuration, 0);
      scheduleAutoplay();
    }

    carousel.classList.add('is-carousel-enhanced');
    track.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');
    gsap.set(cards, {position:'absolute', left:'50%', top:'50%', xPercent:-50, yPercent:-50, transformOrigin:'center center', scale:0.57, autoAlpha:0, x:0});
    updateCardAccessibility();
    renderCards(0, 0);
    updateStatus(false);
    updateAutoplayControl();

    previous.addEventListener('click', function () { moveCarousel(-1, true); });
    next.addEventListener('click', function () { moveCarousel(1, true); });
    if (autoplayToggle) autoplayToggle.addEventListener('click', function () {
      pausedByUser = !pausedByUser;
      updateAutoplayControl();
      scheduleAutoplay();
    });
    track.addEventListener('keydown', function (event) {
      if (event.target !== track) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        moveCarousel(event.key === 'ArrowLeft' ? -1 : 1, true);
      }
    });
    carousel.addEventListener('pointerenter', function () { hovered = true; scheduleAutoplay(); });
    carousel.addEventListener('pointerleave', function () { hovered = false; scheduleAutoplay(); });
    carousel.addEventListener('focusin', function (event) {
      focused = event.target !== autoplayToggle;
      scheduleAutoplay();
    });
    carousel.addEventListener('focusout', function () {
      window.setTimeout(function () {
        focused = carousel.contains(document.activeElement) && document.activeElement !== autoplayToggle;
        scheduleAutoplay();
      }, 0);
    });
    document.addEventListener('visibilitychange', scheduleAutoplay);
    if ('IntersectionObserver' in window) {
      var carouselObserver = new IntersectionObserver(function (entries) {
        visible = entries.some(function (entry) { return entry.isIntersecting; });
        scheduleAutoplay();
      }, {threshold:0.18});
      carouselObserver.observe(track);
    } else {
      visible = true;
    }
    if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', function () {
      updateAutoplayControl();
      renderCards(animationDuration, 0);
      scheduleAutoplay();
    });
    else if (reducedMotion.addListener) reducedMotion.addListener(function () {
      updateAutoplayControl();
      renderCards(animationDuration, 0);
      scheduleAutoplay();
    });

    // Let pointer gestures move the carousel rather than drag image/link previews.
    track.addEventListener('dragstart', function (event) { event.preventDefault(); });
    track.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      pointerDown = {id:event.pointerId, x:event.clientX, y:event.clientY, progress:0, step:geometry().step};
      scheduleAutoplay();
    });
    track.addEventListener('pointermove', function (event) {
      if (!pointerDown || event.pointerId !== pointerDown.id) return;
      var deltaX = event.clientX - pointerDown.x;
      var deltaY = event.clientY - pointerDown.y;
      if (!dragging && Math.abs(deltaX) > 9 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
        dragging = true;
        track.classList.add('is-dragging');
        if (track.setPointerCapture) track.setPointerCapture(event.pointerId);
      }
      if (!dragging) return;
      event.preventDefault();
      pointerDown.progress = Math.max(-1.8, Math.min(1.8, -deltaX / pointerDown.step));
      renderCards(0, pointerDown.progress);
    });
    function finishPointer(event) {
      if (!pointerDown || event.pointerId !== pointerDown.id) return;
      var progress = pointerDown.progress;
      var wasDragging = dragging;
      pointerDown = null;
      dragging = false;
      track.classList.remove('is-dragging');
      if (wasDragging && Math.abs(progress) >= 0.18) {
        var steps = Math.max(1, Math.min(2, Math.round(Math.abs(progress))));
        moveCarousel(progress > 0 ? steps : -steps, true);
        suppressClick = true;
        window.setTimeout(function () { suppressClick = false; }, 0);
      } else {
        renderCards(animationDuration, 0);
        scheduleAutoplay();
      }
    }
    track.addEventListener('pointerup', finishPointer);
    track.addEventListener('pointercancel', finishPointer);
    // Touch pointers start captured by the card under the finger; taking the capture
    // for the track makes that card report a lost capture, which must not end the swipe.
    track.addEventListener('lostpointercapture', function (event) {
      if (event.target === track) finishPointer(event);
    });
    track.addEventListener('click', function (event) {
      if (suppressClick) { event.preventDefault(); event.stopPropagation(); }
    }, true);

    // Two-finger trackpad swipes: one sector per gesture, ignoring the momentum tail.
    var wheelDistance = 0;
    var wheelLocked = false;
    var wheelIdleTimer = 0;
    track.addEventListener('wheel', function (event) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      window.clearTimeout(wheelIdleTimer);
      wheelIdleTimer = window.setTimeout(function () { wheelDistance = 0; wheelLocked = false; }, 220);
      if (wheelLocked) return;
      wheelDistance += event.deltaX;
      if (Math.abs(wheelDistance) < 30) return;
      wheelLocked = true;
      moveCarousel(wheelDistance > 0 ? 1 : -1, true);
    }, {passive:false});
    window.addEventListener('resize', function () { renderCards(reducedMotion.matches ? 0 : 0.2, 0); });
    scheduleAutoplay();
  });

  // Chrome does not resolve directory-style links to index.html when a site is
  // opened directly from disk. Keep clean URLs online, but make local previews
  // navigable without requiring a local web server.
  if (window.location.protocol === "file:") {
    document.querySelectorAll("a[href]").forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#" || /^(?:[a-z]+:|\/\/)/i.test(href)) return;
      var hashIndex = href.indexOf("#");
      var pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
      var hashPart = hashIndex >= 0 ? href.slice(hashIndex) : "";
      var queryIndex = pathPart.indexOf('?');
      var queryPart = queryIndex >= 0 ? pathPart.slice(queryIndex) : '';
      if (queryIndex >= 0) pathPart = pathPart.slice(0, queryIndex);
      if (pathPart.endsWith("/")) {
        link.setAttribute("href", pathPart + "index.html" + queryPart + hashPart);
      }
    });
  }

  if (toggle && nav) {
    var desktopNavigation = window.matchMedia('(min-width: 66.001rem)');
    var headerElement = toggle.closest('.site-header');
    var backgroundElements = Array.from(document.body.children).filter(function (element) {
      return element !== headerElement && element.tagName !== 'SCRIPT';
    });

    function setBackgroundInert(isInert) {
      backgroundElements.forEach(function (element) { element.inert = isInert; });
    }

    function setMenuOpen(isOpen, moveFocus) {
      if (isOpen && desktopNavigation.matches) return;
      body.classList.toggle('nav-open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
      nav.inert = !isOpen;
      nav.setAttribute('aria-hidden', String(!isOpen));
      setBackgroundInert(isOpen);
      if (moveFocus) {
        if (isOpen) {
          var firstLink = nav.querySelector('a[href], button:not([disabled])');
          (firstLink || toggle).focus();
        } else {
          toggle.focus();
        }
      }
    }

    function syncMenuForViewport() {
      if (desktopNavigation.matches) {
        setMenuOpen(false, false);
        nav.inert = false;
        nav.removeAttribute('aria-hidden');
      } else if (!body.classList.contains('nav-open')) {
        nav.inert = true;
        nav.setAttribute('aria-hidden', 'true');
        setBackgroundInert(false);
      }
    }
    if (desktopNavigation.addEventListener) desktopNavigation.addEventListener('change', syncMenuForViewport);
    else if (desktopNavigation.addListener) desktopNavigation.addListener(syncMenuForViewport);
    syncMenuForViewport();
    toggle.addEventListener("click", function (event) {
      // Move focus into the menu only for keyboard activation (detail is 0);
      // a tap or click should not pre-select the first link.
      setMenuOpen(!body.classList.contains('nav-open'), event.detail === 0);
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        setMenuOpen(false, false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (!body.classList.contains('nav-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuOpen(false, true);
        return;
      }
      if (event.key === 'Tab') {
        var focusable = [toggle].concat(Array.from(nav.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')));
        var currentIndex = focusable.indexOf(document.activeElement);
        if (currentIndex < 0) {
          event.preventDefault();
          (event.shiftKey ? focusable[focusable.length - 1] : focusable[0]).focus();
        } else if (event.shiftKey && currentIndex === 0) {
          event.preventDefault();
          focusable[focusable.length - 1].focus();
        } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
          event.preventDefault();
          focusable[0].focus();
        }
      }
    });
  }

  if (body.classList.contains("home-page--gsap-text") && window.gsap && typeof window.gsap.from === "function" && "IntersectionObserver" in window) {
    var homeGsap = window.gsap;
    var homeMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    var homeMotionSections = Array.prototype.slice.call(document.querySelectorAll(".v4-hero, .v4-pathways, .v4-narrative, .v4-testimonial, .v4-presenting, .v4-expertise, .v4-traction, .v4-sector-carousel, .v4-cta"));
    var homeMotionTargets = [];
    var homeSectionObserver;

    function clearHomeMotion() {
      if (homeSectionObserver) homeSectionObserver.disconnect();
      if (homeMotionTargets.length) {
        homeGsap.killTweensOf(homeMotionTargets);
        homeGsap.set(homeMotionTargets, { clearProps: "opacity,transform,y,filter" });
      }
    }
    function revealHomeSection(section) {
      if (homeMotionPreference.matches) { clearHomeMotion(); return; }
      var headings = Array.prototype.slice.call(section.querySelectorAll("h1, h2"));
      var paragraphs = Array.prototype.slice.call(section.querySelectorAll("p:not(.eyebrow)"));
      var sectionTargets = headings.concat(paragraphs);
      if (!sectionTargets.length) return;
      homeMotionTargets = homeMotionTargets.concat(sectionTargets);
      try {
        if (headings.length) homeGsap.from(headings, { opacity: 0, filter: "blur(20px)", y: 20, duration: 0.66, ease: "power2.out", immediateRender: false });
        if (paragraphs.length) homeGsap.from(paragraphs, { y: 30, opacity: 0, stagger: 0.2, duration: 0.8, ease: "power2.out", delay: headings.length ? 0.12 : 0, immediateRender: false });
      } catch (error) {
        homeGsap.killTweensOf(sectionTargets);
        homeGsap.set(sectionTargets, { clearProps: "opacity,transform,y,filter" });
      }
    }

    if (!homeMotionPreference.matches && homeMotionSections.length) {
      try {
        homeSectionObserver = new IntersectionObserver(function (entries, observer) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            revealHomeSection(entry.target);
          });
        }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
        homeMotionSections.forEach(function (section) { homeSectionObserver.observe(section); });
      } catch (error) {
        if (homeSectionObserver) homeSectionObserver.disconnect();
        clearHomeMotion();
      }
      if (homeMotionPreference.addEventListener) homeMotionPreference.addEventListener("change", function (event) { if (event.matches) clearHomeMotion(); });
      else if (homeMotionPreference.addListener) homeMotionPreference.addListener(function (event) { if (event.matches) clearHomeMotion(); });
    }
  }

  var reveals = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });
    reveals.forEach(function (item) { revealObserver.observe(item); });
  } else {
    reveals.forEach(function (item) { item.classList.add("is-visible"); });
  }

  var countGroup = document.querySelector("[data-count-group]");
  if (countGroup) {
    var counterMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    var counters = Array.prototype.slice.call(countGroup.querySelectorAll("[data-count]"));
    var counterTargets = counters.map(function (counter) {
      return {
        element: counter,
        value: parseInt(counter.getAttribute("data-count"), 10) || 0,
        suffix: counter.getAttribute("data-count-suffix") || ""
      };
    });
    var counterFrame = null;
    var counterStarted = false;
    var counterDuration = 1600;

    function formatCounter(value) {
      return Math.round(value).toLocaleString("en-GB");
    }

    function renderCounter(target, value) {
      target.element.textContent = formatCounter(value) + target.suffix;
    }

    function finishCounters() {
      if (counterFrame !== null) {
        cancelAnimationFrame(counterFrame);
        counterFrame = null;
      }
      counterTargets.forEach(function (target) { renderCounter(target, target.value); });
      countGroup.classList.add("is-count-visible");
    }

    function animateCounters() {
      if (counterStarted) return;
      counterStarted = true;
      countGroup.classList.add("is-count-visible");

      if (counterMotionPreference.matches || !counterTargets.length) {
        finishCounters();
        return;
      }

      var startedAt = null;
      function tick(now) {
        if (startedAt === null) startedAt = now;
        var progress = Math.min((now - startedAt) / counterDuration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        counterTargets.forEach(function (target) {
          renderCounter(target, target.value * eased);
        });
        if (progress < 1 && !counterMotionPreference.matches) {
          counterFrame = requestAnimationFrame(tick);
        } else {
          finishCounters();
        }
      }
      counterFrame = requestAnimationFrame(tick);
    }

    function onCounterMotionChange(event) {
      if (event.matches) {
        counterStarted = true;
        finishCounters();
      }
    }

    if (counterMotionPreference.addEventListener) {
      counterMotionPreference.addEventListener("change", onCounterMotionChange);
    } else if (counterMotionPreference.addListener) {
      counterMotionPreference.addListener(onCounterMotionChange);
    }

    if (counterMotionPreference.matches) {
      counterStarted = true;
      finishCounters();
    } else if (!("IntersectionObserver" in window)) {
      animateCounters();
    } else {
      countGroup.classList.add("has-count-reveal");
      var countObserver = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounters();
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      countObserver.observe(countGroup);
    }
  }

  var templateGroups = document.querySelectorAll(".v4-template-group");
  if (templateGroups.length) {
    var mobileTemplateAccordion = window.matchMedia("(max-width: 48rem)");
    templateGroups.forEach(function (group) {
      var summary = group.querySelector("summary");
      summary.addEventListener("click", function (event) {
        if (!mobileTemplateAccordion.matches) event.preventDefault();
      });
    });
    var syncTemplateAccordion = function () {
      templateGroups.forEach(function (group) {
        group.open = !mobileTemplateAccordion.matches;
      });
    };
    syncTemplateAccordion();
    if (mobileTemplateAccordion.addEventListener) {
      mobileTemplateAccordion.addEventListener("change", syncTemplateAccordion);
    } else if (mobileTemplateAccordion.addListener) {
      mobileTemplateAccordion.addListener(syncTemplateAccordion);
    }
  }

  document.querySelectorAll("[data-mail-form]").forEach(function (form) {
    var contactSteps = document.querySelector(".contact-page-steps");
    var contactLayout = document.querySelector(".contact-page-hero__layout");
    if (contactSteps && contactLayout) {
      var mobileContactLayout = window.matchMedia("(max-width: 60rem)");
      var placeContactSteps = function () {
        if (mobileContactLayout.matches) {
          contactSteps.classList.add("contact-page-steps--light");
          form.insertAdjacentElement("afterend", contactSteps);
        } else {
          contactSteps.classList.remove("contact-page-steps--light");
          contactLayout.appendChild(contactSteps);
        }
      };
      placeContactSteps();
      if (mobileContactLayout.addEventListener) {
        mobileContactLayout.addEventListener("change", placeContactSteps);
      } else if (mobileContactLayout.addListener) {
        mobileContactLayout.addListener(placeContactSteps);
      }
    }
    var roleField = form.querySelector('[name="role"]');
    var requestedAudience = new URLSearchParams(window.location.search).get('audience');
    if (roleField && ['in-house', 'executive', 'healthcare'].indexOf(requestedAudience) >= 0) {
      roleField.value = requestedAudience;
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = form.querySelector("[data-form-status]");
      if (!form.checkValidity()) {
        form.reportValidity();
        if (status) {
          status.textContent = "Please complete all required fields.";
          status.className = "form-status is-error";
        }
        return;
      }

      var data = new FormData(form);
      var lines = [];
      data.forEach(function (value, key) {
        if (key !== "subject" && key !== "consent") {
          if (key === 'role' && roleField && value) value = roleField.options[roleField.selectedIndex].textContent;
          lines.push(key.replace(/-/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }) + ": " + value);
        }
      });

      var subject = data.get("subject") || "Website enquiry — MediPharmaco Law";
      var href = "mailto:contact@medipharmacolaw.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n\n"));
      if (status) {
        status.textContent = "Your enquiry is prepared. Review it in your email application, then select Send.";
        status.className = "form-status is-success";
      }
      window.location.href = href;
    });
  });

  var consentBanner = document.querySelector("[data-consent-banner]");
  var consentModal = document.querySelector("[data-consent-modal]");
  if (consentBanner && consentModal) {
    if (document.querySelector("[data-mail-form]")) body.classList.add("has-contact-form");
    var consentKey = "mpl_consent_v1";
    var consentVersion = 1;
    var consentLifetime = 180 * 24 * 60 * 60 * 1000;
    var lastConsentFocus = null;
    var consentBackgroundState = [];
    var analyticsChoice = consentModal.querySelector("[data-consent-analytics]");
    var marketingChoice = consentModal.querySelector("[data-consent-marketing]");

    function setConsentBackgroundInert(isInert) {
      if (isInert) {
        consentBackgroundState = Array.prototype.slice.call(document.body.children)
          .filter(function (element) { return element !== consentModal && element.tagName !== "SCRIPT"; })
          .map(function (element) {
            var state = { element: element, inert: element.inert };
            element.inert = true;
            return state;
          });
      } else {
        consentBackgroundState.forEach(function (state) { state.element.inert = state.inert; });
        consentBackgroundState = [];
      }
    }

    function readConsent() {
      try {
        var saved = JSON.parse(window.localStorage.getItem(consentKey));
        if (!saved || saved.version !== consentVersion || !saved.timestamp || Date.now() - saved.timestamp > consentLifetime) {
          window.localStorage.removeItem(consentKey);
          return null;
        }
        return saved;
      } catch (error) {
        return null;
      }
    }

    function applyConsent(choice) {
      document.documentElement.dataset.analyticsConsent = choice.analytics ? "granted" : "denied";
      document.documentElement.dataset.marketingConsent = choice.marketing ? "granted" : "denied";
      window.MPLConsent = choice;
      window.dispatchEvent(new CustomEvent("mpl:consent", { detail: choice }));
    }

    function showBanner() {
      body.classList.add("has-consent-banner");
      consentBanner.hidden = false;
      window.setTimeout(function () { consentBanner.classList.add("is-visible"); }, 20);
    }

    function hideBanner() {
      consentBanner.classList.remove("is-visible");
      body.classList.remove("has-consent-banner");
      window.setTimeout(function () { consentBanner.hidden = true; }, 500);
    }

    function closePreferences() {
      consentModal.classList.remove("is-open");
      window.setTimeout(function () { consentModal.hidden = true; }, 450);
      setConsentBackgroundInert(false);
      if (lastConsentFocus) { lastConsentFocus.focus(); }
    }

    function openPreferences(trigger) {
      var saved = readConsent();
      lastConsentFocus = trigger || document.activeElement;
      analyticsChoice.checked = Boolean(saved && saved.analytics);
      marketingChoice.checked = Boolean(saved && saved.marketing);
      consentModal.hidden = false;
      setConsentBackgroundInert(true);
      window.setTimeout(function () {
        consentModal.classList.add("is-open");
        consentModal.querySelector("[data-consent-close]").focus();
      }, 20);
    }

    function saveConsent(analytics, marketing) {
      var choice = {
        version: consentVersion,
        necessary: true,
        analytics: Boolean(analytics),
        marketing: Boolean(marketing),
        timestamp: Date.now()
      };
      try { window.localStorage.setItem(consentKey, JSON.stringify(choice)); } catch (error) {}
      applyConsent(choice);
      hideBanner();
      closePreferences();
    }

    document.querySelectorAll("[data-consent-accept]").forEach(function (button) {
      button.addEventListener("click", function () { saveConsent(true, true); });
    });
    document.querySelectorAll("[data-consent-reject]").forEach(function (button) {
      button.addEventListener("click", function () { saveConsent(false, false); });
    });
    document.querySelectorAll("[data-consent-manage],[data-consent-open]").forEach(function (button) {
      button.addEventListener("click", function () { openPreferences(button); });
    });
    document.querySelectorAll("[data-consent-close]").forEach(function (button) {
      button.addEventListener("click", closePreferences);
    });
    consentModal.querySelector("[data-consent-save]").addEventListener("click", function () {
      saveConsent(analyticsChoice.checked, marketingChoice.checked);
    });
    consentModal.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closePreferences();
        return;
      }
      if (event.key !== "Tab") return;
      var focusable = Array.prototype.slice.call(consentModal.querySelector(".consent-modal__sheet").querySelectorAll("button:not([disabled]),input:not([disabled])"));
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    var existingConsent = readConsent();
    if (existingConsent) {
      applyConsent(existingConsent);
    } else {
      window.setTimeout(showBanner, 120);
    }
  }

  var audienceCards = Array.prototype.slice.call(document.querySelectorAll(".v4-audience-card"));
  if (audienceCards.length) {
    var audienceAccordionMedia = window.matchMedia("(max-width: 48rem)");
    function syncAudienceCardMode() {
      audienceCards.forEach(function (card) { card.open = !audienceAccordionMedia.matches; });
    }
    syncAudienceCardMode();
    if (audienceAccordionMedia.addEventListener) audienceAccordionMedia.addEventListener("change", syncAudienceCardMode);
    else if (audienceAccordionMedia.addListener) audienceAccordionMedia.addListener(syncAudienceCardMode);
  }

  var sectorDetailCards = Array.prototype.slice.call(document.querySelectorAll(".v4-sector-card-v2"));
  if (sectorDetailCards.length && typeof HTMLDialogElement !== "undefined") {
    var sectorPopup = document.createElement("dialog");
    sectorPopup.className = "v4-sector-popup";
    sectorPopup.setAttribute("aria-labelledby", "v4-sector-popup-title");
    sectorPopup.innerHTML = '<div class="v4-sector-popup__header"><h2 id="v4-sector-popup-title"></h2><button type="button" class="v4-sector-popup__close" aria-label="Close sector details">×</button></div><div class="v4-sector-popup__body"></div>';
    document.body.appendChild(sectorPopup);
    var sectorPopupTitle = sectorPopup.querySelector("#v4-sector-popup-title");
    var sectorPopupBody = sectorPopup.querySelector(".v4-sector-popup__body");
    var sectorPopupClose = sectorPopup.querySelector(".v4-sector-popup__close");
    var activeSectorTrigger = null;

    sectorDetailCards.forEach(function (card) {
      var trigger = card.querySelector(":scope > summary");
      var title = card.querySelector(".v4-sector-card-v2__title");
      var details = card.querySelector(".v4-sector-card-v2__details");
      if (!trigger || !title || !details) return;
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        activeSectorTrigger = trigger;
        sectorPopupTitle.textContent = title.textContent.trim();
        sectorPopupBody.replaceChildren(details.cloneNode(true));
        trigger.setAttribute("aria-expanded", "true");
        sectorPopup.showModal();
        sectorPopupClose.focus();
      });
    });

    sectorPopupClose.addEventListener("click", function () { sectorPopup.close(); });
    sectorPopup.addEventListener("click", function (event) {
      if (event.target === sectorPopup) sectorPopup.close();
    });
    sectorPopup.addEventListener("close", function () {
      if (!activeSectorTrigger) return;
      activeSectorTrigger.setAttribute("aria-expanded", "false");
      activeSectorTrigger.focus();
      activeSectorTrigger = null;
    });
  }

  var year = document.querySelector("[data-year]");
  if (year) { year.textContent = String(new Date().getFullYear()); }
})();
