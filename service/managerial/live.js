const { default: axios } = require('axios');
const { managerialAccountTypes } = require('../../util/constants');
const MessagingService=require('../../service/messagingService').MessagingService
const Service = require('../base').Service;

const messagingService=new MessagingService()

class LiveService extends Service {
    constructor() {
        super();
    }
    table=`live`
    pk=`id`
    fk=`course_id`
    cols=[
        `title`,
        `description`,
        `thumbnail`,
        `can_join`,
        `scheduled_at`,
        `duration`,
        `meeting_id`,
        `meeting_pass`,
        `teacher_id`,
        `data`
    ]
    types=[
        `string`,
        `string`,
        `string`,
        `boolean`,
        `integer`,
        `string`,
        `string`,
        `string`,
        `integer`,
        `object`
    ]
    getColumns=()=>{
        var result=`(`
        this.cols.map((c,i)=>{
            result+=`${c},`
        })
        result+=`${this.fk}`
        return `${result})`
    }
    getWildCards=()=>{
        var result=`(`
        var fields=[...this.cols,this.fk]
        fields.map((_,i)=>{
            result+=`$${(i+1)}`;
            if(i<fields.length-1)result+=','
        })
        return result+')'
    }
    getUpdatePairs=()=>{
        var result=``
        this.cols.map((c,i)=>{
            result+=`
                ${c} = $${(i+1)}`
                if(i<this.cols.length-1)result+=','
        })
        return result
    }
    
    list=async (req, access)=>{
        const baseSelect = `select t.*, c.title as course_title, (
                SELECT count(*) from interest 
                WHERE live_id=t.id
                ) AS interested from ${this.table} t, course c where t.course_id=c.id`;

        if (access && access.hasGlobalAccess) {
            var query = `${baseSelect} order by scheduled_at`;
            var result = await this.query(query, []);
            result.data = result.data.map(d=>{return {...d,interested:parseInt(d.interested)}});
            return result;
        } else if (access && !access.hasGlobalAccess) {
            var query = `${baseSelect} and c.id = ANY($1) order by scheduled_at`;
            var result = await this.query(query, [access.courseIds]);
            result.data = result.data.map(d=>{return {...d,interested:parseInt(d.interested)}});
            return result;
        } else if(req.body.user_type===managerialAccountTypes.admin){
            var query=`${baseSelect} order by scheduled_at`
            var result=await this.query(query,[])
            result.data=result.data.map(d=>{return {...d,interested:parseInt(d.interested)}})
            return result
        }else{
            var query=`select t.*, c.title as course_title, (
                SELECT count(*) from interest 
                WHERE live_id=t.id
                ) AS interested from ${this.table} t, course c where t.teacher_id=$1 and t.course_id=c.id order by scheduled_at`
            var result=await this.query(query,[req.body.user_id])
            result.data=result.data.map(d=>{return {...d,interested:parseInt(d.interested)}})
            return result
        }
    }

    listForUser=async (user_id,fk_id)=>{
        var query=`select id,data,title,description,thumbnail,can_join,scheduled_at,duration, EXISTS (
            SELECT * from interest 
            WHERE user_id = $1
            AND live_id=t.id
            ) AS interested from ${this.table} t where ${this.fk} = $2 order by scheduled_at`
        var params=[user_id,fk_id]
        var result=await this.query(query,params)
        return {...result,data:{list:result.data,serverTimeStamp:parseInt(Date.now()/1000)}}
    }

