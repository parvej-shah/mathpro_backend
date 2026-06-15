const Service = require('../base').Service;
const { default: axios } = require('axios');
const bcrypt=require('bcryptjs');
const { managerialAccountTypes } = require('../../util/constants');
const MessagingService=require('../../service/messagingService').MessagingService

const messagingService=new MessagingService()

class TeacherService extends Service {
    constructor() {
        super();
    }
    table=`managerial_auth`
    pk=`id`
    cols=[
        `name`,
        `type`,
        `login`,
        `profile`
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
            result+=c;
            if(i<this.cols.length-1)result+=','
        })
        return result+')'
    }
    getWildCards=()=>{
        var result=`(`
        this.cols.map((_,i)=>{
            result+=`$${(i+1)}`;
            if(i<this.cols.length-1)result+=','
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
    
    list=async ()=>{
        var query=`select * from ${this.table} where type=$1 `
        var params=[managerialAccountTypes.moderator]
        var result=await this.query(query,params)
        if(result.success){
            result.data=result.data.map(row=>{
                return {
                    ...row,
                    selectedCourse:row.profile.selectedCourse
                }
            })
        }
        return result
    }

    getTeacher=async (id)=>{
        var query=`select * from ${this.table} where id=$1 `
        var params=[id]
        var result=await this.query(query,params)
        if(result.success&&result.data.length>0&&result.data[0].profile.selectedCourse.length>0){
            var courseQuery=`select * from course where id in ${JSON.stringify(result.data[0].profile.selectedCourse).replaceAll('[','(').replaceAll(']',')')}`
            var courseParams=[]
            var courseResult=await this.query(courseQuery,courseParams)
            result.data[0].profile.selectedCourse=courseResult.data
        }
        // if(result.success){
        //     result.data=result.data.map(row=>{
        //         return {
        //             ...row,
        //             selectedCourse:row.profile.selectedCourse
        //         }
        //     })
        // }
        return result
    }


    getRandomPin = (chars, len)=>[...Array(len)].map(
        (i)=>chars[Math.floor(Math.random()*chars.length)]
    ).join('');

    create=async (reqObj)=>{
        var password=this.getRandomPin('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',8);
        const salt = await bcrypt.genSalt(10)
        var hashedPassWord = await bcrypt.hash(password,salt)
        var query=`
            insert into ${this.table}(name,type,login,profile,password) values ($1,$2,$3,$4,$5) returning ${this.pk}
        `
        var params=[...this.cols.map(c=>{return reqObj[c]}),hashedPassWord]
        var result=await this.query(query,params)
        if(result.success){
            var text=`Dear ${reqObj.name}, your login credentials for https://teachers.codervai.com is, login:${reqObj.login} and password:${password}`
            var teacherId=result.data[0].id
            var insertValues=``
            reqObj.selectedCourse.map((s,i)=>{
                insertValues+=`(${teacherId},${s})`
                if(i<reqObj.selectedCourse.length-1)
                    insertValues+=`,`
            })
            await Promise.all([
                this.query(`insert into instructor(user_id,course_id) values ${insertValues}`),
                await messagingService.sendMessage(reqObj.login,text)
            ])
        }
        return result
    }
    update=async (id,reqObj)=>{
        var query=`
            update ${this.table} set ${this.getUpdatePairs()} where ${this.pk}=$${(this.cols.length+1)}
        `
        var params=[...this.cols.map(c=>{return reqObj[c]}),id]
        var result=await Promise.all(
            [
                this.query(query,params),
                this.query(`delete from instructor where user_id=$1`,[id])
            ]
        )
        var insertValues=``
        reqObj.selectedCourse.map((s,i)=>{
            insertValues+=`(${id},${s})`
            if(i<reqObj.selectedCourse.length-1)
                insertValues+=`,`
        })
        await this.query(`insert into instructor(user_id,course_id) values ${insertValues}`)
            
        return result[0]
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

    forgotPass =async id=>{
        var res=await this.query(`select login,name from managerial_auth where id=$1`,[id])
        var phone=res.data[0].login
        var name=res.data[0].name
        var password=this.getRandomPin('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',8);
        const salt = await bcrypt.genSalt(10)
        var hashedPassWord = await bcrypt.hash(password,salt)
        var text=`Dear ${name}, your updated login credentials for https://teachers.codervai.com is, login:${phone} and password:${password}`
        var result=await Promise.all([
            this.query(`update managerial_auth set password = $1 where id=$2`,[hashedPassWord,id]),
            await messagingService.sendMessage(phone,text)
        ])
        return result[0]
    }
}

module.exports = {TeacherService}