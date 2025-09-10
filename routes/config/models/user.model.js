const mongoose =require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        lowercase: true ,
        unique: true,
        minlength: [5, 'Username must be at least 3 characters long'] },
        email: {
            type:String,
            required: true,
            trim:true,
            lowercase: true,
            minlength: [10, 'Email must be at least 10 characters long'],
        },
        password: {
            type: String,
            
            trim: true,
            minlength: [5, 'Password must be at least 5 characters long'],
        },
        role: {
            type: String,
            enum: ['user', 'creator', 'admin'],
            default: 'user'
        },
         myList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie' }] ,default: [],
         googleId: { type: [String] }
})
const user = mongoose.model("User", userSchema);
module.exports = user; 
