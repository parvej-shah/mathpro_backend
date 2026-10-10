// Purchase confirmation SMS + email sent after a successful IPN (moved from the IPN handler).
// Sending is fire-and-forget: a failure is logged and never affects the payment.
const logger = require('../../util/logger');
const { logNames } = require('../../util/constants.js');
const MessagingService = require('../messagingService.js').MessagingService;
const { CourseService } = require('../managerial/course');

const messagingService = new MessagingService();
const courseService = new CourseService();

const frontendUrl = () => process.env.FRONTEND_URL || 'https://mathpro.academy';

// The HTML bodies are kept byte-for-byte as they were sent before the move.
const bundleEmail = ({ user, bundleTitle, bundleWithCourses, successUrl, transactionId }) => `<!DOCTYPE html>
                                <html lang="en">
                                
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Bundle Purchase Success</title>
                                  <style>
                                    body {
                                      font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                      margin: 0;
                                      padding: 0;
                                      background-color: #f4f4f4;
                                      color: #333;
                                    }
                                
                                    .container {
                                      background-color: #ffffff;
                                      width: 100%;
                                      max-width: 620px;
                                      margin: 40px auto;
                                      padding: 20px;
                                      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                                      border-radius: 8px;
                                      border-top: 3px solid #007bff;
                                    }
                                
                                    .header {
                                      background: linear-gradient(to right, #0062E6, #33AEFF);
                                      color: #ffffff;
                                      padding: 20px;
                                      border-radius: 5px 5px 0 0;
                                      text-align: center;
                                    }
                                
                                    .content {
                                      padding: 20px;
                                      line-height: 1.6;
                                    }
                                
                                    .content h3 {
                                      color: #0062E6;
                                    }
                                
                                    .content p,
                                    .content ul {
                                      margin: 10px 0;
                                    }
                                    
                                    .center { text-align: center; }
                                
                                    .content ul {
                                      list-style: inside square;
                                    }
                                
                                    .button,
                                    .fb-group-button {
                                      display: inline-block;
                                      padding: 12px 25px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      border-radius: 5px;
                                      font-weight: bold;
                                      transition: background-color 0.3s ease;
                                      margin-top: 10px;
                                    }
                                
                                    .button {
                                      background-color: #28a745;
                                    }
                                
                                    .button:hover {
                                      background-color: #218838;
                                    }
                                
                                    .fb-group-button {
                                      background-color: #3b5998;
                                    }
                                
                                    .fb-group-button:hover {
                                      background-color: #333c8c;
                                    }
                                
                                    .info-button {
                                      background-color: #007bff;
                                      display: inline-block;
                                      padding: 12px 25px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      border-radius: 5px;
                                      font-weight: bold;
                                      transition: background-color 0.3s ease;
                                      margin: 10px 5px;
                                    }
                                
                                    .info-button:hover {
                                      background-color: #0056b3;
                                    }
                                
                                    .button-group {
                                      text-align: center;
                                      margin: 25px 0;
                                    }
                                
                                    .footer {
                                      margin-top: 20px;
                                      text-align: center;
                                      font-size: 14px;
                                      color: #666;
                                    }
                                    
                                    .course-list {
                                      background-color: #f8f9fa;
                                      padding: 15px;
                                      border-radius: 5px;
                                      margin: 15px 0;
                                    }
                                  </style>
                                </head>
                                
                                <body>
                                  <div class="container">
                                    <div class="header">
                                      <h2>অভিনন্দন! Bundle Purchase Successful!</h2>
                                    </div>
                                    <div class="content">
                                      <p class="center">Dear <strong>${user.name}</strong>, you have successfully purchased the <strong>${bundleTitle}</strong> bundle from Math Pro!</p>
                                      
                                      ${bundleWithCourses.courses && bundleWithCourses.courses.length > 0 ? `
                                      <div class="course-list">
                                        <h3>You are now enrolled in these courses:</h3>
                                        <ul>
                                          ${bundleWithCourses.courses.map(course => `<li>${course.title}</li>`).join('')}
                                        </ul>
                                      </div>
                                      ` : ''}
                                      
                                      <p class="center">Your access code is: <strong>${transactionId}</strong></p>
                                      <p class="center">আর তোমাকে সর্বাত্নক হেল্প করতে পাশে আছি <strong>আমরা কোডার ভাই পরিবার!</strong></p>
                                      
                                      <div class="button-group">
                                        <a href="${successUrl}" class="info-button">📋 View Important Info & Next Steps</a>
                                      </div>
                                    </div>
                                    <div class="footer">
                                      <p>This is an automated message. Please do not reply directly to this email.</p>
                                      <p style="margin-top: 10px;">
                                        <a href="${successUrl}" style="color: #007bff; text-decoration: underline;">Click here to see important information about your purchase</a>
                                      </p>
                                    </div>
                                  </div>
                                </body>
                                
                                </html>`;

