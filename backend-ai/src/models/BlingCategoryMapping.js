import mongoose from "mongoose";

const BlingCategoryMappingSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    storeId: {
      type: String,
      required: true,
      index: true,
    },
    blingCategoryId: {
      type: Number,
      required: true,
      index: true,
    },
    shopeeCategoryId: {
      type: String,
      required: true,
    },
    descricao: {
      type: String,
      default: null,
    },
    syncedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "pfm_integrations_bling_category_mappings",
  }
);

BlingCategoryMappingSchema.index(
  { tenantId: 1, storeId: 1, blingCategoryId: 1, shopeeCategoryId: 1 },
  { unique: true }
);

export default mongoose.model(
  "BlingCategoryMapping",
  BlingCategoryMappingSchema
);


