
const Service = require('../base').Service;

var supportIssueListeners={
        
}
class SupportService extends Service {
    constructor() {
        super();
    }
    createIssue=async (userId,data)=>{
        var query=`insert into issue(user_id,data,status,timestamp) values ($1,$2,$3,$4)`
        var params=[userId,data,'Pending',parseInt(Date.now()/1000)]
        var result=await this.query(query,params)
        return result
    }
    reOpenIssue=async (issueId)=>{
        var query=`update issue set status=$1 where id=$2`
        var params=['Pending',issueId]
        var result=await this.query(query,params)
        return result
    }
    resolveIssue=async (issueId)=>{
        console.log(issueId)
        var query=`update issue set status=$1 where id=$2`
        var params=['Resolved',issueId]
        var result=await this.query(query,params)
        return result
    }
    createResponse=async (userId,issueId,data)=>{
        var query=`insert into response(user_id,issue_id,data,timestamp) values ($1,$2,$3,$4)`
        var params=[userId,issueId,data,parseInt(Date.now()/1000)]
        var result=await this.query(query,params)
        if(Object.keys(supportIssueListeners).indexOf(`${issueId}`)>=0){
            var resultTmp= await this.getResponses(issueId)
            console.log(supportIssueListeners[`${issueId}`])
            for(var i=0;i<supportIssueListeners[`${issueId}`].length;i++)
                await supportIssueListeners[`${issueId}`][i].status(resultTmp.success?200:400).json(resultTmp)
            supportIssueListeners[`${issueId}`]=[]
        }
        return result
    }
    getAllPendingIssues=async ()=>{
        var issuesQuery=`select i.*,a.name,a.type,a.profile from issue i, managerial_auth a where i.user_id=a.id and i.status=$1 order by i.timestamp desc`
        var issuesParams=['Pending']
        var issuesResult=await this.query(issuesQuery,issuesParams)
        return issuesResult
    }
    getMyIssues=async (userId)=>{
        var issuesQuery=`select i.*,a.name,a.type,a.profile from issue i, managerial_auth a where i.user_id=a.id and a.id=$1  order by i.timestamp desc`
        var issuesParams=[userId]
        var issuesResult=await this.query(issuesQuery,issuesParams)
        return issuesResult
    }

    getResponses=async (issueId)=>{
        var query=`select r.*,a.name,a.type,a.profile from response r, managerial_auth a where r.user_id=a.id and r.issue_id=$1 order by r.timestamp`
        var params=[issueId]
        var result=await this.query(query,params)
        return result
    }
    



    getResponsesLongPolling=async (issueId,res)=>{
        if(Object.keys(supportIssueListeners).indexOf(`${issueId}`)<0)
            supportIssueListeners[`${issueId}`]=[]
        supportIssueListeners[`${issueId}`].push(res)
    }

    
    
}

module.exports = {SupportService}