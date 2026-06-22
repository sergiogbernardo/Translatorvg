const DEFAULT_ENDPOINTS = [
  'https://libretranslate.de',
  'https://translate.argosopentech.com',
  'https://translate.astian.org',
];

const FALLBACK_LANGUAGES = [
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
  endpoint: 'translatorvg-endpoint',
  sourceLang: 'translatorvg-source-lang',
  targetLang: 'translatorvg-target-lang',
  history: 'translatorvg-history',
  favorites: 'translatorvg-favorites',
};

const cache = new Map();

const state = {
  endpoint: localStorage.getItem(STORAGE_KEYS.endpoint) || DEFAULT_ENDPOINTS[0],
  languages: [...FALLBACK_LANGUAGES],
  sourceLang: localStorage.getItem(STORAGE_KEYS.sourceLang) || 'auto',
  targetLang: localStorage.getItem(STORAGE_KEYS.targetLang) || 'en',
  history: loadJSON(STORAGE_KEYS.history, []),
  favorites: loadJSON(STORAGE_KEYS.favorites, []),
  text: '',
  result: '',
  detectedLang: null,
  loading: false,
  copied: false,
};

const els = {
  apiDot: document.getElementById('apiDot'),
  apiStatus: document.getElementById('apiStatus'),
  endpointSelect: document.getElementById('endpointSelect'),
  customEndpoint: document.getElementById('customEndpoint'),
  saveEndpoint: document.getElementById('saveEndpoint'),
  refreshLanguages: document.getElementById('refreshLanguages'),
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

init();

function init() {
  populateEndpointSelect();
  syncSettingsInputs();
  wireEvents();
  renderAll();
  refreshLanguages().catch(() => null);
}

function wireEvents() {
  els.endpointSelect?.addEventListener('change', () => {
    const value = els.endpointSelect.value;
    els.customEndpoint.value = value.startsWith('custom:')
      ? value.slice('custom:'.length)
      : '';
  });

  els.saveEndpoint?.addEventListener('click', () => {
    const selected = els.endpointSelect.value;
    const customValue = els.customEndpoint.value.trim();
    const endpoint = selected === 'custom:' || selected.startsWith('custom:')
      ? customValue
      : selected;

    if (!endpoint) {
      setStatus('warning', 'Informe um endpoint válido.');
      return;
    }

    state.endpoint = endpoint.replace(/\/$/, '');
    localStorage.setItem(STORAGE_KEYS.endpoint, state.endpoint);
    populateEndpointSelect();
    setStatus('warning', 'Endpoint salvo. Atualizando idiomas…');
    refreshLanguages().catch((error) => {
      setStatus('error', error.message || 'Falha ao conectar.');
    });
  });

  els.refreshLanguages?.addEventListener('click', () => {
    refreshLanguages().catch((error) => {
      setStatus('error', error.message || 'Falha ao conectar.');
    });
  });

  els.sourceLang?.addEventListener('change', () => {
    state.sourceLang = els.sourceLang.value;
    localStorage.setItem(STORAGE_KEYS.sourceLang, state.sourceLang);
    autoTranslate();
  });

  els.targetLang?.addEventListener('change', () => {
    state.targetLang = els.targetLang.value;
    localStorage.setItem(STORAGE_KEYS.targetLang, state.targetLang);
    autoTranslate();
  });

  els.swapLanguages?.addEventListener('click', () => {
    const nextSource = state.sourceLang === 'auto' ? state.detectedLang || state.targetLang : state.sourceLang;
    state.sourceLang = state.targetLang;
    state.targetLang = nextSource;
    localStorage.setItem(STORAGE_KEYS.sourceLang, state.sourceLang);
    localStorage.setItem(STORAGE_KEYS.targetLang, state.targetLang);
    syncLanguageSelects();
    autoTranslate(true);
  });

  els.toggleFavorite?.addEventListener('click', () => {
    const pair = { source: state.sourceLang, target: state.targetLang };
    const exists = state.favorites.some(
      (item) => item.source === pair.source && item.target === pair.target,
    );

    if (exists) {
      state.favorites = state.favorites.filter(
        (item) => !(item.source === pair.source && item.target === pair.target),
      );
    } else {
      state.favorites = [...state.favorites, pair].slice(-8);
    }

    persistJSON(STORAGE_KEYS.favorites, state.favorites);
    renderFavorites();
    updateFavoriteButton();
  });

  els.sourceText?.addEventListener('input', () => {
    state.text = els.sourceText.value;
    autoTranslate();
  });

  els.translateBtn?.addEventListener('click', () => translateNow(true));
  els.clearBtn?.addEventListener('click', clearInput);
  els.copyResult?.addEventListener('click', copyResult);
  els.speakResult?.addEventListener('click', speakResult);
  els.clearHistory?.addEventListener('click', () => {
    state.history = [];
    persistJSON(STORAGE_KEYS.history, state.history);
    renderHistory();
  });
}

function populateEndpointSelect() {
  const current = state.endpoint;
  const values = [
    ...DEFAULT_ENDPOINTS,
    ...(current && !DEFAULT_ENDPOINTS.includes(current) ? [current] : []),
  ];

  els.endpointSelect.innerHTML = '';
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    els.endpointSelect.append(option);
  });

  const customOption = document.createElement('option');
  customOption.value = `custom:${current}`;
  customOption.textContent = 'Custom endpoint';
  els.endpointSelect.append(customOption);

  if (DEFAULT_ENDPOINTS.includes(current)) {
    els.endpointSelect.value = current;
    els.customEndpoint.value = '';
  } else {
    els.endpointSelect.value = `custom:${current}`;
    els.customEndpoint.value = current;
  }
}

