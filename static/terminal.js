// A browser-only content navigator. No shell, model, telemetry or persistent history.
const terminal = document.querySelector('.hero-terminal');
if (terminal) {
  const input = terminal.querySelector('input'), output = terminal.querySelector('.terminal-output');
  const history = []; let cursor = 0, draft = '', records = [], failed = false;
  const indexURL = new URL('search-index.json', document.baseURI);
  const ready = fetch(indexURL, {signal: AbortSignal.timeout(10000)}).then(r => { if (!r.ok) throw new Error('Index unavailable'); return r.json(); })
    .then(data => { records = data.pages.filter(p => typeof p.title === 'string' && typeof p.url === 'string' && p.url.startsWith('/') && !p.url.startsWith('//') && !p.url.includes('\\')); })
    .catch(() => { failed = true; });
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const flatten = value => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ') : Array.isArray(value) ? value.map(flatten).join(' ') : value && typeof value === 'object' ? Object.values(value).map(flatten).join(' ') : '';
  const textFor = p => [p.title, p.description, p.subtitle, p.content, flatten(p.copy)].filter(Boolean).join(' ').replace(/\s+/g, ' ');
  function paragraph(parent, text, css='') { const p=document.createElement('p');p.textContent=text;p.className=css;parent.append(p); }
  function links(parent, pages) {
    const list=document.createElement('ul');list.className='terminal-result-list';
    for(const page of pages) {const li=document.createElement('li'),a=document.createElement('a');a.textContent=`${page.title} →`;a.href=page.url;li.append(a);const small=document.createElement('small');small.textContent=[page.url, page.description || page.subtitle || ''].filter(Boolean).join(' — ');li.append(small);list.append(li);}
    parent.append(list);
  }
  function append(entry) {output.append(entry);while(output.children.length>40) output.firstElementChild.remove();output.scrollTop=output.scrollHeight;}
  function find(arg, servicesOnly=false) {
    const key=normalize(arg);return records.filter(p => !servicesOnly || p.service).find(p => normalize(p.title)===key || normalize(p.slug)===key || normalize(p.url)===key);
  }
  function search(arg) {const terms=arg.toLowerCase().match(/[a-z0-9]+/g)||[];return terms.length ? records.filter(p=>terms.every(t=>textFor(p).toLowerCase().includes(t))) : [];}
  function show(entry,p) {paragraph(entry,p.title,'terminal-reply-title');paragraph(entry,p.subtitle || p.description);const body=(p.content || flatten(p.copy)).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();if(body) paragraph(entry,body.slice(0,3500)+(body.length>3500?'…':''));links(entry,[p]);}
  const baseCommands=['herr -help','herr -services','herr -pages','herr -search ','herr -show ','herr -service ','herr -open ','herr -pricing','herr -work','herr -about','herr -contact','herr -blog','herr -history','herr -clear','ls','clear','help'];
  let busy=false;
  async function run(raw) {
    const command=raw.trim().slice(0,300);if(!command || busy) return;
    busy=true;
    try {
      if(history.at(-1)!==command) history.push(command);if(history.length>50) history.shift();cursor=history.length;draft='';input.value='';
      const entry=document.createElement('div');entry.className='terminal-entry';paragraph(entry,`$ ${command}`,'terminal-echo');
      let flag,arg='';
      const match=command.match(/^herr(?:\s+(-{1,2}[a-z-]+))?(?:\s+([\s\S]*))?$/i);
      if(match){flag=(match[1]||'-help').replace(/^--/,'-').toLowerCase();arg=(match[2]||'').trim().replace(/^(["'])(.*)\1$/,'$2');}
      else {const [cmd,...parts]=command.split(/\s+/);flag=({help:'-help',clear:'-clear',ls:'-pages',cat:'-show',man:'-service',find:'-search',search:'-search',services:'-services'})[cmd.toLowerCase()]||'-unknown';arg=parts.join(' ');}
      if(flag==='-clear'){output.replaceChildren();return;}
      if(flag==='-help') {
        paragraph(entry,'Explore Herr Systems','terminal-reply-title');
        for(const line of ['herr -services [name] → List services, or read one','herr -pages → Browse published pages (ls)','herr -show name → Read page information (cat name)','herr -search words → Search pages and services (find words)','herr -open name → Visit an indexed page','herr -pricing / -work / -about / -contact / -blog → Page information','herr -history → Recall recent commands','clear → Clear output','↑↓ recalls commands. Tab completes commands and page names.','This content navigator runs in your browser. It is not a system shell or an AI chat, and sends no messages.']) paragraph(entry,line);
      } else if(flag==='-history') history.slice(-10).forEach((v,i)=>paragraph(entry,`${i+1}  ${v}`));
      else if(flag==='-unknown') paragraph(entry,'Command not found. Try herr -help.','terminal-error');
      else {
        await ready;
        if(failed) paragraph(entry,'The content index is unavailable. Browse Services from the site navigation, or reload to retry.','terminal-error');
        else if(flag==='-pages') links(entry,records);
        else if(flag==='-services'&&!arg) links(entry,records.filter(p=>p.service));
        else if(flag==='-search'||flag==='-chat') {const matches=search(arg);if(matches.length) links(entry,matches);else paragraph(entry,'No matching pages. Try herr -services or a more specific search.');}
        else {
          const aliases={'-pricing':'pricing','-work':'case-studies','-about':'about','-contact':'contact','-blog':'blog'};
          const page=find(aliases[flag]||arg,flag==='-service'||flag==='-services');
          if(!page) paragraph(entry,'Page not found. Try herr -pages or herr -search words.','terminal-error');
          else if(flag==='-open') {paragraph(entry,`Opening ${page.title}…`);append(entry);window.location.assign(page.url);return;}
          else if(['-show','-service','-services',...Object.keys(aliases)].includes(flag)) show(entry,page);
          else paragraph(entry,'Command not found. Try herr -help.','terminal-error');
        }
      }
      append(entry);
    } finally {busy=false;}
  }
  terminal.querySelector('form').addEventListener('submit',e=>{e.preventDefault();run(input.value);});
  input.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if(e.key==='ArrowUp'){e.preventDefault();if(cursor===history.length)draft=input.value;cursor=Math.max(0,cursor-1);input.value=history[cursor]||draft;input.setSelectionRange(input.value.length,input.value.length);}
    else if(e.key==='ArrowDown'){e.preventDefault();cursor=Math.min(history.length,cursor+1);input.value=cursor===history.length?draft:history[cursor];input.setSelectionRange(input.value.length,input.value.length);}
    else if(e.key==='Escape'){input.value='';draft='';cursor=history.length;}
    else if(e.key==='Tab'&&!e.shiftKey&&input.value.trim()) {const commands=[...baseCommands,...records.flatMap(p=>[`herr -open ${normalize(p.title)}`,`herr -show ${normalize(p.title)}`,`herr -service ${normalize(p.title)}`])];const prefix=input.value.trim().toLowerCase();const matches=[...new Set(commands)].filter(c=>c.startsWith(prefix));if(matches.length===1&&matches[0]!==prefix){e.preventDefault();input.value=matches[0]+' ';}}
  });
  terminal.querySelectorAll('button,input').forEach(c=>{c.disabled=false;});
}
