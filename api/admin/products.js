import { db, storage } from "hatchable";
export const access = "admin";
export const methods = ["GET","POST","PUT","DELETE"];
const clean=(v,n=500)=>String(v??"").trim().slice(0,n);
const imagesOf=v=>Array.isArray(v)?v.map(x=>clean(x,1000)).filter(x=>/^https:\/\//i.test(x)||/^jeloura\/products\/[a-f0-9-]+\.(?:jpeg|png|webp)$/i.test(x)).slice(0,8):[];
export default async function(req,res){
 if(req.method==="GET"){
  const {rows}=await db.query("SELECT id,name,category,category_label,short_description,long_description,price,compare_at_price,stock,images,featured,active,sale_enabled,sale_ends_at,created_at FROM products ORDER BY created_at DESC LIMIT 15");
  const products=await Promise.all(rows.map(async p=>({...p,image_urls:await Promise.all((p.images||[]).map(async x=>{if(!String(x).startsWith("jeloura/products/"))return x;try{return await storage.url(x)}catch{return null}}))}))); return res.json({products:products.map(p=>({...p,image_urls:p.image_urls.filter(Boolean)}))});
 }
 const b=req.body||{},id=clean(b.id,100);
 if(req.method==="DELETE"){
  if(!id)return res.status(400).json({error:"معرّف المنتج مطلوب"});
  await db.query("UPDATE products SET active=false,updated_at=now() WHERE id=$1",[id]);
  return res.json({ok:true});
 }
 const name=clean(b.name,140),category=clean(b.category,40)||"skincare",categoryLabel=clean(b.category_label,80)||"منتجات Jeloura",short=clean(b.short_description,300),long=clean(b.long_description,3000),price=Number(b.price),compare=Number(b.compare_at_price||0),stock=Number(b.stock),images=imagesOf(b.images),featured=!!b.featured,sale=!!b.sale_enabled,ends=b.sale_ends_at?new Date(b.sale_ends_at):null;
 if(name.length<2||!Number.isFinite(price)||price<0||!Number.isFinite(compare)||compare<0||!Number.isInteger(stock)||stock<0||!short||!long)return res.status(400).json({error:"تحققي من الاسم والوصف والسعر والمخزون"});
 if(ends&&Number.isNaN(ends.getTime()))return res.status(400).json({error:"موعد انتهاء العرض غير صحيح"});
 if(sale&&!ends)return res.status(400).json({error:"حددي موعد انتهاء العرض لتفعيل المؤقت"});
 if(req.method==="POST"){
  const {rows:count}=await db.query("SELECT count(*)::int AS n FROM products WHERE active=true");
  if(count[0].n>=15)return res.status(409).json({error:"وصل المتجر إلى الحد الأقصى وهو 15 منتجاً"});
  const newId="jel-"+crypto.randomUUID();
  const {rows}=await db.query("INSERT INTO products(id,name,category,category_label,short_description,long_description,price,compare_at_price,stock,images,featured,active,sale_enabled,sale_ends_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,true,$12,$13,now()) RETURNING *",[newId,name,category,categoryLabel,short,long,price,compare,stock,JSON.stringify(images),featured,sale,ends?.toISOString()||null]);
  return res.status(201).json({product:rows[0]});
 }
 if(req.method==="PUT"){
  if(!id)return res.status(400).json({error:"معرّف المنتج مطلوب"});
  const {rows}=await db.query("UPDATE products SET name=$2,category=$3,category_label=$4,short_description=$5,long_description=$6,price=$7,compare_at_price=$8,stock=$9,images=$10::jsonb,featured=$11,active=true,sale_enabled=$12,sale_ends_at=$13,updated_at=now() WHERE id=$1 RETURNING *",[id,name,category,categoryLabel,short,long,price,compare,stock,JSON.stringify(images),featured,sale,ends?.toISOString()||null]);
  if(!rows.length)return res.status(404).json({error:"المنتج غير موجود"});
  return res.json({product:rows[0]});
 }
 res.status(405).json({error:"Method not allowed"});
}