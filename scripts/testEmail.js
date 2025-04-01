import dotenv from "dotenv";
import sendEmail from "../utils/sendEmail.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env"); // Adjusted to point to data-selling-backend/.env

console.log("Looking for .env at:", envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error("Error loading .env file:", result.error);
} else {
  console.log(".env file loaded successfully");
}



const testEmail = async () => {
  try {
    await sendEmail({
      to: "utkarshgh16@gmail.com",
      subject: "Test Email with New App Password",
      text: "This is a test email to confirm the new App Password works.",
    });
  } catch (error) {
    console.error("Test failed:", error);
  }
};

testEmail();