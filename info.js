const button=document.querySelector('.menu-button');
const nav=document.getElementById('siteNav');
function closeMenu(){if(!button||!nav)return;button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Открыть меню');nav.classList.remove('open')}
if(button&&nav){
 button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));button.setAttribute('aria-label',open?'Открыть меню':'Закрыть меню');nav.classList.toggle('open',!open)});
 nav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu()});
 document.addEventListener('click',event=>{if(!event.target.closest('.header'))closeMenu()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMenu();button.focus()}});
}
if(location.hash){requestAnimationFrame(()=>{const target=document.querySelector(location.hash);if(target)target.scrollIntoView()})}