const courseEmail = ({ userName, courseTitle, courseId, frontendUrl, successUrl, transactionId }) => `<!DOCTYPE html>
                                <html lang="en">
                                
                                <head>
                                  <meta charset="UTF-8">
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                  <title>Course Purchase Success</title>
                                  <style>
                                    body {
                                      font-family: 'Hind Siliguri', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                      margin: 0;
                                      padding: 0;
                                      background-color: #f4f4f4;
                                      color: #333;
                                    }
                                
                                    .container {
                                      background-color: #ffffff;
                                      width: 100%;
                                      max-width: 620px;
                                      margin: 40px auto;
                                      padding: 20px;
                                      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                                      border-radius: 8px;
                                      border-top: 3px solid #007bff;
                                    }
                                
                                    .header {
                                      background: linear-gradient(to right, #0062E6, #33AEFF);
                                      color: #ffffff;
                                      padding: 20px;
                                      border-radius: 5px 5px 0 0;
                                      text-align: center;
                                    }
                                
                                    .content {
                                      padding: 20px;
                                      line-height: 1.6;
                                    }
                                
                                    .content h3 {
                                      color: #0062E6;
                                    }
                                
                                    .content p,
                                    .content ul {
                                      margin: 10px 0;
                                    }
                                    
                                    .center { text-align: center; }
                                
                                    .content ul {
                                      list-style: inside square;
                                    }
                                
                                    .button,
                                    .fb-group-button {
                                      display: inline-block;
                                      padding: 12px 25px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      border-radius: 5px;
                                      font-weight: bold;
                                      transition: background-color 0.3s ease;
                                      margin-top: 10px;
                                    }
                                
                                    .button {
                                      background-color: #28a745;
                                    }
                                
                                    .button:hover {
                                      background-color: #218838;
                                    }
                                
                                    .fb-group-button {
                                      background-color: #3b5998;
                                    }
                                
                                    .fb-group-button:hover {
                                      background-color: #333c8c;
                                    }
                                
                                    .info-button {
                                      background-color: #007bff;
                                      display: inline-block;
                                      padding: 12px 25px;
                                      color: #ffffff;
                                      text-decoration: none;
                                      border-radius: 5px;
                                      font-weight: bold;
                                      transition: background-color 0.3s ease;
                                      margin: 10px 5px;
                                    }
                                
                                    .info-button:hover {
                                      background-color: #0056b3;
                                    }
                                
                                    .button-group {
                                      text-align: center;
                                      margin: 25px 0;
                                    }
                                
                                    .footer {
                                      margin-top: 20px;
                                      text-align: center;
                                      font-size: 14px;
                                      color: #666;
                                    }
                                  </style>
                                </head>
                                
                                <body>
                                  <div class="container">
                                    <div class="header">
                                      <h2>অভিনন্দন! Course Purchase Successful!</h2>
                                    </div>
                                    <div class="content">
                                      <p class="center">Dear <strong>${userName}</strong>, you have successfully purchased <strong>${courseTitle}</strong> course from Math Pro!</p>

                                      <p class="center">Your access code is: <strong>${transactionId}</strong></p>
                                      <p class="center">আর তোমাকে সর্বাত্নক হেল্প করতে পাশে আছি <strong>আমরা কোডার ভাই পরিবার!</strong></p>
                                
                                      <div class="button-group">
                                        <a href="${successUrl}" class="info-button">📋 View Important Info & Next Steps</a>
                                      </div>
                                      
                                      <div class="button-group">
                                        <a href="${frontendUrl}/course/${courseId}" class="button">🎓 Start Learning Now</a>
                                      </div>
                                    </div>
                                    <div class="footer">
                                      <p>This is an automated message. Please do not reply directly to this email.</p>
                                      <p style="margin-top: 10px;">
                                        <a href="${successUrl}" style="color: #007bff; text-decoration: underline;">Click here to see important information about your purchase</a>
                                      </p>
                                    </div>
                                  </div>
                                </body>
                                
                                </html>`;

const found = (result) => result.success && result.data && result.data.length > 0;

