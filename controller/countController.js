import { Company } from "../models/companyModel.js";

// Controller function to calculate total count of filtered records
export const getCount = async (req, res) => {
    try {
        const { category, subCategory, country, state, city } = req.query;

        // Build the filter object based on query parameters
        const filter = {};
        if (category) filter["Category"] = category; // Use virtual field for Category
        if (subCategory) filter["Subcategory"] = subCategory; // Use virtual field for Subcategory
        if (country) filter["Country"] = country;
        if (state) filter["State"] = state;
        if (city) filter["City"] = city;

        // Count the total number of matching records
        const totalCount = await Company.countDocuments(filter);

        res.json({ totalCount });
    } catch (error) {
        console.error("Error fetching count:", error.message);
        res.status(500).json({ error: "An error occurred while fetching the count." });
    }
};