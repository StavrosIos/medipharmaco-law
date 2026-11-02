(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(pointer: fine)");
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var hasScrollTrigger = !!(gsap && ScrollTrigger && typeof gsap.registerPlugin === "function");
  var isHome = body.classList.contains("home-page--gsap-text");

  if (hasScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  function headerOffset() {
    var header = document.querySelector("[data-site-header]");
    return header ? header.getBoundingClientRect().height : 0;
  }

  // Reports 0–1 progress of `element` from when its top crosses `startFraction`
  // of the viewport until its bottom crosses `endFraction`.
  function onScrollProgress(element, startFraction, endFraction, callback) {
    if (hasScrollTrigger) {
      ScrollTrigger.create({
        trigger: element,
        start: "top " + startFraction * 100 + "%",
        end: "bottom " + endFraction * 100 + "%",
        onUpdate: function (self) { callback(self.progress); },
        onRefresh: function (self) { callback(self.progress); }
      });
      return;
    }
    var ticking = false;
    function measure() {
      ticking = false;
      var rect = element.getBoundingClientRect();
      var viewport = window.innerHeight;
      var start = viewport * startFraction;
      var distance = rect.height + start - viewport * endFraction;
      callback(Math.min(1, Math.max(0, (start - rect.top) / (distance || 1))));
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(measure); }
    }, { passive: true });
    window.addEventListener("resize", measure);
    measure();
  }

  /* ---------- Scroll reveals ---------- */

  var revealGroups = [
    { selector: ".v4-pathway", stagger: 0.1 },
    { selector: ".v4-expertise-grid article", stagger: 0.12 },
    { selector: ".v4-metric", stagger: 0.07 },
    { selector: ".v4-solution-card", stagger: 0.08 },
    { selector: ".v4-core-values article, .value", stagger: 0.1 },
    { selector: ".sx-step", stagger: 0 },
    { selector: ".v4-narrative-image", mode: "clip" }
  ];

  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });

    revealGroups.forEach(function (group) {
      var siblingsSeen = new Map();
      document.querySelectorAll(group.selector).forEach(function (element) {
        // Leave anything already on screen alone so nothing flashes away on load.
        if (element.getBoundingClientRect().top < window.innerHeight * 0.9) return;
        var parent = element.parentElement;
        var index = siblingsSeen.get(parent) || 0;
        siblingsSeen.set(parent, index + 1);
        element.setAttribute("data-m", group.mode || "");
        if (group.stagger) element.style.setProperty("--m-delay", (index % 4) * group.stagger + "s");
        revealObserver.observe(element);
      });
    });
    root.classList.add("m-ready");
  }

  /* ---------- Cursor glow on cards ---------- */

  if (finePointer.matches) {
    document.querySelectorAll(".v4-pathway, .v4-expertise-grid article, .v4-solution-card, .sx-detail").forEach(function (card) {
      card.setAttribute("data-glow", "");
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", event.clientX - rect.left + "px");
        card.style.setProperty("--my", event.clientY - rect.top + "px");
      });
    });
  }

  /* ---------- Home: quote lights up word by word ---------- */

  var quote = isHome ? document.querySelector(".v4-testimonial blockquote") : null;
  if (quote && !reducedMotion.matches) {
    var words = [];
    Array.prototype.slice.call(quote.childNodes).forEach(function (node) {
      if (node.nodeType !== 3 || !node.textContent.trim()) return;
      var fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { fragment.appendChild(document.createTextNode(part)); return; }
        var word = document.createElement("span");
        word.className = "m-word";
        word.textContent = part;
        words.push(word);
        fragment.appendChild(word);
      });
      node.parentNode.replaceChild(fragment, node);
    });
    if (words.length) {
      quote.classList.add("m-words");
      onScrollProgress(quote, 0.85, 0.5, function (progress) {
        var lit = Math.round(progress * words.length);
        words.forEach(function (word, index) { word.classList.toggle("is-lit", index < lit); });
      });
    }
  }

  /* ---------- Home: hero drift and film reveal ---------- */

  if (isHome && hasScrollTrigger && !reducedMotion.matches) {
    var heroImage = document.querySelector(".v4-hero-image");
    if (heroImage) {
      gsap.to(heroImage, {
        yPercent: 10,
        scale: 1.08,
        ease: "none",
        scrollTrigger: { trigger: ".v4-hero", start: "top top", end: "bottom top", scrub: true }
      });
    }
    var film = document.querySelector(".v4-presenting-player");
    if (film) {
      gsap.fromTo(film,
        { clipPath: "inset(6% 7% 6% 7% round 32px)" },
        {
          clipPath: "inset(0% 0% 0% 0% round 0px)",
          ease: "none",
          scrollTrigger: { trigger: film, start: "top 95%", end: "top 25%", scrub: true }
        });
    }
  }

  /* ---------- Sectors: scroll timeline with sticky detail panel ---------- */

  var timeline = document.querySelector("[data-sx]");
  if (timeline) {
    var steps = Array.prototype.slice.call(timeline.querySelectorAll("[data-sx-step]"));
    var details = steps.map(function (step) { return step.querySelector("[data-sx-detail]"); });
    var list = timeline.querySelector(".sx-timeline");
    var panel = timeline.querySelector("[data-sx-panel]");
    var stage = timeline.querySelector("[data-sx-stage]");
    var splitView = window.matchMedia("(min-width: 66.001rem)");
    var activeIndex = 0;

    function setActive(index) {
      activeIndex = index;
      var split = timeline.classList.contains("is-split");
      steps.forEach(function (step, i) {
        step.classList.toggle("is-active", i === index);
        step.classList.toggle("is-passed", i < index);
      });
      details.forEach(function (detail, i) {
        var on = i === index;
        detail.classList.toggle("is-active", on);
        if (split) {
          detail.inert = !on;
          detail.setAttribute("aria-hidden", String(!on));
        }
      });
    }

    // On small screens long service lists start collapsed behind a toggle.
    var collapseAfter = 5;
    var serviceToggles = details.map(function (detail) {
      var items = detail.querySelectorAll(".sx-services li");
      if (items.length <= collapseAfter + 1) return null;
      var services = detail.querySelector(".sx-services");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "sx-more";
      button.setAttribute("aria-expanded", "false");
      button.textContent = "Show all " + items.length + " services";
      button.addEventListener("click", function () {
        var expanded = button.getAttribute("aria-expanded") === "true";
        services.classList.toggle("is-collapsed", expanded);
        button.setAttribute("aria-expanded", String(!expanded));
        button.textContent = expanded ? "Show all " + items.length + " services" : "Show fewer";
      });
      services.insertAdjacentElement("afterend", button);
      return { services: services, button: button, count: items.length };
    });

    function applyLayout() {
      var split = splitView.matches;
      timeline.classList.toggle("is-split", split);
      serviceToggles.forEach(function (toggle) {
        if (!toggle) return;
        toggle.services.classList.toggle("is-collapsed", !split);
        toggle.button.hidden = split;
        toggle.button.setAttribute("aria-expanded", "false");
        toggle.button.textContent = "Show all " + toggle.count + " services";
      });
      details.forEach(function (detail, i) {
        if (split) {
          stage.appendChild(detail);
        } else {
          steps[i].appendChild(detail);
          detail.inert = false;
          detail.removeAttribute("aria-hidden");
        }
      });
      setActive(activeIndex);
      if (hasScrollTrigger) ScrollTrigger.refresh();
    }

    applyLayout();
    if (splitView.addEventListener) splitView.addEventListener("change", applyLayout);
    else if (splitView.addListener) splitView.addListener(applyLayout);

    // Track which step sits on the reading line.
    if (hasScrollTrigger) {
      steps.forEach(function (step, i) {
        ScrollTrigger.create({
          trigger: step,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: function (self) { if (self.isActive) setActive(i); }
        });
      });
    } else if ("IntersectionObserver" in window) {
      var stepObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(steps.indexOf(entry.target));
        });
      }, { rootMargin: "-45% 0px -55% 0px", threshold: 0 });
      steps.forEach(function (step) { stepObserver.observe(step); });
    }

    onScrollProgress(list, 0.55, 0.55, function (progress) {
      timeline.style.setProperty("--sx-progress", progress.toFixed(4));
    });

    // With ScrollSmoother active, CSS sticky cannot work, so pin the panel instead.
    if (hasScrollTrigger && typeof gsap.matchMedia === "function") {
      gsap.matchMedia().add("(min-width: 66.001rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)", function () {
        if (!body.classList.contains("has-scroll-smoother")) return;
        panel.classList.add("is-pinned");
        var gap = 24;
        var pin = ScrollTrigger.create({
          trigger: panel,
          pin: panel,
          pinSpacing: false,
          start: function () { return "top " + (headerOffset() + gap) + "px"; },
          endTrigger: list,
          end: function () { return "bottom " + (headerOffset() + gap + panel.offsetHeight) + "px"; },
          invalidateOnRefresh: true
        });
        return function () {
          pin.kill();
          panel.classList.remove("is-pinned");
        };
      });
    }

    // Choosing a sector scrolls it onto the reading line and shows its details.
    steps.forEach(function (step, i) {
      var link = step.querySelector(".sx-step__title a");
      if (!link) return;
      link.addEventListener("click", function (event) {
        if (!timeline.classList.contains("is-split")) return;
        event.preventDefault();
        var smoother = window.ScrollSmoother && window.ScrollSmoother.get && window.ScrollSmoother.get();
        if (smoother) smoother.scrollTo(step, !reducedMotion.matches, "center center");
        else step.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
        setActive(i);
        if (window.history && window.history.replaceState) window.history.replaceState(null, "", "#" + step.id);
        details[i].focus({ preventScroll: true });
      });
    });
  }

  if (hasScrollTrigger) {
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }
})();
