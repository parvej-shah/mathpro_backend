const { ContestService } = require("../../service/managerial/contest.js");
const { checkCourseAccess, assertCourseAccess, getAccessibleCourseIds } = require("../../util/courseAccessHelpers");

const Controller = require("../base.js").Controller;

const contestService=new ContestService()

class ContestController extends Controller {
    constructor() {
        super();
    }
    list =async (req,res)=>{
        try {
            console.log("Listing contests for course ID:", req.params.id);
            var result=await contestService.list(req.params.id)
            return res.status(result.success?200:400).json(result)
        } catch (error) {
            console.error("Error in list controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    create =async (req,res)=>{
        try {
            console.log("Creating contest for course ID:", req.params.id);
            console.log("Request body:", JSON.stringify(req.body, null, 2));
            
            const courseId = parseInt(req.params.id);
            const userId = req.user.id;
            
            // Check course access for create operation
            const access = await checkCourseAccess(userId, 'contest', 'manage', courseId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: 'No access to this course'
                });
            }
            
            // Handle case when data is nested inside a 'data' property
            const contestData = req.body.data || req.body;
            
            var result=await contestService.create(courseId, contestData)
            return res.status(result.success?200:400).json(result)
        } catch (error) {
            console.error("Error in create controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    update =async (req,res)=>{
        try {
            console.log("Updating contest ID:", req.params.id);
            console.log("Request body:", JSON.stringify(req.body, null, 2));
            
            const contestId = parseInt(req.params.id);
            const userId = req.user.id;
            
            // Use assertCourseAccess to resolve courseId and check access
            const access = await assertCourseAccess(userId, 'contest', 'manage', 'contest', contestId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: access.reason === 'resource_not_found' ? 'Contest not found' : 'No access to this course'
                });
            }
            
            // Handle case when data is nested inside a 'data' property
            const contestData = req.body.data || req.body;
            
            var result=await contestService.update(contestId, contestData)
            return res.status(result.success?200:400).json(result)
        } catch (error) {
            console.error("Error in update controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    getEntry =async (req,res)=>{
        try {
            console.log("Getting contest ID:", req.params.id);
            var result=await contestService.get(req.params.id)
            return res.status(result.success?200:400).json(result)
        } catch (error) {
            console.error("Error in getEntry controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    deleteEntry =async (req,res)=>{
        try {
            console.log("Deleting contest ID:", req.params.id);
            
            const contestId = parseInt(req.params.id);
            const userId = req.user.id;
            
            // Use assertCourseAccess to resolve courseId and check access
            const access = await assertCourseAccess(userId, 'contest', 'manage', 'contest', contestId);
            if (!access.hasAccess) {
                return res.status(403).json({
                    success: false,
                    error: 'NO_COURSE_ACCESS',
                    message: access.reason === 'resource_not_found' ? 'Contest not found' : 'No access to this course'
                });
            }
            
            var result=await contestService.deleteEntry(contestId)
            return res.status(result.success?200:400).json(result)
        } catch (error) {
            console.error("Error in deleteEntry controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    getAllContests = async (req, res) => {
        try {
            const userId = req.user.id;
            const access = await getAccessibleCourseIds(userId, 'contest', 'manage');
            var result = await contestService.getAllContests(access)
            return res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error("Error in getAllContests controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    createParticipantsTable = async (req, res) => {
        try {
            console.log("Creating participants table");
            var result = await contestService.createParticipantsTable()
            return res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error("Error in createParticipantsTable controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    getParticipants = async (req, res) => {
        try {
            console.log("Getting participants for contest ID:", req.params.id);
            var result = await contestService.getParticipants(req.params.id)
            return res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error("Error in getParticipants controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    addParticipant = async (req, res) => {
        try {
            console.log("Adding participant to contest ID:", req.params.id);
            console.log("User ID:", req.body.userId);
            
            var result = await contestService.addParticipant(req.params.id, req.body.userId)
            return res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error("Error in addParticipant controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    removeParticipant = async (req, res) => {
        try {
            console.log("Removing participant from contest ID:", req.params.id);
            console.log("User ID:", req.body.userId);
            
            var result = await contestService.removeParticipant(req.params.id, req.body.userId)
            return res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error("Error in removeParticipant controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    updateParticipantScore = async (req, res) => {
        try {
            console.log("Updating score for contest ID:", req.params.id);
            console.log("User ID:", req.body.userId);
            console.log("New Score:", req.body.score);
            
            var result = await contestService.updateParticipantScore(
                req.params.id, 
                req.body.userId, 
                req.body.score
            )
            
            return res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error("Error in updateParticipantScore controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    getUsers = async (req, res) => {
        try {
            console.log("Getting users with search:", req.query.search || '');
            var result = await contestService.getUsers(req.query.search || '')
            return res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error("Error in getUsers controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    getCoursesForDropdown = async (req, res) => {
        try {
            console.log("Getting courses for dropdown");
            var result = await contestService.getCoursesForDropdown()
            return res.status(result.success ? 200 : 400).json(result)
        } catch (error) {
            console.error("Error in getCoursesForDropdown controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
    
    // New method to get contest leaderboard
    getLeaderboard = async (req, res) => {
        try {
            console.log("Getting leaderboard for contest ID:", req.params.id);
            var result = await contestService.getLeaderboard(req.params.id);
            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error("Error in getLeaderboard controller:", error);
            return res.status(500).json({
                success: false,
                error: "Internal server error"
            });
        }
    }
}

module.exports={ContestController}

