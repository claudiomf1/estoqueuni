const URLS_LOGOUT_BLING = [
  'https://www.bling.com.br/login?logout=1',
  'https://www.bling.com.br/login',
];

const aguardar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

const adicionarCacheBuster = (url, timestamp = Date.now()) => {
  if (!url || typeof url !== 'string') return '';
  const separador = url.includes('?') ? '&' : '?';
  return `${url}${separador}_ts=${timestamp}`;
};

const navegarSequencia = async (popup, urls, intervaloMs) => {
  for (const destino of urls) {
    if (!popup || popup.closed) break;
    try {
      popup.location = destino;
    } catch {
      // Ignora erros cross-origin
    }
    await aguardar(intervaloMs);
  }
};

const executarLogoutBling = async (popup, intervaloMs) => {
  const timestamp = Date.now();
  const destinos = URLS_LOGOUT_BLING.map((url) => adicionarCacheBuster(url, timestamp));
  await navegarSequencia(popup, destinos, intervaloMs);
};

/**
 * Abre um popup apontando para a tela de autorização do Bling
 * Força logout antes de abrir a URL final para garantir que o usuário veja a tela de login
 * @param {string} urlAutorizacao URL retornada pelo backend (https://www.bling.com.br/Api/v3/oauth/authorize...)
 * @param {Object} opcoes
 * @param {Function} opcoes.aoPopupBloqueado callback acionado quando o navegador bloqueia o popup
 * @param {number} opcoes.intervaloLogout tempo em ms entre cada navegação de logout
 * @returns {Promise<{ popup: Window|null, urlFinal: string }>}
 */
export async function abrirPopupAutorizacaoBling(
  urlAutorizacao,
  { aoPopupBloqueado, intervaloLogout = 1100 } = {}
) {
  if (typeof window === 'undefined') {
    throw new Error('Ambiente sem janela disponível para abrir popup.');
  }

  if (!urlAutorizacao || typeof urlAutorizacao !== 'string') {
    throw new Error('URL de autorização inválida.');
  }

  if (!urlAutorizacao.startsWith('https://www.bling.com.br')) {
    throw new Error('URL de autorização precisa iniciar com https://www.bling.com.br');
  }

  const urlComCache = adicionarCacheBuster(urlAutorizacao.trim());
  const largura = 640;
  const altura = 720;
  const esquerda = window.screen ? window.screen.width / 2 - largura / 2 : 100;
  const topo = window.screen ? window.screen.height / 2 - altura / 2 : 100;
  const especificacoes = [
    `width=${largura}`,
    `height=${altura}`,
    `left=${Math.max(0, esquerda)}`,
    `top=${Math.max(0, topo)}`,
    'resizable=yes',
    'scrollbars=yes',
    'toolbar=no',
    'menubar=no',
  ].join(',');

  const popup = window.open('about:blank', 'BlingAutorizacao', especificacoes);

  if (!popup) {
    if (typeof aoPopupBloqueado === 'function') {
      aoPopupBloqueado(urlComCache);
    }
    return { popup: null, urlFinal: urlComCache };
  }

  try {
    await executarLogoutBling(popup, intervaloLogout);
    popup.location = urlComCache;
  } catch (erro) {
    console.warn('⚠️ Não foi possível controlar completamente o popup do Bling:', erro.message);
    try {
      popup.location = urlComCache;
    } catch {
      // Ignora
    }
  }

  return { popup, urlFinal: urlComCache };
}

export default abrirPopupAutorizacaoBling;



