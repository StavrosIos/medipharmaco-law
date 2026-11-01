(function () {
  "use strict";

  var section = document.querySelector(".v4-global");
  var svg = section && section.querySelector(".v4-global-map");
  if (!svg) return;

  var SVG_NS = "http://www.w3.org/2000/svg";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var scroller = section.querySelector("[data-mobile-map]");
  var legacyPanToggle = section.querySelector("[data-map-toggle]");
  var fullView = [0, 0, 1200, 484];
  var maxZoom = 3;

  var REGIONS = [
    { id: "americas", name: "North America", cities: ["San Francisco Bay Area", "Boston / Cambridge", "New York City / New Jersey", "Philadelphia", "Toronto", "Montreal"] },
    { id: "europe", name: "Europe", cities: ["London", "Oxford", "Cambridge (UK)", "Paris", "Brussels", "Frankfurt", "Berlin", "Munich", "Zurich", "Basel", "Geneva", "Copenhagen", "Southern Sweden"] },
    { id: "middle-east", name: "Middle East", cities: ["Dubai", "Abu Dhabi", "Doha", "Riyadh"] },
    { id: "asia-pacific", name: "Asia-Pacific", cities: ["Beijing", "Shanghai", "Suzhou", "Tokyo", "Hong Kong", "Singapore", "Melbourne", "Sydney"] }
  ];

  // Collaboration routes drawn between hubs, starting from London.
  var ROUTES = [
    ["London", "New York City / New Jersey"],
    ["New York City / New Jersey", "San Francisco Bay Area"],
    ["London", "Dubai"],
    ["Dubai", "Singapore"],
    ["London", "Shanghai"],
    ["Shanghai", "Tokyo"],
    ["Singapore", "Sydney"],
    ["Frankfurt", "Riyadh"]
  ];

  function el(name, attributes) {
    var node = document.createElementNS(SVG_NS, name);
    Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, attributes[key]); });
    return node;
  }

  function regionOf(cityName) {
    for (var i = 0; i < REGIONS.length; i++) {
      if (REGIONS[i].cities.indexOf(cityName) !== -1) return REGIONS[i];
    }
    return null;
  }

  /* ---------- Read the existing map ---------- */

  var cities = {};
  svg.querySelectorAll(".v4-city-marker").forEach(function (marker) {
    var title = marker.querySelector("title");
    var point = marker.querySelector(".v4-city-marker__point");
    if (!title || !point) return;
    var name = title.textContent.replace(/\s+—.*$/, "").trim();
    var region = regionOf(name);
    var city = {
      name: name,
      region: region,
      marker: marker,
      point: point,
      x: parseFloat(point.getAttribute("cx")),
      y: parseFloat(point.getAttribute("cy")),
      r: parseFloat(point.getAttribute("r"))
    };
    if (region) marker.setAttribute("data-region", region.id);
    marker.setAttribute("data-city", name);
    // A larger, invisible target makes the small points easy to hover.
    marker.appendChild(el("circle", { class: "mx-hit", cx: city.x, cy: city.y, r: 10 }));
    cities[name] = city;
  });

  svg.querySelectorAll(".v4-city-map-label").forEach(function (label) {
    var city = cities[label.textContent.trim()];
    if (!city) return;
    city.label = label;
    if (city.region) label.setAttribute("data-region", city.region.id);
  });

  var halos = Array.prototype.slice.call(svg.querySelectorAll(".v4-map-region-halo")).map(function (group) {
    var ring = group.querySelector(".v4-city-marker__halo");
    var x = parseFloat(ring.getAttribute("cx"));
    var y = parseFloat(ring.getAttribute("cy"));
    var nearest = null;
    Object.keys(cities).forEach(function (name) {
      var c = cities[name];
      var d = Math.hypot(c.x - x, c.y - y);
      if (!nearest || d < nearest.d) nearest = { d: d, city: c };
    });
    var region = nearest && nearest.city.region;
    if (region) group.setAttribute("data-region", region.id);
    return { group: group, x: x, y: y, region: region };
  });

  var pins = svg.querySelector(".v4-map-city-pins");
  var land = svg.querySelector("g");

  /* ---------- Ripples, routes and travelling lights ---------- */

  var rippleLayer = el("g", { class: "mx-ripples", "aria-hidden": "true" });
  var routeLayer = el("g", { class: "mx-routes", "aria-hidden": "true" });
  var ripples = [];
  var comets = [];

  halos.forEach(function (halo, index) {
    for (var i = 0; i < 2; i++) {
      var ripple = el("circle", { class: "mx-ripple", cx: halo.x, cy: halo.y, r: 10 });
      ripple.style.animationDelay = (index * 0.45 + i * 1.6) + "s";
      if (halo.region) ripple.setAttribute("data-region", halo.region.id);
      rippleLayer.appendChild(ripple);
      ripples.push(ripple);
    }
  });

  ROUTES.forEach(function (route, index) {
    var from = cities[route[0]];
    var to = cities[route[1]];
    if (!from || !to) return;
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var distance = Math.hypot(dx, dy);
    var lift = Math.min(150, distance * 0.3);
    var cx = (from.x + to.x) / 2;
    var cy = (from.y + to.y) / 2 - lift;
    var d = "M" + from.x + "," + from.y + " Q" + cx.toFixed(1) + "," + cy.toFixed(1) + " " + to.x + "," + to.y;
    var path = el("path", { class: "mx-route", d: d, pathLength: "1" });
    path.style.setProperty("--d", (0.5 + index * 0.18) + "s");
    path.setAttribute("data-regions", [from.region && from.region.id, to.region && to.region.id].join(" "));
    routeLayer.appendChild(path);

    if (!reducedMotion.matches) {
      var duration = Math.max(2.6, distance / 140).toFixed(2) + "s";
      var begin = (index * 0.7).toFixed(2) + "s";
      var comet = el("circle", { class: "mx-comet", r: 2.6, cx: 0, cy: 0 });
      comet.appendChild(el("animateMotion", { path: d, dur: duration, begin: begin, repeatCount: "indefinite", calcMode: "spline", keyTimes: "0;1", keySplines: "0.45 0 0.55 1" }));
      comet.appendChild(el("animate", { attributeName: "opacity", values: "0;1;1;0", keyTimes: "0;0.12;0.85;1", dur: duration, begin: begin, repeatCount: "indefinite" }));
      comet.setAttribute("data-regions", path.getAttribute("data-regions"));
      routeLayer.appendChild(comet);
      comets.push(comet);
    }
  });

  pins.parentNode.insertBefore(rippleLayer, pins);
  pins.parentNode.insertBefore(routeLayer, pins);

  // Leader lines tie each label back to its city once labels spread apart.
  var leaderLayer = el("g", { class: "mx-leaders", "aria-hidden": "true" });
  Object.keys(cities).forEach(function (name) {
    var city = cities[name];
    if (!city.label) return;
    city.leader = el("line", { class: "mx-leader" });
    if (city.region) city.leader.setAttribute("data-region", city.region.id);
    leaderLayer.appendChild(city.leader);
  });
  var labelLayer = svg.querySelector(".v4-map-city-labels");
  (labelLayer || pins).parentNode.insertBefore(leaderLayer, labelLayer || null);

  Object.keys(cities).forEach(function (name, index) {
    cities[name].point.style.setProperty("--d", (index % 7) * 0.35 + "s");
  });

  /* ---------- Region toolbar ---------- */

  var toolbar = document.createElement("div");
  toolbar.className = "mx-toolbar";
  var filters = document.createElement("div");
  filters.className = "mx-filters";
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Show a region on the map");

  var filterButtons = [{ id: "", name: "All regions", count: Object.keys(cities).length }].concat(REGIONS.map(function (region) {
    return { id: region.id, name: region.name, count: region.cities.filter(function (n) { return cities[n]; }).length };
  })).map(function (item) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "mx-filter";
    button.setAttribute("data-region-filter", item.id);
    button.setAttribute("aria-pressed", String(item.id === ""));
    button.innerHTML = '<span></span><strong></strong>';
    button.querySelector("span").textContent = item.name;
    button.querySelector("strong").textContent = item.count;
    button.addEventListener("click", function () { focusRegion(item.id); });
    filters.appendChild(button);
    return button;
  });

  var motionButton = document.createElement("button");
  motionButton.type = "button";
  motionButton.className = "mx-motion";
  motionButton.setAttribute("aria-pressed", "false");
  motionButton.textContent = "Pause animation";
  motionButton.hidden = reducedMotion.matches;

  toolbar.appendChild(filters);
  toolbar.appendChild(motionButton);
  var anchor = section.querySelector("[data-map-controls]") || scroller;
  anchor.parentNode.insertBefore(toolbar, anchor);

  /* ---------- Tooltip ---------- */

  var tip = document.createElement("div");
  tip.className = "mx-tip";
  tip.setAttribute("aria-hidden", "true");
  tip.innerHTML = '<p class="mx-tip__eyebrow"></p><p class="mx-tip__title"></p><p class="mx-tip__list"></p>';
  scroller.appendChild(tip);

  function placeTip(x, y) {
    var matrix = svg.getScreenCTM();
    if (!matrix) return;
    var point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    var screen = point.matrixTransform(matrix);
    var box = scroller.getBoundingClientRect();
    tip.style.left = (screen.x - box.left + scroller.scrollLeft) + "px";
    tip.style.top = (screen.y - box.top + scroller.scrollTop) + "px";
  }

  function showCityTip(city) {
    var region = city.region;
    tip.querySelector(".mx-tip__eyebrow").textContent = region ? region.name : "";
    tip.querySelector(".mx-tip__title").textContent = city.name;
    tip.querySelector(".mx-tip__list").textContent = "Experience & collaboration";
    placeTip(city.x, city.y);
    tip.classList.add("is-visible");
  }

  function showRegionTip(halo) {
    var region = halo.region;
    if (!region) return;
    var near = region.cities.filter(function (name) {
      var c = cities[name];
      return c && Math.hypot(c.x - halo.x, c.y - halo.y) < 60;
    });
    tip.querySelector(".mx-tip__eyebrow").textContent = region.name + " · " + near.length + (near.length === 1 ? " city" : " cities");
    tip.querySelector(".mx-tip__title").textContent = near[0] || region.name;
    tip.querySelector(".mx-tip__list").textContent = near.slice(1).join(" · ");
    placeTip(halo.x, halo.y - 30);
    tip.classList.add("is-visible");
  }

  function hideTip() {
    tip.classList.remove("is-visible");
  }

  function setHot(city, on) {
    city.marker.classList.toggle("is-hot", on);
    if (city.label) city.label.classList.toggle("is-hot", on);
    if (city.leader) city.leader.classList.toggle("is-hot", on);
    svg.classList.toggle("has-hot", on);
  }

  Object.keys(cities).forEach(function (name) {
    var city = cities[name];
    city.marker.addEventListener("pointerenter", function () { setHot(city, true); showCityTip(city); });
    city.marker.addEventListener("pointerleave", function () { setHot(city, false); hideTip(); });
    city.marker.addEventListener("click", function () { if (city.region) focusRegion(city.region.id); });
  });

  halos.forEach(function (halo) {
    halo.group.addEventListener("pointerenter", function () { showRegionTip(halo); });
    halo.group.addEventListener("pointerleave", hideTip);
    halo.group.addEventListener("click", function () { if (halo.region) focusRegion(halo.region.id); });
  });

  // Hovering the city list lights up the matching city on the map.
  section.querySelectorAll(".v4-city-list li").forEach(function (item) {
    var city = cities[item.textContent.trim()];
    if (!city) return;
    if (city.region) item.setAttribute("data-region", city.region.id);
    item.addEventListener("mouseenter", function () { setHot(city, true); showCityTip(city); });
    item.addEventListener("mouseleave", function () { setHot(city, false); hideTip(); });
  });

  /* ---------- Zooming to a region ---------- */

  var currentView = fullView.slice();
  var zoomFrame = 0;

  function viewForRegion(regionId) {
    if (!regionId) return fullView.slice();
    var region = REGIONS.filter(function (r) { return r.id === regionId; })[0];
    var points = region.cities.map(function (n) { return cities[n]; }).filter(Boolean);
    var xs = points.map(function (p) { return p.x; });
    var ys = points.map(function (p) { return p.y; });
    var pad = 40;
    var minX = Math.min.apply(null, xs) - pad;
    var maxX = Math.max.apply(null, xs) + pad;
    var minY = Math.min.apply(null, ys) - pad;
    var maxY = Math.max.apply(null, ys) + pad;
    var aspect = fullView[2] / fullView[3];
    var width = Math.max(maxX - minX, (maxY - minY) * aspect, fullView[2] / maxZoom);
    var height = width / aspect;
    var x = Math.min(Math.max((minX + maxX) / 2 - width / 2, 0), fullView[2] - width);
    var y = Math.min(Math.max((minY + maxY) / 2 - height / 2, -20), fullView[3] - height + 20);
    return [x, y, width, height];
  }

  function applyView(view) {
    currentView = view;
    svg.setAttribute("viewBox", view.map(function (v) { return v.toFixed(2); }).join(" "));
    var zoom = fullView[2] / view[2];
    var shrink = Math.pow(zoom, 0.7);
    svg.style.setProperty("--mx-zoom", zoom.toFixed(3));
    svg.style.setProperty("--mx-shrink", shrink.toFixed(3));
    Object.keys(cities).forEach(function (name) {
      var city = cities[name];
      city.point.setAttribute("r", (city.r / shrink).toFixed(2));
    });
    Object.keys(cities).forEach(function (name) {
      var city = cities[name];
      if (!city.leader) return;
      var anchor = city.label.getAttribute("text-anchor") || "start";
      var fontSize = 9.5 / shrink;
      var gap = 3 / shrink;
      var lx = parseFloat(city.label.getAttribute("x")) + (anchor === "start" ? -gap : anchor === "end" ? gap : 0);
      var ly = parseFloat(city.label.getAttribute("y")) - fontSize * 0.35;
      var dx = lx - city.x;
      var dy = ly - city.y;
      var length = Math.hypot(dx, dy) || 1;
      var start = (city.r + 2) / shrink;
      var visible = length > start + 6 / shrink;
      city.leader.setAttribute("x1", (city.x + dx / length * start).toFixed(2));
      city.leader.setAttribute("y1", (city.y + dy / length * start).toFixed(2));
      city.leader.setAttribute("x2", (visible ? lx : city.x).toFixed(2));
      city.leader.setAttribute("y2", (visible ? ly : city.y).toFixed(2));
    });
    ripples.forEach(function (ripple) { ripple.setAttribute("r", (10 / shrink).toFixed(2)); });
    comets.forEach(function (comet) { comet.setAttribute("r", (2.6 / shrink).toFixed(2)); });
  }

  function animateView(target) {
    window.cancelAnimationFrame(zoomFrame);
    if (reducedMotion.matches) { applyView(target); return; }
    var start = currentView.slice();
    var startTime = null;
    var duration = 1100;
    function frame(time) {
      if (startTime === null) startTime = time;
      var t = Math.min(1, (time - startTime) / duration);
      var eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      applyView(start.map(function (v, i) { return v + (target[i] - v) * eased; }));
      if (t < 1) zoomFrame = window.requestAnimationFrame(frame);
    }
    zoomFrame = window.requestAnimationFrame(frame);
  }

  function focusRegion(regionId) {
    hideTip();
    filterButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-region-filter") === regionId));
    });
    if (regionId) section.setAttribute("data-map-focus", regionId);
    else section.removeAttribute("data-map-focus");
    animateView(viewForRegion(regionId));
    // On small screens the map scrolls sideways; bring the zoomed region into view.
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      if (legacyPanToggle && legacyPanToggle.getAttribute("aria-pressed") !== "true") legacyPanToggle.click();
      scroller.scrollTo({ left: (scroller.scrollWidth - scroller.clientWidth) / 2, behavior: reducedMotion.matches ? "auto" : "smooth" });
    }
  }

  /* ---------- Motion: entrance, pause and off-screen rest ---------- */

  var userPaused = false;
  var onScreen = false;

  function syncMotion() {
    var paused = userPaused || !onScreen || reducedMotion.matches;
    section.classList.toggle("mx-paused", paused);
    if (typeof svg.pauseAnimations === "function") {
      if (paused) svg.pauseAnimations();
      else svg.unpauseAnimations();
    }
  }

  motionButton.addEventListener("click", function () {
    userPaused = !userPaused;
    motionButton.setAttribute("aria-pressed", String(userPaused));
    motionButton.textContent = userPaused ? "Play animation" : "Pause animation";
    if (legacyPanToggle && legacyPanToggle.getAttribute("aria-pressed") !== String(userPaused)) legacyPanToggle.click();
    syncMotion();
  });

  section.classList.add("mx-ready");
  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    section.classList.add("mx-live");
    onScreen = true;
    syncMotion();
  } else {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        onScreen = entry.isIntersecting;
        if (onScreen) section.classList.add("mx-live");
        syncMotion();
      });
    }, { threshold: 0.2 }).observe(svg);
  }

  applyView(fullView.slice());
  if (land) land.classList.add("mx-land");
})();
