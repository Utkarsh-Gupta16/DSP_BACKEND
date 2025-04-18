// src/routes/adminEmailRoutes.js
import express from "express";
import sendEmail from "../utils/sendEmail.js";
import { authenticateToken, checkAdminRole } from "../middleware/authMiddleware.js";
import { Company } from "../models/companyModel.js"; // Changed from `import Company from`
import CompanyDetails from "../models/companyDetailsModel.js"; // Changed from `import {CompanyDetails} from`
import {Order} from "../models/orderModel.js";

const router = express.Router();

// [Rest of the code remains the same...]

// Endpoint to generate CSV and send email
router.post("/send-order-email", authenticateToken, checkAdminRole, async (req, res) => {
  const { orderId, email, userName, totalCount, approvedCount, addOns } = req.body;

  // Safer validation: check explicitly for undefined
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

  try {
    console.log("✔ Preparing CSV and email for:", { orderId, email, userName, totalCount, approvedCount, addOns });

    // Fetch the order to validate existence and get userName if not in body
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Fetch approved company details for the given orderId
    const approvedCompanyDetails = await CompanyDetails.find({ orderId, status: "approved" }).limit(totalCount);
    const companyIds = approvedCompanyDetails.map(detail => detail.companyId);

    // Fetch corresponding companies
    const companies = await Company.find({ _id: { $in: companyIds } });

    // Map company data with details
    const enrichedCompanies = companies.map(company => {
      const detail = approvedCompanyDetails.find(d => d.companyId.equals(company._id));
      return { ...company.toObject(), ...detail?.formData };
    });

    // Generate CSV content with base fields and order-specific add-ons
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

    console.log(`✔ Email sent to ${email}`);
    res.status(200).json({ message: "Email with CSV sent successfully" });

  } catch (error) {
    console.error("❌ Error in send-order-email endpoint:", error.message);
    res.status(500).json({ message: "Failed to send email", error: error.message });
  }
});

// CSV Generator with base fields and order-specific add-ons
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

  // Define possible add-on fields from companyDetails.formData
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

  // Filter add-on fields based on what was selected in the order
  const selectedAddOnFields = addOns
    .map(addOn => allAddOnFields[addOn] ? { label: addOn, value: allAddOnFields[addOn] } : null)
    .filter(field => field);

  // Combine base fields and selected add-ons
  const allFields = [...baseFields, ...selectedAddOnFields];

  // Generate CSV header
  const header = allFields.map(field => field.label).join(",") + "\n";

  // Generate CSV rows
  const rows = companies.map(company => {
    return allFields.map(field => {
      const value = company[field.value] !== undefined && company[field.value] !== null
        ? Array.isArray(company[field.value])
          ? `"${company[field.value].join(";")}"` // Handle arrays (e.g., mailIds)
          : `"${company[field.value]}"`
        : '"not present"';
      return value;
    }).join(",");
  }).join("\n");

  return header + rows;
};

export default router;