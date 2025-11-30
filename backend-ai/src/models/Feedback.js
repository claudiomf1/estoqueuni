import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    type: {
      type: String,
      enum: ["thumbs_up", "thumbs_down", "rating", "detailed"],
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comment: String,
    helpful: Boolean,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Feedback", feedbackSchema);




















