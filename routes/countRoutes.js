import express from "express";
import { Company } from "../models/companyModel.js"; // Use curly braces for named exports

const router = express.Router();

// Route to get total count of filtered records
router.get("/count", async (req, res) => {
  try {
    const { category, subCategory, country, state } = req.query;

    // Build the filter object
    const filter = {};
    if (category) filter.categories = category; // Match field name in the database
    if (subCategory) filter.categories = subCategory; // Match field name in the database
    if (country) filter.state = country; // Adjust based on actual field mapping
    if (state) filter.state = state; // Adjust based on actual field mapping

    // Count the total number of matching records
    const totalCount = await Company.countDocuments(filter);

    res.json({ totalCount });
  } catch (error) {
    console.error("Error fetching count:", error.message);
    res.status(500).json({ error: "An error occurred while fetching the count." });
  }
});

export default router;