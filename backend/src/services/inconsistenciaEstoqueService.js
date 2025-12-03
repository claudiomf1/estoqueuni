import InconsistenciaEstoque from '../models/InconsistenciaEstoque.js';
import EventoProcessado from '../models/EventoProcessado.js';

const EXPIRACAO_MS = 24 * 60 * 60 * 1000; // 24h

class InconsistenciaEstoqueService {
  async marcarSuspeito(tenantId, sku, motivo = 'inconsistencia') {
    if (!tenantId || !sku) return;
    const expires = new Date(Date.now() + EXPIRACAO_MS);
    try {
      await InconsistenciaEstoque.findOneAndUpdate(
        { tenantId, sku },
        {
          $set: { motivo, ultimaDeteccao: new Date(), expiresAt: expires },
          $inc: { contador: 1 },
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.warn('[INCONSISTENCIA] Não foi possível marcar SKU suspeito:', sku, error.message);
    }
  }

  async resolverSuspeito(tenantId, sku) {
    if (!tenantId || !sku) return;
    try {
      await InconsistenciaEstoque.deleteOne({ tenantId, sku });
    } catch (error) {
      console.warn('[INCONSISTENCIA] Não foi possível remover SKU suspeito:', sku, error.message);
    }
  }

  async listarSuspeitos(tenantId, limit = 50) {
    if (!tenantId) return [];
    const limite = Math.min(Number(limit) || 50, 200);
    return InconsistenciaEstoque.find({ tenantId })
      .sort({ ultimaDeteccao: -1 })
      .limit(limite)
      .lean();
  }

  async obterUltimosSkusProcessados(tenantId, horas = 24, limite = 50) {
    if (!tenantId) return [];
    const janela = new Date(Date.now() - (Number(horas) || 24) * 60 * 60 * 1000);
    const registros = await EventoProcessado.find({
      tenantId,
      processadoEm: { $gte: janela },
    })
      .select('produtoId sku processadoEm')
      .sort({ processadoEm: -1 })
      .limit(Math.min(Number(limite) || 50, 200))
      .lean();

    const vistos = new Set();
    const lista = [];
    for (const reg of registros) {
      const chave = reg.sku || reg.produtoId;
      if (!chave) continue;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      lista.push(chave);
    }
    return lista;
  }
}

export default new InconsistenciaEstoqueService();
