import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    metrics: {
      totalQuestions: { type: Number, default: 0 },
      precofacilmarketQuestions: { type: Number, default: 0 },
      generalQuestions: { type: Number, default: 0 },
      avgConfidence: { type: Number, default: 0 },
      avgResponseTime: { type: Number, default: 0 },
      thumbsUp: { type: Number, default: 0 },
      thumbsDown: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0 },
    },
    topQuestions: [
      {
        question: String,
        count: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

analyticsSchema.index({ date: 1, tenantId: 1 }, { unique: true });

export default mongoose.model("Analytics", analyticsSchema);




















