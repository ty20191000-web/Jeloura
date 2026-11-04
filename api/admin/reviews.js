import { db } from "hatchable";
export const access = "admin";
export const methods = ["GET","POST","PUT","DELETE"];
const clean=(v,n=1200)=>String(v??"").trim().slice(0,n);
export default async function(req,res){
 if(req.method==="GET"){
  const {rows}=await db.query("SELECT r.id,r.customer_name,r.rating,r.comment,r.product_id,r.published,r.created_at,p.name AS product_name FROM store_reviews r LEFT JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC LIMIT 300");
  return res.json({reviews:rows});
 }
 const b=req.body||{},id=String(b.id||"");
 if(req.method==="DELETE"){
  if(!id)return res.status(400).json({error:"معرّف الرأي مطلوب"});
  await db.query("DELETE FROM store_reviews WHERE id=$1",[id]);return res.json({ok:true});
 }
 const name=clean(b.customer_name,100),comment=clean(b.comment,1000),rating=Number(b.rating),productId=clean(b.product_id,100)||null,published=b.published!==false;
 if(name.length<2||comment.length<3||!Number.isInteger(rating)||rating<1||rating>5)return res.status(400).json({error:"أدخلي اسم العميل والتعليق وتقييماً من نجمة إلى خمس"});
 if(req.method==="POST"){
  const {rows}=await db.query("INSERT INTO store_reviews(customer_name,rating,comment,product_id,published) VALUES($1,$2,$3,$4,$5) RETURNING *",[name,rating,comment,productId,published]);
  return res.status(201).json({review:rows[0]});
 }
 if(req.method==="PUT"){
  if(!id)return res.status(400).json({error:"معرّف الرأي مطلوب"});
  const {rows}=await db.query("UPDATE store_reviews SET customer_name=$2,rating=$3,comment=$4,product_id=$5,published=$6 WHERE id=$1 RETURNING *",[id,name,rating,comment,productId,published]);
  if(!rows.length)return res.status(404).json({error:"الرأي غير موجود"});
  return res.json({review:rows[0]});
 }
 res.status(405).json({error:"Method not allowed"});
}