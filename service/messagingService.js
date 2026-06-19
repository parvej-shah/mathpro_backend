const { default: axios } = require('axios');
const nodeMailer = require('nodemailer');

const BULKSMS_API_KEY = process.env.BULKSMS_API_KEY;
const BULKSMS_SENDER_ID = process.env.BULKSMS_SENDER_ID;

let transporter = nodeMailer.createTransport({
  host: 'smtp.zoho.com',
  secure: true,
  port: 465,
  auth: {
    user: process.env.ZOHO_LOGIN,
    pass: process.env.ZOHO_PASSWORD
  },
});

class MessagingService{
    constructor() {}
    
    /**
     * Detects if message contains Bengali characters
     * @param {string} text - Message text
     * @returns {boolean} - True if Bengali detected
     */
    containsBengali(text) {
        // Bengali Unicode range: \u0980-\u09FF
        const bengaliRegex = /[\u0980-\u09FF]/;
        return bengaliRegex.test(text);
    }
    
    /**
     * Gets encoding type and max character limit based on message content
     * @param {string} text - Message text
     * @returns {{encoding: string, maxChars: number}} - Encoding info
     */
    getEncodingInfo(text) {
        if (this.containsBengali(text)) {
            return { encoding: 'UTF16', maxChars: 70 };
        }
        return { encoding: 'GSM_7BIT_EX', maxChars: 160 };
    }
    
    /**
     * Send SMS to phone number (single)
     * @param {string} phone - Phone number
     * @param {string} text - Message text
     * @returns {Promise<{success: boolean, data?: any, error?: string, apiCode?: number}>}
     */
    sendMessage=async (phone,text)=>{
      try{
        // URL-encode the message text to prevent special characters from breaking URL
        const encodedMessage = encodeURIComponent(text);
        var response = await axios.post(`http://bulksmsbd.net/api/smsapi?api_key=${BULKSMS_API_KEY}&type=text&number=${phone}&senderid=${BULKSMS_SENDER_ID}&message=${encodedMessage}`);
        
        // Parse API response code - handle different response formats
        let apiCode = null;
        let responseData = response.data;
        
        // BulkSMS API returns status code as number or string or object
        if (typeof responseData === 'number') {
            apiCode = responseData;
        } else if (typeof responseData === 'string') {
            // Try to extract number from string (e.g., "202" or "SMS Submitted Successfully (202)")
            const match = responseData.match(/\d+/);
            apiCode = match ? parseInt(match[0]) : null;
        } else if (responseData && typeof responseData === 'object') {
            // If response is an object, check common fields (response_code is the actual field from BulkSMS)
            apiCode = responseData.response_code || responseData.code || responseData.status || responseData.statusCode || null;
            if (apiCode) apiCode = parseInt(apiCode);
        }
        
        const isSuccess = apiCode === 202;
        
        return {
          success: isSuccess,
          data: responseData,
          apiCode: apiCode,
          error: isSuccess ? null : this.getErrorMessage(apiCode)
        }
      }catch(err){
        console.log('SMS Error:', err.message);
        return {
          success:false,
          error: err.message,
          apiCode: null
        }
      }
    }
    
    /**
     * Send bulk SMS using Many SMS API (One to Many - same message to multiple recipients)
     * @param {Array<string>} phones - Array of phone numbers
     * @param {string} text - Message text
     * @returns {Promise<{success: boolean, data?: any, error?: string, apiCode?: number}>}
     */
    sendBulkSms = async (phones, text) => {
        try {
            // URL-encode the message text
            const encodedMessage = encodeURIComponent(text);
            // Comma-separated phone numbers
            const phoneNumbers = phones.join(',');
            
            const response = await axios.post(
                `http://bulksmsbd.net/api/smsapi?api_key=${BULKSMS_API_KEY}&type=text&number=${phoneNumbers}&senderid=${BULKSMS_SENDER_ID}&message=${encodedMessage}`
            );
            
            // Parse API response code - handle different response formats
            let apiCode = null;
            let responseData = response.data;
            
            // BulkSMS API returns status code as number or string or object
            // Handle different possible response formats
            if (typeof responseData === 'number') {
                apiCode = responseData;
            } else if (typeof responseData === 'string') {
                // Try to extract number from string (e.g., "202" or "SMS Submitted Successfully (202)")
                const match = responseData.match(/\d+/);
                apiCode = match ? parseInt(match[0]) : null;
            } else if (responseData && typeof responseData === 'object') {
                // If response is an object, check common fields (response_code is the actual field from BulkSMS)
                apiCode = responseData.response_code || responseData.code || responseData.status || responseData.statusCode || null;
                if (apiCode) apiCode = parseInt(apiCode);
            }
            
            const isSuccess = apiCode === 202;
            
            return {
                success: isSuccess,
                data: responseData,
                apiCode: apiCode,
                error: isSuccess ? null : this.getErrorMessage(apiCode)
            };
        } catch (err) {
            console.log('Bulk SMS Error:', err.message);
            return {
                success: false,
                error: err.message,
                apiCode: null
            };
        }
    }
    
