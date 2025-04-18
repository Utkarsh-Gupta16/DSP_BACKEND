import express from "express";
import Stripe from "stripe";
import { Order } from "../models/orderModel.js";
import { User } from "../models/userModel.js";
import { Company } from "../models/companyModel.js";
import Task  from "../models/taskModel.js";
import AssignedCompanies from "../models/assignedCompaniesModel.js"; // Corrected import
import CompanyDetails from "../models/companyDetailsModel.js";
import jwt from "jsonwebtoken";
import { Parser } from "json2csv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sendEmail from "../utils/sendEmail.js";
import AdmZip from "adm-zip";

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    console.log("No token provided in request");
    return res.status(401).json({ message: "No token provided" });
  }

  if (!process.env.JWT_SECRET_KEY) {
    console.log("JWT_SECRET_KEY is not defined in environment variables");
    return res.status(500).json({ message: "JWT_SECRET_KEY is not defined" });
  }

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
    if (err) {
      console.log("Token verification failed:", err.message);
      return res.status(403).json({ message: "Invalid or expired token", error: err.message });
    }
    console.log("Token verified, decoded user:", decoded);
    req.user = decoded; // { id: userId }
    next();
  });
};

const checkAdminRole = (req, res, next) => {
  if (req.user.role !== "admin") {
    console.log("Unauthorized access attempt by non-admin user:", req.user.id);
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

// Refresh token endpoint
router.post("/refresh-token", async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    console.log("No token provided in refresh request");
    return res.status(401).json({ message: "No token provided" });
  }

  if (!process.env.JWT_SECRET_KEY) {
    console.log("JWT_SECRET_KEY is not defined in environment variables");
    return res.status(500).json({ message: "JWT_SECRET_KEY is not defined" });
  }

  try {
    // Verify the token, ignoring expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY, { ignoreExpiration: true });
    console.log("Token decoded for refresh:", decoded);

    // Issue a new token with a fresh expiration time (e.g., 1 day)
    const newToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: process.env.JWT_EXPIRE || "1d" }
    );

    console.log("New token issued:", newToken);
    res.status(200).json({ token: newToken });
  } catch (error) {
    console.error("Error refreshing token:", error.message);
    res.status(403).json({ message: "Failed to refresh token", error: error.message });
  }
});

// Create a PaymentIntent for all payment methods
router.post("/create-payment-intent", authenticateToken, async (req, res) => {
  try {
    const { totalCount, country, selectedAddons = [] } = req.body;
    console.log("Creating PaymentIntent for:", { totalCount, country, selectedAddons });

    if (!totalCount || totalCount <= 0) {
      console.log("Invalid totalCount:", totalCount);
      return res.status(400).json({ message: "totalCount must be a positive number" });
    }

    const threshold = 100000;
    const rateFirstTier = 0.01;
    const rateSecondTier = 0.005;
    const addonRate = 0.01;

    let basePrice;
    if (totalCount <= threshold) {
      basePrice = totalCount * rateFirstTier;
    } else {
      const firstTierCost = threshold * rateFirstTier;
      const secondTierCount = totalCount - threshold;
      const secondTierCost = secondTierCount * rateSecondTier;
      basePrice = firstTierCost + secondTierCost;
    }

    const addonCost = totalCount * addonRate * selectedAddons.length;
    const totalPrice = basePrice + addonCost;

    const amountInCents = Math.round(totalPrice * 100);
    console.log("Calculated amount in cents:", amountInCents);

    if (amountInCents < (country === "India" ? 30 : 50)) {
      console.log("Amount too small:", amountInCents);
      return res.status(400).json({ message: "Amount is too small. Minimum is 50 cents for USD or 30 INR for INR." });
    }

    let paymentMethodTypes = ["card"];
    if (country === "US") {
      paymentMethodTypes.push("us_bank_account");
    } else if (country === "EU") {
      paymentMethodTypes.push("sepa_debit");
    }
    console.log("Payment method types:", paymentMethodTypes);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: country === "India" ? "inr" : "usd",
      payment_method_types: paymentMethodTypes,
      metadata: { userId: req.user.id, totalCount, selectedAddons: JSON.stringify(selectedAddons) },
    });

    console.log("PaymentIntent created:", paymentIntent.id);
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).json({ message: "Failed to create payment intent", error: error.message });
  }
});

// New endpoint to delete tasks for a specific employee
router.delete("/admin/delete-tasks/:employeeId", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const result = await Task.deleteMany({ employeeId });
    console.log(`Deleted ${result.deletedCount} tasks for employee ${employeeId}`);
    res.status(200).json({ message: `Deleted ${result.deletedCount} tasks for employee ${employeeId}` });
  } catch (error) {
    console.error("Error deleting tasks:", error.message);
    res.status(500).json({ message: "Failed to delete tasks", error: error.message });
  }
});

