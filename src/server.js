const express = require("express");
const bodyParser = require("body-parser");
const url = require("url");
const HDWalletProvider = require("truffle-hdwallet-provider");
const Web3 = require("web3");
const path = require("path");
const abi = require("./abi/token");
const { connection, insert, find } = require("./db");
const { isAllowed } = require("./util");
var client = null;
require("dotenv").config();

const infura_apikey = process.env.INFURA_NODE_ID;

const provider = new HDWalletProvider(
  process.env.SEED_PHRASE,
  "https://rinkeby.infura.io/v3/" + infura_apikey
);
const web3 = new Web3(provider);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => {
  //res.send(template());
  res.render("index.ejs", { message: null, success: false });
});

app.get("/send", async (req, res) => {
  try {
    let ipAddress =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    console.log(`ip address - `, ipAddress);
    const url_parts = url.parse(req.url, true);
    const query = url_parts.query;

    const from = process.env.FROM;
    const to = query.address;
    const value = web3.utils.toWei(process.env.TOKEN_AMOUNT, "ether");

    //check if this user is in cool down period
    await find(
      {
        $or: [{ wallet: query.address }]
      },
      async records => {
        console.log(records[0]);
        if (records[0] && !isAllowed(records[0].lastUpdatedOn)) {
          res.render("index.ejs", {
            message: "You have to wait 24 hours between faucet requests",
            success: false
          });
        } else {
          //insert ip address into db
          await insert(
            { ip: ipAddress, wallet: to, lastUpdatedOn: Date.now() },
            result => console.log(result)
          );

          //create token instance from abi and contract address
          const tokenInstance = new web3.eth.Contract(
            abi,
            process.env.TOKEN_CONTRACT_ADDRESS
          );

          tokenInstance.methods
            .transfer(to, value)
            .send({ from }, function(error, txHash) {
              if (!error) {
                console.log("txHash - ", txHash);
                res.render("index.ejs", {
                  message: `Great!! test OCEANs are on the way - ${txHash}`,
                  link: `https://rinkeby.etherscan.io/tx/${txHash}`,
                  success: true
                });
              } else {
                console.error(err);
              }
            });
        }
      }
    );
  } catch (err) {
    console.error(err);
  }
});

const port = process.env.PORT || 4000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/public"));
app.use(express.static(__dirname + "/public"));

app.listen(port, async () => {
  client = await connection();
  console.log("Listening on port - ", port);
});
