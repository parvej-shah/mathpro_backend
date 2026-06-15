const Controller = require("../base").Controller;
const ItemService=require("../../service/in/item").ItemService

const itemService=new ItemService()

class ItemController extends Controller {
    constructor() {
        super();
    }
    list =async (req,res)=>{
        var result=await itemService.list(parseInt(req.params.platform),parseInt(req.params.level),parseInt(req.params.parentId))
        return res.status(result.success?200:400).json(result)
    }
    create =async (req,res)=>{
        var result=await itemService.create(parseInt(req.params.platform),parseInt(req.params.level),parseInt(req.params.parentId),req.body.data)
        return res.status(result.success?200:400).json(result)
    }
    update =async (req,res)=>{
        var result=await itemService.update(parseInt(req.params.id),req.body.data)
        return res.status(result.success?200:400).json(result)
    }
    deleteEntry =async (req,res)=>{
        var result=await itemService.deleteEntry(parseInt(req.params.id))
        return res.status(result.success?200:400).json(result)
    }

    qrVisit =async (req,res)=>{
        var result=await itemService.qrVisit(req.query.title,req.query.link)
        res.redirect(req.query.link)
    }



}

module.exports={ItemController}

