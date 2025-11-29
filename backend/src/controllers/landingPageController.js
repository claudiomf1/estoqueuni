import multer from 'multer';
import sharp from 'sharp';
import LandingPageConfig from '../models/LandingPageConfig.js';
import storageService from '../services/storageService.js';

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_RESIZE_WIDTH = 1600;
const MIN_RESIZE_WIDTH = 600;
const INITIAL_QUALITY = 85;
const MIN_QUALITY = 45;

// Configuração do multer (armazenamento em memória)
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limite inicial
  },
});

/**
 * Retorna o documento de configuração, criando de forma atômica se necessário
 */
async function findOrCreateConfig(tenantId) {
  return LandingPageConfig.findOneAndUpdate(
    { tenantId },
    { $setOnInsert: { tenantId } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

function createWebpName(originalName) {
  const base = originalName?.replace(/\.[^.]+$/, '') || `logo-${Date.now()}`;
  return `${base}.webp`;
}

async function optimizeRasterImage(buffer, options = {}) {
  const {
    maxBytes = MAX_LOGO_SIZE_BYTES,
    originalName = 'logo.webp',
    qualityStart = INITIAL_QUALITY,
    minQuality = MIN_QUALITY
  } = options;

  const baseMetadata = await sharp(buffer).metadata();
  const needsResize = baseMetadata?.width && baseMetadata.width > MAX_RESIZE_WIDTH;

  const encode = async (quality, width) => {
    let pipeline = sharp(buffer).rotate();
    if (width) {
      pipeline = pipeline.resize({ width, withoutEnlargement: true });
    }
    return pipeline.webp({ quality, effort: 5 }).toBuffer();
  };

  let quality = qualityStart;
  let currentWidth = needsResize ? MAX_RESIZE_WIDTH : undefined;
  let output = await encode(quality, currentWidth);

  while (output.length > maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, quality - 10);
    output = await encode(quality, currentWidth);
  }

  while (output.length > maxBytes && currentWidth && currentWidth > MIN_RESIZE_WIDTH) {
    currentWidth = Math.max(MIN_RESIZE_WIDTH, currentWidth - 200);
    output = await encode(quality, currentWidth);
  }

  if (output.length > maxBytes) {
    throw Object.assign(new Error('Não foi possível otimizar o logo abaixo do limite configurado'), {
      code: 'LOGO_TOO_LARGE_AFTER_OPTIMIZE'
    });
  }

  return {
    buffer: output,
    contentType: 'image/webp',
    originalName: createWebpName(originalName)
  };
}

async function optimizeLogoFile(file) {
  const { buffer, mimetype, originalname, size } = file;

  if (size <= MAX_LOGO_SIZE_BYTES) {
    return {
      buffer,
      contentType: mimetype,
      originalName: originalname
    };
  }

  if (mimetype === 'image/svg+xml') {
    const minified = Buffer.from(buffer.toString('utf8').replace(/\s+/g, ' ').trim());
    if (minified.length <= MAX_LOGO_SIZE_BYTES) {
      return {
        buffer: minified,
        contentType: mimetype,
        originalName: originalname
      };
    }

    // Se SVG ainda estiver grande, rasteriza para webp otimizado
    return optimizeRasterImage(buffer, { originalName: originalname });
  }

  // Para imagens raster, otimizar
  return optimizeRasterImage(buffer, { originalName: originalname });
}

/**
 * Obtém a configuração da landing page
 * GET /api/painelpresidente/landing-config
 */
export async function getLandingConfig(req, res) {
  try {
    // Sempre usa 'estoqueuni' como tenantId para o logo da landing page
    const tenantId = 'estoqueuni';

    const config = await LandingPageConfig.findOne({ tenantId }).lean();

    if (!config) {
      return res.json({
        success: true,
        data: {
          logoUrl: null,
          logoGcsPath: null,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        logoUrl: config.logoUrl || null,
        logoGcsPath: config.logoGcsPath || null,
      },
    });
  } catch (error) {
    console.error('[landingPageController] Erro ao obter configuração:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro ao obter configuração da landing page',
    });
  }
}

/**
 * Faz upload do logo da landing page
 * POST /api/painelpresidente/landing-config/logo
 */
export async function uploadLogo(req, res) {
  try {
    // Sempre usa 'estoqueuni' como tenantId para o logo da landing page
    // A landing page é pública e não depende de tenantId específico
    const tenantId = 'estoqueuni';

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado',
      });
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de arquivo inválido. Permitidos: JPEG, PNG, WebP, SVG',
      });
    }

    let processedFile;
    try {
      processedFile = await optimizeLogoFile(req.file);
      console.log(
        `[landingPageController] Upload recebido: original=${req.file.size} bytes, otimizado=${processedFile.buffer.length} bytes`
      );
    } catch (optimizationError) {
      console.error('[landingPageController] Falha ao otimizar logo:', optimizationError);
      return res.status(400).json({
        success: false,
        message:
          optimizationError.code === 'LOGO_TOO_LARGE_AFTER_OPTIMIZE'
            ? 'Não foi possível reduzir o logo automaticamente para menos de 5MB. Tente uma imagem menor.'
            : 'Falha ao otimizar o logo enviado',
        error: optimizationError.message,
      });
    }

    // Buscar ou criar a configuração
    const config = await findOrCreateConfig(tenantId);

    // Se já existe um logo, deletar o antigo do GCS
    if (config.logoGcsPath) {
      try {
        await storageService.deleteFileFromGcs(config.logoGcsPath);
      } catch (deleteError) {
        console.warn('[landingPageController] Erro ao deletar logo antigo (continuando):', deleteError);
        // Continua mesmo se não conseguir deletar o logo antigo
      }
    }

    // Upload para o Google Cloud Storage
    let publicUrl, gcsPath;
    try {
      const uploadResult = await storageService.uploadBufferToGcs({
        buffer: processedFile.buffer,
        originalName: processedFile.originalName,
        destinationPrefix: `estoqueuni/logos/${tenantId}`,
        contentType: processedFile.contentType,
      });
      publicUrl = uploadResult.publicUrl;
      gcsPath = uploadResult.gcsPath;
    } catch (uploadError) {
      console.error('[landingPageController] Erro ao fazer upload para GCS:', uploadError);
      
      // Mensagens de erro mais específicas
      let errorMessage = 'Erro ao fazer upload do logo';
      if (uploadError.message?.includes('GCS_BUCKET_NAME')) {
        errorMessage = 'Configuração do Google Cloud Storage não encontrada. Entre em contato com o administrador.';
      } else if (uploadError.message?.includes('Acesso negado') || uploadError.message?.includes('403')) {
        errorMessage = 'Acesso negado ao armazenamento. Verifique as credenciais.';
      } else if (uploadError.message?.includes('não existe') || uploadError.message?.includes('404')) {
        errorMessage = 'Bucket de armazenamento não encontrado. Verifique a configuração.';
      } else {
        errorMessage = uploadError.message || 'Erro ao fazer upload do logo para o armazenamento.';
      }
      
      return res.status(500).json({
        success: false,
        message: errorMessage,
        error: uploadError.message,
      });
    }

    // Atualizar configuração
    try {
      config.logoUrl = publicUrl;
      config.logoGcsPath = gcsPath;
      await config.save();
      console.log('[landingPageController] Configuração salva com sucesso:', {
        tenantId: config.tenantId,
        logoUrl: config.logoUrl,
        logoGcsPath: config.logoGcsPath
      });
    } catch (saveError) {
      console.error('[landingPageController] Erro ao salvar configuração:', saveError);
      // Tenta deletar o arquivo que foi enviado se não conseguir salvar
      try {
        await storageService.deleteFileFromGcs(gcsPath);
      } catch (cleanupError) {
        console.error('[landingPageController] Erro ao limpar arquivo após falha ao salvar:', cleanupError);
      }
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao salvar configuração do logo',
        error: saveError.message,
      });
    }

    return res.json({
      success: true,
      message: 'Logo enviado com sucesso!',
      data: {
        logoUrl: publicUrl,
        logoGcsPath: gcsPath,
      },
    });
  } catch (error) {
    console.error('[landingPageController] Erro ao fazer upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao fazer upload do logo',
      error: error.message,
    });
  }
}

/**
 * Deleta o logo da landing page
 * DELETE /api/painelpresidente/landing-config/logo
 */
export async function deleteLogo(req, res) {
  try {
    // Sempre usa 'estoqueuni' como tenantId para o logo da landing page
    const tenantId = 'estoqueuni';

    const config = await LandingPageConfig.findOne({ tenantId });

    if (!config || !config.logoGcsPath) {
      return res.json({
        success: true,
        message: 'Logo não encontrado',
      });
    }

    // Deletar do GCS
    await storageService.deleteFileFromGcs(config.logoGcsPath);

    // Remover da configuração
    config.logoUrl = null;
    config.logoGcsPath = null;
    await config.save();

    return res.json({
      success: true,
      message: 'Logo deletado com sucesso!',
    });
  } catch (error) {
    console.error('[landingPageController] Erro ao deletar logo:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao deletar logo',
      error: error.message,
    });
  }
}

