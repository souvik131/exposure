// ==UserScript==
// @name         kiteAlgo
// @namespace    https://kite.zerodha.com/
// @version      1.0
// @description  Algo Trading Kite
// @author       Souvik Das
// @match        https://kite.zerodha.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_registerMenuCommand
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @require      https://raw.githubusercontent.com/amit0rana/MonkeyConfig/master/monkeyconfig.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/axios/0.21.1/axios.min.js
// @require      https://cdn.jsdelivr.net/npm/qs-lite@0.0.3/dist/qs-lite.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.27.0/moment.min.js
// @require      https://cdn.jsdelivr.net/npm/bluebird@3.7.2/js/browser/bluebird.js
// @require      https://unpkg.com/@popperjs/core@2
// @require      https://unpkg.com/tippy.js@6
// @require      https://cdn.jsdelivr.net/npm/sweetalert2@11
// @require      https://cdn.jsdelivr.net/npm/toastify-js
// @require      https://cdnjs.cloudflare.com/ajax/libs/uuid/8.3.2/uuid.min.js
// @resource     TOASTIFY_CSS https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css
// @resource     TOASTIFY_CSS https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css
// ==/UserScript==

/* GLOBAL DECLARATIONS */

window.jQ = jQuery.noConflict(true);

function runExposureCalc(optionType,isShort,isNifty){
    let data={}
    for(let pos of document.getElementsByClassName("open-positions")){
        for (let i in pos.getElementsByClassName("instrument")){
            const instrument = pos.getElementsByClassName("instrument")[i]
            if(typeof instrument=='object'&&instrument.getElementsByClassName("tradingsymbol").length>0){
                let tsChunks=instrument.getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ")
                if (isNifty){
                    if(tsChunks[0]=="NIFTY"){
                        if(tsChunks.length==4&&tsChunks[3]==optionType){
                            data[i]={price:+tsChunks[2],name:tsChunks[0]+"_"+tsChunks[3]}
                        }
                    }
                }
                if (!isNifty){
                    if (tsChunks[0]!="NIFTY"){
                        if(tsChunks.length==4&&tsChunks[3]==optionType){
                            data[i]={price:+tsChunks[2],name:tsChunks[0]+"_"+tsChunks[3]}
                        }
                    }
                }

            }
        }
        for (let i in pos.getElementsByClassName("quantity")){
            const qty = pos.getElementsByClassName("quantity")[i]
            if(typeof qty=='object'&&data[i]){
                data[i].qty=+qty.innerHTML
            }
        }
    }
    let exposure=0
    for(let key in data){
        const value=data[key]
        if(value.qty&&value.price){
            data[key].exposure=value.qty*value.price
        }else{
            data[key].exposure=0
        }
        if(isShort){
            if(data[key].exposure<0){
                exposure+=data[key].exposure
            }
        }else{
            if(data[key].exposure>0){
                exposure+=data[key].exposure
            }
        }


    }
    let formatting_options = {
        style: 'currency',
        currency: 'INR',
        notation: "compact",
        compactDisplay: "long",
    }
    return new Intl.NumberFormat( "en-IN", formatting_options ).format(Math.abs(exposure));
}
function init(){
    /*console.log("enctoken "+localStorage.getItem("__storejs_kite_enctoken").slice(1,-1))
    navigator.clipboard.writeText("enctoken "+localStorage.getItem("__storejs_kite_enctoken").slice(1,-1))*/
    setTimeout(()=> {
        console.log("Stock Short "+runExposureCalc("PE",true,false)+":"+runExposureCalc("CE",true,false))
        console.log("Stock Long "+runExposureCalc("PE",false,false)+":"+runExposureCalc("CE",false,false))
        console.log("Nifty Short ",runExposureCalc("PE",true,true)+":"+runExposureCalc("CE",true,true))
        console.log("Nifty Long ",runExposureCalc("PE",false,true)+":"+runExposureCalc("CE",false,true))

        for(let pos of document.getElementsByClassName("open-positions")){
           console.log(pos.getElementsByClassName("page-title"))
           if (pos.getElementsByClassName("page-title").length==1){
               pos.getElementsByClassName("page-title")[0].innerHTML+=" Long/Short Vol : Stock PE "+runExposureCalc("PE",false,false)+"/"+runExposureCalc("PE",true,false)+" CE "+runExposureCalc("CE",false,false)+"/"+runExposureCalc("CE",true,false)
               pos.getElementsByClassName("page-title")[0].innerHTML+=" | Nifty PE "+runExposureCalc("PE",false,true)+"/"+runExposureCalc("PE",true,true)+" CE "+runExposureCalc("CE",false,true)+"/"+runExposureCalc("CE",true,true)
           }
        }
    },1000*2)
}

;(function() {
    'use strict';
    jQ(window).bind("load", init);
})();
