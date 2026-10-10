// Account credential emails (sent when a student / admin account is created or its
// password reset). The HTML is kept byte-for-byte as it was when it lived inline.

// Student account: `isCreation` picks the welcome or the password-reset wording.
const userCredentialsEmail = ({ isCreation, name, login, password }) => `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <title>${isCreation ? 'Account Created' : 'Password Reset'}</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            padding: 40px 20px;
                            line-height: 1.6;
                        }
                        .email-wrapper {
                            max-width: 600px;
                            margin: 0 auto;
                            background: #ffffff;
                            border-radius: 16px;
                            overflow: hidden;
                            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                        }
                        .header {
                            background: linear-gradient(135deg, ${isCreation ? '#667eea 0%, #764ba2 100%' : '#f093fb 0%, #f5576c 100%'});
                            padding: 40px 30px;
                            text-align: center;
                            color: white;
                        }
                        .header-icon {
                            font-size: 48px;
                            margin-bottom: 15px;
                        }
                        .logo {
                            font-size: 32px;
                            font-weight: 800;
                            letter-spacing: -0.5px;
                            margin-bottom: 10px;
                        }
                        .header-subtitle {
                            font-size: 16px;
                            opacity: 0.95;
                            font-weight: 500;
                        }
                        .content {
                            padding: 40px 30px;
                        }
                        .greeting {
                            font-size: 24px;
                            font-weight: 700;
                            color: #1a202c;
                            margin-bottom: 20px;
                        }
                        .message {
                            font-size: 16px;
                            color: #4a5568;
                            margin-bottom: 30px;
                            line-height: 1.8;
                        }
                        .credentials-box {
                            background: linear-gradient(135deg, #f6f8fb 0%, #e9ecef 100%);
                            border-left: 4px solid ${isCreation ? '#667eea' : '#f5576c'};
                            border-radius: 12px;
                            padding: 30px;
                            margin: 30px 0;
                        }
                        .credential-item {
                            margin-bottom: 20px;
                        }
                        .credential-item:last-child {
                            margin-bottom: 0;
                        }
                        .label {
                            display: block;
                            font-size: 12px;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            color: #718096;
                            margin-bottom: 8px;
                        }
                        .value {
                            display: block;
                            font-family: 'Courier New', monospace;
                            font-size: 18px;
                            font-weight: 600;
                            color: #1a202c;
                            background: white;
                            padding: 12px 16px;
                            border-radius: 8px;
                            word-break: break-all;
                            border: 2px solid #e2e8f0;
                        }
                        .cta-button {
                            display: inline-block;
                            background: linear-gradient(135deg, ${isCreation ? '#667eea 0%, #764ba2 100%' : '#f093fb 0%, #f5576c 100%'});
                            color: white;
                            text-decoration: none;
                            padding: 16px 40px;
                            border-radius: 50px;
                            font-weight: 700;
                            font-size: 16px;
                            margin: 20px 0;
                            transition: transform 0.2s;
                            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                        }
                        .cta-button:hover {
                            transform: translateY(-2px);
                        }
                        .security-notice {
                            background: #fff5f5;
                            border-left: 4px solid #fc8181;
                            padding: 16px 20px;
                            border-radius: 8px;
                            margin: 25px 0;
                        }
                        .security-notice-title {
                            font-weight: 700;
                            color: #c53030;
                            margin-bottom: 8px;
                            font-size: 14px;
                        }
                        .security-notice-text {
                            font-size: 14px;
                            color: #742a2a;
                            line-height: 1.6;
                        }
                        .footer {
                            background: #f7fafc;
                            padding: 30px;
                            text-align: center;
                            border-top: 1px solid #e2e8f0;
                        }
                        .footer-text {
                            color: #718096;
                            font-size: 13px;
                            margin-bottom: 10px;
                        }
                        .footer-copyright {
                            color: #a0aec0;
                            font-size: 12px;
                        }
                        .divider {
                            height: 1px;
                            background: linear-gradient(to right, transparent, #e2e8f0, transparent);
                            margin: 25px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="email-wrapper">
                        <div class="header">
                            <div class="header-icon">${isCreation ? '🎉' : '🔐'}</div>
                            <div class="logo">Math Pro</div>
                            <div class="header-subtitle">${isCreation ? 'Welcome to Your Learning Journey' : 'Password Reset Confirmation'}</div>
                        </div>
                        
                        <div class="content">
                            <div class="greeting">Hello ${name}! 👋</div>
                            
                            <div class="message">
                                ${isCreation
                    ? 'Your account has been successfully created by our admin team. We\'re excited to have you on board! Below are your login credentials to access your account.'
                    : 'Your password has been reset successfully. You can now use your new credentials to log in to your account.'
                }
                            </div>
                            
                            <div class="credentials-box">
                                <div class="credential-item">
                                    <span class="label">📧 Login Email</span>
                                    <span class="value">${login}</span>
                                </div>
                                <div class="credential-item">
                                    <span class="label">🔑 ${isCreation ? 'Temporary Password' : 'New Password'}</span>
                                    <span class="value">${password}</span>
                                </div>
                            </div>
                            
                            <center>
                                <a href="https://mathpro.com/auth/login" class="cta-button">
                                    ${isCreation ? '🚀 Login to Your Account' : '🔓 Login Now'}
                                </a>
                            </center>
                            
                            <div class="security-notice">
                                <div class="security-notice-title">🔒 Security Recommendation</div>
                                <div class="security-notice-text">
                                    For your account security, we strongly recommend changing this ${isCreation ? 'temporary' : ''} password immediately after your first login. Never share your password with anyone, including Math Pro staff.
                                </div>
                            </div>
                            
                            <div class="divider"></div>
                            
                            <div class="message" style="font-size: 14px; color: #718096;">
                                Need help? Contact our support team at <a href="mailto:support@mathpro.com" style="color: #667eea; text-decoration: none;">support@mathpro.com</a>
                            </div>
                        </div>
                        
                        <div class="footer">
                            <div class="footer-text">
                                ${isCreation
                    ? 'If you didn\'t expect this email, please contact our support team immediately.'
                    : 'If you didn\'t request a password reset, please contact our support team immediately.'
                }
                            </div>
                            <div class="footer-copyright">
                                © ${new Date().getFullYear()} Math Pro. All rights reserved.
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

const adminCredentialsEmail = ({ name, login, password }) => `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Admin Credentials</title>
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
                        line-height: 1.6;
                        color: #333;
                    }
                    h1 {
                        color: #333;
                        font-size: 24px;
                        margin-bottom: 20px;
                    }
                    .credentials-box {
                        background-color: #f8f9fa;
                        border: 2px solid #007bff;
                        border-radius: 8px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .credential-item {
                        margin: 10px 0;
                    }
                    .label {
                        font-weight: bold;
                        color: #007bff;
                    }
                    .value {
                        font-family: monospace;
                        font-size: 16px;
                        color: #333;
                        word-break: break-all;
                    }
                    .warning {
                        color: #dc3545;
                        font-size: 14px;
                        margin-top: 20px;
                        padding: 15px;
                        background-color: #fff3cd;
                        border-radius: 5px;
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
                        <h1>Your Admin Account Has Been Created</h1>
                        <p>Hello ${name},</p>
                        <p>Your admin account has been created. Please use the following credentials to log in:</p>
                        
                        <div class="credentials-box">
                            <div class="credential-item">
                                <span class="label">Username/Email:</span><br>
                                <span class="value">${login}</span>
                            </div>
                            <div class="credential-item">
                                <span class="label">Password:</span><br>
                                <span class="value">${password}</span>
                            </div>
                        </div>
                        
                        <p>Please log in at: <a href="https://admin.mathpro.com/">Admin Login</a></p>
                    </div>
                    <div class="footer">
                        <p>If you didn't expect this email, please contact the administrator immediately.</p>
                        <p>© ${new Date().getFullYear()} Math Pro. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

module.exports = { userCredentialsEmail, adminCredentialsEmail };
