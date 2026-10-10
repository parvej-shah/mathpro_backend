// SSLCommerz gateway adapter: the one place that knows the store credentials, the
// live/sandbox switch and the gateway's URLs. Documentation: https://developer.sslcommerz.com/doc/v4/
const SSLCommerzPayment = require('sslcommerz-lts');
const https = require('https');
const http = require('http');
const logger = require('../util/logger');

// SSLCOMMERZ_LIVE=false selects the sandbox; anything else (or unset) is live.
const isLive = () => process.env.SSLCOMMERZ_LIVE !== 'false';

// Opens a checkout session; resolves to the gateway's reply (GatewayPageURL on success).
// sslcommerz-lts never rejects: a failed request resolves to the error instead.
// CURRENT BEHAVIOUR (suspected bug, see REFACTOR_PLAN.md §7): sslcommerz-lts's 3rd argument
// is `live` (true = securepay), but since 2026-07-06 this passes the sandbox flag, so session
// init goes to the opposite environment from validateTransaction below.
const initSession = (data) =>
    new SSLCommerzPayment(process.env.STORE_ID, process.env.STORE_PASSWORD, !isLive()).init(data);

// Validate transaction with SSLCommerz Order Validation API (REQUIRED by SSLCommerz)
// Documentation: https://developer.sslcommerz.com/doc/v4/
async function validateTransaction(tran_id, val_id = null, sessionkey = null) {
    try {
        const storeId = process.env.STORE_ID;
        const storePassword = process.env.STORE_PASSWORD;

        // Live: https://securepay.sslcommerz.com, Sandbox: https://sandbox.sslcommerz.com
        const baseUrl = isLive()
            ? 'https://securepay.sslcommerz.com'
            : 'https://sandbox.sslcommerz.com';

        // Build validation URL - prefer tran_id, then val_id, then sessionkey
        let validationUrl;
        if (tran_id) {
            validationUrl = `${baseUrl}/validator/api/merchantTransIDvalidationAPI.php?tran_id=${encodeURIComponent(tran_id)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&v=1&format=json`;
        } else if (val_id) {
            validationUrl = `${baseUrl}/validator/api/merchantTransIDvalidationAPI.php?val_id=${encodeURIComponent(val_id)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&v=1&format=json`;
        } else if (sessionkey) {
            validationUrl = `${baseUrl}/validator/api/merchantTransIDvalidationAPI.php?sessionkey=${encodeURIComponent(sessionkey)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&v=1&format=json`;
        } else {
            return {
                success: false,
                error: 'Either tran_id, val_id, or sessionkey must be provided'
            };
        }

        // Make HTTP request to SSLCommerz validation API
        return new Promise((resolve, reject) => {
            const url = new URL(validationUrl);
            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'GET',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Math Pro Backend/1.0'
                }
            };

            const protocol = url.protocol === 'https:' ? https : http;

            const req = protocol.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);

                        // Check API connection status
                        if (!result.APIConnect || result.APIConnect !== 'DONE') {
                            return resolve({
                                success: false,
                                error: 'API Connection Failed',
                                apiConnect: result.APIConnect,
                                rawResponse: result
                            });
                        }

                        // Check if we have transaction data
                        if (!result.element || !Array.isArray(result.element) || result.element.length === 0) {
                            return resolve({
                                success: false,
                                error: 'No transaction record found',
                                rawResponse: result
                            });
                        }

                        // Get the latest transaction (first element)
                        const transaction = result.element[0];

                        // Extract transaction details
                        const validationResult = {
                            success: true,
                            status: transaction.status, // 'VALID' or 'VALIDATED'
                            tran_id: transaction.tran_id,
                            val_id: transaction.val_id,
                            amount: parseFloat(transaction.amount),
                            store_amount: parseFloat(transaction.store_amount || transaction.amount),
                            bank_tran_id: transaction.bank_tran_id,
                            tran_date: transaction.tran_date,
                            card_type: transaction.card_type,
                            card_no: transaction.card_no,
                            card_issuer: transaction.card_issuer,
                            card_brand: transaction.card_brand,
                            card_issuer_country: transaction.card_issuer_country,
                            card_issuer_country_code: transaction.card_issuer_country_code,
                            risk_level: parseInt(transaction.risk_level || '0'), // 0 = safe, 1 = risky
                            risk_title: transaction.risk_title,
                            error: transaction.error,
                            validated_on: result.validated_on,
                            gw_version: result.gw_version,
                            rawResponse: result
                        };

                        // Check if transaction is valid
                        if (transaction.status === 'VALID' || transaction.status === 'VALIDATED') {
                            validationResult.isValid = true;
                            validationResult.isAlreadyProcessed = transaction.status === 'VALIDATED';
                        } else {
                            validationResult.isValid = false;
                            validationResult.error = transaction.error || `Transaction status: ${transaction.status}`;
                        }

                        resolve(validationResult);
                    } catch (parseError) {
                        logger.error('Error parsing SSLCommerz validation response:', parseError);
                        resolve({
                            success: false,
                            error: 'Failed to parse validation response',
                            rawResponse: data,
                            parseError: parseError.message
                        });
                    }
                });
            });

            req.on('error', (error) => {
                logger.error('Error calling SSLCommerz validation API:', error);
                resolve({
                    success: false,
                    error: 'Failed to connect with SSLCommerz validation API',
                    connectionError: error.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'SSLCommerz validation API request timeout'
                });
            });

            req.end();
        });
    } catch (error) {
        logger.error('Error in sslcommerz.validateTransaction:', error);
        return {
            success: false,
            error: error.message || 'Unknown error during validation'
        };
    }
}

module.exports = { isLive, initSession, validateTransaction };
