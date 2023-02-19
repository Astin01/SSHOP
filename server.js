const bcrypt = require("bcrypt");
const express = require("express");
const path = require("path");
const app = express();
const passport = require("passport");
const session = require("express-session");
const LocalStrategy = require("passport-local").Strategy;
const { ObjectId } = require("mongodb");

app.use(express.static("public"));
require("dotenv").config();
app.use(express.urlencoded({ extended: true }));
const MongoClient = require("mongodb").MongoClient;
app.use(express.json());
var cors = require("cors");
app.use(cors());

app.use(
  session({ secret: "비밀코드", resave: true, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, "/build")));

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "/build/index.html"));
});
var db;
MongoClient.connect(process.env.DB_URL, function (err, client) {
  if (err) return console.log(err);
  db = client.db("shop");
  app.listen(process.env.PORT, function () {
    console.log("listening on 8080");
  });
});

app.post("/signin", function (req, res) {
  const myPlaintextPassword = req.body.pw;
  const saltRounds = 10;
  bcrypt.hash(myPlaintextPassword, saltRounds, function (err, hash) {
    db.collection("login").insertOne(
      {
        id: req.body.id,
        pw: hash,
        name: req.body.name,
        address: req.body.address,
        tel: req.body.tel,
        email: req.body.email,
      },
      function (err, result) {
        console.log("저장완료");
      }
    );
  });
  res.send("전송완료");
});

app.post("/logout", function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.send("0");
  });
});
app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/fail" }),
  function (req, res) {
    res.send("1");
    console.log("성공");
  }
);

app.post("/chat", function (req, res) {
  let a = db
    .collection("chat")
    .find({ member: ObjectId(req.body.id) })
    .toArray();
  if (a) {
    a.then((result) => {
      res.send({ data: result });
    });
  } else {
    db.collection("chat").insertOne(
      {
        member: [req.user.id, "admin"],
        date: Date.now(),
        title: "chat_" + req.body.id,
      },
      function (req, result) {
        console.log("저장완료");
        res.send("완료");
      }
    );
  }
});
// app.post("/message", function (req, res) {
//   var saveChat = {
//     parent: req.body.parent,
//     userid: req.user._id,
//     content: req.body.content,
//     date: new Date(),
//   };
//   db.collection("message")
//     .insertOne(saveChat)
//     .then((result) => {
//       res.send(result);
//     });
// });
app.get("/message/:parentid", function (req, res) {
  res.writeHead(200, {
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });
  var saveChat = {
    parent: req.body.parent,
    userid: req.user._id,
    content: req.body.content,
    date: new Date(),
  };
  db.collection("message")
    .insertOne(saveChat)
    .then((result) => {
      res.send(result);
    });
  db.collection("message")
    .find({ parent: req.params.parentid })
    .toArray()
    .then((result) => {
      res.write("event: test\n");
      res.write(`data: ${JSON.stringify(result)}\n\n`);
    });
});

app.get("/cklogin", ckLogIn, function (req, res) {
  console.log(req.user);
  res.send({ user: req.user });
});

function ckLogIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.send("로그인안하셨는데요?");
  }
}

passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "pw",
      session: true,
      passReqToCallback: false,
    },
    async function (userId, password, done) {
      try {
        const user = await db.collection("login").findOne({ id: userId });
        if (!user) {
          return done(null, false, { reason: "존재하지않는 아이디입니다" });
        }
        const result = await bcrypt.compare(password, user.pw);
        if (result) {
          return done(null, user);
        }
        return done(null, false, { reason: "비밀번호가 틀립니다." });
      } catch (e) {
        console.log(e);
        return done(e);
      }
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(async function (inputid, done) {
  db.collection("login").findOne({ id: inputid.id }, function (err, result) {
    console.log(result);
    done(null, result);
  });
});

app.get("*", function (req, res) {
  res.sendFile(path.join(__dirname, "/build/index.html"));
});
