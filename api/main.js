const express    = require('express');
const app        = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const config = require('../api/config')
const { execFile } = require("child_process");
const pythonProc = execFile('python', ["./TextAnalysis/predict.py", "Hey I'm sad. I need help."], (error, stdout, stderr) => {
    console.log('Output');
    console.log(stdout);
});
// pythonProc.stdout.on('data', (data) => {
//     console.log(`stdout: ${data}`);
//   });
// pythonProc.on('close', (code) => {
//     console.log('DONE');
// })

// var PythonShell = require('python-shell')

const User = require('../app/models/user');
const Note = require('../app/models/note');

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'rise and grind',
    resave: true,
    saveUninitialized: false
}));

// PythonShell.run('../TextAnalysis/predict,py',(err, results)=>{
//     pyshell.send("Help me. I am sad and lonely");
// })

const addSentimentMiddleware = (req, res, next) => {
    const pythonProc = execFile('python', ["./TextAnalysis/predict.py", '"' + req.ody.body + '"'], (error, stdout, stderr) => {
        let score = stdout.substring(2, stdout.length - 2);
        console.log(`Got score of ${score}`);
        req.body.score = score;
        next();
    });
}

let port = process.env.PORT || 3000;

const router = express.Router();         

app.use('/api', router);

mongoose.connect('mongodb://127.0.0.1:27017').then(function(){
    app.listen(port);
}).catch(console.log);

pythonProc.stdout.on('data', (data) => {
    console.log('Recieved data');
    console.log(data);
});

console.log('Listening on port ' + port);

//Main API endpoint
router.get('/', function(req, res) {
    res.json({ message: 'Welcome to the API!' });   
});

//Authenticate login
router.post('/login', function(req, res) {
    console.log('Authenticating...');
    User.authenticate(req.body.email, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.status(err.status).json({message:err.message});
        } else {
            let token = jwt.sign({id:user._id}, config.secret, {
                expiresIn: 86400
            });
            res.json({message:'Logged in', token: token, auth: true, name:user.name});
        }
    });
});

//Sign up
router.route('/users').post(function(req, res) {
    let user = new User();
    user.email = req.body.email;
    if (req.body.password.length < 8) {
        console.log(req.body.password);
        res.status(400).json({message:'Password too short'});
    }
    user.password_hash = req.body.password;
    user.name = req.body.name;
    user.phoneNumber = req.body.phoneNumber;
    let token = jwt.sign({id:user._id}, config.secret, {
        expiresIn: 86400
    });
    user.token = token;
    user.save(function(err) {
        if (err)
            res.status(400).json(err);
        res.status(200).json({message: 'Created new user ' + user.email + '!', token: token, auth: true, name:user.name});
    });
});

//Create new note
router.route('/notes').post(addSentimentMiddleware, function(req, res) {

    let token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({auth:false, message:'No token'});
    jwt.verify(token, config.secret, function(err, decoded) {
        if (err) return res.status(401).send({auth: false, message:'Failed to authenticate'});
    });
    let note = new Note();
    note.body = req.body.body;
    note.date = req.body.date;
    note.score = req.body.score;
    console.log(token);
    User.getUserIDFromToken(token, function(err, user) {
        if (err) {
            res.status(400).json({message:err.message});
        }
        let today = new Date();
        console.log('From note ' + moment(req.body.date));
        let dd = today.getDate();
        let mm = today.getMonth() + 1;
        let yyyy = today.getFullYear();

        if (dd < 10) {
            dd = '0' + dd;
        }
        if (mm < 10) {
            mm = '0' + mm;
        }
        
        today = dd + '-' + mm + '-' + yyyy;
        console.log('Today ' + today);

        if (moment(req.body.date).format("DD-MM-YYYY") === today) {
            note.canEdit = true;
        } else {
            note.canEdit = false;
        }

        Note.updateRecentNote(req.body.date);

        note.save(function(err) {
            if (err) {
                res.status(400).json(err);
            }
            res.status(200).json({message:note});
        })
    });
});

//Get list of notes for a user
router.route('/notes').get(function(req, res) {
    let token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({auth:false, message:'No token'});
    jwt.verify(token, config.secret, function(err, decoded) {
        if (err) return res.status(401).send({auth: false, message:'Failed to authenticate'});
    });
    User.getUserIDFromToken(token, function(err, user) {
        if (err) {
            res.status(400).json({message:err.message});
        }
        notes = Note.getNotes(user._id, function(err, notes){
            if (err) {
                res.status(400).json({message:err.message});
            }
            arr = [...notes];
            arr.forEach(function(element) {
                if (element['body'].length >= 40) {
                    element['body'] = element['body'].substring(0, 40) + '...';
                } else {
                    element['body'] = element['body'].substring(0, 40);
                }
            });
            arr.reverse();
            res.status(200).json(arr);
        });
    });
});
 
router.route('/notes/:noteId').get(function(req, res) {
    let token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({auth:false, message:'No token'});
    jwt.verify(token, config.secret, function(err, decoded) {
        if (err) return res.status(401).send({auth: false, message:'Failed to authenticate'});
    });
    Note.getNoteFromID(req.params.noteId, function(err, note) {
        if (err) {
            res.status(400).json({message:err.message});
        }
        res.status(200).json({message:note});
    });
});

router.route('/notes/:noteId').put(addSentimentMiddleware, function(req, res) {
    let token = req.headers['x-access-token'];
    if (!token) return res.status(401).send({auth:false, message:'No token'});
    jwt.verify(token, config.secret, function(err, decoded) {
        if (err) return res.status(401).send({auth: false, message:'Failed to authenticate'});
    });
    Note.updateNote(req.params.noteId, req.body.body, req.body.score, function(err) {
        if(err) {
            res.status(400).json({message:err.message});
        } else {
            res.status(200).json({message:'Updated note'});
        }
    })
});
