import type { SetCompletionTarget } from './set-completion';
const KEY='setline.last-completed-set.v16';
const REST_OWNER='setline.rest-owner.v16';
function read(key:string):SetCompletionTarget|null {
 try {const value=JSON.parse(window.sessionStorage.getItem(key)??'null');return value&&['sessionId','exerciseKey','setId'].every(field=>typeof value[field]==='string'&&value[field].length>0&&value[field].length<=120)?value:null;}catch{return null;}
}
function save(key:string,target:SetCompletionTarget|null){try{if(target)window.sessionStorage.setItem(key,JSON.stringify(target));else window.sessionStorage.removeItem(key);}catch{/* Live actions remain usable when tab storage is restricted. */}}
export const readCompletionReceipt=()=>read(KEY);
export const saveCompletionReceipt=(target:SetCompletionTarget|null)=>save(KEY,target);
export const readRestOwner=()=>read(REST_OWNER);
export const saveRestOwner=(target:SetCompletionTarget|null)=>save(REST_OWNER,target);
