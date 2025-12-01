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
    bannerUrl: {
      type: String,
      default: null,
    },
    bannerGcsPath: {
      type: String,
      default: null,
    },
  },
  {
    strict: false,
    timestamps: true,
  }
);

const LandingPageConfig =
  mongoose.models.estoqueuni_landingPageConfigs ||
  mongoose.model('estoqueuni_landingPageConfigs', landingPageConfigSchema, 'estoqueuni_landingPageConfigs');

export default LandingPageConfig;
