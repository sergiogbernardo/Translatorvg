const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

const LANGUAGES = [
  { code: 'auto', name: 'Auto detect' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
];

const STORAGE_KEYS = {
  sourceLang: 'translatorvg-source-lang',
  targetLang: 'translatorvg-target-lang',
  history: 'translatorvg-history',
  favorites: 'translatorvg-favorites',
};

const cache = new Map();
const MATRIX_CHARS = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&@*+-'.split('');

const state = {
  sourceLang: localStorage.getItem(STORAGE_KEYS.sourceLang) || 'auto',
  targetLang: localStorage.getItem(STORAGE_KEYS.targetLang) || 'en',
  history: loadJSON(STORAGE_KEYS.history, []),
  favorites: loadJSON(STORAGE_KEYS.favorites, []),
  text: '',
  result: '',
  detectedLang: null,
  loading: false,
};

const els = {
  apiDot: document.getElementById('apiDot'),
  apiStatus: document.getElementById('apiStatus'),
  sourceLang: document.getElementById('sourceLang'),
  targetLang: document.getElementById('targetLang'),
  swapLanguages: document.getElementById('swapLanguages'),
  toggleFavorite: document.getElementById('toggleFavorite'),
  sourceText: document.getElementById('sourceText'),
  translateBtn: document.getElementById('translateBtn'),
  clearBtn: document.getElementById('clearBtn'),
  copyResult: document.getElementById('copyResult'),
  speakResult: document.getElementById('speakResult'),
  resultTitle: document.getElementById('resultTitle'),
  resultText: document.getElementById('resultText'),
  detectedBadge: document.getElementById('detectedBadge'),
  historyList: document.getElementById('historyList'),
  favoritesList: document.getElementById('favoritesList'),
  clearHistory: document.getElementById('clearHistory'),
  historyItemTemplate: document.getElementById('historyItemTemplate'),
  favoriteItemTemplate: document.getElementById('favoriteItemTemplate'),
};

initMatrixRain();
init();

function init() {
  renderLanguageSelects();
  syncLanguageSelects();
  wireEvents();
  renderAll();
  renderFooterYear();
  setStatus('ok', 'MyMemory online');
}

function renderFooterYear() {
  const yearEl = document.getElementById('footerYear');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function wireEvents() {
  els.sourceLang.addEventListener('change', () => {
    state.sourceLang = els.sourceLang.value;
    localStorage.setItem(STORAGE_KEYS.sourceLang, state.sourceLang);
    updateFavoriteButton();
    autoTranslate();
  });

  els.targetLang.addEventListener('change', () => {
    state.targetLang = els.targetLang.value;
    localStorage.setItem(STORAGE_KEYS.targetLang, state.targetLang);
    updateFavoriteButton();
    autoTranslate();
  });

  els.swapLanguages.addEventListener('click', () => {
    const currentSource = state.sourceLang === 'auto' ? state.detectedLang || state.targetLang : state.sourceLang;
    state.sourceLang = state.targetLang;
    state.targetLang = currentSource;
    localStorage.setItem(STORAGE_KEYS.sourceLang, state.sourceLang);
    localStorage.setItem(STORAGE_KEYS.targetLang, state.targetLang);
    syncLanguageSelects();
    autoTranslate(true);
  });

  els.toggleFavorite.addEventListener('click', () => {
    const pair = { source: state.sourceLang, target: state.targetLang };
    const exists = state.favorites.some(
      (item) => item.source === pair.source && item.target === pair.target,
    );

    state.favorites = exists
      ? state.favorites.filter((item) => !(item.source === pair.source && item.target === pair.target))
      : [...state.favorites, pair].slice(-5);

    persistJSON(STORAGE_KEYS.favorites, state.favorites);
    renderFavorites();
    updateFavoriteButton();
  });

  els.sourceText.addEventListener('input', () => {
    state.text = els.sourceText.value;
    autoTranslate();
  });

  els.translateBtn.addEventListener('click', () => translateNow(true));
  els.clearBtn.addEventListener('click', clearInput);
  els.copyResult.addEventListener('click', copyResult);
  els.speakResult.addEventListener('click', speakResult);
  els.clearHistory.addEventListener('click', () => {
    state.history = [];
    persistJSON(STORAGE_KEYS.history, state.history);
    renderHistory();
  });
}

function renderLanguageSelects() {
  els.sourceLang.innerHTML = '';
  els.targetLang.innerHTML = '';

  LANGUAGES.forEach((language) => {
    const sourceOption = document.createElement('option');
    sourceOption.value = language.code;
    sourceOption.textContent = language.name;
    els.sourceLang.append(sourceOption);

    if (language.code !== 'auto') {
      const targetOption = document.createElement('option');
      targetOption.value = language.code;
      targetOption.textContent = language.name;
      els.targetLang.append(targetOption);
    }
  });
}

function syncLanguageSelects() {
  els.sourceLang.value = state.sourceLang;
  els.targetLang.value = state.targetLang;
  updateFavoriteButton();
}

async function translateNow(saveHistory = false) {
  const input = els.sourceText.value.trim();
  state.text = els.sourceText.value;

  if (!input) {
    state.result = '';
    state.detectedLang = null;
    renderResult();
    return;
  }

  const detectedSource = state.sourceLang === 'auto' ? detectLanguage(input) : state.sourceLang;
  const cacheKey = `${detectedSource}|${state.targetLang}|${input}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    applyTranslation(cached, input, detectedSource, state.targetLang, saveHistory);
    return;
  }

  try {
    setLoading(true);
    const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(input)}&langpair=${encodeURIComponent(detectedSource)}|${encodeURIComponent(state.targetLang)}`;
    const response = await requestJSON(url);
    const translated = {
      translatedText: response?.responseData?.translatedText || '',
      detectedLanguage: { language: detectedSource },
      responseDetails: response?.responseDetails,
    };

    cache.set(cacheKey, translated);
    applyTranslation(translated, input, detectedSource, state.targetLang, true);
  } catch (error) {
    state.result = `Translation failed: ${error.message || 'unknown error'}`;
    state.detectedLang = null;
    renderResult();
  } finally {
    setLoading(false);
  }
}

let debounceId;
function autoTranslate(force = false) {
  if (debounceId) clearTimeout(debounceId);
  if (force) {
    translateNow(false);
    return;
  }
  debounceId = setTimeout(() => translateNow(false), 500);
}

function applyTranslation(data, input, sourceLang, targetLang, saveHistory) {
  state.result = data.translatedText || '';
  state.detectedLang = sourceLang;
  renderResult();

  if (saveHistory) {
    addHistory({
      input,
      result: state.result,
      sourceLang,
      targetLang,
      detectedLang: sourceLang,
    });
  }
}

function addHistory(entry) {
  const normalized = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...entry,
    at: Date.now(),
  };

  state.history = [
    normalized,
    ...state.history.filter(
      (item) => !(item.input === entry.input && item.targetLang === entry.targetLang),
    ),
  ].slice(0, 5);

  persistJSON(STORAGE_KEYS.history, state.history);
  renderHistory();
}

