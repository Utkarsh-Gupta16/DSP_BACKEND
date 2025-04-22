import express from "express";
import mongoose from "mongoose";
import validator from "validator";
import sendEmail from "../utils/sendEmail.js";
import { authenticateToken, checkAdminRole } from "../middleware/authMiddleware.js";
import { Company } from "../models/companyModel.js";
import CompanyDetails from "../models/companyDetailsModel.js";
import { Order } from "../models/orderModel.js";

const router = express.Router();

// Endpoint to generate CSV and send email
router.post("/send-order-email", authenticateToken, checkAdminRole, async (req, res) => {
  const { orderId, email, userName, totalCount, approvedCount, addOns } = req.body;

  // Validation (unchanged)
  if (
    orderId === undefined ||
    email === undefined ||
    userName === undefined ||
    totalCount === undefined ||
    approvedCount === undefined ||
    addOns === undefined
  ) {
    return res.status(400).json({
      message: "Missing required fields: orderId, email, userName, totalCount, approvedCount, and addOns are required",
    });
  }

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: "Invalid orderId format" });
  }

  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  if (typeof userName !== "string" || userName.trim().length === 0) {
    return res.status(400).json({ message: "Invalid userName format" });
  }

  if (!Number.isInteger(totalCount) || totalCount < 0) {
    return res.status(400).json({ message: "totalCount must be a non-negative integer" });
  }
  if (!Number.isInteger(approvedCount) || approvedCount < 0) {
    return res.status(400).json({ message: "approvedCount must be a non-negative integer" });
  }

  if (!Array.isArray(addOns)) {
    return res.status(400).json({ message: "addOns must be an array" });
  }
  const validAddOnKeys = new Set(Object.keys(allAddOnFields));
  for (const addOn of addOns) {
    if (typeof addOn !== "string" || !validAddOnKeys.has(addOn)) {
      return res.status(400).json({ message: `Invalid addOn: ${addOn}` });
    }
  }

  try {
    console.log("✔ Preparing CSV and email for:", { orderId, email, userName, totalCount, approvedCount, addOns });

    // Fetch the order to validate existence
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Fetch all approved company details for the given orderId
    const approvedCompanyDetails = await CompanyDetails.find({ orderId, status: "approved" }).lean();
    console.log("✔ Fetched approvedCompanyDetails:", approvedCompanyDetails.map(d => ({ _id: d._id, companyId: d.companyId })));

    if (approvedCompanyDetails.length === 0) {
      return res.status(404).json({ message: "No approved company details found for this order" });
    }

    // Extract companyIds as strings to match the companies collection
    const companyIds = approvedCompanyDetails.map(detail => detail.companyId.toString());
    console.log("✔ Extracted companyIds (as strings):", companyIds);

    // Use raw MongoDB query to fetch companies with _id as string
    const companies = await mongoose.connection.db.collection("companies").find({ _id: { $in: companyIds } }).toArray();
    console.log("✔ Fetched companies raw data:", companies.map(c => ({ _id: c._id, businessName: c["Business Name"] || c.businessName })));

    if (companies.length === 0) {
      return res.status(404).json({ message: "No companies found matching the approved company details. Check database consistency." });
    }

    // Enrich companies with details from CompanyDetails
    const enrichedCompanies = companies.map(company => {
      const detail = approvedCompanyDetails.find(d => d.companyId.toString() === company._id.toString());
      return {
        ...company,
        ...detail?.formData,
        "Business Name": company["Business Name"] || company.businessName || "Unknown",
        Country: company.Country || "Unknown",
        State: company.State || "Unknown",
        City: company.City || "Unknown",
        Address: company.Address || "Unknown",
        Phone: company.Phone || "Unknown",
        category: company.category || company.Categories || "Unknown",
        subcategory: company.subcategory || "Unknown",
        Categories: company.Categories || "Unknown",
        Timezone: company.Timezone || "UTC",
      };
    });
    console.log("✔ Enriched companies count:", enrichedCompanies.length);

    // Generate CSV content
    const csvContent = generateCSV(enrichedCompanies, totalCount, addOns);
    console.log("✔ Generated CSV content preview:", csvContent.substring(0, 200));

    const attachment = [
      {
        filename: `order_${orderId}_data.csv`,
        content: Buffer.from(csvContent, "utf-8"),
      },
    ];

    // Email content
    const subject = "Your Order Data - Ready for Delivery";
    const text = `
Dear ${userName || order.userName},

Your order (ID: ${orderId}) with ${totalCount} companies is ready.
- Total Companies: ${totalCount}
- Approved Companies: ${approvedCount}
- Attached is the CSV file containing the company data.

Best regards,
DataSellingProject Team
    `;

    // Send email
    await sendEmail({
      to: email,
      subject,
      text,
      attachments: attachment,
    });

    console.log(`✔ Email sent to ${email}`);
    res.status(200).json({ message: "Email with CSV sent successfully" });

  } catch (error) {
    console.error("❌ Error in send-order-email endpoint:", error.message, error.stack);
    res.status(500).json({ message: "Failed to send email", error: error.message });
  }
});

