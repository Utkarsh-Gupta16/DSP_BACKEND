import mongoose from "mongoose";

const filtersCacheSchema = new mongoose.Schema({
  category: { type: String, required: true },
  subCategories: [{ type: String }],
  subSubCategories: [{ type: String }],
  countries: [{ type: String }],
  states: [{ type: String }],
  cities: [{ type: String }],
  lastUpdated: { type: Date, default: Date.now },
});

// Indexes for fast lookups
filtersCacheSchema.index({ category: 1 });
filtersCacheSchema.index({ "subCategories": 1 });
filtersCacheSchema.index({ "subSubCategories": 1 });

export const FiltersCache = mongoose.model("FiltersCache", filtersCacheSchema, "filtersCache");