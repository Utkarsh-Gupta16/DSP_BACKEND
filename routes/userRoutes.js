import express from "express";
import { User } from "../models/userModel.js";
import mongoose from "mongoose";
import passport from "passport";
import { authenticateToken, checkAdminRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all employees (users with role: "employee") - Place this first
router.get("/employee", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    console.log("Fetching all employees for admin:", req.user.id);
    const employees = await User.find({ role: "employee" }).select("_id name email"); // Adjust fields as needed
    console.log("Raw employee data:", employees); // Debug log to verify data
    console.log(`Found ${employees.length} employees`);
    res.status(200).json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error.message);
    res.status(500).json({ message: "Failed to fetch employees", error: error.message });
  }
});

// Get Current User
router.get("/me", authenticateToken, async (req, res) => {
  try {
    console.log("Fetching user with ID:", req.user.id);
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      console.log("User not found for ID:", req.user.id);
      return res.status(404).json({ message: "Invalid user ID", userId: req.user.id });
    }
    console.log("User found:", user.email);
    res.status(200).json(user);
  } catch (error) {
    console.error("Error in /api/users/me:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get All Users
router.get("/", async (req, res) => {
  try {
    console.log("Fetching all users");
    const users = await User.find();
    console.log(`Found ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error("Get users error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get User by ID - Place this after /employee
router.get("/:id", async (req, res) => {
  try {
    console.log("Fetching user with ID:", req.params.id);
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("Invalid user ID format:", req.params.id);
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      console.log("User not found for ID:", req.params.id);
      return res.status(404).json({ message: "User not found" });
    }
    console.log("User found:", user.email);
    res.json(user);
  } catch (error) {
    console.error("Get user by ID error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Save User Filters
router.post("/:userId/save-filters", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { filters } = req.body;
    console.log("Saving filters for user:", userId, "Filters:", filters);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Invalid user ID format:", userId);
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (req.user.id !== userId) {
      console.log("Unauthorized filter modification attempt by user:", req.user.id);
      return res.status(403).json({ message: "Unauthorized to modify this user's filters" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found for ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    user.savedFilters = filters;
    await user.save();
    console.log("Filters saved successfully for user:", user.email);

    res.status(200).json({ message: "Filters saved successfully" });
  } catch (error) {
    console.error("Save filters error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get User Saved Filters
router.get("/:userId/saved-filters", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Fetching saved filters for user:", userId);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.log("Invalid user ID format:", userId);
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (req.user.id !== userId) {
      console.log("Unauthorized filter access attempt by user:", req.user.id);
      return res.status(403).json({ message: "Unauthorized to access this user's filters" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found for ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Filters retrieved for user:", user.email);
    res.status(200).json({ filters: user.savedFilters || {} });
  } catch (error) {
    console.error("Get saved filters error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;