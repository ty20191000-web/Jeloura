import { db, config } from "hatchable";
export const access = "public";
export const methods = ["POST"];
export default async function(req,res){
 const b=req.body||{};
 const name=String(b.customer_name||"").trim(),phone=String(b.phone||"").trim(),address=String(b.address||"").trim(),notes=String(b.notes||"").trim(),governorate=String(b.governorate||"").trim();
 if(name.length<2||phone.length<7||address.length<5||!governorate||!Array.isArray(b.items)||!b.items.length||b.items.length>15)return res.status(400).json({error:"يرجى إدخال بيانات العميل والمحافظة والمنتجات بشكل صحيح."});
 const {rows:rateRows}=await db.query("SELECT price FROM shipping_rates WHERE governorate=$1",[governorate]);
 if(!rateRows.length)return res.status(400).json({error:"اختاري محافظة صحيحة لإتمام الطلب."});
 const shippingFee=Number(rateRows[0].price);
 const itemsMap=new Map();
 for(const x of b.items){const id=String(x.product_id||"");const qty=Number(x.quantity);if(!id||!Number.isInteger(qty)||qty<1||qty>20)return res.status(400).json({error:"بيانات كمية المنتج غير صحيحة."});itemsMap.set(id,(itemsMap.get(id)||0)+qty);}
 const items=[...itemsMap].map(([product_id,quantity])=>({product_id,quantity}));
 if(items.some(x=>x.quantity>20))return res.status(400).json({error:"الكمية المطلوبة أكبر من الحد المسموح."});
 const orderNumber="JEL-"+Date.now().toString(36).toUpperCase()+"-"+crypto.randomUUID().slice(0,5).toUpperCase();
 const sql=`WITH requested AS (SELECT product_id, SUM(quantity)::int AS quantity FROM jsonb_to_recordset($1::jsonb) AS x(product_id text, quantity int) GROUP BY product_id), product_rows AS (SELECT p.id,p.name,p.price,r.quantity,p.stock,p.images FROM requested r JOIN products p ON p.id=r.product_id WHERE p.active=true), valid AS (SELECT count(*)=(SELECT count(*) FROM requested) AND COALESCE(bool_and(stock>=quantity),false) AS ok, COALESCE(sum(price*quantity),0) AS subtotal FROM product_rows), updated AS (UPDATE products p SET stock=p.stock-r.quantity,updated_at=now() FROM requested r,valid v WHERE v.ok=true AND p.id=r.product_id AND p.stock>=r.quantity RETURNING p.id), inserted AS (INSERT INTO store_orders(order_number,customer_name,phone,address,notes,items,subtotal,governorate,shipping_fee,total) SELECT $2,$3,$4,$5,$6,(SELECT jsonb_agg(jsonb_build_object('product_id',id,'name',name,'price',price,'quantity',quantity,'image',COALESCE(images->>0,''))) FROM product_rows),v.subtotal,$7,$8,v.subtotal+$8 FROM valid v WHERE v.ok=true AND (SELECT count(*) FROM updated)=(SELECT count(*) FROM requested) RETURNING order_number,items,subtotal,governorate,shipping_fee,total) SELECT order_number,items,subtotal,governorate,shipping_fee,total FROM inserted`;
 const {rows}=await db.query(sql,[JSON.stringify(items),orderNumber,name,phone,address,notes,governorate,shippingFee]);
 if(!rows.length)return res.status(409).json({error:"بعض المنتجات لم تعد متاحة بالكمية المطلوبة. حدّثي السلة وحاولي مرة أخرى."});
 let whatsappSent=false;
 try{
  const token=await config.get("WHATSAPP_ACCESS_TOKEN"),senderId=await config.get("WHATSAPP_PHONE_NUMBER_ID");
  if(token&&senderId){
   const lines=(rows[0].items||[]).map(x=>"- "+x.name+" × "+x.quantity+" = "+(Number(x.price)*Number(x.quantity))+" ج.م").join("\n");
   const message="طلب جديد من متجر Jeloura\nرقم الطلب: "+rows[0].order_number+"\nالعميل: "+name+"\nالهاتف: "+phone+"\nالمحافظة: "+governorate+"\nالعنوان: "+address+"\nملاحظات: "+(notes||"لا يوجد")+"\nالمنتجات:\n"+lines+"\nسعر المنتجات: "+rows[0].subtotal+" ج.م\nالشحن: "+rows[0].shipping_fee+" ج.م\nالإجمالي: "+rows[0].total+" ج.م";
   const templateName=(await config.get("WHATSAPP_TEMPLATE_NAME"))||"jeloura_new_order";
   const response=await fetch("https://graph.facebook.com/v23.0/"+senderId+"/messages",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:"201288423070",type:"template",template:{name:templateName,language:{code:"ar"},components:[{type:"body",parameters:[{type:"text",text:rows[0].order_number},{type:"text",text:name},{type:"text",text:phone},{type:"text",text:governorate+" - "+address},{type:"text",text:lines||"—"},{type:"text",text:String(rows[0].total)+" ج.م"}]}]}})});
   whatsappSent=response.ok;if(!response.ok)console.error("WhatsApp Cloud API error",response.status,await response.text());
  }
 }catch(err){console.error("WhatsApp notification not configured or failed",String(err).slice(0,400));}
 res.status(201).json({ok:true,order_number:rows[0].order_number,message:"تم تسجيل طلبك بنجاح",subtotal:rows[0].subtotal,shipping_fee:rows[0].shipping_fee,total:rows[0].total,whatsapp_sent:whatsappSent,whatsapp_number:"201288423070"});
}