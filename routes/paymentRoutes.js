import express from "express";
import Stripe from "stripe";
import { Order } from "../models/orderModel.js";
import { User } from "../models/userModel.js";
import { Company } from "../models/companyModel.js";
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
    const { totalCount, country } = req.body;
    console.log("Creating PaymentIntent for:", { totalCount, country });

    if (!totalCount || totalCount <= 0) {
      console.log("Invalid totalCount:", totalCount);
      return res.status(400).json({ message: "totalCount must be a positive number" });
    }

    // Calculate price (same logic as in Transaction.jsx)
    const threshold = 100000;
    const rateFirstTier = 0.1;
    const rateSecondTier = 0.05;
    let price;
    if (totalCount <= threshold) {
      price = totalCount * rateFirstTier;
    } else {
      const firstTierCost = threshold * rateFirstTier;
      const secondTierCount = totalCount - threshold;
      const secondTierCost = secondTierCount * rateSecondTier;
      price = firstTierCost + secondTierCost;
    }

    // Convert price to cents (Stripe expects amounts in cents)
    const amountInCents = Math.round(price * 100);
    console.log("Calculated amount in cents:", amountInCents);

    // Validate minimum amount for Stripe
    if (amountInCents < (country === "India" ? 30 : 50)) {
      console.log("Amount too small:", amountInCents);
      return res.status(400).json({ message: "Amount is too small. Minimum is 50 cents for USD or 30 INR for INR." });
    }

    // Determine payment methods based on country
    let paymentMethodTypes = ["card"];
    if (country === "US") {
      paymentMethodTypes.push("us_bank_account");
    } else if (country === "EU") {
      paymentMethodTypes.push("sepa_debit");
    }
    console.log("Payment method types:", paymentMethodTypes);

    // Create a PaymentIntent with the appropriate payment methods
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: country === "India" ? "inr" : "usd",
      payment_method_types: paymentMethodTypes,
      metadata: { userId: req.user.id, totalCount },
    });

    console.log("PaymentIntent created:", paymentIntent.id);
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error("Error creating payment intent:", error.message);
    res.status(500).json({ message: "Failed to create payment intent", error: error.message });
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

