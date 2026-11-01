(function () {
  "use strict";

  // Knowledge Centre: turns the template lists into a browsable library with
  // category filters and a search across every template. Without JavaScript the
  // original grouped lists stay as they are.
  var library = document.querySelector("[data-kc-library]");
  if (!library) return;

  var groups = Array.prototype.slice.call(library.querySelectorAll(".v4-template-group")).map(function (group, index) {
    var title = group.querySelector("h3").textContent.replace(/\s+/g, " ").trim();
    return {
      id: "kc-cat-" + (index + 1),
      name: title.replace(/\s+Templates$/, ""),
      items: Array.prototype.slice.call(group.querySelectorAll("li")).map(function (item) {
        return item.textContent.replace(/\s+/g, " ").trim();
      })
    };
  });
  if (!groups.length) return;

  var total = groups.reduce(function (sum, group) { return sum + group.items.length; }, 0);
  document.querySelectorAll("[data-kc-template-count]").forEach(function (element) {
    element.textContent = String(total);
  });

  var docIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
  var searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';

  function create(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  // Lower-case and unify the non-breaking and other hyphens used in the copy.
  // Every replacement is one character for one, so match positions still line
  // up with the original text for highlighting.
  function normalise(value) {
    return value.toLowerCase().replace(/[‐-―−]/g, "-");
  }

  /* ---------- Build the library ---------- */

  var root = create("div", "kc-lib");
  var bar = create("div", "kc-lib__bar");

  var search = create("div", "kc-lib__search");
  search.innerHTML = searchIcon;
  var searchLabel = create("label", "visually-hidden", "Search templates");
  searchLabel.htmlFor = "kc-lib-search";
  var input = create("input");
  input.type = "search";
  input.id = "kc-lib-search";
  input.placeholder = "Search all " + total + " templates";
  input.autocomplete = "off";
  input.setAttribute("aria-controls", "kc-lib-list");
  search.append(searchLabel, input);

  var filters = create("div", "kc-lib__filters");
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "Template categories");
  var buttons = groups.map(function (group) {
    var button = create("button");
    button.type = "button";
    button.dataset.cat = group.id;
    button.setAttribute("aria-controls", "kc-lib-list");
    button.append(document.createTextNode(group.name + " "), create("span", "kc-lib__count", String(group.items.length)));
    filters.appendChild(button);
    return button;
  });
  bar.append(search, filters);

  var status = create("p", "kc-lib__status");
  status.setAttribute("aria-live", "polite");

  var list = create("ul", "kc-lib__grid");
  list.id = "kc-lib-list";
  var entries = [];
  groups.forEach(function (group) {
    group.items.forEach(function (name) {
      var item = create("li", "kc-lib__item");
      item.innerHTML = docIcon;
      var label = create("span", "kc-lib__name", name);
      var category = create("span", "kc-lib__cat", group.name);
      item.append(label, category);
      list.appendChild(item);
      entries.push({ element: item, label: label, name: name, group: group, haystack: normalise(name + " " + group.name) });
    });
  });

  var empty = create("div", "kc-lib__empty");
  empty.hidden = true;
  var emptyText = create("p");
  var emptyLink = create("a", "", "Ask us about a template");
  emptyLink.href = "../contact/";
  empty.append(emptyText, emptyLink);

  root.append(bar, status, list, empty);
  library.appendChild(root);
  library.classList.add("is-enhanced");

  /* ---------- Filtering ---------- */

  var activeCategory = groups[0].id;

  function highlight(entry, terms) {
    entry.label.textContent = "";
    if (!terms.length) { entry.label.textContent = entry.name; return; }
    var lower = normalise(entry.name);
    var marks = [];
    terms.forEach(function (term) {
      var at = lower.indexOf(term);
      if (at !== -1) marks.push([at, at + term.length]);
    });
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var cursor = 0;
    marks.forEach(function (range) {
      if (range[0] < cursor) return;
      if (range[0] > cursor) entry.label.append(document.createTextNode(entry.name.slice(cursor, range[0])));
      entry.label.append(create("mark", "", entry.name.slice(range[0], range[1])));
      cursor = range[1];
    });
    if (cursor < entry.name.length) entry.label.append(document.createTextNode(entry.name.slice(cursor)));
  }

  function plural(count) {
    return count + (count === 1 ? " template" : " templates");
  }

  function render() {
    var query = input.value.trim();
    var terms = normalise(query).split(/\s+/).filter(Boolean);
    var searching = terms.length > 0;
    var shown = 0;

    entries.forEach(function (entry) {
      var match = searching
        ? terms.every(function (term) { return entry.haystack.indexOf(term) !== -1; })
        : entry.group.id === activeCategory;
      entry.element.hidden = !match;
      if (match) shown += 1;
      highlight(entry, searching ? terms : []);
    });

    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(!searching && button.dataset.cat === activeCategory));
    });
    list.classList.toggle("is-searching", searching);

    if (searching) {
      status.textContent = shown ? plural(shown) + " match “" + query + "”" : "";
    } else {
      var group = groups.filter(function (g) { return g.id === activeCategory; })[0];
      status.textContent = plural(shown) + " in " + group.name;
    }
    empty.hidden = shown > 0;
    if (!shown) emptyText.textContent = "No templates match “" + query + "”.";
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      activeCategory = button.dataset.cat;
      input.value = "";
      render();
    });
  });

  input.addEventListener("input", render);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && input.value) {
      event.preventDefault();
      input.value = "";
      render();
    }
  });

  render();
})();
