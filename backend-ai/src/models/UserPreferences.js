import mongoose from "mongoose";

const userPreferencesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "auto",
      },
      language: {
        type: String,
        default: "pt-BR",
      },
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
    },
    usage: {
      totalQuestions: { type: Number, default: 0 },
      questionsToday: { type: Number, default: 0 },
      lastQuestionAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("UserPreferences", userPreferencesSchema);




















