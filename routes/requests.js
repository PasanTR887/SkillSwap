const router = require("express").Router();
const Request = require("../models/Request");
const Skill = require("../models/Skill");
const Review = require("../models/Review");

router.post("/", async (req, res) => {
  try {
    const { skillId, requesterId, message = "" } = req.body || {};
    if (!skillId || !requesterId) return res.status(400).json({ error: "skillId and requesterId required" });

    const skill = await Skill.findById(skillId);
    if (!skill) return res.status(404).json({ error: "Skill not found" });

    if (String(skill.userId) === String(requesterId)) {
      return res.status(400).json({ error: "You cannot request your own skill." });
    }

    const doc = await Request.create({
      skillId,
      requesterId,
      ownerId: skill.userId,
      message: message.trim(),
      status: "pending"
    });

    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/incoming", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const list = await Request.find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .populate("requesterId", "name email")
      .populate({
        path: "skillId",
        populate: { path: "userId", select: "name email" }
      });

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/outgoing", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const list = await Request.find({ requesterId: userId })
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("skillId");

    // attach: reviewed?
    const reqIds = list.map(r => r._id);
    const reviews = await Review.find({ requestId: { $in: reqIds } }, "requestId");
    const reviewedSet = new Set(reviews.map(r => String(r.requestId)));

    const out = list.map(r => ({ ...r.toObject(), isReviewed: reviewedSet.has(String(r._id)) }));
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/:id/status", async (req, res) => {
  try {
    const { userId, status } = req.body || {};
    const { id } = req.params;
    if (!userId || !status) return res.status(400).json({ error: "userId and status required" });

    const reqDoc = await Request.findById(id);
    if (!reqDoc) return res.status(404).json({ error: "Request not found" });

    const isOwner = String(reqDoc.ownerId) === String(userId);
    if (!isOwner) return res.status(403).json({ error: "Only skill owner can change status." });

    const allowed = new Set(["pending", "accepted", "rejected", "completed"]);
    if (!allowed.has(status)) return res.status(400).json({ error: "Invalid status" });

    // simple state rules
    if (reqDoc.status === "rejected" || reqDoc.status === "completed") {
      return res.status(400).json({ error: "Cannot change status from rejected/completed." });
    }
    if (reqDoc.status === "pending" && status === "completed") {
      return res.status(400).json({ error: "Accept before completing." });
    }

    reqDoc.status = status;
    await reqDoc.save();

    res.json(reqDoc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
