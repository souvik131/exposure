
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
let token=""
function runPnlCalc(){
    let data={}
    for(let pos of document.getElementsByClassName("open-positions")){
        for (let i in pos.getElementsByClassName("instrument")){
            const instrument = pos.getElementsByClassName("instrument")[i]
            if(typeof instrument=='object'&&instrument.getElementsByClassName("tradingsymbol").length>0){
                let tsChunks=instrument.getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ")
                let typeLeg=tsChunks[tsChunks.length-1]
                if(typeLeg=="CE"||typeLeg=="PE"){
                    data[i]={name:tsChunks[0],type:typeLeg}
                }else if(typeLeg=="FUT"){
                    data[i]={name:tsChunks[0],type:"FUT"}
                }
            }
        }
        for (let i in pos.getElementsByClassName("pnl")){
            const pnl = pos.getElementsByClassName("pnl")[i]
            if(typeof pnl=='object'&&data[i]){
                try{
                    data[i].pnl=parseFloat(pnl.getElementsByTagName("*")[0].innerHTML.replace(/,/g, ''))
                }catch(e){
                    data[i].pnl=parseFloat(pnl.innerHTML.replace(/,/g, ''))
                }
            }
        }
    }
    let pnlByScript={}
    let pePnlByScript={}
    let cePnlByScript={}
    let futPnlByScript={}
    let positionsByScript={}
    for(let key in data){
        positionsByScript[data[key].name]=positionsByScript[data[key].name]||0
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
        positionsByScript[data[key].name]+=1
    }
    return {pnlByScript,pePnlByScript,cePnlByScript,futPnlByScript,positionsByScript};
}

