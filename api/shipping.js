import { db } from "hatchable";
export const access = "public";
export const methods = ["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT governorate,price FROM shipping_rates ORDER BY governorate");
 res.json({governorates:rows});
}