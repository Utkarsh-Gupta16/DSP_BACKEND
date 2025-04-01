import express from "express";
import { Category } from "../models/categorymodel.js";

const router = express.Router();

// Fetch all categories
router.get("/", async (req, res) => {
  try {
    const rawCategories = await Category.find().lean(); // Fetch raw data

    // Group subcategories by category
    const groupedCategories = rawCategories.reduce((acc, curr) => {
      const existingCategory = acc.find((item) => item.Category === curr.Category);
      if (existingCategory) {
        existingCategory.subcategories.push(curr.Subcategory);
      } else {
        acc.push({
          _id: curr._id,
          Category: curr.Category,
          subcategories: [curr.Subcategory],
        });
      }
      return acc;
    }, []);

    res.json(groupedCategories); // Return grouped data
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;