// New endpoint to clear all tasks
router.delete("/admin/clear-all-tasks", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const result = await Task.deleteMany({});
    console.log(`Cleared all tasks. Total deleted: ${result.deletedCount}`);
    res.status(200).json({ message: `Cleared all tasks. Total deleted: ${result.deletedCount}` });
  } catch (error) {
    console.error("Error clearing all tasks:", error.message);
    res.status(500).json({ message: "Failed to clear all tasks", error: error.message });
  }
});

// New endpoint to delete a specific task by ID
router.delete("/admin/delete-task/:taskId", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await Task.findByIdAndDelete(taskId);
    if (!result) {
      return res.status(404).json({ message: "Task not found" });
    }
    console.log(`Deleted task with ID ${taskId}`);
    res.status(200).json({ message: `Deleted task with ID ${taskId}` });
  } catch (error) {
    console.error("Error deleting task:", error.message);
    res.status(500).json({ message: "Failed to delete task", error: error.message });
  }
});

// New endpoint to assign tasks to employees
router.post("/admin/assign-task", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const { orderId, employeeId, companyCount, startIndex = 0 } = req.body;
    console.log("Assign task request body:", req.body);

    // Validate inputs
    if (!orderId || !employeeId || !companyCount) {
      return res.status(400).json({ message: "orderId, employeeId, and companyCount are required" });
    }
    const companyCountNum = parseInt(companyCount, 10);
    const startIndexNum = parseInt(startIndex, 10);
    if (isNaN(companyCountNum) || companyCountNum <= 0 || companyCountNum > 100) {
      return res.status(400).json({ message: "companyCount must be a number between 1 and 100" });
    }
    if (isNaN(startIndexNum) || startIndexNum < 0) {
      return res.status(400).json({ message: "startIndex must be a non-negative number" });
    }

    // Fetch order details
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Determine the next startIndex based on the maximum endIndex of existing tasks
    const lastTask = await Task.findOne({ orderId }).sort({ endIndex: -1 });
    const nextStartIndex = lastTask ? lastTask.endIndex + 1 : 0;
    const effectiveStartIndex = Math.max(startIndexNum, nextStartIndex); // Use the higher value

    // Normalize filters
    const normalizedCategories = order.filters.categories?.length > 0
      ? order.filters.categories.map(cat => cat.trim())
      : [];
    const normalizedSubcategories = order.filters.subcategories?.length > 0
      ? order.filters.subcategories.map(subcat => subcat.split(":").pop().trim())
      : [];
    const normalizedSubSubcategories = order.filters.subSubcategories?.length > 0
      ? order.filters.subSubcategories.map(subSubcat => subSubcat.split(":").pop().trim())
      : [];

    // Construct query
    const query = {
      ...(normalizedCategories.length > 0 && { category: { $in: normalizedCategories } }),
      ...(normalizedSubcategories.length > 0 && { subcategory: { $in: normalizedSubcategories } }),
      ...(normalizedSubSubcategories.length > 0 && { Categories: { $in: normalizedSubSubcategories } }),
      ...(order.filters.country?.value && { Country: order.filters.country.value }),
      ...(order.filters.state?.value && { State: order.filters.state.value }),
      ...(order.filters.city?.value && { City: order.filters.city.value }),
    };

    // Exclude already-assigned companies
    const existingTasks = await Task.find({ orderId }).select("companyIds");
    const assignedCompanyIds = existingTasks.flatMap(task => task.companyIds);
    const uniqueAssignedCompanyIds = [...new Set(assignedCompanyIds)];
    if (uniqueAssignedCompanyIds.length > 0) {
      query._id = { $nin: uniqueAssignedCompanyIds };
    }

    // Fetch companies to assign
    const companies = await Company.find(query)
      .skip(effectiveStartIndex)
      .limit(companyCountNum)
      .select("_id companyDetails");

    if (companies.length === 0) {
      return res.status(400).json({ message: "No companies available to assign with the given filters or startIndex." });
    }

    // Calculate endIndex
    const endIndex = effectiveStartIndex + companies.length - 1;

    // Create a new task
    const newTask = new Task({
      orderId,
      employeeId,
      companyCount: companies.length,
      startIndex: effectiveStartIndex,
      endIndex: endIndex,
      companyIds: companies.map(company => company._id),
      companyData: companies.map(company => ({
        companyId: company._id,
        companyDetails: company.companyDetails,
      })),
      status: "pending",
    });

    await newTask.save();

    console.log(`Assigned ${companies.length} companies to employee ${employeeId} with range ${effectiveStartIndex + 1} to ${endIndex + 1}.`);
    res.status(200).json({ task: newTask });
  } catch (error) {
    console.error("Error assigning task:", error.message, error.stack);
    res.status(500).json({ message: "Failed to assign task", error: error.message });
  }
});

