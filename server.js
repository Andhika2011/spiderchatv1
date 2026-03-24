/**
 * SpiderChat v2.0 — Real-time Backend
 * Node.js + Express + Socket.io + Multer + WebRTC Signaling + AI Proxy
 */
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Upload ──────────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_,__,cb) => cb(null, uploadDir),
  filename:    (_,file,cb) => cb(null, `${Date.now()}-${Buffer.from(file.originalname,'latin1').toString('utf8')}`)
});
const upload = multer({ storage, limits:{ fileSize: 50*1024*1024 } });

// ── DB ──────────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'db.json');
let DB = { users:{}, messages:{}, contacts:{}, groups:{} };
if (fs.existsSync(DB_FILE)) {
  try { DB = JSON.parse(fs.readFileSync(DB_FILE,'utf-8')); console.log('✅ DB loaded'); }
  catch(e) { console.log('⚠️  db.json error'); }
}
if (!Object.keys(DB.users).length) {
  [
    {u:'admin',n:'Admin SpiderChat',p:'admin123',av:'🕷️',bio:'Administrator'},
    {u:'budi', n:'Budi Santoso',    p:'123456',  av:'🦊',bio:'Halo semua!'},
    {u:'sari', n:'Sari Dewi',       p:'123456',  av:'🌺',bio:'Suka traveling 🌏'},
    {u:'raka', n:'Raka Pratama',    p:'123456',  av:'🐉',bio:'Developer & Gamer'},
    {u:'lina', n:'Lina Kartini',    p:'123456',  av:'🦋',bio:'UI/UX Designer'},
  ].forEach(x => {
    DB.users[x.u]={name:x.n,passHash:bcrypt.hashSync(x.p,8),avatar:x.av,bio:x.bio,joined:new Date().toLocaleDateString('id-ID')};
  });
  DB.contacts['admin']=['budi','sari','raka','lina'];
  DB.groups['group_spiders']={
    name:'Komunitas SpiderChat 🕸️',avatar:'🕸️',
    participants:['admin','budi','sari','raka','lina'],
    messages:[
      {id:uuidv4(),from:'budi',text:'Selamat datang! 🕷️',time:fmt(),read:true},
      {id:uuidv4(),from:'sari',text:'Halo semua! 👋',time:fmt(),read:true},
      {id:uuidv4(),from:'lina',text:'Keren banget app-nya! 😍',time:fmt(),read:true},
    ]
  };
  saveDB();
}

function saveDB(){ fs.writeFileSync(DB_FILE,JSON.stringify(DB,null,2)); }
function fmt(d=new Date()){ return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function getChatId(a,b){ return [a,b].sort().join('_'); }
function pubUser(u){ const x=DB.users[u]; if(!x)return null; return {username:u,name:x.name,avatar:x.avatar,bio:x.bio,joined:x.joined}; }

// ── Online ──────────────────────────────────────────────────
const onlineUsers = new Map();
const socketUsers = new Map();

// ── REST ────────────────────────────────────────────────────
app.post('/api/register',(req,res)=>{
  const {username,name,password,avatar}=req.body;
  if(!username||!name||!password) return res.json({ok:false,msg:'Field tidak lengkap'});
  if(DB.users[username]) return res.json({ok:false,msg:'Username sudah dipakai'});
  if(password.length<6) return res.json({ok:false,msg:'Password min 6 karakter'});
  DB.users[username]={name,passHash:bcrypt.hashSync(password,8),avatar:avatar||'🦊',bio:'Hey, saya pakai SpiderChat!',joined:new Date().toLocaleDateString('id-ID')};
  DB.contacts[username]=[];
  saveDB();
  res.json({ok:true,user:pubUser(username)});
});

app.post('/api/login',(req,res)=>{
  const {username,password}=req.body;
  const u=DB.users[username];
  if(!u) return res.json({ok:false,msg:'Username tidak ditemukan'});
  if(!bcrypt.compareSync(password,u.passHash)) return res.json({ok:false,msg:'Password salah'});
  res.json({ok:true,user:pubUser(username)});
});

app.get('/api/users',(_,res)=>res.json(Object.keys(DB.users).map(pubUser).filter(Boolean)));

app.post('/api/upload', upload.single('file'),(req,res)=>{
  if(!req.file) return res.json({ok:false,msg:'No file'});
  res.json({ok:true,url:`/uploads/${req.file.filename}`,name:req.file.originalname,size:req.file.size,mime:req.file.mimetype});
});

// AI proxy — passes Claude API key from client
app.post('/api/ai', async(req,res)=>{
  const {messages,apiKey}=req.body;
  if(!apiKey) return res.json({ok:false,msg:'API key diperlukan'});
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:1024,
        system:'Kamu adalah SpiderBot, asisten AI cerdas di SpiderChat. Jawab dengan ramah, singkat, dalam bahasa Indonesia. Gunakan emoji sesekali.',
        messages})
    });
    const data=await r.json();
    if(data.error) return res.json({ok:false,msg:data.error.message});
    res.json({ok:true,text:data.content?.[0]?.text||''});
  } catch(e){
    res.json({ok:false,msg:'Gagal AI: '+e.message});
  }
});

