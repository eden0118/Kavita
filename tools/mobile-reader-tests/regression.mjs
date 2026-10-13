const {default: puppeteer} = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
import {spawnSync} from 'node:child_process';import fs from 'node:fs';import assert from 'node:assert/strict';
const root=process.cwd();const out=process.env.KAVITA_TEST_OUTPUT || root+'/docs/2026-10-13-kavita-reader-improvements';fs.mkdirSync(out,{recursive:true});
const data=JSON.parse(spawnSync('python3',['-c',`import sqlite3,json,sys
c=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)
key=c.execute("SELECT k.Key FROM AppUserAuthKey k JOIN AspNetUserRoles ur ON ur.UserId=k.AppUserId JOIN AspNetRoles r ON r.Id=ur.RoleId WHERE r.Name='Admin' ORDER BY k.Id LIMIT 1").fetchone()[0]
rows=c.execute("SELECT f.ChapterId,s.LibraryId,s.Id,s.Format FROM MangaFile f JOIN Chapter ch ON ch.Id=f.ChapterId JOIN Volume v ON v.Id=ch.VolumeId JOIN Series s ON s.Id=v.SeriesId WHERE f.FilePath IN ('/comics/致性別為蒙娜麗莎的你/致性別為蒙娜麗莎的你_ch001-004.epub','/comics/新世紀福音戰士/新世紀福音戰士_v01.pdf')").fetchall()
print(json.dumps({'key':key,'chapters':rows}))`,process.env.KAVITA_TEST_DB || root+'/data/config/kavita.db'],{encoding:'utf8'}).stdout);
const browser=await puppeteer.launch({executablePath:process.env.KAVITA_TEST_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',headless:true,userDataDir:'/private/tmp/kavita-reader-regression-'+Date.now(),args:['--no-first-run','--disable-background-networking']});
const checks=[];const failures=[];const network=[];const base=process.env.KAVITA_TEST_URL || 'http://localhost:1315';
let failInfo=false;let failPage=false;
let page;
try{
 page=await browser.newPage();await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await page.setRequestInterception(true);page.on('request',req=>{if((failInfo&&/\/book-info/.test(req.url()))||(failPage&&/\/book-page/.test(req.url())))req.respond({status:500,contentType:'application/json',body:'{}'});else if(/\/api\/reader\//.test(req.url())&&!['GET','HEAD'].includes(req.method()))req.respond({status:200,contentType:'application/json',body:'{}'});else req.continue()});
 page.on('response',r=>{if(r.status()>=400){const u=new URL(r.url());network.push({path:u.pathname,status:r.status()})}});page.on('pageerror',e=>failures.push(e.message));
 await page.goto(base+'/login?apiKey='+encodeURIComponent(data.key),{waitUntil:'networkidle2',timeout:60000});
 assert.equal(new URL(page.url()).pathname,'/home');checks.push('login to existing backend');
 const book=data.chapters.find(r=>r[3]===3),pdf=data.chapters.find(r=>r[3]===4);
 const url=r=>base+`/library/${r[1]}/series/${r[2]}/${r[3]===4?'pdf':'book'}/${r[0]}?incognitoMode=true`;
 const screenshot=async(name)=>{await new Promise(r=>setTimeout(r,500));await page.screenshot({path:out+'/'+name+'.png'})};
 await page.goto(url(book),{waitUntil:'networkidle2',timeout:60000});await page.waitForSelector('.book-content img',{timeout:45000});
 for(const width of [320,390,430]){await page.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});if(!await page.$('.mobile-controls[aria-label]'))await page.touchscreen.tap(width/2,400);await page.waitForSelector('.mobile-controls[aria-label]');await screenshot('epub-'+width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await page.$eval('.mobile-controls[aria-label]',e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));assert(bounds.w>=44&&bounds.h>=44);}
 checks.push('EPUB mobile containment and 44px return control');
 const client=await page.createCDPSession();const ax=await client.send('Accessibility.getFullAXTree');assert.equal(ax.nodes.filter(n=>!n.ignored&&n.role?.value==='button'&&!n.name?.value).length,0);await client.detach();checks.push('EPUB visible buttons have accessible names');
 await page.click('.mobile-controls button[ngbdropdowntoggle]');await page.waitForSelector('.reader-tools-menu.show');
 assert(await page.$$eval('.reader-tools-menu.show .dropdown-item',items=>items.every(e=>e.getBoundingClientRect().height>=44)));await screenshot('epub-menu');
 await page.keyboard.press('Escape');checks.push('EPUB more menu has 44px text actions');
 if(!await page.$('.bottom-bar'))await page.touchscreen.tap(215,400);const before=await page.$eval('.bottom-bar',e=>e.innerText);await page.click('.bottom-bar button[title="Next Page"]');await page.waitForFunction(()=>document.querySelector('.bottom-bar')?.innerText.includes('Page 2'));checks.push('EPUB next page');
 failPage=true;await page.click('.bottom-bar button[title="Next Page"]');await page.waitForSelector('.reader-error',{timeout:15000});await screenshot('epub-page-error');failPage=false;await page.click('.reader-error .btn-primary');await page.waitForFunction(()=>!document.querySelector('.reader-error'));await page.waitForSelector('.book-content img');checks.push('EPUB page error and retry');
 failInfo=true;await page.goto(url(book),{waitUntil:'networkidle2',timeout:60000});await page.waitForSelector('.reader-error');await screenshot('epub-info-error');failInfo=false;await page.click('.reader-error .btn-primary');await page.waitForFunction(()=>!document.querySelector('.reader-error'));await page.waitForSelector('.book-content img');checks.push('EPUB info error and retry');
 if(!await page.$('button.mobile-controls[aria-label="Close Reader"]'))await page.touchscreen.tap(215,400);await page.waitForSelector('button.mobile-controls[aria-label="Close Reader"]');await page.click('button.mobile-controls[aria-label="Close Reader"]');await page.waitForFunction(expected=>location.pathname===expected,{timeout:15000},`/library/${book[1]}/series/${book[2]}`);assert.equal(new URL(page.url()).pathname,`/library/${book[1]}/series/${book[2]}`);checks.push('direct EPUB close returns to its own series');
 await page.goto(url(pdf),{waitUntil:'networkidle2',timeout:90000});await page.waitForSelector('.pdf-chapter-navigation',{timeout:45000});await page.waitForFunction(()=>!document.querySelector('.loading-message-container'),{timeout:120000});await page.waitForSelector('#viewer canvas',{timeout:45000});
 for(const width of [320,390,430]){await page.setViewport({width,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});await screenshot('pdf-'+width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await page.$eval('.mobile-pdf-toolbar button',e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));assert(bounds.w>=44&&bounds.h>=44);}
 checks.push('PDF mobile containment and 44px return control');
 await page.click('.mobile-pdf-toolbar button[ngbdropdowntoggle]');await page.waitForSelector('.pdf-mobile-menu.show');await screenshot('pdf-menu');
 const input=await page.$('#pdf-mobile-page');await input.click({clickCount:3});await input.type('2');await input.press('Tab');await page.waitForFunction(()=>document.querySelector('.pdf-chapter-navigation')?.innerText.includes('2 /'));await page.keyboard.press('Escape');checks.push('PDF page number control changes page');
 await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await screenshot('pdf-desktop');assert(await page.$eval('#toolbarViewer',e=>getComputedStyle(e).display!=='none'));checks.push('PDF desktop toolbar retained');
 await page.setViewport({width:430,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const next=await page.$('.pdf-chapter-navigation .btn-primary');await page.waitForFunction(()=>!document.querySelector('.pdf-chapter-navigation .btn-primary')?.disabled,{timeout:20000});await next.click();await page.waitForFunction(id=>!location.pathname.endsWith('/'+id),{timeout:45000},String(pdf[0]));assert.equal(new URL(page.url()).searchParams.get('incognitoMode'),'true');checks.push('PDF next chapter preserves incognito mode');
 await page.waitForSelector('.pdf-chapter-navigation');await screenshot('pdf-next-chapter');
 failInfo=true;await page.goto(url(pdf),{waitUntil:'networkidle2',timeout:60000});await page.waitForSelector('.pdf-reader-error');await screenshot('pdf-info-error');failInfo=false;await page.click('.pdf-reader-error .btn-primary');await page.waitForFunction(()=>!document.querySelector('.pdf-reader-error'));checks.push('PDF info error and retry');
 fs.writeFileSync(out+'/regression-results.json',JSON.stringify({checks,failures,network},null,2));console.log(JSON.stringify({passed:checks.length,checks,failures,network},null,2));
} catch(e){
 const error=e.message.replaceAll(data.key,'REDACTED');
 if(page) await page.screenshot({path:out+'/failure.png'}).catch(()=>{});
 fs.writeFileSync(out+'/regression-results.json',JSON.stringify({checks,failures,network,error},null,2));
 console.log(JSON.stringify({checks,failures,network,error},null,2));process.exitCode=1;
}finally{await browser.close()}
