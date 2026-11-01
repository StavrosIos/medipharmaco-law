(function () {
  "use strict";

  var body = document.body;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Knowledge Centre: finished sessions move to "Past sessions" ---------- */

  var upcoming = document.querySelector("[data-wb-upcoming]");
  var pastBlock = document.querySelector("[data-wb-past]");
  if (upcoming && pastBlock) {
    var pastList = pastBlock.querySelector("[data-wb-past-list]");
    upcoming.querySelectorAll("[data-wb-end]").forEach(function (card) {
      if (Date.parse(card.getAttribute("data-wb-end")) < Date.now()) {
        card.classList.add("is-past");
        pastList.appendChild(card);
      }
    });
    pastBlock.hidden = !pastList.children.length;
  }

  /* ---------- Webinar page ---------- */

  var page = document.querySelector("[data-wb-page]");
  if (!page) return;

  var eventElement = page.querySelector("[data-wb-event]");
  var session = eventElement && {
    title: eventElement.getAttribute("data-title"),
    start: new Date(eventElement.getAttribute("data-start")),
    end: new Date(eventElement.getAttribute("data-end")),
    location: eventElement.getAttribute("data-location") || "Online"
  };
  var pageUrl = window.location.href.split("#")[0];
  var status = page.querySelector("[data-wb-status]");

  function announce(message) {
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(function () { status.textContent = ""; }, 4000);
  }

  function ukDate(date, options) {
    return new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: "Europe/London" }, options)).format(date);
  }

  /* Share and email links */
  var linkedIn = page.querySelector("[data-wb-linkedin]");
  if (linkedIn) linkedIn.href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(pageUrl);

  var email = page.querySelector("[data-wb-email]");
  if (email && session) {
    var when = ukDate(session.start, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " UK time";
    email.href = "mailto:?subject=" + encodeURIComponent(session.title + " – MediPharmaco Law webinar") +
      "&body=" + encodeURIComponent("I thought you might be interested in this webinar:\n\n" + session.title + "\n" + when + "\n\n" + pageUrl);
  }

  /* Print / save as PDF */
  page.querySelectorAll("[data-wb-print]").forEach(function (button) {
    button.addEventListener("click", function () { window.print(); });
  });

  /* Add to calendar: build an .ics file in the browser */
  function icsDate(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }
  function icsText(text) {
    return String(text).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  }
  function downloadCalendarFile() {
    if (!session) return;
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MediPharmaco Law//Webinars//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + icsDate(session.start) + "-" + window.location.pathname.replace(/[^a-z0-9]+/gi, "-") + "@medipharmacolaw.com",
      "DTSTAMP:" + icsDate(new Date()),
      "DTSTART:" + icsDate(session.start),
      "DTEND:" + icsDate(session.end),
      "SUMMARY:" + icsText(session.title),
      "DESCRIPTION:" + icsText("MediPharmaco Law webinar.\nDetails and registration: " + pageUrl),
      "LOCATION:" + icsText(session.location),
      "URL:" + pageUrl,
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    var blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = (session.title.replace(/\[[^\]]*\]/g, "").trim() || "webinar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    announce("Calendar file downloaded.");
  }
  page.querySelectorAll("[data-wb-ics]").forEach(function (button) {
    button.addEventListener("click", downloadCalendarFile);
  });

  /* Show the time in the visitor's own time zone when it differs from UK time */
  var localNote = page.querySelector("[data-wb-localtime]");
  if (localNote && session) {
    var timeOnly = { hour: "2-digit", minute: "2-digit" };
    var localRange = new Intl.DateTimeFormat(undefined, timeOnly).format(session.start) + "–" + new Intl.DateTimeFormat(undefined, timeOnly).format(session.end);
    var ukRange = ukDate(session.start, timeOnly) + "–" + ukDate(session.end, timeOnly);
    var zone = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").replace(/_/g, " ");
    localNote.textContent = localRange === ukRange
      ? "Times are shown in UK time."
      : "Times are shown in UK time. That’s " + localRange + " in your time zone" + (zone ? " (" + zone + ")" : "") + ".";
  }

  /* A finished session says so and hides registration */
  if (session && session.end.getTime() < Date.now()) {
    page.classList.add("is-ended");
    var ended = page.querySelector("[data-wb-ended]");
    if (ended) ended.hidden = false;
  }

  /* Series description: collapsed to a preview with a "…more" toggle */
  var series = page.querySelector("[data-wb-series]");
  if (series) {
    var more = series.querySelector(".wb-series__more");
    var text = series.querySelector(".wb-series__text");
    if (more && text) {
      series.classList.add("is-collapsible");
      more.hidden = text.scrollHeight <= text.clientHeight + 4;
      more.addEventListener("click", function () {
        var open = series.classList.toggle("is-open");
        more.setAttribute("aria-expanded", String(open));
        more.textContent = open ? "Show less" : "…more";
      });
    }
  }

  /* Tabs: smooth scrolling and highlighting the section in view */
  var header = document.querySelector("[data-site-header]");
  var tabsBar = document.querySelector("[data-wb-tabs]");
  var tabs = tabsBar ? Array.prototype.slice.call(tabsBar.querySelectorAll("a[href^='#']")) : [];
  var sections = tabs.map(function (tab) { return document.querySelector(tab.getAttribute("href")); });

  function stickyOffset() {
    return (header ? header.getBoundingClientRect().height : 0) + (tabsBar ? tabsBar.getBoundingClientRect().height : 0) + 20;
  }

  function setActiveTab(index) {
    tabs.forEach(function (tab, i) {
      tab.classList.toggle("is-active", i === index);
      if (i === index) tab.setAttribute("aria-current", "true");
      else tab.removeAttribute("aria-current");
    });
  }

  function scrollToTarget(target) {
    var smoother = window.ScrollSmoother && window.ScrollSmoother.get && window.ScrollSmoother.get();
    var offset = stickyOffset();
    if (smoother) smoother.scrollTo(target, !reducedMotion.matches, "top " + offset + "px");
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: reducedMotion.matches ? "auto" : "smooth" });
  }

  page.parentNode.querySelectorAll("[data-wb-tabs] a[href^='#'], [data-wb-jump]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      var target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      scrollToTarget(target);
      if (window.history && window.history.replaceState) window.history.replaceState(null, "", link.getAttribute("href"));
      var index = tabs.indexOf(link);
      if (index !== -1) setActiveTab(index);
    });
  });

  // ScrollTrigger follows ScrollSmoother's eased positions; a plain scroll
  // listener would read positions before the smoothed content has moved.
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    sections.forEach(function (section, i) {
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: function () { return "top " + (stickyOffset() + 40) + "px"; },
        end: function () { return "bottom " + (stickyOffset() + 40) + "px"; },
        invalidateOnRefresh: true,
        onToggle: function (self) { if (self.isActive) setActiveTab(i); },
        onLeaveBack: function () { if (i === 0) setActiveTab(0); }
      });
    });
  } else {
    var spyTicking = false;
    var updateActiveTab = function () {
      spyTicking = false;
      var line = stickyOffset() + 40;
      var active = 0;
      sections.forEach(function (section, i) {
        if (section && section.getBoundingClientRect().top <= line) active = i;
      });
      setActiveTab(active);
    };
    window.addEventListener("scroll", function () {
      if (!spyTicking) { spyTicking = true; window.requestAnimationFrame(updateActiveTab); }
    }, { passive: true });
    updateActiveTab();
  }

  /* With ScrollSmoother, CSS sticky cannot work, so pin the tabs and the action rail */
  var rail = page.querySelector("[data-wb-rail]");
  var content = page.querySelector(".wb-content");
  if (gsap && ScrollTrigger && typeof gsap.matchMedia === "function" && tabsBar && rail && content) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add("(min-width: 66.001rem) and (pointer: fine) and (prefers-reduced-motion: no-preference)", function () {
      if (!body.classList.contains("has-scroll-smoother")) return;
      tabsBar.classList.add("is-pinned");
      rail.classList.add("is-pinned");
      var headerHeight = function () { return header ? header.getBoundingClientRect().height : 0; };
      var tabsPin = ScrollTrigger.create({
        trigger: tabsBar,
        pin: tabsBar,
        pinSpacing: false,
        start: function () { return "top " + headerHeight() + "px"; },
        endTrigger: page,
        end: function () { return "bottom " + (headerHeight() + tabsBar.offsetHeight) + "px"; },
        invalidateOnRefresh: true
      });
      var railTop = function () { return headerHeight() + tabsBar.offsetHeight + 24; };
      var railPin = ScrollTrigger.create({
        trigger: rail,
        pin: rail,
        pinSpacing: false,
        start: function () { return "top " + railTop() + "px"; },
        endTrigger: content,
        end: function () { return "bottom " + (railTop() + rail.offsetHeight) + "px"; },
        invalidateOnRefresh: true
      });
      return function () {
        tabsPin.kill();
        railPin.kill();
        tabsBar.classList.remove("is-pinned");
        rail.classList.remove("is-pinned");
      };
    });
  }

  /* Registration form: preview only until a registration method is chosen */
  var form = page.querySelector("[data-wb-form]");
  if (form) {
    var formStatus = form.querySelector("[data-wb-form-status]");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      formStatus.textContent = "Preview only: registration isn’t switched on yet, so nothing was sent.";
    });
  }
})();
