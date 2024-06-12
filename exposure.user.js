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
let formatting_options = {
        style: 'currency',
        currency: 'INR',
        notation: "compact",
        compactDisplay: "long",
    }
function runExposureCalc(optionType,isShort){
    let data={}
    for(let pos of document.getElementsByClassName("open-positions")){
        for (let i in pos.getElementsByClassName("instrument")){
            const instrument = pos.getElementsByClassName("instrument")[i]
            if(typeof instrument=='object'&&instrument.getElementsByClassName("tradingsymbol").length>0){
                let tsChunks=instrument.getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ")
                if(tsChunks.length>=4&&tsChunks[3]==optionType){
                    data[i]={price:+tsChunks[2],name:tsChunks[0]+"_"+tsChunks[3]}
                }else if(tsChunks.length>=3&&tsChunks[2]=="FUT"){
                    data[i]={price:0,name:tsChunks[0]+"_FUT"}
                }
            }
        }
        for (let i in pos.getElementsByClassName("last-price")){
            const lp = pos.getElementsByClassName("last-price")[i]
            if(typeof lp=='object'&&data[i]){
                if (data[i].name.endsWith("_FUT")){
                    data[i].price=+parseFloat(lp.innerHTML.replace(/,/g, ''))
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
    let exposureByScript={}
    for(let key in data){
        const value=data[key]
        const name = value.name.split("_")[0]
        exposureByScript[name]=exposureByScript[name]||0
        if(value.qty&&value.price){
            data[key].exposure=value.qty*value.price
        }else{
            data[key].exposure=0
        }


        if(isShort){
            if (data[key].name.endsWith("_FUT")){
                if (data[key].exposure>0&&optionType=="PE"){
                   exposure-=data[key].exposure
                   exposureByScript[name]-=data[key].exposure
                }
                if (data[key].exposure<0&&optionType=="PE"){
                   exposure+=data[key].exposure
                   exposureByScript[name]+=data[key].exposure
                }
            }else if (data[key].exposure<0){
                exposure+=data[key].exposure
                exposureByScript[name]+=data[key].exposure
            }
        }else{
            if (data[key].name.endsWith("_FUT")){
                if (data[key].exposure<0&&optionType=="CE"){
                    exposure-=data[key].exposure
                   exposureByScript[name]-=data[key].exposure
                }
                if (data[key].exposure>0&&optionType=="CE"){
                    exposure+=data[key].exposure
                   exposureByScript[name]+=data[key].exposure
                }
            }else if (data[key].exposure>0){
                exposure+=data[key].exposure
                   exposureByScript[name]+=data[key].exposure
                if (optionType=="PE"){
                    console.log(name,exposureByScript,optionType)
                }
            }
        }

        let valArr=document.getElementsByClassName("open-positions")[0].getElementsByClassName("instrument")[key].getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ").slice(0, 4)
        if (valArr[2]=="FUT"){
            valArr=document.getElementsByClassName("open-positions")[0].getElementsByClassName("instrument")[key].getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ").slice(0, 3)
        }

        valArr.push(new Intl.NumberFormat( "en-IN", formatting_options ).format(data[key].exposure))
        document.getElementsByClassName("open-positions")[0].getElementsByClassName("instrument")[key].getElementsByClassName("tradingsymbol")[0].innerHTML=valArr.join(" ")


    }

    for (let key in exposureByScript){
        exposureByScript[key]=Math.abs(exposureByScript[key])
    }

    return exposureByScript;
}
function trigger(){


    try{
        const peShortVol=runExposureCalc("PE",true)
        const peLongVol=runExposureCalc("PE",false)
        const ceShortVol=runExposureCalc("CE",true)
        const ceLongVol=runExposureCalc("CE",false)
        const instruments = Object.keys(peShortVol);
        console.log(peShortVol,peLongVol,ceShortVol,ceLongVol)
        const combinedData = instruments.map(instrument => ({
            instrument: instrument,
            peShortVol: peShortVol[instrument] || 0,
            peLongVol: peLongVol[instrument] || 0,
            ceShortVol: ceShortVol[instrument] || 0,
            ceLongVol: ceLongVol[instrument] || 0
        }))
        let dataHTML=`<div class="table-wrapper">
        <table id="json-table">
            <thead>
                <tr>
                    <th class="product sortable"> Instrument |</th>
                    <th class="product sortable"> PE Short Vol  |</th>
                    <th class="product sortable"> PE Long Vol  |</th>
                    <th class="product sortable"> CE Short Vol  |</th>
                    <th class="product sortable"> CE Long Vol  |</th>
                    <th class="product sortable"> PE Net  |</th>
                    <th class="product sortable"> CE Net  |</th>
                </tr>
            </thead>
            <tbody>`

         const total={
            instrument: "TOTAL",
            peShortVol:  0,
            peLongVol:  0,
            ceShortVol:  0,
            ceLongVol:  0
        }
         for (let row of combinedData){
             if (row.peShortVol+row.peLongVol+row.ceShortVol+row.ceLongVol>0){
                 total.peShortVol+=row.peShortVol
                 total.peLongVol+=row.peLongVol
                 total.ceShortVol+=row.ceShortVol
                 total.ceLongVol+=row.ceLongVol
                dataHTML += `
                    <tr><td>${row.instrument}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.peShortVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.peLongVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.ceShortVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.ceLongVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.peLongVol-row.peShortVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.ceLongVol-row.ceShortVol)}</td></tr>
                `;
             }
          }
        dataHTML += `
                    <tr><td>${total.instrument}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(total.peShortVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(total.peLongVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(total.ceShortVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(total.ceLongVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(total.peLongVol-total.peShortVol)}</td>
                    <td>${new Intl.NumberFormat( "en-IN", formatting_options ).format(total.ceLongVol-total.ceShortVol)}</td></tr>
                `;

            dataHTML+=`</tbody>
        </table>
    </div>`

        for(let pos of document.getElementsByClassName("open-positions")){
            console.log(pos.getElementsByClassName("page-title"))
            if (pos.getElementsByClassName("page-title").length==1){
                let val=pos.getElementsByClassName("page-title")[0].innerHTML.split(")")[0]
                val+=")<br/>"
                val+=dataHTML
                pos.getElementsByClassName("page-title")[0].innerHTML=val
            }
        }


    }
    catch(e){
      console.log(e)
    }

}

function init(){
    setTimeout(()=> {
        trigger()
        setInterval(()=> {
            trigger()
        },1000*5)
    },1000*2)
}

;(function() {
    'use strict';
    jQ(window).bind("load", init);
})();
