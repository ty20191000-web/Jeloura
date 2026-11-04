import { db, storage } from "hatchable";
export const access = "public";
export const methods = ["GET"];
export default async function(req,res){
 const {rows}=await db.query("SELECT id,name,category,category_label,short_description,long_description,price,compare_at_price,stock,images,featured,sale_enabled,sale_ends_at FROM products WHERE active=true ORDER BY featured DESC,created_at DESC LIMIT 15");
 const products=await Promise.all(rows.map(async p=>({...p,images:await Promise.all((p.images||[]).map(async x=>String(x).startsWith("jeloura/products/")?await storage.url(x):x))})));
 res.json({products});
}