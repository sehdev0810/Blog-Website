const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userModel = require('./models/user');
const { Post, Comment } = require('./models/post');


const app = express();

mongoose.connect('mongodb://localhost:27017/blog');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride('_method')); 
app.use(cookieParser());

const authenticateUser = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        jwt.verify(token, "secretKey", (err, decoded) => {
            if (err) {
                res.redirect('/');
            } else {
                req.user = decoded;
                next();
            }
        });
    } else {
        res.redirect('/');
    }
};

// Default route to login page
app.get('/', (req, res) => {
    res.render('login');
});

// Login route
app.post('/', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.render('login', { error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            const token = jwt.sign({ email: user.email }, "secretKey");
            res.cookie('token', token);
            return res.redirect('/posts');
        } else {
            res.render('login', { error: 'Invalid email or password' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'An error occurred' });
    }
});

// Register route
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const saltRounds = 10;

    try {
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(password, salt);
        await userModel.create({ email, password: hash });
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.redirect('/register');
    }
});

// Protected routes
app.get('/posts', authenticateUser, async (req, res) => {
    const posts = await Post.find({});
    const categories = ['Travel', 'Fashion', 'Social Media', 'Education'];
    const categorizedPosts = {};

    categories.forEach(category => {
        categorizedPosts[category] = posts.filter(post => post.category === category);
    });

    res.render('index', { categorizedPosts });
});

app.get('/posts/new', authenticateUser, (req, res) => {
    res.render('new');
});

app.post('/posts', authenticateUser, async (req, res) => {
    const { title, content, imageUrl, category } = req.body.post;
    await Post.create({ title, content, imageUrl, category });
    res.redirect('/posts');
});

app.get('/posts/:id', authenticateUser, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id).populate({
            path: 'comments',
            options: { sort: { createdAt: -1 } } // Optionally sort comments by creation date
        });
        if (!post) {
            return res.redirect('/posts'); // Handle case where post is not found
        }
        res.render('show', { post });
    } catch (err) {
        console.error(err);
        res.redirect('/posts');
    }
});

app.get('/posts/:id/edit', authenticateUser, async (req, res) => {
    const post = await Post.findOne({ _id: req.params.id }); // Using findOne with _id
    res.render('edit', { post });
});

app.put('/posts/:id', authenticateUser, async (req, res) => {
    const { title, content, imageUrl, category } = req.body.post;
    await Post.findOneAndUpdate({ _id: req.params.id }, { title, content, imageUrl, category }); // Using findOneAndUpdate with _id
    res.redirect(`/posts/${req.params.id}`);
});

app.delete('/posts/:id', authenticateUser, async (req, res) => {
    await Post.findOneAndDelete({ _id: req.params.id }); 
    res.redirect('/posts');
});

app.get('/search', authenticateUser, async (req, res) => {
    const query = req.query.q;
    const regex = new RegExp(query, 'i'); // 'i' makes the search case-insensitive
    const posts = await Post.find({
        $or: [
            { title: regex },
            { content: regex },
            { category: regex }
        ]
    });

    res.render('search', { query, posts });
});

// Add comment route
app.post('/posts/:id/comments', authenticateUser, async (req, res) => {
    const { text, author } = req.body.comment;
    const comment = new Comment({ text, author });
    await comment.save();

    const post = await Post.findById(req.params.id);
    post.comments.push(comment);
    await post.save();

    res.redirect(`/posts/${req.params.id}`);
});

// Edit comment route
app.get('/posts/:postId/comments/:commentId/edit', authenticateUser, async (req, res) => {
    const comment = await Comment.findById(req.params.commentId);
    res.render('editComment', { comment, postId: req.params.postId });
});

app.put('/posts/:postId/comments/:commentId', authenticateUser, async (req, res) => {
    const { text } = req.body.comment;
    await Comment.findByIdAndUpdate(req.params.commentId, { text });
    res.redirect(`/posts/${req.params.postId}`);
});

// Delete comment route
app.delete('/posts/:postId/comments/:commentId', authenticateUser, async (req, res) => {
    await Comment.findByIdAndDelete(req.params.commentId);
    const post = await Post.findById(req.params.postId);
    post.comments.pull(req.params.commentId);
    await post.save();
    res.redirect(`/posts/${req.params.postId}`);
});


app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
