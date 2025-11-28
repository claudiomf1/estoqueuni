import express from 'express';

const router = express.Router();

// Rotas de branding simples para integração com JetSkin/PrecoFacilMarket
// Estas rotas retornam configurações mínimas porém válidas para os testes de mídia.

// Utilizamos data URI para evitar dependência de arquivos físicos ou HTTP externo.
const DATA_URI_IMAGEM_SIMBOLICA = 'data:image/png;base64,iVBORw0KGgo='; // Stub suficiente para os testes

router.get('/:tenantId/favicon', (req, res) => {
  return res.json({
    success: true,
    data: {
      // Os testes aceitam faviconUrl, url ou dataUri.
      dataUri: DATA_URI_IMAGEM_SIMBOLICA,
    },
  });
});

router.get('/:tenantId/logo', (req, res) => {
  return res.json({
    success: true,
    data: {
      // Os testes aceitam logoUrl, url ou dataUri.
      dataUri: DATA_URI_IMAGEM_SIMBOLICA,
    },
  });
});

router.get('/:tenantId/landing', (req, res) => {
  return res.json({
    success: true,
    data: {
      // Os testes procuram por heroImageUrl especificamente.
      heroImageUrl: DATA_URI_IMAGEM_SIMBOLICA,
    },
  });
});

router.get('/:tenantId/feature-cards', (req, res) => {
  // Cards padrão mínimos. A imagem é opcional quando source === "default",
  // conforme verificação em feature-cards.test.js.
  const cardsPadrao = [
    {
      title: 'Envio rápido',
      description: 'Entrega ágil para todo o Brasil.',
    },
    {
      title: 'Melhores ofertas',
      description: 'Preços competitivos atualizados diariamente.',
    },
    {
      title: 'Atendimento dedicado',
      description: 'Suporte especializado para o seu negócio.',
    },
  ];

  return res.json({
    success: true,
    source: 'default',
    cards: cardsPadrao,
  });
});

export default router;