function runExposureCalc(optionType,isShort){
    let data={}
    for(let pos of document.getElementsByClassName("open-positions")){
        for (let i in pos.getElementsByClassName("instrument")){
            const instrument = pos.getElementsByClassName("instrument")[i]
            if(typeof instrument=='object'&&instrument.getElementsByClassName("tradingsymbol").length>0){
                let tsChunks=instrument.getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ")
                let typeLeg=tsChunks[tsChunks.length-1]
                let name=tsChunks[0]
                if(typeLeg==optionType){
                    let priceVal=tsChunks[tsChunks.length-2]
                    data[i]={price:+priceVal,name:name+"_"+typeLeg}
                }else if(typeLeg=="FUT"){
                    data[i]={price:0,name:name+"_FUT"}
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



    }

    for (let key in exposureByScript){
        exposureByScript[key]=Math.abs(exposureByScript[key])
    }

    return exposureByScript;
}


function addRowToTable(row){
  return  `<tr>
                    <td>${row.instrument}</td>
                    <td class="open `+((row.peShortVol)>0?`text-sell`:``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(-row.peShortVol).replace("₹","")}</td>
                    <td class="open `+((row.peLongVol)>0?`text-buy`:``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.peLongVol).replace("₹","")}</td>
                    <td class="open `+((row.peLongVol-row.peShortVol)!=0?((row.peLongVol-row.peShortVol)>0?`text-buy`:`text-sell`):``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.peLongVol-row.peShortVol).replace("₹","")}</td>
                    <td class="open `+((row.ceShortVol)>0?`text-sell`:``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(-row.ceShortVol).replace("₹","")}</td>
                    <td class="open `+((row.ceLongVol)>0?`text-buy`:``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.ceLongVol).replace("₹","")}</td>
                    <td class="open `+((row.ceLongVol-row.ceShortVol)!=0?((row.ceLongVol-row.ceShortVol)>0?`text-buy`:`text-sell`):``)+` right">${new Intl.NumberFormat( "en-IN", formatting_options ).format(row.ceLongVol-row.ceShortVol).replace("₹","")}</td>
                    <td class="open ">${row.positions}</td>
                    <td class="open `+(row.pePnl>=0?`text-green`:`text-red`)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.pePnl).replace("₹","")}</td>
                    <td class="open `+(row.cePnl>=0?`text-green`:`text-red`)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.cePnl).replace("₹","")}</td>
                    <td class="open `+(row.futPnl>=0?`text-green`:`text-red`)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.futPnl).replace("₹","")}</td>
                    <td class="open `+(row.charges>0?`text-red`:``)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.charges).replace("₹","")}</td>
                    <td class="open `+((row.pnl-row.charges)>=0?`text-green`:`text-red`)+` pnl right">${new Intl.NumberFormat( "en-IN", formatting_pnl_options ).format(row.pnl-row.charges).replace("₹","")}</td>

           </tr>`
}

async function trigger(){

    if (window.location.href=="https://kite.zerodha.com/positions"){
        for (let pos of document.getElementsByClassName("consolidated-positions")){
            pos.style.display = 'block';
        }
        try{
            const {pnlByScript,pePnlByScript,cePnlByScript,futPnlByScript,positionsByScript}=runPnlCalc()
            const peShortVol=runExposureCalc("PE",true)
            const peLongVol=runExposureCalc("PE",false)
            const ceShortVol=runExposureCalc("CE",true)
            const ceLongVol=runExposureCalc("CE",false)
            const instruments = Object.keys(pnlByScript)
            const chargesByScript = await fetchCharges()

            const combinedData = instruments.map(instrument => ({
                instrument: instrument,
                pnl: pnlByScript[instrument] || 0,
                pePnl: pePnlByScript[instrument] || 0,
                cePnl: cePnlByScript[instrument] || 0,
                futPnl: futPnlByScript[instrument] || 0,
                peShortVol: peShortVol[instrument] || 0,
                peLongVol: peLongVol[instrument] || 0,
                ceShortVol: ceShortVol[instrument] || 0,
                ceLongVol: ceLongVol[instrument] || 0,
                positions: positionsByScript[instrument] || 0,
                charges: chargesByScript[instrument] || 0
            }))


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
                positions:  0,
                charges:0,
            }
            var regex = /(?<!^).(?!$)/g
            let dataHTML = ""
            for (let row of combinedData){
                total.peShortVol+=row.peShortVol
                total.peLongVol+=row.peLongVol
                total.ceShortVol+=row.ceShortVol
                total.ceLongVol+=row.ceLongVol
                total.pnl+=row.pnl
                total.pePnl+=row.pePnl
                total.cePnl+=row.cePnl
                total.futPnl+=row.futPnl
                total.positions+=row.positions
                total.charges+=row.charges
                dataHTML += addRowToTable(row);
                
            }
            dataHTML = addRowToTable(total)+dataHTML;
            document.getElementById("json-table-body").innerHTML=dataHTML

        }
        catch(e){
            console.log(e)
        }
    }else{
        for (let pos of document.getElementsByClassName("consolidated-positions")){
            pos.style.display = 'none';
        }
    }

}
const fetchCharges = async () => {
  try {
    // Fetch the orders
    const ordersResponse = await fetch("https://kite.zerodha.com/oms/orders", {
      headers: {
        "accept": "application/json, text/plain, */*",
        "authorization": token,
      },
      method: "GET",
    });

    if (!ordersResponse.ok) {
      throw new Error(`Error fetching orders: ${ordersResponse.statusText}`);
    }

    const ordersData = await ordersResponse.json();

    if (ordersData.status !== "success" || !ordersData.data) {
      throw new Error("Invalid orders response");
    }

    // Prepare the body for the second API call
    const chargesRequestBody = ordersData.data.map(order => ({
      order_id: order.order_id,
      exchange: order.exchange,
      tradingsymbol: order.tradingsymbol,
      transaction_type: order.transaction_type,
      variety: order.variety,
      product: order.product,
      order_type: order.order_type,
      quantity: order.quantity,
      average_price: order.average_price
    }));

    // Fetch the charges
    const chargesResponse = await fetch("https://kite.zerodha.com/oms/charges/orders", {
      headers: {
        "accept": "application/json, text/plain, */*",
        "authorization": token,
      },
      method: "POST",
      body: JSON.stringify(chargesRequestBody),
    });

    if (!chargesResponse.ok) {
      throw new Error(`Error fetching charges: ${chargesResponse.statusText}`);
    }

    const chargesData = await chargesResponse.json();

    if (chargesData.status !== "success" || !chargesData.data) {
      throw new Error("Invalid charges response");
    }

    // Combine the orders and charges data based on order_id
    const combinedData = ordersData.data.map(order => {
      const charge = chargesData.data.find(c => c.tradingsymbol === order.tradingsymbol && c.transaction_type === order.transaction_type);
      return { ...order, charges: charge ? charge.charges : null };
    });

    // Function to extract the name from the tradingsymbol
    const extractName = (tradingsymbol) => {
        try{
            tradingsymbol.match(/^[A-Za-z]+/)[0]
        }catch(e){
            return tradingsymbol
        }
    }

    // Map to store the total charges for each name
    const chargesMap = new Map();

    combinedData.forEach(order => {
      if (order.charges) {
        const name = extractName(order.tradingsymbol);
        const totalCharges = order.charges.total;

        if (chargesMap.has(name)) {
          chargesMap.set(name, chargesMap.get(name) + totalCharges);
        } else {
          chargesMap.set(name, totalCharges);
        }
      }
    });

    // Convert the map to an object for easier use
    const chargesObject = Object.fromEntries(chargesMap);

    return chargesObject

  } catch (error) {
    console.error(error);
  }
};



async function init(){
    token="enctoken "+localStorage.getItem("__storejs_kite_enctoken").slice(1,-1)
    const myHeaders = new Headers();
   // myHeaders.append("accept", "application/json, text/plain, */*");
    /*myHeaders.append("authorization", token);

    const requestOptions = {
        method: "GET",
        headers: myHeaders,
        redirect: "follow"
    };

    fetch("https://kite.zerodha.com/oms/portfolio/positions", requestOptions)
        .then((response) => response.text())
        .then((result) => console.log(JSON.parse(result).data))
        .catch((error) => console.error(error));*/
    /*navigator.clipboard.writeText("enctoken "+localStorage.getItem("__storejs_kite_enctoken").slice(1,-1))*/


    setTimeout(async ()=>{
        const sec = document.createElement("section");
        sec.classList.add("consolidated-positions");
        sec.classList.add("table-wrapper");
        sec.innerHTML=`<header class="row data-table-header">
                                <h3 class="page-title small">
                                        <span>Consolidated</span>
                                </h3>
                        </header>
                  	<div>
                            	<div class="data-table fold-header sticky">
                                      	<div class="table-wrapper">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th> Instrument </th>
                                                            <th> PE Short Exposure  </th>
                                                            <th> PE Long Exposure  </th>
                                                            <th> PE Net Exposure  </th>
                                                            <th> CE Short Exposure </th>
                                                            <th> CE Long Exposure  </th>
                                                            <th> CE Net Exposure  </th>
                                                            <th> Legs </th>
                                                            <th> PE PNL </th>
                                                            <th> CE PNL </th>
                                                            <th> FUT PNL </th>
                                                            <th> Charges </th>
                                                            <th> Net PNL </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody  id="json-table-body">
                                                    </tbody>
                                                </table>
                                            </div>
                                    </div>
                            </div>`
        const element = document.getElementsByClassName("positions")[0];
        const child = document.getElementsByClassName("positions")[1];
        element.insertBefore(sec, child);
        await trigger()
        setInterval(trigger,1000*2)
    },1000*3)
}

;(function() {
    'use strict';
    jQ(window).bind("load", init);
})();





