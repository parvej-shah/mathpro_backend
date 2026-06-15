const { managerialAccountTypes } = require('../../util/constants');
const Service = require('../base').Service;

class RoutineService extends Service {
    constructor() {
        super();
    }
    
    table = `course_routine`;
    pk = `id`;
    fk = `course_id`;
    
    cols = [
        `week_number`,
        `routine_image_url`,
        `week_start_date`,
        `week_end_date`,
        `is_active`
    ];
    
    types = [
        `integer`,
        `string`,
        `string`,
        `string`,
        `boolean`
    ];
    
    getColumns = () => {
        var result = `(`;
        this.cols.map((c, i) => {
            result += `${c},`;
        });
        result += `${this.fk}`;
        return `${result})`;
    };
    
    getWildCards = () => {
        var result = `(`;
        var fields = [...this.cols, this.fk];
        fields.map((_, i) => {
            result += `$${(i + 1)}`;
            if (i < fields.length - 1) result += ',';
        });
        return result + ')';
    };
    
    getUpdatePairs = () => {
        var result = ``;
        this.cols.map((c, i) => {
            result += `
                ${c} = $${(i + 1)}`;
            if (i < this.cols.length - 1) result += ',';
        });
        return result;
    };

    // List all routines for a course (admin)
    list = async (req, access) => {
        if (access && access.hasGlobalAccess) {
            var query = `
                SELECT r.*, c.title as course_title 
                FROM ${this.table} r
                JOIN course c ON r.course_id = c.id
                ORDER BY r.course_id ASC, r.week_number ASC
            `;
            var result = await this.query(query, []);
            return result;
        } else if (access && !access.hasGlobalAccess) {
            var query = `
                SELECT r.*, c.title as course_title 
                FROM ${this.table} r
                JOIN course c ON r.course_id = c.id
                WHERE r.course_id = ANY($1)
                ORDER BY r.course_id ASC, r.week_number ASC
            `;
            var result = await this.query(query, [access.courseIds]);
            return result;
        } else {
            // Fallback: legacy type-based check
            if (req.body.user_type === managerialAccountTypes.admin) {
                var query = `
                    SELECT r.*, c.title as course_title 
                    FROM ${this.table} r
                    JOIN course c ON r.course_id = c.id
                    ORDER BY r.course_id ASC, r.week_number ASC
                `;
                var result = await this.query(query, []);
                return result;
            } else {
                var query = `
                    SELECT r.*, c.title as course_title 
                    FROM ${this.table} r
                    JOIN course c ON r.course_id = c.id
                    JOIN instructor i ON c.id = i.course_id
                    WHERE i.user_id = $1
                    ORDER BY r.course_id ASC, r.week_number ASC
                `;
                var result = await this.query(query, [req.body.user_id]);
                return result;
            }
        }
    };

    // List routines for a specific course (admin)
    listByCourse = async (course_id) => {
        var query = `
            SELECT r.*, c.title as course_title 
            FROM ${this.table} r
            JOIN course c ON r.course_id = c.id
            WHERE r.${this.fk} = $1
            ORDER BY r.week_number ASC
        `;
        var params = [course_id];
        var result = await this.query(query, params);
        return result;
    };

    // Get current week's routine for a course (user-facing)
    // Falls back to most recent routine if no routine found for current week
    getCurrentRoutine = async (course_id) => {
        // First, try to find routine for current week
        var query = `
            SELECT 
                r.id,
                r.course_id,
                r.week_number,
                r.routine_image_url,
                r.week_start_date,
                r.week_end_date,
                c.title as course_title
            FROM ${this.table} r
            JOIN course c ON r.course_id = c.id
            WHERE r.course_id = $1
                AND r.is_active = true
                AND CURRENT_DATE BETWEEN r.week_start_date AND r.week_end_date
            ORDER BY r.week_number DESC
            LIMIT 1
        `;
        var params = [course_id];
        var result = await this.query(query, params);
        
        if (result.success && result.data.length > 0) {
            return {
                success: true,
                data: {
                    routine_image_url: result.data[0].routine_image_url,
                    week_number: result.data[0].week_number,
                    week_start_date: result.data[0].week_start_date,
                    week_end_date: result.data[0].week_end_date,
                    course_title: result.data[0].course_title,
                    is_current_week: true
                }
            };
        }
        
        // Fallback: Get the most recent active routine (by week_end_date)
        var fallbackQuery = `
            SELECT 
                r.id,
                r.course_id,
                r.week_number,
                r.routine_image_url,
                r.week_start_date,
                r.week_end_date,
                c.title as course_title
            FROM ${this.table} r
            JOIN course c ON r.course_id = c.id
            WHERE r.course_id = $1
                AND r.is_active = true
            ORDER BY r.week_end_date DESC
            LIMIT 1
        `;
        var fallbackResult = await this.query(fallbackQuery, params);
        
        if (fallbackResult.success && fallbackResult.data.length > 0) {
            return {
                success: true,
                data: {
                    routine_image_url: fallbackResult.data[0].routine_image_url,
                    week_number: fallbackResult.data[0].week_number,
                    week_start_date: fallbackResult.data[0].week_start_date,
                    week_end_date: fallbackResult.data[0].week_end_date,
                    course_title: fallbackResult.data[0].course_title,
                    is_current_week: false
                },
                message: 'Showing most recent routine (no routine for current week)'
            };
        }
        
        return {
            success: true,
            data: null,
            message: 'No active routine found for this course'
        };
    };

    // Create a new routine
    create = async (course_id, reqObj) => {
        var query = `
            INSERT INTO ${this.table}${this.getColumns()} 
            VALUES ${this.getWildCards()} 
            RETURNING ${this.pk}
        `;
        var params = [...this.cols.map(c => reqObj[c]), course_id];
        var result = await this.query(query, params);
        return result;
    };

    // Update routine
    update = async (id, reqObj) => {
        var query = `
            UPDATE ${this.table} 
            SET ${this.getUpdatePairs()} 
            WHERE ${this.pk} = $${this.cols.length + 1}
        `;
        var params = [...this.cols.map(c => reqObj[c]), id];
        var result = await this.query(query, params);
        return result;
    };

    // Get single routine
    get = async (id) => {
        var query = `
            SELECT r.*, c.title as course_title 
            FROM ${this.table} r
            JOIN course c ON r.course_id = c.id
            WHERE r.${this.pk} = $1
        `;
        var params = [id];
        var result = await this.query(query, params);
        return result;
    };

    // Delete routine
    deleteEntry = async (id) => {
        var query = `DELETE FROM ${this.table} WHERE ${this.pk} = $1`;
        var params = [id];
        var result = await this.query(query, params);
        return result;
    };

    // Toggle routine active status
    toggleActive = async (id, is_active) => {
        var query = `
            UPDATE ${this.table} 
            SET is_active = $1, updated_at = CURRENT_TIMESTAMP
            WHERE ${this.pk} = $2
        `;
        var params = [is_active, id];
        var result = await this.query(query, params);
        return result;
    };
}

module.exports = { RoutineService };
