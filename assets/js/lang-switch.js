(function() {
  var KEY = 'lpt_lang';
  var DEFAULT = 'zh';
  var supported = ['zh','fr','en'];

  // Auto-detect language from browser on first visit (no stored preference yet)
  function detect() {
    try {
      var langs = (navigator.languages && navigator.languages.length)
        ? navigator.languages
        : [navigator.language || navigator.userLanguage || ''];
      for (var i = 0; i < langs.length; i++) {
        var l = (langs[i] || '').toLowerCase();
        if (l.indexOf('zh') === 0) return 'zh';
        if (l.indexOf('fr') === 0) return 'fr';
        if (l.indexOf('en') === 0) return 'en';
      }
    } catch (e) {}
    return DEFAULT;
  }

  function apply(lang) {
    if (supported.indexOf(lang) < 0) lang = DEFAULT;
    document.documentElement.setAttribute('lang', lang);
    try { localStorage.setItem(KEY, lang); } catch(e) {}
    document.querySelectorAll('[data-lang-switch]').forEach(function(el){
      el.classList.toggle('is-active', el.getAttribute('data-lang-switch') === lang);
    });
  }

  var initial;
  try {
    initial = localStorage.getItem(KEY);
  } catch (e) { initial = null; }
  if (!initial) {
    initial = detect();
    try { localStorage.setItem(KEY, initial); } catch(e) {}
  }

  // Apply as early as possible
  apply(initial);

  document.addEventListener('DOMContentLoaded', function(){
    apply(initial);

    // Subtle nudge banner: if browser language differs from current setting,
    // suggest switching once. Auto-dismiss after 8s, persist dismissal.
    try {
      var browser = detect();
      var dismissed = localStorage.getItem('lpt_lang_nudged');
      if (browser !== initial && !dismissed) {
        showNudge(browser);
      }
    } catch (e) {}

    // Click handler — toggle, both for switcher buttons and the nudge banner buttons
    document.body.addEventListener('click', function(e){
      var btn = e.target.closest ? e.target.closest('[data-lang-switch]') : null;
      if (!btn) return;
      e.preventDefault();
      apply(btn.getAttribute('data-lang-switch'));
      hideNudge();
    });
  });

  function showNudge(lang) {
    var labels = {
      zh: { msg: '看起来您说中文 — 切换为中文版？', yes: '是的', no: '不用' },
      fr: { msg: 'On dirait que vous parlez français — passer en français ?', yes: 'Oui', no: 'Non' },
      en: { msg: 'Looks like you speak English — switch to English?', yes: 'Yes', no: 'No' }
    };
    var l = labels[lang]; if (!l) return;
    var bar = document.createElement('div');
    bar.className = 'lang-nudge';
    bar.innerHTML =
      '<span class="lang-nudge-msg">' + l.msg + '</span>' +
      '<button class="lang-nudge-btn primary" data-lang-switch="' + lang + '">' + l.yes + '</button>' +
      '<button class="lang-nudge-btn" data-lang-nudge-close>' + l.no + '</button>';
    document.body.appendChild(bar);
    requestAnimationFrame(function(){ bar.classList.add('is-visible'); });
    setTimeout(hideNudge, 12000);
    bar.querySelector('[data-lang-nudge-close]').addEventListener('click', hideNudge);
  }
  function hideNudge() {
    var bar = document.querySelector('.lang-nudge');
    if (!bar) return;
    bar.classList.remove('is-visible');
    setTimeout(function(){ if (bar.parentNode) bar.parentNode.removeChild(bar); }, 300);
    try { localStorage.setItem('lpt_lang_nudged', '1'); } catch(e) {}
  }
})();

/* ============================================================
   Karaoke text effect — characters light up as the user scrolls
   through the element. Looks for [data-karaoke] containers, splits
   their text into per-character spans and updates them on scroll.
   ============================================================ */
