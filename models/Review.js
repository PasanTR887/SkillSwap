const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, unique: true },
    skillId: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Review", ReviewSchema);
