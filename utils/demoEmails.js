import sendEmail from "./sendEmail.js";

const sendDemoConfirmationEmail = async (to, name, date, time, isCancellation = false, customMessage = "") => {
  try {
    const subject = isCancellation ? "Demo Request Cancelled" : "Demo Request Confirmation";
    const text = isCancellation
      ? customMessage || `
          Hello ${name},

          Sorry we cannot complete your demo in the given slot due to some constraints. We would be happy to schedule your new demo with a different time slot.

          Details:
          - Original Date: ${date}
          - Original Time: ${time}

          Please contact us to reschedule.

          Best regards,
          Your Company Team
        `
      : `
          Hello ${name},

          Thank you for requesting a demo with us!

          Details:
          - Date: ${date}
          - Time: ${time}

          One of our representatives will contact you soon with the meeting link.

          Best regards,
          Your Company Team
        `;
    const info = await sendEmail({ to, subject, text });
    console.log(`${isCancellation ? "Cancellation" : "Confirmation"} email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Error sending ${isCancellation ? "cancellation" : "confirmation"} email to ${to}:`, error);
    throw new Error(`Failed to send ${isCancellation ? "cancellation" : "confirmation"} email: ${error.message}`);
  }
};

const sendMeetingLinkEmail = async (to, name, date, time, meetingLink) => {
  try {
    const subject = "Your Demo Meeting Link";
    const text = `
      Hello ${name},

      Your demo is scheduled, and here are the details:

      Details:
      - Date: ${date}
      - Time: ${time}
      - Meeting Link: ${meetingLink}

      We look forward to meeting you!

      Best regards,
      Your Company Team
    `;
    const info = await sendEmail({ to, subject, text });
    console.log(`Meeting link email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Error sending meeting link email to ${to}:`, error);
    throw new Error(`Failed to send meeting link email: ${error.message}`);
  }
};

export { sendDemoConfirmationEmail, sendMeetingLinkEmail };