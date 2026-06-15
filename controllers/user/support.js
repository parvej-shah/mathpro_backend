const Controller = require("../base.js").Controller;
const SupportService=require("../../service/user/support.js").SupportService

const supportService=new SupportService()

class SupportController extends Controller {
    constructor() {
        super();
    }
    createIssue =async (req,res)=>{
        var result=await supportService.createIssue(req.body.user_id,req.body.data)
        return res.status(result.success?200:400).json(result)
    }
    reOpenIssue =async (req,res)=>{
        var result=await supportService.reOpenIssue(parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }
    resolveIssue =async (req,res)=>{
        var result=await supportService.resolveIssue(parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }
    createResponse =async (req,res)=>{
        var result=await supportService.createResponse(req.body.user_id,parseInt(req.params.id),req.body.data)
        return res.status(result.success?200:400).json(result)
    }
    getAllPendingIssues =async (req,res)=>{
        var result=await supportService.getAllPendingIssues()
        return res.status(result.success?200:400).json(result)
    }
    getMyIssues =async (req,res)=>{
        var result=await supportService.getMyIssues(req.body.user_id)
        return res.status(result.success?200:400).json(result)
    }

    getResponses =async (req,res)=>{
        var result=await supportService.getResponses(req.params.id)
        return res.status(result.success?200:400).json(result)
    }

    getResponsesLongPolling =async (req,res)=>{
        await supportService.getResponsesLongPolling(req.params.id,res)
    }
}

module.exports={SupportController}

