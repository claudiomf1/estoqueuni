import mongoose from "mongoose";

const featureCardSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    cards: [
      {
        title: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        imageUrl: {
          type: String,
          default: "",
        },
        icon: {
          type: String,
          default: "📦",
        },
        order: {
          type: Number,
          default: 0,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: "feature_cards",
  }
);

featureCardSchema.index({ tenantId: 1, isActive: 1 });

const FeatureCards = mongoose.model("FeatureCards", featureCardSchema);

export default FeatureCards;

