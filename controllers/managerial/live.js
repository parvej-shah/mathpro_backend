const Controller = require("../base").Controller;
const LiveService=require("../../service/managerial/live.js").LiveService;
const ErrorHandler = require('../../util/errorHandler');
const { checkCourseAccess, assertCourseAccess, getAccessibleCourseIds } = require("../../util/courseAccessHelpers");

const liveService=new LiveService()

class LiveController extends Controller {
    constructor() {
        super();
    }
    list =async (req,res)=>{
        const userId = req.user.id;
        const access = await getAccessibleCourseIds(userId, 'live', 'manage');
        var result=await liveService.list(req, access)
        return res.status(result.success?200:400).json(result)
    }
    listForUser =async (req,res)=>{
        var result=await liveService.listForUser(req.body.user_id,parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }
    create =async (req,res)=>{
        const courseId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Check course access for create operation
        const access = await checkCourseAccess(userId, 'live', 'manage', courseId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: 'No access to this course'
            });
        }
        
        var result=await liveService.create(courseId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    update =async (req,res)=>{
        const liveId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'live', 'manage', 'live', liveId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Live session not found' : 'No access to this course'
            });
        }
        
        var result=await liveService.update(liveId,req.body)
        return res.status(result.success?200:400).json(result)
    }
    getEntry =async (req,res)=>{
        const liveId = parseInt(req.params.id);
        const userId = req.user.id;

        const access = await assertCourseAccess(userId, 'live', 'manage', 'live', liveId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Live session not found' : 'No access to this course'
            });
        }

        var result=await liveService.get(liveId)
        return res.status(result.success?200:400).json(result)
    }
    getEntryForUser =async (req,res)=>{
        var result=await liveService.getForUser(req.body.user_id,parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }
    deleteEntry =async (req,res)=>{
        const liveId = parseInt(req.params.id);
        const userId = req.user.id;
        
        // Use assertCourseAccess to resolve courseId and check access
        const access = await assertCourseAccess(userId, 'live', 'manage', 'live', liveId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Live session not found' : 'No access to this course'
            });
        }
        
        var result=await liveService.deleteEntry(liveId)
        return res.status(result.success?200:400).json(result)
    }

    interest =async (req,res)=>{
        var result=await liveService.showInterest(req.body.user_id,parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }

    interestCount =async (req,res)=>{
        const liveId = parseInt(req.params.id);
        const userId = req.user.id;

        const access = await assertCourseAccess(userId, 'live', 'manage', 'live', liveId);
        if (!access.hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'NO_COURSE_ACCESS',
                message: access.reason === 'resource_not_found' ? 'Live session not found' : 'No access to this course'
            });
        }

        var result=await liveService.interestCount(liveId)
        return res.status(result.success?200:400).json(result)
    }

    addFeed=async (req,res)=>{
        var result=await liveService.addFeed(req.body.user_id,parseInt(req.params.id),req.body.feed)
        return res.status(result.success?200:400).json(result)
    }

    getAllFeeds=async (req,res)=>{
        var result=await liveService.getAllFeedsForALive(parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }

    /**
     * POST /admin/live/bulk-import
     * Bulk import live classes from JSON
     */
    bulkImport = async (req, res) => {
        try {
            const { live_classes } = req.body;

            // Validate request body
            if (!live_classes) {
                const { response, statusCode } = ErrorHandler.validationError({
                    live_classes: 'live_classes array is required'
                });
                return res.status(statusCode).json(response);
            }

            if (!Array.isArray(live_classes)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    live_classes: 'live_classes must be an array'
                });
                return res.status(statusCode).json(response);
            }

            if (live_classes.length === 0) {
                const { response, statusCode } = ErrorHandler.validationError({
                    live_classes: 'live_classes array must not be empty'
                });
                return res.status(statusCode).json(response);
            }

            // Limit bulk import size
            const MAX_BULK_SIZE = 100;
            if (live_classes.length > MAX_BULK_SIZE) {
                const { response, statusCode } = ErrorHandler.validationError({
                    live_classes: `Maximum ${MAX_BULK_SIZE} entries allowed per import`
                });
                return res.status(statusCode).json(response);
            }

            // Course access check — verify all course_ids are accessible
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'live', 'manage');
            if (!access.hasGlobalAccess) {
                const requestedCourseIds = [...new Set(live_classes.map(l => l.course_id).filter(Boolean))];
                const forbidden = requestedCourseIds.filter(id => !access.courseIds.includes(id));
                if (forbidden.length > 0) {
                    return res.status(403).json({
                        success: false,
                        error: 'NO_COURSE_ACCESS',
                        message: `No access to course(s): ${forbidden.join(', ')}`
                    });
                }
            }

            const result = await liveService.bulkImport(live_classes);

            if (!result.success) {
                const statusCode = result.code === 'VALIDATION_ERROR' ? 422 : 400;
                return res.status(statusCode).json(result);
            }

            return res.status(201).json(result);

        } catch (error) {
            console.error('Error in bulkImport:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    }

    /**
     * GET /admin/live/export
     * Export live classes to CSV
     * Query params: course_id (optional), format (csv|json, default: csv)
     */
    exportCSV = async (req, res) => {
        try {
            const courseId = req.query.course_id ? parseInt(req.query.course_id) : null;
            const format = req.query.format || 'csv';

            // Validate course_id if provided
            if (req.query.course_id && isNaN(courseId)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    course_id: 'course_id must be a valid integer'
                });
                return res.status(statusCode).json(response);
            }

            // Validate format
            if (format !== 'csv' && format !== 'json') {
                const { response, statusCode } = ErrorHandler.validationError({
                    format: 'format must be either "csv" or "json"'
                });
                return res.status(statusCode).json(response);
            }

            // Course access check
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'live', 'manage');
            if (!access.hasGlobalAccess) {
                // If a specific course_id was requested, verify it's accessible
                if (courseId !== null) {
                    if (!access.courseIds.includes(courseId)) {
                        return res.status(403).json({
                            success: false,
                            error: 'NO_COURSE_ACCESS',
                            message: 'No access to this course'
                        });
                    }
                }
            }

            // For .own users with no course_id filter, scope export to their accessible courses
            // Pass courseId as-is for .all users; for .own users without a specific courseId,
            // getExportData will be called per accessible course or we pass the access object
            const exportCourseId = (!access.hasGlobalAccess && courseId === null)
                ? access.courseIds  // array — handled below
                : courseId;

            const result = await liveService.getExportData(
                Array.isArray(exportCourseId) ? null : exportCourseId,
                Array.isArray(exportCourseId) ? exportCourseId : null
            );

            if (!result.success) {
                return res.status(400).json(result);
            }

            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename="live_classes.json"');
                return res.json({
                    success: true,
                    exported_at: new Date().toISOString(),
                    count: result.data.length,
                    live_classes: result.data
                });
            }

            // CSV format
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="live_classes.csv"');

            // CSV headers
            const headers = [
                'ID',
                'Course ID',
                'Course Title',
                'Title',
                'Description',
                'Thumbnail',
                'Can Join',
                'Scheduled At',
                'Scheduled At (Readable)',
                'Duration',
                'Meeting ID',
                'Meeting Password',
                'Teacher ID',
                'Teacher Name',
                'Interested Count'
            ];

            // Helper function to escape CSV values
            const escapeCSV = (value) => {
                if (value === null || value === undefined) return '';
                const str = String(value);
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            let csv = headers.join(',') + '\n';

            // CSV rows
            result.data.forEach(row => {
                const scheduledDate = row.scheduled_at 
                    ? new Date(row.scheduled_at * 1000).toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })
                    : '';
                
                const csvRow = [
                    row.id,
                    row.course_id,
                    escapeCSV(row.course_title),
                    escapeCSV(row.title),
                    escapeCSV(row.description),
                    escapeCSV(row.thumbnail),
                    row.can_join ? 'Yes' : 'No',
                    row.scheduled_at,
                    escapeCSV(scheduledDate),
                    escapeCSV(row.duration),
                    escapeCSV(row.meeting_id),
                    escapeCSV(row.meeting_pass),
                    row.teacher_id || '',
                    escapeCSV(row.teacher_name),
                    row.interested_count
                ];
                csv += csvRow.join(',') + '\n';
            });

            return res.send(csv);

        } catch (error) {
            console.error('Error in exportCSV:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    }

    /**
     * GET /admin/live/template
     * Get JSON template for bulk import
     * Query params: example (true|false, default: true)
     */
    getImportTemplate = async (req, res) => {
        try {
            const withExample = req.query.example !== 'false';
            const template = liveService.getImportTemplate(withExample);

            return res.status(200).json({
                success: true,
                data: template
            });

        } catch (error) {
            console.error('Error in getImportTemplate:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    }

    /**
     * DELETE /admin/live/bulk-delete
     * Bulk delete live classes by IDs
     */
    bulkDelete = async (req, res) => {
        try {
            const { ids } = req.body;

            // Validate request body
            if (!ids) {
                const { response, statusCode } = ErrorHandler.validationError({
                    ids: 'ids array is required'
                });
                return res.status(statusCode).json(response);
            }

            if (!Array.isArray(ids)) {
                const { response, statusCode } = ErrorHandler.validationError({
                    ids: 'ids must be an array'
                });
                return res.status(statusCode).json(response);
            }

            if (ids.length === 0) {
                const { response, statusCode } = ErrorHandler.validationError({
                    ids: 'ids array must not be empty'
                });
                return res.status(statusCode).json(response);
            }

            // Limit bulk delete size for safety
            const MAX_DELETE_SIZE = 50;
            if (ids.length > MAX_DELETE_SIZE) {
                const { response, statusCode } = ErrorHandler.validationError({
                    ids: `Maximum ${MAX_DELETE_SIZE} entries allowed per delete operation`
                });
                return res.status(statusCode).json(response);
            }

            // Course access check — resolve course_id for each live id and verify access
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'live', 'manage');
            if (!access.hasGlobalAccess) {
                const { Service } = require('../../service/base');
                const svc = new Service();
                const liveRows = await svc.query(
                    'SELECT id, course_id FROM live WHERE id = ANY($1)',
                    [ids]
                );
                if (liveRows.success && liveRows.data.length > 0) {
                    const forbidden = liveRows.data.filter(r => !access.courseIds.includes(r.course_id));
                    if (forbidden.length > 0) {
                        return res.status(403).json({
                            success: false,
                            error: 'NO_COURSE_ACCESS',
                            message: `No access to live session(s): ${forbidden.map(r => r.id).join(', ')}`
                        });
                    }
                }
            }

            const result = await liveService.bulkDelete(ids);

            if (!result.success) {
                const statusCode = result.code === 'NOT_FOUND' ? 404 : 400;
                return res.status(statusCode).json(result);
            }

            return res.status(200).json(result);

        } catch (error) {
            console.error('Error in bulkDelete:', error);
            const { response, statusCode } = ErrorHandler.serverError();
            return res.status(statusCode).json(response);
        }
    }
}

module.exports={LiveController}