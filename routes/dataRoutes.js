import express from "express";
import { Company } from "../models/companyModel.js";

const router = express.Router();

const normalizeCountry = (country) => {
  const countryMap = {
    USA: "United States of America (U.S.A)",
    US: "United States of America (U.S.A)",
    "United States": "United States of America (U.S.A)",
    "United States of America (U.S.A)": "United States of America (U.S.A)",
    CAN: "Canada",
    Canada: "Canada",
  };
  return countryMap[country?.trim()] || country?.trim();
};

const cache = new Map();
const cacheTTL = 15 * 60 * 1000;

const buildMatchStage = ({ or, Country, State, City }) => {
  const matchStage = {};
  const orConditions = JSON.parse(or || "[]");

  if (orConditions.length > 0) {
    matchStage.$or = orConditions.map(condition => {
      const subMatch = {};

      // Handle category
      if (condition.category) {
        subMatch.category = new RegExp(`^${condition.category.trim()}$`, "i");
      }

      // Handle subcategory
      if (condition.subcategory) {
        subMatch.subcategory = new RegExp(`^${condition.subcategory.trim()}$`, "i");
      }

      // Handle sub-subcategories (now an array)
      if (condition.subSubcategories && Array.isArray(condition.subSubcategories)) {
        const trimmedSubSubcategories = condition.subSubcategories.map(subSub => subSub.trim());
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
                  trimmedSubSubcategories,
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
  if (Country) locationConditions.Country = normalizeCountry(Country);
  if (State) locationConditions.State = State.trim();
  if (City) locationConditions.City = City.trim();

  if (Object.keys(locationConditions).length > 0) {
    if (matchStage.$or) {
      matchStage.$and = [{ $or: matchStage.$or }, locationConditions];
      delete matchStage.$or;
    } else {
      Object.assign(matchStage, locationConditions);
    }
  }

  return matchStage;
};

router.route("/count")
  .get(async (req, res) => {
    console.log("Received GET request to /count with query:", req.query);
    try {
      const { or, Country, State, City } = req.query;

      const cacheKey = JSON.stringify({ or, Country, State, City });
      if (cache.has(cacheKey)) {
        const { count, timestamp } = cache.get(cacheKey);
        if (Date.now() - timestamp < cacheTTL) {
          console.log("Returning cached count:", count);
          return res.json({ totalCount: count });
        }
      }

      const matchStage = buildMatchStage({ or, Country, State, City });

      if (Object.keys(matchStage).length === 0) {
        return res.json({ totalCount: 0 });
      }

      const result = await Company.aggregate([
        { $match: matchStage },
        { $group: { _id: "$_id" } },
        { $count: "totalCount" },
      ]);

      const totalCount = result.length > 0 ? result[0].totalCount : 0;
      console.log("Total count retrieved (GET):", totalCount);

      cache.set(cacheKey, { count: totalCount, timestamp: Date.now() });
      res.json({ totalCount });
    } catch (error) {
      console.error("Error in /count (GET):", error.message);
      res.status(500).json({ error: "Failed to fetch count: " + error.message });
    }
  })
  .post(async (req, res) => {
    console.log("Received POST request to /count with body:", req.body);
    try {
      const { or, Country, State, City } = req.body;

      const cacheKey = JSON.stringify({ or, Country, State, City });
      if (cache.has(cacheKey)) {
        const { count, timestamp } = cache.get(cacheKey);
        if (Date.now() - timestamp < cacheTTL) {
          console.log("Returning cached count:", count);
          return res.json({ totalCount: count });
        }
      }

      const matchStage = buildMatchStage({ or, Country, State, City });

      if (Object.keys(matchStage).length === 0) {
        return res.json({ totalCount: 0 });
      }

      const result = await Company.aggregate([
        { $match: matchStage },
        { $group: { _id: "$_id" } },
        { $count: "totalCount" },
      ]);

      const totalCount = result.length > 0 ? result[0].totalCount : 0;
      console.log("Total count retrieved (POST):", totalCount);

      cache.set(cacheKey, { count: totalCount, timestamp: Date.now() });
      res.json({ totalCount });
    } catch (error) {
      console.error("Error in /count (POST):", error.message);
      res.status(500).json({ error: "Failed to fetch count: " + error.message });
    }
  });

router.get("/filters", async (req, res) => {
  console.log("Received GET request to /filters with query:", req.query);
  try {
    const { field, category, subcategory, Country, State, skip = 0, limit = 100 } = req.query;

    const cacheKey = `${field}:${JSON.stringify({ category, subcategory, Country, State, skip, limit })}`;
    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      if (Date.now() - timestamp < cacheTTL) {
        console.log("Returning cached response for cacheKey:", cacheKey);
        return res.json(data);
      }
    }

    let result;
    if (field === "category") {
      const categories = await Company.aggregate([
        { $match: { category: { $ne: null, $ne: "N/A" } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $skip: Number(skip) },
        { $limit: Number(limit) },
        { $project: { category: "$_id", count: 1, _id: 0 } },
      ]);
      const total = await Company.distinct("category", { category: { $ne: null, $ne: "N/A" } }).then(res => res.length);
      result = { data: categories, total };
    } else if (field === "subcategory") {
      const matchStage = category ? { category, subcategory: { $ne: null, $ne: "N/A" } } : {};
      const subcategories = await Company.aggregate([
        { $match: matchStage },
        { $group: { _id: "$subcategory", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $skip: Number(skip) },
        { $limit: Number(limit) },
        { $project: { subcategory: "$_id", count: 1, _id: 0 } },
      ]);
      const total = category
        ? await Company.distinct("subcategory", matchStage).then(res => res.length)
        : 0;
      result = { data: subcategories, total };
    } else if (field === "categories") {
      const matchStage = { Categories: { $ne: null, $ne: "N/A" } };
      if (category) matchStage.category = category;
      if (subcategory) matchStage.subcategory = subcategory;

      const subSubCategories = await Company.aggregate([
        { $match: matchStage },
        {
          $project: {
            Categories: {
              $cond: {
                if: { $and: [{ $ne: ["$Categories", null] }, { $ne: ["$Categories", ""] }] },
                then: { $split: ["$Categories", ","] },
                else: [],
              },
            },
          },
        },
        { $unwind: "$Categories" },
        { $match: { Categories: { $ne: "" } } },
        { $group: { _id: { $trim: { input: "$Categories" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $skip: Number(skip) },
        { $limit: Number(limit) },
        { $project: { label: "$_id", count: 1, _id: 0 } },
      ]);

      const totalResult = await Company.aggregate([
        { $match: matchStage },
        { $project: { Categories: { $split: ["$Categories", ","] } } },
        { $unwind: "$Categories" },
        { $match: { Categories: { $ne: "" } } },
        { $group: { _id: "$Categories" } },
        { $count: "total" },
      ]);

      const total = totalResult[0]?.total || 0;
      result = { data: subSubCategories, total };
    } else if (field === "Country") {
      result = await Company.distinct("Country", { Country: { $ne: null, $ne: "N/A" } }).sort();
    } else if (field === "State") {
      const normalizedCountry = normalizeCountry(Country);
      const matchStage = normalizedCountry
        ? { Country: normalizedCountry, State: { $ne: null, $ne: "N/A" } }
        : {};
      result = await Company.distinct("State", matchStage).sort();
    } else if (field === "City") {
      const normalizedCountry = normalizeCountry(Country);
      const matchStage = { City: { $ne: null, $ne: "N/A" } };
      if (normalizedCountry) matchStage.Country = normalizedCountry;
      if (State) matchStage.State = State;
      result = await Company.distinct("City", matchStage).sort();
    } else {
      return res.status(400).json({ error: "Invalid field specified" });
    }

    const responseData = field === "categories" || field === "category" || field === "subcategory" ? result : result;
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    console.log("Returning response for /filters:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Error in /filters:", error.message);
    res.status(500).json({ error: "Failed to fetch filters: " + error.message });
  }
});

export default router;