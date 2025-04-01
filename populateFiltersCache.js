import mongoose from "mongoose";
import dotenv from "dotenv";
import { Company } from "./models/companyModel.js";
import { FiltersCache } from "./models/filtersCacheModel.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

const populateFiltersCache = async () => {
  try {
    await connectDB();

    console.log("Populating filters cache for 17M records...");

    const pipeline = [
      {
        $group: {
          _id: "$category",
          subCategories: { $addToSet: "$subcategory" },
          subSubCategories: { $addToSet: "$categories" },
          countries: { $addToSet: "$Country" },
          states: { $addToSet: "$state" },
          cities: { $addToSet: "$city" },
        },
      },
      {
        $project: {
          category: "$_id",
          subCategories: {
            $filter: { input: "$subCategories", cond: { $and: [{ $ne: ["$$this", null] }, { $ne: ["$$this", "N/A"] }] } },
          },
          subSubCategories: {
            $filter: {
              input: "$subSubCategories",
              cond: { $and: [{ $ne: ["$$this", null] }, { $ne: ["$$this", "N/A"] }] },
            },
          },
          countries: {
            $filter: { input: "$countries", cond: { $and: [{ $ne: ["$$this", null] }, { $ne: ["$$this", "N/A"] }] } },
          },
          states: {
            $filter: { input: "$states", cond: { $and: [{ $ne: ["$$this", null] }, { $ne: ["$$this", "N/A"] }] } },
          },
          cities: {
            $filter: { input: "$cities", cond: { $and: [{ $ne: ["$$this", null] }, { $ne: ["$$this", "N/A"] }] } },
          },
          _id: 0,
        },
      },
    ];

    console.log("Running aggregation pipeline...");
    const filters = await Company.aggregate(pipeline).allowDiskUse(true);
    console.log(`Found ${filters.length} unique categories.`);
    console.log("Sample filter data:", filters.slice(0, 5)); // Log first 5 entries

    if (filters.every((f) => f.subSubCategories.length === 0)) {
      console.warn("No sub-subcategories found in any category!");
    }

    await FiltersCache.deleteMany({});
    console.log("Cleared existing filters cache.");

    await FiltersCache.insertMany(filters);
    console.log("Filters cache populated successfully.");

    await mongoose.connection.close();
    console.log("✅ Done");
  } catch (error) {
    console.error("Error populating filters cache:", error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

populateFiltersCache();