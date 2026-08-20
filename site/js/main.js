(function () {
  "use strict";

  /* ---------------- Mobile nav ---------------- */
  var nav = document.querySelector(".nav");
  var burger = document.querySelector(".nav-burger");

  burger.addEventListener("click", function () {
    var open = nav.classList.toggle("nav-open");
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  });

  document.querySelectorAll(".nav-drawer a").forEach(function (link) {
    link.addEventListener("click", function () {
      nav.classList.remove("nav-open");
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    });
  });

  /* ---------------- Services tabs ---------------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".services-tab"));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute("aria-controls")); });
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var switchTimer = null;

  function showPanel(panel) {
    panels.forEach(function (p) {
      if (!p) return;
      p.classList.remove("leaving");
      p.hidden = p !== panel;
    });
  }

  function selectTab(tab) {
    var next = document.getElementById(tab.getAttribute("aria-controls"));
    tabs.forEach(function (t) {
      var active = t === tab;
      t.setAttribute("aria-selected", String(active));
      t.tabIndex = active ? 0 : -1;
    });
    var current = panels.filter(function (p) { return p && !p.hidden; })[0];
    if (current === next) return;
    /* ease the old panel out before the new one rises in */
    if (!current || reducedMotion.matches) {
      showPanel(next);
      return;
    }
    if (switchTimer) clearTimeout(switchTimer);
    current.classList.add("leaving");
    switchTimer = setTimeout(function () {
      switchTimer = null;
      showPanel(next);
    }, 160); /* must match the .services-panel.leaving duration */
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { selectTab(tab); });
    tab.addEventListener("keydown", function (e) {
      var next;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) {
        e.preventDefault();
        next.focus();
        selectTab(next);
      }
    });
  });

  /* ---------------- FAQ accordion ---------------- */
  var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-item"));
  var expandAll = document.querySelector(".faq-expand");

  function animatePanel(panel, open) {
    /* height-animated open/close; falls back to instant toggling */
    if (reducedMotion.matches) {
      panel.hidden = !open;
      return;
    }
    if (panel._onEnd) {
      panel.removeEventListener("transitionend", panel._onEnd);
      panel._onEnd = null;
    }
    if (panel._endTimer) {
      clearTimeout(panel._endTimer);
      panel._endTimer = null;
    }

    var finish = function () {
      panel.removeEventListener("transitionend", onEnd);
      panel._onEnd = null;
      if (panel._endTimer) { clearTimeout(panel._endTimer); panel._endTimer = null; }
      panel.classList.remove("anim");
      if (!open) panel.hidden = true;
      panel.style.height = "";
      panel.style.opacity = "";
    };
    var onEnd = function (e) {
      if (e.propertyName !== "height") return;
      finish();
    };
    if (open) {
      if (!panel.hidden && !panel.classList.contains("anim")) return; // already open
      panel.hidden = false;
      var target = panel.scrollHeight;
      panel.style.height = "0px";
      panel.style.opacity = "0";
      panel.getBoundingClientRect(); // flush so the transition has a start value
      panel.classList.add("anim");
      panel.style.height = target + "px";
      panel.style.opacity = "1";
    } else {
      if (panel.hidden) return;
      panel.style.height = panel.scrollHeight + "px";
      panel.getBoundingClientRect();
      panel.classList.add("anim");
      panel.style.height = "0px";
      panel.style.opacity = "0";
    }
    panel._onEnd = onEnd;
    panel.addEventListener("transitionend", onEnd);
    /* transitionend never arrives if the tab is backgrounded part-way through,
       which would strand the panel mid-height with .anim still on it */
    panel._endTimer = setTimeout(finish, 600); /* .faq-a.anim is 320ms */
  }

  function setItem(item, open, delay) {
    var btn = item.querySelector(".faq-q");
    var panel = item.querySelector(".faq-a");
    /* state flips straight away; only the height animation is staggered, so
       aria and "Expand all" stay truthful the moment the button is pressed */
    item.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    if (delay) {
      if (item._faqTimer) clearTimeout(item._faqTimer);
      item._faqTimer = setTimeout(function () {
        item._faqTimer = null;
        animatePanel(panel, open);
      }, delay);
    } else {
      if (item._faqTimer) { clearTimeout(item._faqTimer); item._faqTimer = null; }
      animatePanel(panel, open);
    }
  }

  function syncExpandAll() {
    var allOpen = faqItems.every(function (item) { return item.classList.contains("open"); });
    expandAll.textContent = allOpen ? "Collapse all" : "Expand all";
    expandAll.setAttribute("aria-pressed", String(allOpen));
  }

  faqItems.forEach(function (item) {
    item.querySelector(".faq-q").addEventListener("click", function () {
      setItem(item, !item.classList.contains("open"));
      syncExpandAll();
    });
  });

  expandAll.addEventListener("click", function () {
    var allOpen = faqItems.every(function (item) { return item.classList.contains("open"); });
    var stagger = reducedMotion.matches ? 0 : 45;
    faqItems.forEach(function (item, i) {
      /* opening ripples down the list; collapsing is instant so the page
         doesn't shuffle under the reader eight separate times */
      setItem(item, !allOpen, allOpen ? 0 : i * stagger);
    });
    syncExpandAll();
  });

  /* ---------------- Trust marquee pause ---------------- */
  var trust = document.querySelector(".trust");
  var pauseBtn = document.querySelector(".trust-pause");

  if (pauseBtn) {
    pauseBtn.addEventListener("click", function () {
      var paused = trust.classList.toggle("paused");
      pauseBtn.setAttribute("aria-pressed", String(paused));
      pauseBtn.setAttribute("aria-label", paused ? "Play logo animation" : "Pause logo animation");
      pauseBtn.querySelector(".icon-pause").style.display = paused ? "none" : "";
      pauseBtn.querySelector(".icon-play").style.display = paused ? "" : "none";
    });
  }

  /* ---------------- Stat count-up ---------------- */
  function runCounters(root, delay) {
    var targets = root.matches("[data-count]")
      ? [root]
      : Array.prototype.slice.call(root.querySelectorAll("[data-count]"));

    targets.forEach(function (el) {
      if (el._counted) return;
      el._counted = true;

      var target = parseFloat(el.getAttribute("data-count"));
      var suffix = el.getAttribute("data-suffix") || "";
      var settle = function () { el.textContent = target + suffix; };

      if (isNaN(target)) return;
      if (reducedMotion.matches || document.hidden) {
        /* a hidden tab gets no animation frames -- show the real number */
        settle();
        return;
      }

      var start = null;
      var dur = 1100;
      var done = false;
      function step(ts) {
        if (done) return;
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
        else done = true;
      }
      setTimeout(function () { requestAnimationFrame(step); }, (delay || 0) + 120);
      /* never leave a throttled or backgrounded tab showing a stale 0 */
      setTimeout(function () {
        if (done) return;
        done = true;
        settle();
      }, (delay || 0) + dur + 900);
    });
  }

  /* ---------------- Reveal on scroll ---------------- */
  /* The delay lands on a --d custom property rather than transition-delay so
     descendants (chart marks, ripple rings, list rows) can offset from it
     with calc() and stay in step with their parent. */
  var revealEls = document.querySelectorAll(".reveal");

  function reveal(el, delay) {
    el.style.setProperty("--d", delay + "ms");
    el.classList.add("in");
    runCounters(el, delay);

    var settle = function () {
      el.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
      el.classList.add("settled");
    };
    function onEnd(e) {
      if (e.target !== el) return; /* ignore bubbling from staggered children */
      settle();
    }
    el.addEventListener("transitionend", onEnd);
    /* backstop, same reason as the accordion: a backgrounded tab delivers no
       transitionend, and .settled is what arms the hover states */
    var timer = setTimeout(settle, delay + 1400);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      /* stagger elements that arrive in the same batch, in DOM order */
      var visible = entries
        .filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) {
          return a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });
      visible.forEach(function (entry, i) {
        reveal(entry.target, Math.min(i * 80, 400));
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { reveal(el, 0); el.classList.add("settled"); });
  }

  /* ---------------- Bell curve draw-on ---------------- */
  /* Feed the path its real length so the dash trick works at any viewBox. */
  var curve = document.querySelector(".win-chart .chart-curve");
  if (curve && typeof curve.getTotalLength === "function") {
    try { curve.style.setProperty("--len", curve.getTotalLength()); } catch (err) { /* no layout yet */ }
  }

  /* ---------------- Nav elevation on scroll ---------------- */
  var navTicking = false;
  function syncNavShadow() {
    navTicking = false;
    nav.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", function () {
    if (navTicking) return;
    navTicking = true;
    requestAnimationFrame(syncNavShadow);
  }, { passive: true });
  syncNavShadow();

  /* ---------------- Idle animations: stop when off-screen ---------------- */
  var heroVideo = document.querySelector(".hero-art-video video");

  if (heroVideo && reducedMotion.matches) {
    heroVideo.removeAttribute("autoplay");
    heroVideo.pause();
  }

  if ("IntersectionObserver" in window) {
    if (trust) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { trust.classList.toggle("offscreen", !e.isIntersecting); });
      }, { threshold: 0 }).observe(trust);
    }

    if (heroVideo && !reducedMotion.matches) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var p = heroVideo.play();
            if (p && p.catch) p.catch(function () { /* autoplay blocked */ });
          } else {
            heroVideo.pause();
          }
        });
      }, { threshold: 0.05 }).observe(heroVideo);
    }
  }

  /* ---------------- Footer year ---------------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
