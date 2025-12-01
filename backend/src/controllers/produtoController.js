// backend/src/controllers/produtoController.js
import Produto from '../models/Produto.js';
import BlingConfig from '../models/BlingConfig.js';
import blingService from '../services/blingService.js';
import { getBrazilNow } from '../utils/timezone.js';

class ProdutoController {
  async listarProdutos(req, res) {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      const produtos = await Produto.find({ tenantId })
        .sort({ updatedAt: -1 })
        .lean();

      // Converter Map para objeto se necessário
      const produtosFormatados = produtos.map(produto => {
        if (produto.estoquePorConta instanceof Map) {
          produto.estoquePorConta = Object.fromEntries(produto.estoquePorConta);
        }
        return produto;
      });

      return res.json({
        success: true,
        data: produtosFormatados
      });
    } catch (error) {
      console.error('Erro ao listar produtos:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar produtos'
      });
    }
  }

  async obterProduto(req, res) {
    try {
      const { tenantId } = req.query;
      const { sku } = req.params;

      if (!tenantId || !sku) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e sku são obrigatórios'
        });
      }

      const produto = await Produto.findOne({ tenantId, sku }).lean();

      if (!produto) {
        return res.status(404).json({
          success: false,
          error: 'Produto não encontrado'
        });
      }

      // Converter Map para objeto se necessário
      if (produto.estoquePorConta instanceof Map) {
        produto.estoquePorConta = Object.fromEntries(produto.estoquePorConta);
      }

      return res.json({
        success: true,
        data: produto
      });
    } catch (error) {
      console.error('Erro ao obter produto:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter produto'
      });
    }
  }

  /**
   * Verifica quantos produtos existem no Bling vs EstoqueUni
   * GET /api/produtos/verificacao?tenantId=xxx
   */
  async verificarProdutos(req, res) {
    try {
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId é obrigatório'
        });
      }

      // Buscar todas as contas Bling do tenant (mesma lógica do listarContas)
      const todasContas = await BlingConfig.find({ tenantId }).sort({
        createdAt: -1
      });

      // Considerar apenas contas ativas (is_active diferente de false)
      const contasBling = todasContas.filter(
        (conta) => conta.is_active !== false
      );

      if (contasBling.length === 0) {
        return res.json({
          success: true,
          data: {
            contas: [],
            totalEstoqueUni: 0,
            resumo: {
              totalContas: 0,
              totalProdutosBling: 0,
              totalProdutosEstoqueUni: 0,
              totalProdutosEstoqueUniPorConta: 0
            }
          }
        });
      }

      // Buscar produtos no EstoqueUni
      const produtosEstoqueUni = await Produto.find({ tenantId }).lean();
      const totalEstoqueUni = produtosEstoqueUni.length;

      // Criar mapa de produtos por conta no EstoqueUni
      const produtosPorContaEstoqueUni = {};
      produtosEstoqueUni.forEach(produto => {
        // Usar contasBling se disponível, senão usar estoquePorConta
        let contas = [];
        if (produto.contasBling && Array.isArray(produto.contasBling) && produto.contasBling.length > 0) {
          contas = produto.contasBling;
        } else {
          // Fallback para estoquePorConta
          const estoquePorConta = produto.estoquePorConta instanceof Map
            ? Object.fromEntries(produto.estoquePorConta)
            : produto.estoquePorConta || {};
          contas = Object.keys(estoquePorConta);
        }
        
        contas.forEach(blingAccountId => {
          if (blingAccountId) {
            if (!produtosPorContaEstoqueUni[blingAccountId]) {
              produtosPorContaEstoqueUni[blingAccountId] = new Set();
            }
            produtosPorContaEstoqueUni[blingAccountId].add(produto.sku);
          }
        });
      });

      // Buscar produtos de cada conta Bling
      const verificacaoContas = await Promise.all(
        contasBling.map(async (conta) => {
          try {
            // Buscar todos os produtos do Bling (pode precisar paginar)
            let totalProdutosBling = 0;
            let pagina = 1;
            const limite = 100;
            let temMais = true;
            const skusBling = new Set();

            while (temMais) {
              try {
                const produtos = await blingService.getProdutos(
                  { limit: limite, page: pagina },
                  tenantId,
                  conta.blingAccountId
                );

                if (!produtos || produtos.length === 0) {
                  temMais = false;
                  break;
                }

                produtos.forEach(produto => {
                  if (produto.codigo) {
                    // Normalizar SKU (mesma lógica do serviço)
                    const skuNormalizado = produto.codigo
                      .toString()
                      .trim()
                      .toUpperCase()
                      .replace(/^0+/, '');
                    skusBling.add(skuNormalizado);
                  }
                });

                totalProdutosBling = skusBling.size;

                // Se retornou menos que o limite, não há mais páginas
                if (produtos.length < limite) {
                  temMais = false;
                } else {
                  pagina++;
                }
              } catch (error) {
                console.error(
                  `Erro ao buscar produtos da conta ${conta.blingAccountId}:`,
                  error.message
                );
                temMais = false;
              }
            }

            // Contar produtos dessa conta no EstoqueUni
            const produtosContaEstoqueUni = produtosPorContaEstoqueUni[conta.blingAccountId]
              ? produtosPorContaEstoqueUni[conta.blingAccountId].size
              : 0;

            // Produtos no Bling que não estão no EstoqueUni
            const produtosFaltando = Array.from(skusBling).filter(
              sku => !produtosPorContaEstoqueUni[conta.blingAccountId]?.has(sku)
            );

            return {
              blingAccountId: conta.blingAccountId,
              accountName: conta.accountName || conta.store_name || 'Conta Bling',
              isActive: conta.is_active,
              is_active: conta.is_active,
              totalProdutosBling: totalProdutosBling,
              totalProdutosEstoqueUni: produtosContaEstoqueUni,
              produtosFaltando: produtosFaltando.length,
              status: 'sucesso'
            };
          } catch (error) {
            console.error(
              `Erro ao verificar conta ${conta.blingAccountId}:`,
              error.message
            );
            return {
              blingAccountId: conta.blingAccountId,
              accountName: conta.accountName || conta.store_name || 'Conta Bling',
              isActive: conta.is_active,
              is_active: conta.is_active,
              totalProdutosBling: 0,
              totalProdutosEstoqueUni: 0,
              produtosFaltando: 0,
              status: 'erro',
              erro: error.message
            };
          }
        })
      );

      // Calcular totais
      const totalProdutosBling = verificacaoContas.reduce(
        (sum, conta) => sum + conta.totalProdutosBling,
        0
      );
      const totalProdutosEstoqueUniContas = verificacaoContas.reduce(
        (sum, conta) => sum + conta.totalProdutosEstoqueUni,
        0
      );

      return res.json({
        success: true,
        data: {
          contas: verificacaoContas,
          totalEstoqueUni: totalEstoqueUni,
          resumo: {
            totalContas: contasBling.length,
            totalProdutosBling: totalProdutosBling,
            totalProdutosEstoqueUni: totalEstoqueUni,
            totalProdutosEstoqueUniPorConta: totalProdutosEstoqueUniContas
          }
        }
      });
    } catch (error) {
      console.error('Erro ao verificar produtos:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao verificar produtos'
      });
    }
  }

  /**
   * Importa produtos do Bling para o EstoqueUni
   * POST /api/produtos/importar
   * Body: { tenantId, blingAccountId, limite? }
   */
  async importarProdutos(req, res) {
    try {
      const { tenantId, blingAccountId, limite: limiteRaw } = req.body;

      if (!tenantId || !blingAccountId) {
        return res.status(400).json({
          success: false,
          error: 'tenantId e blingAccountId são obrigatórios'
        });
      }

      // Converter limite para número se fornecido
      let limite = null;
      if (limiteRaw !== undefined && limiteRaw !== null && limiteRaw !== '') {
        limite = parseInt(limiteRaw);
        if (isNaN(limite) || limite <= 0) {
          return res.status(400).json({
            success: false,
            error: 'Limite deve ser um número positivo'
          });
        }
      }

      console.log(`[IMPORTAR-PRODUTOS] Iniciando importação - Tenant: ${tenantId}, Conta: ${blingAccountId}, Limite: ${limite || 'todos'}`);

      // Buscar produtos existentes no EstoqueUni para esta conta
      const produtosExistentes = await Produto.find({ tenantId }).lean();
      const skusExistentes = new Set(
        produtosExistentes.map(p => {
          // Normalizar SKU
          if (!p.sku) return null;
          return p.sku.toString().trim().toUpperCase().replace(/^0+/, '');
        }).filter(Boolean)
      );

      console.log(`[IMPORTAR-PRODUTOS] Tenant: ${tenantId}, Conta: ${blingAccountId}, SKUs existentes: ${skusExistentes.size}`);

      // Buscar produtos do Bling
      let totalImportados = 0;
      let pagina = 1;
      const limitePagina = 100;
      let temMais = true;
      const produtosParaImportar = [];

      while (temMais) {
        // Verificar se já atingiu o limite de produtos para importar
        if (limite && produtosParaImportar.length >= limite) {
          temMais = false;
          break;
        }

        try {
          const produtos = await blingService.getProdutos(
            { limit: limitePagina, page: pagina },
            tenantId,
            blingAccountId
          );

          if (!produtos || produtos.length === 0) {
            temMais = false;
            break;
          }

          // Filtrar produtos que ainda não existem no EstoqueUni
          for (const produto of produtos) {
            // Verificar se já atingiu o limite
            if (limite && produtosParaImportar.length >= limite) {
              temMais = false;
              break;
            }

            if (!produto.codigo) continue;

            // Normalizar SKU
            const skuNormalizado = produto.codigo
              .toString()
              .trim()
              .toUpperCase()
              .replace(/^0+/, '');

            // Verificar se já existe
            if (!skusExistentes.has(skuNormalizado)) {
              // Buscar estoque do produto (pode estar na resposta ou precisar buscar)
              let estoque = 0;
              if (produto.estoque?.saldoVirtualTotal !== undefined) {
                estoque = produto.estoque.saldoVirtualTotal;
              } else if (produto.estoque?.saldoFisicoTotal !== undefined) {
                estoque = produto.estoque.saldoFisicoTotal;
              } else if (typeof produto.estoque === 'number') {
                estoque = produto.estoque;
              } else {
                // Se não tiver estoque na resposta, buscar individualmente
                try {
                  estoque = await blingService.getEstoqueProduto(
                    skuNormalizado,
                    tenantId,
                    blingAccountId
                  );
                } catch (error) {
                  console.warn(`Não foi possível buscar estoque do produto ${skuNormalizado}:`, error.message);
                  estoque = 0;
                }
              }

              produtosParaImportar.push({
                sku: skuNormalizado,
                nome: produto.nome || '',
                estoque: estoque,
                // descricao: produto.descricao || '', // Não importar descrição por enquanto
                blingAccountId: blingAccountId
              });
              skusExistentes.add(skuNormalizado); // Adicionar para evitar duplicatas na mesma importação
            }
          }

          // Se retornou menos que o limite, não há mais páginas
          if (produtos.length < limitePagina) {
            temMais = false;
          } else {
            pagina++;
          }
        } catch (error) {
          console.error(`Erro ao buscar produtos da conta ${blingAccountId}:`, error.message);
          temMais = false;
        }
      }

      console.log(`[IMPORTAR-PRODUTOS] Produtos para importar: ${produtosParaImportar.length}`);

      // Importar produtos em lotes
      const lote = 10;
      const operacoes = [];

      for (let i = 0; i < produtosParaImportar.length; i += lote) {
        const loteProdutos = produtosParaImportar.slice(i, i + lote);

        loteProdutos.forEach(produto => {
          const estoque = produto.estoque || 0;
          operacoes.push({
            updateOne: {
              filter: { tenantId, sku: produto.sku },
              update: {
                $set: {
                  tenantId,
                  sku: produto.sku,
                  nome: produto.nome,
                  estoquePorConta: {
                    [blingAccountId]: estoque
                  },
                  estoque: estoque, // Estoque total (será recalculado pelo middleware se necessário)
                  contasBling: [blingAccountId],
                  ultimaSincronizacao: getBrazilNow(),
                  updatedAt: getBrazilNow()
                },
                $setOnInsert: {
                  createdAt: getBrazilNow()
                }
              },
              upsert: true
            }
          });
        });

        // Executar lote
        if (operacoes.length >= lote) {
          await Produto.bulkWrite(operacoes);
          totalImportados += operacoes.length;
          operacoes.length = 0; // Limpar array
        }
      }

      // Executar operações restantes
      if (operacoes.length > 0) {
        await Produto.bulkWrite(operacoes);
        totalImportados += operacoes.length;
      }

      console.log(`[IMPORTAR-PRODUTOS] ✅ Importação concluída: ${totalImportados} produtos importados`);

      return res.json({
        success: true,
        data: {
          totalImportados,
          blingAccountId
        },
        message: `${totalImportados} produto(s) importado(s) com sucesso`
      });
    } catch (error) {
      console.error('Erro ao importar produtos:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Erro ao importar produtos'
      });
    }
  }
}

export default ProdutoController;