// Background task to generate CSV, split, compress, and send emails
const processPaymentInBackground = async (order, filters, totalCount, price) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  try {
    console.log("Starting background task for order:", order._id);

    // Build the query based on selected filters
    const orConditions = [];

    // Add category filter
    if (filters.categories?.length > 0) {
      filters.categories.forEach(cat => {
        orConditions.push({ category: cat.trim() });
      });
    }

    // Add subcategory filter
    if (filters.subcategories?.length > 0) {
      filters.subcategories.forEach(subCat => {
        const [category, subcategory] = subCat.split(":");
        orConditions.push({ category: category.trim(), subcategory: subcategory.trim() });
      });
    }

    // Add sub-subcategory filter (grouped by category and subcategory)
    if (filters.subSubcategories?.length > 0) {
      const groupedSubSubcategories = {};

      // Group sub-subcategories by category and subcategory
      filters.subSubcategories.forEach(subSub => {
        const [category, subcategory, subSubcategory] = subSub.split(":");
        const key = `${category}:${subcategory}`;
        if (!groupedSubSubcategories[key]) {
          groupedSubSubcategories[key] = { category: category.trim(), subcategory: subcategory.trim(), subSubcategories: [] };
        }
        groupedSubSubcategories[key].subSubcategories.push(subSubcategory.trim());
      });

      // Add grouped conditions to orConditions
      Object.values(groupedSubSubcategories).forEach(({ category, subcategory, subSubcategories }) => {
        orConditions.push({ category, subcategory, subSubcategories });
      });
    }

    // Build the match stage
    const matchStage = {};
    if (orConditions.length > 0) {
      matchStage.$or = orConditions.map(condition => {
        const subMatch = {};

        // Handle category
        if (condition.category) {
          subMatch.category = new RegExp(`^${condition.category}$`, "i");
        }

        // Handle subcategory
        if (condition.subcategory) {
          subMatch.subcategory = new RegExp(`^${condition.subcategory}$`, "i");
        }

        // Handle sub-subcategories
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

    // Add location filters with $and
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

    // Validate the count before fetching
    const countResult = await Company.aggregate([
      { $match: matchStage },
      { $group: { _id: "$_id" } },
      { $count: "totalCount" },
    ]);

    const validatedCount = countResult.length > 0 ? countResult[0].totalCount : 0;
    console.log("Validated count:", validatedCount);

    // Check for count mismatch
    if (Math.abs(validatedCount - totalCount) > 100) {
      console.log(`Mismatch between validated count (${validatedCount}) and totalCount (${totalCount})`);
      await Order.findByIdAndUpdate(order._id, {
        status: "failed",
        error: `Mismatch between validated count (${validatedCount}) and expected count (${totalCount}). A refund will be issued.`,
      });

      // Initiate a refund
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

    // Define fields for CSV with renamed headers
    const fields = [
      { label: "Business Name", value: "Business Name" },
      { label: "Country", value: "Country" },
      { label: "State", value: "State" },
      { label: "City", value: "City" },
      { label: "Address", value: "Address" },
      { label: "Phone", value: "Phone" },
      { label: "Category", value: "category" },
      { label: "Subcategory", value: "subcategory" },
      { label: "Sub-Sub Categories", value: "Categories" },
    ];

    const json2csvParser = new Parser({ fields });
    const header = json2csvParser.parse([]).split("\n")[0] + "\n"; // Get the CSV header

    // Stream companies from MongoDB
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

    const maxFileSize = 18 * 1024 * 1024; // 18 MB in bytes
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

    // Verify all CSV files exist before proceeding
    for (const csvFile of splitFiles) {
      if (!fs.existsSync(csvFile)) {
        throw new Error(`CSV file not found: ${csvFile}`);
      }
    }

    // Compress each split file into a ZIP and prepare email attachments
    const zipFiles = [];
    for (let i = 0; i < splitFiles.length; i++) {
      const csvFilePath = splitFiles[i];
      const zipFilePath = path.join(tempDir, `companies_${order._id}_part${i + 1}.zip`);
      const zip = new AdmZip();
      zip.addLocalFile(csvFilePath);
      zip.writeZip(zipFilePath);

      // Check the size of the ZIP file
      const zipStats = fs.statSync(zipFilePath);
      const zipSize = zipStats.size;
      console.log(`ZIP file ${zipFilePath} size: ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);

      if (zipSize > maxFileSize) {
        throw new Error(`ZIP file ${zipFilePath} exceeds 18 MB limit: ${(zipSize / (1024 * 1024)).toFixed(2)} MB`);
      }

      zipFiles.push(zipFilePath);
    }

    // Send an email for each ZIP file
    for (let i = 0; i < zipFiles.length; i++) {
      const zipFilePath = zipFiles[i];
      const partNumber = i + 1;
      const totalParts = zipFiles.length;

      console.log(`Sending email ${partNumber} of ${totalParts} to:`, order.email);
      const emailSubject = `Your Purchased Company Data - Part ${partNumber} of ${totalParts}`;
      const emailText = `Dear ${order.userName || "Customer"},\n\nThank you for your purchase! Your company data has been split into ${totalParts} parts due to email size limits. This email contains Part ${partNumber} of ${totalParts}.\n\nPlease download and unzip the attached file. Once you have all parts, you can combine them into a single CSV file if needed. Instructions:\n1. Download all parts.\n2. Unzip each part to get the CSV files.\n3. Combine the CSV files (excluding headers from parts 2 onward) into a single file.\n\nTotal Companies: ${companyCount}\nTotal Price: $${price}\n\nIf you have any questions, please contact support.\n\nBest regards,\nYour Team`;
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

    // Clean up all temporary files
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
  } catch (error) {
    console.error("Error in background task for order:", order._id, error.message);
    await Order.findByIdAndUpdate(order._id, { status: "failed", error: error.message });

    // Initiate a refund
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
    const emailText = `Dear ${order.userName || "Customer"},\n\nWe regret to inform you that your order (ID: ${order._id}) has failed due to the following reason:\n\n${error.message}\n\nTotal Companies: ${totalCount}\nTotal Price: $${price}\n\nA refund has been initiated, and the amount will be credited back to your account shortly. If you have any questions, please contact support.\n\nBest regards,\nYour Team`;
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
    const { filters, totalCount, price, paymentIntentId } = req.body;

    // Validate required fields
    if (!totalCount || !price || !paymentIntentId) {
      console.log("Missing required fields:", { totalCount, price, paymentIntentId });
      return res.status(400).json({ message: "totalCount, price, and paymentIntentId are required" });
    }

    // Validate price to prevent tampering
    const threshold = 100000;
    const rateFirstTier = 0.01;
    const rateSecondTier = 0.005;
    let expectedPrice;
    if (totalCount <= threshold) {
      expectedPrice = totalCount * rateFirstTier;
    } else {
      const firstTierCost = threshold * rateFirstTier;
      const secondTierCount = totalCount - threshold;
      const secondTierCost = secondTierCount * rateSecondTier;
      expectedPrice = firstTierCost + secondTierCost;
    }
    expectedPrice = parseFloat(expectedPrice.toFixed(2));
    const receivedPrice = parseFloat(price);
    if (Math.abs(expectedPrice - receivedPrice) > 0.01) {
      console.log("Price mismatch:", { expectedPrice, receivedPrice });
      return res.status(400).json({ message: "Invalid price: does not match expected calculation" });
    }

    // Retrieve the PaymentIntent to confirm its status
    console.log("Retrieving PaymentIntent:", paymentIntentId);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      console.log("PaymentIntent not successful:", paymentIntent.status);
      return res.status(400).json({ message: "Payment not successful" });
    }

    // Fetch the user to get their email and name
    console.log("Fetching user with ID:", req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      console.log("User not found for ID:", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }
    console.log("User found:", user.email);

    // Ensure filters has a consistent structure
    const defaultFilters = {
      categories: [],
      subcategories: [],
      subSubcategories: [],
      country: null,
      state: null,
      city: null,
    };
    const validatedFilters = { ...defaultFilters, ...(filters || {}) };

    // Save the order
    const order = new Order({
      userId: req.user.id,
      email: user.email,
      userName: user.name,
      filters: validatedFilters,
      totalCount,
      price,
      paymentMethod: "stripe",
      paymentDetails: {
        paymentIntentId,
      },
      status: "processing",
    });

    await order.save();
    console.log("Order saved:", order._id);

    // Schedule the CSV generation and email sending in the background
    setImmediate(() => {
      processPaymentInBackground(order, validatedFilters, totalCount, price).catch(err => {
        console.error("Uncaught error in background task for order:", order._id, err.message);
        Order.findByIdAndUpdate(order._id, {
          status: "failed",
          error: `Uncaught error in background task: ${err.message}`,
        }).catch(updateErr => {
          console.error("Failed to update order status after uncaught error:", updateErr.message);
        });
      });
    });

    // Return a response immediately
    res.status(200).json({ message: "Payment successful, the CSV file(s) will be sent to your email shortly" });
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

export default router;