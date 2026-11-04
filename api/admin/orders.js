import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET","PUT"];
export default async function(req,res){
 if(req.method==="GET"){
  const {rows}=await db.query("SELECT id,order_number,customer_name,phone,address,notes,items,subtotal,governorate,shipping_fee,total,status,created_at FROM store_orders ORDER BY created_at DESC LIMIT 250");
  return res.json({orders:rows});
 }
 const b=req.body||{},id=String(b.id||""),status=String(b.status||"");
 if(!id||!["new","confirmed","processing","shipped","delivered","cancelled"].includes(status))return res.status(400).json({error:"بيانات تحديث الطلب غير صحيحة"});
 const {rows}=await db.query("UPDATE store_orders SET status=$2 WHERE id=$1 RETURNING id,order_number,status",[id,status]);
 if(!rows.length)return res.status(404).json({error:"الطلب غير موجود"});
 res.json({order:rows[0]});
}