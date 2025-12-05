/**
 * Script para atualizar o store_id da conta W2ISHOP
 * 
 * O problema: Os webhooks do Bling enviam companyId que precisa corresponder
 * ao store_id na collection estoqueuni_blingConfigs para identificar a conta.
 * 
 * Execute: node scripts/atualizar-store-id-w2ishop.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Importar modelo
const BlingConfigSchema = new mongoose.Schema({
  blingAccountId: String,
  tenantId: String,
  accountName: String,
  store_id: String,
  store_name: String,
  access_token: String,
  refresh_token: String,
  is_active: Boolean,
}, { collection: 'estoqueuni_blingConfigs' });

const BlingConfig = mongoose.model('BlingConfig', BlingConfigSchema);

async function atualizarStoreId() {
  try {
    // Conectar MongoDB
    const mongoUri = process.env.MONGODB_URI_REMOTE || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Conectado ao MongoDB');

    // Buscar conta W2ISHOP
    const conta = await BlingConfig.findOne({
      accountName: 'W2ISHOP',
      tenantId: '692cc9f4ed4da38f4fe505ca'
    });

    if (!conta) {
      console.error('❌ Conta W2ISHOP não encontrada');
      process.exit(1);
    }

    console.log('📋 Conta encontrada:', {
      blingAccountId: conta.blingAccountId,
      accountName: conta.accountName,
      store_id: conta.store_id,
      store_name: conta.store_name,
    });

    // O companyId que vem nos webhooks é: 7a4bfb8e1e1118c4093d460cd9004098
    // Este deve ser o store_id correto
    const novoStoreId = '7a4bfb8e1e1118c4093d460cd9004098';

    if (conta.store_id === novoStoreId) {
      console.log('✅ store_id já está correto');
      process.exit(0);
    }

    // Atualizar store_id
    await BlingConfig.updateOne(
      { _id: conta._id },
      { $set: { store_id: novoStoreId } }
    );

    console.log('✅ store_id atualizado com sucesso!');
    console.log('📋 Novo valor:', novoStoreId);

    // Verificar atualização
    const contaAtualizada = await BlingConfig.findOne({ _id: conta._id });
    console.log('📋 Conta após atualização:', {
      blingAccountId: contaAtualizada.blingAccountId,
      accountName: contaAtualizada.accountName,
      store_id: contaAtualizada.store_id,
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Desconectado do MongoDB');
  }
}

atualizarStoreId();

