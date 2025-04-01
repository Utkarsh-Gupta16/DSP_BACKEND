import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    category: {
        type: String,
        required: [true, "Please enter the category name"],
        unique: true,
    },
    subcategories: [
        {
            type: String,
            required: [true, "Please enter the subcategory name"],
        }
    ],
}, { timestamps: true });

// Ensure that each subcategory is unique within its category
categorySchema.index({ category: 1, "subcategories": 1 }, { unique: true });

export const Category = mongoose.model("Category", categorySchema);