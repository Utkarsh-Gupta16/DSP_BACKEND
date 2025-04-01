// models/filterMetadataModel.js
import mongoose from "mongoose";

const filterMetadataSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ["category", "subcategory", "subSubcategory"] },
  category: { type: String }, // For subcategories and sub-subcategories
  subcategory: { type: String }, // For sub-subcategories
  value: { type: String, required: true }, // The category/subcategory/sub-subcategory name
  count: { type: Number, required: true },
  lastUpdated: { type: Date, default: Date.now },
});

export const FilterMetadata = mongoose.model("FilterMetadata", filterMetadataSchema);