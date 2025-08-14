(() => {
  // =========================
  // CONFIG
  // =========================
  const BASE_API_URL = `${location.origin}/api/recados`;
  const MAX_NOME = 80;
  const MAX_MSG = 1000;

  // =========================
  // UTILS
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const setStatus = (el, msg, type = 'info') => {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('ok', 'erro', 'info');
    el.classList.add(type);
  };

  const brDateTime = (iso) =>
    new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  // fetch com timeout para evitar request “pendurado”
  function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options; // 10s
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(resource, { ...options, signal: controller.signal }).finally(() =>
      clearTimeout(id)
    );
  }

  // =========================
  // NAVEGAÇÃO ENTRE SEÇÕES
  // =========================
  function initNav() {
    const links = $$('nav a');
    const secoes = $$('.conteudo-secao');

    const activate = (id) => {
      secoes.forEach((s) => s.classList.remove('active'));
      const alvo = document.getElementById(id);
      if (alvo) alvo.classList.add('active');
      if (id === 'recados') recados.load();
    };

    links.forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const id = a.getAttribute('href').replace(/^#/, '');
        activate(id);
        history.replaceState(null, '', `#${id}`);
      })
    );

    if (location.hash) {
      activate(location.hash.replace(/^#/, ''));
    } else if (secoes[0]) {
      secoes[0].classList.add('active');
    }
  }

  // =========================
  // RECADOS (API)
  // =========================
  const recados = (() => {
    const listEl = $('#lista-recados');
    const form = $('#form-recados');
    const statusEl = $('#status-recado');
    const nomeEl = $('#nome-recado');
    const msgEl = $('#mensagem-recado');

    const validate = (nome, mensagem) => {
      const n = (nome || '').trim();
      const m = (mensagem || '').trim();
      if (!n) return 'Informe seu nome.';
      if (n.length > MAX_NOME) return `Nome muito longo (máx. ${MAX_NOME}).`;
      if (!m) return 'Escreva uma mensagem.';
      if (m.length > MAX_MSG) return `Mensagem muito longa (máx. ${MAX_MSG}).`;
      return null;
    };

    const renderLoading = () => {
      if (!listEl) return;
      listEl.innerHTML = '';
      const d = document.createElement('div');
      d.className = 'lista-loading';
      d.textContent = 'Carregando recados...';
      listEl.appendChild(d);
    };

    const renderEmpty = () => {
      if (!listEl) return;
      listEl.innerHTML = '';
      const d = document.createElement('div');
      d.className = 'lista-vazia';
      d.textContent = 'Nenhum recado ainda.';
      listEl.appendChild(d);
    };

    const renderList = (items) => {
      if (!listEl) return;
      listEl.innerHTML = '';

      if (!items || !items.length) {
        renderEmpty();
        return;
      }

      const ordered = [...items].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      for (const r of ordered) {
        const card = document.createElement('div');
        card.className = 'recado bubble';
        if (r?.id) card.dataset.id = r.id; // para deletar depois

        const header = document.createElement('div');
        header.className = 'recado-header';

        const h4 = document.createElement('h4');
        h4.textContent = r?.nome ?? 'Convidado';

        // botão apagar (só mostra se tiver id)
        let delBtn = null;
        if (r?.id) {
          delBtn = document.createElement('button');
          delBtn.className = 'recado-del';
          delBtn.type = 'button';
          delBtn.title = 'Apagar comentário';
          delBtn.setAttribute('aria-label', 'Apagar comentário');
          delBtn.textContent = '🗑️';
        }

        header.append(h4);
        if (delBtn) header.append(delBtn);

        const p = document.createElement('p');
        p.textContent = r?.mensagem ?? '';

        const small = document.createElement('small');
        small.textContent = brDateTime(r?.timestamp ?? Date.now());

        card.append(header, p, small);
        listEl.appendChild(card);
      }
    };

    async function load() {
      if (!listEl) return;
      renderLoading();
      try {
        const resp = await fetchWithTimeout(BASE_API_URL, { timeout: 10000 });
        if (!resp.ok) throw new Error(`Falha ao buscar (${resp.status})`);
        const data = await resp.json();
        renderList(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('GET /api/recados erro:', e);
        if (listEl) listEl.textContent = 'Erro ao carregar recados. Tente novamente.';
      }
    }

    async function submit(e) {
      e.preventDefault();
      if (!form) return;

      const nome = nomeEl?.value ?? '';
      const mensagem = msgEl?.value ?? '';
      const err = validate(nome, mensagem);
      if (err) {
        setStatus(statusEl, err, 'erro');
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      setStatus(statusEl, 'Enviando recado...', 'info');
      btn?.setAttribute('disabled', 'true');

      // UI otimista (opcional)
      let optimisticCard = null;
      if (listEl) {
        optimisticCard = document.createElement('div');
        optimisticCard.className = 'recado bubble recado--pending';
        const h4 = document.createElement('h4');
        const head = document.createElement('div');
        head.className = 'recado-header';
        h4.textContent = nome.trim();
        head.append(h4);
        const p = document.createElement('p');
        p.textContent = mensagem.trim();
        const small = document.createElement('small');
        small.textContent = brDateTime(new Date().toISOString());
        optimisticCard.append(head, p, small);
        listEl.prepend(optimisticCard);
      }

      try {
        const resp = await fetchWithTimeout(BASE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nome.trim(), mensagem: mensagem.trim() }),
          timeout: 10000
        });

        if (!resp.ok) throw new Error(`Falha ao enviar (${resp.status})`);

        setStatus(statusEl, 'Recado enviado com sucesso!', 'ok');
        form.reset();
        await load(); // confirma com o backend (pega o id)
      } catch (e) {
        console.error('POST /api/recados erro:', e);
        setStatus(
          statusEl,
          'Erro ao enviar recado. Confira sua conexão e tente novamente.',
          'erro'
        );
      } finally {
        btn?.removeAttribute('disabled');
        if (optimisticCard && optimisticCard.isConnected) {
          optimisticCard.remove();
        }
      }
    }

    // delegação para deletar recados
    function bindDeleteDelegation() {
      if (!listEl) return;
      listEl.addEventListener('click', async (e) => {
        const btn = e.target.closest('.recado-del');
        if (!btn) return;

        const card = btn.closest('.recado');
        const id = card?.dataset?.id;
        if (!id) return; // recado sem id (antigo) não pode ser apagado

        if (!confirm('Tem certeza que deseja apagar este recado?')) return;

        try {
          btn.disabled = true;
          card.classList.add('recado--removendo');
          const resp = await fetchWithTimeout(`${BASE_API_URL}/${id}`, {
            method: 'DELETE',
            timeout: 10000
          });
          if (!resp.ok && resp.status !== 204) {
            throw new Error(`Falha ao apagar (${resp.status})`);
          }
          card.remove();
          if (!listEl.querySelector('.recado')) {
            renderEmpty();
          }
        } catch (err) {
          console.error('DELETE /api/recados/:id erro:', err);
          alert('Não foi possível apagar. Tente novamente.');
          btn.disabled = false;
          card.classList.remove('recado--removendo');
        }
      });
    }

    function init() {
      if (form) form.addEventListener('submit', submit);
      bindDeleteDelegation();
      // se a aba recados já estiver ativa na carga:
      const ativa = $('.conteudo-secao.active#recados');
      if (ativa) load();
    }

    return { init, load };
  })();

  // =========================
  // CARROSSEL
  // =========================
  function initCarousel() {
    const slides = $$('.carrossel-slide');
    if (!slides.length) return;

    const prevBtn = $('.prev-btn');
    const nextBtn = $('.next-btn');
    const container = $('.carrossel') || $('.carrossel-container');
    const dotsContainer = $('.dots-container');

    // Gera dots se não batem com o nº de slides
    let dots = $$('.dots-container .dot');
    if (dotsContainer && dots.length !== slides.length) {
      dotsContainer.innerHTML = '';
      for (let i = 0; i < slides.length; i++) {
        const b = document.createElement('button');
        b.className = 'dot';
        b.setAttribute('type', 'button');
        b.setAttribute('aria-label', `Ir para slide ${i + 1}`);
        dotsContainer.appendChild(b);
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

    // Teclado
    (container || document).addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    // Swipe (mobile)
    let startX = null;
    const threshold = 30;
    (container || document).addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    });
    (container || document).addEventListener('touchend', (e) => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (dx > threshold) show(index - 1);
      if (dx < -threshold) show(index + 1);
      startX = null;
    });

    show(0);
  }

  // =========================
  // CONTADOR REGRESSIVO
  // =========================
  function initCountdown(){
  const FALLBACK_ISO = "2025-09-20T19:00:00-03:00";

  // Para CADA contador na página
  document.querySelectorAll(".contador").forEach((cont) => {
    const raw = cont.getAttribute("data-evento") || FALLBACK_ISO;
    const target = new Date(raw).getTime();

    const h3   = cont.querySelector("h3");
    const box  = cont.querySelector(".contador-numeros");

    // Procura dentro do próprio contador (aceita id antigo ou data-atributo/classe)
    const dEl  = cont.querySelector('[data-ct="dias"], .ct-dias, #dias');
    const hEl  = cont.querySelector('[data-ct="horas"], .ct-horas, #horas');
    const mEl  = cont.querySelector('[data-ct="minutos"], .ct-minutos, #minutos');
    const sEl  = cont.querySelector('[data-ct="segundos"], .ct-segundos, #segundos');

    if (!dEl || !hEl || !mEl || !sEl) return; // se faltar algo, ignora este bloco

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
  // BOOT
  // =========================
  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    recados.init();
    initCarousel();
    initCountdown();

    const nav = document.querySelector('nav');
  const btn = document.querySelector('.menu-toggle');
  const menu = document.getElementById('menu');

  if (nav && btn && menu) {
    const closeMenu = () => {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    };
    const toggleMenu = () => {
      const isOpen = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(isOpen));
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      toggleMenu();
    });

    // Fecha ao clicar em um link (só no mobile)
    menu.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      if (window.matchMedia('(max-width: 768px)').matches) closeMenu();
    });

    // Fecha com ESC e ao clicar fora
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    document.addEventListener('click', (e) => {
      if (!nav.classList.contains('open')) return;
      if (!nav.contains(e.target)) closeMenu();
    });

    // Se redimensionar para desktop, garante que o menu fique aberto “normal”
    window.matchMedia('(max-width: 768px)').addEventListener('change', (mq) => {
      if (!mq.matches) closeMenu();
    });
  }
  });
})();

