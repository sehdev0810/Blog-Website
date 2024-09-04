const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    text: String,
    author: String,
});

const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    imageUrl: String,
    category: String,
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }]
});

const Comment = mongoose.model('Comment', commentSchema);
const Post = mongoose.model('Post', postSchema);

module.exports = { Post, Comment };