router.get("/admin/assigned-companies", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    console.log("Fetching assigned companies for admin:", req.user.id);
    const assignedTasks = await Task.aggregate([
      {
        $group: {
          _id: "$orderId", // Group by orderId to get total per order
          totalCompaniesAssigned: { $sum: "$companyCount" },
          taskCount: { $sum: 1 },
          employeeIds: { $push: "$employeeId" }, // Track associated employees
        },
      },
      {
        $sort: { totalCompaniesAssigned: -1 },
      },
    ]);
    console.log("Assigned companies data per order:", assignedTasks);
    res.status(200).json(assignedTasks);
  } catch (error) {
    console.error("Error fetching assigned companies:", error.message);
    res.status(500).json({ message: "Failed to fetch assigned companies", error: error.message });
  }
});

// Inside paymentRoutes.js, add this new endpoint
router.get("/admin/pending-approvals", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    console.log("Fetching pending approvals for admin:", req.user.id);
    const pendingApprovals = await CompanyDetails.find({ status: "pending" })
      .populate("companyId")
      .populate("employeeId", "name email")
      .populate("orderId", "userId email userName") // Populate order details
      .lean();
    console.log("Fetched pending approvals:", pendingApprovals);
    res.status(200).json(pendingApprovals);
  } catch (error) {
    console.error("Error fetching pending approvals:", error.message);
    res.status(500).json({ message: "Failed to fetch pending approvals", error: error.message });
  }
});

router.get("/admin/pending-approvals", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    console.log("Fetching pending approvals for admin:", req.user.id);
    const pendingApprovals = await CompanyDetails.find({ status: "pending" })
      .populate("companyId")
      .populate("employeeId", "name email")
      .lean();

    console.log("Fetched pending approvals:", pendingApprovals);
    res.status(200).json(pendingApprovals);
  } catch (error) {
    console.error("Error fetching pending approvals:", error.message);
    res.status(500).json({ message: "Failed to fetch pending approvals", error: error.message });
  }
});

// Add an endpoint to update the approval status
router.put("/admin/approve-company-details/:companyDetailId", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const { companyDetailId } = req.params;
    const { status, returnToEmployee } = req.body; // Add returnToEmployee from request
    const validStatuses = ["approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updatedApproval = await CompanyDetails.findByIdAndUpdate(
      companyDetailId,
      { 
        status, 
        approvedDate: status === "approved" ? new Date() : undefined,
        returnToEmployee: returnToEmployee || false // Store if it should go back to employee
      },
      { new: true, runValidators: true }
    );
    if (!updatedApproval) {
      return res.status(404).json({ message: "Approval record not found" });
    }

    console.log(`Updated approval status for ${companyDetailId} to ${status}`);

    // If rejected and returnToEmployee is true, update the task and notify the employee
    if (status === "rejected" && returnToEmployee) {
      const task = await Task.findOne({ companyIds: updatedApproval.companyId });
      if (task) {
        // Mark the company as pending for refill (you can add a field like `pendingRefill` to Task or CompanyDetails)
        await CompanyDetails.findByIdAndUpdate(companyDetailId, { pendingRefill: true });
        // Optionally, send an email or notification to the employee
        const employeeEmail = updatedApproval.employeeId.email;
        await sendEmail({
          to: employeeEmail,
          subject: "Company Data Rejected - Please Refill",
          text: `Dear ${updatedApproval.employeeId.name},\n\nThe company data for ${updatedApproval.companyId.businessName} (ID: ${updatedApproval.companyId._id}) has been rejected. Please refill the form and resubmit it.\n\nBest regards,\nAdmin Team`,
        });
        console.log(`Notification sent to employee ${employeeEmail} for rejected company ${companyDetailId}`);
      }
    }

    res.status(200).json({ message: "Approval status updated successfully", approval: updatedApproval });
  } catch (error) {
    console.error("Error updating approval status:", error.message);
    res.status(500).json({ message: "Failed to update approval status", error: error.message });
  }
});



router.get("/task/:taskId", authenticateToken, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId).populate("orderId");
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.status(200).json(task);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch task", error: error.message });
  }
});

// Add this near the other router.get endpoints
router.get("/admin/tasks", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    console.log("Fetching all tasks for admin:", req.user.id);
    const tasks = await Task.find().lean(); // Use .lean() to get plain JavaScript objects
    console.log("Fetched tasks:", tasks);
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error.message);
    res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
});

