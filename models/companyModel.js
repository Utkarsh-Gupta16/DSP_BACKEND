import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    _id: mongoose.Schema.Types.ObjectId,
    businessName: { type: String, required: true },
    originUrl: { type: String, required: true },
    companyUrl: { type: String, required: true },
    address: { type: String, required: true },
    State: { type: String, required: true, index: true },
    City: { type: String, required: true, index: true },
    phone: { type: String, required: true },
    category: { type: String, required: true, index: true },
    subcategory: { type: String, index: true },
    Categories: { type: String, index: true },
    Country: { type: String, index: true },
    companyDetails: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyDetails",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "companies",
  }
);

companySchema.index(
  { category: 1, subcategory: 1, Categories: 1 },
  { background: true }
);

companySchema.index(
  { Country: 1, State: 1, City: 1 },
  { background: true }
);

export const Company = mongoose.model("Company", companySchema, "companies");