// Starts the SMS, email and purchase log without waiting for them.
function send(user, { kind, subject, text, emailText, log, context }) {
    const userPhone = user.login || user.phone;
    const userEmail = user.profile?.email || user.email;
    if (!userPhone && !userEmail) {
        console.warn('IPN: Cannot send notifications - user has no phone or email:', context);
        return;
    }
    Promise.all([
        userPhone ? messagingService.sendMessage(userPhone, text).catch(err => {
            logger.error(`IPN: ${kind} SMS send error`, err, { userId: context.userId, transactionId: context.transactionId, phone: userPhone });
            return { success: false, error: err.message };
        }) : Promise.resolve({ success: false, error: 'No phone number' }),
        userEmail ? messagingService.sendMail(userEmail, subject, emailText).catch(err => {
            logger.error(`IPN: ${kind} Email send error`, err, { userId: context.userId, transactionId: context.transactionId, email: userEmail });
            return { success: false, error: err.message };
        }) : Promise.resolve({ success: false, error: 'No email address' }),
        courseService.createLog(logNames.coursePurchase, log).catch(err => logger.error('IPN: Log creation error:', err))
    ]).then(results => {
        console.log(`IPN: ${kind} notifications sent:`, {
            ...context,
            sms: results[0]?.success ? 'sent' : 'failed',
            email: results[1]?.success ? 'sent' : 'failed'
        });
    }).catch(err => {
        logger.error(`IPN: ${kind} notification error`, err, context);
    });
}

// After a successful bundle purchase. The lookups are awaited; sending is not.
async function notifyBundlePurchase(query, bundleService, { userId, itemId, amount, transactionId }) {
    const [userResult, bundleResult, withCourses] = await Promise.all([
        query(`select * from managerial_auth where id = $1`, [userId]),
        query(`select * from bundle where id = $1`, [itemId]),
        bundleService.get(itemId) // bundle with its courses
    ]);
    if (!found(userResult) || !found(bundleResult) || !found(withCourses)) return;
    try {
        const user = userResult.data[0];
        const bundle = bundleResult.data[0];
        const bundleWithCourses = withCourses.data[0];
        const bundleId = !bundle.id || isNaN(bundle.id) ? itemId : bundle.id;
        const courseCount = bundleWithCourses.courses ? bundleWithCourses.courses.length : 0;
        const successUrl = `${frontendUrl()}/billing/invoice/${encodeURIComponent(transactionId)}`;
        send(user, {
            kind: 'Bundle',
            subject: 'Bundle Purchase Confirmation | Math Pro',
            text: `Dear ${user.name}, you have successfully purchased the "${bundle.title}" bundle from Math Pro! You are now enrolled in ${courseCount} courses. Your access code is: ${transactionId}. View dashboard: ${frontendUrl()}/dashboard`,
            emailText: bundleEmail({ user, bundleTitle: bundle.title, bundleWithCourses, successUrl, transactionId }),
            log: { user_id: userId, course_id: itemId, amount, type: 'bundle' },
            context: { userId, transactionId, bundleId }
        });
    } catch (notificationError) {
        // Never let notification errors break payment processing: the payment already succeeded.
    }
}

// After a successful course enrolment. `ipnAmount` is the IPN's own `amount` field.
async function notifyCoursePurchase(query, { userId, itemId, amount, ipnAmount, transactionId }) {
    const [userResult, courseResult] = await Promise.all([
        query(`select * from managerial_auth where id = $1`, [userId]),
        query(`select * from course where id = $1`, [itemId])
    ]);
    if (!found(userResult) || !found(courseResult)) return;
    try {
        const user = userResult.data[0];
        const course = courseResult.data[0];
        const courseId = !course.id || isNaN(course.id) ? itemId : course.id;
        const successUrl = `${frontendUrl()}/billing/invoice/${encodeURIComponent(transactionId)}`;
        const dashboardUrl = `${frontendUrl()}/dashboard/${String(courseId)}`;
        send(user, {
            kind: 'Course',
            subject: 'Course Purchased Confirmation | Math Pro',
            text: `Dear ${user.name}, you have successfully purchased "${course.title}" course from Math Pro. Your access code is: ${transactionId}. Start learning: ${dashboardUrl}`,
            emailText: courseEmail({ userName: user.name, courseTitle: course.title, courseId, frontendUrl: frontendUrl(), successUrl, transactionId }),
            log: { user_id: userId, course_id: courseId || itemId, amount: ipnAmount || amount },
            context: { userId, transactionId, courseId }
        });
    } catch (notificationError) {
        // Never let notification errors break payment processing: the payment already succeeded.
    }
}

module.exports = { notifyBundlePurchase, notifyCoursePurchase, bundleEmail, courseEmail, messagingService };
