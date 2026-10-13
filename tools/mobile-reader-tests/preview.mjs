import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=process.cwd()+'/UI/Web/dist/browser';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.woff2':'font/woff2','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{
 if(req.url.startsWith('/api/')||req.url.startsWith('/hubs/')){
  const proxy=http.request({hostname:'127.0.0.1',port:1314,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:1314'}},up=>{res.writeHead(up.statusCode,up.headers);up.pipe(res)});proxy.on('error',()=>{res.writeHead(502);res.end()});req.pipe(proxy);return;
 }
 const url=new URL(req.url,'http://localhost');const file=path.join(root,decodeURIComponent(url.pathname));
 const target=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(root,'index.html');
 res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);
});
server.on('upgrade',(req,socket,head)=>{const proxy=http.request({hostname:'127.0.0.1',port:1314,path:req.url,headers:{...req.headers,host:'localhost:1314'}});proxy.on('upgrade',(up,peer,extra)=>{socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(up.headers).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');if(head.length)peer.write(head);if(extra.length)socket.write(extra);socket.pipe(peer).pipe(socket)});proxy.on('error',()=>socket.destroy());proxy.end()});
server.listen(1315,'127.0.0.1',()=>console.log('Temporary mobile QA preview http://127.0.0.1:1315'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
