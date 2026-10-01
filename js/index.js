const runtimeLines=[
    ['tag','<main class="portfolio">'],
    ['tag','  <h1>Utilidades para programar</h1>'],
    ['selector','.portfolio'],
    ['property','  display: grid; color: var(--text);'],
    ['tag','  <a class="card-link">Formateador JSON</a>'],
    ['keyword','const tools = document.querySelectorAll(\'.card-link\');'],
    ['method','tools.forEach(tool => openTool(tool));'],
    ['property','  background: var(--surface); border: 1px solid;'],
    ['tag','</main>'],
    ['keyword','requestAnimationFrame(render);']
];
let runtimeLine=0;
function renderRuntime(){
    const out=document.getElementById('runtimeCode');
    if(!out) return;
    const escapeCode=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const visibleCount=4;
    const lastStart=Math.max(0,runtimeLines.length-visibleCount);
    const start=Math.min(Math.max(0,runtimeLine-(visibleCount-2)),lastStart);
    const visibleLines=runtimeLines.slice(start,start+visibleCount);
    out.innerHTML=`<span class="runtime-inline-status"><b></b> running</span>`+visibleLines.map((line,index)=>{const lineNumber=start+index;return `<span class="runtime-line ${lineNumber===runtimeLine?'is-running':''}"><b>${String(lineNumber+1).padStart(2,'0')}</b><code class="syntax-${line[0]}">${escapeCode(line[1])}</code></span>`}).join('');
}
renderRuntime();
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    setInterval(()=>{
    runtimeLine=(runtimeLine+1)%runtimeLines.length;
    renderRuntime();
    },900);
}

function filterTools(q){
    q=q.trim().toLowerCase();
    const cards=document.querySelectorAll('#toolsGrid .card-link');
    let visible=0;
    cards.forEach(c=>{
    const match=!q||c.dataset.name.includes(q)||c.querySelector('h3').textContent.toLowerCase().includes(q);
    c.classList.toggle('hide',!match);
    if(match) visible++;
    });
    document.getElementById('emptyMsg').style.display=visible?'none':'block';
}

document.addEventListener('click', event => {
    const toolLink = event.target.closest('#toolsGrid .card-link');
    if (!toolLink || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || toolLink.target === '_blank' || toolLink.hasAttribute('download') || toolLink.origin !== location.origin) return;

    event.preventDefault();
    if (document.body.classList.contains('tool-navigation-leaving')) return;

    const destination = toolLink.href;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.location.assign(destination);
        return;
    }

    document.body.classList.add('tool-navigation-leaving');
    window.setTimeout(() => window.location.assign(destination), 280);
});

// --- Animación de escritura de título (Typewriter) ---
function getTitlePhrases() {
    if (window.i18n && typeof window.i18n.t === 'function') {
        return [
            window.i18n.t('hero_title_phrase_1'),
            window.i18n.t('hero_title_phrase_2')
        ];
    }
    return ['Utilidades rápidas para programar sin pausa', 'Herramientas prácticas'];
}

let typewriterTimeoutId = null;

function startTypewriter(forceRestart = false) {
    const typingTitle = document.getElementById('typingTitle');
    if (!typingTitle) return;
    if (!forceRestart && typingTitle.dataset.typingStarted) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    typingTitle.dataset.typingStarted = 'true';

    if (typewriterTimeoutId) {
        clearTimeout(typewriterTimeoutId);
    }

    const titlePhrases = getTitlePhrases();
    let phraseIndex = 0;
    let titleText = titlePhrases[phraseIndex];
    let titleIndex = 0;
    let deleting = false;

    const typeTitle = () => {
        if (!document.getElementById('typingTitle')) return;
        if (!deleting) {
            titleIndex++;
            typingTitle.textContent = titleText.slice(0, titleIndex);
            if (titleIndex === titleText.length) {
                deleting = true;
                typewriterTimeoutId = setTimeout(typeTitle, 3500);
                return;
            }
            typewriterTimeoutId = setTimeout(typeTitle, 75);
            return;
        }

        titleIndex--;
        typingTitle.textContent = titleText.slice(0, titleIndex);
        if (titleIndex === 0) {
            const currentPhrases = getTitlePhrases();
            phraseIndex = (phraseIndex + 1) % currentPhrases.length;
            titleText = currentPhrases[phraseIndex];
            deleting = false;
            typewriterTimeoutId = setTimeout(typeTitle, 450);
            return;
        }
        typewriterTimeoutId = setTimeout(typeTitle, 40);
    };

    typewriterTimeoutId = setTimeout(() => {
        titleIndex = 0;
        typingTitle.textContent = '';
        deleting = false;
        typeTitle();
    }, forceRestart ? 100 : 900);
}

