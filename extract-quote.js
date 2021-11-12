import {DOMFromString,xpath,XML2OffText} from 'pitaka/xmlparser';
import {openBasket,fetchRange} from 'pitaka'
import {translatePointer} from 'pitaka/format'
import { diffCJK, trimPunc } from 'pitaka/utils';
import { makeHook } from 'pitaka/offtext';
const ptk=await openBasket('cb-t'); 

/*
<lb n="0225a08" ed="Y"/>宗說：<lb n="0225a08" ed="Y" type="old"/>凡言語所表詮的，心行所緣慮的，都是世俗，唯有<quote type="嚴謹引文">「心行言語斷」<note n="0225001" resp="厚觀法師" type="add">《中論》卷3〈18 觀法品〉(CBETA, T30, no. 1564, p. 24, a3)</note></quote>

<cit><bibl><title level="m">《
<lb n="0227a06" ed="Y"/>中<lb n="0227a06" ed="Y" type="old"/>論》</title>說</bibl><quote type="嚴謹引文">「諸佛依二諦，為眾生說法」</quote></cit>

*/
//嚴謹引文 ，換算為hook
const closeHandlers={

}
export const handlers={
    quote:(el,xmlctx)=>{
        if (el.attrs.source) {
            const q=trimPunc(el.innerText()
            .replace(/\r?\n/g,'')
            .replace(/《.+/,'')
            .replace(/[」』][a-z\)\(\d]*$/,'')
            );
            // console.log(xmlctx.loc,el.attrs.source)
            xmlctx.quotes.push([xmlctx.loc,el.attrs.source,q ])
        }
    },
    lb:(el,xmlctx)=>{
        if (el.attrs.type!=='old') xmlctx.loc=el.attrs.n;
    }
}
const found=[],failed=[];
export const onRawContent=async (fn,rawtext,ctx)=>{
    const el=DOMFromString(ctx.rawContent);   
    const body=xpath(el,'text/body');
    const xmlctx={quotes:[],defs:ctx.labeldefs,lbcount:0,hide:0,snippet:'',div:0,fn,started:false};
    XML2OffText(body,xmlctx,handlers,closeHandlers);
    let success=false;
    // if (xmlctx.quotes.length) console.log(fn,'quote count',xmlctx.quotes.length)
    for (let i=0;i<xmlctx.quotes.length;i++){
        const [lb,source,q]=xmlctx.quotes[i];
        const ptr=translatePointer(source,'cbeta');
        if (ptr.indexOf('/cb-t')!==0) continue;

        const {from,lines} = await fetchRange(ptr,{ptk,extra:3});

        const first2=q.substr(0,2);
        for (let i=0;i<lines.length-1;i++) {
            const line=lines[i];
            let at= line.indexOf(first2);
            while (at>-1 && at<line.length) {
                const [d,x,w,sim]=diffCJK(q,line,at,Math.floor(q.length*1.5));
                if (sim>0.75) {
                    const h=makeHook(line,x,w);
                    const addr='/'+ptk.name+'/'+ptk.pageAt(from+i,true)+h;
                    found.push([fn,lb,addr ]);
                    success=true;
                    break;
                }
                at=line.indexOf(first2,at+2);
            }
        }
        if (!success) {
            failed.push([fn,lb,source,q]);
        }
    }
}

export const onFinalize=async ()=>{
    console.log('write to transclusion.json and failquote.txt');
    const out={}
    for (let i=0;i<found.length;i++) {
        const [fn,lb,addr]=found[i];
        if (!out[fn]) out[fn]={};
        out[fn][lb]=addr; //max one quote per lb
    }
    fs.writeFileSync('transclusion.json',JSON.stringify(out,'',' '),'utf8')
    fs.writeFileSync('failquote.txt',failed.join('\n'),'utf8')
}