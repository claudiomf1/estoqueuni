import mongoose from 'mongoose';

/**
 * Model de configuração da Landing Page do EstoqueUni
 * Collection: estoqueuni_landingPageConfigs
 */
const landingPageConfigSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: null,
    },
    logoGcsPath: {
      type: String,
      default: null,
    },
  },
  {
    strict: false,
    timestamps: true,
  }
);

// Índice único para tenantId
landingPageConfigSchema.index({ tenantId: 1 }, { unique: true });

const LandingPageConfig =
  mongoose.models.estoqueuni_landingPageConfigs ||
  mongoose.model('estoqueuni_landingPageConfigs', landingPageConfigSchema, 'estoqueuni_landingPageConfigs');

export default LandingPageConfig;

