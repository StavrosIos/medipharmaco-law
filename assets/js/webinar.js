(function () {
  "use strict";

  var body = document.body;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var UK = "Europe/London";

  // All dates are formatted en-GB; `zone` null means the visitor's own time zone.
  function formatIn(zone, date, options) {
    return new Intl.DateTimeFormat("en-GB", Object.assign(zone ? { timeZone: zone } : {}, options)).format(date);
  }

  function ukDate(date, options) {
    return formatIn(UK, date, options);
  }

  var timeOnly = { hour: "2-digit", minute: "2-digit" };

  function timeRange(zone, session) {
    return formatIn(zone, session.start, timeOnly) + "–" + formatIn(zone, session.end, timeOnly);
  }

  // "2027-03-10": the calendar day a moment falls on in the UK.
  var ukDayParts = new Intl.DateTimeFormat("en-GB", { timeZone: UK, year: "numeric", month: "2-digit", day: "2-digit" });
  function ukDayKey(date) {
    var parts = {};
    ukDayParts.formatToParts(date).forEach(function (part) { parts[part.type] = part.value; });
    return parts.year + "-" + parts.month + "-" + parts.day;
  }

  // A card's sessions are "start/end" pairs (ISO 8601, UTC) separated by spaces.
  function parseSessions(value) {
    return (value || "").trim().split(/\s+/).filter(Boolean).map(function (pair) {
      var parts = pair.split("/");
      return { start: new Date(parts[0]), end: new Date(parts[1] || parts[0]) };
    });
  }

  /* ---------- Knowledge Centre: finished webinars move to "Past sessions" ---------- */

  var upcoming = document.querySelector("[data-wb-upcoming]");
  var pastBlock = document.querySelector("[data-wb-past]");
  var listedCards = upcoming ? Array.prototype.slice.call(upcoming.querySelectorAll("[data-wb-sessions]")) : [];
  if (upcoming && pastBlock) {
    var pastList = pastBlock.querySelector("[data-wb-past-list]");
    listedCards.forEach(function (card) {
      var sessions = parseSessions(card.getAttribute("data-wb-sessions"));
      var lastEnd = Math.max.apply(null, sessions.map(function (session) { return session.end.getTime(); }));
      if (sessions.length && lastEnd < Date.now()) {
        card.classList.add("is-past");
        pastList.appendChild(card);
      }
    });
    pastBlock.hidden = !pastList.children.length;
  }

  /* ---------- Knowledge Centre: month calendar of sessions ---------- */

  var calendar = document.querySelector("[data-wb-cal]");
  if (calendar && listedCards.length) buildCalendar(calendar, listedCards);

  function buildCalendar(container, cards) {
    var events = [];
    cards.forEach(function (card) {
      var title = (card.querySelector(".wb-card__title") || card).textContent.trim();
      parseSessions(card.getAttribute("data-wb-sessions")).forEach(function (session) {
        events.push({ title: title, href: card.getAttribute("href"), start: session.start, end: session.end, day: ukDayKey(session.start) });
      });
    });
    if (!events.length) return;
    events.sort(function (a, b) { return a.start - b.start; });

    var monthLabel = container.querySelector(".wb-cal__month");
    var prev = container.querySelector("[data-wb-cal-prev]");
    var next = container.querySelector("[data-wb-cal-next]");
    var days = container.querySelector("[data-wb-cal-days]");
    var agenda = container.querySelector("[data-wb-cal-agenda]");

    // Months are counted as year * 12 + month (0-based) so they can be compared and stepped.
    function monthOf(dayKey) { return +dayKey.slice(0, 4) * 12 + (+dayKey.slice(5, 7) - 1); }
    function pad(number) { return (number < 10 ? "0" : "") + number; }
    function dayDate(dayKey) { return new Date(Date.UTC(+dayKey.slice(0, 4), +dayKey.slice(5, 7) - 1, +dayKey.slice(8, 10))); }
    function eventsOn(dayKey) { return events.filter(function (event) { return event.day === dayKey; }); }
    function isOver(event) { return event.end.getTime() < Date.now(); }

    var today = ukDayKey(new Date());
    var nextEvent = events.filter(function (event) { return !isOver(event); })[0];
    var minMonth = monthOf(today);
    var maxMonth = Math.max(minMonth, monthOf(events[events.length - 1].day));
    var month = nextEvent ? monthOf(nextEvent.day) : minMonth;
    var selected = nextEvent ? nextEvent.day : null;

    // On changing month, show the first session still to come in it, or else its first session.
    function defaultDay() {
      var inMonth = events.filter(function (event) { return monthOf(event.day) === month; });
      var first = inMonth.filter(function (event) { return !isOver(event); })[0] || inMonth[0];
      return first ? first.day : null;
    }

    function renderAgenda() {
      agenda.textContent = "";
      var heading = document.createElement("div");
      heading.className = "wb-cal__date";
      if (!selected) {
        heading.textContent = "No webinars in " + monthLabel.textContent + ".";
        agenda.appendChild(heading);
        return;
      }
      heading.textContent = formatIn("UTC", dayDate(selected), { weekday: "long", day: "numeric", month: "long" });
      agenda.appendChild(heading);
      var list = document.createElement("ul");
      list.className = "wb-cal__events";
      eventsOn(selected).forEach(function (event) {
        var item = document.createElement("li");
        var link = document.createElement("a");
        link.className = "wb-cal__event";
        link.href = event.href;
        var time = document.createElement("span");
        time.className = "wb-cal__time";
        time.textContent = timeRange(UK, event) + (isOver(event) ? " · Ended" : "");
        var title = document.createElement("span");
        title.className = "wb-cal__title";
        title.textContent = event.title;
        link.appendChild(time);
        link.appendChild(title);
        item.appendChild(link);
        list.appendChild(item);
      });
      agenda.appendChild(list);
    }

    function select(dayKey) {
      selected = dayKey;
      days.querySelectorAll("button").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.getAttribute("data-day") === dayKey));
      });
      renderAgenda();
    }

    function renderMonth() {
      var year = Math.floor(month / 12);
      var monthIndex = month % 12;
      var first = new Date(Date.UTC(year, monthIndex, 1));
      var lead = (first.getUTCDay() + 6) % 7; // weeks start on Monday
      var length = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      monthLabel.textContent = formatIn("UTC", first, { month: "long", year: "numeric" });
      prev.disabled = month <= minMonth;
      next.disabled = month >= maxMonth;

      days.textContent = "";
      var row = document.createElement("tr");
      for (var blank = 0; blank < lead; blank++) row.appendChild(document.createElement("td"));
      for (var date = 1; date <= length; date++) {
        var key = year + "-" + pad(monthIndex + 1) + "-" + pad(date);
        var count = eventsOn(key).length;
        var cell = document.createElement("td");
        var day = document.createElement(count ? "button" : "span");
        day.className = "wb-cal__day";
        day.textContent = date;
        if (key < today) day.classList.add("is-past");
        if (key === today) {
          day.classList.add("is-today");
          day.setAttribute("aria-current", "date");
        }
        if (count) {
          day.type = "button";
          day.setAttribute("data-day", key);
          day.setAttribute("aria-pressed", String(key === selected));
          day.setAttribute("aria-label", formatIn("UTC", dayDate(key), { weekday: "long", day: "numeric", month: "long" }) + ", " + count + (count === 1 ? " webinar" : " webinars"));
          day.addEventListener("click", select.bind(null, key));
        }
        cell.appendChild(day);
        row.appendChild(cell);
        if ((lead + date) % 7 === 0) {
          days.appendChild(row);
          row = document.createElement("tr");
        }
      }
      if (row.children.length) {
        while (row.children.length < 7) row.appendChild(document.createElement("td"));
        days.appendChild(row);
      }
      renderAgenda();
    }

    function step(delta, button) {
      month = Math.min(maxMonth, Math.max(minMonth, month + delta));
      selected = defaultDay();
      renderMonth();
      // Keep keyboard focus on the calendar when the button just pressed becomes disabled.
      if (button.disabled) (button === prev ? next : prev).focus();
    }
    prev.addEventListener("click", function () { step(-1, prev); });
    next.addEventListener("click", function () { step(1, next); });

    renderMonth();
    container.hidden = false;
  }

  /* ---------- Webinar page ---------- */

  var page = document.querySelector("[data-wb-page]");
  if (!page) return;

  var title = page.getAttribute("data-title") || document.title;
  var venue = page.getAttribute("data-location") || "Online";
  var sessions = Array.prototype.slice.call(page.querySelectorAll("[data-wb-session]")).map(function (element) {
    return {
      element: element,
      start: new Date(element.getAttribute("data-start")),
      end: new Date(element.getAttribute("data-end"))
    };
  });
  var pageUrl = window.location.href.split("#")[0];
  var status = page.querySelector("[data-wb-status]");
  var form = page.querySelector("[data-wb-form]");

  function announce(message) {
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(announce.timer);
    announce.timer = window.setTimeout(function () { status.textContent = ""; }, 4000);
  }

  /* Share and email links */
  var linkedIn = page.querySelector("[data-wb-linkedin]");
  if (linkedIn) linkedIn.href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(pageUrl);

  var email = page.querySelector("[data-wb-email]");
  if (email && sessions.length) {
    var when = sessions.map(function (session) {
      return ukDate(session.start, { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " UK time";
    }).join(sessions.length > 1 ? " or\n" : "");
    email.href = "mailto:?subject=" + encodeURIComponent(title + " – MediPharmaco Law webinar") +
      "&body=" + encodeURIComponent("I thought you might be interested in this webinar:\n\n" + title + "\n" + when + "\n\n" + pageUrl);
  }

  /* Print / save as PDF */
  page.querySelectorAll("[data-wb-print]").forEach(function (button) {
    button.addEventListener("click", function () { window.print(); });
  });

  /* Finished sessions say so; the page closes registration once all have finished */
  sessions.forEach(function (session) {
    session.ended = session.end.getTime() < Date.now();
    if (!session.ended) return;
    session.element.classList.add("is-ended");
    var label = document.createElement("span");
    label.className = "wb-session__status";
    label.textContent = "Ended";
    session.element.appendChild(label);
    var choice = form && form.querySelector("input[name='session'][value='" + session.element.getAttribute("data-start") + "']");
    if (choice) choice.disabled = true;
  });
  if (sessions.length && sessions.every(function (session) { return session.ended; })) {
    page.classList.add("is-ended");
    var ended = page.querySelector("[data-wb-ended]");
    if (ended) ended.hidden = false;
  }

  /* Add to calendar: build an .ics file in the browser */
  function icsDate(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }
  function icsText(text) {
    return String(text).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  }
  function downloadCalendarFile(session) {
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
      "SUMMARY:" + icsText(title),
      "DESCRIPTION:" + icsText("MediPharmaco Law webinar.\nDetails and registration: " + pageUrl),
      "LOCATION:" + icsText(venue),
      "URL:" + pageUrl,
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    var blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
    var link = document.createElement("a");
    var slug = (title.replace(/\[[^\]]*\]/g, "").trim() || "webinar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    link.href = URL.createObjectURL(blob);
    link.download = slug + (sessions.length > 1 ? "-" + ukDayKey(session.start) : "") + ".ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    announce("Calendar file downloaded.");
  }
  page.querySelectorAll("[data-wb-ics]").forEach(function (button) {
    var owner = button.closest("[data-wb-session]");
    button.addEventListener("click", function () {
      var session = owner && sessions.filter(function (item) { return item.element === owner; })[0];
      var open = sessions.filter(function (item) { return !item.ended; });
      if (!session && open.length === 1) session = open[0];
      if (session) {
        downloadCalendarFile(session);
        return;
      }
      // Several dates on offer: let the visitor pick one in the Dates & times section.
      if (sessions.length) {
        scrollToTarget(sessions[0].element.closest("section") || sessions[0].element);
        announce("Choose a date below to add it to your calendar.");
      }
    });
  });

  /* Show each session's time in the visitor's own time zone when it differs from UK time */
  var zone = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").replace(/_/g, " ");
  sessions.forEach(function (session) {
    var note = session.element.querySelector("[data-wb-localtime]");
    if (!note || timeRange(null, session) === timeRange(UK, session)) return;
    var dayOptions = { weekday: "long", day: "numeric", month: "long" };
    var localDay = formatIn(null, session.start, dayOptions);
    var otherDay = localDay !== ukDate(session.start, dayOptions);
    note.textContent = "That’s " + timeRange(null, session) + (otherDay ? " on " + localDay : "") + " in your time zone" + (zone ? " (" + zone + ")" : "") + ".";
    note.hidden = false;
  });

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
  if (form) {
    var formStatus = form.querySelector("[data-wb-form-status]");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;
      formStatus.textContent = "Preview only: registration isn’t switched on yet, so nothing was sent.";
    });
  }
})();
