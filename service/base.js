require('dotenv').config(); // Load environment variables
const Pool = require('pg').Pool;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DB,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    }
})



class Service {
    constructor() { }

    query = async function (query, params) {
        try {
            const data = await pool.query(query, params);
            return {
                success: true,
                data: data.rows,
                rowCount: data.rowCount
            }
        } catch (error) {
            console.log(error)
            return {
                success: false,
                error
            }
        }
    }

    // Get a client from the pool for transactions
    // IMPORTANT: Always call client.release() when done!
    getClient = async function () {
        return await pool.connect();
    }
}
exports.Service = Service;