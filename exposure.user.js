
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

function runAllExposureCalcs() {
    let data = {};
    for (let pos of document.getElementsByClassName("open-positions")) {
        for (let i in pos.getElementsByClassName("instrument")) {
            const instrument = pos.getElementsByClassName("instrument")[i];
            if (typeof instrument == 'object' && instrument.getElementsByClassName("tradingsymbol").length > 0) {
                let tsChunks = instrument.getElementsByClassName("tradingsymbol")[0].innerHTML.split(" ");
                let typeLeg = tsChunks[tsChunks.length - 1];
                let name = tsChunks[0];
                if (typeLeg == "PE" || typeLeg == "CE" || typeLeg == "FUT") {
                    let priceVal = tsChunks[tsChunks.length - 2];
                    data[i] = { strike: typeLeg == "FUT" ? 0 : +priceVal, name: name,typeLeg: typeLeg};
                }
            }
        }
        for (let i in pos.getElementsByClassName("last-price")) {
            const lp = pos.getElementsByClassName("last-price")[i];
            if (typeof lp == 'object' && data[i]) {
                data[i].price = +parseFloat(lp.innerHTML.replace(/,/g, ''));
            }
        }
        for (let i in pos.getElementsByClassName("quantity")) {
            const qty = pos.getElementsByClassName("quantity")[i];
            if (typeof qty == 'object' && data[i]) {
                data[i].qty = +qty.innerHTML.replace(/\t/g, '').replace(/\n/g, '');
            }
        }
    }

    let exposures = {
        peShortVol: {},
        peLongVol: {},
        ceShortVol: {},
        ceLongVol: {},
        positions:data,
    };

    for (let key in data) {
        const value = data[key];
        const name = value.name;
        const typeLeg = value.typeLeg;
        if (value.typeLeg=="FUT"){
            if (value.qty && value.price) {
                value.exposure = value.qty * value.price;
            } else {
                value.exposure = 0;
            }
        }else{
            if (value.qty && value.strike) {
                value.exposure = value.qty * value.strike;
            } else {
                value.exposure = 0;
            }
        }

        if (typeLeg == "PE") {
            exposures.peShortVol[name] = exposures.peShortVol[name] || 0;
            exposures.peLongVol[name] = exposures.peLongVol[name] || 0;

            if (value.exposure < 0) {
                exposures.peShortVol[name] += Math.abs(value.exposure);
            } else {
                exposures.peLongVol[name] += Math.abs(value.exposure);
            }
        } else if (typeLeg == "CE") {
            exposures.ceShortVol[name] = exposures.ceShortVol[name] || 0;
            exposures.ceLongVol[name] = exposures.ceLongVol[name] || 0;

            if (value.exposure < 0) {
                exposures.ceShortVol[name] += Math.abs(value.exposure);
            } else {
                exposures.ceLongVol[name] += Math.abs(value.exposure);
            }
        } else if (typeLeg == "FUT") {
            exposures.peShortVol[name] = exposures.peShortVol[name] || 0;
            exposures.peLongVol[name] = exposures.peLongVol[name] || 0;
            exposures.ceShortVol[name] = exposures.ceShortVol[name] || 0;
            exposures.ceLongVol[name] = exposures.ceLongVol[name] || 0;

            if (value.exposure > 0) {
                exposures.ceLongVol[name] += value.exposure;
                exposures.peShortVol[name] += value.exposure;
            } else {
                exposures.ceShortVol[name] += Math.abs(value.exposure);
                exposures.peLongVol[name] += Math.abs(value.exposure);
            }
        }
    }

    return exposures;
}





function formatAmount(val){
    return new Intl.NumberFormat( "en-IN", {
        style: 'currency',
        currency: 'INR',
        notation: "compact",
        compactDisplay: "long",
    } ).format(val).replace("₹","").replace("-0","0")
}
function formatAmountLong(val){
    return new Intl.NumberFormat( "en-IN", {
                    style: 'currency',
                    currency: 'INR',
                    compactDisplay: "long",
         } ).format(val).replace("₹","").replace("-0","0")
}