startTypewriter();

// Reiniciar máquina de escribir si cambia el idioma
document.addEventListener('languageChanged', () => {
    startTypewriter(true);
});

// Detectar cambios en <main> para reiniciar el typewriter si se vuelve a Inicio con fast-navigation
const mainContainer = document.querySelector('main');
if (mainContainer) {
    const mainObserver = new MutationObserver(() => {
        startTypewriter();
    });
    mainObserver.observe(mainContainer, { childList: true, subtree: true });
}

// --- Selector de idioma ---
const closeLanguageMenu = () => {
    const langSelect = document.getElementById('langSelect');
    const langBtn = document.getElementById('langBtn');
    if (langSelect) langSelect.classList.remove('open');
    if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
};

document.addEventListener('click', (event) => {
    const langBtn = event.target.closest('#langBtn');
    const langSelect = document.getElementById('langSelect');
    if (langBtn && langSelect) {
        event.stopPropagation();
        const isOpen = langSelect.classList.toggle('open');
        langBtn.setAttribute('aria-expanded', String(isOpen));
        return;
    }

    const langOpt = event.target.closest('.lang-opt');
    if (langOpt && langSelect) {
        const selectedLang = langOpt.dataset.lang;

        // Actualizar UI del menú
        document.querySelectorAll('.lang-opt').forEach(item => item.classList.remove('active'));
        langOpt.classList.add('active');
        const langLabel = document.querySelector('#langBtn .mono');
        if (langLabel && selectedLang) {
            langLabel.textContent = selectedLang.toUpperCase();
        }
        closeLanguageMenu();

        // Aplicar el idioma a través del módulo i18n (persiste en localStorage y traduce todo el DOM)
        if (selectedLang && window.i18n && typeof window.i18n.setLanguage === 'function') {
            window.i18n.setLanguage(selectedLang);
        }
        return;
    }

    if (langSelect && !event.target.closest('#langSelect')) {
        closeLanguageMenu();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLanguageMenu();
});

// --- Ocultar / Mostrar header al hacer scroll ---
let lastScrollY = window.scrollY;
let scrollFramePending = false;
function showHeaderOnPageEntry() {
    const siteHeader = document.querySelector('header');
    if (!siteHeader) return;
    siteHeader.classList.remove('header-hidden');
    lastScrollY = window.scrollY;
}

showHeaderOnPageEntry();
window.addEventListener('pageshow', showHeaderOnPageEntry);

window.addEventListener('scroll', () => {
    if (scrollFramePending) return;
    scrollFramePending = true;
    requestAnimationFrame(() => {
        const siteHeader = document.querySelector('header');
        if (!siteHeader) {
            scrollFramePending = false;
            return;
        }
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY + 6 && currentScrollY > 80) {
            siteHeader.classList.add('header-hidden');
            closeLanguageMenu();
        } else if (currentScrollY < lastScrollY - 6 || currentScrollY <= 80) {
            siteHeader.classList.remove('header-hidden');
        }
        lastScrollY = currentScrollY;
        scrollFramePending = false;
    });
}, { passive: true });