const { handleRequest } = require("../server.js");

module.exports = async (req, res) => {
  return await handleRequest(req, res);
};
