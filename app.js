(() => {
  'use strict';
  const root = document.documentElement;
  const mobile = root.classList.contains('mobile');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lowPower = navigator.connection?.saveData || (navigator.hardwareConcurrency || 8) <= 4;
  const select = (selector, scope = document) => scope.querySelector(selector);
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const clamp = (value, max = 1) => Math.min(max, Math.max(0, value));
  const scrollBehavior = reduced ? 'instant' : 'smooth';

  function startIntro() {
    if (!root.classList.contains('show-intro')) return;
    try { sessionStorage.setItem('vih-cinema-intro', 'complete'); } catch {}
    const count = select('[data-loader-count]');
    if (reduced) {
      setTimeout(() => root.classList.remove('show-intro'), 250);
      return;
    }
    const start = performance.now();
    function draw(now) {
      const percent = Math.round(clamp((now - start) / 1500) * 100);
      count.textContent = percent + '%';
      if (percent < 100) requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
    setTimeout(() => root.classList.remove('show-intro'), 2000);
  }

  function startOrder() {
    const catalog = [
      { id: 'pote', name: 'Bolo no pote' },
      { id: 'brigadeiros', name: 'Brigadeiros' },
      { id: 'festa', name: 'Bolo festivo' }
    ];
    const key = 'vih-cinema-order';
    let saved = {};
    try { saved = JSON.parse(sessionStorage.getItem(key)) || {}; } catch {}
    const quantities = Object.fromEntries(catalog.map(({ id }) => [id, clamp(Math.floor(Number(saved[id])) || 0, 99)]));
    const choices = select('[data-choices]');
    const summary = select('[data-summary]');
    const message = select('[data-message]');
    const send = select('[data-send]');
    const copy = select('[data-copy]');
    const status = select('[data-copy-status]');
    const controls = new Map();

    for (const { id, name } of catalog) {
      const row = document.createElement('div');
      row.className = 'choice';
      row.innerHTML = `<span>${name}</span><div class="stepper" role="group" aria-label="${name}"><button type="button" aria-label="Remover um: ${name}" data-evt="decrease_${id}">−</button><output aria-label="Quantidade de ${name}"></output><button type="button" aria-label="Adicionar um: ${name}" data-evt="increase_${id}">+</button></div>`;
      const [minus, plus] = all('button', row);
      minus.addEventListener('click', () => change(id, -1));
      plus.addEventListener('click', () => change(id, 1));
      controls.set(id, { minus, plus, output: select('output', row) });
      choices.append(row);
    }

    function render() {
      const selected = catalog.filter(({ id }) => quantities[id] > 0);
      const total = selected.reduce((sum, { id }) => sum + quantities[id], 0);
      const lines = selected.map(({ id, name }) => `${quantities[id]} × ${name}`);
      for (const [id, { minus, plus, output }] of controls) {
        output.value = quantities[id];
        minus.disabled = quantities[id] === 0;
        plus.disabled = quantities[id] === 99;
      }
      for (const badge of all('[data-box-count]')) badge.textContent = total;
      summary.textContent = lines.length ? lines.join(' · ') : 'Sua caixa está vazia.';
      message.value = lines.length
        ? `Olá, Vih Cakees! Gostaria de consultar valores e disponibilidade para:\n\n${lines.join('\n')}\n\nPodem me ajudar com a encomenda?`
        : 'Olá, Vih Cakees! Gostaria de saber mais sobre as encomendas.';
      if (/^\d{8,15}$/.test(send.dataset.whatsapp || '')) {
        send.href = 'https://wa.me/' + send.dataset.whatsapp + '?text=' + encodeURIComponent(message.value);
        send.textContent = 'Abrir WhatsApp';
      }
    }

    function change(id, amount) {
      quantities[id] = clamp(quantities[id] + amount, 99);
      try { sessionStorage.setItem(key, JSON.stringify(quantities)); } catch {}
      status.textContent = 'Copie o texto e cole na conversa do Instagram.';
      render();
    }

    for (const link of all('[data-add]')) link.addEventListener('click', () => change(link.dataset.add, 1));
    copy.hidden = false;
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(message.value);
        status.textContent = 'Mensagem copiada. Abra a DM e cole o texto.';
      } catch {
        message.focus();
        message.select();
        status.textContent = 'Texto selecionado. Use a opção Copiar do seu dispositivo.';
      }
    });
    render();
  }

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger && !reduced) gsap.registerPlugin(ScrollTrigger);

  function startCarousel() {
    const section = select('.products');
    const viewport = select('.carousel', section);
    const track = select('.track', section);
    const slides = all('.product', section);
    const meter = select('.carousel-meter span', section);
    let trigger;
    let index = 0;
    const distance = () => Math.max(1, track.scrollWidth - viewport.clientWidth);
    const update = progress => { meter.style.transform = `scaleX(${clamp(progress)})`; };
    const slideOffsets = () => slides.map(slide => Math.min(distance(), slide.offsetLeft - slides[0].offsetLeft));

    if (!mobile && !reduced && gsap && ScrollTrigger) {
      const desktop = gsap.matchMedia();
      desktop.add('(min-width: 1024px) and (min-height: 650px)', () => {
        section.classList.add('pin-carousel');
        viewport.scrollLeft = 0;
        const tween = gsap.to(track, {
          x: () => -distance(), ease: 'none',
          scrollTrigger: {
            trigger: section, start: 'top top', end: () => '+=' + Math.max(420, distance() * 1.65),
            pin: true, scrub: true, invalidateOnRefresh: true,
            onUpdate: self => update(self.progress)
          }
        });
        trigger = tween.scrollTrigger;
        return () => {
          trigger = undefined;
          section.classList.remove('pin-carousel');
          update(0);
        };
      });
    }

    function jump(target) {
      index = clamp(target, slides.length - 1);
      const left = slideOffsets()[index];
      if (trigger) {
        window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * left / distance(), behavior: scrollBehavior });
      } else {
        viewport.scrollTo({ left, behavior: scrollBehavior });
      }
    }

    function next(direction) {
      const left = trigger ? trigger.progress * distance() : viewport.scrollLeft;
      const offsets = slideOffsets();
      const candidates = offsets.map((offset, i) => ({ offset, i }));
      const target = direction > 0
        ? candidates.find(({ offset }) => offset > left + 3)
        : candidates.reverse().find(({ offset }) => offset < left - 3);
      if (target) jump(target.i);
    }

    select('[data-prev]', section).addEventListener('click', () => next(-1));
    select('[data-next]', section).addEventListener('click', () => next(1));
    viewport.addEventListener('scroll', () => { if (!trigger) update(viewport.scrollLeft / distance()); }, { passive: true });
    viewport.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home' || event.key === 'End') jump(event.key === 'Home' ? 0 : slides.length - 1);
      else next(event.key === 'ArrowRight' ? 1 : -1);
    });
    viewport.addEventListener('focusin', event => {
      const slide = event.target.closest('.product');
      if (trigger && slide) {
        viewport.scrollLeft = 0;
        jump(slides.indexOf(slide));
      }
    });

    if (!fine || reduced || mobile) return;
    const cursor = select('.drag-cursor');
    let drag;
    viewport.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('a,button')) return;
      drag = { x: event.clientX, left: viewport.scrollLeft, y: window.scrollY };
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      cursor.classList.toggle('active', Boolean(drag) || !event.target.closest('a,button'));
      cursor.style.transform = `translate3d(${event.clientX - 36}px,${event.clientY - 36}px,0)`;
      const slide = event.target.closest('.product');
      if (drag) {
        const delta = drag.x - event.clientX;
        if (trigger?.isActive) window.scrollTo({ top: drag.y + delta * (trigger.end - trigger.start) / distance(), behavior: 'instant' });
        else if (!trigger) viewport.scrollLeft = drag.left + delta;
      } else if (slide) {
        const rect = slide.getBoundingClientRect();
        slide.style.setProperty('--tilt-x', (0.5 - (event.clientY - rect.top) / rect.height) * 7 + 'deg');
        slide.style.setProperty('--tilt-y', ((event.clientX - rect.left) / rect.width - 0.5) * 7 + 'deg');
      }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => viewport.addEventListener(type, () => { drag = undefined; }));
    viewport.addEventListener('pointerleave', () => cursor.classList.remove('active'));
    slides.forEach(slide => slide.addEventListener('pointerleave', () => {
      slide.style.removeProperty('--tilt-x');
      slide.style.removeProperty('--tilt-y');
    }));
  }

  function startScenes() {
    if (reduced) return null;
    const title = select('[data-split]');
    const sentence = title.textContent.trim();
    title.setAttribute('aria-label', sentence);
    title.replaceChildren(...sentence.split(/\s+/).flatMap((word, index) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.setAttribute('aria-hidden', 'true');
      return index ? [' ', span] : [span];
    }));
    const words = all('span', title);
    if (!gsap || !ScrollTrigger) {
      title.classList.add('native-words');
      return () => {
        const bounds = title.getBoundingClientRect();
        const progress = clamp((innerHeight * .85 - bounds.top) / (innerHeight * .38));
        words.forEach((word, index) => word.style.setProperty('--word-opacity', .36 + .64 * clamp(progress * (words.length + 2) - index)));
      };
    }
    gsap.from(words, {
      opacity: .36, yPercent: 10, stagger: .13,
      scrollTrigger: { trigger: title, start: 'top 86%', end: 'bottom 42%', scrub: true }
    });
    if (!mobile) {
      gsap.matchMedia().add('(min-width: 1024px) and (min-height: 650px)', () => {
        ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: '+=48%', pin: '.hero-stage' });
      });
    }
    return null;
  }

  function startProcess() {
    const section = select('.process');
    const canvas = select('.process-canvas', section);
    const cues = all('.process-cues li', section);
    const context = canvas.getContext('2d');
    if (reduced || !context) return () => {};
    let frames;
    let last = -1;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      frames = cues.map(cue => {
        const frame = new Image();
        frame.onload = () => { last = -1; schedule(); };
        frame.src = cue.dataset.src;
        return frame;
      });
    }, { rootMargin: '300px 0px' });
    observer.observe(section);

    return () => {
      if (!frames) return;
      const bounds = section.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) return;
      const progress = clamp((innerHeight - bounds.top - innerHeight * .22) / (bounds.height + innerHeight * .28));
      const index = Math.min(frames.length - 1, Math.floor(progress * frames.length * 1.12));
      const frame = frames[index];
      if (index === last || !frame.naturalWidth) return;
      last = index;
      const size = canvas.width;
      const scale = Math.max(size / frame.naturalWidth, size / frame.naturalHeight);
      const width = frame.naturalWidth * scale;
      const height = frame.naturalHeight * scale;
      context.drawImage(frame, (size - width) / 2, (size - height) / 2, width, height);
      canvas.classList.add('ready');
      cues[0].parentElement.classList.add('scrubbed');
      cues.forEach((cue, i) => cue.classList.toggle('active', i === index));
    };
  }

  function startParticles() {
    const stage = select('.hero-stage');
    const canvas = select('.particles', stage);
    const context = canvas.getContext('2d');
    if (reduced || !context) return;
    const points = Array.from({ length: mobile || lowPower ? 16 : 52 }, () => ({
      x: Math.random(), y: Math.random(), depth: Math.random(), phase: Math.random() * Math.PI * 2
    }));
    let width = 1, height = 1, visible = false, animation = 0, paused = false;
    const art = select('.hero-art', stage);
    const pieces = all('.pieces img', stage);
    const drifters = pieces.map((piece, index) => piece.animate([
      { translate: '0 0', rotate: '0deg' }, { translate: '0 -12px', rotate: '8deg' }
    ], { duration: 3600 + index * 410, delay: -index * 260, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    new ResizeObserver(resize).observe(stage);
    let pointerX = 0, pointerY = 0;
    if (fine && !mobile) {
      stage.addEventListener('pointermove', event => {
        pointerX = (event.clientX / innerWidth - .5) * 26;
        pointerY = (event.clientY / innerHeight - .5) * 24;
      }, { passive: true });
      stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
    }
    function draw(now) {
      if (!visible || paused || document.hidden) { animation = 0; return; }
      const time = now * .001;
      const scrollY = Math.min(window.scrollY, height) * -.042;
      art.style.setProperty('--art-x', pointerX + 'px');
      art.style.setProperty('--art-y', pointerY + scrollY + 'px');
      context.clearRect(0, 0, width, height);
      for (const point of points) {
        const x = point.x * width + Math.sin(time + point.phase) * 9;
        const y = ((point.y - time * (.011 + point.depth * .012)) % 1 + 1) % 1 * height;
        context.globalAlpha = .15 + point.depth * .5;
        context.fillStyle = '#ffd09b';
        context.beginPath();
        context.arc(x, y, .5 + point.depth * 1.15, 0, Math.PI * 2);
        context.fill();
      }
      animation = requestAnimationFrame(draw);
    }
    function sync() {
      const running = visible && !paused && !document.hidden;
      drifters.forEach(drift => running ? drift.play() : drift.pause());
      if (running && !animation) animation = requestAnimationFrame(draw);
      if (!running && animation) { cancelAnimationFrame(animation); animation = 0; }
    }
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(stage);
    document.addEventListener('visibilitychange', sync);
    const toggle = select('[data-motion]', stage);
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      paused = !paused;
      toggle.setAttribute('aria-pressed', String(paused));
      sync();
      if (paused) context.clearRect(0, 0, width, height);
    });
    sync();
  }

  function manageMedia() {
    const observer = new IntersectionObserver(entries => entries.forEach(({ target, isIntersecting }) => {
      if (target.tagName === 'VIDEO') {
        if (isIntersecting && !reduced && !lowPower) {
          if (!target.getAttribute('src') && target.dataset.src) target.src = target.dataset.src;
          target.play().catch(() => {});
        } else target.pause();
      } else if (isIntersecting) {
        if (target.getAttribute('src') !== target.dataset.src) target.src = target.dataset.src;
        observer.unobserve(target);
      }
    }), { rootMargin: '150px 0px' });
    all('img[data-src], video').forEach(element => observer.observe(element));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) all('video').forEach(video => video.pause());
    });
  }

  const progress = select('.page-progress span');
  const box = select('#caixa');
  const updateProcess = startProcess();
  const revealWords = startScenes();
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const value = window.scrollY;
      const boxRect = box.getBoundingClientRect();
      root.classList.toggle('scrolled', value > 60);
      root.classList.toggle('at-start', !mobile && value < innerHeight * .6);
      root.classList.toggle('is-order', boxRect.top < innerHeight * .65 && boxRect.bottom > innerHeight * .3);
      progress.style.transform = `scaleX(${clamp(value / Math.max(1, root.scrollHeight - innerHeight))})`;
      revealWords?.();
      updateProcess();
    });
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  if (fine && !mobile && !reduced) for (const button of all('.magnet')) {
    button.addEventListener('pointermove', event => {
      const bounds = button.getBoundingClientRect();
      button.style.transform = `translate(${(event.clientX - bounds.left - bounds.width / 2) * .14}px,${(event.clientY - bounds.top - bounds.height / 2) * .19}px)`;
    });
    button.addEventListener('pointerleave', () => { button.style.transform = ''; });
  }

  startIntro();
  startOrder();
  startCarousel();
  startParticles();
  manageMedia();
  schedule();
})();
