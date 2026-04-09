const fs = require('fs');
const src = fs.readFileSync('frontend/src/app/dashboard/student/classes/[classId]/materials/[materialId]/page.tsx','utf8');
let stack=[];
let inStr=null;let inLine=false;let inBlock=false;
for(let i=0;i<src.length;i++){
  const ch=src[i], next=src[i+1];
  if(inLine){ if(ch==='\n') inLine=false; continue; }
  if(inBlock){ if(ch==='*' && next === '/'){ inBlock=false; i++; } continue; }
  if(inStr){ if(ch==='\\'){ i++; continue; } if(ch===inStr){ inStr=null; } continue; }
  if(ch==='/' && next === '/'){ inLine=true; i++; continue; }
  if(ch==='/' && next === '*'){ inBlock=true; i++; continue; }
  if(ch==='"' || ch==="'" || ch==='`'){ inStr=ch; continue; }
  if(ch==='{'||ch==='('||ch==='['){ stack.push([ch,i]); }
  else if(ch==='}'||ch===')'||ch===']'){ if(!stack.length){ console.log('extra',ch,'at',i); break; } stack.pop(); }
}
console.log('stack', stack.length, stack.length?stack[stack.length-1]:null);
