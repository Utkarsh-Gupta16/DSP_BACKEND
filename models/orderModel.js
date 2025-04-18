import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    userName: {
      type: String, // Add userName field to store the user's name for email greeting
    },
    filters: {
      categories: [String],
      subcategories: [String],
      subSubcategories: [String],
      country: {
        label: String,
        value: String,
      },
      state: { // Changed from `State` to `state` to match `paymentRoute.js`
        label: String,
        value: String,
      },
      city: { // Changed from `City` to `city` to match `paymentRoute.js`
        label: String,
        value: String,
      },
    },
    totalCount: {
      type: Number,
      required: true,
    },
    approvedCompanies: { 
      type: Number, default: 0 
    }, // Add this field
    addOns: [String],
    price: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["stripe"],
      required: true,
    },
    paymentDetails: {
      paymentIntentId: {
        type: String,
        required: function () {
          return this.paymentMethod === "stripe";
        },
      },
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
    error: {
      type: String,
    },
    downloadLink: {
      type: String, // For future use if you switch to cloud storage
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);

export { Order };