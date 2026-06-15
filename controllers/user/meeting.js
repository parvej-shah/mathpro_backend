const Controller = require("../base").Controller;
const MeetingService=require("../../service/user/meeting.js").MeetingService

const meetingService=new MeetingService()

class MeetingController extends Controller {
    constructor() {
        super();
    }

    getMeetingProps =async (req,res)=>{
        var result=await meetingService.getMeetingProps(req.body.user_id,parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }
}

module.exports={MeetingController}

