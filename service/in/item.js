const Service = require('../base').Service;


class ItemService extends Service {
    constructor() {
        super();
    }

    list=async (platform,level,parentId)=>{
        var query=`select * from in_pr where platform=$1 and level=$2 ${level>0?`and parent_id=$3`:``} order by timestamp desc`
        var params=level>0?[platform,level,parentId]:[platform,level]
        var result=await this.query(query,params)
        return result
    }

    create=async (platform,level,parentId,data)=>{
        var query=`
            insert into in_pr(platform,level,data,timestamp${level>0?`,parent_id`:``}) values ($1,$2,$3,$4${level>0?`,$5`:``}) returning *
        `
        var params=level>0?[platform,level,data,parseInt(Date.now()/1000),parentId]:[platform,level,data,parseInt(Date.now()/1000)]
        var result=await this.query(query,params)
        return result
    }
    update=async (id,data)=>{
        var query=`
            update in_pr set data=$1, timestamp=$2 where id=$3 returning *
        `
        var params=[data,parseInt(Date.now()/1000),id]
        var result=await this.query(query,params)
        return result
    }

    deleteEntry =async id=>{
        var query=`delete from in_pr where id=$1`
        var params=[id]
        var result=await this.query(query,params)
        return result
    }

    qrVisit =async (title,link)=>{
        var query=`insert into qr(title,link,timestamp) values ($1,$2,$3)`
        var params=[title,link,parseInt(Date.now()/1000)]
        var result=await this.query(query,params)
        return result
    }
}

module.exports = {ItemService}