function addRowToTable(row){
  return  `<tr>
                    <td>${row.instrument}</td>
                    <td><span class="open `+((row.peLongVol)>0?`text-buy`:``)+` right">${formatAmount(row.peLongVol)}</span> / <span class="open `+((row.peShortVol)>0?`text-sell`:``)+` right">${formatAmount(-row.peShortVol)}</span> </td>
                    <td><span class="open `+((row.ceLongVol)>0?`text-buy`:``)+` right">${formatAmount(row.ceLongVol)}</span> / <span class="open `+((row.ceShortVol)>0?`text-sell`:``)+` right">${formatAmount(-row.ceShortVol)}</span> </td>
                    <td><span class="open text-red ">${formatAmount(-row.peVar)}</span> / <span class="open text-red ">${formatAmount(-row.ceVar)}</span></td>
                    <td><span class="open `+(row.peHedge==0?"":((row.peHedge)>0?`text-red`:`text-green`))+` right">${formatAmount(row.peHedge)} </span> / <span class="open `+(row.ceHedge==0?"":((row.ceHedge)>0?`text-red`:`text-green`))+` right">${formatAmount(row.ceHedge)} </span></td>
                    <td><span class="open `+(row.pePremium==0?"":((row.pePremium)>0?`text-red`:`text-green`))+` right">${formatAmount(row.pePremium)} </span> / <span class="open `+(row.cePremium==0?"":((row.cePremium)>0?`text-red`:`text-green`))+` right">${formatAmount(row.cePremium)} </span></td>
                    <td class="open ">${row.positions}</td>
                    <td class="open `+(row.pePnl>=0?`text-green`:`text-red`)+`  right">${formatAmount(row.pePnl)}</td>
                    <td class="open `+(row.cePnl>=0?`text-green`:`text-red`)+`  right">${formatAmount(row.cePnl)}</td>
                    <td class="open `+(row.futPnl>=0?`text-green`:`text-red`)+`  right">${formatAmount(row.futPnl)}</td>
                    <td class="open `+(row.charges>0?`text-red`:``)+` pnl right">${formatAmountLong(row.charges)}</td>
                    <td class="open `+((row.pnl-row.charges)>=0?`text-green`:`text-red`)+` pnl right">${formatAmountLong(row.pnl-row.charges)}</td>

           </tr>`
}


