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

  // Validation
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
    // Fetch the order to validate existence
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Fetch all approved company details for the given orderId
    const approvedCompanyDetails = await CompanyDetails.find({ orderId, status: "approved" }).lean();
    if (approvedCompanyDetails.length === 0) {
      return res.status(404).json({ message: "No approved company details found for this order" });
    }

    // Extract companyIds as ObjectIds
    const companyIds = approvedCompanyDetails.map(detail => detail.companyId);
    if (companyIds.length === 0) {
      return res.status(404).json({ message: "No company IDs found in approved company details." });
    }

    // Fetch companies using Mongoose
    const companies = await Company.find({ _id: { $in: companyIds } }).lean();
    if (companies.length === 0) {
      console.error("No companies found for companyIds:", companyIds);
      return res.status(404).json({ message: "No companies found matching the approved company details. Check database consistency." });
    }

    // Enrich companies with details from CompanyDetails and process decision maker fields
    const enrichedCompanies = companies.map(company => {
      const detail = approvedCompanyDetails.find(d => d.companyId.toString() === company._id.toString());
      const formData = detail?.formData || {};
      const processedData = {
        ...company,
        ...formData,
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

      // Process predefined decision maker fields (assuming array format)
      Object.keys(allAddOnFields).forEach(field => {
        if (
          processedData[field] &&
          Array.isArray(processedData[field]) &&
          processedData[field].length > 0 &&
          typeof processedData[field][0] === 'object'
        ) {
          processedData[field] = formatDecisionMaker(processedData[field][0]);
        }
      });

      // Process custom decision maker roles from additionalProperties
      if (formData.additionalProperties) {
        Object.entries(formData.additionalProperties).forEach(([key, value]) => {
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
            processedData[key] = formatDecisionMaker(value[0]);
          }
        });
      }

      return processedData;
    });

    // Generate CSV content
    const csvContent = generateCSV(enrichedCompanies, totalCount, addOns);

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

    res.status(200).json({ message: "Email with CSV sent successfully" });
  } catch (error) {
    console.error("Error sending order email:", error.message, error.stack);
    res.status(500).json({ message: "Failed to send email", error: error.message });
  }
});

// CSV Generator with base fields and order-specific add-ons
const allAddOnFields = {
  website: "Website",
  mailIds: "Mail IDs",
  linkedinProfile: "LinkedIn Profile",
  headquarterAddress: "Headquarter Address",
  foundationYear: "Foundation Year",
  presentInCountries: "Present in Countries",
  locationOfEachCountryOffice: "Location of Each Country Office",
  businessDevelopmentManager: "Business Development Manager",
  cco: "CCO",
  cdo: "CDO",
  ceo: "CEO",
  cfo: "CFO",
  chro: "CHRO",
  cio: "CIO",
  ciso: "CISO",
  cmo: "CMO",
  coFounder: "Co-Founder",
  coo: "COO",
  cpo: "CPO",
  cro: "CRO",
  cso: "CSO",
  cto: "CTO",
  customerSuccessManager: "Customer Success Manager",
  cxo: "CXO",
  cybersecurityDirector: "Cybersecurity Director",
  cybersecurityManager: "Cybersecurity Manager",
  devOpsManager: "DevOps Manager",
  directorOfBusinessDevelopment: "Director of Business Development",
  directorOfDigitalMarketing: "Director of Digital Marketing",
  directorOfFinance: "Director of Finance",
  directorOfHr: "Director of HR",
  directorOfIt: "Director of IT",
  directorOfMarketing: "Director of Marketing",
  directorOfOperations: "Director of Operations",
  directorOfProcurement: "Director of Procurement",
  directorOfProductManagement: "Director of Product Management",
  directorOfSales: "Director of Sales",
  directorOfStrategy: "Director of Strategy",
  directorOfSupplyChain: "Director of Supply Chain",
  directorOfTalentAcquisition: "Director of Talent Acquisition",
  ecommerceDirector: "Ecommerce Director",
  ecommerceManager: "Ecommerce Manager",
  evp: "EVP",
  financeAccounting: "Finance Accounting",
  financeDirector: "Finance Director",
  financialController: "Financial Controller",
  founder: "Founder",
  founderCoFounder: "Founder/Co-Founder",
  gm: "GM",
  headOfBusinessDevelopment: "Head of Business Development",
  headOfCloudInfrastructure: "Head of Cloud Infrastructure",
  headOfCustomerSuccess: "Head of Customer Success",
  headOfDigitalTransformation: "Head of Digital Transformation",
  headOfGrowthStrategy: "Head of Growth Strategy",
  headOfHr: "Head of HR",
  headOfIt: "Head of IT",
  headOfItInfrastructure: "Head of IT Infrastructure",
  headOfManufacturing: "Head of Manufacturing",
  headOfMarketing: "Head of Marketing",
  headOfMarketplaceManagement: "Head of Marketplace Management",
  headOfPartnerships: "Head of Partnerships",
  headOfPerformanceMarketing: "Head of Performance Marketing",
  headOfPropertyManagement: "Head of Property Management",
  headOfSales: "Head of Sales",
  headOfSeoPpcSocialMedia: "Head of SEO/PPC/Social Media",
  headOfSoftwareDevelopment: "Head of Software Development",
  headOfStrategy: "Head of Strategy",
  hrBusinessPartner: "HR Business Partner",
  investmentManager: "Investment Manager",
  itDirector: "IT Director",
  itManager: "IT Manager",
  technologyManager: "Technology Manager",
  managingBroker: "Managing Broker",
  md: "MD",
  marketingManager: "Marketing Manager",
  operationsManager: "Operations Manager",
  owner: "Owner",
  partner: "Partner",
  performanceMarketingManager: "Performance Marketing Manager",
  president: "President",
  principal: "Principal",
  procurementManager: "Procurement Manager",
  productManager: "Product Manager",
  realEstateDeveloper: "Real Estate Developer",
  riskComplianceOfficer: "Risk Compliance Officer",
  salesManager: "Sales Manager",
  securityManager: "Security Manager",
  seniorBusinessDevelopmentManager: "Senior Business Development Manager",
  seniorItManager: "Senior IT Manager",
  seniorMarketingManager: "Senior Marketing Manager",
  seniorProcurementManager: "Senior Procurement Manager",
  seniorVicePresident: "Senior Vice President",
  supplyChainManager: "Supply Chain Manager",
  vpBusinessDevelopment: "VP Business Development",
  vpCustomerSuccess: "VP Customer Success",
  vpEngineering: "VP Engineering",
  vpFinance: "VP Finance",
  vpIt: "VP IT",
  vpMarketing: "VP Marketing",
  vpOperations: "VP Operations",
  vpSales: "VP Sales",
  vpStrategy: "VP Strategy",
  vpTechnology: "VP Technology",
  vpHr: "VP HR",
  vpProduct: "VP Product",
};

