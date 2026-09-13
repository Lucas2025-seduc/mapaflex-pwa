  function drawNode(n){
    const metrics=nodeMetrics(n);
    const {w,h,x,y,editorX,editorW,editorH,showImageOnly}=metrics;
    const g=svgEl('g',{class:'node'+(n.id===selected?' selected':'')+(editingNode===n.id?' editing':'')+(n.link?' hasLink':''),'data-id':n.id,transform:`translate(${n.x},${n.y})`});
    let rx=10;
    if(n.shape==='pill') rx=28; else if(n.shape==='box') rx=4;
    const t=themes[state.theme]||themes.blue;
    const rect=svgEl('rect',{x,y,width:w,height:h,rx,fill:n.id==='root'?t.root:n.color||'#fff',stroke:n.id==='root'?t.rootBorder:'#cbd5e1'});
    g.appendChild(rect);

    const showThumb = !!n.image && !(presentationMode && currentPresentationNode()?.id===n.id);
    if(showThumb && showImageOnly){
      const img=svgEl('image',{class:'nodeImage',x:x+8,y:y+8,width:w-16,height:h-16,href:n.image,preserveAspectRatio:'xMidYMid meet'});
      img.addEventListener('mousedown',ev=>ev.stopPropagation());
      img.addEventListener('click',(ev)=>{ ev.preventDefault(); ev.stopPropagation(); openImageModal(n.image, n.text || 'Imagem do balão'); });
      const imgTip=svgEl('title'); imgTip.textContent='Clique para ampliar a imagem'; img.appendChild(imgTip);
      g.appendChild(img);
    }

    if(editingNode===n.id){
      const fo=svgEl('foreignObject',{class:'nodeEditorFO',x:editorX,y:y+6,width:editorW,height:editorH});
      const input=document.createElementNS('http://www.w3.org/1999/xhtml','textarea');
      input.className='nodeEditor';
      input.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
      input.value=n.text;
      input.setAttribute('aria-label','Editar texto do balão');
      input.setAttribute('rows','1');
      if(n.bold) input.style.fontWeight='750';
      if(n.italic) input.style.fontStyle='italic';
      input.addEventListener('mousedown',ev=>ev.stopPropagation());
      input.addEventListener('click',ev=>ev.stopPropagation());
      input.addEventListener('dblclick',ev=>ev.stopPropagation());
      input.addEventListener('input',()=>{
        const nn=nodeById(n.id); if(!nn) return;
        nn.text=input.value || 'Novo tópico';
        $('nodeTextInput').value=input.value;
        autoGrowEditor(input);
      });
      input.addEventListener('keydown',(ev)=>{
        if(ev.key==='Enter' && !ev.shiftKey){ev.preventDefault();ev.stopPropagation();finishInlineEdit();}
        if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();finishInlineEdit(true);}
      });
      input.addEventListener('blur',()=>{ if(editingNode===n.id) finishInlineEdit(); });
      fo.appendChild(input);
      g.appendChild(fo);
    } else if(!showImageOnly) {
      appendWrappedText(g,n,metrics);
    }

    const presentOrder=normalizePresentOrder(n.presentOrder);
    if(presentOrder!==''){
      const badge=svgEl('circle',{cx:x+16,cy:y+16,r:12,fill:t.accent,stroke:'#fff','stroke-width':2});
      g.appendChild(badge);
      const badgeText=svgEl('text',{class:'nodeOrderBadgeText',x:x+16,y:y+16+0.5,'text-anchor':'middle','dominant-baseline':'middle'});
      badgeText.textContent=presentOrder;
      g.appendChild(badgeText);
    }

    if(Array.isArray(n.attachments) && n.attachments.length){
      const aText=svgEl('text',{x:x+10,y:h/2-9,'font-size':10,'text-anchor':'start',fill:'#64748b','font-weight':700});
      const hasAudio=n.attachments.some(a=>a.kind==='audio');
      aText.textContent=(hasAudio?'🎵 ':'📎 ')+n.attachments.length;
      aText.setAttribute('pointer-events','none');
      g.appendChild(aText);
    }

    if(state.collapsed.includes(n.id)){
      const c=svgEl('circle',{cx:w/2-12,cy:-h/2+12,r:6,fill:t.accent});
      g.appendChild(c);
    }
    if(n.link){
      const link=svgEl('text',{x:w/2-10,y:h/2-10,'font-size':10,'text-anchor':'end',fill:t.accent});
      link.textContent='🔗';
      link.setAttribute('pointer-events','none');
      g.appendChild(link);
      const tip=svgEl('title');
      tip.textContent='Clique para abrir o link • Duplo clique para editar o título';
      g.appendChild(tip);
    }

    g.addEventListener('mousedown',onNodeDown);
    g.addEventListener('dblclick',(ev)=>{
      ev.preventDefault(); ev.stopPropagation();
      if(nodeClickTimer){clearTimeout(nodeClickTimer);nodeClickTimer=null;}
      nodeWasDragged=false;
      beginInlineEdit(n.id);
    });
    g.addEventListener('click',(ev)=>{
      ev.stopPropagation();
      if(nodeWasDragged){ nodeWasDragged=false; return; }
      selectNodeWithoutRender(n.id);
      if(connectSource && connectSource!==n.id){ createRelation(connectSource,n.id); return; }
      if(n.link){
        if(nodeClickTimer) clearTimeout(nodeClickTimer);
        nodeClickTimer=setTimeout(()=>{
          nodeClickTimer=null;
          if(editingNode===n.id) return;
          window.location.href=n.link;
        },330);
      }
    });
    g.addEventListener('contextmenu',(ev)=>{ev.preventDefault(); selectNode(n.id); showContext(ev.clientX,ev.clientY);});
    nodesG.appendChild(g);

    if(editingNode===n.id) {
      requestAnimationFrame(()=>{
        const input=g.querySelector('.nodeEditor');
        if(input){ input.focus(); input.select(); autoGrowEditor(input); }
        showNodeToolbar(n, g);
      });
    }
  }
  function selectNode(id){ selected=id; render(); }
  function beginInlineEdit(id){
    selected=id;
    editingNode=id;
    render();
  }
  function finishInlineEdit(cancel=false){
    if(!editingNode) return;
    const id=editingNode, n=nodeById(id);
    if(n && !cancel){
      const el=nodesG.querySelector(`g[data-id="${CSS.escape(id)}"] .nodeEditor`);
      if(el) n.text=el.value.trim() || n.text;
    }
    editingNode=null;
    hideNodeToolbar();
    resolveNodeOverlaps({padding:28,iterations:20});
    render(); saveLocal();
  }
  function showNodeToolbar(n,g){
    const tb=$('nodeToolbar'); if(!tb) return;
    const r=g.getBoundingClientRect();
    tb.style.left=Math.max(8, Math.min(window.innerWidth-250, r.left + r.width/2 - 120))+'px';
    tb.style.top=Math.max(62, r.top - 48)+'px';
    tb.classList.add('visible');
  }
  function hideNodeToolbar(){ $('nodeToolbar')?.classList.remove('visible'); }
  $('nodeToolbar')?.addEventListener('mousedown',e=>e.preventDefault());

  $('tbBold').onclick=()=>{const n=nodeById(selected);if(!n)return;pushHistory();n.bold=!n.bold;render();beginInlineEdit(n.id)};
  $('tbItalic').onclick=()=>{const n=nodeById(selected);if(!n)return;pushHistory();n.italic=!n.italic;render();beginInlineEdit(n.id)};
  $('tbDone').onclick=()=>finishInlineEdit();

  $('tbColor').onclick=()=>{
    const n=nodeById(selected); if(!n) return;
    const choice=prompt('Cor do balão (HEX, por exemplo #E8F0FF):',n.color||'#FFFFFF');
    if(choice && /^#[0-9A-Fa-f]{6}$/.test(choice.trim())){
      pushHistory(); n.color=choice.trim(); render(); beginInlineEdit(n.id);
    }
  };

  $('tbLink').onclick=async()=>{
    const n=nodeById(selected); if(!n) return;
    const url=prompt('Cole a URL do vídeo ou link:',n.link||'https://');
    if(url!==null) await setNodeLink(n,url);
  };

  $('tbImage').onclick=()=>{ $('imageInput').click(); };
  $('tbRemoveImage').onclick=()=>{
    const n=nodeById(selected); if(!n) return;
    pushHistory(); n.image=''; render(); beginInlineEdit(n.id);
  };

  $('imageInput').onchange=(ev)=>{
    const file=ev.target.files[0]; if(!file || !selected) return;
    if(file.size > 5*1024*1024){ alert('Use imagens de até 5 MB.'); ev.target.value=''; return; }
    const fr=new FileReader();
    fr.onload=()=>{
      const n=nodeById(selected); if(!n) return;
      pushHistory(); n.image=fr.result; editingNode=null; hideNodeToolbar(); resolveNodeOverlaps({padding:30,iterations:24}); render(); saveLocal();
    };
    fr.readAsDataURL(file); ev.target.value='';
  };

  function bytesLabel(size){
    const n=Number(size)||0;
    if(n<1024) return n+' B';
    if(n<1024*1024) return (n/1024).toFixed(1)+' KB';
    return (n/(1024*1024)).toFixed(1)+' MB';
  }