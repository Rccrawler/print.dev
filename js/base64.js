function b64(mode){
  const el=document.getElementById('b64In');
  const out=document.getElementById('b64Out');
  try{
    if(mode==='encode'){
      out.textContent=btoa(unescape(encodeURIComponent(el.value)));
    }else{
      out.textContent=decodeURIComponent(escape(atob(el.value)));
    }
    out.classList.remove('err');
  }catch(e){
    out.textContent='No se pudo procesar el texto.';
    out.classList.add('err');
  }
}
