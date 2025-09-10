const nodemailer = require("nodemailer");

async function sendOtpEmail(toEmail, otp) {
  // Transporter setup
  const transporter = nodemailer.createTransport({
    service: "gmail",
   
    auth: {
      user: process.env.MAIL_USER,  // your gmail
      pass: process.env.MAIL_PASS   // app password
    },
     tls: {
    rejectUnauthorized: false
  }
  });

  // Mail options
  const mailOptions = {
    from:   process.env.MAIL_USER,
    to: toEmail,
    subject: "Verify your account - OTP",
    text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
    html: `<h2>Your OTP code is <b>${otp}</b></h2>
         <p>This code will expire in 5 minutes.</p>`
  };
transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error("Error sending mail:", err);
  } else {
    console.log("Mail sent:", info.response);
    
  }
});

  // Send mail
  await transporter.sendMail(mailOptions);
}

module.exports = sendOtpEmail;