// Define decision maker fields to identify them
const decisionMakerFields = new Set([
  "businessDevelopmentManager", "cco", "cdo", "ceo", "cfo", "chro", "cio", "ciso", "cmo",
  "coFounder", "coo", "cpo", "cro", "cso", "cto", "customerSuccessManager", "cxo",
  "cybersecurityDirector", "cybersecurityManager", "devOpsManager", "directorOfBusinessDevelopment",
  "directorOfDigitalMarketing", "directorOfFinance", "directorOfHr", "directorOfIt",
  "directorOfMarketing", "directorOfOperations", "directorOfProcurement", "directorOfProductManagement",
  "directorOfSales", "directorOfStrategy", "directorOfSupplyChain", "directorOfTalentAcquisition",
  "ecommerceDirector", "ecommerceManager", "evp", "financeAccounting", "financeDirector",
  "financialController", "founder", "founderCoFounder", "gm", "headOfBusinessDevelopment",
  "headOfCloudInfrastructure", "headOfCustomerSuccess", "headOfDigitalTransformation",
  "headOfGrowthStrategy", "headOfHr", "headOfIt", "headOfItInfrastructure", "headOfManufacturing",
  "headOfMarketing", "headOfMarketplaceManagement", "headOfPartnerships", "headOfPerformanceMarketing",
  "headOfPropertyManagement", "headOfSales", "headOfSeoPpcSocialMedia", "headOfSoftwareDevelopment",
  "headOfStrategy", "hrBusinessPartner", "investmentManager", "itDirector", "itManager",
  "technologyManager", "managingBroker", "md", "marketingManager", "operationsManager", "owner",
  "partner", "performanceMarketingManager", "president", "principal", "procurementManager",
  "productManager", "realEstateDeveloper", "riskComplianceOfficer", "salesManager", "securityManager",
  "seniorBusinessDevelopmentManager", "seniorItManager", "seniorMarketingManager",
  "seniorProcurementManager", "seniorVicePresident", "supplyChainManager", "vpBusinessDevelopment",
  "vpCustomerSuccess", "vpEngineering", "vpFinance", "vpIt", "vpMarketing", "vpOperations",
  "vpSales", "vpStrategy", "vpTechnology", "vpHr", "vpProduct",
]);

// Function to format decision maker object into desired string with beautified labels
const formatDecisionMaker = (decisionMaker) => {
  if (!decisionMaker || Object.keys(decisionMaker).length === 0) {
    return "not present";
  }
  // Only include name, email, phoneNumber, and linkedinProfile if they exist
  const allowedFields = {
    name: "Name",
    email: "Email",
    phoneNumber: "Phone Number",
    linkedinProfile: "LinkedIn Profile"
  };
  const filteredDecisionMaker = {};
  Object.keys(allowedFields).forEach(field => {
    if (decisionMaker[field] !== undefined) {
      filteredDecisionMaker[field] = decisionMaker[field];
    }
  });
  return Object.entries(filteredDecisionMaker)
    .map(([key, value]) => `${allowedFields[key]}: '${value || ''}'`)
    .join(", ");
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
    .map(addOn => {
      if (allAddOnFields[addOn]) {
        return { label: allAddOnFields[addOn], value: addOn };
      }
      return null;
    })
    .filter(field => field);

  // Combine base fields and selected add-ons
  const allFields = [...baseFields, ...selectedAddOnFields];

  // Generate CSV header
  const header = allFields.map(field => field.label).join(",") + "\n";

  // Generate CSV rows
  const rows = companies.map(company => {
    return allFields
      .map(field => {
        let fieldValue = company[field.value];
        let formattedValue;

        if (fieldValue === undefined || fieldValue === null) {
          formattedValue = '"not present"';
        } else if (decisionMakerFields.has(field.value)) {
          formattedValue = `"${fieldValue}"`; // Already formatted by formatDecisionMaker
        } else if (Array.isArray(fieldValue)) {
          formattedValue = `"${fieldValue.join(";")}"`;
        } else {
          formattedValue = `"${fieldValue.toString().replace(/"/g, '""')}"`; // Escape quotes in CSV
        }

        return formattedValue;
      })
      .join(",");
  }).join("\n");

  return header + rows;
};

export default router;