function syncSettingsInputs() {
  syncLanguageSelects();
  els.sourceText.value = state.text;
}

function syncLanguageSelects() {
  renderLanguages();
  els.sourceLang.value = state.sourceLang;
  els.targetLang.value = state.targetLang;
  updateFavoriteButton();
}

function renderLanguages() {
  const languages = state.languages.length ? state.languages : FALLBACK_LANGUAGES;
  const sourceSelect = els.sourceLang;
  const targetSelect = els.targetLang;
  sourceSelect.innerHTML = '';
  targetSelect.innerHTML = '';

  languages.forEach((language) => {
    const sourceOption = document.createElement('option');
    sourceOption.value = language.code;
    sourceOption.textContent = language.name;
    sourceSelect.append(sourceOption);

    if (language.code !== 'auto') {
      const targetOption = document.createElement('option');
      targetOption.value = language.code;
      targetOption.textContent = language.name;
      targetSelect.append(targetOption);
    }
  });
}

async function refreshLanguages() {
  setStatus('warning', 'Conectando à API…');
  const endpoints = uniqueEndpoints();

  for (const endpoint of endpoints) {
    try {
      const langs = await requestJSON(`${endpoint}/languages`);
      if (!Array.isArray(langs) || !langs.length) continue;

      state.endpoint = endpoint;
      state.languages = [{ code: 'auto', name: 'Auto detect' }, ...langs];
      localStorage.setItem(STORAGE_KEYS.endpoint, state.endpoint);
      populateEndpointSelect();
      syncLanguageSelects();
      setStatus('ok', `API pronta em ${stripProtocol(endpoint)}`);
      return;
    } catch {
      // Try the next endpoint.
    }
  }

  state.languages = [...FALLBACK_LANGUAGES];
  syncLanguageSelects();
  setStatus('warning', 'API indisponível. Você pode ajustar o endpoint.');
  throw new Error('Nenhum endpoint respondeu.');
}

function uniqueEndpoints() {
  const endpoints = [state.endpoint, ...DEFAULT_ENDPOINTS];
  return [...new Set(endpoints.map((item) => item.replace(/\/$/, '')))];
}

