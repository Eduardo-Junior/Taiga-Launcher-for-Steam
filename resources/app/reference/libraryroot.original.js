// ════════════════════════════════════════════════════════════════════
// LG, libraryroot_custom.js
//
// Customizações para a Biblioteca da Steam (via SFP).
// Cada módulo roda em seu próprio IIFE e é independente.
//
// Módulos:
//   1. Core compartilhado ........ helpers + dados por jogo (window.LG_SHARED)
//   2. Notice customizado ........ substitui o aviso "Algumas informações..."
//   3. Abas de link .............. injeta botões (Página, Trailer, Guias, etc)
//   4. Painel Espaço/Conquistas .. mostra "Espaço necessário" e "Conquistas"
//   5. Aba dinâmica .............. cria aba com desenvolvedor/publisher
//   6. Conquistas modal .......... substitui "Anotações" por conquistas
//   7. Loja Free ................. loja de jogos gratuitos integrada à Steam
//   8. Painel Controle ........... badge de compatibilidade de controle
// ════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────
// 1. Core compartilhado, helpers + dados por jogo
// ──────────────────────────────────────────────────────────────────────
(() => {
  if (window.LG_SHARED) return;

  const BUTTON_LABELS = [
    "Página do jogo",
    "Trailer do jogo",
    "Legendary Games",
    "Creditos",
    "Guias",
    "Suporte"
  ];

  function getAttr(el, name) {
    if (!el || !el.getAttribute) return "";
    const v = el.getAttribute(name);
    return v == null ? "" : String(v);
  }

  function getText(el) {
    if (!el) return "";
    const t = el.textContent;
    return t == null ? "" : String(t);
  }

  function normalizeTitle(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function openLink(link) {
    if (!link) return;
    const webview = document.querySelector("webview");
    if (webview) webview.src = link;
    else window.open(link, "_blank");
  }

  function resolveGameTitle(scope, options) {
    scope = scope || document;
    options = options || {};

    const selectors = [
      'span._3rpUkswF6xc_ste4Ros_xM',
      '.apphub_AppName',
      '[data-title]',
      '[data-game-title]',
      'div._3gofIRJCg1EDHUFbiOdy9X'
    ];

    for (let i = 0; i < selectors.length; i++) {
      const el = scope.querySelector(selectors[i]);
      if (!el) continue;
      let txt = getAttr(el, 'data-title');
      if (!txt) txt = getAttr(el, 'data-game-title');
      if (!txt) txt = getText(el);
      txt = (txt || '').trim();
      if (txt) return txt;
    }

    const offlineHeader = document.querySelector('div._3gofIRJCg1EDHUFbiOdy9X');
    if (offlineHeader) {
      const txt = getText(offlineHeader).trim();
      if (txt) return txt;
    }

    const badImgClass = '_24_AuLm54JVe1Zc0AApCDR';
    const imgs = scope.querySelectorAll('img[alt]');
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      if (img.classList && img.classList.contains(badImgClass)) continue;
      if (getAttr(img, 'role') === 'presentation') continue;
      if (img.matches && img.matches('[data-lg-ignore="1"]')) continue;
      const src = getAttr(img, 'src');
      if (src.indexOf('data:') === 0) continue;
      const alt = getAttr(img, 'alt').trim();
      if (alt && alt.length <= 160) return alt;
    }

    if (options.useWindowFallback !== false && window.LG_CURRENT_GAME_RAW) {
      return window.LG_CURRENT_GAME_RAW;
    }

    return '';
  }

  function syncCurrentGame(scope) {
    const raw = resolveGameTitle(scope || document) || '';
    const normalized = normalizeTitle(raw);
    const prev = window.LG_CURRENT_GAME || '';

    if (raw) window.LG_CURRENT_GAME_RAW = raw;
    window.LG_CURRENT_GAME = normalized;

    if (prev !== normalized) {
      window.dispatchEvent(new Event('LG:gamechange'));
    }

    return { raw, normalized };
  }

  const GAME_DATA_RAW = {
    "Demon Slayer - Kimetsu no Yaiba The Hinokami Chronicles 2": {
      notice: {
        destaqueTitulo: "DEMON SLAYER",
        destaqueData: "- 13 de agosto",
        destaqueSubtitulo: "Jogue novos arcos do anime",
        destaqueDescricao:
          "O novo jogo conta com uma série de personagens novos, alm de ter sido adicionado cenas extras de qualidade de cinema!",
        destaqueImagem: "https://i.imgur.com/4esezGP.gif",
        blocos: [
          {
            titulo: "Legendary Games",
            descricao:
              "Jogue seus jogos pagando mais barato e diretamente pela Steam! Acesse nosso discord para mais informações",
            imagem: "https://i.imgur.com/vtQmZkm.png",
            link: "https://example.com/demonslayer/lg"
          },
          {
            titulo: "Outro bloco (exemplo)",
            descricao: "Texto descritivo do segundo bloco.",
            imagem: "https://i.imgur.com/vtQmZkm.png",
            link: "https://example.com/demonslayer/outro"
          },
          {
            titulo: "Demon Slayer",
            descricao: "Conteúdo de teste",
            imagem: "https://ingresso-a.akamaihd.net/b2b/production/uploads/article/image/4021/44a2e5074b432ae7f2333707a9d3dca3.jpg",
            link: "https://example.com/demonslayer/teste"
          }
        ]
      },
      links: {
        "Página do jogo": "https://example.com/demonslayer/page",
        "Trailer do jogo": "https://example.com/demonslayer/trailer",
        "Legendary Games": "https://example.com/demonslayer/lg",
        "Créditos": "https://example.com/demonslayer/credits",
        "Guias": "https://example.com/demonslayer/guides",
        "Suporte": "https://example.com/demonslayer/support"
      },
      extraInfo: { peso: "81,92 GB", conquistas: "37/37", progresso: 100 }
    },

"God of War: Chains of Olympus": {
  notice: {
    destaqueTitulo: "GOD OF WAR",
    destaqueData: "- 4 de março",
    destaqueSubtitulo: "A fúria de Kratos antes do caos do Olimpo",
    destaqueDescricao:
      "God of War: Chains of Olympus mostra Kratos em uma jornada brutal contra deuses e monstros, em um dos capítulos mais marcantes da saga grega.",
    destaqueImagem: "https://cdn.selectgame.net/wp-content/uploads/2012/06/God-of-War-Chains-of-Olympus-Wallpaper-Full-HD.webp",
    blocos: [
      {
        titulo: "Uma aventura lendária no PSP",
        descricao:
          "Mesmo tendo nascido no PSP, o jogo entrega combates intensos, chefes épicos e o estilo clássico que consagrou a franquia God of War.",
        imagem: "https://www.readyatdawn.com/images/gow_CoO_lowerImage.jpg",
        link: "https://example.com/gowchains/lg"
      }
    ]
  },
  links: {
    "Página do jogo": "https://example.com/gowchains/page",
    "Trailer do jogo": "https://example.com/gowchains/trailer",
    "Legendary Games": "https://example.com/gowchains/lg",
    "Créditos": "https://example.com/gowchains/credits",
    "Guias": "https://example.com/gowchains/guides",
    "Suporte": "https://example.com/gowchains/support"
  },
  extraInfo: { peso: "7,00 GB", duracao: "20 horas", conquistas: "36/36", progresso: 100}
},

    "Dragon Ball Z: Budokai Tenkaichi 3": {
      notice: {
        destaqueTitulo: "Budokai Tenkaichi 3",
        destaqueData: "4 de outubro",
        destaqueSubtitulo: "O jogo mais lendário da franquia",
        destaqueDescricao:
          "Dragon Ball Budokai Tenkaichi 3 é considerado por muitos até hoje como o melhor jogo de toda franquia, contando com uma variedade gigante de personagens e de lutas no modo história",
        destaqueImagem: "https://tm.ibxk.com.br/2023/10/31/31190720564485.jpg",
        blocos: [
          {
            titulo: "150 personagens jogáveis",
            descricao:
              "Jogue seus jogos pagando mais barato e diretamente pela Steam! Acesse nosso discord para mais informações",
            imagem: "https://i.ytimg.com/vi/_Hw8RxTlK3A/maxresdefault.jpg",
            link: ""
          }
        ]
      },
      links: {
        "Página do jogo": "https://example.com/demonslayer/page",
        "Trailer do jogo": "https://example.com/demonslayer/trailer",
        "Legendary Games": "https://example.com/demonslayer/lg",
        "Créditos": "https://example.com/demonslayer/credits",
        "Guias": "https://example.com/demonslayer/guides",
        "Suporte": "https://example.com/demonslayer/support"
      },
      extraInfo: { peso: "38,50 GB", duracao: "20 horas", conquistas: "35/35", progresso: 100}
    },

    "God of War III": {
      notice: {
        destaqueTitulo: "GOD OF WAR III",
        destaqueData: "- 20 de agosto",
        destaqueSubtitulo: "A vingança final de Kratos",
        destaqueDescricao:
          "A continuação direta de God of War II, onde Kratos enfrenta Zeus e todo o Olimpo em batalhas épicas.",
        destaqueImagem: "https://criticalhits.com.br/wp-content/uploads/2022/09/blob_vgyq.jpg",
        blocos: [
          {
            titulo: "Nota no Metacritic",
            descricao:
              "O jogo foi muito aclamado tanto pelo público como pelos críticos, ficando com uma nota maior que 90! Pontos o jogo é considerado o melhor da triologia encerrando ela com chave de ouro",
            imagem: "https://notadogame.com/uploads/game/screenshot/640x360/5c056a78a1c11.jpg",
            link: "https://example.com/gow3/lg"
          }
        ]
      },
      links: {
        "Página do jogo": "https://example.com/gow3/page",
        "Trailer do jogo": "https://example.com/gow3/trailer",
        "Legendary Games": "https://example.com/gow3/lg",
        "Créditos": "https://example.com/gow3/credits",
        "Guias": "https://example.com/gow3/guides",
        "Suporte": "https://example.com/gow3/support"
      },
            extraInfo: { peso: "38,50 GB", duracao: "20 horas", conquistas: "35/35", progresso: 100}
    }
  };

  const GAME_DATA = {};
  Object.keys(GAME_DATA_RAW).forEach((key) => {
    GAME_DATA[normalizeTitle(key)] = GAME_DATA_RAW[key];
  });

  window.LG_SHARED = {
    BUTTON_LABELS,
    getAttr,
    getText,
    normalizeTitle,
    openLink,
    resolveGameTitle,
    syncCurrentGame,
    GAME_DATA
  };
})();

// ──────────────────────────────────────────────────────────────────────
// 2. Notice customizado, substitui aviso "Algumas informações..."
// ──────────────────────────────────────────────────────────────────────
(() => {
  const LG = window.LG_SHARED;
  const { getAttr, getText, openLink, syncCurrentGame, GAME_DATA } = LG;

  const TEMPLATE_HEADER = (function(){/*
<div data-lg-novo-conteudo data-lg-ignore="1" class="_5uvIN6jXDXzzck59F-nhv _2EEApFUXB7aWXBtitgV5dk">
  <div class="Panel">
    <div class="UVeN0kaD3zv1feMj_mMw5">
      <div>
        <div class="_39Zk32AvV5cr6g-83IVRVS UVeN0kaD3zv1feMj_mMw5 _3xi-HLpFVHaakihoqhQ_6C">
          <div class="_1WdC0YUP8FT0dYWZ-QIVZL">Destaque</div>
          <div class="_2Dbxm-Lv_YU2jN88HErlMS">
            <div class="LibriMVXcLl1HB60ZUp78 Panel" tabindex="0" role="button">
              <div class="_2tDv0EeJIdDmZLyfUE63t1">
                <img class="fGDsmh9vz8h0RMEoRoAvF _3cX_vEKsN9S9EmR0O5w1Ol" src="{thumbFundo}">
                <div class="_1XpBItdUymdlwPZzvvOnyW">
                  <img class="fGDsmh9vz8h0RMEoRoAvF" src="{destaqueImagem}">
                </div>
                <div class="_2HzKE96Sc4z6KHN68gr4DS">
                  <div class="_1ujzuoxGhLunHZQqHAqRgg _29bW1yCn25VTm4bFameBaV">
                    <div>{destaqueTitulo}</div>
                    <div class="ElNfQSVSKeMaOVHygQ4Nh">{destaqueData}</div>
                  </div>
                  <div class="_3fsjzvni7TQ1NphLHM_5r3">{destaqueSubtitulo}</div>
                  <div class="_3zwBRDW1egliiT4pKYIXap">{destaqueDescricao}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="_1yWgPveQ73QeYCdLcs6oFQ">
          <div class="_2lY7z1MtJRmiRJu3ykdYfs"></div>
          <div class="_21jcwMWGCL3FILnsOf5I8W"></div>
          <div class="_3i62HEXIhsNTd5-Z4uL3K _3Mds9UG-5yRsWUclIV_Y9q">
            <div class="_2RkIcXHXACX4EdBluR3nAH">55</div>
            <div class="_1R6Oubrk1mRaGQf56EQwd4"></div>
          </div>
          <div class="_21jcwMWGCL3FILnsOf5I8W"></div>
          <div class="_161IKq84RwQO4abJSCqv7q _3Mds9UG-5yRsWUclIV_Y9q">
            <div class="_3grvnr9zzkvx6NoBOdmTnf">692</div>
            <div class="_2lVtDi3eSjGcLfXVsRgoUy"></div>
            <div class="_1OhPtd0sU2yzZwckCTGRNC"></div>
          </div>
        </div>

        {SECTIONS}

      </div>
    </div>
  </div>
</div>
*/}).toString().split("\n").slice(1,-1).join("\n");

  const SECTION_TEMPLATE = (function(){/*
<div class="_2UySYiE8fUGGugkHVm1Qb">
  <div class="_2kqz-bSlDu-I49_cV_wicB">
    <div class="SMWMsB-gz3WbYRK2HOm7i Panel">
      <div class="_2o5c89vAnrXN8C60QTSMqO">
        <h2 class="_3A_c3YHYd4YIjA8Y-olnPl _1Q2q_tQ9_Eq8YdEHNAHS3F">
          <div class="_1SQ30LQnUhED7sXI79rmas">
            <div class="_3i0kopAostOz2IDi9HqmeN">Novo conteúdo lançado</div>
            <div class="_34I5HgBL6QP2CcuI4emtaM Focusable">
              <div class="_2890MptFADbe-IUQFQ8L1O">?</div>
            </div>
          </div>
        </h2>
        <div class="bsNegRKT1Hbv4tqHrOk9- _1V-tjeQQqrwAF4ufgABl_3">
          <div class="_2dB1oJFsqNThak1cFya2-q _3qlJ0L41KQFqUTzVQKFERC">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_X_Line" x="0" y="0" width="256" height="256" viewBox="0 0 256 256">
              <line fill="none" stroke="#FFFFFF" stroke-width="45" stroke-miterlimit="10" x1="212" y1="212" x2="44" y2="44"></line>
              <line fill="none" stroke="#FFFFFF" stroke-width="45" stroke-miterlimit="10" x1="44" y1="212" x2="212" y2="44"></line>
            </svg>
          </div>
        </div>
      </div>

      <div>
        <div class="_3fiHsLeD_6rtm6bM9lHlVL _291lAW7IPxmXPQ2fk3AE4P" gap="10">
          <div role="list" aria-labelledby=":r1kh:" class="_3CJctA7pLVdwHzNF5JmORE _1b9np87BteQi38-defpW0U _1X10hweRfMtUjyF-CHh6K5 b3wFR-A7udxD-EIp_rbqC" style="padding: 6px 16px 6px 0px; gap: 10px;">
            <div role="listitem" class="lg-b2-item">
              <a class="_78Pwybe-fHVYEkQFFlpA5 -q2cvgwBii80QuhRe3rRE">
                <div class="_3gB_gMsbWHUGn5Rqwe6KeC">
                  <div class="Ie7sdp_wTfHTvr5FVVoJl Panel">
                    <div class="_2bF7XkQZA1M7jTj6txLFp-">
                      <div class="_1R9r2OBCxAmtuUVrgBEUBw _2E7G8grj_-tgxXbTXs1t2E ZsU8nIIpj8MJn0vzMzSp1 _3SQn1_upOaYSAJAn2N4YKY">
                        <input type="file" accept=".jpg,.jpeg,.png" name="fileupload" style="display: none;">
                        <img class="_24_AuLm54JVe1Zc0AApCDR _3d_bT685lnWotXxgzKW6am yDr03475kalWBTwAE-Rnw" alt="{itemTitulo}" src="{itemImagem}">
                      </div>
                      <div class="HAvWsE0-ycDj77SdyLXE-"></div>
                    </div>
                  </div>
                </div>
                <div class="_1XMxxg4Tf-bnjlvGWtSdmP">
                  <div class="_3hubFyqcbN0Tp93ajVPHLl">{itemTitulo}</div>
                  <div class="_1M3piztNHu7tsD7h8OgpuI">{itemDescricao}</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>

    </div>
    <div class="_1yEoLSbdr6RwEzqpyKLR4m">
      <a href="#" class="_3m6qdpFN3Mop0iw9ZE3RRa Focusable lg-ver-todos"
         role="button" data-link="{btnLink}">Ver todos na loja</a>
    </div>
  </div>
</div>
*/}).toString().split("\n").slice(1,-1).join("\n");

  function collectBlocks(config) {
    const out = [];
    if (config && Array.isArray(config.blocos)) {
      for (let i = 0; i < config.blocos.length; i++) {
        const it = config.blocos[i] || {};
        const titulo = (it.titulo || '').trim();
        if (!titulo) continue;
        out.push({
          titulo,
          descricao: it.descricao || '',
          imagem: it.imagem || '',
          link: it.link || ''
        });
      }
    }
    return out;
  }

  function renderNotice(config) {
    const blocks = collectBlocks(config);
    let thumb = '';
    if (blocks.length && blocks[0].imagem) thumb = blocks[0].imagem;

    let sections = '';
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      sections += SECTION_TEMPLATE
        .replace(/\{itemTitulo\}/g, b.titulo)
        .replace('{itemDescricao}', b.descricao || '')
        .replace('{itemImagem}', b.imagem || '')
        .replace('{btnLink}', b.link || '') + "\n";
    }

    return TEMPLATE_HEADER
      .replace('{thumbFundo}', thumb || '')
      .replace('{destaqueImagem}', config.destaqueImagem || '')
      .replace('{destaqueTitulo}', config.destaqueTitulo || '')
      .replace('{destaqueData}', config.destaqueData || '')
      .replace('{destaqueSubtitulo}', config.destaqueSubtitulo || '')
      .replace('{destaqueDescricao}', config.destaqueDescricao || '')
      .replace('{SECTIONS}', sections);
  }

  function findNoticeNodes() {
    const byClass = Array.prototype.slice.call(
      document.querySelectorAll('._5uvIN6jXDXzzck59F-nhv._1TGl52GwsFQg3CXUYvThP-')
    );
    if (byClass.length) return byClass;

    const re = /algumas\s+informações\s+detalhadas\s+sobre[\s\S]*não\s*steam/i;
    const divs = document.querySelectorAll('div');
    const out = [];
    for (let i = 0; i < divs.length; i++) {
      if (re.test(getText(divs[i]))) out.push(divs[i]);
    }
    return out;
  }

  function wireNoticeButtons(root) {
    const btns = root.querySelectorAll('.lg-ver-todos');
    for (let i = 0; i < btns.length; i++) {
      const btn = btns[i];
      const link = getAttr(btn, 'data-link');
      if (link) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          openLink(link);
        });
      } else {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        btn.title = 'Link indisponível';
      }
    }
  }

  function apply() {
    const current = syncCurrentGame(document);
    const game = GAME_DATA[current.normalized];
    if (!game || !game.notice) return;

    const nodes = findNoticeNodes();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node || node.dataset.lgReplaced === '1') continue;
      node.dataset.lgReplaced = '1';

      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderNotice(game.notice);
      wireNoticeButtons(wrapper);

      const first = wrapper.firstElementChild || wrapper.firstChild;
      if (first && node.parentNode) node.parentNode.replaceChild(first, node);
    }
  }

  const observer = new MutationObserver(apply);
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  apply();
})();

