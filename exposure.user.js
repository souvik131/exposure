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
const formatting_options = {
        style: 'currency',
        currency: 'INR',
        notation: "compact",
        compactDisplay: "long",
    }
const formatting_pnl_options={
                    style: 'currency',
                    currency: 'INR',
                    compactDisplay: "long",
         }
function runPnlCalc(){
    let data={}
    for(let pos of document.getElementsByClassName("open-positions")){
        for (let i in pos.getElementsByClassName("instrument")){
            const instrument = pos.getElementsByClassName("instrument")[i]
            if(typeof instrument=='object'&&instrument.getElementsByClassName("tradingsymbol").length>0){
                let tsChunks=instrument.getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ")
                if(tsChunks.length>=4){
                    data[i]={name:tsChunks[0],type:tsChunks[3]}
                }else if(tsChunks.length>=3&&tsChunks[2]=="FUT"){
                    data[i]={name:tsChunks[0],type:"FUT"}
                }
            }
        }
        for (let i in pos.getElementsByClassName("pnl")){
            const pnl = pos.getElementsByClassName("pnl")[i]
            if(typeof pnl=='object'&&data[i]){
                data[i].pnl=parseFloat(pnl.getElementsByTagName("*")[0].innerHTML.replace(/,/g, ''))
            }
        }
    }
    let pnlByScript={}
    let pePnlByScript={}
    let cePnlByScript={}
    let futPnlByScript={}
    for(let key in data){
        pePnlByScript[data[key].name]=pePnlByScript[data[key].name]||0
        cePnlByScript[data[key].name]=cePnlByScript[data[key].name]||0
        futPnlByScript[data[key].name]=futPnlByScript[data[key].name]||0
        if(data[key].type=="PE"){
            pePnlByScript[data[key].name]+=data[key].pnl
        }
        if(data[key].type=="CE"){
            cePnlByScript[data[key].name]+=data[key].pnl
        }
        if(data[key].type=="FUT"){
            futPnlByScript[data[key].name]+=data[key].pnl
        }
        pnlByScript[data[key].name]=pnlByScript[data[key].name]||0
        pnlByScript[data[key].name]+=data[key].pnl
    }

    return {pnlByScript,pePnlByScript,cePnlByScript,futPnlByScript};
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
                data[i].qty=qty.innerHTML
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
                
            }
        }

       /* let valArr=document.getElementsByClassName("open-positions")[0].getElementsByClassName("instrument")[key].getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ").slice(0, 4)
        if (valArr[2]=="FUT"){
            valArr=document.getElementsByClassName("open-positions")[0].getElementsByClassName("instrument")[key].getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ").slice(0, 3)
        }

        valArr.push(new Intl.NumberFormat( "en-IN", formatting_options ).format(data[key].exposure))
        document.getElementsByClassName("open-positions")[0].getElementsByClassName("instrument")[key].getElementsByClassName("tradingsymbol")[0].innerHTML=valArr.join(" ")*/


    }

    for (let key in exposureByScript){
        exposureByScript[key]=Math.abs(exposureByScript[key])
    }

    return exposureByScript;
}


