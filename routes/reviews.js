const router = require("express").Router();
const Review = require("../models/Review");
const Request = require("../models/Request");

router.post("/", async (req, res) => {
  try {
    const { requestId, reviewerId, rating, comment = "" } = req.body || {};
    if (!requestId || !reviewerId || !rating) return res.status(400).json({ error: "requestId, reviewerId, rating required" });

    const reqDoc = await Request.findById(requestId);
    if (!reqDoc) return res.status(404).json({ error: "Request not found" });

    if (String(reqDoc.requesterId) !== String(reviewerId)) {
      return res.status(403).json({ error: "Only requester can review." });
    }
    if (reqDoc.status !== "completed") {
      return res.status(400).json({ error: "Request must be completed to review." });
    }

    const existing = await Review.findOne({ requestId });
    if (existing) return res.status(400).json({ error: "Review already exists." });

    const doc = await Review.create({
      requestId,
      skillId: reqDoc.skillId,
      reviewerId,
      rating: Number(rating),
      comment: comment.trim()
    });

    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
