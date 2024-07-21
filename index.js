var connect = require("./db");
var axios = require("axios");
var path = require("path");
const express = require('express')
const app = express()
const port = process.env.PORT || 3000;
const { Builder } = require('xml2js');
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());

var reqConnet = false

var defaultData = async () => {
    reqConnet = true;
   var client =  await connect.run();
    await client.connect();
    var db = client.db("TPGlobal");

    try {
        var data = await axios.get("https://portal.panelo.co/paneloresto/api/productlist/18");
        if(data.status != 200){
            console.log("response server error");
            return "response server error";
        }
           

        if(!data.data){
            console.log("format data response berubah");
            return "format data response berubah";
        }

        if(!data.data.products){
            console.log("format data response products berubah");
            return "format data response products berubah";
        }

        var dataExist = await db.collection("products").find({}).toArray((err, items) => items);

        if(dataExist.length == 0){
            var anu = await db.collection("products").insertMany(data.data.products);
            console.log("insert success");
        }


    }catch(err) {
        console.log(err)
        console.log("server error = >", err.response.data.message);
    }

}

var getProduct = async (category) => {
    var client =  await connect.run();
     await client.connect();
     var db = client.db("TPGlobal");
 
     try {
        var dataExist = [];
        if(typeof category == 'string'){
            if(category && category != 'All'){
                category = {name:category};
            }else{
                category = {}
            }
        }

        console.log("final query => ",category);
       
        dataExist = await db.collection("products").find(category).toArray((err, items) => items);

        return dataExist;
 
     }catch(err) {
         console.log(err)
         console.log("server error = >", err.response.data.message);
     }
 
 }
 

 if(reqConnet == false) {
    defaultData().then(() => {
        reqConnet = false
        app.set('view engine', 'ejs');

        app.get('/', async (req, res) => {
            var category = req.query.category;
            var allData = await getProduct("");
            var data = await getProduct(category);

            res.render("index", {data:data, allData:allData});
        })

        app.get('/xml', async (req, res) => {
            var category = req.query.category;

            var byCategory = await getProduct(category);

            var newArr = [];

            for(let i=0; i< byCategory.length; i++){
                for(let j=0; j < byCategory[i].products.length; j++){
                    if(j == 0){
                        byCategory[i].items = {};
                    }
                    var title = byCategory[i].products[j].title.replace(/ /g, "-");

                    byCategory[i].items[title] = byCategory[i].products[j];
                
                }

                var newObj = {
                    id:byCategory[i].id,
                    category:byCategory[i].name,
                    product:byCategory[i].items,
                    user_id:byCategory[i].user_id
                }

                newArr.push(newObj);
            }

            try {

                const rootElement = { root: newArr};
                const builder = new Builder();
                const xmlData = builder.buildObject(rootElement);

                res.setHeader('Content-Type', 'application/xml');
                res.type('application/xml');
                res.send(xmlData);
            } catch (error) {
                console.error('Error converting JSON to XML:', error);
                res.status(500).json({ error: 'Error converting JSON to XML' });
            }
        });

        app.get('/detail/:categoryId/:productId', async (req, res) => {
            var allData = await getProduct("");
            var query = {
                id:parseInt(req.params.categoryId)
            }

            var data = await getProduct(query);
            
            res.render("detail", {data:data[0], id:req.params.productId});
        });

        app.post('/edit/:categoryId/:productId', async (req, res) => {
            for(var key in req.body) {
                console.log(req.body[key])
            }

            var allData = await getProduct("");
            var query = {
                id:parseInt(req.params.categoryId)
            }

            var data = await getProduct(query);
            
            res.render("detail", {data:data[0], id:req.params.productId});
        });
    
    
        app.listen(port, () => {
            console.log(`app listening on port ${port}`)
        });

    }).catch((err) => {
        reqConnet = false
        console.log("connect db failed", err);
    });
 }else{
    console.log("server busy");
 }