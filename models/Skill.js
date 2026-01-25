const mongoose = require("mongoose");

const SkillSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    priceType: { type: String, enum: ["Free", "Paid"], default: "Free" },
    price: { type: Number, default: 0 },
    description: { type: String, default: "" },
    availability: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Skill", SkillSchema);