(function() {
  function splitCharSpans(node) {
    if (node.querySelector('.karaoke-char')) return;
    var text = node.textContent;
    node.textContent = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === ' ' || ch === '\n' || ch === '\t') {
        // Keep whitespace as plain text nodes so the browser can wrap on
        // them for FR / EN. CJK has no spaces — wrapping happens at any
        // char boundary thanks to the CSS rules below.
        frag.appendChild(document.createTextNode(' '));
      } else {
        var span = document.createElement('span');
        span.className = 'karaoke-char';
        span.textContent = ch;
        frag.appendChild(span);
      }
    }
    node.appendChild(frag);
  }

  function setupKaraoke(el) {
    el.querySelectorAll('[data-lang]').forEach(splitCharSpans);

    function update() {
      var rect = el.getBoundingClientRect();
      var winH = window.innerHeight;
      // Map element vertical position to a 0..1 progress.
      // Start lighting when the top of the element reaches 80% of the viewport
      // height, fully lit when it reaches 25%.
      var startY = winH * 0.80;
      var endY   = winH * 0.25;
      var progress = (startY - rect.top) / (startY - endY);
      progress = Math.max(0, Math.min(1, progress));

      var activeLang = document.documentElement.lang || 'zh';
      var activeSpan = el.querySelector('[data-lang="' + activeLang + '"]');
      if (!activeSpan) return;
      var chars = activeSpan.querySelectorAll('.karaoke-char');
      var litCount = Math.floor(progress * chars.length);
      for (var i = 0; i < chars.length; i++) {
        var lit = i < litCount;
        if (chars[i].classList.contains('is-lit') !== lit) {
          chars[i].classList.toggle('is-lit', lit);
        }
      }
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function(){
        update();
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // Re-process when language changes (so the newly-active span gets split too)
    document.body.addEventListener('click', function(e){
      if (e.target.closest && e.target.closest('[data-lang-switch]')) {
        setTimeout(function(){
          el.querySelectorAll('[data-lang]').forEach(splitCharSpans);
          update();
        }, 50);
      }
    });
    update();
  }

  function init() {
    document.querySelectorAll('[data-karaoke]').forEach(setupKaraoke);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ============================================================
   Testimonial slider — own controller (Webflow's was unreliable)
   ============================================================
   The Webflow slider script binds click handlers but they don't fire from
   our restyled arrows for reasons I couldn't pin down. Rather than fight
   the cascade, we drive the slider ourselves: on click, we shift each
   slide's translateX by the slide width and update aria-hidden. Webflow's
   own autoplay can keep running underneath; our manual nav cooperates by
   reading the current slide from aria-hidden each time. */
(function(){
  function getSlider(){
    return document.querySelector('.testimonial-home-section .slider.w-slider');
  }
  function getSlides(slider){
    return Array.from(slider.querySelectorAll('.w-slide'));
  }
  function getCurrentIdx(slides){
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].getAttribute('aria-hidden') !== 'true') return i;
    }
    return 0;
  }
  function advance(slider, direction){
    var slides = getSlides(slider);
    if (!slides.length) return;
    var n = slides.length;
    var current = getCurrentIdx(slides);
    var next = (current + direction + n) % n;
    // Compute slide width — use the mask width (visible window)
    var mask = slider.querySelector('.w-slider-mask');
    var slideWidth = mask ? mask.getBoundingClientRect().width : slides[0].getBoundingClientRect().width;
    // Apply transform + aria-hidden
    slides.forEach(function(s, i){
      var offset = (i - next) * slideWidth;
      s.style.transition = 'transform 600ms cubic-bezier(.645,.045,.355,1)';
      s.style.transform = 'translateX(' + offset + 'px)';
      s.setAttribute('aria-hidden', i === next ? 'false' : 'true');
      s.classList.toggle('w--current', i === next);
    });
  }
  function bind(){
    var slider = getSlider();
    if (!slider) return false;
    var arrows = slider.querySelectorAll('.w-slider-arrow-left, .w-slider-arrow-right');
    if (!arrows.length) return false;
    arrows.forEach(function(arrow){
      if (arrow.dataset.lptManual) return;
      arrow.dataset.lptManual = '1';
      var dir = arrow.classList.contains('w-slider-arrow-right') ? 1 : -1;
      arrow.addEventListener('click', function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        advance(slider, dir);
      }, true);
      arrow.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          advance(slider, dir);
        }
      });
    });
    // Ensure first slide has w--current on init so styles can target it
    var slides = getSlides(slider);
    if (slides.length && !slider.querySelector('.w-slide.w--current')) {
      var current = getCurrentIdx(slides);
      slides[current].classList.add('w--current');
    }
    return true;
  }
  function ready(){
    if (bind()) return;
    var tries = 0;
    var iv = setInterval(function(){
      if (bind() || ++tries > 50) clearInterval(iv);
    }, 200);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
