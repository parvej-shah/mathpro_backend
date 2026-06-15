const Service = require('../base').Service;
const CourseService=require('./course').CourseService

const courseService=new CourseService()

class LevelService extends Service {
    constructor() {
        super();
    }
    table=`level`
    pk=`id`
    fk=`course_id`
    cols=[
        `title`,
        `threshold`,
        `logo`,
        `data`
    ]
    types=[
        `string`,
        `integer`,
        `string`,
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
    
    list=async (fk_id)=>{
        var query=`select * from ${this.table} where ${this.fk} = $1 order by threshold`
        var params=[fk_id]
        var result=await this.query(query,params)
        return result
    }
    create=async (fk_id,reqObj)=>{
        var query=`
            insert into ${this.table}${this.getColumns()} values ${this.getWildCards()} returning ${this.pk}
        `
        var params=[...this.cols.map(c=>{return reqObj[c]}),fk_id]
        var result=await this.query(query,params)
        return result
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
        var query=`select * from ${this.table} where ${this.pk}=$1`
        var params=[id]
        var result=await this.query(query,params)
        return result
    }

    deleteEntry =async id=>{
        var query=`delete from ${this.table} where ${this.pk}=$1`
        var params=[id]
        var result=await this.query(query,params)
        return result
    }

    requestGift=async (level_id,user_id)=>{
        var query=`insert into gift(level_id,user_id,request_timestamp) values ($1,$2,$3)`
        var params=[level_id,user_id,parseInt(Date.now()/1000)]
        var result=await this.query(query,params)
        return result
    }

    getGiftRequests=async (access)=>{
        let query=`
            select g.*,l.*,a.*,c.title as course_name,(SELECT SUM(p.point) as s from progress p,module m,chapter ch where p.user_id=a.id and p.module_id=m.id and m.chapter_id=ch.id and ch.course_id=c.id) as totalScore 
            from gift g, managerial_auth a, level l, course c 
            where g.level_id=l.id
                and g.user_id=a.id
                and l.course_id=c.id
                and g.confirm_timestamp is null
        `
        let params=[]
        if (access && !access.hasGlobalAccess) {
            query += ` and c.id = ANY($1)`
            params = [access.courseIds]
        }
        var result=await this.query(query,params)
        return result
    }

    approveGift=async (level_id,user_id)=>{
        var query=`update gift set confirm_timestamp = $1 where level_id = $2 and user_id = $3`
        var params=[parseInt(Date.now()/1000),level_id,user_id]
        var result=await this.query(query,params)
        return result
    }

    getGiftsPage=async (user_id,course_id)=>{
        var results=await Promise.all([
            courseService.getScore({user_id},course_id),
            this.query(`
                select l.*,(select request_timestamp from gift g where g.user_id=$1 and g.level_id=l.id) as request_timestamp,(select confirm_timestamp from gift g where g.user_id=$2 and g.level_id=l.id) as confirm_timestamp from level l where l.course_id=$3
            `,[
                user_id,user_id,course_id
            ])
        ])
        return {
            success:results[0].success&&results[1].success,
            data:{
                score:results[0].data.score,
                gifts:results[1].data
            }
        }
    }
}

module.exports = {LevelService}