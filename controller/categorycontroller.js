import {Category} from "../models/categorymodel.js";

// Create a new category with subcategories
export const createCategory = async (req, res) => {
    try {
        const { category, subcategories } = req.body;

        // Check if the category already exists
        const existingCategory = await Category.findOne({ category });
        if (existingCategory) {
            return res.status(400).json({ message: "Category already exists" });
        }

        // Create a new category with subcategories
        const newCategory = new Category({ category, subcategories });
        await newCategory.save();

        res.status(201).json({ message: "Category created successfully", newCategory });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all categories and their subcategories
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update a category and its subcategories
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, subcategories } = req.body;

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { category, subcategories },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ message: "Category not found" });
        }

        res.status(200).json({ message: "Category updated successfully", updatedCategory });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Delete a category and its subcategories
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedCategory = await Category.findByIdAndDelete(id);

        if (!deletedCategory) {
            return res.status(404).json({ message: "Category not found" });
        }

        res.status(200).json({ message: "Category deleted successfully", deletedCategory });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};