    // create=async (fk_id,reqObj)=>{
    //     var query=`
    //         insert into ${this.table}${this.getColumns()} values ${this.getWildCards()} returning ${this.pk}
    //     `
    //     var params=[...this.cols.map(c=>{return reqObj[c]}),fk_id]
    //     var result=await Promise.all([this.query(query,params),this.query(`select login,name from managerial_auth where id = $1`,[reqObj.teacher_id])])
    //     try{
    //         var text=`Dear ${result[1].data[0].name}, you are assigned a new live class on mathpro.com titled "${reqObj.title}" scheduled at ${new Date(reqObj.scheduled_at*1000).toLocaleString()}%0A%0AZoom meeting id: ${reqObj.meeting_id}%0Apassword: ${reqObj.meeting_pass}`
    //         await messagingService.sendMessage(result[1].data[0].login,text)
    //     }catch(err){
    //         console.log(err)
    //     }
    //     var notitification_query = `INSERT INTO notification (TYPE, data, user_id, course_id, is_read, timestamp)
    //                 SELECT
    //                 	$1 AS TYPE,
	//                     json_build_object('title', 'A new live is scheduled titled ${reqObj.title}, it will be started at ${new Date(reqObj.scheduled_at*1000).toLocaleString()}', 'body', '', 'moduleData', json_build_object('liveId', l.id, 'title', l.title)) AS data,
	//                     t.user_id AS user_id,
	//                     l.course_id AS course_id,
	//                     $2 AS is_read,
	//                     $3 AS timestamp
    //                 FROM
	//                     live l
	//                     JOIN takes t ON l.course_id = t.course_id
    //                 WHERE
	//                     l.id = $4`;
    //     var notification_params = ['LIVE',false,parseInt(Date.now()/1000),result[0].data[0].id];
    //     var notitification_generator = await this.query(notitification_query,notification_params);
    //     return result[0]
    // }
    create=async (fk_id,reqObj)=>{
        var query=`
            insert into ${this.table}${this.getColumns()} values ${this.getWildCards()} returning ${this.pk}
        `
        var params=[...this.cols.map(c=>{return reqObj[c]}),fk_id]
        var result=await Promise.all([this.query(query,params),this.query(`select login,name from managerial_auth where id = $1`,[reqObj.teacher_id])])
        try{
            var text=`Dear ${result[1].data[0].name}, you are assigned a new live class on mathpro.com titled "${reqObj.title}" scheduled at ${new Date(reqObj.scheduled_at*1000).toLocaleString()}%0A%0AZoom meeting id: ${reqObj.meeting_id}%0Apassword: ${reqObj.meeting_pass}`
            await messagingService.sendMessage(result[1].data[0].login,text)
        }catch(err){
            console.error('Live create: failed to send teacher message');
        }
        var notitification_query = `INSERT INTO notification (TYPE, data, user_id, course_id, is_read, timestamp)
                    SELECT
                    	$1 AS TYPE,
	                    json_build_object('title', 'A new live is scheduled titled ${reqObj.title}, it will be started at ${new Date(reqObj.scheduled_at*1000).toLocaleString()}', 'body', '', 'moduleData', json_build_object('liveId', l.id, 'title', l.title)) AS data,
	                    t.user_id AS user_id,
	                    l.course_id AS course_id,
	                    $2 AS is_read,
	                    $3 AS timestamp
                    FROM
	                    live l
	                    JOIN takes t ON l.course_id = t.course_id
                    WHERE
	                    l.id = $4`;
        var notification_params = ['LIVE',false,parseInt(Date.now()/1000),result[0].data[0].id];
        var notitification_generator = await this.query(notitification_query,notification_params);
        return result[0]
    }
    update=async (id,reqObj)=>{
        var query=`
            update ${this.table} set ${this.getUpdatePairs()} where ${this.pk}=$${(this.cols.length+1)}
        `
        var params=[...this.cols.map(c=>{return reqObj[c]}),id]
        var result=await this.query(query,params)
        return result
    }
    get = async id=>{
        var query=`select t.* , (
                SELECT count(*) from interest 
                WHERE live_id=t.id
            ) AS interested from ${this.table} t where ${this.pk}=$1`
        var params=[id]
        var result=await this.query(query,params)
        result.data=result.data.map(d=>{return {...d,interested:parseInt(d.interested)}})
        return result
    }

    getForUser = async (user_id,id)=>{
        var query=`select id,title,data,description,thumbnail,can_join,scheduled_at,duration, EXISTS (
            SELECT * from interest 
            WHERE user_id = $1
            AND live_id=t.id
            ) AS interested from ${this.table} t where id = $2 order by scheduled_at`
        var params=[user_id,id]
        var result=await this.query(query,params)
        return result
    }

    deleteEntry =async id=>{
        var query=`delete from ${this.table} where ${this.pk}=$1`
        var params=[id]
        var result=await this.query(query,params)
        return result
    }

    showInterest =async (user_id,live_id)=>{
        var query=`insert into interest(user_id,live_id) values($1 , $2)`
        var params=[user_id,live_id]
        var result=await this.query(query,params)
        return result
    }

