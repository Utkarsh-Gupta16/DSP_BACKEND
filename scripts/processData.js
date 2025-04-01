// scripts/processData.js
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../config/db.js";

const processData = async () => {
  try {
    // Connect to the database
    await connectDB();

    const db = mongoose.connection;
    const sourceCollection = db.collection("businessdatabase");

    console.log("🔄 Processing data with $merge...");

    await sourceCollection.aggregate([
      {
        $group: {
          _id: {
            businessName: "$Business Name",
            address: "$Address",
            phone: "$Phone"
          },
          categories: { $push: "$Categories" },  // Collect categories
          originURL: { $first: "$Origin URL" },
          companyURL: { $first: "$Company URL" },
          state: { $first: "$State" },
          city: { $first: "$City" },
          contactPerson: { $first: "$Contact Person" }
        }
      },
      {
        $project: {
          _id: 0,
          businessName: "$_id.businessName",
          address: "$_id.address",
          phone: "$_id.phone",
          categories: { $reduce: { input: "$categories", initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } },  // Remove duplicates
          originURL: 1,
          companyURL: 1,
          state: 1,
          city: 1,
          contactPerson: 1
        }
      },
      {
        $merge: {
          into: "merged_companies2",  // Save into new collection
          whenMatched: "merge",      // Merge existing records
          whenNotMatched: "insert"   // Insert if new
        }
      }
    ], { allowDiskUse: true });  // Enable disk usage for large data

    console.log("🎉 All data processed!");
  } catch (error) {
    console.error("❌ Error processing data:", error.message);
  } finally {
    // Disconnect from the database
    await disconnectDB();
  }
};

processData();