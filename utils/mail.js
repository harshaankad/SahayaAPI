import nodemailer from "nodemailer";

export const sendMail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    host:process.env.MAIL_HOST,
    port: 465,
    auth: {
      user: process.env.NODEMAILER_USER,
      pass: process.env.NODEMAILER_PASS,
    },
  });
  await transporter.sendMail({
    from: process.env.NODEMAILER_USER,
    to: `${to}`,
    subject,
    text : `${text}`,
  });
};
