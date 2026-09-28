const script = `(function(){try{var d=document.documentElement;var p=localStorage.getItem('theme')||'auto';var h=new Date().getHours();var t=p==='auto'?(h>=7&&h<19?'day':'night'):p;d.dataset.theme=t;d.dataset.themePref=p;}catch(e){document.documentElement.dataset.theme='day';}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
