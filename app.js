(() => {
  // =========================
  // UTILS
  // =========================
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // =========================
  // NAVEGAÇÃO ENTRE SEÇÕES (SPA)
  // =========================
  function initNav() {
    const links  = $$('nav a');
    const secoes = $$('.conteudo-secao');

    const activate = (id) => {
      secoes.forEach((s) => s.classList.remove('active'));
      const alvo = document.getElementById(id);
      if (alvo) alvo.classList.add('active');
    };

    links.forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const id = a.getAttribute('href').replace(/^#/, '');
        activate(id);
        history.replaceState(null, '', `#${id}`);
      });
    });

    if (location.hash) {
      activate(location.hash.replace(/^#/, ''));
    } else if (secoes[0]) {
      secoes[0].classList.add('active');
    }
  }

  // =========================
  // CARROSSEL
  // =========================
  function initCarousel() {
    const slides = $$('.carrossel-slide');
    if (!slides.length) return;

    const prevBtn   = $('.prev-btn');
    const nextBtn   = $('.next-btn');
    const container = $('.carrossel') || $('.carrossel-container');
    const dotsWrap  = $('.dots-container');

    // cria dots conforme nº de slides
    let dots = $$('.dots-container .dot');
    if (dotsWrap && dots.length !== slides.length) {
      dotsWrap.innerHTML = '';
      for (let i = 0; i < slides.length; i++) {
        const b = document.createElement('button');
        b.className = 'dot';
        b.type = 'button';
        b.setAttribute('aria-label', `Ir para slide ${i + 1}`);
        dotsWrap.appendChild(b);
      }
      dots = $$('.dots-container .dot');
    }

    let index = 0;
    const show = (nextIndex) => {
      const n = (nextIndex + slides.length) % slides.length;
      slides.forEach((s) => s.classList.remove('active'));
      dots.forEach((d) => d.classList.remove('active'));
      slides[n].classList.add('active');
      dots[n]?.classList.add('active');
      index = n;
    };

    prevBtn?.addEventListener('click', () => show(index - 1));
    nextBtn?.addEventListener('click', () => show(index + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => show(i)));

    // teclado
    (container || document).addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft')  show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    // swipe (mobile)
    let startX = null;
    const threshold = 30;
    (container || document).addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    });
    (container || document).addEventListener('touchend', (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (dx >  threshold) show(index - 1);
      if (dx < -threshold) show(index + 1);
      startX = null;
    });

    show(0);
  }

  // =========================
  // CONTADOR REGRESSIVO (multi-bloco)
  // =========================
  function initCountdown(){
    const FALLBACK_ISO = "2025-09-20T19:00:00-03:00";

    document.querySelectorAll(".contador").forEach((cont) => {
      const raw    = cont.getAttribute("data-evento") || FALLBACK_ISO;
      const target = new Date(raw).getTime();

      const h3  = cont.querySelector("h3");
      const box = cont.querySelector(".contador-numeros");

      const dEl = cont.querySelector('[data-ct="dias"], .ct-dias, #dias');
      const hEl = cont.querySelector('[data-ct="horas"], .ct-horas, #horas');
      const mEl = cont.querySelector('[data-ct="minutos"], .ct-minutos, #minutos');
      const sEl = cont.querySelector('[data-ct="segundos"], .ct-segundos, #segundos');

      if (!dEl || !hEl || !mEl || !sEl) return;

      const tick = () => {
        const now = Date.now();
        const dist = target - now;

        if (Number.isNaN(target)) {
          if (h3) h3.textContent = "Data inválida";
          return;
        }
        if (dist <= 0) {
          if (h3) h3.textContent = "A festa começou!";
          if (box) box.innerHTML = "";
          clearInterval(timer);
          return;
        }

        const dias     = Math.floor(dist / (1000 * 60 * 60 * 24));
        const horas    = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos  = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((dist % (1000 * 60)) / 1000);

        dEl.textContent = String(dias).padStart(2, "0");
        hEl.textContent = String(horas).padStart(2, "0");
        mEl.textContent = String(minutos).padStart(2, "0");
        sEl.textContent = String(segundos).padStart(2, "0");
      };

      tick();
      const timer = setInterval(tick, 1000);
    });
  }

  // =========================
  // TOGGLE do Google Forms (Home e Detalhes)
  // =========================
  function initFormsToggle() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-form-toggle]');
      if (!btn) return;

      const id   = btn.getAttribute('data-form-toggle');
      const wrap = document.querySelector(`[data-form-wrap="${id}"]`);
      if (!wrap) return;

      const abrir = !wrap.classList.contains('is-open');
      wrap.classList.toggle('is-open', abrir);
      wrap.classList.toggle('is-collapsed', !abrir);
      wrap.setAttribute('aria-hidden', String(!abrir));
      btn.setAttribute('aria-expanded', String(abrir));
      btn.textContent = abrir ? 'Ocultar formulário' : 'Confirmar Presença';
      if (abrir) wrap.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  }

  // =========================
  // BOOT
  // =========================
  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initCarousel();
    initCountdown();
    initFormsToggle();
  });
})();

// =========================
// MODAL do QR Code (isolado)
// =========================
(function () {
  const modal = document.getElementById('qr-modal');
  if (!modal) return;

  const openers  = Array.from(document.querySelectorAll('.qr-open, .qr-card .qr-code'));
  const closeBtn = modal.querySelector('.qr-close');
  let lastFocus = null;

  const open = () => {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    closeBtn?.focus();
  };

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  };

  openers.forEach(el => el.addEventListener('click', open));
  closeBtn?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (!modal.hidden && e.key === 'Escape') close(); });
})();


// Borboletas
(function () {
  const sky = document.getElementById('butterfly-sky');
  if (!sky) return;

   if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let onScreen = 0;
  const MAX = 15;          
  const INTERVAL = 1200;   

  function spawn() {
    if (onScreen >= MAX) return;

    const el = document.createElement('div');
    el.className = 'bf';

    const wings = document.createElement('div');
    wings.className = 'wings';
    el.appendChild(wings);

    // randomiza tamanho posição e duração
    const size = Math.round(22 + Math.random() * 20);           
    const left = Math.round(Math.random() * 100);                 
    const drift = (Math.random() * 80 - 40).toFixed(1) + 'vw';    
    const dur = (10 + Math.random() * 8).toFixed(1) + 's';        

    el.style.left = left + 'vw';
    el.style.setProperty('--size', size + 'px');
    el.style.setProperty('--drift', drift);
    el.style.setProperty('--dur', dur);
    el.style.animationDelay = (Math.random() * 0.8).toFixed(2) + 's';

    sky.appendChild(el);
    onScreen++;

    el.addEventListener('animationend', () => {
      el.remove();
      onScreen--;
    });
  }

  for (let i = 0; i < 4; i++) setTimeout(spawn, i * 350);

    setInterval(spawn, INTERVAL);
})();

