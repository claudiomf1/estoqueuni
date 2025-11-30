import mongoose from "mongoose";

const BlingTokenSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    provider: {
      type: String,
      enum: ["bling"],
      default: "bling",
    },
    accessTokenEnc: {
      type: String,
      required: true,
    },
    refreshTokenEnc: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    scopes: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "pfm_integrations_bling_tokens",
  }
);

BlingTokenSchema.methods.isExpired = function () {
  if (!this.expiresAt) return true;
  return this.expiresAt.getTime() <= Date.now();
};

export default mongoose.model("BlingToken", BlingTokenSchema);