// CSV Generator with base fields and order-specific add-ons
const allAddOnFields = {
  website: "website",
  mailIds: "mailIds",
  linkedinProfile: "linkedinProfile",
  headquarterAddress: "headquarterAddress",
  foundationYear: "foundationYear",
  presentInCountries: "presentInCountries",
  locationOfEachCountryOffice: "locationOfEachCountryOffice",
  businessDevelopmentManager: "businessDevelopmentManager",
  cco: "cco",
  cdo: "cdo",
  ceo: "ceo",
  cfo: "cfo",
  chro: "chro",
  cio: "cio",
  ciso: "ciso",
  cmo: "cmo",
  coFounder: "coFounder",
  coo: "coo",
  cpo: "cpo",
  cro: "cro",
  cso: "cso",
  cto: "cto",
  customerSuccessManager: "customerSuccessManager",
  cxo: "cxo",
  cybersecurityDirector: "cybersecurityDirector",
  cybersecurityManager: "cybersecurityManager",
  devOpsManager: "devOpsManager",
  directorOfBusinessDevelopment: "directorOfBusinessDevelopment",
  directorOfDigitalMarketing: "directorOfDigitalMarketing",
  directorOfFinance: "directorOfFinance",
  directorOfHr: "directorOfHr",
  directorOfIt: "directorOfIt",
  directorOfMarketing: "directorOfMarketing",
  directorOfOperations: "directorOfOperations",
  directorOfProcurement: "directorOfProcurement",
  directorOfProductManagement: "directorOfProductManagement",
  directorOfSales: "directorOfSales",
  directorOfStrategy: "directorOfStrategy",
  directorOfSupplyChain: "directorOfSupplyChain",
  directorOfTalentAcquisition: "directorOfTalentAcquisition",
  ecommerceDirector: "ecommerceDirector",
  ecommerceManager: "ecommerceManager",
  evp: "evp",
  financeAccounting: "financeAccounting",
  financeDirector: "financeDirector",
  financialController: "financialController",
  founder: "founder",
  founderCoFounder: "founderCoFounder",
  gm: "gm",
  headOfBusinessDevelopment: "headOfBusinessDevelopment",
  headOfCloudInfrastructure: "headOfCloudInfrastructure",
  headOfCustomerSuccess: "headOfCustomerSuccess",
  headOfDigitalTransformation: "headOfDigitalTransformation",
  headOfGrowthStrategy: "headOfGrowthStrategy",
  headOfHr: "headOfHr",
  headOfIt: "headOfIt",
  headOfItInfrastructure: "headOfItInfrastructure",
  headOfManufacturing: "headOfManufacturing",
  headOfMarketing: "headOfMarketing",
  headOfMarketplaceManagement: "headOfMarketplaceManagement",
  headOfPartnerships: "headOfPartnerships",
  headOfPerformanceMarketing: "headOfPerformanceMarketing",
  headOfPropertyManagement: "headOfPropertyManagement",
  headOfSales: "headOfSales",
  headOfSeoPpcSocialMedia: "headOfSeoPpcSocialMedia",
  headOfSoftwareDevelopment: "headOfSoftwareDevelopment",
  headOfStrategy: "headOfStrategy",
  hrBusinessPartner: "hrBusinessPartner",
  investmentManager: "investmentManager",
  itDirector: "itDirector",
  itManager: "itManager",
  technologyManager: "technologyManager",
  managingBroker: "managingBroker",
  md: "md",
  marketingManager: "marketingManager",
  operationsManager: "operationsManager",
  owner: "owner",
  partner: "partner",
  performanceMarketingManager: "performanceMarketingManager",
  president: "president",
  principal: "principal",
  procurementManager: "procurementManager",
  productManager: "productManager",
  realEstateDeveloper: "realEstateDeveloper",
  riskComplianceOfficer: "riskComplianceOfficer",
  salesManager: "salesManager",
  securityManager: "securityManager",
  seniorBusinessDevelopmentManager: "seniorBusinessDevelopmentManager",
  seniorItManager: "seniorItManager",
  seniorMarketingManager: "seniorMarketingManager",
  seniorProcurementManager: "seniorProcurementManager",
  seniorVicePresident: "seniorVicePresident",
  supplyChainManager: "supplyChainManager",
  vpBusinessDevelopment: "vpBusinessDevelopment",
  vpCustomerSuccess: "vpCustomerSuccess",
  vpEngineering: "vpEngineering",
  vpFinance: "vpFinance",
  vpIt: "vpIt",
  vpMarketing: "vpMarketing",
  vpOperations: "vpOperations",
  vpSales: "vpSales",
  vpStrategy: "vpStrategy",
  vpTechnology: "vpTechnology",
  vpHr: "vpHr",
  vpProduct: "vpProduct",
};

const generateCSV = (companies, totalCount, addOns) => {
  // Define base fields
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

  // Filter add-on fields based on what was selected in the order
  const selectedAddOnFields = addOns
    .map(addOn => (allAddOnFields[addOn] ? { label: addOn, value: allAddOnFields[addOn] } : null))
    .filter(field => field);

  // Combine base fields and selected add-ons
  const allFields = [...baseFields, ...selectedAddOnFields];

  // Generate CSV header
  const header = allFields.map(field => field.label).join(",") + "\n";

  // Generate CSV rows
  const rows = companies.map(company => {
    return allFields
      .map(field => {
        const fieldValue = company[field.value];
        let formattedValue;

        if (fieldValue === undefined || fieldValue === null) {
          formattedValue = '"not present"';
        } else if (Array.isArray(fieldValue)) {
          formattedValue = `"${fieldValue.join(";")}"`;
        } else {
          formattedValue = `"${fieldValue}"`;
        }

        return formattedValue;
      })
      .join(",");
  }).join("\n");

  return header + rows;
};

export default router;
