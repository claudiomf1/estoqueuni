import { Storage } from '@google-cloud/storage';
import path from 'path';
import fs from 'fs';

let storageClient;
const rawUniformValue = (process.env.GCS_UNIFORM_BUCKET_ACCESS || '').toString();
const useUniformBucketAccess = rawUniformValue.trim().toLowerCase() === 'true';

if (!globalThis.__estoqueuniStorageUblaLogged) {
  console.log(
    `[estoqueuni-storage] Uniform bucket access flag: raw="${rawUniformValue}" => parsed=${useUniformBucketAccess}`
  );
  globalThis.__estoqueuniStorageUblaLogged = true;
}

/**
 * Inicializa o cliente do Google Cloud Storage
 */
function getStorageClient() {
  if (storageClient) return storageClient;

  const keyFilename = process.env.GCS_KEYFILE_PATH;
  const projectId = process.env.GCS_PROJECT_ID;

  const options = {};
  if (keyFilename) {
    // Verificar se o arquivo existe
    if (!fs.existsSync(keyFilename)) {
      throw new Error(`Arquivo de credenciais não encontrado: ${keyFilename}`);
    }
    options.keyFilename = keyFilename;
    
    // Tentar ler o email da conta de serviço para ajudar no diagnóstico
    try {
      const creds = JSON.parse(fs.readFileSync(keyFilename, 'utf8'));
      if (creds.client_email) {
        console.log('[estoqueuni-storage] Usando conta de serviço:', creds.client_email);
      }
    } catch (e) {
      console.warn('[estoqueuni-storage] Não foi possível ler email da conta de serviço:', e.message);
    }
  } else {
    console.log('[estoqueuni-storage] Usando Application Default Credentials (ADC)');
  }
  
  if (projectId) {
    options.projectId = projectId;
  }

  try {
    storageClient = new Storage(options);
    console.log('[estoqueuni-storage] Cliente do Google Cloud Storage inicializado com sucesso');
    return storageClient;
  } catch (error) {
    console.error('[estoqueuni-storage] Erro ao inicializar cliente do Google Cloud Storage:', error);
    throw new Error(`Erro ao inicializar Google Cloud Storage: ${error.message || error}`);
  }
}

/**
 * Faz upload de um buffer para o Google Cloud Storage
 * @param {Buffer} buffer - Buffer do arquivo
 * @param {string} originalName - Nome original do arquivo
 * @param {string} destinationPrefix - Prefixo do diretório de destino
 * @param {string} contentType - Tipo MIME do arquivo
 * @returns {Promise<{publicUrl: string, gcsPath: string}>} URL pública e caminho no GCS
 */
async function uploadBufferToGcs({
  buffer,
  originalName,
  destinationPrefix = 'estoqueuni',
  contentType
}) {
  if (!buffer || !buffer.length) {
    throw new Error('Buffer de upload inválido.');
  }

  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    console.error('[estoqueuni-storage] Variáveis de ambiente disponíveis:', {
      GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
      GCS_KEYFILE_PATH: process.env.GCS_KEYFILE_PATH ? 'definido' : 'não definido',
      GCS_PROJECT_ID: process.env.GCS_PROJECT_ID,
      GCS_UNIFORM_BUCKET_ACCESS: process.env.GCS_UNIFORM_BUCKET_ACCESS
    });
    throw new Error('A variável GCS_BUCKET_NAME não está configurada.');
  }

  console.log('[estoqueuni-storage] Configuração:', {
    bucketName,
    destinationPrefix,
    contentType,
    keyFile: process.env.GCS_KEYFILE_PATH ? 'definido' : 'não definido',
    projectId: process.env.GCS_PROJECT_ID || 'não definido'
  });

  const storage = getStorageClient();
  const safeName = originalName?.replace(/[^a-zA-Z0-9.\-_]/g, '_') || 'upload.bin';
  const timestamp = Date.now();
  const destination = path.posix.join(
    destinationPrefix,
    `${timestamp}-${safeName}`
  );

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destination);
    
    // Não verificamos bucket.exists() porque requer permissão storage.buckets.get
    // A conta de serviço pode ter apenas permissões de objetos (Storage Object Administrator)
    // Se o bucket não existir ou não tiver acesso, o erro será claro no momento do upload

    try {
      await file.save(buffer, {
        gzip: true,
        metadata: {
          contentType,
          cacheControl: 'public, max-age=31536000'
        },
        resumable: false
      });
    } catch (saveError) {
      console.error('[estoqueuni-storage] Erro ao salvar arquivo:', saveError);
      if (saveError.code === 403) {
        throw new Error('Acesso negado ao salvar arquivo. A conta de serviço precisa da permissão "Storage Object Creator" no bucket.');
      }
      throw saveError;
    }

    // Tornar o arquivo público (pula se bucket usa Uniform Bucket-Level Access)
    if (!useUniformBucketAccess) {
      try {
        await file.makePublic();
      } catch (err) {
        console.warn(
          '[estoqueuni-storage] Não foi possível tornar o arquivo público automaticamente:',
          err?.message || err
        );
        // Não falha o upload se não conseguir tornar público
      }
    } else if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[estoqueuni-storage] makePublic pulado (GCS_UNIFORM_BUCKET_ACCESS habilitado). Certifique-se de que o bucket possua permissões públicas no nível do bucket.'
      );
    }

    // Retornar URL pública
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;
    
    console.log(`[estoqueuni-storage] Arquivo enviado com sucesso: ${publicUrl}`);
    
    return {
      publicUrl,
      gcsPath: destination
    };
  } catch (error) {
    console.error('[estoqueuni-storage] Erro ao fazer upload:', error);
    
    // Melhorar mensagens de erro
    if (error.code === 403) {
      throw new Error('Acesso negado ao bucket. Verifique se a conta de serviço tem as permissões necessárias (Storage Object Creator, Storage Object Viewer) no Google Cloud Console.');
    } else if (error.code === 404) {
      throw new Error(`Bucket "${bucketName}" não encontrado. Verifique se o nome do bucket está correto.`);
    } else if (error.message && error.message.includes('Acesso negado')) {
      throw error; // Já tem mensagem melhorada
    } else if (error.message) {
      throw error;
    } else {
      throw new Error(`Erro ao fazer upload: ${error.toString()}`);
    }
  }
}

/**
 * Deleta um arquivo do Google Cloud Storage
 * @param {string} gcsPath - Caminho do arquivo no GCS
 */
async function deleteFileFromGcs(gcsPath) {
  if (!gcsPath) {
    return;
  }

  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('A variável GCS_BUCKET_NAME não está configurada.');
  }

  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(gcsPath);

  try {
    await file.delete();
    console.log(`[estoqueuni-storage] Arquivo deletado com sucesso: ${gcsPath}`);
  } catch (err) {
    if (err.code === 404) {
      console.warn(`[estoqueuni-storage] Arquivo não encontrado para deletar: ${gcsPath}`);
    } else {
      console.warn(`[estoqueuni-storage] Erro ao deletar arquivo: ${err?.message || err}`);
      // Não lança erro para não quebrar o fluxo se o arquivo não existir ou já foi deletado
    }
  }
}

export default {
  getStorageClient,
  uploadBufferToGcs,
  deleteFileFromGcs
};

