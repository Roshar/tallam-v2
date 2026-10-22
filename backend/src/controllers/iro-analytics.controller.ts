import type { Request,Response } from "express";
import { isCardTypeKind } from "../services/evaluation-scale.js";
import * as iro from "../services/iro-analytics.service.js";

const year = (req:Request) => { const v=Number(req.query.academicYearStart); if(!Number.isInteger(v)||v<2000||v>2100) throw new Error("Некорректный учебный год"); return v; };
const card = (req:Request) => { const v=req.query.cardType; if(!isCardTypeKind(v)) throw new Error("Параметр cardType обязателен: method или full"); return v; };
const run=(fn:(req:Request)=>Promise<unknown>)=>async(req:Request,res:Response)=>{try{return res.json(await fn(req));}catch(e){return res.status(400).json({error:e instanceof Error?e.message:"Некорректный запрос"});}};
export const academicYears=run(()=>iro.getAcademicYears());
export const areas=run(()=>iro.getAreas());
export const dashboard=run(req=>iro.getDashboard(year(req)));
export const schools=run(req=>iro.getSchools({year:year(req),status:String(req.query.status??"all"),areaId:req.query.areaId?Number(req.query.areaId):undefined,coverageMin:req.query.coverageMin!==undefined?Number(req.query.coverageMin):undefined,coverageMax:req.query.coverageMax!==undefined?Number(req.query.coverageMax):undefined,search:String(req.query.search??"").trim(),page:Math.max(1,Number(req.query.page)||1),pageSize:Math.min(100,Math.max(1,Number(req.query.pageSize)||20)),sort:String(req.query.sort??"name")}));
export const schoolAnalytics=run(req=>iro.getSchoolAnalytics(Number(req.params.schoolId),year(req),card(req)));
export const analytics=run(req=>iro.getRepublicAnalytics(year(req),card(req)));
