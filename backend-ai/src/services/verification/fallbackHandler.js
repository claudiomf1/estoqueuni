import logger from "../../utils/logger.js";

/**
 * Stub básico do FallbackHandler
 * TODO: Implementar fallback completo no Agente 5
 */
export class FallbackHandler {
  handleLowConfidence(question, response, confidence, context) {
    try {
      const { score } = confidence;

      // Se confiança for alta, retorna resposta normal
      if (score >= 0.7) {
        return {
          answer: response,
          sources: context.sources || [],
          actions: [],
          disclaimer: null,
        };
      }

      // Se confiança for média, adiciona disclaimer
      if (score >= 0.5) {
        return {
          answer: response,
          sources: context.sources || [],
          actions: [],
          disclaimer:
            "Esta resposta tem confiança moderada. Recomendo verificar a documentação oficial.",
        };
      }

      // Se confiança for baixa, sugere ações
      return {
        answer: response,
        sources: context.sources || [],
        actions: [
          { type: "contact_support", label: "Falar com suporte" },
          { type: "view_docs", label: "Ver documentação" },
        ],
        disclaimer:
          "Não tenho certeza completa sobre esta resposta. Recomendo contatar o suporte ou consultar a documentação.",
      };
    } catch (error) {
      logger.error("Error handling fallback:", error);
      return {
        answer: response,
        sources: [],
        actions: [],
        disclaimer: null,
      };
    }
  }
}



















