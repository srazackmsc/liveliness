const express       = require('express');
const path          = require('path');
const bodyParser    = require('body-parser');
const app           = express();
const port          = 3030;
//const routeAPI      = require('./routes/api');


//app.use('/static', express.static('public'));
//app.use(express.static(path.join(__dirname,'public')));
app.use(express.static(path.join(__dirname,'public')));
app.use(bodyParser.json());
//app.use('/api',routeAPI);
//app.get('/login',(req,res,next)=>{
    //res.sendFile(__dirname+'/public/index.html');
    //console.log('Login action invoked..');
//});
//app.post('/register',(req,res,next)=>{
    //console.log('Registration action invoked..'+req.data.foo);
    //res.json(req.body);
//});
app.get('*',(req,res) =>{
    res.sendFile(path.join(__dirname,'public/index.html'));
});
app.listen(port,'0.0.0.0', () => {
    console.log("Application running on Port -->"+port)
});//192.168.1.10