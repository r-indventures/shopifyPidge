const request = require("request-promise");
const BASE_URL = process.env.API_BASE_URL;
module.exports = {
  get: async (url, options = {}) => {
   return request.get(url, { headers: options }).then((res)=>{
     return JSON.parse(res)
   })
  },
  post: async (url, body, options = {}) => {
      return request.post(url, { json: body});
  },
  put: async (url, body, options = {}) => {},
  delete: async (url, options = {}) => {},
};