router.get("/employee/companies", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.query;
    console.log("Fetching companies for employee:", req.user.id, "taskId:", taskId);

    let tasksQuery = { employeeId: req.user.id };
    if (taskId) {
      tasksQuery._id = taskId;
    }

    const tasks = await Task.find(tasksQuery).populate("orderId");
    if (!tasks || tasks.length === 0) {
      console.log("No tasks found for employee:", req.user.id);
      return res.status(200).json([]); // Return empty array instead of 500
    }

    const companyQueries = tasks.map(async (task) => {
      const order = task.orderId;
      const query = {};
      if (order.filters.categories?.length > 0) query.category = { $in: order.filters.categories };
      if (order.filters.subcategories?.length > 0) query.subcategory = { $in: order.filters.subcategories };
      if (order.filters.subSubcategories?.length > 0) {
        const normalizedSubSubcategories = order.filters.subSubcategories.map(subSub =>
          subSub.split(":").pop().trim()
        );
        query.Categories = { $regex: new RegExp(normalizedSubSubcategories.join("|"), "i") };
      }
      if (order.filters.country?.value) query.Country = order.filters.country.value;
      if (order.filters.state?.value) query.State = order.filters.state.value;
      if (order.filters.city?.value) query.City = order.filters.city.value;

      console.log("Company query for task", task._id, ":", query);

      const startIndex = task.startIndex || 0;
      const companyCount = task.companyCount || 0;
      if (startIndex < 0 || companyCount <= 0) {
        console.warn("Invalid startIndex or companyCount for task", task._id, { startIndex, companyCount });
        return { taskId: task._id, companies: [], range: [0, 0] };
      }

      let companies;
      try {
        companies = await Company.find(query)
          .skip(startIndex)
          .limit(companyCount)
          .lean();
        console.log("Fetched companies for task", task._id, "Count:", companies.length, "Sample:", companies.slice(0, 2));
      } catch (dbError) {
        console.error("Database error fetching companies for task", task._id, dbError.message);
        return { taskId: task._id, companies: [], range: [startIndex + 1, startIndex] };
      }

      // Safely handle companyData being undefined
      const companiesWithDetails = companies.map(company => {
        const companyData = task.companyData || []; // Default to empty array if undefined
        const matchingData = companyData.find(cd => cd.companyId && cd.companyId.toString() === company._id.toString());
        return {
          ...company,
          companyDetails: matchingData?.companyDetails || {}
        };
      });

      return { taskId: task._id, companies: companiesWithDetails, range: [startIndex + 1, startIndex + companies.length] };
    });

    const results = await Promise.all(companyQueries);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error in /employee/companies endpoint:", error.stack);
    res.status(500).json({ message: "Failed to fetch companies", error: error.message });
  }
});

router.get("/employee/tasks", authenticateToken, async (req, res) => {
  try {
    const employeeId = req.user.id;
    const tasks = await Task.find({ employeeId })
      .select("orderId companyCount startIndex endIndex assignedDate submitTillDate")
      .populate("orderId", "userId email userName"); // Ensure orderId is populated
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching employee tasks:", error.message);
    res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
});

router.post("/task/:taskId/company", authenticateToken, async (req, res) => {
  try {
    const { index, data } = req.body;
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!task.companyData) task.companyData = [];
    task.companyData[index] = data;
    await task.save();
    res.status(200).json({ message: "Company data saved" });
  } catch (error) {
    res.status(500).json({ message: "Failed to save company data", error: error.message });
  }
});

// Updated endpoint to count companies
router.post("/count-companies", authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;

    // Normalize filters
    const normalizedCategories = query.categories?.length > 0
      ? query.categories.map(cat => cat.trim())
      : [];
    const normalizedSubcategories = query.subcategories?.length > 0
      ? query.subcategories.map(subcat => subcat.split(":").pop().trim())
      : [];
    const normalizedSubSubcategories = query.subSubcategories?.length > 0
      ? query.subSubcategories.map(subSubcat => subSubcat.split(":").pop().trim())
      : [];

    // Construct normalized query
    const normalizedQuery = {
      ...(normalizedCategories.length > 0 && { category: { $in: normalizedCategories } }),
      ...(normalizedSubcategories.length > 0 && { subcategory: { $in: normalizedSubcategories } }),
      ...(normalizedSubSubcategories.length > 0 && { Categories: { $in: normalizedSubSubcategories } }),
      ...(query.country?.value && { Country: query.country.value }),
      ...(query.state?.value && { State: query.state.value }),
      ...(query.city?.value && { City: query.city.value }),
    };

    console.log("Count-companies query:", JSON.stringify(normalizedQuery, null, 2));

    // Count matching companies
    const count = await Company.countDocuments(normalizedQuery);
    console.log("Counted companies:", count);

    res.status(200).json({ count });
  } catch (error) {
    console.error("Error counting companies:", error.message);
    res.status(500).json({ message: "Failed to count companies", error: error.message });
  }
});

// Add this to paymentRoute.js
router.post("/generate-and-send-csv", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const { orderId, email, userName, totalCount } = req.body;
    const order = await Order.findById(orderId).lean();
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Reuse processPaymentInBackground logic for CSV generation
    await processPaymentInBackground(order, order.filters, totalCount, order.price, order.selectedAddons || []);

    res.status(200).json({ message: "CSV generation and email sending initiated" });
  } catch (error) {
    console.error("Error generating and sending CSV:", error.message);
    res.status(500).json({ message: "Failed to generate and send CSV", error: error.message });
  }
});

