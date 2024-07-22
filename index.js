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

const fs = require('node:fs');
const { rejects } = require("assert");


var collUser = () => {
    return  new Promise((resolve, reject) => {
        var dataUser = [];
        return fs.readFile('./data_user.txt', 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            var userArr = data.split("\n");

            for(let i=0; i < userArr.length; i++) {
                if(i > 0){
                    var obj = {};

                    var title = userArr[0].replace(/\r/,"").split("|");
                    var data = userArr[i].replace(/\r/,"").split("|")
                    for(let j=1; j < 6; j++){
                        if(data[j]){
                            obj[title[j].trim()] = (!isNaN(parseInt(data[j].trim())) && title[j].trim() != 'created' ) ? parseInt(data[j].trim()) : data[j].trim();
                        }

                    }

                    if(Object.keys(obj).length  > 0) {
                        dataUser.push(obj);
                    }
                }
            }

            resolve(dataUser)
        });

    
    });
}

var defaultData = async () => {
    var dataUser = await collUser();
 
    reqConnet = true;
   var client =  await connect.run();
    await client.connect();
    var db = client.db("TPGlobal");

    var user = await db.collection("user").find({}).toArray((err, items) => items);

    if(user.length == 0){
        await db.collection("user").insertMany(dataUser);
    }

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
            try {
                var newObj = {};

                for(var key in req.body) {
                    var arr = key.split("-");

                    if(arr.length == 2){
                        if(!newObj[arr[0]]) {
                            newObj[arr[0]] = {};
                        }

                        newObj[arr[0]][arr[1]] = (!isNaN(parseInt(req.body[key])) && key != 'created_at' && key !=  'updated_at') ? parseInt(req.body[key]) : req.body[key];
                    }else{
                        newObj[key] = (!isNaN(parseInt(req.body[key])) && key != 'created_at' && key !=  'updated_at') ?  parseInt(req.body[key]) : req.body[key] ;
                    }
                }

                var query = {
                    id:parseInt(req.params.categoryId)
                }

                var productId = req.params.productId;

                var data = await getProduct(query);
                var newProducts = []

                for(let i = 0; i < data[0].products.length; i++){
                    if(data[0].products[i].id == parseInt(productId)){
                        for(var key in data[0].products[i]){
                            if(typeof newObj[key] == 'object'){
                                if(JSON.stringify(newObj[key]) != JSON.stringify(data[0].products[i][key])) {
                                    data[0].products[i][key] = newObj[key]
                                }
                            }else{
                                if(newObj[key] != data[0].products[i][key] && typeof newObj[key] != 'undefined') {
                                    data[0].products[i][key] = newObj[key]
                                }
                            }
                        }
                    }
                    newProducts.push(data[0].products[i]);
                }

                var client =  await connect.run();
                await client.connect();
                var db = client.db("TPGlobal");
          
                var dataUpdateRes  = await db.collection("products").updateOne({
                    id:parseInt(req.params.categoryId)
                }, { 
                    $set: {
                        products:newProducts
                    } 
                });
                
                res.status(200).json({});
            }catch(err){

                res.status(500).json({...err});
            }
        });
    
        app.get("/add", async(req,res) => {
            var allData = await getProduct("");

            res.render("add", {data:allData});
        });

        app.post('/add', async (req, res) => {
            try {
                var newObj = {};

                for(var key in req.body) {
                    var arr = key.split("-");

                    if(arr.length == 2){
                        if(!newObj[arr[0]]) {
                            newObj[arr[0]] = {};
                        }

                        newObj[arr[0]][arr[1]] = (!isNaN(parseInt(req.body[key])) && key != 'created_at' && key !=  'updated_at') ? parseInt(req.body[key]) : req.body[key];
                    }else{
                        newObj[key] = (!isNaN(parseInt(req.body[key])) && key != 'created_at' && key !=  'updated_at') ?  parseInt(req.body[key]) : req.body[key] ;
                    }
                }

                var query = {
                    id:parseInt(newObj.category)
                }


                var data = await getProduct(query);
                delete newObj.category;
                var id = (data[0].products[data[0].products.length -1].id) ? parseInt(data[0].products[data[0].products.length -1].id) + 1 : data[0].products.length
                newObj.id = id
                data[0].products.push(newObj);
                var client =  await connect.run();
                await client.connect();
                var db = client.db("TPGlobal");
          
                var dataUpdateRes  = await db.collection("products").updateOne(query, { 
                    $set: {
                        products: data[0].products
                    } 
                });
                
                res.status(200).json({newObj:dataUpdateRes});
            }catch(err){

                res.status(500).json({...err});
            }
        });

        app.get('/user', async (req, res) => {
            try {
                var client =  await connect.run();
                await client.connect();
                var db = client.db("TPGlobal");
                var totalData = await db.collection('user').count();
          
               var score = await db.collection('user').aggregate([{
                    $group: {
                        "_id": {
                            "score": "$score",
                        },
                        "count": {
                            "$sum": 1
                        },
                        avgQuantity: { $avg: "$score" }
                    }, 
               }]).toArray( items => items);

               var emotion = await db.collection('user').aggregate([{
                $group: {
                    "_id": {
                        "name": "$name",
                        "emotion": "$emotion",
                    },
                    "count": {
                        "$sum": 1
                    }
                }, 
                }]).toArray( items => items);
                var emotion2 = await db.collection('user').aggregate([{
                    $group: {
                        "_id": {
                            "name": "$name",
                            "emotion": "$emotion",
                            "created":"$created"
                        },
                        "count": {
                            "$sum": 1
                        }
                    }, 
                    }]).toArray( items => items);

                var total = await db.collection('user').aggregate([
                    {
                      $group: {
                        _id:'',
                        score: { $sum: "$score"},
                      }
                    }
                 ]).toArray( items => items);

                 var data = {
                    emoByName:emotion,
                    avgScore : total[0].score / totalData,
                    emotionPerDayByName:emotion2
                 }
               
                
                res.render("user", {data:data});
            }catch(err){

                res.status(500).json({...err});
            }
        });

        app.get('/delete/:categoryId/:productId', async (req, res) => {
            try {
                var query = {
                    id:parseInt(req.params.categoryId)
                }

                var productId = req.params.productId;

                var data = await getProduct(query);
                var newProducts = []

                for(let i = 0; i < data[0].products.length; i++){
                    if(data[0].products[i].id != parseInt(productId)){
                        newProducts.push(data[0].products[i]);
                    }
                    
                }

                var client =  await connect.run();
                await client.connect();
                var db = client.db("TPGlobal");
          
                var dataUpdateRes  = await db.collection("products").updateOne({
                    id:parseInt(req.params.categoryId)
                }, { 
                    $set: {
                        products:newProducts
                    } 
                });
                
                res.status(200).json({});
            }catch(err){

                res.status(500).json({...err});
            }
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