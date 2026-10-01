function formatJSON(){
  const out=document.getElementById('jsonOut');
  try{
    const parsed=JSON.parse(document.getElementById('jsonIn').value);
    out.textContent=JSON.stringify(parsed,null,2);
    out.classList.remove('err');
  }catch(e){
    out.textContent='JSON inválido: '+e.message;
    out.classList.add('err');
  }
}