// ──────────────────────────────────────────────────────────────────────
// 3. Abas de link, Página do jogo / Trailer / Guias / etc
// ──────────────────────────────────────────────────────────────────────
(() => {
  const LG = window.LG_SHARED;
  const { BUTTON_LABELS, normalizeTitle, openLink, resolveGameTitle, GAME_DATA } = LG;

  const TARGET_SELECTOR =
    'div._3Y87YQY56ZCOqhgcZFaDc5.Panel, div._1YbtIWcfkQJOysLXQbwzRf.Panel';

  const HTML_TO_APPEND = `
<div role="region" class="_2r4TK4BAuU-J4FuF_O7v_5 _3-V8vjmrwuJM6Ws3tsjFJj Panel" data-lg="simple-injection">
  <div class="_31ptFGGMZrSQc5BCX1e5lm _3KfxIwlXEvum7FCD_AM2_t Panel">
    <div class="_5uvIN6jXDXzzck59F-nhv _25f0fX6qbgdB7O_lMrbhCN">
      <div class="DgVQapkBmhAW6oPY5rPZo Panel" style="height: 32px;">
        ${BUTTON_LABELS.map((label, i) => `
        <div class="_7k4qmaN8SUMvv6u-L81uk" style="left:${i * 150}px; top:0;">
          <div role="button" tabindex="0" class="DY4_wSF8h9T5o46hO5I9V Panel Focusable lg-btn" data-lg="${label}">
            <div class="_1b6LYWVijW-9E4YV0keDWZ"><span class="_2sNDjgK9EWiPLdNGkjun-w">${label}</span></div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>`.trim();

  function injectAfter(node, title, links) {
    if (node.dataset.lgTabsAdded === '1') return;

    const tpl = document.createElement('template');
    tpl.innerHTML = HTML_TO_APPEND;
    const elem = tpl.content.firstElementChild;

    elem.querySelectorAll('.lg-btn').forEach((btn) => {
      const key = btn.dataset.lg;
      const link = links[key];
      if (link) {
        btn.addEventListener('click', () => openLink(link));
      } else {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
      }
    });

    node.insertAdjacentElement('afterend', elem);
    node.dataset.lgTabsAdded = '1';
    console.log('[LG] Abas adicionadas para:', title);
  }

  function apply(root) {
    const scope = root || document;
    const cards = scope.querySelectorAll(TARGET_SELECTOR);
    cards.forEach((card) => {
      const rawTitle = resolveGameTitle(card, { useWindowFallback: false });
      const title = normalizeTitle(rawTitle);
      const game = GAME_DATA[title];
      if (!game || !game.links) return;
      injectAfter(card, rawTitle || title, game.links);
    });
  }

  const observer = new MutationObserver(() => apply(document));
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener('load', () => apply(document));
  apply(document);
})();

// ──────────────────────────────────────────────────────────────────────
// 4. Painel "Espaço necessário" e "Conquistas" no painel principal
// ──────────────────────────────────────────────────────────────────────
(() => {
  const LG = window.LG_SHARED;
  const { syncCurrentGame, GAME_DATA } = LG;

function renderTemplate(info) {
  return `
<div class="lg-extra-info">
  <div class="lg-storage-info">
    <div class="_34lrt5-Fc3usZU6trA1P0-">ESPAÇO NECESSÁRIO</div>
    <div class="_2TYVGoD27ZMfjRirKQNLfk _1nfJNsQjTOXSQQyFahGnRi">${info.peso}</div>
  </div>

  <div class="_1kiZKVbDe-9Ikootk57kpA _1aKegVl9_lSdNAyWYZQlr9 lg-duration-info">
    <div class="_1tIg-QIrwMNtCm7NcYADyi _1GZdosVXnfrf69yU8DWASl">
      <svg version="1.1" id="Layer_2" xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_PlayTime" x="0px" y="0px" width="256px" height="256px" viewBox="0 0 256 256">
        <polyline fill="none" stroke="#000000" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points="85.5,149.167 128,128 128,55.167 "></polyline>
        <path fill="none" stroke="#000000" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" d="M128,17.5c61.027,0,110.5,49.473,110.5,110.5S189.027,238.5,128,238.5S17.5,189.027,17.5,128"></path>
        <circle stroke="#000000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" cx="26.448" cy="85.833" r="5.5"></circle>
        <circle stroke="#000000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" cx="50.167" cy="50.5" r="5.5"></circle>
        <circle stroke="#000000" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" cx="86" cy="26.667" r="5.5"></circle>
      </svg>
    </div>
    <div class="_3m_zjRTQBqcfzCjXLXUHcR">
      <div class="_34lrt5-Fc3usZU6trA1P0-">Duração</div>
      <div class="_2TYVGoD27ZMfjRirKQNLfk">${info.duracao || "-"}</div>
    </div>
  </div>



  <div class="lg-achievements _1kiZKVbDe-9Ikootk57kpA UAhWiMg9Q2VPsQQBj_ikT" data-lg-open-achievements="1" role="button" tabindex="0" style="cursor:pointer;">
    <div class="_1tIg-QIrwMNtCm7NcYADyi k-QNT9kzOEOvG0U_kGmwr">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M9.64304 9.49988L6.39294 12.8055L9.64304 16.1112V20.8333H14.2858L18.0001 24.6111L21.7143 20.8333H26.3573V16.111L29.6072 12.8055L26.3573 9.50012V4.77777H21.7143L18.0001 1L14.2858 4.77777H9.64304V9.49988ZM22.6432 12.8056C22.6432 15.4136 20.5645 17.5278 18.0004 17.5278C15.4362 17.5278 13.3575 15.4136 13.3575 12.8056C13.3575 10.1976 15.4362 8.08334 18.0004 8.08334C20.5645 8.08334 22.6432 10.1976 22.6432 12.8056Z"></path><path fill="currentColor" d="M5 30.2778L8.25 24.6111H12.4286L15.6786 27.9167L11.5 35L9.17857 30.2778H5Z"></path><path fill="currentColor" d="M30.9999 30.2778L27.7499 24.6111H23.5713L20.3213 27.9167L24.4999 35L26.8213 30.2778H30.9999Z"></path></svg>
        <defs>
          <linearGradient id="svgid_165" x1="7.08" y1="3.72" x2="33.6694" y2="25.0697" gradientUnits="userSpaceOnUse">
            <stop stop-color="#0056D6"></stop>
            <stop offset="1" stop-color="#1A9FFF"></stop>
          </linearGradient>
          <linearGradient id="svgid_164" x1="7.08" y1="3.72" x2="33.6694" y2="25.0697" gradientUnits="userSpaceOnUse">
            <stop stop-color="#0056D6"></stop>
            <stop offset="1" stop-color="#1A9FFF"></stop>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div class="_3m_zjRTQBqcfzCjXLXUHcR">
      <div class="_34lrt5-Fc3usZU6trA1P0-">Conquistas</div>
      <div class="_16quGbk-i_9yE-tFyyOK8G">
        <div class="_2TYVGoD27ZMfjRirKQNLfk _2muiKHUkOiTvX-6arqnQUC">${info.conquistas}</div>
        <div role="progressbar" aria-valuenow="${info.progresso}" class="_25YVDTaClw6Y2COPsU0UaV">
          <div class="_1FnTqlsi2_-TJf1d5apoS6" style="width: ${info.progresso}%;"></div>
        </div>
      </div>
    </div>
  </div>
</div>`.trim();
}

  function ensureStyle() {
    if (document.getElementById('lg-storage-style')) return;
    const style = document.createElement('style');
    style.id = 'lg-storage-style';
    style.textContent = `
      .lg-extra-info {
        display: flex;
        align-items: center;
        gap: 30px;
        margin-left: 15px;
      }

      .lg-storage-info {
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .lg-storage-info ._34lrt5-Fc3usZU6trA1P0- {
        font-size: 11px;
        line-height: 1.2;
      }
      .lg-storage-info ._2TYVGoD27ZMfjRirKQNLfk {
        font-size: 13px;
        font-weight: 500;
        margin-top: 2px;
        white-space: nowrap;
      }

      ._2s7bUkQ39U2kTztAKe5p84 .lg-hide-expanded {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function apply() {
    const current = syncCurrentGame(document);
    const game = GAME_DATA[current.normalized];
    if (!game || !game.extraInfo) return;

    const nodes = document.querySelectorAll('div._1mDAVT4sTzFRwJtlKCw2Ws');
    nodes.forEach((node, index) => {
      if (node.querySelector('.lg-extra-info')) return;
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderTemplate(game.extraInfo);
      const elem = wrapper.firstElementChild;
      if (index > 0) elem.classList.add('lg-hide-expanded');
      node.appendChild(elem);
    });

    ensureStyle();
  }

  const observer = new MutationObserver(apply);
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  apply();
})();


// ──────────────────────────────────────────────────────────────────────
// 5. Aba dinâmica, desenvolvedor/publisher/série
// ──────────────────────────────────────────────────────────────────────
(() => {
  const CTRL_SELECTOR =
    'div[role="button"][aria-label="Configurar controle"], div[role="button"][aria-label="Controller Settings"]';

  const TAB_ANCHOR_SEL = '#lg-tabbar, [data-lg="tabbar"], [data-lg="simple-injection"]';

  // 🔹 Função para normalizar nomes
  function normalize(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

// ---------- Substitua a função getGameTitle por esta ----------
function getGameTitle(scope = document) {
  // 1) Fontes "seguras" DENTRO do card (online/offline)
  const SAFE_SELECTORS_IN_CARD = [
    'span._3rpUkswF6xc_ste4Ros_xM', // título comum no cabeçalho do card
    '.apphub_AppName',
    '[data-title]',
    'div._3gofIRJCg1EDHUFbiOdy9X'   // título offline dentro do card (se estiver no card)
  ];
  for (const sel of SAFE_SELECTORS_IN_CARD) {
    const el = scope.querySelector(sel);
    const txt = (el?.getAttribute?.('data-title') || el?.textContent || '').trim();
    if (txt) return normalize(txt);
  }

  // 2) Fonte offline GLOBAL e específica (header da página)
  const offlineHeader = document.querySelector('div._3gofIRJCg1EDHUFbiOdy9X');
  if (offlineHeader) {
    const txt = (offlineHeader.textContent || '').trim();
    if (txt) return normalize(txt);
  }

  // 3) img[alt] DENTRO do card, ignorando a classe problemática e contextos ruins
  const BAD_IMG_CLASS = '_24_AuLm54JVe1Zc0AApCDR';
  const okImg = Array.from(scope.querySelectorAll('img[alt]')).find(img => {
    if (img.classList.contains(BAD_IMG_CLASS)) return false;   // ignora a problemática
    if (img.getAttribute('role') === 'presentation') return false;
    if (img.matches('[data-lg-ignore="1"]')) return false;
    const src = img.getAttribute('src') || '';
    if (src.startsWith('data:')) return false;                 // miniaturas/base64
    const alt = (img.getAttribute('alt') || '').trim();
    return alt && alt.length <= 160;
  });
  if (okImg) return normalize(okImg.getAttribute('alt') || '');

  // 4) Nada encontrado no ESCOPO local
  return '';
}


  // === CONFIGURAÇÕES DE JOGOS ===
  const GAME_CONFIG = {
    "demon slayer - kimetsu no yaiba the hinokami chronicles 2": {
      image: "/assets/2928600/cd8f57c2f07be40f38f1ecbe6d94ddda5195a1b8/library_600x900.jpg?c=3953412360",
      description: "Destrua demônios com o poder dos laços forjados! A batalha de Tanjiro Kamado se repete...",
      developer: { name: "CyberConnect2", url: "steam://openurl/https://store.steampowered.com/search/?developer=CyberConnect2" },
      publisher: { name: "SEGA", url: "steam://openurl/https://store.steampowered.com/publisher/Sega" },
      series: { name: "Demon Slayer -Kimetsu no Yaiba-", url: "steam://openurl/https://store.steampowered.com/search/?franchise=Demon%20Slayer%20-Kimetsu%20no%20Yaiba-" },
      releaseDate: "5 de ago. de 2025"
    },


"god of war chains of olympus": {
  image: "https://cdn2.steamgriddb.com/grid/8ac7e4d4674273a7c3d787376759b14f.png",
  description: "Kratos encara deuses, titãs e criaturas mitológicas em uma jornada brutal ambientada antes dos eventos principais da trilogia grega.",
  developer: {
    name: "Ready at Dawn",
    url: "steam://openurl/https://store.steampowered.com/search/?developer=Ready%20at%20Dawn"
  },
  publisher: {
    name: "Sony",
    url: "steam://openurl/https://store.steampowered.com/publisher/Sony"
  },
  series: {
    name: "God of War",
    url: "steam://openurl/https://store.steampowered.com/search/?franchise=God%20of%20War"
  },
  releaseDate: "4 de mar. de 2008"
},

    "dragon ball z: budokai tenkaichi 3": {
      image: "https://cdn2.steamgriddb.com/grid/2fcd824d9156e24ad1f7344c8723ab5f.png",
      description: "Jogue toda história de Dragon Ball Z",
      developer: { name: "CyberConnect2", url: "steam://openurl/https://store.steampowered.com/search/?developer=CyberConnect2" },
      publisher: { name: "SEGA", url: "steam://openurl/https://store.steampowered.com/publisher/Sega" },
      series: { name: "Dragon Balll Budokai Tenkaichi 3", url: "steam://openurl/https://store.steampowered.com/search/?franchise=Demon%20Slayer%20-Kimetsu%20no%20Yaiba-" },
      releaseDate: "5 de ago. de 2007"
    },

    "god of war iii": {
      image: "/assets/2928600/godofwar3.jpg",
      description: "O final lendário da saga grega, com Kratos enfrentando todo o Olimpo em uma vingança épica.",
      developer: { name: "Santa Monica Studio", url: "steam://openurl/https://store.steampowered.com/search/?developer=Santa%20Monica%20Studio" },
      publisher: { name: "Sony", url: "steam://openurl/https://store.steampowered.com/publisher/Sony" },
      series: { name: "God of War", url: "steam://openurl/https://store.steampowered.com/search/?franchise=God%20of%20War" },
      releaseDate: "19 de mai. de 2010"
    }
  };

  // === GERA HTML DINÂMICO DA ABA ===
  function buildInfoTab(gameId) {
    const cfg = GAME_CONFIG[gameId];
    if (!cfg) return `<div style="padding:12px;color:#bbb">Sem informações configuradas para este jogo.</div>`;

    return `
<div class="_25oBZpa3dUcMw8QAsa2u67 _3s6_6sN8LyrlTHc_z6VfNU _2QAgOXmzdXYGH8vI6S2sHw" style="height: 179px;">
  <div class="_2jPMy2QZr8bWi6yrk5ZzHA">
    <div class="_37mmOlZM_8n5yJAG5CHiW7">
      <div class="_1Id6ZFEUVa5PKEMIvSg4nE">
        <div class="_1R9r2OBCxAmtuUVrgBEUBw _2E7G8grj_-tgxXbTXs1t2E _3Ehhd5MxErV_bXQE4qVhzB _3JzkHhrsBKThuVrwsu3Q7T">
          <img alt="${cfg.series.name}" class="_24_AuLm54JVe1Zc0AApCDR _3d_bT685lnWotXxgzKW6am yDr03475kalWBTwAE-Rnw" src="${cfg.image}">
        </div>
      </div>
      <div class="_2AMl0koRXkR77BaY7Sa3Ie _1uS70KI6ZbUE94jUB27ioB">
        <div class="_3GkV1NVDKuXYTLyRt2Uirz">${cfg.description}</div>
      </div>
      <div class="_3cntzF30xAuwn1ARWJjvCb _1uS70KI6ZbUE94jUB27ioB">
        <div class="_2ZcNQxY8YknnhNa4ZvIoU4"><div class="_1vYL2q-91QLy-FBzntE7E5">Desenvolvedor:</div><div class="_-9icu8LqT7inRSJISgnkh"><a class="_2j8Xh4pPOOgF4MF6FVUI28" href="${cfg.developer.url}">${cfg.developer.name}</a></div></div>
        <div class="_2ZcNQxY8YknnhNa4ZvIoU4"><div class="_1vYL2q-91QLy-FBzntE7E5">Distribuidora:</div><div class="_-9icu8LqT7inRSJISgnkh"><a class="_2j8Xh4pPOOgF4MF6FVUI28" href="${cfg.publisher.url}">${cfg.publisher.name}</a></div></div>
        <div class="_2ZcNQxY8YknnhNa4ZvIoU4"><div class="_1vYL2q-91QLy-FBzntE7E5">Série:</div><div class="_-9icu8LqT7inRSJISgnkh"><a class="_2j8Xh4pPOOgF4MF6FVUI28" href="${cfg.series.url}">${cfg.series.name}</a></div></div>
        <div class="_1OWQ9x11PhUMMRAfAu4d_4"><div class="_1vYL2q-91QLy-FBzntE7E5">Data de lançamento:</div><div class="izVv8jajo7mehdAkZozAK">${cfg.releaseDate}</div></div>
      </div>
<div class="nkIX48cHLbjc0eaP5CNmM _1uS70KI6ZbUE94jUB27ioB"><div class="_1SIa8xLHqCJGyeA9sQ4yK_ Focusable"><img class="_2RwHEhnDQNfN31QK-EOHy7" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAgCAYAAABdP1tmAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyBpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkRERUQ1MjQ5NjAxMzExRTY5NTkyRjY4RDcwMzI0QjQ1IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkRERUQ1MjRBNjAxMzExRTY5NTkyRjY4RDcwMzI0QjQ1Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RERFRDUyNDc2MDEzMTFFNjk1OTJGNjhENzAzMjRCNDUiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RERFRDUyNDg2MDEzMTFFNjk1OTJGNjhENzAzMjRCNDUiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz6coHCaAAABjklEQVR42mL8//8/w3ACjKMeGsEeUgbiZCC2B2JpkF1A/A6IzwLxEiA+QBNbQR6iATYD4pf/8YMSWthNixjiAOJTQKxLKCyB2AiIL1DTciYaRLoJEZ5hgCbBYGpbTgsPadNI7YB5iJcEtdxYYm3QeYikMokAf1B46CkJal8MhSRnRYJadSDmGuwe0iDRQ2yD3UNHSFB7HYg/DnYPHSRB7SlqFAS0bsuxAPECII4moO4GEDsA8cvBHkN/gPgoEequUdsztKyHLhKh5iwSm5kalSotuw+gZLcOiH1xyF8FYlcgfo7UQqCOQ2jUfQBhazxdh3xa2UvLpg++JMRKK0tp6SF9EuVYqZGPqJmH+IBYBdolABXHYUDMg6dRCioJtwLxOWgF+3iwFAqgjB8LxJZALEOmGZ+A+AQQzwTijUD8dyAKBXYgnv+fuuA3EK8FYtGBGFOYC8RJNMp/Z6GjRV/pFUMO/2kPyugZQ8uBOILGvdlb0O4FXQqF00CsRGMPgZKb3GBp+gwYGPXQYAcAAQYATEEIKTrcDEcAAAAASUVORK5CYII=" alt="Um jogador"><div class="_1VoVzLPXjhlaguJLgO8htG">Um jogador</div></div><div class="_1SIa8xLHqCJGyeA9sQ4yK_ Focusable"><img class="_2RwHEhnDQNfN31QK-EOHy7" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAgCAYAAABdP1tmAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyBpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBXaW5kb3dzIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkQxM0JDNzI2NjAwRTExRTZBQkYxRTRDRTc4MzQxRjI2IiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkQxM0JDNzI3NjAwRTExRTZBQkYxRTRDRTc4MzQxRjI2Ij4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6RDEzQkM3MjQ2MDBFMTFFNkFCRjFFNENFNzgzNDFGMjYiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6RDEzQkM3MjU2MDBFMTFFNkFCRjFFNENFNzgzNDFGMjYiLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz4y5hBdAAAC4UlEQVR42uyYy2tUMRTG59VaW7XoaKlFFC0WUaQIIkVFcSGCglvXLkRcufGxcSW4E7oTBcGFoH+A4AsLogsVQQuVVhTrY3C0PuqjTH3OHb8j30AIuTe5ndxRhjnwg0lubiZfknNyctOVSiXVSJZJNZg1BTUFNZCgfnAWjIDXoAAeglOgL6k/TScU5TaCK2BeyPP3YAcF/veCcuA2GLC0uwx2/WtBHWA+t2oJfDS0WQnGQNbS1xS33lutPg8WcWImwRtQiTObrrYWrAdtLFfoF0Pgu9Kux0GM2BzQpQiSd7ZQpOrbRXCDE+gtKCwAmxUxf1cXLAXrtLZZ192hTaj0s8owJpmgTb6jXHfEsx6tXHLs8xeYVsT1RrSViWuvV9hOG/ys7Ciohb9bLQOWdnN9CvoZ8eyHVt7quO3alUiYc3gn41NQpyXyqf2Mxljd5yGrbLKyT0GfI56JHwRK+T63k82mY4oPfAp6xTPBZCNaeRwMOvR5nCG56iO2LZf1KUhmfCKkvmioH3Lo87rye6HDWLp9R7kxw1YaNQQFsSeWQCK53AstLNtsuct44wiaMJwxL0PaymBPRjj3UfBJqbvDFXugTUSZPnmNqx74EpTjLHZo9b08H0xR6nxIDibB4JKh7hm4B35rgeAR/XKq1lyuhanIEqY+pqvAGlJkCH4KvvFZW4jQVi2FSnFSpJ8V2gErY9hNQe94ryrPRNBssJPJY5RJYvmY2/GrMruLwb6Qd2aBA+AMo2c18x7nSvUx21az7zx/fwA36YOxrg9y2q+2iLmrXNDk4N3GBLafiWbe8r5MwDDD/i1wlXXiBhsMSW/VvoALcQXtNWyLlObEw/zzw+AIt2UtJtv2GDjH8kCIqICrG0vQMiVgBIYOC/SPi2CP50vnCQrL0H8zhihZSOIKvh+cTuhbx3Ze6ur21Ueiz8EEvxgdquWDxkysi2F8MiFB1TOvFPfFdPNjfVNQfe2PAAMAwxKnYH2hpYkAAAAASUVORK5CYII=" alt="Multijogador"><div class="_1VoVzLPXjhlaguJLgO8htG">Multijogador</div></div><div class="_1SIa8xLHqCJGyeA9sQ4yK_ Focusable"><img class="_2RwHEhnDQNfN31QK-EOHy7" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAgCAYAAABdP1tmAAAACXBIWXMAAAsTAAALEwEAmpwYAAAKT2lDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8TG4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH/w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjAFAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwABRmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AISZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJhmkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiYuP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoOnaV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41EScY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQWHTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz/HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKayCQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgTYSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9cgI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJvQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAyrxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJNwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5DPkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0uhHdlR5Ol9BX0svpR+iX6AP0dwwNhhWDx4hnKBmbGAcYZxl3GK+YTKYZ04sZx1QwNzHrmOeZD5lvVVgqtip8FZHKCpVKlSaVGyovVKmqpqreqgtV81XLVI+pXlN9rkZVM1PjqQnUlqtVqp1Q61MbU2epO6iHqmeob1Q/pH5Z/YkGWcNMw09DpFGgsV/jvMYgC2MZs3gsIWsNq4Z1gTXEJrHN2Xx2KruY/R27iz2qqaE5QzNKM1ezUvOUZj8H45hx+Jx0TgnnKKeX836K3hTvKeIpG6Y0TLkxZVxrqpaXllirSKtRq0frvTau7aedpr1Fu1n7gQ5Bx0onXCdHZ4/OBZ3nU9lT3acKpxZNPTr1ri6qa6UbobtEd79up+6Ynr5egJ5Mb6feeb3n+hx9L/1U/W36p/VHDFgGswwkBtsMzhg8xTVxbzwdL8fb8VFDXcNAQ6VhlWGX4YSRudE8o9VGjUYPjGnGXOMk423GbcajJgYmISZLTepN7ppSTbmmKaY7TDtMx83MzaLN1pk1mz0x1zLnm+eb15vft2BaeFostqi2uGVJsuRaplnutrxuhVo5WaVYVVpds0atna0l1rutu6cRp7lOk06rntZnw7Dxtsm2qbcZsOXYBtuutm22fWFnYhdnt8Wuw+6TvZN9un2N/T0HDYfZDqsdWh1+c7RyFDpWOt6azpzuP33F9JbpL2dYzxDP2DPjthPLKcRpnVOb00dnF2e5c4PziIuJS4LLLpc+Lpsbxt3IveRKdPVxXeF60vWdm7Obwu2o26/uNu5p7ofcn8w0nymeWTNz0MPIQ+BR5dE/C5+VMGvfrH5PQ0+BZ7XnIy9jL5FXrdewt6V3qvdh7xc+9j5yn+M+4zw33jLeWV/MN8C3yLfLT8Nvnl+F30N/I/9k/3r/0QCngCUBZwOJgUGBWwL7+Hp8Ib+OPzrbZfay2e1BjKC5QRVBj4KtguXBrSFoyOyQrSH355jOkc5pDoVQfujW0Adh5mGLw34MJ4WHhVeGP45wiFga0TGXNXfR3ENz30T6RJZE3ptnMU85ry1KNSo+qi5qPNo3ujS6P8YuZlnM1VidWElsSxw5LiquNm5svt/87fOH4p3iC+N7F5gvyF1weaHOwvSFpxapLhIsOpZATIhOOJTwQRAqqBaMJfITdyWOCnnCHcJnIi/RNtGI2ENcKh5O8kgqTXqS7JG8NXkkxTOlLOW5hCepkLxMDUzdmzqeFpp2IG0yPTq9MYOSkZBxQqohTZO2Z+pn5mZ2y6xlhbL+xW6Lty8elQfJa7OQrAVZLQq2QqboVFoo1yoHsmdlV2a/zYnKOZarnivN7cyzytuQN5zvn//tEsIS4ZK2pYZLVy0dWOa9rGo5sjxxedsK4xUFK4ZWBqw8uIq2Km3VT6vtV5eufr0mek1rgV7ByoLBtQFr6wtVCuWFfevc1+1dT1gvWd+1YfqGnRs+FYmKrhTbF5cVf9go3HjlG4dvyr+Z3JS0qavEuWTPZtJm6ebeLZ5bDpaql+aXDm4N2dq0Dd9WtO319kXbL5fNKNu7g7ZDuaO/PLi8ZafJzs07P1SkVPRU+lQ27tLdtWHX+G7R7ht7vPY07NXbW7z3/T7JvttVAVVN1WbVZftJ+7P3P66Jqun4lvttXa1ObXHtxwPSA/0HIw6217nU1R3SPVRSj9Yr60cOxx++/p3vdy0NNg1VjZzG4iNwRHnk6fcJ3/ceDTradox7rOEH0x92HWcdL2pCmvKaRptTmvtbYlu6T8w+0dbq3nr8R9sfD5w0PFl5SvNUyWna6YLTk2fyz4ydlZ19fi753GDborZ752PO32oPb++6EHTh0kX/i+c7vDvOXPK4dPKy2+UTV7hXmq86X23qdOo8/pPTT8e7nLuarrlca7nuer21e2b36RueN87d9L158Rb/1tWeOT3dvfN6b/fF9/XfFt1+cif9zsu72Xcn7q28T7xf9EDtQdlD3YfVP1v+3Njv3H9qwHeg89HcR/cGhYPP/pH1jw9DBY+Zj8uGDYbrnjg+OTniP3L96fynQ89kzyaeF/6i/suuFxYvfvjV69fO0ZjRoZfyl5O/bXyl/erA6xmv28bCxh6+yXgzMV70VvvtwXfcdx3vo98PT+R8IH8o/2j5sfVT0Kf7kxmTk/8EA5jz/GMzLdsAAAAgY0hSTQAAeiUAAICDAAD5/wAAgOkAAHUwAADqYAAAOpgAABdvkl/FRgAAAjRJREFUeNrsmLFrFEEUxr+Xi4UBFQUbCwkeqKQwhYiFlQom/8BiLJRYBNFCtNFG0wUkQjoLBQW7/AGBgIjaxHQ2phDUQkRFBKMSRc+7+1k44jDsiXs7u3sc+WCbNzu738ebefO9MUD9hAH1GfpOkIBMT5f/GAHOl8HPspI0s25IzUs6JKluZo2sgirJEHAOmAIsJTttfmMqZd4e4Eo0fhEFTTjSj4FRPzv8xQug5uKbgFmgAdzqRUH7PeJNYA446GXnD04Ap4B3XuxCz+0hYKukj2FYUjihJakWxMbM7F6MPRStbJvZaoqgNPW1lNizWDwGuyylRyTtTBlak7Qt4+d+StoF7JD03c+kmT0t5RwCdgMfKBZnSi0KwAHga0FiLlVS5YAxV3ZjYqbSsg2cjCjmRt4tkavKAXVJxyNayxawuXRzCgwBM8CPAvbPWyApbckBCfCa4rEI1MtYci8l3ZS0JKldUFezJqkp6WjmAz6P9XF255ikSUnjOUU8kbQg6b6kZTNrVtY+BI66W1zrCXMKjEha6eDbsuCzpGEz+1S1OZ2OIEaStkg6W+mdQtCNNoBHwFVg9T+W2CvgDvDGi70HNlbmFICLwHVngYa8+FJA/gvQCmLz3vv7gMvAg7BNr6xjDUjc9Yh/Aw4Dk4Gg6Q5zB/IIGizoHHnu9TqJmT105LZLmnVjKx2KTruyPfSPbyZuiSUpY3MuQ3sL4VeQoFHgdIcxA24DG3rionH9bntdUD78GgDD9sxi5Lh6hgAAAABJRU5ErkJggg==" alt="Conquistas"><div class="_1VoVzLPXjhlaguJLgO8htG">Conquistas</div></div><div class="_1SIa8xLHqCJGyeA9sQ4yK_ Focusable"><img class="_2RwHEhnDQNfN31QK-EOHy7" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAgCAYAAABdP1tmAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNU CBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6RkU2NTg3NzNFMkJCMTFFM0FEQjdEN0Q5ODk1RUQ3RDAiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6RkU2NTg3NzRFMkJCMTFFM0FEQjdEN0Q5ODk1RUQ3RDAiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpGRTY1ODc3MUUyQkIxMUUzQURCN0Q3RDk4OTVFRDdEMCIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpGRTY1ODc3MkUyQkIxMUUzQURCN0Q3RDk4OTVFRDdEMCIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Ph3YSCMAAAF0SURBVHjaYvz//z/DcAKMox4a9dDQ8RAnECcAsR8Qi0LFzgLxESBeA8TfB8RHIA+Rgc2A+MZ/3AAkp0um2RRhcmIoCogXATEzAXW/gNgKGmuDNoZUgPjbf+LBEyCuBuIzSGLngTgfiNkGQwyBYiaWSmF5Coh9gPj1QBUKoELgLZSmFgAVIA5A/HcgPKQFxFdpkOo7oGYbQEvLC0C8CYinAPEXWnlIGoinQYtoeoFHQOwJxNeo7aE0IO4CYv4BqFVAnjIE4nfEamAiooieOUCeAQE5IC6lVgyBktkNIOYZBC2aF0A8F5rfvpBbD7X/H3zgHhAbkFsPXQJi3UHY/gTFljaufMVEoJgejEACiHPIyUN/iGivDRS4D8RKpHroIbSUGayABVsLA1+SOziIPfMdV3MJn4f6BrGHzpJTsV6AtqcGI5hIbtMHVCjMgXa1BwsAde9DKe3gBQLxq0FQsU4m1DEcHfUZ9dCoh0Y9NOqhIQUAAgwANas/kaURLm8AAAAASUVORK5CYII=" alt="Salvamentos na nuvem"><div class="_1VoVzLPXjhlaguJLgO8htG">Salvamento dentro do jogo</div></div><div class="_1SIa8xLHqCJGyeA9sQ4yK_ Focusable"><svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="Layer_1" x="0px" y="0px" viewBox="0 0 36 36" class="_2RwHEhnDQNfN31QK-EOHy7"><path fill="currentColor" d="M31.5,9.6c-0.3-0.3-0.7-0.6-1.1-1V8.4c0,0,0-0.6-0.6-1.1s-3.9-1.7-5.1-1.7c-0.7,0-0.9,0.2-1.2,0.4c-0.2,0.1-0.3,0.2-0.5,0.2  H12.9c-0.2,0-0.4-0.1-0.5-0.2c-0.2-0.2-0.5-0.4-1.2-0.4c-1.1,0-4.5,1.1-5.1,1.7S5.6,8.4,5.6,8.4v0.1c-0.4,0.3-0.8,0.7-1.1,1  C3.4,10.7,0,20.2,0,25.3s3.4,5.6,3.4,5.6c0.9,0,2.3-1.8,3.7-3.5c1.2-1.5,2.3-3,3.1-3.2c1.7-0.6,14.1-0.6,15.8,0  c0.8,0.3,1.9,1.7,3.1,3.2c1.4,1.7,2.8,3.5,3.7,3.5c0,0,3.4-0.6,3.4-5.6S32.6,10.7,31.5,9.6z M8.4,14.6c-1.2,0-2.2-1-2.2-2.2  s1-2.2,2.2-2.2s2.2,1,2.2,2.2S9.7,14.6,8.4,14.6z M15.8,18.8c0,0.3-0.3,0.6-0.6,0.6h-0.8v0.8c0,0.3-0.3,0.6-0.6,0.6h-1.1  c-0.3,0-0.6-0.3-0.6-0.6v-0.8h-0.8c-0.3,0-0.6-0.3-0.6-0.6v-1.1c0-0.3,0.3-0.6,0.6-0.6h0.8v-0.8c0-0.3,0.3-0.6,0.6-0.6h1.1  c0.3,0,0.6,0.3,0.6,0.6v0.8h0.8c0.3,0,0.6,0.3,0.6,0.6V18.8z M27.6,8.7c0.8,0,1.4,0.6,1.4,1.4s-0.6,1.4-1.4,1.4s-1.4-0.6-1.4-1.4  S26.8,8.7,27.6,8.7z M23.1,20.2c-1.2,0-2.2-1-2.2-2.2s1-2.2,2.2-2.2s2.2,1,2.2,2.2S24.3,20.2,23.1,20.2z M25,14.1  c-0.8,0-1.4-0.6-1.4-1.4c0-0.8,0.6-1.4,1.4-1.4s1.4,0.6,1.4,1.4C26.4,13.4,25.8,14.1,25,14.1z M27.6,16.6c-0.8,0-1.4-0.6-1.4-1.4  s0.6-1.4,1.4-1.4s1.4,0.6,1.4,1.4S28.3,16.6,27.6,16.6z M30.1,14.1c-0.8,0-1.4-0.6-1.4-1.4c0-0.8,0.6-1.4,1.4-1.4s1.4,0.6,1.4,1.4  C31.5,13.4,30.9,14.1,30.1,14.1z"></path></svg><div class="_1VoVzLPXjhlaguJLgO8htG">Compatibilidade a controles</div></div><div class="_1SIa8xLHqCJGyeA9sQ4yK_ Focusable"><svg xmlns="https://i.imgur.com/7LD4DmW.png" viewBox="0 0 36 36" fill="none" class="_2RwHEhnDQNfN31QK-EOHy7"><g clip-path="url(#svgid_89)"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M4.49995 7.47C3.93745 8.0325 2.81244 10.2825 2.81244 10.2825C2.24993 11.97 0.562445 17.0325 -5.43911e-05 23.7825C-5.43911e-05 23.7825 -0.562553 28.845 3.37495 29.4075C6.832 29.8396 7.9652 25.2921 8.55982 22.9059C8.73921 22.186 8.86958 21.6629 8.99995 21.5325C9.33789 21.1945 9.67584 21.0596 9.89181 21.0058C10.5086 21.6754 11.3928 22.095 12.3749 22.095C13.3745 22.095 14.2726 21.6605 14.8906 20.97H21.1093C21.7273 21.6605 22.6254 22.095 23.6249 22.095C24.6071 22.095 25.4913 21.6754 26.1081 21.0058C26.3241 21.0596 26.662 21.1945 27 21.5325C27.1303 21.6629 27.2607 22.186 27.4401 22.9059C28.0347 25.2921 29.1679 29.8396 32.625 29.4075C36.5625 28.845 36 23.7825 36 23.7825C35.4375 17.0325 33.75 11.97 33.1875 10.2825C33.1875 10.2825 32.0625 8.03251 31.4999 7.47C31.4575 7.42758 31.3927 7.39155 31.3091 7.36121C30.794 7.09333 29.2603 6.45543 26.9999 6.9075C26.8121 7.09539 26.6869 7.28328 26.6036 7.45021C26.4971 7.46255 26.4375 7.47001 26.4375 7.47001L25.875 8.0325L24.1874 8.03251V12.5325C24.1874 13.1538 23.6838 13.6575 23.0624 13.6575H12.9374C12.3161 13.6575 11.8124 13.1538 11.8124 12.5325V8.03251L10.1249 8.03249L9.56245 7.47C9.56245 7.47 9.50277 7.46254 9.39629 7.4502C9.31296 7.28328 9.18783 7.09539 8.99995 6.9075C6.73958 6.45543 5.20586 7.09333 4.6908 7.36121C4.60721 7.39155 4.54237 7.42759 4.49995 7.47ZM14.3999 18.1575C14.3999 19.4002 13.3926 20.4075 12.1499 20.4075C10.9073 20.4075 9.89995 19.4002 9.89995 18.1575C9.89995 16.9149 10.9073 15.9075 12.1499 15.9075C13.3926 15.9075 14.3999 16.9149 14.3999 18.1575ZM23.6249 20.4075C24.8676 20.4075 25.8749 19.4002 25.8749 18.1575C25.8749 16.9149 24.8676 15.9075 23.6249 15.9075C22.3823 15.9075 21.3749 16.9149 21.3749 18.1575C21.3749 19.4002 22.3823 20.4075 23.6249 20.4075ZM30.3749 10.845C30.3749 11.4663 29.8713 11.97 29.2499 11.97C28.6286 11.97 28.1249 11.4663 28.1249 10.845C28.1249 10.2237 28.6286 9.72001 29.2499 9.72001C29.8713 9.72001 30.3749 10.2237 30.3749 10.845ZM29.2499 17.0325C29.8713 17.0325 30.3749 16.5288 30.3749 15.9075C30.3749 15.2862 29.8713 14.7825 29.2499 14.7825C28.6286 14.7825 28.1249 15.2862 28.1249 15.9075C28.1249 16.5288 28.6286 17.0325 29.2499 17.0325ZM26.7187 12.2513C27.34 12.2513 27.8437 12.7549 27.8437 13.3763C27.8437 13.9976 27.34 14.5013 26.7187 14.5013C26.0974 14.5013 25.5937 13.9976 25.5937 13.3763C25.5937 12.7549 26.0974 12.2513 26.7187 12.2513ZM32.9062 13.3763C32.9062 12.7549 32.4025 12.2513 31.7812 12.2513C31.1599 12.2513 30.6562 12.7549 30.6562 13.3763C30.6562 13.9976 31.1599 14.5013 31.7812 14.5013C32.4025 14.5013 32.9062 13.9976 32.9062 13.3763ZM5.62495 10.7825C5.62495 10.5064 5.8488 10.2825 6.12495 10.2825H7.37495C7.65109 10.2825 7.87495 10.5064 7.87495 10.7825V11.7629C7.87495 11.8955 7.82227 12.0227 7.7285 12.1165L7.1035 12.7415C6.90824 12.9367 6.59166 12.9367 6.39639 12.7415L5.77139 12.1165C5.67763 12.0227 5.62495 11.8955 5.62495 11.7629V10.7825ZM6.12495 16.47C5.8488 16.47 5.62495 16.2462 5.62495 15.97V14.9896C5.62495 14.857 5.67763 14.7298 5.77139 14.6361L6.39639 14.0111C6.59166 13.8158 6.90824 13.8158 7.1035 14.0111L7.7285 14.6361C7.82227 14.7298 7.87495 14.857 7.87495 14.9896V15.97C7.87495 16.2462 7.65109 16.47 7.37495 16.47H6.12495ZM4.1562 14.5013C3.88006 14.5013 3.6562 14.2774 3.6562 14.0013V12.7513C3.6562 12.4751 3.88006 12.2513 4.1562 12.2513H5.13659C5.2692 12.2513 5.39638 12.3039 5.49014 12.3977L6.11514 13.0227C6.31041 13.218 6.31041 13.5346 6.11514 13.7298L5.49014 14.3548C5.39638 14.4486 5.2692 14.5013 5.13659 14.5013H4.1562ZM9.8437 14.0013C9.8437 14.2774 9.61984 14.5013 9.3437 14.5013H8.36331C8.2307 14.5013 8.10352 14.4486 8.00975 14.3548L7.38475 13.7298C7.18949 13.5346 7.18949 13.218 7.38475 13.0227L8.00975 12.3977C8.10352 12.3039 8.2307 12.2513 8.36331 12.2513H9.3437C9.61984 12.2513 9.8437 12.4751 9.8437 12.7513V14.0013Z"></path><path fill="currentColor" d="M23.0624 8.03251L12.9374 8.03251V12.5325H23.0624V8.03251Z"></path></g><defs><clipPath id="svgid_89"><rect fill="currentColor" width="36" height="36"></rect></clipPath></defs></svg><div class="_1VoVzLPXjhlaguJLgO8htG">Suporte a atividade do Discord</div></div></div>
    </div>
  </div>
</div>
    
`.trim();
  }

  // Botão "i"
  const INFO_BTN_HTML = `
<div class="_3qDWQGB0rtwM3qpXTb11Q- Focusable" tabindex="0" role="button" aria-label="Informações">
  <div class="zvLq1GUCH3yLuqv_TXBJ1">
    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" class="SVGIcon_Button SVGIcon_Information" viewBox="0 0 256 256">
      <polyline class="I" points="86.883,110.957 152.894,110.957 152.894,181.406 177.117,181.406 177.117,202.485 86.883,202.485 86.883,181.775 109.441,181.775 109.441,130.372 86.883,130.372 "></polyline>
      <circle class="I" cx="128.47" cy="67.607" r="25.517"></circle>
      <circle fill="none" stroke="#000" stroke-width="14" stroke-miterlimit="10" cx="128" cy="128" r="116.833"></circle>
    </svg>
  </div>
</div>`.trim();

  // CSS da aba drop-down
  const CSS = `
#lg-info-section{
  display:block;
  position:relative;
  flex:0 0 auto;
  overflow:hidden;
  max-height:0;
  opacity:0;
  transform:translateY(-4px);
  transition:max-height .25s ease, opacity .2s ease, transform .2s ease;
  border-top:1px solid rgba(255,255,255,.08);
  margin-top:8px;
  width:100%;
}
#lg-info-section.lg-open{opacity:1;transform:translateY(0)}
#lg-info-section>.lg-inner{padding:12px 10px 8px}
._3qDWQGB0rtwM3qpXTb11Q-[aria-pressed="true"]{filter:brightness(1.15)}
`;

  function injectStyle(){
    if (document.getElementById('lg-info-style')) return;
    const st=document.createElement('style');
    st.id='lg-info-style'; st.textContent=CSS; document.head.appendChild(st);
  }

  // 🔧 NOVO: encontra um "root" local do jogo a partir do botão clicado
  function getLocalRootFrom(btn){
    let n = btn;
    for (let i=0; i<10 && n; i++){
      // Escolhe um container que contenha os elementos que usamos de referência
      if (n.querySelector?.('.OhSdLYuggDtBcWjYP0j_9') || n.querySelector?.(TAB_ANCHOR_SEL)) return n;
      n = n.parentElement;
    }
    return document; // safety
  }

  // 🔧 NOVO: atualiza/move a seção para o local correto (escopo local do jogo)
  function ensureSectionAfter(anchorRow, gameId, scopeRoot){
    let section = document.getElementById('lg-info-section');
    const desiredParent = scopeRoot || document;

    // ponto de inserção: antes do bloco da direita (quando existir), senão logo após a barra de abas
    const targetDiv = desiredParent.querySelector('.OhSdLYuggDtBcWjYP0j_9');

    if (!section){
      section = document.createElement('div');
      section.id = 'lg-info-section';
      section.dataset.gameId = gameId;
      section.innerHTML = `<div class="lg-inner">${buildInfoTab(gameId)}</div>`;

      if (targetDiv) targetDiv.insertAdjacentElement('beforebegin', section);
      else anchorRow.insertAdjacentElement('afterend', section);

      // mantém animação estável quando imagens terminam de carregar
      section.querySelectorAll('img').forEach(img=>{
        img.addEventListener('load', ()=> {
          if (section.classList.contains('lg-open')) {
            section.style.maxHeight = section.scrollHeight + 'px';
          }
        });
      });
      section.addEventListener('transitionend', () => {
        if (section.classList.contains('lg-open')) {
          section.style.maxHeight = 'none';
        }
      });
      return section;
    }

    // Se já existe: reposiciona se estiver no lugar errado
    const shouldBeBefore = targetDiv ? targetDiv : null;
    const isBefore = shouldBeBefore ? section.nextElementSibling === shouldBeBefore : false;
    const sameParent = section.parentElement === (shouldBeBefore?.parentElement || anchorRow.parentElement);

    if (!sameParent || (shouldBeBefore && !isBefore)){
      section.remove();
      if (targetDiv) targetDiv.insertAdjacentElement('beforebegin', section);
      else anchorRow.insertAdjacentElement('afterend', section);
    }

    // Se mudou de jogo, atualiza o conteúdo e fecha
    if (section.dataset.gameId !== gameId){
      section.querySelector('.lg-inner').innerHTML = buildInfoTab(gameId);
      section.dataset.gameId = gameId;
      section.classList.remove('lg-open');
      section.style.maxHeight = '0px';
    }

    return section;
  }

  function openClose(open){
    const section = document.getElementById('lg-info-section');
    if (!section) return;
    const willOpen = open !== undefined ? open : !section.classList.contains('lg-open');
    if (willOpen){
      section.style.maxHeight = '0px';
      section.classList.add('lg-open');
      requestAnimationFrame(()=>{
        section.style.maxHeight = section.scrollHeight + 'px';
      });
    } else {
      section.style.maxHeight = section.scrollHeight + 'px';
      requestAnimationFrame(()=>{
        section.style.maxHeight = '0px';
        section.classList.remove('lg-open');
      });
    }
  }

  function wire(ctrlBtn, gameId){
    if (ctrlBtn.dataset.lgInfoInjected !== '1'){
      const t=document.createElement('template'); t.innerHTML=INFO_BTN_HTML;
      ctrlBtn.insertAdjacentElement('afterend', t.content.firstElementChild);
      ctrlBtn.dataset.lgInfoInjected='1';
    }
    const infoBtn = ctrlBtn.nextElementSibling;
    if (!infoBtn?.querySelector?.('.SVGIcon_Information') || infoBtn.dataset.lgWired==='1') return;

    infoBtn.dataset.lgWired='1';
    infoBtn.setAttribute('aria-pressed','false');

    infoBtn.addEventListener('click',(e)=>{
      e.stopPropagation(); injectStyle();

      const scope = getLocalRootFrom(ctrlBtn);
      const anchor = scope.querySelector(TAB_ANCHOR_SEL) || ctrlBtn.parentElement;

      const section = ensureSectionAfter(anchor, gameId, scope);
      const opening = !(section.classList.contains('lg-open'));
      openClose(opening);
      infoBtn.setAttribute('aria-pressed', opening ? 'true' : 'false');
    });

    // 🔧 fecha ao clicar fora (garante apenas um listener global)
    if (!window.__lgCloseBound){
      document.addEventListener('click',(ev)=>{
        const s=document.getElementById('lg-info-section');
        if (!s?.classList.contains('lg-open')) return;
        const pressed = document.querySelector('._3qDWQGB0rtwM3qpXTb11Q-[aria-pressed="true"]');
        if (pressed?.contains(ev.target) || s.contains(ev.target)) return;
        openClose(false);
        pressed?.setAttribute?.('aria-pressed','false');
      });
      window.__lgCloseBound = true;
    }
  }

  // 🔹 Injeção
  function inject(){
    injectStyle();
    const gameId = getGameTitle();
    if (!GAME_CONFIG[gameId]) return;

    // Fecha estado antigo (se trocar de jogo)
    const s = document.getElementById('lg-info-section');
    if (s && s.dataset.gameId !== gameId){
      s.classList.remove('lg-open');
      s.style.maxHeight = '0px';
    }

    document.querySelectorAll(CTRL_SELECTOR).forEach(btn => wire(btn, gameId));
  }

  const mo = new MutationObserver(inject);
  mo.observe(document.documentElement||document.body,{childList:true,subtree:true});
  window.addEventListener('load', inject);
  inject();
})();


// ──────────────────────────────────────────────────────────────────────
// 6. Conquistas modal, RetroAchievements via helper local
// ──────────────────────────────────────────────────────────────────────
(() => {
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const RA_HELPER_BASE = "http://127.0.0.1:48766";

  function getTitleRaw() {
    return window.LG_CURRENT_GAME_RAW || "";
  }

  function getTitle() {
    return window.LG_CURRENT_GAME || "";
  }

  const RA_GAME_MAP = {
    "god of war chains of olympus": {
      raGameId: 3537,
      totalLabel: "Conquistas RetroAchievements",
      platform: "PSP"
    }
  };

  let achievements = [];
  let achievementsMeta = {
    total: 0,
    unlocked: 0,
    percentNumber: 0,
    lastSyncText: ""
  };

  // ──────────────────────────────────────────────────────────────────
  // Imagens por jogo.
  //   heroSpecial     , usado como ícone quadrado ao lado do título
  //   achievementsBg  , imagem blurred de fundo do header do modal
  //                      (se ausente, cai no heroSpecial)
  //   slot1..slot5    , imagens dos cards menores na aba da biblioteca
  // ──────────────────────────────────────────────────────────────────
  const PREVIEW_IMG_CONFIG = {
    [norm("Demon Slayer - Kimetsu no Yaiba The Hinokami Chronicles 2")]: {
      heroSpecial: "https://cdn.rafled.com/anime-icons/images/6b9e4f8e940d11b42a53e5692c3ec3d6a68ee03cd282f62666548285004507e9.jpg",
      slot1: "https://cdn.rafled.com/anime-icons/images/6b9e4f8e940d11b42a53e5692c3ec3d6a68ee03cd282f62666548285004507e9.jpg",
      slot2: "https://cdn.rafled.com/anime-icons/images/6b9e4f8e940d11b42a53e5692c3ec3d6a68ee03cd282f62666548285004507e9.jpg",
      slot3: "https://cdn.rafled.com/anime-icons/images/6b9e4f8e940d11b42a53e5692c3ec3d6a68ee03cd282f62666548285004507e9.jpg",
      slot4Special: "https://m.exophase.com/retro/awards/s/8d75d45.png?4cd89074458a59ebca8ccca63208bb7d",
      slot5: "https://m.exophase.com/retro/awards/s/64174gg.png?4cd89074458a59ebca8ccca63208bb7d"
    },

    [norm("Dragon Ball Z: Budokai Tenkaichi 3")]: {
      heroSpecial: "https://m.exophase.com/retro/awards/s/641507j.png?4cd89074458a59ebca8ccca63208bb7d",
      slot1: "https://m.exophase.com/retro/awards/s/31g0300.png?4cd89074458a59ebca8ccca63208bb7d",
      slot2: "https://m.exophase.com/retro/awards/s/04ed73b.png?4cd89074458a59ebca8ccca63208bb7d",
      slot3: "https://m.exophase.com/retro/awards/s/641507j.png?4cd89074458a59ebca8ccca63208bb7d",
      slot4Special: "https://m.exophase.com/retro/awards/s/641507j.png?4cd89074458a59ebca8ccca63208bb7d",
      slot5: "https://m.exophase.com/retro/awards/s/641507j.png?4cd89074458a59ebca8ccca63208bb7d"
    },

    [norm("God of War Chains of Olympus")]: {
      heroSpecial: "https://cdn2.steamgriddb.com/icon/c233abe6b5d62eda374b43ec404cfdb4.ico",
      achievementsBg: "https://static0.srcdn.com/wordpress/wp-content/uploads/2021/10/God-of-War-Timeline-Chains-of-Olympus-and-Ghost-of-Sparta.jpg?w=1600&h=900&fit=crop",
      slot1: "https://m.exophase.com/retro/awards/s/31g0300.png?4cd89074458a59ebca8ccca63208bb7d",
      slot2: "https://m.exophase.com/retro/awards/s/04ed73b.png?4cd89074458a59ebca8ccca63208bb7d",
      slot3: "https://m.exophase.com/retro/awards/s/641507j.png?4cd89074458a59ebca8ccca63208bb7d",
      slot4Special: "https://m.exophase.com/retro/awards/s/641507j.png?4cd89074458a59ebca8ccca63208bb7d",
      slot5: "https://m.exophase.com/retro/awards/s/641507j.png?4cd89074458a59ebca8ccca63208bb7d"
    },

    [norm("God of War III")]: {
      heroSpecial: "https://m.exophase.com/psn/awards/s/0d43eg.png?a6f7613c12ec427f2486f37d6847a129",
      slot1: "https://m.exophase.com/psn/awards/s/0d43eg.png?a6f7613c12ec427f2486f37d6847a129",
      slot2: "https://m.exophase.com/psn/awards/s/0d43eg.png?a6f7613c12ec427f2486f37d6847a129",
      slot4Special: "https://m.exophase.com/psn/awards/s/0d43eg.png?a6f7613c12ec427f2486f37d6847a129",
      slot5: "https://m.exophase.com/psn/awards/s/0d43eg.png?a6f7613c12ec427f2486f37d6847a129"
    }
  };

  function getPreviewImagesFor(titleNorm) {
    const defaults = {
      heroSpecial: "https://cdn.steamstatic.com/steamcommunity/public/images/apps/2928600/f856022fe0d738155ed0fa2dd698b19ef9bf9e90.jpg",
      slot1: "https://cdn.steamstatic.com/steamcommunity/public/images/apps/2928600/9cd72bd438cb231bca826e89f66d89aed41e1704.jpg",
      slot2: "https://cdn.steamstatic.com/steamcommunity/public/images/apps/2928600/f856022fe0d738155ed0fa2dd698b19ef9bf9e90.jpg",
      slot3: "https://cdn.steamstatic.com/steamcommunity/public/images/apps/2928600/31d9453c835698e212a42678668df1e04c95ec3a.jpg",
      slot4Special: "https://cdn.steamstatic.com/steamcommunity/public/images/apps/2928600/e87aaeb4bf4aaeefabb626a8055183d1266657a9.jpg",
      slot5: "https://cdn.steamstatic.com/steamcommunity/public/images/apps/2928600/9c31604dfb13b2376ef873aa0e7c9f995e5c2530.jpg",
    };
    const cfg = PREVIEW_IMG_CONFIG[titleNorm];
    if (!cfg) return null;
    return { ...defaults, ...cfg };
  }

  function getExactGameId() {
    const t = getTitle();
    return Object.prototype.hasOwnProperty.call(PREVIEW_IMG_CONFIG, t) ? t : null;
  }

  function getMappedRetroGame() {
    const t = getTitle();
    return RA_GAME_MAP[t] || null;
  }

  function formatDatePtBR(value) {
    if (!value) return "Ainda não desbloqueada";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("pt-BR");
  }

  function safePercentText(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0%";
    return `${n.toFixed(1)}%`;
  }

  function buildAchievementItem(raw) {
    return {
      img: raw.img || raw.icon || raw.badge || "",
      title: raw.title || raw.name || "Conquista sem nome",
      desc: raw.desc || raw.description || "",
      percent: safePercentText(raw.percent || raw.rarity || 0),
      date: formatDatePtBR(raw.date || raw.unlockDate || raw.unlockedAt || "")
    };
  }

function getGameCacheKey() {
  const title = getTitle() || "unknown";
  return `lg_ra_cache:${title}`;
}

function saveAchievementsCache() {
  try {
    localStorage.setItem(getGameCacheKey(), JSON.stringify({
      achievements,
      achievementsMeta,
      savedAt: new Date().toISOString()
    }));
  } catch {}
}

function loadAchievementsCache() {
  try {
    const raw = localStorage.getItem(getGameCacheKey());
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.achievements) || !parsed.achievementsMeta) return false;

    achievements = parsed.achievements.slice();
    achievementsMeta = {
      total: Number(parsed.achievementsMeta.total || 0),
      unlocked: Number(parsed.achievementsMeta.unlocked || 0),
      percentNumber: Number(parsed.achievementsMeta.percentNumber || 0),
      lastSyncText: parsed.achievementsMeta.lastSyncText || "Cache local"
    };
    return true;
  } catch {
    return false;
  }
}

function updateExtraInfoAchievementsUI() {
  try {
    const total = Number(achievementsMeta.total || 0);
    const unlocked = Number(achievementsMeta.unlocked || 0);
    const progress = Number(achievementsMeta.percentNumber || 0);

    document.querySelectorAll(".lg-achievements").forEach((root) => {
      const valueEl = root.querySelector("._2muiKHUkOiTvX-6arqnQUC");
      const barEl = root.querySelector("._1FnTqlsi2_-TJf1d5apoS6");
      const progressEl = root.querySelector('[role="progressbar"]');

      if (valueEl) valueEl.textContent = `${unlocked}/${total}`;
      if (barEl) barEl.style.width = `${Math.max(0, Math.min(100, progress))}%`;
      if (progressEl) progressEl.setAttribute("aria-valuenow", String(Math.round(progress)));

      root.style.cursor = "pointer";
      root.setAttribute("role", "button");
      root.setAttribute("tabindex", "0");
      root.setAttribute("data-lg-open-achievements", "1");
    });
  } catch {}
}

async function refreshAchievementsSilently() {
  try {
    await loadAchievementsFromRetro();
  } catch {}
}

function getGameCacheKey() {
  const title = getTitle() || "unknown";
  return `lg_ra_cache:${title}`;
}

function saveAchievementsCache() {
  try {
    const payload = {
      achievements,
      achievementsMeta,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(getGameCacheKey(), JSON.stringify(payload));
  } catch {}
}

function loadAchievementsCache() {
  try {
    const raw = localStorage.getItem(getGameCacheKey());
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.achievements) || !parsed.achievementsMeta) return false;

    achievements = parsed.achievements;
    achievementsMeta = {
      total: Number(parsed.achievementsMeta.total || 0),
      unlocked: Number(parsed.achievementsMeta.unlocked || 0),
      percentNumber: Number(parsed.achievementsMeta.percentNumber || 0),
      lastSyncText: parsed.achievementsMeta.lastSyncText || "Cache local"
    };
    return true;
  } catch {
    return false;
  }
}

function updateExtraInfoAchievementsUI() {
  try {
    const total = Number(achievementsMeta.total || 0);
    const unlocked = Number(achievementsMeta.unlocked || 0);
    const progress = Number(achievementsMeta.percentNumber || 0);

    const nodes = document.querySelectorAll(".lg-achievements");
    nodes.forEach((root) => {
      const valueEl = root.querySelector("._2muiKHUkOiTvX-6arqnQUC");
      const barEl = root.querySelector("._1FnTqlsi2_-TJf1d5apoS6");
      const progressWrap = root.querySelector('[role="progressbar"]');

      if (valueEl) valueEl.textContent = `${unlocked}/${total}`;
      if (barEl) barEl.style.width = `${Math.max(0, Math.min(100, progress))}%`;
      if (progressWrap) progressWrap.setAttribute("aria-valuenow", String(Math.round(progress)));
    });
  } catch {}
}

function updateAchievementsSummaryUI() {
  try {
    const total = Number(achievementsMeta.total || achievements.length || 0);
    const unlocked = Number(achievementsMeta.unlocked || 0);
    const progress = Math.max(0, Math.min(100, Number(achievementsMeta.percentNumber || 0)));

    document.querySelectorAll("[data-lg-achievements-section]").forEach((section) => {
      const textEl = section.querySelector("[data-lg-ach-summary-text]");
      const percentEl = section.querySelector("[data-lg-ach-summary-percent]");
      const barEl = section.querySelector("[data-lg-ach-summary-bar]");

      if (textEl) textEl.textContent = `${unlocked}/${total} alcançadas`;
      if (percentEl) percentEl.textContent = ` (${Math.round(progress)}%)`;
      if (barEl) barEl.style.width = `${progress}%`;
    });
  } catch {}
}

  async function helperGet(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${RA_HELPER_BASE}${path}${query ? `?${query}` : ""}`;
    const res = await fetch(url);

    if (!res.ok) {
      let text = "";
      try { text = await res.text(); } catch {}
      throw new Error(text || `HTTP ${res.status}`);
    }

    return await res.json();
  }

async function loadAchievementsFromRetro() {
  const mapped = getMappedRetroGame();

  if (!mapped) {
    achievements = [{
      img: "",
      title: "Jogo sem mapeamento",
      desc: "Este jogo ainda não foi vinculado ao RetroAchievements.",
      percent: "0%",
      date: ""
    }];
    achievementsMeta = {
      total: 0,
      unlocked: 0,
      percentNumber: 0,
      lastSyncText: "Sem mapeamento"
    };
    updateExtraInfoAchievementsUI();
    updateAchievementsSummaryUI();
    return;
  }

  try {
    const data = await helperGet("/achievements", {
      gameId: mapped.raGameId
    });

    const list = Array.isArray(data.achievements) ? data.achievements : [];
    achievements = list.map(buildAchievementItem);

    achievementsMeta = {
      total: Number(data.total || achievements.length || 0),
      unlocked: Number(data.unlocked || 0),
      percentNumber: Number(data.progress || 0),
      lastSyncText: formatDatePtBR(data.syncedAt || new Date().toISOString())
    };

    if (!achievements.length) {
      achievements = [{
        img: "",
        title: "Nenhuma conquista retornada",
        desc: "O helper respondeu, mas não trouxe conquistas para este jogo.",
        percent: "0%",
        date: ""
      }];
    }

    saveAchievementsCache();
    updateExtraInfoAchievementsUI();
    updateAchievementsSummaryUI();
    return;
  } catch (err) {
    const loadedFromCache = loadAchievementsCache();
    if (loadedFromCache) {
      achievementsMeta.lastSyncText = `${achievementsMeta.lastSyncText || "Cache local"} • offline`;
      updateExtraInfoAchievementsUI();
      updateAchievementsSummaryUI();
      return;
    }

    achievements = [{
      img: "",
      title: "Erro ao carregar conquistas",
      desc: "Sem conexão e sem cache salvo para este jogo.",
      percent: "0%",
      date: ""
    }];
    achievementsMeta = {
      total: 0,
      unlocked: 0,
      percentNumber: 0,
      lastSyncText: "Falha"
    };
    updateExtraInfoAchievementsUI();
    updateAchievementsSummaryUI();
  }
}


  // mantém o visual pequeno original
function sectionHTML(previews) {
  const total = Number(achievementsMeta.total || achievements.length || 0);
  const unlocked = Number(achievementsMeta.unlocked || 0);
  const progress = Math.max(0, Math.min(100, Number(achievementsMeta.percentNumber || 0)));

  return `
<div role="region" aria-labelledby="lg-achievements-title" class="_2r4TK4BAuU-J4FuF_O7v_5 Panel" data-lg-achievements-section="1">
  <h2 class="_3A_c3YHYd4YIjA8Y-olnPl _1Q2q_tQ9_Eq8YdEHNAHS3F _3jY6xWI4URhFyYsanh9VKL" id="lg-achievements-title">
    <div class="_1SQ30LQnUhED7sXI79rmas">
      <div class="_3i0kopAostOz2IDi9HqmeN">Conquistas</div>
    </div>
  </h2>

  <div class="_31ptFGGMZrSQc5BCX1e5lm _2G5B7o_YoI__u11--EFjal _3KfxIwlXEvum7FCD_AM2_t Panel" tabindex="0" role="button">
    <div class="_38t1mljBjmJfqjpVzMT1CG _2xTb6N-jUUQ-mIkMB6OVMm" data-lg-ach-summary="1">
      <div class="_3jC8om-5Sci_dkUB-6VYiU">
        <span data-lg-ach-summary-text>${unlocked}/${total} alcançadas</span>
        <span class="_14kZVEyaz7WX57N47z4Yr1" data-lg-ach-summary-percent> (${Math.round(progress)}%)</span>
      </div>
      <div class="_3ns9185LizH61StaAXuAp6">
        <div class="_3Rm36_oeAhvIg6ZYP9l1Jj" data-lg-ach-summary-bar style="width: ${progress}%;"></div>
      </div>
      <div class="_1LNALpkg3wnKm61YtxBCOb"></div>
    </div>

    <div class="_5uvIN6jXDXzzck59F-nhv">
      <div role="link" class="_14U8eM1W6Z4uJhCc5zvbKC MGoYUyIslJerluzgnU7z9 _1j_gja8bHXjiS-BeSQk8hb Panel" tabindex="0">
        <div class="_2CK1m9x0gtA_oSAQa2FpS3 Panel">
          <div class="_1fEbX-PfpZ2FhkhttWcm-V zcasgBSVIteabq-j_3g1m">
            <img class="_2V2sHETNfa62yMoDwSF3_t" loading="lazy" src="https://shared.steamstatic.com/community_assets/images/apps/2322010/dff9f0238f37a57f15f4421e639ca9acf90757eb.jpg">
          </div>
        </div>
        <div class="_1s_9cSxUjb4609MSH0EjWH">
          <div class="_39Y01uSRcLiDg5DneTTR0m">Lustrado com Cuspe</div>
          <div class="_2gLHbXukQBdrIKhqEYVvOe">Aprimore uma peça de armadura</div>
        </div>
      </div>

      <div class="_3eVREaIAGyRjbf0bkFjR9Y">
        <div class="_1IIKwlQaVZU6bIeEQJvmTK">
          <div class="_2H_ytAwp5tfeou0kdWjLl4"><div role="link" class="_2aVnDeExEHiUFX0zwr_BTO MGoYUyIslJerluzgnU7z9 Panel" tabindex="0"><div class="_2CK1m9x0gtA_oSAQa2FpS3 Panel"><div class="_1fEbX-PfpZ2FhkhttWcm-V zcasgBSVIteabq-j_3g1m"><img class="_2V2sHETNfa62yMoDwSF3_t" loading="lazy" src="https://shared.steamstatic.com/community_assets/images/apps/2322010/460fecc92590775db4e2cf2c8f4055559d90fa59.jpg"></div></div></div></div>
          <div class="_2H_ytAwp5tfeou0kdWjLl4"><div role="link" class="_2aVnDeExEHiUFX0zwr_BTO MGoYUyIslJerluzgnU7z9 Panel" tabindex="0"><div class="_2CK1m9x0gtA_oSAQa2FpS3 Panel"><div class="_1fEbX-PfpZ2FhkhttWcm-V zcasgBSVIteabq-j_3g1m"><img class="_2V2sHETNfa62yMoDwSF3_t" loading="lazy" src="https://shared.steamstatic.com/community_assets/images/apps/2322010/b774621d4b562f5f2f808e73682080f7c8f905db.jpg"></div></div></div></div>
        </div>
      </div>

      <div class="_3ca11X3AK6npLS3emMa5Lr _3i6PczGBBYzCDZXkCDbJAD">
        <div class="uoFNFZ7Hs5cF1IjP2fvPw">Conquistas para alcançar</div>
        <div class="_3eVREaIAGyRjbf0bkFjR9Y">
          <div class="_1IIKwlQaVZU6bIeEQJvmTK">
            <div class="_2H_ytAwp5tfeou0kdWjLl4"><div role="link" class="_2aVnDeExEHiUFX0zwr_BTO _3llpbyrXsfwsh1apqHhPfB Panel" tabindex="0"><div class="_2CK1m9x0gtA_oSAQa2FpS3 Panel"><div class="_1fEbX-PfpZ2FhkhttWcm-V zcasgBSVIteabq-j_3g1m"><img class="_2V2sHETNfa62yMoDwSF3_t" loading="lazy" src="https://shared.steamstatic.com/community_assets/images/apps/2322010/95071084c9b0057cef21ffe0ba95bf63c3b8dac0.jpg"></div></div></div></div>
            <div class="_2H_ytAwp5tfeou0kdWjLl4"><div role="link" class="_2aVnDeExEHiUFX0zwr_BTO _3llpbyrXsfwsh1apqHhPfB Panel" tabindex="0"><div class="_2CK1m9x0gtA_oSAQa2FpS3 Panel"><div class="_1fEbX-PfpZ2FhkhttWcm-V zcasgBSVIteabq-j_3g1m"><img class="_2V2sHETNfa62yMoDwSF3_t" loading="lazy" src="https://shared.steamstatic.com/community_assets/images/apps/2322010/f29caddf5e76ef8337090da30b978f76da70adc1.jpg"></div></div></div></div>
            <div class="_2H_ytAwp5tfeou0kdWjLl4"><div role="link" class="_2aVnDeExEHiUFX0zwr_BTO _3llpbyrXsfwsh1apqHhPfB Panel" tabindex="0"><div class="_2CK1m9x0gtA_oSAQa2FpS3 Panel"><div class="_1fEbX-PfpZ2FhkhttWcm-V zcasgBSVIteabq-j_3g1m"><img class="_2V2sHETNfa62yMoDwSF3_t" loading="lazy" src="https://shared.steamstatic.com/community_assets/images/apps/2322010/c4644281972470405f58160e7dfcd7a74a3dd62e.jpg"></div></div></div></div>
            <div class="_2H_ytAwp5tfeou0kdWjLl4"><div role="link" class="_2aVnDeExEHiUFX0zwr_BTO _3llpbyrXsfwsh1apqHhPfB Panel" tabindex="0"><div class="_2CK1m9x0gtA_oSAQa2FpS3 Panel"><div class="_1fEbX-PfpZ2FhkhttWcm-V zcasgBSVIteabq-j_3g1m"><img class="_2V2sHETNfa62yMoDwSF3_t" loading="lazy" src="https://shared.steamstatic.com/community_assets/images/apps/2322010/14cd4364e153c671fa3003e0322157620f0137c4.jpg"></div></div></div></div>
            <div class="_2H_ytAwp5tfeou0kdWjLl4"><div role="link" class="_2aVnDeExEHiUFX0zwr_BTO _3llpbyrXsfwsh1apqHhPfB Panel" tabindex="0"><div class="_2CK1m9x0gtA_oSAQa2FpS3 Panel"><div class="_1fEbX-PfpZ2FhkhttWcm-V zcasgBSVIteabq-j_3g1m"><img class="_2V2sHETNfa62yMoDwSF3_t" loading="lazy" src="https://shared.steamstatic.com/community_assets/images/apps/2322010/1255cb8abab40f1c6cb0a6bf9992a425797926fd.jpg"></div></div></div></div>
            <div class="_2H_ytAwp5tfeou0kdWjLl4"><div class="_2aVnDeExEHiUFX0zwr_BTO lZ2c49vTWJ60klQOY9l2K Panel" tabindex="0" role="button"><div class="_2gISWIeEzZ9PNuAzVuMaWd"><div class="_1-H7tKj_QcGHLUbx5wVsGg">+40</div></div></div></div>
          </div>
        </div>
      </div>

      <button type="button" class="_3Cdin80d-hVsakHUZboheb _3nJyYxGQ3kdwwabPmxNnMe DialogButton _DialogLayout Secondary Focusable" role="button">
        Ver as minhas conquistas
      </button>
    </div>
  </div>
</div>`.trim();
}
  function isUnlockedAchievement(a) {
    const date = String(a.date || "").trim().toLowerCase();
    return !!date && date !== "ainda não desbloqueada";
  }

  function renderAchievementCard(a) {
    const unlocked = isUnlockedAchievement(a);
    return `
      <div class="lg-steam-ach-row" data-unlocked="${unlocked ? "1" : "0"}">
        <div class="lg-steam-ach-row__left">
          <div class="lg-steam-ach-row__icon">
            ${
              a.img
                ? `<img src="${a.img}" alt="${a.title}">`
                : `<div class="lg-steam-ach-row__icon-fallback">-</div>`
            }
          </div>
          <div class="lg-steam-ach-row__body">
            <div class="lg-steam-ach-row__title">${a.title}</div>
            <div class="lg-steam-ach-row__desc">${a.desc}</div>
          </div>
        </div>
        <div class="lg-steam-ach-row__date">
          ${unlocked ? `Alcançada em ${a.date}` : "Ainda não desbloqueada"}
        </div>
      </div>
    `;
  }

  function renderModalHTML(list, headerImg, gameTitle, bgImg) {
    const all = Array.isArray(list) ? list : [];
    const unlockedList = all.filter(isUnlockedAchievement);
    const lockedList = all.filter(a => !isUnlockedAchievement(a));

    const total = Number(achievementsMeta.total || all.length || 0);
    const unlocked = Number(achievementsMeta.unlocked || unlockedList.length || 0);
    const progress = Number(
      achievementsMeta.percentNumber ||
      (total > 0 ? (unlocked / total) * 100 : 0)
    );
    const progressClamped = Math.max(0, Math.min(100, progress));

    // Imagem de fundo do header: usa bgImg se existir, senão cai no headerImg
    const finalBg = bgImg || headerImg || "";

    // Paleta Steam oficial (Biblioteca)
    const css = `
      .lg-steam-modal{
        --bg:#0E141B;          /* fundo do modal */
        --row-bg:#23262E;      /* fundo dos cards de conquista */
        --text:#DCDEDF;        /* título da conquista */
        --text-dim:#ADB1B4;    /* descrição / texto secundário */
        --text-mute:#7a8289;
        --search-bg:#252A31;   /* fundo do campo de busca */
        background:var(--bg);
        color:var(--text);
        font-family:"Motiva Sans","Segoe UI",system-ui,sans-serif;
        -webkit-font-smoothing:antialiased;
      }
      .lg-steam-modal *{box-sizing:border-box}

      /* ── HEADER (a imagem de fundo vai até embaixo do tab) ── */
      .lg-steam-header{
        position:relative;
        padding:20px 26px 18px 26px;
        overflow:hidden;
        isolation:isolate;
      }
      .lg-steam-header__bg{
        position:absolute;inset:0;z-index:-1;
        background-size:cover;
        background-position:center 30%;
        filter:blur(2px) saturate(1.1);
        transform:scale(1.05);
        opacity:0.6;
      }
      .lg-steam-header__overlay{
        position:absolute;inset:0;z-index:-1;
        background:linear-gradient(180deg, rgba(14,20,27,0.45) 0%, rgba(14,20,27,0.78) 80%, rgba(14,20,27,0.92) 100%);
      }

      .lg-steam-header__title-row{
        display:flex;
        align-items:center;
        gap:12px;
        margin-bottom:12px;
      }
      .lg-steam-header__icon{
        width:36px;
        height:36px;
        border-radius:4px;
        overflow:hidden;
        flex-shrink:0;
        background:rgba(0,0,0,0.3);
      }
      .lg-steam-header__icon img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }
      .lg-steam-header__title{
        font-size:22px;
        font-weight:700;
        color:#fff;
        line-height:1.2;
        letter-spacing:-0.2px;
        margin:0;
      }

      /* ── BARRA DE PROGRESSO ──────────────────────── */
      .lg-steam-progress{
        margin-bottom:16px;
      }
      .lg-steam-progress__row{
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:6px;
        font-size:11px;
        font-weight:700;
        letter-spacing:0.6px;
        text-transform:uppercase;
        color:var(--text);
      }
      .lg-steam-progress__percent{
        font-size:11px;
        font-weight:700;
        color:var(--text);
      }
      .lg-steam-progress__bar{
        width:70%;
        height:6px;
        background:rgba(0,0,0,0.35);
        border-radius:999px;
        overflow:hidden;
      }
      .lg-steam-progress__fill{
        height:100%;
        background:linear-gradient(90deg,#1a9fff,#66c0f4);
        border-radius:999px;
        transition:width 0.5s ease;
      }

      /* ── TAB (só "Minhas conquistas", centralizado) ── */
      .lg-steam-tabs{
        display:flex;
        justify-content:center;
        padding:0;
      }
      .lg-steam-tabs__item{
        padding:8px 22px;
        border-radius:999px;
        font-size:12px;
        font-weight:700;
        letter-spacing:1px;
        text-transform:uppercase;
        color:#fff;
        background:rgba(255,255,255,0.08);
        cursor:default;
        user-select:none;
      }

      /* ── BODY ────────────────────────────────────── */
      .lg-steam-body{
        padding:14px 26px 30px 26px;
        background:var(--bg);
      }

      /* ── BUSCA ───────────────────────────────────── */
      .lg-steam-search{
        display:flex;
        justify-content:flex-end;
        padding:4px 0 14px 0;
      }
      .lg-steam-search__input{
        width:min(340px,50%);
        background:var(--search-bg);
        border:1px solid rgba(255,255,255,0.04);
        border-radius:4px;
        padding:10px 14px;
        color:var(--text);
        font-size:14px;
        outline:none;
        transition:border-color 0.2s ease;
      }
      .lg-steam-search__input::placeholder{
        color:var(--text-mute);
        font-style:italic;
      }
      .lg-steam-search__input:focus{
        border-color:rgba(102,192,244,0.4);
      }

      /* ── SESSION LABEL ───────────────────────────── */
      .lg-steam-section-label{
        font-size:11px;
        font-weight:700;
        letter-spacing:1.5px;
        text-transform:uppercase;
        color:var(--text-mute);
        margin:14px 0 10px 0;
      }
      .lg-steam-section-label:first-child{ margin-top:0 }

      /* ── LINHA DE CONQUISTA ──────────────────────── */
      .lg-steam-list{
        display:flex;
        flex-direction:column;
        gap:6px;
      }
      .lg-steam-ach-row{
        display:flex;
        align-items:center;
        gap:16px;
        padding:11px 14px;
        background:var(--row-bg);
        border-radius:4px;
      }
      .lg-steam-ach-row__left{
        display:flex;
        align-items:center;
        gap:14px;
        min-width:0;
        flex:1;
      }
      .lg-steam-ach-row__icon{
        width:48px;
        height:48px;
        flex-shrink:0;
        border-radius:4px;
        overflow:hidden;
        background:#0b0f15;
        display:flex;
        align-items:center;
        justify-content:center;
      }
      .lg-steam-ach-row__icon img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }
      .lg-steam-ach-row[data-unlocked="0"] .lg-steam-ach-row__icon img{
        filter:grayscale(100%) brightness(0.55);
      }
      .lg-steam-ach-row__icon-fallback{
        color:var(--text-mute);
        font-size:12px;
      }
      .lg-steam-ach-row__body{
        min-width:0;
        flex:1;
      }
      .lg-steam-ach-row__title{
        font-size:14px;
        font-weight:700;
        color:var(--text);
        line-height:1.3;
        margin-bottom:2px;
      }
      .lg-steam-ach-row__desc{
        font-size:12px;
        color:var(--text-dim);
        line-height:1.35;
      }
      .lg-steam-ach-row__date{
        flex-shrink:0;
        font-size:12px;
        color:var(--text-dim);
        text-align:right;
        white-space:nowrap;
        padding-left:16px;
      }
      .lg-steam-ach-row[data-unlocked="0"] .lg-steam-ach-row__date{
        color:var(--text-mute);
      }

      /* Empty state */
      .lg-steam-empty{
        padding:50px 20px;
        text-align:center;
        color:var(--text-mute);
        font-size:14px;
      }

      /* Responsivo */
      @media(max-width:680px){
        .lg-steam-header{ padding:16px 18px 14px 18px }
        .lg-steam-header__title{ font-size:18px }
        .lg-steam-body{ padding:12px 18px 24px 18px }
        .lg-steam-progress__bar{ width:100%; }
        .lg-steam-ach-row__date{ display:none }
      }
    `;

    const unlockedRows = unlockedList.map(renderAchievementCard).join("");
    const lockedRows = lockedList.map(renderAchievementCard).join("");

    return `
      <style>${css}</style>
      <div class="lg-steam-modal">

        <!-- HEADER: imagem blurred se estende até atrás dos tabs -->
        <div class="lg-steam-header">

          <div class="lg-steam-header__title-row">
            ${headerImg ? `<div class="lg-steam-header__icon"><img src="${headerImg}" alt=""></div>` : ""}
            <h1 class="lg-steam-header__title">${gameTitle || "Conquistas"}</h1>
          </div>

          <div class="lg-steam-progress">
            <div class="lg-steam-progress__row">
              <span>${unlocked} de ${total} conquistas alcançadas</span>
              <span class="lg-steam-progress__percent">(${Math.round(progress)}%)</span>
            </div>
            <div class="lg-steam-progress__bar">
              <div class="lg-steam-progress__fill" style="width:${progressClamped}%"></div>
            </div>
          </div>

          <div class="lg-steam-tabs">
            <div class="lg-steam-tabs__item">Minhas conquistas</div>
          </div>
        </div>

        <!-- BODY -->
        <div class="lg-steam-body">
          <div class="lg-steam-search">
            <input type="text" class="lg-steam-search__input" placeholder="Buscar" data-lg-ach-search />
          </div>

          <div data-lg-ach-unlocked-wrap>
            ${
              unlockedList.length
                ? `<div class="lg-steam-list" data-lg-ach-unlocked-list>${unlockedRows}</div>`
                : ""
            }
          </div>

          <div data-lg-ach-locked-wrap>
            ${
              lockedList.length
                ? `<div class="lg-steam-section-label" data-lg-ach-locked-label>Conquistas não alcançadas</div>
                   <div class="lg-steam-list" data-lg-ach-locked-list>${lockedRows}</div>`
                : ""
            }
          </div>

          <div class="lg-steam-empty" data-lg-ach-empty style="display:${all.length ? "none" : "block"}">
            ${all.length ? "" : "Nenhuma conquista encontrada."}
          </div>
        </div>

      </div>
    `;
  }

  // ─────────────────────────────────────────────────
  // BUSCA FUNCIONAL, liga no modal depois de renderizar
  // ─────────────────────────────────────────────────
  function wireSearch(wrap) {
    const input = wrap.querySelector("[data-lg-ach-search]");
    if (!input) return;

    const doFilter = () => {
      const q = norm(input.value || "").trim();

      const rows = wrap.querySelectorAll(".lg-steam-ach-row");
      let visibleUnlocked = 0;
      let visibleLocked = 0;

      rows.forEach(row => {
        const title = norm(row.querySelector(".lg-steam-ach-row__title")?.textContent || "");
        const desc  = norm(row.querySelector(".lg-steam-ach-row__desc")?.textContent || "");
        const match = !q || title.includes(q) || desc.includes(q);
        row.style.display = match ? "" : "none";

        if (match) {
          if (row.dataset.unlocked === "1") visibleUnlocked++;
          else visibleLocked++;
        }
      });

      // Esconde a label/lista de cada seção se não tiver nada visível
      const lockedLabel = wrap.querySelector("[data-lg-ach-locked-label]");
      const lockedList  = wrap.querySelector("[data-lg-ach-locked-list]");
      if (lockedLabel) lockedLabel.style.display = visibleLocked ? "" : "none";
      if (lockedList)  lockedList.style.display  = visibleLocked ? "" : "none";

      const unlockedList = wrap.querySelector("[data-lg-ach-unlocked-list]");
      if (unlockedList) unlockedList.style.display = visibleUnlocked ? "" : "none";

      // Empty state quando nada bate com a busca
      const total = rows.length;
      const empty = wrap.querySelector("[data-lg-ach-empty]");
      if (empty && total > 0) {
        if (visibleUnlocked + visibleLocked === 0 && q) {
          empty.textContent = `Nenhuma conquista encontrada para "${input.value.trim()}".`;
          empty.style.display = "block";
        } else {
          empty.style.display = "none";
        }
      }
    };

    input.addEventListener("input", doFilter);
  }

  function ensureModal() {
    let wrap = document.getElementById("lg-achievements-modal");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.id = "lg-achievements-modal";
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:99999; display:none;
      background:rgba(0,0,0,.72); backdrop-filter:blur(10px);
      place-items:center; padding:20px;
    `;

    wrap.innerHTML = `
      <div class="lg-modal__content" tabindex="-1" style="
        width:min(920px,96vw); max-height:88vh; overflow:hidden;
        border-radius:6px; background:#0E141B; border:1px solid rgba(255,255,255,.06);
        box-shadow:0 30px 90px rgba(0,0,0,.75); position:relative;
      ">
        <button class="lg-modal__close" aria-label="Fechar" style="
          position:absolute; top:14px; right:14px; z-index:3;
          width:34px; height:34px; border-radius:999px; border:none;
          background:rgba(0,0,0,.4); color:#fff; cursor:pointer; font-size:16px;
          display:flex; align-items:center; justify-content:center;
          backdrop-filter:blur(8px); transition:background 0.2s ease;
        ">✕</button>
        <div class="lg-modal__body" style="overflow:auto; max-height:88vh;"></div>
      </div>
    `;

    wrap.addEventListener("click", (ev) => {
      if (ev.target === wrap) wrap.style.display = "none";
    });

    wrap.querySelector(".lg-modal__close").addEventListener("click", () => {
      wrap.style.display = "none";
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") wrap.style.display = "none";
    });

    document.body.appendChild(wrap);
    return wrap;
  }

  function openModalWith(html) {
    const wrap = ensureModal();
    const content = wrap.querySelector(".lg-modal__content");
    const body = wrap.querySelector(".lg-modal__body");
    body.innerHTML = html;
    wrap.style.display = "grid";
    wireSearch(body);
    content?.focus();
  }

  function replaceNotes() {
    const gameId = getExactGameId();
    if (!gameId) return;

    const previews = getPreviewImagesFor(gameId);

    const h2 = Array.from(document.querySelectorAll("h2, [role='heading']"))
      .find(h => norm(h.textContent || "").includes("gravacoes e capturas de tela"));
    if (!h2) return;

    const region = h2.closest("[role='region']");
    if (!region) return;

    const wrapper = region.closest(".vzLedtsu3TtTlKLEKzIhH");
    if (!wrapper || !wrapper.parentElement) return;

    const prev = wrapper.previousElementSibling;
    if (prev && prev.matches("[data-lg-achievements-section]")) return;

    const tmp = document.createElement("div");
    tmp.innerHTML = sectionHTML(previews);
    const newNode = tmp.firstElementChild;
    wrapper.parentElement.insertBefore(newNode, wrapper);
  }

  async function openAchievementsFromRetro() {
    const gid = getExactGameId();
    if (!gid) return;

    const previews = getPreviewImagesFor(gid);
    const headerImg = previews?.heroSpecial || "";
    const bgImg = previews?.achievementsBg || previews?.heroSpecial || "";

    achievements = [{
      img: "",
      title: "Carregando conquistas...",
      desc: "Buscando dados do RetroAchievements pelo helper local.",
      percent: "0%",
      date: ""
    }];

    achievementsMeta = {
      total: 0,
      unlocked: 0,
      percentNumber: 0,
      lastSyncText: ""
    };

    openModalWith(renderModalHTML(achievements, headerImg, getTitleRaw(), bgImg));

    try {
      await loadAchievementsFromRetro();
    } catch (err) {
      achievements = [{
        img: "",
        title: "Erro ao carregar conquistas",
        desc: "Verifique se o helper local do RetroAchievements está rodando.",
        percent: "0%",
        date: ""
      }];
      achievementsMeta = {
        total: 0,
        unlocked: 0,
        percentNumber: 0,
        lastSyncText: "Falha"
      };
    }

    openModalWith(renderModalHTML(achievements, headerImg, getTitleRaw(), bgImg));
  }

document.addEventListener("click", (ev) => {
  const extraInfoCard = ev.target.closest(".lg-achievements");
  if (extraInfoCard) {
    ev.preventDefault();
    ev.stopPropagation();
    openAchievementsFromRetro();
    return;
  }

  const btn = ev.target.closest("button, a, div[role='button'], div[role='link']");
  if (!btn) return;

  const section = btn.closest("[data-lg-achievements-section]");
  if (!section) return;

  const txt = norm(btn.textContent || "");
  if (txt.includes("ver as minhas conquistas") || txt.includes("veja todas")) {
    ev.preventDefault();
    ev.stopPropagation();
    openAchievementsFromRetro();
  }
}, { capture: true });

document.addEventListener("keydown", (ev) => {
  if (ev.key !== "Enter" && ev.key !== " ") return;

  const extraInfoCard = ev.target.closest(".lg-achievements");
  if (!extraInfoCard) return;

  ev.preventDefault();
  ev.stopPropagation();
  openAchievementsFromRetro();
}, { capture: true });

function updateAchievementsSummaryUI() {
  try {
    const total = Number(achievementsMeta.total || achievements.length || 0);
    const unlocked = Number(achievementsMeta.unlocked || 0);
    const progress = Math.max(0, Math.min(100, Number(achievementsMeta.percentNumber || 0)));

    document.querySelectorAll("[data-lg-achievements-section]").forEach((section) => {
      const textEl = section.querySelector("[data-lg-ach-summary-text]");
      const percentEl = section.querySelector("[data-lg-ach-summary-percent]");
      const barEl = section.querySelector("[data-lg-ach-summary-bar]");

      if (textEl) textEl.textContent = `${unlocked}/${total} alcançadas`;
      if (percentEl) percentEl.textContent = ` (${Math.round(progress)}%)`;
      if (barEl) barEl.style.width = `${progress}%`;
    });
  } catch {}
}

let lgRefreshTimer = null;
let lgLastAppliedGame = "";

function applyAchievementsUIFromCurrentState() {
  updateExtraInfoAchievementsUI();
  updateAchievementsSummaryUI();
}

function scheduleSilentRefresh(delay = 120) {
  clearTimeout(lgRefreshTimer);
  lgRefreshTimer = setTimeout(() => {
    refreshAchievementsSilently();
  }, delay);
}

function bootstrapAchievementsForCurrentGame(forceRefresh = false) {
  const currentTitle = getTitle();

  if (!forceRefresh && currentTitle === lgLastAppliedGame) {
    applyAchievementsUIFromCurrentState();
    return;
  }

  lgLastAppliedGame = currentTitle;

  achievements = [];
  achievementsMeta = {
    total: 0,
    unlocked: 0,
    percentNumber: 0,
    lastSyncText: ""
  };

  loadAchievementsCache();
  applyAchievementsUIFromCurrentState();

  if (forceRefresh || currentTitle) {
    scheduleSilentRefresh(120);
  }
}

const mo = new MutationObserver(() => {
  replaceNotes();
  applyAchievementsUIFromCurrentState();
});
mo.observe(document.body, { childList: true, subtree: true });

window.addEventListener("LG:gamechange", () => {
  bootstrapAchievementsForCurrentGame(true);
});

replaceNotes();
bootstrapAchievementsForCurrentGame(false);

window.addEventListener("load", () => {
  replaceNotes();
  bootstrapAchievementsForCurrentGame(true);
});

window.LG = window.LG || {};

window.LG.addAchievement = (item) => achievements.push(item);

window.LG.setAchievements = (list) => {
  achievements = Array.isArray(list) ? list.slice() : [];
  saveAchievementsCache();
};

window.LG.setAchievementsMeta = (meta) => {
  achievementsMeta = {
    total: Number(meta?.total || 0),
    unlocked: Number(meta?.unlocked || 0),
    percentNumber: Number(meta?.percentNumber || 0),
    lastSyncText: meta?.lastSyncText || ""
  };
  saveAchievementsCache();
  applyAchievementsUIFromCurrentState();
};

window.LG.refreshAchievementsCacheOnly = () => {
  const ok = loadAchievementsCache();
  if (ok) {
    applyAchievementsUIFromCurrentState();
  }
  return ok;
};

window.LG.openAchievements = () => {
  const gid = getExactGameId();
  if (!gid) return;
  const previews = getPreviewImagesFor(gid);
  const headerImg = previews?.heroSpecial || "";
  const bgImg = previews?.achievementsBg || previews?.heroSpecial || "";
  openModalWith(renderModalHTML(achievements, headerImg, getTitleRaw(), bgImg));
};
})();

