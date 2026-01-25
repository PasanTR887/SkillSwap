const router = require("express").Router();
const Skill = require("../models/Skill");
const Review = require("../models/Review");
const mongoose = require("mongoose");

router.get("/", async (req, res) => {
  try {
    const { search = "", category = "" } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const skills = await Skill.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "name email");

    // attach rating summary
    const skillIds = skills.map(s => s._id);
    const ratings = await Review.aggregate([
      { $match: { skillId: { $in: skillIds } } },
      { $group: { _id: "$skillId", avg: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);

    const ratingMap = new Map(ratings.map(r => [String(r._id), { avg: r.avg, count: r.count }]));

    const out = skills.map(s => {
      const r = ratingMap.get(String(s._id)) || { avg: 0, count: 0 };
      return {
        ...s.toObject(),
        ratingAvg: Math.round(r.avg * 10) / 10,
        ratingCount: r.count
      };
    });

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/mine", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const skills = await Skill.find({ userId }).sort({ createdAt: -1 });
    res.json(skills);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { userId, title, category, priceType, price, description, availability } = req.body || {};
    if (!userId || !title || !category) return res.status(400).json({ error: "userId, title, category required" });

    const doc = await Skill.create({
      userId,
      title: title.trim(),
      category: category.trim(),
      priceType: priceType === "Paid" ? "Paid" : "Free",
      price: priceType === "Paid" ? Number(price || 0) : 0,
      description: (description || "").trim(),
      availability: (availability || "").trim()
    });

    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { userId } = req.query;
    const { id } = req.params;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const skill = await Skill.findById(id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    if (String(skill.userId) !== String(userId)) return res.status(403).json({ error: "Not allowed" });

    await Skill.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
