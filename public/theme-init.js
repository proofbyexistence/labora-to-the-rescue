/* Pre-paint theme bootstrap loaded in <head> so the initial theme never flashes. */
(function () {
  var key = 'labora_theme_v1';
  var theme = 'light';
  try {
    var saved = window.localStorage.getItem(key);
    if (saved === 'dark' || saved === 'light') {
      theme = saved;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  } catch (e) {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
