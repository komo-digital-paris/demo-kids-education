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
   Testimonial slider — document-level delegation (rock-solid)
   ============================================================
   Earlier per-arrow bindings were fragile: Webflow's slider script
   sometimes touches the DOM after our setup, and clicks on the SVG
   children inside the arrows didn't always reach our listener. We now
   listen on `document` itself in capture phase, then use closest() to
   find the arrow ancestor — this catches clicks on the arrow, the
   icon wrapper, the SVG, or the path. Capture phase + stopImmediate-
   Propagation ensures our handler is the SOLE responder. */
(function(){
  var SLIDER_SEL = '.testimonial-home-section .slider.w-slider';
  var ARROW_SEL  = '.testimonial-home-section .w-slider-arrow-left, '
                 + '.testimonial-home-section .w-slider-arrow-right';

  function getSlider(){ return document.querySelector(SLIDER_SEL); }
  function getSlides(slider){ return Array.from(slider.querySelectorAll('.w-slide')); }
  function getCurrentIdx(slides){
    for (var i = 0; i < slides.length; i++) {
      if (slides[i].getAttribute('aria-hidden') !== 'true') return i;
    }
    return 0;
  }
  // Slides are inline-block in normal flow inside the .w-slider-mask, so the
  // pitch between them is `slideWidth + horizontal padding/gap`, NOT just the
  // mask width. We need this pitch to translate every slide by the same amount
  // (shifting the whole strip) so slide N lands exactly on the anchor.
  // offsetLeft is the perfect tool: it returns the slide's natural offset from
  // its parent, ignoring any CSS transforms — so we never have to clear styles
  // and the value is stable across slider states.
  function getPitch(slides){
    if (slides.length < 2) return slides[0].getBoundingClientRect().width;
    return slides[1].offsetLeft - slides[0].offsetLeft;
  }
  function advance(direction){
    var slider = getSlider();
    if (!slider) { console.warn('[LPT carousel] no slider'); return; }
    var slides = getSlides(slider);
    if (!slides.length) { console.warn('[LPT carousel] no slides'); return; }
    var n = slides.length;
    var current = getCurrentIdx(slides);
    var next = (current + direction + n) % n;
    var pitch = getPitch(slides);
    // To bring slide `next` into the active spot we shift the whole strip
    // left by next*pitch — one transform value applied to every slide.
    var shift = -next * pitch;
    slides.forEach(function(s, i){
      var isCur = i === next;
      s.style.transition = 'transform 600ms cubic-bezier(.645,.045,.355,1), opacity 400ms ease';
      s.style.transform = 'translateX(' + shift + 'px)';
      // Active slide pops to full white card; the peeking ones fade so the
      // user immediately knows which one is "current".
      s.style.opacity = isCur ? '1' : '0.32';
      s.setAttribute('aria-hidden', isCur ? 'false' : 'true');
      s.classList.toggle('w--current', isCur);
    });
    console.log('[LPT carousel] advance', direction, '→ slide', next + 1, '/', n);
  }

  // WINDOW-level capture-phase delegation. Webflow's slider script binds a
   // capture-phase listener on `document` that calls stopPropagation, so any
   // listener at document or below gets blocked. By listening on `window`
   // (the very first node in the capture phase) we run BEFORE Webflow's
   // listener and catch the click no matter what it does afterwards.
   window.addEventListener('click', function(e){
    var arrow = e.target.closest && e.target.closest(ARROW_SEL);
    if (!arrow) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var dir = arrow.classList.contains('w-slider-arrow-right') ? 1 : -1;
    advance(dir);
  }, true);

  // Keyboard support — when arrow is focused, Enter / Space advances.
  document.addEventListener('keydown', function(e){
    var active = document.activeElement;
    var arrow = active && active.closest && active.closest(ARROW_SEL);
    if (!arrow) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      var dir = arrow.classList.contains('w-slider-arrow-right') ? 1 : -1;
      advance(dir);
    }
  });

  // Initialise the first slide so the styles + transforms are correct
  // even before the user touches anything.
  function initFirstSlide(){
    var slider = getSlider();
    if (!slider) return false;
    var slides = getSlides(slider);
    if (!slides.length) return false;
    var current = getCurrentIdx(slides);
    if (!slider.querySelector('.w-slide.w--current')) {
      slides[current].classList.add('w--current');
    }
    var pitch = getPitch(slides);
    var shift = -current * pitch;
    slides.forEach(function(s, i){
      s.style.transform = 'translateX(' + shift + 'px)';
      s.style.opacity = i === current ? '1' : '0.32';
    });
    return true;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirstSlide);
  } else {
    initFirstSlide();
  }
  window.addEventListener('load',   initFirstSlide);
  window.addEventListener('resize', initFirstSlide);
})();
