import mongoose from "mongoose";

const landingPageConfigSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  heroImageUrl: {
    type: String,
    default: null,
  },
  heroImageGcsPath: {
    type: String,
    default: null,
  },
  logoUrl: {
    type: String,
    default: null,
  },
  logoGcsPath: {
    type: String,
    default: null,
  },
  faviconUrl: {
    type: String,
    default: null,
  },
  faviconGcsPath: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

landingPageConfigSchema.pre("save", function preSave(next) {
  this.updatedAt = new Date();
  next();
});

const LandingPageConfig = mongoose.model("LandingPageConfig", landingPageConfigSchema);

export default LandingPageConfig;