function addRowToTable(row){
  return  `
                    <tr><td>${row.instrument}</td>
                    <td class="open `+((row.peShortVol)>0?`text-sell`:``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(-row.peShortVol).replace("₹","")}</td>
                    <td class="open `+((row.peLongVol)>0?`text-buy`:``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.peLongVol).replace("₹","")}</td>
                    <td class="open `+((row.peLongVol-row.peShortVol)!=0?((row.peLongVol-row.peShortVol)>0?`text-buy`:`text-sell`):``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.peLongVol-row.peShortVol).replace("₹","")}</td>
                    <td class="open `+((row.ceShortVol)>0?`text-sell`:``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(-row.ceShortVol).replace("₹","")}</td>
                    <td class="open `+((row.ceLongVol)>0?`text-buy`:``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.ceLongVol).replace("₹","")}</td>
                    <td class="open `+((row.ceLongVol-row.ceShortVol)!=0?((row.peLongVol-row.ceShortVol)>0?`text-buy`:`text-sell`):``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.ceLongVol-row.ceShortVol).replace("₹","")}</td>
                    <td class="open `+(row.pePnl>=0?`text-green`:`text-red`)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.pePnl).replace("₹","")}</td>
                    <td class="open `+(row.cePnl>=0?`text-green`:`text-red`)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.cePnl).replace("₹","")}</td>
                    <td class="open `+(row.futPnl>=0?`text-green`:`text-red`)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.futPnl).replace("₹","")}</td>
                    <td class="open `+(row.pnl>=0?`text-green`:`text-red`)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.pnl).replace("₹","")}</td></tr>
                `
}

function trigger(){


    try{
        const {pnlByScript,pePnlByScript,cePnlByScript,futPnlByScript}=runPnlCalc()
        const peShortVol=runExposureCalc("PE",true)
        const peLongVol=runExposureCalc("PE",false)
        const ceShortVol=runExposureCalc("CE",true)
        const ceLongVol=runExposureCalc("CE",false)
        const instruments = Object.keys(pnlByScript);
        const combinedData = instruments.map(instrument => ({
            instrument: instrument,
            pnl: pnlByScript[instrument] || 0,
            pePnl: pePnlByScript[instrument] || 0,
            cePnl: cePnlByScript[instrument] || 0,
            futPnl: futPnlByScript[instrument] || 0,
            peShortVol: peShortVol[instrument] || 0,
            peLongVol: peLongVol[instrument] || 0,
            ceShortVol: ceShortVol[instrument] || 0,
            ceLongVol: ceLongVol[instrument] || 0
        }))
        let dataHTMLStart=`<div class="table-wrapper data-table fold-header sticky">
        <table id="json-table">
            <thead>
                <tr>
                    <th class="product"> Instrument </th>
                    <th class="product"> PE Short Exposure  </th>
                    <th class="product"> PE Long Exposure  </th>
                    <th class="product"> PE Net Exposure  </th>
                    <th class="product"> CE Short Exposure </th>
                    <th class="product"> CE Long Exposure  </th>
                    <th class="product"> CE Net Exposure  </th>
                    <th class="product"> PE PNL </th>
                    <th class="product"> CE PNL </th>
                    <th class="product"> FUT PNL </th>
                    <th class="product"> PNL </th>
                </tr>
            </thead>
            <tbody>`

         const total={
            instrument: "TOTAL",
            peShortVol:  0,
            peLongVol:  0,
            ceShortVol:  0,
            ceLongVol:  0,
            pnl:0,
            pePnl:  0,
            cePnl:  0,
            futPnl:  0,
        }
         var regex = /(?<!^).(?!$)/g
         let dataHTML = ""
         for (let row of combinedData){
             if (row.peShortVol+row.peLongVol+row.ceShortVol+row.ceLongVol>0){
                 total.peShortVol+=row.peShortVol
                 total.peLongVol+=row.peLongVol
                 total.ceShortVol+=row.ceShortVol
                 total.ceLongVol+=row.ceLongVol
                 total.pnl+=row.pnl
                 total.pePnl+=row.pePnl
                 total.cePnl+=row.cePnl
                 total.futPnl+=row.futPnl
                dataHTML += addRowToTable(row);
             }
          }
        dataHTML = addRowToTable(total)+dataHTML;
        //dataHTML += addRowToTable(total);

            let dataHTMLEnd=`</tbody>
        </table>
    </div><br/><br/>`

        for(let pos of document.getElementsByClassName("open-positions")){
            if (pos.getElementsByClassName("page-title").length==1){
                let val=pos.getElementsByClassName("page-title")[0].innerHTML.split("</span>")[0]
                val+="</span><br/>"
                val+=dataHTMLStart+dataHTML+dataHTMLEnd
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
