(function () {
  'use strict';

  var MEASUREMENT_ID = 'G-K4T0ST4DPB';

  (function () {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + MEASUREMENT_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID);
  })();

  var fired = {};
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    var pct = Math.round((window.scrollY / h) * 100);
    [25, 50, 75, 100].forEach(function (d) {
      if (pct >= d && !fired[d]) {
        fired[d] = true;
        gtag('event', 'scroll_depth', { depth: d });
      }
    });
  }, { passive: true });

  var orig = window.setLang;
  if (typeof orig === 'function') {
    window.setLang = function (lang) {
      orig(lang);
      gtag('event', 'language_switch', { language: lang });
    };
  }

  document.body.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    if (href.indexOf('basketindex-extension') !== -1 && href.endsWith('.zip')) {
      gtag('event', 'download_zip', { version: 'v0.2.0' });
      return;
    }

    if (href.indexOf('/assets/personal-inflation-analysis.md') !== -1) {
      gtag('event', 'download_prompt', { file_type: 'md' });
      return;
    }

    if (href.indexOf('github.com/stefanatanassov/basketindex') !== -1) {
      gtag('event', 'click_github', { url: href });
      return;
    }
  });
})();
