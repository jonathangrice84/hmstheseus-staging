(function () {
  if (!document.body) {
    return;
  }

  document.body.classList.add('site-enhanced');

  var script = document.currentScript;
  var scriptUrl = new URL(script && script.src ? script.src : 'site-enhancements.js', window.location.href);
  var siteRoot = scriptUrl.href.slice(0, scriptUrl.href.lastIndexOf('/') + 1);
  var navItems = [
    { label: 'Home', href: 'index.html' },
    { label: 'Guestbook', href: 'my_guestbook.htm' },
    { label: '1947 Tour', href: '1947_tour.htm' },
    { label: 'FAA', href: 'faa.htm' },
    { label: 'Links', href: 'links.htm' },
    { label: 'Contact', href: 'mailto:wgrice@blueyonder.co.uk' }
  ];

  function makeUrl(path) {
    return new URL(path, siteRoot).href;
  }

  function normalizePath(pathname) {
    return pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '').replace(/^$/, '/');
  }

  var currentPath = normalizePath(window.location.pathname);

  if (!document.getElementById('site-toolbar')) {
    var toolbar = document.createElement('div');
    toolbar.id = 'site-toolbar';
    toolbar.innerHTML = [
      '<div class="site-toolbar-inner">',
      '<p class="site-toolbar-title">HMS THESEUS ARCHIVE NAVIGATION</p>',
      '<nav class="site-toolbar-links" aria-label="Site navigation">',
      navItems.map(function (item) {
        var href = makeUrl(item.href);
        var isCurrent = normalizePath(new URL(href).pathname) === currentPath ? ' is-current' : '';
        return '<a class="site-toolbar-link' + isCurrent + '" href="' + href + '">' + item.label + '</a>';
      }).join(''),
      '</nav>',
      '</div>'
    ].join('');
    document.body.insertBefore(toolbar, document.body.firstChild);
  }

  if (!document.getElementById('site-footer')) {
    var footer = document.createElement('div');
    footer.id = 'site-footer';
    footer.innerHTML = [
      '<div class="site-footer-inner">',
      '<p>HMS Theseus archive and guestbook. Staging build.</p>',
      '</div>'
    ].join('');
    document.body.appendChild(footer);
  }
})();