async function translateNow(manual = false) {
  const text = els.sourceText.value.trim();
  state.text = els.sourceText.value;

  if (!text) {
    state.result = '';
    state.detectedLang = null;
    renderResult();
    return;
  }

  const sourceLang = els.sourceLang.value;
  const targetLang = els.targetLang.value;
  const cacheKey = `${state.endpoint}|${sourceLang}|${targetLang}|${text}`;

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    applyTranslation(cached, text, sourceLang, targetLang, false);
    return;
  }

  try {
    setLoading(true);
    const payload = {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text',
    };
    const translated = await requestJSON(`${state.endpoint}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    cache.set(cacheKey, translated);
    applyTranslation(translated, text, sourceLang, targetLang, true);
  } catch (error) {
    state.result = `Translation failed: ${error.message || 'unknown error'}`;
    state.detectedLang = null;
    renderResult();
  } finally {
    setLoading(false);
    void manual;
  }
}

let debounceId;
function autoTranslate(force = false) {
  if (debounceId) clearTimeout(debounceId);

  if (force) {
    translateNow(false);
    return;
  }

  debounceId = setTimeout(() => {
    translateNow(false);
  }, 500);
}

function applyTranslation(data, input, sourceLang, targetLang, saveHistory) {
  state.result = data.translatedText || data.translated_text || '';
  const detected = data.detectedLanguage?.language || data.detected_lang || null;
  state.detectedLang = detected;
  renderResult();

  if (saveHistory) {
    addHistory({
      input,
      result: state.result,
      sourceLang,
      targetLang,
      detectedLang: detected,
    });
  }
}

function addHistory(entry) {
  const normalized = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...entry,
    at: Date.now(),
  };
  state.history = [normalized, ...state.history.filter((item) => item.input !== entry.input || item.targetLang !== entry.targetLang)].slice(0, 20);
  persistJSON(STORAGE_KEYS.history, state.history);
  renderHistory();
}

function renderResult() {
  const hasResult = Boolean(state.result);
  els.resultTitle.textContent = hasResult ? 'Tradução concluída' : 'Pronto para traduzir';
  els.resultText.textContent = state.result || 'O texto traduzido aparece aqui.';
  els.detectedBadge.textContent = state.detectedLang ? `Detectado: ${languageName(state.detectedLang)}` : 'Auto-detect';
}

function renderHistory() {
  const list = els.historyList;
  list.innerHTML = '';

  if (!state.history.length) {
    list.append(emptyState('Sem histórico ainda.'));
    return;
  }

  state.history.forEach((item) => {
    const template = els.historyItemTemplate.content.firstElementChild.cloneNode(true);
    template.querySelector('strong').textContent = `${truncate(item.input, 56)}`;
    template.querySelector('span').textContent = `${languageName(item.sourceLang)} → ${languageName(item.targetLang)}`;
    template.addEventListener('click', () => restoreHistory(item));
    list.append(template);
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
    const template = els.favoriteItemTemplate.content.firstElementChild.cloneNode(true);
    template.textContent = `${languageName(pair.source)} → ${languageName(pair.target)}`;
    template.addEventListener('click', () => {
      state.sourceLang = pair.source;
      state.targetLang = pair.target;
      localStorage.setItem(STORAGE_KEYS.sourceLang, state.sourceLang);
      localStorage.setItem(STORAGE_KEYS.targetLang, state.targetLang);
      syncLanguageSelects();
      autoTranslate(true);
    });
    list.append(template);
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
  utterance.lang = state.targetLang === 'auto' ? 'en' : state.targetLang;
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
}

function setStatus(kind, message) {
  els.apiStatus.textContent = message;
  els.apiDot.classList.remove('is-ok', 'is-warn');

  if (kind === 'ok') {
    els.apiDot.classList.add('is-ok');
  } else if (kind === 'warning') {
    els.apiDot.classList.add('is-warn');
  }
}

function renderAll() {
  renderResult();
  renderHistory();
  renderFavorites();
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

function requestJSON(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  })
    .then(async (response) => {
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .catch((error) => {
      clearTimeout(timeout);
      throw error;
    });
}

function languageName(code) {
  if (!code) return '';
  const lang = state.languages.find((item) => item.code === code);
  return lang?.name || code;
}

function stripProtocol(value) {
  return value.replace(/^https?:\/\//, '');
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
