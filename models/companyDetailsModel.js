import mongoose from "mongoose";

// Define the schema for decision makers
const decisionMakerSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  email: { type: String, default: "" }, // Single email field after transformation
  phoneNumber: { type: String, default: "" }, // Single phone number field after transformation
  linkedinProfile: { type: String, default: "" },
});

// Define the schema for employee growth
const employeeGrowthSchema = new mongoose.Schema({
  period: {
    type: String,
    enum: ["employeeGrowth6Months", "employeeGrowth1Year", "employeeGrowth2Years"],
    required: true,
  },
  value: { type: String, default: "" },
});

const companyDetailsSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  formData: {
    // General fields as arrays of strings
    website: { type: [String], default: [] },
    mailIds: { type: [String], default: [] },
    linkedinProfile: { type: [String], default: [] },
    headquarterAddress: { type: [String], default: [] },
    foundationYear: { type: [String], default: [] },
    presentInCountries: { type: [String], default: [] },
    locationOfEachCountryOffice: { type: [String], default: [] },
    contactNumber: { type: [String], default: [] },
    companySize: {
      type: String,
      enum: [
        "",
        "2-10",
        "11-50",
        "50-200",
        "200-500",
        "500-1000",
        "1000-5000",
        "5000-10000",
        "10000+",
      ],
      default: "",
    },
    revenue: { type: [String], default: [] },
    currentActiveMembers: { type: [String], default: [] },
    employeeGrowth: { type: employeeGrowthSchema, default: () => ({}) }, // New field for employee growth
    subsidiaries: { type: [String], default: [] },
    // Decision makers
    businessDevelopmentManager: { type: [decisionMakerSchema], default: [] },
    cco: { type: [decisionMakerSchema], default: [] },
    cdo: { type: [decisionMakerSchema], default: [] },
    ceo: { type: [decisionMakerSchema], default: [] },
    cfo: { type: [decisionMakerSchema], default: [] },
    chro: { type: [decisionMakerSchema], default: [] },
    cio: { type: [decisionMakerSchema], default: [] },
    ciso: { type: [decisionMakerSchema], default: [] },
    cmo: { type: [decisionMakerSchema], default: [] },
    coFounder: { type: [decisionMakerSchema], default: [] },
    coo: { type: [decisionMakerSchema], default: [] },
    cpo: { type: [decisionMakerSchema], default: [] },
    cro: { type: [decisionMakerSchema], default: [] },
    cso: { type: [decisionMakerSchema], default: [] },
    cto: { type: [decisionMakerSchema], default: [] },
    customerSuccessManager: { type: [decisionMakerSchema], default: [] },
    cxo: { type: [decisionMakerSchema], default: [] },
    cybersecurityDirector: { type: [decisionMakerSchema], default: [] },
    cybersecurityManager: { type: [decisionMakerSchema], default: [] },
    devOpsManager: { type: [decisionMakerSchema], default: [] },
    directorOfBusinessDevelopment: { type: [decisionMakerSchema], default: [] },
    directorOfDigitalMarketing: { type: [decisionMakerSchema], default: [] },
    directorOfFinance: { type: [decisionMakerSchema], default: [] },
    directorOfHr: { type: [decisionMakerSchema], default: [] },
    directorOfIt: { type: [decisionMakerSchema], default: [] },
    directorOfMarketing: { type: [decisionMakerSchema], default: [] },
    directorOfOperations: { type: [decisionMakerSchema], default: [] },
    directorOfProcurement: { type: [decisionMakerSchema], default: [] },
    directorOfProductManagement: { type: [decisionMakerSchema], default: [] },
    directorOfSales: { type: [decisionMakerSchema], default: [] },
    directorOfStrategy: { type: [decisionMakerSchema], default: [] },
    directorOfSupplyChain: { type: [decisionMakerSchema], default: [] },
    directorOfTalentAcquisition: { type: [decisionMakerSchema], default: [] },
    ecommerceDirector: { type: [decisionMakerSchema], default: [] },
    ecommerceManager: { type: [decisionMakerSchema], default: [] },
    evp: { type: [decisionMakerSchema], default: [] },
    financeAccounting: { type: [decisionMakerSchema], default: [] },
    financeDirector: { type: [decisionMakerSchema], default: [] },
    financialController: { type: [decisionMakerSchema], default: [] },
    founder: { type: [decisionMakerSchema], default: [] },
    founderCoFounder: { type: [decisionMakerSchema], default: [] },
    gm: { type: [decisionMakerSchema], default: [] },
    headOfBusinessDevelopment: { type: [decisionMakerSchema], default: [] },
    headOfCloudInfrastructure: { type: [decisionMakerSchema], default: [] },
    headOfCustomerSuccess: { type: [decisionMakerSchema], default: [] },
    headOfDigitalTransformation: { type: [decisionMakerSchema], default: [] },
    headOfGrowthStrategy: { type: [decisionMakerSchema], default: [] },
    headOfHr: { type: [decisionMakerSchema], default: [] },
    headOfIt: { type: [decisionMakerSchema], default: [] },
    headOfItInfrastructure: { type: [decisionMakerSchema], default: [] },
    headOfManufacturing: { type: [decisionMakerSchema], default: [] },
    headOfMarketing: { type: [decisionMakerSchema], default: [] },
    headOfMarketplaceManagement: { type: [decisionMakerSchema], default: [] },
    headOfPartnerships: { type: [decisionMakerSchema], default: [] },
    headOfPerformanceMarketing: { type: [decisionMakerSchema], default: [] },
    headOfPropertyManagement: { type: [decisionMakerSchema], default: [] },
    headOfSales: { type: [decisionMakerSchema], default: [] },
    headOfSeoPpcSocialMedia: { type: [decisionMakerSchema], default: [] },
    headOfSoftwareDevelopment: { type: [decisionMakerSchema], default: [] },
    headOfStrategy: { type: [decisionMakerSchema], default: [] },
    hrBusinessPartner: { type: [decisionMakerSchema], default: [] },
    investmentManager: { type: [decisionMakerSchema], default: [] },
    itDirector: { type: [decisionMakerSchema], default: [] },
    itManager: { type: [decisionMakerSchema], default: [] },
    technologyManager: { type: [decisionMakerSchema], default: [] },
    managingBroker: { type: [decisionMakerSchema], default: [] },
    md: { type: [decisionMakerSchema], default: [] },
    marketingManager: { type: [decisionMakerSchema], default: [] },
    operationsManager: { type: [decisionMakerSchema], default: [] },
    owner: { type: [decisionMakerSchema], default: [] },
    partner: { type: [decisionMakerSchema], default: [] },
    performanceMarketingManager: { type: [decisionMakerSchema], default: [] },
    president: { type: [decisionMakerSchema], default: [] },
    principal: { type: [decisionMakerSchema], default: [] },
    procurementManager: { type: [decisionMakerSchema], default: [] },
    productManager: { type: [decisionMakerSchema], default: [] },
    realEstateDeveloper: { type: [decisionMakerSchema], default: [] },
    riskComplianceOfficer: { type: [decisionMakerSchema], default: [] },
    salesManager: { type: [decisionMakerSchema], default: [] },
    securityManager: { type: [decisionMakerSchema], default: [] },
    seniorBusinessDevelopmentManager: { type: [decisionMakerSchema], default: [] },
    seniorItManager: { type: [decisionMakerSchema], default: [] },
    seniorMarketingManager: { type: [decisionMakerSchema], default: [] },
    seniorProcurementManager: { type: [decisionMakerSchema], default: [] },
    seniorVicePresident: { type: [decisionMakerSchema], default: [] },
    supplyChainManager: { type: [decisionMakerSchema], default: [] },
    vpBusinessDevelopment: { type: [decisionMakerSchema], default: [] },
    vpCustomerSuccess: { type: [decisionMakerSchema], default: [] },
    vpEngineering: { type: [decisionMakerSchema], default: [] },
    vpFinance: { type: [decisionMakerSchema], default: [] },
    vpIt: { type: [decisionMakerSchema], default: [] },
    vpMarketing: { type: [decisionMakerSchema], default: [] },
    vpOperations: { type: [decisionMakerSchema], default: [] },
    vpSales: { type: [decisionMakerSchema], default: [] },
    vpStrategy: { type: [decisionMakerSchema], default: [] },
    vpTechnology: { type: [decisionMakerSchema], default: [] },
    vpHr: { type: [decisionMakerSchema], default: [] },
    vpProduct: { type: [decisionMakerSchema], default: [] },
    additionalProperties: {
      type: Map,
      of: [decisionMakerSchema],
      default: {},
    },
  },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "stale"],
    default: "pending",
  },
  submittedDate: {
    type: Date,
    default: Date.now,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  approvedAt: {
    type: Date,
  },
  returnToEmployee: { type: Boolean, default: false },
  pendingRefill: { type: Boolean, default: false },
  lastRefreshed: {
    type: Date,
    default: Date.now,
  },
});

// Add TTL index for 90 days after approvedAt
companyDetailsSchema.index({ approvedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Middleware to handle dynamic decision maker fields
companyDetailsSchema.pre("validate", function (next) {
  const formData = this.formData || {};
  const additionalProperties = new Map();

  // List of predefined decision maker fields
  const predefinedFields = [
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
  ];

  // General fields that should remain in formData
  const generalFields = [
    "website", "mailIds", "linkedinProfile", "headquarterAddress",
    "foundationYear", "presentInCountries", "locationOfEachCountryOffice",
    "companySize", "revenue", "currentActiveMembers", "contactNumber",
    "employeeGrowth", "subsidiaries",
  ];

  // Move non-predefined decision maker fields to additionalProperties
  for (const key of Object.keys(formData)) {
    if (!predefinedFields.includes(key) && !generalFields.includes(key)) {
      additionalProperties.set(key, formData[key] || []);
      delete formData[key];
    }
  }

  this.formData.additionalProperties = additionalProperties;
  next();
});

const CompanyDetails = mongoose.model("CompanyDetails", companyDetailsSchema);

export default CompanyDetails;