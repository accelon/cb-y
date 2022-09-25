import {xpath} from 'ptk/nodebundle.cjs'
export const buildCharmap=(charDecl)=>{
    const res={};
    if (!charDecl)return res;
    for (let i=0;i<charDecl.children.length;i++) {
        const char=charDecl.children[i];
        if (!char.attrs)continue;
        const id=char.attrs['xml:id'];
        const uni=xpath(char,'mapping');
        if (uni&& uni.attrs.type=='unicode' && typeof uni.children[0]=='string') {
            res[id]= String.fromCodePoint(parseInt( uni.children[0].substr(2),16));
        }
    }
    return res;
}