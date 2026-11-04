import { storage } from "hatchable";
import crypto from "node:crypto";
export const access = "admin";
export const methods = ["POST"];
const MAX_BYTES = 8 * 1024 * 1024;
export default async function(req,res){
 const data=String(req.body?.data||"");
 const m=data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
 if(!m)return res.status(400).json({error:"اختاري صورة بصيغة JPG أو PNG أو WEBP."});
 const bytes=Buffer.from(m[2],"base64");
 if(!bytes.length||bytes.length>MAX_BYTES)return res.status(413).json({error:"حجم الصورة كبير. الحد الأقصى 8 ميجابايت."});
 const type="image/"+m[1],sig=bytes.subarray(0,12);
 const valid=type==="image/jpeg"?sig[0]===0xff&&sig[1]===0xd8:type==="image/png"?sig[0]===0x89&&sig[1]===0x50&&sig[2]===0x4e&&sig[3]===0x47:sig.toString("ascii",0,4)==="RIFF"&&sig.toString("ascii",8,12)==="WEBP";
 if(!valid)return res.status(415).json({error:"محتوى الصورة غير صالح."});
 const key="jeloura/products/"+crypto.randomUUID()+"."+m[1];
 await storage.put(key,bytes,type);
 return res.status(201).json({key});
}