import { writeChanged,nodefs, readTextLines, readTextContent,filesFromPattern,
DOMFromString,xpath,walkDOMOfftext,toBase26} from 'ptk/nodebundle.cjs'
import {buildCharmap} from './cbetatei.js';
const outdir='cb-y.offtext/';
import {pageunit} from './pageunit.js';

await nodefs;
const files=filesFromPattern('xml/Y3[0123]');
const ctx={
	preface_p_count:0, 
	pb:'',
	prevpb:'',
	hide:0,
	prefaces:[],
	onText:(t)=>{
		if (ctx.hide) return '';
		const s=ctx.pre?t:t.trimRight();
		return s
	}
};
const unhide=ctx=>{ (ctx.hide?ctx.hide--:0) };
const onOpen={
	milestone:(el,ctx)=>{
		unhide(ctx);
		return '^ck'+el.attrs.n;
	},
	quote:(el,ctx)=>{
		if (el.attrs.type=="被解釋的經論") {
			// return '^quote';
		}
	},
	p:(el,ctx)=>{
		ctx.pre=el.attrs['cb:type']=='pre';
		let out='';
		if (typeof ctx.pb=='string') {
			if (ctx.bkid!=='30') { //雜阿含經論部類之整編, 
				out='\n^n' + (++ctx.preface_p_count);
			} else {
				if (ctx.pb[0]=='a') { //送到序
					out='\n'+ (++ctx.preface_p_count); 
				} else { // b1~b71
					if (ctx.pb!==ctx.prevpb) out='\n^n' + parseInt(ctx.pb.slice(1));
					else out='\n';
				}
			}
		} else {
			if (ctx.pb!==ctx.prevpb) out='\n^n' + ctx.pb;
			else out='\n';
		}
		ctx.prevpb=ctx.pb;
		if (el.attrs.rend=='bold') out+='^b';
		return out;
	},
	head:(el,ctx)=>{
		ctx.hide++;
	},
	pb:(el,ctx)=>{
		if (el.attrs.type!=='old') { //use yinshun new version
			const n=el.attrs.n;
			const pb = parseInt(n.slice(0,4));
			const pu=pageunit(ctx.bkid, n.slice(0,5));
			if (pu==1) { 
				outbuf='\n^preface《'+ctx.bkname+'》'+ctx.out;
				ctx.prefaces.push(outbuf); //合併序
				ctx.out='';
			} else if (pu==30) { //改書號
				outbuf=ctx.out;
				writefile('30',true); //部類之整編
				ctx.out='';
			} else if (pu==33) {
				outbuf=ctx.out;
				writefile('31',true); //印度之佛教有重版後記 z 區，先輸出到 31.off
				ctx.out='';
			}
			ctx.pb=pb||n.slice(0,4);
			ctx.p_count=0;
		}
	},
	'cb:mulu':(el,ctx)=>{
		if (ctx.hide) return;
		return '\n^z'+toBase26(parseInt(el.attrs.level)-1)+'〈';
	},
	item:(el,ctx)=>ctx.pre=true
}
const onClose={
	'cb:mulu':(el,ctx)=>{
		if (ctx.hide) return;
		return '〉';
	},
	item:(el,ctx)=>{ctx.pre=false;return '\n'},
	head:(el,ctx)=>{
		unhide(ctx);
	},
}
let prevoutfn='', outbuf='';
const writefile=(fn,fixname)=>{
	const fnn=parseInt(fn);
	if (fixname) { 
		if (fn=='30') {
			ctx.bkname='雜阿含經部類之整編';
			//去除
		} 
	} else {
		if (fnn>=30 && fnn<33) {
			fn=((fnn-30) +43).toString();  //43,44,45
		} else if (fnn>33) {
			fn=(fnn-2).toString();//將cbeta 書號改為 accelon 書號, 
		} else if (fnn==33) { //正文已在 pb handler 寫到 31.off
			ctx.prefaces.push(outbuf); // 重版後記, 合併到prefaces
			ctx.out='';
			return;
		}		
	}
	const bkid=parseInt(fn);
	writeChanged(outdir+fn+'.off', '^bk'+bkid+'《'+ctx.bkname+'》'+outbuf,true);
	ctx.out='';
	outbuf='';
}
const parseFile=fn=>{
	const buf=readTextContent(fn);
	const el=DOMFromString(buf);
	ctx.charmap=buildCharmap(xpath(el,'teiHeader/encodingDesc/charDecl'));
	ctx.hide=1; //hide redundant head
	ctx.outfn=fn.match(/Y(\d+)/)[1];
	ctx.fn=fn;
    ctx.bkid=ctx.outfn;
	const title=xpath(el,'teiHeader/fileDesc/titleStmt').children[1].children[0];
    const body=xpath(el,'text/body');
    if (prevoutfn!==ctx.outfn&&prevoutfn) {
    	writefile(prevoutfn);
    }
	ctx.bkname=title.match(/ ([^ ]+)$/)[1];
    const out=walkDOMOfftext(body,ctx,onOpen, onClose);
    outbuf+=ctx.out;
    prevoutfn=ctx.outfn;
}
files.forEach(parseFile);

writefile(prevoutfn); //last file is main
ctx.prefaces.unshift('^bk99《合併序》');
writeChanged(outdir+'0preface.off',ctx.prefaces.join(''),true)