function renderResult() {
  const hasResult = Boolean(state.result);
  els.resultTitle.textContent = hasResult ? 'Tradução concluída' : 'Pronto para traduzir';
  els.resultText.textContent = state.result || 'O texto traduzido aparece aqui.';
  els.detectedBadge.textContent = state.detectedLang
    ? `Detectado: ${languageName(state.detectedLang)}`
    : 'Auto-detect';
}

function renderHistory() {
  const list = els.historyList;
  list.innerHTML = '';

  if (!state.history.length) {
    list.append(emptyState('Sem histórico ainda.'));
    return;
  }

  state.history.forEach((item) => {
    const node = els.historyItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('strong').textContent = truncate(item.input, 56);
    node.querySelector('span').textContent = `${languageName(item.sourceLang)} → ${languageName(item.targetLang)}`;
    node.addEventListener('click', () => restoreHistory(item));
    list.append(node);
  });
}

function renderFavorites() {
  const list = els.favoritesList;
  list.innerHTML = '';

  if (!state.favorites.length) {
    list.append(emptyState('Salve pares de idiomas para acesso rápido.'));
    return;
  }

  state.favorites.forEach((pair) => {
    const node = els.favoriteItemTemplate.content.firstElementChild.cloneNode(true);
    node.textContent = `${languageName(pair.source)} → ${languageName(pair.target)}`;
    node.addEventListener('click', () => {
      state.sourceLang = pair.source;
      state.targetLang = pair.target;
      localStorage.setItem(STORAGE_KEYS.sourceLang, state.sourceLang);
      localStorage.setItem(STORAGE_KEYS.targetLang, state.targetLang);
      syncLanguageSelects();
      autoTranslate(true);
    });
    list.append(node);
  });
}

