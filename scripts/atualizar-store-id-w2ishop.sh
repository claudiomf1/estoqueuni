#!/bin/bash

# Script para atualizar store_id da conta W2ISHOP
# O companyId que vem nos webhooks é: 7a4bfb8e1e1118c4093d460cd9004098

echo "🔧 Atualizando store_id da conta W2ISHOP..."

ssh Linode_dallas << 'ENDSSH'
cd /home/claudio/semtypescript/apps/estoqueuni

# Usar node dentro do container para atualizar
docker compose -f docker-compose.base.yml -f docker-compose.prod.yml exec -T estoqueuni-backend node << 'NODE_SCRIPT'
import('mongoose').then(async (mongoose) => {
  const uri = process.env.MONGODB_URI_REMOTE || process.env.MONGODB_URI;
  await mongoose.default.connect(uri);
  
  const BlingConfig = mongoose.default.model('BlingConfig', new mongoose.default.Schema({}, { 
    collection: 'estoqueuni_blingConfigs', 
    strict: false 
  }));
  
  const conta = await BlingConfig.findOne({ 
    accountName: 'W2ISHOP', 
    tenantId: '692cc9f4ed4da38f4fe505ca' 
  });
  
  if (!conta) {
    console.error('❌ Conta W2ISHOP não encontrada');
    process.exit(1);
  }
  
  console.log('📋 Antes:', {
    blingAccountId: conta.blingAccountId,
    store_id: conta.store_id
  });
  
  const novoStoreId = '7a4bfb8e1e1118c4093d460cd9004098';
  
  if (conta.store_id === novoStoreId) {
    console.log('✅ store_id já está correto');
    process.exit(0);
  }
  
  await BlingConfig.updateOne(
    { _id: conta._id },
    { $set: { store_id: novoStoreId } }
  );
  
  const atualizada = await BlingConfig.findOne({ _id: conta._id });
  console.log('✅ store_id atualizado!');
  console.log('📋 Depois:', {
    blingAccountId: atualizada.blingAccountId,
    store_id: atualizada.store_id
  });
  
  await mongoose.default.disconnect();
}).catch(e => {
  console.error('❌ Erro:', e.message);
  process.exit(1);
});
NODE_SCRIPT

ENDSSH

echo "✅ Concluído!"