async function trigger(){

    if (window.location.href=="https://kite.zerodha.com/positions"){
        for (let pos of document.getElementsByClassName("consolidated-positions")){
            pos.style.display = 'block';
        }
        try{
            const {pnlByScript,pePnlByScript,cePnlByScript,futPnlByScript,positionsByScript}=runPnlCalc()
            let {peShortVol,peLongVol,ceShortVol,ceLongVol,positions }= await runAllExposureCalcs()

            const groupedPositions={}
            for (let pos of Object.values(positions)){
                groupedPositions[pos.name]=groupedPositions[pos.name]||[]
                groupedPositions[pos.name].push(pos)
            }

            const ceVar={}
            const peVar={}
            const cePremium={}
            const pePremium={}
            const ceHedge={}
            const peHedge={}

            for(const name of Object.keys(groupedPositions)){
                const legs=groupedPositions[name]
                let ceStrikeQty=[]
                let peStrikeQty=[]
                cePremium[name]=cePremium[name]||0
                pePremium[name]=pePremium[name]||0
                ceHedge[name]=ceHedge[name]||0
                peHedge[name]=peHedge[name]||0
                for(const leg of legs){
                     if(leg.typeLeg=="PE"){
                         peStrikeQty.push({strike:leg.strike,qty:leg.qty})
                         if (leg.qty<0){
                             pePremium[name]+=leg.price*leg.qty
                         }else{

                             peHedge[name]+=leg.price*leg.qty
                         }

                     }
                     if(leg.typeLeg=="CE"){
                         ceStrikeQty.push({strike:leg.strike,qty:leg.qty})
                         if (leg.qty<0){
                             cePremium[name]+=leg.price*leg.qty
                         }else{

                             ceHedge[name]+=leg.price*leg.qty
                         }
                     }

                     if(leg.typeLeg=="FUT"){
                        if (leg.qty>0){
                         peStrikeQty.push({strike:leg.price,qty:leg.qty})
                        }
                        if (leg.qty<0){
                         ceStrikeQty.push({strike:leg.price,qty:leg.qty})
                        }
                     }
                }
                peStrikeQty=peStrikeQty.sort((a, b) =>b.strike-a.strike)
                ceStrikeQty=ceStrikeQty.sort((a, b) => a.strike- b.strike)
                let peRunningQty=0
                let ceRunningQty=0
                let lowestPe=-1
                let lowestCe=-1


                let lowest=Infinity
                for (let i in peStrikeQty){
                    let el=peStrikeQty[i]
                    peRunningQty+=el.qty
                    peStrikeQty[i].cumQty=peRunningQty
                    if (i>0&&peStrikeQty[i].cumQty>lowest&&peStrikeQty[i-1].cumQty==lowest){
                        lowestPe=peStrikeQty[i].strike
                    }
                    if (peStrikeQty[i].cumQty<lowest){
                        lowest=peStrikeQty[i].cumQty
                    }

                }
                lowest=Infinity
                for (let i in ceStrikeQty){
                    let el=ceStrikeQty[i]
                    ceRunningQty+=el.qty
                    ceStrikeQty[i].cumQty=ceRunningQty
                    if (i>0&&ceStrikeQty[i].cumQty>lowest&&ceStrikeQty[i-1].cumQty==lowest){
                        lowestCe=ceStrikeQty[i].strike
                    }
                    if (ceStrikeQty[i].cumQty<lowest){
                        lowest=ceStrikeQty[i].cumQty
                    }
                }

                let putExp=0
                let callExp=0
                for(const leg of legs){


                     if(leg.typeLeg=="PE"){
                         if (leg.qty < 0) {
                             if (lowestPe==-1&&peRunningQty<0){
                                 putExp+=Math.abs(leg.exposure)
                             }else if (putExp<Math.abs(leg.exposure)){
                                 putExp += (lowestPe-leg.strike) *leg.qty + leg.price *leg.qty
                             }
                         }
                         if (leg.qty > 0) {
                             putExp -= leg.price *leg.qty
                         }
                     }
                     if(leg.typeLeg=="CE"){
                         if (leg.qty < 0) {
                             if (lowestCe==-1&&ceRunningQty<0){
                                 callExp+=Math.abs(leg.exposure)
                             }else if (callExp<Math.abs(leg.exposure)){
                                 callExp += (lowestCe-leg.strike) *leg.qty - leg.price *leg.qty
                             }
                         }
                         if (leg.qty > 0) {
                             callExp += leg.price *leg.qty
                         }

                     }

                     if(leg.typeLeg=="FUT"){
                        if (leg.qty>0){
                             putExp += (leg.price-lowestPe) *leg.qty
                        }
                        if (leg.qty<0){
                             callExp += (leg.price-lowestCe) *leg.qty
                        }
                     }

                }
                ceVar[name]=callExp
                peVar[name]=putExp
            }

            const instruments = Object.keys(pnlByScript)
            const chargesByScript = (await fetchCharges())||{}

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
                charges: chargesByScript[instrument] || 0,
                ceVar: ceVar[instrument] || 0,
                peVar: peVar[instrument] || 0,
                cePremium: cePremium[instrument] || 0,
                pePremium: pePremium[instrument] || 0,
                ceHedge: ceHedge[instrument] || 0,
                peHedge: peHedge[instrument] || 0,
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
                ceVar: 0,
                peVar: 0,
                cePremium: 0,
                pePremium: 0,
                ceHedge: 0,
                peHedge: 0,
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
                total.ceVar+=row.ceVar
                total.peVar+=row.peVar
                total.pePremium+=row.pePremium
                total.cePremium+=row.cePremium
                total.peHedge+=row.peHedge
                total.ceHedge+=row.ceHedge
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
            return tradingsymbol.match(/^[A-Za-z]+/)[0]
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
                            	<div class="data-table fold-header sticky" >
                                      	<div class="table-wrapper">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th> Instrument </th>
                                                            <th> PE Long / Short Exposure  </th>
                                                            <th> CE Long / Short Exposure  </th>
                                                            <th> PE / CE VaR  </th>
                                                            <th> PE / CE Bought  </th>
                                                            <th> PE / CE Sold  </th>
                                                            <th> Legs </th>
                                                            <th class="right"> PE PNL </th>
                                                            <th class="right"> CE PNL </th>
                                                            <th class="right"> FUT PNL </th>
                                                            <th class="right"> Charges </th>
                                                            <th class="right"> Net PNL </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody  id="json-table-body" style="white-space: nowrap;">
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





