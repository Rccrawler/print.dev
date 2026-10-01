function extractMain(src){
  const idx=src.indexOf('main(');
  if(idx===-1) return src;
  const i=src.indexOf('{',idx);
  if(i===-1) return src;
  let depth=1,j=i+1;
  while(j<src.length&&depth>0){
    if(src[j]==='{')depth++;
    if(src[j]==='}')depth--;
    j++;
  }
  return src.slice(i+1,j-1);
}

function tokenizeJava(src){
  const re=/\s+|\/\/.*|"(?:[^"\\]|\\.)*"|\d+\.\d+|\d+|[A-Za-z_]\w*|==|!=|<=|>=|&&|\|\||\+\+|--|\+=|-=|[-+*/%(){};,=<>!.]/g;
  const toks=[]; let m;
  while((m=re.exec(src))){ const t=m[0]; if(/^\s+$/.test(t)||t.startsWith('//')) continue; toks.push(t); }
  toks.push('<EOF>');
  return toks;
}

function runJavaCode(){
  const out=document.getElementById('javaOut');
  out.classList.remove('err');
  const src=extractMain(document.getElementById('javaIn').value);
  try{
    const toks=tokenizeJava(src);
    let pos=0;
    const peek=()=>toks[pos];
    const next=()=>toks[pos++];
    const expect=t=>{ if(peek()!==t) throw new Error("se esperaba '"+t+"' cerca de '"+peek()+"'"); return next(); };
    const types=new Set(['int','double','float','long','boolean','String','var']);
    const isNum=t=>/^\d+(\.\d+)?$/.test(t);
    const isId=t=>/^[A-Za-z_]\w*$/.test(t)&&!['if','else','for','while','true','false'].includes(t)&&!types.has(t);

    function parseExpr(){ return parseOr(); }
    function parseOr(){ let l=parseAnd(); while(peek()==='||'){ next(); l={k:'bin',op:'||',l,r:parseAnd()}; } return l; }
    function parseAnd(){ let l=parseEq(); while(peek()==='&&'){ next(); l={k:'bin',op:'&&',l,r:parseEq()}; } return l; }
    function parseEq(){ let l=parseRel(); while(peek()==='=='||peek()==='!='){ const op=next(); l={k:'bin',op,l,r:parseRel()}; } return l; }
    function parseRel(){ let l=parseAdd(); while(['<','>','<=','>='].includes(peek())){ const op=next(); l={k:'bin',op,l,r:parseAdd()}; } return l; }
    function parseAdd(){ let l=parseMul(); while(peek()==='+'||peek()==='-'){ const op=next(); l={k:'bin',op,l,r:parseMul()}; } return l; }
    function parseMul(){ let l=parseUnary(); while(peek()==='*'||peek()==='/'||peek()==='%'){ const op=next(); l={k:'bin',op,l,r:parseUnary()}; } return l; }
    function parseUnary(){ if(peek()==='!'||peek()==='-'){ const op=next(); return {k:'un',op,v:parseUnary()}; } return parsePrimary(); }
    function parsePrimary(){
      const t=next();
      if(t==='(') { const e=parseExpr(); expect(')'); return e; }
      if(t==='true') return {k:'lit',v:true};
      if(t==='false') return {k:'lit',v:false};
      if(isNum(t)) return {k:'lit',v:parseFloat(t)};
      if(t[0]==='"') return {k:'lit',v:t.slice(1,-1).replace(/\\n/g,'\n').replace(/\\"/g,'"')};
      return {k:'var',name:t};
    }

    function parseVarDecl(){
      next();
      const decls=[];
      while(true){
        const name=next();
        let v=null;
        if(peek()==='='){ next(); v=parseExpr(); }
        decls.push({name,v});
        if(peek()===','){ next(); continue; }
        break;
      }
      expect(';');
      return {k:'decls',decls};
    }
    function parseBlock(){
      if(peek()==='{'){ next(); const s=[]; while(peek()!=='}') s.push(parseStmt()); next(); return {k:'block',body:s}; }
      return parseStmt();
    }
    function parseForInit(){
      if(types.has(peek())){ next(); const name=next(); expect('='); return {k:'decl',name,v:parseExpr()}; }
      const name=next(); expect('='); return {k:'assign',name,v:parseExpr()};
    }
    function parseForUpd(){
      const name=next();
      if(peek()==='++'||peek()==='--'){ return {k:'incdec',name,op:next()}; }
      if(peek()==='+='||peek()==='-='){ const op=next(); return {k:'opassign',name,op,v:parseExpr()}; }
      expect('='); return {k:'assign',name,v:parseExpr()};
    }
    function parseStmt(){
      const t=peek();
      if(types.has(t)) return parseVarDecl();
      if(t==='if'){ next(); expect('('); const c=parseExpr(); expect(')'); const then=parseBlock(); let els=null; if(peek()==='else'){ next(); els=parseBlock(); } return {k:'if',c,then,els}; }
      if(t==='while'){ next(); expect('('); const c=parseExpr(); expect(')'); return {k:'while',c,body:parseBlock()}; }
      if(t==='for'){ next(); expect('('); const init=peek()===';'?null:parseForInit(); expect(';'); const cond=peek()===';'?{k:'lit',v:true}:parseExpr(); expect(';'); const upd=peek()===')'?null:parseForUpd(); expect(')'); return {k:'for',init,cond,upd,body:parseBlock()}; }
      if(t==='{') return parseBlock();
      if(t==='System'){ next(); expect('.'); expect('out'); expect('.'); const fn=next(); expect('('); const arg=peek()===')'?{k:'lit',v:''}:parseExpr(); expect(')'); expect(';'); return {k:'print',arg,nl:fn==='println'}; }
      if(isId(t)){
        const name=next();
        if(peek()==='++'||peek()==='--'){ const op=next(); expect(';'); return {k:'incdec',name,op}; }
        if(peek()==='+='||peek()==='-='){ const op=next(); const v=parseExpr(); expect(';'); return {k:'opassign',name,op,v}; }
        expect('='); const v=parseExpr(); expect(';'); return {k:'assign',name,v};
      }
      throw new Error("instrucción no reconocida cerca de '"+t+"'");
    }

    const prog=[]; while(peek()!=='<EOF>') prog.push(parseStmt());

    const env={}; const output=[]; let steps=0;
    function ev(n){
      if(n.k==='lit') return n.v;
      if(n.k==='var'){ if(!(n.name in env)) throw new Error('variable no definida: '+n.name); return env[n.name]; }
      if(n.k==='un') return n.op==='!'?!ev(n.v):-ev(n.v);
      if(n.k==='bin'){
        if(n.op==='&&') return ev(n.l)&&ev(n.r);
        if(n.op==='||') return ev(n.l)||ev(n.r);
        const l=ev(n.l), r=ev(n.r);
        switch(n.op){
          case '+': return (typeof l==='string'||typeof r==='string')?String(l)+String(r):l+r;
          case '-': return l-r;
          case '*': return l*r;
          case '/': { const res=l/r; return (Number.isInteger(l)&&Number.isInteger(r))?Math.trunc(res):res; }
          case '%': return l%r;
          case '==': return l===r;
          case '!=': return l!==r;
          case '<': return l<r;
          case '>': return l>r;
          case '<=': return l<=r;
          case '>=': return l>=r;
        }
      }
    }
    function doUpd(u){ if(!u) return; if(u.k==='incdec') env[u.name]+= u.op==='++'?1:-1; else if(u.k==='opassign') env[u.name]=u.op==='+='?ev({k:'bin',op:'+',l:{k:'lit',v:env[u.name]},r:u.v}):env[u.name]-ev(u.v); else env[u.name]=ev(u.v); }
    function exec(s){
      if(++steps>200000) throw new Error('demasiadas iteraciones (posible bucle infinito)');
      if(s.k==='block'){ s.body.forEach(exec); return; }
      if(s.k==='decls'){ s.decls.forEach(d=>{ env[d.name]=d.v?ev(d.v):0; }); return; }
      if(s.k==='assign'){ env[s.name]=ev(s.v); return; }
      if(s.k==='opassign'){ doUpd(s); return; }
      if(s.k==='incdec'){ doUpd(s); return; }
      if(s.k==='print'){ output.push(String(ev(s.arg))+(s.nl?'\n':'')); return; }
      if(s.k==='if'){ if(ev(s.c)) exec(s.then); else if(s.els) exec(s.els); return; }
      if(s.k==='while'){ while(ev(s.c)) exec(s.body); return; }
      if(s.k==='for'){ if(s.init){ env[s.init.name]=ev(s.init.v); } while(ev(s.cond)){ exec(s.body); doUpd(s.upd); } return; }
    }
    prog.forEach(exec);
    out.textContent=output.length?output.join(''):'(sin salida)';
  }catch(e){
    out.textContent='Error: '+e.message;
    out.classList.add('err');
  }
}

