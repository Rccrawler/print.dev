let pyodidePromise;
const pyodideIndexURL='https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

function loadPython(){
  if(!pyodidePromise){
    pyodidePromise=loadPyodide({indexURL:pyodideIndexURL});
  }
  return pyodidePromise;
}

async function runPythonCode(){
  const input=document.getElementById('pythonIn').value;
  const output=document.getElementById('pythonOut');
  const status=document.getElementById('pythonStatus');
  const button=document.getElementById('pythonRun');
  output.classList.remove('err');
  output.textContent='';
  button.disabled=true;
  status.textContent='Cargando Python en el navegador (solo la primera vez)...';

  try{
    const pyodide=await loadPython();
    pyodide.runPython('import sys\nimport io\nsys.stdout = io.StringIO()');
    await pyodide.runPythonAsync(input);
    output.textContent=pyodide.runPython('sys.stdout.getvalue()') || '(sin salida)';
    status.textContent='Python listo. La siguiente ejecución será más rápida.';
  }catch(error){
    output.textContent=error.message || String(error);
    output.classList.add('err');
    status.textContent='Se produjo un error al ejecutar el código.';
  }finally{
    button.disabled=false;
  }
}