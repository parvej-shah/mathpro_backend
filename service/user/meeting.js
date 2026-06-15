const Service = require('../base').Service;
const KJUR = require('jsrsasign')

class MeetingService extends Service {
    constructor() {
        super();
    }
    
    getSignature=async (meetingNumber,role)=>{
        const iat = Math.round(new Date().getTime() / 1000) - 30;
        const exp = iat + 60 * 60 * 2

        const oHeader = { alg: 'HS256', typ: 'JWT' }

        const oPayload = {
            sdkKey: process.env.ZOOM_MEETING_SDK_KEY,
            mn: meetingNumber,
            role: role,
            iat: iat,
            exp: exp,
            appKey: process.env.ZOOM_MEETING_SDK_KEY,
            tokenExp: iat + 60 * 60 * 2
        }

        const sHeader = JSON.stringify(oHeader)
        const sPayload = JSON.stringify(oPayload)
        const signature = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, process.env.ZOOM_MEETING_SDK_SECRET)

       return signature
    }

    getMeetingProps=async (userId,liveId)=>{

        try{
            var results=await Promise.all([
                this.query(`select * from managerial_auth where id = $1`,[userId]),        
                this.query(`select live.*,course.url from live,course where live.id = $1 and live.course_id=course.id`,[liveId])        
            ])

            if(results[0].success && results[1].success && results[0].data.length>0 && results[1].data.length>0){
                var user=results[0].data[0]
                var live=results[1].data[0]
                if(live.scheduled_at>parseInt(Date.now()/1000)){
                    return {
                        success:false,
                        data:'Wait for the schedule'
                    }
                }else if(!live.can_join){
                    return {
                        success:false,
                        data:'Cannot Join'
                    }
                }else{
                    var signature=await this.getSignature(live.meeting_id,0)
                    return {
                        success:true,
                        data:{
                            signature: signature,
                            sdkKey: process.env.ZOOM_MEETING_SDK_KEY,
                            meetingNumber: live.meeting_id,
                            passWord: live.meeting_pass,
                            userName: `${user.name}_${user.login}`,
                            userEmail: '',
                            tk: '',
                            zak: '',
                            leaveUrl:`${live.url}/live-class`
                        }
                    }
                }
                
            }else
                return {
                    success:false,
                    data:'Unknown Error'
                }
        }catch(err){
            return {
                success:false,
                data:'Unknown Error'
            }
        }
        
    }
    
}

module.exports = {MeetingService}