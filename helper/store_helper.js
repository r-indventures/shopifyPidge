const HELPER = {
  shipping_slot: (price, store_info) => {
    price = isNaN(price) ? 0 : price;
    if(price==0){
      console.log("price is ",price)
      return []
    }
    const slot = [];
    const delivery_slots=[];
    if(store_info.meta_info && store_info.meta_info.delivery_slots){
      for(let s of store_info.meta_info.delivery_slots){
        if(s.is_active ==true)
        {
          delivery_slots.push(s)
        }
      }
    }
    for (let k = 0; k < delivery_slots.length; k++) {
      let c_date = new Date();
      let i =delivery_slots[k].delivery_day;
      let service_name
      c_date.setDate(c_date.getDate() + i);
      if (i == 0) {
        service_name= `Pidge: Today Delivery`

      } else if (i == 1) {
        service_name= `Pidge: Tomorrow Delivery`
        } else {
      let weekname = c_date.toLocaleString("en-US", { weekday: "long" });
        service_name= `Pidge: Delivery within ${weekname}`
      }
      let str_date =
        c_date.toLocaleString("default", { month: "long" }) +
        " " +
        c_date.getDate();
      slot.push({
        service_name: service_name,
        service_code: `PSD-${i}`,
        total_price: 0,
        description: `${str_date}, Instant Delivery & Courier Service`,
        currency: "INR",
        min_delivery_date: "2013-04-12 14:48:45 -0400",
        max_delivery_date: "2013-04-12 14:48:45 -0400",
      });
    }
    return slot;
  },
  get_shipping_date: (code) => {
    let arr= code.split("-")
    let c_date = new Date();
    if(arr.length ==2){
       c_date.setDate(c_date.getDate() + Number(arr[1]));
       return c_date
    }
    return c_date
  },
  weight_to_size_conversion:(store_detail, qnt, dimensionP)=>{
    console.log("weight_to_size", store_detail)
    if(store_detail && store_detail.meta_info){
      if(store_detail.meta_info.hasOwnProperty('weight_to_size')){
        let weight_to_size= store_detail.meta_info.weight_to_size['100'] || 0 
        let sum =  Number(dimensionP) * Number(weight_to_size)
        console.log("weight_to_size", weight_to_size, 'sum', sum)
        return sum * Number(qnt)
      }
    }
    return dimensionP
  }
};
module.exports = HELPER;
