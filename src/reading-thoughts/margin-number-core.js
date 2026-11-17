/* Identify aligned, consecutive draft line-number columns by PDF geometry. */
var MarginNumberCore = (() => {
  const median=values=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]||0;};
  function detect(page,templates=[]){
    const chars=page?.chars||[],box=page?.viewBox;
    const empty={indices:new Set(),groups:[]};
    if(!box||chars.length<80)return empty;
    const width=box[2]-box[0],height=box[3]-box[1];
    const letters=chars.filter(c=>c.rect&&!c.isolated&&!c.rotation&&/\p{L}/u.test(c.c));
    if(letters.length<50&&!templates.length)return empty;
    const font=median(letters.map(c=>c.fontSize||c.rect[3]-c.rect[1]))||median(templates.map(t=>t.fontSize))/.8;
    const body=letters.filter(c=>(c.fontSize||c.rect[3]-c.rect[1])>=font*.85);
    const left=Math.min(...body.map(c=>c.rect[0])),right=Math.max(...body.map(c=>c.rect[2]));
    const candidates=[];let token=[];
    const flush=()=>{
      if(!token.length)return;
      const text=token.map(x=>x.char.c).join('');
      if(/^\d{1,4}$/.test(text)){
        const x0=Math.min(...token.map(x=>x.char.rect[0])),x1=Math.max(...token.map(x=>x.char.rect[2]));
        const y=median(token.map(x=>(x.char.rect[1]+x.char.rect[3])/2));
        const size=median(token.map(x=>x.char.fontSize||x.char.rect[3]-x.char.rect[1]));
        const x=(x0+x1)/2,fontName=token[0].char.fontName;
        const template=templates.find(t=>Math.abs(t.x-x)<2.5&&Math.abs(t.fontSize-size)<.6&&(!t.fontName||t.fontName===fontName));
        const normalSide=x1<left-7&&x1<box[0]+width*.16?'left':x0>right+7&&x0>box[0]+width*.84?'right':null;
        const strict=!!normalSide&&size<=font*.95,side=strict?normalSide:template?.side;
        if(side&&y>box[1]+height*.025&&y<box[3]-height*.025)candidates.push({text,value:Number(text),x,y,size,fontName,side,knownTemplate:!!template,strict,indices:token.map(x=>x.index)});
      }
      token=[];
    };
    for(let index=0;index<chars.length;index++){
      const char=chars[index];
      if(!char.rect||char.rotation){flush();continue;}
      if(token.length){const previous=token.at(-1).char;if(Math.abs((previous.baseline??previous.rect[1])-(char.baseline??char.rect[1]))>2||Math.abs(previous.rect[2]-char.rect[0])>Math.max(3,font*.5))flush();}
      token.push({char,index});
      if(char.wordBreakAfter||char.spaceAfter||char.lineBreakAfter||char.paragraphBreakAfter)flush();
    }
    flush();
    const columns=[];
    for(const candidate of candidates){
      let column=columns.find(c=>c.side===candidate.side&&Math.abs(c.x-candidate.x)<2.5&&Math.abs(c.size-candidate.size)<1&&c.fontName===candidate.fontName);
      if(!column){column={x:candidate.x,size:candidate.size,side:candidate.side,fontName:candidate.fontName,rows:[]};columns.push(column);}
      column.rows.push(candidate);
    }
    const indices=new Set(),groups=[];
    for(const column of columns){
      const rows=column.rows.sort((a,b)=>b.y-a.y);
      const known=rows.every(row=>row.knownTemplate),strict=rows.every(row=>row.strict);
      if(rows.length<(known?2:8)||rows[0].y-rows.at(-1).y<font*(known?.5:6))continue;
      let sequential=0;for(let i=1;i<rows.length;i++)if(rows[i].value===rows[i-1].value+1&&rows[i-1].y-rows[i].y>1)sequential++;
      if(sequential/(rows.length-1)<.88)continue;
      for(const row of rows)for(const index of row.indices)indices.add(index);
      groups.push({side:column.side,count:rows.length,first:rows[0].value,last:rows.at(-1).value,x:Number(column.x.toFixed(2)),fontSize:column.size,fontName:column.fontName,source:strict&&rows.length>=8?'page-layout':'document-template'});
    }
    return {indices,groups};
  }
  function textFromChars(chars,excluded,start=0,end=chars.length){
    const text=[];let removed=0;
    for(let index=start;index<end;index++){
      const char=chars[index];if(!char)continue;
      if(excluded?.has(index)){removed++;continue;}
      if(!char.ignorable){text.push(char.c);if(char.spaceAfter||char.lineBreakAfter)text.push(' ');if(char.paragraphBreakAfter)text.push(' ');}
    }
    return {text:text.join('').trim(),removed};
  }
  function cleanRange(page,range,model){
    const start=Math.min(range.anchorOffset,range.headOffset),end=Math.max(range.anchorOffset,range.headOffset);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>page.chars.length)return {text:range.text,removed:0};
    const result=textFromChars(page.chars,model.indices,start,end);
    return result.removed?result:{text:range.text,removed:0};
  }
  return {detect,textFromChars,cleanRange};
})();
