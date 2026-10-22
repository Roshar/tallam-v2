import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
dotenv.config();

const [emailRaw,password,role,firstName,lastName,patronymic=""] = process.argv.slice(2);
const roles=["iro_viewer","iro_methodologist","iro_admin"];
if(!emailRaw||!password||!roles.includes(role)||!firstName||!lastName){
  console.error("Usage: node scripts/create-iro-user.mjs <email> <password> <role> <first_name> <last_name> [patronymic]"); process.exit(1);
}
if(password.length<8){console.error("Password must contain at least 8 characters");process.exit(1);}
const email=emailRaw.trim().toLowerCase();
const db=await mysql.createConnection({host:process.env.DATABASE_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DATABASE_USER,password:process.env.DATABASE_PASSWORD||"",database:process.env.DATABASE});
try{
  const [found]=await db.query("SELECT id FROM iro_users WHERE email=? LIMIT 1",[email]);
  if(found.length){console.error("IRO user with this email already exists");process.exitCode=1;}
  else {const hash=await bcrypt.hash(password,12);await db.query("INSERT INTO iro_users (email,password_hash,role,first_name,last_name,patronymic) VALUES (?,?,?,?,?,?)",[email,hash,role,firstName,lastName,patronymic||null]);console.log(`IRO user created: ${email} (${role}), ${lastName} ${firstName}`);}
} finally {await db.end();}
