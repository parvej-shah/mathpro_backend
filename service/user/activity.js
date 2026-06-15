const Service = require('../base').Service;

class ActivityService extends Service {
    constructor() {
        super();
    }
    
    create = async (user_id, url) => {

        try {
            const currentTime = Date.now();
            const newActivity = {
                url: url,
                time: currentTime
            };

            const date = new Date().toISOString().split('T')[0];
            
            // Check if activity for the day already exists
            const query = `
                SELECT * FROM activity
                WHERE user_id = $1 AND date = $2
                LIMIT 1
            `;
            const params = [user_id,date];
            const dbResult = await this.query(query, params);

            const existingActivity = dbResult.data[0];

            let activityLogs = [];
            let duration = 0;

            if (existingActivity) {
                activityLogs = JSON.parse(JSON.stringify(existingActivity.activity_logs));
                
                // Update time for existing URL or add new URL
                const existingUrlIndex = activityLogs.findIndex(item => item.url === url);
                if (existingUrlIndex !== -1) {
                    activityLogs[existingUrlIndex].time = currentTime;
                } else {
                    activityLogs.push(newActivity);
                }

                // Calculate duration based on the highest and lowest times
                const times = activityLogs.map(item => item.time);
                const lowestTime = Math.min(...times);
                const highestTime = Math.max(...times);
                duration = highestTime - lowestTime;
            } else {
                activityLogs.push(newActivity);
                duration = 0; 
            }

            let result;
            if (existingActivity) {
                // Update existing activit
                const query = `
                    UPDATE activity 
                    SET duration = $1, activity_logs = $2 
                    WHERE id = $3
                    RETURNING *
                `;

                const params = [duration, JSON.stringify(activityLogs), existingActivity.id];
                result = await this.query(query, params);
                return { success: true, message: "Activity updated", data: result };
            } else {
                const query = `
                    INSERT INTO activity (user_id, date, duration, activity_logs)
                    VALUES ($1, $2, $3, $4)
                    RETURNING *
                `;
                const params = [user_id, date, duration, JSON.stringify(activityLogs)];
                result = await this.query(query, params);
                return { success: true, message: "Activity created" };
            }
        } catch (error) {
            console.error("Error in ActivityService.create:", error);
            return { success: false, message: "Error creating/updating activity", error: error.message };
        }
    }

    get = async (user_id,start_date,end_date) => {
        try {
            const query = `
                SELECT * FROM activity
                WHERE user_id = $1
                AND date >= $2
                AND date <= $3
            `;
            const params = [user_id,start_date,end_date];
            const dbResult = await this.query(query, params);
            return { success: true, message: "Activity fetched", data: dbResult.data };
        } catch (error) {
            console.error("Error in ActivityService.get:", error);
            return { success: false, message: "Error fetching activity", error: error.message };
        }
    }
    
    
}

module.exports={ActivityService}