const dotenv = require('dotenv').config();
const express = require('express');
const relink = require('./relinkAPI');
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const port = process.env.PORT || 3001;

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  next();
});

const connectionString = process.env.DB_CREDENTIALS;
const mongoose = require('mongoose');
mongoose.connect(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

//SCHEMAS//
const usersSchema = new mongoose.Schema({
  name: String,
  last_name: String,
  email: String,
  password: String,
  register_date: Date
});

usersSchema.methods.encryptPassword = async password => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

usersSchema.methods.validatePassword = function(password) {
  return bcrypt.compare(password, this.password);
};

const userLinks = new mongoose.Schema({
  user_id: String,
  name: String,
  url: String,
  short_link: String,
  creation_date: Date
});

// Models
const User = mongoose.model('User', usersSchema);
const Link = mongoose.model('Link', userLinks);

//Middlewares
app.use(express.json());

const requireUser = async (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({
      auth: false,
      message: 'No token provided'
    });
  }
  const decoded = jwt.verify(token, process.env.SECRET);
  req.userId = decoded.id;
  const user = await User.findById(decoded.id, { password: 0 });

  if (!user) {
    return res.status(404).send('No user found');
  }
  next();
};

// ROUTES

app.post('/sing-up', async (req, res) => {
  const { name, last_name, email, password } = req.body;

  const user = new User({
    name,
    last_name,
    email,
    password,
    register_date: new Date()
  });

  try {
    user.password = await user.encryptPassword(user.password);
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.SECRET, {
      expiresIn: 60 * 60 * 24
    });

    res.json({
      auth: true,
      token
    });
  } catch (err) {
    if (err) {
      console.log(err);
    }
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email });

  if (!user) {
    return res.status(404).send('Email not found');
  }
  const validPassword = await user.validatePassword(password);
  if (!validPassword) {
    return res.status(401).json({
      auth: false,
      token: null
    });
  }

  const token = jwt.sign({ id: user._id }, process.env.SECRET, {
    expiresIn: 60 * 60 * 24
  });

  res.json({
    auth: true,
    token
  });
});

app.post('/new-user', async (req, res) => {
  const newUser = req.body;
  try {
    const user = await User.create(newUser);
    res.json(user);
  } catch (err) {
    if (err) {
      console.log(err);
    }
  }
});

app.post('/new-link', requireUser, async (req, res) => {
  try {
    const shortLink = await relink.shortUrl(req.body);
    const newLink = {
      user_id: req.userId,
      name: req.body.name,
      url: shortLink.url,
      short_link: `https://rel.ink/${shortLink.hashid}`,
      creation_date: new Date()
    };
    const link = await Link.create(newLink);
    res.json(link);
  } catch (err) {
    if (err) {
      console.log(err);
    }
  }
});

app.get('/my-links', requireUser, async (req, res) => {
  try {
    const myLinks = await Link.find({ user_id: req.userId }).sort({
      creation_date: -1
    });
    res.json(myLinks);
  } catch (err) {
    console.log(err);
  }
});

app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