// ──────────────────────────────────────────────────────────────────────
// 7. Loja Free, jogos gratuitos integrados à Steam
// ──────────────────────────────────────────────────────────────────────
(() => {
  if (window.LG_LOJA_FREE_NEW_MODEL_INIT) return;
  window.LG_LOJA_FREE_NEW_MODEL_INIT = true;

  const ACTIVE_TAB_CLASS = "_1gqEjB5QsKT_NftD1dEsdZ";
  const TOP_TAB_SELECTOR = "._2Lu3d-5qLmW4i19ysTt2jT._7AlhCx3XGzBeIrQaCneUD";
  const BTN_ID           = "lg-loja-free-btn";
  const OVERLAY_ID       = "lg-loja-free-overlay";
  const LOCAL_DOWNLOADER_BASE = "http://127.0.0.1:48765";

  // ─────────────────────────────────────────────────────────
  // PERSISTÊNCIA, salva/carrega estado via arquivo no disco
  // O localStorage do CEF da Steam não persiste entre sessões.
  // Usamos C:\SFP\loja_state.json via rotas do SFP Downloader.
  // ─────────────────────────────────────────────────────────

  function loadInstalledMap() {
    // Retorna mapa vazio na inicialização síncrona.
    // O carregamento real é feito assincronamente em loadInstalledMapFromDisk().
    return {};
  }

  async function loadInstalledMapFromDisk() {
    try {
      const data = await helperGet("/load-state");
      if (data.ok && data.state && typeof data.state === "object") {
        return data.state;
      }
      return {};
    } catch { return {}; }
  }

  async function saveInstalledMap(map) {
    try {
      await helperPost("/save-state", { state: map });
    } catch {}
    // Fallback: tenta localStorage também por segurança
    try { localStorage.setItem("lg_loja_installed_v1", JSON.stringify(map)); } catch {}
  }

  const GAMES = [
    {
      id: "gowC",
      title: "God of War Chains of Olympus",
      genre: "Ação/Aventura",
      gf: "Ação",
      dev: "Santa Monica Studio",
      year: "2008",
      rating: "8.5",
      size: "1.8 GB",
      sN: 1.8,
      age: "+18",
      edition: "Standard",
      tags: ["Ação", "Hack and Slash", "Aventura"],
      desc: "Embarca em uma jornada épica como Kratos que segue servindo os deuses em busca de conseguir se livrar de seus pesadelos.",
      cover: "https://cdn2.steamgriddb.com/grid/63719b0a1928ddc9f968cb69bffe2f81.png",
      hero: "https://cdn2.steamgriddb.com/hero/4863e1cb2338372056eb9ded8f80f3e2.png",
      isFree: true,
      downloadName: "God of War Chains of Olympus",
      destination: "C:\\SFP\\Downloads\\GodOfWarChains.iso",
      downloadUrl: "https://drive.usercontent.google.com/download?id=1ImAz_Aul_T8nq_xsqyeDIhtQM1SqlK28&export=download&authuser=0",
      launchExe: "C:\\SFP\\Emuladores\\PSP\\PPSSPPWindows64.exe",
      launchOptions: "\"C:\\SFP\\Downloads\\GodOfWarChains.iso\"",
      startDir: "C:\\SFP\\Emuladores\\PSP",
      images: {
        capa:   "https://cdn2.steamgriddb.com/grid/63719b0a1928ddc9f968cb69bffe2f81.png",
        logo:   "https://cdn2.steamgriddb.com/logo/863ae4a798069192865306197bff9428.png",
        fundo1: "https://cdn2.steamgriddb.com/hero/955cb567b6e38f4c6b3f28cc857fc38c.png",
        fundo2: "https://cdn2.steamgriddb.com/hero/955cb567b6e38f4c6b3f28cc857fc38c.png",
        ico:    "https://cdn2.steamgriddb.com/icon/c233abe6b5d62eda374b43ec404cfdb4/32/256x256.png",
      }
    },
    {
      id: "gt7",
      title: "Gran Turismo 7",
      genre: "Corrida",
      gf: "Corrida",
      dev: "Polyphony Digital",
      year: "2022",
      rating: "9.1",
      size: "112.8 GB",
      sN: 112.8,
      age: "+0",
      edition: "Simulador",
      tags: ["Corrida", "Simulação", "Online"],
      desc: "O simulador de automobilismo mais completo da história. Mais de 420 carros modelados com perfeição, pistas lendárias e uma experiência premium de corrida.",
      cover: "https://cdn2.steamgriddb.com/grid/00cdbd4c5ac2a3510eed9336cf0447b8.png",
      hero: "https://cdn2.steamgriddb.com/hero/59f1c5f6ef9f2a1b8d5f0d0ac0ef6ac7.jpg",
      isFree: true,
      downloadName: "Gran Turismo 7",
      destination: "C:\\SFP\\Downloads\\GranTurismo7.pkg",
      downloadUrl: "https://drive.usercontent.google.com/u/0/uc?id=1RKzJUPL0XNNqkogO94dDB9KuBHIr2gD5&export=download",
      launchExe: "C:\\SFP\\Emuladores\\PSP\\PPSSPPWindows64.exe",
      launchOptions: "\"C:\\SFP\\Downloads\\GranTurismo7.pkg\"",
      startDir: "C:\\SFP\\Emuladores\\PSP",
      images: {
        capa:   "https://cdn2.steamgriddb.com/grid/00cdbd4c5ac2a3510eed9336cf0447b8.png",
        logo:   "https://cdn2.steamgriddb.com/logo/5af35c299d051a5251a6f95b5af38222.png",
        fundo1: "https://cdn2.steamgriddb.com/hero/64e6efc0a9328d335236f9395697760d.jpg",
        fundo2: "https://cdn2.steamgriddb.com/hero/64e6efc0a9328d335236f9395697760d.jpg",
        ico:    "https://cdn2.steamgriddb.com/icon/83e49686c19d602e12bf6aed21cf03b9.png"
      }
    }
  ];

  const GAME_MAP = Object.fromEntries(GAMES.map(g => [g.id, g]));

  const STATE = {
    currentTab: "all",
    currentFilter: "all",
    searchQuery: "",
    activeGameId: null,
    installedMap: loadInstalledMap(), // começa vazio, preenchido assincronamente
    pendingFinalizeMap: {},
    finalizingMap: {},
    download: {
      gameId: null, status: "idle", progress: 0,
      downloadedBytes: 0, totalBytes: 0, paused: false,
      pollingTimer: null, errorMessage: null
    }
  };

  function getGame(id) { return GAME_MAP[id] || GAMES[0]; }

  function escapeHtml(str) {
    return String(str || "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 MB";
    const units = ["B","KB","MB","GB","TB"];
    let i = 0, value = bytes;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return `${value.toFixed(value >= 100 || i === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
  }

  function helperGet(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = `${LOCAL_DOWNLOADER_BASE}${path}${query ? `?${query}` : ""}`;
    return fetch(url).then(async res => {
      if (!res.ok) { let t = ""; try { t = await res.text(); } catch {} throw new Error(t || `HTTP ${res.status}`); }
      return res.json();
    });
  }

  function helperPost(path, body) {
    return fetch(`${LOCAL_DOWNLOADER_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(async res => {
      if (!res.ok) { let t = ""; try { t = await res.text(); } catch {} throw new Error(t || `HTTP ${res.status}`); }
      return res.json();
    });
  }

  async function tryHelperRoutes(routes, params = {}) {
    let lastErr = null;
    for (const route of routes) { try { return await helperGet(route, params); } catch (e) { lastErr = e; } }
    throw lastErr || new Error("Nenhuma rota respondeu.");
  }

  function extractInstalledBool(data) {
    if (!data || typeof data !== "object") return false;
    for (const k of ["installed","exists","fileExists","found"]) if (typeof data[k] === "boolean") return data[k];
    if (typeof data.status === "string") {
      if (["installed","exists","found"].includes(data.status.toLowerCase())) return true;
      if (["missing","not_found","absent"].includes(data.status.toLowerCase())) return false;
    }
    return false;
  }

  async function checkInstalledState(game) {
    // FIX 2+3: se marcado como instalado no localStorage, confia sem checar arquivo
    if (STATE.installedMap[game.id] === true) return true;
    try {
      const data = await tryHelperRoutes(["/exists","/file_exists"], {
        path: game.destination, dest: game.destination,
        file: game.destination, name: game.downloadName, game: game.id
      });
      return extractInstalledBool(data);
    } catch { return false; }
  }

  async function refreshInstalledState(gameId) {
    const game = getGame(gameId);
    const exists = await checkInstalledState(game);
    if (!exists && !STATE.installedMap[gameId]) {
      STATE.pendingFinalizeMap[gameId] = false;
      STATE.finalizingMap[gameId] = false;
    } else if (exists && !STATE.installedMap[gameId]) {
      STATE.pendingFinalizeMap[gameId] = true;
    }
    renderAll();
    return exists;
  }

  async function refreshAllInstalledStates() {
    for (const game of GAMES) {
      const exists = await checkInstalledState(game);
      if (!exists && !STATE.installedMap[game.id]) {
        STATE.pendingFinalizeMap[game.id] = false;
        STATE.finalizingMap[game.id] = false;
      } else if (exists && !STATE.installedMap[game.id]) {
        STATE.pendingFinalizeMap[game.id] = true;
      }
    }
    renderAll();
  }

  const isInstalled       = id => !!STATE.installedMap[id];
  const isPendingFinalize = id => !!STATE.pendingFinalizeMap[id];
  const isFinalizing      = id => !!STATE.finalizingMap[id];

  async function pingDownloader() { try { const d = await helperGet("/ping"); return !!d.ok; } catch { return false; } }

  function stopDownloadPolling() {
    if (STATE.download.pollingTimer) { clearInterval(STATE.download.pollingTimer); STATE.download.pollingTimer = null; }
  }

  function resetDownloadState() {
    stopDownloadPolling();
    Object.assign(STATE.download, { gameId:null, status:"idle", progress:0, downloadedBytes:0, totalBytes:0, paused:false, errorMessage:null });
    renderAll();
  }

  async function fetchDownloadStatus() {
    const game = getGame(STATE.download.gameId);
    if (!game) return;
    try {
      const data = await helperGet("/status", { name: game.downloadName, dest: game.destination });
      STATE.download.status = data.status || "idle";
      STATE.download.downloadedBytes = Number(data.downloadedBytes || 0);
      STATE.download.totalBytes = Number(data.totalBytes || 0);
      if (STATE.download.totalBytes > 0)
        STATE.download.progress = Math.max(0, Math.min(100, (STATE.download.downloadedBytes / STATE.download.totalBytes) * 100));
      STATE.download.paused = STATE.download.status === "paused";

      if (STATE.download.status === "completed") {
        stopDownloadPolling();
        const gid = game.id;
        resetDownloadState();
        STATE.pendingFinalizeMap[gid] = true;
        STATE.activeGameId = gid;
        toast("i","⚙","Download concluído",`${game.title}, iniciando instalação...`);
        renderAll();
        setTimeout(() => runInstallFlow(gid), 800);
        return;
      }
      if (STATE.download.status === "error") { STATE.download.errorMessage = data.message || "Erro no download."; stopDownloadPolling(); }
      renderAll();
    } catch {
      STATE.download.status = "error";
      STATE.download.errorMessage = "Falha ao consultar o helper local.";
      stopDownloadPolling(); renderAll();
    }
  }

  function startDownloadPolling() { stopDownloadPolling(); STATE.download.pollingTimer = setInterval(fetchDownloadStatus, 1000); }

  async function runInstallFlow(gameId) {
    const game = getGame(gameId);
    if (!game) return;

    STATE.finalizingMap[gameId] = true;
    STATE.pendingFinalizeMap[gameId] = false;
    STATE.activeGameId = gameId;
    renderAll();
    toast("i","⚙","Instalando...",`${game.title}, configurando na Steam`);

    try {
      const result = await helperPost("/install-game", {
        gameName:      game.title,
        launchExe:     game.launchExe,
        launchOptions: game.launchOptions || "",
        startDir:      game.startDir || "",
        images:        game.images || {}
      });
      if (!result.ok) throw new Error(result.error || "Erro ao instalar.");

      toast("s","✓","Jogo adicionado",`${game.title} adicionado à Steam`);
      await new Promise(r => setTimeout(r, 1000));
      toast("i","↺","Reiniciando Steam","Aguarde...");

      // Salva o estado ANTES de reiniciar, o restart mata o processo JS junto com a Steam
      STATE.finalizingMap[gameId] = false;
      STATE.installedMap[gameId] = true;
      await saveInstalledMap(STATE.installedMap);
      STATE.activeGameId = gameId;
      renderAll();
      toast("s","✓","Instalado!",`${game.title} pronto, Steam reiniciando`);

      // Só reinicia depois de persistir o estado
      await new Promise(r => setTimeout(r, 600));
      const restart = await helperGet("/restart");
      if (!restart.ok) throw new Error(restart.error || "Não foi possível reiniciar a Steam.");

    } catch (err) {
      STATE.finalizingMap[gameId] = false;
      STATE.pendingFinalizeMap[gameId] = true;
      renderAll();
      toast("w","⚠","Erro na instalação", err.message || "Tente novamente.");
    }
  }

  async function startDownload(gameId) {
    const game = getGame(gameId);
    if (isInstalled(game.id))       { toast("i","✓","Já instalado", game.title); renderAll(); return; }
    if (isPendingFinalize(game.id)) { toast("i","⚙","Pronto para instalar", game.title); renderAll(); return; }

    const online = await pingDownloader();
    if (!online) {
      STATE.download.status = "error";
      STATE.download.errorMessage = "O SFP Downloader local não está rodando. Abra o .bat primeiro.";
      STATE.activeGameId = game.id; renderAll(); return;
    }
    try {
      await helperGet("/start", { name: game.downloadName, url: game.downloadUrl, dest: game.destination });
      Object.assign(STATE.download, { gameId: game.id, status:"downloading", progress:0, downloadedBytes:0, totalBytes:0, paused:false, errorMessage:null });
      STATE.activeGameId = game.id;
      renderAll(); startDownloadPolling(); fetchDownloadStatus();
      toast("i","⬇","Download iniciado", game.title);
    } catch {
      STATE.download.status = "error"; STATE.download.errorMessage = "Erro ao iniciar o download.";
      STATE.activeGameId = game.id; renderAll();
    }
  }

  async function togglePause(gameId) {
    const game = getGame(gameId);
    if (STATE.download.gameId !== game.id) return;
    try {
      if (STATE.download.paused) {
        await helperGet("/resume", { name: game.downloadName });
        STATE.download.status = "downloading"; STATE.download.paused = false;
        toast("i","▶","Download retomado", game.title);
      } else {
        await helperGet("/pause", { name: game.downloadName });
        STATE.download.status = "paused"; STATE.download.paused = true;
        toast("w","⏸","Download pausado", game.title);
      }
      renderAll();
    } catch { STATE.download.status = "error"; STATE.download.errorMessage = "Erro ao alterar estado."; renderAll(); }
  }

  async function cancelDownload(gameId) {
    const game = getGame(gameId);
    try { await helperGet("/cancel", { name: game.downloadName }); } catch {}
    if (STATE.download.gameId === game.id) { resetDownloadState(); toast("w","✕","Download cancelado", game.title); }
  }

  async function uninstallGame(gameId) {
    const game = getGame(gameId);
    try {
      await tryHelperRoutes(["/delete","/remove","/uninstall"], {
        path: game.destination, dest: game.destination,
        file: game.destination, name: game.downloadName, game: game.id
      });
    } catch {}
    // FIX 2+3: remove do localStorage
    STATE.installedMap[game.id] = false;
    STATE.pendingFinalizeMap[game.id] = false;
    STATE.finalizingMap[game.id] = false;
    await saveInstalledMap(STATE.installedMap);
    if (STATE.activeGameId === game.id) resetDownloadState();
    renderAll();
    toast("w","🗑","Desinstalado",`${game.title} foi removido`);
  }

  function showConfirm(title, msg, onConfirm) {
    const bk = document.getElementById("lg-confirm-bk");
    if (!bk) { onConfirm(); return; }
    document.getElementById("lg-confirm-title").textContent = title;
    document.getElementById("lg-confirm-msg").textContent = msg;
    bk.classList.add("open");
    function cleanup() {
      bk.classList.remove("open");
      ["lg-confirm-ok","lg-confirm-cancel"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.replaceWith(el.cloneNode(true));
      });
    }
    document.getElementById("lg-confirm-ok").addEventListener("click", () => { cleanup(); onConfirm(); }, { once: true });
    document.getElementById("lg-confirm-cancel").addEventListener("click", () => { cleanup(); }, { once: true });
    bk.addEventListener("click", e => { if (e.target === bk) cleanup(); }, { once: true });
  }

  function finalizeGame(gameId) {
    const game = getGame(gameId);
    if (!isPendingFinalize(game.id) || isFinalizing(game.id)) return;
    showConfirm(
      `Instalar ${game.title}`,
      "Sua Steam será reiniciada para terminar a instalação.",
      () => runInstallFlow(gameId)
    );
  }

  function filteredGames() {
    let list = STATE.currentTab === "inst"
      ? GAMES.filter(g => isInstalled(g.id))
      : STATE.currentFilter === "all"
        ? GAMES.slice()
        : GAMES.filter(g => g.gf === STATE.currentFilter);
    if (STATE.searchQuery) {
      const q = STATE.searchQuery.toLowerCase();
      list = list.filter(g =>
        g.title.toLowerCase().includes(q) ||
        g.genre.toLowerCase().includes(q) ||
        g.dev.toLowerCase().includes(q) ||
        (g.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }

  function cardBadge(game) {
    if (isInstalled(game.id))       return `<div class="floating-badge installed">Instalado</div>`;
    if (isFinalizing(game.id))      return `<div class="floating-badge downloading">Instalando</div>`;
    if (isPendingFinalize(game.id)) return `<div class="floating-badge downloading">Pronto</div>`;
    if (STATE.download.gameId === game.id && !["idle","error"].includes(STATE.download.status))
      return `<div class="floating-badge downloading">Baixando · ${Math.round(STATE.download.progress)}%</div>`;
    return `<div class="floating-badge free">Free</div>`;
  }

  function cardCta(game) {
    if (isInstalled(game.id))
      return `<button class="action play"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>Jogar</button>`;
    if (isFinalizing(game.id))
      return `<button class="action download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>Instalando</button>`;
    if (isPendingFinalize(game.id))
      return `<button class="action download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Instalar agora</button>`;
    return `<button class="action download"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Baixar</button>`;
  }

  function cardBar(game) {
    const active = STATE.download.gameId === game.id && ["downloading","paused"].includes(STATE.download.status);
    if (!active) return "";
    return `
      <div class="progress show" id="cbar-${game.id}">
        <div class="progress-fill" style="width:${STATE.download.progress}%"></div>
      </div>`;
  }

  function createCard(game) {
    const d = document.createElement("div");
    let cls = "card";
    if (isInstalled(game.id)) cls += " installed";
    const dlActive = STATE.download.gameId === game.id && ["downloading","paused"].includes(STATE.download.status);
    if (dlActive) cls += " downloading";
    d.className = cls;
    d.id = "card-" + game.id;

    const statusLabel = isInstalled(game.id) ? "Instalado"
      : dlActive ? Math.round(STATE.download.progress) + "%"
      : "Disponível";

    const sizeLine = dlActive
      ? `${((STATE.download.progress/100) * (game.sizeN || 0)).toFixed(1)} / ${game.size || ""}`
      : (game.size || "");

    d.innerHTML = `
      <div class="media">
        <img src="${game.cover}" alt="${escapeHtml(game.title)}" loading="lazy">
        ${cardBadge(game)}
        ${cardCta(game)}
      </div>
      <div class="info">
        <div class="info-meta">
          <span>${escapeHtml(game.year || "")}</span>
          <span class="dot"></span>
          <span>${escapeHtml(game.genre)}</span>
        </div>
        <div class="info-title">${escapeHtml(game.title)}</div>
        <div class="info-footer">
          <span class="info-size">${escapeHtml(sizeLine)}</span>
          <span class="info-status">${statusLabel}</span>
        </div>
        ${cardBar(game)}
      </div>`;

    // Click na capa abre modal; action botão trata navegação/instalação/play
    d.querySelector(".media")?.addEventListener("click", e => {
      if (e.target.closest(".action")) return;
      openModal(game.id);
    });
    d.querySelector(".action")?.addEventListener("click", e => {
      e.stopPropagation();
      if (isInstalled(game.id)) { openGameInSteam(game.id); return; }
      if (isPendingFinalize(game.id)) { finalizeGame(game.id); return; }
      openModal(game.id);
    });
    // Click na info também abre modal
    d.querySelector(".info")?.addEventListener("click", () => openModal(game.id));
    return d;
  }

  function renderMainGrid() {
    const g = document.getElementById("lg-mainGrid");
    if (!g) return;
    g.innerHTML = "";
    filteredGames().forEach(game => g.appendChild(createCard(game)));
  }

  function renderInstalledGrid() {
    const g = document.getElementById("lg-instGrid");
    if (!g) return;
    g.innerHTML = "";
    GAMES.filter(game => isInstalled(game.id)).forEach(game => g.appendChild(createCard(game)));
  }

  function syncModalButtons(game) {
    const dl  = document.getElementById("lg-mDlBtn");
    const ins = document.getElementById("lg-mInstBtn");
    const un  = document.getElementById("lg-mUninstBtn");
    if (!dl || !ins || !un) return;
    const isDl = STATE.download.gameId === game.id && ["downloading","paused"].includes(STATE.download.status);
    if (isInstalled(game.id)) {
      dl.style.display="none"; ins.style.display="flex"; un.style.display="flex";
      ins.classList.remove("ready","finishing");
      ins.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Instalado`;
      return;
    }
    if (isFinalizing(game.id)) {
      dl.style.display="none"; ins.style.display="flex"; un.style.display="none";
      ins.classList.add("ready","finishing");
      ins.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>Instalando...`;
      return;
    }
    if (isPendingFinalize(game.id)) {
      dl.style.display="none"; ins.style.display="flex"; un.style.display="flex";
      ins.classList.add("ready"); ins.classList.remove("finishing");
      ins.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>Instalar`;
      return;
    }
    dl.style.display = isDl ? "none" : "flex";
    ins.style.display = "none";
    un.style.display  = "none";
  }

  function syncModalDownloadUI(game) {
    const mdl = document.getElementById("lg-mDl");
    if (!mdl) return;
    const isDl = STATE.download.gameId === game.id && ["downloading","paused","error"].includes(STATE.download.status);
    if (!isDl) { mdl.classList.remove("show"); return; }
    mdl.classList.add("show");
    document.getElementById("lg-mFill").style.width    = `${STATE.download.progress}%`;
    document.getElementById("lg-mPct").textContent     = `${Math.round(STATE.download.progress)}%`;
    document.getElementById("lg-mDone").textContent    = formatBytes(STATE.download.downloadedBytes);
    document.getElementById("lg-mTot").textContent     = STATE.download.totalBytes > 0 ? formatBytes(STATE.download.totalBytes) : game.size;
    document.getElementById("lg-mSpd").textContent     = STATE.download.paused ? "Pausado" : "-";
    document.getElementById("lg-mSpin").style.display  = STATE.download.paused ? "none" : "block";
    document.getElementById("lg-mDlLbl").textContent   = STATE.download.status === "error" ? "Erro" : STATE.download.paused ? "Pausado" : "Baixando...";
    document.getElementById("lg-mPNote").classList.toggle("show", STATE.download.paused || STATE.download.status === "error");
    document.getElementById("lg-mPNote").textContent   = STATE.download.status === "error" ? (STATE.download.errorMessage || "Erro no download.") : "⏸ Download pausado";
    document.getElementById("lg-mPLbl").textContent    = STATE.download.paused ? "Retomar" : "Pausar";
    document.getElementById("lg-mPIco").innerHTML      = STATE.download.paused
      ? `<polygon points="5 3 19 12 5 21 5 3"/>`
      : `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
  }

  function openModal(gameId) {
    STATE.activeGameId = gameId;
    const game = getGame(gameId);
    document.getElementById("lg-mCov").src              = game.cover;
    document.getElementById("lg-mTitle").textContent    = game.title;
    document.getElementById("lg-mDev").textContent      = game.dev;
    document.getElementById("lg-mDesc").textContent     = game.desc;
    document.getElementById("lg-mRating").textContent   = game.rating;
    document.getElementById("lg-mSize").textContent     = game.size;
    document.getElementById("lg-mAge").textContent      = game.age || "+18";
    document.getElementById("lg-mInfoSize").textContent = game.size;
    document.getElementById("lg-mInfoYear").textContent = game.year + (game.edition ? " · " + game.edition : "");
    document.getElementById("lg-mTags").innerHTML       = (game.tags || [game.genre]).map(t => `<div class="m-tag">${escapeHtml(t)}</div>`).join("");
    syncModalButtons(game);
    syncModalDownloadUI(game);
    document.getElementById("lg-mbk").classList.add("open");
    document.body.style.overflow = "hidden";
    refreshInstalledState(game.id).then(() => {
      if (STATE.activeGameId === game.id) { syncModalButtons(game); syncModalDownloadUI(game); }
    }).catch(() => {});
  }

  function closeModal() {
    document.getElementById("lg-mbk")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  function toast(type, ico, ttl, msg) {
    const w = document.getElementById("lg-toasts");
    if (!w) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<div class="tico ${type}">${ico}</div><div><div class="tttl">${escapeHtml(ttl)}</div><div class="tmsg">${escapeHtml(msg)}</div></div>`;
    w.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 3500);
  }

  function renderAll() {
    const totalN  = document.getElementById("lg-totalN");
    const instN   = document.getElementById("lg-instN");
    const allSec  = document.getElementById("lg-allSec");
    const instSec = document.getElementById("lg-instSec");
    const banner  = document.getElementById("lg-bannerEl");
    const empty   = document.getElementById("lg-emptyEl");

    if (totalN) totalN.textContent = GAMES.length;
    if (instN)  instN.textContent  = GAMES.filter(g => isInstalled(g.id)).length;

    if (STATE.currentTab === "all") {
      if (allSec)  allSec.style.display = "";
      if (banner)  banner.style.display = "";
      if (instSec) instSec.classList.remove("active");
    } else {
      if (allSec)  allSec.style.display = "none";
      if (banner)  banner.style.display = "none";
      if (instSec) instSec.classList.add("active");
    }

    renderMainGrid();
    renderInstalledGrid();

    if (empty) empty.classList.toggle("show",
      STATE.currentTab === "inst" && GAMES.filter(g => isInstalled(g.id)).length === 0
    );
    if (STATE.activeGameId) {
      const game = getGame(STATE.activeGameId);
      syncModalButtons(game);
      syncModalDownloadUI(game);
    }
  }

  function setTab(tab, btn) {
    STATE.currentTab = tab;
    document.getElementById(OVERLAY_ID)?.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderAll();
  }

  function setFilter(filter, btn) {
    STATE.currentFilter = filter;
    document.getElementById(OVERLAY_ID)?.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    if (btn) btn.classList.add("active");
    renderAll();
  }

  function ensureStyles() {
    if (document.getElementById("lg-loja-free-new-model-style")) return;
    const style = document.createElement("style");
    style.id = "lg-loja-free-new-model-style";
    style.textContent = `
      #${OVERLAY_ID}{position:fixed;left:0;right:0;top:78px;bottom:0;z-index:2147483647;display:none;overflow:auto;background:#080c12}
      #${OVERLAY_ID}.show{display:block}
      #${OVERLAY_ID} *{box-sizing:border-box;margin:0;padding:0}
      #${OVERLAY_ID}{--bg:#080c12;--bg2:#0f1520;--accent:#4facff;--ag:rgba(79,172,255,0.22);--green:#3ddc84;--gg:rgba(61,220,132,0.18);--red:#ff4d4d;--text:#d8eaf8;--text2:#6e8fa8;--text3:#8aabb8;--bdr:rgba(255,255,255,0.06);--bdr2:rgba(79,172,255,0.3);--r2:16px;--t:0.28s cubic-bezier(0.4,0,0.2,1);font-family:'DM Sans',sans-serif;color:var(--text)}
      #${OVERLAY_ID} .bg-glow{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
      #${OVERLAY_ID} .bg-glow::before{content:'';position:absolute;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(79,172,255,0.08),transparent 70%);top:-200px;right:-150px}
      #${OVERLAY_ID} .bg-glow::after{content:'';position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(0,212,255,0.05),transparent 70%);bottom:-100px;left:-100px}
      #${OVERLAY_ID} .wrap{position:relative;z-index:1;max-width:1380px;margin:0 auto;padding:0 28px 100px}
      #${OVERLAY_ID} nav{display:flex;align-items:center;justify-content:space-between;padding:22px 0 20px;border-bottom:1px solid var(--bdr);margin-bottom:36px;gap:16px}
      #${OVERLAY_ID} .nav-tabs{display:flex;gap:3px;background:rgba(255,255,255,0.04);border:1px solid var(--bdr);border-radius:9px;padding:3px}
      #${OVERLAY_ID} .nav-tab{padding:9px 22px;border-radius:7px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;transition:var(--t);border:none;background:none;font-family:'DM Sans',sans-serif}
      #${OVERLAY_ID} .nav-tab.active,#${OVERLAY_ID} .nav-tab:hover{background:var(--accent);color:#000}
      #${OVERLAY_ID} .nav-tab.active{box-shadow:0 0 18px var(--ag)}
      #${OVERLAY_ID} .nav-right{display:flex;align-items:center;gap:12px}
      #${OVERLAY_ID} .badge-inst{display:flex;align-items:center;gap:8px;background:rgba(61,220,132,0.08);border:1px solid rgba(61,220,132,0.25);border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;color:var(--green);cursor:pointer;transition:var(--t)}
      #${OVERLAY_ID} .badge-inst:hover{background:rgba(61,220,132,0.14)}
      #${OVERLAY_ID} .badge-inst svg{width:15px;height:15px}
      #${OVERLAY_ID} .badge-n{background:var(--green);color:#000;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:800}
      #${OVERLAY_ID} .spill{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,0.04);border:1px solid var(--bdr);border-radius:8px;padding:6px 14px;font-size:13px;color:var(--text2);transition:var(--t)}
      #${OVERLAY_ID} .spill:focus-within{border-color:var(--bdr2);background:rgba(79,172,255,0.06)}
      #${OVERLAY_ID} .spill svg{width:14px;height:14px;flex-shrink:0;color:var(--text2)}
      #${OVERLAY_ID} .spill input{background:none;border:none;outline:none;font-family:"DM Sans",sans-serif;font-size:13px;color:var(--text);width:140px;}
      #${OVERLAY_ID} .spill input::placeholder{color:var(--text2)}
      #${OVERLAY_ID} .spill .spill-clear{background:none;border:none;cursor:pointer;color:var(--text3);padding:0;display:none;line-height:1}
      #${OVERLAY_ID} .spill .spill-clear.show{display:block}
      #${OVERLAY_ID} .spill .spill-clear:hover{color:var(--text)}
      #${OVERLAY_ID} .banner{position:relative;border-radius:18px;overflow:hidden;border:1px solid var(--bdr);margin-bottom:40px;box-shadow:0 20px 70px rgba(0,0,0,0.6)}
      #${OVERLAY_ID} .banner img{width:100%;height:360px;object-fit:cover;object-position:center 25%;display:block;transition:transform 0.9s ease}
      #${OVERLAY_ID} .banner:hover img{transform:scale(1.025)}
      #${OVERLAY_ID} .bover{position:absolute;inset:0;background:linear-gradient(105deg,rgba(8,12,18,0.92) 0%,rgba(8,12,18,0.62) 45%,rgba(8,12,18,0.08) 100%)}
      #${OVERLAY_ID} .bbody{position:absolute;top:0;left:0;bottom:0;display:flex;flex-direction:column;justify-content:center;padding:48px 64px;gap:12px;max-width:580px}
      #${OVERLAY_ID} .btag{display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:#000;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;padding:5px 12px;border-radius:4px;width:fit-content;box-shadow:0 0 24px var(--ag)}
      #${OVERLAY_ID} .bh{font-family:'Bebas Neue',sans-serif;font-size:64px;line-height:0.92;color:#fff;letter-spacing:2px;text-shadow:0 4px 40px rgba(0,0,0,0.8)}
      #${OVERLAY_ID} .bh span{color:var(--accent)}
      #${OVERLAY_ID} .bp{font-size:15px;color:rgba(255,255,255,0.78);line-height:1.65;font-weight:300;max-width:420px}
      #${OVERLAY_ID} .bnums{display:flex;gap:36px;margin-top:4px}
      #${OVERLAY_ID} .bnum{font-family:'Bebas Neue',sans-serif;font-size:32px;color:var(--accent);letter-spacing:1px;line-height:1}
      #${OVERLAY_ID} .blbl{font-family:'Space Mono',monospace;font-size:8px;color:var(--text3);text-transform:uppercase;letter-spacing:2px}
      #${OVERLAY_ID} .sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;gap:20px}
      #${OVERLAY_ID} .sl{display:flex;flex-direction:column;gap:2px}
      #${OVERLAY_ID} .seye{font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--accent)}
      #${OVERLAY_ID} .stitle{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:2px;color:var(--text)}
      #${OVERLAY_ID} .sline{flex:1;height:1px;background:linear-gradient(90deg,var(--accent),transparent);opacity:0.2;margin-top:6px}
      #${OVERLAY_ID} .pills{display:flex;gap:6px}
      #${OVERLAY_ID} .pill{padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border:1px solid var(--bdr);color:var(--text2);cursor:pointer;transition:var(--t);font-family:'Space Mono',monospace;background:none}
      #${OVERLAY_ID} .pill:hover,#${OVERLAY_ID} .pill.active{border-color:var(--accent);color:var(--accent);background:rgba(79,172,255,0.1)}
      /* ═════ GRID + CARD v5 (Glassmorphism Aurora) ═════ */
      #${OVERLAY_ID} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:20px}
      #${OVERLAY_ID} .card{position:relative;cursor:pointer;border-radius:20px;padding:8px;background:linear-gradient(var(--bg),var(--bg)) padding-box,linear-gradient(135deg,rgba(167,139,250,0.25),rgba(244,114,182,0.15),rgba(34,211,238,0.2)) border-box;border:1px solid transparent;transition:transform 0.4s cubic-bezier(0.22,0.9,0.33,1),box-shadow 0.4s cubic-bezier(0.22,0.9,0.33,1);isolation:isolate}
      #${OVERLAY_ID} .card::before{content:'';position:absolute;inset:0;border-radius:20px;background:rgba(255,255,255,0.02);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);z-index:-1}
      #${OVERLAY_ID} .card:hover{transform:translateY(-8px);box-shadow:0 20px 50px rgba(167,139,250,0.15),0 0 60px rgba(244,114,182,0.1)}
      #${OVERLAY_ID} .card.installed{background:linear-gradient(var(--bg),var(--bg)) padding-box,linear-gradient(135deg,rgba(52,211,153,0.4),rgba(34,211,238,0.2),rgba(52,211,153,0.3)) border-box}
      #${OVERLAY_ID} .card.installed:hover{box-shadow:0 20px 50px rgba(52,211,153,0.2),0 0 60px rgba(52,211,153,0.1)}

      /* Media wrapper (capa) */
      #${OVERLAY_ID} .card .media{position:relative;border-radius:14px;overflow:hidden;aspect-ratio:2/3;background:#0f0820}
      #${OVERLAY_ID} .card .media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform 1s cubic-bezier(0.22,0.9,0.33,1)}
      #${OVERLAY_ID} .card:hover .media img{transform:scale(1.08)}

      /* Shine sweep diagonal no hover */
      #${OVERLAY_ID} .card .media::before{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.15) 48%,rgba(255,255,255,0.15) 52%,transparent 70%);transform:translateX(-100%);transition:transform 0.9s cubic-bezier(0.22,0.9,0.33,1);z-index:3;pointer-events:none}
      #${OVERLAY_ID} .card:hover .media::before{transform:translateX(100%)}

      /* Floating badge, pílula de vidro no topo */
      #${OVERLAY_ID} .floating-badge{position:absolute;top:12px;left:12px;z-index:4;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:100px;background:rgba(255,255,255,0.1);backdrop-filter:blur(20px) saturate(1.8);-webkit-backdrop-filter:blur(20px) saturate(1.8);border:1px solid rgba(255,255,255,0.15);font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.3)}
      #${OVERLAY_ID} .floating-badge::before{content:'';width:5px;height:5px;border-radius:50%}
      #${OVERLAY_ID} .floating-badge.free::before{background:linear-gradient(135deg,#a78bfa,#f472b6);box-shadow:0 0 8px #a78bfa}
      #${OVERLAY_ID} .floating-badge.installed::before{background:#34d399;box-shadow:0 0 8px #34d399;animation:pulse-badge 2s ease-in-out infinite}
      #${OVERLAY_ID} .floating-badge.downloading::before{background:#22d3ee;box-shadow:0 0 8px #22d3ee;animation:pulse-fast 1s ease-in-out infinite}
      @keyframes pulse-badge{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(1.3)}}
      @keyframes pulse-fast{0%,100%{opacity:1}50%{opacity:0.3}}

      /* Action button, glass pill que aparece no hover */
      #${OVERLAY_ID} .action{position:absolute;bottom:12px;left:12px;right:12px;z-index:5;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.1);backdrop-filter:blur(20px) saturate(1.8);-webkit-backdrop-filter:blur(20px) saturate(1.8);color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;letter-spacing:0.2px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;opacity:0;transform:translateY(12px);transition:opacity 0.28s ease,transform 0.36s cubic-bezier(0.34,1.4,0.64,1),background 0.2s ease,border-color 0.2s ease}
      #${OVERLAY_ID} .card:hover .action{opacity:1;transform:translateY(0)}
      #${OVERLAY_ID} .action:hover{background:rgba(255,255,255,0.18);border-color:rgba(255,255,255,0.3)}
      #${OVERLAY_ID} .action svg{width:14px;height:14px;flex-shrink:0}
      #${OVERLAY_ID} .action.play{background:linear-gradient(135deg,rgba(52,211,153,0.35),rgba(34,211,238,0.25));border-color:rgba(52,211,153,0.4)}
      #${OVERLAY_ID} .action.play:hover{background:linear-gradient(135deg,rgba(52,211,153,0.5),rgba(34,211,238,0.4));border-color:rgba(52,211,153,0.6)}
      #${OVERLAY_ID} .action.play svg{margin-left:1px}
      #${OVERLAY_ID} .action.download{background:linear-gradient(135deg,rgba(167,139,250,0.35),rgba(244,114,182,0.25));border-color:rgba(167,139,250,0.4)}
      #${OVERLAY_ID} .action.download:hover{background:linear-gradient(135deg,rgba(167,139,250,0.5),rgba(244,114,182,0.4));border-color:rgba(167,139,250,0.6)}

      /* Info abaixo da capa */
      #${OVERLAY_ID} .card .info{padding:14px 10px 8px}
      #${OVERLAY_ID} .card .info-meta{display:flex;align-items:center;gap:8px;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:1.5px;color:var(--text3);text-transform:uppercase;margin-bottom:6px}
      #${OVERLAY_ID} .card .info-meta .dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:0.6}
      #${OVERLAY_ID} .card .info-title{font-size:15px;font-weight:600;letter-spacing:-0.3px;color:var(--text);line-height:1.3;margin-bottom:10px;transition:color 0.2s;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
      #${OVERLAY_ID} .card:hover .info-title{color:#fff}
      #${OVERLAY_ID} .card .info-footer{display:flex;align-items:center;justify-content:space-between;gap:10px}
      #${OVERLAY_ID} .card .info-size{font-family:'Space Mono',monospace;font-size:11px;color:var(--text2);letter-spacing:0.3px}
      #${OVERLAY_ID} .card .info-status{font-family:'Space Mono',monospace;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;padding:3px 9px;border-radius:100px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);color:var(--text2)}
      #${OVERLAY_ID} .card.installed .info-status{background:rgba(52,211,153,0.1);color:#34d399;border-color:rgba(52,211,153,0.2)}
      #${OVERLAY_ID} .card.downloading .info-status{background:rgba(34,211,238,0.1);color:#22d3ee;border-color:rgba(34,211,238,0.2)}

      /* Progress bar inline (abaixo do footer) */
      #${OVERLAY_ID} .card .progress{margin-top:10px;height:3px;background:rgba(255,255,255,0.05);border-radius:100px;overflow:hidden;position:relative;display:none}
      #${OVERLAY_ID} .card.downloading .progress,#${OVERLAY_ID} .card .progress.show{display:block}
      #${OVERLAY_ID} .card .progress-fill{height:100%;background:linear-gradient(90deg,#22d3ee,#a78bfa);border-radius:100px;transition:width 0.4s ease;position:relative}
      #${OVERLAY_ID} .card .progress-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent);animation:sh 1.5s linear infinite}
      @keyframes sh{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
      @keyframes bb{0%,100%{opacity:1}50%{opacity:0.45}}

      #${OVERLAY_ID} .mbk{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.85);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;pointer-events:none;transition:opacity 0.3s ease}
      #${OVERLAY_ID} .mbk.open{opacity:1;pointer-events:all}
      #${OVERLAY_ID} .modal{background:#0f1520;border:1px solid rgba(255,255,255,0.09);border-radius:18px;max-width:860px;width:100%;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,0.85);transform:translateY(24px) scale(0.96);transition:transform 0.38s cubic-bezier(0.34,1.56,0.64,1);max-height:92vh;overflow-y:auto;position:relative}
      #${OVERLAY_ID} .mbk.open .modal{transform:translateY(0) scale(1)}
      #${OVERLAY_ID} .mclose{position:absolute;top:16px;right:16px;z-index:20;width:36px;height:36px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#aaa;transition:var(--t)}
      #${OVERLAY_ID} .mclose:hover{background:rgba(255,77,77,0.25);color:#fff;border-color:rgba(255,77,77,0.5)}
      #${OVERLAY_ID} .mclose svg{width:16px;height:16px}
      #${OVERLAY_ID} .modal-inner{display:flex;gap:0;height:500px}
      #${OVERLAY_ID} .mi-left{width:300px;flex-shrink:0;position:relative;background:#0d0f12;border-radius:18px 0 0 18px;overflow:hidden}
      #${OVERLAY_ID} .mi-left img{width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0}
      #${OVERLAY_ID} .mi-left-fade{display:none}
      #${OVERLAY_ID} .mi-right{flex:1;padding:28px 32px 0 24px;display:flex;flex-direction:column;overflow-y:auto;overflow-x:hidden}
      #${OVERLAY_ID} .m-tags{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
      #${OVERLAY_ID} .m-tag{padding:5px 14px;border-radius:20px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:#bcc8d8}
      #${OVERLAY_ID} .m-title{font-family:'DM Sans',sans-serif;font-size:32px;font-weight:800;color:#fff;line-height:1.1;margin-bottom:6px}
      #${OVERLAY_ID} .m-dev{font-size:14px;color:var(--text2);margin-bottom:20px}
      #${OVERLAY_ID} .m-dev span{color:var(--accent);font-weight:600}
      #${OVERLAY_ID} .m-hr{height:1px;background:rgba(255,255,255,0.08);margin-bottom:20px}
      #${OVERLAY_ID} .m-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
      #${OVERLAY_ID} .mstat{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px 12px;text-align:center}
      #${OVERLAY_ID} .mstat-val{font-size:22px;font-weight:800;color:var(--accent);margin-bottom:4px;line-height:1}
      #${OVERLAY_ID} .mstat-lbl{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--text3)}
      #${OVERLAY_ID} .m-desc{font-size:14px;color:var(--text2);line-height:1.7;margin-bottom:18px}
      #${OVERLAY_ID} .m-infobar{display:flex;align-items:center;gap:24px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 18px;margin-bottom:20px}
      #${OVERLAY_ID} .m-infobar-item{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--text2)}
      #${OVERLAY_ID} .m-infobar-item svg{width:14px;height:14px;color:var(--text3);flex-shrink:0}
      #${OVERLAY_ID} .m-infobar-item strong{color:var(--text);font-weight:700}
      #${OVERLAY_ID} .m-infobar-sep{width:1px;height:16px;background:rgba(255,255,255,0.1)}
      #${OVERLAY_ID} .mdl{display:none;margin-bottom:16px}
      #${OVERLAY_ID} .mdl.show{display:block}
      #${OVERLAY_ID} .dlrow{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
      #${OVERLAY_ID} .dllbl{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--accent);font-family:'Space Mono',monospace;text-transform:uppercase;letter-spacing:1px}
      #${OVERLAY_ID} .spin{width:12px;height:12px;border:2px solid rgba(79,172,255,0.2);border-top-color:var(--accent);border-radius:50%;animation:sp 0.75s linear infinite}
      @keyframes sp{to{transform:rotate(360deg)}}
      #${OVERLAY_ID} .dlpct{font-family:'Space Mono',monospace;font-size:14px;font-weight:700;color:var(--accent)}
      #${OVERLAY_ID} .dltrack{height:6px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin-bottom:8px}
      #${OVERLAY_ID} .dlfill{height:100%;background:linear-gradient(90deg,var(--accent),#a8d8ff);border-radius:3px;transition:width 0.4s ease;position:relative;overflow:hidden}
      #${OVERLAY_ID} .dlfill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent);animation:sh 1.1s linear infinite}
      #${OVERLAY_ID} .dlmeta{display:flex;justify-content:space-between;font-size:11px;color:var(--text3);font-family:'Space Mono',monospace;margin-bottom:10px}
      #${OVERLAY_ID} .dlpnote{display:none;align-items:center;gap:6px;background:rgba(79,172,255,0.08);border:1px solid rgba(79,172,255,0.25);border-radius:7px;padding:7px 12px;font-size:11px;color:var(--accent);font-family:'Space Mono',monospace;margin-bottom:10px}
      #${OVERLAY_ID} .dlpnote.show{display:flex}
      #${OVERLAY_ID} .dlbtns{display:flex;gap:10px;margin-bottom:4px}
      #${OVERLAY_ID} .dlb{flex:1;padding:10px;border-radius:9px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;border:none;cursor:pointer;font-family:'Space Mono',monospace;display:flex;align-items:center;justify-content:center;gap:7px;transition:var(--t)}
      #${OVERLAY_ID} .dlb svg{width:13px;height:13px}
      #${OVERLAY_ID} .dlb.pause{background:rgba(79,172,255,0.1);border:1px solid rgba(79,172,255,0.3);color:var(--accent)}
      #${OVERLAY_ID} .dlb.pause:hover{background:rgba(79,172,255,0.18)}
      #${OVERLAY_ID} .dlb.cancel{background:rgba(255,77,77,0.1);border:1px solid rgba(255,77,77,0.3);color:var(--red)}
      #${OVERLAY_ID} .dlb.cancel:hover{background:rgba(255,77,77,0.18)}
      #${OVERLAY_ID} .mactions{display:flex;gap:10px;padding-bottom:28px}
      #${OVERLAY_ID} .abtn{flex:1;padding:15px 24px;border-radius:10px;font-size:14px;font-weight:800;letter-spacing:2px;text-transform:uppercase;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;transition:var(--t)}
      #${OVERLAY_ID} .abtn svg{width:18px;height:18px}
      #${OVERLAY_ID} .abtn.dl{background:var(--accent);color:#000;box-shadow:0 6px 28px rgba(79,172,255,0.35)}
      #${OVERLAY_ID} .abtn.dl:hover{box-shadow:0 8px 36px rgba(79,172,255,0.55);transform:translateY(-1px)}
      #${OVERLAY_ID} .abtn.inst{background:rgba(61,220,132,0.1);border:1.5px solid rgba(61,220,132,0.4);color:var(--green);cursor:default}
      #${OVERLAY_ID} .abtn.ready{background:rgba(79,172,255,0.12);border:1.5px solid rgba(79,172,255,0.45);color:var(--accent);cursor:pointer}
      #${OVERLAY_ID} .abtn.ready:hover{background:rgba(79,172,255,0.2);box-shadow:0 4px 20px rgba(79,172,255,0.2)}
      #${OVERLAY_ID} .abtn.finishing{opacity:0.9;cursor:default}
      #${OVERLAY_ID} .abtn.uninst{background:rgba(255,77,77,0.08);border:1.5px solid rgba(255,77,77,0.35);color:var(--red);flex:none;padding:15px 20px}
      #${OVERLAY_ID} .abtn.uninst:hover{background:rgba(255,77,77,0.16)}
      #${OVERLAY_ID} .isec{display:none;animation:fi 0.3s ease}
      #${OVERLAY_ID} .isec.active{display:block}
      @keyframes fi{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      #${OVERLAY_ID} .empty{text-align:center;padding:80px 40px;display:none}
      #${OVERLAY_ID} .empty.show{display:block}
      #${OVERLAY_ID} .eico{font-size:52px;opacity:0.25;margin-bottom:14px}
      #${OVERLAY_ID} .etxt{font-family:'Bebas Neue',sans-serif;font-size:24px;color:var(--text3);letter-spacing:2px}
      #${OVERLAY_ID} .toasts{position:fixed;top:22px;right:22px;z-index:500;display:flex;flex-direction:column;gap:10px;pointer-events:none}
      #${OVERLAY_ID} .toast{background:#1a1c1f;border:1px solid var(--bdr2);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;min-width:270px;max-width:340px;box-shadow:0 10px 40px rgba(0,0,0,0.6),0 0 20px var(--ag);animation:tin 0.35s cubic-bezier(0.34,1.56,0.64,1);pointer-events:all}
      #${OVERLAY_ID} .toast.out{animation:tout 0.28s ease forwards}
      @keyframes tin{from{opacity:0;transform:translateX(40px) scale(0.9)}to{opacity:1;transform:translateX(0) scale(1)}}
      @keyframes tout{to{opacity:0;transform:translateX(40px) scale(0.9)}}
      #${OVERLAY_ID} .tico{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
      #${OVERLAY_ID} .tico.s{background:rgba(61,220,132,0.15)}
      #${OVERLAY_ID} .tico.i{background:rgba(79,172,255,0.15)}
      #${OVERLAY_ID} .tico.w{background:rgba(79,172,255,0.1)}
      #${OVERLAY_ID} .tttl{font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px}
      #${OVERLAY_ID} .tmsg{font-size:11px;color:var(--text2)}
      #${OVERLAY_ID} .confirm-bk{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;pointer-events:none;transition:opacity 0.25s ease}
      #${OVERLAY_ID} .confirm-bk.open{opacity:1;pointer-events:all}
      #${OVERLAY_ID} .confirm-box{background:#0f1520;border:1px solid rgba(79,172,255,0.25);border-radius:16px;max-width:420px;width:100%;padding:32px 28px;box-shadow:0 40px 80px rgba(0,0,0,0.8),0 0 40px rgba(79,172,255,0.1);transform:translateY(20px) scale(0.95);transition:transform 0.35s cubic-bezier(0.34,1.56,0.64,1)}
      #${OVERLAY_ID} .confirm-bk.open .confirm-box{transform:translateY(0) scale(1)}
      #${OVERLAY_ID} .confirm-ico{width:52px;height:52px;border-radius:14px;background:rgba(79,172,255,0.12);border:1px solid rgba(79,172,255,0.3);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:22px}
      #${OVERLAY_ID} .confirm-title{font-family:'DM Sans',sans-serif;font-size:20px;font-weight:800;color:#fff;text-align:center;margin-bottom:10px}
      #${OVERLAY_ID} .confirm-msg{font-size:14px;color:var(--text2);text-align:center;line-height:1.65;margin-bottom:28px}
      #${OVERLAY_ID} .confirm-btns{display:flex;gap:10px}
      #${OVERLAY_ID} .confirm-cancel{flex:1;padding:13px;border-radius:9px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:'DM Sans',sans-serif;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:var(--text2);cursor:pointer;transition:var(--t)}
      #${OVERLAY_ID} .confirm-cancel:hover{background:rgba(255,255,255,0.1);color:var(--text)}
      #${OVERLAY_ID} .confirm-ok{flex:1;padding:13px;border-radius:9px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:'DM Sans',sans-serif;border:none;background:var(--accent);color:#000;cursor:pointer;transition:var(--t);box-shadow:0 4px 20px rgba(79,172,255,0.35);display:flex;align-items:center;justify-content:center;gap:8px}
      #${OVERLAY_ID} .confirm-ok:hover{box-shadow:0 6px 28px rgba(79,172,255,0.55);transform:translateY(-1px)}
      #${OVERLAY_ID} .confirm-ok svg{width:15px;height:15px}
      #${OVERLAY_ID} ::-webkit-scrollbar{width:5px}
      #${OVERLAY_ID} ::-webkit-scrollbar-track{background:transparent}
      #${OVERLAY_ID} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}
      #${OVERLAY_ID} ::-webkit-scrollbar-thumb:hover{background:rgba(79,172,255,0.4)}
      @media(max-width:760px){
        #${OVERLAY_ID} .modal-inner{flex-direction:column;height:auto}
        #${OVERLAY_ID} .mi-left{width:100%;height:200px}
        #${OVERLAY_ID} .bh{font-size:36px}
        #${OVERLAY_ID} .grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
      }`;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    const bg = getGame("gowC");
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="bg-glow"></div>
      <div class="toasts" id="lg-toasts"></div>
      <div class="mbk" id="lg-mbk">
        <div class="modal" id="lg-modal">
          <button class="mclose" id="lg-mclose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <div class="modal-inner">
            <div class="mi-left"><img id="lg-mCov" src="${bg.cover}" alt=""><div class="mi-left-fade"></div></div>
            <div class="mi-right">
              <div class="m-tags" id="lg-mTags"></div>
              <div class="m-title" id="lg-mTitle"></div>
              <div class="m-dev">desenvolvido por <span id="lg-mDev"></span></div>
              <div class="m-hr"></div>
              <div class="m-stats">
                <div class="mstat"><div class="mstat-val" id="lg-mRating"></div><div class="mstat-lbl">Avaliação</div></div>
                <div class="mstat"><div class="mstat-val" id="lg-mSize"></div><div class="mstat-lbl">Tamanho</div></div>
                <div class="mstat"><div class="mstat-val" id="lg-mAge"></div><div class="mstat-lbl">Faixa Etária</div></div>
              </div>
              <div class="m-desc" id="lg-mDesc"></div>
              <div class="m-infobar">
                <div class="m-infobar-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>Tamanho: <strong id="lg-mInfoSize"></strong></div>
                <div class="m-infobar-sep"></div>
                <div class="m-infobar-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><strong id="lg-mInfoYear"></strong></div>
              </div>
              <div class="mdl" id="lg-mDl">
                <div class="dlrow"><div class="dllbl"><div class="spin" id="lg-mSpin"></div><span id="lg-mDlLbl">Baixando...</span></div><div class="dlpct" id="lg-mPct">0%</div></div>
                <div class="dltrack"><div class="dlfill" id="lg-mFill" style="width:0%"></div></div>
                <div class="dlmeta"><span id="lg-mDone">0 GB</span><span id="lg-mSpd">-</span><span id="lg-mTot">-</span></div>
                <div class="dlpnote" id="lg-mPNote">⏸ Download pausado</div>
                <div class="dlbtns">
                  <button class="dlb pause" id="lg-mPBtn"><svg id="lg-mPIco" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg><span id="lg-mPLbl">Pausar</span></button>
                  <button class="dlb cancel" id="lg-mCancelBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancelar</button>
                </div>
              </div>
              <div class="mactions">
                <button class="abtn dl" id="lg-mDlBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Baixar</button>
                <button class="abtn inst" id="lg-mInstBtn" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Instalado</button>
                <button class="abtn uninst" id="lg-mUninstBtn" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>Desinstalar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="confirm-bk" id="lg-confirm-bk">
        <div class="confirm-box">
          <div class="confirm-ico">⚙</div>
          <div class="confirm-title" id="lg-confirm-title">Instalar Jogo</div>
          <div class="confirm-msg" id="lg-confirm-msg">Sua Steam será reiniciada para terminar a instalação.</div>
          <div class="confirm-btns">
            <button class="confirm-cancel" id="lg-confirm-cancel">Cancelar</button>
            <button class="confirm-ok" id="lg-confirm-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>Confirmar</button>
          </div>
        </div>
      </div>
      <div class="wrap">
        <nav>
          <div class="nav-tabs">
            <button class="nav-tab active" data-tab="all">Todos os Jogos</button>
            <button class="nav-tab" data-tab="inst">Instalados</button>
          </div>
          <div class="nav-right">
            <div class="badge-inst" id="lg-badge-inst">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              Instalados <span class="badge-n" id="lg-instN">0</span>
            </div>
            <div class="spill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input type="text" id="lg-search" placeholder="Pesquisar jogos..." autocomplete="off"><button class="spill-clear" id="lg-search-clear" title="Limpar">✕</button></div>
          </div>
        </nav>
        <div class="banner" id="lg-bannerEl">
          <img src="${bg.hero}" alt="">
          <div class="bover"></div>
          <div class="bbody">
            <div class="btag">✦ Coleção Exclusiva</div>
            <div class="bh">Jogos <span>DIRETAMENTE</span><br>NA STEAM</div>
            <div class="bp">Jogos que nunca foram para Steam, baixe e os jogue diretamente pela nossa loja</div>
            <div class="bnums">
              <div><div class="bnum" id="lg-totalN">${GAMES.length}</div><div class="blbl">Jogos</div></div>
              <div><div class="bnum">100%</div><div class="blbl">Gratuito</div></div>
              <div><div class="bnum">∞</div><div class="blbl">Diversão</div></div>
            </div>
          </div>
        </div>
        <div id="lg-allSec">
          <div class="sh">
            <div class="sl"><div class="seye">Disponíveis</div><div class="stitle">Biblioteca Gratuita</div></div>
            <div class="sline"></div>
            <div class="pills">
              <button class="pill active" data-filter="all">Todos</button>
              <button class="pill" data-filter="Ação">Ação</button>
              <button class="pill" data-filter="Corrida">Corrida</button>
            </div>
          </div>
          <div class="grid" id="lg-mainGrid"></div>
        </div>
        <div class="isec" id="lg-instSec">
          <div class="sh">
            <div class="sl"><div class="seye">Biblioteca Local</div><div class="stitle">Instalados</div></div>
            <div class="sline"></div>
          </div>
          <div class="grid" id="lg-instGrid"></div>
          <div class="empty" id="lg-emptyEl"><div class="eico">📦</div><div class="etxt">Nenhum jogo instalado ainda</div></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    wireEvents(overlay);
    renderAll();
    // Carrega estado do disco na primeira montagem
    loadInstalledMapFromDisk().then(saved => {
      Object.assign(STATE.installedMap, saved);
      renderAll();
    }).catch(() => {});
    return overlay;
  }

  async function showOverlay() {
    const o = ensureOverlay();
    o.classList.add("show");
    // Carrega estado do disco toda vez que a loja é aberta
    const saved = await loadInstalledMapFromDisk();
    // Mescla com o state atual (preserva downloads em andamento)
    Object.assign(STATE.installedMap, saved);
    renderAll();
    refreshAllInstalledStates().catch(() => {});
  }

  function hideOverlay() {
    document.getElementById(OVERLAY_ID)?.classList.remove("show");
  }

  function wireEvents(root) {
    if (root.dataset.wired === "1") return;
    root.dataset.wired = "1";
    root.querySelectorAll(".nav-tab").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab, b)));
    root.querySelector("#lg-badge-inst")?.addEventListener("click", () => setTab("inst", root.querySelector('.nav-tab[data-tab="inst"]')));
    root.querySelectorAll(".pill").forEach(b => b.addEventListener("click", () => setFilter(b.dataset.filter, b)));
    root.querySelector("#lg-mbk")?.addEventListener("click", e => { if (e.target.id === "lg-mbk") closeModal(); });
    root.querySelector("#lg-mclose")?.addEventListener("click", closeModal);
    root.querySelector("#lg-mDlBtn")?.addEventListener("click", () => { if (STATE.activeGameId) startDownload(STATE.activeGameId); });
    root.querySelector("#lg-mInstBtn")?.addEventListener("click", () => { if (STATE.activeGameId && isPendingFinalize(STATE.activeGameId)) finalizeGame(STATE.activeGameId); });
    root.querySelector("#lg-mPBtn")?.addEventListener("click", () => { if (STATE.activeGameId) togglePause(STATE.activeGameId); });
    root.querySelector("#lg-mCancelBtn")?.addEventListener("click", () => { if (STATE.activeGameId) cancelDownload(STATE.activeGameId); });
    root.querySelector("#lg-mUninstBtn")?.addEventListener("click", () => { if (STATE.activeGameId) uninstallGame(STATE.activeGameId); });
    root.addEventListener("click", e => {
      const pb = e.target.closest("[data-pause-id]");
      if (pb) { e.stopPropagation(); togglePause(pb.dataset.pauseId); return; }
      const cb = e.target.closest("[data-cancel-id]");
      if (cb) { e.stopPropagation(); cancelDownload(cb.dataset.cancelId); return; }
    });
    document.addEventListener("keydown", ev => { if (ev.key === "Escape") closeModal(); });

    // Pesquisa funcional
    const searchInput = root.querySelector("#lg-search");
    const searchClear = root.querySelector("#lg-search-clear");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        STATE.searchQuery = searchInput.value.trim();
        searchClear.classList.toggle("show", STATE.searchQuery.length > 0);
        renderAll();
      });
      searchClear.addEventListener("click", () => {
        searchInput.value = "";
        STATE.searchQuery = "";
        searchClear.classList.remove("show");
        searchInput.focus();
        renderAll();
      });
    }
  }

  function createLojaFreeButton() {
    const btn = document.createElement("div");
    btn.id = BTN_ID;
    btn.className = "_2Lu3d-5qLmW4i19ysTt2jT _7AlhCx3XGzBeIrQaCneUD";
    btn.innerHTML = '<div class="_19axKcqYRuaJ8vdYKYmtTQ">Loja Free</div>';
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      // Remove destaque de todos os outros tabs da Steam
      document.querySelectorAll(TOP_TAB_SELECTOR).forEach(el => {
        if (el.id !== BTN_ID) el.classList.remove(ACTIVE_TAB_CLASS);
      });
      btn.classList.add(ACTIVE_TAB_CLASS);
      showOverlay();
    });
    return btn;
  }

  function ensureButton() {
    if (document.getElementById(BTN_ID)) return;
    const tabs = Array.from(document.querySelectorAll(TOP_TAB_SELECTOR));
    if (!tabs.length) return;
    const com = tabs.find(el => (el.textContent || "").trim().toLowerCase().includes("comunidade"));
    if (!com || !com.parentNode) return;
    com.parentNode.insertBefore(createLojaFreeButton(), com.nextSibling);
  }

  // FIX 1: listener global com capture:true para detectar clique em qualquer
  // outro tab da Steam e retirar o destaque do botão Loja Free
  if (!window.LG_TOP_TAB_HANDLER_NEW_MODEL) {
    window.LG_TOP_TAB_HANDLER_NEW_MODEL = true;
    document.addEventListener("click", e => {
      const tab = e.target.closest(TOP_TAB_SELECTOR);
      if (!tab) return;
      if (tab.id !== BTN_ID) {
        const btn = document.getElementById(BTN_ID);
        if (btn) btn.classList.remove(ACTIVE_TAB_CLASS);
        hideOverlay();
      }
    }, true); // capture:true, roda antes dos outros handlers, não é bloqueado por stopPropagation
  }

  ensureStyles();
  ensureOverlay();
  const mo = new MutationObserver(() => ensureButton());
  mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
  ensureButton();
})();


// ──────────────────────────────────────────────────────────────────────
// 8. Painel Controle, badge de compatibilidade de controle
// ──────────────────────────────────────────────────────────────────────
(() => {
  const PANEL_HTML = `
<div role="region" aria-labelledby="lg-controller-panel-title" class="_2r4TK4BAuU-J4FuF_O7v_5 Panel" data-lg-controller-panel="1">
  <h2 class="_3A_c3YHYd4YIjA8Y-olnPl _1Q2q_tQ9_Eq8YdEHNAHS3F _3jY6xWI4URhFyYsanh9VKL" id="lg-controller-panel-title">
    <div class="_1SQ30LQnUhED7sXI79rmas">
      <div class="_3i0kopAostOz2IDi9HqmeN">Controle</div>
    </div>
  </h2>

  <div class="_31ptFGGMZrSQc5BCX1e5lm _2G5B7o_YoI__u11--EFjal _3KfxIwlXEvum7FCD_AM2_t Panel" tabindex="0" role="button">
    <div class="_5uvIN6jXDXzzck59F-nhv">
      <div class="bG5F-o9ZUikaoNCIniMEa">
        <div class="Gs_qHIFwN4Z9JusWrfbfP">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" class="_2A8NghNvAnMQQTHsudFu7H">
            <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M11.25 5.625C11.909 5.625 12.182 5.81802 12.4081 5.97792C12.568 6.09099 12.7045 6.1875 12.9375 6.1875H23.0625C23.2955 6.1875 23.432 6.09099 23.5919 5.97792C23.818 5.81802 24.091 5.625 24.75 5.625C25.875 5.625 29.25 6.75 29.8125 7.3125C30.375 7.875 30.375 8.4375 30.375 8.4375V8.5803C30.8163 8.91923 31.1986 9.26106 31.5 9.5625C32.625 10.6875 36 20.25 36 25.3125C36 30.375 32.625 30.9375 32.625 30.9375C31.7178 30.9375 30.323 29.1494 28.9649 27.4083C27.7966 25.9106 26.6553 24.4476 25.875 24.1875C24.1875 23.625 11.8125 23.625 10.125 24.1875C9.34465 24.4476 8.20344 25.9106 7.03512 27.4083C5.67696 29.1494 4.28215 30.9375 3.375 30.9375C3.375 30.9375 0 30.375 0 25.3125C0 20.25 3.375 10.6875 4.5 9.5625C4.80144 9.26106 5.18366 8.91923 5.625 8.5803V8.4375C5.625 8.4375 5.625 7.875 6.1875 7.3125C6.75 6.75 10.125 5.625 11.25 5.625ZM27.5625 8.71875C28.3392 8.71875 28.9688 9.34835 28.9688 10.125C28.9688 10.9017 28.3392 11.5312 27.5625 11.5312C26.7858 11.5312 26.1562 10.9017 26.1562 10.125C26.1562 9.34835 26.7858 8.71875 27.5625 8.71875ZM8.4375 14.625C9.68014 14.625 10.6875 13.6176 10.6875 12.375C10.6875 11.1324 9.68014 10.125 8.4375 10.125C7.19486 10.125 6.1875 11.1324 6.1875 12.375C6.1875 13.6176 7.19486 14.625 8.4375 14.625ZM23.0625 20.25C24.3051 20.25 25.3125 19.2426 25.3125 18C25.3125 16.7574 24.3051 15.75 23.0625 15.75C21.8199 15.75 20.8125 16.7574 20.8125 18C20.8125 19.2426 21.8199 20.25 23.0625 20.25ZM12.0938 17.1562V16.3125C12.0938 16.0018 12.3456 15.75 12.6562 15.75H13.7812C14.0919 15.75 14.3438 16.0018 14.3438 16.3125V17.1562H15.1875C15.4982 17.1562 15.75 17.4081 15.75 17.7188V18.8438C15.75 19.1544 15.4982 19.4062 15.1875 19.4062H14.3438V20.25C14.3438 20.5607 14.0919 20.8125 13.7812 20.8125H12.6562C12.3456 20.8125 12.0938 20.5607 12.0938 20.25V19.4062H11.25C10.9393 19.4062 10.6875 19.1544 10.6875 18.8438V17.7188C10.6875 17.4081 10.9393 17.1562 11.25 17.1562H12.0938ZM25.0312 14.0625C25.8079 14.0625 26.4375 13.4329 26.4375 12.6562C26.4375 11.8796 25.8079 11.25 25.0312 11.25C24.2546 11.25 23.625 11.8796 23.625 12.6562C23.625 13.4329 24.2546 14.0625 25.0312 14.0625ZM31.5 12.6562C31.5 13.4329 30.8704 14.0625 30.0938 14.0625C29.3171 14.0625 28.6875 13.4329 28.6875 12.6562C28.6875 11.8796 29.3171 11.25 30.0938 11.25C30.8704 11.25 31.5 11.8796 31.5 12.6562ZM28.9688 15.1875C28.9688 14.4108 28.3392 13.7812 27.5625 13.7812C26.7858 13.7812 26.1562 14.4108 26.1562 15.1875C26.1562 15.9642 26.7858 16.5938 27.5625 16.5938C28.3392 16.5938 28.9688 15.9642 28.9688 15.1875Z"></path>
          </svg>

          <div class="_1vvIpx6zQ1mZiiY1y-PtlS">
            <div class="_2L06P_EWxoS_20kC2eNCQl">Compatível com controles externos</div>
            <div class="_8tm4KhHFNHvzsiuuyHgld">O jogo funciona muito bem com o seu controle.</div>
          </div>
        </div>
      </div>

      <button type="button" class="_3Cdin80d-hVsakHUZboheb _3nJyYxGQ3kdwwabPmxNnMe DialogButton _DialogLayout Secondary Focusable" role="button">
       Configurar seu controle
      </button>
    </div>
  </div>
</div>`.trim();

  function isNotesPanel(region) {
    if (!region) return false;
    const titleEl = region.querySelector('h2 ._3i0kopAostOz2IDi9HqmeN');
    const txt = (titleEl?.textContent || '').trim().toLowerCase();
    return txt === 'anotações' || txt === 'notes';
  }

  function injectControllerAboveNotes() {
    const panels = document.querySelectorAll('div[role="region"]._2r4TK4BAuU-J4FuF_O7v_5.Panel');

    panels.forEach((panel) => {
      if (!isNotesPanel(panel)) return;

      const prev = panel.previousElementSibling;
      if (prev && prev.matches('[data-lg-controller-panel="1"]')) return;

      const wrap = document.createElement('div');
      wrap.innerHTML = PANEL_HTML;
      const controllerPanel = wrap.firstElementChild;
      if (!controllerPanel) return;

      panel.parentNode.insertBefore(controllerPanel, panel);
    });
  }

  const observer = new MutationObserver(injectControllerAboveNotes);
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', injectControllerAboveNotes);
  } else {
    injectControllerAboveNotes();
  }
})();