(function () {
  function initSectionToc() {
    var toc = document.getElementById('TOC');
    if (!toc) return;

    var rootList = toc.querySelector(':scope > ul > li > ul');
    if (!rootList) return;

    var links = Array.prototype.slice.call(toc.querySelectorAll('a.nav-link[href^="#"]'));
    var usableLinks = links.filter(function (link) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      return id && id !== 'interactive-analysis-of-maritime-activity-in-the-port-of-singapore-using-sentinel-1' && document.getElementById(id);
    });

    var targets = usableLinks.map(function (link) {
      var id = decodeURIComponent(link.getAttribute('href').slice(1));
      return {
        id: id,
        link: link,
        element: document.getElementById(id)
      };
    });

    function getTopSectionLi(link) {
      var node = link.closest('li');
      while (node && node.parentElement !== rootList) {
        node = node.parentElement && node.parentElement.closest('li');
      }
      return node;
    }

    function updateToc() {
      var marker = window.scrollY + Math.min(220, window.innerHeight * 0.32);
      var active = targets[0];

      targets.forEach(function (target) {
        var top = target.element.getBoundingClientRect().top + window.scrollY;
        if (top <= marker) active = target;
      });

      links.forEach(function (link) {
        link.classList.remove('active');
        link.classList.remove('active-section');
      });

      Array.prototype.forEach.call(rootList.children, function (li) {
        li.classList.remove('toc-section-active');
      });

      if (!active) return;

      active.link.classList.add('active');

      var sectionLi = getTopSectionLi(active.link);
      if (sectionLi) {
        sectionLi.classList.add('toc-section-active');
        var sectionLink = sectionLi.querySelector(':scope > a.nav-link');
        if (sectionLink) sectionLink.classList.add('active-section');
      }
    }

    var ticking = false;
    function scheduleUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        updateToc();
        ticking = false;
      });
    }

    updateToc();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.setTimeout(updateToc, 250);
  }

  function initDockedToc() {
    var dashboard = document.querySelector('.gee-app-frame');
    var sidebar = document.querySelector('#quarto-margin-sidebar');
    var toc = document.querySelector('#quarto-margin-sidebar nav#TOC');
    var tocTitle = document.querySelector('#quarto-margin-sidebar nav#TOC #toc-title');

    if (!dashboard || !sidebar || !toc || !tocTitle) return;

    function updateDockState() {
      var rect = dashboard.getBoundingClientRect();

      var dashboardIsActive =
        rect.top <= 120 &&
        rect.bottom > 120;

      if (dashboardIsActive) {
        document.body.classList.add('toc-docked');
      } else {
        document.body.classList.remove('toc-docked');
        document.body.classList.remove('toc-open');
      }
    }

    tocTitle.addEventListener('click', function (event) {
      if (document.body.classList.contains('toc-docked')) {
        event.preventDefault();
        event.stopPropagation();
        document.body.classList.toggle('toc-open');
      }
    });

    document.addEventListener('click', function (event) {
      if (
        document.body.classList.contains('toc-docked') &&
        document.body.classList.contains('toc-open') &&
        !toc.contains(event.target)
      ) {
        document.body.classList.remove('toc-open');
      }
    });

    window.addEventListener('scroll', updateDockState, { passive: true });
    window.addEventListener('resize', updateDockState);

    updateDockState();
  }

  function initAll() {
    initSectionToc();
    initDockedToc();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();