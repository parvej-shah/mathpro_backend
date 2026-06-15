const { Controller } = require("../base");
const { ActivityService } = require("../../service/user/activity");

const activityService=new ActivityService()

class ActivityController extends Controller {

    constructor(){
        super()
    }


    store=async(req,res)=>{
        var result=await activityService.create(req.body.user_id,req.body.url)
        return res.status(result.success?200:400).json(result)
    }

    get=async(req,res)=>{

        var start_date = req.query.start_date;
        var end_date = req.query.end_date;

        if (!start_date || !end_date) {
            const today = new Date();
            end_date = today.toISOString().split('T')[0];
            start_date = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0];
        }


        var result=await activityService.get(req.body.user_id,start_date,end_date)
        return res.status(result.success?200:400).json(result)
    }


}

module.exports={ActivityController}