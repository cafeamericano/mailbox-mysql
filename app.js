let port=process.env.PORT || 9000

var express = require('express')
var path = require('path')
var mysql = require('mysql')
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var app = express()
var handlebars = require('express-handlebars')
var moment = require('moment')
//var dbkeys = require('./dbkeys')

//DEFINE DB================================================================

/*
var connection = mysql.createConnection({
  host: dbkeys.Xhost,
  user: dbkeys.Xuser,
  password: dbkeys.Xpassword,
  database: dbkeys.Xdatabase,
  dateStrings: true
});
*/

var connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "database",
    dateStrings: true
  });

//MIDDLEWARE================================================================

app.use(express.static(__dirname+'/public'));

app.use(cookieParser());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', handlebars({defaultLayout: 'standard'}))
app.set('view engine', 'handlebars');

//CONNECT TO DB================================================================

connection.connect(function(err) {
if (err) throw err;
console.log("Connected to MySQL!");

//ROUTES================================================================

//Login routes__________________________________________________________________________________________________

    //Force redirection to login route
    app.get('/', function(req, res) {
        res.redirect('/login/prompt')
    });

    //Render the login page, clear any previous cookies, and give unauthroized layout
    app.get('/login/prompt', function(req, res) {
        let cookiedUsername = req.cookies['username']
        res.clearCookie(cookiedUsername).render('_login/loginScreen', {layout: 'unauthorized'})
    });

    //Process an attempted login by the user and respond accordingly
    app.post('/login/process', function(req, res) {
        var sql = "SELECT password FROM useraccounts WHERE username ='" + req.body.username + "';"
        console.log(sql)
        connection.query(sql, function (err, result) {
            let passwordEntered = req.body.password;

            let pwArr = [];
            for (i=0; i<result.length; i++) {
                pwArr.push(result[i].password)
            }
            let passwordStored = pwArr[0];

            if (passwordEntered === passwordStored) {
                res.cookie('username', req.body.username).redirect('/login/success');
            } else {
                res.render('_login/loginFailure', {layout: 'unauthorized'})
            }
        })
    });

    //Render the page that lets the user know login was successful
    app.get('/login/success', function(req, res) {
        res.render('_login/loginSuccess', {layout: 'unauthorized'});
    });

//Account management routes__________________________________________________________________________________________________

    //Render page for new account creation
    app.get('/account/create/prompt', function(req, res) {
        res.render('_accountManagement/createNewAccount', {layout: 'unauthorized'});
    });

    //Process creation of new account given user input
    app.post('/account/create/process', function(req, res) {
        if (req.body.username === "" || req.body.email === "" || req.body.password === "" || req.body.firstname === "" || req.body.lastname === "" || req.body.city === "" || req.body.country === "") {
            res.render('_accountManagement/accountCreationFailure', {layout: 'unauthorized'})
        } else {
            let timestamp = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
            var sql = `INSERT INTO useraccounts (datejoined, username, password, email, firstname, lastname, city, state, zip, country, profilephotolink) VALUES ("${timestamp}", "${req.body.username}", "${req.body.password}", "${req.body.email}", "${req.body.firstname}", "${req.body.lastname}", "${req.body.city}", "${req.body.state}", "${req.body.zip}", "${req.body.country}", "${req.body.profilephotolink}")`
            connection.query(sql, function (err, result) {
            })
            res.render('_accountManagement/accountCreationSuccess', {layout: 'unauthorized'})
        };
    });

    //Render the page that allows the user to confirm that the account should be deleted
    app.get('/account/delete/prompt', function(req, res) {
        let x = req.cookies['username']
        res.render('_accountManagement/confirmAccountDeletion', {
            accountToBeDeleted: x
        });
    });

    //Render the page indicating that account deletion was successful, use unauthorized layout
    app.post('/account/delete/process', function(req, res) {
        var sql = `DELETE FROM useraccounts WHERE username = '${req.body.username}';`
        console.log(sql)
        connection.query(sql, function (err) {
            if (err) throw err;
            res.render('_accountManagement/accountDeletionSuccess', {layout: 'unauthorized'})
        });
    });

//Profile management routes__________________________________________________________________________________________________

    //Render the user's profiel page listing all current values
    app.get('/profile/update/prompt', function(req, res) {
        let x = req.cookies['username']
        var sql = "SELECT * FROM useraccounts WHERE username = '" + x + "';" 
        connection.query(sql, function (err, results, fields) {
            if (err) throw err;
            res.render('_profileManagement/showProfile', {
                entries: results
            });
        });
    });

    //Process confirmed updates to the user's profile
    app.post('/profile/update/process', function(req, res) {
        var sql = `UPDATE useraccounts SET profilephotolink = '${req.body.profilephotolink}', firstname = '${req.body.firstname}', lastname = '${req.body.lastname}', city = '${req.body.city}', state = '${req.body.state}', zip = '${req.body.zip}', country = '${req.body.country}' WHERE email = '${req.body.email}';`
        connection.query(sql, function (err, result) {
        })
        res.redirect('/profile/update/success')
    });

    //Render the page confirming that the user's profile updates have been accepted
    app.get('/profile/update/success', function(req, res) {
        res.render('_profileManagement/profileUpdateSuccess');
    });

//User content routes__________________________________________________________________________________________________

    //Render the page listing all entries made by the user
    app.get('/usercontent/entries/show', function(req, res) {
        let cookiedUsername = req.cookies['username']
        var sql = `SELECT * FROM messagepool WHERE sendto = "${cookiedUsername}" AND inTrash = 0 ORDER BY timestamp DESC;`
        connection.query(sql, function (err, results, fields) {
            res.render('_userContent/showEntries', {
                entries: results
            });
        });
    });

    //Render the page for creating a new entry
    app.get('/usercontent/entries/add/prompt', function(req, res) {
        let cookiedUsername = req.cookies['username']
        res.render('_userContent/createNewEntry', {
            currentUsername: cookiedUsername
        });
    });

    //Show sent messages
    app.get('/usercontent/entries/show/sent', function(req, res) {
        let cookiedUsername = req.cookies['username']
        var sql = `SELECT * FROM messagepool WHERE sentfrom = "${cookiedUsername}" ORDER BY timestamp DESC;`
        connection.query(sql, function (err, results, fields) {
            res.render('_userContent/showSentMessages', {
                entries: results
            });
        });
    });

    //Add an entry for the logged in user
    app.post('/usercontent/entries/add/process', function(req, res) {
        let timestamp = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss');
        var sql = `INSERT INTO messagepool (timestamp, sendto, sentfrom, messagecontent, inTrash) VALUES ("${timestamp}", "${req.body.sendto}", "${req.body.sentfrom}", "${req.body.messagecontent}", 0);`
        console.log(sql)
        connection.query(sql, function (err, result) {
        })
        res.render('_userContent/messageSentSuccess')
    });

    //Process send-to-trash request
    app.post('/usercontent/entries/delete/process', function(req, res) {
        var sql = `UPDATE messagepool SET inTrash = 1 WHERE ID = '${req.body.ID}';`
        console.log(sql)
        connection.query(sql, function (err) {
            if (err) throw err;
            res.redirect('/usercontent/entries/show')
        });
    });

    //Show deleted messages
    app.get('/usercontent/entries/show/deleted', function(req, res) {
        let cookiedUsername = req.cookies['username']
        var sql = `SELECT * FROM messagepool WHERE sendto = "${cookiedUsername}" AND inTrash = 1 ORDER BY timestamp DESC;`
        connection.query(sql, function (err, results, fields) {
            res.render('_userContent/showDeletedMessages', {
                entries: results
            });
        });
    });

    //Process permanent deletion request
    app.post('/usercontent/entries/deletepermanently/process', function(req, res) {
        var sql = `DELETE FROM messagepool WHERE ID = '${req.body.ID}';`
        console.log(sql)
        connection.query(sql, function (err) {
            if (err) throw err;
            res.redirect('/usercontent/entries/show/deleted')
        });
    });
    
//Logout routes__________________________________________________________________________________________________

    //Render the page confirming that the user has logged out, use the unauthorized layout
    app.get('/logout/process', function(req, res) {
        res.render('_logout/processingLogout', {layout: 'unauthorized'});
    });

    //Render the page confirming that the user has logged out, use the unauthorized layout
    app.get('/logout/success', function(req, res) {
        res.render('_logout/logoutSuccess', {layout: 'unauthorized'});
    });

//START SERVER================================================================

});

app.listen(port, function(){
    console.log(`Server listening on Port ${port}...`)
})