router.patch("/task/:taskId", authenticateToken, async (req, res) => {
  try {
    const { status, completedDate } = req.body;
    const task = await Task.findByIdAndUpdate(
      req.params.taskId,
      { status, completedDate },
      { new: true }
    );
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.status(200).json({ message: "Task updated", task });
  } catch (error) {
    res.status(500).json({ message: "Failed to update task", error: error.message });
  }
});

router.put("/admin/update-order-status/:orderId", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const validStatuses = ["pending_delivery", "completed", "failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true, runValidators: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    console.log(`Updated order ${orderId} status to ${status}`);
    res.status(200).json({ message: "Order status updated successfully", order: updatedOrder });
  } catch (error) {
    console.error("Error updating order status:", error.message);
    res.status(500).json({ message: "Failed to update order status", error: error.message });
  }
});

// Utility to promisify fs.writeStream close
const closeWriteStream = (writeStream) => {
  return new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
    writeStream.end();
  });
};

// Background task to either send notification or process CSV based on add-ons
const processPaymentInBackground = async (order, filters, totalCount, price, selectedAddons) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  try {
    console.log("Starting background task for order:", order._id);

    if (selectedAddons.length > 0) {
      // Case 1: Add-ons selected, calculate dynamic delivery days
      const deliveryDays = Math.ceil(totalCount / 1000); // Number of companies / 1000, rounded up
      const emailSubject = "Payment Confirmation - Data Delivery in Progress";
      const emailText = `Dear ${order.userName || "Customer"},\n\nThank you for your purchase! Your payment has been successfully processed.\n\nOrder Details:\n- Total Companies: ${totalCount}\n- Total Price: $${price}\n- Selected Add-Ons: ${selectedAddons.join(", ") || "None"}\n\nYour company data, including the requested add-ons, is being prepared and will be sent to you via email as a CSV or ZIP file within ${deliveryDays} days. We appreciate your patience.\n\nIf you have any questions, please contact support.\n\nBest regards,\nYour Team`;
      await sendEmail({
        to: order.email,
        subject: emailSubject,
        text: emailText,
      });

      console.log("Notification email sent to:", order.email);

      // Send admin notification email
      const adminEmailSubject = "New Order with Add-Ons - Action Required";
      const adminEmailText = `Dear Admin,\n\nA new order with add-ons has been placed. Please prepare the data accordingly.\n\nOrder Details:\n- Order ID: ${order._id}\n- User Email: ${order.email}\n- User Name: ${order.userName || "N/A"}\n- Total Companies: ${totalCount}\n- Total Price: $${price}\n- Selected Add-Ons: ${selectedAddons.join(", ") || "None"}\n- Categories: ${filters.categories?.join(", ") || "None"}\n- Subcategories: ${filters.subcategories?.join(", ") || "None"}\n- Sub-Subcategories: ${filters.subSubcategories?.join(", ") || "None"}\n- Delivery Days: ${deliveryDays}\n\nPlease ensure the data is prepared and delivered within ${deliveryDays} days.\n\nBest regards,\nData Selling Team`;
      await sendEmail({
        to: process.env.ADMIN_EMAIL || "admin@example.com", // Fallback to a default email
        subject: adminEmailSubject,
        text: adminEmailText,
      });

      console.log("Admin notification email sent to:", process.env.ADMIN_EMAIL);

      await Order.findByIdAndUpdate(order._id, { status: "pending_delivery" });
      console.log("Order status updated to pending_delivery for order:", order._id);
    } else {
      // Case 2: No add-ons, proceed with CSV generation and immediate delivery
      const orConditions = [];
      if (filters.categories?.length > 0) {
        filters.categories.forEach(cat => {
          orConditions.push({ category: cat.trim() });
        });
      }
      if (filters.subcategories?.length > 0) {
        filters.subcategories.forEach(subCat => {
          const [category, subcategory] = subCat.split(":");
          orConditions.push({ category: category.trim(), subcategory: subcategory.trim() });
        });
      }
      if (filters.subSubcategories?.length > 0) {
        const groupedSubSubcategories = {};
        filters.subSubcategories.forEach(subSub => {
          const [category, subcategory, subSubcategory] = subSub.split(":");
          const key = `${category}:${subcategory}`;
          if (!groupedSubSubcategories[key]) {
            groupedSubSubcategories[key] = { category: category.trim(), subcategory: subcategory.trim(), subSubcategories: [] };
          }
          groupedSubSubcategories[key].subSubcategories.push(subSubcategory.trim());
        });
        Object.values(groupedSubSubcategories).forEach(({ category, subcategory, subSubcategories }) => {
          orConditions.push({ category, subcategory, subSubcategories });
        });
      }

      const matchStage = {};
      if (orConditions.length > 0) {
        matchStage.$or = orConditions.map(condition => {
          const subMatch = {};
          if (condition.category) {
            subMatch.category = new RegExp(`^${condition.category}$`, "i");
          }
          if (condition.subcategory) {
            subMatch.subcategory = new RegExp(`^${condition.subcategory}$`, "i");
          }
          if (condition.subSubcategories && Array.isArray(condition.subSubcategories)) {
            subMatch.$expr = {
              $gt: [
                {
                  $size: {
                    $setIntersection: [
                      {
                        $cond: {
                          if: { $and: [{ $ne: ["$Categories", null] }, { $ne: ["$Categories", ""] }, { $eq: [{ $type: "$Categories" }, "string"] }] },
                          then: {
                            $map: {
                              input: { $split: ["$Categories", ","] },
                              as: "cat",
                              in: { $trim: { input: "$$cat" } },
                            },
                          },
                          else: [],
                        },
                      },
                      condition.subSubcategories,
                    ],
                  },
                },
                0,
              ],
            };
          }
          return subMatch;
        });
      }

      const locationConditions = {};
      if (filters.country?.value) {
        locationConditions.Country = filters.country.value.trim();
      }
      if (filters.state?.value) {
        locationConditions.State = filters.state.value.trim();
      }
      if (filters.city?.value) {
        locationConditions.City = filters.city.value.trim();
      }

      if (Object.keys(locationConditions).length > 0) {
        if (matchStage.$or) {
          matchStage.$and = [{ $or: matchStage.$or }, locationConditions];
          delete matchStage.$or;
        } else {
          Object.assign(matchStage, locationConditions);
        }
      }

      if (Object.keys(matchStage).length === 0) {
        console.log("No filters provided, cannot fetch companies");
        await Order.findByIdAndUpdate(order._id, {
          status: "failed",
          error: "No filters provided to fetch companies.",
        });
        return;
      }

      console.log("Validating count with match stage:", JSON.stringify(matchStage, null, 2));

      const countResult = await Company.aggregate([
        { $match: matchStage },
        { $group: { _id: "$_id" } },
        { $count: "totalCount" },
      ]);

      const validatedCount = countResult.length > 0 ? countResult[0].totalCount : 0;
      console.log("Validated count:", validatedCount);

      if (Math.abs(validatedCount - totalCount) > 100) {
        console.log(`Mismatch between validated count (${validatedCount}) and totalCount (${totalCount})`);
        await Order.findByIdAndUpdate(order._id, {
          status: "failed",
          error: `Mismatch between validated count (${validatedCount}) and expected count (${totalCount}). A refund will be issued.`,
        });

        if (order.paymentDetails?.paymentIntentId) {
          try {
            console.log("Initiating refund for PaymentIntent:", order.paymentDetails.paymentIntentId);
            await stripe.refunds.create({
              payment_intent: order.paymentDetails.paymentIntentId,
            });
            console.log("Refund initiated successfully");
          } catch (refundError) {
            console.error("Error initiating refund:", refundError.message);
          }
        }

        const emailSubject = "Order Failed - Refund Initiated";
        const emailText = `Dear ${order.userName || "Customer"},\n\nWe regret to inform you that your order (ID: ${order._id}) has failed due to a mismatch in the number of companies fetched (${validatedCount}) compared to the expected count (${totalCount}).\n\nTotal Price: $${price}\n\nA refund has been initiated, and the amount will be credited back to your account shortly. If you have any questions, please contact support.\n\nBest regards,\nYour Team`;
        await sendEmail({
          to: order.email,
          subject: emailSubject,
          text: emailText,
        });

        console.log("Failure email sent to:", order.email);
        return;
      }

      const baseFields = [
        { label: "Business Name", value: "Business Name" },
        { label: "Country", value: "Country" },
        { label: "State", value: "State" },
        { label: "City", value: "City" },
        { label: "Address", value: "Address" },
        { label: "Phone", value: "Phone" },
        { label: "Category", value: "category" },
        { label: "Subcategory", value: "subcategory" },
        { label: "Sub-Sub Categories", value: "Categories" },
        { label: "Timezone", value: "Timezone" },
      ];

      const addonFields = selectedAddons.map(addon => ({
        label: addon.charAt(0).toUpperCase() + addon.slice(1),
        value: addon,
      }));

      const fields = [...baseFields, ...addonFields];
      const json2csvParser = new Parser({ fields });
      const header = json2csvParser.parse([]).split("\n")[0] + "\n";

      console.log("Streaming companies with match stage:", JSON.stringify(matchStage, null, 2));
      const cursor = Company.aggregate([
        { $match: matchStage },
        { $group: { _id: "$_id", doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
      ]).cursor();

      let companyCount = 0;
      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) {
        console.log("Creating temp directory:", tempDir);
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const maxFileSize = 18 * 1024 * 1024;
      let currentFileIndex = 1;
      let currentFileSize = 0;
      let currentFilePath = path.join(tempDir, `companies_${order._id}_part${currentFileIndex}.csv`);
      let currentWriteStream = fs.createWriteStream(currentFilePath);
      currentWriteStream.write(header);
      currentFileSize += Buffer.byteLength(header, "utf8");

      const splitFiles = [currentFilePath];

      for await (const company of cursor) {
        companyCount++;
        const row = json2csvParser.parse([company]).split("\n")[1] + "\n";
        const rowSize = Buffer.byteLength(row, "utf8");

        if (currentFileSize + rowSize > maxFileSize) {
          await closeWriteStream(currentWriteStream);
          console.log(`Closed CSV file: ${currentFilePath}`);
          currentFileIndex++;
          currentFilePath = path.join(tempDir, `companies_${order._id}_part${currentFileIndex}.csv`);
          currentWriteStream = fs.createWriteStream(currentFilePath);
          currentWriteStream.write(header);
          currentFileSize = Buffer.byteLength(header, "utf8");
          splitFiles.push(currentFilePath);
        }

        currentWriteStream.write(row);
        currentFileSize += rowSize;
      }

      await closeWriteStream(currentWriteStream);
      console.log(`Closed CSV file: ${currentFilePath}`);
      console.log(`Processed ${companyCount} companies`);
      console.log(`Split into ${splitFiles.length} CSV files:`, splitFiles);

      for (const csvFile of splitFiles) {
        if (!fs.existsSync(csvFile)) {
          throw new Error(`CSV file not found: ${csvFile}`);
        }
      }

      const zipFiles = [];
      for (let i = 0; i < splitFiles.length; i++) {
        const csvFilePath = splitFiles[i];
        const zipFilePath = path.join(tempDir, `companies_${order._id}_part${i + 1}.zip`);
        const zip = new AdmZip();
        zip.addLocalFile(csvFilePath);
        zip.writeZip(zipFilePath);

        const zipStats = fs.statSync(zipFilePath);
        const zipSize = zipStats.size;
        console.log(`ZIP file ${zipFilePath} size: ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);

        if (zipSize > maxFileSize) {
          throw new Error(`ZIP file ${zipFilePath} exceeds 18 MB limit: ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);
        }

        zipFiles.push(zipFilePath);
      }

      for (let i = 0; i < zipFiles.length; i++) {
        const zipFilePath = zipFiles[i];
        const partNumber = i + 1;
        const totalParts = zipFiles.length;

        console.log(`Sending email ${partNumber} of ${totalParts} to:`, order.email);
        const emailSubject = `Your Purchased Company Data - Part ${partNumber} of ${totalParts}`;
        const emailText = `Dear ${order.userName || "Customer"},\n\nThank you for your purchase! Your company data has been split into ${totalParts} parts due to email size limits. This email contains Part ${partNumber} of ${totalParts}.\n\nPlease download and unzip the attached file. Once you have all parts, you can combine them into a single CSV file if needed. Instructions:\n1. Download all parts.\n2. Unzip each part to get the CSV files.\n3. Combine the CSV files (excluding headers from parts 2 onward) into a single file.\n\nTotal Companies: ${companyCount}\nTotal Price: $${price}\nSelected Add-Ons: ${selectedAddons.join(", ") || "None"}\n\nIf you have any questions, please contact support.\n\nBest regards,\nYour Team`;
        await sendEmail({
          to: order.email,
          subject: emailSubject,
          text: emailText,
          attachments: [
            {
              filename: `companies_${order._id}_part${partNumber}.zip`,
              path: zipFilePath,
            },
          ],
        });
      }

      console.log("Cleaning up temporary files...");
      for (const csvFile of splitFiles) {
        if (fs.existsSync(csvFile)) {
          fs.unlinkSync(csvFile);
          console.log(`Deleted CSV file: ${csvFile}`);
        }
      }
      for (const zipFile of zipFiles) {
        if (fs.existsSync(zipFile)) {
          fs.unlinkSync(zipFile);
          console.log(`Deleted ZIP file: ${zipFile}`);
        }
      }

      await Order.findByIdAndUpdate(order._id, { status: "completed" });
      console.log("Background task completed for order:", order._id);
    }
  } catch (error) {
    console.error("Error in background task for order:", order._id, error.message);
    await Order.findByIdAndUpdate(order._id, { status: "failed", error: error.message });

    if (order.paymentDetails?.paymentIntentId) {
      try {
        console.log("Initiating refund for PaymentIntent:", order.paymentDetails.paymentIntentId);
        await stripe.refunds.create({
          payment_intent: order.paymentDetails.paymentIntentId,
        });
        console.log("Refund initiated successfully");
      } catch (refundError) {
        console.error("Error initiating refund:", refundError.message);
      }
    }

    const emailSubject = "Order Failed - Refund Initiated";
    const emailText = `Dear ${order.userName || "Customer"},\n\nWe regret to inform you that your order (ID: ${order._id}) has failed due to the following reason:\n\n${error.message}\n\nTotal Companies: ${totalCount}\nTotal Price: $${price}\nSelected Add-Ons: ${selectedAddons.join(", ") || "None"}\n\nA refund has been initiated, and the amount will be credited back to your account shortly. If you have any questions, please contact support.\n\nBest regards,\nYour Team`;
    await sendEmail({
      to: order.email,
      subject: emailSubject,
      text: emailText,
    });

    console.log("Failure email sent to:", order.email);
  }
};