// ── Socket.io ────────────────────────────────────────────────
io.on('connection',socket=>{
  socket.on('join',({username})=>{
    if(!DB.users[username]) return;
    if(onlineUsers.has(username)) socketUsers.delete(onlineUsers.get(username));
    onlineUsers.set(username,socket.id);
    socketUsers.set(socket.id,username);
    socket.username=username;
    socket.join(`user:${username}`);
    Object.entries(DB.groups).forEach(([gid,g])=>{ if(g.participants.includes(username)) socket.join(`group:${gid}`); });

    const dmHistory={};
    Object.entries(DB.messages||{}).forEach(([cid,msgs])=>{ if(cid.split('_').includes(username)) dmHistory[cid]=msgs.slice(-100); });

    socket.emit('init',{
      user:pubUser(username),
      contacts:(DB.contacts[username]||[]).map(pubUser).filter(Boolean),
      groups:Object.entries(DB.groups).filter(([,g])=>g.participants.includes(username)).map(([id,g])=>({id,name:g.name,avatar:g.avatar,participants:g.participants.map(pubUser).filter(Boolean),messages:g.messages.slice(-100)})),
      dmHistory,
      onlineUsers:[...onlineUsers.keys()],
    });
    io.emit('user:online',{username});
  });

  socket.on('dm:send',(d)=>{
    const from=socket.username; if(!from||!DB.users[d.to]) return;
    const chatId=getChatId(from,d.to);
    if(!DB.messages[chatId]) DB.messages[chatId]=[];
    const msg={id:uuidv4(),chatId,from,to:d.to,text:d.text||'',type:d.type||'text',time:fmt(),read:false,reactions:[],replyTo:d.replyTo||null,duration:d.duration||null,fileName:d.fileName||null,fileUrl:d.fileUrl||null,fileSize:d.fileSize||null,fileMime:d.fileMime||null};
    DB.messages[chatId].push(msg);
    if(DB.messages[chatId].length>500) DB.messages[chatId]=DB.messages[chatId].slice(-500);
    saveDB();
    socket.emit('dm:message',msg);
    io.to(`user:${d.to}`).emit('dm:message',msg);
  });

  socket.on('group:send',(d)=>{
    const from=socket.username; if(!from) return;
    const g=DB.groups[d.groupId]; if(!g||!g.participants.includes(from)) return;
    const msg={id:uuidv4(),groupId:d.groupId,from,text:d.text||'',type:d.type||'text',time:fmt(),read:false,reactions:[],replyTo:d.replyTo||null,duration:d.duration||null,fileName:d.fileName||null,fileUrl:d.fileUrl||null,fileSize:d.fileSize||null,fileMime:d.fileMime||null};
    g.messages.push(msg);
    if(g.messages.length>500) g.messages=g.messages.slice(-500);
    saveDB();
    io.to(`group:${d.groupId}`).emit('group:message',msg);
  });

  socket.on('dm:read',({chatId,from})=>{
    if(!DB.messages[chatId]) return;
    DB.messages[chatId].forEach(m=>{ if(m.from===from) m.read=true; });
    saveDB();
    io.to(`user:${from}`).emit('dm:read',{chatId,by:socket.username});
  });

  socket.on('typing:start',({chatId,groupId})=>{
    const u=socket.username; if(!u) return;
    if(groupId) socket.to(`group:${groupId}`).emit('typing:start',{username:u,groupId});
    else { const o=chatId.split('_').find(x=>x!==u); if(o) io.to(`user:${o}`).emit('typing:start',{username:u,chatId}); }
  });
  socket.on('typing:stop',({chatId,groupId})=>{
    const u=socket.username; if(!u) return;
    if(groupId) socket.to(`group:${groupId}`).emit('typing:stop',{username:u,groupId});
    else { const o=chatId.split('_').find(x=>x!==u); if(o) io.to(`user:${o}`).emit('typing:stop',{username:u,chatId}); }
  });

  socket.on('reaction:add',({msgId,chatId,groupId,emoji})=>{
    const u=socket.username; if(!u) return;
    let msg;
    if(groupId&&DB.groups[groupId]) msg=DB.groups[groupId].messages.find(m=>m.id===msgId);
    else if(chatId&&DB.messages[chatId]) msg=DB.messages[chatId].find(m=>m.id===msgId);
    if(!msg) return;
    if(!msg.reactions) msg.reactions=[];
    const ei=msg.reactions.findIndex(r=>r.from===u&&r.emoji===emoji);
    if(ei>-1) msg.reactions.splice(ei,1); else msg.reactions.push({emoji,from:u});
    saveDB();
    const payload={msgId,chatId,groupId,reactions:msg.reactions};
    if(groupId) io.to(`group:${groupId}`).emit('reaction:update',payload);
    else { socket.emit('reaction:update',payload); const o=chatId.split('_').find(x=>x!==u); if(o) io.to(`user:${o}`).emit('reaction:update',payload); }
  });

  socket.on('msg:delete',({msgId,chatId,groupId})=>{
    const u=socket.username;
    if(groupId&&DB.groups[groupId]){
      const i=DB.groups[groupId].messages.findIndex(m=>m.id===msgId&&m.from===u);
      if(i>-1){DB.groups[groupId].messages.splice(i,1);saveDB();io.to(`group:${groupId}`).emit('msg:deleted',{msgId,groupId});}
    } else if(chatId&&DB.messages[chatId]){
      const i=DB.messages[chatId].findIndex(m=>m.id===msgId&&m.from===u);
      if(i>-1){DB.messages[chatId].splice(i,1);saveDB();socket.emit('msg:deleted',{msgId,chatId});const o=chatId.split('_').find(x=>x!==u);if(o) io.to(`user:${o}`).emit('msg:deleted',{msgId,chatId});}
    }
  });

  socket.on('contact:add',({target})=>{
    const u=socket.username;
    if(!DB.users[target]||target===u) return;
    if(!DB.contacts[u]) DB.contacts[u]=[];
    if(!DB.contacts[u].includes(target)){DB.contacts[u].push(target);saveDB();}
    socket.emit('contact:list',(DB.contacts[u]||[]).map(pubUser).filter(Boolean));
    socket.emit('toast',`✅ ${DB.users[target].name} ditambahkan ke kontak!`);
  });
  socket.on('contact:remove',({target})=>{
    const u=socket.username;
    if(DB.contacts[u]){DB.contacts[u]=DB.contacts[u].filter(x=>x!==target);saveDB();}
    socket.emit('contact:list',(DB.contacts[u]||[]).map(pubUser).filter(Boolean));
  });

  // WebRTC signaling
  socket.on('call:initiate',({to,type})=>io.to(`user:${to}`).emit('call:incoming',{from:socket.username,type,fromUser:pubUser(socket.username)}));
  socket.on('call:offer',   ({to,offer})   =>io.to(`user:${to}`).emit('call:offer',  {from:socket.username,offer}));
  socket.on('call:answer',  ({to,answer})  =>io.to(`user:${to}`).emit('call:answer', {from:socket.username,answer}));
  socket.on('call:ice',     ({to,candidate})=>io.to(`user:${to}`).emit('call:ice',   {from:socket.username,candidate}));
  socket.on('call:hangup',  ({to})=>io.to(`user:${to}`).emit('call:hangup',{from:socket.username}));
  socket.on('call:reject',  ({to})=>io.to(`user:${to}`).emit('call:rejected',{from:socket.username}));

  socket.on('disconnect',()=>{
    const u=socketUsers.get(socket.id);
    if(u){onlineUsers.delete(u);socketUsers.delete(socket.id);io.emit('user:offline',{username:u});}
  });
});

const PORT=process.env.PORT||3000;
server.listen(PORT,()=>{
  console.log(`\n🕷️  SpiderChat v2.0 — http://localhost:${PORT}\n📋 admin/admin123 | budi,sari,raka,lina / 123456\n`);
});