    interestCount =async (live_id)=>{
        var query=`select count(*) as n from interest where live_id = $1`
        var params=[live_id]
        var result=await this.query(query,params)
        return {...result,data:{count:parseInt(result.data[0].n)}}
    }

    addFeed=async (user_id,live_id,feed)=>{
        var query=`insert into live_feed (user_id,live_id,feed,timestamp) values ($1,$2,$3,$4)`
        var params=[user_id,live_id,feed,parseInt(Date.now()/1000)]
        var result=await this.query(query,params)
        return result
    }

    getAllFeedsForALive = async (live_id) => {
        var query = `
            SELECT lf.*, ma.*
            FROM live_feed lf
            JOIN managerial_auth ma ON lf.user_id = ma.id
            WHERE lf.live_id = $1
            ORDER BY lf.timestamp DESC
        `;
        var params = [live_id];
        var result = await this.query(query, params);
        return result;
    }

    /**
     * Validate a single live class entry
     * @param {object} liveData - Live class data object
     * @param {number} index - Index in the array (for error reporting)
     * @returns {object} { valid: boolean, errors: array }
     */
    validateLiveData = (liveData, index) => {
        const errors = [];
        const prefix = `Entry ${index + 1}`;

        // Required fields
        if (!liveData.course_id || !Number.isInteger(liveData.course_id)) {
            errors.push(`${prefix}: course_id is required and must be an integer`);
        }
        if (!liveData.title || typeof liveData.title !== 'string' || liveData.title.trim() === '') {
            errors.push(`${prefix}: title is required and must be a non-empty string`);
        }
        if (!liveData.scheduled_at || !Number.isInteger(liveData.scheduled_at)) {
            errors.push(`${prefix}: scheduled_at is required and must be a unix timestamp (integer)`);
        }

        // Optional field type validation
        if (liveData.description !== undefined && typeof liveData.description !== 'string') {
            errors.push(`${prefix}: description must be a string`);
        }
        if (liveData.thumbnail !== undefined && typeof liveData.thumbnail !== 'string') {
            errors.push(`${prefix}: thumbnail must be a string`);
        }
        if (liveData.can_join !== undefined && typeof liveData.can_join !== 'boolean') {
            errors.push(`${prefix}: can_join must be a boolean`);
        }
        if (liveData.duration !== undefined && typeof liveData.duration !== 'string') {
            errors.push(`${prefix}: duration must be a string`);
        }
        if (liveData.meeting_id !== undefined && typeof liveData.meeting_id !== 'string') {
            errors.push(`${prefix}: meeting_id must be a string`);
        }
        if (liveData.meeting_pass !== undefined && typeof liveData.meeting_pass !== 'string') {
            errors.push(`${prefix}: meeting_pass must be a string`);
        }
        if (liveData.teacher_id !== undefined && liveData.teacher_id !== null && !Number.isInteger(liveData.teacher_id)) {
            errors.push(`${prefix}: teacher_id must be an integer`);
        }
        if (liveData.data !== undefined && (typeof liveData.data !== 'object' || Array.isArray(liveData.data))) {
            errors.push(`${prefix}: data must be an object`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Bulk import live classes from JSON
     * @param {array} liveClasses - Array of live class objects
     * @param {boolean} skipNotifications - Skip sending notifications (default: true for bulk)
     * @returns {Promise<object>} Import result with success/failure counts
     */
    bulkImport = async (liveClasses, skipNotifications = true) => {
        // Validate all entries first
        const allErrors = [];
        const validatedData = [];

        for (let i = 0; i < liveClasses.length; i++) {
            const validation = this.validateLiveData(liveClasses[i], i);
            if (!validation.valid) {
                allErrors.push(...validation.errors);
            } else {
                validatedData.push(liveClasses[i]);
            }
        }

        if (allErrors.length > 0) {
            return {
                success: false,
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: allErrors,
                validCount: validatedData.length,
                invalidCount: liveClasses.length - validatedData.length
            };
        }

        // Verify all course_ids exist
        const courseIds = [...new Set(liveClasses.map(l => l.course_id))];
        const courseCheck = await this.query(
            `SELECT id FROM course WHERE id = ANY($1)`,
            [courseIds]
        );
        
        if (!courseCheck.success) {
            return {
                success: false,
                error: 'Failed to verify course IDs',
                code: 'DATABASE_ERROR'
            };
        }

        const existingCourseIds = new Set(courseCheck.data.map(c => c.id));
        const invalidCourseIds = courseIds.filter(id => !existingCourseIds.has(id));
        
        if (invalidCourseIds.length > 0) {
            return {
                success: false,
                error: `Invalid course IDs: ${invalidCourseIds.join(', ')}`,
                code: 'INVALID_COURSE_IDS'
            };
        }

        // Verify teacher_ids if provided
        const teacherIds = [...new Set(liveClasses.filter(l => l.teacher_id).map(l => l.teacher_id))];
        if (teacherIds.length > 0) {
            const teacherCheck = await this.query(
                `SELECT id FROM managerial_auth WHERE id = ANY($1)`,
                [teacherIds]
            );
            
            if (!teacherCheck.success) {
                return {
                    success: false,
                    error: 'Failed to verify teacher IDs',
                    code: 'DATABASE_ERROR'
                };
            }

            const existingTeacherIds = new Set(teacherCheck.data.map(t => t.id));
            const invalidTeacherIds = teacherIds.filter(id => !existingTeacherIds.has(id));
            
            if (invalidTeacherIds.length > 0) {
                return {
                    success: false,
                    error: `Invalid teacher IDs: ${invalidTeacherIds.join(', ')}`,
                    code: 'INVALID_TEACHER_IDS'
                };
            }
        }

        // Begin transaction
        const client = await this.getClient();
        const insertedIds = [];
        const failedEntries = [];

        try {
            await client.query('BEGIN');

            for (let i = 0; i < liveClasses.length; i++) {
                const live = liveClasses[i];
                
                // Prepare values with defaults
                const values = [
                    live.title,
                    live.description || null,
                    live.thumbnail || null,
                    live.can_join !== undefined ? live.can_join : false,
                    live.scheduled_at,
                    live.duration || null,
                    live.meeting_id || null,
                    live.meeting_pass || null,
                    live.teacher_id || null,
                    live.data || {},
                    live.course_id
                ];

                const insertQuery = `
                    INSERT INTO ${this.table} ${this.getColumns()} 
                    VALUES ${this.getWildCards()} 
                    RETURNING ${this.pk}
                `;

                try {
                    const result = await client.query(insertQuery, values);
                    insertedIds.push({
                        index: i,
                        id: result.rows[0].id,
                        title: live.title
                    });
                } catch (insertError) {
                    failedEntries.push({
                        index: i,
                        title: live.title,
                        error: insertError.message
                    });
                }
            }

            if (failedEntries.length > 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'Some entries failed to insert',
                    code: 'PARTIAL_FAILURE',
                    inserted: [],
                    failed: failedEntries
                };
            }

            await client.query('COMMIT');
            
            return {
                success: true,
                message: `Successfully imported ${insertedIds.length} live class(es)`,
                data: {
                    imported_count: insertedIds.length,
                    imported: insertedIds
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Bulk import error:', error);
            return {
                success: false,
                error: 'Failed to import live classes',
                code: 'IMPORT_FAILED',
                details: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get live classes data for export
     * @param {number|null} courseId - Optional course ID filter
     * @returns {Promise<object>} Export data
     */
    getExportData = async (courseId = null, courseIds = null) => {
        let query = `
            SELECT 
                l.id,
                l.course_id,
                c.title as course_title,
                l.title,
                l.description,
                l.thumbnail,
                l.can_join,
                l.scheduled_at,
                l.duration,
                l.meeting_id,
                l.meeting_pass,
                l.teacher_id,
                ma.name as teacher_name,
                l.data,
                (SELECT count(*) FROM interest WHERE live_id = l.id) as interested_count
            FROM ${this.table} l
            LEFT JOIN course c ON l.course_id = c.id
            LEFT JOIN managerial_auth ma ON l.teacher_id = ma.id
        `;
        
        const params = [];
        
        if (courseId) {
            query += ` WHERE l.course_id = $1`;
            params.push(courseId);
        } else if (courseIds && courseIds.length > 0) {
            query += ` WHERE l.course_id = ANY($1)`;
            params.push(courseIds);
        }
        
        query += ` ORDER BY l.scheduled_at DESC`;
        
        const result = await this.query(query, params);
        
        if (!result.success) {
            return {
                success: false,
                error: 'Failed to fetch live classes for export',
                code: 'EXPORT_FETCH_FAILED'
            };
        }
        
        return {
            success: true,
            data: result.data
        };
    }

    /**
     * Bulk delete live classes by IDs
     * @param {array} ids - Array of live class IDs to delete
     * @returns {Promise<object>} Delete result
     */
    bulkDelete = async (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) {
            return {
                success: false,
                error: 'IDs array is required and must not be empty',
                code: 'VALIDATION_ERROR'
            };
        }

        // Validate all IDs are integers
        const invalidIds = ids.filter(id => !Number.isInteger(id));
        if (invalidIds.length > 0) {
            return {
                success: false,
                error: 'All IDs must be integers',
                code: 'VALIDATION_ERROR',
                invalidIds
            };
        }

        const client = await this.getClient();

        try {
            await client.query('BEGIN');

            // First, check which IDs exist
            const existCheck = await client.query(
                `SELECT id FROM ${this.table} WHERE id = ANY($1)`,
                [ids]
            );

            const existingIds = existCheck.rows.map(r => r.id);
            const notFoundIds = ids.filter(id => !existingIds.includes(id));

            if (existingIds.length === 0) {
                await client.query('ROLLBACK');
                return {
                    success: false,
                    error: 'None of the provided IDs exist',
                    code: 'NOT_FOUND',
                    notFoundIds: ids
                };
            }

            // Delete related interests first
            await client.query(
                `DELETE FROM interest WHERE live_id = ANY($1)`,
                [existingIds]
            );

            // Delete related feeds
            await client.query(
                `DELETE FROM live_feed WHERE live_id = ANY($1)`,
                [existingIds]
            );

            // Delete the live classes
            const deleteResult = await client.query(
                `DELETE FROM ${this.table} WHERE id = ANY($1) RETURNING id, title`,
                [existingIds]
            );

            await client.query('COMMIT');

            return {
                success: true,
                message: `Successfully deleted ${deleteResult.rowCount} live class(es)`,
                data: {
                    deleted_count: deleteResult.rowCount,
                    deleted: deleteResult.rows,
                    not_found: notFoundIds.length > 0 ? notFoundIds : undefined
                }
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Bulk delete error:', error);
            return {
                success: false,
                error: 'Failed to delete live classes',
                code: 'DELETE_FAILED',
                details: error.message
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get JSON template for bulk import
     * @param {boolean} withExample - Include example data
     * @returns {object} Template structure
     */
    getImportTemplate = (withExample = true) => {
        const template = {
            description: 'JSON template for bulk importing live classes',
            version: '1.0',
            live_classes: []
        };

        if (withExample) {
            template.live_classes = [
                {
                    course_id: 1,
                    title: 'Introduction to Programming - Live Session',
                    description: 'A live session covering the basics of programming',
                    thumbnail: 'https://example.com/thumbnails/live1.jpg',
                    can_join: true,
                    scheduled_at: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
                    duration: '60',
                    meeting_id: '123456789',
                    meeting_pass: 'abc123',
                    teacher_id: 1,
                    data: {
                        topics: ['variables', 'loops', 'functions']
                    }
                },
                {
                    course_id: 1,
                    title: 'Advanced Topics - Q&A Session',
                    description: 'Interactive Q&A session for advanced learners',
                    thumbnail: null,
                    can_join: false,
                    scheduled_at: Math.floor(Date.now() / 1000) + 172800, // Day after tomorrow
                    duration: '90',
                    meeting_id: '987654321',
                    meeting_pass: 'xyz789',
                    teacher_id: 2,
                    data: {}
                }
            ];
        }

        template.field_descriptions = {
            course_id: 'Required. Integer. ID of the course this live class belongs to.',
            title: 'Required. String. Title of the live class.',
            description: 'Optional. String. Description of the live class.',
            thumbnail: 'Optional. String. URL of the thumbnail image.',
            can_join: 'Optional. Boolean. Whether users can join the meeting. Defaults to false.',
            scheduled_at: 'Required. Integer. Unix timestamp of when the live class is scheduled.',
            duration: 'Optional. String. Duration of the live class (e.g., "60" for 60 minutes).',
            meeting_id: 'Optional. String. Zoom/Meeting ID.',
            meeting_pass: 'Optional. String. Meeting password.',
            teacher_id: 'Optional. Integer. ID of the assigned teacher.',
            data: 'Optional. Object. Additional JSON data for the live class.'
        };

        return template;
    }
}

module.exports = {LiveService}
