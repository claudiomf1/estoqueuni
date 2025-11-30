import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Nova Conversa",
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
    metadata: {
      totalMessages: { type: Number, default: 0 },
      lastMessageAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Conversation", conversationSchema);




















