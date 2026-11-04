import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET","PUT"];
export default async function(req,res){
 if(req.method==="GET"){
  const {rows}=await db.query("SELECT governorate,price FROM shipping_rates ORDER BY governorate");
  return res.json({governorates:rows});
 }
 const list=req.body?.governorates;
 if(!Array.isArray(list)||list.length!==27)return res.status(400).json({error:"يجب إرسال أسعار المحافظات الـ27 كاملة."});
 const seen=new Set();
 for(const row of list){
  const name=String(row.governorate||"").trim(), price=Number(row.price);
  if(!name||seen.has(name)||!Number.isFinite(price)||price<0||price>100000)return res.status(400).json({error:"تحققي من أسماء المحافظات وأسعار الشحن."});
  seen.add(name);
 }
 const existing=await db.query("SELECT governorate FROM shipping_rates");
 const known=new Set(existing.rows.map(x=>x.governorate));
 if(list.some(x=>!known.has(String(x.governorate))))return res.status(400).json({error:"توجد محافظة غير معروفة."});
 for(const row of list)await db.query("UPDATE shipping_rates SET price=$2,updated_at=now() WHERE governorate=$1",[String(row.governorate),Number(row.price)]);
 const {rows}=await db.query("SELECT governorate,price FROM shipping_rates ORDER BY governorate");
 return res.json({ok:true,governorates:rows});
}