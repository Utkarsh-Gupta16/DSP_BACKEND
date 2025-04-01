import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, text, attachments = [] }) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Optional: Use this only if you face SSL issues
    },
  });

  try {
    console.log("Preparing to send email to:", to); // Keep this for now to monitor
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #0052cc;">${subject}</h2>
          <p>${text.replace(/\n/g, "<br/>")}</p>
          <p>If you have any questions, feel free to contact us at <a href="mailto:${process.env.EMAIL_USER}">${process.env.EMAIL_USER}</a>.</p>
          <p>Best regards,<br/>DataSellingProject Team</p>
        </div>
      `,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${to}, Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Error sending email:", error.message);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

export default sendEmail;