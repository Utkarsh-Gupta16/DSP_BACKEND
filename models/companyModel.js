import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    businessName: { type: String, required: true },
    originUrl: { type: String, required: true },
    companyUrl: { type: String, required: true },
    address: { type: String, required: true },
    State: { type: String, required: true, index: true },
    City: { type: String, required: true, index: true },
    phone: { type: String, required: true },
    category: { type: String, required: true, index: true }, // Top-level category
    subcategory: { type: String, index: true }, // Second-level category
    Categories: { type: String, index: true }, // Sub-subcategory (renamed from categories)
    Country: { type: String, index: true }, // Country field
  },
  {
    timestamps: true,
    collection: "companies",
  }
);

// Compound indexes for hierarchical filtering
companySchema.index(
  { category: 1, subcategory: 1, Categories: 1 }, // Updated to Categories
  { background: true }
);

// Compound index for location-based filtering
companySchema.index(
  { Country: 1, State: 1, City: 1 },
  { background: true }
);

export const Company = mongoose.model("Company", companySchema);