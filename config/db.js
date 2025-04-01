// config/db.js
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/DataSellingProject";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, { 
      serverSelectionTimeoutMS: 5000, 
      family: 4 
    });
    console.log("✅ Connected to MongoDB");

    const db = mongoose.connection;
    const sourceCollection = db.collection("businessdatabase");

    // Ensure indexes for fast grouping
    await sourceCollection.createIndex({ "Business Name": 1, "Address": 1, "Phone": 1 });
    console.log("🔄 Indexing Done.");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1); // Exit the process on failure
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ MongoDB disconnection failed:", error.message);
  }
};