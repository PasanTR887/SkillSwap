const mongoose = require("mongoose");

const RequestSchema = new mongoose.Schema(
  {
    skillId: { type: mongoose.Schema.Types.ObjectId, ref: "Skill", required: true },
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, default: "" },
    status: { type: String, enum: ["pending", "accepted", "rejected", "completed"], default: "pending" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", RequestSchema);