function updateFavoriteButton() {
  const exists = state.favorites.some(
    (item) => item.source === state.sourceLang && item.target === state.targetLang,
  );
  els.toggleFavorite.textContent = exists ? 'Favorito' : 'Favoritar';
}

function restoreHistory(entry) {
  els.sourceText.value = entry.input;
  state.text = entry.input;
  state.result = entry.result;
  state.sourceLang = entry.sourceLang;
  state.targetLang = entry.targetLang;
  state.detectedLang = entry.detectedLang;
  localStorage.setItem(STORAGE_KEYS.sourceLang, state.sourceLang);
  localStorage.setItem(STORAGE_KEYS.targetLang, state.targetLang);
  syncLanguageSelects();
  renderResult();
}

async function copyResult() {
  if (!state.result) return;
  try {
    await navigator.clipboard.writeText(state.result);
    els.copyResult.textContent = 'Copiado';
    setTimeout(() => {
      els.copyResult.textContent = 'Copiar';
    }, 1200);
  } catch {
    setStatus('warning', 'Clipboard indisponível.');
  }
}

function speakResult() {
  if (!state.result || !('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(state.result);
  utterance.lang = state.targetLang;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function clearInput() {
  els.sourceText.value = '';
  state.text = '';
  state.result = '';
  state.detectedLang = null;
  renderResult();
}

function setLoading(isLoading) {
  state.loading = isLoading;
  els.translateBtn.disabled = isLoading;
  els.translateBtn.textContent = isLoading ? 'Traduzindo…' : 'Traduzir';
  els.apiDot.classList.toggle('is-ok', !isLoading);
  els.apiDot.classList.toggle('is-warn', isLoading);
  els.apiStatus.textContent = isLoading ? 'Traduzindo…' : 'MyMemory online';
}

function setStatus(kind, message) {
  els.apiStatus.textContent = message;
  els.apiDot.classList.remove('is-ok', 'is-warn');
  if (kind === 'ok') els.apiDot.classList.add('is-ok');
  if (kind === 'warning') els.apiDot.classList.add('is-warn');
}

function renderAll() {
  renderResult();
  renderHistory();
  renderFavorites();
}

function requestJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  return fetch(url, { signal: controller.signal })
    .then(async (response) => {
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      clearTimeout(timeout);
      throw error;
    });
}

function detectLanguage(text) {
  const value = text.toLowerCase();
  if (/[ãõáàâéêíóôúç]/.test(value)) return 'pt';
  if (/[ñ¡¿]/.test(value) || /\b(hola|gracias|usted|para|pero)\b/.test(value)) return 'es';
  if (/\b(je|bonjour|merci|vous|avec)\b/.test(value) || /[àâæçéèêëîïôœùûüÿ]/.test(value)) return 'fr';
  if (/\b(der|die|das|und|nicht|ich)\b/.test(value)) return 'de';
  if (/\b(il|ciao|grazie|perché|con)\b/.test(value)) return 'it';
  if (/\b(o|a|the|and|you|is|are|this|that)\b/.test(value)) return 'en';
  return 'en';
}

function languageName(code) {
  if (!code) return '';
  return LANGUAGES.find((item) => item.code === code)?.name || code;
}

function persistJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function truncate(value, max) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function emptyState(text) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.textContent = text;
  return div;
}

function initMatrixRain() {
  const canvas = document.getElementById('matrixCanvas');
  if (!(canvas instanceof HTMLCanvasElement)) return;

  let context;
  try {
    context = canvas.getContext('2d');
  } catch {
    return;
  }
  if (!context) return;

  let animationFrame = 0;
  let width = 0;
  let height = 0;
  let columns = 0;
  let drops = [];

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    columns = Math.max(1, Math.floor(width / 18));
    drops = Array.from({ length: columns }, () => Math.random() * height);
  };

  const draw = () => {
    context.fillStyle = 'rgba(0, 0, 0, 0.08)';
    context.fillRect(0, 0, width, height);

    context.fillStyle = 'rgba(34, 197, 94, 0.48)';
    context.shadowColor = 'rgba(34, 197, 94, 0.35)';
    context.shadowBlur = 8;
    context.font = '16px monospace';

    for (let column = 0; column < columns; column += 1) {
      const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      const x = column * 18;
      const y = drops[column];

      context.fillText(char, x, y);

      if (y > height && Math.random() > 0.975) {
        drops[column] = 0;
      } else {
        drops[column] += 18;
      }
    }

    animationFrame = window.requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener('resize', resize);

  window.addEventListener(
    'beforeunload',
    () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    },
    { once: true },
  );
}
