import { db } from "hatchable";
export const access = "public";
export const methods = ["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT r.id,r.customer_name,r.rating,r.comment,r.created_at,p.name AS product_name FROM store_reviews r LEFT JOIN products p ON p.id=r.product_id WHERE r.published=true ORDER BY r.created_at DESC LIMIT 30");
 res.json({reviews:rows});
}