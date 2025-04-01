import express from "express";
import { Employee } from "../models/employeeModel.js";

const router = express.Router();

// Add Employee
router.post("/", async (req, res) => {
    try {
        const { name, email, phone, position, department, salary } = req.body;

        const existingEmployee = await Employee.findOne({ email });
        if (existingEmployee) return res.status(400).json({ message: "Employee already exists" });

        const employee = new Employee({ name, email, phone, position, department, salary });
        await employee.save();

        res.status(201).json({ message: "Employee added successfully", employee });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get All Employees
router.get("/", async (req, res) => {
    try {
        const employees = await Employee.find();
        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Employee by ID
router.get("/:id", async (req, res) => {
    try {
        const employee = await Employee.findById(req.params.id);
        if (!employee) return res.status(404).json({ message: "Employee not found" });

        res.json(employee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Employee
router.put("/:id", async (req, res) => {
    try {
        const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!employee) return res.status(404).json({ message: "Employee not found" });

        res.json({ message: "Employee updated successfully", employee });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Employee
router.delete("/:id", async (req, res) => {
    try {
        const employee = await Employee.findByIdAndDelete(req.params.id);
        if (!employee) return res.status(404).json({ message: "Employee not found" });

        res.json({ message: "Employee deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
