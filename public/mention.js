(function () {
  "use strict";

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  function closeDrop(drop) {
    drop.innerHTML = "";
    drop.style.display = "none";
  }

  function setup(input) {
    var hidden = document.getElementById(input.dataset.hidden);
    if (!hidden) return;

    var wrap = document.createElement("div");
    wrap.className = "mention-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var drop = document.createElement("div");
    drop.className = "mention-drop";
    drop.style.display = "none";
    wrap.appendChild(drop);

    var suppress = false;

    function currentQuery() {
      var pos = input.selectionStart || input.value.length;
      var head = input.value.slice(0, pos);
      var at = head.lastIndexOf("@");
      if (at === -1) return null;
      var q = head.slice(at + 1);
      if (/\s/.test(q)) return null;
      return q;
    }

    var search = debounce(function (q) {
      fetch("/api/nguoi-dung?q=" + encodeURIComponent(q))
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) { renderDrop(list); })
        .catch(function () { closeDrop(drop); });
    }, 150);

    function renderDrop(list) {
      drop.innerHTML = "";
      if (!list || !list.length) {
        closeDrop(drop);
        return;
      }
      list.forEach(function (u) {
        var item = document.createElement("div");
        item.textContent = u.fullName + " (" + u.username + ")";
        item.addEventListener("mousedown", function (e) {
          e.preventDefault();
          suppress = true;
          input.value = u.fullName;
          hidden.value = u.username;
          closeDrop(drop);
          suppress = false;
        });
        drop.appendChild(item);
      });
      drop.style.display = "block";
    }

    input.addEventListener("input", function () {
      if (suppress) return;
      hidden.value = "";
      var q = currentQuery();
      if (q !== null && q.length >= 3) {
        search(q);
      } else {
        closeDrop(drop);
      }
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrop(drop);
    });

    input.addEventListener("blur", function () {
      setTimeout(function () { closeDrop(drop); }, 120);
    });
  }

  function init() {
    document.querySelectorAll("input[data-mention]").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