// Handle payment submission
router.post("/submit", authenticateToken, async (req, res) => {
  try {
    console.log("Received /api/payment/submit request:", req.body);
    const { filters, totalCount, price, paymentIntentId, selectedAddons = [] } = req.body;

    if (!totalCount || !price || !paymentIntentId) {
      console.log("Missing required fields:", { totalCount, price, paymentIntentId });
      return res.status(400).json({ message: "totalCount, price, and paymentIntentId are required" });
    }

    const threshold = 100000;
    const rateFirstTier = 0.01;
    const rateSecondTier = 0.005;
    const addonRate = 0.01;

    let expectedBasePrice;
    if (totalCount <= threshold) {
      expectedBasePrice = totalCount * rateFirstTier;
    } else {
      const firstTierCost = threshold * rateFirstTier;
      const secondTierCount = totalCount - threshold;
      const secondTierCost = secondTierCount * rateSecondTier;
      expectedBasePrice = firstTierCost + secondTierCost;
    }

    const expectedAddonCost = totalCount * addonRate * selectedAddons.length;
    const expectedPrice = parseFloat((expectedBasePrice + expectedAddonCost).toFixed(2));
    const receivedPrice = parseFloat(price);
    if (Math.abs(expectedPrice - receivedPrice) > 0.01) {
      console.log("Price mismatch:", { expectedPrice, receivedPrice });
      return res.status(400).json({ message: "Invalid price: does not match expected calculation" });
    }

    console.log("Retrieving PaymentIntent:", paymentIntentId);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      console.log("PaymentIntent not successful:", paymentIntent.status);
      return res.status(400).json({ message: "Payment not successful" });
    }

    console.log("Fetching user with ID:", req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log("User not found for ID:", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }
    console.log("User found:", user.email);

    const defaultFilters = {
      categories: [],
      subcategories: [],
      subSubcategories: [],
      country: null,
      state: null,
      city: null,
    };
    const validatedFilters = { ...defaultFilters, ...(filters || {}) };

    const order = new Order({
      userId: req.user.id,
      email: user.email,
      userName: user.name,
      filters: validatedFilters,
      totalCount,
      addOns: selectedAddons || [],
      price,
      paymentMethod: "stripe",
      paymentDetails: {
        paymentIntentId,
      },
      selectedAddons,
      status: "processing",
    });

    await order.save();
    console.log("Order saved:", order._id);

    // Schedule the background task
    setImmediate(() => {
      processPaymentInBackground(order, validatedFilters, totalCount, price, selectedAddons).catch(err => {
        console.error("Uncaught error in background task for order:", order._id, err.message);
        Order.findByIdAndUpdate(order._id, {
          status: "failed",
          error: `Uncaught error in background task: ${err.message}`,
        }).catch(updateErr => {
          console.error("Failed to update order status after uncaught error:", updateErr.message);
        });
      });
    });

    // Adjust the response message based on whether add-ons are selected
    const deliveryDays = selectedAddons.length > 0 ? Math.ceil(totalCount / 1000) : 0;
    const responseMessage = selectedAddons.length > 0
      ? `Payment successful, you will receive a confirmation email shortly. Your data will be delivered within ${deliveryDays} days.`
      : "Payment successful, the CSV file(s) will be sent to your email shortly.";
    res.status(200).json({ message: responseMessage });
  } catch (error) {
    console.error("Error processing payment submission:", error.message);
    res.status(500).json({ message: "Failed to process payment submission", error: error.message });
  }
});

// Fetch user's order history
router.get("/my-orders", authenticateToken, async (req, res) => {
  try {
    console.log("Fetching orders for user:", req.user.id);
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    console.log(`Found ${orders.length} orders`);
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
});

router.get("/orders", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    console.log("Fetching all orders for admin:", req.user.id);
    const orders = await Order.find().sort({ createdAt: -1 }); // Fetch all orders, sorted by creation date
    console.log(`Found ${orders.length} orders`);
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error.message);
    res.status(500).json({ message: "Failed to fetch orders", error: error.message });
  }
});

// Add this near the other router.get endpoints in paymentRoutes.js
router.get("/orders/:orderId", authenticateToken, checkAdminRole, async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log("Fetching order with ID:", orderId);
    const order = await Order.findById(orderId).populate("filters");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    console.log("Order fetched:", order);
    res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching order:", error.message);
    res.status(500).json({ message: "Failed to fetch order", error: error.message });
  }
});

export default router;