    /**
     * Send bulk SMS using Many to Many API (different messages to different recipients)
     * @param {Array<{to: string, message: string}>} messages - Array of message objects
     * @returns {Promise<{success: boolean, data?: any, error?: string, apiCode?: number}>}
     */
    sendBulkSmsManyToMany = async (messages) => {
        try {
            // Format messages according to API spec
            const formattedMessages = messages.map(msg => ({
                to: msg.to,
                message: msg.message
            }));
            
            const response = await axios.post(
                `http://bulksmsbd.net/api/smsapimany`,
                {
                    api_key: BULKSMS_API_KEY,
                    senderid: BULKSMS_SENDER_ID,
                    messages: formattedMessages
                }
            );
            
            // Parse API response code
            const apiCode = response.data ? parseInt(response.data) : null;
            const isSuccess = apiCode === 202;
            
            return {
                success: isSuccess,
                data: response.data,
                apiCode: apiCode,
                error: isSuccess ? null : this.getErrorMessage(apiCode)
            };
        } catch (err) {
            console.log('Many-to-Many SMS Error:', err.message);
            return {
                success: false,
                error: err.message,
                apiCode: null
            };
        }
    }
    
    /**
     * Get error message from API code
     * @param {number} apiCode - API response code
     * @returns {string} - Error message
     */
    getErrorMessage(apiCode) {
        const errorMessages = {
            1001: 'Invalid Number',
            1002: 'Sender ID not correct or disabled',
            1003: 'Required fields missing',
            1005: 'Internal Error',
            1006: 'Balance Validity Not Available',
            1007: 'Balance Insufficient',
            1011: 'User ID not found',
            1012: 'Masking SMS must be sent in Bengali',
            1013: 'Sender ID has not found Gateway by API key',
            1014: 'Sender Type Name not found',
            1015: 'Sender ID has not found Any Valid Gateway',
            1016: 'Sender Type Name Active Price Info not found',
            1017: 'Sender Type Name Price Info not found',
            1018: 'Account owner is disabled',
            1019: 'Account price is disabled',
            1020: 'Parent account not found',
            1021: 'Parent active price not found',
            1031: 'Account not verified',
            1032: 'IP not whitelisted'
        };
        
        return errorMessages[apiCode] || `API Error: ${apiCode}`;
    }
    
    /**
     * Send email
     * @param {string} email - Email address
     * @param {string} subject - Email subject
     * @param {string} html - Email HTML content
     * @param {Array} attachments - Optional attachments
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    sendMail=async (email,subject,html,attachments=[])=>{
      try{
        const mailOptions = {
          from: process.env.ZOHO_MAIL, 
          to: email,
          subject: subject, 
          html:html,
          attachments
      };
        var mailResult = await transporter.sendMail(mailOptions)
        console.log('Email sent:', mailResult.messageId)
        return {
          success: true,
          data: mailResult
        }
      }catch(err){
        console.log('Email Error:', err.message)
        return {
          success:false,
          error: err.message
        }
      }
        
    }
    
    /**
     * Send OTP via appropriate channel (SMS or Email)
     * @param {string} contact - Email or phone number
     * @param {'email' | 'phone'} contactType - Type of contact
     * @param {string} otp - OTP code
     * @param {'registration' | 'password_reset' | 'verification'} purpose - Purpose of OTP
     * @returns {Promise<{success: boolean, data?: any, error?: string}>}
     */
    sendOTP = async (contact, contactType, otp, purpose = 'verification') => {
      const purposeText = {
        'registration': 'register your account',
        'password_reset': 'reset your password',
        'verification': 'verify your account'
      };
      
      const action = purposeText[purpose] || 'verify your identity';
      
      if (contactType === 'phone') {
        const smsText = `${otp} is your OTP to ${action} on Math Pro. Valid for 10 minutes. Do not share this code.`;
        return await this.sendMessage(contact, smsText);
      } 
      else if (contactType === 'email') {
        const emailSubject = `Math Pro OTP - ${otp}`;
        const emailHTML = this.getOTPEmailTemplate(otp, action);
        return await this.sendMail(contact, emailSubject, emailHTML);
      }
      
      return {
        success: false,
        error: 'Invalid contact type'
      };
    }
    
    /**
     * Get OTP Email HTML Template
     * @param {string} otp - OTP code
     * @param {string} action - Action description
     * @returns {string} HTML template
     */
    getOTPEmailTemplate = (otp, action) => {
      return `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>OTP Verification</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 20px auto;
                padding: 30px;
                background-color: #fff;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 28px;
                font-weight: bold;
                color: #007bff;
              }
              .content {
                text-align: center;
              }
              h1 {
                color: #333;
                font-size: 24px;
                margin-bottom: 20px;
              }
              p {
                color: #666;
                line-height: 1.6;
                margin: 15px 0;
              }
              .otp-code {
                font-size: 32px;
                font-weight: bold;
                color: #007bff;
                letter-spacing: 8px;
                border: 3px solid #007bff;
                border-radius: 8px;
                padding: 20px;
                margin: 30px 0;
                display: inline-block;
                background-color: #f8f9fa;
              }
              .warning {
                color: #dc3545;
                font-size: 14px;
                margin-top: 20px;
              }
              .footer {
                text-align: center;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
              }
              .footer p {
                color: #999;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">Math Pro</div>
              </div>
              <div class="content">
                <h1>Your Verification Code</h1>
                <p>
                  Use the following OTP to ${action}.
                </p>
                <div class="otp-code">${otp}</div>
                <p>This code will expire in <strong>10 minutes</strong>.</p>
                <p class="warning">
                  ⚠️ Never share this code with anyone, including Math Pro staff.
                </p>
              </div>
              <div class="footer">
                <p>
                  If you didn't request this code, please ignore this email.
                </p>
                <p>© ${new Date().getFullYear()} Math Pro. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }
}

exports.MessagingService=MessagingService